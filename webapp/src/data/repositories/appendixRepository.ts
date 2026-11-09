// ============================================================================
// APÉNDICES Y REGLAS ADICIONALES: bloques de texto con formato (título +
// cuerpo) que acompañan a una unidad, una facción, una opción de equipo, una
// mejora, una montura o un carro.
//
// EL DUEÑO VA EN DOS COLUMNAS (owner_kind + owner_id) porque cada tipo de
// dueño vive en su propia tabla y una clave ajena solo podría apuntar a una.
// Nacieron colgando solo de unidades (unit_appendices); esa tabla se queda con
// lo que hubiera, pero ya no se lee ni se escribe — sus filas se copiaron a
// `appendices` en la migración.
//
// SE COPIAN, NO SE COMPARTEN. Copiar un apéndice a otro dueño DUPLICA el
// texto: a partir de ahí son dos apéndices independientes y editar uno no toca
// el otro. Fue una decisión explícita: compartirlos obligaría a avisar en cada
// edición de a cuántos afecta, y lo normal es que el texto copiado se acabe
// retocando para el destino.
//
// El HTML se sanea AQUÍ, además de en el editor: este repositorio es lo último
// que hay antes de la base de datos y no puede fiarse de quién le llame (ver
// shared/richText).
// ============================================================================
import { execCatalog, execCatalogBatch } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import { sanearHtml } from '@/shared/richText'
import type { ApendiceDueno, UnitAppendix } from '@/domain/types'

/** Cómo se llama cada tipo de dueño en la pantalla. */
export const ETIQUETAS_DE_DUENO: Record<ApendiceDueno, string> = {
  faccion: 'Facción',
  unidad: 'Unidad',
  equipo: 'Equipo',
  opcion: 'Opción',
  montura: 'Montura',
  carro: 'Carro',
}

export const DUENOS: ApendiceDueno[] = ['faccion', 'unidad', 'equipo', 'opcion', 'montura', 'carro']

export interface Dueno {
  kind: ApendiceDueno
  id: number
}

function mapAppendix(row: Record<string, unknown>): UnitAppendix {
  return {
    id: row.id as number,
    ownerKind: row.owner_kind as ApendiceDueno,
    ownerId: row.owner_id as number,
    title: row.title as string,
    bodyHtml: (row.body_html as string) ?? '',
    sortOrder: row.sort_order as number,
  }
}

export interface AppendixInput {
  title: string
  bodyHtml: string
}

/** Un apéndice con de quién es, para listarlos todos juntos y para "copiar desde…". */
export interface AppendixConDueno extends UnitAppendix {
  duenoNombre: string
  factionName: string | null
  /** Id de la facción a la que pertenece su dueño; null si no se puede saber. */
  factionId: number | null
}

/** Algo de lo que puede colgar un apéndice. */
export interface DuenoPosible {
  kind: ApendiceDueno
  id: number
  nombre: string
  /**
   * En qué facciones aparece. Una facción es de la suya; una unidad, de la
   * suya; una opción de equipo o una montura pueden estar en varias, porque
   * las comparten unidades de facciones distintas. Vacío = no la usa nadie.
   */
  factionIds: number[]
}

/**
 * DE QUÉ PUEDE COLGAR UN APÉNDICE, con su nombre y en qué facciones sale.
 *
 * Una consulta por tipo de dueño y el cruce en memoria: son cinco consultas
 * locales contra sql.js —no cuestan red— y una UNION de tablas con columnas
 * distintas se lee mucho peor que esto.
 */
export async function listarDuenos(): Promise<DuenoPosible[]> {
  const porClave = new Map<string, DuenoPosible>()
  const mete = (kind: ApendiceDueno, id: number, nombre: string, factionId: number | null) => {
    const clave = `${kind}:${id}`
    const ya = porClave.get(clave)
    if (ya) {
      if (factionId != null && !ya.factionIds.includes(factionId)) ya.factionIds.push(factionId)
      return
    }
    porClave.set(clave, { kind, id, nombre, factionIds: factionId == null ? [] : [factionId] })
  }

  const facciones = await queryLocal('SELECT id, name FROM factions ORDER BY name', [], (r) => ({
    id: r.id as number,
    name: r.name as string,
  }))
  for (const f of facciones) mete('faccion', f.id, f.name, f.id)

  const unidades = await queryLocal('SELECT id, name, faction_id FROM units ORDER BY name', [], (r) => ({
    id: r.id as number,
    name: r.name as string,
    factionId: r.faction_id as number,
  }))
  for (const u of unidades) mete('unidad', u.id, u.name, u.factionId)

  const equipo = await queryLocal(
    `SELECT eo.id AS id, eo.name AS name, u.faction_id AS faction_id
       FROM equipment_options eo
       LEFT JOIN unit_equipment_options ueo ON ueo.equipment_id = eo.id
       LEFT JOIN units u ON u.id = ueo.unit_id
      ORDER BY eo.name`,
    [],
    (r) => ({ id: r.id as number, name: r.name as string, factionId: (r.faction_id as number) ?? null }),
  )
  for (const e of equipo) mete('equipo', e.id, e.name, e.factionId)

  const mejoras = await queryLocal(
    `SELECT up.id AS id, up.name AS name, u.faction_id AS faction_id
       FROM upgrades up
       LEFT JOIN unit_upgrade_options uuo ON uuo.upgrade_id = up.id
       LEFT JOIN units u ON u.id = uuo.unit_id
      ORDER BY up.name`,
    [],
    (r) => ({ id: r.id as number, name: r.name as string, factionId: (r.faction_id as number) ?? null }),
  )
  for (const m of mejoras) mete('opcion', m.id, m.name, m.factionId)

  const perfiles = await queryLocal(
    `SELECT ap.id AS id, ap.name AS name, upr.role AS role, u.faction_id AS faction_id
       FROM attribute_profiles ap
       JOIN unit_profiles upr ON upr.profile_id = ap.id
       JOIN units u ON u.id = upr.unit_id
      WHERE upr.role IN ('montura', 'carro')
      ORDER BY ap.name`,
    [],
    (r) => ({
      id: r.id as number,
      name: (r.name as string) ?? 'Sin nombre',
      role: r.role as 'montura' | 'carro',
      factionId: (r.faction_id as number) ?? null,
    }),
  )
  for (const p of perfiles) mete(p.role, p.id, p.name, p.factionId)

  return [...porClave.values()]
}

export const AppendixRepository = {
  async listByOwner(kind: ApendiceDueno, ownerId: number): Promise<UnitAppendix[]> {
    try {
      return await queryLocal(
        'SELECT * FROM appendices WHERE owner_kind = ? AND owner_id = ? ORDER BY sort_order, id',
        [kind, ownerId],
        mapAppendix,
      )
    } catch {
      // La tabla puede no existir todavía (Worker sin desplegar): sin
      // apéndices, no con la pantalla rota.
      return []
    }
  },

  /** Atajo del caso de siempre. */
  async listByUnit(unitId: number): Promise<UnitAppendix[]> {
    return AppendixRepository.listByOwner('unidad', unitId)
  },

  /** TODOS, para la pantalla del Editor. Quien los agrupa y los filtra es ella. */
  async listAll(): Promise<UnitAppendix[]> {
    try {
      return await queryLocal('SELECT * FROM appendices ORDER BY owner_kind, owner_id, sort_order, id', [], mapAppendix)
    } catch {
      return []
    }
  },

  async create(dueno: Dueno, input: AppendixInput): Promise<number> {
    const id = await execCatalog(
      `INSERT INTO appendices (owner_kind, owner_id, title, body_html, sort_order)
       VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM appendices WHERE owner_kind = ? AND owner_id = ?))`,
      [dueno.kind, dueno.id, input.title.trim(), sanearHtml(input.bodyHtml), dueno.kind, dueno.id],
    )
    await apuntar(dueno, `Añadió el apéndice "${input.title.trim()}"`)
    return id
  },

  async update(id: number, input: AppendixInput): Promise<void> {
    await execCatalog('UPDATE appendices SET title = ?, body_html = ? WHERE id = ?', [
      input.title.trim(),
      sanearHtml(input.bodyHtml),
      id,
    ])
    const [existente] = await queryLocal('SELECT * FROM appendices WHERE id = ?', [id], mapAppendix)
    if (existente) {
      await apuntar({ kind: existente.ownerKind, id: existente.ownerId }, `Editó el apéndice "${input.title.trim()}"`)
    }
  },

  async remove(id: number): Promise<void> {
    // Se lee antes de borrar para poder decir QUÉ se borró: después ya no hay
    // de dónde sacar el título (mismo criterio que en el resto de repositorios).
    const [existente] = await queryLocal('SELECT * FROM appendices WHERE id = ?', [id], mapAppendix)
    if (!existente) return
    await execCatalog('DELETE FROM appendices WHERE id = ?', [id])
    await apuntar({ kind: existente.ownerKind, id: existente.ownerId }, `Borró el apéndice "${existente.title}"`)
  },

  /** Nuevo orden, por ids. Se escribe en un único lote para que no queden órdenes a medias. */
  async reorder(orderedIds: number[]): Promise<void> {
    if (orderedIds.length === 0) return
    await execCatalogBatch(
      orderedIds.map((id, indice) => ({
        sql: 'UPDATE appendices SET sort_order = ? WHERE id = ?',
        params: [indice + 1, id],
      })),
    )
  },

  /**
   * Copia un apéndice a otro dueño. El resultado es un apéndice NUEVO e
   * independiente: se copia el texto tal cual estaba en ese momento.
   */
  async copyTo(appendixId: number, destino: Dueno): Promise<number> {
    const [origen] = await queryLocal('SELECT * FROM appendices WHERE id = ?', [appendixId], mapAppendix)
    if (!origen) throw new Error('El apéndice que se quería copiar ya no existe.')
    return AppendixRepository.create(destino, { title: origen.title, bodyHtml: origen.bodyHtml })
  },

  /**
   * Todos los apéndices MENOS los de este dueño, para poder copiar uno de otro
   * sitio. Van con el nombre de su dueño porque "Reglas de asedio" repetido
   * siete veces no se distingue de otro modo.
   */
  async listCopiables(excepto: Dueno): Promise<AppendixConDueno[]> {
    const [todos, duenos] = await Promise.all([AppendixRepository.listAll(), listarDuenos()])
    const porClave = new Map(duenos.map((d) => [`${d.kind}:${d.id}`, d]))
    const nombreDeFaccion = new Map(
      await queryLocal('SELECT id, name FROM factions', [], (r) => [r.id as number, r.name as string] as const),
    )
    return todos
      .filter((a) => !(a.ownerKind === excepto.kind && a.ownerId === excepto.id))
      .map((a) => {
        const dueno = porClave.get(`${a.ownerKind}:${a.ownerId}`)
        const faccionId = dueno?.factionIds[0] ?? null
        return {
          ...a,
          duenoNombre: dueno?.nombre ?? `#${a.ownerId}`,
          factionId: faccionId,
          factionName: faccionId != null ? (nombreDeFaccion.get(faccionId) ?? null) : null,
        }
      })
      .sort(
        (a, b) =>
          (a.factionName ?? '').localeCompare(b.factionName ?? '', 'es') ||
          a.duenoNombre.localeCompare(b.duenoNombre, 'es'),
      )
  },

  /** Se los lleva por delante al borrar su dueño: nadie los volvería a ver. */
  async removeByOwner(kind: ApendiceDueno, ownerId: number): Promise<void> {
    try {
      await execCatalog('DELETE FROM appendices WHERE owner_kind = ? AND owner_id = ?', [kind, ownerId])
    } catch {
      // Sin la tabla no hay nada que limpiar.
    }
  },
}

/**
 * El apunte del Log. Los de una unidad van con su id, que es lo que hace que
 * los de un Personaje de Renombre acaben en su pestaña (ver
 * changeLogRepository); los de los demás tipos van sin id.
 */
async function apuntar(dueno: Dueno, texto: string): Promise<void> {
  if (dueno.kind === 'unidad') {
    await ChangeLogRepository.record('unidad', 'editar', texto, dueno.id)
    return
  }
  const entidad =
    dueno.kind === 'faccion'
      ? 'faccion'
      : dueno.kind === 'montura'
        ? 'montura'
        : dueno.kind === 'carro'
          ? 'carro'
          : 'equipo'
  await ChangeLogRepository.record(entidad, 'editar', texto, dueno.id)
}
