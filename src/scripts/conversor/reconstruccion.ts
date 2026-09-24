/**
 * Reconstruye la estructura de un documento a partir de los fragmentos de texto
 * que trae un PDF. Un PDF no tiene "párrafos": solo sabe dónde dibujar cada trozo
 * de texto. Acá se agrupan en líneas, las líneas en párrafos, y se detectan
 * títulos (por tamaño de letra) y listas (por viñetas o números).
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
}

export interface Tramo {
  texto: string;
  negrita: boolean;
  cursiva: boolean;
}

export type TipoBloque = 'titulo1' | 'titulo2' | 'titulo3' | 'parrafo' | 'vinieta' | 'numerado';

export interface Bloque {
  tipo: TipoBloque;
  tramos: Tramo[];
}

interface Linea {
  tramos: Tramo[];
  x: number;
  /** Dónde termina el texto de la línea (borde derecho) */
  fin: number;
  y: number;
  tamano: number;
  pagina: number;
}

const VINIETA = /^\s*[•◦▪▫●○■□‣⁃∙·\-–—*]\s+/;
const NUMERO = /^\s*(\d{1,3}|[a-zA-Z])[.)]\s+/;

const textoDe = (tramos: Tramo[]) => tramos.map((t) => t.texto).join('');

/** Agrega texto a una lista de tramos, uniéndolo al último si tiene el mismo formato. */
function sumar(tramos: Tramo[], t: Tramo) {
  const ultimo = tramos[tramos.length - 1];
  if (ultimo && ultimo.negrita === t.negrita && ultimo.cursiva === t.cursiva) ultimo.texto += t.texto;
  else tramos.push({ ...t });
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

  // 2. Ordena los renglones de arriba hacia abajo, y cada renglón de izquierda a derecha:
  // el PDF no siempre guarda el texto en orden de lectura (p. ej. el número de una lista
  // puede venir después del texto del ítem).
  grupos.sort((a, b) => a[0].pagina - b[0].pagina || b[0].y - a[0].y);

  const lineas: Linea[] = [];
  for (const grupo of grupos) {
    grupo.sort((a, b) => a.x - b.x);
    const visibles = grupo.filter((f) => f.texto.trim());
    if (!visibles.length) continue;
    const linea: Linea = {
      tramos: [],
      x: visibles[0].x,
      fin: Math.max(...visibles.map((f) => f.x + f.ancho)),
      y: grupo[0].y,
      tamano: Math.max(...visibles.map((f) => f.tamano)),
      pagina: grupo[0].pagina,
    };
    let finX = -Infinity;
    for (const f of grupo) {
      // Espacio entre fragmentos si hay un hueco visible y ninguno lo trae.
      const previo = textoDe(linea.tramos);
      if (previo && f.x - finX > f.tamano * 0.15 && !/\s$/.test(previo) && !/^\s/.test(f.texto)) {
        sumar(linea.tramos, { texto: ' ', negrita: f.negrita, cursiva: f.cursiva });
      }
      sumar(linea.tramos, { texto: f.texto, negrita: f.negrita, cursiva: f.cursiva });
      finX = Math.max(finX, f.x + f.ancho);
    }
    // Normaliza espacios repetidos y recorta los extremos.
    linea.tramos.forEach((t) => (t.texto = t.texto.replace(/\s+/g, ' ')));
    linea.tramos[0].texto = linea.tramos[0].texto.trimStart();
    linea.tramos[linea.tramos.length - 1].texto = linea.tramos[linea.tramos.length - 1].texto.trimEnd();
    linea.tramos = linea.tramos.filter((t) => t.texto);
    if (linea.tramos.length) lineas.push(linea);
  }
  return lineas;
}

/** El valor más frecuente (redondeado), ponderado. */
function moda(valores: [number, number][]): number | undefined {
  const cuenta = new Map<number, number>();
  for (const [v, peso] of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + peso);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Tamaño de letra más usado (ponderado por cantidad de caracteres): es el del texto normal. */
const tamanoCuerpo = (lineas: Linea[]) =>
  moda(lineas.map((l) => [Math.round(l.tamano * 2) / 2, textoDe(l.tramos).length])) ?? 12;

function tipoDeLinea(l: Linea, cuerpo: number): TipoBloque {
  const texto = textoDe(l.tramos);
  if (VINIETA.test(texto)) return 'vinieta';
  if (NUMERO.test(texto)) return 'numerado';
  const todoNegrita = l.tramos.every((t) => t.negrita);
  if (l.tamano >= cuerpo * 1.6) return 'titulo1';
  if (l.tamano >= cuerpo * 1.25) return 'titulo2';
  if (l.tamano >= cuerpo * 1.08 && todoNegrita && texto.length < 120) return 'titulo3';
  return 'parrafo';
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
    const n = textoDe(l.tramos).length;
    cuenta.set(Math.round(l.x), (cuenta.get(Math.round(l.x)) ?? 0) + n);
    total += n;
  }
  const candidatas = [...cuenta.entries()].filter(([, n]) => n >= total * 0.1).map(([x]) => x);
  return candidatas.length ? Math.min(...candidatas) : 0;
}

export function reconstruir(fragmentos: Fragmento[]): Bloque[] {
  const lineas = agruparLineas(fragmentos);
  const cuerpo = tamanoCuerpo(lineas);
  const delCuerpo = lineas.filter((l) => Math.abs(l.tamano - cuerpo) < 0.6);
  // Margen izquierdo del texto normal y borde derecho de las líneas completas.
  const izquierda = margenIzquierdo(delCuerpo);
  const derecha = Math.max(...delCuerpo.map((l) => l.fin), 0);
  const anchoTexto = derecha - izquierda;

  /** Una línea que termina bastante antes del margen derecho: suele cerrar un párrafo o un ítem. */
  const corta = (l: Linea) => anchoTexto > 0 && l.fin < derecha - anchoTexto * 0.15;
  const conSangria = (l: Linea) => l.x >= izquierda + cuerpo * 0.8;
  const mismaX = (a: Linea, b: Linea) => Math.abs(a.x - b.x) < 3;
  const seguidas = (a: Linea, b: Linea) =>
    a.pagina === b.pagina && a.y - b.y > 0 && a.y - b.y <= Math.max(a.tamano, b.tamano) * 1.6;

  const bloques: Bloque[] = [];
  let anterior: { linea: Linea; tipo: TipoBloque; bloque: Bloque; porSangria: boolean } | null = null;

  lineas.forEach((linea, i) => {
    let tipo = tipoDeLinea(linea, cuerpo);
    const siguiente = lineas[i + 1];
    const cercana = anterior ? seguidas(anterior.linea, linea) : false;
    const cambioPagina = anterior && anterior.linea.pagina !== linea.pagina;
    const mismoTamano = anterior && Math.abs(anterior.linea.tamano - linea.tamano) < 0.6;
    const cierra = (l: Linea, texto: string) => corta(l) && /[.:!?]$/.test(texto);

    // Listas cuyas viñetas son dibujos (no texto): se reconocen por la sangría, cuando
    // hay otra línea con la misma sangría justo arriba o justo abajo.
    let porSangria = false;
    if (tipo === 'parrafo' && conSangria(linea)) {
      const vecinoArriba = anterior && anterior.porSangria && mismaX(anterior.linea, linea) && cercana;
      const vecinoAbajo = siguiente && conSangria(siguiente) && mismaX(siguiente, linea) && seguidas(linea, siguiente);
      if (vecinoArriba || vecinoAbajo) {
        porSangria = true;
        // Si la línea de arriba era un ítem que llegaba hasta el margen, esta es su continuación.
        if (vecinoArriba && !corta(anterior!.linea)) {
          unir(anterior!.bloque, linea);
          anterior = { ...anterior!, linea };
          return;
        }
        tipo = 'vinieta';
      }
    }

    // Un párrafo sigue en la línea de abajo (o en la página siguiente, si no terminó en punto).
    const textoAnterior = anterior ? textoDe(anterior.bloque.tramos) : '';
    const continuaParrafo =
      anterior &&
      anterior.tipo === 'parrafo' &&
      tipo === 'parrafo' &&
      mismoTamano &&
      ((cercana && !cierra(anterior.linea, textoAnterior)) || (cambioPagina && !/[.:!?]$/.test(textoAnterior)));
    // Un título largo que ocupa dos líneas.
    const continuaTitulo = anterior && tipo.startsWith('titulo') && anterior.tipo === tipo && cercana;
    // Un ítem de lista (con viñeta o número de texto) cuyo texto sigue, con sangría, abajo.
    const continuaItem =
      anterior &&
      !anterior.porSangria &&
      (anterior.tipo === 'vinieta' || anterior.tipo === 'numerado') &&
      tipo === 'parrafo' &&
      cercana &&
      linea.x > anterior.linea.x + 2;

    if (anterior && (continuaParrafo || continuaTitulo || continuaItem)) {
      unir(anterior.bloque, linea);
      anterior = { ...anterior, linea };
      return;
    }

    const tramos = linea.tramos.map((t) => ({ ...t }));
    if ((tipo === 'vinieta' || tipo === 'numerado') && !porSangria) {
      // Se quita la viñeta o el número: Word los agrega con su propio formato de lista.
      const patron = tipo === 'vinieta' ? VINIETA : NUMERO;
      tramos[0].texto = tramos[0].texto.replace(patron, '');
      if (!tramos[0].texto) tramos.shift();
      if (!tramos.length) tipo = 'parrafo';
    }
    const bloque: Bloque = { tipo, tramos };
    bloques.push(bloque);
    anterior = { linea, tipo, bloque, porSangria };
  });
  return bloques.filter((b) => b.tramos.some((t) => t.texto.trim()));
}

/** Agrega el texto de una línea al final de un bloque. */
function unir(bloque: Bloque, linea: Linea) {
  const ultimo = bloque.tramos[bloque.tramos.length - 1];
  // Palabra cortada con guion al final de la línea: se vuelve a unir.
  if (/[a-záéíóúñü]-$/i.test(ultimo.texto) && /^[a-záéíóúñü]/.test(linea.tramos[0].texto)) {
    ultimo.texto = ultimo.texto.slice(0, -1);
  } else {
    sumar(bloque.tramos, { texto: ' ', negrita: ultimo.negrita, cursiva: ultimo.cursiva });
  }
  linea.tramos.forEach((t) => sumar(bloque.tramos, t));
}
