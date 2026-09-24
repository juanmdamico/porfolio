# Portfolio

Mi portfolio personal, hecho con [Astro](https://astro.build) y publicado en GitHub Pages, en español e inglés.

🔗 https://juanmdamico.github.io/porfolio

## Herramientas incluidas

Todas funcionan 100% en el navegador, sin servidor:

| Herramienta | Ruta | Código |
| --- | --- | --- |
| Conversor de archivos (imágenes, Word ⇄ PDF, CSV ⇄ JSON) | `/conversor` | `src/pages/conversor.astro`, `src/scripts/conversor/` |
| Dashboard del clima | `/clima` | `src/pages/clima.astro`, `src/scripts/clima/` |
| Generador de paletas | `/paletas` | `src/pages/paletas.astro`, `src/scripts/paletas/` |
| Editor de Markdown | `/markdown` | `src/pages/markdown.astro` |
| Contraseñas y QR | `/contrasenas-qr` | `src/pages/contrasenas-qr.astro`, `src/scripts/seguridad/` |
| Snake | `/snake` | `src/pages/snake.astro`, `src/scripts/snake/` |

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:4321/porfolio
npm run check    # revisa tipos de TypeScript
npm test         # corre los tests (Vitest)
npm run build    # genera el sitio en dist/
```

## Cómo editarlo

| Qué querés cambiar | Dónde |
| --- | --- |
| Nombre, rol, bio (ES/EN), habilidades, links | `src/data/perfil.ts` |
| Experiencia laboral (la sección aparece sola al completarla) | `experiencia` en `src/data/perfil.ts` |
| Estadísticas de visitas | `goatcounter` en `src/data/perfil.ts` |
| Proyectos | `src/content/proyectos/es/*.md` y `src/content/proyectos/en/*.md` |
| Artículos del blog | `src/content/blog/*.md` |
| Textos de la interfaz (ES/EN) | `src/i18n.ts` |
| Colores y tipografía | `src/styles/global.css` |
| Capturas de las tarjetas | `public/capturas/` (el nombre va en el campo `imagen` del proyecto) |
| Imagen al compartir el link | `public/og.png` (1200×630) |
| CV descargable | Poné `public/cv.pdf` y `tieneCV: true` en `perfil.ts` |

### Agregar un proyecto

Creá el mismo archivo en `src/content/proyectos/es/` y en `src/content/proyectos/en/`:

```md
---
titulo: Mi proyecto
resumen: Una línea que explique qué es.
tecnologias: [Astro, TypeScript]
fecha: 2026-09-01
demo: https://...                # opcional
codigo: https://github.com/...   # opcional
imagen: mi-proyecto.webp         # opcional, en public/capturas/
orden: 7                         # menor número = aparece antes
---

## El problema
...

## La solución
...
```

### Escribir un artículo

Creá `src/content/blog/mi-articulo.md` con `titulo`, `resumen`, `fecha` y `etiquetas`. Con `borrador: true` no se publica. Los artículos aparecen en `/blog`, en la portada y en el feed RSS (`/rss.xml`).

## Publicación

Cada push a `main` publica el sitio automáticamente (`.github/workflows/deploy.yml`).
