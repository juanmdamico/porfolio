# Portfolio

Mi portfolio personal, hecho con [Astro](https://astro.build) y publicado en GitHub Pages.

🔗 https://juanmdamico.github.io/porfolio

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:4321/porfolio
npm run build    # genera el sitio en dist/
```

## Cómo editarlo

| Qué querés cambiar | Dónde |
| --- | --- |
| Nombre, rol, bio, habilidades, links | `src/data/perfil.ts` |
| Proyectos | `src/content/proyectos/*.md` (un archivo por proyecto) |
| Colores y tipografía | `src/styles/global.css` |
| CV descargable | Poné `public/cv.pdf` y `tieneCV: true` en `perfil.ts` |

### Agregar un proyecto

Creá `src/content/proyectos/mi-proyecto.md`:

```md
---
titulo: Mi proyecto
resumen: Una línea que explique qué es.
tecnologias: [Astro, TypeScript]
fecha: 2026-09-01
demo: https://...        # opcional
codigo: https://github.com/...   # opcional
destacado: true          # opcional, aparece primero
---

## El problema
...

## La solución
...
```

## Publicación

Cada push a `main` publica el sitio automáticamente (`.github/workflows/deploy.yml`).
La primera vez: **Settings → Pages → Source: GitHub Actions**.
