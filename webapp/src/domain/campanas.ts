// ============================================================================
// El FILTRO POR CAMPAÑAS de la pantalla de Personajes de Renombre, como regla
// pura (la usa PersonajesRenombrePage y se prueba sin navegador).
//
//  - Sin nada elegido, pasan todos.
//  - Un personaje pasa si está en ALGUNA de las campañas elegidas.
//  - SIN_CAMPANA es "los que no están en ninguna", y se combina con las demás:
//    "Imperio en llamas" + "Sin campaña" enseña las dos cosas.
// ============================================================================

/** "Los que no están en ninguna". Los ids de las campañas de verdad empiezan en 1. */
export const SIN_CAMPANA = 0

export function pasaElFiltroDeCampanas(susCampanas: readonly number[], elegidas: ReadonlySet<number>): boolean {
  if (elegidas.size === 0) return true
  if (susCampanas.length === 0) return elegidas.has(SIN_CAMPANA)
  return susCampanas.some((id) => elegidas.has(id))
}

/**
 * Lo elegido, sin las campañas que ya no existen. Una campaña borrada que se
 * quedara guardada en el filtro dejaría la pantalla vacía sin motivo.
 */
export function eleccionVigente(guardadas: ReadonlySet<number>, existentes: readonly number[]): Set<number> {
  const validas = new Set([SIN_CAMPANA, ...existentes])
  return new Set([...guardadas].filter((id) => validas.has(id)))
}
