// ============================================================================
// Los apéndices de la ficha que van DEBAJO de la hoja.
//
// Un apéndice elige dónde sale: DENTRO de la hoja, como una caja colocada en
// el cuadro blanco (ver ApendiceEnFicha), o DEBAJO, que es esta lista. Lo
// segundo es lo que pide un apéndice largo —media página de reglas—: metido
// dentro solo conseguiría que la hoja se cortara por la mitad, porque la hoja
// es un formato cerrado (alto máximo fijo y lo que se sale se recorta).
// Aquí se pasa de un sitio al otro con el botón de la flecha, sin tocar el
// texto: es la misma fila de la base de datos con `in_sheet` a 1 o a 0.
//
// SE EDITAN AQUÍ MISMO (`editable`): el texto sale en la hoja y se retoca sin
// ir al Editor, que es donde se está cuando uno se da cuenta de que sobra una
// línea. Es el mismo diálogo de la pantalla de Apéndices.
//
// Valen para los tres tipos de hoja —unidad, montura y opción—, cada una con
// sus propios apéndices (ver appendixRepository).
//
// Se pinta solo si hay algo que pintar: sin apéndices no enseña ni el título,
// para no dejar un hueco vacío bajo cada hoja. Con `editable` sí se enseña el
// botón de añadir, que si no no habría por dónde empezar.
//
// La LISTA la trae puesta de fuera (FichasPage): la tarjeta de la hoja también
// necesita los apéndices, y dos consultas por separado se quedaban desfasadas
// entre sí en cuanto uno se movía de un sitio al otro.
// ============================================================================
import { useState } from 'react'
import { EditorDeApendice } from '@/features/admin/appendices/EditorDeApendice'
import { tieneTexto } from '@/shared/richText'
import { RichText } from '@/shared/ui/RichTextEditor'
import { ArrowUpIcon, PencilIcon, PlusIcon } from '@/shared/ui/icons'
import type { ApendiceDueno, UnitAppendix } from '@/domain/types'

export function SheetAppendices({
  kind,
  ownerId,
  apendices,
  grayscale = false,
  editable = false,
  onMeter,
  onCambio,
}: {
  kind: ApendiceDueno
  ownerId: number
  /** TODOS los de esta ficha; aquí se enseñan solo los que no están pegados dentro. */
  apendices: UnitAppendix[]
  grayscale?: boolean
  editable?: boolean
  /** "Ponerlo en la ficha": lo decide FichasPage, que es quien sabe dónde cabe. */
  onMeter?: (apendice: UnitAppendix) => void
  onCambio?: () => void
}) {
  const [editando, setEditando] = useState<UnitAppendix | 'nuevo' | null>(null)

  const debajo = apendices.filter((a) => !a.inSheet).filter((a) => tieneTexto(a.bodyHtml) || editable)
  if (debajo.length === 0 && !editable) return null

  return (
    <div className={grayscale ? 'w-full grayscale' : 'w-full'}>
      {debajo.map((apendice) => (
        <section
          key={apendice.id}
          className="mt-3 border border-rule-dark/40 bg-[#efe6cd] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,.18)]"
        >
          <div className="mb-1.5 flex items-baseline gap-2 border-b border-rule-dark/30 pb-1">
            <h3 className="min-w-0 flex-1 font-display text-sm tracking-wide text-ink">{apendice.title}</h3>
            {editable && (
              <>
                <button
                  type="button"
                  onClick={() => onMeter?.(apendice)}
                  aria-label={`Poner ${apendice.title} en la ficha`}
                  title="Ponerlo dentro de la ficha (luego se coloca arrastrándolo)"
                  className="shrink-0 rounded-sm p-1 text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze"
                >
                  <ArrowUpIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(apendice)}
                  aria-label={`Editar ${apendice.title}`}
                  title="Editar este apéndice"
                  className="shrink-0 rounded-sm p-1 text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
          <RichText html={apendice.bodyHtml} className="text-xs leading-relaxed text-ink" />
        </section>
      ))}

      {editable && (
        <button
          type="button"
          onClick={() => setEditando('nuevo')}
          className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-rule-dark/40 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-parchment-dark hover:text-ink"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Añadir apéndice
        </button>
      )}

      {editando && (
        <EditorDeApendice
          apendice={editando === 'nuevo' ? null : editando}
          duenoFijo={{ kind, id: ownerId }}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            onCambio?.()
          }}
        />
      )}
    </div>
  )
}
