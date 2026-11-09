// ============================================================================
// Una preferencia de PANTALLA que se recuerda entre visitas: qué filtro tenías
// puesto, qué columna abierta, si enseñabas lo viejo o no.
//
// En el navegador (localStorage) y no en la base: es cómo mira uno la
// pantalla, no un dato del grupo, y mandarla a la red en cada clic sería
// gastar un viaje para nada. Va por USUARIO, porque dos jugadores pueden
// entrar desde el mismo navegador y no tienen por qué heredar lo del otro.
//
// Todo lo que toca el almacenamiento va con red: en una ventana privada, o
// con el almacenamiento bloqueado, leer o escribir LANZA. Sin él la
// preferencia funciona igual; lo único que se pierde es que se acuerde.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'

function clave(nombre: string, userId: number | null | undefined): string {
  return `wharmy_${nombre}_${userId ?? 'anon'}`
}

export function usePreferenciaLocal(
  nombre: string,
  userId: number | null | undefined,
  inicial: boolean,
): [boolean, (valor: boolean) => void] {
  const leer = useCallback(() => {
    try {
      const crudo = localStorage.getItem(clave(nombre, userId))
      return crudo == null ? inicial : crudo === '1'
    } catch {
      return inicial
    }
  }, [nombre, userId, inicial])

  const [valor, setValor] = useState<boolean>(leer)

  // Al cambiar de usuario (entrar, salir, otro jugador) se recarga LA SUYA.
  useEffect(() => {
    setValor(leer())
  }, [leer])

  const guardar = useCallback(
    (siguiente: boolean) => {
      setValor(siguiente)
      try {
        localStorage.setItem(clave(nombre, userId), siguiente ? '1' : '0')
      } catch {
        // Sin almacenamiento, la preferencia vale para esta visita y ya.
      }
    },
    [nombre, userId],
  )

  return [valor, guardar]
}
