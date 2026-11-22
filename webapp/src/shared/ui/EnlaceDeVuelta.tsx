// ============================================================================
// EL CAMINO DE VUELTA de una página que cuelga de otra (la Forja, la ficha de
// un personaje, la hoja de experiencia de batalla… cuelgan de Personajes de
// Renombre). Siempre el mismo: flecha, el nombre de adonde vuelve y el mismo
// hueco hasta la cabecera.
// ============================================================================
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from './icons'

export function EnlaceDeVuelta({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="mb-3 inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-soft transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-bronze/50 focus-visible:outline-none"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      {children}
    </Link>
  )
}
