// ============================================================================
// El catálogo de MAGIA de los Personajes de Renombre: habilidades mágicas,
// avanzadas y saberes arcanos (tabla magic_skills, ver magicRepository).
//
// Va debajo de las sendas y no en otra pantalla porque es lo mismo: lo que un
// hechicero puede llegar a saber. Los PERGAMINOS no están aquí — son hechizos
// de nivel 1 y 2 de las propias sendas, y se editan arriba, con sus hechizos.
//
// LA CLAVE NO SE EDITA: es lo que queda apuntado en la ficha de cada
// personaje (unit_skills).
// ============================================================================
import { useState } from 'react'
import { clsx } from 'clsx'
import { MagicRepository, type FilaDeMagia, type MagicSkillInputPropio } from '@/data/repositories/magicRepository'
import { ETIQUETAS_DE_MAGIA, GREMIO, TORRE, type TipoDeMagia } from '@/domain/magiaDeRenombre'
import { MAGIC_LEVELS } from '@/domain/magic'
import { useAsync } from '@/shared/hooks/useAsync'
import { Panel } from '@/shared/ui/Panel'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { TextArea } from '@/shared/ui/TextArea'
import { EnteroInput } from '@/shared/ui/EnteroInput'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { PencilIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'

const TIPOS: TipoDeMagia[] = ['habilidad', 'avanzada', 'saber']

const PREFIJO: Record<TipoDeMagia, string> = {
  habilidad: 'magia:',
  avanzada: 'magia-av:',
  saber: 'saber:',
  pergamino: 'pergamino:',
}

function aClave(tipo: TipoDeMagia, nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${PREFIJO[tipo]}${limpio || 'sin-nombre'}`
}

const CAMPO =
  'w-full rounded-sm border border-rule-dark/50 bg-parchment/70 px-3 py-1 text-xs text-ink outline-none transition-colors focus:border-bronze focus:ring-2 focus:ring-bronze/25'

export function MagicSkillsPanel() {
  const { data: catalogo, reload } = useAsync(() => MagicRepository.listMagicSkills())
  const [tipo, setTipo] = useState<TipoDeMagia>('habilidad')
  const [editando, setEditando] = useState<FilaDeMagia | 'nueva' | null>(null)
  const [porBorrar, setPorBorrar] = useState<FilaDeMagia | null>(null)
  const [error, setError] = useState<string | null>(null)

  const todas = catalogo ?? []
  const visibles = todas.filter((h) => h.tipo === tipo)
  const sinTabla = todas.some((h) => h.id < 0)

  async function borrar() {
    if (!porBorrar) return
    setError(null)
    try {
      await MagicRepository.removeMagicSkill(porBorrar.id)
      setPorBorrar(null)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Panel
      title="Habilidades mágicas"
      headerRight={
        <Button variant="secondary" onClick={() => setEditando('nueva')} disabled={sinTabla}>
          <PlusIcon className="h-4 w-4" />
          Nueva
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-0.5 rounded-sm border border-rule-dark/30 bg-parchment/70 p-0.5">
        {TIPOS.map((t) => (
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
            {ETIQUETAS_DE_MAGIA[t]}
            <span className="ml-1.5 text-mini tabular-nums opacity-70">{todas.filter((h) => h.tipo === t).length}</span>
          </button>
        ))}
      </div>

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      <ul className="divide-y divide-rule-dark/15">
        {visibles.map((h) => (
          <li key={h.clave} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-maroon">
                {h.nombre}
                <span className="ml-2 text-xs font-normal tabular-nums text-ink-soft">{h.coste} exp.</span>
                {h.nivel != null && (
                  <span className="ml-2 text-xs font-normal text-ink-soft">
                    Nivel {h.nivel}
                    {h.dificultad ? ` · ${h.dificultad}` : ''}
                  </span>
                )}
                {h.requiere && (
                  <span className="ml-2 text-xs font-normal text-bronze">
                    Requiere {todas.find((x) => x.clave === h.requiere)?.nombre ?? h.requiere}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">{h.descripcion}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
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
                onClick={() => setPorBorrar(h)}
                disabled={sinTabla}
                aria-label={`Borrar ${h.nombre}`}
                title="Borrar"
                className="rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-maroon/10 hover:text-danger disabled:opacity-40"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
        {visibles.length === 0 && <li className="py-3 text-center text-xs italic text-ink-soft">Ninguna.</li>}
      </ul>

      {editando && (
        <FormularioDeMagia
          entrada={editando === 'nueva' ? null : editando}
          tipoInicial={tipo}
          catalogo={todas}
          onClose={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null)
            reload()
          }}
        />
      )}

      {porBorrar && (
        <ConfirmDialog
          title="Borrar del catálogo"
          message={`¿Seguro que borras "${porBorrar.nombre}"? Los personajes que la tengan dejarán de verla en su ficha y en la hoja de ejército.`}
          confirmLabel="Sí, borrarla"
          cancelLabel="Cancelar"
          onConfirm={() => void borrar()}
          onCancel={() => setPorBorrar(null)}
        />
      )}
    </Panel>
  )
}

function FormularioDeMagia({
  entrada,
  tipoInicial,
  catalogo,
  onClose,
  onGuardada,
}: {
  entrada: FilaDeMagia | null
  tipoInicial: TipoDeMagia
  catalogo: FilaDeMagia[]
  onClose: () => void
  onGuardada: () => void
}) {
  const [nombre, setNombre] = useState(entrada?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoDeMagia>(entrada?.tipo ?? tipoInicial)
  const [coste, setCoste] = useState(String(entrada?.coste ?? ''))
  const [descripcion, setDescripcion] = useState(entrada?.descripcion ?? '')
  const [requiere, setRequiere] = useState(entrada?.requiere ?? '')
  const [nivel, setNivel] = useState(String(entrada?.nivel ?? 1))
  const [dificultad, setDificultad] = useState(entrada?.dificultad ?? '')
  const [edificio, setEdificio] = useState(entrada?.edificio ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clave = entrada?.clave ?? aClave(tipo, nombre)
  const esSaber = tipo === 'saber'
  const esAvanzada = tipo === 'avanzada'

  async function guardar() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!entrada && catalogo.some((h) => h.clave === clave)) {
      setError(`Ya hay una entrada con la clave ${clave}.`)
      return
    }
    setGuardando(true)
    setError(null)
    const datos: MagicSkillInputPropio = {
      clave,
      nombre: nombre.trim(),
      tipo,
      coste: Number(coste || 0),
      descripcion: descripcion.trim(),
      requiere: esAvanzada && requiere ? requiere : null,
      nivel: esSaber ? Number(nivel || 1) : null,
      dificultad: esSaber ? dificultad.trim() || null : null,
      edificio: edificio.trim() || null,
    }
    try {
      if (entrada) {
        await MagicRepository.updateMagicSkill(entrada.id, datos)
      } else {
        await MagicRepository.createMagicSkill(datos)
      }
      onGuardada()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={entrada ? 'Editar entrada de magia' : 'Nueva entrada de magia'}
      widthClassName="max-w-2xl"
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
          <Select
            label="Tipo"
            value={tipo}
            onChange={(e) => {
              const nuevo = e.target.value as TipoDeMagia
              setTipo(nuevo)
              if (nuevo === 'saber' && !edificio) setEdificio(TORRE)
            }}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_DE_MAGIA[t]}
              </option>
            ))}
          </Select>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Experiencia</span>
            <EnteroInput min={0} value={coste} onChange={(e) => setCoste(e.target.value)} className={CAMPO} />
          </label>
        </div>

        {esAvanzada && (
          <Select label="Requiere" value={requiere} onChange={(e) => setRequiere(e.target.value)}>
            <option value="">Nada</option>
            {catalogo
              .filter((h) => h.tipo === 'habilidad')
              .map((h) => (
                <option key={h.clave} value={h.clave}>
                  {h.nombre}
                </option>
              ))}
          </Select>
        )}

        {esSaber && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Nivel" value={nivel} onChange={(e) => setNivel(e.target.value)}>
              {MAGIC_LEVELS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <TextField
              label="Dificultad"
              value={dificultad}
              onChange={(e) => setDificultad(e.target.value)}
              placeholder="5+"
            />
          </div>
        )}

        <TextField
          label="Edificio que requiere"
          value={edificio}
          onChange={(e) => setEdificio(e.target.value)}
          placeholder={esSaber ? TORRE : GREMIO}
        />
        <TextArea label="Qué hace" rows={5} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <p className="text-micro tabular-nums text-ink-soft/70">{clave}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
