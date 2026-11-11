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
import { useState } from 'react'
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

/**
 * LO QUE TIENE EL PERSONAJE, para mirarlo y nada más.
 *
 * Es lo que se enseña en el personaje de OTRO jugador: su crónica se ve
 * entera —sus habilidades, sus cicatrices, su magia, con lo que hace cada
 * cosa— y lo que desaparece es el catálogo de lo que podría comprar y los
 * botones de adquirir y devolver. Ver no es editar (ver esEditablePor).
 *
 * Una sola pieza para los tres diálogos: tres listas calcadas escritas tres
 * veces es como empezaron a divergir las de arriba.
 */
export function LoQueTiene({
  etiqueta,
  cosas,
  vacio,
}: {
  etiqueta: string
  cosas: { clave: string; nombre: string; detalle?: string | null; descripcion?: string | null }[]
  /** Qué poner cuando no tiene ninguna. Sin esto, el grupo no se pinta. */
  vacio?: string
}) {
  const [abierta, setAbierta] = useState<string | null>(null)
  if (cosas.length === 0 && !vacio) return null
  return (
    <div className="mt-2 first:mt-0">
      <EncabezadoDeGrupo etiqueta={etiqueta} cuantas={cosas.length} />
      {cosas.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule-dark/30 px-3 py-2 text-center text-mini italic text-ink-soft">
          {vacio}
        </p>
      ) : (
        <ul className="divide-y divide-rule-dark/12">
          {cosas.map((c) => (
            <li key={c.clave} className="px-0.5 py-1">
              <div className="flex items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="min-w-0 truncate text-xs font-medium text-ink">{c.nombre}</span>
                  {c.descripcion && (
                    <BotonDeInfo
                      nombre={c.nombre}
                      abierto={abierta === c.clave}
                      onClick={() => setAbierta(abierta === c.clave ? null : c.clave)}
                    />
                  )}
                </span>
                {c.detalle && <span className="shrink-0 text-mini text-ink-soft/80">{c.detalle}</span>}
              </div>
              {abierta === c.clave && c.descripcion && <Descripcion texto={c.descripcion} />}
            </li>
          ))}
        </ul>
      )}
    </div>
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
