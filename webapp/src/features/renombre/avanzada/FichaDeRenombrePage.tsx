// ============================================================================
// VISTA AVANZADA de Personajes de Renombre: la FICHA de un personaje.
//
// Todo el personaje en una página, para LEERLO de un vistazo: quién es, de
// dónde viene, su perfil y lo que monta, sus reglas, lo que ha aprendido, lo
// que ha perdido, su magia y los objetos que lleva. Aquí no se edita nada: los
// botones de la cabecera abren las mismas ventanas que en la vista clásica, y
// es ahí donde se cambia cada cosa.
//
// LA PÁGINA ESTÁ COMPUESTA COMO UN EXPEDIENTE. Arriba, la cabecera: el retrato
// grande con su marco, el nombre, la facción, el coste y la experiencia, y la
// barra de acciones debajo, que es lo único que se toca. Después, a lo ancho,
// lo que se lee de corrido (el trasfondo) y lo que se consulta en la mesa (el
// perfil y las reglas). Y al final, en dos columnas, las cuatro cosas que
// hacen único a un personaje de renombre: habilidades, cicatrices, magia y
// objetos. Cada lista dice cuántas tiene y despliega lo que hace cada cosa
// con su "i": a primera vista solo nombres, que es lo que se viene a buscar.
//
// SE ANIMA LA ENTRADA, escalonada por bloques, por la misma razón que la
// galería (ver GaleriaDeRenombre): es una pantalla para mirar.
//
// LO QUE NO SE VE: si el personaje está oculto y es de otro, o no existe, la
// ficha no lo enseña — es la misma regla que el listado (ver esVisiblePara),
// que ya lo deja fuera al cargarlo.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  EXPERIENCIA_MAXIMA,
  SpecialCharacterRepository,
  type PersonajeEspecial,
} from '@/data/repositories/specialCharacterRepository'
import { UnitRepository } from '@/data/repositories/unitRepository'
import { CharacterSkillRepository } from '@/data/repositories/characterSkillRepository'
import { MagicRepository } from '@/data/repositories/magicRepository'
import { MagicItemRepository, type ObjetoMagico } from '@/data/repositories/magicItemRepository'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { fichaDeRenombre, lineaDeAtributo, type FichaDeRenombre } from '@/domain/fichaDeRenombre'
import { ETIQUETAS_DE_TIPO } from '@/domain/habilidadesDeRenombre'
import { ETIQUETAS_DE_MAGIA, NOMBRE_DEL_NIVEL } from '@/domain/magiaDeRenombre'
import { MAGIC_GROUP_LABELS, esHechicero } from '@/domain/magic'
import { ETIQUETAS_DE_OBJETO } from '@/domain/objetosMagicos'
import { esEditablePor } from '@/domain/personajeRenombre'
import type { UnitDetail } from '@/domain/types'
import { commandGroupText, monturaItems, optionsList, unifiedProfileRows } from '@/features/fichas/sheetContent'
import {
  BarraDeExperiencia,
  DistintivoEspecial,
  EditarPersonajeModal,
  ExperienciaModal,
} from '@/features/renombre/PersonajeRenombreCard'
import { HabilidadesModal } from '@/features/renombre/HabilidadesModal'
import { CicatricesModal } from '@/features/renombre/CicatricesModal'
import { MagiaModal } from '@/features/renombre/MagiaModal'
import { BotonDeInfo, LoQueTiene } from '@/features/renombre/piezas'
import { useAccionesDePersonaje } from '@/features/renombre/avanzada/acciones'
import { useAsync } from '@/shared/hooks/useAsync'
import { useSession } from '@/shared/session/useSession'
import { sanearHtml, tieneTexto } from '@/shared/richText'
import { RichText } from '@/shared/ui/RichTextEditor'
import { ATTRIBUTE_LABELS } from '@/shared/ui/AttributeTable'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import { CandadoDeAutor } from '@/shared/ui/CandadoDeAutor'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Spinner } from '@/shared/ui/Spinner'
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  MonedaIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@/shared/ui/icons'

/** Todo lo que se pinta, cargado de una vez y en paralelo. */
interface Expediente {
  personaje: PersonajeEspecial
  unidad: UnitDetail | null
  ficha: FichaDeRenombre
  sendas: { pathId: number; nombre: string; grupo: string | null; nivel: number }[]
  pergaminos: { id: number; nombre: string; detalle: string; reglas: string | null }[]
  objetos: ObjetoMagico[]
  faccion: { name: string; emblemUrl: string | null } | null
}

async function cargarExpediente(id: number): Promise<Expediente | null> {
  // `listAll` ya deja fuera a los ocultos de otro: si no está ahí, no se ve.
  const personaje = (await SpecialCharacterRepository.listAll()).find((p) => p.id === id) ?? null
  if (!personaje) return null

  const [unidad, claves, cicatrices, catHabilidades, catMagia, susSendas, catSendas, objetos, facciones] =
    await Promise.all([
      UnitRepository.getDetailById(id),
      SpecialCharacterRepository.listHabilidades(id),
      SpecialCharacterRepository.listCicatrices(id),
      CharacterSkillRepository.mapa(),
      MagicRepository.magicSkillMap(),
      MagicRepository.listUnitPaths(id).catch(() => []),
      MagicRepository.listPathsWithSpells().catch(() => []),
      MagicItemRepository.listAll().catch(() => [] as ObjetoMagico[]),
      FactionRepository.listAll().catch(() => []),
    ])

  const ficha = fichaDeRenombre(claves, cicatrices, { habilidades: catHabilidades, magia: catMagia })
  const sendaPorId = new Map(catSendas.map((s) => [s.id, s]))
  const hechizoPorId = new Map(catSendas.flatMap((s) => s.spells.map((h) => [h.id, { hechizo: h, senda: s }] as const)))
  const faccion = facciones.find((f) => f.id === personaje.factionId) ?? null

  return {
    personaje,
    unidad,
    ficha,
    sendas: susSendas.map((s) => {
      const cual = sendaPorId.get(s.pathId)
      return {
        pathId: s.pathId,
        nombre: cual?.name ?? `Senda #${s.pathId}`,
        grupo: cual ? (MAGIC_GROUP_LABELS[cual.group] ?? null) : null,
        nivel: s.level,
      }
    }),
    pergaminos: ficha.pergaminos
      .map((spellId) => hechizoPorId.get(spellId))
      .filter((x) => x != null)
      .map(({ hechizo, senda }) => ({
        id: hechizo.id,
        nombre: hechizo.name,
        detalle: `${senda.name} · nivel ${hechizo.level}`,
        reglas: hechizo.rules ?? null,
      })),
    objetos: objetos.filter((o) => o.unitId === id),
    faccion: faccion ? { name: faccion.name, emblemUrl: faccion.emblemUrl } : null,
  }
}

export function FichaDeRenombrePage() {
  const { id } = useParams()
  const unitId = Number(id)
  const navegar = useNavigate()
  const { user, actingAsAdmin } = useSession()
  const { data, loading, reload } = useAsync(() => cargarExpediente(unitId), [unitId])

  const [ventana, setVentana] = useState<
    'experiencia' | 'habilidades' | 'cicatrices' | 'magia' | 'retrato' | 'borrar' | null
  >(null)
  const acciones = useAccionesDePersonaje(data?.personaje ?? null, reload)

  // La rueda solo la PRIMERA vez: en las recargas de después (cada cambio en
  // una ventana) se sigue enseñando la ficha de antes hasta que llega la nueva,
  // como en la lista; si no, la ventana abierta desaparecería con la página.
  if (loading && data == null) return <Spinner />

  if (!data) {
    return (
      <div>
        <VolverAlListado />
        <EmptyState
          title="Personaje no encontrado"
          action={
            <Link to="/renombre" className="text-sm font-medium text-maroon underline underline-offset-2">
              Volver a Personajes de Renombre
            </Link>
          }
        />
      </div>
    )
  }

  const { personaje, unidad, ficha, sendas, pergaminos, objetos, faccion } = data
  const puedeEditar = esEditablePor(personaje, user?.id)
  const esMago = esHechicero(personaje) || sendas.length > 0
  const subtitulo = [unidad?.category?.name, unidad?.typeTag?.name].filter(Boolean).join(' · ')

  return (
    <div className="pb-10">
      <VolverAlListado />

      {/* ------------------------------------------------------------------
          LA CABECERA DEL EXPEDIENTE
          ------------------------------------------------------------------ */}
      <header
        className={clsx(
          'wh-surgir relative overflow-hidden rounded-sm border bg-parchment/80 shadow-sm shadow-black/10',
          personaje.hidden ? 'border-dashed border-rule-dark/55' : 'border-rule-dark/45',
        )}
      >
        {/* El filete de arriba de la lámina clásica: tinta a los lados, bronce en el centro. */}
        <span
          aria-hidden
          className="block h-[3px] w-full bg-gradient-to-r from-rule-dark/60 via-bronze/80 to-rule-dark/60"
        />

        <div className="flex flex-col gap-5 p-4 sm:flex-row sm:gap-6 sm:p-6">
          <RetratoGrande url={personaje.portraitUrl} nombre={personaje.name} />

          <div className="flex min-w-0 flex-1 flex-col">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <DistintivoEspecial />
              {subtitulo && (
                <>
                  <span className="text-rule-dark/45">·</span>
                  <span className="text-micro font-semibold tracking-[0.14em] text-ink-soft/80 uppercase">
                    {subtitulo}
                  </span>
                </>
              )}
            </p>

            <h1 className="mt-1.5 flex items-start gap-2.5 font-display text-3xl leading-[1.08] font-bold tracking-wide text-ink sm:text-[2.6rem]">
              <span className="min-w-0">{personaje.name}</span>
              {!puedeEditar && (
                <CandadoDeAutor autorId={personaje.userId} className="mt-2 shrink-0" iconClassName="h-5 w-5" />
              )}
            </h1>

            <p className="mt-2 flex items-center gap-2">
              <FactionEmblem faction={faccion} size="xs" />
              <span className="text-xs font-semibold tracking-[0.16em] text-bronze uppercase">
                {faccion?.name ?? personaje.factionName}
              </span>
            </p>

            {/* LOS DATOS DE UN VISTAZO: coste, experiencia y estado. */}
            <dl className="mt-4 grid grid-cols-[auto_1fr] items-end gap-x-6 gap-y-3 border-t border-rule-dark/25 pt-3 sm:grid-cols-[auto_minmax(0,16rem)_auto]">
              <div>
                <dt className="text-micro font-semibold tracking-[0.16em] text-ink-soft/70 uppercase">Coste</dt>
                <dd className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={clsx(
                      'font-display text-xl leading-none tabular-nums',
                      personaje.hideCost ? 'text-ink-soft/45 line-through' : 'text-ink',
                    )}
                  >
                    {personaje.baseCost}
                    <span className="ml-1 font-body text-xs text-ink-soft/70">pts</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!personaje.hideCost}
                    aria-label={`Contar el coste de ${personaje.name} en los ejércitos`}
                    disabled={acciones.ocupado != null || !puedeEditar}
                    onClick={() => void acciones.alternarCoste()}
                    title={personaje.hideCost ? 'El coste no cuenta' : 'El coste cuenta'}
                    className={clsx(
                      'inline-flex rounded-sm p-0.5 transition-colors disabled:opacity-50',
                      personaje.hideCost ? 'text-ink-soft/45 hover:text-bronze' : 'text-bronze hover:text-maroon',
                    )}
                  >
                    <MonedaIcon className="h-4 w-4" />
                  </button>
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="flex items-baseline justify-between gap-2">
                  <span className="text-micro font-semibold tracking-[0.16em] text-ink-soft/70 uppercase">
                    Experiencia
                  </span>
                  <span className="font-display text-xl leading-none text-maroon tabular-nums">
                    {personaje.experiencia}
                    <span className="font-body text-xs text-ink-soft/70"> / {EXPERIENCIA_MAXIMA}</span>
                  </span>
                </dt>
                <dd className="mt-1.5">
                  <BarraDeExperiencia valor={personaje.experiencia} size="md" sinCifra />
                </dd>
              </div>

              {(personaje.hidden || !personaje.active) && (
                <div className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-1 sm:justify-end">
                  {personaje.hidden && (
                    <Estado icono={<EyeOffIcon className="h-3 w-3" />} tono="bronce">
                      Oculto
                    </Estado>
                  )}
                  {!personaje.active && <Estado tono="peligro">Desactivado</Estado>}
                </div>
              )}
            </dl>
          </div>
        </div>
        {/* LA BARRA DE ACCIONES, al pie de la cabecera y a todo su ancho: lo
            único de la página que cambia algo. */}
        <div className="border-t border-rule-dark/25 bg-parchment-dark/20 px-4 py-3 sm:px-6">
          <nav aria-label={`Acciones sobre ${personaje.name}`} className="flex flex-wrap items-center gap-1.5">
            <Accion principal={puedeEditar} onClick={() => setVentana('experiencia')}>
              {puedeEditar && <PlusIcon className="h-3.5 w-3.5" />}
              Experiencia
            </Accion>
            <Accion onClick={() => setVentana('habilidades')}>Habilidades</Accion>
            <Accion onClick={() => setVentana('cicatrices')}>Cicatrices</Accion>
            {esMago && <Accion onClick={() => setVentana('magia')}>Magia</Accion>}
            {puedeEditar && (
              <Accion onClick={() => setVentana('retrato')}>
                <PencilIcon className="h-3.5 w-3.5" />
                Retrato y trasfondo
              </Accion>
            )}

            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              {puedeEditar && (
                <Accion
                  discreta
                  disabled={acciones.ocupado != null}
                  onClick={() => void acciones.alternarOculto()}
                  title={
                    personaje.hidden
                      ? 'Oculto: solo lo ves tú. Pulsa para que vuelva a verlo todo el mundo.'
                      : 'Ocultarlo: dejará de verlo el resto, y no saldrá en sus listas de ejército.'
                  }
                >
                  {personaje.hidden ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
                  {personaje.hidden ? 'Mostrar' : 'Ocultar'}
                </Accion>
              )}
              {puedeEditar && (
                <Accion discreta peligro onClick={() => setVentana('borrar')}>
                  <TrashIcon className="h-3.5 w-3.5" />
                  Borrar
                </Accion>
              )}
              {/* La ficha de unidad está en el Editor, que solo se abre en modo
                administrador; en el personaje de otro se abre en lectura. */}
              {actingAsAdmin && (
                <Link
                  to={`/admin/unidades/${personaje.id}`}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-transparent px-2.5 py-1.5 text-xs font-medium text-ink-soft underline decoration-rule-dark/40 underline-offset-2 transition-colors hover:text-ink"
                >
                  Ficha de unidad
                </Link>
              )}
            </span>
          </nav>

          {acciones.error && (
            <p className="mt-3 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-mini text-danger">
              {acciones.error}
            </p>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------------
          EL CUERPO
          ------------------------------------------------------------------ */}
      <div className="mt-6 space-y-6">
        <Bloque titulo="Trasfondo" retraso={1}>
          {tieneTexto(personaje.background ?? '') ? (
            <div
              className={clsx(
                'max-w-[72ch] text-[0.95rem] leading-relaxed text-ink-soft',
                '[&_em]:italic [&_li]:mb-0.5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2.5 [&_p:last-child]:mb-0',
                '[&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5',
                '[&_p:first-child]:first-letter:float-left [&_p:first-child]:first-letter:mr-1.5 [&_p:first-child]:first-letter:font-display',
                '[&_p:first-child]:first-letter:text-[2.9rem] [&_p:first-child]:first-letter:leading-[0.85] [&_p:first-child]:first-letter:text-maroon',
              )}
              dangerouslySetInnerHTML={{ __html: sanearHtml(personaje.background ?? '') }}
            />
          ) : (
            <Vacio>Sin trasfondo todavía.</Vacio>
          )}
        </Bloque>

        {unidad && <Perfil unidad={unidad} retraso={2} />}

        <div className="grid gap-6 md:grid-cols-2">
          <Bloque titulo="Habilidades" cuantas={cuantasHabilidades(ficha)} retraso={3}>
            <ListasDeHabilidades ficha={ficha} />
          </Bloque>

          <Bloque titulo="Cicatrices" cuantas={ficha.cicatrices.length} retraso={3}>
            {ficha.cicatrices.length === 0 ? (
              <Vacio>Ninguna.</Vacio>
            ) : (
              <LoQueTiene
                etiqueta="Cicatrices de guerra"
                cosas={ficha.cicatrices.map((c) => ({ clave: c.clave, nombre: c.nombre, descripcion: c.descripcion }))}
              />
            )}
          </Bloque>

          {esMago && (
            <Bloque
              titulo="Magia"
              cuantas={
                sendas.length + ficha.magicas.length + ficha.avanzadas.length + ficha.saberes.length + pergaminos.length
              }
              retraso={4}
            >
              <LoQueTiene
                etiqueta="Sendas de magia"
                vacio="No practica ninguna senda."
                cosas={sendas.map((s) => ({
                  clave: `senda:${s.pathId}`,
                  nombre: s.nombre,
                  detalle: NOMBRE_DEL_NIVEL[s.nivel]
                    ? `Nivel ${s.nivel} · ${NOMBRE_DEL_NIVEL[s.nivel]}`
                    : `Nivel ${s.nivel}`,
                  descripcion: s.grupo,
                }))}
              />
              <LoQueTiene
                etiqueta={ETIQUETAS_DE_MAGIA.habilidad}
                cosas={ficha.magicas.map((h) => ({ clave: h.clave, nombre: h.nombre, descripcion: h.descripcion }))}
              />
              <LoQueTiene
                etiqueta={ETIQUETAS_DE_MAGIA.avanzada}
                cosas={ficha.avanzadas.map((h) => ({ clave: h.clave, nombre: h.nombre, descripcion: h.descripcion }))}
              />
              <LoQueTiene
                etiqueta={ETIQUETAS_DE_MAGIA.saber}
                cosas={ficha.saberes.map((h) => ({
                  clave: h.clave,
                  nombre: h.nombre,
                  detalle: h.nivel ? `Nivel ${h.nivel}${h.dificultad ? ` · ${h.dificultad}` : ''}` : null,
                  descripcion: h.descripcion,
                }))}
              />
              <LoQueTiene
                etiqueta={ETIQUETAS_DE_MAGIA.pergamino}
                cosas={pergaminos.map((p) => ({
                  clave: `pergamino:${p.id}`,
                  nombre: p.nombre,
                  detalle: p.detalle,
                  descripcion: p.reglas,
                }))}
              />
            </Bloque>
          )}

          <Bloque titulo="Objetos mágicos" cuantas={objetos.length} retraso={4}>
            {objetos.length === 0 ? <Vacio>No lleva ninguno.</Vacio> : <ListaDeObjetos objetos={objetos} />}
          </Bloque>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          LAS VENTANAS: las mismas de la vista clásica
          ------------------------------------------------------------------ */}
      {ventana === 'experiencia' && (
        <ExperienciaModal
          personaje={personaje}
          soloLectura={!puedeEditar}
          onClose={() => setVentana(null)}
          onApuntado={reload}
        />
      )}
      {ventana === 'habilidades' && (
        <HabilidadesModal
          personaje={personaje}
          soloLectura={!puedeEditar}
          onClose={() => setVentana(null)}
          onCambio={reload}
        />
      )}
      {ventana === 'cicatrices' && (
        <CicatricesModal
          personaje={personaje}
          soloLectura={!puedeEditar}
          onClose={() => setVentana(null)}
          onCambio={reload}
        />
      )}
      {ventana === 'magia' && (
        <MagiaModal
          personaje={personaje}
          soloLectura={!puedeEditar}
          onClose={() => setVentana(null)}
          onCambio={reload}
        />
      )}
      {ventana === 'retrato' && (
        <EditarPersonajeModal
          personaje={personaje}
          onClose={() => setVentana(null)}
          onGuardado={() => {
            setVentana(null)
            reload()
          }}
        />
      )}
      {ventana === 'borrar' && (
        <ConfirmDialog
          title="Borrar Personaje de Renombre"
          message={
            `¿Seguro que quieres borrar a "${personaje.name}"? Se borra la unidad entera —perfil, equipo, reglas, ` +
            'opciones y monturas— junto con su retrato, su trasfondo y toda la experiencia que tenga apuntada, y ' +
            'desaparece de cualquier lista de ejército que lo llevara. Esto es irreversible: no hay papelera ni ' +
            'forma de recuperarlo, y los apuntes de experiencia no se pueden volver a montar.'
          }
          confirmLabel="Borrar definitivamente"
          onCancel={() => setVentana(null)}
          onConfirm={async () => {
            const hecho = await acciones.borrar()
            setVentana(null)
            if (hecho) navegar('/renombre')
          }}
        />
      )}
    </div>
  )
}

// ===========================================================================
// Piezas
// ===========================================================================

function VolverAlListado() {
  return (
    <Link
      to="/renombre"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Personajes de Renombre
    </Link>
  )
}

/** El retrato de la cabecera: el mismo marco de la galería, en grande. */
function RetratoGrande({ url, nombre }: { url: string | null; nombre: string }) {
  return (
    <div className="mx-auto w-44 shrink-0 self-start rounded-sm sm:mx-0 border border-rule-dark/45 bg-parchment-dark/25 p-1.5 shadow-md shadow-black/15 sm:w-56">
      <div className="relative aspect-square overflow-hidden rounded-[1px] bg-parchment-dark/50">
        {url ? (
          <img src={url} alt={`Retrato de ${nombre}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-soft/30">
            <ImageIcon className="h-9 w-9" />
            <span className="text-micro tracking-widest uppercase">Sin retrato</span>
          </div>
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[1px] ring-1 ring-inset ring-bronze/30"
          style={{ boxShadow: 'inset 0 0 18px rgba(20,14,6,0.24)' }}
        />
      </div>
    </div>
  )
}

/** Un estado del personaje, como sello pequeño. */
function Estado({ children, icono, tono }: { children: ReactNode; icono?: ReactNode; tono: 'bronce' | 'peligro' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-micro font-semibold tracking-[0.12em] uppercase',
        tono === 'bronce' ? 'border-bronze/50 bg-bronze/10 text-bronze' : 'border-danger/40 bg-danger/10 text-danger',
      )}
    >
      {icono}
      {children}
    </span>
  )
}

/** Un botón de la barra de acciones. */
function Accion({
  children,
  onClick,
  principal = false,
  discreta = false,
  peligro = false,
  disabled = false,
  title,
}: {
  children: ReactNode
  onClick: () => void
  principal?: boolean
  discreta?: boolean
  peligro?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
        'focus-visible:ring-2 focus-visible:ring-bronze/40 focus-visible:ring-offset-1 focus-visible:ring-offset-parchment focus-visible:outline-none',
        principal
          ? 'border-maroon bg-maroon text-parchment shadow-sm shadow-black/20 hover:bg-maroon-dark'
          : discreta
            ? clsx(
                'border-transparent text-ink-soft',
                peligro ? 'hover:bg-danger/10 hover:text-danger' : 'hover:bg-bronze/10 hover:text-bronze',
              )
            : 'border-rule-dark/45 bg-parchment/60 text-ink hover:border-bronze hover:bg-parchment',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Un bloque del expediente: rótulo en versalita con su filete y su recuento, y
 * el contenido sobre una placa de pergamino.
 */
function Bloque({
  titulo,
  cuantas,
  retraso = 0,
  children,
}: {
  titulo: string
  cuantas?: number
  /** Orden en la entrada escalonada. */
  retraso?: number
  children: ReactNode
}) {
  return (
    <section
      className="wh-surgir min-w-0 rounded-sm border border-rule-dark/40 bg-parchment/70 px-4 pt-3 pb-4 shadow-sm shadow-black/5 sm:px-5"
      style={{ animationDelay: `${retraso * 70}ms` }}
    >
      <h2 className="mb-2.5 flex items-center gap-3">
        <span className="font-display text-lg leading-none font-bold tracking-wide text-ink">{titulo}</span>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-rule-dark/45 to-transparent" />
        {cuantas != null && <span className="text-xs tabular-nums text-ink-soft/70">{cuantas}</span>}
      </h2>
      {children}
    </section>
  )
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-soft/55 italic">{children}</p>
}

function cuantasHabilidades(ficha: FichaDeRenombre): number {
  return ficha.rangos.length + ficha.atributos.length + ficha.habilidades.length + ficha.sociales.length
}

function ListasDeHabilidades({ ficha }: { ficha: FichaDeRenombre }) {
  if (cuantasHabilidades(ficha) === 0) return <Vacio>Todavía no tiene ninguna.</Vacio>
  return (
    <div>
      <LoQueTiene
        etiqueta="Rango"
        cosas={ficha.rangos.map((h) => ({ clave: h.clave, nombre: h.nombre, descripcion: h.descripcion }))}
      />
      <LoQueTiene
        etiqueta={ETIQUETAS_DE_TIPO.atributo}
        cosas={ficha.atributos.map((h) => ({ clave: h.clave, ...lineaDeAtributo(h) }))}
      />
      <LoQueTiene
        etiqueta={ETIQUETAS_DE_TIPO.habilidad}
        cosas={ficha.habilidades.map((h) => ({ clave: h.clave, nombre: h.nombre, descripcion: h.descripcion }))}
      />
      <LoQueTiene
        etiqueta={ETIQUETAS_DE_TIPO.social}
        cosas={ficha.sociales.map((h) => ({ clave: h.clave, nombre: h.nombre, descripcion: h.descripcion }))}
      />
    </div>
  )
}

/**
 * EL PERFIL, como en la hoja de unidad: una sola tabla con una fila por perfil
 * (el personaje, su campeón si lo hubiera, sus monturas y carros), y debajo lo
 * que lleva y lo que puede llevar. Las reglas especiales, con su "i", porque a
 * veces lo que se viene a buscar es justo qué hace una.
 */
function Perfil({ unidad, retraso }: { unidad: UnitDetail; retraso: number }) {
  const filas = unifiedProfileRows(unidad)
  const opciones = optionsList(unidad)
  const monturas = monturaItems(unidad)
  const mando = commandGroupText(unidad)
  const datos: { rotulo: string; valor: string }[] = [
    { rotulo: 'Equipo', valor: unidad.equipmentText ?? '' },
    { rotulo: 'Monturas', valor: monturas.join(' · ') },
    { rotulo: 'Opciones', valor: opciones.join(' · ') },
    { rotulo: 'Grupo de mando', valor: mando },
  ].filter((d) => d.valor.trim())

  return (
    <Bloque titulo="Perfil" retraso={retraso}>
      {filas.length > 0 && (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-[1.5px] border-ink/70">
                <th className="py-1.5 pr-3 text-left text-micro font-semibold tracking-[0.14em] text-ink-soft/70 uppercase">
                  <span className="sr-only">Perfil</span>
                </th>
                {ATTRIBUTE_LABELS.map(({ key, label }) => (
                  <th
                    key={key}
                    className="px-1 py-1.5 text-center font-display text-xs font-bold text-ink-soft sm:px-1.5"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={fila.key} className="border-b border-rule-dark/25">
                  <th
                    scope="row"
                    className={clsx(
                      'py-1.5 pr-3 text-left font-medium sm:whitespace-nowrap',
                      i === 0 ? 'font-display text-[0.95rem] font-bold text-ink' : 'text-xs text-ink-soft',
                    )}
                  >
                    {i === 0 ? fila.label : `↳ ${fila.label}`}
                  </th>
                  {ATTRIBUTE_LABELS.map(({ key }) => (
                    <td key={key} className="px-1 py-1.5 text-center tabular-nums sm:px-1.5 text-ink">
                      {fila.profile[key] || '–'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {datos.length > 0 && (
        <dl className="mt-3 grid gap-x-5 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
          {datos.map((d) => (
            <div key={d.rotulo} className="contents">
              <dt className="text-micro font-semibold tracking-[0.14em] text-ink-soft/70 uppercase sm:pt-[3px]">
                {d.rotulo}
              </dt>
              <dd className="text-ink-soft">{d.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {unidad.specialRules.length > 0 && (
        <div className="mt-4">
          <LoQueTiene
            etiqueta="Reglas especiales"
            cosas={unidad.specialRules.map((r) => ({
              clave: `regla:${r.id}`,
              nombre: r.name,
              descripcion: r.description || null,
            }))}
          />
        </div>
      )}
    </Bloque>
  )
}

/** Los objetos que lleva, para mirarlos: se cambian en la Forja. */
function ListaDeObjetos({ objetos }: { objetos: ObjetoMagico[] }) {
  const [abierto, setAbierto] = useState<number | null>(null)
  return (
    <ul className="divide-y divide-rule-dark/12">
      {objetos.map((objeto) => {
        const esteAbierto = abierto === objeto.id
        const conHistoria = tieneTexto(objeto.trasfondo)
        const conDetalle = conHistoria || objeto.caracteristicas.some((c) => c.descripcion)
        return (
          <li key={objeto.id} className="py-2 first:pt-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-micro font-semibold tracking-[0.16em] text-bronze uppercase">
                {ETIQUETAS_DE_OBJETO[objeto.tipo]}
              </span>
              <span className="font-display text-[0.95rem] font-semibold text-ink">{objeto.nombre}</span>
              {conDetalle && (
                <BotonDeInfo
                  nombre={objeto.nombre}
                  abierto={esteAbierto}
                  onClick={() => setAbierto(esteAbierto ? null : objeto.id)}
                />
              )}
              <span className="ml-auto text-mini text-ink-soft/80 tabular-nums">{objeto.costePagado} exp.</span>
            </div>
            {objeto.caracteristicas.length > 0 && (
              <p className="mt-0.5 text-xs text-ink-soft">
                {objeto.caracteristicas
                  .map((c) => (c.tipo === 'sello' ? `Sello ${c.nombre.toLowerCase()}` : c.nombre))
                  .join(' · ')}
              </p>
            )}
            {esteAbierto && (
              <div className="mt-1.5 space-y-1.5">
                {objeto.caracteristicas
                  .filter((c) => c.descripcion)
                  .map((c) => (
                    <p
                      key={c.clave}
                      className="border-l-2 border-bronze/40 bg-parchment-dark/20 px-2 py-1 text-mini leading-relaxed text-ink-soft"
                    >
                      <b className="font-semibold text-ink">{c.nombre}.</b> {c.descripcion}
                    </p>
                  ))}
                {conHistoria && <RichText html={objeto.trasfondo} className="text-xs leading-relaxed text-ink" />}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
