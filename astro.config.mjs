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
      rollupOptions: {
        output: {
          // Cada librería y los helpers de Vite van en su propio archivo. Sin esto, Rollup
          // puede meter un helper compartido dentro del script de una página, y otra página
          // termina cargando (y ejecutando) ese script ajeno.
          manualChunks(id) {
            if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'vite-helpers';
            const paquete = id.split('node_modules/')[1]?.split('/')[0];
            if (paquete && !id.includes('/astro/')) return `lib-${paquete}`;
          },
        },
      },
    },
  },
});
