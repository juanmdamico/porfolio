import { nombreBase } from './util';
import { reconstruir, type Fragmento, type Bloque } from './reconstruccion';

export interface ResultadoDocumento {
  blob: Blob;
  nombre: string;
  avisos: string[];
}

const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function tipoDocumento(archivo: File): 'docx' | 'pdf' | 'doc' | null {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith('.docx') || archivo.type === TIPO_DOCX) return 'docx';
  if (nombre.endsWith('.pdf') || archivo.type === 'application/pdf') return 'pdf';
  if (nombre.endsWith('.doc')) return 'doc';
  return null;
}

// ---------- Word → PDF ----------

/** A4 en puntos, con márgenes de 2 cm. */
const MARGEN = 56;
const ANCHO_UTIL = 595.28 - MARGEN * 2;

export async function wordAPdf(archivo: File): Promise<ResultadoDocumento> {
  // Todo se carga recién cuando hace falta: son librerías pesadas.
  const [mammothMod, pdfMakeMod, fuentesMod, htmlMod] = await Promise.all([
    import('mammoth'),
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    import('html-to-pdfmake'),
  ]);
  const mammoth = (mammothMod as any).default ?? mammothMod;
  const pdfMake = (pdfMakeMod as any).default ?? pdfMakeMod;
  const fuentes = (fuentesMod as any).default ?? fuentesMod;
  const htmlAPdfmake = (htmlMod as any).default ?? htmlMod;
  pdfMake.addVirtualFileSystem(fuentes);

  const avisos: string[] = [];
  let resultado;
  try {
    resultado = await mammoth.convertToHtml({ arrayBuffer: await archivo.arrayBuffer() });
  } catch {
    throw new Error(`${archivo.name}: no es un documento de Word válido.`);
  }

  // pdfmake solo acepta PNG y JPG. Las demás (GIF, BMP, WebP…) se pasan a PNG con un canvas;
  // las que el navegador no sabe dibujar (EMF, WMF de Office) se omiten.
  let omitidas = 0;
  const imagenes = [...(resultado.value as string).matchAll(/<img [^>]*src="(data:image\/([a-z+.-]+);base64,[^"]*)"[^>]*>/gi)];
  const reemplazos = new Map<string, string>();
  for (const [img, src, tipo] of imagenes) {
    if (/^(png|jpe?g)$/i.test(tipo) || reemplazos.has(img)) continue;
    try {
      const bitmap = await createImageBitmap(await (await fetch(src)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      reemplazos.set(img, img.replace(src, canvas.toDataURL('image/png')));
    } catch {
      reemplazos.set(img, '');
      omitidas++;
    }
  }
  const html = (resultado.value as string).replace(/<img [^>]*>/gi, (img) => reemplazos.get(img) ?? img);
  if (omitidas) avisos.push(`Se omitieron ${omitidas} imagen(es) en un formato que el navegador no puede mostrar (por ejemplo EMF o WMF).`);

  const contenido = htmlAPdfmake(html || '<p></p>', {
    defaultStyles: {
      h1: { fontSize: 22, bold: true, marginBottom: 8, marginTop: 12 },
      h2: { fontSize: 17, bold: true, marginBottom: 6, marginTop: 10 },
      h3: { fontSize: 14, bold: true, marginBottom: 4, marginTop: 8 },
      p: { marginBottom: 8 },
      table: { marginBottom: 10 },
      th: { bold: true, fillColor: '#f1f5f9' },
    },
  });

  // Las imágenes sin tamaño se ajustan al ancho de la página.
  const ajustarImagenes = (nodo: any) => {
    if (Array.isArray(nodo)) return nodo.forEach(ajustarImagenes);
    if (!nodo || typeof nodo !== 'object') return;
    if (nodo.image) {
      if (!nodo.width || nodo.width > ANCHO_UTIL) {
        delete nodo.width;
        delete nodo.height;
        nodo.fit = [ANCHO_UTIL, 700];
      }
    }
    for (const clave of ['stack', 'columns', 'ul', 'ol', 'text']) if (Array.isArray(nodo[clave])) ajustarImagenes(nodo[clave]);
    if (nodo.table?.body) nodo.table.body.forEach((fila: any[]) => fila.forEach(ajustarImagenes));
  };
  ajustarImagenes(contenido);

  const documento = {
    pageSize: 'A4',
    pageMargins: [MARGEN, MARGEN, MARGEN, MARGEN],
    content: contenido,
    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.25 },
    info: { title: nombreBase(archivo.name) },
  };
  const blob: Blob = await pdfMake.createPdf(documento).getBlob();
  return { blob, nombre: `${nombreBase(archivo.name)}.pdf`, avisos };
}

// ---------- PDF → Word ----------

async function cargarPdfjs() {
  // Build "legacy" de pdf.js: incluye compatibilidad con navegadores que todavía no
  // tienen las funciones de JavaScript más nuevas (la build normal falla en ellos).
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: worker } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
}

export async function extraerFragmentos(datos: ArrayBuffer): Promise<{ fragmentos: Fragmento[]; paginas: number }> {
  const pdfjs = await cargarPdfjs();
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(datos) }).promise;
  } catch (e) {
    if ((e as Error).name === 'PasswordException') throw new Error('El PDF está protegido con contraseña.');
    throw new Error('No se pudo leer el PDF.');
  }

  const fragmentos: Fragmento[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const contenido = await pagina.getTextContent();
    // Las fuentes se cargan al pedir la lista de operaciones; de ahí sale si son negrita o cursiva.
    await pagina.getOperatorList();
    const estilos = new Map<string, { negrita: boolean; cursiva: boolean }>();
    const estiloDe = (fuente: string) => {
      if (!estilos.has(fuente)) {
        let nombre = '';
        let datosFuente: any = {};
        try {
          datosFuente = pagina.commonObjs.get(fuente);
          nombre = datosFuente?.name ?? '';
        } catch {}
        const familia = (contenido.styles[fuente]?.fontFamily ?? '') + ' ' + nombre;
        estilos.set(fuente, {
          negrita: Boolean(datosFuente?.bold || datosFuente?.black) || /bold|black|heavy|semibold|demi|medium/i.test(familia),
          cursiva: Boolean(datosFuente?.italic) || /italic|oblique/i.test(familia),
        });
      }
      return estilos.get(fuente)!;
    };

    for (const item of contenido.items) {
      if (!('str' in item)) continue;
      const [a, b, c, d, x, y] = item.transform;
      const tamano = Math.hypot(c, d) || Math.hypot(a, b);
      const estilo = estiloDe(item.fontName);
      fragmentos.push({ texto: item.str, x, y, ancho: item.width, tamano, pagina: n, ...estilo });
    }
    pagina.cleanup();
  }
  return { fragmentos, paginas: pdf.numPages };
}

export async function bloquesADocx(bloques: Bloque[], titulo: string): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat, AlignmentType } = await import('docx');
  const niveles = { titulo1: HeadingLevel.HEADING_1, titulo2: HeadingLevel.HEADING_2, titulo3: HeadingLevel.HEADING_3 } as const;

  const parrafos = bloques.map((b) => {
    // En los títulos la negrita ya la pone el estilo de Word.
    const esTitulo = b.tipo in niveles;
    const children = b.tramos.map(
      (t) => new TextRun({ text: t.texto, bold: (t.negrita && !esTitulo) || undefined, italics: t.cursiva || undefined }),
    );
    if (b.tipo === 'vinieta') return new Paragraph({ children, numbering: { reference: 'vinietas', level: 0 } });
    if (b.tipo === 'numerado') return new Paragraph({ children, numbering: { reference: 'numeros', level: 0 } });
    if (esTitulo) return new Paragraph({ children, heading: niveles[b.tipo as keyof typeof niveles] });
    return new Paragraph({ children, spacing: { after: 160 } });
  });

  const lista = (formato: (typeof LevelFormat)[keyof typeof LevelFormat], texto: string) => ({
    levels: [{ level: 0, format: formato, text: texto, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  });

  const doc = new Document({
    title: titulo,
    creator: 'Conversor de archivos',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: [
        { reference: 'vinietas', ...lista(LevelFormat.BULLET, '•') },
        { reference: 'numeros', ...lista(LevelFormat.DECIMAL, '%1.') },
      ],
    },
    sections: [{ children: parrafos }],
  });
  return Packer.toBlob(doc);
}

export async function pdfAWord(archivo: File): Promise<ResultadoDocumento> {
  const { fragmentos, paginas } = await extraerFragmentos(await archivo.arrayBuffer());
  const caracteres = fragmentos.reduce((n, f) => n + f.texto.trim().length, 0);
  if (caracteres < 10 * paginas) {
    throw new Error(
      `${archivo.name}: el PDF casi no tiene texto. Probablemente es un documento escaneado (una imagen), y para convertirlo haría falta reconocimiento óptico de caracteres (OCR).`,
    );
  }
  const bloques = reconstruir(fragmentos);
  const blob = await bloquesADocx(bloques, nombreBase(archivo.name));
  return {
    blob,
    nombre: `${nombreBase(archivo.name)}.docx`,
    avisos: [],
  };
}
