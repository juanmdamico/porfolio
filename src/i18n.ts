export type Idioma = 'es' | 'en';

export const textos = {
  es: {
    proyectos: 'Proyectos',
    sobreMi: 'Sobre mí',
    experiencia: 'Experiencia',
    blog: 'Blog',
    contacto: 'Contacto',
    conversor: 'Conversor',
    habilidades: 'Habilidades',
    hola: 'Hola, soy',
    verProyectos: 'Ver proyectos',
    contactame: 'Contactame',
    descargarCV: 'Descargar CV',
    verProyecto: 'Ver proyecto →',
    volver: '← Volver',
    verDemo: 'Ver demo',
    verCodigo: 'Ver código',
    trabajemos: '¿Trabajamos juntos?',
    escribime: 'Escribime y te respondo a la brevedad.',
    tema: 'Cambiar tema',
    menu: 'Menú',
    otroIdioma: 'English',
    actualidad: 'Actualidad',
    ultimosPosts: 'Últimos artículos',
    verTodos: 'Ver todos →',
  },
  en: {
    proyectos: 'Projects',
    sobreMi: 'About',
    experiencia: 'Experience',
    blog: 'Blog',
    contacto: 'Contact',
    conversor: 'Converter',
    habilidades: 'Skills',
    hola: "Hi, I'm",
    verProyectos: 'See projects',
    contactame: 'Contact me',
    descargarCV: 'Download CV',
    verProyecto: 'View project →',
    volver: '← Back',
    verDemo: 'Live demo',
    verCodigo: 'Source code',
    trabajemos: "Let's work together",
    escribime: "Write to me and I'll get back to you soon.",
    tema: 'Toggle theme',
    menu: 'Menu',
    otroIdioma: 'Español',
    actualidad: 'Present',
    ultimosPosts: 'Latest posts',
    verTodos: 'See all →',
  },
} as const;

/** Prefijo de URL para cada idioma: el español es el idioma por defecto (sin prefijo). */
export function rutaBase(idioma: Idioma): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return idioma === 'es' ? base : `${base}/en`;
}
