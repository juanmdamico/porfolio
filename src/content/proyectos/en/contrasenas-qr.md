---
titulo: Passwords and QR codes
resumen: Cryptographically secure password generator, strength meter with k-anonymity breach check, and QR code maker.
tecnologias: [TypeScript, Web Crypto API, SHA-1, QR]
fecha: 2026-09-24
demo: https://juanmdamico.github.io/porfolio/contrasenas-qr/
codigo: https://github.com/juanmdamico/porfolio/blob/main/src/scripts/seguridad/contrasenas.ts
orden: 5
imagen: contrasenas-qr.webp
---

> The tool's interface is in Spanish.

## The problem

Many people still use weak or reused passwords, and online generators don't always inspire trust: how do you know they don't store what they generate? The same goes for QR generators, which often add redirects or ads.

## The solution

Two tools that run 100% in the browser:

**Passwords**
- Generator from 8 to 64 characters, configurable character sets and an option to avoid look-alikes (`l`, `1`, `O`, `0`).
- **Strength meter**: computes entropy in bits and estimates how long an attack would take to guess it.
- **Analysis of your own passwords**: detects common words, keyboard sequences, repetition and years.
- **Breach check** with Have I Been Pwned.

**QR codes**
- For text, links, **Wi-Fi networks** (phones join when scanning it) or email.
- Custom colors, with a **low-contrast warning** when the QR might not scan.
- Error correction level and download as **PNG or SVG** (vector, great for print).

## Technical decisions

- **Cryptographic randomness**: uses `crypto.getRandomValues` instead of `Math.random`, with rejection sampling to avoid _modulo bias_ (which would make some characters more likely than others).
- Guarantees at least one character of each chosen set and then shuffles with **Fisher–Yates**, so they don't end up in predictable positions.
- **Privacy through k-anonymity**: to check whether a password leaked, its SHA-1 hash is computed in the browser and only the **first 5 characters** are sent. The service returns every hash with that prefix and the comparison happens locally. The password never leaves your computer.
- The Wi-Fi QR format requires escaping special characters (`;`, `:`, `,`, `\`). I verified it by decoding the generated QR codes in automated tests.
