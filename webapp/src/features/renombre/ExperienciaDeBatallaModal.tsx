// ============================================================================
// EXPERIENCIA DE BATALLA: lo que un personaje hizo en una batalla, elegido de
// la tabla del reglamento (ver domain/experienciaDeBatalla) en vez de escrito
// a mano.
//
// LA HOJA ES UN ACTA EN DOS COLUMNAS. A la izquierda, la tabla del reglamento
// tal cual, agrupada como allí y con las acciones del personaje en cursiva,
// en un ACORDEÓN: se abre un grupo y se cierran los demás, así la hoja no
// pasa nunca del alto de un grupo; la cabecera de los cerrados dice cuántas
// hay marcadas y lo que suman. Pinchar una acción la apunta (y en las de "por cada", pinchar otra vez suma una
// más). A la derecha, lo que se le va a apuntar a ESTE personaje, línea a
// línea, con los puntos a la vista y corregibles: los puntos del bando se
// reparten entre varios personajes y no le llegan enteros a cada uno.
//
// Las piezas (elegir la batalla, la tabla, la lista) son las mismas que las de
// la experiencia de una batalla entera: ver batalla/piezasDeBatalla.
//
// Se guarda como UN apunte en su libro de experiencia, con la batalla y el
// desglose en el texto: el libro sigue siendo una lista de lo que pasó, y
// esta batalla es una de esas cosas.
// ============================================================================
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  EXPERIENCIA_MAXIMA,
  SpecialCharacterRepository,
  type PersonajeEspecial,
} from '@/data/repositories/specialCharacterRepository'
import {
  notaDeBatalla,
  pincharAccion,
  totalDeBatalla,
  type GrupoDeAccion,
  type LineaApuntada,
} from '@/domain/experienciaDeBatalla'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { SwordIcon } from '@/shared/ui/icons'
import { CamposDeBatalla, LineasApuntadas, TablaDeAcciones } from '@/features/renombre/batalla/piezasDeBatalla'
import { useBatallaElegida } from '@/features/renombre/batalla/useBatallaElegida'

export function ExperienciaDeBatallaModal({
  personaje,
  experienciaActual,
  onClose,
  onApuntado,
}: {
  personaje: PersonajeEspecial
  /** La que tiene ahora, para avisar si con esto se pasa del máximo. */
  experienciaActual: number
  onClose: () => void
  onApuntado: () => void
}) {
  const batalla = useBatallaElegida()
  const [lineas, setLineas] = useState<LineaApuntada[]>([])
  const [siguienteId, setSiguienteId] = useState(1)
  /** El grupo de la tabla que está abierto; al abrir uno se cierran los demás. */
  const [grupoAbierto, setGrupoAbierto] = useState<GrupoDeAccion | null>('personaje')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = totalDeBatalla(lineas)
  const resultado = experienciaActual + total
  const sePasa = resultado > EXPERIENCIA_MAXIMA

  function pinchar(clave: string) {
    setLineas((ls) => pincharAccion(ls, clave, siguienteId))
    setSiguienteId((n) => n + 1)
  }

  async function apuntar() {
    if (total <= 0) return
    setGuardando(true)
    setError(null)
    try {
      await SpecialCharacterRepository.añadirExperiencia(personaje.id, total, notaDeBatalla(batalla.nombre, lineas))
      onApuntado()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={`Experiencia de batalla · ${personaje.name}`}
      onClose={onClose}
      widthClassName="max-w-4xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={apuntar} disabled={guardando || total <= 0}>
            <SwordIcon className="h-4 w-4" />
            {guardando ? 'Apuntando…' : `Apuntar ${total} de experiencia`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:w-2/3">
          <CamposDeBatalla estado={batalla} />
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
          <TablaDeAcciones lineas={lineas} onPinchar={pinchar} grupoAbierto={grupoAbierto} onAbrir={setGrupoAbierto} />

          {/* ---- LO QUE SE LE APUNTA ---- */}
          <aside className="md:sticky md:top-0 md:self-start">
            <div className="rounded-sm border border-rule-dark/45 bg-parchment shadow-sm shadow-black/5">
              <div className="flex items-baseline justify-between gap-2 border-b border-rule-dark/25 px-2.5 py-1.5">
                <span className="text-micro font-semibold tracking-[0.16em] text-ink-soft/80 uppercase">
                  Para {personaje.name}
                </span>
                <span className="text-micro tabular-nums text-ink-soft/70">{lineas.length}</span>
              </div>
              <LineasApuntadas lineas={lineas} setLineas={setLineas} />
              <div className="border-t border-rule-dark/25 bg-parchment-dark/20 px-2.5 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-micro font-semibold tracking-[0.16em] text-ink-soft/80 uppercase">Total</span>
                  <span className="font-display text-2xl leading-none text-maroon tabular-nums">{total}</span>
                </div>
                <p
                  className={clsx(
                    'mt-1 text-right text-mini tabular-nums',
                    sePasa ? 'text-amber-700' : 'text-ink-soft',
                  )}
                >
                  {experienciaActual} → <b className="font-semibold">{resultado}</b> / {EXPERIENCIA_MAXIMA}
                </p>
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </aside>
        </div>
      </div>
    </Modal>
  )
}
