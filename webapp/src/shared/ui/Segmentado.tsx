// ============================================================================
// UN CONTROL SEGMENTADO: dos o tres opciones excluyentes en una sola pieza.
//
// Caja de pergamino con filete y la opción elegida en granate. Lo usan el
// filtro de las barras (`FiltroSegmentado`), el "De evento / De batalla" de la
// experiencia y el "No / Ver / Editar" de compartir un ejército. Antes cada
// uno llevaba su copia y ya no medían lo mismo: uno con más aire, otro sin el
// fondo al pasar el ratón.
//
// Es un `radiogroup` de verdad: una opción y solo una está marcada siempre.
// ============================================================================
import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface OpcionSegmentada<T extends string> {
  valor: T
  etiqueta: string
  icono?: ReactNode
  /** Cuántos hay de esto. Se pinta pequeño al lado. */
  cuantos?: number
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  className,
}: {
  opciones: OpcionSegmentada<T>[]
  valor: T
  onChange: (valor: T) => void
  /** Para los lectores de pantalla: qué se está eligiendo. */
  etiqueta: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className={clsx('flex w-fit gap-0.5 rounded-sm border border-rule-dark/50 bg-parchment/70 p-0.5', className)}
    >
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => onChange(opcion.valor)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-[2px] px-2.5 py-0.5 text-xs whitespace-nowrap transition-colors',
              'focus-visible:ring-2 focus-visible:ring-bronze/50 focus-visible:outline-none',
              activa
                ? 'bg-maroon font-semibold text-parchment shadow-sm shadow-black/20'
                : 'text-ink-soft hover:bg-parchment-dark hover:text-ink',
            )}
          >
            {opcion.icono}
            {opcion.etiqueta}
            {opcion.cuantos != null && <span className="text-mini tabular-nums opacity-70">{opcion.cuantos}</span>}
          </button>
        )
      })}
    </div>
  )
}
