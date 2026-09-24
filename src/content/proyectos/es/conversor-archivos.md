---
titulo: Conversor de archivos
resumen: Herramienta web para convertir imágenes, pasar de Word a PDF y de PDF a Word, y transformar CSV ⇄ JSON, sin subir archivos a ningún servidor.
tecnologias: [TypeScript, Canvas API, pdf.js, pdfmake, docx]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/conversor/
codigo: https://github.com/juanmdamico/porfolio/tree/main/src/scripts/conversor
orden: 1
imagen: conversor.webp
---

## El problema

La mayoría de los conversores online te obligan a subir tus archivos a un servidor ajeno, esperar, y muchas veces tienen límites, publicidad o marcas de agua. Para fotos personales o datos de trabajo, eso es un riesgo de privacidad.

## La solución

Un conversor que funciona **100% en el navegador**. Los archivos nunca salen de la computadora del usuario, así que es instantáneo, privado y funciona sin límites.

Tiene cuatro herramientas:

- **Imágenes:** convierte entre PNG, JPG y WebP, con control de calidad y redimensionado. Procesa varias a la vez, muestra cuánto se redujo cada archivo y permite descargar todo en un `.zip`.
- **Word ⇄ PDF:** convierte documentos `.docx` a PDF y PDF a Word editable. De PDF a Word recupera títulos, tablas con sus colores, listas, alineación, tamaños, colores, líneas separadoras y saltos de página.
- **Imágenes a PDF:** une varias imágenes en un PDF, con opción de reordenar páginas y elegir tamaño A4 o el de cada imagen.
- **CSV ⇄ JSON:** convierte en ambos sentidos, detecta el separador automáticamente (coma, punto y coma o tabulación), respeta campos entre comillas y reconoce números y booleanos.

## Decisiones técnicas

### Word ⇄ PDF sin servidor

- **Word → PDF**: `mammoth` lee el `.docx` y lo transforma en HTML semántico (títulos, listas, tablas), y `pdfmake` arma un PDF con **texto real**, seleccionable y buscable, no una foto de la página. Las imágenes GIF, BMP o WebP se pasan a PNG con un canvas, porque pdfmake solo acepta PNG y JPG.
- **PDF → Word** es el sentido difícil: un PDF no tiene párrafos, tablas ni listas, solo sabe dónde dibujar cada trozo de texto. Con `pdf.js` (el lector de PDF de Firefox) obtengo cada fragmento con su posición, tamaño y fuente, y un algoritmo propio reconstruye la estructura:
  - agrupa los fragmentos en renglones y los ordena de izquierda a derecha;
  - detecta **tablas** buscando "canales" de espacio en blanco que se repiten en varios renglones seguidos, y deduce si cada columna está centrada o alineada;
  - detecta **títulos** por el tamaño de letra, y subtítulos por renglones cortos en negrita;
  - detecta texto **centrado** y **justificado** comparando dónde empieza y termina cada renglón con los márgenes;
  - une los renglones de un mismo párrafo y los separa por el espacio entre líneas y porque la última línea suele ser más corta;
  - reconoce **listas** por viñetas o números, y también cuando las viñetas son dibujos, por la sangría;
  - detecta **saltos de página intencionales** cuando una hoja termina mucho antes del margen.
- **Colores**: el texto de un PDF no trae su color, así que dibujo cada página en un canvas y leo los píxeles de cada fragmento para saber de qué color es el texto y el fondo (por ejemplo, el encabezado de una tabla). En esa misma imagen busco líneas horizontales finas para recuperar los separadores.
- La librería `docx` genera el Word con estilos reales: títulos, listas, tablas con sombreado, la fuente equivalente (Helvetica → Arial) y los márgenes y tamaño de hoja del PDF original. El algoritmo está cubierto por tests automáticos.
- Si el PDF es un escaneo (una imagen, sin texto), lo detecta y lo avisa en lugar de devolver un Word vacío.

### El resto

- **Canvas API** para convertir imágenes, sin librerías externas. Al pasar a JPG se agrega fondo blanco para que las transparencias no queden negras.
- **Parser de CSV propio** que maneja comillas escapadas y saltos de línea dentro de los campos.
- **Carga diferida**: las librerías de PDF, Word y ZIP pesan varios megas en total, pero se descargan solo cuando se usan. Al abrir la página se cargan apenas unos pocos KB.
- El CSV exportado incluye BOM para que Excel muestre bien los acentos.

## Resultado

- Convertir PNG a WebP o JPG reduce mucho el peso, y la herramienta muestra el ahorro exacto de cada archivo.
- Todo el procesamiento es local: cero costo de servidor y cero riesgo de filtrar archivos.
