import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { perfil } from '../data/perfil';

export async function GET(context: APIContext) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const posts = (await getCollection('blog', (p) => !p.data.borrador)).sort(
    (a, b) => b.data.fecha.valueOf() - a.data.fecha.valueOf(),
  );
  return rss({
    title: `Blog · ${perfil.nombre}`,
    description: 'Notas sobre desarrollo web, cosas que aprendo y cómo construyo mis proyectos.',
    site: new URL(`${base}/`, context.site),
    items: posts.map((p) => ({
      title: p.data.titulo,
      description: p.data.resumen,
      pubDate: p.data.fecha,
      categories: p.data.etiquetas,
      link: `${base}/blog/${p.id}/`,
    })),
    customData: '<language>es-ar</language>',
  });
}
