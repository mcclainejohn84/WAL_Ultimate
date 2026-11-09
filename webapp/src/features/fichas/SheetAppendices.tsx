// ============================================================================
// Los apéndices de la ficha, DEBAJO de la hoja.
//
// Debajo y no dentro: la hoja de unidad es un formato cerrado —alto máximo fijo
// y lo que se sale se recorta— pensado para exportarse como imagen. Un apéndice
// puede ser media página de texto, así que metido dentro solo conseguiría que
// la hoja se cortara por la mitad. Va a continuación, con la misma tipografía,
// como las páginas de reglas que acompañan a una ficha.
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
// ============================================================================
import { useState } from 'react'
import { AppendixRepository } from '@/data/repositories/appendixRepository'
import { EditorDeApendice } from '@/features/admin/appendices/EditorDeApendice'
import { tieneTexto } from '@/shared/richText'
import { useAsync } from '@/shared/hooks/useAsync'
import { RichText } from '@/shared/ui/RichTextEditor'
import { PencilIcon, PlusIcon } from '@/shared/ui/icons'
import type { ApendiceDueno, UnitAppendix } from '@/domain/types'

export function SheetAppendices({
  kind,
  ownerId,
  grayscale = false,
  editable = false,
}: {
  kind: ApendiceDueno
  ownerId: number
  grayscale?: boolean
  editable?: boolean
}) {
  const { data, reload } = useAsync(
    () => (ownerId > 0 ? AppendixRepository.listByOwner(kind, ownerId) : Promise.resolve([])),
    [kind, ownerId],
  )
  const [editando, setEditando] = useState<UnitAppendix | 'nuevo' | null>(null)

  const conTexto = (data ?? []).filter((a) => tieneTexto(a.bodyHtml) || editable)
  if (conTexto.length === 0 && !editable) return null

  return (
    <div className={grayscale ? 'w-full grayscale' : 'w-full'}>
      {conTexto.map((apendice) => (
        <section
          key={apendice.id}
          className="mt-3 border border-rule-dark/40 bg-[#efe6cd] px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,.18)]"
        >
          <div className="mb-1.5 flex items-baseline gap-2 border-b border-rule-dark/30 pb-1">
            <h3 className="min-w-0 flex-1 font-display text-sm tracking-wide text-ink">{apendice.title}</h3>
            {editable && (
              <button
                type="button"
                onClick={() => setEditando(apendice)}
                aria-label={`Editar ${apendice.title}`}
                title="Editar este apéndice"
                className="shrink-0 rounded-sm p-1 text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
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
            reload()
          }}
        />
      )}
    </div>
  )
}
