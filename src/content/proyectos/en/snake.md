---
titulo: Snake
resumen: The classic snake game in Canvas, with a fixed-timestep loop, touch controls, saved high score and tested game logic.
tecnologias: [TypeScript, Canvas 2D, Game loop, Tests]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/snake/
codigo: https://github.com/juanmdamico/porfolio/blob/main/src/scripts/snake/juego.ts
orden: 6
imagen: snake.webp
---

> The game's interface is in Spanish.

## The idea

A simple game is a great way to show logic, state management and animation. Snake looks easy, but it has several details that ruin the experience when done wrong.

## Features

- Play with **arrow keys or W A S D**, by swiping, or with **on-screen buttons** on mobile.
- **Increasing speed** as you eat.
- **Pause** with Space or P, and it pauses automatically when you switch tabs.
- **High score** saved in the browser.
- Instantly adapts to **light or dark mode**.

## Technical decisions

- **Logic separated from rendering**: all mechanics live in a DOM-free class, which let me cover it with **automated tests** (collisions, turns, growth, speed, food placement).
- **Fixed-timestep loop** with `requestAnimationFrame` and a time accumulator: the game runs at the same speed on a 60 Hz or 144 Hz display.
- **Turn queue**: if you press two arrows very quickly (say up and then left), neither is lost. 180° turns that would make the snake hit itself are ignored.
- **Tail detail**: the head may move into the cell the tail is leaving in that same step. Many implementations wrongly treat that as a collision.
- Food appears with **equal probability in any free cell**, without random retries that get slow when the snake is very long.
- **Crisp canvas** on high-density screens, scaled by `devicePixelRatio`.
