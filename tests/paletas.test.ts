import { describe, expect, it } from 'vitest';
import { extraerPaleta, contraste, aHex, aHsl, exportar, type RGB } from '../src/scripts/paletas/colores';

describe('Paletas', () => {
  it('encuentra los colores dominantes y su proporción', () => {
    const pixeles: RGB[] = [...Array(700).fill([255, 0, 0]), ...Array(300).fill([0, 0, 255])];
    const paleta = extraerPaleta(pixeles, 2);
    expect(paleta.map((c) => c.hex)).toEqual(['#ff0000', '#0000ff']);
    expect(paleta[0].peso).toBeCloseTo(0.7);
  });

  it('da siempre el mismo resultado para la misma imagen', () => {
    const pixeles: RGB[] = Array.from({ length: 500 }, (_, i) => [(i * 37) % 256, (i * 91) % 256, (i * 13) % 256]);
    expect(extraerPaleta(pixeles, 5)).toEqual(extraerPaleta(pixeles, 5));
  });

  it('calcula el contraste WCAG', () => {
    expect(contraste([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(contraste([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 1);
  });

  it('convierte entre formatos', () => {
    expect(aHex([79, 70, 229])).toBe('#4f46e5');
    expect(aHsl([255, 0, 0])).toEqual([0, 100, 50]);
  });

  it('exporta Tailwind del más claro al más oscuro', () => {
    const paleta = extraerPaleta([...Array(50).fill([10, 10, 10]), ...Array(40).fill([250, 250, 250])] as RGB[], 2);
    expect(exportar(paleta, 'tailwind')).toMatch(/100: '#fafafa',\n {2}200: '#0a0a0a'/);
  });
});
