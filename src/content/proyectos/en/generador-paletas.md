---
titulo: Palette generator
resumen: Extracts the color palette from any photo using a custom k-means algorithm and exports it to CSS, SCSS, Tailwind or JSON.
tecnologias: [TypeScript, Canvas API, K-means, OKLab]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/paletas/
codigo: https://github.com/juanmdamico/porfolio/tree/main/src/scripts/paletas
orden: 3
imagen: paletas.webp
---

> The tool's interface is in Spanish.

## The problem

When you design a site based on a photo or a brand, picking colors by hand with an eyedropper is slow and inaccurate: you end up with shades that don't really represent the image.

## The solution

Upload a photo (or paste it with Ctrl+V) and get its main colors in milliseconds:

- **3 to 10 colors**, sorted by how much of the image they cover, with a proportion bar.
- Each color in **HEX, RGB and HSL**, copied with one click.
- **Export** to CSS variables, SCSS, Tailwind config or JSON.
- **Download the palette** as a PNG image.

## Technical decisions

- **K-means written from scratch**, with _k-means++_ initialization so clusters start well separated and converge fast.
- **Clusters in the OKLab color space** instead of RGB. In OKLab the distance between two colors matches what the human eye perceives, so the resulting palette looks more faithful.
- **Sampling**: the image is scaled down to ~120 px before analysis. The result is virtually the same and it takes milliseconds.
- **Stable results**: a fixed seed means the same image always produces the same palette.
- The text over each swatch picks black or white based on **WCAG contrast**, so it is always readable.
- The Tailwind export goes from the lightest color (100) to the darkest, following the convention.
