// ============================================================================
// El diálogo de UN apéndice: su título y su texto, con el editor con formato.
//
// Vive aparte de la pantalla de Apéndices porque lo usan dos sitios: esa
// pantalla y las Hojas de Unidad, donde el apéndice se puede retocar sin
// salir de la hoja (que fue justo lo que se pidió). Un diálogo copiado en dos
// sitios acaba divergiendo.
//
// DE QUÉ CUELGA SE ELIGE EN TRES PASOS —facción, tipo y elemento— y el primero
// es solo un FILTRO: lo que se guarda es el elemento. Si ese elemento (un
// escudo, una montura) lo usan unidades de varias facciones, el apéndice sale
// en todas, como tiene que ser. Sin el filtro, el desplegable de elementos
// traía el catálogo entero y elegir en una lista de trescientas líneas es
// justo lo que se vino a evitar.
// ============================================================================
import { useState } from 'react'
import {
  AppendixRepository,
  DUENOS,
  ETIQUETAS_DE_DUENO,
  type Dueno,
  type DuenoPosible,
} from '@/data/repositories/appendixRepository'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { RichTextEditor } from '@/shared/ui/RichTextEditor'
import type { ApendiceDueno, UnitAppendix } from '@/domain/types'

export function EditorDeApendice({
  apendice,
  duenos = [],
  faccionElegida = null,
  duenoFijo,
  onClose,
  onGuardado,
}: {
  apendice: UnitAppendix | null
  /** De qué se puede colgar un apéndice nuevo. Vacío si el dueño ya viene dado. */
  duenos?: DuenoPosible[]
  faccionElegida?: number | null
  /** El dueño ya decidido (lo pasa la hoja de unidad): entonces no se pregunta. */
  duenoFijo?: Dueno
  onClose: () => void
  onGuardado: () => void
}) {
  const [titulo, setTitulo] = useState(apendice?.title ?? '')
  const [cuerpo, setCuerpo] = useState(apendice?.bodyHtml ?? '')
  const [kind, setKind] = useState<ApendiceDueno>(apendice?.ownerKind ?? duenoFijo?.kind ?? 'unidad')
  const [ownerId, setOwnerId] = useState<string>(
    apendice ? String(apendice.ownerId) : duenoFijo ? String(duenoFijo.id) : '',
  )
  // La facción de la que se está eligiendo. Arranca en la que se esté mirando
  // en la pantalla; vacío = todas (hace falta para lo que no es de ninguna,
  // como una opción de equipo que todavía no usa nadie).
  const [faccion, setFaccion] = useState<string>(
    apendice?.ownerKind === 'faccion' ? String(apendice.ownerId) : faccionElegida != null ? String(faccionElegida) : '',
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const faccionId = faccion ? Number(faccion) : null
  const facciones = duenos.filter((d) => d.kind === 'faccion').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  // Un apéndice de FACCIÓN no necesita un tercer paso: el elemento es la
  // facción que ya se ha elegido arriba.
  const esDeFaccion = kind === 'faccion'
  const candidatos = duenos
    .filter((d) => d.editable)
    .filter((d) => d.kind === kind)
    .filter((d) => faccionId == null || d.factionIds.includes(faccionId))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  async function guardar() {
    if (!titulo.trim()) {
      setError('El título es obligatorio.')
      return
    }
    const destino = esDeFaccion ? Number(faccion) : Number(ownerId)
    if (!apendice && !destino) {
      setError(esDeFaccion ? 'Elige la facción.' : 'Elige de qué cuelga el apéndice.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      if (apendice) {
        await AppendixRepository.update(apendice.id, { title: titulo, bodyHtml: cuerpo })
      } else {
        const dueno: Dueno = { kind, id: destino }
        await AppendixRepository.create(dueno, { title: titulo, bodyHtml: cuerpo })
      }
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={apendice ? 'Editar apéndice' : 'Nuevo apéndice'}
      widthClassName="max-w-3xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void guardar()} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!apendice && !duenoFijo && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Facción"
              value={faccion}
              onChange={(e) => {
                setFaccion(e.target.value)
                setOwnerId('')
              }}
            >
              <option value="">Todas</option>
              {facciones.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </Select>
            <Select
              label="Tipo"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as ApendiceDueno)
                setOwnerId('')
              }}
            >
              {DUENOS.map((k) => (
                <option key={k} value={k}>
                  {ETIQUETAS_DE_DUENO[k]}
                </option>
              ))}
            </Select>
            {!esDeFaccion && (
              <Select label="Elemento" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">Elegir…</option>
                {candidatos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}
        <TextField label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
        <div>
          <span className="mb-1 block text-xs font-medium text-ink-soft">Texto</span>
          <RichTextEditor value={cuerpo} onChange={setCuerpo} valorInicialKey={apendice?.id ?? 'nuevo'} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
