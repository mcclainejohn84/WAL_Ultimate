// ============================================================================
// UN FILTRO DE DOS O TRES OPCIONES EXCLUYENTES, en una sola pieza.
//
// Es el mismo control que ya usan las pestañas de los diálogos (Habilidades,
// Magia) y el Editor: caja de pergamino con filete, y la opción activa en
// granate. Aquí vive como componente porque empezó a hacer falta FUERA de un
// diálogo —en las barras de filtros— y la primera versión se resolvió con una
// casilla suelta: un cuadrado con un "Solo los míos" al lado, media cabeza más
// bajo que el desplegable de facciones y sin nada que lo atara a él.
//
// CON SU RÓTULO ENCIMA, como `SelectorMultiple`: es lo que hace que los dos
// controles de una barra de filtros midan lo mismo y se alineen por abajo.
// Las medidas están calculadas para eso — el filete de 1px más los 2px de la
// caja más la línea de texto dan los mismos 26px que el desplegable.
// ============================================================================
import { clsx } from 'clsx'

export interface OpcionDeFiltro<T extends string> {
  valor: T
  etiqueta: string
  /** Cuántos hay de esto. Se pinta pequeño al lado, como en las pestañas del Editor. */
  cuantos?: number
}

export function FiltroSegmentado<T extends string>({
  label,
  opciones,
  valor,
  onChange,
  className,
}: {
  label: string
  opciones: OpcionDeFiltro<T>[]
  valor: T
  onChange: (valor: T) => void
  className?: string
}) {
  return (
    <div className={clsx('min-w-0', className)}>
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="flex gap-0.5 rounded-sm border border-rule-dark/50 bg-parchment/70 p-0.5"
      >
        {opciones.map((opcion) => {
          const activa = opcion.valor === valor
          return (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => onChange(opcion.valor)}
              aria-pressed={activa}
              className={clsx(
                'rounded-[2px] px-2.5 py-0.5 text-xs whitespace-nowrap transition-colors',
                activa
                  ? 'bg-maroon font-semibold text-parchment shadow-sm shadow-black/20'
                  : 'text-ink-soft hover:bg-parchment-dark hover:text-ink',
              )}
            >
              {opcion.etiqueta}
              {opcion.cuantos != null && (
                <span className="ml-1.5 text-mini tabular-nums opacity-70">{opcion.cuantos}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
