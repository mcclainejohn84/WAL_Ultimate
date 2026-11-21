// ============================================================================
// Lo que se le HACE a un personaje de renombre desde su ficha de la vista
// avanzada: ocultarlo, hacer que su coste cuente o no, y borrarlo.
//
// Es la misma lógica que la lámina de la vista clásica (PersonajeRenombreCard),
// incluido el reintento tras aplicar migraciones cuando la columna todavía no
// existe en la D1. Se escribe aparte, y no extrayéndola de la lámina, porque la
// vista clásica se pidió INTACTA: ni una línea de ella se toca para esto.
// ============================================================================
import { useState } from 'react'
import { SpecialCharacterRepository, type PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import { UnitRepository } from '@/data/repositories/unitRepository'
import { runMigrations } from '@/data/sqlite/client'
import { mensajeDeMigracionPendiente } from '@/data/repositories/schemaHealth'

function mensaje(err: unknown): string {
  return mensajeDeMigracionPendiente(err) ?? (err instanceof Error ? err.message : String(err))
}

/** Lo intenta; si falla, aplica las migraciones y lo intenta UNA vez más. */
async function conReintento(accion: () => Promise<void>): Promise<void> {
  try {
    await accion()
  } catch {
    await runMigrations()
    await accion()
  }
}

export function useAccionesDePersonaje(personaje: PersonajeEspecial | null, onCambio: () => void) {
  const [ocupado, setOcupado] = useState<'ocultar' | 'coste' | 'borrar' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function alternarOculto() {
    if (!personaje) return
    setOcupado('ocultar')
    setError(null)
    try {
      await conReintento(() => SpecialCharacterRepository.setHidden(personaje.id, !personaje.hidden))
      onCambio()
    } catch (err) {
      setError('No se pudo cambiar la visibilidad: ' + mensaje(err))
    } finally {
      setOcupado(null)
    }
  }

  async function alternarCoste() {
    if (!personaje) return
    setOcupado('coste')
    setError(null)
    try {
      await conReintento(() => SpecialCharacterRepository.setCosteOculto(personaje.id, !personaje.hideCost))
      onCambio()
    } catch (err) {
      setError('No se pudo cambiar el coste: ' + mensaje(err))
    } finally {
      setOcupado(null)
    }
  }

  /** Lo borra UnitRepository, igual que en la lámina: un personaje ES una unidad. */
  async function borrar(): Promise<boolean> {
    if (!personaje) return false
    setOcupado('borrar')
    setError(null)
    try {
      await UnitRepository.remove(personaje.id)
      return true
    } catch (err) {
      setError('No se pudo borrar: ' + mensaje(err))
      return false
    } finally {
      setOcupado(null)
    }
  }

  return { ocupado, error, alternarOculto, alternarCoste, borrar }
}
