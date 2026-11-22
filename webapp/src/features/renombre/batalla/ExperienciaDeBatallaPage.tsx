// ============================================================================
// EXPERIENCIA DE UNA BATALLA ENTERA: todos los personajes que fueron, de una
// vez, en lugar de abrir la experiencia de cada uno.
//
// EL ORDEN DE LA HOJA ES EL DE LA MESA AL ACABAR LA PARTIDA:
//  1. De qué campaña y qué batalla. La campaña es obligatoria: decide quién
//     puede ir (sus personajes y los que no están en ninguna).
//  2. Quién fue: se marcan los personajes.
//  3. Lo que ganó el BANDO (victoria, bajas, diferencia de puntos), apuntado
//     una sola vez para la batalla.
//  4. Cada personaje: sus acciones propias (las de cursiva del reglamento,
//     que son obligatoriamente suyas) y su parte de lo del bando. Lo del bando
//     se reparte entero —la suma tiene que dar exactamente lo ganado— y el
//     General se lleva al menos 1 punto si hubo victoria. De entrada va todo
//     al General, que es lo que dice el reglamento.
//
// Al guardar, cada personaje recibe SU apunte en su libro de experiencia, con
// la batalla, la campaña y el desglose: exactamente como si se hubiera
// apuntado uno a uno (ver domain/experienciaDeBatalla#notaDeBatallaConjunta).
//
// SALEN LOS DE TODOS LOS JUGADORES, no solo los de quien apunta: es la única
// excepción a que un personaje solo lo toca su autor (ver
// domain/personajeRenombre#puedeIrALaBatalla). Quien organiza la partida la
// apunta entera. Los suyos van primero y los del resto, agrupados por jugador.
// ============================================================================
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  EXPERIENCIA_MAXIMA,
  SpecialCharacterRepository,
  type PersonajeEspecial,
} from '@/data/repositories/specialCharacterRepository'
import { CampaignRepository } from '@/data/repositories/campaignRepository'
import {
  GRUPOS_DEL_BANDO,
  GRUPOS_DEL_PERSONAJE,
  notaDeBatallaConjunta,
  pincharAccion,
  puedeIrALaCampana,
  repartoAlGeneral,
  revisarReparto,
  totalDeBatalla,
  type GrupoDeAccion,
  type LineaApuntada,
} from '@/domain/experienciaDeBatalla'
import { puedeIrALaBatalla } from '@/domain/personajeRenombre'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { useNombresDeUsuario } from '@/shared/hooks/useNombresDeUsuario'
import { PageHeader } from '@/shared/ui/PageHeader'
import { EnlaceDeVuelta } from '@/shared/ui/EnlaceDeVuelta'
import { TituloDeSeccion } from '@/shared/ui/TituloDeSeccion'
import { Select } from '@/shared/ui/Select'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EnteroInput } from '@/shared/ui/EnteroInput'
import { CheckIcon, ChevronDownIcon, StarIcon, SwordIcon } from '@/shared/ui/icons'
import { CamposDeBatalla, LineasApuntadas, TablaDeAcciones } from '@/features/renombre/batalla/piezasDeBatalla'
import { useBatallaElegida } from '@/features/renombre/batalla/useBatallaElegida'

async function cargar() {
  const [personajes, campanas, porPersonaje] = await Promise.all([
    SpecialCharacterRepository.listAll(),
    CampaignRepository.listAll(),
    CampaignRepository.campanasPorPersonaje(),
  ])
  return { personajes, campanas, porPersonaje }
}

export function ExperienciaDeBatallaPage() {
  const navegar = useNavigate()
  const { user } = useSession()
  const { data, loading } = useAsync(cargar)
  const batalla = useBatallaElegida()

  const [campanaId, setCampanaId] = useState<number | null>(null)
  const [participantes, setParticipantes] = useState<number[]>([])
  const [general, setGeneral] = useState<number | null>(null)
  /** Las acciones propias de cada personaje. */
  const [propias, setPropias] = useState<Record<number, LineaApuntada[]>>({})
  const [delBando, setDelBando] = useState<LineaApuntada[]>([])
  const [grupoDelBando, setGrupoDelBando] = useState<GrupoDeAccion | null>('victoria')
  /** El personaje cuyas acciones propias están abiertas; uno a la vez. */
  const [abierto, setAbierto] = useState<number | null>(null)
  /** Cuánto de lo del bando le toca a cada uno. Sin tocar (null), todo al General. */
  const [repartoAMano, setRepartoAMano] = useState<Record<number, number> | null>(null)
  const [siguienteId, setSiguienteId] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const porId = useMemo(() => new Map((data?.personajes ?? []).map((p) => [p.id, p])), [data])
  const campana = data?.campanas.find((c) => c.id === campanaId) ?? null

  const nombres = useNombresDeUsuario()

  // Los que pueden ir: los de cualquier jugador, de esta campaña o de ninguna.
  const elegibles = useMemo(() => {
    if (!data || campanaId == null) return []
    return data.personajes
      .filter((p) => puedeIrALaBatalla(p, user?.id))
      .filter((p) => puedeIrALaCampana(data.porPersonaje.get(p.id) ?? [], campanaId))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [data, campanaId, user?.id])

  // Y agrupados por jugador: los suyos primero, el resto por nombre.
  const porJugador = useMemo(() => {
    const grupos = new Map<number | null, PersonajeEspecial[]>()
    for (const p of elegibles) {
      const autor = p.userId ?? null
      const ya = grupos.get(autor)
      if (ya) ya.push(p)
      else grupos.set(autor, [p])
    }
    const nombreDe = (autor: number | null) =>
      autor === user?.id ? 'Tuyos' : autor != null ? (nombres.get(autor) ?? '…') : 'Sin autor'
    return [...grupos.entries()]
      .map(([autor, personajes]) => ({ autor, nombre: nombreDe(autor), personajes }))
      .sort((a, b) => (a.autor === user?.id ? -1 : b.autor === user?.id ? 1 : a.nombre.localeCompare(b.nombre, 'es')))
  }, [elegibles, nombres, user?.id])

  const totalDelBando = totalDeBatalla(delBando)
  const reparto = useMemo(
    () =>
      repartoAMano
        ? new Map(participantes.map((id) => [id, repartoAMano[id] ?? 0]))
        : repartoAlGeneral(participantes, general, totalDelBando),
    [repartoAMano, participantes, general, totalDelBando],
  )
  const estado = revisarReparto(delBando, reparto, participantes, general)
  const totalDe = (id: number) => totalDeBatalla(propias[id] ?? []) + (reparto.get(id) ?? 0)
  const algoQueApuntar = participantes.some((id) => totalDe(id) > 0)

  const motivoParaNoGuardar =
    campanaId == null
      ? 'Elige la campaña.'
      : participantes.length === 0
        ? 'Añade los personajes que fueron a la batalla.'
        : estado.pendiente > 0
          ? estado.pendiente === 1
            ? 'Falta 1 punto del bando por repartir.'
            : `Faltan ${estado.pendiente} puntos del bando por repartir.`
          : estado.pendiente < 0
            ? `Se han repartido ${-estado.pendiente} ${estado.pendiente === -1 ? 'punto' : 'puntos'} de más.`
            : estado.generalSinPunto
              ? 'El General tiene que llevarse al menos 1 punto de la victoria.'
              : !algoQueApuntar
                ? 'No hay nada que apuntar todavía.'
                : null

  // --- Quién va ------------------------------------------------------------

  function elegirCampana(valor: string) {
    const id = valor ? Number(valor) : null
    setCampanaId(id)
    // Quien no pueda ir a la nueva campaña, se cae de la lista.
    if (id != null && data) {
      const siguen = participantes.filter((p) => puedeIrALaCampana(data.porPersonaje.get(p) ?? [], id))
      if (siguen.length !== participantes.length) ponerParticipantes(siguen)
    }
  }

  function ponerParticipantes(siguientes: number[]) {
    setParticipantes(siguientes)
    if (general == null || !siguientes.includes(general)) setGeneral(siguientes[0] ?? null)
    if (abierto != null && !siguientes.includes(abierto)) setAbierto(null)
  }

  function alternarParticipante(id: number) {
    ponerParticipantes(participantes.includes(id) ? participantes.filter((p) => p !== id) : [...participantes, id])
  }

  // --- Lo apuntado -----------------------------------------------------------

  function pincharDelBando(clave: string) {
    setDelBando((ls) => pincharAccion(ls, clave, siguienteId))
    setSiguienteId((n) => n + 1)
  }

  function pincharPropia(personaje: number, clave: string) {
    setPropias((todas) => ({ ...todas, [personaje]: pincharAccion(todas[personaje] ?? [], clave, siguienteId) }))
    setSiguienteId((n) => n + 1)
  }

  function lineasDe(personaje: number) {
    return (cambio: LineaApuntada[] | ((ls: LineaApuntada[]) => LineaApuntada[])) =>
      setPropias((todas) => ({
        ...todas,
        [personaje]: typeof cambio === 'function' ? cambio(todas[personaje] ?? []) : cambio,
      }))
  }

  function cambiarParte(personaje: number, valor: number) {
    const parte = Math.max(0, Math.round(Number.isFinite(valor) ? valor : 0))
    setRepartoAMano({ ...Object.fromEntries(reparto), [personaje]: parte })
  }

  // --- Guardar ---------------------------------------------------------------

  async function apuntar() {
    if (motivoParaNoGuardar) return
    setGuardando(true)
    setError(null)
    const apuntados: string[] = []
    try {
      for (const id of participantes) {
        const total = totalDe(id)
        if (total <= 0) continue
        const nota = notaDeBatallaConjunta(
          batalla.nombre,
          campana?.nombre ?? null,
          propias[id] ?? [],
          reparto.get(id) ?? 0,
          delBando,
        )
        await SpecialCharacterRepository.añadirExperiencia(id, total, nota)
        apuntados.push(porId.get(id)?.name ?? `#${id}`)
      }
      navegar('/renombre')
    } catch (err) {
      const que = err instanceof Error ? err.message : String(err)
      // Si se corta a medias, se dice a quién ya se le apuntó: volver a
      // guardar se lo apuntaría dos veces.
      setError(apuntados.length > 0 ? `Ya se apuntó a ${apuntados.join(', ')}; el resto falló: ${que}` : que)
      setGuardando(false)
    }
  }

  if (loading && !data) return <Spinner />

  return (
    <div className="pb-24">
      <EnlaceDeVuelta to="/renombre">Personajes de Renombre</EnlaceDeVuelta>
      <PageHeader title="Experiencia de batalla" />

      {/* 1. CAMPAÑA Y BATALLA */}
      <Paso numero={1} titulo="Campaña y batalla" primero>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Campaña" value={campanaId ?? ''} onChange={(e) => elegirCampana(e.target.value)} required>
            <option value="">Elige la campaña…</option>
            {(data?.campanas ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
          <CamposDeBatalla estado={batalla} />
        </div>
      </Paso>

      {campanaId != null && (
        <>
          {/* 2. QUIÉN FUE */}
          <Paso numero={2} titulo="Personajes" cuantos={participantes.length}>
            {elegibles.length === 0 ? (
              <p className="text-xs text-ink-soft/60 italic">Ningún personaje puede ir a esta campaña.</p>
            ) : (
              <div role="group" aria-label="Personajes que fueron a la batalla" className="space-y-2.5">
                {porJugador.map((grupo) => (
                  <div key={grupo.autor ?? 'nadie'}>
                    {/* Con un solo jugador no hay nada que distinguir. */}
                    {porJugador.length > 1 && (
                      <p className="mb-1 text-micro font-semibold tracking-[0.14em] text-bronze uppercase">
                        {grupo.nombre}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {grupo.personajes.map((p) => {
                        const va = participantes.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={va}
                            onClick={() => alternarParticipante(p.id)}
                            className={clsx(
                              'inline-flex items-center gap-1.5 rounded-sm border py-0.5 pr-2.5 pl-0.5 text-xs font-medium transition-colors',
                              'focus-visible:ring-2 focus-visible:ring-bronze/40 focus-visible:outline-none',
                              va
                                ? 'border-maroon bg-maroon text-parchment shadow-sm shadow-black/20'
                                : 'border-rule-dark/45 bg-parchment/60 text-ink hover:border-bronze',
                            )}
                          >
                            <Avatar personaje={p} />
                            {p.name}
                            {va && <CheckIcon className="h-3 w-3" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Paso>

          {participantes.length > 0 && (
            <>
              {/* 3. LO DEL BANDO */}
              <Paso numero={3} titulo="Puntos del bando">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
                  <TablaDeAcciones
                    grupos={GRUPOS_DEL_BANDO}
                    lineas={delBando}
                    onPinchar={pincharDelBando}
                    grupoAbierto={grupoDelBando}
                    onAbrir={setGrupoDelBando}
                    prefijo="bando"
                  />
                  <aside className="md:sticky md:top-0 md:self-start">
                    <div className="rounded-sm border border-rule-dark/45 bg-parchment shadow-sm shadow-black/5">
                      <div className="border-b border-rule-dark/25 px-2.5 py-1.5 text-micro font-semibold tracking-[0.16em] text-ink-soft/80 uppercase">
                        Ganado por el bando
                      </div>
                      <LineasApuntadas lineas={delBando} setLineas={setDelBando} />
                      <div className="flex items-baseline justify-between border-t border-rule-dark/25 bg-parchment-dark/20 px-2.5 py-2">
                        <span className="text-micro font-semibold tracking-[0.16em] text-ink-soft/80 uppercase">
                          A repartir
                        </span>
                        <span className="font-display text-2xl leading-none text-maroon tabular-nums">
                          {totalDelBando}
                        </span>
                      </div>
                    </div>
                  </aside>
                </div>
              </Paso>

              {/* 4. CADA PERSONAJE */}
              <Paso
                numero={4}
                titulo="Reparto y acciones de cada personaje"
                extra={
                  totalDelBando > 0 && (
                    <span className="flex items-center gap-2">
                      {/* Vuelve al reparto del reglamento: todo para el General. */}
                      {repartoAMano && (
                        <button
                          type="button"
                          onClick={() => setRepartoAMano(null)}
                          className="text-mini font-medium text-ink-soft underline decoration-rule-dark/40 underline-offset-2 hover:text-ink"
                        >
                          Todo al General
                        </button>
                      )}
                      <span
                        className={clsx(
                          'text-mini font-semibold tabular-nums',
                          estado.pendiente === 0 ? 'text-success' : 'text-danger',
                        )}
                      >
                        Repartidos {estado.repartido} de {estado.total}
                      </span>
                    </span>
                  )
                }
              >
                <ul className="space-y-2">
                  {participantes.map((id) => {
                    const p = porId.get(id)
                    if (!p) return null
                    const suyas = propias[id] ?? []
                    const propiasTotal = totalDeBatalla(suyas)
                    const parte = reparto.get(id) ?? 0
                    const total = propiasTotal + parte
                    const resultado = p.experiencia + total
                    const esGeneral = general === id
                    const estaAbierto = abierto === id
                    return (
                      <li
                        key={id}
                        className={clsx(
                          'rounded-sm border bg-parchment/70 shadow-sm shadow-black/5',
                          esGeneral ? 'border-bronze/60' : 'border-rule-dark/40',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2.5 py-2">
                          <span className="flex min-w-0 flex-1 basis-52 items-center gap-2">
                            <Avatar personaje={p} grande />
                            <span className="min-w-0">
                              <span className="block truncate font-display text-[0.95rem] font-bold text-ink">
                                {p.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setGeneral(id)}
                                aria-pressed={esGeneral}
                                className={clsx(
                                  'inline-flex items-center gap-1 text-micro font-semibold tracking-[0.14em] uppercase transition-colors',
                                  esGeneral ? 'text-bronze' : 'text-ink-soft/50 hover:text-bronze',
                                )}
                              >
                                <StarIcon className="h-3 w-3" filled={esGeneral} />
                                General
                              </button>
                            </span>
                          </span>

                          {/* Sus acciones: el botón abre la tabla (una a la vez). */}
                          <button
                            type="button"
                            onClick={() => setAbierto(estaAbierto ? null : id)}
                            aria-expanded={estaAbierto}
                            className={clsx(
                              'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs transition-colors',
                              estaAbierto
                                ? 'border-maroon/50 bg-maroon/10 text-ink'
                                : 'border-rule-dark/40 bg-parchment/60 text-ink hover:border-bronze',
                            )}
                          >
                            <ChevronDownIcon
                              className={clsx('h-3.5 w-3.5 transition-transform', !estaAbierto && '-rotate-90')}
                            />
                            Propias
                            <b className="font-semibold tabular-nums">+{propiasTotal}</b>
                          </button>

                          {/* Su parte de lo del bando. */}
                          <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                            Del bando
                            <span className="flex items-center rounded-sm border border-rule-dark/40 bg-parchment/70">
                              <button
                                type="button"
                                onClick={() => cambiarParte(id, parte - 1)}
                                disabled={parte <= 0 || totalDelBando === 0}
                                aria-label={`Un punto del bando menos para ${p.name}`}
                                className="px-1.5 py-0.5 text-xs text-ink-soft hover:text-ink disabled:opacity-30"
                              >
                                −
                              </button>
                              <EnteroInput
                                min={0}
                                value={parte}
                                disabled={totalDelBando === 0}
                                onChange={(e) => cambiarParte(id, Number(e.target.value))}
                                aria-label={`Puntos del bando para ${p.name}`}
                                className="w-9 bg-transparent text-center text-xs font-semibold tabular-nums text-ink disabled:opacity-40"
                              />
                              <button
                                type="button"
                                onClick={() => cambiarParte(id, parte + 1)}
                                disabled={totalDelBando === 0}
                                aria-label={`Un punto del bando más para ${p.name}`}
                                className="px-1.5 py-0.5 text-xs text-ink-soft hover:text-ink disabled:opacity-30"
                              >
                                +
                              </button>
                            </span>
                          </span>

                          <span className="ml-auto flex items-baseline gap-2 text-right">
                            <span
                              className={clsx(
                                'text-mini tabular-nums',
                                resultado > EXPERIENCIA_MAXIMA ? 'text-amber-700' : 'text-ink-soft/80',
                              )}
                            >
                              {p.experiencia} → {resultado}
                            </span>
                            <span className="w-9 font-display text-xl leading-none text-maroon tabular-nums">
                              +{total}
                            </span>
                          </span>
                        </div>

                        {estaAbierto && (
                          <div className="grid gap-3 border-t border-rule-dark/25 px-2.5 py-2.5 md:grid-cols-[minmax(0,1fr)_15rem]">
                            <TablaDeAcciones
                              grupos={GRUPOS_DEL_PERSONAJE}
                              lineas={suyas}
                              onPinchar={(clave) => pincharPropia(id, clave)}
                              grupoAbierto="personaje"
                              onAbrir={() => undefined}
                              prefijo={`propias-${id}`}
                            />
                            <div className="self-start rounded-sm border border-rule-dark/45 bg-parchment">
                              <LineasApuntadas lineas={suyas} setLineas={lineasDe(id)} />
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Paso>
            </>
          )}
        </>
      )}

      {/* LA BARRA DE GUARDAR, siempre a mano y diciendo qué falta. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule-dark/40 bg-parchment/95 px-4 py-3 backdrop-blur-sm sm:mx-0 sm:rounded-sm sm:border">
        <p className={clsx('min-w-0 flex-1 text-xs', motivoParaNoGuardar ? 'text-ink-soft' : 'text-ink')}>
          {error ? (
            <span className="text-danger">{error}</span>
          ) : (
            (motivoParaNoGuardar ??
            `${participantes.filter((id) => totalDe(id) > 0).length} personajes reciben experiencia.`)
          )}
        </p>
        <Button variant="ghost" onClick={() => navegar('/renombre')} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={apuntar} disabled={guardando || motivoParaNoGuardar != null}>
          <SwordIcon className="h-4 w-4" />
          {guardando ? 'Apuntando…' : 'Apuntar la experiencia'}
        </Button>
      </div>
    </div>
  )
}

/** Un paso de la hoja: rótulo con su número y lo que lleva dentro. */
function Paso({
  numero,
  titulo,
  cuantos,
  extra,
  primero = false,
  children,
}: {
  numero: number
  titulo: string
  cuantos?: number
  extra?: ReactNode
  /** El primero no lleva margen de arriba: va pegado a la cabecera de la página. */
  primero?: boolean
  children: ReactNode
}) {
  return (
    <section className={primero ? undefined : 'mt-6'}>
      <TituloDeSeccion numero={numero} titulo={titulo} cuantos={cuantos} extra={extra} className="mb-2.5" />
      {children}
    </section>
  )
}

/** El retrato en pequeño, o la inicial. */
function Avatar({ personaje, grande = false }: { personaje: PersonajeEspecial; grande?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-parchment-dark/60',
        grande ? 'h-9 w-9' : 'h-6 w-6',
      )}
    >
      {personaje.portraitUrl ? (
        <img src={personaje.portraitUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-xs font-bold text-ink/45">{personaje.name.charAt(0)}</span>
      )}
    </span>
  )
}
