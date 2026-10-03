// ============================================================================
// Campo de contraseña, con el interruptor para VERLA.
//
// POR QUÉ EXISTE Y NO ES UN TextField CON type="password". Porque escribir a
// ciegas una contraseña que no se ve es la causa número uno de "no me deja
// entrar": una mayúscula que se coló, el teclado en otro idioma, una letra de
// más. En este programa duele el doble, porque al crear o restablecer hay que
// teclearla DOS veces sin verla ninguna, y porque no hay correo de recuperación
// detrás que arregle el estropicio.
//
// EL OJO EMPIEZA APAGADO, SIEMPRE. Mostrarla es algo que se pide, no algo que
// se hereda del campo anterior o de la vez pasada: quien escribe su contraseña
// delante de otra persona cuenta con que no se vea, y romper esa expectativa
// una sola vez ya es una contraseña enseñada sin querer.
//
// El botón es `type="button"` A PROPÓSITO: dentro de un formulario, un <button>
// sin tipo es `submit`, así que el ojo enviaría el formulario — y en la pantalla
// de acceso eso es intentar entrar con la contraseña a medio escribir.
// ============================================================================
import { useId, useState, type InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'
import { EyeIcon, EyeOffIcon } from '@/shared/ui/icons'

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string
}

export function PasswordField({ label, error, className, id, ...props }: PasswordFieldProps) {
  // `useId` y no el texto del rótulo (como hace TextField): en esta misma
  // pantalla hay tres contraseñas, y dos de ellas podrían llegar a llamarse
  // igual. Dos <input> con el mismo id hacen que el rótulo de uno enfoque al
  // otro, que es de esos fallos que no se ven hasta que alguien se queja.
  const generado = useId()
  const inputId = id ?? `password-${generado}`
  const [visible, setVisible] = useState(false)
  const rotulo = visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={clsx(
            // `pr-9` deja el hueco del ojo: sin él, el texto pasa por debajo
            // del icono justo cuando la contraseña es larga.
            'w-full rounded-sm border bg-parchment/70 py-1 pr-9 pl-3 text-xs text-ink outline-none transition-colors',
            'focus:border-bronze focus:ring-2 focus:ring-bronze/25',
            error ? 'border-danger' : 'border-rule-dark/50',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={rotulo}
          title={rotulo}
          className="absolute inset-y-0 right-0 flex items-center rounded-sm px-2 text-ink-soft/70 transition-colors hover:text-ink"
        >
          {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  )
}
