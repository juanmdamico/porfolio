---
titulo: Markdown editor
resumen: Editor with live preview, keyboard shortcuts, autosave and export to PDF, HTML and Markdown.
tecnologias: [TypeScript, Marked, DOMPurify, Print CSS]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/markdown/
codigo: https://github.com/juanmdamico/porfolio/blob/main/src/pages/markdown.astro
orden: 4
imagen: markdown.webp
---

> The tool's interface is in Spanish.

## The problem

When writing documentation, notes or a README you often need to see how the Markdown will look, and online editors usually require an account, store your text on their servers or make exporting hard.

## The solution

An editor that runs entirely in the browser:

- **Live side-by-side preview** (on mobile, tabs to switch between them).
- **Formatting toolbar and shortcuts**: Ctrl+B, Ctrl+I, Ctrl+K, and Tab to indent.
- Supports **tables, task lists, code blocks** and all GitHub-flavored Markdown.
- **Autosave** in the browser: close the tab and your text is still there.
- **Exports to PDF, HTML or .md**, and copies the generated HTML.
- Word count and reading time.

## Technical decisions

- **XSS protection**: the HTML generated from Markdown goes through **DOMPurify** before being displayed. If someone pastes `<script>` or an `<img onerror>`, it is stripped and never runs. I verified this with automated tests.
- **PDF via print CSS** instead of a library: exporting uses the browser's print dialog with an `@media print` stylesheet that hides everything but the document. The PDF has real text (selectable and searchable) and the page stays light.
- Shortcuts edit the text with `setRangeText`, so they respect the user's selection.
- **Light loading**: each library ships in its own file, so the site's other tools never download code they don't use.
