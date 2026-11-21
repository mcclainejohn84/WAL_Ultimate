// ============================================================================
// FAMILIAS DE OPCIONES: las piezas de equipo (y las opciones de unidad) que
// se llaman igual SON LA MISMA PIEZA, aunque el catálogo las tenga repetidas.
//
// El catálogo guarda una fila por cada PRECIO: "Lanza" a 1, a 2 y a 3 puntos
// son tres filas, porque lo que cuesta depende de quién la lleve. Pero lo que
// hace una lanza es siempre lo mismo, así que su apéndice también: se pidió
// que hubiera UNO para todas las lanzas, uno para todas las armas a dos
// manos, etc., sin importar el coste.
//
// Por eso los apéndices de equipo y de opciones no cuelgan de una fila sino de
// una FAMILIA: todas las filas cuyo nombre, ya expandido y normalizado, es el
// mismo. La familia la representa su fila de id más bajo (la "cabeza"), que
// es de quien cuelga el apéndice en la base de datos; leer por cualquier otra
// fila de la familia lleva al mismo apéndice.
//
// EL NOMBRE SE EXPANDE ANTES DE COMPARAR: "A2M" y "Arma a dos manos" son la
// misma pieza (ver catalogAliases). Y OJO: "2AM" NO es "A2M" — una es "Dos
// armas de mano" y la otra "Arma a dos manos" —, y eso lo resuelven los
// alias, no una comparación más laxa.
//
// Solo equipo y opciones de unidad. Las monturas y los carros son perfiles
// con atributos propios y no se agrupan; las facciones y unidades, tampoco.
//
// Módulo puro (sin base de datos), para poder probarlo sin navegador.
// ============================================================================
import { EQUIPMENT_ALIASES, UPGRADE_ALIASES, expandName } from '@/domain/catalogAliases'
import type { ApendiceDueno } from '@/domain/types'

export type DuenoAgrupado = 'equipo' | 'opcion'

export function esAgrupado(kind: ApendiceDueno): kind is DuenoAgrupado {
  return kind === 'equipo' || kind === 'opcion'
}

/** Una fila del catálogo de equipo o de opciones de unidad. */
export interface PiezaDelCatalogo {
  kind: DuenoAgrupado
  id: number
  name: string
}

/** Lo que identifica a una familia: sin mayúsculas, sin acentos, sin espacios de más y con la abreviatura expandida. */
export function claveDeFamilia(kind: DuenoAgrupado, name: string): string {
  const completo = expandName(name, kind === 'equipo' ? EQUIPMENT_ALIASES : UPGRADE_ALIASES)
  return completo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface Familias {
  /** De cada pieza (`kind:id`), la cabeza de su familia. */
  cabeza: Map<string, number>
  /** De cada pieza (`kind:id`), todas las de su familia, ella incluida, de menor a mayor id. */
  miembros: Map<string, number[]>
}

export const FAMILIAS_VACIAS: Familias = { cabeza: new Map(), miembros: new Map() }

export function agruparEnFamilias(piezas: PiezaDelCatalogo[]): Familias {
  const porClave = new Map<string, number[]>()
  for (const p of piezas) {
    const clave = `${p.kind}|${claveDeFamilia(p.kind, p.name)}`
    const ya = porClave.get(clave)
    if (ya) ya.push(p.id)
    else porClave.set(clave, [p.id])
  }
  const cabeza = new Map<string, number>()
  const miembros = new Map<string, number[]>()
  for (const [clave, ids] of porClave) {
    const kind = clave.slice(0, clave.indexOf('|'))
    const ordenados = [...new Set(ids)].sort((a, b) => a - b)
    for (const id of ordenados) {
      cabeza.set(`${kind}:${id}`, ordenados[0])
      miembros.set(`${kind}:${id}`, ordenados)
    }
  }
  return { cabeza, miembros }
}

/** La cabeza de la familia de una pieza; cualquier otro dueño se queda como está. */
export function cabezaDe(familias: Familias, kind: ApendiceDueno, id: number): number {
  return esAgrupado(kind) ? (familias.cabeza.get(`${kind}:${id}`) ?? id) : id
}

/** Todas las piezas de la familia de una (ella sola si no se agrupa o no se conoce). */
export function miembrosDe(familias: Familias, kind: ApendiceDueno, id: number): number[] {
  return esAgrupado(kind) ? (familias.miembros.get(`${kind}:${id}`) ?? [id]) : [id]
}

/** Lo justo de un apéndice para decidir cómo unificarlo. */
export interface ApendiceAUnificar {
  id: number
  ownerKind: ApendiceDueno
  ownerId: number
  title: string
  bodyHtml: string
  inSheet: boolean
}

/**
 * QUÉ HACER CON LOS APÉNDICES QUE YA HABÍA, colgados de filas sueltas:
 *  - `mover`: los que cuelgan de una fila que no es la cabeza pasan a ella.
 *  - `borrar`: los que, ya en la misma familia, son COPIAS EXACTAS de otro
 *    (mismo título y mismo texto). Era lo habitual: el mismo apéndice copiado
 *    a la lanza de 1 punto, a la de 2 y a la de 3. Se queda uno: el que esté
 *    pegado en la ficha, si alguno lo está (para no perder dónde se colocó);
 *    si no, el más antiguo.
 * Los que tienen el texto distinto se quedan todos: no hay forma de saber cuál
 * es el bueno, y eso lo decide quien los lea en el Editor.
 */
export function planDeUnificacion(
  apendices: ApendiceAUnificar[],
  familias: Familias,
): { mover: { id: number; ownerId: number }[]; borrar: number[] } {
  const mover: { id: number; ownerId: number }[] = []
  const iguales = new Map<string, ApendiceAUnificar[]>()
  for (const a of apendices) {
    if (!esAgrupado(a.ownerKind)) continue
    const destino = cabezaDe(familias, a.ownerKind, a.ownerId)
    if (destino !== a.ownerId) mover.push({ id: a.id, ownerId: destino })
    const clave = [a.ownerKind, destino, a.title.trim().toLowerCase(), a.bodyHtml.trim()].join('\u0000')
    const ya = iguales.get(clave)
    if (ya) ya.push(a)
    else iguales.set(clave, [a])
  }
  const borrar: number[] = []
  for (const grupo of iguales.values()) {
    if (grupo.length < 2) continue
    const queda = [...grupo].sort((a, b) => Number(b.inSheet) - Number(a.inSheet) || a.id - b.id)[0]
    for (const a of grupo) if (a !== queda) borrar.push(a.id)
  }
  const borrados = new Set(borrar)
  return { mover: mover.filter((m) => !borrados.has(m.id)), borrar: borrar.sort((a, b) => a - b) }
}
