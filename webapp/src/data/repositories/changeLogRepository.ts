// ============================================================================
// Registro de cambios del EDITOR (sección "Log"): quién tocó qué y cuándo en
// los datos maestros compartidos.
//
// Alcance deliberado: SOLO Editor (facciones, unidades, reglas, equipo y
// opciones, monturas y carros). Ni Fichas ni Ejércitos — la presentación de
// una ficha y las listas de ejército son trabajo personal de cada usuario, no
// catálogo del grupo, y llenarían el registro de ruido tapando justo lo que
// interesa auditar.
//
// CON UNA EXCEPCIÓN: los CAMBIOS DE CONTRASEÑA (entidad 'usuario'). No son
// catálogo, pero son lo único que puede hacer una persona en nombre de otra —
// cualquiera con la contraseña de administrador puede restablecer la de quien
// quiera (ver la sección RESTABLECER del Worker). Esa puerta se dejó abierta a
// sabiendas, y lo que la hace asumible es precisamente que se vea aquí. Las
// escribe el propio Worker, no `record`: cuando se restablece una contraseña no
// hay nadie dentro de la aplicación que las pueda anotar.
//
// Granularidad: UNA entrada por acción ("editó la unidad Guerreros"), no por
// campo. Un diff campo a campo obligaría a leer el estado anterior en cada
// guardado y multiplicaría las filas sin ayudar a la pregunta real de esta
// pantalla, que es "¿quién anduvo tocando esto y cuándo?".
//
// El registro NO viaja en el snapshot de catálogo (crece sin parar y solo lo
// lee su propia pantalla): se escribe y se lee por red, como las listas de
// ejército. De ahí `exec`/`query` y no `execCatalog`/`queryLocal`.
// ============================================================================
import { exec, query } from '@/data/sqlite/client'
import { queryLocalOne } from '@/data/sqlite/localCatalog'
import { getCurrentUser } from '@/shared/session/useSession'

export type ChangeLogEntity =
  | 'faccion'
  | 'unidad'
  | 'regla'
  | 'equipo'
  | 'opcion'
  | 'montura'
  | 'carro'
  | 'usuario'
  // Los PERSONAJES DE RENOMBRE llevan entidad propia aunque por dentro sean
  // unidades: lo suyo —la experiencia, sobre todo— se apunta cada partida y
  // en la misma lista que el catálogo tapaba lo que se va a auditar. En el
  // Log tienen su pestaña.
  | 'personaje'
export type ChangeLogAction = 'crear' | 'editar' | 'borrar'

export interface ChangeLogEntry {
  id: number
  createdAt: string
  username: string
  entity: ChangeLogEntity
  entityId: number | null
  action: ChangeLogAction
  description: string
}

/** Etiqueta visible de cada tipo de cosa registrada. */
export const ENTITY_LABELS: Record<ChangeLogEntity, string> = {
  faccion: 'Facción',
  unidad: 'Unidad',
  regla: 'Regla especial',
  equipo: 'Equipo',
  opcion: 'Opción de unidad',
  montura: 'Montura/Dotación',
  carro: 'Carro',
  usuario: 'Usuario',
  personaje: 'Personaje de renombre',
}

export const ACTION_LABELS: Record<ChangeLogAction, string> = {
  crear: 'Creación',
  editar: 'Edición',
  borrar: 'Borrado',
}

function mapEntry(row: Record<string, unknown>): ChangeLogEntry {
  return {
    id: row.id as number,
    createdAt: row.created_at as string,
    username: row.username as string,
    entity: row.entity as ChangeLogEntity,
    entityId: (row.entity_id as number) ?? null,
    action: row.action as ChangeLogAction,
    description: row.description as string,
  }
}

/**
 * LOS PERSONAJES DE RENOMBRE SE REGISTRAN APARTE, con entidad propia, y por eso
 * se decide aquí y no en cada sitio que llama a `record`: lo que llega como
 * 'unidad' sobre un personaje de renombre se guarda como 'personaje', y en el
 * Log tiene su pestaña.
 *
 * Antes no se registraban en absoluto, y el motivo era que se pueden OCULTAR
 * (ver units.hidden): un personaje oculto solo lo ve su autor, y de nada sirve
 * esconderlo del listado si el Log le está contando a todo el mundo que existe,
 * cómo se llama y cuánta experiencia lleva. Eso NO ha cambiado — lo que lo
 * resuelve ahora es que la pestaña de Personajes se filtra por lo que cada uno
 * puede ver (ver esVisiblePara y LogPage).
 *
 * Se comprueba contra la copia local del catálogo, así que no cuesta red. Si la
 * unidad ya no está —un borrado registra DESPUÉS de borrar— no se puede saber
 * desde aquí, y por eso el borrado de un personaje lo sigue sin registrar
 * `UnitRepository.remove`: sin su fila no hay forma de saber si estaba oculto.
 */
async function esPersonajeDeRenombre(unitId: number): Promise<boolean> {
  try {
    const marca = await queryLocalOne<number>(
      'SELECT is_special_character FROM units WHERE id = ?',
      [unitId],
      (row) => (row.is_special_character as number) ?? 0,
    )
    return marca === 1
  } catch {
    // Catálogo local aún sin cargar o columna inexistente: ante la duda se
    // registra, que es el comportamiento de siempre.
    return false
  }
}

export const ChangeLogRepository = {
  /**
   * Anota un cambio. Nunca lanza: un fallo al registrar (tabla aún sin migrar,
   * red caída) no debe tumbar la edición que el usuario acaba de hacer y que
   * YA está guardada. Se avisa por consola y se sigue — perder una línea de
   * registro es mucho menos grave que perder el trabajo.
   */
  async record(
    entity: ChangeLogEntity,
    action: ChangeLogAction,
    description: string,
    entityId?: number | null,
  ): Promise<void> {
    const deVerdad =
      entity === 'unidad' && entityId != null && (await esPersonajeDeRenombre(entityId)) ? 'personaje' : entity
    const user = getCurrentUser()
    try {
      await exec(
        `INSERT INTO change_log (created_at, user_id, username, entity, entity_id, action, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          new Date().toISOString(),
          user?.id ?? null,
          user?.username ?? 'desconocido',
          deVerdad,
          entityId ?? null,
          action,
          description,
        ],
      )
    } catch (err) {
      console.warn('[WHArmy] No se pudo registrar el cambio en el Log:', err)
    }
  },

  /**
   * Últimas entradas, de la más reciente a la más antigua. `limit` acota lo
   * que se trae por red: el registro crece sin parar y la pantalla pagina.
   */
  async list(limit = 200, offset = 0): Promise<ChangeLogEntry[]> {
    try {
      return await query(
        'SELECT * FROM change_log ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
        [limit, offset],
        mapEntry,
      )
    } catch {
      // La tabla puede no existir todavía si el Worker no se ha desplegado con
      // su migración: se muestra un registro vacío en vez de una pantalla rota.
      return []
    }
  },

  /** Cuántas entradas hay en total, para saber si quedan más por cargar. */
  async count(): Promise<number> {
    try {
      const rows = await query('SELECT COUNT(*) AS n FROM change_log', [], (r) => r.n as number)
      return rows[0] ?? 0
    } catch {
      return 0
    }
  },
}
