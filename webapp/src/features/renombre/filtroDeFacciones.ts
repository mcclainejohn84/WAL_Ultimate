// ============================================================================
// QUÉ FACCIONES SE ESTÁN MIRANDO en la pantalla de Personajes de Renombre, y
// que se acuerde de una visita a otra.
//
// Se guarda en el navegador (localStorage) y no en la base: es una preferencia
// de cómo mira uno la pantalla, no un dato del grupo, y mandarla a la red en
// cada clic sería gastar un viaje para nada. Va por USUARIO, porque dos
// jugadores pueden entrar desde el mismo navegador y no tienen por qué
// heredar el filtro del otro.
//
// Vacío = TODAS. Es lo que hay la primera vez y lo que queda al quitar la
// última facción marcada: una pantalla vacía sin que nadie la haya pedido es
// peor que enseñar de más.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'

function clave(nombre: string, userId: number | null | undefined): string {
  return `wharmy_renombre_${nombre}_${userId ?? 'anon'}`
}

function leer(nombre: string, userId: number | null | undefined): number[] {
  try {
    const crudo = localStorage.getItem(clave(nombre, userId))
    if (!crudo) return []
    const ids: unknown = JSON.parse(crudo)
    return Array.isArray(ids) ? ids.filter((x): x is number => typeof x === 'number') : []
  } catch {
    // Navegador en privado, almacenamiento bloqueado o un valor de otra
    // versión: se mira todo, que es el estado de salida.
    return []
  }
}

export function useFiltroDeFacciones(
  userId: number | null | undefined,
): [Set<number>, (siguiente: Set<number>) => void] {
  return useFiltroGuardado('facciones', userId)
}

/**
 * El mismo filtro con memoria para las CAMPAÑAS. Además de los ids de las
 * campañas lleva SIN_CAMPANA (ver domain/campanas), para poder ver los que no están en ninguna.
 */
export function useFiltroDeCampanas(
  userId: number | null | undefined,
): [Set<number>, (siguiente: Set<number>) => void] {
  return useFiltroGuardado('campanas', userId)
}

function useFiltroGuardado(
  nombre: string,
  userId: number | null | undefined,
): [Set<number>, (siguiente: Set<number>) => void] {
  const [ids, setIds] = useState<Set<number>>(() => new Set(leer(nombre, userId)))

  // Al cambiar de usuario (entrar, salir, otro jugador) se recarga SU filtro,
  // no se arrastra el del anterior.
  useEffect(() => {
    setIds(new Set(leer(nombre, userId)))
  }, [nombre, userId])

  const guardar = useCallback(
    (siguiente: Set<number>) => {
      setIds(siguiente)
      try {
        localStorage.setItem(clave(nombre, userId), JSON.stringify([...siguiente]))
      } catch {
        // Sin almacenamiento el filtro funciona igual; lo único que se pierde
        // es que se acuerde la próxima vez.
      }
    },
    [nombre, userId],
  )

  return [ids, guardar]
}
