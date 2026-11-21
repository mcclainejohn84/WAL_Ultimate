// ============================================================================
// Las familias de opciones contra la base de datos (la regla, en
// domain/familiasDeOpciones): cargarlas, unificar los apéndices que ya había y
// no dejar ninguno huérfano cuando una pieza sale de su familia.
//
// Módulo aparte, y no dentro de appendixRepository, porque lo usan también los
// repositorios del equipo y de las opciones al borrar o renombrar una pieza, y
// así ninguno de los dos tiene que importar al otro.
// ============================================================================
import { execCatalogBatch, type BatchStatement } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import {
  FAMILIAS_VACIAS,
  agruparEnFamilias,
  claveDeFamilia,
  miembrosDe,
  planDeUnificacion,
  type DuenoAgrupado,
  type Familias,
  type PiezaDelCatalogo,
} from '@/domain/familiasDeOpciones'
import type { ApendiceDueno } from '@/domain/types'

/** Todo el equipo y todas las opciones de unidad, agrupados por familia. Dos consultas locales: no cuesta red. */
export async function cargarFamilias(): Promise<Familias> {
  try {
    const piezas: PiezaDelCatalogo[] = [
      ...(await queryLocal('SELECT id, name FROM equipment_options', [], (r) => ({
        kind: 'equipo' as const,
        id: r.id as number,
        name: (r.name as string) ?? '',
      }))),
      ...(await queryLocal('SELECT id, name FROM upgrades', [], (r) => ({
        kind: 'opcion' as const,
        id: r.id as number,
        name: (r.name as string) ?? '',
      }))),
    ]
    return agruparEnFamilias(piezas)
  } catch {
    return FAMILIAS_VACIAS
  }
}

/** Los lotes del Worker no pasan de 50 sentencias. */
async function enTrozos(sentencias: BatchStatement[]): Promise<void> {
  for (let i = 0; i < sentencias.length; i += 45) await execCatalogBatch(sentencias.slice(i, i + 45))
}

/**
 * Pasa los apéndices que había colgados de filas sueltas a la cabeza de su
 * familia y quita las copias exactas (ver planDeUnificacion). Idempotente y
 * sin marca: son dos consultas locales y solo escribe si hay algo que
 * arreglar, así que se puede pasar en cada arranque.
 */
export async function unificarApendicesDeOpciones(): Promise<{ movidos: number; borrados: number }> {
  let apendices
  try {
    apendices = await queryLocal(
      "SELECT id, owner_kind, owner_id, title, body_html, in_sheet FROM appendices WHERE owner_kind IN ('equipo', 'opcion')",
      [],
      (r) => ({
        id: r.id as number,
        ownerKind: r.owner_kind as ApendiceDueno,
        ownerId: r.owner_id as number,
        title: (r.title as string) ?? '',
        bodyHtml: (r.body_html as string) ?? '',
        inSheet: Boolean(r.in_sheet),
      }),
    )
  } catch {
    return { movidos: 0, borrados: 0 } // sin la tabla, nada que unificar
  }
  if (apendices.length === 0) return { movidos: 0, borrados: 0 }
  const plan = planDeUnificacion(apendices, await cargarFamilias())
  await enTrozos([
    ...plan.borrar.map((id) => ({ sql: 'DELETE FROM appendices WHERE id = ?', params: [id] })),
    ...plan.mover.map((m) => ({ sql: 'UPDATE appendices SET owner_id = ? WHERE id = ?', params: [m.ownerId, m.id] })),
  ])
  return { movidos: plan.mover.length, borrados: plan.borrar.length }
}

/**
 * ANTES DE QUE UNA PIEZA SALGA DE SU FAMILIA —porque se borra o porque se le
 * cambia el nombre—, sus apéndices pasan a otra de la familia. Si no, al
 * borrar la cabeza (la "Lanza" de id más bajo) el apéndice de todas las
 * lanzas se quedaría colgando de una fila que ya no existe.
 *
 * Si era la única de su familia no se toca nada: se va con sus apéndices,
 * como antes de que hubiera familias.
 */
export async function soltarDeSuFamilia(kind: DuenoAgrupado, id: number, nombreNuevo?: string): Promise<void> {
  const familias = await cargarFamilias()
  const resto = miembrosDe(familias, kind, id).filter((m) => m !== id)
  if (resto.length === 0) return
  if (nombreNuevo != null) {
    // Un cambio de nombre que no la saca de la familia ("lanza" → "Lanza") no mueve nada.
    const tabla = kind === 'equipo' ? 'equipment_options' : 'upgrades'
    const [actual] = await queryLocal(`SELECT name FROM ${tabla} WHERE id = ?`, [id], (r) => r.name as string)
    if (actual != null && claveDeFamilia(kind, actual) === claveDeFamilia(kind, nombreNuevo)) return
  }
  try {
    await execCatalogBatch([
      { sql: 'UPDATE appendices SET owner_id = ? WHERE owner_kind = ? AND owner_id = ?', params: [resto[0], kind, id] },
    ])
  } catch (err) {
    // Sin la tabla de apéndices (Worker sin desplegar) no hay nada que mover;
    // cualquier otro fallo sí se dice, para no borrar la pieza a ciegas.
    if (!/no such table/i.test(String(err))) throw err
  }
}
