---
titulo: Snake
resumen: El clásico juego de la viborita en Canvas, con bucle de paso fijo, controles táctiles, récord guardado y lógica probada con tests.
tecnologias: [TypeScript, Canvas 2D, Game loop, Tests]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/snake/
codigo: https://github.com/juanmdamico/porfolio/blob/main/src/scripts/snake/juego.ts
orden: 6
imagen: snake.webp
---

## La idea

Un juego simple es una excelente forma de mostrar lógica, manejo de estado y animación. Snake parece fácil, pero tiene varios detalles que, si se hacen mal, arruinan la experiencia.

## Qué tiene

- Se juega con **flechas o W A S D**, deslizando el dedo o con **botones en pantalla** en el celular.
- **Velocidad creciente** a medida que comés.
- **Pausa** con Espacio o P, y se pausa sola si cambiás de pestaña.
- **Récord** guardado en el navegador.
- Se adapta al **modo claro u oscuro** al instante.

## Decisiones técnicas

- **Lógica separada del dibujo**: toda la mecánica está en una clase sin DOM, lo que me permitió cubrirla con **tests automáticos** (choques, giros, crecimiento, velocidad, aparición de la comida).
- **Bucle con paso fijo** usando `requestAnimationFrame` y un acumulador de tiempo: el juego corre a la misma velocidad en una pantalla de 60 Hz o de 144 Hz.
- **Cola de giros**: si apretás dos flechas muy rápido (por ejemplo arriba y enseguida izquierda), no se pierde ninguna. Y se ignoran los giros de 180° que harían chocar a la serpiente consigo misma.
- **Detalle de la cola**: la cabeza puede entrar en la celda que la cola está dejando en ese mismo paso. Muchas implementaciones lo toman como choque por error.
- La comida aparece con **la misma probabilidad en cualquier celda libre**, sin reintentos al azar que se vuelven lentos cuando la serpiente es muy larga.
- **Canvas nítido** en pantallas de alta densidad, escalando según `devicePixelRatio`.
