export type RGB = [number, number, number];

export interface Color {
  rgb: RGB;
  hex: string;
  /** Proporción de la imagen que ocupa este color (0 a 1) */
  peso: number;
}

// ---------- Conversiones ----------

export const aHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

export function aHsl([r, g, b]: RGB): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

const lineal = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Luminancia relativa (WCAG) */
export const luminancia = ([r, g, b]: RGB) => 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);

export function contraste(a: RGB, b: RGB): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Color de texto (negro o blanco) con mejor contraste sobre el fondo. */
export const textoSobre = (fondo: RGB): RGB =>
  contraste(fondo, [0, 0, 0]) >= contraste(fondo, [255, 255, 255]) ? [0, 0, 0] : [255, 255, 255];

/** RGB → OKLab: un espacio donde la distancia se parece a la diferencia que percibe el ojo. */
function aOklab([r, g, b]: RGB): RGB {
  const [R, G, B] = [lineal(r), lineal(g), lineal(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const distancia2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// ---------- Extracción de la paleta ----------

/** Toma una muestra de píxeles de la imagen (reducida para que sea rápido). */
export function muestrear(imagen: CanvasImageSource & { width: number; height: number }, lado = 120): RGB[] {
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(imagen.width * escala));
  canvas.height = Math.max(1, Math.round(imagen.height * escala));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixeles: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // ignora píxeles transparentes
    pixeles.push([data[i], data[i + 1], data[i + 2]]);
  }
  return pixeles;
}

/**
 * K-means con inicialización k-means++ en espacio OKLab.
 * Agrupa los píxeles en `k` colores representativos.
 */
export function extraerPaleta(pixeles: RGB[], k: number, iteraciones = 12): Color[] {
  if (!pixeles.length) return [];
  const puntos = pixeles.map(aOklab);
  k = Math.min(k, puntos.length);

  // Semilla fija: la misma imagen da siempre la misma paleta.
  let semilla = 42;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);

  // k-means++: cada centro nuevo se elige lejos de los anteriores.
  const centros: RGB[] = [puntos[Math.floor(azar() * puntos.length)]];
  const dist = puntos.map((p) => distancia2(p, centros[0]));
  while (centros.length < k) {
    const total = dist.reduce((a, b) => a + b, 0);
    let objetivo = azar() * total;
    let elegido = 0;
    for (; elegido < puntos.length - 1 && objetivo > dist[elegido]; elegido++) objetivo -= dist[elegido];
    centros.push(puntos[elegido]);
    puntos.forEach((p, i) => (dist[i] = Math.min(dist[i], distancia2(p, puntos[elegido]))));
  }

  const grupo = new Int32Array(puntos.length);
  for (let it = 0; it < iteraciones; it++) {
    let cambios = 0;
    puntos.forEach((p, i) => {
      let mejor = 0;
      let mejorD = Infinity;
      centros.forEach((c, j) => {
        const d = distancia2(p, c);
        if (d < mejorD) [mejor, mejorD] = [j, d];
      });
      if (grupo[i] !== mejor) cambios++;
      grupo[i] = mejor;
    });
    // Recalcula cada centro como el promedio de su grupo.
    const sumas = centros.map(() => [0, 0, 0, 0]);
    puntos.forEach((p, i) => {
      const s = sumas[grupo[i]];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    });
    sumas.forEach((s, j) => s[3] && (centros[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]));
    if (it > 0 && cambios === 0) break;
  }

  // El color de cada grupo es el promedio en RGB de sus píxeles originales.
  const acum = centros.map(() => [0, 0, 0, 0]);
  pixeles.forEach((px, i) => {
    const a = acum[grupo[i]];
    a[0] += px[0];
    a[1] += px[1];
    a[2] += px[2];
    a[3]++;
  });
  return acum
    .filter((a) => a[3] > 0)
    .map((a) => {
      const rgb: RGB = [Math.round(a[0] / a[3]), Math.round(a[1] / a[3]), Math.round(a[2] / a[3])];
      return { rgb, hex: aHex(rgb), peso: a[3] / pixeles.length };
    })
    .sort((x, y) => y.peso - x.peso);
}

// ---------- Exportación ----------

export function exportar(colores: Color[], formato: 'css' | 'scss' | 'tailwind' | 'json'): string {
  const nombres = colores.map((_, i) => `color-${i + 1}`);
  switch (formato) {
    case 'css':
      return `:root {\n${colores.map((c, i) => `  --${nombres[i]}: ${c.hex};`).join('\n')}\n}`;
    case 'scss':
      return colores.map((c, i) => `$${nombres[i]}: ${c.hex};`).join('\n');
    case 'tailwind': {
      // En Tailwind la escala va del más claro (100) al más oscuro.
      const ordenados = [...colores].sort((a, b) => luminancia(b.rgb) - luminancia(a.rgb));
      return `// tailwind.config.js → theme.extend.colors\npaleta: {\n${ordenados.map((c, i) => `  ${(i + 1) * 100}: '${c.hex}',`).join('\n')}\n},`;
    }
    case 'json':
      return JSON.stringify(colores.map((c) => ({ hex: c.hex, rgb: c.rgb, porcentaje: +(c.peso * 100).toFixed(1) })), null, 2);
  }
}
