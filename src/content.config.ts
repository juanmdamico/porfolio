import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Cada proyecto tiene una versión por idioma: proyectos/es/x.md y proyectos/en/x.md
const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/proyectos' }),
  schema: z.object({
    titulo: z.string(),
    resumen: z.string(),
    tecnologias: z.array(z.string()),
    fecha: z.coerce.date(),
    demo: z.url().optional(),
    codigo: z.url().optional(),
    /** Nombre del archivo de captura en public/capturas/ */
    imagen: z.string().optional(),
    /** Menor número = aparece antes */
    orden: z.number().default(99),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    titulo: z.string(),
    resumen: z.string(),
    fecha: z.coerce.date(),
    etiquetas: z.array(z.string()).default([]),
    borrador: z.boolean().default(false),
  }),
});

export const collections = { proyectos, blog };
