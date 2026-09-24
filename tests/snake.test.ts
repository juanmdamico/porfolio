import { describe, expect, it } from 'vitest';
import { Juego } from '../src/scripts/snake/juego';

const jugando = (tamano = 10) => {
  const j = new Juego(tamano);
  j.estado = 'jugando';
  return j;
};

describe('Snake', () => {
  it('empieza con 3 segmentos y la comida en una celda libre', () => {
    const j = new Juego(10);
    expect(j.serpiente).toHaveLength(3);
    expect(j.serpiente.some((p) => p.x === j.comida.x && p.y === j.comida.y)).toBe(false);
  });

  it('ignora los giros de 180°', () => {
    const j = jugando();
    j.girar('izquierda');
    j.paso();
    expect(j.direccion).toBe('derecha');
  });

  it('encola giros rápidos sin perder ninguno', () => {
    const j = jugando();
    j.girar('arriba');
    j.girar('izquierda');
    j.paso();
    expect(j.direccion).toBe('arriba');
    j.paso();
    expect(j.direccion).toBe('izquierda');
  });

  it('termina al chocar con la pared', () => {
    const j = jugando();
    j.comida = { x: 0, y: 0 };
    for (let i = 0; i < 10; i++) j.paso();
    expect(j.estado).toBe('fin');
  });

  it('crece y suma puntos al comer', () => {
    const j = jugando();
    const cabeza = j.serpiente[0];
    j.comida = { x: cabeza.x + 1, y: cabeza.y };
    expect(j.paso()).toBe(true);
    expect(j.serpiente).toHaveLength(4);
    expect(j.puntos).toBe(1);
  });

  it('puede entrar en la celda que deja la cola en ese mismo paso', () => {
    const j = jugando();
    j.serpiente = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }];
    j.direccion = 'arriba';
    j.comida = { x: 0, y: 0 };
    j.girar('izquierda');
    j.paso();
    expect(j.estado).toBe('jugando');
  });

  it('termina al chocar consigo misma', () => {
    const j = jugando();
    j.serpiente = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }];
    j.direccion = 'arriba';
    j.comida = { x: 0, y: 0 };
    j.girar('izquierda');
    j.paso();
    expect(j.estado).toBe('fin');
  });

  it('acelera con los puntos hasta un mínimo', () => {
    const j = new Juego(10);
    expect(j.intervalo).toBe(140);
    j.puntos = 100;
    expect(j.intervalo).toBe(60);
  });

  it('puede poner comida en cualquier celda libre', () => {
    const celdas = new Set<number>();
    for (let i = 0; i < 3000; i++) {
      const j = new Juego(4);
      celdas.add(j.comida.y * 4 + j.comida.x);
    }
    expect(celdas.size).toBe(16 - 3);
  });
});
