// ============================================================================
// EL CANDADO de lo que es de otro jugador: un personaje de renombre, su hoja,
// su ficha, un objeto mágico.
//
// SOLO EL ICONO. El candado se entiende solo; escribir al lado "De otro
// jugador" era decir dos veces lo mismo y ocupar media barra de acciones. Lo
// que no dice el icono —DE QUIÉN es— va en el globo al pasar el ratón:
// "Personaje de Hudson228". Y en `aria-label`, para quien no ve el globo.
//
// Si todavía no se sabe el nombre (la lista de jugadores no ha llegado, o el
// autor ya no existe), el globo se queda en "de otro jugador": es lo único
// que se puede afirmar.
// ============================================================================
import { clsx } from 'clsx'
import { LockIcon } from '@/shared/ui/icons'
import { useNombresDeUsuario } from '@/shared/hooks/useNombresDeUsuario'

export function CandadoDeAutor({
  autorId,
  que = 'Personaje',
  className,
  iconClassName = 'h-3.5 w-3.5',
}: {
  autorId: number | null | undefined
  /** De qué se habla: "Personaje", "Objeto"… Va delante del nombre en el globo. */
  que?: string
  className?: string
  iconClassName?: string
}) {
  const nombres = useNombresDeUsuario()
  const autor = autorId != null ? nombres.get(autorId) : undefined
  const texto = `${que} de ${autor ?? 'otro jugador'}`
  return (
    <span role="img" aria-label={texto} title={texto} className={clsx('inline-flex text-ink-soft/60', className)}>
      <LockIcon className={iconClassName} />
    </span>
  )
}
