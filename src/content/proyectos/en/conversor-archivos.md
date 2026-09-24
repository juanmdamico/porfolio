---
titulo: File converter
resumen: Web tool to convert images, turn Word into PDF and PDF into Word, and transform CSV ⇄ JSON, without uploading files to any server.
tecnologias: [TypeScript, Canvas API, pdf.js, pdfmake, docx]
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

It includes four tools:

- **Images:** converts between PNG, JPG and WebP, with quality control and resizing. It processes several files at once, shows how much each one shrank and lets you download everything as a `.zip`.
- **Word ⇄ PDF:** converts `.docx` documents to PDF and PDF to editable Word, keeping headings, bold, italics, lists, tables and images (when going to PDF).
- **Images to PDF:** merges several images into a PDF, with page reordering and A4 or image-sized pages.
- **CSV ⇄ JSON:** converts both ways, auto-detects the delimiter (comma, semicolon or tab), respects quoted fields and recognizes numbers and booleans.

## Technical decisions

### Word ⇄ PDF without a server

- **Word → PDF**: `mammoth` reads the `.docx` and turns it into semantic HTML (headings, lists, tables), and `pdfmake` builds a PDF with **real text**, selectable and searchable, not a picture of the page. GIF, BMP or WebP images are converted to PNG with a canvas, since pdfmake only accepts PNG and JPG.
- **PDF → Word** is the hard direction: a PDF has no paragraphs or lists, it only knows where to draw each piece of text. With `pdf.js` (Firefox's PDF reader) I get every fragment with its position, size and font, and a custom algorithm rebuilds the structure:
  - groups fragments into lines and sorts them left to right;
  - detects **headings** by comparing font size with the body text;
  - joins the lines of a paragraph and splits paragraphs by line spacing and because the last line is usually shorter;
  - recognizes **lists** by bullets or numbers, and also by indentation when the bullets are drawn shapes;
  - rejoins hyphenated words and detects bold and italics from the font name.
  Then the `docx` library generates a Word file with real heading and list styles. The algorithm is covered by automated tests.
- If the PDF is a scan (an image with no text), it detects it and says so instead of returning an empty Word file.

### The rest

- **Canvas API** for image conversion, with no external libraries. When exporting to JPG a white background is added so transparent areas don't turn black.
- **Custom CSV parser** that handles escaped quotes and line breaks inside fields.
- **Lazy loading**: the PDF, Word and ZIP libraries add up to several megabytes, but they only download when used. Opening the page loads just a few KB.
- Exported CSV includes a BOM so Excel displays accented characters correctly.

## Result

- Converting PNG to WebP or JPG reduces file size considerably, and the tool shows the exact savings for each file.
- All processing is local: zero server cost and zero risk of leaking files.
