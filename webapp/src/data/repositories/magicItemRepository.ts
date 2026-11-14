// ============================================================================
// LA FORJA DE OBJETOS MÁGICOS: el catálogo de características y sellos, los
// objetos forjados y a quién se le ha dado cada uno.
//
// EL CATÁLOGO vive en la base (magic_item_traits) y se edita desde el Editor;
// lo del código (domain/objetosMagicos) es la SEMILLA, igual que en las
// habilidades de personaje y las de magia. Sin la tabla —Worker sin
// desplegar— se devuelve la semilla tal cual: una forja vacía parecería que no
// hay nada que forjar.
//
// FORJAR ES GRATIS Y ASIGNAR CUESTA. Mientras el objeto está en la forja se le
// cambia lo que haga falta; al dárselo a un personaje, éste paga de su
// experiencia la suma de lo que lleva y el objeto queda cerrado. Quitárselo
// devuelve exactamente lo que pagó —`magic_items.cost`, no lo que costaría
// hoy—, que es lo que permite pasar un objeto de un personaje a otro sin que
// el viaje cueste nada.
//
// LOS TOPES SON DEL REGLAMENTO y se comprueban aquí, no en la pantalla: tres
// características por objeto (el sello cuenta como una), un objeto de cada
// tipo por personaje, y tantos objetos como diga su rango.
// ============================================================================
import { execCatalog, execCatalogBatch, query, type BatchStatement } from '@/data/sqlite/client'
import { queryLocal } from '@/data/sqlite/localCatalog'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import { SpecialCharacterRepository } from '@/data/repositories/specialCharacterRepository'
import { getCurrentUser } from '@/shared/session/useSession'
import { sanearHtml } from '@/shared/richText'
import {
  CATALOGO_DE_OBJETOS,
  MAX_CARACTERISTICAS,
  costeDelObjeto,
  motivoParaNoAsignar,
  topeDeObjetos,
  type CaracteristicaMagica,
  type TipoDeCaracteristica,
  type TipoDeObjeto,
} from '@/domain/objetosMagicos'

/** Una fila del catálogo: la característica más lo que hace falta para editarla. */
export interface FilaDeCaracteristica extends CaracteristicaMagica {
  id: number
}

export interface CaracteristicaInput {
  clave: string
  nombre: string
  tipo: TipoDeCaracteristica
  coste: number
  descripcion: string | null
}

/** Un objeto forjado, con lo que lleva grabado ya resuelto. */
export interface ObjetoMagico {
  id: number
  nombre: string
  tipo: TipoDeObjeto
  trasfondo: string
  /** Quién lo forjó. Como en los personajes: se ve, pero solo lo toca su autor. */
  userId: number | null
  /** A quién se le ha dado. null = sigue en la forja. */
  unitId: number | null
  /** Lo que PAGÓ su portador. 0 mientras está en la forja. */
  costePagado: number
  caracteristicas: CaracteristicaMagica[]
  creadoEl: string
}

function mapCaracteristica(row: Record<string, unknown>): FilaDeCaracteristica {
  return {
    id: row.id as number,
    clave: row.trait_key as string,
    nombre: row.name as string,
    tipo: row.kind as TipoDeCaracteristica,
    coste: (row.cost as number) ?? 0,
    descripcion: (row.description as string) || null,
    sortOrder: (row.sort_order as number) ?? 0,
  }
}

/** La semilla vestida de filas, para cuando la tabla todavía no está. */
function semillaComoFilas(): FilaDeCaracteristica[] {
  return CATALOGO_DE_OBJETOS.map((c, indice) => ({ ...c, id: -(indice + 1) }))
}

export const MagicItemRepository = {
  // ---- El catálogo -------------------------------------------------------

  async listCatalogo(): Promise<FilaDeCaracteristica[]> {
    try {
      const filas = await queryLocal<FilaDeCaracteristica>('SELECT * FROM magic_item_traits', [], mapCaracteristica)
      return filas.length > 0 ? [...filas].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id) : semillaComoFilas()
    } catch {
      return semillaComoFilas()
    }
  },

  async mapaDelCatalogo(): Promise<Map<string, CaracteristicaMagica>> {
    return new Map((await MagicItemRepository.listCatalogo()).map((c) => [c.clave, c]))
  },

  async crearCaracteristica(input: CaracteristicaInput): Promise<number> {
    const [{ next }] = await queryLocal(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM magic_item_traits WHERE kind = ?',
      [input.tipo],
      (row) => ({ next: row.next as number }),
    )
    return execCatalog(
      'INSERT INTO magic_item_traits (trait_key, kind, name, cost, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [input.clave, input.tipo, input.nombre, input.coste, input.descripcion ?? '', next],
    )
  },

  /**
   * LA CLAVE NO SE TOCA al editar: es lo que llevan grabado los objetos ya
   * forjados, y cambiarla se la quitaría a todos de golpe.
   */
  async editarCaracteristica(id: number, input: Omit<CaracteristicaInput, 'clave'>): Promise<void> {
    await execCatalog('UPDATE magic_item_traits SET kind = ?, name = ?, cost = ?, description = ? WHERE id = ?', [
      input.tipo,
      input.nombre,
      input.coste,
      input.descripcion ?? '',
      id,
    ])
  },

  async borrarCaracteristica(id: number): Promise<void> {
    await execCatalog('DELETE FROM magic_item_traits WHERE id = ?', [id])
  },

  /** En cuántos objetos está grabada: se pregunta antes de borrarla. */
  async cuantosLaLlevan(clave: string): Promise<number> {
    try {
      const filas = await queryLocal(
        'SELECT COUNT(*) AS cuantos FROM magic_item_powers WHERE trait_key = ?',
        [clave],
        (row) => row.cuantos as number,
      )
      return filas[0] ?? 0
    } catch {
      return 0
    }
  },

  // ---- Los objetos -------------------------------------------------------

  async listAll(): Promise<ObjetoMagico[]> {
    const catalogo = await MagicItemRepository.mapaDelCatalogo()
    let objetos: Omit<ObjetoMagico, 'caracteristicas'>[]
    try {
      objetos = await queryLocal('SELECT * FROM magic_items ORDER BY name', [], (row) => ({
        id: row.id as number,
        nombre: row.name as string,
        tipo: row.kind as TipoDeObjeto,
        trasfondo: (row.background as string) ?? '',
        userId: (row.user_id as number) ?? null,
        unitId: (row.unit_id as number) ?? null,
        costePagado: (row.cost as number) ?? 0,
        creadoEl: row.created_at as string,
      }))
    } catch {
      // Sin la tabla no hay forja, pero tampoco pantalla rota.
      return []
    }
    const porObjeto = new Map<number, string[]>()
    try {
      for (const fila of await queryLocal('SELECT item_id, trait_key FROM magic_item_powers', [], (row) => ({
        itemId: row.item_id as number,
        clave: row.trait_key as string,
      }))) {
        const ya = porObjeto.get(fila.itemId)
        if (ya) ya.push(fila.clave)
        else porObjeto.set(fila.itemId, [fila.clave])
      }
    } catch {
      // Igual: un objeto sin características se ve, y se le pueden poner.
    }
    return objetos.map((o) => ({
      ...o,
      caracteristicas: (porObjeto.get(o.id) ?? [])
        .map((clave) => catalogo.get(clave))
        .filter((c) => c != null)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
  },

  async crear(nombre: string, tipo: TipoDeObjeto): Promise<number> {
    const id = await execCatalog(
      'INSERT INTO magic_items (name, kind, background, user_id, unit_id, cost, created_at) VALUES (?, ?, NULL, ?, NULL, 0, ?)',
      [nombre.trim(), tipo, getCurrentUser()?.id ?? null, new Date().toISOString()],
    )
    await ChangeLogRepository.record('unidad', 'crear', `Forjó el objeto mágico "${nombre.trim()}"`)
    return id
  },

  async renombrar(id: number, nombre: string): Promise<void> {
    await execCatalog('UPDATE magic_items SET name = ? WHERE id = ?', [nombre.trim(), id])
  },

  /** El trasfondo se guarda saneado, como el de los personajes. */
  async setTrasfondo(id: number, html: string): Promise<void> {
    const limpio = sanearHtml(html)
    await execCatalog('UPDATE magic_items SET background = ? WHERE id = ?', [limpio || null, id])
  },

  async borrar(id: number): Promise<void> {
    const objeto = await unObjeto(id)
    if (objeto?.unitId != null) {
      throw new Error('Está asignado a un personaje. Quítaselo antes de deshacerlo.')
    }
    await execCatalogBatch([
      { sql: 'DELETE FROM magic_item_powers WHERE item_id = ?', params: [id] },
      { sql: 'DELETE FROM magic_items WHERE id = ?', params: [id] },
    ])
    if (objeto) await ChangeLogRepository.record('unidad', 'borrar', `Deshizo el objeto mágico "${objeto.nombre}"`)
  },

  /**
   * Cambia de golpe lo que lleva grabado el objeto. Se reescribe entero —y no
   * una característica cada vez— porque el tope de tres hay que comprobarlo
   * sobre el conjunto, no sobre lo que se añade.
   */
  async setCaracteristicas(id: number, claves: string[]): Promise<void> {
    const objeto = await unObjeto(id)
    if (!objeto) throw new Error('Ese objeto ya no existe.')
    if (objeto.unitId != null) {
      throw new Error('Está asignado a un personaje: para cambiarlo, quítaselo antes.')
    }
    const unicas = [...new Set(claves)]
    if (unicas.length > MAX_CARACTERISTICAS) {
      throw new Error(`Un objeto no admite más de ${MAX_CARACTERISTICAS} características (el sello cuenta como una).`)
    }
    const catalogo = await MagicItemRepository.mapaDelCatalogo()
    const sellos = unicas.filter((c) => catalogo.get(c)?.tipo === 'sello')
    if (sellos.length > 1) throw new Error('Un objeto solo puede llevar un sello mágico.')
    for (const clave of unicas) {
      const cual = catalogo.get(clave)
      if (!cual) throw new Error('Esa característica ya no está en el catálogo.')
      if (cual.tipo !== 'sello' && cual.tipo !== objeto.tipo) {
        throw new Error(`"${cual.nombre}" no es de este tipo de objeto.`)
      }
    }
    await execCatalogBatch([
      { sql: 'DELETE FROM magic_item_powers WHERE item_id = ?', params: [id] },
      ...unicas.map((clave) => ({
        sql: 'INSERT OR IGNORE INTO magic_item_powers (item_id, trait_key) VALUES (?, ?)',
        params: [id, clave] as (string | number)[],
      })),
    ])
  },

  /**
   * Se lo da a un personaje, que paga de su experiencia lo que lleva el objeto.
   *
   * Comprueba los topes del reglamento ANTES de cobrar nada. Si el personaje
   * no llega de experiencia tampoco se le da: un objeto a crédito no existe.
   */
  async asignar(id: number, unitId: number): Promise<void> {
    const objeto = await unObjeto(id)
    if (!objeto) throw new Error('Ese objeto ya no existe.')
    if (objeto.unitId != null) throw new Error('Ese objeto ya lo lleva otro personaje.')

    const todos = await MagicItemRepository.listAll()
    const conEste = todos.find((o) => o.id === id)
    const suyos = todos.filter((o) => o.unitId === unitId)

    const habilidades = await SpecialCharacterRepository.listHabilidades(unitId)
    const coste = costeDelObjeto(conEste?.caracteristicas ?? [])
    const saldo = await SpecialCharacterRepository.totalExperiencia(unitId)
    const motivo = motivoParaNoAsignar({
      tope: topeDeObjetos(habilidades),
      suyos,
      tipo: objeto.tipo,
      saldo,
      coste,
    })
    if (motivo) throw new Error(`No se le puede dar: ${motivo}.`)

    // Primero el apunte de experiencia y después la marca: si algo falla por
    // el camino, es preferible un cobro sin objeto —que se ve en su libro y se
    // corrige— que un objeto puesto y sin pagar.
    if (coste > 0) {
      await SpecialCharacterRepository.añadirExperiencia(unitId, -coste, `Objeto mágico "${objeto.nombre}"`)
    }
    await execCatalog('UPDATE magic_items SET unit_id = ?, cost = ? WHERE id = ?', [unitId, coste, id])
  },

  /**
   * Cuántos objetos admite CADA personaje, en una sola consulta.
   *
   * La pantalla necesita saberlo de todos a la vez para decir a quién se le
   * puede dar un objeto; preguntando personaje a personaje serían quince
   * viajes a la red para leer quince palabras.
   */
  async topesPorPersonaje(): Promise<Map<number, number>> {
    const porUnidad = new Map<number, string[]>()
    try {
      const filas = await query(
        "SELECT unit_id, skill_key FROM unit_skills WHERE skill_key LIKE 'rango:%'",
        [],
        (row) => ({ unitId: row.unit_id as number, clave: row.skill_key as string }),
      )
      for (const fila of filas) {
        const ya = porUnidad.get(fila.unitId)
        if (ya) ya.push(fila.clave)
        else porUnidad.set(fila.unitId, [fila.clave])
      }
    } catch {
      // Sin la tabla, nadie tiene rango todavía.
    }
    return new Map([...porUnidad].map(([unitId, claves]) => [unitId, topeDeObjetos(claves)]))
  },

  /** Se lo quita y le devuelve lo que pagó, ni más ni menos. */
  async desasignar(id: number): Promise<void> {
    const objeto = await unObjeto(id)
    if (!objeto || objeto.unitId == null) return
    if (objeto.costePagado > 0) {
      await SpecialCharacterRepository.añadirExperiencia(
        objeto.unitId,
        objeto.costePagado,
        `Devuelto el objeto mágico "${objeto.nombre}"`,
      )
    }
    await execCatalog('UPDATE magic_items SET unit_id = NULL, cost = 0 WHERE id = ?', [id])
  },
}

/** Un objeto suelto, con lo que lleva. */
async function unObjeto(id: number): Promise<ObjetoMagico | null> {
  const todos = await MagicItemRepository.listAll()
  return todos.find((o) => o.id === id) ?? null
}

/** Número de sentencias por lote. El Worker rechaza más de 50 (ver MAX_MUTATE_STATEMENTS). */
const LOTE = 45

/**
 * Siembra las características del reglamento que todavía no estén, por su
 * clave. No toca ni una fila existente: si se ha cambiado un precio, es suyo.
 */
export async function seedMagicItemTraits(): Promise<number> {
  const existentes = new Set(
    await queryLocal('SELECT trait_key FROM magic_item_traits', [], (row) => row.trait_key as string),
  )
  const faltan = CATALOGO_DE_OBJETOS.filter((c) => !existentes.has(c.clave))
  if (faltan.length === 0) return 0
  const sentencias: BatchStatement[] = faltan.map((c) => ({
    sql: 'INSERT OR IGNORE INTO magic_item_traits (trait_key, kind, name, cost, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    params: [c.clave, c.tipo, c.nombre, c.coste, c.descripcion ?? '', c.sortOrder],
  }))
  for (let i = 0; i < sentencias.length; i += LOTE) {
    await execCatalogBatch(sentencias.slice(i, i + LOTE))
  }
  return faltan.length
}
