// ============================================================================
// EJÉRCITOS QUE EDITAN VARIOS: cuándo lo que hay en la base es "cambios de
// otro", y qué hacer entonces. Reglas puras (las usa ArmyListBuilderPage y se
// prueban sin navegador).
//
// El constructor guarda la lista ENTERA de una vez, así que guardar encima de
// lo que otro acaba de guardar le borraría su trabajo sin que se enterase.
// Por eso se compara lo que hay en la base con LO ÚLTIMO QUE SE VIO desde aquí
// (el `updated_at` al cargar o al guardar).
// ============================================================================

/** Lo que dice la base de la lista en este momento (ver ArmyListRepository.getEstado). */
export interface EstadoGuardado {
  updatedAt: string
  /** Quién la tocó por última vez; null si no consta (columna sin migrar). */
  updatedBy: number | null
  ready: boolean
}

/**
 * ¿La ha guardado OTRO desde la última vez que se vio? Si consta que el
 * último fui yo (por ejemplo, desde "Editar lista"), no es de otro aunque la
 * marca haya cambiado.
 */
export function laHaGuardadoOtro(estado: EstadoGuardado, vistoGuardado: string | null, yo: number | null): boolean {
  if (vistoGuardado == null) return false
  if (estado.updatedAt === vistoGuardado) return false
  return estado.updatedBy == null || estado.updatedBy !== yo
}

/** Al pulsar Guardar: se guarda, o se pregunta porque otro la cambió o la cerró. */
export function alGuardar(
  estado: EstadoGuardado | null,
  vistoGuardado: string | null,
  cerradaAqui: boolean,
  yo: number | null,
): 'guardar' | 'cambios' | 'completada' {
  // Sin poder preguntar a la base no se bloquea: es lo que pasaba siempre.
  if (!estado) return 'guardar'
  if (estado.ready && !cerradaAqui) return 'completada'
  return laHaGuardadoOtro(estado, vistoGuardado, yo) ? 'cambios' : 'guardar'
}

/**
 * Al vigilar la lista abierta: si otro la ha cambiado (o cerrado/reabierto),
 * se recarga sola cuando no tienes nada a medias, y si lo tienes, se avisa y
 * no se toca nada.
 */
export function alVigilar(
  estado: EstadoGuardado,
  visto: { guardado: string | null; cerrada: boolean; aMedias: boolean },
  yo: number | null,
): 'nada' | 'recargar' | 'avisar' {
  const cambio = laHaGuardadoOtro(estado, visto.guardado, yo) || estado.ready !== visto.cerrada
  if (!cambio) return 'nada'
  return visto.aMedias ? 'avisar' : 'recargar'
}
