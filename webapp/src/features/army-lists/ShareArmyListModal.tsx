// ============================================================================
// "Compartir" un ejército con otros usuarios.
//
// TRES NIVELES POR PERSONA, en un solo control: no compartida, VER o EDITAR.
//  - Ver: la lista aparece en su sección de Ejércitos, la abre y la exporta,
//    pero no la toca.
//  - Editar: la MISMA lista, no una copia. Lo que cambie él lo ves tú y al
//    revés, y puede darla por completada o reabrirla. Lo que no puede es
//    compartirla ni borrarla: eso sigue siendo del dueño.
// Que dos editen la misma lista no pisa a nadie a ciegas: el constructor
// comprueba antes de guardar si otro la ha guardado entretanto y pregunta (ver
// ArmyListBuilderPage, "cambios de otro").
//
// EL DESPLIEGUE VA APARTE, y por persona. Enseñarle el ejército a un rival
// para que lo revise antes de la partida no debería enseñarle dónde vas a
// colocar; a un compañero de equipo sí. La casilla nace APAGADA —lo que se
// comparte sin querer no se puede des-ver— y con edición, quien lo ve también
// lo puede mover.
//
// Solo lo abre el dueño: en una lista compartida contigo este botón no sale.
// ============================================================================
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { ArmyListRepository, type ArmyListShare } from '@/data/repositories/armyListRepository'
import { UserRepository } from '@/data/repositories/userRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'

type Acceso = 'nada' | 'ver' | 'editar'
const ACCESOS: { valor: Acceso; etiqueta: string }[] = [
  { valor: 'nada', etiqueta: 'No' },
  { valor: 'ver', etiqueta: 'Ver' },
  { valor: 'editar', etiqueta: 'Editar' },
]

export function ShareArmyListModal({
  armyListId,
  listName,
  ownerId,
  onClose,
  onSaved,
}: {
  armyListId: number
  listName: string
  ownerId: number
  onClose: () => void
  onSaved: () => void
}) {
  const { data: users, loading: loadingUsers } = useAsync(() => UserRepository.listAll())
  const { data: compartidos } = useAsync(() => ArmyListRepository.getShares(armyListId), [armyListId])

  /** Por id de usuario: null = todavía cargando. Sin clave = no compartida con él. */
  const [selected, setSelected] = useState<Map<number, ArmyListShare> | null>(null)
  useEffect(() => {
    if (compartidos) setSelected(new Map(compartidos.map((c) => [c.userId, c])))
  }, [compartidos])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El dueño no se comparte la lista consigo mismo: ya la tiene, y aparecer en
  // su propia lista de destinatarios solo invita a marcarse por error.
  const destinatarios = (users ?? []).filter((u) => u.id !== ownerId)

  /** No compartida, solo ver o editar. */
  function ponerAcceso(id: number, acceso: Acceso) {
    setSelected((prev) => {
      const next = new Map(prev ?? [])
      const actual = next.get(id)
      if (acceso === 'nada') next.delete(id)
      // Al compartir de nuevo se empieza SIN despliegue, aunque antes lo
      // tuviera: quitar y volver a poner es la forma natural de "empezar de
      // cero" con alguien. Pasar de ver a editar (o al revés) lo conserva.
      else next.set(id, { userId: id, shareDeployment: actual?.shareDeployment ?? false, canEdit: acceso === 'editar' })
      return next
    })
  }

  function toggleDespliegue(id: number) {
    setSelected((prev) => {
      const next = new Map(prev ?? [])
      const actual = next.get(id)
      if (!actual) return next
      next.set(id, { ...actual, shareDeployment: !actual.shareDeployment })
      return next
    })
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await ArmyListRepository.setShares(armyListId, [...selected.values()])
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Compartir — ${listName}`}
      widthClassName="max-w-md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !selected}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      {loadingUsers || !selected ? (
        <Spinner />
      ) : destinatarios.length === 0 ? (
        <p className="text-xs italic text-ink-soft">No hay otros usuarios con los que compartir.</p>
      ) : (
        <ul className="max-h-[55vh] divide-y divide-rule-dark/15 overflow-y-auto pr-1">
          {destinatarios.map((u) => {
            const share = selected.get(u.id)
            const acceso: Acceso = share == null ? 'nada' : share.canEdit ? 'editar' : 'ver'
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                {/* En el móvil el nombre va en su propia línea: al lado de los
                    controles se quedaba en tres letras y unos puntos. */}
                <span
                  className={clsx(
                    'w-full min-w-0 truncate text-sm sm:w-auto sm:flex-1',
                    share ? 'text-ink' : 'text-ink-soft/70',
                  )}
                >
                  {u.username}
                </span>
                <div
                  role="radiogroup"
                  aria-label={`Qué puede hacer ${u.username} con el ejército`}
                  className="flex gap-0.5 rounded-sm border border-rule-dark/50 bg-parchment/70 p-0.5"
                >
                  {ACCESOS.map(({ valor, etiqueta }) => (
                    <button
                      key={valor}
                      type="button"
                      role="radio"
                      aria-checked={acceso === valor}
                      onClick={() => ponerAcceso(u.id, valor)}
                      className={clsx(
                        'rounded-[2px] px-2.5 py-0.5 text-xs whitespace-nowrap transition-colors',
                        acceso === valor
                          ? 'bg-maroon font-semibold text-parchment shadow-sm shadow-black/20'
                          : 'text-ink-soft hover:text-ink',
                      )}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>
                {/* Sin el ejército no hay despliegue que enseñar, así que la
                    casilla solo se activa con acceso. */}
                <label
                  className={clsx(
                    'flex w-28 items-center gap-1.5 text-xs',
                    share ? 'text-ink-soft' : 'text-ink-soft/40',
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-maroon disabled:opacity-40"
                    disabled={share == null}
                    checked={share?.shareDeployment ?? false}
                    onChange={() => toggleDespliegue(u.id)}
                    aria-label={`Compartir el despliegue con ${u.username}`}
                  />
                  Despliegue
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
