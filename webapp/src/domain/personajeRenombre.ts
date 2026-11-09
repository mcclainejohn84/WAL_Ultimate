// ============================================================================
// Reglas de visibilidad de un PERSONAJE DE RENOMBRE.
//
// Vive en el dominio y no en su repositorio porque la usan tres sitios que no
// se pueden importar entre sí sin dar una vuelta rara: el listado de la sección
// (specialCharacterRepository), el explorador del constructor de listas y el
// buscador global (que consulta unidades a secas). Un personaje oculto tiene
// que desaparecer de LOS TRES; con la regla escrita una sola vez, ninguno se
// puede quedar atrás.
// ============================================================================

/** Lo mínimo que hace falta saber de una unidad para decidir si se enseña. */
export interface UnidadOcultable {
  hidden: boolean
  /** Autor. Solo lo tienen los personajes de renombre; null = sin autor conocido. */
  userId: number | null
}

/**
 * Si el usuario dado puede VER esta unidad.
 *
 * Oculto = solo su autor. Un personaje oculto SIN autor (los creados antes de
 * que existiera la columna no lo tienen) lo sigue viendo todo el mundo: es
 * preferible enseñar de más a que un personaje desaparezca para siempre sin que
 * nadie pueda recuperarlo. Quien oculta uno de esos pasa a ser su autor, así que
 * el caso se cura solo (ver SpecialCharacterRepository.setHidden).
 */
export function esVisiblePara(unidad: UnidadOcultable, userId: number | null | undefined): boolean {
  if (!unidad.hidden) return true
  if (unidad.userId == null) return true
  return unidad.userId === userId
}

/** Lo mínimo para decidir si se puede TOCAR. */
export interface UnidadConAutor extends UnidadOcultable {
  isSpecialCharacter: boolean
}

/**
 * Si el usuario dado puede EDITAR esta unidad.
 *
 * VER NO ES EDITAR. Un personaje de renombre que no esté oculto lo ve todo el
 * mundo —su lámina, su hoja, su ficha en una lista de ejército— y no lo toca
 * nadie más que su autor: su experiencia, sus habilidades, sus cicatrices, su
 * magia, su retrato, su trasfondo, su hoja de unidad y sus apéndices son la
 * crónica de SUS partidas.
 *
 * NI SIQUIERA EN MODO ADMINISTRADOR. Fue una excepción durante un tiempo y era
 * la puerta por la que se colaba todo: el modo administrador se enciende con un
 * interruptor, sin contraseña, así que en la práctica no bloqueaba a nadie.
 *
 * Lo que NO es un personaje de renombre —el catálogo entero— es de todos, como
 * siempre: ahí quien manda es el modo administrador y esta función dice que sí.
 */
export function esEditablePor(unidad: UnidadConAutor, userId: number | null | undefined): boolean {
  if (!unidad.isSpecialCharacter) return true
  // Los creados antes de que existiera la columna del autor no tienen ninguno.
  // Se les asignó uno a mano en una migración (ver worker MIGRATIONS); si
  // apareciera otro sin autor, es preferible que se pueda arreglar a que quede
  // congelado para siempre.
  if (unidad.userId == null) return true
  return unidad.userId === userId
}
