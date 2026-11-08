// ============================================================================
// Sendas de magia de una entrada de lista, cada una con su NIVEL.
//
// Los nombres van en MINÚSCULAS aquí (a petición del usuario): en el catálogo
// son nombres propios ("Fuego", "Nigromancia") pero dentro de la lista se leen
// como lo que lleva la miniatura, no como títulos.
//
// COMPOSICIÓN. Son 30 sendas en el catálogo y un hechicero lleva dos o tres.
// Pintar las 30 con su casilla y su selector de nivel llenaría la pantalla de
// controles apagados. Aquí solo se ven las ELEGIDAS —una línea por senda, con
// su nivel y su papelera— más un único desplegable para añadir la siguiente.
// La sección crece con lo que de verdad lleva el personaje y no con el tamaño
// del catálogo.
//
// El nivel va por senda porque puede ser distinto en cada una: Fuego a 2 y
// Bestias a 1 en el mismo hechicero.
//
// Cerrada por defecto (ver ArmyListBuilderPage): la mayoría de entradas no son
// hechiceros, y de las que lo son, no siempre se toca la magia al editarlas.
//
// EL CUERPO VA APARTE (ListaDeSendas) porque se usa en tres sitios con la
// misma pinta y distinto permiso: aquí dentro, editable; aquí dentro en SOLO
// LECTURA cuando la entrada es de un Personaje de Renombre, cuya magia se
// decide en su pantalla y no en la lista; y en esa pantalla suya, otra vez
// editable y ya sin el plegado, porque allí el diálogo se abrió para esto.
// ============================================================================
import { clsx } from 'clsx'
import { MAGIC_GROUPS, MAGIC_GROUP_LABELS, MAGIC_LEVELS, type MagicPath } from '@/domain/magic'
import { ChevronRightIcon, TrashIcon } from '@/shared/ui/icons'
import type { EntryMagicPath } from '@/domain/types'

/**
 * "NIGROMANCIA" → "Nigromancia", "Fuego" → "Fuego".
 *
 * No basta con capitalizar la primera letra: hay que bajar el resto, porque lo
 * que llega del catálogo puede venir ya en mayúsculas. Solo toca la primera
 * palabra, que es lo correcto en español ("Manuscritos de nigromancia").
 */
function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase('es')
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1)
}

/** Resumen de una línea para la cabecera plegada: "Fuego 2 · Bestias 1". */
function resumenDeSendas(paths: MagicPath[], value: EntryMagicPath[]): string {
  const pathById = new Map(paths.map((p) => [p.id, p]))
  return value.map((v) => `${sentenceCase(pathById.get(v.pathId)?.name ?? '—')} ${v.level}`).join(' · ')
}

interface ListaDeSendasProps {
  paths: MagicPath[]
  value: EntryMagicPath[]
  /** No hace falta en solo lectura. */
  onChange?: (next: EntryMagicPath[]) => void
  /** Se ven las sendas con su nivel, pero no se pueden tocar. */
  readOnly?: boolean
}

/**
 * Las sendas elegidas y, debajo, el desplegable para añadir la siguiente. En
 * solo lectura se queda en la lista: sin botones de nivel, sin papelera y sin
 * desplegable.
 */
export function ListaDeSendas({ paths, value, onChange, readOnly = false }: ListaDeSendasProps) {
  const pathById = new Map(paths.map((p) => [p.id, p]))
  const chosenIds = new Set(value.map((v) => v.pathId))
  const available = paths.filter((p) => !chosenIds.has(p.id))

  function add(pathId: number) {
    // Nivel 1 de salida: es el más común y siempre se puede subir. Lo que no
    // se puede es adivinar cuál quería el usuario.
    onChange?.([...value, { pathId, level: 1 }])
  }
  function setLevel(pathId: number, level: number) {
    onChange?.(value.map((v) => (v.pathId === pathId ? { ...v, level } : v)))
  }
  function remove(pathId: number) {
    onChange?.(value.filter((v) => v.pathId !== pathId))
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && readOnly && (
        <p className="rounded-sm border border-dashed border-rule-dark/30 px-3 py-2 text-center text-mini italic text-ink-soft">
          Sin sendas.
        </p>
      )}

      {value.length > 0 && (
        <ul className="divide-y divide-rule-dark/15 overflow-hidden rounded-sm border border-rule-dark/25">
          {value.map((chosen) => {
            const path = pathById.get(chosen.pathId)
            return (
              <li key={chosen.pathId} className="flex items-center gap-2 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-ink">
                  {sentenceCase(path?.name ?? 'senda borrada')}
                  {path && (
                    <span className="ml-1.5 text-mini text-ink-soft/70">
                      {sentenceCase(MAGIC_GROUP_LABELS[path.group])}
                    </span>
                  )}
                </span>

                {readOnly ? (
                  <span className="shrink-0 rounded-sm border border-rule-dark/30 bg-parchment-dark/40 px-1.5 py-0.5 text-mini font-medium tabular-nums text-ink-soft">
                    Nivel {chosen.level}
                  </span>
                ) : (
                  <>
                    {/* Nivel como botones y no como desplegable: son cuatro
                        valores y así el nivel se ve sin desplegar nada. */}
                    <span className="flex shrink-0 overflow-hidden rounded-sm border border-rule-dark/40">
                      {MAGIC_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setLevel(chosen.pathId, level)}
                          aria-pressed={chosen.level === level}
                          title={`Nivel ${level}`}
                          className={clsx(
                            'w-6 py-0.5 text-mini font-medium tabular-nums transition-colors',
                            chosen.level === level
                              ? 'bg-maroon text-parchment'
                              : 'bg-parchment text-ink-soft hover:bg-parchment-dark',
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </span>

                    <button
                      type="button"
                      onClick={() => remove(chosen.pathId)}
                      aria-label={`Quitar ${path?.name ?? 'la senda'}`}
                      title="Quitar"
                      className="shrink-0 rounded-sm px-1 py-0.5 text-ink-soft hover:bg-maroon/10 hover:text-danger"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!readOnly &&
        (available.length > 0 ? (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) add(Number(e.target.value))
            }}
            className="w-full rounded-sm border border-rule-dark/40 bg-parchment px-2 py-1.5 text-xs text-ink outline-none focus:border-bronze"
          >
            <option value="">+ Añadir senda…</option>
            {MAGIC_GROUPS.map((group) => {
              const groupPaths = available.filter((p) => p.group === group)
              if (groupPaths.length === 0) return null
              return (
                <optgroup key={group} label={sentenceCase(MAGIC_GROUP_LABELS[group])}>
                  {groupPaths.map((path) => (
                    <option key={path.id} value={path.id}>
                      {sentenceCase(path.name)}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        ) : (
          paths.length === 0 && <p className="text-xs text-ink-soft italic">No hay sendas en el catálogo.</p>
        ))}
    </div>
  )
}

interface EntryMagicSectionProps {
  paths: MagicPath[]
  value: EntryMagicPath[]
  onChange?: (next: EntryMagicPath[]) => void
  open: boolean
  onToggle: () => void
  /**
   * La entrada enseña su magia pero no la cambia: es de un Personaje de
   * Renombre y se decide en su pantalla.
   */
  readOnly?: boolean
}

export function EntryMagicSection({ paths, value, onChange, open, onToggle, readOnly }: EntryMagicSectionProps) {
  const resumen = resumenDeSendas(paths, value)
  return (
    <div className="overflow-hidden rounded-sm border border-rule-dark/30">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 bg-parchment-dark/40 px-2.5 py-1.5 text-left hover:bg-parchment-dark"
      >
        <span className="text-[10.5px] font-semibold tracking-wide text-ink-soft">
          Magia
          {/* El resumen en la cabecera evita tener que abrir la sección solo
              para comprobar qué lleva. */}
          {resumen && <span className="ml-2 font-normal text-bronze">{resumen}</span>}
        </span>
        <ChevronRightIcon className={clsx('h-3.5 w-3.5 text-ink-soft transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="p-2.5">
          <ListaDeSendas paths={paths} value={value} onChange={onChange} readOnly={readOnly} />
        </div>
      )}
    </div>
  )
}
