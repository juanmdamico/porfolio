export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Muestra un mensaje en la línea de estado de la herramienta (#aviso). */
export function avisar(mensaje: string, error = false): void {
  const aviso = $('aviso');
  aviso.textContent = mensaje;
  aviso.classList.toggle('error', error);
}

export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copiar(texto: string, mensaje = 'Copiado al portapapeles.'): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    avisar(mensaje);
  } catch {
    avisar('No se pudo copiar. Seleccioná el texto y copialo a mano.', true);
  }
}

/** Lee una variable CSS (por ejemplo un color del tema actual). */
export const colorCss = (nombre: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
