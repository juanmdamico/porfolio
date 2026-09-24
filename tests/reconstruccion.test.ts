import { describe, expect, it } from 'vitest';
import { reconstruir, type Fragmento } from '../src/scripts/conversor/reconstruccion';

/** Arma fragmentos como los que devuelve un PDF: y crece hacia arriba. */
let y = 800;
const f = (texto: string, o: Partial<Fragmento> = {}): Fragmento => ({
  texto, x: 56, y, ancho: texto.length * 5, tamano: 11, negrita: false, cursiva: false, pagina: 1, ...o,
});
const linea = (salto: number, ...frag: Fragmento[]) => {
  y -= salto;
  return frag.map((x) => ({ ...x, y }));
};
const texto = (b: { tramos: { texto: string }[] }) => b.tramos.map((t) => t.texto).join('');

describe('Reconstrucción de PDF', () => {
  it('detecta títulos por tamaño y une líneas del mismo párrafo', () => {
    y = 800;
    const bloques = reconstruir([
      ...linea(0, f('Informe anual', { tamano: 24, negrita: true })),
      ...linea(40, f('Este es un párrafo que ocupa')),
      ...linea(13, f('dos líneas en el PDF.')),
      ...linea(24, f('Resultados', { tamano: 15, negrita: true })),
      ...linea(24, f('Otro párrafo distinto.')),
      ...linea(13, f('Este también es de relleno para que el cuerpo sea el tamaño más común.')),
    ]);
    expect(bloques.map((b) => b.tipo)).toEqual(['titulo1', 'parrafo', 'titulo2', 'parrafo', 'parrafo']);
    expect(texto(bloques[0])).toBe('Informe anual');
    expect(texto(bloques[1])).toBe('Este es un párrafo que ocupa dos líneas en el PDF.');
    expect(texto(bloques[2])).toBe('Resultados');
    // Una línea corta que termina en punto cierra el párrafo.
    expect(texto(bloques[3])).toBe('Otro párrafo distinto.');
  });

  it('separa párrafos cuando hay más espacio entre ellos', () => {
    y = 800;
    const bloques = reconstruir([
      ...linea(0, f('Primer párrafo que sigue')),
      ...linea(13, f('en esta línea.')),
      ...linea(26, f('Segundo párrafo.')),
    ]);
    expect(bloques.map(texto)).toEqual(['Primer párrafo que sigue en esta línea.', 'Segundo párrafo.']);
  });

  it('conserva negritas y cursivas dentro de una línea', () => {
    y = 800;
    const bloques = reconstruir(
      linea(0, f('Texto '), f('importante', { x: 86, negrita: true }), f(' y ', { x: 136 }), f('énfasis', { x: 151, cursiva: true })),
    );
    expect(bloques[0].tramos).toEqual([
      { texto: 'Texto ', negrita: false, cursiva: false },
      { texto: 'importante', negrita: true, cursiva: false },
      { texto: ' y ', negrita: false, cursiva: false },
      { texto: 'énfasis', negrita: false, cursiva: true },
    ]);
  });

  it('agrega espacio entre fragmentos separados sin espacio', () => {
    y = 800;
    const bloques = reconstruir(linea(0, f('Hola', { ancho: 20 }), f('mundo', { x: 56 + 20 + 3 })));
    expect(texto(bloques[0])).toBe('Hola mundo');
  });

  it('detecta listas con viñetas y numeradas, y quita el marcador', () => {
    y = 800;
    const bloques = reconstruir([
      ...linea(0, f('• Manzanas')),
      ...linea(14, f('• Peras que tienen un texto')),
      ...linea(13, f('largo en dos líneas', { x: 70 })),
      ...linea(20, f('1. Primero')),
      ...linea(14, f('2) Segundo')),
    ]);
    expect(bloques.map((b) => [b.tipo, texto(b)])).toEqual([
      ['vinieta', 'Manzanas'],
      ['vinieta', 'Peras que tienen un texto largo en dos líneas'],
      ['numerado', 'Primero'],
      ['numerado', 'Segundo'],
    ]);
  });

  it('vuelve a unir palabras cortadas con guion', () => {
    y = 800;
    const bloques = reconstruir([...linea(0, f('Una palabra muy lar-')), ...linea(13, f('ga termina acá.'))]);
    expect(texto(bloques[0])).toBe('Una palabra muy larga termina acá.');
  });

  it('continúa un párrafo en la página siguiente si no terminó en punto', () => {
    y = 800;
    const a = linea(0, f('Esta oración sigue'));
    y = 800;
    const b = linea(0, f('en la otra página.', { pagina: 2 }), f('', { pagina: 2 }));
    const bloques = reconstruir([...a, ...b]);
    expect(bloques.map(texto)).toEqual(['Esta oración sigue en la otra página.']);
  });

  it('ordena cada línea de izquierda a derecha (números de lista guardados después del texto)', () => {
    y = 800;
    const bloques = reconstruir([
      ...linea(0, f('Paso uno', { x: 72 }), f('1.', { x: 56, ancho: 8 })),
      ...linea(14, f('Paso dos', { x: 72 }), f('2.', { x: 56, ancho: 8 })),
    ]);
    expect(bloques.map((b) => [b.tipo, texto(b)])).toEqual([
      ['numerado', 'Paso uno'],
      ['numerado', 'Paso dos'],
    ]);
  });

  it('reconoce listas con viñetas dibujadas (sin texto) por la sangría', () => {
    y = 800;
    const largo = 'x'.repeat(90); // una línea que llega hasta el margen derecho
    const bloques = reconstruir([
      ...linea(0, f(`Texto normal del documento que ocupa todo el ancho ${largo}`)),
      ...linea(20, f('Diseño del sitio', { x: 80 })),
      ...linea(14, f(`Desarrollo con un texto que es muy largo ${largo}`, { x: 80 })),
      ...linea(14, f('y sigue en otra línea', { x: 80 })),
      ...linea(14, f('Publicación', { x: 80 })),
      ...linea(20, f('Cierre.')),
    ]);
    expect(bloques.map((b) => [b.tipo, texto(b).slice(0, 30)])).toEqual([
      ['parrafo', 'Texto normal del documento que'],
      ['vinieta', 'Diseño del sitio'],
      ['vinieta', 'Desarrollo con un texto que es'],
      ['vinieta', 'Publicación'],
      ['parrafo', 'Cierre.'],
    ]);
    expect(texto(bloques[2])).toMatch(/y sigue en otra línea$/);
  });

  it('no confunde la sangría de primera línea de un párrafo con una lista', () => {
    y = 800;
    const largo = 'x'.repeat(90);
    const bloques = reconstruir([
      ...linea(0, f(`Empieza con sangría ${largo}`, { x: 80 })),
      ...linea(14, f(`y sigue sin sangría ${largo}`)),
      ...linea(14, f('hasta terminar.')),
    ]);
    expect(bloques.map((b) => b.tipo)).toEqual(['parrafo']);
  });
});
