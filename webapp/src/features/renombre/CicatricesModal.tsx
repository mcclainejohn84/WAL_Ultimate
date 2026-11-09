// ============================================================================
// LAS CICATRICES DE UN PERSONAJE DE RENOMBRE: lo que le queda después de una
// mala tirada.
//
// Es el hermano pequeño del diálogo de habilidades (ver HabilidadesModal) y
// se parece a propósito: lo que tiene arriba, el catálogo plegado abajo, la
// "i" para leer qué hace cada una y una pregunta antes de quitar nada.
//
// LA DIFERENCIA ES QUE AQUÍ NO HAY DINERO. Una cicatriz no se compra: se
// sufre. No cuesta experiencia, no la devuelve al quitarla y no deja apunte en
// el libro, así que no hay saldo que enseñar ni nada que impida añadirla.
// ============================================================================
import { useRef, useState } from 'react'
import { clsx } from 'clsx'
import { SpecialCharacterRepository, type PersonajeEspecial } from '@/data/repositories/specialCharacterRepository'
import { CATALOGO_DE_CICATRICES, CICATRIZ_POR_CLAVE, type CicatrizDeRenombre } from '@/domain/cicatricesDeRenombre'
import { useAsync } from '@/shared/hooks/useAsync'
import { BotonDeInfo, Descripcion } from '@/features/renombre/piezas'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CheckIcon, ChevronDownIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons'

export function CicatricesModal({
  personaje,
  onClose,
  onCambio,
}: {
  personaje: PersonajeEspecial
  onClose: () => void
  onCambio: () => void
}) {
  const { data: claves, reload } = useAsync(() => SpecialCharacterRepository.listCicatrices(personaje.id))
  const [anadiendo, setAnadiendo] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [porQuitar, setPorQuitar] = useState<CicatrizDeRenombre | null>(null)
  const catalogo = useRef<HTMLElement | null>(null)

  const tiene = new Set(claves ?? [])
  const suyas = (claves ?? []).map((c) => CICATRIZ_POR_CLAVE.get(c)).filter((c) => c != null)

  function alternarCatalogo() {
    const abrir = !anadiendo
    setAnadiendo(abrir)
    if (abrir) requestAnimationFrame(() => catalogo.current?.scrollIntoView({ block: 'start' }))
  }

  async function anadir(cicatriz: CicatrizDeRenombre) {
    setOcupado(true)
    setError(null)
    try {
      await SpecialCharacterRepository.anadirCicatriz(personaje.id, cicatriz.clave)
      reload()
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcupado(false)
    }
  }

  async function quitar(cicatriz: CicatrizDeRenombre) {
    setOcupado(true)
    setError(null)
    try {
      await SpecialCharacterRepository.quitarCicatriz(personaje.id, cicatriz.clave)
      setPorQuitar(null)
      reload()
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Modal
      title={`Cicatrices · ${personaje.name}`}
      widthClassName="max-w-2xl"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-3">
        <section>
          <h3 className="mb-1.5 font-display text-sm font-semibold text-ink">Cicatrices del personaje</h3>
          {suyas.length === 0 ? (
            <p className="rounded-sm border border-dashed border-rule-dark/30 px-3 py-3 text-center text-mini italic text-ink-soft">
              Ninguna.
            </p>
          ) : (
            <ul className="divide-y divide-rule-dark/12">
              {suyas.map((cicatriz) => (
                <li key={cicatriz.clave} className="px-0.5 py-1">
                  <div className="flex items-center gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="min-w-0 truncate text-xs font-medium text-ink">{cicatriz.nombre}</span>
                      <BotonDeInfo
                        nombre={cicatriz.nombre}
                        abierto={abierta === `suyas:${cicatriz.clave}`}
                        onClick={() =>
                          setAbierta(abierta === `suyas:${cicatriz.clave}` ? null : `suyas:${cicatriz.clave}`)
                        }
                      />
                    </span>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => setPorQuitar(cicatriz)}
                      aria-label={`Quitar ${cicatriz.nombre}`}
                      title="Quitar"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-soft/70 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {abierta === `suyas:${cicatriz.clave}` && <Descripcion texto={cicatriz.descripcion} />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section ref={catalogo} className="pt-1">
          <button
            type="button"
            onClick={alternarCatalogo}
            aria-expanded={anadiendo}
            className="flex w-full items-center justify-between gap-2 rounded-sm border border-rule-dark/35 bg-parchment-dark/30 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-parchment-dark"
          >
            <span className="inline-flex items-center gap-1.5">
              <PlusIcon className="h-3.5 w-3.5 text-maroon" />
              Añadir cicatrices
            </span>
            <ChevronDownIcon
              className={clsx('h-3.5 w-3.5 shrink-0 text-ink-soft transition-transform', anadiendo && 'rotate-180')}
            />
          </button>

          {anadiendo && (
            <ul className="mt-2 divide-y divide-rule-dark/12">
              {CATALOGO_DE_CICATRICES.map((cicatriz) => {
                const yaLaTiene = tiene.has(cicatriz.clave)
                return (
                  <li key={cicatriz.clave} className="px-0.5 py-1">
                    <div className="flex items-center gap-2">
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span
                          className={clsx(
                            'min-w-0 truncate text-xs',
                            yaLaTiene ? 'font-medium text-maroon' : 'text-ink',
                          )}
                        >
                          {cicatriz.nombre}
                        </span>
                        <BotonDeInfo
                          nombre={cicatriz.nombre}
                          abierto={abierta === `cat:${cicatriz.clave}`}
                          onClick={() =>
                            setAbierta(abierta === `cat:${cicatriz.clave}` ? null : `cat:${cicatriz.clave}`)
                          }
                        />
                      </span>
                      <span className="flex w-20 shrink-0 justify-end">
                        {yaLaTiene ? (
                          <span className="inline-flex items-center gap-1 text-mini font-medium text-maroon">
                            <CheckIcon className="h-3 w-3" />
                            Ya adquirida
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => void anadir(cicatriz)}
                            className="rounded-sm border border-maroon/45 px-2 py-0.5 text-mini font-semibold text-maroon transition-colors hover:bg-maroon hover:text-parchment disabled:opacity-40"
                          >
                            Añadir
                          </button>
                        )}
                      </span>
                    </div>
                    {abierta === `cat:${cicatriz.clave}` && <Descripcion texto={cicatriz.descripcion} />}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {error && <p className="rounded-sm bg-danger-dark/10 px-2 py-1 text-mini text-danger">{error}</p>}
      </div>

      {porQuitar && (
        <ConfirmDialog
          title="Quitar la cicatriz"
          message={`¿Seguro que le quitas "${porQuitar.nombre}" a ${personaje.name}?`}
          confirmLabel="Sí, quitarla"
          cancelLabel="No"
          onConfirm={() => quitar(porQuitar)}
          onCancel={() => setPorQuitar(null)}
        />
      )}
    </Modal>
  )
}
