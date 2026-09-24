import { describe, expect, it } from 'vitest';
import { csvAJson, jsonACsv, parsearCsv, detectarSeparador } from '../src/scripts/conversor/datos';

describe('CSV ⇄ JSON', () => {
  it('detecta el separador', () => {
    expect(detectarSeparador('a;b;c\n1;2;3')).toBe(';');
    expect(detectarSeparador('a\tb\n1\t2')).toBe('\t');
    expect(detectarSeparador('a,b\n1,2')).toBe(',');
  });

  it('respeta comillas, comillas escapadas y saltos de línea', () => {
    expect(parsearCsv('nombre,nota\n"Pérez, Ana","dijo ""hola""\ny chau"')).toEqual([
      ['nombre', 'nota'],
      ['Pérez, Ana', 'dijo "hola"\ny chau'],
    ]);
  });

  it('convierte tipos al pasar a JSON', () => {
    const json = JSON.parse(csvAJson('n;edad;activo;vacio\nAna;31;true;'));
    expect(json).toEqual([{ n: 'Ana', edad: 31, activo: true, vacio: null }]);
  });

  it('hace ida y vuelta sin perder datos', () => {
    const csv = 'nombre,nota\n"Pérez, Ana","dijo ""hola"""\nLuis,';
    expect(jsonACsv(csvAJson(csv))).toBe(csv);
  });

  it('une las claves de todos los objetos', () => {
    expect(jsonACsv('[{"a":1},{"b":2}]')).toBe('a,b\n1,\n,2');
  });

  it('avisa si el JSON no es válido', () => {
    expect(() => jsonACsv('{malo')).toThrow('El JSON no es válido');
  });
});
