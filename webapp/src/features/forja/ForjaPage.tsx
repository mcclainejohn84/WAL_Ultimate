// ============================================================================
// FORJA DE OBJETOS MÁGICOS
//
// Dos estados y nada más: lo que está EN LA FORJA y lo que YA LLEVA alguien.
// Un objeto en la forja se arma libremente —nombre, características, sello,
// trasfondo— y no cuesta nada. Dárselo a un personaje le cuesta a ÉL la suma
// de lo que lleva el objeto, y desde ese momento el objeto queda cerrado:
// quien quiera cambiarlo, que se lo quite primero (ver magicItemRepository,
// donde están las reglas de verdad).
//
// Quitárselo devuelve lo que pagó, así que pasar un objeto de un personaje a
// otro sale a cero: el primero recupera y el segundo paga.
//
// Los objetos son de quien los forja, como los personajes: se ven todos y solo
// los toca su autor (ver esEditablePor — aquí la regla es la misma, escrita
// sobre el objeto en vez de sobre la unidad).
// ============================================================================
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  MagicItemRepository,
  type FilaDeCaracteristica,
  type ObjetoMagico,
} from '@/data/repositories/magicItemRepository'
import { SpecialCharacterRepository, type PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import {
  ETIQUETAS_DE_OBJETO,
  ETIQUETAS_EN_PLURAL,
  MAX_CARACTERISTICAS,
  TIPOS_DE_OBJETO,
  costeDelObjeto,
  motivoParaNoAsignar,
  type TipoDeObjeto,
} from '@/domain/objetosMagicos'
import { useAsync } from '@/shared/hooks/useAsync'
import { usePreferenciaLocal } from '@/shared/hooks/usePreferenciaLocal'
import { useSession } from '@/shared/session/useSession'
import { PageHeader } from '@/shared/ui/PageHeader'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Spinner } from '@/shared/ui/Spinner'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { Select } from '@/shared/ui/Select'
import { TextField } from '@/shared/ui/TextField'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { RichText, RichTextEditor } from '@/shared/ui/RichTextEditor'
import { tieneTexto } from '@/shared/richText'
import { EncabezadoDeGrupo } from '@/features/renombre/piezas'
import { FiltroSegmentado } from '@/shared/ui/FiltroSegmentado'
import { CandadoDeAutor } from '@/shared/ui/CandadoDeAutor'
import { EnlaceDeVuelta } from '@/shared/ui/EnlaceDeVuelta'
import { PencilIcon, PlusIcon, SwapIcon, TrashIcon } from '@/shared/ui/icons'

export function ForjaPage() {
  const { user: usuario } = useSession()
  const { data: objetos, loading, reload } = useAsync(() => MagicItemRepository.listAll())
  const { data: catalogo } = useAsync(() => MagicItemRepository.listCatalogo())
  const { data: personajes } = useAsync(() => SpecialCharacterRepository.listAll())
  const { data: topes } = useAsync(() => MagicItemRepository.topesPorPersonaje())

  const [forjando, setForjando] = useState(false)
  const [editando, setEditando] = useState<ObjetoMagico | null>(null)
  const [asignando, setAsignando] = useState<ObjetoMagico | null>(null)
  const [porDeshacer, setPorDeshacer] = useState<ObjetoMagico | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [soloMios, setSoloMios] = usePreferenciaLocal('forja_solo_mios', usuario?.id, false)

  if (loading && objetos == null) return <Spinner />

  const todos = objetos ?? []
  const esMio = (o: ObjetoMagico) => o.userId == null || o.userId === usuario?.id
  const lista = soloMios ? todos.filter(esMio) : todos
  const enLaForja = lista.filter((o) => o.unitId == null)
  const repartidos = lista.filter((o) => o.unitId != null)
  const porId = new Map((personajes ?? []).map((p) => [p.id, p]))

  async function hacer(accion: () => Promise<void>) {
    setError(null)
    try {
      await accion()
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div>
      {/* La Forja ya no está en el menú: se entra desde Personajes de
          Renombre, así que el camino de vuelta tiene que estar a la vista. */}
      <EnlaceDeVuelta to="/renombre">Personajes de Renombre</EnlaceDeVuelta>

      <PageHeader
        title="Forja de objetos mágicos"
        actions={
          <Button variant="primary" onClick={() => setForjando(true)}>
            <PlusIcon className="h-4 w-4" />
            Forjar objeto
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {usuario != null && todos.length > 0 && (
        <div className="mb-5 flex flex-wrap items-end gap-x-3 gap-y-2">
          <FiltroSegmentado
            label="Autor"
            valor={soloMios ? 'mios' : 'todos'}
            onChange={(valor) => setSoloMios(valor === 'mios')}
            opciones={[
              { valor: 'todos', etiqueta: 'Todos', cuantos: todos.length },
              { valor: 'mios', etiqueta: 'Mis objetos', cuantos: todos.filter(esMio).length },
            ]}
          />
        </div>
      )}

      {todos.length === 0 ? (
        <EmptyState
          title="La forja está vacía"
          description="Un objeto se arma aquí sin coste; lo que cuesta es dárselo a un personaje."
          action={
            <Button variant="primary" onClick={() => setForjando(true)}>
              <PlusIcon className="h-4 w-4" />
              Forjar objeto
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section>
            <EncabezadoDeGrupo etiqueta="En la forja" cuantas={enLaForja.length} />
            {enLaForja.length === 0 ? (
              <p className="px-1 py-2 text-mini italic text-ink-soft">Nada sin repartir.</p>
            ) : (
              <ul className="space-y-3">
                {enLaForja.map((objeto) => (
                  <li key={objeto.id}>
                    <TarjetaDeObjeto
                      objeto={objeto}
                      portador={null}
                      editable={esMio(objeto)}
                      onEditar={() => setEditando(objeto)}
                      onAsignar={() => setAsignando(objeto)}
                      onDeshacer={() => setPorDeshacer(objeto)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <EncabezadoDeGrupo etiqueta="Repartidos" cuantas={repartidos.length} />
            {repartidos.length === 0 ? (
              <p className="px-1 py-2 text-mini italic text-ink-soft">Todavía no lleva ninguno nadie.</p>
            ) : (
              <ul className="space-y-3">
                {repartidos.map((objeto) => (
                  <li key={objeto.id}>
                    <TarjetaDeObjeto
                      objeto={objeto}
                      portador={objeto.unitId != null ? (porId.get(objeto.unitId) ?? null) : null}
                      editable={esMio(objeto)}
                      onQuitar={() => void hacer(() => MagicItemRepository.desasignar(objeto.id))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {forjando && (
        <ForjarModal
          onClose={() => setForjando(false)}
          onForjado={() => {
            setForjando(false)
            reload()
          }}
        />
      )}

      {editando && (
        <EditarObjetoModal
          objeto={editando}
          catalogo={catalogo ?? []}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            reload()
          }}
        />
      )}

      {asignando && (
        <AsignarModal
          objeto={asignando}
          personajes={(personajes ?? []).filter((p) => p.userId == null || p.userId === usuario?.id)}
          objetos={todos}
          topes={topes ?? new Map()}
          onClose={() => setAsignando(null)}
          onAsignado={() => {
            setAsignando(null)
            reload()
          }}
        />
      )}

      {porDeshacer && (
        <ConfirmDialog
          title="Deshacer el objeto"
          message={`Se deshace "${porDeshacer.nombre}" y se pierde lo que llevaba grabado. No se puede recuperar.`}
          confirmLabel="Sí, deshacerlo"
          cancelLabel="No"
          onConfirm={() => {
            const cual = porDeshacer
            setPorDeshacer(null)
            void hacer(() => MagicItemRepository.borrar(cual.id))
          }}
          onCancel={() => setPorDeshacer(null)}
        />
      )}
    </div>
  )
}

/** Un objeto: lo que es, lo que lleva, lo que cuesta y quién lo lleva. */
function TarjetaDeObjeto({
  objeto,
  portador,
  editable,
  onEditar,
  onAsignar,
  onQuitar,
  onDeshacer,
}: {
  objeto: ObjetoMagico
  portador: PersonajeEspecial | null
  editable: boolean
  onEditar?: () => void
  onAsignar?: () => void
  onQuitar?: () => void
  onDeshacer?: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const coste = objeto.unitId != null ? objeto.costePagado : costeDelObjeto(objeto.caracteristicas)

  return (
    <article className="rounded-sm border border-rule-dark/40 bg-parchment/70 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-micro font-semibold uppercase tracking-[0.16em] text-bronze">
          {ETIQUETAS_DE_OBJETO[objeto.tipo]}
        </span>
        <h3 className="font-display text-base font-semibold text-ink">{objeto.nombre}</h3>
        <span className="ml-auto shrink-0 font-display text-sm text-maroon tabular-nums">{coste} exp.</span>
      </div>

      {objeto.caracteristicas.length === 0 ? (
        <p className="mt-1 text-mini italic text-ink-soft">Sin características: todavía no es mágico.</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {objeto.caracteristicas.map((c) => (
            <li key={c.clave} className="text-xs text-ink">
              {c.tipo === 'sello' && <span className="mr-1 text-micro uppercase text-bronze">Sello</span>}
              {c.nombre}
              <span className="ml-1 text-mini tabular-nums text-ink-soft/70">{c.coste}</span>
            </li>
          ))}
        </ul>
      )}

      {portador && (
        <p className="mt-1.5 text-xs text-ink-soft">
          Lo lleva <b className="text-ink">{portador.name}</b>
        </p>
      )}

      {tieneTexto(objeto.trasfondo) && (
        <>
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            className="mt-1.5 text-mini font-medium text-ink-soft underline decoration-rule-dark/40 underline-offset-2 hover:text-ink"
          >
            {abierto ? 'Ocultar su historia' : 'Su historia'}
          </button>
          {abierto && <RichText html={objeto.trasfondo} className="mt-1 text-xs leading-relaxed text-ink" />}
        </>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-rule-dark/25 pt-2">
        {!editable ? (
          <CandadoDeAutor autorId={objeto.userId} que="Objeto" className="px-2 py-1" />
        ) : objeto.unitId != null ? (
          <button
            type="button"
            onClick={onQuitar}
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze"
          >
            <SwapIcon className="h-3.5 w-3.5" />
            Quitárselo
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Forjar
            </button>
            <button
              type="button"
              onClick={onAsignar}
              className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium text-maroon transition-colors hover:bg-maroon/10"
            >
              <SwapIcon className="h-3.5 w-3.5" />
              Asignar
            </button>
            <button
              type="button"
              onClick={onDeshacer}
              aria-label={`Deshacer ${objeto.nombre}`}
              title="Deshacer este objeto"
              className="ml-auto rounded-sm p-1.5 text-ink-soft transition-colors hover:bg-maroon/10 hover:text-danger"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </article>
  )
}

/** Alta: nombre y tipo. Lo demás se le pone después, sin prisa y sin coste. */
function ForjarModal({ onClose, onForjado }: { onClose: () => void; onForjado: () => void }) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoDeObjeto>('arma')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function forjar() {
    if (!nombre.trim()) {
      setError('Ponle un nombre.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await MagicItemRepository.crear(nombre, tipo)
      onForjado()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  return (
    <Modal
      title="Forjar un objeto"
      widthClassName="max-w-md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void forjar()} disabled={guardando}>
            {guardando ? 'Forjando…' : 'Forjar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeObjeto)}>
          {TIPOS_DE_OBJETO.map((t) => (
            <option key={t} value={t}>
              {ETIQUETAS_DE_OBJETO[t]}
            </option>
          ))}
        </Select>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}

/** La forja de verdad: qué lleva grabado, cómo se llama y su historia. */
function EditarObjetoModal({
  objeto,
  catalogo,
  onClose,
  onGuardado,
}: {
  objeto: ObjetoMagico
  catalogo: FilaDeCaracteristica[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(objeto.nombre)
  const [trasfondo, setTrasfondo] = useState(objeto.trasfondo)
  const [elegidas, setElegidas] = useState<Set<string>>(new Set(objeto.caracteristicas.map((c) => c.clave)))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const delTipo = catalogo.filter((c) => c.tipo === objeto.tipo)
  const sellos = catalogo.filter((c) => c.tipo === 'sello')
  const puestas = catalogo.filter((c) => elegidas.has(c.clave))
  const coste = costeDelObjeto(puestas)
  const lleno = elegidas.size >= MAX_CARACTERISTICAS
  const selloPuesto = puestas.find((c) => c.tipo === 'sello')

  function alternar(clave: string, esSello: boolean) {
    setElegidas((previas) => {
      const siguientes = new Set(previas)
      if (siguientes.has(clave)) {
        siguientes.delete(clave)
        return siguientes
      }
      // Un solo sello: elegir otro sustituye al que hubiera.
      if (esSello && selloPuesto) siguientes.delete(selloPuesto.clave)
      if (siguientes.size >= MAX_CARACTERISTICAS) return previas
      siguientes.add(clave)
      return siguientes
    })
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await MagicItemRepository.renombrar(objeto.id, nombre)
      await MagicItemRepository.setCaracteristicas(objeto.id, [...elegidas])
      await MagicItemRepository.setTrasfondo(objeto.id, trasfondo)
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={`Forjar · ${objeto.nombre}`}
      widthClassName="max-w-3xl"
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
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-rule-dark/30 bg-parchment-dark/25 px-2.5 py-1.5">
          <div>
            <span className="block text-micro font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Lo que costará
            </span>
            <b className="font-display text-2xl leading-none text-maroon tabular-nums">{coste}</b>
          </div>
          <span className="ml-auto text-mini tabular-nums text-ink-soft">
            {elegidas.size} / {MAX_CARACTERISTICAS}
          </span>
        </div>

        <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />

        <div>
          <EncabezadoDeGrupo etiqueta={ETIQUETAS_EN_PLURAL[objeto.tipo]} cuantas={delTipo.length} />
          <ListaDeCaracteristicas
            entradas={delTipo}
            elegidas={elegidas}
            lleno={lleno}
            onAlternar={(clave) => alternar(clave, false)}
          />
        </div>

        <div>
          <EncabezadoDeGrupo etiqueta={ETIQUETAS_EN_PLURAL.sello} cuantas={sellos.length} />
          <ListaDeCaracteristicas
            entradas={sellos}
            elegidas={elegidas}
            lleno={lleno && selloPuesto == null}
            onAlternar={(clave) => alternar(clave, true)}
          />
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-ink-soft">Su historia</span>
          <RichTextEditor value={trasfondo} onChange={setTrasfondo} valorInicialKey={objeto.id} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}

function ListaDeCaracteristicas({
  entradas,
  elegidas,
  lleno,
  onAlternar,
}: {
  entradas: FilaDeCaracteristica[]
  elegidas: Set<string>
  lleno: boolean
  onAlternar: (clave: string) => void
}) {
  return (
    <ul className="divide-y divide-rule-dark/12">
      {entradas.map((c) => {
        const puesta = elegidas.has(c.clave)
        return (
          <li key={c.clave} className="px-0.5 py-1">
            <label
              className={clsx(
                'flex items-start gap-2 text-xs',
                !puesta && lleno ? 'cursor-default opacity-45' : 'cursor-pointer',
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-maroon"
                checked={puesta}
                disabled={!puesta && lleno}
                onChange={() => onAlternar(c.clave)}
              />
              <span className="min-w-0 flex-1">
                <span className={clsx('text-ink', puesta && 'font-medium')}>{c.nombre}</span>
                {c.descripcion && <span className="block text-mini text-ink-soft">{c.descripcion}</span>}
              </span>
              <span className="shrink-0 text-mini tabular-nums text-ink-soft/80">{c.coste}</span>
            </label>
          </li>
        )
      })}
      {entradas.length === 0 && (
        <li className="px-1 py-2 text-center text-mini italic text-ink-soft">No hay ninguna en el catálogo.</li>
      )}
    </ul>
  )
}

/** A quién se le da. Solo salen los tuyos, y se dice cuál puede y cuál no. */
function AsignarModal({
  objeto,
  personajes,
  objetos,
  topes,
  onClose,
  onAsignado,
}: {
  objeto: ObjetoMagico
  personajes: PersonajeEspecial[]
  objetos: ObjetoMagico[]
  topes: Map<number, number>
  onClose: () => void
  onAsignado: () => void
}) {
  const [elegido, setElegido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const coste = costeDelObjeto(objeto.caracteristicas)

  const candidatos = personajes.map((p) => ({
    personaje: p,
    motivo: motivoParaNoAsignar({
      tope: topes.get(p.id) ?? 0,
      suyos: objetos.filter((o) => o.unitId === p.id),
      tipo: objeto.tipo,
      saldo: p.experiencia,
      coste,
    }),
  }))

  async function asignar() {
    if (!elegido) {
      setError('Elige a quién se lo das.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await MagicItemRepository.asignar(objeto.id, Number(elegido))
      onAsignado()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={`Asignar · ${objeto.nombre}`}
      widthClassName="max-w-md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void asignar()} disabled={guardando}>
            {guardando ? 'Asignando…' : `Asignar por ${coste} exp.`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Personaje" value={elegido} onChange={(e) => setElegido(e.target.value)}>
          <option value="">Elegir…</option>
          {candidatos.map(({ personaje, motivo }) => (
            <option key={personaje.id} value={personaje.id} disabled={motivo != null}>
              {personaje.name} · {personaje.experiencia} exp.{motivo ? ` — ${motivo}` : ''}
            </option>
          ))}
        </Select>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
