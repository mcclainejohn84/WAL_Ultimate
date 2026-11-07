import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { ArmyListRepository, type ArmyListSummary } from '@/data/repositories/armyListRepository'
import { BattleRepository } from '@/data/repositories/battleRepository'
import { ensureArmyListsOwned } from '@/data/repositories/catalogMaintenance'
import { mensajeDeMigracionPendiente } from '@/data/repositories/schemaHealth'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { useVisibleFactions } from '@/shared/session/useVisibleFactions'
import { useFavoriteFactionId } from '@/shared/session/useFavoriteFactionId'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CheckIcon, LayersIcon, LockIcon, PlusIcon, SwordIcon, TrashIcon } from '@/shared/ui/icons'
import { Tooltip } from '@/shared/ui/Tooltip'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import { urlDelEmblemaDeLista } from '@/domain/armyEmblem'
import { ArmyListFormModal } from '@/features/army-lists/ArmyListFormModal'
import { CompositionRulesModal } from '@/features/army-lists/CompositionRulesModal'
import { ShareArmyListModal } from '@/features/army-lists/ShareArmyListModal'

/** Qué ejércitos se enseñan. Por defecto, todos. */
type FiltroDeEstado = 'todos' | 'completados' | 'pendientes'

// EN ORDEN DE TRABAJO, NO DE AMPLITUD: primero lo que queda por hacer, luego lo
// terminado, y "Todos" al final. Es el orden en que se mira —se entra a seguir
// con lo de en medio— y además el primero es el que viene puesto de entrada,
// así que el filtro activo cae donde empieza la vista.
const FILTROS: { clave: FiltroDeEstado; etiqueta: string }[] = [
  { clave: 'pendientes', etiqueta: 'Sin completar' },
  { clave: 'completados', etiqueta: 'Completados' },
  { clave: 'todos', etiqueta: 'Todos' },
]

/**
 * El filtro de estado: tres palabras y un filete, sin caja ni fondo.
 *
 * Discreto a propósito. Un ejército está completado o no lo está; es un dato
 * de una sola letra y no merece un control con presencia. Lo que sí merece es
 * llevar el RECUENTO al lado de cada opción: así el filtro informa aunque no
 * se toque —cuántas llevas cerradas y cuántas te quedan— en vez de ser tres
 * botones mudos.
 */
function FiltroDeEstadoSelector({
  valor,
  onChange,
  recuentos,
}: {
  valor: FiltroDeEstado
  onChange: (v: FiltroDeEstado) => void
  recuentos: Record<FiltroDeEstado, number>
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span aria-hidden className="h-px flex-1 bg-rule-dark/20" />
      <div role="group" aria-label="Filtrar por estado" className="flex items-center gap-0.5">
        {FILTROS.map((f, i) => (
          <span key={f.clave} className="flex items-center">
            {i > 0 && <span aria-hidden className="mx-1 h-3 w-px bg-rule-dark/25" />}
            <button
              type="button"
              aria-pressed={valor === f.clave}
              onClick={() => onChange(f.clave)}
              className={clsx(
                'rounded-sm px-1.5 py-0.5 text-mini transition-colors',
                valor === f.clave ? 'font-semibold text-maroon' : 'text-ink-soft/70 hover:bg-bronze/10 hover:text-ink',
              )}
            >
              {f.etiqueta}
              <span className={clsx('ml-1 tabular-nums', valor === f.clave ? 'text-maroon/70' : 'text-ink-soft/45')}>
                {recuentos[f.clave]}
              </span>
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * LA MARCA DEL DESPLIEGUE: cuántas unidades están ya puestas sobre la mesa.
 *
 * Pequeña a propósito —un icono y dos cifras—, porque es un dato de apoyo y no
 * el estado de la lista. Pero hace falta aquí y no solo dentro del Despliegue:
 * dar una lista por completada CIERRA también su despliegue, así que esto es lo
 * que avisa, antes de pulsar, de que la mesa está a medio poner.
 *
 * Tres lecturas de un vistazo por el color: apagado si no hay nada colocado,
 * bronce si va a medias, y marcado cuando está entero. En una lista sin
 * unidades no sale: no hay nada que desplegar y una marca en gris solo
 * preguntaría por algo que no existe.
 *
 * Y EN UNA LISTA AJENA NO SALE SALVO QUE TE HAYAN COMPARTIDO EL DESPLIEGUE.
 * Compartir la lista y compartir el despliegue son dos casillas distintas
 * porque son dos cosas distintas: la lista es con qué juega, el despliegue es
 * dónde lo pone, y eso es media partida. El dato ni siquiera llega desde la
 * base (ver deploymentVisible), así que esto es el segundo cierre, no el
 * único.
 */
function MarcaDeDespliegue({ list }: { list: ArmyListSummary }) {
  if (list.entryCount === 0 || !list.deploymentVisible) return null
  const completo = list.deployedCount >= list.entryCount
  const vacio = list.deployedCount === 0
  return (
    <Tooltip
      label={
        vacio
          ? 'Despliegue sin empezar: ninguna unidad colocada sobre la mesa'
          : completo
            ? `Despliegue hecho: las ${list.entryCount} unidades están colocadas`
            : `Despliegue a medias: ${list.deployedCount} de ${list.entryCount} unidades colocadas`
      }
      className={clsx(
        'flex w-12 shrink-0 items-center justify-end gap-1 text-mini tabular-nums',
        vacio ? 'text-ink-soft/35' : completo ? 'text-success' : 'text-bronze',
      )}
    >
      <LayersIcon className="h-3.5 w-3.5" />
      {list.deployedCount}/{list.entryCount}
    </Tooltip>
  )
}

/**
 * "Mis ejércitos": listado de listas guardadas, con crear/renombrar/borrar y
 * abrir en el constructor. Sustituye al antiguo guardado/cargado como
 * fichero .json del "Hoja de Ejército" original — aquí todo vive en la BBDD
 * del navegador, igual que el resto de la app (ver ARCHITECTURE.md).
 */
export function ArmyListsPage() {
  const navigate = useNavigate()
  const { user } = useSession()
  const {
    data: lists,
    loading,
    error,
    reload,
  } = useAsync(async () => {
    if (!user) return []
    // Los ejércitos anteriores a los usuarios se asignan al usuario "admin".
    // Se hace aquí además de al arrancar porque ese usuario puede haberse
    // creado DESPUÉS del arranque, y este es el momento en que de verdad
    // importa que estén asignados.
    await ensureArmyListsOwned().catch(() => undefined)
    return ArmyListRepository.listAll(user.id)
  }, [user?.id])
  // Solo las facciones que el usuario quiere ver (en modo admin, todas).
  const { factions } = useVisibleFactions()
  const favoriteFactionId = useFavoriteFactionId()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ArmyListSummary | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null)
  const [editingComposition, setEditingComposition] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [sharing, setSharing] = useState<ArmyListSummary | null>(null)
  /** Lista compartida que se está dejando de ver (confirmación abierta). */
  const [descompartiendo, setDescompartiendo] = useState<ArmyListSummary | null>(null)
  /** Lista que se va a dar por completada SIN el despliegue hecho (ver `pedirCompletar`). */
  const [completandoSinDesplegar, setCompletandoSinDesplegar] = useState<ArmyListSummary | null>(null)
  const [cerrandoId, setCerrandoId] = useState<number | null>(null)
  // Qué listas están metidas en alguna batalla. No se pueden reabrir (lo impide
  // ArmyListRepository.setReady); esto es solo para poder DECIRLO antes, en vez
  // de dejar que el usuario pulse el sello y se coma un error.
  const { data: enBatalla } = useAsync(() => BattleRepository.idsDeListasEnBatalla(), [])
  const [readyError, setReadyError] = useState<string | null>(null)
  // SE ENTRA POR "SIN COMPLETAR". Un ejército terminado está terminado: lo que
  // se viene a hacer aquí es seguir con el que está a medias. Los completados
  // siguen a un clic, y el recuento al lado de cada filtro dice cuántos hay sin
  // tener que ir a mirar.
  const [filtro, setFiltro] = useState<FiltroDeEstado>('pendientes')

  /**
   * Marca o desmarca una lista como TERMINADA. Cerrada, el constructor se abre
   * en solo lectura.
   *
   * Se puede abrir y cerrar las veces que haga falta: no es un permiso ni un
   * camino de ida, es el pestillo que evita el manotazo sobre una lista dada por
   * buena. Por eso el interruptor está aquí, a la vista en el listado, y no
   * escondido dentro de un menú de la propia lista.
   */
  async function alternarListo(list: ArmyListSummary, ready: boolean) {
    setCerrandoId(list.id)
    setReadyError(null)
    try {
      await ArmyListRepository.setReady(list.id, ready)
      reload()
    } catch (err) {
      // Si lo que falla es que la columna no existe todavía, se dice qué hacer
      // en vez de soltar el error crudo de D1, que es exacto y no sirve de nada.
      setReadyError(mensajeDeMigracionPendiente(err) ?? (err instanceof Error ? err.message : String(err)))
    } finally {
      setCerrandoId(null)
    }
  }

  /**
   * COMPLETAR PIDE CONFIRMACIÓN SI EL DESPLIEGUE ESTÁ A MEDIAS.
   *
   * Dar una lista por completada cierra también su despliegue (ver setReady),
   * así que cerrarla con la mesa a medio poner deja un trabajo que ya no se
   * puede terminar sin reabrirla — y si además entra en una batalla, ni eso.
   * El aviso dice cuántas faltan y deja seguir: hay listas que no se despliegan.
   *
   * Solo al MARCAR. Desmarcar no cierra nada y no necesita permiso de nadie.
   */
  function pedirCompletar(list: ArmyListSummary) {
    if (list.entryCount > 0 && list.deployedCount < list.entryCount) {
      setCompletandoSinDesplegar(list)
      return
    }
    void alternarListo(list, true)
  }

  /**
   * Copia una lista con todas sus entradas y se queda en el listado (no abre
   * la copia): duplicar suele ser el paso previo a comparar variantes, y
   * saltar a una de ellas te sacaría de la vista donde estás decidiendo.
   *
   * El nombre lleva un contador —"(copia)", "(copia 2)"…— para no acabar con
   * tres listas llamadas igual, que es exactamente el lío que esta función
   * pretende evitar.
   */
  async function handleDuplicate(list: ArmyListSummary) {
    if (!user) return
    setDuplicatingId(list.id)
    setDuplicateError(null)
    try {
      const existing = new Set((lists ?? []).map((l) => l.name))
      let name = `${list.name} (copia)`
      for (let n = 2; existing.has(name); n++) name = `${list.name} (copia ${n})`
      await ArmyListRepository.duplicate(list.id, name, user.id)
      // `reload()` solo pide la recarga (devuelve void, no espera al fetch),
      // así que la copia aparece en el listado un instante después de que el
      // botón deje de decir "Copiando…". Es un parpadeo, no un fallo.
      reload()
    } catch (err) {
      setDuplicateError(err instanceof Error ? err.message : String(err))
    } finally {
      setDuplicatingId(null)
    }
  }

  const todas = lists ?? []
  const recuentos: Record<FiltroDeEstado, number> = {
    todos: todas.length,
    completados: todas.filter((l) => l.ready).length,
    pendientes: todas.filter((l) => !l.ready).length,
  }
  const visibles = filtro === 'todos' ? todas : todas.filter((l) => (filtro === 'completados' ? l.ready : !l.ready))

  return (
    <div>
      <PageHeader
        title="Ejércitos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Configuración COMÚN a todos los ejércitos, de ahí que viva en el
                listado y no dentro de una lista concreta. */}
            <Button variant="secondary" onClick={() => setEditingComposition(true)}>
              Selección de puntos
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" />
              Nueva lista
            </Button>
          </div>
        }
      />

      {loading && <Spinner />}
      {error && <p className="text-sm text-danger">{error}</p>}
      {duplicateError && <p className="mb-3 text-sm text-danger">No se pudo duplicar la lista: {duplicateError}</p>}
      {readyError && (
        <p className="mb-3 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-ink">
          <b className="text-danger">No se pudo cambiar el estado de la lista.</b> {readyError}
        </p>
      )}

      {!loading && todas.length === 0 && (
        <EmptyState
          title="Todavía no tienes ninguna lista"
          description='Crea la primera con "+ Nueva lista".'
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" />
              Nueva lista
            </Button>
          }
        />
      )}

      {/* El filtro aparece EN CUANTO HAY UN EJÉRCITO, aunque sea uno solo.
          Antes hacían falta dos, con el argumento de que elegir entre una lista
          y ella misma es ruido — y era verdad mientras se entraba por "Todos".
          Ahora se entra por "Sin completar", así que con un único ejército ya
          terminado el listado saldría vacío y sin ningún mando a la vista para
          deshacerlo: la pantalla diría que no tienes nada teniéndolo. */}
      {!loading && todas.length > 0 && (
        <FiltroDeEstadoSelector valor={filtro} onChange={setFiltro} recuentos={recuentos} />
      )}

      {!loading && todas.length > 0 && visibles.length === 0 && (
        <p className="rounded-sm border border-rule-dark/30 bg-parchment/60 px-4 py-6 text-center text-sm text-ink-soft">
          {filtro === 'completados'
            ? 'Ninguno de tus ejércitos está marcado como completado todavía.'
            : 'Todos tus ejércitos están completados.'}
        </p>
      )}

      {!loading && visibles.length > 0 && (
        <div className="divide-y divide-rule-dark/20 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
          {visibles.map((list) => (
            <div
              key={list.id}
              className={clsx(
                // DOS LÍNEAS EN EL MÓVIL. En una sola caben el emblema, el
                // nombre, el sello de 8rem y tres acciones: en un teléfono eso
                // deja al nombre —lo único que de verdad se lee— en una columna
                // de cuatro centímetros donde todo se parte. Envuelto, el
                // ejército ocupa la primera línea entero y los mandos bajan a la
                // segunda; `sm:flex-nowrap` devuelve la fila única en cuanto hay
                // sitio, así que en el ordenador no cambia nada.
                'group flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors sm:flex-nowrap sm:px-4',
                list.ready && !list.shared && 'bg-maroon/[0.04]',
              )}
            >
              {/* El emblema de ESTE ejército —el de su facción salvo que se le
                  haya puesto otro—, en el mismo recuadro cuadrado de siempre. */}
              <FactionEmblem
                faction={{
                  name: list.factionName,
                  emblemUrl: urlDelEmblemaDeLista(list, factions ?? []),
                }}
                size="sm"
              />
              {/* UN <div> Y NO UN <button>, aunque se pulse igual. Dentro va el
                  candado, que ES un botón: un botón dentro de otro es HTML
                  inválido y el navegador lo desmonta por su cuenta, dejando el
                  de dentro sin pulsar. Con `role` y `tabIndex` esto sigue
                  siendo pulsable con el teclado y anunciándose como lo que es. */}
              <div
                role="button"
                tabIndex={0}
                className="min-w-0 flex-1 basis-0 cursor-pointer text-left"
                onClick={() => navigate(`/ejercitos/${list.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/ejercitos/${list.id}`)
                  }
                }}
              >
                <p className="flex items-center gap-1.5 font-display text-lg font-semibold text-maroon">
                  {list.name}
                  {/* EL CANDADO ES EL BOTÓN DE DEJAR DE VERLA.
                      Sigue diciendo lo de siempre —que la lista es de otro y
                      aquí solo se mira—, que es para lo que hay que poder
                      distinguirlas de un vistazo antes de entrar. Pero además
                      se pulsa, y esa es ahora la forma de quitársela de encima:
                      antes había un "Dejar de ver" escrito al final de la fila,
                      y era una palabra de más en un sitio donde ya hay tres.
                      Lo que abre es una pregunta, no un borrado: ver más abajo. */}
                  {list.shared && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDescompartiendo(list)
                      }}
                      aria-label={`Dejar de ver ${list.name}`}
                      title="Compartida contigo: solo lectura. Pulsa para dejar de verla."
                      className="inline-flex text-ink-soft transition-colors hover:text-maroon"
                    >
                      <LockIcon className="h-4 w-4" />
                    </button>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {list.factionName} · {list.entryCount} {list.entryCount === 1 ? 'entrada' : 'entradas'}
                  {list.pointsLimit != null && <> · límite {list.pointsLimit} pts</>}
                  {list.shared && list.ownerName && <> · de {list.ownerName}</>}
                </p>
              </div>
              {/* EL SELLO. Va al final de la fila y no pegado al nombre: los
                  nombres miden lo que miden, así que ahí el sello bailaría de una
                  fila a otra; al final forman una columna y el estado del montón
                  se lee de arriba abajo de una pasada.

                  Y va SIEMPRE visible, no escondido tras el hover como duplicar
                  o borrar: aquello son acciones de mantenimiento y esto es el
                  estado de la lista. Es el mismo gesto tipográfico que los
                  rótulos del Despliegue —versalita espaciada— porque es lo que en
                  este programa significa "esto es una etiqueta, no un botón
                  más". En una lista compartida no sale: cerrar la de otro no es
                  cosa tuya. */}
              {/* SELLO Y ACCIONES VAN EN UN BLOQUE PROPIO. Así, cuando la fila
                  se parte en el móvil, bajan los dos juntos a la segunda línea
                  y quedan alineados a la derecha en vez de repartirse a medias
                  entre las dos. En el ordenador el bloque es `w-auto` y la fila
                  vuelve a leerse de un tirón.

                  DENTRO DEL BLOQUE VA PRIMERO LO QUE SE HACE Y DESPUÉS LO QUE
                  SE MIRA: compartir, duplicar y borrar por dentro, y el
                  despliegue y el sello pegados al borde derecho. Al revés, que
                  es como estaba, el estado se quedaba flotando a media fila con
                  un hueco a su derecha — porque esos tres botones ocupan su
                  sitio aunque no se vean: son `opacity-0`, no `display:none`.
                  Cada uno de los dos lleva ancho fijo, así que de una fila a
                  otra forman dos columnas que se leen de arriba abajo. */}
              {!list.shared && (
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
                  {/* Duplicar, compartir y borrar son cosa del dueño. En una lista
                    compartida contigo no salen: no es que fallen, es que no
                    existen.

                    APARECEN AL PASAR EL RATÓN SOLO DONDE HAY RATÓN. Estaban en
                    `opacity-0` con `group-hover`, y en Tailwind v4 `hover:` ya
                    va dentro de `@media (hover: hover)`: en un teléfono ese
                    hover no ocurre NUNCA, así que los tres botones se quedaban
                    invisibles para siempre. Compartir, duplicar y borrar un
                    ejército sencillamente no existían desde el móvil. Ahora se
                    ven de partida y solo se esconden donde hay un cursor con el
                    que sacarlos. */}
                  <div className="flex shrink-0 items-center gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                    <button
                      className="rounded-sm px-2 py-0.5 text-mini font-medium text-ink-soft hover:bg-bronze/10 hover:text-bronze"
                      onClick={() => setSharing(list)}
                      aria-label={`Compartir ${list.name}`}
                      title="Compartir esta lista con otros usuarios"
                    >
                      Compartir
                    </button>
                    <button
                      className="rounded-sm px-2 py-0.5 text-mini font-medium text-ink-soft hover:bg-bronze/10 hover:text-bronze disabled:cursor-wait disabled:opacity-50"
                      onClick={() => handleDuplicate(list)}
                      disabled={duplicatingId === list.id}
                      aria-label={`Duplicar ${list.name}`}
                      title="Duplicar esta lista"
                    >
                      {duplicatingId === list.id ? 'Copiando…' : 'Duplicar'}
                    </button>
                    <button
                      className="rounded-sm px-1.5 py-0.5 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                      onClick={() => setDeleting(list)}
                      aria-label={`Borrar ${list.name}`}
                      title="Borrar"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <MarcaDeDespliegue list={list} />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={list.ready}
                    disabled={cerrandoId === list.id || (enBatalla?.has(list.id) ?? false)}
                    onClick={() => (list.ready ? void alternarListo(list, false) : pedirCompletar(list))}
                    title={
                      enBatalla?.has(list.id)
                        ? 'Está en una batalla, así que no se puede reabrir: lo que la batalla enseña no puede cambiar. Borra la batalla o cámbiale el ejército.'
                        : list.ready
                          ? 'Completada: la lista y su despliegue se abren en solo lectura. Pulsa para volver a editarlos.'
                          : 'Márcala cuando esté completada: se cerrará a cambios —la lista y su despliegue— hasta que la desmarques.'
                    }
                    className={clsx(
                      // Ancho FIJO: sin fijarlo los sellos quedaban escalonados de
                      // una fila a otra en vez de formar columna, que es justo lo
                      // que se venía a arreglar.
                      'flex w-32 shrink-0 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors disabled:opacity-50',
                      enBatalla?.has(list.id)
                        ? 'border border-maroon bg-maroon/20 text-maroon'
                        : list.ready
                          ? 'border border-maroon/45 bg-maroon/10 text-maroon hover:bg-maroon/15'
                          : 'border border-dashed border-rule-dark/35 text-ink-soft/45 hover:border-bronze/60 hover:text-bronze',
                    )}
                  >
                    {/* EL MISMO RÓTULO EN LOS DOS ESTADOS. Un interruptor no se
                      cambia de nombre según esté encendido o apagado: lo que
                      dice es de QUÉ trata, y si está puesto o no lo dicen el
                      sello frente al contorno de trazos, el candado frente al
                      visto, y `aria-checked` para quien no ve ninguno de los
                      dos. */}
                    {/* TRES ESTADOS, no dos. Un ejército metido en una batalla
                        está completado Y ADEMÁS atado: no se puede reabrir
                        mientras la batalla exista, y un sello que decía
                        "Completado" no explicaba por qué el botón no respondía.
                        Ahora lo dice él.

                        En los FILTROS sigue contando como completado, porque lo
                        está: separarlo en una pestaña propia obligaría a mirar
                        en dos sitios para ver lo que ya está listo. */}
                    {enBatalla?.has(list.id) ? (
                      <>
                        <SwordIcon className="h-3 w-3" />
                        En batalla
                      </>
                    ) : (
                      <>
                        {list.ready ? <LockIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}
                        Completado
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* LO QUE SE VE EN UNA LISTA QUE TE HAN COMPARTIDO.
                  Dos cosas, y ninguna de las dos la tenía antes.

                  EL SELLO, SOLO DE LECTURA. Si su dueño la dio por completada,
                  aquí se dice. Antes el sello no se pintaba en las compartidas
                  —con el argumento de que cerrar la lista de otro no es cosa
                  tuya, que sigue siendo cierto—, pero de ahí no se sigue que no
                  puedas SABERLO: el filtro "Completados" ya las contaba y no
                  había forma de ver cuáles eran. Es un <span>, no un botón: se
                  lee y no se toca.

                  DEJAR DE VER. Compartir lo decide uno y la bandeja la sufre el
                  otro. Sin esto, el ejército que te mandaron para una partida de
                  hace tres meses se queda en tu listado para siempre y el único
                  que puede quitarlo de ahí es alguien que ni lo ve. */}
              {/* LA CONDICIÓN ES "¿VA A HABER ALGO AQUÍ DENTRO?", y hay que
                  preguntarla fuera: un <div> vacío se lleva, en el móvil, una
                  segunda línea entera de la fila para no enseñar nada. Dentro
                  solo pueden ir dos cosas, y las dos pueden faltar: la marca
                  del despliegue —que necesita unidades Y que te hayan
                  compartido el despliegue— y el sello, que necesita que su
                  dueño la haya dado por completada. */}
              {list.shared && ((list.entryCount > 0 && list.deploymentVisible) || list.ready) && (
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
                  <MarcaDeDespliegue list={list} />
                  {list.ready && enBatalla?.has(list.id) && (
                    <span
                      title="Está metida en una batalla"
                      className="flex w-32 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-maroon/50 bg-maroon/10 px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-maroon/80 uppercase"
                    >
                      <SwordIcon className="h-3 w-3" />
                      En batalla
                    </span>
                  )}
                  {list.ready && !enBatalla?.has(list.id) && (
                    <span
                      title={`${list.ownerName ?? 'Su dueño'} la ha dado por completada`}
                      className="flex w-32 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-maroon/30 bg-maroon/5 px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-maroon/70 uppercase"
                    >
                      <LockIcon className="h-3 w-3" />
                      Completado
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <ArmyListFormModal
          factions={factions ?? []}
          defaultFactionId={
            favoriteFactionId != null && (factions ?? []).some((f) => f.id === favoriteFactionId)
              ? favoriteFactionId
              : undefined
          }
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            if (!user) return
            const id = await ArmyListRepository.create({ ...input, userId: user.id })
            setCreating(false)
            navigate(`/ejercitos/${id}`)
          }}
        />
      )}

      {sharing && user && (
        <ShareArmyListModal
          armyListId={sharing.id}
          listName={sharing.name}
          ownerId={user.id}
          onClose={() => setSharing(null)}
          onSaved={() => setSharing(null)}
        />
      )}

      {editingComposition && <CompositionRulesModal onClose={() => setEditingComposition(false)} />}

      {/* Se confirma, pero SIN el tono de lo irreversible: no se borra nada de
          nadie, solo se quita de tu listado, y su dueño puede volver a
          enviártela. De ahí "Dejar de ver" y no "Borrar", y el botón normal en
          vez del rojo. */}
      {descompartiendo && user && (
        <ConfirmDialog
          title="¿Dejar de ver este ejército?"
          message={`"${descompartiendo.name}" desaparecerá de tu listado. No se borra: sigue siendo de ${descompartiendo.ownerName ?? 'su dueño'}, y puede volver a compartírtelo cuando quiera.`}
          confirmLabel="Sí"
          cancelLabel="No"
          danger={false}
          onCancel={() => setDescompartiendo(null)}
          onConfirm={async () => {
            await ArmyListRepository.dejarDeVerCompartida(descompartiendo.id, user.id)
            setDescompartiendo(null)
            reload()
          }}
        />
      )}

      {completandoSinDesplegar && (
        <ConfirmDialog
          title="El despliegue no está hecho"
          message={
            completandoSinDesplegar.deployedCount === 0
              ? `"${completandoSinDesplegar.name}" no tiene ninguna unidad colocada sobre la mesa. Al darla por completada se cierra también su despliegue, así que no podrás colocarlas sin volver a abrirla. ¿La completas igualmente?`
              : `"${completandoSinDesplegar.name}" tiene ${completandoSinDesplegar.deployedCount} de ${completandoSinDesplegar.entryCount} unidades colocadas sobre la mesa. Al darla por completada se cierra también su despliegue, así que las que faltan se quedan fuera. ¿La completas igualmente?`
          }
          confirmLabel="Sí, completarla"
          danger={false}
          onCancel={() => setCompletandoSinDesplegar(null)}
          onConfirm={async () => {
            const lista = completandoSinDesplegar
            setCompletandoSinDesplegar(null)
            await alternarListo(lista, true)
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Borrar lista"
          message={`Se borrará "${deleting.name}" con todas sus entradas. Esta acción no se puede deshacer.`}
          confirmLabel="Borrar definitivamente"
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await ArmyListRepository.remove(deleting.id)
            setDeleting(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
