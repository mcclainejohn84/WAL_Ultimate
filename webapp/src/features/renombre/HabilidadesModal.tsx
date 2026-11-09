// ============================================================================
// EL LIBRO DE HABILIDADES DE UN PERSONAJE DE RENOMBRE: rangos, mejoras de
// atributo, habilidades y características sociales, que se COMPRAN con
// experiencia.
//
// El catálogo es el reglamento y vive en el código (ver
// domain/habilidadesDeRenombre); la base solo guarda qué tiene cada personaje.
// Aquí se juntan las dos cosas.
//
// SE ABRE PARA CONSULTAR, NO PARA COMPRAR. Nueve de cada diez veces se entra a
// ver qué sabe hacer este personaje, así que lo que tiene ocupa el diálogo
// entero y el catálogo —que son 131 entradas— empieza PLEGADO detrás de un
// botón. Antes estaba siempre desplegado y enterraba lo único que se venía a
// leer.
//
// SE COBRA AL AÑADIR, y no de propina: descontar la experiencia es la mitad del
// trabajo. Si no llega, el botón no está y se dice cuánto falta — avisar
// después de cobrar no sirve de nada. El descuento queda como un apunte más del
// libro de experiencia, con el nombre de lo que se compró, así que de dónde
// salió cada punto se sigue pudiendo leer entero.
//
// QUITAR PREGUNTA ANTES. Devuelve experiencia y deja rastro, pero es un clic
// en una fila estrecha junto a otras veinte: el accidente se evita
// preguntando, no esperando que nadie falle.
//
// NO SE ANIMA NADA, igual que en el resto del programa salvo la Batalla (ver
// index.css): esto es una pantalla de trabajo y el movimiento solo estorba.
// ============================================================================
import { useRef, useState } from 'react'
import { clsx } from 'clsx'
import { SpecialCharacterRepository, type PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import { CharacterSkillRepository } from '@/data/repositories/characterSkillRepository'
import {
  ETIQUETAS_DE_TIPO,
  ORDEN_DE_TIPOS,
  TOPE_DE_SOCIALES,
  costeDeSocial,
  type HabilidadDeRenombre,
  type TipoDeHabilidad,
} from '@/domain/habilidadesDeRenombre'
import { useAsync } from '@/shared/hooks/useAsync'
import { BotonDeInfo, Descripcion, EncabezadoDeGrupo } from '@/features/renombre/piezas'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CheckIcon, ChevronDownIcon, PlusIcon, SearchIcon, TrashIcon } from '@/shared/ui/icons'

/**
 * Rótulos cortos para las pestañas. "Características sociales" entero no cabe
 * en un móvil sin partir la fila de pestañas en dos; el nombre completo sigue
 * en el `title` y en la cabecera de su grupo.
 */
const ETIQUETAS_CORTAS: Record<TipoDeHabilidad, string> = {
  rango: 'Rangos',
  atributo: 'Atributos',
  habilidad: 'Habilidades',
  social: 'Sociales',
}

export function HabilidadesModal({
  personaje,
  onClose,
  onCambio,
}: {
  personaje: PersonajeEspecial
  onClose: () => void
  onCambio: () => void
}) {
  const { data: claves, reload } = useAsync(() => SpecialCharacterRepository.listHabilidades(personaje.id))
  // EL CATÁLOGO SALE DE LA BASE, que es donde se edita (ver
  // characterSkillRepository y la pantalla "Habilidades de personaje" del
  // Editor). El del código solo es la semilla.
  const { data: catalogoDeHabilidades } = useAsync(() => CharacterSkillRepository.list())
  // La experiencia se recalcula aquí dentro y no se hereda de `personaje`: se
  // gasta sin cerrar el diálogo, y un saldo congelado dejaría comprar dos veces
  // lo que solo se puede pagar una.
  const { data: experiencia, reload: recargarExperiencia } = useAsync(() =>
    SpecialCharacterRepository.totalExperiencia(personaje.id),
  )
  const [anadiendo, setAnadiendo] = useState(false)
  const [tipo, setTipo] = useState<TipoDeHabilidad>('habilidad')
  const [busqueda, setBusqueda] = useState('')
  // Qué descripción está desplegada. Lleva PREFIJO de lista porque la misma
  // habilidad sale arriba (la tiene) y abajo (el catálogo), y sin él se abrían
  // las dos a la vez.
  const [abierta, setAbierta] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [porQuitar, setPorQuitar] = useState<HabilidadDeRenombre | null>(null)
  const catalogo = useRef<HTMLElement | null>(null)

  /**
   * Abrir el catálogo lo SUBE A LA VISTA. Es lo último del diálogo y en un
   * móvil nace entero por debajo del borde: sin esto se pulsa "Añadir
   * habilidades" y aparentemente no pasa nada.
   */
  function alternarCatalogo() {
    const abrir = !anadiendo
    setAnadiendo(abrir)
    if (abrir) requestAnimationFrame(() => catalogo.current?.scrollIntoView({ block: 'start' }))
  }

  const tiene = new Set(claves ?? [])
  const saldo = experiencia ?? 0
  const porClave = new Map((catalogoDeHabilidades ?? []).map((h) => [h.clave, h]))
  const suyas = (claves ?? []).map((c) => porClave.get(c)).filter((h) => h != null)
  const socialesQueTiene = suyas.filter((h) => h.tipo === 'social').length
  const sinSitioParaSociales = socialesQueTiene >= TOPE_DE_SOCIALES

  /** Lo que cuesta COMPRAR ahora una entrada: las sociales, según cuántas lleve. */
  function costeDeCompra(h: HabilidadDeRenombre): number {
    return h.coste ?? costeDeSocial(socialesQueTiene)
  }

  /**
   * Lo que se DEVUELVE al quitarla, que en las sociales no es lo mismo: cuesta
   * 8 la primera y 12 la segunda, así que al quitar una de las dos hay que
   * devolver el precio de LA ÚLTIMA, no el de la siguiente. Devolviendo 12 las
   * dos veces se regalaban 4 puntos por cada pareja que entraba y salía.
   */
  function costeDeDevolucion(h: HabilidadDeRenombre): number {
    return h.coste ?? costeDeSocial(socialesQueTiene - 1)
  }

  async function comprar(h: HabilidadDeRenombre) {
    setOcupado(true)
    setError(null)
    try {
      await SpecialCharacterRepository.anadirHabilidad(personaje.id, h.clave, h.nombre, costeDeCompra(h))
      reload()
      recargarExperiencia()
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcupado(false)
    }
  }

  async function devolver(h: HabilidadDeRenombre) {
    setOcupado(true)
    setError(null)
    try {
      await SpecialCharacterRepository.quitarHabilidad(personaje.id, h.clave, h.nombre, costeDeDevolucion(h))
      setPorQuitar(null)
      reload()
      recargarExperiencia()
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcupado(false)
    }
  }

  const termino = busqueda.trim().toLowerCase()
  const delCatalogo = (catalogoDeHabilidades ?? []).filter(
    (h) => h.tipo === tipo && (termino === '' || h.nombre.toLowerCase().includes(termino)),
  )

  return (
    <Modal
      title={`Habilidades · ${personaje.name}`}
      widthClassName="max-w-2xl"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-3">
        {/* EL SALDO, arriba y en grande: es el dato que decide si se puede
            comprar algo, y el que se viene a mirar antes de nada. */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-rule-dark/30 bg-parchment-dark/25 px-2.5 py-1.5">
          <div>
            <span className="block text-micro font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Experiencia disponible
            </span>
            <b className="font-display text-2xl leading-none text-maroon tabular-nums">{saldo}</b>
          </div>
          <dl className="ml-auto flex gap-4 text-right">
            <div>
              <dt className="text-micro uppercase tracking-[0.12em] text-ink-soft/80">En total</dt>
              <dd className="font-display text-sm leading-tight text-ink tabular-nums">{suyas.length}</dd>
            </div>
            <div>
              <dt className="text-micro uppercase tracking-[0.12em] text-ink-soft/80">Sociales</dt>
              <dd
                className={clsx(
                  'font-display text-sm leading-tight tabular-nums',
                  sinSitioParaSociales ? 'text-bronze' : 'text-ink',
                )}
              >
                {socialesQueTiene}/{TOPE_DE_SOCIALES}
              </dd>
            </div>
          </dl>
        </div>

        {/* LO QUE SABE HACER */}
        <section>
          <h3 className="mb-1.5 font-display text-sm font-semibold text-ink">Habilidades de personaje</h3>
          {suyas.length === 0 ? (
            <p className="rounded-sm border border-dashed border-rule-dark/30 px-3 py-3 text-center text-mini italic text-ink-soft">
              Todavía no tiene ninguna.
            </p>
          ) : (
            ORDEN_DE_TIPOS.filter((t) => suyas.some((h) => h.tipo === t)).map((t) => {
              const grupo = suyas.filter((h) => h.tipo === t)
              return (
                <div key={t} className="mt-2 first:mt-0">
                  <EncabezadoDeGrupo etiqueta={ETIQUETAS_DE_TIPO[t]} cuantas={grupo.length} />
                  <ul className="divide-y divide-rule-dark/12">
                    {grupo.map((h) => (
                      <li key={h.clave} className="px-0.5 py-1">
                        <div className="flex items-center gap-2">
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="min-w-0 truncate text-xs font-medium text-ink">{h.nombre}</span>
                            {h.descripcion && (
                              <BotonDeInfo
                                nombre={h.nombre}
                                abierto={abierta === `suyas:${h.clave}`}
                                onClick={() => setAbierta(abierta === `suyas:${h.clave}` ? null : `suyas:${h.clave}`)}
                              />
                            )}
                          </span>
                          <span className="shrink-0 text-mini tabular-nums text-ink-soft/80">
                            {costeDeDevolucion(h)} exp.
                          </span>
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => setPorQuitar(h)}
                            aria-label={`Quitar ${h.nombre}`}
                            title={`Quitarla y devolver ${costeDeDevolucion(h)} de experiencia`}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-soft/70 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {abierta === `suyas:${h.clave}` && h.descripcion && <Descripcion texto={h.descripcion} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          )}
        </section>

        {/* EL CATÁLOGO, plegado: se abre solo quien viene a comprar. */}
        {/* Sin filete propio: la lista de arriba ya termina en uno y dos
            seguidos se ven como un error de dibujo. */}
        <section ref={catalogo} className="pt-1">
          <button
            type="button"
            onClick={alternarCatalogo}
            aria-expanded={anadiendo}
            className="flex w-full items-center justify-between gap-2 rounded-sm border border-rule-dark/35 bg-parchment-dark/30 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-parchment-dark"
          >
            <span className="inline-flex items-center gap-1.5">
              <PlusIcon className="h-3.5 w-3.5 text-maroon" />
              Añadir habilidades
            </span>
            <ChevronDownIcon
              className={clsx('h-3.5 w-3.5 shrink-0 text-ink-soft transition-transform', anadiendo && 'rotate-180')}
            />
          </button>

          {anadiendo && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-0.5 rounded-sm border border-rule-dark/30 bg-parchment/70 p-0.5">
                  {ORDEN_DE_TIPOS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo(t)}
                      title={ETIQUETAS_DE_TIPO[t]}
                      aria-pressed={t === tipo}
                      className={clsx(
                        'rounded-sm px-2 py-0.5 text-mini font-semibold tracking-wide transition-colors',
                        t === tipo
                          ? 'bg-maroon text-parchment shadow-sm shadow-black/20'
                          : 'text-ink-soft hover:bg-parchment-dark',
                      )}
                    >
                      {ETIQUETAS_CORTAS[t]}
                    </button>
                  ))}
                </div>
                <label className="relative min-w-[8rem] flex-1">
                  <span className="sr-only">Buscar una habilidad por su nombre</span>
                  <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft/70" />
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar…"
                    className="w-full rounded-sm border border-rule-dark/45 bg-parchment/70 py-0.5 pl-7 pr-2 text-xs text-ink outline-none transition-colors focus:border-bronze focus:ring-2 focus:ring-bronze/25"
                  />
                </label>
              </div>

              <ul className="divide-y divide-rule-dark/12">
                {delCatalogo.map((h) => {
                  const yaLaTiene = tiene.has(h.clave)
                  const coste = costeDeCompra(h)
                  const llega = saldo >= coste
                  const topeLlena = h.tipo === 'social' && sinSitioParaSociales
                  return (
                    <li key={h.clave} className="px-0.5 py-1">
                      <div className="flex items-center gap-2">
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span
                            className={clsx(
                              'min-w-0 truncate text-xs',
                              yaLaTiene ? 'font-medium text-maroon' : 'text-ink',
                            )}
                          >
                            {h.nombre}
                          </span>
                          {h.descripcion && (
                            <BotonDeInfo
                              nombre={h.nombre}
                              abierto={abierta === `cat:${h.clave}`}
                              onClick={() => setAbierta(abierta === `cat:${h.clave}` ? null : `cat:${h.clave}`)}
                            />
                          )}
                        </span>
                        <span className="w-12 shrink-0 text-right text-mini tabular-nums text-ink-soft/80">
                          {coste} exp.
                        </span>
                        <span className="flex w-20 shrink-0 justify-end">
                          {yaLaTiene ? (
                            <span className="inline-flex items-center gap-1 text-mini font-medium text-maroon">
                              <CheckIcon className="h-3 w-3" />
                              Ya adquirido
                            </span>
                          ) : topeLlena ? (
                            // EL TOPE NO SE EXPLICA EN UN PÁRRAFO, se ve en el
                            // sitio donde se pulsaría: dos y no hay más.
                            <span
                              className="text-mini font-medium text-bronze"
                              title={`Un personaje no puede tener más de ${TOPE_DE_SOCIALES} características sociales`}
                            >
                              Tope de {TOPE_DE_SOCIALES}
                            </span>
                          ) : llega ? (
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => void comprar(h)}
                              className="rounded-sm border border-maroon/45 px-2 py-0.5 text-mini font-semibold text-maroon transition-colors hover:bg-maroon hover:text-parchment disabled:opacity-40"
                            >
                              Añadir
                            </button>
                          ) : (
                            // NO SE OFRECE LO QUE NO SE PUEDE PAGAR, y se dice
                            // cuánto falta. Un botón que al pulsarlo contesta
                            // "no te llega" hace perder un clic y no informa.
                            <span className="text-mini text-danger" title={`Hacen falta ${coste} y tiene ${saldo}`}>
                              Faltan {coste - saldo} exp
                            </span>
                          )}
                        </span>
                      </div>
                      {abierta === `cat:${h.clave}` && h.descripcion && <Descripcion texto={h.descripcion} />}
                    </li>
                  )
                })}
                {delCatalogo.length === 0 && (
                  <li className="px-1 py-2 text-center text-mini italic text-ink-soft">
                    No hay ninguna que se llame así.
                  </li>
                )}
              </ul>
            </div>
          )}
        </section>

        {error && <p className="rounded-sm bg-danger-dark/10 px-2 py-1 text-mini text-danger">{error}</p>}
      </div>

      {porQuitar && (
        <ConfirmDialog
          title="Quitar la habilidad"
          message={`¿Seguro que le quitas "${porQuitar.nombre}" a ${personaje.name}? Se le devolverán ${costeDeDevolucion(porQuitar)} puntos de experiencia y quedará apuntado en su libro.`}
          confirmLabel="Sí, quitarla"
          cancelLabel="No"
          onConfirm={() => devolver(porQuitar)}
          onCancel={() => setPorQuitar(null)}
        />
      )}
    </Modal>
  )
}
