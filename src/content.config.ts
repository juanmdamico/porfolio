import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/proyectos' }),
  schema: z.object({
    titulo: z.string(),
    resumen: z.string(),
    tecnologias: z.array(z.string()),
    fecha: z.coerce.date(),
    demo: z.string().url().optional(),
    codigo: z.string().url().optional(),
    destacado: z.boolean().default(false),
  }),
});

export const collections = { proyectos };
