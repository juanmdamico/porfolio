/**
 * Word → PDF con alta fidelidad, sin servidor.
 *
 * 1. docx-preview dibuja el .docx en un iframe invisible, respetando fuentes, colores,
 *    alineación, tablas, listas, encabezados y pies de página.
 * 2. Se "calca" lo que dibujó el navegador: la posición exacta de cada palabra, los fondos,
 *    los bordes y las imágenes.
 * 3. pdf-lib arma el PDF con esos elementos, con texto real (seleccionable) y fuentes
 *    incrustadas que miden igual que las de Office (Arimo = Arial, Carlito = Calibri, etc.).
 */
import { nombreBase } from './util';
import { paginar, type Banda } from './paginado';

// ---------- Fuentes ----------

type Familia = 'arimo' | 'tinos' | 'cousine' | 'carlito' | 'caladea';
type Variante = `${Familia}-${400 | 700}-${'normal' | 'italic'}`;

// Vite genera un archivo por cada fuente, que se descarga solo si el documento la usa.
const ARCHIVOS_FUENTES = import.meta.glob<string>(
  '../../../node_modules/@fontsource/{arimo,tinos,cousine,carlito,caladea}/files/*-latin-{400,700}-{normal,italic}.woff2',
  { query: '?url', import: 'default' },
);

function urlFuente(v: Variante): Promise<string> {
  const [familia] = v.split('-');
  const clave = Object.keys(ARCHIVOS_FUENTES).find((k) => k.endsWith(`/${familia}/files/${familia}-latin-${v.slice(familia.length + 1)}.woff2`));
  if (!clave) throw new Error(`Falta la fuente ${v}`);
  return ARCHIVOS_FUENTES[clave]();
}

/** Elige la fuente libre que mide igual (o casi) que la del documento. */
export function familiaEquivalente(css: string): Familia {
  const f = css.toLowerCase();
  if (/calibri|aptos|segoe|candara|corbel|gill sans|trebuchet/.test(f)) return 'carlito';
  if (/cambria|georgia|garamond|book antiqua|palatino|constantia|baskerville|century/.test(f)) return 'caladea';
  if (/courier|consolas|mono|lucida console|menlo/.test(f)) return 'cousine';
  if (/times|(^|[^-])serif/.test(f.replace(/sans-serif/g, ''))) return 'tinos';
  return 'arimo';
}

const NOMBRE_CSS = (v: Variante) => `cv-${v}`;

// ---------- Viñetas y numeración ----------

/** Las viñetas de Word suelen usar caracteres privados de la fuente Symbol/Wingdings. */
const VINIETAS: Record<string, string> = {
  '': '•', '': '▪', '': '❖', '': '➢', '': '✓', '': '○', '': '○', '': '■', '': '❑',
};

function romano(n: number): string {
  const tabla: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let r = '';
  for (const [v, s] of tabla) while (n >= v) [r, n] = [r + s, n - v];
  return r;
}

function letra(n: number): string {
  let r = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) r = String.fromCharCode(97 + ((n - 1) % 26)) + r;
  return r;
}

export function formatearNumero(n: number, formato: string): string {
  switch (formato) {
    case 'lowerLetter': return letra(n);
    case 'upperLetter': return letra(n).toUpperCase();
    case 'lowerRoman': return romano(n);
    case 'upperRoman': return romano(n).toUpperCase();
    case 'decimalZero': return String(n).padStart(2, '0');
    case 'none': return '';
    case 'bullet': return '';
    default: return String(n);
  }
}

interface Numeracion {
  id: string;
  level: number;
  start: number;
  levelText?: string;
  format: string;
  suff?: string;
}

/**
 * docx-preview dibuja los números de las listas con contadores de CSS (::before), que
 * no existen como texto en la página. Acá se calculan igual que lo hace el CSS y se
 * insertan como texto real, con el mismo estilo.
 */
function materializarNumeracion(doc: Document, numeraciones: Numeracion[], clase: string) {
  const porClase = new Map(numeraciones.map((n) => [`${clase}-num-${n.id}-${n.level}`, n]));
  const contadores = new Map<string, number>();
  for (const n of numeraciones) contadores.set(`${n.id}-${n.level}`, n.start - 1);

  for (const p of doc.querySelectorAll<HTMLElement>('p')) {
    const num = [...p.classList].map((c) => porClase.get(c)).find(Boolean);
    if (!num) continue;
    const clave = `${num.id}-${num.level}`;
    contadores.set(clave, (contadores.get(clave) ?? 0) + 1);
    // Un ítem de un nivel reinicia los niveles de abajo.
    for (const otra of numeraciones) {
      if (otra.id === num.id && otra.level === num.level + 1) contadores.set(`${otra.id}-${otra.level}`, otra.start - 1);
    }
    let texto = (num.levelText ?? '').replace(/%(\d)/g, (_, k) => {
      const nivel = Number(k) - 1;
      const def = numeraciones.find((x) => x.id === num.id && x.level === nivel);
      return formatearNumero(contadores.get(`${num.id}-${nivel}`) ?? 1, def?.format ?? 'decimal');
    });
    texto = [...texto].map((c) => VINIETAS[c] ?? c).join('');
    const ventana = doc.defaultView!;
    const antes = ventana.getComputedStyle(p, '::before');
    if (!texto && num.format !== 'bullet') continue;
    const marca = doc.createElement('span');
    marca.textContent = (texto || '•') + (num.suff === 'nothing' ? '' : ' ');
    for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'display', 'width', 'minWidth', 'paddingRight', 'marginRight'] as const) {
      marca.style[prop] = antes[prop];
    }
    if (VINIETAS[num.levelText ?? ''] || /symbol|wingdings/i.test(antes.fontFamily)) marca.style.fontFamily = 'inherit';
    marca.dataset.marcador = '';
    p.classList.add('cv-sin-marcador');
    p.prepend(marca);
  }
}

// ---------- Calco del documento dibujado ----------

type RGB = [number, number, number];

interface Palabra {
  texto: string;
  x: number;
  base: number; // línea base, en px desde el tope de la sección
  arriba: number;
  abajo: number;
  tamano: number; // px
  variante: Variante;
  color: RGB;
  opacidad: number;
  subrayado: boolean;
  tachado: boolean;
}

interface Rect {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

interface Fondo extends Rect {
  color: RGB;
  opacidad: number;
}

interface Trazo {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  grosor: number;
  color: RGB;
  estilo: string;
}

interface Imagen extends Rect {
  elemento: HTMLImageElement;
}

interface Capa {
  palabras: Palabra[];
  fondos: Fondo[];
  trazos: Trazo[];
  imagenes: Imagen[];
}

const capaVacia = (): Capa => ({ palabras: [], fondos: [], trazos: [], imagenes: [] });

function parsearColor(css: string): { rgb: RGB; alfa: number } | null {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = '1'] = m[1].split(/[\s,/]+/).filter(Boolean);
  const alfa = Number(a);
  if (alfa === 0) return null;
  return { rgb: [Number(r), Number(g), Number(b)], alfa };
}

function calcar(raiz: Element, origen: DOMRect, excluir: Element[] = []): Capa {
  const doc = raiz.ownerDocument;
  const ventana = doc.defaultView!;
  const capa = capaVacia();
  const dentroDeExcluido = (n: Node) => excluir.some((e) => e.contains(n));
  const rel = (r: DOMRect): Rect => ({ x: r.left - origen.left, y: r.top - origen.top, ancho: r.width, alto: r.height });

  // Fondos, bordes e imágenes.
  for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
    if (dentroDeExcluido(el) && !excluir.includes(el)) continue;
    if (excluir.includes(el)) continue;
    const cs = ventana.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const caja = el.getBoundingClientRect();
    if (!caja.width && !caja.height) continue;
    const r = rel(caja);
    if (el !== raiz && el.tagName !== 'SECTION') {
      const fondo = parsearColor(cs.backgroundColor);
      if (fondo && !(fondo.rgb.every((v) => v > 250) && fondo.alfa === 1 && el.tagName === 'ARTICLE')) {
        capa.fondos.push({ ...r, color: fondo.rgb, opacidad: fondo.alfa });
      }
    }
    const lados = [
      ['Top', r.x, r.y, r.x + r.ancho, r.y],
      ['Bottom', r.x, r.y + r.alto, r.x + r.ancho, r.y + r.alto],
      ['Left', r.x, r.y, r.x, r.y + r.alto],
      ['Right', r.x + r.ancho, r.y, r.x + r.ancho, r.y + r.alto],
    ] as const;
    for (const [lado, x1, y1, x2, y2] of lados) {
      const grosor = parseFloat(cs[`border${lado}Width`]);
      const estilo = cs[`border${lado}Style`];
      const color = parsearColor(cs[`border${lado}Color`]);
      if (grosor > 0 && estilo !== 'none' && estilo !== 'hidden' && color) {
        // El trazo va por el medio del borde.
        const d = grosor / 2;
        const [dx, dy] = lado === 'Top' ? [0, d] : lado === 'Bottom' ? [0, -d] : lado === 'Left' ? [d, 0] : [-d, 0];
        capa.trazos.push({ x1: x1 + dx, y1: y1 + dy, x2: x2 + dx, y2: y2 + dy, grosor, color: color.rgb, estilo });
      }
    }
    if (el instanceof ventana.HTMLImageElement && el.complete && el.naturalWidth) capa.imagenes.push({ ...r, elemento: el });
  }

  // Texto: cada palabra con su posición exacta.
  const recorrido = doc.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const rango = doc.createRange();
  for (let nodo = recorrido.nextNode() as Text | null; nodo; nodo = recorrido.nextNode() as Text | null) {
    if (dentroDeExcluido(nodo) || !nodo.data.trim()) continue;
    const padre = nodo.parentElement!;
    const cs = ventana.getComputedStyle(padre);
    if (cs.visibility === 'hidden') continue;
    const color = parsearColor(cs.color) ?? { rgb: [0, 0, 0] as RGB, alfa: 1 };
    const tamano = parseFloat(cs.fontSize);
    const variante = cs.fontFamily.replace(/["']/g, '').split(',')[0].replace(/^cv-/, '') as Variante;
    const decoracion = cs.textDecorationLine;
    const transformar = (t: string) => (cs.textTransform === 'uppercase' ? t.toUpperCase() : cs.textTransform === 'lowercase' ? t.toLowerCase() : t);
    for (const m of nodo.data.matchAll(/\S+/g)) {
      rango.setStart(nodo, m.index!);
      rango.setEnd(nodo, m.index! + m[0].length);
      const rects = [...rango.getClientRects()].filter((r) => r.width > 0);
      if (!rects.length) continue;
      if (rects.length === 1) {
        const r = rel(rects[0]);
        capa.palabras.push({
          texto: transformar(m[0]), x: r.x, base: 0, arriba: r.y, abajo: r.y + r.alto, tamano, variante,
          color: color.rgb, opacidad: color.alfa, subrayado: decoracion.includes('underline'), tachado: decoracion.includes('line-through'),
        });
      } else {
        // La palabra quedó partida en dos renglones (p. ej. con guion): letra por letra.
        for (let k = 0; k < m[0].length; k++) {
          rango.setStart(nodo, m.index! + k);
          rango.setEnd(nodo, m.index! + k + 1);
          const rl = rango.getClientRects()[0];
          if (!rl || !rl.width) continue;
          const r = rel(rl);
          capa.palabras.push({
            texto: transformar(m[0][k]), x: r.x, base: 0, arriba: r.y, abajo: r.y + r.alto, tamano, variante,
            color: color.rgb, opacidad: color.alfa, subrayado: decoracion.includes('underline'), tachado: decoracion.includes('line-through'),
          });
        }
      }
    }
  }
  return capa;
}

// ---------- Conversión ----------

export interface ResultadoWordAPdf {
  blob: Blob;
  nombre: string;
  avisos: string[];
  paginas: number;
}

export async function wordAPdf(archivo: File): Promise<ResultadoWordAPdf> {
  const [{ renderAsync }, pdfLib, fontkitMod] = await Promise.all([
    import('docx-preview'),
    import('pdf-lib'),
    import('@pdf-lib/fontkit'),
  ]);
  const { PDFDocument, rgb, LineCapStyle } = pdfLib;
  const fontkit = (fontkitMod as any).default ?? fontkitMod;
  const avisos: string[] = [];

  // Iframe invisible: aísla los estilos del documento de los del sitio.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;left:-20000px;top:0;width:1400px;height:1000px;border:0;visibility:hidden';
  document.body.append(iframe);
  try {
    const doc = iframe.contentDocument!;
    const ventana = iframe.contentWindow!;
    doc.open();
    doc.write('<!doctype html><html><head><style>body{margin:0}.cv-sin-marcador::before{content:none!important}.cv-sin-marcador{list-style:none!important}</style><style id="docx"></style></head><body><div id="docx"></div></body></html>');
    doc.close();

    let documento: any;
    try {
      documento = await renderAsync(await archivo.arrayBuffer(), doc.querySelector('div#docx') as HTMLElement, doc.querySelector('style#docx')!.parentElement as HTMLElement, {
        className: 'docx',
        inWrapper: false,
        breakPages: true,
        // Word guarda dónde terminó cada página: se respeta para que las hojas coincidan.
        ignoreLastRenderedPageBreak: false,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        useBase64URL: true,
        experimental: true,
      });
    } catch {
      throw new Error(`${archivo.name}: no es un documento de Word válido.`);
    }

    materializarNumeracion(doc, documento?.numberingPart?.domNumberings ?? [], 'docx');

    // Cada elemento pasa a usar la fuente libre equivalente, en su peso y estilo. Primero se
    // leen todas (si se cambiara la del padre antes, los hijos heredarían la nueva).
    const usadas = new Set<Variante>();
    const originales = new Set<string>();
    const elementos = [...doc.querySelectorAll<HTMLElement>('div#docx *')];
    const asignaciones = elementos.map((el) => {
      const cs = ventana.getComputedStyle(el);
      const variante: Variante = `${familiaEquivalente(cs.fontFamily)}-${Number(cs.fontWeight) >= 600 ? 700 : 400}-${cs.fontStyle === 'normal' ? 'normal' : 'italic'}`;
      const tieneTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (tieneTexto) {
        usadas.add(variante);
        originales.add(cs.fontFamily.replace(/["']/g, '').split(',')[0].trim());
      }
      return variante;
    });
    elementos.forEach((el, i) => {
      el.style.fontFamily = NOMBRE_CSS(asignaciones[i]);
      el.style.fontWeight = 'normal';
      el.style.fontStyle = 'normal';
      el.style.fontSynthesis = 'none';
    });

    // Carga las fuentes en el iframe (para medir) y en el PDF (para dibujar).
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    pdf.setTitle(nombreBase(archivo.name));
    pdf.setCreator('Conversor de archivos');
    const fuentesPdf = new Map<Variante, any>();
    const metricas = new Map<Variante, { ascenso: number; descenso: number }>();
    await Promise.all(
      [...usadas].map(async (v) => {
        const datos = await (await fetch(await urlFuente(v))).arrayBuffer();
        const cara = new (ventana as unknown as typeof globalThis).FontFace(NOMBRE_CSS(v), datos);
        await cara.load();
        doc.fonts.add(cara);
        const fuente = await pdf.embedFont(datos, { subset: false });
        fuentesPdf.set(v, fuente);
        const fk = (fuente as any).embedder.font;
        metricas.set(v, { ascenso: fk.ascent / fk.unitsPerEm, descenso: -fk.descent / fk.unitsPerEm });
      }),
    );
    await doc.fonts.ready;
    // Arial, Calibri, Cambria, Times y Courier tienen equivalentes que miden igual; el resto, parecidas.
    const sinEquivalente = [...originales].filter(
      (f) => f && !/^(arial|helvetica|calibri|cambria|times new roman|times|courier new|courier|symbol|wingdings)$/i.test(f),
    );
    if (sinEquivalente.length) avisos.push(`Fuentes reemplazadas por otras parecidas: ${sinEquivalente.slice(0, 4).join(', ')}.`);

    const PT = 0.75; // 1 px de CSS = 0,75 pt
    const color = (c: RGB) => rgb(c[0] / 255, c[1] / 255, c[2] / 255);
    const pendientes: { pagina: any; imagen: Imagen; y: number }[] = [];
    let totalPaginas = 0;

    for (const seccion of doc.querySelectorAll<HTMLElement>('section.docx')) {
      const cs = ventana.getComputedStyle(seccion);
      const caja = seccion.getBoundingClientRect();
      const anchoPag = caja.width;
      const altoPag = parseFloat(cs.minHeight) || caja.width * 1.414;
      const margenArriba = parseFloat(cs.paddingTop);
      const margenAbajo = parseFloat(cs.paddingBottom);
      const encabezado = seccion.querySelector(':scope > header');
      const pie = seccion.querySelector(':scope > footer');

      const cuerpo = calcar(seccion, caja, [encabezado, pie].filter(Boolean) as Element[]);
      const capaEncabezado = encabezado ? calcar(encabezado, caja) : capaVacia();
      const capaPie = pie ? calcar(pie, caja) : capaVacia();
      // El pie se dibujó al final de la sección; en cada hoja va pegado al borde inferior.
      const moverPie = altoPag - caja.height;

      // Línea base de cada palabra, con las métricas de su fuente.
      for (const c of [cuerpo, capaEncabezado, capaPie]) {
        for (const p of c.palabras) {
          const m = metricas.get(p.variante) ?? { ascenso: 0.9, descenso: 0.2 };
          const contenido = (m.ascenso + m.descenso) * p.tamano;
          p.base = p.arriba + (p.abajo - p.arriba - contenido) / 2 + m.ascenso * p.tamano;
        }
      }

      // Franjas que no se pueden cortar: renglones, imágenes y filas de tablas.
      const bandas: Banda[] = [
        ...cuerpo.palabras.map((p) => ({ arriba: p.arriba, abajo: p.abajo })),
        ...cuerpo.imagenes.map((i) => ({ arriba: i.y, abajo: i.y + i.alto })),
        ...[...seccion.querySelectorAll('article tr')].map((tr) => {
          const r = tr.getBoundingClientRect();
          return { arriba: r.top - caja.top, abajo: r.bottom - caja.top };
        }),
      ];
      const cortes = paginar(bandas, margenArriba, altoPag - margenAbajo);

      for (let k = 0; k < cortes.length; k++) {
        const pagina = pdf.addPage([anchoPag * PT, altoPag * PT]);
        totalPaginas++;
        // Tramo del flujo que corresponde a esta hoja, y cuánto hay que subirlo.
        const lo = k === 0 ? -Infinity : cortes[k];
        const hi = k + 1 < cortes.length ? cortes[k + 1] : Infinity;
        const mover = margenArriba - cortes[k];
        const Y = (y: number) => (altoPag - y) * PT;

        const dibujar = (c: Capa, dy: number, recortar: boolean) => {
          const desde = recortar ? lo : -Infinity;
          const hasta = recortar ? hi : Infinity;
          for (const f of c.fondos) {
            const a = Math.max(f.y, desde);
            const b = Math.min(f.y + f.alto, hasta);
            if (b <= a) continue;
            pagina.drawRectangle({ x: f.x * PT, y: Y(b + dy), width: f.ancho * PT, height: (b - a) * PT, color: color(f.color), opacity: f.opacidad });
          }
          for (const t of c.trazos) {
            let [y1, y2] = [t.y1, t.y2];
            if (y1 === y2) {
              if (y1 < desde - 0.5 || y1 > hasta + 0.5) continue;
            } else {
              [y1, y2] = [Math.max(Math.min(t.y1, t.y2), desde), Math.min(Math.max(t.y1, t.y2), hasta)];
              if (y2 <= y1) continue;
            }
            const guiones = t.estilo === 'dashed' ? [t.grosor * 3, t.grosor * 2] : t.estilo === 'dotted' ? [t.grosor, t.grosor * 1.5] : undefined;
            pagina.drawLine({
              start: { x: t.x1 * PT, y: Y(y1 + dy) },
              end: { x: t.x2 * PT, y: Y(y2 + dy) },
              thickness: Math.max(t.grosor * PT, 0.25),
              color: color(t.color),
              dashArray: guiones?.map((g) => g * PT),
              lineCap: t.estilo === 'dotted' ? LineCapStyle.Round : undefined,
            });
          }
          // Palabras e imágenes van en la hoja donde queda su centro.
          const aca = (arriba: number, abajo: number) => (arriba + abajo) / 2 >= desde && (arriba + abajo) / 2 < hasta;
          for (const imagen of c.imagenes) if (aca(imagen.y, imagen.y + imagen.alto)) pendientes.push({ pagina, imagen, y: imagen.y + dy });
          for (const p of c.palabras) {
            if (!aca(p.arriba, p.abajo)) continue;
            const fuente = fuentesPdf.get(p.variante);
            if (!fuente) continue;
            const tamano = p.tamano * PT;
            const x = p.x * PT;
            const y = Y(p.base + dy);
            pagina.drawText(p.texto, { x, y, size: tamano, font: fuente, color: color(p.color), opacity: p.opacidad });
            const ancho = fuente.widthOfTextAtSize(p.texto, tamano);
            if (p.subrayado) pagina.drawLine({ start: { x, y: y - tamano * 0.12 }, end: { x: x + ancho, y: y - tamano * 0.12 }, thickness: tamano * 0.06, color: color(p.color) });
            if (p.tachado) pagina.drawLine({ start: { x, y: y + tamano * 0.3 }, end: { x: x + ancho, y: y + tamano * 0.3 }, thickness: tamano * 0.06, color: color(p.color) });
          }
        };

        dibujar(cuerpo, mover, true);
        dibujar(capaEncabezado, 0, false);
        dibujar(capaPie, moverPie, false);
      }
    }

    // Imágenes: PNG y JPG se incrustan tal cual; el resto se pasa a PNG con un canvas.
    const cache = new Map<string, any>();
    for (const { pagina, imagen, y } of pendientes) {
      const src = imagen.elemento.src;
      let img = cache.get(src);
      if (!img) {
        try {
          if (/^data:image\/png/.test(src)) img = await pdf.embedPng(await (await fetch(src)).arrayBuffer());
          else if (/^data:image\/jpe?g/.test(src)) img = await pdf.embedJpg(await (await fetch(src)).arrayBuffer());
          else {
            const canvas = document.createElement('canvas');
            canvas.width = imagen.elemento.naturalWidth;
            canvas.height = imagen.elemento.naturalHeight;
            canvas.getContext('2d')!.drawImage(imagen.elemento, 0, 0);
            img = await pdf.embedPng(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer());
          }
          cache.set(src, img);
        } catch {
          avisos.push('Se omitió una imagen que no se pudo leer.');
          continue;
        }
      }
      pagina.drawImage(img, { x: imagen.x * PT, y: pagina.getHeight() - (y + imagen.alto) * PT, width: imagen.ancho * PT, height: imagen.alto * PT });
    }

    const bytes = await pdf.save();
    return { blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), nombre: `${nombreBase(archivo.name)}.pdf`, avisos: [...new Set(avisos)], paginas: totalPaginas };
  } finally {
    iframe.remove();
  }
}

