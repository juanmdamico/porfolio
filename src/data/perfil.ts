// ✏️ Editá este archivo con tus datos.
export const perfil = {
  nombre: "Juan M. D'Amico",
  email: 'juanmdamico@gmail.com',
  links: {
    github: 'https://github.com/juanmdamico',
    linkedin: 'https://www.linkedin.com/in/tu-usuario',
  },
  habilidades: ['TypeScript', 'JavaScript', 'Astro', 'React', 'HTML', 'CSS', 'Node.js', 'Git'],
  // Poné tu CV en /public/cv.pdf y cambiá a true
  tieneCV: false,
  // Estadísticas de visitas: creá una cuenta gratis en https://www.goatcounter.com
  // y poné acá tu código (por ejemplo 'juanmdamico'). Vacío = desactivado.
  goatcounter: '',

  es: {
    rol: 'Desarrollador web',
    frase: 'Construyo sitios y aplicaciones rápidas, claras y fáciles de usar.',
    sobreMi: [
      'Soy desarrollador con foco en frontend. Me gusta transformar ideas en productos concretos y cuidar cada detalle de la experiencia.',
      'Actualmente trabajo con JavaScript/TypeScript, Astro y React, y siempre estoy aprendiendo algo nuevo.',
    ],
  },
  en: {
    rol: 'Web developer',
    frase: 'I build fast, clear and easy-to-use websites and apps.',
    sobreMi: [
      'I am a frontend-focused developer. I enjoy turning ideas into real products and caring about every detail of the experience.',
      'I currently work with JavaScript/TypeScript, Astro and React, and I am always learning something new.',
    ],
  },

  // Tu trayectoria, de la más reciente a la más antigua. La sección
  // "Experiencia" aparece sola cuando agregás al menos un elemento. Ejemplo:
  // {
  //   periodo: { es: '2024 — Actualidad', en: '2024 — Present' },
  //   puesto: { es: 'Desarrollador frontend', en: 'Frontend developer' },
  //   lugar: 'Empresa S.A.',
  //   descripcion: { es: 'Qué hiciste y qué lograste.', en: 'What you did and achieved.' },
  // },
  experiencia: [] as {
    periodo: { es: string; en: string };
    puesto: { es: string; en: string };
    lugar: string;
    descripcion: { es: string; en: string };
  }[],
};
