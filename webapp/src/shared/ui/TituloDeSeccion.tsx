// ============================================================================
// EL RÓTULO DE UNA SECCIÓN DENTRO DE UNA PÁGINA.
//
// Letra de título, el recuento pequeño al lado, un filete que se desvanece
// hasta el borde y, si hace falta, algo a la derecha (un botón, un total).
// Con `numero` lleva delante el círculo granate de los pasos de una hoja.
//
// Es el mismo rótulo en la ficha de un personaje, en la hoja de experiencia
// de batalla y en las facciones de la vista clásica: antes cada uno ponía el
// recuento a un lado distinto del filete.
// ============================================================================
import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export function TituloDeSeccion({
  titulo,
  numero,
  cuantos,
  extra,
  como: Etiqueta = 'h2',
  className,
}: {
  titulo: ReactNode
  numero?: number
  cuantos?: number
  extra?: ReactNode
  como?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <Etiqueta className={clsx('flex min-h-6 items-center gap-2.5', className)}>
      {numero != null && (
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-maroon font-display text-xs font-bold text-parchment">
          {numero}
        </span>
      )}
      <span className="min-w-0 truncate font-display text-lg leading-none font-bold tracking-wide text-ink">
        {titulo}
      </span>
      {cuantos != null && <span className="shrink-0 text-xs tabular-nums text-ink-soft/70">{cuantos}</span>}
      <span aria-hidden className="h-px min-w-6 flex-1 bg-gradient-to-r from-rule-dark/45 to-transparent" />
      {extra}
    </Etiqueta>
  )
}
