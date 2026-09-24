import { nombreBase } from './util';

export type FormatoImagen = 'image/png' | 'image/jpeg' | 'image/webp';

export const EXTENSIONES: Record<FormatoImagen, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface OpcionesImagen {
  formato: FormatoImagen;
  calidad: number; // 0 a 1, se ignora en PNG
  anchoMaximo?: number;
}

export async function dibujarEnCanvas(archivo: File, anchoMaximo?: number, fondoBlanco = false) {
  const bitmap = await createImageBitmap(archivo);
  const escala = anchoMaximo && bitmap.width > anchoMaximo ? anchoMaximo / bitmap.width : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d')!;
  if (fondoBlanco) {
    // JPG no tiene transparencia: sin esto las zonas transparentes quedan negras.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export async function convertirImagen(archivo: File, opciones: OpcionesImagen) {
  const { formato, calidad, anchoMaximo } = opciones;
  const canvas = await dibujarEnCanvas(archivo, anchoMaximo, formato === 'image/jpeg');
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo convertir la imagen'))), formato, calidad),
  );
  // Si el navegador no soporta el formato pedido, toBlob devuelve PNG.
  if (blob.type !== formato) {
    throw new Error(`Tu navegador no puede generar ${EXTENSIONES[formato].toUpperCase()}`);
  }
  return {
    blob,
    nombre: `${nombreBase(archivo.name)}.${EXTENSIONES[formato]}`,
    ancho: canvas.width,
    alto: canvas.height,
  };
}
