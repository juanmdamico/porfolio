import { nombreBase } from './util';
import { reconstruir, type Fragmento, type Tramo, type Documento, type Regla } from './reconstruccion';

export interface ResultadoDocumento {
  blob: Blob;
  nombre: string;
  avisos: string[];
}

const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function tipoDocumento(archivo: File): 'docx' | 'pdf' | 'doc' | null {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith('.docx') || archivo.type === TIPO_DOCX) return 'docx';
  if (nombre.endsWith('.pdf') || archivo.type === 'application/pdf') return 'pdf';
  if (nombre.endsWith('.doc')) return 'doc';
  return null;
}

// ---------- Word → PDF ----------

// Vive en su propio módulo (word-a-pdf.ts): dibuja el documento y lo calca a PDF.
export { wordAPdf } from './word-a-pdf';

// ---------- PDF → Word ----------

async function cargarPdfjs() {
  // Build "legacy" de pdf.js: incluye compatibilidad con navegadores que todavía no
  // tienen las funciones de JavaScript más nuevas (la build normal falla en ellos).
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: worker } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
}

type RGB = [number, number, number];
const hex = ([r, g, b]: RGB) => [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const distancia = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/**
 * El texto de un PDF no trae su color: se dibuja la página y se mira de qué color
 * quedaron los píxeles de cada fragmento (y cuál es el fondo alrededor).
 */
function muestreadorDeColores(datos: Uint8ClampedArray, ancho: number, alto: number) {
  const pixel = (x: number, y: number): RGB => {
    const i = (y * ancho + x) * 4;
    return [datos[i], datos[i + 1], datos[i + 2]];
  };
  return (x0: number, y0: number, x1: number, y1: number): { color: string | null; fondo: string | null } => {
    [x0, x1] = [Math.max(0, Math.floor(Math.min(x0, x1))), Math.min(ancho - 1, Math.ceil(Math.max(x0, x1)))];
    [y0, y1] = [Math.max(0, Math.floor(Math.min(y0, y1))), Math.min(alto - 1, Math.ceil(Math.max(y0, y1)))];
    if (x1 - x0 < 1 || y1 - y0 < 1) return { color: null, fondo: null };

    // Fondo: el color más repetido en el borde del recuadro.
    const cuenta = new Map<string, { n: number; rgb: RGB }>();
    const contar = (x: number, y: number) => {
      const rgb = pixel(x, y);
      const clave = rgb.map((v) => v >> 3).join(',');
      const c = cuenta.get(clave) ?? { n: 0, rgb };
      c.n++;
      cuenta.set(clave, c);
    };
    for (let x = x0; x <= x1; x++) [contar(x, y0), contar(x, y1)];
    for (let y = y0; y <= y1; y++) [contar(x0, y), contar(x1, y)];
    const fondo = [...cuenta.values()].sort((a, b) => b.n - a.n)[0].rgb;

    // Texto: los píxeles más distintos del fondo (el centro de los trazos, sin el antialiasing).
    const tinta: { d: number; rgb: RGB }[] = [];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const rgb = pixel(x, y);
        const d = distancia(rgb, fondo);
        if (d > 90) tinta.push({ d, rgb });
      }
    let color: string | null = null;
    if (tinta.length) {
      tinta.sort((a, b) => b.d - a.d);
      const mejores = tinta.slice(0, Math.max(1, Math.ceil(tinta.length * 0.3)));
      const prom: RGB = [0, 1, 2].map((k) => mejores.reduce((s, t) => s + t.rgb[k], 0) / mejores.length) as RGB;
      // Casi negro o gris muy oscuro sin tinte = color "automático".
      const oscuro = Math.max(...prom) < 70 && Math.max(...prom) - Math.min(...prom) < 25;
      color = oscuro ? null : hex(prom);
    }
    const blanco = Math.min(...fondo) > 242;
    return { color, fondo: blanco ? null : hex(fondo) };
  };
}

/**
 * Busca líneas horizontales dibujadas (separadores, subrayados de encabezado): tramos
 * largos y finos de un mismo color que no es blanco. Las franjas gruesas (fondos) no cuentan.
 */
function detectarReglas(datos: Uint8ClampedArray, ancho: number, alto: number): { y: number; x0: number; x1: number; color: RGB }[] {
  const minimo = ancho * 0.25;
  const filas: { y: number; x0: number; x1: number; color: RGB }[] = [];
  for (let y = 0; y < alto; y++) {
    let x = 0;
    while (x < ancho) {
      const i = (y * ancho + x) * 4;
      const color: RGB = [datos[i], datos[i + 1], datos[i + 2]];
      if (Math.min(...color) > 235) {
        x++;
        continue;
      }
      let fin = x + 1;
      while (fin < ancho) {
        const j = (y * ancho + fin) * 4;
        if (distancia([datos[j], datos[j + 1], datos[j + 2]], color) > 40) break;
        fin++;
      }
      if (fin - x >= minimo) filas.push({ y, x0: x, x1: fin, color });
      x = fin;
    }
  }
  // Une filas consecutivas del mismo tramo y descarta las demasiado gruesas.
  const reglas: { y: number; x0: number; x1: number; color: RGB; grosor: number }[] = [];
  for (const f of filas) {
    const previa = reglas.find((r) => f.y === r.y + r.grosor && Math.abs(r.x0 - f.x0) < 4 && Math.abs(r.x1 - f.x1) < 4);
    if (previa) previa.grosor++;
    else reglas.push({ ...f, grosor: 1 });
  }
  return reglas.filter((r) => r.grosor <= 6).map(({ y, x0, x1, color, grosor }) => ({ y: y + grosor / 2, x0, x1, color }));
}

export async function extraerFragmentos(
  datos: ArrayBuffer,
  progreso?: (pagina: number, total: number) => void,
): Promise<{ fragmentos: Fragmento[]; reglas: Regla[]; paginas: number; tamanoPagina: { ancho: number; alto: number } }> {
  const pdfjs = await cargarPdfjs();
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(datos) }).promise;
  } catch (e) {
    if ((e as Error).name === 'PasswordException') throw new Error('El PDF está protegido con contraseña.');
    throw new Error('No se pudo leer el PDF.');
  }

  const fragmentos: Fragmento[] = [];
  const reglas: Regla[] = [];
  let tamanoPagina = { ancho: 595.28, alto: 841.89 };
  const ESCALA = 2;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  for (let n = 1; n <= pdf.numPages; n++) {
    progreso?.(n, pdf.numPages);
    const pagina = await pdf.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    if (n === 1) tamanoPagina = { ancho: base.width, alto: base.height };
    const contenido = await pagina.getTextContent();

    // Dibuja la página para leer los colores (y de paso carga las fuentes).
    const vista = pagina.getViewport({ scale: ESCALA });
    canvas.width = Math.ceil(vista.width);
    canvas.height = Math.ceil(vista.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvas, canvasContext: ctx, viewport: vista }).promise;
    const pixeles = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const muestrear = muestreadorDeColores(pixeles, canvas.width, canvas.height);
    for (const r of detectarReglas(pixeles, canvas.width, canvas.height)) {
      const [x0, y] = vista.convertToPdfPoint(r.x0, r.y);
      const [x1] = vista.convertToPdfPoint(r.x1, r.y);
      reglas.push({ pagina: n, y, x0, x1, color: hex(r.color) });
    }

    const estilos = new Map<string, { negrita: boolean; cursiva: boolean; fuente: string }>();
    const estiloDe = (id: string) => {
      if (!estilos.has(id)) {
        let datosFuente: any = {};
        try {
          datosFuente = pagina.commonObjs.get(id) ?? {};
        } catch {}
        const nombre: string = datosFuente.name ?? '';
        const familia = `${contenido.styles[id]?.fontFamily ?? ''} ${nombre}`;
        estilos.set(id, {
          negrita: Boolean(datosFuente.bold || datosFuente.black) || /bold|black|heavy|semibold|demi|medium/i.test(familia),
          cursiva: Boolean(datosFuente.italic) || /italic|oblique/i.test(familia),
          fuente: nombre || contenido.styles[id]?.fontFamily || '',
        });
      }
      return estilos.get(id)!;
    };

    for (const item of contenido.items) {
      if (!('str' in item) || !item.str) continue;
      const [a, b, c, d, x, y] = item.transform;
      const tamano = Math.hypot(c, d) || Math.hypot(a, b);
      const estilo = estiloDe(item.fontName);
      let color: string | null = null;
      let fondo: string | null = null;
      if (item.str.trim()) {
        // Recuadro del fragmento: desde un poco debajo de la línea base hasta la altura de las mayúsculas.
        const [px0, py0] = vista.convertToViewportPoint(x, y - tamano * 0.25);
        const [px1, py1] = vista.convertToViewportPoint(x + item.width, y + tamano * 0.85);
        ({ color, fondo } = muestrear(px0, py0, px1, py1));
      }
      fragmentos.push({ texto: item.str, x, y, ancho: item.width, tamano, pagina: n, color, fondo, ...estilo });
    }
    pagina.cleanup();
  }
  return { fragmentos, reglas, paginas: pdf.numPages, tamanoPagina };
}

export async function documentoADocx(documento: Documento, titulo: string, tamanoPagina: { ancho: number; alto: number }): Promise<Blob> {
  const d = await import('docx');
  const { Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, Table, TableRow, TableCell, WidthType, ShadingType, VerticalAlign, BorderStyle, HeightRule } = d;
  const TW = 20; // twips por punto
  const niveles = { titulo1: HeadingLevel.HEADING_1, titulo2: HeadingLevel.HEADING_2, titulo3: HeadingLevel.HEADING_3 } as const;
  const alineaciones = {
    izquierda: AlignmentType.LEFT,
    centro: AlignmentType.CENTER,
    derecha: AlignmentType.RIGHT,
    justificado: AlignmentType.JUSTIFIED,
  } as const;
  const cuerpo = documento.cuerpo;

  const corridas = (tramos: Tramo[]) =>
    tramos.map(
      (t) =>
        new TextRun({
          text: t.texto,
          bold: t.negrita,
          italics: t.cursiva || undefined,
          size: t.tamano ? Math.round(t.tamano * 2) : undefined,
          // Los títulos de Word traen su propio color; se fuerza el del PDF (negro si no tenía).
          color: t.color ?? '000000',
          font: documento.fuente ?? undefined,
        }),
    );

  const hijos = documento.bloques.flatMap((b) => {
    if (b.tipo === 'tabla') {
      const total = b.anchos.reduce((x, y) => x + y, 0);
      const borde = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
      const tabla = new Table({
        width: { size: Math.round(total * TW), type: WidthType.DXA },
        columnWidths: b.anchos.map((a) => Math.round(a * TW)),
        alignment: b.centrada ? AlignmentType.CENTER : AlignmentType.LEFT,
        borders: { top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde },
        rows: b.filas.map(
          (fila, i) =>
            new TableRow({
              tableHeader: i === 0,
              height: { value: Math.round(b.altoFila * TW), rule: HeightRule.ATLEAST },
              children: fila.map(
                (celda, k) =>
                  new TableCell({
                    width: { size: Math.round(b.anchos[k] * TW), type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 0, bottom: 0, left: 100, right: 100 },
                    shading: celda?.fondo ? { fill: celda.fondo, type: ShadingType.CLEAR, color: 'auto' } : undefined,
                    children: [
                      new Paragraph({
                        alignment: alineaciones[celda?.alineacion ?? 'izquierda'],
                        children: corridas(celda?.tramos ?? []),
                      }),
                    ],
                  }),
              ),
            }),
        ),
      });
      // Word no permite "salto antes" en una tabla: se agrega un párrafo con salto de página.
      return b.saltoAntes ? [new Paragraph({ pageBreakBefore: true, spacing: { after: 0 } }), tabla] : [tabla];
    }

    // Interlineado: Word mide el "simple" como ~1,15 × tamaño de letra.
    const tamano = b.tramos.find((t) => t.tamano)?.tamano ?? cuerpo;
    const interlineado = b.interlineado ? { line: Math.round((240 * b.interlineado) / (tamano * 1.15)) } : {};
    const comun = {
      children: corridas(b.tramos),
      alignment: alineaciones[b.alineacion],
      border: b.lineaDebajo ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: b.lineaDebajo, space: 8 } } : undefined,
      pageBreakBefore: b.saltoAntes || undefined,
    };
    if (b.tipo === 'vinieta') return new Paragraph({ ...comun, numbering: { reference: 'vinietas', level: 0 }, spacing: { after: 60, ...interlineado } });
    if (b.tipo === 'numerado')
      return new Paragraph({ ...comun, numbering: { reference: 'numeros', level: 0, instance: b.lista ?? 0 }, spacing: { after: 60, ...interlineado } });
    if (b.tipo in niveles)
      return new Paragraph({ ...comun, heading: niveles[b.tipo as keyof typeof niveles], spacing: { before: 200, after: 80, ...interlineado } });
    return new Paragraph({ ...comun, spacing: { after: 140, ...interlineado } });
  });

  const lista = (formato: (typeof LevelFormat)[keyof typeof LevelFormat], texto: string) => ({
    levels: [{ level: 0, format: formato, text: texto, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  });

  // Márgenes y tamaño de hoja copiados del PDF.
  const { izquierda, derecha, arriba } = documento.limites;
  const margen = (pt: number) => Math.round(Math.min(Math.max(pt, 18), 144) * TW);
  const doc = new d.Document({
    title: titulo,
    creator: 'Conversor de archivos',
    styles: {
      default: {
        document: { run: { font: documento.fuente ?? 'Calibri', size: Math.round(cuerpo * 2) } },
        heading1: { run: { color: '000000' } },
        heading2: { run: { color: '000000' } },
        heading3: { run: { color: '000000' } },
      },
    },
    numbering: {
      config: [
        { reference: 'vinietas', ...lista(LevelFormat.BULLET, '•') },
        { reference: 'numeros', ...lista(LevelFormat.DECIMAL, '%1.') },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(tamanoPagina.ancho * TW), height: Math.round(tamanoPagina.alto * TW) },
            margin: {
              left: margen(izquierda),
              right: margen(tamanoPagina.ancho - derecha),
              top: margen(arriba !== null ? tamanoPagina.alto - arriba : 72),
              bottom: margen(izquierda),
            },
          },
        },
        children: hijos,
      },
    ],
  });
  return d.Packer.toBlob(doc);
}

export async function pdfAWord(archivo: File, progreso?: (pagina: number, total: number) => void): Promise<ResultadoDocumento> {
  const { fragmentos, reglas, paginas, tamanoPagina } = await extraerFragmentos(await archivo.arrayBuffer(), progreso);
  const caracteres = fragmentos.reduce((n, f) => n + f.texto.trim().length, 0);
  if (caracteres < 10 * paginas) {
    throw new Error(
      `${archivo.name}: el PDF casi no tiene texto. Probablemente es un documento escaneado (una imagen), y para convertirlo haría falta reconocimiento óptico de caracteres (OCR).`,
    );
  }
  const documento = reconstruir(fragmentos, reglas);
  const blob = await documentoADocx(documento, nombreBase(archivo.name), tamanoPagina);
  return { blob, nombre: `${nombreBase(archivo.name)}.docx`, avisos: [] };
}
