// ============================================================================
// EL CATÁLOGO DE HABILIDADES DE LOS PERSONAJES DE RENOMBRE, ya en la base
// (tabla character_skills) y editable desde el Editor.
//
// ANTES VIVÍA ESCRITO EN EL CÓDIGO (domain/habilidadesDeRenombre), que sigue
// estando: ahora es la SEMILLA. Al arrancar se siembran las entradas que
// falten y a partir de ahí mandan las filas de la base, con lo que el usuario
// haya cambiado, añadido o borrado.
//
// Es catálogo, así que se lee de la copia local (queryLocal) y se escribe con
// execCatalog, igual que las unidades o las reglas.
//
// SI LA TABLA TODAVÍA NO EXISTE —Worker sin desplegar— se devuelve la semilla
// tal cual. Una pantalla de habilidades vacía sería peor: el personaje
// parecería no tener nada.
// ============================================================================
import { execCatalog, execCatalogBatch, type BatchStatement } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import {
  CATALOGO_DE_HABILIDADES,
  ORDEN_DE_TIPOS,
  type HabilidadDeRenombre,
  type TipoDeHabilidad,
} from '@/domain/habilidadesDeRenombre'

/** Una fila del catálogo: la habilidad más lo que hace falta para editarla. */
export interface FilaDeHabilidad extends HabilidadDeRenombre {
  id: number
  orden: number
}

export interface HabilidadInput {
  clave: string
  nombre: string
  tipo: TipoDeHabilidad
  coste: number | null
  descripcion: string | null
}

function mapFila(row: Record<string, unknown>): FilaDeHabilidad {
  return {
    id: row.id as number,
    clave: row.skill_key as string,
    nombre: row.name as string,
    tipo: row.kind as TipoDeHabilidad,
    coste: (row.cost as number) ?? null,
    descripcion: (row.description as string) ?? null,
    orden: (row.sort_order as number) ?? 0,
  }
}

/** La semilla vestida de filas, para cuando la tabla todavía no está. */
function semillaComoFilas(): FilaDeHabilidad[] {
  return CATALOGO_DE_HABILIDADES.map((h, indice) => ({ ...h, id: -(indice + 1), orden: indice }))
}

/** El orden del reglamento primero y, dentro de cada tipo, el que tenga puesto. */
function ordenar(filas: FilaDeHabilidad[]): FilaDeHabilidad[] {
  return [...filas].sort(
    (a, b) => ORDEN_DE_TIPOS.indexOf(a.tipo) - ORDEN_DE_TIPOS.indexOf(b.tipo) || a.orden - b.orden || a.id - b.id,
  )
}

export const CharacterSkillRepository = {
  async list(): Promise<FilaDeHabilidad[]> {
    try {
      const filas = await queryLocal<FilaDeHabilidad>('SELECT * FROM character_skills', [], mapFila)
      return filas.length > 0 ? ordenar(filas) : semillaComoFilas()
    } catch {
      return semillaComoFilas()
    }
  },

  /** Por clave, que es como se guarda lo que tiene cada personaje. */
  async mapa(): Promise<Map<string, HabilidadDeRenombre>> {
    return new Map((await CharacterSkillRepository.list()).map((h) => [h.clave, h]))
  },

  async create(input: HabilidadInput): Promise<number> {
    const [{ next }] = await queryLocal(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM character_skills WHERE kind = ?',
      [input.tipo],
      (row) => ({ next: row.next as number }),
    )
    return execCatalog(
      'INSERT INTO character_skills (skill_key, name, kind, cost, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [input.clave, input.nombre, input.tipo, input.coste, input.descripcion, next],
    )
  },

  /**
   * LA CLAVE NO SE TOCA al editar: es lo que tienen apuntado los personajes
   * (unit_skills), y cambiarla les quitaría la habilidad a todos de golpe. Se
   * cambia el nombre, el precio, el tipo y lo que hace.
   */
  async update(id: number, input: Omit<HabilidadInput, 'clave'>): Promise<void> {
    await execCatalog('UPDATE character_skills SET name = ?, kind = ?, cost = ?, description = ? WHERE id = ?', [
      input.nombre,
      input.tipo,
      input.coste,
      input.descripcion,
      id,
    ])
  },

  async remove(id: number): Promise<void> {
    await execCatalog('DELETE FROM character_skills WHERE id = ?', [id])
  },

  /** Cuántos personajes la tienen apuntada: se pregunta antes de borrarla. */
  async cuantosLaTienen(clave: string): Promise<number> {
    try {
      const filas = await queryLocal(
        'SELECT COUNT(*) AS cuantos FROM unit_skills WHERE skill_key = ?',
        [clave],
        (row) => row.cuantos as number,
      )
      return filas[0] ?? 0
    } catch {
      return 0
    }
  },
}

/** Número de sentencias por lote. El Worker rechaza más de 50 (ver MAX_MUTATE_STATEMENTS). */
const LOTE = 45

/**
 * Siembra las habilidades del reglamento que todavía no estén, por su clave.
 * No toca ni una fila existente: si el usuario ha cambiado un precio, es suyo.
 */
export async function seedCharacterSkills(): Promise<number> {
  const existentes = new Set(
    await queryLocal('SELECT skill_key FROM character_skills', [], (row) => row.skill_key as string),
  )
  const faltan = CATALOGO_DE_HABILIDADES.filter((h) => !existentes.has(h.clave))
  if (faltan.length === 0) return 0

  // El orden que se guarda es el del reglamento, no el del hueco que toque
  // rellenar: así una entrada que se siembre más tarde cae en su sitio.
  const sentencias: BatchStatement[] = faltan.map((h) => ({
    sql: 'INSERT OR IGNORE INTO character_skills (skill_key, name, kind, cost, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    params: [h.clave, h.nombre, h.tipo, h.coste, h.descripcion, CATALOGO_DE_HABILIDADES.indexOf(h)],
  }))
  for (let i = 0; i < sentencias.length; i += LOTE) {
    await execCatalogBatch(sentencias.slice(i, i + LOTE))
  }
  return faltan.length
}
