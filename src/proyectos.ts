import { getCollection, type CollectionEntry } from 'astro:content';
import type { Idioma } from './i18n';

export type Proyecto = CollectionEntry<'proyectos'>;

/** El id viene como "es/conversor-archivos": devolvemos solo "conversor-archivos". */
export const slugDe = (p: Proyecto) => p.id.split('/').slice(1).join('/');

export async function proyectosDe(idioma: Idioma): Promise<Proyecto[]> {
  const todos = await getCollection('proyectos', (p) => p.id.startsWith(`${idioma}/`));
  return todos.sort((a, b) => a.data.orden - b.data.orden || b.data.fecha.valueOf() - a.data.fecha.valueOf());
}
