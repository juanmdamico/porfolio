---
titulo: Generador de paletas
resumen: Extrae la paleta de colores de cualquier foto con un algoritmo k-means propio y la exporta a CSS, SCSS, Tailwind o JSON.
tecnologias: [TypeScript, Canvas API, K-means, OKLab]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/paletas/
codigo: https://github.com/juanmdamico/porfolio/tree/main/src/scripts/paletas
orden: 3
imagen: paletas.webp
---

## El problema

Cuando diseñás un sitio a partir de una foto o una marca, sacar los colores a mano con un cuentagotas es lento e impreciso: terminás eligiendo tonos que no representan bien la imagen.

## La solución

Subís una foto (o la pegás con Ctrl+V) y en milisegundos obtenés sus colores principales:

- **De 3 a 10 colores**, ordenados por cuánto ocupan en la imagen, con una barra de proporciones.
- Cada color en **HEX, RGB y HSL**, y se copia con un clic.
- **Exportación** a variables CSS, SCSS, configuración de Tailwind o JSON.
- **Descarga de la paleta** como imagen PNG.

## Decisiones técnicas

- **K-means implementado desde cero**, con inicialización _k-means++_ para que los grupos arranquen bien separados y converjan rápido.
- **Agrupa en el espacio de color OKLab** en lugar de RGB. En OKLab la distancia entre dos colores se parece a la diferencia que percibe el ojo humano, así que la paleta resultante se ve más fiel.
- **Muestreo**: la imagen se reduce a ~120 px antes de analizarla. El resultado es prácticamente igual y el cálculo tarda milisegundos.
- **Resultados estables**: usa una semilla fija, así la misma imagen siempre da la misma paleta.
- El texto sobre cada muestra elige blanco o negro según el **contraste WCAG**, para que siempre se lea.
- En la exportación a Tailwind, la escala va del color más claro (100) al más oscuro, como es la convención.
