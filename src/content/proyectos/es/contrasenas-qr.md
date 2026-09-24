---
titulo: Contraseñas y códigos QR
resumen: Generador de contraseñas criptográficamente seguras, medidor de fuerza con consulta de filtraciones por k-anonimato y creador de códigos QR.
tecnologias: [TypeScript, Web Crypto API, SHA-1, QR]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/contrasenas-qr/
codigo: https://github.com/juanmdamico/porfolio/blob/main/src/scripts/seguridad/contrasenas.ts
orden: 5
imagen: contrasenas-qr.webp
---

## El problema

Mucha gente sigue usando contraseñas débiles o repetidas, y los generadores online no siempre inspiran confianza: ¿cómo sabés que no guardan lo que generan? Algo parecido pasa con los generadores de QR, que muchas veces agregan redirecciones o publicidad.

## La solución

Dos herramientas que funcionan 100% en el navegador:

**Contraseñas**
- Generador con largo de 8 a 64 caracteres, tipos de caracteres configurables y opción para evitar los que se confunden (`l`, `1`, `O`, `0`).
- **Medidor de fuerza**: calcula la entropía en bits y estima cuánto tardaría un ataque en adivinarla.
- **Análisis de tus contraseñas**: detecta palabras comunes, secuencias de teclado, repeticiones y años.
- **Verificación de filtraciones** con Have I Been Pwned.

**Códigos QR**
- Para texto, enlaces, **redes Wi-Fi** (el celular se conecta al escanearlo) o email.
- Colores personalizables, con **aviso si el contraste es bajo** y el QR podría no leerse.
- Nivel de corrección de errores y descarga en **PNG o SVG** (vectorial, ideal para imprimir).

## Decisiones técnicas

- **Aleatoriedad criptográfica**: usa `crypto.getRandomValues` en lugar de `Math.random`, con muestreo por rechazo para evitar el _sesgo de módulo_ (que haría que algunos caracteres salgan más que otros).
- Garantiza al menos un carácter de cada tipo elegido y después mezcla todo con **Fisher–Yates**, para que no queden en posiciones previsibles.
- **Privacidad con k-anonimato**: para saber si una contraseña se filtró, se calcula su hash SHA-1 en el navegador y solo se envían los **primeros 5 caracteres** del hash. El servicio responde con todos los hashes que empiezan igual y la comparación se hace localmente. La contraseña nunca sale de tu computadora.
- El formato de QR para Wi-Fi requiere escapar caracteres especiales (`;`, `:`, `,`, `\`). Lo verifiqué decodificando los QR generados en pruebas automáticas.
