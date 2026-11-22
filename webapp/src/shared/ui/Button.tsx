import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'border-maroon bg-maroon text-parchment hover:bg-maroon-dark shadow-sm shadow-black/20',
  secondary: 'border-rule-dark/60 bg-parchment text-ink hover:bg-parchment-dark',
  ghost: 'border-transparent text-ink-soft hover:bg-parchment-dark/70',
  danger: 'border-danger bg-danger text-parchment hover:bg-danger-dark shadow-sm shadow-black/20',
}

type Size = 'sm' | 'md'

/** `sm` es para las barras de acciones de una ficha: varios botones seguidos que no son la acción de la página. */
const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        // El anillo de foco es `focus-visible` y no `focus`: solo aparece al
        // navegar con teclado, no al hacer clic con el ratón. Los campos de
        // texto ya lo tenían; los botones no tenían ninguno, así que con el
        // tabulador no se veía dónde estabas.
        // Todas llevan filete, transparente si no se ve: así un botón granate
        // y uno de pergamino puestos al lado miden lo mismo.
        'inline-flex items-center justify-center gap-1.5 rounded-sm border font-medium tracking-wide transition-colors',
        SIZE_CLASSES[size],
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/50 focus-visible:ring-offset-1 focus-visible:ring-offset-parchment',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
