// ============================================================================
// Un desplegable para elegir VARIAS cosas a la vez: el botón dice cuántas hay
// marcadas y, al pulsarlo, se abre la lista con sus casillas.
//
// POR QUÉ UN DESPLEGABLE Y NO FICHAS SUELTAS. Con cinco facciones las fichas
// se leen de un vistazo, pero el catálogo crece: a la vuelta de unos meses son
// veinte y el filtro ocupa tres líneas de pantalla antes de que empiece lo que
// se viene a mirar. Un desplegable ocupa siempre una línea.
//
// No es un `<select multiple>`: ese obliga a arrastrar o a dejar pulsado el
// control, no dice cuántas hay marcadas sin contarlas y en un móvil es
// directamente otra cosa.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDownIcon } from '@/shared/ui/icons'

export interface OpcionMultiple {
  id: number
  nombre: string
  /** Un número al lado del nombre (cuántos hay de esto). */
  cuantos?: number
}

export function SelectorMultiple({
  label,
  opciones,
  elegidas,
  onChange,
  textoDeTodas,
  className,
}: {
  label: string
  opciones: OpcionMultiple[]
  elegidas: Set<number>
  onChange: (siguiente: Set<number>) => void
  /** Lo que pone el botón cuando no hay ninguna marcada. */
  textoDeTodas: string
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (caja.current?.contains(e.target as Node)) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  const marcadas = opciones.filter((o) => elegidas.has(o.id))
  const resumen =
    marcadas.length === 0
      ? textoDeTodas
      : marcadas.length === 1
        ? marcadas[0].nombre
        : `${marcadas.length} seleccionadas`

  function alternar(id: number) {
    const siguiente = new Set(elegidas)
    if (siguiente.has(id)) siguiente.delete(id)
    else siguiente.add(id)
    onChange(siguiente)
  }

  return (
    <div ref={caja} className={clsx('relative', className)}>
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-2 rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 py-1 text-xs text-ink outline-none transition-colors focus:border-bronze focus:ring-2 focus:ring-bronze/25"
      >
        <span className="truncate">{resumen}</span>
        <ChevronDownIcon
          className={clsx('h-3.5 w-3.5 shrink-0 text-ink-soft transition-transform', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div className="absolute left-0 z-30 mt-1 max-h-72 w-full min-w-56 overflow-y-auto rounded-sm border border-rule-dark/50 bg-parchment shadow-lg shadow-black/20">
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="flex w-full items-center justify-between gap-2 border-b border-rule-dark/25 px-2.5 py-1.5 text-left text-xs font-medium text-ink transition-colors hover:bg-parchment-dark"
          >
            <span className={clsx(elegidas.size === 0 && 'text-maroon')}>{textoDeTodas}</span>
          </button>
          <ul>
            {opciones.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-parchment-dark">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0 accent-maroon"
                    checked={elegidas.has(o.id)}
                    onChange={() => alternar(o.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
                  {o.cuantos != null && (
                    <span className="shrink-0 text-mini tabular-nums text-ink-soft">{o.cuantos}</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
