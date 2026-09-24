import { describe, expect, it } from 'vitest';
import { reconstruir as reconstruirDoc, type Fragmento, type BloqueTexto } from '../src/scripts/conversor/reconstruccion';

/** Los bloques de texto del documento reconstruido. */
const reconstruir = (f: Fragmento[]) => reconstruirDoc(f).bloques as BloqueTexto[];

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
    expect(bloques[0].tramos.map(({ texto, negrita, cursiva }) => ({ texto, negrita, cursiva }))).toEqual([
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

describe('Reconstrucción de PDF: tablas, alineación y formato', () => {
  const doc = (frags: Fragmento[], reglas = []) => reconstruirDoc(frags, reglas);
  const cuerpo = (t: string, o: Partial<Fragmento> = {}) => f(t, { ancho: 480, ...o }); // renglón a todo el ancho

  it('detecta una tabla por las columnas alineadas, aunque pdf.js rellene los huecos con espacios', () => {
    y = 800;
    const r = doc([
      ...linea(0, cuerpo('Texto de introducción que ocupa todo el ancho de la página.')),
      ...linea(30, f('L 200', { x: 243, ancho: 23, negrita: true, fondo: 'b22222', color: 'ffffff' }), f(' ', { x: 266, ancho: 55 }), f('L 300', { x: 321, ancho: 23, negrita: true, fondo: 'b22222', color: 'ffffff' })),
      ...linea(22, f('Entre 18 y 27 años', { x: 74, ancho: 90 }), f(' ', { x: 164, ancho: 80 }), f('70 %', { x: 244.2, ancho: 20.5 }), f('70 %', { x: 322.1, ancho: 20.5 })),
      ...linea(22, f('Entre 28 y 35 años', { x: 74, ancho: 90 }), f('0 %', { x: 247, ancho: 15 }), f('0 %', { x: 325, ancho: 15 })),
      ...linea(30, cuerpo('Texto final.')),
    ]);
    const tabla = r.bloques.find((b) => b.tipo === 'tabla');
    expect(tabla?.tipo).toBe('tabla');
    if (tabla?.tipo !== 'tabla') return;
    expect(tabla.filas).toHaveLength(3);
    expect(tabla.filas.map((f) => f.map((c) => (c ? c.tramos.map((t) => t.texto).join('') : null)))).toEqual([
      ['', 'L 200', 'L 300'], // la celda vacía del encabezado existe y toma el fondo de su fila
      ['Entre 18 y 27 años', '70 %', '70 %'],
      ['Entre 28 y 35 años', '0 %', '0 %'],
    ]);
    // Los números están centrados en su columna; los textos de la primera, a la izquierda.
    expect(tabla.filas[1].map((c) => c?.alineacion)).toEqual(['izquierda', 'centro', 'centro']);
    expect(tabla.filas[0][1]?.fondo).toBe('b22222');
    expect(tabla.altoFila).toBeCloseTo(22);
    expect(r.bloques.at(-1)?.tipo).toBe('parrafo');
  });

  it('detecta texto centrado y justificado', () => {
    y = 800;
    const r = doc([
      ...linea(0, f('Título centrado', { x: 240, ancho: 115, tamano: 20, negrita: true })),
      ...linea(30, cuerpo('Un párrafo justificado cuyas líneas llegan todas')),
      ...linea(13, cuerpo('exactamente hasta el margen derecho de la hoja')),
      ...linea(13, f('salvo la última.', { ancho: 80 })),
    ]).bloques as BloqueTexto[];
    expect(r.map((b) => [b.tipo, b.alineacion])).toEqual([
      ['titulo1', 'centro'],
      ['parrafo', 'justificado'],
    ]);
    expect(r[1].interlineado).toBeCloseTo(13);
  });

  it('toma como subtítulo un renglón en negrita seguido de texto normal, conservando su número', () => {
    y = 800;
    const r = doc([
      ...linea(0, f('1. ÁMBITO DE APLICACIÓN', { negrita: true })),
      ...linea(13, cuerpo('El presente contrato reviste carácter individual.')),
      ...linea(20, f('2. OBJETO', { negrita: true })),
      ...linea(13, cuerpo('El presente contrato tiene por objeto…')),
    ]).bloques as BloqueTexto[];
    expect(r.map((b) => [b.tipo, b.tramos.map((t) => t.texto).join('')])).toEqual([
      ['titulo3', '1. ÁMBITO DE APLICACIÓN'],
      ['parrafo', 'El presente contrato reviste carácter individual.'],
      ['titulo3', '2. OBJETO'],
      ['parrafo', 'El presente contrato tiene por objeto…'],
    ]);
  });

  it('conserva color y tamaño de cada tramo, y no toma "*" como viñeta', () => {
    y = 800;
    const [b] = doc([...linea(0, f('* Nota al pie', { tamano: 7.5, color: '888888' }))]).bloques as BloqueTexto[];
    expect(b.tipo).toBe('parrafo');
    expect(b.tramos[0]).toMatchObject({ texto: '* Nota al pie', tamano: 7.5, color: '888888' });
  });

  it('asigna una línea horizontal al bloque que tiene justo encima', () => {
    y = 800;
    const frags = [...linea(0, f('Encabezado', { x: 240, ancho: 115 })), ...linea(40, cuerpo('Texto.'))];
    const [encabezado, texto] = doc(frags, [{ pagina: 1, y: 790, x0: 56, x1: 536, color: 'b22222' }] as never).bloques as BloqueTexto[];
    expect(encabezado.lineaDebajo).toBe('b22222');
    expect(texto.lineaDebajo).toBeUndefined();
  });

  it('traduce nombres de fuentes de PDF a fuentes de Word', async () => {
    const { fuenteWord } = await import('../src/scripts/conversor/reconstruccion');
    expect(fuenteWord('Helvetica-Bold')).toBe('Arial');
    expect(fuenteWord('ABCDEF+ArialMT')).toBe('Arial');
    expect(fuenteWord('TimesNewRomanPS-BoldMT')).toBe('Times New Roman');
    expect(fuenteWord('Courier')).toBe('Courier New');
    expect(fuenteWord('ABCDEF+Roboto-Medium')).toBe('Roboto');
  });

  it('marca un salto de página cuando una hoja del PDF termina mucho antes del margen', () => {
    const renglones = (pagina: number, desde: number, cantidad: number, texto: string) =>
      Array.from({ length: cantidad }, (_, k) => f(`${texto} ${k}`, { pagina, y: desde - k * 14, ancho: 480 }));
    const r = doc([
      ...renglones(1, 780, 10, 'Hoja uno'), // termina alto: hay un salto intencional
      ...renglones(2, 780, 50, 'Hoja dos'), // llega hasta abajo
      ...renglones(3, 780, 5, 'Hoja tres'),
    ]).bloques as BloqueTexto[];
    const conSalto = r.filter((b) => b.saltoAntes).map((b) => b.tramos[0].texto.split(' ').slice(0, 2).join(' '));
    expect(conSalto).toEqual(['Hoja dos']);
  });
});
