---
titulo: Dashboard del clima
resumen: Clima actual, pronóstico de 7 días e historial de 30 días para cualquier ciudad, con gráficos interactivos hechos a mano en SVG.
tecnologias: [TypeScript, SVG, API REST, Open-Meteo]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/clima/
codigo: https://github.com/juanmdamico/porfolio/tree/main/src/scripts/clima
orden: 2
imagen: clima.webp
---

## El problema

Los sitios de clima están llenos de publicidad y es difícil ver tendencias: saber si esta semana es más fría que las anteriores o cuánto llovió en el último mes.

## La solución

Un dashboard limpio que muestra, para cualquier ciudad del mundo:

- **El clima actual**: temperatura, sensación térmica, humedad, viento y lluvia del día.
- **El pronóstico de 7 días**.
- **Tres gráficos interactivos**: temperatura de las próximas 24 horas, máximas y mínimas de los últimos 30 días junto al pronóstico, y lluvia diaria.
- **Buscador con sugerencias** (se puede usar con el teclado) y botón para usar la ubicación actual.
- **Vista en tabla** con todos los datos, para accesibilidad.

## Decisiones técnicas

- **Gráficos propios en SVG, sin librerías.** Escalas, ejes con marcas "redondas", tooltips, línea guía al pasar el mouse y redibujado automático al cambiar el tamaño de la pantalla con `ResizeObserver`. Así la página pesa muy poco.
- **Colores accesibles**: la paleta de los gráficos está validada para personas con daltonismo y tiene su propia versión para el modo oscuro. Los gráficos cambian de tema al instante porque usan variables CSS.
- **Búsqueda eficiente**: espera a que dejes de escribir (_debounce_) y cancela los pedidos viejos con `AbortController`, así no se muestran resultados desordenados.
- **API sin clave**: [Open-Meteo](https://open-meteo.com/) es gratuita y no requiere registro, así que todo funciona desde el navegador, sin servidor propio.
- Recuerda la última ciudad consultada.
