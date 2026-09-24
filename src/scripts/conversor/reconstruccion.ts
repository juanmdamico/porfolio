/**
 * Reconstruye la estructura de un documento a partir de los fragmentos de texto
 * que trae un PDF. Un PDF no tiene "párrafos" ni "tablas": solo sabe dónde dibujar
 * cada trozo de texto. Acá se agrupan en renglones, los renglones en párrafos y
 * tablas, y se detectan títulos, listas, alineación, tamaños y colores.
 * Es código puro, sin DOM ni librerías, para poder probarlo aparte.
 */

export interface Fragmento {
  texto: string;
  x: number;
  y: number; // coordenada PDF: crece hacia arriba
  ancho: number;
  tamano: number;
  negrita: boolean;
  cursiva: boolean;
  pagina: number;
  /** Color del texto en hex (sin #), o null si es negro */
  color?: string | null;
  /** Color de fondo detrás del texto, o null si es blanco */
  fondo?: string | null;
  /** Nombre de la fuente (p. ej. "Helvetica-Bold") */
  fuente?: string;
}

export interface Tramo {
  texto: string;
  negrita: boolean;
  cursiva: boolean;
  tamano?: number;
  color?: string | null;
}

export type Alineacion = 'izquierda' | 'centro' | 'derecha' | 'justificado';
export type TipoTexto = 'titulo1' | 'titulo2' | 'titulo3' | 'parrafo' | 'vinieta' | 'numerado';

export interface BloqueTexto {
  tipo: TipoTexto;
  tramos: Tramo[];
  alineacion: Alineacion;
  /** Distancia entre renglones en puntos, si el bloque tiene más de uno */
  interlineado?: number;
  /** Para listas numeradas: número de lista (cambia cuando empieza una lista nueva) */
  lista?: number;
  /** Color de una línea horizontal dibujada debajo del bloque */
  lineaDebajo?: string;
  /** Empieza en una hoja nueva (en el PDF había un salto de página intencional) */
  saltoAntes?: boolean;
}

/** Una línea horizontal dibujada en el PDF (no es texto). */
export interface Regla {
  pagina: number;
  y: number;
  x0: number;
  x1: number;
  color: string;
}

export interface Celda {
  tramos: Tramo[];
  fondo: string | null;
  alineacion: Alineacion;
}

export interface BloqueTabla {
  tipo: 'tabla';
  filas: (Celda | null)[][];
  /** Ancho de cada columna en puntos */
  anchos: number[];
  centrada: boolean;
  /** Distancia entre filas en puntos */
  altoFila: number;
  saltoAntes?: boolean;
}

export type Bloque = BloqueTexto | BloqueTabla;

export interface Documento {
  bloques: Bloque[];
  /** Tamaño de letra del texto normal */
  cuerpo: number;
  /** Fuente más usada, ya traducida a una de Word (Arial, Times New Roman…) */
  fuente: string | null;
  /** Límites del texto en coordenadas PDF: borde izquierdo, borde derecho y tope del primer renglón */
  limites: { izquierda: number; derecha: number; arriba: number | null };
}

interface Segmento {
  tramos: Tramo[];
  x: number;
  fin: number;
  fondo: string | null;
}

interface Linea {
  segmentos: Segmento[];
  x: number;
  fin: number;
  y: number;
  tamano: number;
  pagina: number;
}

// '*' no se toma como viñeta: en documentos suele marcar una nota al pie.
const VINIETA = /^\s*[•◦▪▫●○■□‣⁃∙·\-–—]\s+/;
const NUMERO = /^\s*(\d{1,3}|[a-zA-Z])[.)]\s+/;

const textoDe = (tramos: Tramo[]) => tramos.map((t) => t.texto).join('');
const tramosDe = (l: Linea) => l.segmentos.flatMap((s, i) => (i ? [{ ...espacio(s.tramos[0]) }, ...s.tramos] : s.tramos));
const espacio = (t: Tramo): Tramo => ({ ...t, texto: ' ' });
const redondear = (n: number) => Math.round(n * 2) / 2;

const mismoFormato = (a: Tramo, b: Tramo) =>
  a.negrita === b.negrita && a.cursiva === b.cursiva && a.tamano === b.tamano && (a.color ?? null) === (b.color ?? null);

/** Agrega texto a una lista de tramos, uniéndolo al último si tiene el mismo formato. */
function sumar(tramos: Tramo[], t: Tramo) {
  const ultimo = tramos[tramos.length - 1];
  if (ultimo && mismoFormato(ultimo, t)) ultimo.texto += t.texto;
  else if (ultimo && !t.texto.trim()) ultimo.texto += t.texto; // un espacio no crea un tramo nuevo
  else tramos.push({ ...t });
}

function limpiar(tramos: Tramo[]): Tramo[] {
  tramos.forEach((t) => (t.texto = t.texto.replace(/\s+/g, ' ')));
  if (tramos.length) {
    tramos[0].texto = tramos[0].texto.trimStart();
    tramos[tramos.length - 1].texto = tramos[tramos.length - 1].texto.trimEnd();
  }
  return tramos.filter((t) => t.texto);
}

export function agruparLineas(fragmentos: Fragmento[]): Linea[] {
  // 1. Agrupa los fragmentos por renglón (misma página y casi la misma altura).
  const grupos: Fragmento[][] = [];
  for (const f of fragmentos) {
    if (!f.texto) continue;
    const grupo = grupos.find(
      (g) => g[0].pagina === f.pagina && Math.abs(g[0].y - f.y) < Math.max(g[0].tamano, f.tamano) * 0.5,
    );
    if (grupo) grupo.push(f);
    else grupos.push([f]);
  }

  // 2. Renglones de arriba hacia abajo; cada renglón de izquierda a derecha (el PDF no
  // siempre guarda el texto en orden de lectura).
  grupos.sort((a, b) => a[0].pagina - b[0].pagina || b[0].y - a[0].y);

  const lineas: Linea[] = [];
  for (const grupo of grupos) {
    // Los fragmentos que son solo espacios no cuentan para medir: pdf.js a veces agrega
    // uno que "rellena" todo el hueco entre dos columnas de una tabla.
    const visibles = grupo.filter((f) => f.texto.trim()).sort((a, b) => a.x - b.x);
    if (!visibles.length) continue;

    // 3. Parte el renglón en segmentos donde hay un hueco más grande que un espacio. Si es
    // una tabla, los huecos van a coincidir entre renglones (eso se decide en detectarTablas);
    // si es un párrafo, los segmentos se vuelven a unir con un espacio.
    const segmentos: Segmento[] = [];
    let actual: Segmento | null = null;
    for (const f of visibles) {
      const tramo: Tramo = {
        texto: f.texto,
        negrita: f.negrita,
        cursiva: f.cursiva,
        tamano: redondear(f.tamano),
        color: f.color ?? null,
      };
      const hueco = actual ? f.x - actual.fin : 0;
      if (!actual || hueco > f.tamano * 0.6) {
        actual = { tramos: [], x: f.x, fin: f.x + f.ancho, fondo: f.fondo ?? null };
        segmentos.push(actual);
      } else if (hueco > f.tamano * 0.15 && !/\s$/.test(textoDe(actual.tramos)) && !/^\s/.test(f.texto)) {
        // Hueco visible sin espacio: se agrega uno.
        sumar(actual.tramos, espacio(tramo));
      }
      sumar(actual.tramos, tramo);
      actual.fin = Math.max(actual.fin, f.x + f.ancho);
    }
    segmentos.forEach((s) => (s.tramos = limpiar(s.tramos)));
    const conTexto = segmentos.filter((s) => s.tramos.length);
    if (!conTexto.length) continue;
    lineas.push({
      segmentos: conTexto,
      x: conTexto[0].x,
      fin: conTexto[conTexto.length - 1].fin,
      y: grupo[0].y,
      tamano: Math.max(...visibles.map((f) => f.tamano)),
      pagina: grupo[0].pagina,
    });
  }
  return lineas;
}

/** El valor con más peso. */
function moda<T>(valores: [T, number][]): T | undefined {
  const cuenta = new Map<T, number>();
  for (const [v, peso] of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + peso);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Margen izquierdo del texto: la posición más a la izquierda que concentra al menos
 * un 10% del texto. (La más frecuente no sirve: en un documento con listas largas,
 * podría ser la sangría de la lista.)
 */
function margenIzquierdo(lineas: Linea[]): number {
  const cuenta = new Map<number, number>();
  let total = 0;
  for (const l of lineas) {
    const n = textoDe(tramosDe(l)).length;
    cuenta.set(Math.round(l.x), (cuenta.get(Math.round(l.x)) ?? 0) + n);
    total += n;
  }
  const candidatas = [...cuenta.entries()].filter(([, n]) => n >= total * 0.1).map(([x]) => x);
  return candidatas.length ? Math.min(...candidatas) : 0;
}

/** Traduce el nombre de una fuente de PDF a una fuente de Word equivalente. */
export function fuenteWord(nombre: string | undefined): string | null {
  if (!nombre) return null;
  const base = nombre
    .replace(/^[A-Z]{6}\+/, '') // prefijo de subconjunto (ABCDEF+Arial)
    .replace(/[-,](Bold|Italic|Oblique|BoldItalic|BoldOblique|Regular|Roman|Medium|Light|Semibold|Black).*$/i, '')
    .replace(/(MT|PS|PSMT)$/, '');
  if (/helvetica|arial/i.test(base)) return 'Arial';
  if (/times/i.test(base)) return 'Times New Roman';
  if (/courier/i.test(base)) return 'Courier New';
  if (/symbol|dingbat|^g_d|^f\d/i.test(base) || !base) return null;
  return base.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// ---------- Tablas ----------

/**
 * Busca tablas: dos o más renglones seguidos que se parten en columnas, donde las
 * columnas quedan separadas por "canales" de espacio en blanco comunes a todos.
 */
function detectarTablas(lineas: Linea[]): Map<number, { fin: number; tabla: BloqueTabla }> {
  const tablas = new Map<number, { fin: number; tabla: BloqueTabla }>();
  let i = 0;
  while (i < lineas.length) {
    if (lineas[i].segmentos.length < 2) {
      i++;
      continue;
    }
    let j = i;
    while (
      j + 1 < lineas.length &&
      lineas[j + 1].segmentos.length >= 2 &&
      lineas[j + 1].pagina === lineas[j].pagina &&
      lineas[j].y - lineas[j + 1].y <= Math.max(lineas[j].tamano, lineas[j + 1].tamano) * 3.5
    ) {
      j++;
    }
    const filas = lineas.slice(i, j + 1);
    const tabla = filas.length >= 2 ? armarTabla(filas) : null;
    if (tabla) {
      tablas.set(i, { fin: j, tabla });
      i = j + 1;
    } else {
      i++;
    }
  }
  return tablas;
}

function armarTabla(filas: Linea[]): BloqueTabla | null {
  // Columnas: se unen los intervalos [x, fin] de todos los segmentos que se superponen.
  const intervalos = filas.flatMap((f) => f.segmentos.map((s) => [s.x, s.fin] as [number, number])).sort((a, b) => a[0] - b[0]);
  const columnas: [number, number][] = [];
  for (const [a, b] of intervalos) {
    const ultima = columnas[columnas.length - 1];
    if (ultima && a <= ultima[1] + 1) ultima[1] = Math.max(ultima[1], b);
    else columnas.push([a, b]);
  }
  if (columnas.length < 2) return null;

  // Si la primera columna solo tiene marcadores de lista ("1.", "a)", "•"), es una lista.
  const marcador = /^((\d{1,3}|[a-zA-Z])[.)]|[•◦▪▫●○■□‣⁃∙·\-–—])$/;
  const primeros = filas.map((f) => textoDe(f.segmentos[0].tramos).trim());
  if (filas.every((f) => f.segmentos[0].fin <= columnas[0][1] + 1) && primeros.every((t) => marcador.test(t))) return null;

  const tamano = Math.max(...filas.map((f) => f.tamano));
  const relleno = tamano * 0.8;
  const columnaDe = (s: Segmento) => columnas.findIndex(([a, b]) => s.x >= a - 1 && s.fin <= b + 1);

  // Alineación de cada columna: centrada si todas las celdas comparten el centro pero
  // empiezan en lugares distintos; a la derecha si comparten el final.
  const alineaciones: Alineacion[] = columnas.map((_, c) => {
    const segs = filas.flatMap((f) => f.segmentos.filter((s) => columnaDe(s) === c));
    const rango = (v: number[]) => Math.max(...v) - Math.min(...v);
    const inicios = rango(segs.map((s) => s.x));
    if (segs.length < 2 || inicios < 0.8) return 'izquierda';
    if (rango(segs.map((s) => (s.x + s.fin) / 2)) < 2) return 'centro';
    if (rango(segs.map((s) => s.fin)) < 1.5) return 'derecha';
    return 'izquierda';
  });

  const celdas = filas.map((f) => {
    const fila: (Celda | null)[] = columnas.map(() => null);
    for (const s of f.segmentos) {
      const c = columnaDe(s);
      if (c < 0) continue;
      const previa = fila[c];
      if (previa) previa.tramos.push(espacio(s.tramos[0]), ...s.tramos);
      else fila[c] = { tramos: s.tramos, fondo: s.fondo, alineacion: alineaciones[c] };
    }
    return fila;
  });

  // Las celdas vacías toman el fondo de su fila (p. ej. la primera celda del encabezado).
  for (const fila of celdas) {
    const fondo = fila.find((c) => c?.fondo)?.fondo ?? null;
    fila.forEach((c, k) => {
      if (!c && fondo) fila[k] = { tramos: [], fondo, alineacion: 'izquierda' };
    });
  }

  // Ancho de cada columna: desde donde empieza hasta donde empieza la siguiente.
  const anchos = columnas.map(([a, b], k) => (k < columnas.length - 1 ? columnas[k + 1][0] - a : b - a + relleno * 2));
  anchos[0] += relleno;
  // La última columna no tiene "siguiente" para medirla: si quedó más angosta que las
  // del medio, se iguala a ellas.
  if (anchos.length > 2) {
    const medio = anchos.slice(1, -1).sort((a, b) => a - b)[Math.floor((anchos.length - 2) / 2)];
    anchos[anchos.length - 1] = Math.max(anchos[anchos.length - 1], medio);
  }
  const saltos = filas.slice(1).map((f, k) => filas[k].y - f.y);
  const altoFila = saltos.reduce((a, b) => a + b, 0) / saltos.length;
  return { tipo: 'tabla', filas: celdas, anchos, centrada: false, altoFila };
}

// ---------- Texto ----------

function tipoDeLinea(l: Linea, cuerpo: number, siguiente: Linea | undefined): TipoTexto {
  const tramos = tramosDe(l);
  const texto = textoDe(tramos);
  const todoNegrita = tramos.every((t) => t.negrita || !t.texto.trim());
  if (l.tamano >= cuerpo * 1.6) return 'titulo1';
  if (l.tamano >= cuerpo * 1.25) return 'titulo2';
  if (l.tamano >= cuerpo * 1.08 && todoNegrita && texto.length < 120) return 'titulo3';
  // Un renglón corto todo en negrita seguido de texto normal es un subtítulo
  // (p. ej. "1. ÁMBITO DE APLICACIÓN" o "Cláusula del Reglamento…").
  const siguienteNormal = siguiente && !tramosDe(siguiente).every((t) => t.negrita || !t.texto.trim());
  if (todoNegrita && texto.length < 120 && siguienteNormal) return 'titulo3';
  if (VINIETA.test(texto)) return 'vinieta';
  if (NUMERO.test(texto)) return 'numerado';
  return 'parrafo';
}

export function reconstruir(fragmentos: Fragmento[], reglas: Regla[] = []): Documento {
  const lineas = agruparLineas(fragmentos);
  const cuerpo = moda(lineas.map((l) => [redondear(l.tamano), textoDe(tramosDe(l)).length])) ?? 12;
  const delCuerpo = lineas.filter((l) => Math.abs(l.tamano - cuerpo) < 0.6 && l.segmentos.length === 1);
  const base = delCuerpo.length ? delCuerpo : lineas;
  const izquierda = margenIzquierdo(base);
  const derecha = Math.max(...base.map((l) => l.fin), 0);
  const anchoTexto = derecha - izquierda;
  const centroTexto = (izquierda + derecha) / 2;
  const fuente = moda(fragmentos.filter((f) => f.texto.trim()).map((f) => [fuenteWord(f.fuente) ?? '', f.texto.length])) || null;

  /** Una línea que termina bastante antes del margen derecho: suele cerrar un párrafo o un ítem. */
  const corta = (l: Linea) => anchoTexto > 0 && l.fin < derecha - anchoTexto * 0.15;
  const conSangria = (l: Linea) => l.x >= izquierda + cuerpo * 0.8;
  const mismaX = (a: Linea, b: Linea) => Math.abs(a.x - b.x) < 3;
  const seguidas = (a: Linea, b: Linea) =>
    a.pagina === b.pagina && a.y - b.y > 0 && a.y - b.y <= Math.max(a.tamano, b.tamano) * 1.6;
  // Centrada: más angosta que el ancho del texto y con el medio alineado al medio de la página.
  const centrada = (l: Linea) =>
    anchoTexto > 0 &&
    l.x > izquierda + 5 &&
    l.fin - l.x < anchoTexto * 0.9 &&
    Math.abs((l.x + l.fin) / 2 - centroTexto) < Math.max(3, anchoTexto * 0.01);

  // Una hoja que termina mucho antes del margen inferior (el más bajo al que llega el texto
  // en todo el documento) indica un salto de página intencional.
  const piso = Math.min(...lineas.map((l) => l.y));
  const techo = Math.max(...lineas.map((l) => l.y));
  const ultimaDePagina = new Map<number, number>();
  for (const l of lineas) ultimaDePagina.set(l.pagina, Math.min(ultimaDePagina.get(l.pagina) ?? Infinity, l.y));
  const saltoIntencional = (pagina: number) => (ultimaDePagina.get(pagina) ?? piso) - piso > (techo - piso) * 0.2;

  const tablas = detectarTablas(lineas);
  const bloques: Bloque[] = [];
  // Renglones de cada bloque de texto, para calcular después la alineación.
  const renglones = new Map<BloqueTexto, Linea[]>();
  type Anterior = { linea: Linea; tipo: TipoTexto; bloque: BloqueTexto; porSangria: boolean };
  let anterior: Anterior | null = null;
  let numeroLista = 0;
  let ultimoTipo: TipoTexto | 'tabla' | null = null;

  for (let i = 0; i < lineas.length; i++) {
    const tabla = tablas.get(i);
    if (tabla) {
      const [x0, x1] = [lineas[i].x, Math.max(...lineas.slice(i, tabla.fin + 1).map((l) => l.fin))];
      tabla.tabla.centrada = Math.abs((x0 + x1) / 2 - centroTexto) < anchoTexto * 0.05 && x0 > izquierda + 5;
      bloques.push(tabla.tabla);
      i = tabla.fin;
      anterior = null;
      ultimoTipo = 'tabla';
      continue;
    }

    const linea = lineas[i];
    const siguiente = lineas[i + 1];
    let tipo = tipoDeLinea(linea, cuerpo, siguiente);
    const cercana = anterior ? seguidas(anterior.linea, linea) : false;
    const cambioPagina = anterior && anterior.linea.pagina !== linea.pagina;
    const mismoTamano = anterior && Math.abs(anterior.linea.tamano - linea.tamano) < 0.6;
    const textoAnterior = anterior ? textoDe(anterior.bloque.tramos) : '';
    const cierra = (l: Linea) => corta(l) && /[.:!?]$/.test(textoAnterior);

    // Listas cuyas viñetas son dibujos (no texto): se reconocen por la sangría, cuando
    // hay otra línea con la misma sangría justo arriba o justo abajo.
    let porSangria = false;
    if (tipo === 'parrafo' && conSangria(linea) && !centrada(linea)) {
      const vecinoArriba = anterior && anterior.porSangria && mismaX(anterior.linea, linea) && cercana;
      const vecinoAbajo =
        siguiente && conSangria(siguiente) && mismaX(siguiente, linea) && seguidas(linea, siguiente) && !tablas.has(i + 1);
      if (vecinoArriba || vecinoAbajo) {
        porSangria = true;
        // Si la línea de arriba era un ítem que llegaba hasta el margen, esta es su continuación.
        if (vecinoArriba && !corta(anterior!.linea)) {
          const previo: Anterior = anterior!;
          unir(previo.bloque, linea);
          renglones.get(previo.bloque)!.push(linea);
          anterior = { ...previo, linea };
          continue;
        }
        tipo = 'vinieta';
      }
    }

    // Un párrafo sigue en la línea de abajo (o en la página siguiente, si no terminó en punto).
    const continuaParrafo =
      anterior &&
      anterior.tipo === 'parrafo' &&
      tipo === 'parrafo' &&
      mismoTamano &&
      ((cercana && !cierra(anterior.linea)) ||
        (cambioPagina && !saltoIntencional(anterior.linea.pagina) && !/[.:!?]$/.test(textoAnterior)));
    // Un título largo que ocupa dos líneas.
    const continuaTitulo = anterior && tipo.startsWith('titulo') && anterior.tipo === tipo && cercana && mismoTamano;
    // Un ítem de lista (con viñeta o número de texto) cuyo texto sigue, con sangría, abajo.
    const continuaItem =
      anterior &&
      !anterior.porSangria &&
      (anterior.tipo === 'vinieta' || anterior.tipo === 'numerado') &&
      tipo === 'parrafo' &&
      cercana &&
      linea.x > anterior.linea.x + 2;

    if (anterior && (continuaParrafo || continuaTitulo || continuaItem)) {
      const previo: Anterior = anterior;
      unir(previo.bloque, linea);
      renglones.get(previo.bloque)!.push(linea);
      anterior = { ...previo, linea };
      continue;
    }

    const tramos = tramosDe(linea).map((t) => ({ ...t }));
    if ((tipo === 'vinieta' || tipo === 'numerado') && !porSangria) {
      // Se quita la viñeta o el número: Word los agrega con su propio formato de lista.
      quitarPrefijo(tramos, (textoDe(tramos).match(tipo === 'vinieta' ? VINIETA : NUMERO)?.[0] ?? '').length);
      if (!tramos.length) tipo = 'parrafo';
    }
    // Cada lista numerada nueva empieza de 1.
    if (tipo === 'numerado' && ultimoTipo !== 'numerado') numeroLista++;
    const bloque: BloqueTexto = { tipo, tramos, alineacion: 'izquierda' };
    if (tipo === 'numerado') bloque.lista = numeroLista;
    bloques.push(bloque);
    renglones.set(bloque, [linea]);
    anterior = { linea, tipo, bloque, porSangria };
    ultimoTipo = tipo;
  }

  // Después de un salto de página intencional, el bloque que sigue empieza en hoja nueva.
  const primeraLinea = new Map<Bloque, Linea>();
  for (const [b, ls] of renglones) primeraLinea.set(b, ls[0]);
  for (const [i, t] of tablas) primeraLinea.set(t.tabla, lineas[i]);
  let paginaPrevia = lineas[0]?.pagina;
  for (const b of bloques) {
    const l = primeraLinea.get(b);
    if (!l) continue;
    if (l.pagina !== paginaPrevia) {
      if (saltoIntencional(paginaPrevia)) b.saltoAntes = true;
      paginaPrevia = l.pagina;
    }
  }

  // Líneas horizontales: se asignan al bloque de texto que queda justo encima,
  // salvo que estén dentro de una tabla (son sus bordes).
  const rangosTablas = [...tablas.entries()].map(([i, t]) => ({
    pagina: lineas[i].pagina,
    arriba: lineas[i].y + lineas[i].tamano * 2,
    abajo: lineas[t.fin].y - lineas[t.fin].tamano * 2,
  }));
  for (const r of reglas) {
    if (rangosTablas.some((t) => t.pagina === r.pagina && r.y <= t.arriba && r.y >= t.abajo)) continue;
    let mejor: { bloque: BloqueTexto; distancia: number } | null = null;
    for (const [bloque, ls] of renglones) {
      const ultima = ls[ls.length - 1];
      const distancia = ultima.y - r.y;
      if (ultima.pagina === r.pagina && distancia > 0 && distancia < ultima.tamano * 4 && (!mejor || distancia < mejor.distancia)) {
        mejor = { bloque, distancia };
      }
    }
    // Que no haya texto entre el bloque y la línea.
    if (mejor) {
      const ultimaY = renglones.get(mejor.bloque)!.at(-1)!.y;
      const entre = lineas.some((l) => l.pagina === r.pagina && l.y < ultimaY && l.y > r.y);
      if (!entre) mejor.bloque.lineaDebajo = r.color;
    }
  }

  // Alineación e interlineado de cada bloque de texto.
  for (const [bloque, ls] of renglones) {
    const noUltimas = ls.slice(0, -1);
    if (ls.every(centrada)) bloque.alineacion = 'centro';
    else if (noUltimas.length && noUltimas.every((l) => Math.abs(l.fin - derecha) < 2)) bloque.alineacion = 'justificado';
    else if (ls.length === 1 && Math.abs(ls[0].fin - derecha) < 2 && ls[0].x > izquierda + anchoTexto * 0.3) bloque.alineacion = 'derecha';
    if (ls.length > 1) {
      const saltos = ls.slice(1).map((l, k) => ls[k].y - l.y).filter((s) => s > 0);
      if (saltos.length) bloque.interlineado = saltos.reduce((a, b) => a + b, 0) / saltos.length;
    }
  }

  return {
    bloques: bloques.filter((b) => b.tipo === 'tabla' || b.tramos.some((t) => t.texto.trim())),
    cuerpo,
    fuente,
    limites: { izquierda, derecha, arriba: lineas[0] ? lineas[0].y + lineas[0].tamano : null },
  };
}

/** Quita los primeros `n` caracteres, aunque estén repartidos en varios tramos. */
function quitarPrefijo(tramos: Tramo[], n: number) {
  while (n > 0 && tramos.length) {
    const t = tramos[0];
    if (t.texto.length <= n) {
      n -= t.texto.length;
      tramos.shift();
    } else {
      t.texto = t.texto.slice(n);
      n = 0;
    }
  }
}

/** Agrega el texto de una línea al final de un bloque. */
function unir(bloque: BloqueTexto, linea: Linea) {
  const ultimo = bloque.tramos[bloque.tramos.length - 1];
  const nuevos = tramosDe(linea);
  // Palabra cortada con guion al final de la línea: se vuelve a unir.
  if (/[a-záéíóúñü]-$/i.test(ultimo.texto) && /^[a-záéíóúñü]/.test(nuevos[0].texto)) {
    ultimo.texto = ultimo.texto.slice(0, -1);
  } else {
    sumar(bloque.tramos, espacio(ultimo));
  }
  nuevos.forEach((t) => sumar(bloque.tramos, t));
}
