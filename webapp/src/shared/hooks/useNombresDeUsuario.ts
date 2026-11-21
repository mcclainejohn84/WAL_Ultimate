// ============================================================================
// El nombre de cada jugador, por su id: lo que hace falta para poner "de
// Hudson228" en un candado sin preguntarlo candado a candado.
//
// UNA consulta por sesión, compartida: una pantalla de personajes puede tener
// veinte láminas y cada una pinta su candado. La promesa se guarda en el
// módulo, así que la segunda lámina ya no sale a la red. Si falla, se olvida
// para que el siguiente intento lo vuelva a probar, y mientras tanto el mapa
// va vacío (el candado dice "de otro jugador", que también es verdad).
// ============================================================================
import { useEffect, useState } from 'react'
import { UserRepository } from '@/data/repositories/userRepository'

let enCurso: Promise<Map<number, string>> | null = null

function cargar(): Promise<Map<number, string>> {
  if (!enCurso) {
    enCurso = UserRepository.listAll()
      .then((usuarios) => new Map(usuarios.map((u) => [u.id, u.username])))
      .catch(() => {
        enCurso = null
        return new Map<number, string>()
      })
  }
  return enCurso
}

export function useNombresDeUsuario(): Map<number, string> {
  const [nombres, setNombres] = useState<Map<number, string>>(() => new Map())
  useEffect(() => {
    let vivo = true
    void cargar().then((m) => {
      if (vivo) setNombres(m)
    })
    return () => {
      vivo = false
    }
  }, [])
  return nombres
}
