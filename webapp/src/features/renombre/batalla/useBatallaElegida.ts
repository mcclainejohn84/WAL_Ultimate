// La batalla de la que se apunta experiencia: una de las jugadas (sección
// Batallas) o escrita a mano. La usan las dos hojas de experiencia de batalla
// (ver piezasDeBatalla).
import { useState } from 'react'
import { BattleRepository } from '@/data/repositories/battleRepository'
import { useAsync } from '@/shared/hooks/useAsync'

/** Valor del desplegable para escribir el nombre de una batalla que no está en la lista. */
export const OTRA = 'otra'

export function useBatallaElegida() {
  const { data: batallas } = useAsync(() => BattleRepository.listAll().catch(() => []))
  const [elegida, setElegida] = useState<string>('')
  const [escrita, setEscrita] = useState('')
  const hayBatallas = (batallas?.length ?? 0) > 0
  const escribiendo = !hayBatallas || elegida === OTRA
  const batalla = batallas?.find((b) => String(b.id) === elegida) ?? null
  return {
    batallas: batallas ?? [],
    hayBatallas,
    escribiendo,
    elegida,
    setElegida,
    escrita,
    setEscrita,
    /** El nombre que se apunta. */
    nombre: escribiendo ? escrita : (batalla?.name ?? ''),
  }
}

export type BatallaElegida = ReturnType<typeof useBatallaElegida>
