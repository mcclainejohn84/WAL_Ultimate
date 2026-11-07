// ============================================================================
// Un `<input type="number">` que SOLO admite enteros, para los campos sueltos
// que no pasan por TextField: los de dentro de una tabla, el coste escrito a
// mano del constructor, los costes del grupo de mando… TextField ya trae la
// misma regla puesta por su cuenta.
//
// El porqué de todo esto —y por qué las medidas en centímetros se quedan
// fuera— está en shared/ui/enteros.ts, que es donde vive la regla.
// ============================================================================
import type { InputHTMLAttributes } from 'react'
import { guardaDeEnteros, limpiaDecimales } from '@/shared/ui/enteros'

export function EnteroInput({
  onChange,
  onKeyDown,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'step'>) {
  return (
    <input
      {...props}
      type="number"
      step={1}
      inputMode="numeric"
      onKeyDown={guardaDeEnteros(onKeyDown)}
      onChange={(e) => {
        limpiaDecimales(e)
        onChange?.(e)
      }}
    />
  )
}
