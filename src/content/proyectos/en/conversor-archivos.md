---
titulo: File converter
resumen: Web tool to convert images, build PDFs and transform CSV ⇄ JSON, without uploading files to any server.
tecnologias: [TypeScript, Astro, Canvas API, jsPDF]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/conversor/
codigo: https://github.com/juanmdamico/porfolio/tree/main/src/scripts/conversor
orden: 1
imagen: conversor.webp
---

> The tool's interface is in Spanish.

## The problem

Most online converters make you upload your files to someone else's server, wait, and often come with limits, ads or watermarks. For personal photos or work data, that is a privacy risk.

## The solution

A converter that runs **100% in the browser**. Files never leave the user's computer, so it is instant, private and has no limits.

It includes three tools:

- **Images:** converts between PNG, JPG and WebP, with quality control and resizing. It processes several files at once, shows how much each one shrank and lets you download everything as a `.zip`.
- **Images to PDF:** merges several images into a PDF, with page reordering and A4 or image-sized pages.
- **CSV ⇄ JSON:** converts both ways, auto-detects the delimiter (comma, semicolon or tab), respects quoted fields and recognizes numbers and booleans.

## Technical decisions

- **Canvas API** for image conversion, with no external libraries. When exporting to JPG a white background is added so transparent areas don't turn black.
- **Custom CSV parser** that handles escaped quotes and line breaks inside fields.
- **Lazy loading**: jsPDF and the ZIP library are only downloaded when needed, so the page loads fast.
- Exported CSV includes a BOM so Excel displays accented characters correctly.

## Result

- Converting PNG to WebP or JPG reduces file size considerably, and the tool shows the exact savings for each file.
- All processing is local: zero server cost and zero risk of leaking files.
