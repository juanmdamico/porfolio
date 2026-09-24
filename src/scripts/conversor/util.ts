export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function nombreBase(nombre: string): string {
  const i = nombre.lastIndexOf('.');
  return i > 0 ? nombre.slice(0, i) : nombre;
}

export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Conecta una zona de "arrastrar y soltar" con su <input type="file">. */
export function iniciarZona(zona: HTMLElement, alRecibir: (archivos: File[]) => void): void {
  const input = zona.querySelector('input[type="file"]') as HTMLInputElement;
  const aceptar = (lista: FileList | null) => {
    const archivos = Array.from(lista ?? []);
    if (archivos.length) alRecibir(archivos);
  };

  input.addEventListener('change', () => {
    aceptar(input.files);
    input.value = '';
  });
  zona.addEventListener('dragover', (e) => {
    e.preventDefault();
    zona.classList.add('activa');
  });
  zona.addEventListener('dragleave', () => zona.classList.remove('activa'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('activa');
    aceptar(e.dataTransfer?.files ?? null);
  });
}
