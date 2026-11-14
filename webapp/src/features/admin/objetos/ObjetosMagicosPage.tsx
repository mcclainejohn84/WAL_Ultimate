// ============================================================================
// "Objetos mágicos" — el catálogo de la Forja: la tabla de características
// mágicas (armas, armaduras, estandartes y amuletos) y los sellos.
//
// Vive en `magic_item_traits` (ver magicItemRepository) y se edita aquí como
// cualquier otro catálogo; lo del código es solo la semilla.
//
// LA CLAVE NO SE EDITA. Es lo que llevan grabado los objetos ya forjados
// (magic_item_powers): cambiarla se la quitaría a todos a la vez. Se escribe
// al crear —sale sola del nombre— y después solo se lee.
//
// Un cambio de precio NO recalcula lo que ya se pagó: un objeto asignado
// guarda lo que costó (ver magic_items.cost), y quitárselo devuelve eso.
// ============================================================================
import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  MagicItemRepository,
  type CaracteristicaInput,
  type FilaDeCaracteristica,
} from '@/data/repositories/magicItemRepository'
import { ETIQUETAS_EN_PLURAL, TIPOS_DE_OBJETO, type TipoDeCaracteristica } from '@/domain/objetosMagicos'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { TextArea } from '@/shared/ui/TextArea'
import { EnteroInput } from '@/shared/ui/EnteroInput'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PencilIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'

const PESTANAS: TipoDeCaracteristica[] = [...TIPOS_DE_OBJETO, 'sello']

/** "Golpe letal" → "arma:golpe-letal". La clave lleva el tipo delante. */
function aClave(tipo: TipoDeCaracteristica, nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${tipo}:${limpio || 'sin-nombre'}`
}

export function ObjetosMagicosPage() {
  const { data: caracteristicas, loading, error, reload } = useAsync(() => MagicItemRepository.listCatalogo())
  const [tipo, setTipo] = useState<TipoDeCaracteristica>('arma')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<FilaDeCaracteristica | 'nueva' | null>(null)
  const [porBorrar, setPorBorrar] = useState<FilaDeCaracteristica | null>(null)
  const [cuantosLaLlevan, setCuantosLaLlevan] = useState<number | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const todas = useMemo(() => caracteristicas ?? [], [caracteristicas])
  const termino = busqueda.trim().toLowerCase()
  const visibles = todas.filter((c) => c.tipo === tipo && (termino === '' || c.nombre.toLowerCase().includes(termino)))
  // Id negativo = viene de la semilla, no de la base: falta desplegar el
  // Worker y todavía no hay nada que editar.
  const sinTabla = todas.some((c) => c.id < 0)

  async function preguntarBorrado(c: FilaDeCaracteristica) {
    setPorBorrar(c)
    setCuantosLaLlevan(null)
    setCuantosLaLlevan(await MagicItemRepository.cuantosLaLlevan(c.clave))
  }

  async function borrar() {
    if (!porBorrar) return
    setFallo(null)
    try {
      await MagicItemRepository.borrarCaracteristica(porBorrar.id)
      setPorBorrar(null)
      reload()
    } catch (err) {
      setFallo(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Objetos mágicos"
        actions={
          <Button variant="primary" onClick={() => setEditando('nueva')} disabled={sinTabla}>
            <PlusIcon className="h-4 w-4" />
            Nueva característica
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-0.5 rounded-sm border border-rule-dark/30 bg-parchment/70 p-0.5">
          {PESTANAS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={t === tipo}
              className={clsx(
                'rounded-sm px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors',
                t === tipo
                  ? 'bg-maroon text-parchment shadow-sm shadow-black/20'
                  : 'text-ink-soft hover:bg-parchment-dark',
              )}
            >
              {ETIQUETAS_EN_PLURAL[t]}
              <span className="ml-1.5 text-mini tabular-nums opacity-70">
                {todas.filter((c) => c.tipo === t).length}
              </span>
            </button>
          ))}
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Filtrar por nombre…"
          className="h-[30px] w-full max-w-xs rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 text-xs outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
        />
      </div>

      {loading && <Spinner />}
      {error && <p className="text-sm text-danger">{error}</p>}
      {fallo && <p className="mb-3 text-sm text-danger">{fallo}</p>}

      {!loading && visibles.length === 0 && <EmptyState title="Sin resultados" />}

      {!loading && visibles.length > 0 && (
        <div className="divide-y divide-rule-dark/20 overflow-hidden rounded-sm border border-rule-dark/40 bg-parchment/70">
          {visibles.map((c) => (
            <div key={c.clave} className="flex items-start justify-between gap-4 px-4 py-2.5">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold text-maroon">
                  {c.nombre}
                  <span className="ml-2 text-xs font-normal tabular-nums text-ink-soft">{c.coste} exp.</span>
                </p>
                {c.descripcion && <p className="mt-0.5 text-sm text-ink-soft">{c.descripcion}</p>}
                <p className="mt-0.5 text-micro tabular-nums text-ink-soft/60">{c.clave}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setEditando(c)}
                  disabled={sinTabla}
                  aria-label={`Editar ${c.nombre}`}
                  title="Editar"
                  className="rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze disabled:opacity-40"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void preguntarBorrado(c)}
                  disabled={sinTabla}
                  aria-label={`Borrar ${c.nombre}`}
                  title="Borrar"
                  className="rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-maroon/10 hover:text-danger disabled:opacity-40"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <FormularioDeCaracteristica
          caracteristica={editando === 'nueva' ? null : editando}
          tipoInicial={tipo}
          clavesUsadas={new Set(todas.map((c) => c.clave))}
          onClose={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null)
            reload()
          }}
        />
      )}

      {porBorrar && (
        <ConfirmDialog
          title="Borrar la característica"
          message={
            cuantosLaLlevan == null
              ? `¿Seguro que borras "${porBorrar.nombre}"?`
              : cuantosLaLlevan === 0
                ? `¿Seguro que borras "${porBorrar.nombre}"? No la lleva ningún objeto.`
                : `"${porBorrar.nombre}" está grabada en ${cuantosLaLlevan} objeto${cuantosLaLlevan === 1 ? '' : 's'}. Si la borras, desaparecerá de ${cuantosLaLlevan === 1 ? 'él' : 'ellos'}.`
          }
          confirmLabel="Sí, borrarla"
          cancelLabel="No"
          onConfirm={() => void borrar()}
          onCancel={() => setPorBorrar(null)}
        />
      )}
    </div>
  )
}

function FormularioDeCaracteristica({
  caracteristica,
  tipoInicial,
  clavesUsadas,
  onClose,
  onGuardada,
}: {
  caracteristica: FilaDeCaracteristica | null
  tipoInicial: TipoDeCaracteristica
  clavesUsadas: Set<string>
  onClose: () => void
  onGuardada: () => void
}) {
  const [nombre, setNombre] = useState(caracteristica?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoDeCaracteristica>(caracteristica?.tipo ?? tipoInicial)
  const [coste, setCoste] = useState<string>(String(caracteristica?.coste ?? 0))
  const [descripcion, setDescripcion] = useState(caracteristica?.descripcion ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const claveNueva = aClave(tipo, nombre)

  async function guardar() {
    if (!nombre.trim()) {
      setError('Ponle un nombre.')
      return
    }
    if (!caracteristica && clavesUsadas.has(claveNueva)) {
      setError('Ya hay una con ese nombre en ese tipo.')
      return
    }
    const input: CaracteristicaInput = {
      clave: claveNueva,
      nombre: nombre.trim(),
      tipo,
      coste: Math.max(0, Math.round(Number(coste) || 0)),
      descripcion: descripcion.trim() || null,
    }
    setGuardando(true)
    setError(null)
    try {
      if (caracteristica) await MagicItemRepository.editarCaracteristica(caracteristica.id, input)
      else await MagicItemRepository.crearCaracteristica(input)
      onGuardada()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={caracteristica ? 'Editar característica' : 'Nueva característica'}
      widthClassName="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void guardar()} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeCaracteristica)}>
            {PESTANAS.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_EN_PLURAL[t]}
              </option>
            ))}
          </Select>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Experiencia</span>
            <EnteroInput
              min={0}
              value={coste}
              onChange={(e) => setCoste(e.target.value)}
              className="w-full rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 py-1 text-xs text-ink outline-none transition-colors focus:border-bronze focus:ring-2 focus:ring-bronze/25"
            />
          </label>
        </div>
        <TextArea label="Qué hace" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <p className="text-micro tabular-nums text-ink-soft/60">{caracteristica?.clave ?? claveNueva}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
