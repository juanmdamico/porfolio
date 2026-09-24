---
titulo: Conversor de archivos
resumen: Herramienta web para convertir imágenes, armar PDFs y transformar CSV ⇄ JSON, sin subir archivos a ningún servidor.
tecnologias: [TypeScript, Astro, Canvas API, jsPDF]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/conversor/
codigo: https://github.com/juanmdamico/porfolio/tree/main/src/scripts/conversor
destacado: true
---

## El problema

La mayoría de los conversores online te obligan a subir tus archivos a un servidor ajeno, esperar, y muchas veces tienen límites, publicidad o marcas de agua. Para fotos personales o datos de trabajo, eso es un riesgo de privacidad.

## La solución

Un conversor que funciona **100% en el navegador**. Los archivos nunca salen de la computadora del usuario, así que es instantáneo, privado y funciona sin límites.

Tiene tres herramientas:

- **Imágenes:** convierte entre PNG, JPG y WebP, con control de calidad y redimensionado. Procesa varias a la vez, muestra cuánto se redujo cada archivo y permite descargar todo en un `.zip`.
- **Imágenes a PDF:** une varias imágenes en un PDF, con opción de reordenar páginas y elegir tamaño A4 o el de cada imagen.
- **CSV ⇄ JSON:** convierte en ambos sentidos, detecta el separador automáticamente (coma, punto y coma o tabulación), respeta campos entre comillas y reconoce números y booleanos.

## Decisiones técnicas

- **Canvas API** para convertir imágenes, sin librerías externas. Al pasar a JPG se agrega fondo blanco para que las transparencias no queden negras.
- **Parser de CSV propio** que maneja comillas escapadas y saltos de línea dentro de los campos.
- **Carga diferida**: jsPDF y la librería de ZIP se descargan solo cuando se usan, así la página carga rápido.
- El CSV exportado incluye BOM para que Excel muestre bien los acentos.

## Resultado

- Convertir PNG a WebP o JPG reduce mucho el peso, y la herramienta muestra el ahorro exacto de cada archivo.
- Todo el procesamiento es local: cero costo de servidor y cero riesgo de filtrar archivos.
