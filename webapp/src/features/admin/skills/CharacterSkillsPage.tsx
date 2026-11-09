// ============================================================================
// "Habilidades de personaje" — el catálogo que compran los Personajes de
// Renombre con su experiencia: rangos, mejoras de atributo, habilidades y
// características sociales.
//
// Hasta ahora era una lista escrita en el código. Vive en `character_skills`
// (ver characterSkillRepository) y se edita aquí como cualquier otro
// catálogo.
//
// LA CLAVE NO SE EDITA. Es lo que queda apuntado en la ficha de cada
// personaje (unit_skills): cambiarla les quitaría la habilidad a todos a la
// vez. Se escribe al crear —sale sola del nombre— y después solo se lee.
//
// LAS CARACTERÍSTICAS SOCIALES NO LLEVAN PRECIO. No lo pone la característica
// sino cuántas lleva ya el personaje (8 la primera, 12 la segunda, ver
// domain/habilidadesDeRenombre), así que el campo ni se ofrece.
// ============================================================================
import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  CharacterSkillRepository,
  type FilaDeHabilidad,
  type HabilidadInput,
} from '@/data/repositories/characterSkillRepository'
import { ETIQUETAS_DE_TIPO, ORDEN_DE_TIPOS, type TipoDeHabilidad } from '@/domain/habilidadesDeRenombre'
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

/** "Golpe certero" → "golpe-certero". La clave se construye con el tipo delante. */
function aClave(tipo: TipoDeHabilidad, nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${tipo}:${limpio || 'sin-nombre'}`
}

export function CharacterSkillsPage() {
  const { data: habilidades, loading, error, reload } = useAsync(() => CharacterSkillRepository.list())
  const [tipo, setTipo] = useState<TipoDeHabilidad>('habilidad')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<FilaDeHabilidad | 'nueva' | null>(null)
  const [porBorrar, setPorBorrar] = useState<FilaDeHabilidad | null>(null)
  const [cuantosLaTienen, setCuantosLaTienen] = useState<number | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  const todas = useMemo(() => habilidades ?? [], [habilidades])
  const termino = busqueda.trim().toLowerCase()
  const visibles = todas.filter((h) => h.tipo === tipo && (termino === '' || h.nombre.toLowerCase().includes(termino)))
  // Una entrada con id negativo es de la semilla, no de la base: la tabla
  // todavía no existe (falta desplegar el Worker) y no hay nada que editar.
  const sinTabla = todas.some((h) => h.id < 0)

  async function preguntarBorrado(h: FilaDeHabilidad) {
    setPorBorrar(h)
    setCuantosLaTienen(null)
    setCuantosLaTienen(await CharacterSkillRepository.cuantosLaTienen(h.clave))
  }

  async function borrar() {
    if (!porBorrar) return
    setFallo(null)
    try {
      await CharacterSkillRepository.remove(porBorrar.id)
      setPorBorrar(null)
      reload()
    } catch (err) {
      setFallo(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Habilidades de personaje"
        actions={
          <Button variant="primary" onClick={() => setEditando('nueva')} disabled={sinTabla}>
            <PlusIcon className="h-4 w-4" />
            Nueva habilidad
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-0.5 rounded-sm border border-rule-dark/30 bg-parchment/70 p-0.5">
          {ORDEN_DE_TIPOS.map((t) => (
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
              {ETIQUETAS_DE_TIPO[t]}
              <span className="ml-1.5 text-mini tabular-nums opacity-70">
                {todas.filter((h) => h.tipo === t).length}
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
          {visibles.map((h) => (
            <div key={h.clave} className="group flex items-start justify-between gap-4 px-4 py-2.5">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold text-maroon">
                  {h.nombre}
                  {h.coste != null && (
                    <span className="ml-2 text-xs font-normal tabular-nums text-ink-soft">{h.coste} exp.</span>
                  )}
                </p>
                {h.descripcion && <p className="mt-0.5 text-sm text-ink-soft">{h.descripcion}</p>}
                <p className="mt-0.5 text-micro tabular-nums text-ink-soft/60">{h.clave}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setEditando(h)}
                  disabled={sinTabla}
                  aria-label={`Editar ${h.nombre}`}
                  title="Editar"
                  className="rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze disabled:opacity-40"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void preguntarBorrado(h)}
                  disabled={sinTabla}
                  aria-label={`Borrar ${h.nombre}`}
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
        <FormularioDeHabilidad
          habilidad={editando === 'nueva' ? null : editando}
          tipoInicial={tipo}
          clavesUsadas={new Set(todas.map((h) => h.clave))}
          onClose={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null)
            reload()
          }}
        />
      )}

      {porBorrar && (
        <ConfirmDialog
          title="Borrar la habilidad"
          message={
            cuantosLaTienen == null
              ? `¿Seguro que borras "${porBorrar.nombre}" del catálogo?`
              : cuantosLaTienen === 0
                ? `¿Seguro que borras "${porBorrar.nombre}" del catálogo? No la tiene ningún personaje.`
                : `"${porBorrar.nombre}" la tienen ${cuantosLaTienen} personaje(s). Si la borras del catálogo, dejará de verse en sus fichas y en sus hojas de ejército, pero su apunte de experiencia se queda.`
          }
          confirmLabel="Sí, borrarla"
          cancelLabel="Cancelar"
          onConfirm={() => void borrar()}
          onCancel={() => setPorBorrar(null)}
        />
      )}
    </div>
  )
}

function FormularioDeHabilidad({
  habilidad,
  tipoInicial,
  clavesUsadas,
  onClose,
  onGuardada,
}: {
  habilidad: FilaDeHabilidad | null
  tipoInicial: TipoDeHabilidad
  clavesUsadas: Set<string>
  onClose: () => void
  onGuardada: () => void
}) {
  const [nombre, setNombre] = useState(habilidad?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoDeHabilidad>(habilidad?.tipo ?? tipoInicial)
  const [coste, setCoste] = useState(habilidad?.coste != null ? String(habilidad.coste) : '')
  const [descripcion, setDescripcion] = useState(habilidad?.descripcion ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clave = habilidad?.clave ?? aClave(tipo, nombre)
  const esSocial = tipo === 'social'

  async function guardar() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!habilidad && clavesUsadas.has(clave)) {
      setError(`Ya hay una habilidad con la clave ${clave}.`)
      return
    }
    setGuardando(true)
    setError(null)
    const datos: HabilidadInput = {
      clave,
      nombre: nombre.trim(),
      tipo,
      coste: esSocial ? null : Number(coste || 0),
      descripcion: descripcion.trim() || null,
    }
    try {
      if (habilidad) {
        await CharacterSkillRepository.update(habilidad.id, datos)
      } else {
        await CharacterSkillRepository.create(datos)
      }
      onGuardada()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={habilidad ? 'Editar habilidad' : 'Nueva habilidad'}
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
          <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeHabilidad)}>
            {ORDEN_DE_TIPOS.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_DE_TIPO[t]}
              </option>
            ))}
          </Select>
          {!esSocial && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Experiencia</span>
              <EnteroInput
                min={0}
                value={coste}
                onChange={(e) => setCoste(e.target.value)}
                className="w-full rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 py-1 text-xs text-ink outline-none transition-colors focus:border-bronze focus:ring-2 focus:ring-bronze/25"
              />
            </label>
          )}
        </div>
        <TextArea label="Qué hace" rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <p className="text-micro tabular-nums text-ink-soft/70">{clave}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
