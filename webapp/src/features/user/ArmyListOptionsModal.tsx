// ============================================================================
// "Opciones Lista de ejército". Dos bloques:
//
//   - EN PANTALLA: qué líneas extra se ven bajo cada unidad en "Unidades en la
//     lista" (ver ArmyListBuilderPage).
//   - OPCIONES DE IMPRESIÓN: qué secciones salen en la hoja de ejército (el
//     PDF). Lo encendido se imprime, lo apagado no sale.
//
// Las dos son preferencia de CADA usuario, no del catálogo ni de la lista: dos
// personas pueden abrir —e imprimir— el mismo ejército con distinto detalle.
// Por eso viven en columnas de `users` y no en `army_lists`.
//
// Todas nacen encendidas. Estrenarlas apagadas dejaría la novedad escondida
// detrás de un menú que casi nadie abre.
//
// LO QUE NO TIENE INTERRUPTOR: la "Lista de unidades" y la tabla de "Perfiles
// y reglas especiales". Son la hoja en sí; apagarlas sería imprimir un folio
// con un título.
// ============================================================================
import { useEffect, useState, type ReactNode } from 'react'
import {
  UserRepository,
  DEFAULT_ARMY_LIST_OPTIONS,
  DEFAULT_PRINT_OPTIONS,
  type ArmyListOptions,
  type PrintOptions,
} from '@/data/repositories/userRepository'
import { DUENOS, ETIQUETAS_DE_DUENO } from '@/data/repositories/appendixRepository'
import { useAsync } from '@/shared/hooks/useAsync'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Spinner } from '@/shared/ui/Spinner'
import type { ApendiceDueno } from '@/domain/types'

const OPCIONES: { key: keyof ArmyListOptions; label: string }[] = [
  { key: 'showMounts', label: 'Ver la montura y el carro' },
  { key: 'showMagic', label: 'Ver las sendas de magia y su nivel' },
]

/** Las secciones del PDF que se pueden apagar, con el nombre que llevan en la hoja. */
const SECCIONES: { key: 'renombre' | 'reglas' | 'magia'; label: string; pista: string }[] = [
  {
    key: 'reglas',
    label: 'Resumen de reglas especiales',
    pista: 'El glosario del final, con la descripción de cada regla',
  },
  { key: 'magia', label: 'Sendas de magia', pista: 'El listado de hechizos de cada mago' },
  {
    key: 'renombre',
    label: 'Personajes de renombre',
    pista: 'Atributos, habilidades, saberes y cicatrices de cada uno',
  },
]

/** Lo que de verdad se enseña en la lista de apéndices, con su nombre en plural. */
const APENDICES: Record<ApendiceDueno, string> = {
  faccion: 'De la facción',
  unidad: 'De las unidades',
  equipo: 'Del equipo',
  opcion: 'De las opciones',
  montura: 'De las monturas',
  carro: 'De los carros',
}

function Casilla({
  marcada,
  onCambio,
  children,
  pista,
  sangrada = false,
}: {
  marcada: boolean
  onCambio: (valor: boolean) => void
  children: ReactNode
  pista?: string
  sangrada?: boolean
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-sm py-1.5 text-sm text-ink hover:bg-parchment-dark/50 ${
        sangrada ? 'pl-7 pr-2' : 'px-2'
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 accent-maroon"
        checked={marcada}
        onChange={(e) => onCambio(e.target.checked)}
      />
      <span className="min-w-0">
        {children}
        {pista && <span className="block text-mini text-ink-soft">{pista}</span>}
      </span>
    </label>
  )
}

export function ArmyListOptionsModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: number
  onClose: () => void
  onSaved: () => void
}) {
  const { data: guardadas, loading } = useAsync(
    async () => ({
      pantalla: await UserRepository.getArmyListOptions(userId),
      impresion: await UserRepository.getPrintOptions(userId),
    }),
    [userId],
  )

  const [draft, setDraft] = useState<ArmyListOptions>(DEFAULT_ARMY_LIST_OPTIONS)
  const [impresion, setImpresion] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS)
  useEffect(() => {
    if (!guardadas) return
    setDraft(guardadas.pantalla)
    setImpresion(guardadas.impresion)
  }, [guardadas])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await UserRepository.setArmyListOptions(userId, draft)
      await UserRepository.setPrintOptions(userId, impresion)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const apendicesEncendidos = DUENOS.filter((k) => impresion.apendices[k]).length

  return (
    <Modal
      title="Opciones Lista de ejército"
      widthClassName="max-w-md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <section>
            <h3 className="mb-1 border-b border-rule-dark/30 pb-1 font-display text-xs tracking-wide text-ink-soft">
              En pantalla
            </h3>
            {OPCIONES.map((opcion) => (
              <Casilla
                key={opcion.key}
                marcada={draft[opcion.key]}
                onCambio={(valor) => setDraft((d) => ({ ...d, [opcion.key]: valor }))}
              >
                {opcion.label}
              </Casilla>
            ))}
          </section>

          <section>
            <h3 className="mb-1 border-b border-rule-dark/30 pb-1 font-display text-xs tracking-wide text-ink-soft">
              Opciones de impresión
            </h3>
            {SECCIONES.map((seccion) => (
              <Casilla
                key={seccion.key}
                marcada={impresion[seccion.key]}
                pista={seccion.pista}
                onCambio={(valor) => setImpresion((o) => ({ ...o, [seccion.key]: valor }))}
              >
                {seccion.label}
              </Casilla>
            ))}

            {/* Los apéndices van en bloque, con su propia cabecera: son seis
                interruptores y, sueltos entre las secciones, la lista se leía
                como diez cosas distintas al mismo nivel. */}
            <p className="mt-2 px-2 text-xs font-medium text-ink">
              Apéndices y reglas adicionales
              <span className="ml-1 font-normal text-ink-soft">
                (
                {apendicesEncendidos === 0
                  ? 'ninguno'
                  : apendicesEncendidos === DUENOS.length
                    ? 'todos'
                    : `${apendicesEncendidos} de ${DUENOS.length}`}
                )
              </span>
            </p>
            {DUENOS.map((kind) => (
              <Casilla
                key={kind}
                sangrada
                marcada={impresion.apendices[kind]}
                onCambio={(valor) => setImpresion((o) => ({ ...o, apendices: { ...o.apendices, [kind]: valor } }))}
              >
                {APENDICES[kind]}
                <span className="sr-only"> ({ETIQUETAS_DE_DUENO[kind]})</span>
              </Casilla>
            ))}
          </section>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
