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
// Se guarda como UN apunte en su libro de experiencia, con la batalla y el
// desglose en el texto: el libro sigue siendo una lista de lo que pasó, y
// esta batalla es una de esas cosas.
// ============================================================================
import { useState } from 'react'
import type { GrupoDeAccion } from '@/domain/experienciaDeBatalla'
import { clsx } from 'clsx'
import {
  EXPERIENCIA_MAXIMA,
  SpecialCharacterRepository,
  type PersonajeEspecial,
} from '@/data/repositories/specialCharacterRepository'
import { BattleRepository } from '@/data/repositories/battleRepository'
import {
  ACCIONES_DE_BATALLA,
  ACCION_POR_CLAVE,
  GRUPOS_DE_ACCIONES,
  cambiarCantidad,
  cambiarPuntos,
  cambiarRango,
  notaDeBatalla,
  pincharAccion,
  quitarLinea,
  totalDeBatalla,
  vecesElegida,
  type LineaApuntada,
} from '@/domain/experienciaDeBatalla'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { EnteroInput } from '@/shared/ui/EnteroInput'
import { CheckIcon, ChevronDownIcon, SwordIcon, XIcon } from '@/shared/ui/icons'
import { BotonDeInfo, Descripcion } from '@/features/renombre/piezas'

/** Valor del desplegable para escribir el nombre de una batalla que no está en la lista. */
const OTRA = 'otra'

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
  const { data: batallas } = useAsync(() => BattleRepository.listAll().catch(() => []))
  const [batallaElegida, setBatallaElegida] = useState<string>('')
  const [nombreEscrito, setNombreEscrito] = useState('')
  const [lineas, setLineas] = useState<LineaApuntada[]>([])
  const [siguienteId, setSiguienteId] = useState(1)
  const [infoAbierta, setInfoAbierta] = useState<string | null>(null)
  /** El grupo de la tabla que está abierto; al abrir uno se cierran los demás. */
  const [grupoAbierto, setGrupoAbierto] = useState<GrupoDeAccion | null>('personaje')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hayBatallas = (batallas?.length ?? 0) > 0
  const escribiendo = !hayBatallas || batallaElegida === OTRA
  const batalla = batallas?.find((b) => String(b.id) === batallaElegida) ?? null
  const nombreDeLaBatalla = escribiendo ? nombreEscrito : (batalla?.name ?? '')

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
      await SpecialCharacterRepository.añadirExperiencia(personaje.id, total, notaDeBatalla(nombreDeLaBatalla, lineas))
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
        {/* LA BATALLA: una de las jugadas, o escrita a mano. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:w-2/3">
          {hayBatallas && (
            <Select label="Batalla" value={batallaElegida} onChange={(e) => setBatallaElegida(e.target.value)}>
              <option value="">Elige una batalla…</option>
              {(batallas ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.nombreA} contra {b.nombreB}
                </option>
              ))}
              <option value={OTRA}>Otra (escribir el nombre)</option>
            </Select>
          )}
          {escribiendo && (
            <TextField
              label={hayBatallas ? 'Nombre de la batalla' : 'Batalla'}
              placeholder="La batalla del Paso Negro"
              value={nombreEscrito}
              onChange={(e) => setNombreEscrito(e.target.value)}
            />
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
          {/* ---- LA TABLA DEL REGLAMENTO, en acordeón ---- */}
          <div className="min-w-0 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/60">
            {GRUPOS_DE_ACCIONES.map((grupo) => {
              const acciones = ACCIONES_DE_BATALLA.filter((x) => x.grupo === grupo.clave)
              const claveInfo = `grupo:${grupo.clave}`
              const abierto = grupoAbierto === grupo.clave
              const suyas = lineas.filter((l) => ACCION_POR_CLAVE.get(l.clave)?.grupo === grupo.clave)
              const marcadas = suyas.reduce((n, l) => n + l.cantidad, 0)
              const suman = totalDeBatalla(suyas)
              return (
                <section key={grupo.clave} className="border-b border-rule-dark/25 last:border-b-0">
                  <div className={clsx('flex items-center gap-1 pr-1', abierto && 'bg-parchment-dark/25')}>
                    <button
                      type="button"
                      onClick={() => setGrupoAbierto(abierto ? null : grupo.clave)}
                      aria-expanded={abierto}
                      aria-controls={`grupo-${grupo.clave}`}
                      className="group flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left focus-visible:bg-bronze/10 focus-visible:outline-none"
                    >
                      <ChevronDownIcon
                        className={clsx(
                          'h-3.5 w-3.5 shrink-0 text-ink-soft/60 transition-transform duration-200 group-hover:text-bronze',
                          !abierto && '-rotate-90',
                        )}
                      />
                      <span className="text-micro font-semibold tracking-[0.16em] text-bronze uppercase">
                        {grupo.titulo}
                      </span>
                      <span className="text-micro tabular-nums text-ink-soft/60">{acciones.length}</span>
                      {/* Lo marcado en el grupo, a la vista aunque esté cerrado. */}
                      {marcadas > 0 && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-sm bg-maroon px-1.5 py-px text-mini font-semibold text-parchment tabular-nums">
                          {marcadas} · +{suman}
                        </span>
                      )}
                    </button>
                    <BotonDeInfo
                      nombre={grupo.titulo}
                      abierto={infoAbierta === claveInfo}
                      onClick={() => setInfoAbierta(infoAbierta === claveInfo ? null : claveInfo)}
                    />
                  </div>
                  {infoAbierta === claveInfo && (
                    <div className="px-2.5 pb-1.5">
                      <Descripcion texto={grupo.reparto} />
                      {grupo.nota && <Descripcion texto={grupo.nota} />}
                    </div>
                  )}
                  {abierto && (
                    <ul id={`grupo-${grupo.clave}`} className="border-t border-rule-dark/25">
                      {acciones.map((accion) => {
                        const veces = vecesElegida(lineas, accion.clave)
                        const elegida = veces > 0
                        return (
                          <li key={accion.clave} className="border-b border-rule-dark/15 last:border-b-0">
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() => pinchar(accion.clave)}
                                aria-pressed={elegida}
                                className={clsx(
                                  'flex min-w-0 flex-1 items-center gap-2 px-2 py-[0.3rem] text-left text-[0.8rem] leading-snug transition-colors',
                                  'focus-visible:bg-bronze/10 focus-visible:outline-none',
                                  elegida ? 'bg-maroon/[0.07] text-ink' : 'text-ink hover:bg-bronze/10',
                                )}
                              >
                                <span
                                  aria-hidden
                                  className={clsx(
                                    'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border text-[0.55rem] font-bold tabular-nums',
                                    elegida
                                      ? 'border-maroon bg-maroon text-parchment'
                                      : 'border-rule-dark/40 bg-parchment text-transparent',
                                  )}
                                >
                                  {elegida && veces > 1 ? veces : <CheckIcon className="h-2.5 w-2.5" />}
                                </span>
                                <span className={clsx('min-w-0 flex-1', grupo.cursiva && 'italic')}>
                                  {accion.texto}
                                </span>
                                <span
                                  className={clsx(
                                    'shrink-0 text-xs font-semibold tabular-nums',
                                    elegida ? 'text-maroon' : 'text-ink-soft/70',
                                  )}
                                >
                                  {accion.porRango ? '1 + rango − 2' : `+${accion.puntos}`}
                                </span>
                              </button>
                              {accion.nota && (
                                <span className="pr-1">
                                  <BotonDeInfo
                                    nombre={accion.texto}
                                    abierto={infoAbierta === accion.clave}
                                    onClick={() => setInfoAbierta(infoAbierta === accion.clave ? null : accion.clave)}
                                  />
                                </span>
                              )}
                            </div>
                            {infoAbierta === accion.clave && accion.nota && (
                              <div className="px-2 pb-1">
                                <Descripcion texto={accion.nota} />
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>

          {/* ---- LO QUE SE LE APUNTA ---- */}
          <aside className="md:sticky md:top-0 md:self-start">
            <div className="rounded-sm border border-rule-dark/45 bg-parchment shadow-sm shadow-black/5">
              <div className="flex items-baseline justify-between gap-2 border-b border-rule-dark/25 px-2.5 py-1.5">
                <span className="text-micro font-semibold tracking-[0.16em] text-ink-soft/80 uppercase">
                  Para {personaje.name}
                </span>
                <span className="text-micro tabular-nums text-ink-soft/70">{lineas.length}</span>
              </div>

              {lineas.length === 0 ? (
                <p className="px-3 py-4 text-xs text-ink-soft/55 italic">Nada todavía.</p>
              ) : (
                <ul className="divide-y divide-rule-dark/15">
                  {lineas.map((l) => {
                    const accion = ACCION_POR_CLAVE.get(l.clave)
                    if (!accion) return null
                    const cursiva = GRUPOS_DE_ACCIONES.find((g) => g.clave === accion.grupo)?.cursiva
                    return (
                      <li key={l.id} className="px-2.5 py-1.5">
                        {/* Una línea: lo que es, sus puntos y quitarla. Debajo,
                            solo si los tiene, cuántas veces o el rango. */}
                        <div className="flex items-center gap-2">
                          <span className={clsx('min-w-0 flex-1 text-xs leading-snug text-ink', cursiva && 'italic')}>
                            {accion.corto}
                          </span>
                          <label className="flex shrink-0 items-center gap-1 text-mini text-ink-soft">
                            <EnteroInput
                              min={0}
                              value={l.puntos}
                              onChange={(e) => setLineas((ls) => cambiarPuntos(ls, l.id, Number(e.target.value)))}
                              aria-label={`Puntos de ${accion.corto}`}
                              className={clsx(
                                'w-11 rounded-sm border px-1.5 py-0.5 text-right text-xs font-semibold tabular-nums',
                                l.editada
                                  ? 'border-bronze/60 bg-bronze/10 text-ink'
                                  : 'border-rule-dark/40 bg-parchment/70 text-ink',
                              )}
                              title={l.editada ? 'Corregido a mano' : undefined}
                            />
                            pts
                          </label>
                          <button
                            type="button"
                            onClick={() => setLineas((ls) => quitarLinea(ls, l.id))}
                            aria-label={`Quitar ${accion.corto}`}
                            className="shrink-0 rounded-sm p-0.5 text-ink-soft/50 transition-colors hover:text-danger"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {(accion.porCada || accion.porRango) && (
                          <div className="mt-1.5 flex items-center gap-2">
                            {accion.porCada && (
                              <span className="flex items-center rounded-sm border border-rule-dark/40 bg-parchment/70">
                                <button
                                  type="button"
                                  onClick={() => setLineas((ls) => cambiarCantidad(ls, l.id, l.cantidad - 1))}
                                  aria-label="Una menos"
                                  className="px-1.5 py-0.5 text-xs text-ink-soft hover:text-ink"
                                >
                                  −
                                </button>
                                <span className="min-w-5 text-center text-xs tabular-nums text-ink">×{l.cantidad}</span>
                                <button
                                  type="button"
                                  onClick={() => setLineas((ls) => cambiarCantidad(ls, l.id, l.cantidad + 1))}
                                  aria-label="Una más"
                                  className="px-1.5 py-0.5 text-xs text-ink-soft hover:text-ink"
                                >
                                  +
                                </button>
                              </span>
                            )}
                            {accion.porRango && (
                              <label className="flex items-center gap-1 text-mini text-ink-soft">
                                Rango
                                <EnteroInput
                                  min={1}
                                  value={l.rango ?? ''}
                                  onChange={(e) => setLineas((ls) => cambiarRango(ls, l.id, Number(e.target.value)))}
                                  className="w-11 rounded-sm border border-rule-dark/40 bg-parchment/70 px-1.5 py-0.5 text-xs tabular-nums text-ink"
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

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
