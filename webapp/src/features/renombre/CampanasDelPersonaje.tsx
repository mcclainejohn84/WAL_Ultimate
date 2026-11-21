// ============================================================================
// En qué CAMPAÑAS sale un personaje: ninguna, una o varias (ver
// campaignRepository). Se elige en su ventana de "Retrato y trasfondo" con un
// botón por campaña que se enciende y se apaga; en su ficha se enseñan como
// sellos, solo para leer.
// ============================================================================
import { clsx } from 'clsx'
import type { Campana } from '@/data/repositories/campaignRepository'
import { CheckIcon } from '@/shared/ui/icons'

/** Miniatura de la imagen de la campaña, o su inicial. */
function Miniatura({ campana, encendida }: { campana: Campana; encendida: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[2px]',
        encendida ? 'bg-parchment/20' : 'bg-parchment-dark/60',
      )}
    >
      {campana.imagenUrl ? (
        <img src={campana.imagenUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-[0.7rem] leading-none font-bold">{campana.nombre.charAt(0)}</span>
      )}
    </span>
  )
}

export function SelectorDeCampanas({
  campanas,
  elegidas,
  onChange,
  disabled = false,
}: {
  campanas: Campana[]
  elegidas: Set<number>
  onChange: (siguiente: Set<number>) => void
  disabled?: boolean
}) {
  return (
    <div role="group" aria-label="Campañas" className="flex flex-wrap gap-1.5">
      {campanas.map((c) => {
        const encendida = elegidas.has(c.id)
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={encendida}
            disabled={disabled}
            onClick={() => {
              const siguiente = new Set(elegidas)
              if (encendida) siguiente.delete(c.id)
              else siguiente.add(c.id)
              onChange(siguiente)
            }}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-sm border py-1 pr-2.5 pl-1 text-xs font-medium transition-colors disabled:opacity-50',
              'focus-visible:ring-2 focus-visible:ring-bronze/40 focus-visible:outline-none',
              encendida
                ? 'border-maroon bg-maroon text-parchment shadow-sm shadow-black/20'
                : 'border-rule-dark/45 bg-parchment/60 text-ink hover:border-bronze',
            )}
          >
            <Miniatura campana={c} encendida={encendida} />
            {c.nombre}
            {encendida && <CheckIcon className="h-3 w-3" />}
          </button>
        )
      })}
    </div>
  )
}

/** Las campañas de un personaje, como sellos de bronce, para leer. */
export function SellosDeCampana({ campanas }: { campanas: Campana[] }) {
  if (campanas.length === 0) return null
  return (
    <ul aria-label="Campañas" className="flex flex-wrap gap-1.5">
      {campanas.map((c) => (
        <li
          key={c.id}
          className="inline-flex items-center gap-1.5 rounded-sm border border-bronze/45 bg-bronze/10 py-0.5 pr-2 pl-0.5 text-mini font-semibold tracking-[0.06em] text-bronze"
        >
          <Miniatura campana={c} encendida={false} />
          {c.nombre}
        </li>
      ))}
    </ul>
  )
}
