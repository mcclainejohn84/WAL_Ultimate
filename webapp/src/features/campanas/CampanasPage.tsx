// ============================================================================
// "Campañas", junto a Batallas y Mapas (empezó en el Editor y se sacó de ahí
// a petición del usuario: las campañas son de quien juega, no del catálogo).
// Se crean, se editan y se borran. Cada una tiene su
// nombre, su historia, una imagen y un mapa, y agrupa Personajes de Renombre
// (eso se decide desde cada personaje, ver CampanasDelPersonaje).
//
// CADA CAMPAÑA ES UNA PLACA, como las de la galería de personajes y cuatro
// por fila: su escudo (la imagen, CUADRADA) enmarcado arriba, y debajo el
// nombre, quién sale en ella (los retratos en fila) y el arranque de su
// historia. Sin escudo, su mapa; sin mapa tampoco, la inicial del nombre en
// grande, para que no quede un hueco.
// ============================================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { CampaignRepository, type Campana, type ImagenDeCampana } from '@/data/repositories/campaignRepository'
import { SpecialCharacterRepository, type PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import {
  compressImageFile,
  descargarImagenComoBytes,
  medirImagen,
  recortarEncuadre,
  zoomParaCubrir,
  type EncuadreRetrato,
} from '@/shared/image'
import { MarcoDeEncuadre } from '@/features/renombre/MarcoDeEncuadre'
import { aTextoPlano, tieneTexto } from '@/shared/richText'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { TextField } from '@/shared/ui/TextField'
import { RichTextEditor } from '@/shared/ui/RichTextEditor'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ImageIcon, MapaIcon, PencilIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'

/** Cuántos retratos se enseñan en fila antes del "+N". */
const RETRATOS_EN_FILA = 4

async function cargar() {
  const [campanas, personajes, porPersonaje] = await Promise.all([
    CampaignRepository.listAll(),
    SpecialCharacterRepository.listAll().catch(() => [] as PersonajeEspecial[]),
    CampaignRepository.campanasPorPersonaje(),
  ])
  // De cada campaña, sus personajes (los que este usuario puede ver).
  const deLaCampana = new Map<number, PersonajeEspecial[]>()
  for (const p of personajes) {
    for (const id of porPersonaje.get(p.id) ?? []) {
      const ya = deLaCampana.get(id)
      if (ya) ya.push(p)
      else deLaCampana.set(id, [p])
    }
  }
  return { campanas, deLaCampana }
}

export function CampanasPage() {
  const { data, loading, reload } = useAsync(cargar)
  const [editando, setEditando] = useState<Campana | 'nueva' | null>(null)
  const [porBorrar, setPorBorrar] = useState<Campana | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function borrar() {
    if (!porBorrar) return
    setError(null)
    try {
      await CampaignRepository.remove(porBorrar.id)
      setPorBorrar(null)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPorBorrar(null)
    }
  }

  if (loading && data == null) return <Spinner />
  const campanas = data?.campanas ?? []

  return (
    <div>
      <PageHeader
        title="Campañas"
        actions={
          <Button variant="primary" onClick={() => setEditando('nueva')}>
            <PlusIcon className="h-4 w-4" />
            Nueva campaña
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {campanas.length === 0 ? (
        <EmptyState
          title="Todavía no hay ninguna campaña"
          action={
            <Button variant="primary" onClick={() => setEditando('nueva')}>
              <PlusIcon className="h-4 w-4" />
              Nueva campaña
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          {campanas.map((c, i) => (
            <li key={c.id} className="wh-surgir" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
              <Folio
                campana={c}
                personajes={data?.deLaCampana.get(c.id) ?? []}
                onEditar={() => setEditando(c)}
                onBorrar={() => setPorBorrar(c)}
              />
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <EditorDeCampana
          campana={editando === 'nueva' ? null : editando}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            reload()
          }}
        />
      )}

      {porBorrar && (
        <ConfirmDialog
          title="Borrar la campaña"
          message={`¿Seguro que borras "${porBorrar.nombre}"? Sus personajes no se borran: solo dejan de estar en ella.`}
          confirmLabel="Sí, borrarla"
          cancelLabel="Cancelar"
          onConfirm={() => void borrar()}
          onCancel={() => setPorBorrar(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// El folio de una campaña
// ---------------------------------------------------------------------------

function Folio({
  campana,
  personajes,
  onEditar,
  onBorrar,
}: {
  campana: Campana
  personajes: PersonajeEspecial[]
  onEditar: () => void
  onBorrar: () => void
}) {
  const ordenados = [...personajes].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const enFila = ordenados.slice(0, RETRATOS_EN_FILA)
  const resto = ordenados.length - enFila.length
  const historia = tieneTexto(campana.historia) ? aTextoPlano(campana.historia) : ''
  const portada = campana.imagenUrl ?? campana.mapaUrl

  return (
    <article className="group flex h-full flex-col rounded-sm border border-rule-dark/45 bg-parchment/80 p-1.5 shadow-sm shadow-black/10 transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-bronze/70 hover:shadow-lg hover:shadow-black/15">
      {/* EL ESCUDO: cuadrado, como su encuadre. Pulsarlo abre la edición. */}
      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${campana.nombre}`}
        className="relative block aspect-square w-full overflow-hidden rounded-[1px] bg-parchment-dark/50 focus-visible:ring-2 focus-visible:ring-bronze/60 focus-visible:outline-none"
      >
        {portada ? (
          <img
            src={portada}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-[scale] duration-500 ease-out group-hover:scale-[1.035]"
            // Sin escudo se usa el MAPA, envejecido: sigue siendo de la campaña.
            style={campana.imagenUrl ? undefined : { filter: 'sepia(0.55) saturate(0.8) contrast(0.95)' }}
          />
        ) : (
          <>
            <span aria-hidden className="absolute inset-2 border border-bronze/30" />
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center font-display text-7xl leading-none font-bold text-ink/[0.12] select-none"
            >
              {campana.nombre.trim().charAt(0).toUpperCase()}
            </span>
          </>
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-bronze/30"
          style={{ boxShadow: 'inset 0 0 14px rgba(20,14,6,0.22)' }}
        />
      </button>

      <div className="flex flex-1 flex-col gap-1.5 px-1 pt-2">
        <h2 className="line-clamp-2 font-display text-[0.98rem] leading-tight font-bold tracking-wide text-ink">
          {campana.nombre}
        </h2>

        {/* QUIÉN SALE: los retratos en fila y cuántos son. */}
        <div className="flex items-center gap-2">
          {enFila.length > 0 && (
            <div className="flex -space-x-1.5">
              {enFila.map((p) => (
                <span
                  key={p.id}
                  title={p.name}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-parchment-dark ring-2 ring-parchment"
                >
                  {p.portraitUrl ? (
                    <img src={p.portraitUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-[0.65rem] font-bold text-ink/45">{p.name.charAt(0)}</span>
                  )}
                </span>
              ))}
              {resto > 0 && (
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bronze/15 text-[0.6rem] font-semibold text-bronze ring-2 ring-parchment tabular-nums">
                  +{resto}
                </span>
              )}
            </div>
          )}
          <span className="text-micro font-semibold tracking-[0.14em] text-ink-soft/75 uppercase tabular-nums">
            {ordenados.length === 0
              ? 'Sin personajes'
              : `${ordenados.length} ${ordenados.length === 1 ? 'personaje' : 'personajes'}`}
          </span>
        </div>

        {historia && <p className="line-clamp-2 text-xs leading-snug text-ink-soft">{historia}</p>}

        <div className="mt-auto flex items-center gap-0.5 border-t border-rule-dark/20 pt-1">
          {campana.mapaUrl && (
            <a
              href={campana.mapaUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver el mapa"
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-mini font-medium text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze"
            >
              <MapaIcon className="h-3.5 w-3.5" />
              Mapa
            </a>
          )}
          <span className="ml-auto flex items-center">
            <button
              type="button"
              onClick={onEditar}
              aria-label={`Editar ${campana.nombre}`}
              title="Editar"
              className="rounded-sm p-1 text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onBorrar}
              aria-label={`Borrar ${campana.nombre}`}
              title="Borrar"
              className="rounded-sm p-1 text-ink-soft transition-colors hover:bg-maroon/10 hover:text-danger"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Crear y editar
// ---------------------------------------------------------------------------

/** Una imagen elegida que todavía no se ha subido: se sube al guardar. */
interface Pendiente {
  bytes: Uint8Array
  mime: string
  url: string
  /** Sus medidas: las necesita el encuadre para saber cuánto ocupa en el marco. */
  ancho: number
  alto: number
}

/**
 * LA IMAGEN DE LA CAMPAÑA ES SU ESCUDO, y se encuadra como los retratos: es
 * CUADRADA, que es como se ve en su placa, y una foto casi nunca tiene esa
 * forma. Se arrastra y se amplía dentro de un marco cuadrado, y lo que se
 * guarda es justo lo que se ve ahí (ver shared/image#recortarEncuadre).
 *
 * El MAPA no: se guarda entero y se enseña con SU forma, porque cada mapa
 * tiene la suya y recortarlo le quitaría justo los bordes.
 */
const PROPORCION_IMAGEN = 1
const TAMANO_IMAGEN = { ancho: 800, alto: 800 }

/**
 * Cómo se prepara cada una. El mapa se deja más grande y con más peso: se
 * mira para leerlo, y a 1600 px los rótulos de un mapa dibujado ya no se leen.
 */
const PREPARACION: Record<ImagenDeCampana, { maxSize: number; maxBytes?: number }> = {
  // Más grande que lo que se guarda: así se puede ampliar al encuadrar sin
  // que el recorte salga borroso.
  imagen: { maxSize: 2400 },
  mapa: { maxSize: 2600, maxBytes: 1500 * 1024 },
}

function EditorDeCampana({
  campana,
  onClose,
  onGuardado,
}: {
  campana: Campana | null
  onClose: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(campana?.nombre ?? '')
  const [historia, setHistoria] = useState(campana?.historia ?? '')
  const [pendientes, setPendientes] = useState<Partial<Record<ImagenDeCampana, Pendiente>>>({})
  const [quitar, setQuitar] = useState<Partial<Record<ImagenDeCampana, boolean>>>({})
  const [preparando, setPreparando] = useState<ImagenDeCampana | null>(null)
  /** El encuadre de la imagen que se está colocando (solo con una imagen nueva o reencuadrándose). */
  const [encuadre, setEncuadre] = useState<EncuadreRetrato | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Las URL de objeto se sueltan al cerrar (ver EditarPersonajeModal).
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  /** Deja una imagen lista para guardar (y, si es la de portada, para encuadrar). */
  async function ponerPendiente(cual: ImagenDeCampana, bytes: Uint8Array, mime: string) {
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
    urls.current.push(url)
    const medidas = (await medirImagen(bytes, mime)) ?? { ancho: 0, alto: 0 }
    setPendientes((p) => ({ ...p, [cual]: { bytes, mime, url, ...medidas } }))
    setQuitar((q) => ({ ...q, [cual]: false }))
    // Nace CUBRIENDO el marco, sin franjas: es como se ve en la portada.
    if (cual === 'imagen')
      setEncuadre({ zoom: zoomParaCubrir(medidas.ancho, medidas.alto, PROPORCION_IMAGEN), x: 0, y: 0 })
  }

  async function elegir(cual: ImagenDeCampana, file: File | undefined) {
    if (!file) return
    setPreparando(cual)
    setError(null)
    try {
      const lista = await compressImageFile(file, { ...PREPARACION[cual], keepAlpha: false })
      await ponerPendiente(cual, lista.bytes, lista.mime)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreparando(null)
    }
  }

  /**
   * Reencuadrar la imagen que ya tiene. Se parte de la guardada, que ya está
   * recortada: vale para retocar el encuadre; para un cambio grande sale mejor
   * volver a elegir la original (igual que en los retratos).
   */
  async function reencuadrar() {
    if (!campana?.imagenUrl) return
    setPreparando('imagen')
    setError(null)
    try {
      const { bytes, mime } = await descargarImagenComoBytes(campana.imagenUrl)
      await ponerPendiente('imagen', bytes, mime)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreparando(null)
    }
  }

  function quitarImagen(cual: ImagenDeCampana) {
    setPendientes((p) => ({ ...p, [cual]: undefined }))
    setQuitar((q) => ({ ...q, [cual]: true }))
    if (cual === 'imagen') setEncuadre(null)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const datos = { nombre, historia }
      let id = campana?.id
      if (id == null) id = await CampaignRepository.create(datos)
      else await CampaignRepository.update(id, datos)
      for (const cual of ['imagen', 'mapa'] as const) {
        const nueva = pendientes[cual]
        if (nueva && cual === 'imagen' && encuadre) {
          // El encuadre se aplica AQUÍ: lo que sube es ya la portada definitiva.
          const recortada = await recortarEncuadre(nueva.bytes, nueva.mime, encuadre, TAMANO_IMAGEN)
          await CampaignRepository.setImagen(id, cual, recortada.bytes, recortada.mime)
        } else if (nueva) await CampaignRepository.setImagen(id, cual, nueva.bytes, nueva.mime)
        else if (quitar[cual]) await CampaignRepository.quitarImagen(id, cual)
      }
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  const urlDe = (cual: ImagenDeCampana) =>
    pendientes[cual]?.url ?? (quitar[cual] ? null : cual === 'imagen' ? campana?.imagenUrl : campana?.mapaUrl) ?? null

  return (
    <Modal
      title={campana ? campana.nombre : 'Nueva campaña'}
      onClose={onClose}
      widthClassName="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando || preparando != null || !nombre.trim()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />

        <div>
          <span className="mb-1 block text-xs font-medium text-ink-soft">Historia</span>
          <RichTextEditor value={historia} onChange={setHistoria} valorInicialKey={campana?.id ?? 'nueva'} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RanuraDeImagen
            etiqueta="Imagen"
            icono={<ImageIcon className="h-7 w-7" />}
            url={urlDe('imagen')}
            preparando={preparando === 'imagen'}
            bloqueado={guardando}
            onElegir={(f) => void elegir('imagen', f)}
            onQuitar={() => quitarImagen('imagen')}
            encuadrando={
              pendientes.imagen && encuadre
                ? {
                    fuente: pendientes.imagen,
                    encuadre,
                    onChange: setEncuadre,
                    onCentrar: () =>
                      setEncuadre({
                        zoom: zoomParaCubrir(pendientes.imagen!.ancho, pendientes.imagen!.alto, PROPORCION_IMAGEN),
                        x: 0,
                        y: 0,
                      }),
                  }
                : null
            }
            onReencuadrar={campana?.imagenUrl && !pendientes.imagen && !quitar.imagen ? () => void reencuadrar() : null}
          />
          <RanuraDeImagen
            etiqueta="Mapa"
            icono={<MapaIcon className="h-7 w-7" />}
            url={urlDe('mapa')}
            // El de verdad, no el que se acaba de elegir: ese aún no tiene dirección.
            enlace={!pendientes.mapa && !quitar.mapa ? (campana?.mapaUrl ?? null) : null}
            contener
            preparando={preparando === 'mapa'}
            bloqueado={guardando}
            onElegir={(f) => void elegir('mapa', f)}
            onQuitar={() => quitarImagen('mapa')}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}

/** El hueco de una imagen en el editor: la vista previa y sus botones. */
function RanuraDeImagen({
  etiqueta,
  icono,
  url,
  enlace = null,
  contener = false,
  preparando,
  bloqueado,
  onElegir,
  onQuitar,
  encuadrando = null,
  onReencuadrar = null,
}: {
  etiqueta: string
  icono: ReactNode
  url: string | null
  /** Si se puede abrir a tamaño completo (el mapa ya guardado). */
  enlace?: string | null
  /** El mapa se ve ENTERO (contain); la imagen llena el hueco (cover). */
  contener?: boolean
  preparando: boolean
  bloqueado: boolean
  onElegir: (file: File | undefined) => void
  onQuitar: () => void
  /** Con una imagen nueva de portada: el marco para encuadrarla en vez de la vista previa. */
  encuadrando?: {
    fuente: Pendiente
    encuadre: EncuadreRetrato
    onChange: (e: EncuadreRetrato) => void
    onCentrar: () => void
  } | null
  /** Reencuadrar la que ya está guardada. */
  onReencuadrar?: (() => void) | null
}) {
  const input = useRef<HTMLInputElement>(null)
  const id = useMemo(() => `ranura-${etiqueta.toLowerCase()}`, [etiqueta])
  return (
    <div>
      <span id={id} className="mb-1 block text-xs font-medium text-ink-soft">
        {etiqueta}
      </span>
      {encuadrando ? (
        // LO QUE SE VE EN EL MARCO ES LO QUE SE GUARDA (ver MarcoDeEncuadre).
        <MarcoDeEncuadre
          url={encuadrando.fuente.url}
          ancho={encuadrando.fuente.ancho}
          alto={encuadrando.fuente.alto}
          encuadre={encuadrando.encuadre}
          onChange={encuadrando.onChange}
          proporcion={PROPORCION_IMAGEN}
          de="de la imagen"
        />
      ) : (
        <div className={clsx('rounded-sm border border-rule-dark/45 bg-parchment-dark/25 p-1.5', !contener && 'w-fit')}>
          <button
            type="button"
            aria-labelledby={id}
            disabled={bloqueado || preparando}
            onClick={() => input.current?.click()}
            className={clsx(
              // Con imagen, el hueco toma SU forma: el escudo es cuadrado y el
              // mapa, el que sea (cada uno tiene la suya). Vacío, un cuadrado.
              'relative flex items-center justify-center overflow-hidden rounded-[1px] bg-parchment-dark/45 text-ink-soft/35',
              !url && 'aspect-square',
              // El escudo, del mismo tamaño que su marco de encuadre (14rem).
              contener ? 'w-full' : 'w-56 max-w-full',
              'transition-colors hover:text-bronze focus-visible:ring-2 focus-visible:ring-bronze/60 focus-visible:outline-none',
            )}
          >
            {url ? (
              <img
                src={url}
                alt=""
                className={clsx(
                  'block w-full',
                  contener ? 'h-auto max-h-[22rem] object-contain' : 'aspect-square object-cover',
                )}
              />
            ) : preparando ? (
              <span className="text-xs">Preparando…</span>
            ) : (
              icono
            )}
            <span aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-bronze/25" />
          </button>
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Button variant="secondary" disabled={bloqueado || preparando} onClick={() => input.current?.click()}>
          {preparando ? 'Preparando…' : url ? 'Cambiar' : 'Elegir'}
        </Button>
        {onReencuadrar && (
          <Button variant="secondary" disabled={bloqueado || preparando} onClick={onReencuadrar}>
            Reencuadrar
          </Button>
        )}
        {encuadrando && (
          <Button
            variant="ghost"
            disabled={bloqueado}
            onClick={encuadrando.onCentrar}
            title="Vuelve al encuadre de partida: la imagen cubriendo el marco, centrada"
          >
            Centrar
          </Button>
        )}
        {url && (
          <Button variant="ghost" disabled={bloqueado || preparando} onClick={onQuitar}>
            Quitar
          </Button>
        )}
        {enlace && (
          <a
            href={enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-medium text-ink-soft underline decoration-rule-dark/40 underline-offset-2 hover:text-ink"
          >
            Ver a tamaño completo
          </a>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onElegir(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
