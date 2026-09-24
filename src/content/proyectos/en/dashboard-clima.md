---
titulo: Weather dashboard
resumen: Current weather, 7-day forecast and 30-day history for any city, with hand-made interactive SVG charts.
tecnologias: [TypeScript, SVG, REST API, Open-Meteo]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/clima/
codigo: https://github.com/juanmdamico/porfolio/tree/main/src/scripts/clima
orden: 2
imagen: clima.webp
---

> The tool's interface is in Spanish.

## The problem

Weather sites are full of ads and make it hard to see trends: whether this week is colder than the previous ones, or how much it rained in the last month.

## The solution

A clean dashboard that shows, for any city in the world:

- **Current weather**: temperature, feels-like, humidity, wind and today's rain.
- **7-day forecast**.
- **Three interactive charts**: temperature for the next 24 hours, highs and lows for the last 30 days alongside the forecast, and daily rainfall.
- **Search with suggestions** (keyboard friendly) and a button to use your current location.
- **Table view** with all the data, for accessibility.

## Technical decisions

- **Custom SVG charts, no libraries.** Scales, axes with "round" ticks, tooltips, a hover guide line and automatic redraw on resize with `ResizeObserver`. The page stays very light.
- **Accessible colors**: the chart palette is validated for color-blind users and has its own dark-mode version. Charts switch theme instantly because they use CSS variables.
- **Efficient search**: waits until you stop typing (debounce) and cancels stale requests with `AbortController`, so results never arrive out of order.
- **No API key**: [Open-Meteo](https://open-meteo.com/) is free and requires no sign-up, so everything runs in the browser with no backend.
- Remembers the last city you looked up.
