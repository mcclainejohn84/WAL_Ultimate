// ============================================================================
// CAMPAÑAS: se crean, se editan y se borran en el Editor, y agrupan
// Personajes de Renombre. Un personaje puede estar en NINGUNA, en una o en
// varias, y eso es lo que permite filtrar la pantalla de personajes por
// campaña.
//
// Cada campaña tiene su nombre, su historia (texto con formato), una imagen y
// un mapa. Las dos imágenes van a R2 como los retratos: la base guarda solo la
// clave, que lleva el hash del contenido (ver data/network/images). La
// anterior no se borra al cambiarla, por lo mismo que los retratos.
//
// QUIÉN DICE EN QUÉ CAMPAÑAS ESTÁ UN PERSONAJE: su autor, desde el propio
// personaje, como el resto de lo suyo (ver esEditablePor). La regla se
// comprueba también aquí y no solo en la pantalla.
// ============================================================================
import { execCatalog, execCatalogBatch, type BatchStatement } from '@/data/sqlite/client'
import { queryLocal, queryLocalOne } from '@/data/sqlite/localCatalog'
import { ChangeLogRepository } from '@/data/repositories/changeLogRepository'
import { hashDeContenido, imageUrl, uploadImageAtKey } from '@/data/network/images'
import { esEditablePor } from '@/domain/personajeRenombre'
import { getCurrentUser } from '@/shared/session/useSession'
import { sanearHtml, tieneTexto } from '@/shared/richText'

export interface Campana {
  id: number
  nombre: string
  /** HTML ya saneado; '' si no tiene. */
  historia: string
  imagenKey: string | null
  imagenUrl: string | null
  mapaKey: string | null
  mapaUrl: string | null
}

/** Las dos imágenes de una campaña. */
export type ImagenDeCampana = 'imagen' | 'mapa'
const COLUMNA: Record<ImagenDeCampana, string> = { imagen: 'image_key', mapa: 'map_key' }

function mapCampana(r: Record<string, unknown>): Campana {
  const imagenKey = (r.image_key as string) || null
  const mapaKey = (r.map_key as string) || null
  return {
    id: r.id as number,
    nombre: r.name as string,
    historia: (r.history as string) ?? '',
    imagenKey,
    imagenUrl: imagenKey ? imageUrl(imagenKey) : null,
    mapaKey,
    mapaUrl: mapaKey ? imageUrl(mapaKey) : null,
  }
}

function limpia(historia: string): string | null {
  const html = sanearHtml(historia)
  return tieneTexto(html) ? html : null
}

export const CampaignRepository = {
  /** Todas, por nombre. Sin la tabla (Worker sin desplegar), ninguna: la pantalla sigue funcionando. */
  async listAll(): Promise<Campana[]> {
    try {
      return await queryLocal('SELECT * FROM campaigns ORDER BY name COLLATE NOCASE, id', [], mapCampana)
    } catch {
      return []
    }
  },

  /** De cada personaje, los ids de sus campañas. Los que no están en ninguna no aparecen. */
  async campanasPorPersonaje(): Promise<Map<number, number[]>> {
    const mapa = new Map<number, number[]>()
    try {
      const filas = await queryLocal('SELECT unit_id, campaign_id FROM unit_campaigns', [], (r) => ({
        unitId: r.unit_id as number,
        campaignId: r.campaign_id as number,
      }))
      for (const f of filas) {
        const ya = mapa.get(f.unitId)
        if (ya) ya.push(f.campaignId)
        else mapa.set(f.unitId, [f.campaignId])
      }
    } catch {
      // Sin la tabla, nadie está en ninguna.
    }
    return mapa
  },

  async create(input: { nombre: string; historia: string }): Promise<number> {
    const nombre = input.nombre.trim()
    const id = await execCatalog('INSERT INTO campaigns (name, history, created_at) VALUES (?, ?, ?)', [
      nombre,
      limpia(input.historia),
      new Date().toISOString(),
    ])
    await ChangeLogRepository.record('campana', 'crear', `Creó la campaña "${nombre}"`, id)
    return id
  },

  async update(id: number, input: { nombre: string; historia: string }): Promise<void> {
    const nombre = input.nombre.trim()
    await execCatalog('UPDATE campaigns SET name = ?, history = ? WHERE id = ?', [nombre, limpia(input.historia), id])
    await ChangeLogRepository.record('campana', 'editar', `Editó la campaña "${nombre}"`, id)
  },

  /**
   * La borra y la quita de todos los personajes que estuvieran en ella. Los
   * personajes no se tocan. Las dos sentencias van juntas y en este orden para
   * no depender de que la base tenga activas las claves ajenas.
   */
  async remove(id: number): Promise<void> {
    const nombre = await queryLocalOne('SELECT name FROM campaigns WHERE id = ?', [id], (r) => r.name as string)
    await execCatalogBatch([
      { sql: 'DELETE FROM unit_campaigns WHERE campaign_id = ?', params: [id] },
      { sql: 'DELETE FROM campaigns WHERE id = ?', params: [id] },
    ])
    await ChangeLogRepository.record('campana', 'borrar', `Borró la campaña "${nombre ?? `#${id}`}"`, id)
  },

  /** Sube la imagen o el mapa a R2 y apunta la campaña a su clave. */
  async setImagen(id: number, cual: ImagenDeCampana, bytes: Uint8Array, mime: string): Promise<string> {
    const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp'
    const key = `campanas/${id}/${cual}-${await hashDeContenido(bytes)}.${ext}`
    await uploadImageAtKey(key, bytes, mime)
    await execCatalog(`UPDATE campaigns SET ${COLUMNA[cual]} = ? WHERE id = ?`, [key, id])
    return key
  },

  async quitarImagen(id: number, cual: ImagenDeCampana): Promise<void> {
    await execCatalog(`UPDATE campaigns SET ${COLUMNA[cual]} = NULL WHERE id = ?`, [id])
  },

  /**
   * Deja al personaje EXACTAMENTE en estas campañas: las que sobran se quitan y
   * las que faltan se ponen, en un solo lote. Solo su autor (ver esEditablePor).
   */
  async setCampanasDe(unitId: number, campanaIds: number[]): Promise<void> {
    const unidad = await queryLocalOne(
      'SELECT user_id, is_special_character FROM units WHERE id = ?',
      [unitId],
      (r) => ({
        userId: (r.user_id as number) ?? null,
        isSpecialCharacter: Boolean(r.is_special_character),
        hidden: false,
      }),
    )
    if (unidad && !esEditablePor(unidad, getCurrentUser()?.id ?? null)) {
      throw new Error('Este personaje es de otro jugador: solo su autor puede cambiar sus campañas.')
    }
    const sentencias: BatchStatement[] = [{ sql: 'DELETE FROM unit_campaigns WHERE unit_id = ?', params: [unitId] }]
    for (const id of [...new Set(campanaIds)]) {
      sentencias.push({ sql: 'INSERT INTO unit_campaigns (unit_id, campaign_id) VALUES (?, ?)', params: [unitId, id] })
    }
    await execCatalogBatch(sentencias)
  },
}
