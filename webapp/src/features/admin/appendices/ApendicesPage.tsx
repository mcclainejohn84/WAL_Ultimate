// ============================================================================
// "Apéndices y reglas adicionales" — todos los bloques de texto del programa
// en una sola pantalla, vengan de donde vengan.
//
// Un apéndice cuelga de algo: una facción, una unidad (o un personaje, que es
// una unidad), una opción de equipo, una mejora, una montura o un carro. Aquí
// se ven todos juntos, se filtran por facción y por tipo de dueño, y se
// escriben con el mismo editor que en la ficha de unidad.
//
// POR FACCIÓN PRIMERO, porque es como se trabaja: uno se sienta a repasar los
// Hombres Bestia, no "todas las monturas del juego". Lo que NO pertenece a
// ninguna facción —una opción de equipo que no usa todavía nadie— sale con
// el filtro en "Todas".
// ============================================================================
import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  AppendixRepository,
  DUENOS,
  ETIQUETAS_DE_DUENO,
  listarDuenos,
  type DuenoPosible,
} from '@/data/repositories/appendixRepository'
import { FactionRepository } from '@/data/repositories/factionRepository'
import { aTextoPlano, tieneTexto } from '@/shared/richText'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Select } from '@/shared/ui/Select'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LockIcon, PencilIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'
import { EditorDeApendice } from '@/features/admin/appendices/EditorDeApendice'
import type { ApendiceDueno, UnitAppendix } from '@/domain/types'

const TODAS = 'todas'
const TODO = 'todo'

export function ApendicesPage() {
  const { data: apendices, loading, reload } = useAsync(() => AppendixRepository.listAll())
  const { data: duenos } = useAsync(() => listarDuenos())
  const { data: facciones } = useAsync(() => FactionRepository.listAll())

  const [faccion, setFaccion] = useState<string>(TODAS)
  const [tipo, setTipo] = useState<ApendiceDueno | typeof TODO>(TODO)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<UnitAppendix | 'nuevo' | null>(null)
  const [porBorrar, setPorBorrar] = useState<UnitAppendix | null>(null)
  const [error, setError] = useState<string | null>(null)

  const porClave = useMemo(() => new Map((duenos ?? []).map((d) => [`${d.kind}:${d.id}`, d])), [duenos])

  const faccionId = faccion === TODAS ? null : Number(faccion)

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return (apendices ?? []).filter((a) => {
      const dueno = porClave.get(`${a.ownerKind}:${a.ownerId}`)
      if (tipo !== TODO && a.ownerKind !== tipo) return false
      if (faccionId != null && !(dueno?.factionIds ?? []).includes(faccionId)) return false
      if (!termino) return true
      return (
        a.title.toLowerCase().includes(termino) ||
        (dueno?.nombre ?? '').toLowerCase().includes(termino) ||
        aTextoPlano(a.bodyHtml).toLowerCase().includes(termino)
      )
    })
  }, [apendices, porClave, tipo, faccionId, busqueda])

  /** Agrupados por dueño, que es como se leen: "lo que lleva encima esta unidad". */
  const grupos = useMemo(() => {
    const mapa = new Map<
      string,
      { dueno: DuenoPosible | undefined; kind: ApendiceDueno; id: number; lista: UnitAppendix[] }
    >()
    for (const a of visibles) {
      const clave = `${a.ownerKind}:${a.ownerId}`
      const grupo = mapa.get(clave)
      if (grupo) grupo.lista.push(a)
      else mapa.set(clave, { dueno: porClave.get(clave), kind: a.ownerKind, id: a.ownerId, lista: [a] })
    }
    return [...mapa.values()].sort(
      (a, b) =>
        DUENOS.indexOf(a.kind) - DUENOS.indexOf(b.kind) ||
        (a.dueno?.nombre ?? '').localeCompare(b.dueno?.nombre ?? '', 'es'),
    )
  }, [visibles, porClave])

  const cuantosPorTipo = useMemo(() => {
    const cuenta = new Map<ApendiceDueno, number>()
    for (const a of apendices ?? []) {
      const dueno = porClave.get(`${a.ownerKind}:${a.ownerId}`)
      if (faccionId != null && !(dueno?.factionIds ?? []).includes(faccionId)) continue
      cuenta.set(a.ownerKind, (cuenta.get(a.ownerKind) ?? 0) + 1)
    }
    return cuenta
  }, [apendices, porClave, faccionId])

  async function borrar() {
    if (!porBorrar) return
    setError(null)
    try {
      await AppendixRepository.remove(porBorrar.id)
      setPorBorrar(null)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Apéndices y reglas adicionales"
        actions={
          <Button variant="primary" onClick={() => setEditando('nuevo')}>
            <PlusIcon className="h-4 w-4" />
            Nuevo apéndice
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Select label="Facción" value={faccion} onChange={(e) => setFaccion(e.target.value)}>
            <option value={TODAS}>Todas las facciones</option>
            {(facciones ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-0.5 rounded-sm border border-rule-dark/30 bg-parchment/70 p-0.5">
          <button
            type="button"
            onClick={() => setTipo(TODO)}
            aria-pressed={tipo === TODO}
            className={clsx(
              'rounded-sm px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors',
              tipo === TODO
                ? 'bg-maroon text-parchment shadow-sm shadow-black/20'
                : 'text-ink-soft hover:bg-parchment-dark',
            )}
          >
            Todo
          </button>
          {DUENOS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTipo(k)}
              aria-pressed={tipo === k}
              className={clsx(
                'rounded-sm px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors',
                tipo === k
                  ? 'bg-maroon text-parchment shadow-sm shadow-black/20'
                  : 'text-ink-soft hover:bg-parchment-dark',
              )}
            >
              {ETIQUETAS_DE_DUENO[k]}
              <span className="ml-1.5 text-mini tabular-nums opacity-70">{cuantosPorTipo.get(k) ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Filtrar por título, dueño o texto…"
          className="h-[30px] w-full max-w-xs rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 text-xs outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
        />
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {loading && <Spinner />}
      {!loading && grupos.length === 0 && <EmptyState title="Sin apéndices" />}

      {!loading && grupos.length > 0 && (
        <div className="space-y-4">
          {grupos.map((grupo) => (
            <section key={`${grupo.kind}:${grupo.id}`}>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-micro font-semibold tracking-[0.16em] text-bronze uppercase">
                  {ETIQUETAS_DE_DUENO[grupo.kind]}
                </span>
                <span className="font-display text-base font-semibold text-ink">
                  {grupo.dueno?.nombre ?? `#${grupo.id}`}
                </span>
                <span className="h-px flex-1 bg-rule-dark/25" />
                <span className="text-micro tabular-nums text-ink-soft/70">{grupo.lista.length}</span>
              </div>
              <div className="divide-y divide-rule-dark/20 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
                {grupo.lista.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold text-maroon">{a.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">
                        {tieneTexto(a.bodyHtml) ? aTextoPlano(a.bodyHtml) : 'Sin texto'}
                      </p>
                    </div>
                    {/* El personaje de renombre de OTRO se ve pero no se
                        toca, tampoco por aquí (ver listarDuenos). */}
                    <div className="flex shrink-0 items-center gap-1 pt-0.5">
                      {grupo.dueno?.editable === false ? (
                        <span className="p-1.5 text-ink-soft/60" title="De otro jugador">
                          <LockIcon className="h-4 w-4" />
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditando(a)}
                            aria-label={`Editar ${a.title}`}
                            title="Editar"
                            className="rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPorBorrar(a)}
                            aria-label={`Borrar ${a.title}`}
                            title="Borrar"
                            className="rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-maroon/10 hover:text-danger"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editando && (
        <EditorDeApendice
          apendice={editando === 'nuevo' ? null : editando}
          duenos={duenos ?? []}
          faccionElegida={faccionId}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            reload()
          }}
        />
      )}

      {porBorrar && (
        <ConfirmDialog
          title="Borrar el apéndice"
          message={`¿Seguro que borras "${porBorrar.title}"? El texto se pierde.`}
          confirmLabel="Sí, borrarlo"
          cancelLabel="Cancelar"
          onConfirm={() => void borrar()}
          onCancel={() => setPorBorrar(null)}
        />
      )}
    </div>
  )
}
