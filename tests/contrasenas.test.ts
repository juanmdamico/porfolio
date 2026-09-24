import { describe, expect, it } from 'vitest';
import { generarContrasena, entropiaGenerada, entropiaEscrita, tiempoParaRomper, aleatorio } from '../src/scripts/seguridad/contrasenas';

describe('Contraseñas', () => {
  it('respeta el largo e incluye cada tipo de carácter elegido', () => {
    for (let i = 0; i < 200; i++) {
      const c = generarContrasena({ largo: 12, conjuntos: ['minusculas', 'mayusculas', 'numeros', 'simbolos'], sinAmbiguos: false });
      expect(c).toHaveLength(12);
      expect(c).toMatch(/[a-z]/);
      expect(c).toMatch(/[A-Z]/);
      expect(c).toMatch(/\d/);
      expect(c).toMatch(/[^a-zA-Z\d]/);
    }
  });

  it('evita caracteres confusos si se pide', () => {
    const c = generarContrasena({ largo: 64, conjuntos: ['minusculas', 'mayusculas', 'numeros'], sinAmbiguos: true });
    expect(c).not.toMatch(/[Il1O0o]/);
  });

  it('falla si no hay ningún tipo de carácter', () => {
    expect(() => generarContrasena({ largo: 10, conjuntos: [], sinAmbiguos: false })).toThrow();
  });

  it('genera números uniformes en el rango', () => {
    const cuentas = new Array(6).fill(0);
    for (let i = 0; i < 60000; i++) cuentas[aleatorio(6)]++;
    for (const c of cuentas) expect(Math.abs(c - 10000)).toBeLessThan(600);
  });

  it('calcula la entropía de una contraseña generada', () => {
    expect(entropiaGenerada({ largo: 10, conjuntos: ['numeros'], sinAmbiguos: false })).toBeCloseTo(10 * Math.log2(10));
  });

  it('penaliza patrones comunes', () => {
    const debil = entropiaEscrita('password123');
    const fuerte = entropiaEscrita('Tr3n-Azul!Galaxia#Mate');
    expect(debil.bits).toBeLessThan(28);
    expect(debil.problemas.length).toBeGreaterThan(0);
    expect(fuerte.bits).toBeGreaterThan(80);
  });

  it('expresa el tiempo para romperla', () => {
    expect(tiempoParaRomper(10)).toBe('al instante');
    expect(tiempoParaRomper(200)).toBe('miles de millones de años');
  });
});
