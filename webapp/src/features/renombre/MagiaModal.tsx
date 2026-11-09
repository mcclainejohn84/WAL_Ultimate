// ============================================================================
// LA MAGIA DE UN PERSONAJE DE RENOMBRE: sus sendas y su nivel, sus habilidades
// mágicas, sus saberes arcanos y sus pergaminos.
//
// POR QUÉ AQUÍ Y NO EN EL EJÉRCITO. Un hechicero del catálogo elige sendas al
// entrar en una lista y puede llevar otras en la partida siguiente. Un
// personaje con nombre propio no: su magia es parte de él, igual que sus
// habilidades o sus cicatrices, y es la misma en todos los ejércitos en los
// que aparezca. El constructor de listas solo la enseña.
//
// TODO SE PAGA CON EXPERIENCIA y todo deja apunte en su libro, como las
// habilidades de personaje: el saldo manda arriba, lo que no se puede pagar no
// se ofrece y se dice cuánto falta. Quitar algo devuelve lo que costó.
//
// LO QUE LA APLICACIÓN NO PUEDE COMPROBAR son los edificios —la Torre de Alta
// Hechicería y el Gremio de Magos son del jugador, no del personaje—, así que
// lo que los requiere lo dice y se compra igual. Lo que sí sabe lo exige: una
// habilidad avanzada pide la suya, un saber pide nivel de senda y los saberes
// de abajo, y las sendas nuevas no pasan del nivel de la primera.
//
// EN PESTAÑAS porque son cuatro listas que no se miran a la vez: se viene a
// subir un nivel, o a adquirir una habilidad, o a repasar los saberes.
//
// TODO SE "ADQUIERE", a petición del usuario: ni se compra, ni se aprende, ni
// se añade. Una sola palabra para la misma acción en las cuatro listas.
// ============================================================================
import { useState } from 'react'
import { clsx } from 'clsx'
import { MagicRepository } from '@/data/repositories/magicRepository'
import { SpecialCharacterRepository, type PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import { MAGIC_GROUP_LABELS, type MagicPath, type MagicPathDetail, type MagicSpell } from '@/domain/magic'
import {
  COSTE_DEL_PERGAMINO,
  ETIQUETAS_DE_MAGIA,
  GREMIO,
  MAGIA_POR_CLAVE,
  NIVEL_MAXIMO_DE_PERGAMINO,
  NOMBRE_DEL_NIVEL,
  TORRE,
  claveDePergamino,
  costeDeHabilidadMagica,
  costeDeNivel,
  devolucionDeHabilidadMagica,
  esClaveDeMagia,
  faltanSaberesPorDebajo,
  magiaDeTipo,
  nivelMaximoDeSenda,
  spellIdDePergamino,
  type HabilidadMagica,
} from '@/domain/magiaDeRenombre'
import { BotonDeInfo, Descripcion, EncabezadoDeGrupo } from '@/features/renombre/piezas'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CheckIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'

type Pestana = 'sendas' | 'habilidades' | 'saberes' | 'pergaminos'

const PESTANAS: Array<{ clave: Pestana; corto: string; largo: string }> = [
  { clave: 'sendas', corto: 'Sendas', largo: 'Sendas y niveles de magia' },
  { clave: 'habilidades', corto: 'Habilidades', largo: 'Habilidades mágicas y avanzadas' },
  { clave: 'saberes', corto: 'Saberes', largo: 'Saberes arcanos' },
  { clave: 'pergaminos', corto: 'Pergaminos', largo: 'Pergaminos de magia' },
]

/** "NIGROMANCIA" → "Nigromancia". El catálogo mezcla mayúsculas y minúsculas. */
function enMinusculas(texto: string): string {
  const bajo = texto.toLocaleLowerCase('es')
  return bajo.charAt(0).toLocaleUpperCase('es') + bajo.slice(1)
}

export function MagiaModal({
  personaje,
  onClose,
  onCambio,
}: {
  personaje: PersonajeEspecial
  onClose: () => void
  onCambio: () => void
}) {
  const { data: catalogoDeSendas } = useAsync(() => MagicRepository.listPaths())
  const { data: sendasConHechizos } = useAsync(() => MagicRepository.listPathsWithSpells())
  const { data: sendas, reload: recargarSendas } = useAsync(() => MagicRepository.listUnitPaths(personaje.id))
  const { data: claves, reload: recargarClaves } = useAsync(() =>
    SpecialCharacterRepository.listHabilidades(personaje.id),
  )
  // El saldo se recalcula aquí dentro y no se hereda de `personaje`: se gasta
  // sin cerrar el diálogo, y un saldo congelado dejaría comprar dos veces lo
  // que solo se puede pagar una.
  const { data: experiencia, reload: recargarExperiencia } = useAsync(() =>
    SpecialCharacterRepository.totalExperiencia(personaje.id),
  )

  const [pestana, setPestana] = useState<Pestana>('sendas')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [porQuitar, setPorQuitar] = useState<{ titulo: string; mensaje: string; hacer: () => Promise<void> } | null>(
    null,
  )
  // Al listado de detrás se le avisa UNA VEZ, al cerrar: cada cambio recarga
  // la página entera y aquí se hacen muchos seguidos.
  const [tocado, setTocado] = useState(false)

  const saldo = experiencia ?? 0
  const misClaves = claves ?? []
  const tiene = new Set(misClaves)
  const sendaPorId = new Map((catalogoDeSendas ?? []).map((p) => [p.id, p]))
  const misSendas = sendas ?? []

  // ---- Lo que sabe el personaje, repartido por listas --------------------
  const deMagia = misClaves.filter(esClaveDeMagia)
  const misHabilidades = deMagia.map((c) => MAGIA_POR_CLAVE.get(c)).filter((h) => h != null)
  const cuantasHabilidades = misHabilidades.filter((h) => h.tipo === 'habilidad' || h.tipo === 'avanzada').length
  const saberesPorNivel: Record<number, number> = {}
  for (const h of misHabilidades)
    if (h.tipo === 'saber' && h.nivel) saberesPorNivel[h.nivel] = (saberesPorNivel[h.nivel] ?? 0) + 1

  const sendasArchimago = misSendas.filter((s) => s.level >= 4).length
  const nivelDeLaInicial = misSendas.length > 0 ? misSendas[0].level : 0
  const grupoInicial = misSendas.length > 0 ? sendaPorId.get(misSendas[0].pathId)?.group : undefined

  /** El puesto de una senda: 0 la inicial (sin recargo), 1 la primera que abrió después... */
  function puestoDe(indice: number): number {
    return indice
  }

  function esDeSuDisciplina(senda: MagicPath | undefined): boolean {
    return senda?.group === grupoInicial
  }

  /** Lo que se ha pagado en total por una senda, que es lo que se devuelve al olvidarla. */
  function pagadoPorLaSenda(indice: number, nivel: number, misma: boolean): number {
    let total = 0
    // El nivel 1 de la senda INICIAL es gratis: es con la que empezó la
    // campaña, no se compró.
    for (let n = indice === 0 ? 2 : 1; n <= nivel; n++) total += costeDeNivel(n, puestoDe(indice), misma).total
    return total
  }

  async function hacer(accion: () => Promise<void>) {
    setOcupado(true)
    setError(null)
    try {
      await accion()
      setTocado(true)
      recargarSendas()
      recargarClaves()
      recargarExperiencia()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcupado(false)
      setPorQuitar(null)
    }
  }

  function cerrar() {
    if (tocado) onCambio()
    onClose()
  }

  // ---- Compra y devolución de cualquier cosa de las listas ---------------
  function comprar(clave: string, nombre: string, coste: number) {
    void hacer(() => SpecialCharacterRepository.anadirHabilidad(personaje.id, clave, nombre, coste))
  }
  function devolver(clave: string, nombre: string, devolucion: number) {
    void hacer(() => SpecialCharacterRepository.quitarHabilidad(personaje.id, clave, nombre, devolucion))
  }

  const cargando = catalogoDeSendas == null || sendas == null || claves == null || experiencia == null

  return (
    <Modal
      title={`Magia · ${personaje.name}`}
      widthClassName="max-w-3xl"
      onClose={cerrar}
      footer={
        <Button variant="primary" onClick={cerrar}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-3">
        {/* EL SALDO, arriba y en grande: es el dato que decide si se puede
            comprar algo. Mismo sitio y mismo peso que en Habilidades. */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-rule-dark/30 bg-parchment-dark/25 px-2.5 py-1.5">
          <div>
            <span className="block text-micro font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Experiencia disponible
            </span>
            <b className="font-display text-2xl leading-none text-maroon tabular-nums">{saldo}</b>
          </div>
          <dl className="ml-auto flex gap-4 text-right">
            <div>
              <dt className="text-micro uppercase tracking-[0.12em] text-ink-soft/80">Sendas</dt>
              <dd className="font-display text-sm leading-tight text-ink tabular-nums">{misSendas.length}</dd>
            </div>
            <div>
              <dt className="text-micro uppercase tracking-[0.12em] text-ink-soft/80">Habilidades</dt>
              <dd className="font-display text-sm leading-tight text-ink tabular-nums">{cuantasHabilidades}</dd>
            </div>
            <div>
              <dt className="text-micro uppercase tracking-[0.12em] text-ink-soft/80">Saberes</dt>
              <dd className="font-display text-sm leading-tight text-ink tabular-nums">
                {misHabilidades.filter((h) => h.tipo === 'saber').length}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap gap-0.5 rounded-sm border border-rule-dark/30 bg-parchment/70 p-0.5">
          {PESTANAS.map((p) => (
            <button
              key={p.clave}
              type="button"
              onClick={() => setPestana(p.clave)}
              title={p.largo}
              aria-pressed={p.clave === pestana}
              className={clsx(
                'rounded-sm px-2 py-0.5 text-mini font-semibold tracking-wide transition-colors',
                p.clave === pestana
                  ? 'bg-maroon text-parchment shadow-sm shadow-black/20'
                  : 'text-ink-soft hover:bg-parchment-dark',
              )}
            >
              {p.corto}
            </button>
          ))}
        </div>

        {cargando ? (
          <Spinner />
        ) : (
          <>
            {pestana === 'sendas' && (
              <PestanaDeSendas
                catalogo={catalogoDeSendas ?? []}
                misSendas={misSendas}
                saldo={saldo}
                ocupado={ocupado}
                nivelDeLaInicial={nivelDeLaInicial}
                esDeSuDisciplina={esDeSuDisciplina}
                pagadoPorLaSenda={pagadoPorLaSenda}
                onAbrir={(path, coste) =>
                  void hacer(() =>
                    SpecialCharacterRepository.abrirSenda(
                      personaje.id,
                      path.id,
                      enMinusculas(path.name),
                      1,
                      coste,
                      misSendas.length,
                    ),
                  )
                }
                onSubir={(path, nivel, coste) =>
                  void hacer(() =>
                    SpecialCharacterRepository.subirSenda(personaje.id, path.id, enMinusculas(path.name), nivel, coste),
                  )
                }
                onBajar={(path, nivel, devolucion) =>
                  void hacer(() =>
                    SpecialCharacterRepository.bajarSenda(
                      personaje.id,
                      path.id,
                      enMinusculas(path.name),
                      nivel,
                      devolucion,
                    ),
                  )
                }
                onOlvidar={(path, devolucion, nombre) =>
                  setPorQuitar({
                    titulo: 'Olvidar la senda',
                    mensaje: `¿Seguro que ${personaje.name} olvida la senda de ${nombre}? Se le devolverán ${devolucion} puntos de experiencia y quedará apuntado en su libro.`,
                    hacer: () => SpecialCharacterRepository.olvidarSenda(personaje.id, path.id, nombre, devolucion),
                  })
                }
              />
            )}

            {pestana === 'habilidades' && (
              <ListaComprable
                grupos={[
                  { etiqueta: ETIQUETAS_DE_MAGIA.habilidad, entradas: magiaDeTipo('habilidad') },
                  { etiqueta: ETIQUETAS_DE_MAGIA.avanzada, entradas: magiaDeTipo('avanzada') },
                ]}
                tiene={tiene}
                saldo={saldo}
                ocupado={ocupado}
                abierta={abierta}
                setAbierta={setAbierta}
                coste={(h) => costeDeHabilidadMagica(h.coste, cuantasHabilidades, sendasArchimago)}
                devolucion={(h) => devolucionDeHabilidadMagica(h.coste, cuantasHabilidades, sendasArchimago)}
                bloqueo={(h) => {
                  if (h.requiere && !tiene.has(h.requiere)) {
                    return `Requiere ${MAGIA_POR_CLAVE.get(h.requiere)?.nombre ?? 'otra habilidad'}`
                  }
                  if (h.clave === 'magia:aprendiz-de-mago' && sendasArchimago === 0) return 'Requiere ser Archimago'
                  return null
                }}
                onComprar={(h, coste) => comprar(h.clave, h.nombre, coste)}
                onQuitar={(h, devuelve) =>
                  setPorQuitar({
                    titulo: 'Quitar la habilidad mágica',
                    mensaje: `¿Seguro que le quitas "${h.nombre}" a ${personaje.name}? Se le devolverán ${devuelve} puntos de experiencia y quedará apuntado en su libro.`,
                    hacer: async () => devolver(h.clave, h.nombre, devuelve),
                  })
                }
              />
            )}

            {pestana === 'saberes' && (
              <>
                <Nota texto={`${TORRE}. Además, el mago necesita el nivel del hechizo en alguna de sus sendas.`} />
                <ListaComprable
                  grupos={[{ etiqueta: ETIQUETAS_DE_MAGIA.saber, entradas: magiaDeTipo('saber') }]}
                  tiene={tiene}
                  saldo={saldo}
                  ocupado={ocupado}
                  abierta={abierta}
                  setAbierta={setAbierta}
                  coste={(h) => h.coste}
                  devolucion={(h) => h.coste}
                  etiqueta={(h) => `Nivel ${h.nivel} · ${h.dificultad}`}
                  bloqueo={(h) => {
                    const nivel = h.nivel ?? 1
                    if (!misSendas.some((s) => s.level >= nivel)) return `Requiere nivel ${nivel} en una senda`
                    if (faltanSaberesPorDebajo(nivel, saberesPorNivel)) return 'Faltan saberes de nivel inferior'
                    return null
                  }}
                  onComprar={(h, coste) => comprar(h.clave, h.nombre, coste)}
                  onQuitar={(h, devuelve) =>
                    setPorQuitar({
                      titulo: 'Quitar el saber arcano',
                      mensaje: `¿Seguro que le quitas "${h.nombre}" a ${personaje.name}? Se le devolverán ${devuelve} puntos de experiencia y quedará apuntado en su libro.`,
                      hacer: async () => devolver(h.clave, h.nombre, devuelve),
                    })
                  }
                />
              </>
            )}

            {pestana === 'pergaminos' && (
              <PestanaDePergaminos
                sendas={sendasConHechizos ?? []}
                claves={misClaves}
                saldo={saldo}
                ocupado={ocupado}
                onComprar={(hechizo, coste) =>
                  comprar(claveDePergamino(hechizo.id), `Pergamino: ${hechizo.name}`, coste)
                }
                onQuitar={(hechizo, devuelve) =>
                  setPorQuitar({
                    titulo: 'Quitar el pergamino',
                    mensaje: `¿Seguro que le quitas el pergamino de "${hechizo.name}" a ${personaje.name}? Se le devolverán ${devuelve} puntos de experiencia.`,
                    hacer: async () => devolver(claveDePergamino(hechizo.id), `Pergamino: ${hechizo.name}`, devuelve),
                  })
                }
              />
            )}
          </>
        )}

        {error && <p className="rounded-sm bg-danger-dark/10 px-2 py-1 text-mini text-danger">{error}</p>}
      </div>

      {porQuitar && (
        <ConfirmDialog
          title={porQuitar.titulo}
          message={porQuitar.mensaje}
          confirmLabel="Sí, quitarlo"
          cancelLabel="No"
          onConfirm={() => void hacer(porQuitar.hacer)}
          onCancel={() => setPorQuitar(null)}
        />
      )}
    </Modal>
  )
}

/** Un aviso de los que la aplicación no puede comprobar: el edificio lo tiene el jugador, no el personaje. */
function Nota({ texto }: { texto: string }) {
  return (
    <p className="rounded-sm border-l-2 border-bronze/50 bg-parchment-dark/25 px-2 py-1 text-mini text-ink-soft">
      {texto}
    </p>
  )
}

// ---------------------------------------------------------------------------
// SENDAS
// ---------------------------------------------------------------------------
function PestanaDeSendas({
  catalogo,
  misSendas,
  saldo,
  ocupado,
  nivelDeLaInicial,
  esDeSuDisciplina,
  pagadoPorLaSenda,
  onAbrir,
  onSubir,
  onBajar,
  onOlvidar,
}: {
  catalogo: MagicPath[]
  misSendas: Array<{ pathId: number; level: number }>
  saldo: number
  ocupado: boolean
  nivelDeLaInicial: number
  esDeSuDisciplina: (senda: MagicPath | undefined) => boolean
  pagadoPorLaSenda: (indice: number, nivel: number, misma: boolean) => number
  onAbrir: (path: MagicPath, coste: number) => void
  onSubir: (path: MagicPath, nivel: number, coste: number) => void
  onBajar: (path: MagicPath, nivel: number, devolucion: number) => void
  onOlvidar: (path: MagicPath, devolucion: number, nombre: string) => void
}) {
  const [nuevaSenda, setNuevaSenda] = useState('')
  const porId = new Map(catalogo.map((p) => [p.id, p]))
  const elegidas = new Set(misSendas.map((s) => s.pathId))
  const disponibles = catalogo.filter((p) => !elegidas.has(p.id))

  const candidata = nuevaSenda ? porId.get(Number(nuevaSenda)) : undefined
  const costeDeLaNueva =
    misSendas.length === 0 ? 0 : costeDeNivel(1, misSendas.length, esDeSuDisciplina(candidata)).total

  return (
    <div className="space-y-3">
      <section>
        <EncabezadoDeGrupo etiqueta="Sendas que practica" cuantas={misSendas.length} />
        {misSendas.length === 0 ? (
          <p className="rounded-sm border border-dashed border-rule-dark/30 px-3 py-3 text-center text-mini italic text-ink-soft">
            Todavía no practica ninguna. La primera es la senda con la que empieza la campaña y no cuesta experiencia.
          </p>
        ) : (
          <ul className="divide-y divide-rule-dark/15 overflow-hidden rounded-sm border border-rule-dark/25">
            {misSendas.map((senda, indice) => {
              const path = porId.get(senda.pathId)
              const nombre = enMinusculas(path?.name ?? 'senda borrada')
              const misma = esDeSuDisciplina(path)
              const esInicial = indice === 0
              const tope = nivelMaximoDeSenda(esInicial, nivelDeLaInicial)
              const siguiente = senda.level + 1
              const subir = siguiente <= tope ? costeDeNivel(siguiente, indice, misma) : null
              const devolucionDelNivel = costeDeNivel(senda.level, indice, misma).total
              const puedeBajar = senda.level > 1
              const pagado = pagadoPorLaSenda(indice, senda.level, misma)
              return (
                <li key={senda.pathId} className="px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-ink">
                        {nombre}
                        {esInicial && <span className="ml-1.5 text-mini font-normal text-bronze">senda inicial</span>}
                      </span>
                      <span className="block truncate text-mini text-ink-soft/80">
                        {path ? enMinusculas(MAGIC_GROUP_LABELS[path.group]) : '—'} · Nivel {senda.level}:{' '}
                        {NOMBRE_DEL_NIVEL[senda.level]}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-1">
                      {puedeBajar && (
                        <button
                          type="button"
                          disabled={ocupado || !path}
                          onClick={() => path && onBajar(path, senda.level - 1, devolucionDelNivel)}
                          title={`Bajar a nivel ${senda.level - 1} y devolver ${devolucionDelNivel} de experiencia`}
                          className="rounded-sm border border-rule-dark/40 px-1.5 py-0.5 text-mini font-semibold text-ink-soft transition-colors hover:bg-parchment-dark disabled:opacity-40"
                        >
                          −1
                        </button>
                      )}
                      {subir == null ? (
                        <span
                          className="text-mini font-medium text-bronze"
                          title={
                            esInicial
                              ? 'No hay nivel por encima de Archimago'
                              : 'Una senda nueva no puede pasar del nivel de la senda inicial'
                          }
                        >
                          {senda.level >= 4 ? 'Archimago' : `Tope: nivel ${tope}`}
                        </span>
                      ) : saldo >= subir.total ? (
                        <button
                          type="button"
                          disabled={ocupado || !path}
                          onClick={() => path && onSubir(path, siguiente, subir.total)}
                          title={
                            subir.recargo > 0
                              ? `Nivel ${siguiente}: ${subir.base} de tabla + ${subir.recargo} por ser una senda nueva`
                              : `Nivel ${siguiente}`
                          }
                          className="rounded-sm border border-maroon/45 px-2 py-0.5 text-mini font-semibold text-maroon transition-colors hover:bg-maroon hover:text-parchment disabled:opacity-40"
                        >
                          Adquirir nivel {siguiente} · {subir.total} exp
                        </button>
                      ) : (
                        <span className="text-mini text-danger" title={`Hacen falta ${subir.total} y tiene ${saldo}`}>
                          Faltan {subir.total - saldo} exp
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={ocupado || !path}
                        onClick={() => path && onOlvidar(path, pagado, nombre)}
                        aria-label={`Olvidar ${nombre}`}
                        title={`Olvidarla y devolver ${pagado} de experiencia`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-ink-soft/70 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-1.5">
        <EncabezadoDeGrupo etiqueta="Adquirir una senda nueva" cuantas={disponibles.length} />
        {misSendas.length > 0 && (
          <Nota
            texto={`Requiere Torre de Hechicería. Una senda nueva nunca pasa del nivel de la inicial, y cada una que se abre encarece los niveles de las siguientes: +5 y +6 en su misma disciplina, +10 y +12 en otra.`}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={nuevaSenda}
            onChange={(e) => setNuevaSenda(e.target.value)}
            className="min-w-[10rem] flex-1 rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1.5 text-xs text-ink outline-none focus:border-bronze"
          >
            <option value="">Elegir una senda…</option>
            {disponibles.map((p) => (
              <option key={p.id} value={p.id}>
                {enMinusculas(p.name)} · {enMinusculas(MAGIC_GROUP_LABELS[p.group])}
              </option>
            ))}
          </select>
          {candidata &&
            (saldo >= costeDeLaNueva ? (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  onAbrir(candidata, costeDeLaNueva)
                  setNuevaSenda('')
                }}
                className="inline-flex items-center gap-1 rounded-sm border border-maroon/45 px-2.5 py-1 text-mini font-semibold text-maroon transition-colors hover:bg-maroon hover:text-parchment disabled:opacity-40"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                {costeDeLaNueva === 0 ? 'Adquirir' : `Adquirir · ${costeDeLaNueva} exp`}
              </button>
            ) : (
              <span className="text-mini text-danger">Faltan {costeDeLaNueva - saldo} exp</span>
            ))}
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LISTAS DE COMPRA (habilidades, avanzadas, saberes)
// ---------------------------------------------------------------------------
function ListaComprable({
  grupos,
  tiene,
  saldo,
  ocupado,
  abierta,
  setAbierta,
  coste,
  devolucion,
  etiqueta,
  bloqueo,
  onComprar,
  onQuitar,
}: {
  grupos: Array<{ etiqueta: string; entradas: HabilidadMagica[] }>
  tiene: Set<string>
  saldo: number
  ocupado: boolean
  abierta: string | null
  setAbierta: (clave: string | null) => void
  coste: (h: HabilidadMagica) => number
  devolucion: (h: HabilidadMagica) => number
  etiqueta?: (h: HabilidadMagica) => string
  bloqueo: (h: HabilidadMagica) => string | null
  onComprar: (h: HabilidadMagica, coste: number) => void
  onQuitar: (h: HabilidadMagica, devolucion: number) => void
}) {
  return (
    <div className="space-y-3">
      {grupos.map((grupo) => (
        <section key={grupo.etiqueta}>
          <EncabezadoDeGrupo
            etiqueta={grupo.etiqueta}
            cuantas={grupo.entradas.filter((h) => tiene.has(h.clave)).length}
          />
          <ul className="divide-y divide-rule-dark/12">
            {grupo.entradas.map((h) => {
              const laTiene = tiene.has(h.clave)
              const precio = coste(h)
              const impedimento = laTiene ? null : bloqueo(h)
              return (
                <li key={h.clave} className="px-0.5 py-1">
                  <div className="flex items-center gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span
                        className={clsx('min-w-0 truncate text-xs', laTiene ? 'font-medium text-maroon' : 'text-ink')}
                      >
                        {h.nombre}
                      </span>
                      {etiqueta && <span className="shrink-0 text-mini text-ink-soft/70">{etiqueta(h)}</span>}
                      <BotonDeInfo
                        nombre={h.nombre}
                        abierto={abierta === h.clave}
                        onClick={() => setAbierta(abierta === h.clave ? null : h.clave)}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right text-mini tabular-nums text-ink-soft/80">
                      {laTiene ? devolucion(h) : precio} exp.
                    </span>
                    <span className="flex w-28 shrink-0 items-center justify-end gap-1">
                      {laTiene ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-mini font-medium text-maroon">
                            <CheckIcon className="h-3 w-3" />
                            Ya adquirida
                          </span>
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => onQuitar(h, devolucion(h))}
                            aria-label={`Quitar ${h.nombre}`}
                            title={`Quitarla y devolver ${devolucion(h)} de experiencia`}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-ink-soft/70 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : impedimento ? (
                        // EL MOTIVO SE LEE ENTERO, aunque ocupe dos renglones:
                        // cortado con puntos suspensivos ("Faltan saberes de
                        // nivel…") obliga a un `title` que en un móvil no
                        // existe, y el motivo es justo lo que hay que saber.
                        <span className="text-right text-mini font-medium leading-tight text-bronze">
                          {impedimento}
                        </span>
                      ) : saldo >= precio ? (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => onComprar(h, precio)}
                          className="rounded-sm border border-maroon/45 px-2 py-0.5 text-mini font-semibold text-maroon transition-colors hover:bg-maroon hover:text-parchment disabled:opacity-40"
                        >
                          Adquirir
                        </button>
                      ) : (
                        <span className="text-mini text-danger" title={`Hacen falta ${precio} y tiene ${saldo}`}>
                          Faltan {precio - saldo} exp
                        </span>
                      )}
                    </span>
                  </div>
                  {abierta === h.clave && (
                    <Descripcion texto={h.edificio ? `${h.descripcion} (${h.edificio}.)` : h.descripcion} />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PERGAMINOS: hechizos sueltos de nivel 1 y 2, del catálogo de sendas.
// ---------------------------------------------------------------------------
function PestanaDePergaminos({
  sendas,
  claves,
  saldo,
  ocupado,
  onComprar,
  onQuitar,
}: {
  sendas: MagicPathDetail[]
  claves: string[]
  saldo: number
  ocupado: boolean
  onComprar: (hechizo: MagicSpell, coste: number) => void
  onQuitar: (hechizo: MagicSpell, devolucion: number) => void
}) {
  const [elegido, setElegido] = useState('')
  const porId = new Map<number, { hechizo: MagicSpell; senda: MagicPathDetail }>()
  for (const senda of sendas) {
    for (const hechizo of senda.spells) {
      if (hechizo.level <= NIVEL_MAXIMO_DE_PERGAMINO) porId.set(hechizo.id, { hechizo, senda })
    }
  }
  const mios = claves
    .map((c) => spellIdDePergamino(c))
    .filter((id) => id != null)
    .map((id) => porId.get(id))
    .filter((x) => x != null)
  const yaLosTiene = new Set(mios.map((m) => m.hechizo.id))
  const candidato = elegido ? porId.get(Number(elegido)) : undefined
  const costeDelCandidato = candidato ? (COSTE_DEL_PERGAMINO[candidato.hechizo.level] ?? 0) : 0

  return (
    <div className="space-y-3">
      <Nota texto={`${GREMIO}. Un pergamino es un hechizo suelto de nivel 1 o 2, de cualquier senda.`} />

      <section>
        <EncabezadoDeGrupo etiqueta="Pergaminos del personaje" cuantas={mios.length} />
        {mios.length === 0 ? (
          <p className="rounded-sm border border-dashed border-rule-dark/30 px-3 py-3 text-center text-mini italic text-ink-soft">
            Ninguno.
          </p>
        ) : (
          <ul className="divide-y divide-rule-dark/12">
            {mios.map(({ hechizo, senda }) => {
              const devuelve = COSTE_DEL_PERGAMINO[hechizo.level] ?? 0
              return (
                <li key={hechizo.id} className="flex items-center gap-2 px-0.5 py-1">
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">
                    {hechizo.name}
                    <span className="ml-1.5 text-mini text-ink-soft/70">
                      {enMinusculas(senda.name)} · nivel {hechizo.level}
                      {hechizo.difficulty ? ` · ${hechizo.difficulty}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-mini tabular-nums text-ink-soft/80">{devuelve} exp.</span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => onQuitar(hechizo, devuelve)}
                    aria-label={`Quitar el pergamino de ${hechizo.name}`}
                    title={`Quitarlo y devolver ${devuelve} de experiencia`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-soft/70 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-1.5">
        <EncabezadoDeGrupo etiqueta="Adquirir un pergamino" cuantas={porId.size - yaLosTiene.size} />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
            className="min-w-[12rem] flex-1 rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1.5 text-xs text-ink outline-none focus:border-bronze"
          >
            <option value="">Elegir un hechizo…</option>
            {sendas.map((senda) => {
              const suyos = senda.spells.filter((h) => h.level <= NIVEL_MAXIMO_DE_PERGAMINO && !yaLosTiene.has(h.id))
              if (suyos.length === 0) return null
              return (
                <optgroup key={senda.id} label={enMinusculas(senda.name)}>
                  {suyos.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} · nivel {h.level} · {COSTE_DEL_PERGAMINO[h.level]} exp
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          {candidato &&
            (saldo >= costeDelCandidato ? (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  onComprar(candidato.hechizo, costeDelCandidato)
                  setElegido('')
                }}
                className="inline-flex items-center gap-1 rounded-sm border border-maroon/45 px-2.5 py-1 text-mini font-semibold text-maroon transition-colors hover:bg-maroon hover:text-parchment disabled:opacity-40"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adquirir · {costeDelCandidato} exp
              </button>
            ) : (
              <span className="text-mini text-danger">Faltan {costeDelCandidato - saldo} exp</span>
            ))}
        </div>
      </section>
    </div>
  )
}
