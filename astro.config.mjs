// @ts-check
import { defineConfig } from 'astro/config';

// Publicado en GitHub Pages: https://juanmdamico.github.io/porfolio
// Si usás un dominio propio, cambiá `site` y borrá `base`.
export default defineConfig({
  site: 'https://juanmdamico.github.io',
  base: '/porfolio',
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    build: {
      // pdfmake (con sus fuentes) pesa ~1.8 MB, pero solo se descarga al convertir un Word a PDF.
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          // Cada librería va en su propio archivo, y el helper con el que Vite carga los
          // módulos diferidos también. Sin esto, el empaquetador mete ese helper dentro de
          // alguna librería (p. ej. jsPDF) y cualquier página que lo necesite la descarga entera.
          codeSplitting: {
            groups: [
              { name: 'vite-helpers', test: /vite\/preload-helper/, priority: 20 },
              {
                name: (id) => {
                  const paquete = id.split('node_modules/')[1]?.split('/')[0];
                  return paquete && !id.includes('/astro/') ? `lib-${paquete}` : null;
                },
                test: /node_modules/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
  },
});
