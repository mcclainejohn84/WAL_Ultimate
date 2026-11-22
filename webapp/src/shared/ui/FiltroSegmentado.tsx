// ============================================================================
// UN FILTRO DE DOS O TRES OPCIONES EXCLUYENTES, con su rótulo encima.
//
// El control es `Segmentado`; esto le pone el rótulo como `SelectorMultiple`,
// que es lo que hace que los controles de una barra de filtros midan lo mismo
// y se alineen por abajo: el filete de 1px más los 2px de la caja más la línea
// de texto dan los mismos 26px que el desplegable.
// ============================================================================
import { clsx } from 'clsx'
import { Segmentado, type OpcionSegmentada } from './Segmentado'

export type OpcionDeFiltro<T extends string> = OpcionSegmentada<T>

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
      <Segmentado etiqueta={label} opciones={opciones} valor={valor} onChange={onChange} />
    </div>
  )
}
