// ============================================================================
// Las piezas sueltas que comparten los diálogos de un Personaje de Renombre
// (habilidades, cicatrices y magia): el encabezado de un grupo, el botón de
// "qué hace" y la descripción que despliega.
//
// Estaban definidas dentro de HabilidadesModal y las copiaron después los
// otros dos diálogos. Tres copias de la misma "i" es justo como empiezan a
// divergir: una con `h-3.5` y otra con `h-4`, una en bronce y otra en granate,
// y los tres diálogos abiertos uno detrás de otro dejan de parecer el mismo
// programa. Aquí hay una sola definición.
// ============================================================================
import { clsx } from 'clsx'
import { InfoIcon } from '@/shared/ui/icons'

/** Cabecera de un grupo: rótulo, filete hasta el borde y cuántas hay. */
export function EncabezadoDeGrupo({ etiqueta, cuantas }: { etiqueta: string; cuantas: number }) {
  return (
    <div className="mb-0.5 flex items-center gap-2">
      <span className="text-micro font-semibold uppercase tracking-[0.16em] text-bronze">{etiqueta}</span>
      <span className="h-px flex-1 bg-rule-dark/25" />
      <span className="text-micro tabular-nums text-ink-soft/70">{cuantas}</span>
    </div>
  )
}

/**
 * El botón de "qué hace". Es un icono y no la palabra: en una lista de 70
 * entradas el texto repetido setenta veces pesa más que los nombres, que son
 * lo que se viene a leer.
 *
 * NO ES UN `hover`. Tailwind compila `hover:` dentro de `@media (hover:hover)`,
 * así que en un móvil no existiría; y una descripción de seis líneas no cabe en
 * un globo. Se pulsa y se despliega debajo.
 */
export function BotonDeInfo({ nombre, abierto, onClick }: { nombre: string; abierto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={abierto}
      aria-label={`Qué hace: ${nombre}`}
      title={`Qué hace: ${nombre}`}
      className={clsx(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
        abierto ? 'text-maroon' : 'text-ink-soft/45 hover:text-bronze',
      )}
    >
      <InfoIcon className="h-3.5 w-3.5" />
    </button>
  )
}

/** Lo que hace una habilidad, desplegado bajo su fila como una nota al margen. */
export function Descripcion({ texto }: { texto: string }) {
  return (
    <p className="mt-1 mb-0.5 border-l-2 border-bronze/40 bg-parchment-dark/20 px-2 py-1 text-mini leading-relaxed text-ink-soft">
      {texto}
    </p>
  )
}
