import { dibujarEnCanvas } from './imagenes';

export type TamanoPagina = 'a4' | 'imagen';

const A4 = { ancho: 595.28, alto: 841.89 }; // en puntos
const MARGEN = 24;
const PX_A_PT = 0.75;

export async function imagenesAPdf(archivos: File[], tamano: TamanoPagina): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  let pdf: InstanceType<typeof jsPDF> | undefined;

  for (const archivo of archivos) {
    const canvas = await dibujarEnCanvas(archivo, 2400, true);
    const datos = canvas.toDataURL('image/jpeg', 0.9);
    const horizontal = canvas.width > canvas.height;

    let anchoPagina: number, altoPagina: number;
    if (tamano === 'a4') {
      anchoPagina = horizontal ? A4.alto : A4.ancho;
      altoPagina = horizontal ? A4.ancho : A4.alto;
    } else {
      anchoPagina = canvas.width * PX_A_PT;
      altoPagina = canvas.height * PX_A_PT;
    }

    const orientacion = horizontal ? 'landscape' : 'portrait';
    if (!pdf) {
      pdf = new jsPDF({ unit: 'pt', format: [anchoPagina, altoPagina], orientation: orientacion });
    } else {
      pdf.addPage([anchoPagina, altoPagina], orientacion);
    }

    if (tamano === 'a4') {
      const escala = Math.min(
        (anchoPagina - MARGEN * 2) / canvas.width,
        (altoPagina - MARGEN * 2) / canvas.height,
      );
      const w = canvas.width * escala;
      const h = canvas.height * escala;
      pdf.addImage(datos, 'JPEG', (anchoPagina - w) / 2, (altoPagina - h) / 2, w, h);
    } else {
      pdf.addImage(datos, 'JPEG', 0, 0, anchoPagina, altoPagina);
    }
  }

  if (!pdf) throw new Error('No hay imágenes para convertir');
  return pdf.output('blob');
}
