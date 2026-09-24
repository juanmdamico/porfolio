/** Lógica pura del juego (sin DOM), para poder probarla por separado. */

export type Punto = { x: number; y: number };
export type Direccion = 'arriba' | 'abajo' | 'izquierda' | 'derecha';
export type Estado = 'inicio' | 'jugando' | 'pausa' | 'fin';

const VECTORES: Record<Direccion, Punto> = {
  arriba: { x: 0, y: -1 },
  abajo: { x: 0, y: 1 },
  izquierda: { x: -1, y: 0 },
  derecha: { x: 1, y: 0 },
};
const OPUESTA: Record<Direccion, Direccion> = { arriba: 'abajo', abajo: 'arriba', izquierda: 'derecha', derecha: 'izquierda' };

export class Juego {
  serpiente: Punto[] = [];
  comida: Punto = { x: 0, y: 0 };
  direccion: Direccion = 'derecha';
  puntos = 0;
  estado: Estado = 'inicio';
  /** Direcciones pendientes: permite giros rápidos (p. ej. arriba+izquierda) sin perder ninguno. */
  private cola: Direccion[] = [];

  constructor(
    readonly tamano = 20,
    private azar: () => number = Math.random,
  ) {
    this.reiniciar();
  }

  reiniciar() {
    const medio = Math.floor(this.tamano / 2);
    this.serpiente = [
      { x: medio, y: medio },
      { x: medio - 1, y: medio },
      { x: medio - 2, y: medio },
    ];
    this.direccion = 'derecha';
    this.cola = [];
    this.puntos = 0;
    this.estado = 'inicio';
    this.ponerComida();
  }

  /** Milisegundos entre pasos: arranca en 140 y acelera hasta 60. */
  get intervalo() {
    return Math.max(60, 140 - this.puntos * 3);
  }

  girar(nueva: Direccion) {
    const ultima = this.cola.at(-1) ?? this.direccion;
    // Ignora girar 180° (chocaría consigo misma) o repetir la misma dirección.
    if (nueva === ultima || nueva === OPUESTA[ultima] || this.cola.length >= 2) return;
    this.cola.push(nueva);
  }

  /** Avanza un paso. Devuelve true si comió. */
  paso(): boolean {
    if (this.estado !== 'jugando') return false;
    if (this.cola.length) this.direccion = this.cola.shift()!;
    const v = VECTORES[this.direccion];
    const cabeza = { x: this.serpiente[0].x + v.x, y: this.serpiente[0].y + v.y };
    const come = cabeza.x === this.comida.x && cabeza.y === this.comida.y;

    // La cola se mueve en este mismo paso (salvo que coma), así que puede ocupar esa celda.
    const cuerpo = come ? this.serpiente : this.serpiente.slice(0, -1);
    const fuera = cabeza.x < 0 || cabeza.y < 0 || cabeza.x >= this.tamano || cabeza.y >= this.tamano;
    if (fuera || cuerpo.some((p) => p.x === cabeza.x && p.y === cabeza.y)) {
      this.estado = 'fin';
      return false;
    }

    this.serpiente = [cabeza, ...cuerpo];
    if (come) {
      this.puntos++;
      if (this.serpiente.length === this.tamano ** 2) this.estado = 'fin'; // ¡ganó!
      else this.ponerComida();
    }
    return come;
  }

  /** Elige una celda libre al azar, con la misma probabilidad para todas. */
  private ponerComida() {
    const ocupadas = new Set(this.serpiente.map((p) => p.y * this.tamano + p.x));
    const libres: number[] = [];
    for (let i = 0; i < this.tamano ** 2; i++) if (!ocupadas.has(i)) libres.push(i);
    const celda = libres[Math.floor(this.azar() * libres.length)];
    this.comida = { x: celda % this.tamano, y: Math.floor(celda / this.tamano) };
  }
}
