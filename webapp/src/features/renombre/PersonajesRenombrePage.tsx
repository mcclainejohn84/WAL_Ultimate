// ============================================================================
// PERSONAJES DE RENOMBRE: los que tienen nombre propio (Vlad von Carstein) en
// vez de ser "un Señor Vampiro" del montón.
//
// ESTA SECCIÓN YA NO ES DE EDICIÓN. Vive en la barra principal, junto a Hojas
// de Unidad, Ejércitos y Mapas, y la usa cualquiera: los personajes de renombre
// son comunes —se ven, se editan y se meten en un ejército sin modo
// administrador—. La única excepción es OCULTARLOS, que reserva un personaje
// para su autor (ver specialCharacterRepository).
//
// QUÉ SE EDITA AQUÍ Y QUÉ NO, que es lo que más despista al llegar. Un
// personaje de renombre ES una unidad (ver specialCharacterRepository), así que
// sus atributos, su equipo, sus monturas y su coste se tocan en la ficha de
// unidad de siempre, que sigue estando en "Editor". Esta pantalla se ocupa solo
// de lo que un personaje de renombre tiene y una unidad no: el retrato, el
// trasfondo y la experiencia.
//
// Se montó así a propósito, en vez de replicar aquí medio editor de unidades:
// serían dos sitios para editar lo mismo, y al primer cambio en uno el otro se
// quedaría corto.
// ============================================================================
import { useState } from 'react'
import { clsx } from 'clsx'
import { SpecialCharacterRepository, type PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { usePreferenciaLocal } from '@/shared/hooks/usePreferenciaLocal'
import { PageHeader } from '@/shared/ui/PageHeader'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useSession } from '@/shared/session/useSession'
import { useFaccionesPlegadas, useFiltroDeCampanas, useFiltroDeFacciones } from '@/features/renombre/filtroDeFacciones'
import { SIN_CAMPANA, eleccionVigente, pasaElFiltroDeCampanas } from '@/domain/campanas'
import { CampaignRepository } from '@/data/repositories/campaignRepository'
import { Modal } from '@/shared/ui/Modal'
import { SelectorMultiple } from '@/shared/ui/SelectorMultiple'
import { FiltroSegmentado } from '@/shared/ui/FiltroSegmentado'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import { AnvilIcon, ChevronDownIcon, PlusIcon, SwordIcon } from '@/shared/ui/icons'
import { useNavigate } from 'react-router-dom'
import { PersonajeRenombreCard } from '@/features/renombre/PersonajeRenombreCard'
import { GaleriaDeRenombre } from '@/features/renombre/avanzada/GaleriaDeRenombre'
import { MagicItemRepository, type ObjetoMagico } from '@/data/repositories/magicItemRepository'
import type { Faction } from '@/domain/types'
import type { UnitSummary } from '@/data/repositories/unitRepository'

/**
 * Cabecera de un grupo: emblema, nombre de la facción y una regla que llega
 * hasta el final.
 *
 * Sustituye al <Panel> que envolvía cada facción. El panel metía las láminas
 * dentro de otra caja con borde —caja dentro de caja— y obligaba a poner un
 * subtítulo debajo del nombre, que es donde vivía el "N con nombre propio" que
 * el usuario pidió quitar. Una regla horizontal separa igual de bien y deja
 * todo el ancho a las láminas, que es lo que se ha venido a ver.
 *
 * SE PLIEGA: la cabecera entera es el botón, con la flecha al final de la
 * regla. Plegada, la facción ocupa una línea y el número dice cuántos hay
 * dentro, así que no se pierde de vista lo que se ha escondido.
 */
function CabeceraDeFaccion({
  faccion,
  nombre,
  cuantos,
  plegada,
  onAlternar,
  controla,
}: {
  faccion?: Pick<Faction, 'name' | 'emblemUrl'>
  nombre: string
  cuantos: number
  plegada: boolean
  onAlternar: () => void
  /** Id de la lista que pliega, para aria-controls. */
  controla: string
}) {
  return (
    <h2 className={clsx(!plegada && 'mb-3')}>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={!plegada}
        aria-controls={controla}
        className="group flex w-full items-center gap-3 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-bronze/50 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment focus-visible:outline-none"
      >
        {faccion && <FactionEmblem faction={faccion} size="sm" />}
        <span className="font-display text-xl leading-none font-bold tracking-wide text-ink transition-colors group-hover:text-maroon">
          {nombre}
        </span>
        <span className="text-sm tabular-nums text-ink-soft/70">{cuantos}</span>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-rule-dark/50 to-transparent" />
        <ChevronDownIcon
          className={clsx(
            'h-4 w-4 shrink-0 text-ink-soft/60 transition-transform duration-200 group-hover:text-bronze',
            plegada && '-rotate-90',
          )}
        />
      </button>
    </h2>
  )
}

/** La clave de "Sin facción reconocible" entre las plegadas. Los ids de facción empiezan en 1. */
const SIN_FACCION = -1

/** Valor del filtro cuando no filtra nada. Es una cadena porque sale de un <select>. */

export function PersonajesRenombrePage() {
  const navegar = useNavigate()
  const { data: personajes, loading, reload } = useAsync(() => SpecialCharacterRepository.listAll())
  // Los objetos mágicos de TODOS de una vez (son de catálogo: lectura local,
  // sin red) y repartidos por portador, para que cada lámina enseñe los suyos.
  const { data: objetos, reload: recargarObjetos } = useAsync(() => MagicItemRepository.listAll())
  const objetosDe = new Map<number, ObjetoMagico[]>()
  for (const objeto of objetos ?? []) {
    if (objeto.unitId == null) continue
    const ya = objetosDe.get(objeto.unitId)
    if (ya) ya.push(objeto)
    else objetosDe.set(objeto.unitId, [objeto])
  }
  /** Desvincular un objeto cambia el objeto Y la experiencia del personaje. */
  // LAS CAMPAÑAS y en cuáles sale cada personaje (las dos de catálogo: lectura local).
  const { data: campanas, reload: recargarCampanas } = useAsync(async () => ({
    lista: await CampaignRepository.listAll(),
    porPersonaje: await CampaignRepository.campanasPorPersonaje(),
  }))
  function recargarTodo() {
    reload()
    recargarObjetos()
    recargarCampanas()
  }
  const { data: facciones } = useAsync(() => FactionRepository.listAll())
  const [creando, setCreando] = useState(false)
  // QUÉ FACCIONES se están mirando, y se acuerda de una visita a otra (ver
  // filtroDeFacciones). Vacío = todas.
  const { user: usuario } = useSession()
  const [faccionesElegidas, setFaccionesElegidas] = useFiltroDeFacciones(usuario?.id)
  // QUÉ CAMPAÑAS, igual: con memoria y vacío = todas. Se SUMA a los otros dos.
  const [campanasGuardadas, setCampanasElegidas] = useFiltroDeCampanas(usuario?.id)
  // Las facciones PLEGADAS en la vista clásica (ver CabeceraDeFaccion).
  const [plegadas, setPlegadas] = useFaccionesPlegadas(usuario?.id)
  function alternarPlegada(id: number) {
    const siguiente = new Set(plegadas)
    if (siguiente.has(id)) siguiente.delete(id)
    else siguiente.add(id)
    setPlegadas(siguiente)
  }
  // SOLO LOS MÍOS: se suma al de facciones, no lo sustituye (los tuyos de los
  // Hombres Bestia). Con memoria, como el de facciones: quien entra a llevar
  // los suyos entra siempre a lo mismo.
  const [soloMios, setSoloMios] = usePreferenciaLocal('renombre_solo_mios', usuario?.id, false)
  // LA VISTA: la avanzada (galería de retratos, y cada personaje en su ficha,
  // ver avanzada/) o la clásica (las láminas de siempre, donde se edita en el
  // sitio). Con memoria por usuario; de entrada, la avanzada.
  const [vistaAvanzada, setVistaAvanzada] = usePreferenciaLocal('renombre_vista_avanzada', usuario?.id, true)
  const [error, setError] = useState<string | null>(null)

  // LA RUEDA, SOLO LA PRIMERA VEZ. Con `if (loading)` a secas, cualquier
  // recarga posterior —y hay una cada vez que se toca una habilidad, una
  // cicatriz o una senda— vaciaba la pantalla entera y la dejaba en una rueda
  // durante el viaje a la red: las láminas desaparecían y, con ellas, el
  // diálogo que estaba abierto. Mientras ya haya personajes en pantalla se
  // siguen enseñando los de antes y lo nuevo entra cuando llega.
  if (loading && personajes == null) return <Spinner />

  const visibles = personajes ?? []
  const mios = usuario ? visibles.filter((p) => p.userId === usuario.id) : []
  const deAutor = soloMios ? mios : visibles
  // Una campaña borrada que siguiera guardada en el filtro no cuenta: si solo
  // quedaba esa, se ven todos en vez de una pantalla vacía sin motivo.
  const listaDeCampanas = campanas?.lista ?? []
  const campanasElegidas = eleccionVigente(
    campanasGuardadas,
    listaDeCampanas.map((c) => c.id),
  )
  const campanasDe = (p: PersonajeEspecial) => campanas?.porPersonaje.get(p.id) ?? []
  const todos =
    listaDeCampanas.length === 0
      ? deAutor
      : deAutor.filter((p) => pasaElFiltroDeCampanas(campanasDe(p), campanasElegidas))
  const filtraCampana = campanasElegidas.size > 0 && listaDeCampanas.length > 0
  // El filtro se aplica ANTES de agrupar, así que los grupos, los contadores y
  // el mensaje de "no hay ninguno" salen todos del mismo sitio y no pueden
  // contradecirse (un contador que suma los de todas las facciones sobre una
  // lista filtrada es el fallo clásico de esta pantalla).
  const lista = faccionesElegidas.size === 0 ? todos : todos.filter((p) => faccionesElegidas.has(p.factionId))
  // Agrupados por facción y en el orden en que vienen las facciones, no
  // alfabético: es el orden que el usuario ya conoce del resto del programa.
  const porFaccion = new Map<number, PersonajeEspecial[]>()
  for (const p of lista) {
    const grupo = porFaccion.get(p.factionId)
    if (grupo) grupo.push(p)
    else porFaccion.set(p.factionId, [p])
  }
  const ordenadas = (facciones ?? []).filter((f) => porFaccion.has(f.id))
  // Personajes cuya facción NO viene en el listado de facciones (desactivada,
  // borrada, o simplemente todavía cargando). Sin esto se quedaban fuera de la
  // pantalla SIN QUE NADA LO DIJERA: contaban para que no saliera el mensaje de
  // "no hay ninguno", pero no se pintaban en ningún grupo, así que no había
  // forma de llegar ni a su ficha para arreglarlos.
  const conocidas = new Set(ordenadas.map((f) => f.id))
  const huerfanos = lista.filter((p) => !conocidas.has(p.factionId))

  // En el desplegable solo las facciones que TIENEN personajes. Con las 22 del
  // catálogo, elegir una y encontrarse la pantalla vacía es lo más probable que
  // podría pasar, y el desplegable estaría diciendo que allí hay algo.
  const conPersonajes = new Set(todos.map((p) => p.factionId))
  const faccionesDelFiltro = (facciones ?? []).filter((f) => conPersonajes.has(f.id))

  return (
    <div>
      <PageHeader
        title="Personajes de Renombre"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* La experiencia de una batalla entera, para todos los que
                fueron, y la Forja: viven DENTRO de esta sección porque son de
                los personajes, y una entrada propia en el menú las alejaba de
                lo único a lo que sirven. */}
            <Button variant="secondary" onClick={() => navegar('/renombre/batalla')}>
              <SwordIcon className="h-4 w-4" />
              Experiencia de batalla
            </Button>
            <Button variant="secondary" onClick={() => navegar('/forja')}>
              <AnvilIcon />
              Forja de objetos
            </Button>
            <Button variant="primary" onClick={() => setCreando(true)}>
              <PlusIcon className="h-4 w-4" />
              Nuevo personaje
            </Button>
          </div>
        }
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {/* LA BARRA DE FILTROS: los dos controles se leen como uno, con su
          rótulo encima y alineados por abajo (ver FiltroSegmentado). El de
          autor se SUMA al de facciones: los tuyos, y además de esa facción. */}
      {(faccionesDelFiltro.length > 1 || usuario != null || visibles.length > 0) && (
        <div className="mb-5 flex flex-wrap items-end gap-x-3 gap-y-2">
          {faccionesDelFiltro.length > 1 && (
            <SelectorMultiple
              className="w-60"
              label="Facciones"
              textoDeTodas={`Todas las facciones (${todos.length})`}
              opciones={faccionesDelFiltro.map((f) => ({
                id: f.id,
                nombre: f.name,
                cuantos: todos.filter((p) => p.factionId === f.id).length,
              }))}
              elegidas={faccionesElegidas}
              onChange={setFaccionesElegidas}
            />
          )}
          {listaDeCampanas.length > 0 && (
            <SelectorMultiple
              className="w-56"
              label="Campañas"
              textoDeTodas="Todas las campañas"
              opciones={[
                ...listaDeCampanas.map((c) => ({
                  id: c.id,
                  nombre: c.nombre,
                  cuantos: deAutor.filter((p) => campanasDe(p).includes(c.id)).length,
                })),
                {
                  id: SIN_CAMPANA,
                  nombre: 'Sin campaña',
                  cuantos: deAutor.filter((p) => campanasDe(p).length === 0).length,
                },
              ]}
              elegidas={campanasElegidas}
              onChange={setCampanasElegidas}
            />
          )}
          {usuario != null && (
            <FiltroSegmentado
              label="Autor"
              valor={soloMios ? 'mios' : 'todos'}
              onChange={(valor) => setSoloMios(valor === 'mios')}
              opciones={[
                { valor: 'todos', etiqueta: 'Todos', cuantos: visibles.length },
                { valor: 'mios', etiqueta: 'Mis personajes', cuantos: mios.length },
              ]}
            />
          )}
          {/* El cambio de vista va aparte, a la derecha: no filtra, cambia cómo se mira. */}
          <FiltroSegmentado
            className="ml-auto"
            label="Vista"
            valor={vistaAvanzada ? 'avanzada' : 'clasica'}
            onChange={(valor) => setVistaAvanzada(valor === 'avanzada')}
            opciones={[
              { valor: 'clasica', etiqueta: 'Clásica' },
              { valor: 'avanzada', etiqueta: 'Avanzada' },
            ]}
          />
        </div>
      )}

      {lista.length === 0 ? (
        <EmptyState
          title={
            filtraCampana
              ? 'Ninguno en esas campañas'
              : soloMios
                ? 'No tienes ninguno'
                : faccionesElegidas.size === 0
                  ? 'Todavía no hay ninguno'
                  : 'Ninguno en esas facciones'
          }
          description={
            filtraCampana
              ? undefined
              : faccionesElegidas.size === 0
                ? 'Elige un personaje de una facción y se copiará entero para darle nombre e historia.'
                : 'Prueba con otra facción, o quita el filtro para verlos todos.'
          }
          action={
            filtraCampana ? (
              <Button variant="secondary" onClick={() => setCampanasElegidas(new Set())}>
                Ver todas las campañas
              </Button>
            ) : faccionesElegidas.size === 0 ? (
              <Button variant="primary" onClick={() => setCreando(true)}>
                <PlusIcon className="h-4 w-4" />
                Nuevo personaje
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setFaccionesElegidas(new Set())}>
                Ver todas las facciones
              </Button>
            )
          }
        />
      ) : vistaAvanzada ? (
        <GaleriaDeRenombre personajes={lista} facciones={facciones ?? []} />
      ) : (
        <div className="space-y-8">
          {ordenadas.map((faccion) => (
            <section key={faccion.id}>
              <CabeceraDeFaccion
                faccion={faccion}
                nombre={faccion.name}
                cuantos={porFaccion.get(faccion.id)?.length ?? 0}
                plegada={plegadas.has(faccion.id)}
                onAlternar={() => alternarPlegada(faccion.id)}
                controla={`renombre-faccion-${faccion.id}`}
              />
              {/* Una lámina por fila. El contenido de la aplicación va en una
                  columna de 896 px (ver AppShell), así que partirla en dos
                  dejaría el retrato de 160 px con una columna de texto de cuatro
                  palabras de ancho. */}
              <ul id={`renombre-faccion-${faccion.id}`} hidden={plegadas.has(faccion.id)} className="space-y-4">
                {(porFaccion.get(faccion.id) ?? []).map((p) => (
                  <li key={p.id}>
                    <PersonajeRenombreCard personaje={p} objetos={objetosDe.get(p.id) ?? []} onCambio={recargarTodo} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {huerfanos.length > 0 && (
            <section>
              <CabeceraDeFaccion
                nombre="Sin facción reconocible"
                cuantos={huerfanos.length}
                plegada={plegadas.has(SIN_FACCION)}
                onAlternar={() => alternarPlegada(SIN_FACCION)}
                controla="renombre-faccion-ninguna"
              />
              <div id="renombre-faccion-ninguna" hidden={plegadas.has(SIN_FACCION)}>
                <p className="mb-3 text-xs text-ink-soft">
                  Su facción no aparece en el listado: puede estar desactivada o haberse borrado.
                </p>
                <ul className="space-y-4">
                  {huerfanos.map((p) => (
                    <li key={p.id}>
                      <PersonajeRenombreCard
                        personaje={p}
                        objetos={objetosDe.get(p.id) ?? []}
                        onCambio={recargarTodo}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      )}

      {creando && (
        <CrearPersonajeModal
          onClose={() => setCreando(false)}
          onCreado={() => {
            setCreando(false)
            reload()
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

/**
 * Alta: facción → personaje del que se copia → nombre.
 *
 * El personaje base es OBLIGATORIO y no hay forma de crear uno en blanco. Es
 * deliberado: un personaje de renombre sin perfil, sin equipo y sin coste no
 * sirve para nada y habría que rellenárselo todo a mano; partiendo de un
 * genérico se empieza con algo jugable y solo se retoca lo que cambie.
 */
function CrearPersonajeModal({
  onClose,
  onCreado,
  onError,
}: {
  onClose: () => void
  onCreado: () => void
  onError: (mensaje: string | null) => void
}) {
  const { data: facciones } = useAsync(() => FactionRepository.listAll())
  const [factionId, setFactionId] = useState<number | null>(null)
  const { data: bases, loading: cargandoBases } = useAsync(
    () => (factionId ? SpecialCharacterRepository.listPersonajesBase(factionId) : Promise.resolve([] as UnitSummary[])),
    [factionId],
  )
  const [baseId, setBaseId] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const puedeGuardar = baseId != null && nombre.trim().length > 0 && !guardando

  async function guardar() {
    if (baseId == null) return
    setGuardando(true)
    onError(null)
    try {
      await SpecialCharacterRepository.crearDesdePersonaje(baseId, nombre)
      onCreado()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      title="Nuevo Personaje de Renombre"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={!puedeGuardar}>
            {guardando ? 'Copiando…' : 'Crear'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select
          label="Facción"
          value={factionId ?? ''}
          onChange={(e) => {
            setFactionId(e.target.value ? Number(e.target.value) : null)
            setBaseId(null)
          }}
        >
          <option value="">Elige una facción…</option>
          {(facciones ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>

        <Select
          label="Copiar de"
          value={baseId ?? ''}
          disabled={!factionId || cargandoBases}
          onChange={(e) => setBaseId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{cargandoBases ? 'Cargando…' : 'Elige un personaje…'}</option>
          {(bases ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.baseCost} pts
            </option>
          ))}
        </Select>

        <TextField
          label="Nombre del personaje"
          placeholder="Vlad von Carstein"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        {factionId != null && (bases ?? []).length === 0 && !cargandoBases && (
          <p className="text-xs text-ink-soft">
            Esa facción todavía no tiene personajes de los que copiar. Créalo primero en Editor &gt; Unidades.
          </p>
        )}

        <p className="text-mini leading-relaxed text-ink-soft/80">
          Se copia todo: perfil, reglas, equipo, opciones, monturas con su coste, grupo de mando y, si es hechicero, sus
          sendas. La copia es independiente — retocarle los atributos no toca al personaje del que salió.
        </p>
      </div>
    </Modal>
  )
}
