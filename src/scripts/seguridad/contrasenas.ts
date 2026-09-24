export const CONJUNTOS = {
  minusculas: 'abcdefghijklmnopqrstuvwxyz',
  mayusculas: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numeros: '0123456789',
  simbolos: '!@#$%^&*()-_=+[]{};:,.?/~',
} as const;

export type Conjunto = keyof typeof CONJUNTOS;
const AMBIGUOS = /[Il1O0o]/g;

/**
 * Número aleatorio uniforme en [0, max) usando el generador criptográfico del navegador.
 * Descarta los valores del final del rango para evitar el "sesgo de módulo".
 */
export function aleatorio(max: number): number {
  const limite = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0] >= limite);
  return buffer[0] % max;
}

export interface OpcionesContrasena {
  largo: number;
  conjuntos: Conjunto[];
  sinAmbiguos: boolean;
}

export function generarContrasena({ largo, conjuntos, sinAmbiguos }: OpcionesContrasena): string {
  if (!conjuntos.length) throw new Error('Elegí al menos un tipo de carácter.');
  const grupos = conjuntos.map((c) => (sinAmbiguos ? CONJUNTOS[c].replace(AMBIGUOS, '') : CONJUNTOS[c]));
  const todos = grupos.join('');
  // Garantiza al menos un carácter de cada tipo elegido…
  const chars = grupos.map((g) => g[aleatorio(g.length)]);
  while (chars.length < largo) chars.push(todos[aleatorio(todos.length)]);
  // …y los mezcla (Fisher–Yates) para que no queden siempre al principio.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.slice(0, largo).join('');
}

/** Entropía en bits de una contraseña generada al azar. */
export function entropiaGenerada({ largo, conjuntos, sinAmbiguos }: OpcionesContrasena): number {
  const tamano = conjuntos.reduce((n, c) => n + (sinAmbiguos ? CONJUNTOS[c].replace(AMBIGUOS, '') : CONJUNTOS[c]).length, 0);
  return tamano ? largo * Math.log2(tamano) : 0;
}

const COMUNES = ['123456', 'password', 'qwerty', 'contraseña', 'contrasena', 'admin', 'abc123', 'iloveyou', 'dragon', 'monkey', 'futbol', 'boca', 'river', 'hola', 'test'];

/**
 * Estimación de la fuerza de una contraseña escrita por una persona.
 * Parte del tamaño del alfabeto y penaliza patrones previsibles.
 */
export function entropiaEscrita(clave: string): { bits: number; problemas: string[] } {
  const problemas: string[] = [];
  if (!clave) return { bits: 0, problemas };
  let alfabeto = 0;
  if (/[a-z]/.test(clave)) alfabeto += 26;
  if (/[A-Z]/.test(clave)) alfabeto += 26;
  if (/\d/.test(clave)) alfabeto += 10;
  if (/[^a-zA-Z\d]/.test(clave)) alfabeto += 33;
  let bits = clave.length * Math.log2(alfabeto || 1);

  const minus = clave.toLowerCase();
  if (COMUNES.some((c) => minus.includes(c))) {
    bits *= 0.35;
    problemas.push('Contiene una palabra o secuencia muy común.');
  }
  if (/(.)\1{2,}/.test(clave)) {
    bits *= 0.7;
    problemas.push('Repite el mismo carácter varias veces.');
  }
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(clave)) {
    bits *= 0.7;
    problemas.push('Tiene secuencias del teclado o del abecedario.');
  }
  if (/(19|20)\d\d/.test(clave)) {
    bits *= 0.85;
    problemas.push('Parece incluir un año.');
  }
  if (clave.length < 12) problemas.push('Es corta: usá al menos 12 caracteres.');
  if (alfabeto <= 26) problemas.push('Usa un solo tipo de carácter.');
  return { bits, problemas };
}

export function nivel(bits: number): { texto: string; valor: 0 | 1 | 2 | 3 | 4 } {
  if (bits < 28) return { texto: 'Muy débil', valor: 0 };
  if (bits < 40) return { texto: 'Débil', valor: 1 };
  if (bits < 60) return { texto: 'Aceptable', valor: 2 };
  if (bits < 80) return { texto: 'Fuerte', valor: 3 };
  return { texto: 'Muy fuerte', valor: 4 };
}

/** Tiempo estimado para adivinarla a 10 mil millones de intentos por segundo (ataque offline). */
export function tiempoParaRomper(bits: number): string {
  const segundos = 2 ** bits / 2 / 1e10;
  const unidades: [number, string, string][] = [
    [60, 'segundo', 'segundos'],
    [60, 'minuto', 'minutos'],
    [24, 'hora', 'horas'],
    [365, 'día', 'días'],
    [1000, 'año', 'años'],
    [1000, 'mil años', 'mil años'],
    [1000, 'millón de años', 'millones de años'],
  ];
  if (segundos < 1) return 'al instante';
  let v = segundos;
  for (const [factor, uno, varios] of unidades) {
    if (v < factor) return `${Math.round(v) === 1 ? `1 ${uno}` : `${Math.round(v)} ${varios}`}`;
    v /= factor;
  }
  return 'miles de millones de años';
}

/**
 * Consulta Have I Been Pwned con k-anonimato: solo se envían los primeros 5
 * caracteres del hash SHA-1. La contraseña nunca sale del navegador.
 */
export async function vecesFiltrada(clave: string): Promise<number> {
  const datos = new TextEncoder().encode(clave);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-1', datos))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  const [prefijo, resto] = [hash.slice(0, 5), hash.slice(5)];
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefijo}`, { headers: { 'Add-Padding': 'true' } });
  if (!res.ok) throw new Error('No se pudo consultar la base de filtraciones.');
  const linea = (await res.text()).split('\n').find((l) => l.startsWith(resto));
  return linea ? Number(linea.split(':')[1]) : 0;
}
