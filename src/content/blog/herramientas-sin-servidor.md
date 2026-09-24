---
titulo: Por qué todas mis herramientas funcionan sin servidor
resumen: Conversor de archivos, paletas de colores, contraseñas y más, todo corriendo en el navegador. Qué ganás, qué perdés y algunos trucos que aprendí en el camino.
fecha: 2026-09-24
etiquetas: [JavaScript, Privacidad, Arquitectura]
---

Todas las herramientas de este portfolio tienen algo en común: **ninguna tiene backend**. El [conversor de archivos](../../conversor/), el [generador de paletas](../../paletas/), el [editor de Markdown](../../markdown/) y el [generador de contraseñas](../../contrasenas-qr/) hacen todo el trabajo en tu navegador. Tus archivos nunca viajan a ningún lado.

No fue casualidad. El sitio está publicado en GitHub Pages, que solo sirve archivos estáticos, así que la restricción vino primero. Pero terminó siendo la mejor decisión del proyecto.

## Lo que se gana

**Privacidad de verdad.** Cuando convertís una foto en un sitio cualquiera, le estás dando esa foto a un desconocido. Acá no: el archivo se lee con la API de archivos, se procesa en un `<canvas>` y se descarga, sin salir de tu computadora. No es una promesa en una política de privacidad, es cómo funciona el código.

**Velocidad.** No hay subida ni espera. Convertir una imagen tarda lo que tarda tu procesador, que suele ser menos de lo que tardaría en subirse.

**Costo cero.** Sin servidores no hay nada que pagar, escalar ni mantener. Si mañana entran mil personas a la vez, cada una usa su propia computadora.

## Lo que se pierde (y cómo lo resolví)

### Librerías pesadas

Generar PDFs o archivos ZIP requiere librerías que pesan bastante. La solución es cargarlas **solo cuando se usan**, con importaciones dinámicas:

```ts
$('pdf-generar').addEventListener('click', async () => {
  const { jsPDF } = await import('jspdf'); // se descarga recién acá
  // ...
});
```

Si nunca apretás "Generar PDF", nunca descargás jsPDF.

Un detalle que me costó encontrar: al compartir dependencias entre páginas, el empaquetador puso un _helper_ compartido dentro del script de una página, y otra página terminaba cargando y ejecutando ese script ajeno. La solución fue separar cada librería en su propio archivo con `manualChunks`.

### Hacer cálculos pesados rápido

Extraer la paleta de una foto con k-means sobre millones de píxeles sería lento. Pero no hace falta: reduzco la imagen a unos 120 píxeles de lado antes de analizarla. El resultado es prácticamente el mismo y tarda milisegundos.

También agrupo los colores en el espacio **OKLab** en lugar de RGB. En RGB, dos colores "cercanos" matemáticamente pueden verse muy distintos; en OKLab la distancia se parece a lo que percibe el ojo, y la paleta queda más fiel.

### Consultar servicios externos sin exponer datos

¿Cómo verificar si una contraseña apareció en una filtración sin mandarla a ningún lado? Con **k-anonimato**, la técnica que usa Have I Been Pwned:

1. Calculo el hash SHA-1 de la contraseña en el navegador.
2. Envío solo los **primeros 5 caracteres** del hash.
3. El servicio responde con todos los hashes que empiezan igual (cientos).
4. Comparo localmente si el mío está en la lista.

El servicio nunca sabe qué contraseña consultaste, ni siquiera su hash completo.

```ts
const hash = await sha1(clave);
const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
const filtrada = (await res.text()).includes(hash.slice(5));
```

## ¿Cuándo sí hace falta un servidor?

Este enfoque tiene límites claros. Si necesitás compartir datos entre usuarios, guardar información de forma permanente, o procesar algo que un celular no puede (como un video largo), vas a necesitar un backend.

Pero para muchísimas herramientas del día a día, el navegador moderno alcanza y sobra. Y cada vez que una tarea se puede resolver ahí, el usuario gana en privacidad y velocidad.
