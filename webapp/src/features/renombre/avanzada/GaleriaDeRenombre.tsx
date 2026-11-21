// ============================================================================
// VISTA AVANZADA de Personajes de Renombre: la GALERÍA.
//
// Una cuadrícula de retratos para reconocer a cada personaje de un vistazo y
// entrar en él con un clic. Cada lámina dice lo justo: el retrato, el nombre,
// la facción (su emblema y su nombre) y, si es de otro jugador, el candado. Lo
// demás —experiencia, habilidades, magia…— está en su ficha (ver
// FichaDeRenombrePage), que es a donde lleva el clic.
//
// LA LÁMINA ES UNA PLACA ENMARCADA, con el mismo lenguaje que el retrato de la
// vista clásica: paspartú de pergamino, hilo de bronce por dentro y una
// sombra interior que asienta la foto. Al pasar por encima se levanta un
// punto, el marco se calienta a bronce y cruza un brillo: es lo único que
// indica que es un enlace, y no hace falta más.
//
// SE ANIMA LA ENTRADA, y es una excepción a la norma del programa (ver
// index.css, "ENTRADAS ANIMADAS"). Es la misma razón que en la Batalla: esta
// vista se abre para MIRAR, no para trabajar en ella. El escalonado se corta a
// la docena para que una facción de cuarenta personajes no tarde dos segundos
// en terminar de aparecer, y quien pide menos movimiento no ve ninguno.
//
// SIN RETRATO no queda un hueco gris: el emblema de su facción, lavado en
// sepia, y la inicial del nombre en grande. Una galería con huecos parece a
// medio montar; así, el que no tiene foto sigue pareciendo una placa.
// ============================================================================
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import type { PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import type { Faction } from '@/domain/types'
import { esEditablePor } from '@/domain/personajeRenombre'
import { useSession } from '@/shared/session/useSession'
import { FactionEmblem } from '@/shared/ui/FactionEmblem'
import { CandadoDeAutor } from '@/shared/ui/CandadoDeAutor'
import { EyeOffIcon } from '@/shared/ui/icons'

/** Hasta cuántas láminas se escalona la entrada; de ahí en adelante entran todas a la vez. */
const ESCALONADO_MAX = 12
const PASO_MS = 35

export function GaleriaDeRenombre({
  personajes,
  facciones,
}: {
  /** Ya filtrados (facción y autor): la galería pinta lo que le dan. */
  personajes: PersonajeEspecial[]
  facciones: Faction[]
}) {
  const { user } = useSession()
  const faccionPorId = new Map(facciones.map((f) => [f.id, f]))
  // En el orden de las facciones que ya conoce el usuario (el del resto del
  // programa) y, dentro de cada una, por nombre: así los de una misma facción
  // quedan juntos aunque la cuadrícula no los separe con un rótulo.
  const orden = new Map(facciones.map((f, i) => [f.id, i]))
  const ordenados = [...personajes].sort(
    (a, b) =>
      (orden.get(a.factionId) ?? Number.MAX_SAFE_INTEGER) - (orden.get(b.factionId) ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name, 'es'),
  )

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
      {ordenados.map((personaje, indice) => (
        <li
          key={personaje.id}
          className="wh-surgir"
          style={{ animationDelay: `${Math.min(indice, ESCALONADO_MAX) * PASO_MS}ms` }}
        >
          <Placa
            personaje={personaje}
            faccion={faccionPorId.get(personaje.factionId) ?? null}
            ajeno={!esEditablePor(personaje, user?.id)}
          />
        </li>
      ))}
    </ul>
  )
}

function Placa({
  personaje,
  faccion,
  ajeno,
}: {
  personaje: PersonajeEspecial
  faccion: Faction | null
  ajeno: boolean
}) {
  const nombreDeFaccion = faccion?.name ?? personaje.factionName
  return (
    <Link
      to={`/renombre/${personaje.id}`}
      aria-label={`${personaje.name}, ${nombreDeFaccion}`}
      className={clsx(
        'group block rounded-sm outline-none',
        'focus-visible:ring-2 focus-visible:ring-bronze/60 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
      )}
    >
      <figure
        className={clsx(
          'relative rounded-sm border bg-parchment-dark/25 p-1.5 shadow-sm shadow-black/10',
          'transition-[translate,box-shadow,border-color] duration-200 ease-out',
          'group-hover:-translate-y-0.5 group-hover:border-bronze/70 group-hover:shadow-lg group-hover:shadow-black/15',
          // Oculto = solo lo ve su autor: el marco discontinuo lo dice sin texto,
          // igual que en la lámina clásica.
          personaje.hidden ? 'border-dashed border-rule-dark/55' : 'border-rule-dark/45',
        )}
      >
        <div className="relative aspect-square overflow-hidden rounded-[1px] bg-parchment-dark/50">
          {personaje.portraitUrl ? (
            <img
              src={personaje.portraitUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-[scale,filter] duration-300 ease-out group-hover:scale-[1.035] group-hover:brightness-[1.04]"
            />
          ) : (
            <SinRetrato nombre={personaje.name} faccion={faccion} />
          )}

          {/* Hilo de bronce y sombra interior: los mismos del retrato clásico. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[1px] ring-1 ring-inset ring-bronze/30"
            style={{ boxShadow: 'inset 0 0 14px rgba(20,14,6,0.22)' }}
          />
          {/* El brillo que cruza al pasar por encima. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: 'linear-gradient(125deg, transparent 38%, rgba(255,246,222,0.22) 50%, transparent 62%)',
            }}
          />

          {personaje.hidden && (
            <span
              title="Oculto"
              aria-label="Oculto"
              role="img"
              className="absolute top-1.5 left-1.5 inline-flex rounded-full bg-parchment/90 p-1 text-bronze shadow-sm shadow-black/20"
            >
              <EyeOffIcon className="h-3.5 w-3.5" />
            </span>
          )}
          {ajeno && (
            <CandadoDeAutor
              autorId={personaje.userId}
              className="absolute top-1.5 right-1.5 rounded-full bg-parchment/90 p-1 shadow-sm shadow-black/20"
            />
          )}
        </div>

        <figcaption className="px-1 pt-2.5 pb-1">
          <p className="line-clamp-2 font-display text-[0.98rem] leading-tight font-bold tracking-wide text-ink transition-colors group-hover:text-maroon">
            {personaje.name}
          </p>
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5">
            <FactionEmblem faction={faccion} size="xs" />
            <span className="truncate text-micro font-semibold tracking-[0.14em] text-bronze uppercase">
              {nombreDeFaccion}
            </span>
          </p>
        </figcaption>
      </figure>
    </Link>
  )
}

/** El hueco de una placa sin foto: el emblema de su facción en sepia y su inicial. */
function SinRetrato({ nombre, faccion }: { nombre: string; faccion: Faction | null }) {
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {faccion?.emblemUrl && (
        <img
          src={faccion.emblemUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          style={{ filter: 'sepia(0.7) saturate(0.6) contrast(0.9)' }}
        />
      )}
      <span className="relative font-display text-6xl leading-none font-bold text-ink/30 select-none">{inicial}</span>
    </div>
  )
}
