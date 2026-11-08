// ============================================================================
// LA MAGIA DE UN PERSONAJE DE RENOMBRE: qué sendas conoce y a qué nivel.
//
// POR QUÉ AQUÍ Y NO EN EL EJÉRCITO. Un hechicero del catálogo elige sendas al
// entrar en una lista, y puede llevar unas en una partida y otras en la
// siguiente. Un personaje con nombre propio no: su magia es parte de él,
// igual que sus habilidades o sus cicatrices, y es la misma en todos los
// ejércitos en los que aparezca. Por eso se guarda con la unidad
// (unit_magic_paths) y el constructor de listas solo la enseña.
//
// El cuerpo es el mismo control que usa el constructor (ver ListaDeSendas en
// EntryMagicSection), para que se maneje igual en los dos sitios.
//
// SE GUARDA AL VUELO. No hay botón de guardar: cada senda que se añade, se
// quita o cambia de nivel se escribe en el momento, como las habilidades y las
// cicatrices. Si falla la red se dice y se recarga lo que hay de verdad.
// ============================================================================
import { useState } from 'react'
import { MagicRepository } from '@/data/repositories/magicRepository'
import type { PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import { ListaDeSendas } from '@/features/army-lists/EntryMagicSection'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import type { EntryMagicPath } from '@/domain/types'

export function MagiaModal({
  personaje,
  onClose,
  onCambio,
}: {
  personaje: PersonajeEspecial
  onClose: () => void
  onCambio: () => void
}) {
  const { data: paths } = useAsync(() => MagicRepository.listPaths())
  const { data: guardadas, reload } = useAsync(() => MagicRepository.listUnitPaths(personaje.id))
  // Copia de trabajo: la pantalla responde al instante y la escritura va
  // detrás. Mientras no haya nada tocado, manda lo que hay en la base.
  const [borrador, setBorrador] = useState<EntryMagicPath[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sendas = borrador ?? guardadas ?? []

  async function cambiar(next: EntryMagicPath[]) {
    setBorrador(next)
    setError(null)
    try {
      await MagicRepository.setUnitPaths(personaje.id, next)
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBorrador(null)
      reload()
    }
  }

  return (
    <Modal
      title={`Magia · ${personaje.name}`}
      widthClassName="max-w-xl"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-3">
        {paths == null || guardadas == null ? (
          <Spinner />
        ) : (
          <ListaDeSendas paths={paths} value={sendas} onChange={(next) => void cambiar(next)} />
        )}
        {error && <p className="rounded-sm bg-danger-dark/10 px-2 py-1 text-mini text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
