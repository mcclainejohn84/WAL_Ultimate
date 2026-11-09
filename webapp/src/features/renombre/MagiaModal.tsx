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
//
// PERO AL LISTADO DE DETRÁS NO SE LE AVISA HASTA CERRAR. Avisar en cada clic
// volvía a pedir la lista entera de personajes con su experiencia, y la
// pantalla pegaba un respingo cada vez que se subía un nivel: con cuatro
// niveles y tres sendas, eso es una docena de recargas para no enseñar nada
// nuevo —la lámina no pinta las sendas—. Se avisa una sola vez al cerrar, y
// solo si de verdad se tocó algo.
// ============================================================================
import { useRef, useState } from 'react'
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
  const [tocado, setTocado] = useState(false)

  const sendas = borrador ?? guardadas ?? []

  // LAS ESCRITURAS VAN EN FILA, una detrás de otra. Subir un nivel de 1 a 4
  // son tres clics seguidos y tres viajes a la red: lanzados a la vez, el
  // último en llegar es el que manda, y no tiene por qué ser el último que se
  // pulsó. Encadenándolas, lo que queda guardado es lo último que se pidió.
  const cola = useRef<Promise<void>>(Promise.resolve())

  function cambiar(next: EntryMagicPath[]) {
    setBorrador(next)
    setError(null)
    cola.current = cola.current.then(async () => {
      try {
        await MagicRepository.setUnitPaths(personaje.id, next)
        setTocado(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setBorrador(null)
        reload()
      }
    })
  }

  function cerrar() {
    if (tocado) onCambio()
    onClose()
  }

  return (
    <Modal
      title={`Magia · ${personaje.name}`}
      widthClassName="max-w-xl"
      onClose={cerrar}
      footer={
        <Button variant="primary" onClick={cerrar}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-3">
        {paths == null || guardadas == null ? (
          <Spinner />
        ) : (
          <ListaDeSendas paths={paths} value={sendas} onChange={cambiar} />
        )}
        {error && <p className="rounded-sm bg-danger-dark/10 px-2 py-1 text-mini text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
