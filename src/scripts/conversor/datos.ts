type Fila = Record<string, unknown>;

/** Detecta el separador mirando la primera línea: coma, punto y coma o tabulación. */
export function detectarSeparador(texto: string): string {
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? '';
  const candidatos = [',', ';', '\t'];
  return candidatos.reduce((mejor, c) =>
    primeraLinea.split(c).length > primeraLinea.split(mejor).length ? c : mejor,
  );
}

/** Parser de CSV que respeta comillas, comillas escapadas ("") y saltos de línea dentro de campos. */
export function parsearCsv(texto: string, separador = detectarSeparador(texto)): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

function convertirValor(valor: string): unknown {
  const v = valor.trim();
  if (v === '') return null;
  if (v === 'true' || v === 'false') return v === 'true';
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v)) return Number(v);
  return valor;
}

export function csvAJson(texto: string, detectarTipos = true): string {
  const [encabezados, ...filas] = parsearCsv(texto);
  if (!encabezados) throw new Error('El CSV está vacío');
  const objetos = filas.map((fila) =>
    Object.fromEntries(
      encabezados.map((col, i) => {
        const valor = fila[i] ?? '';
        return [col.trim(), detectarTipos ? convertirValor(valor) : valor];
      }),
    ),
  );
  return JSON.stringify(objetos, null, 2);
}

function escaparCampo(valor: unknown, separador: string): string {
  if (valor === null || valor === undefined) return '';
  const texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  return /["\n\r]/.test(texto) || texto.includes(separador) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function jsonACsv(texto: string, separador = ','): string {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error('El JSON no es válido');
  }
  const filas: Fila[] = (Array.isArray(datos) ? datos : [datos]).map((d) =>
    d !== null && typeof d === 'object' && !Array.isArray(d) ? (d as Fila) : { valor: d },
  );
  if (!filas.length) throw new Error('El JSON no tiene elementos');

  // Unión de todas las claves, en el orden en que aparecen.
  const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))];
  const lineas = [
    columnas.map((c) => escaparCampo(c, separador)).join(separador),
    ...filas.map((f) => columnas.map((c) => escaparCampo(f[c], separador)).join(separador)),
  ];
  return lineas.join('\n');
}
