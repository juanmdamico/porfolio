/** Una franja vertical que no se puede cortar entre dos hojas (un renglón, una imagen, una fila). */
export interface Banda {
  arriba: number;
  abajo: number;
}

/**
 * Reparte el contenido en hojas sin cortar renglones, imágenes ni filas de tablas.
 * Devuelve dónde empieza (en el flujo del documento) el contenido de cada hoja.
 * `inicio` y `fin` son el tope y el piso del área de texto de una hoja.
 */
export function paginar(bandas: Banda[], inicio: number, fin: number): number[] {
  const capacidad = fin - inicio;
  // Las franjas que se superponen forman un bloque (p. ej. una fila y su texto).
  const ordenadas = bandas.filter((b) => b.abajo > b.arriba).sort((a, b) => a.arriba - b.arriba);
  const bloques: Banda[] = [];
  for (const b of ordenadas) {
    const ultimo = bloques[bloques.length - 1];
    if (ultimo && b.arriba < ultimo.abajo - 0.5) ultimo.abajo = Math.max(ultimo.abajo, b.abajo);
    else bloques.push({ ...b });
  }

  const cortes = [inicio];
  let tope = inicio;
  for (const b of bloques) {
    // Si el bloque no entra en lo que queda de la hoja, empieza una nueva (salvo que ya
    // esté arriba de todo: un bloque más alto que una hoja se deja como está).
    if (b.abajo - tope > capacidad + 0.5 && b.arriba > tope + 0.5) {
      tope = b.arriba;
      cortes.push(tope);
    }
  }
  return cortes;
}
