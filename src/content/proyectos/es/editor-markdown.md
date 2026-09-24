---
titulo: Editor de Markdown
resumen: Editor con vista previa en vivo, atajos de teclado, guardado automático y exportación a PDF, HTML y Markdown.
tecnologias: [TypeScript, Marked, DOMPurify, CSS de impresión]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/markdown/
codigo: https://github.com/juanmdamico/porfolio/blob/main/src/pages/markdown.astro
orden: 4
imagen: markdown.webp
---

## El problema

Para escribir documentación, notas o un README muchas veces necesitás ver cómo va a quedar el Markdown, y los editores online suelen pedir cuenta, guardar tus textos en sus servidores o no dejarte exportar fácilmente.

## La solución

Un editor que funciona completamente en el navegador:

- **Vista previa en vivo** lado a lado (en el celular, con pestañas para alternar).
- **Barra de formato y atajos**: Ctrl+B, Ctrl+I, Ctrl+K, y Tab para indentar.
- Soporta **tablas, listas de tareas, bloques de código** y todo el Markdown de GitHub.
- **Guardado automático** en el navegador: si cerrás la pestaña, el texto sigue ahí.
- **Exporta a PDF, HTML o .md**, y copia el HTML generado.
- Contador de palabras y tiempo de lectura.

## Decisiones técnicas

- **Seguridad ante XSS**: el HTML que genera el Markdown pasa por **DOMPurify** antes de mostrarse. Si alguien pega `<script>` o un `<img onerror>`, se elimina y no se ejecuta. Lo verifiqué con pruebas automáticas.
- **PDF con CSS de impresión** en lugar de una librería: al exportar se usa el diálogo del navegador con una hoja de estilos `@media print` que oculta todo menos el documento. El PDF queda con texto real (seleccionable y buscable) y la página no suma peso.
- Los atajos modifican el texto con `setRangeText`, así respetan la selección del usuario.
- **Carga liviana**: cada librería va en su propio archivo, para que las otras herramientas del sitio no descarguen código que no usan.
