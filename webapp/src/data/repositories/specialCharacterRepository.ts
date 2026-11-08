// ============================================================================
// PERSONAJES DE RENOMBRE: los que tienen nombre propio (Vlad von Carstein) en
// vez de ser "un Señor Vampiro" cualquiera.
//
// SON DE TODOS. Cualquiera los crea, los edita y los mete en su ejército —como
// los mapas, y al contrario que el resto del catálogo, que solo se toca desde
// "Editor". La ÚNICA excepción es OCULTARLOS: un personaje oculto solo lo ve su
// autor, y es lo que permite tener uno a medio escribir sin que le estorbe a
// nadie.
//
// NO SON UNA ENTIDAD NUEVA, y eso es lo primero que hay que entender de este
// archivo. Un personaje de renombre es una fila de `units` con
// `unit_type = 'personaje'` y `is_special_character = 1`. Nace COPIANDO un
// personaje de su facción con UnitRepository.duplicate, así que el día uno ya
// tiene perfil, equipo, monturas, coste, magia y grupo de mando sin que aquí
// haya una sola línea que replique esa estructura. El esquema avisa
// expresamente de no partir units en dos tablas (ver db/schema.sql): sería
// duplicarlo todo para no ganar nada.
//
// Consecuencia práctica y deliberada: sus ATRIBUTOS, equipo y opciones se
// editan en la ficha de unidad de siempre (UnitDetailPage), no aquí. Este
// repositorio solo se ocupa de lo que un personaje de renombre tiene y una
// unidad normal no: el retrato, el trasfondo, la experiencia y el ocultarlo.
//
// LA EXPERIENCIA NO ES UN CONTADOR, ES UN LIBRO DE APUNTES. No hay columna con
// el total: el total se suma de `unit_experience_log`. Se pidió así —poder ver
// de dónde sale cada punto, partida a partida— y además hace falta para lo que
// viene: cuando la experiencia se gaste en habilidades, un saldo suelto no
// permite explicar nada.
//
// Y ESA TABLA VA POR RED, NO EN EL SNAPSHOT DEL CATÁLOGO, aunque cuelgue de
// `units`. El catálogo es lo que casi nunca cambia y se consulta mil veces al
// pintar; esto es lo contrario: se escribe después de cada partida y se lee
// cuando alguien abre el historial de un personaje. Es dato de partida, como
// las listas de ejército, y se trata igual que ellas (exec/query en vez de
// execCatalog/queryLocal). De propina, así funciona sin esperar a que se
// despliegue el Worker: una tabla que el snapshot no conoce llegaría vacía y
// la experiencia parecería borrarse en cuanto se recargara la página.
// ============================================================================
import { exec, execCatalog, query } from '@/data/sqlite/client'
import { UnitRepository } from '@/data/repositories/unitRepository'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import { hashDeContenido, imageUrl, uploadImageAtKey } from '@/data/network/images'
import { getCurrentUser } from '@/shared/session/useSession'
import { esVisiblePara } from '@/domain/personajeRenombre'
import type { UnitSummary } from '@/data/repositories/unitRepository'

/**
 * Tope de experiencia, tal y como se pidió: una escala de 1 a 100. Sumar por
 * encima no se rechaza en la base —el apunte es histórico y no queremos perder
 * lo que pasó en una partida—, pero la interfaz avisa antes de pasarse.
 */
export const EXPERIENCIA_MAXIMA = 100

/** Un apunte del libro de experiencia. */
export interface ApunteDeExperiencia {
  id: number
  unitId: number
  /** Puntos ganados. Puede ser negativo: una corrección también es un apunte. */
  amount: number
  /** Por qué se ganaron. Es lo que hace que el registro sirva de algo. */
  note: string | null
  createdAt: string
  /**
   * Quién lo apuntó. Va el id y no el nombre porque `users` NO viaja en el
   * snapshot del catálogo, así que aquí no se puede cruzar con él sin salir a
   * la red. Y no hace falta: cada apunte deja además su línea en el Log, que
   * sí guarda el nombre de quien lo hizo.
   */
  userId: number | null
}

/** Un personaje de renombre en el listado: su unidad, más lo que solo él tiene. */
export interface PersonajeEspecial extends UnitSummary {
  /** URL del retrato, ya resuelta. null = sin foto. */
  portraitUrl: string | null
  /** Suma de todos los apuntes. */
  experiencia: number
}

function conRetrato(unidad: UnitSummary, experiencia: number): PersonajeEspecial {
  return {
    ...unidad,
    portraitUrl: unidad.portraitKey ? imageUrl(unidad.portraitKey) : null,
    experiencia,
  }
}

/**
 * La experiencia de un puñado de personajes de una vez.
 *
 * Se pide en UNA consulta agrupada y no una por personaje: el listado de una
 * facción puede tener quince, y quince viajes a la red para sumar cuatro
 * enteros es un desperdicio que además se nota al pintar.
 */
async function experienciaDe(unitIds: number[]): Promise<Map<number, number>> {
  const total = new Map<number, number>()
  if (unitIds.length === 0) return total
  const marcas = unitIds.map(() => '?').join(',')
  const filas = await query(
    `SELECT unit_id, COALESCE(SUM(amount), 0) AS total
       FROM unit_experience_log
      WHERE unit_id IN (${marcas})
      GROUP BY unit_id`,
    unitIds,
    (row) => ({ unitId: row.unit_id as number, total: row.total as number }),
  )
  for (const f of filas) total.set(f.unitId, f.total)
  return total
}

export const SpecialCharacterRepository = {
  /**
   * Los personajes de renombre de una facción. Incluye los desactivados: aquí
   * se administran, y esconderlos obligaría a activarlos a ciegas para poder
   * tocarlos. Quien los filtra es el constructor de listas.
   */
  async listByFaction(factionId: number): Promise<PersonajeEspecial[]> {
    const unidades = (await UnitRepository.listByFaction(factionId)).filter((u) => u.isSpecialCharacter)
    const exp = await experienciaDe(unidades.map((u) => u.id))
    return unidades.map((u) => conRetrato(u, exp.get(u.id) ?? 0))
  },

  /**
   * Todos los que el usuario actual puede ver, de todas las facciones, para la
   * pantalla que los lista de corrido.
   *
   * Los ocultos de otro se quitan AQUÍ y no en la pantalla: así ninguna vista
   * futura se puede olvidar de filtrarlos.
   */
  async listAll(): Promise<PersonajeEspecial[]> {
    const yo = getCurrentUser()?.id ?? null
    const unidades = (await UnitRepository.listAll()).filter((u) => u.isSpecialCharacter && esVisiblePara(u, yo))
    const exp = await experienciaDe(unidades.map((u) => u.id))
    return unidades.map((u) => conRetrato(u, exp.get(u.id) ?? 0))
  },

  /**
   * Los personajes NORMALES de una facción, que son de los que se puede copiar
   * uno de renombre. Se excluyen los que ya lo son: copiar a Vlad para hacer
   * otro Vlad no es lo que esta sección hace, y ofrecerlo solo confunde.
   */
  async listPersonajesBase(factionId: number): Promise<UnitSummary[]> {
    return (await UnitRepository.listByFaction(factionId)).filter(
      (u) => u.unitType === 'personaje' && !u.isSpecialCharacter,
    )
  },

  /**
   * Crea un personaje de renombre copiando un personaje de la facción.
   *
   * Toda la copia la hace UnitRepository.duplicate, que ya sabía hacerlo para
   * el "crear desde" de las unidades: perfil propio duplicado de verdad,
   * monturas y carros enlazados con su coste, reglas, equipo, opciones, grupo
   * de mando, marca de hechicero y sendas. Aquí solo se le dice que la copia
   * nace marcada como de renombre, y se apunta quién la hizo.
   */
  async crearDesdePersonaje(baseUnitId: number, nombre: string, factionId?: number): Promise<number> {
    // Sin línea de Log propia: `duplicate` ya apunta "Creó X copiando Y", que
    // dice más que un "creó un personaje de renombre" y evita dos entradas para
    // un solo acto.
    const id = await UnitRepository.duplicate(baseUnitId, {
      name: nombre.trim(),
      factionId,
      isSpecialCharacter: true,
    })
    // El autor se apunta DESPUÉS y en su propia sentencia, no dentro de
    // `duplicate`: esa función la usa también el "copiar unidad" del editor, y
    // las unidades normales no tienen dueño. Si falla —Worker sin desplegar, sin
    // sesión— el personaje ya está creado y sirve igual; lo único que se pierde
    // es poder ocultárselo a los demás.
    const yo = getCurrentUser()?.id ?? null
    if (yo != null) {
      try {
        await execCatalog('UPDATE units SET user_id = ? WHERE id = ?', [yo, id])
      } catch {
        // La columna puede no existir todavía. Sin autor, pero creado.
      }
    }
    return id
  },

  /**
   * Oculta o vuelve a enseñar un personaje. Oculto = solo lo ve su autor, ni en
   * el listado ni en el constructor de listas de los demás.
   *
   * QUIEN OCULTA UN PERSONAJE SIN AUTOR PASA A SERLO. Los creados antes de que
   * existiera la columna no tienen ninguno, y ocultarlos sin más los dejaría
   * invisibles para todo el mundo —incluido quien acaba de ocultarlos—, que es
   * la peor versión posible de este botón.
   */
  /**
   * Que el coste de este personaje cuente o no en los ejércitos.
   *
   * No borra el coste: la columna `base_cost` y los costes de su equipo y sus
   * monturas se quedan donde estaban, y se siguen viendo en el editor y en su
   * hoja. Lo único que cambia es que al montar una lista valen 0 (ver
   * computeEntryCost), y que volviéndolo a activar suman otra vez lo que
   * siempre pusieron.
   *
   * SE APUNTA EN EL LOG, al revés que ocultar el personaje: esto cambia lo que
   * suman los ejércitos de todo el grupo, así que no puede pasar en silencio.
   * Y el nombre del personaje no es un secreto aquí: uno con el coste
   * encendido o apagado es visible para todos por definición.
   */
  async setCosteOculto(unitId: number, oculto: boolean): Promise<void> {
    await execCatalog('UPDATE units SET hide_cost = ? WHERE id = ?', [oculto ? 1 : 0, unitId])
    await ChangeLogRepository.record(
      'unidad',
      'editar',
      oculto
        ? 'Dejó de cobrar el coste de un personaje de renombre'
        : 'Hizo que el coste de un personaje de renombre vuelva a contar',
    )
  },

  async setHidden(unitId: number, oculto: boolean): Promise<void> {
    // DOS SENTENCIAS, y en este orden. Ocultar es lo que se ha pedido y va
    // primero, solo; apuntar el autor es un apaño para los personajes que no lo
    // tienen y va después, sin poder llevarse por delante lo anterior si falla.
    // Juntarlas en un `SET hidden = 1, user_id = COALESCE(user_id, ?)` hacía que
    // cualquier problema con la columna del autor —que es la más reciente—
    // dejara al personaje sin ocultar y con un error en pantalla.
    await execCatalog('UPDATE units SET hidden = ? WHERE id = ?', [oculto ? 1 : 0, unitId])
    const yo = getCurrentUser()?.id ?? null
    if (oculto && yo != null) {
      try {
        await execCatalog('UPDATE units SET user_id = ? WHERE id = ? AND user_id IS NULL', [yo, unitId])
      } catch {
        // Sin autor apuntado. El personaje queda oculto igual y lo sigue viendo
        // todo el mundo hasta que la columna exista (ver esVisiblePara).
      }
    }
    await ChangeLogRepository.record(
      'unidad',
      'editar',
      oculto ? 'Ocultó el personaje de renombre' : 'Dejó de ocultar el personaje de renombre',
      unitId,
    )
  },

  /** Trasfondo. Cadena vacía se guarda como NULL: "sin trasfondo" es una sola cosa, no dos. */
  async setBackground(unitId: number, texto: string): Promise<void> {
    const limpio = texto.trim()
    await execCatalog('UPDATE units SET background = ? WHERE id = ?', [limpio || null, unitId])
  },

  /**
   * Guarda el retrato en R2 y apunta la unidad a su clave.
   *
   * La clave lleva el hash del contenido, como el resto de imágenes del
   * programa: así una foto dada se puede servir con caché eterna y cambiarla
   * produce una clave distinta. La anterior NO se borra a propósito — cuesta
   * unos KB y borrarla es la forma más fácil de dejar sin foto a algo que
   * todavía la estuviera mirando.
   */
  async setPortrait(unitId: number, bytes: Uint8Array, mime: string): Promise<string> {
    const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp'
    const key = `personajes/${unitId}/${await hashDeContenido(bytes)}.${ext}`
    await uploadImageAtKey(key, bytes, mime)
    await execCatalog('UPDATE units SET portrait_key = ? WHERE id = ?', [key, unitId])
    return key
  },

  /** Quita el retrato de la ficha (el objeto de R2 se queda, ver setPortrait). */
  async clearPortrait(unitId: number): Promise<void> {
    await execCatalog('UPDATE units SET portrait_key = NULL WHERE id = ?', [unitId])
  },

  // --------------------------------------------------------------------------
  // Experiencia
  // --------------------------------------------------------------------------

  /**
   * El libro de apuntes de un personaje, del más reciente al más antiguo.
   *
   * Va por red (ver la cabecera del archivo): es dato de partida, no catálogo.
   */
  async listExperiencia(unitId: number): Promise<ApunteDeExperiencia[]> {
    return query(
      `SELECT * FROM unit_experience_log
        WHERE unit_id = ?
        ORDER BY created_at DESC, id DESC`,
      [unitId],
      (row) => ({
        id: row.id as number,
        unitId: row.unit_id as number,
        amount: row.amount as number,
        note: (row.note as string) ?? null,
        createdAt: row.created_at as string,
        userId: (row.user_id as number) ?? null,
      }),
    )
  },

  /** El total de un personaje, sumado en SQL y no en el cliente. */
  async totalExperiencia(unitId: number): Promise<number> {
    const filas = await query(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM unit_experience_log WHERE unit_id = ?',
      [unitId],
      (row) => row.total as number,
    )
    return filas[0] ?? 0
  },

  /**
   * Apunta experiencia. El apunte es INMUTABLE: no hay editar ni borrar, y es a
   * propósito — es el registro de lo que pasó en una partida. Corregirse es
   * apuntar otra cosa, incluso negativa, con su motivo.
   */
  async añadirExperiencia(unitId: number, amount: number, note: string): Promise<void> {
    await exec('INSERT INTO unit_experience_log (unit_id, amount, note, created_at, user_id) VALUES (?, ?, ?, ?, ?)', [
      unitId,
      Math.round(amount),
      note.trim() || null,
      new Date().toISOString(),
      getCurrentUser()?.id ?? null,
    ])
    await ChangeLogRepository.record(
      'unidad',
      'editar',
      `Apuntó ${amount > 0 ? '+' : ''}${Math.round(amount)} de experiencia${note.trim() ? ` (${note.trim()})` : ''}`,
      unitId,
    )
  },

  // --------------------------------------------------------------------------
  // Habilidades
  // --------------------------------------------------------------------------

  /**
   * Las habilidades que tiene un personaje, por su CLAVE del catálogo (ver
   * domain/habilidadesDeRenombre). Lo que cada clave significa lo resuelve el
   * catálogo, que vive en el código.
   *
   * `.catch` como el resto de lo que va por red: si la tabla todavía no existe
   * —Worker sin desplegar— el personaje se enseña sin habilidades en vez de no
   * enseñarse. Una ficha que no carga es peor que una ficha incompleta.
   */
  async listHabilidades(unitId: number): Promise<string[]> {
    try {
      return await query<string>(
        'SELECT skill_key FROM unit_skills WHERE unit_id = ? ORDER BY created_at, skill_key',
        [unitId],
        (row) => row.skill_key as string,
      )
    } catch {
      return []
    }
  },

  /**
   * Compra una habilidad: la apunta Y DESCUENTA SU COSTE de la experiencia.
   *
   * LAS DOS COSAS O NINGUNA, y en este orden: primero el apunte de experiencia
   * y después la habilidad. Si fallara la red a medias, es preferible quedarse
   * con el cobro sin la habilidad —que se ve en el libro de apuntes y se
   * corrige— que con una habilidad gratis que nadie sabría que no se pagó.
   *
   * Quien llama COMPRUEBA ANTES que hay experiencia suficiente (ver la pantalla
   * de habilidades): aquí no se rechaza, porque el repositorio no es el sitio
   * donde explicarle nada a nadie, y porque un máster puede querer regalar una
   * habilidad a un personaje tieso.
   */
  async anadirHabilidad(unitId: number, clave: string, nombre: string, coste: number): Promise<void> {
    if (coste !== 0) {
      await SpecialCharacterRepository.añadirExperiencia(unitId, -Math.abs(coste), `Añadida habilidad "${nombre}"`)
    }
    await exec('INSERT OR IGNORE INTO unit_skills (unit_id, skill_key, created_at, user_id) VALUES (?, ?, ?, ?)', [
      unitId,
      clave,
      new Date().toISOString(),
      getCurrentUser()?.id ?? null,
    ])
  },

  /**
   * Quita una habilidad Y DEVUELVE lo que costó.
   *
   * Devolver es deliberado, y no es un agujero: esto es un grupo de amigos y lo
   * que de verdad pasa es que alguien pulsa la de al lado. Sin devolución, un
   * clic de más cuesta 50 puntos de experiencia para siempre y la única salida
   * es apuntarlos a mano, que es lo mismo pero peor explicado. El libro de
   * apuntes lo cuenta todo: queda "Añadida habilidad X, -50" y debajo "Quitada
   * la habilidad X, +50". Nadie puede hacer trampa en silencio.
   */
  async quitarHabilidad(unitId: number, clave: string, nombre: string, coste: number): Promise<void> {
    await exec('DELETE FROM unit_skills WHERE unit_id = ? AND skill_key = ?', [unitId, clave])
    if (coste !== 0) {
      await SpecialCharacterRepository.añadirExperiencia(unitId, Math.abs(coste), `Quitada la habilidad "${nombre}"`)
    }
  },

  // --------------------------------------------------------------------------
  // Cicatrices
  //
  // Las lleva su propia tabla y no `unit_skills` porque no son lo mismo: una
  // habilidad se compra con experiencia y una cicatriz se sufre. Mezclarlas
  // obligaría a mirar el catálogo para saber si hay algo que cobrar.
  // --------------------------------------------------------------------------

  /** Las cicatrices de un personaje, por su CLAVE del catálogo (ver domain/cicatricesDeRenombre). */
  async listCicatrices(unitId: number): Promise<string[]> {
    try {
      return await query<string>(
        'SELECT scar_key FROM unit_scars WHERE unit_id = ? ORDER BY created_at, scar_key',
        [unitId],
        (row) => row.scar_key as string,
      )
    } catch {
      // Sin la tabla (Worker sin desplegar), el personaje se enseña sin
      // cicatrices en vez de no enseñarse.
      return []
    }
  },

  /**
   * Le queda una cicatriz. NO cuesta experiencia y no deja apunte en el libro:
   * no se ha pagado nada, ha pasado algo.
   */
  async anadirCicatriz(unitId: number, clave: string): Promise<void> {
    await exec('INSERT OR IGNORE INTO unit_scars (unit_id, scar_key, created_at, user_id) VALUES (?, ?, ?, ?)', [
      unitId,
      clave,
      new Date().toISOString(),
      getCurrentUser()?.id ?? null,
    ])
  },

  /** Se la quita. Tampoco devuelve nada, por lo mismo. */
  async quitarCicatriz(unitId: number, clave: string): Promise<void> {
    await exec('DELETE FROM unit_scars WHERE unit_id = ? AND scar_key = ?', [unitId, clave])
  },

  /**
   * Deja de ser personaje de renombre y vuelve a ser un personaje normal. No se
   * borra nada: la unidad se queda, con sus atributos y su equipo. Borrarla del
   * todo es cosa de la ficha de unidad, que ya sabe hacerlo y avisa de lo que
   * se lleva por delante.
   *
   * Se quita también el "oculto": la marca solo tiene sentido en un personaje
   * de renombre, y dejarla puesta escondería una unidad normal del editor sin
   * que nada lo explicara.
   */
  async degradarAPersonaje(unitId: number): Promise<void> {
    // SIN línea de Log, aunque al terminar ya sea una unidad normal y el filtro
    // de ChangeLogRepository no la fuese a parar: la entrada diría el nombre de
    // un personaje que hasta hace un instante podía estar oculto, y ese nombre
    // es justo lo que no tiene que llegar al registro común.
    await execCatalog('UPDATE units SET is_special_character = 0, hidden = 0 WHERE id = ?', [unitId])
  },
}
