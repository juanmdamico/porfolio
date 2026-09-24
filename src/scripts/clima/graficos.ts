/**
 * Gráficos SVG livianos y sin dependencias: líneas y barras con tooltip.
 * Los colores se pasan como variables CSS, así se adaptan solos al cambiar de tema.
 */

export interface Serie {
  nombre: string;
  color: string; // p. ej. 'var(--serie-calida)'
  valores: number[];
}

interface Opciones {
  etiquetas: string[]; // etiqueta larga de cada punto (tooltip)
  etiquetasEje: string[]; // etiqueta corta en el eje X ('' = sin etiqueta)
  unidad: string;
  alto?: number;
  /** Marca una zona desde este índice (p. ej. el pronóstico) */
  desde?: { indice: number; texto: string };
  /** Etiqueta el último valor de cada serie junto a la línea */
  etiquetaFinal?: boolean;
  decimales?: number;
}

const NS = 'http://www.w3.org/2000/svg';
type Margenes = { arriba: number; derecha: number; abajo: number; izquierda: number };
const MARGENES: Margenes = { arriba: 20, derecha: 16, abajo: 26, izquierda: 38 };

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Marcas "lindas" para el eje Y (1, 2, 5 × 10^n). */
function marcas(min: number, max: number, cantidad = 4): number[] {
  if (min === max) max = min + 1;
  const paso0 = (max - min) / cantidad;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 5, 10].map((f) => f * mag).find((p) => p >= paso0)!;
  const inicio = Math.floor(min / paso) * paso;
  const res: number[] = [];
  for (let v = inicio; v <= max + paso * 0.001; v += paso) res.push(+v.toFixed(10));
  if (res[res.length - 1] < max) res.push(res[res.length - 1] + paso);
  return res;
}

function montar(contenedor: HTMLElement, dibujar: (ancho: number) => void) {
  let ultimoAncho = 0;
  const ro = new ResizeObserver(([entrada]) => {
    const ancho = Math.round(entrada.contentRect.width);
    if (ancho && ancho !== ultimoAncho) {
      ultimoAncho = ancho;
      dibujar(ancho);
    }
  });
  ro.observe(contenedor);
  return () => ro.disconnect();
}

function crearTooltip(contenedor: HTMLElement) {
  const tip = document.createElement('div');
  tip.className = 'grafico-tooltip';
  tip.hidden = true;
  contenedor.append(tip);
  return tip;
}

function posicionarTooltip(tip: HTMLElement, x: number, ancho: number) {
  tip.hidden = false;
  const w = tip.offsetWidth;
  tip.style.left = `${Math.min(Math.max(x - w / 2, 0), ancho - w)}px`;
}

function ejes(M: Margenes, svg: SVGSVGElement, o: Opciones, ancho: number, alto: number, y: (v: number) => number, ticks: number[], xDe: (i: number) => number) {
  const g = el('g', { class: 'ejes' });
  for (const t of ticks) {
    g.append(el('line', { x1: M.izquierda, x2: ancho - M.derecha, y1: y(t), y2: y(t), class: 'grilla' }));
    const txt = el('text', { x: M.izquierda - 8, y: y(t), class: 'eje-y' });
    txt.textContent = `${t}${o.unidad}`;
    g.append(txt);
  }
  // Etiquetas del eje X, salteando las que no entran.
  // Separación mínima según el largo de la etiqueta más larga (~6.5px por carácter a 11px).
  const largo = Math.max(...o.etiquetasEje.map((e) => e.length));
  const minSeparacion = Math.max(36, largo * 6.5 + 14);
  let ultimaX = -Infinity;
  o.etiquetasEje.forEach((etq, i) => {
    const x = xDe(i);
    if (!etq || x - ultimaX < minSeparacion || x + (largo * 6.5) / 2 > ancho) return;
    ultimaX = x;
    const txt = el('text', { x, y: alto - 6, class: 'eje-x' });
    txt.textContent = etq;
    g.append(txt);
  });
  svg.append(g);
}

function zonaDesde(M: Margenes, svg: SVGSVGElement, o: Opciones, ancho: number, alto: number, xDe: (i: number) => number, medioPaso: number) {
  if (!o.desde) return;
  const x = xDe(o.desde.indice) - medioPaso;
  svg.append(el('rect', { x, y: M.arriba, width: ancho - M.derecha - x, height: alto - M.arriba - M.abajo, class: 'zona' }));
  svg.append(el('line', { x1: x, x2: x, y1: M.arriba, y2: alto - M.abajo, class: 'hoy' }));
  const txt = el('text', { x: ancho - M.derecha, y: M.arriba - 5, class: 'zona-texto' });
  txt.textContent = o.desde.texto;
  svg.append(txt);
}

export function graficoLineas(contenedor: HTMLElement, series: Serie[], o: Opciones) {
  contenedor.innerHTML = '';
  contenedor.classList.add('grafico');
  const tip = crearTooltip(contenedor);
  const n = o.etiquetas.length;
  const dec = o.decimales ?? 0;
  const M = { ...MARGENES, derecha: o.etiquetaFinal ? 52 : MARGENES.derecha };

  const dibujar = (ancho: number) => {
    contenedor.querySelector('svg')?.remove();
    const alto = o.alto ?? 220;
    const svg = el('svg', { width: ancho, height: alto, viewBox: `0 0 ${ancho} ${alto}`, role: 'img' });
    const todos = series.flatMap((s) => s.valores);
    const ticks = marcas(Math.min(...todos), Math.max(...todos));
    const [yMin, yMax] = [ticks[0], ticks[ticks.length - 1]];
    const y = (v: number) => alto - M.abajo - ((v - yMin) / (yMax - yMin)) * (alto - M.arriba - M.abajo);
    const paso = (ancho - M.izquierda - M.derecha) / Math.max(1, n - 1);
    const xDe = (i: number) => M.izquierda + i * paso;

    zonaDesde(M, svg, o, ancho, alto, xDe, paso / 2);
    ejes(M, svg, o, ancho, alto, y, ticks, xDe);

    for (const s of series) {
      const d = s.valores.map((v, i) => `${i ? 'L' : 'M'}${xDe(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
      svg.append(el('path', { d, class: 'linea', stroke: s.color }));
      if (o.etiquetaFinal) {
        const ultimo = s.valores[n - 1];
        const txt = el('text', { x: xDe(n - 1) + 8, y: y(ultimo), class: 'etiqueta-final' });
        txt.textContent = `${ultimo.toFixed(dec)}${o.unidad}`;
        svg.append(txt);
      }
    }

    // Capa de interacción: línea vertical + puntos + tooltip.
    const cruz = el('line', { y1: M.arriba, y2: alto - M.abajo, class: 'cruz', visibility: 'hidden' });
    const puntos = series.map((s) => el('circle', { r: 4.5, class: 'punto', fill: s.color, visibility: 'hidden' }));
    svg.append(cruz, ...puntos);
    const capa = el('rect', { x: M.izquierda - paso / 2, y: 0, width: ancho - M.izquierda - M.derecha + paso, height: alto, fill: 'transparent' });
    svg.append(capa);

    const mostrar = (i: number) => {
      const x = xDe(i);
      cruz.setAttribute('x1', String(x));
      cruz.setAttribute('x2', String(x));
      cruz.setAttribute('visibility', 'visible');
      puntos.forEach((p, k) => {
        p.setAttribute('cx', String(x));
        p.setAttribute('cy', String(y(series[k].valores[i])));
        p.setAttribute('visibility', 'visible');
      });
      tip.innerHTML = `<strong></strong>${series
        .map((s) => `<span><i style="background:${s.color}"></i>${s.nombre}: <b>${s.valores[i].toFixed(dec)}${o.unidad}</b></span>`)
        .join('')}`;
      tip.querySelector('strong')!.textContent = o.etiquetas[i];
      posicionarTooltip(tip, x, ancho);
    };
    const ocultar = () => {
      tip.hidden = true;
      cruz.setAttribute('visibility', 'hidden');
      puntos.forEach((p) => p.setAttribute('visibility', 'hidden'));
    };
    capa.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      mostrar(Math.min(n - 1, Math.max(0, Math.round((e.clientX - r.left - M.izquierda) / paso))));
    });
    capa.addEventListener('pointerleave', ocultar);
    contenedor.prepend(svg);
  };

  return montar(contenedor, dibujar);
}

export function graficoBarras(contenedor: HTMLElement, serie: Serie, o: Opciones) {
  contenedor.innerHTML = '';
  contenedor.classList.add('grafico');
  const tip = crearTooltip(contenedor);
  const n = o.etiquetas.length;
  const dec = o.decimales ?? 1;
  const M = MARGENES;

  const dibujar = (ancho: number) => {
    contenedor.querySelector('svg')?.remove();
    const alto = o.alto ?? 180;
    const svg = el('svg', { width: ancho, height: alto, viewBox: `0 0 ${ancho} ${alto}`, role: 'img' });
    const ticks = marcas(0, Math.max(1, ...serie.valores));
    const yMax = ticks[ticks.length - 1];
    const base = alto - M.abajo;
    const y = (v: number) => base - (v / yMax) * (alto - M.arriba - M.abajo);
    const paso = (ancho - M.izquierda - M.derecha) / n;
    const xDe = (i: number) => M.izquierda + paso * (i + 0.5);

    zonaDesde(M, svg, o, ancho, alto, xDe, paso / 2);
    ejes(M, svg, o, ancho, alto, y, ticks, xDe);

    const anchoBarra = Math.max(1, paso - 2); // 2px de separación entre barras
    const barras = serie.valores.map((v, i) => {
      const h = base - y(v);
      const x = xDe(i) - anchoBarra / 2;
      const r = Math.min(4, anchoBarra / 2, h);
      // Solo las esquinas superiores redondeadas; la base queda recta sobre el eje.
      const d = h <= 0 ? '' : `M${x},${base}V${base - h + r}q0,-${r} ${r},-${r}H${x + anchoBarra - r}q${r},0 ${r},${r}V${base}Z`;
      const barra = el('path', { d, fill: serie.color, class: 'barra' });
      svg.append(barra);
      return barra;
    });

    const capa = el('rect', { x: M.izquierda, y: 0, width: ancho - M.izquierda - M.derecha, height: alto, fill: 'transparent' });
    svg.append(capa);
    capa.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const i = Math.min(n - 1, Math.max(0, Math.floor((e.clientX - r.left - M.izquierda) / paso)));
      barras.forEach((b, k) => b.classList.toggle('atenuada', k !== i));
      tip.innerHTML = `<strong></strong><span><i style="background:${serie.color}"></i>${serie.nombre}: <b>${serie.valores[i].toFixed(dec)}${o.unidad}</b></span>`;
      tip.querySelector('strong')!.textContent = o.etiquetas[i];
      posicionarTooltip(tip, xDe(i), ancho);
    });
    capa.addEventListener('pointerleave', () => {
      tip.hidden = true;
      barras.forEach((b) => b.classList.remove('atenuada'));
    });
    contenedor.prepend(svg);
  };

  return montar(contenedor, dibujar);
}
