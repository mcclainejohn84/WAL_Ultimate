import type { InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'
import { guardaDeEnteros, limpiaDecimales } from '@/shared/ui/enteros'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/**
 * Campo de texto con su rótulo encima.
 *
 * CUANDO ES `type="number"`, NO ADMITE DECIMALES, y no hace falta pedirlo en
 * cada sitio. Es el componente por el que pasan casi todos los números del
 * programa —costes, puntos, tamaños, atributos, experiencia—, y en ninguno de
 * ellos tiene sentido una coma, así que la regla vive aquí en vez de repetirse
 * (u olvidarse) en catorce pantallas. Ver shared/ui/enteros.
 */
export function TextField({ label, error, className, id, type, onChange, onKeyDown, ...props }: TextFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  const esNumero = type === 'number'
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      <input
        id={inputId}
        type={type}
        step={esNumero ? 1 : undefined}
        inputMode={esNumero ? 'numeric' : undefined}
        onKeyDown={esNumero ? guardaDeEnteros(onKeyDown) : onKeyDown}
        onChange={
          esNumero
            ? (e) => {
                limpiaDecimales(e)
                onChange?.(e)
              }
            : onChange
        }
        className={clsx(
          'w-full rounded-sm border bg-parchment/70 px-3 py-1 text-xs text-ink outline-none transition-colors',
          'focus:border-bronze focus:ring-2 focus:ring-bronze/25',
          error ? 'border-danger' : 'border-rule-dark/50',
          className,
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}
