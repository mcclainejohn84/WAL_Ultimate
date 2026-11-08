import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { UnitRepository, type UnitScalarInput } from '@/data/repositories/unitRepository'
import {
  CommandRoleRepository,
  UnitCategoryRepository,
  UnitTypeTagRepository,
  EquipmentRepository,
  UpgradeRepository,
} from '@/data/repositories/lookupRepositories'
import { MountRepository, ChariotRepository } from '@/data/repositories/profileCatalogRepository'
import { RuleRepository } from '@/data/repositories/ruleRepository'
import { AppendixRepository } from '@/data/repositories/appendixRepository'
import { validateUnitScalarInput } from '@/domain/validation'
import { ARMOR_SAVE_VALUES, formatArmorSave } from '@/domain/unitFormat'
import { ALIAS_MAX, inicialesDe, normalizarAlias, unidadesConLasMismasIniciales } from '@/domain/unitAlias'
import { useAsync } from '@/shared/hooks/useAsync'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Panel } from '@/shared/ui/Panel'
import { Spinner } from '@/shared/ui/Spinner'
import { Button } from '@/shared/ui/Button'
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
} from '@/shared/ui/icons'
import { TextField } from '@/shared/ui/TextField'
import { EnteroInput } from '@/shared/ui/EnteroInput'
import { Select } from '@/shared/ui/Select'
import { RelationEditor } from '@/shared/ui/RelationEditor'
import { AttributeTable, EditableAttributeTable, extractProfileInput } from '@/shared/ui/AttributeTable'
import { UnsavedChangesDialog } from '@/shared/ui/UnsavedChangesDialog'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { AppendicesModal } from '@/features/admin/units/AppendicesModal'
import { EquipmentCreateModal } from '@/features/admin/units/EquipmentCreateModal'
import { UpgradeCreateModal } from '@/features/admin/units/UpgradeCreateModal'
import type {
  AttributeProfile,
  AttributeProfileInput,
  CommandRole,
  EquipmentOption,
  TropaSecundaria,
  UnitDetail,
} from '@/domain/types'

/** Nombre por defecto del Campeón en toda ficha que no tenga uno propio asignado. */
const DEFAULT_CHAMPION_NAME = 'Campeón'

const EQUIPMENT_CATEGORY_LABELS: Record<NonNullable<EquipmentOption['category']>, string> = {
  armadura: 'Armadura',
  escudo: 'Escudo',
  arma_cac: 'Arma cuerpo a cuerpo',
  arma_dist: 'Arma a distancia',
}

/**
 * Borrador en memoria de todos los cambios pendientes de la ficha. Nada de
 * esto toca la base de datos hasta que se pulsa "Guardar cambios": los
 * toggles de relaciones, el texto de los campos y las estadísticas de
 * atributos solo mutan este objeto local.
 */
interface UnitDraft {
  scalar: UnitScalarInput
  specialRuleIds: Set<number>
  equipmentIds: Set<number>
  upgradeIds: Set<number>
  /** Subconjunto de equipmentIds/upgradeIds marcado "por defecto" (ver unit_equipment_options.is_default / unit_upgrade_options.is_default). */
  defaultEquipmentIds: Set<number>
  defaultUpgradeIds: Set<number>
  mountProfileIds: Set<number>
  chariotProfileIds: Set<number>
  /** profile_id -> coste extra en puntos (ver unit_profiles.cost) — solo relevante para personajes; en unidades de tropa se deja sin usar. */
  mountProfileCosts: Record<number, number | null>
  chariotProfileCosts: Record<number, number | null>
  championNames: Record<number, string>
  /** command_role_id -> coste en puntos de esa opción de mando (Músico/Portaestandarte/Campeón). */
  commandCosts: Record<number, number>
  profileStats: Record<number, AttributeProfileInput>
  /**
   * Las TROPAS SECUNDARIAS, si esta unidad es compuesta. La principal no está
   * aquí: es la unidad misma, con su perfil base y su coste.
   *
   * Sus características viajan en `profileStats` como las de cualquier otro
   * perfil; aquí va lo que es de la tropa y no de su ficha.
   */
  tropas: TropaEnEdicion[]
  /** equipment_id -> qué tropas pueden llevarla. Sin entrada, o vacía: toda la unidad. */
  equipoPorTropa: Record<number, number[]>
  /** Cómo se llama la tropa principal ("Gor"). Solo se usa en una unidad compuesta. */
  nombreDeLaPrincipal: string
}

/** Una tropa secundaria mientras se edita. `profileId` es su ficha de atributos. */
interface TropaEnEdicion {
  profileId: number
  name: string
  cost: number
  minSize: number | null
  maxSize: number | null
  countsTowardSize: boolean
}

/** Las nueve características en blanco, para una ficha que todavía no se ha tocado. */
const FICHA_EN_BLANCO: AttributeProfileInput = {
  m: null,
  ha: null,
  hp: null,
  f: null,
  r: null,
  h: null,
  i: null,
  a: null,
  l: null,
}

function tropaEnEdicion(tropa: TropaSecundaria): TropaEnEdicion {
  return {
    profileId: tropa.id,
    name: tropa.name ?? '',
    cost: tropa.cost,
    minSize: tropa.minSize,
    maxSize: tropa.maxSize,
    countsTowardSize: tropa.countsTowardSize,
  }
}

function scalarFromUnit(unit: UnitDetail): UnitScalarInput {
  return {
    name: unit.name,
    alias: unit.alias,
    categoryId: unit.categoryId,
    typeTagId: unit.typeTagId,
    baseCost: unit.baseCost,
    minSize: unit.minSize,
    maxSize: unit.maxSize,
    defaultSize: unit.defaultSize,
    isUnique: unit.isUnique,
    equipmentText: unit.equipmentText,
    armorSave: unit.armorSave,
    notes: unit.notes,
    isWizard: unit.isWizard,
  }
}

function draftFromUnit(unit: UnitDetail): UnitDraft {
  const profileStats: Record<number, AttributeProfileInput> = {}
  if (unit.profiles.base) profileStats[unit.profiles.base.id] = extractProfileInput(unit.profiles.base)
  for (const tropa of unit.profiles.tropas) profileStats[tropa.id] = extractProfileInput(tropa)
  for (const opt of unit.commandOptions) {
    if (opt.profile) profileStats[opt.profile.id] = extractProfileInput(opt.profile)
  }
  return {
    scalar: scalarFromUnit(unit),
    specialRuleIds: new Set(unit.specialRules.map((r) => r.id)),
    equipmentIds: new Set(unit.equipmentOptions.map((e) => e.id)),
    upgradeIds: new Set(unit.upgradeOptions.map((u) => u.id)),
    defaultEquipmentIds: new Set(unit.equipmentOptions.filter((e) => e.isDefault).map((e) => e.id)),
    defaultUpgradeIds: new Set(unit.upgradeOptions.filter((u) => u.isDefault).map((u) => u.id)),
    mountProfileIds: new Set(unit.profiles.montura.map((p) => p.id)),
    chariotProfileIds: new Set(unit.profiles.carro.map((p) => p.id)),
    mountProfileCosts: Object.fromEntries(unit.profiles.montura.map((p) => [p.id, p.cost])),
    chariotProfileCosts: Object.fromEntries(unit.profiles.carro.map((p) => [p.id, p.cost])),
    championNames: Object.fromEntries(
      unit.commandOptions
        .filter((opt) => opt.role.code === 'CAMPEON')
        .map((opt) => [opt.role.id, opt.customName ?? DEFAULT_CHAMPION_NAME]),
    ),
    commandCosts: Object.fromEntries(unit.commandOptions.map((opt) => [opt.role.id, opt.cost])),
    profileStats,
    tropas: unit.profiles.tropas.map(tropaEnEdicion),
    nombreDeLaPrincipal: unit.profiles.base?.name ?? '',
    equipoPorTropa: Object.fromEntries(
      unit.equipmentOptions.filter((e) => e.profileIds.length > 0).map((e) => [e.id, e.profileIds]),
    ),
  }
}

export function UnitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const unitId = Number(id)
  const navigate = useNavigate()

  const { data: unit, loading, error, reload } = useAsync(() => UnitRepository.getDetailById(unitId), [unitId])
  const { data: categories } = useAsync(() => UnitCategoryRepository.listAll())
  const { data: typeTags } = useAsync(() => UnitTypeTagRepository.listAll())
  const { data: allRules } = useAsync(() => RuleRepository.listAll())
  const { data: commandRoles } = useAsync(() => CommandRoleRepository.listAll())
  const { data: allEquipment, reload: reloadEquipment } = useAsync(() => EquipmentRepository.listAll())
  const { data: allUpgrades, reload: reloadUpgrades } = useAsync(() => UpgradeRepository.listAll())
  const { data: mountItems } = useAsync(
    () => (unit ? MountRepository.listForFaction(unit.factionId) : Promise.resolve([])),
    [unit?.factionId],
  )
  const { data: chariotItems } = useAsync(
    () => (unit ? ChariotRepository.listForFaction(unit.factionId) : Promise.resolve([])),
    [unit?.factionId],
  )

  const [draft, setDraft] = useState<UnitDraft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [issues, setIssues] = useState<string[]>([])
  const [savedFlash, setSavedFlash] = useState(false)
  const [showAppendices, setShowAppendices] = useState(false)
  const { data: apendices, reload: reloadApendices } = useAsync(() => AppendixRepository.listByUnit(unitId), [unitId])
  const numApendices = apendices?.length ?? 0

  // Las iniciales de la mesa no pueden repetirse dentro de una facción: dos
  // peanas con las mismas tres letras no hay quien las distinga (ver
  // domain/unitAlias).
  const { data: unidadesDeLaFaccion } = useAsync(
    () => (unit ? UnitRepository.listAliasDeFaccion(unit.factionId) : Promise.resolve([])),
    [unit?.factionId],
  )
  const [tropaPorQuitar, setTropaPorQuitar] = useState<TropaEnEdicion | null>(null)
  const [creatingEquipmentQuery, setCreatingEquipmentQuery] = useState<string | null>(null)
  const [creatingUpgradeQuery, setCreatingUpgradeQuery] = useState<string | null>(null)
  // La unidad puede no tener todavía ficha base (unidad recién creada desde
  // cero): "Crear ficha base" escribe directamente (no hay nada que perder,
  // no existía ninguna edición previa sobre un perfil que no existía) pero
  // sin disparar un reload() completo, para no descartar el resto del
  // borrador en curso. Este override sustituye a unit.profiles.base hasta
  // que la próxima carga real de la unidad lo traiga ya incluido.
  const [baseProfileOverride, setBaseProfileOverride] = useState<AttributeProfile | null>(null)
  // Mismo mecanismo que `baseProfileOverride`, para el grupo de mando: dar de
  // alta o de baja un rol escribe al momento (es una fila suelta, no hay
  // borrador que perder), pero sin reload() para no descartar el resto de
  // cambios en curso. Este override sustituye a unit.commandOptions hasta la
  // próxima carga real de la unidad.
  const [commandOverride, setCommandOverride] = useState<UnitDetail['commandOptions'] | null>(null)
  const [commandBusy, setCommandBusy] = useState(false)

  // Solo se resetea el borrador cuando llega una unidad "fresca" de verdad
  // (carga inicial o justo después de guardar con éxito) — reload() ya no
  // se llama desde ningún toggle/edición suelta, así que esto nunca pisa
  // cambios en curso.
  useEffect(() => {
    if (unit) {
      setDraft(draftFromUnit(unit))
      setDirty(false)
      setBaseProfileOverride(null)
      setCommandOverride(null)
    }
  }, [unit])

  // Avisa de cambios sin guardar al navegar dentro de la app (data router).
  const blocker = useBlocker(dirty)

  // Fallback para cierre/recarga de la pestaña (useBlocker no cubre esto).
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  function updateDraft(updater: (d: UnitDraft) => UnitDraft) {
    setDraft((d) => (d ? updater(d) : d))
    setDirty(true)
  }

  if (loading) {
    return <Spinner />
  }

  if (error || !unit || !draft) {
    return (
      <div>
        <button onClick={() => navigate(-1)} className="mb-3 text-sm text-ink-soft hover:text-ink">
          ← Volver
        </button>
        <div className="rounded-sm border border-danger-dark/40 bg-danger-dark/10 px-4 py-3">
          <p className="text-sm font-medium text-danger-dark">No se pudo cargar esta unidad.</p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          <button onClick={reload} className="mt-2 text-xs font-medium text-maroon hover:underline">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  async function handleSave() {
    if (!draft) return
    const validation = validateUnitScalarInput(draft.scalar)
    if (validation.length > 0) {
      setIssues(validation.map((v) => v.message))
      return
    }
    setIssues([])
    setSaving(true)
    try {
      await UnitRepository.saveUnitDetail(unitId, {
        scalar: draft.scalar,
        specialRuleIds: [...draft.specialRuleIds],
        equipmentIds: [...draft.equipmentIds],
        upgradeIds: [...draft.upgradeIds],
        defaultEquipmentIds: [...draft.defaultEquipmentIds],
        defaultUpgradeIds: [...draft.defaultUpgradeIds],
        mountProfileIds: [...draft.mountProfileIds],
        chariotProfileIds: [...draft.chariotProfileIds],
        mountProfileCosts: draft.mountProfileCosts,
        chariotProfileCosts: draft.chariotProfileCosts,
        championNames: Object.fromEntries(
          Object.entries(draft.championNames).map(([roleId, name]) => {
            const trimmed = name.trim()
            return [roleId, trimmed === '' || trimmed === DEFAULT_CHAMPION_NAME ? null : trimmed]
          }),
        ),
        commandCosts: draft.commandCosts,
        profileStats: draft.profileStats,
        tropas: draft.tropas.map((tropa) => ({ ...tropa, name: tropa.name.trim() || null })),
        equipoPorTropa: draft.equipoPorTropa,
        nombreDeLaPrincipal: draft.nombreDeLaPrincipal.trim() || null,
      })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
      reload()
    } finally {
      setSaving(false)
    }
  }

  // --------------------------------------------------------------------------
  // Unidades compuestas
  //
  // Dar de alta y de baja una tropa ESCRIBE AL MOMENTO, como "Crear ficha base"
  // o dar de alta un Campeón: crea y destruye fichas de atributos, y eso no
  // cabe en un borrador que se guarda al final. Lo que se escribe en ella
  // —nombre, precio, tamaños y características— sí va al borrador y se guarda
  // con el botón, como todo lo demás.
  // --------------------------------------------------------------------------

  async function anadirTropa() {
    const tropa = await UnitRepository.addTropaSecundaria(unitId)
    updateDraft((d) => ({
      ...d,
      tropas: [...d.tropas, tropaEnEdicion(tropa)],
      profileStats: { ...d.profileStats, [tropa.id]: extractProfileInput(tropa) },
    }))
  }

  async function quitarTropa(tropa: TropaEnEdicion) {
    await UnitRepository.removeTropaSecundaria(unitId, tropa.profileId)
    setTropaPorQuitar(null)
    updateDraft((d) => {
      const profileStats = { ...d.profileStats }
      delete profileStats[tropa.profileId]
      const equipoPorTropa: Record<number, number[]> = {}
      for (const [equipmentId, ids] of Object.entries(d.equipoPorTropa)) {
        const quedan = ids.filter((id) => id !== tropa.profileId)
        if (quedan.length > 0) equipoPorTropa[Number(equipmentId)] = quedan
      }
      return {
        ...d,
        tropas: d.tropas.filter((x) => x.profileId !== tropa.profileId),
        profileStats,
        equipoPorTropa,
      }
    })
  }

  /** El orden se escribe al momento: es un número suelto y no hay nada que deshacer. */
  function moverTropa(index: number, delta: number) {
    if (!draft) return
    const destino = index + delta
    if (destino < 0 || destino >= draft.tropas.length) return
    const tropas = [...draft.tropas]
    ;[tropas[index], tropas[destino]] = [tropas[destino], tropas[index]]
    updateDraft((d) => ({ ...d, tropas }))
    void UnitRepository.reorderTropas(
      unitId,
      tropas.map((x) => x.profileId),
    )
  }

  function setTropa(profileId: number, cambio: Partial<TropaEnEdicion>) {
    updateDraft((d) => ({
      ...d,
      tropas: d.tropas.map((x) => (x.profileId === profileId ? { ...x, ...cambio } : x)),
    }))
  }

  /** Sin ninguna tropa marcada, la opción vuelve a ser de toda la unidad. */
  function toggleEquipoDeTropa(equipmentId: number, profileId: number, enabled: boolean) {
    updateDraft((d) => {
      const actuales = d.equipoPorTropa[equipmentId] ?? []
      const siguientes = enabled ? [...actuales, profileId] : actuales.filter((x) => x !== profileId)
      const equipoPorTropa = { ...d.equipoPorTropa }
      if (siguientes.length === 0) delete equipoPorTropa[equipmentId]
      else equipoPorTropa[equipmentId] = siguientes
      return { ...d, equipoPorTropa }
    })
  }

  function toggleDraft(kind: 'specialRuleIds' | 'equipmentIds' | 'upgradeIds', otherId: number, enabled: boolean) {
    updateDraft((d) => {
      const next = new Set(d[kind])
      if (enabled) next.add(otherId)
      else next.delete(otherId)
      const draftUpdate: UnitDraft = { ...d, [kind]: next }
      // Al quitar una opción de equipo/mejora, también deja de estar marcada
      // "por defecto" — no tendría sentido guardar un is_default huérfano de
      // una opción que ya no está asignada a la unidad.
      if (!enabled && kind === 'equipmentIds') {
        const nextDefaults = new Set(d.defaultEquipmentIds)
        nextDefaults.delete(otherId)
        draftUpdate.defaultEquipmentIds = nextDefaults
      }
      if (!enabled && kind === 'upgradeIds') {
        const nextDefaults = new Set(d.defaultUpgradeIds)
        nextDefaults.delete(otherId)
        draftUpdate.defaultUpgradeIds = nextDefaults
      }
      return draftUpdate
    })
  }

  function toggleDraftDefault(kind: 'defaultEquipmentIds' | 'defaultUpgradeIds', otherId: number, isDefault: boolean) {
    updateDraft((d) => {
      const next = new Set(d[kind])
      if (isDefault) next.add(otherId)
      else next.delete(otherId)
      return { ...d, [kind]: next }
    })
  }

  function toggleDraftProfile(profileId: number, role: 'montura' | 'carro', enabled: boolean) {
    const key = role === 'montura' ? 'mountProfileIds' : 'chariotProfileIds'
    updateDraft((d) => {
      const next = new Set(d[key])
      if (enabled) next.add(profileId)
      else next.delete(profileId)
      return { ...d, [key]: next }
    })
  }

  /** Coste extra en puntos de una montura/carro concreto — solo relevante para personajes (ver Panel "Montura/Dotación"/"Perfil de carro"). */
  function setProfileCost(profileId: number, role: 'montura' | 'carro', cost: number | null) {
    const key = role === 'montura' ? 'mountProfileCosts' : 'chariotProfileCosts'
    updateDraft((d) => ({ ...d, [key]: { ...d[key], [profileId]: cost } }))
  }

  function setChampionName(roleId: number, value: string) {
    updateDraft((d) => ({ ...d, championNames: { ...d.championNames, [roleId]: value } }))
  }

  function setCommandCost(roleId: number, cost: number) {
    updateDraft((d) => ({ ...d, commandCosts: { ...d.commandCosts, [roleId]: cost } }))
  }

  function setProfileStats(profileId: number, input: AttributeProfileInput) {
    updateDraft((d) => ({ ...d, profileStats: { ...d.profileStats, [profileId]: input } }))
  }

  async function createBaseProfileNow() {
    const created = await UnitRepository.createBaseProfile(unitId)
    setBaseProfileOverride(created)
    setProfileStats(created.id, extractProfileInput(created))
  }

  const baseProfile = unit.profiles.base ?? baseProfileOverride
  const commandOptions = commandOverride ?? unit.commandOptions

  /**
   * Todas las tropas de la unidad para la tabla de equipo: la principal la
   * primera, con el nombre de la unidad, y las secundarias en su orden.
   */
  const tropasDeLaUnidad: Array<{ profileId: number; nombre: string }> = [
    ...(baseProfile ? [{ profileId: baseProfile.id, nombre: draft.scalar.name.trim() || 'Principal' }] : []),
    ...draft.tropas.map((tropa) => ({ profileId: tropa.profileId, nombre: tropa.name.trim() || 'Sin nombre' })),
  ]

  /** Da de alta o de baja un rol de mando (Músico, Portaestandarte, Campeón). */
  async function toggleCommandRole(role: CommandRole, enabled: boolean) {
    setCommandBusy(true)
    try {
      await UnitRepository.toggleCommandRole(unitId, role.id, enabled)
      setCommandOverride(
        enabled
          ? [...commandOptions, { role, cost: 0, customName: null, profile: null }].sort(
              (a, b) => a.role.id - b.role.id,
            )
          : commandOptions.filter((o) => o.role.id !== role.id),
      )
      // El coste arranca en 0 en el borrador para que "Guardar cambios" no
      // escriba un UPDATE con `undefined` sobre la fila recién creada.
      updateDraft((d) => ({ ...d, commandCosts: { ...d.commandCosts, [role.id]: enabled ? 0 : 0 } }))
    } finally {
      setCommandBusy(false)
    }
  }

  /** Crea la ficha de atributos propia del Campeón, que al añadirlo no trae ninguna. */
  async function createCommandProfileNow(roleId: number) {
    const created = await UnitRepository.createCommandProfile(unitId, roleId)
    setCommandOverride(commandOptions.map((o) => (o.role.id === roleId ? { ...o, profile: created } : o)))
    setProfileStats(created.id, extractProfileInput(created))
  }

  const ruleItems = (allRules ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description }))
  const equipmentItems = (allEquipment ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    cost: e.cost,
    subtitle: e.category ? EQUIPMENT_CATEGORY_LABELS[e.category] : undefined,
  }))
  // Sin subtítulo con la línea de atributos: la ficha completa ya se ve justo
  // debajo, en la tabla — repetirla aquí sería mostrar el mismo dato dos veces.
  const mountRelationItems = (mountItems ?? []).map((p) => ({ id: p.id, name: p.name ?? '(sin nombre)' }))
  const chariotRelationItems = (chariotItems ?? []).map((p) => ({ id: p.id, name: p.name ?? '(sin nombre)' }))

  // Las iniciales que se verán en la mesa, y con quién chocan dentro de la
  // facción. Escritas a mano, un choque impide guardar; automáticas, solo avisa
  // (ver el comentario junto al aviso).
  const aliasEfectivo = draft.scalar.alias ?? inicialesDe(draft.scalar.name)
  const choqueDeAlias = unidadesConLasMismasIniciales(aliasEfectivo, unidadesDeLaFaccion ?? [], unit.id)
  const aliasEscritoRepetido = draft.scalar.alias != null && choqueDeAlias.length > 0

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-3 flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Volver
      </button>

      <PageHeader
        title={unit.name}
        description={`${unit.faction.name}${unit.category ? ` · ${unit.category.name}` : ''}`}
        actions={
          <div className="flex items-center gap-3">
            {dirty && !saving && <span className="text-xs font-medium text-bronze">● Cambios sin guardar</span>}
            {/* Los apéndices se guardan en su propia ventana, aparte del
                borrador de la ficha (ver AppendicesModal): son textos largos y
                no deben depender de que aquí se pulse "Guardar cambios". */}
            <Button variant="secondary" onClick={() => setShowAppendices(true)}>
              Apéndices{numApendices > 0 ? ` (${numApendices})` : ''}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || aliasEscritoRepetido}
              title={aliasEscritoRepetido ? 'Las iniciales están repetidas en esta facción' : undefined}
            >
              {savedFlash && !saving && <CheckIcon className="h-4 w-4" />}
              {saving ? 'Guardando…' : savedFlash ? 'Guardado' : 'Guardar cambios'}
            </Button>
          </div>
        }
      />

      {issues.length > 0 && (
        <div className="mb-4 rounded-sm border border-danger-dark/40 bg-danger-dark/10 px-4 py-3">
          {issues.map((msg) => (
            <p key={msg} className="text-sm text-danger-dark">
              {msg}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* --------------------------------------------------------------
              Rejilla de 12 columnas, con los campos repartidos como se leen:

                fila 1 · Nombre · Coste · Categoría
                fila 2 · Etiqueta · Equipo
                fila 3 · tamaños · T.S. · 0-1   (solo en tropa)

              Los anchos son PROPORCIONALES AL DATO: un nombre necesita sitio,
              un coste son tres dígitos y un tamaño dos. Las filas se cierran
              siempre completas, sin medias líneas vacías.
              -------------------------------------------------------------- */}
          <Panel title="Datos generales">
            {/* Rejilla de 12 columnas con los campos repartidos como se leen:

                  fila 1 · Nombre · Coste · Categoría
                  fila 2 · Etiqueta · Equipo
                  fila 3 · los tres tamaños y el 0-1   (solo en tropa)

                Los anchos son PROPORCIONALES AL DATO: un nombre necesita sitio
                y un tamaño son dos dígitos. Las filas se cierran siempre
                completas, sin medias líneas vacías.

                `items-end` alinea los campos por ABAJO, para que un rótulo que
                se parta en dos líneas no deje su caja a otra altura que las de
                al lado. */}
            <div className="grid grid-cols-12 items-end gap-x-3 gap-y-4">
              {/* Fila 1 */}
              <div className="col-span-12 sm:col-span-6">
                <TextField
                  label="Nombre"
                  value={draft.scalar.name}
                  onChange={(e) => updateDraft((d) => ({ ...d, scalar: { ...d.scalar, name: e.target.value } }))}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <TextField
                  label="Coste (pts)"
                  type="number"
                  max={999}
                  value={draft.scalar.baseCost}
                  onChange={(e) =>
                    updateDraft((d) => ({ ...d, scalar: { ...d.scalar, baseCost: Number(e.target.value) } }))
                  }
                />
              </div>
              <div className="col-span-8 sm:col-span-4">
                <Select
                  label="Categoría"
                  value={draft.scalar.categoryId ?? ''}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      scalar: { ...d.scalar, categoryId: e.target.value ? Number(e.target.value) : null },
                    }))
                  }
                >
                  <option value="">Sin categoría</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Fila 2. La ETIQUETA manda además en la magia: si es Hechicero
                  o Archimago, al añadir el personaje a un ejército se le podrán
                  elegir sendas (ver isWizardTag). */}
              <div className="col-span-12 sm:col-span-4">
                <Select
                  label="Etiqueta"
                  value={draft.scalar.typeTagId ?? ''}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      scalar: { ...d.scalar, typeTagId: e.target.value ? Number(e.target.value) : null },
                    }))
                  }
                >
                  <option value="">Sin etiqueta</option>
                  {typeTags?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-8">
                <TextField
                  label="Equipo"
                  placeholder="p.ej. Arma de mano, escudo"
                  value={draft.scalar.equipmentText ?? ''}
                  onChange={(e) =>
                    updateDraft((d) => ({ ...d, scalar: { ...d.scalar, equipmentText: e.target.value || null } }))
                  }
                />
              </div>

              {/* Fila 3 — solo tropa: un personaje es una sola miniatura, así
                  que no tiene tamaños ni puede ser 0-1, y la fila desaparece
                  entera en vez de quedarse a medias.

                  Los tres tamaños son de DOS DÍGITOS, así que van en cajas de
                  ancho fijo y no repartidos por la rejilla: con una columna de
                  cuatro doceavos cada uno, tres campos de dos cifras ocupaban
                  media pantalla. El 0-1 va detrás, en la misma línea. */}
              {unit.unitType !== 'personaje' && (
                <div className="col-span-12 flex flex-wrap items-end gap-x-3 gap-y-3">
                  <div className="w-16">
                    <TextField
                      label="Mínimo"
                      type="number"
                      max={99}
                      className="text-center"
                      value={draft.scalar.minSize ?? ''}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          scalar: { ...d.scalar, minSize: e.target.value ? Number(e.target.value) : null },
                        }))
                      }
                    />
                  </div>
                  <div className="w-16">
                    <TextField
                      label="Máximo"
                      type="number"
                      max={99}
                      className="text-center"
                      value={draft.scalar.maxSize ?? ''}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          scalar: { ...d.scalar, maxSize: e.target.value ? Number(e.target.value) : null },
                        }))
                      }
                    />
                  </div>
                  <div className="w-16">
                    <TextField
                      label="Inicial"
                      type="number"
                      max={99}
                      className="text-center"
                      title="Tamaño de partida sugerido al añadir esta unidad a una lista (no es un límite, solo precarga la cantidad)."
                      value={draft.scalar.defaultSize ?? ''}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          scalar: { ...d.scalar, defaultSize: e.target.value ? Number(e.target.value) : null },
                        }))
                      }
                    />
                  </div>
                  <span className="pb-1.5 text-mini text-ink-soft/70">miniaturas</span>

                  {/* Ojo: el 0-1 no es tamaño. Limita cuántas UNIDADES de este
                      tipo caben en el ejército, no cuántas miniaturas la
                      forman. */}
                  <label
                    className="flex cursor-pointer items-center gap-2 pb-1.5 text-xs text-ink-soft"
                    title="Solo una unidad de este tipo en todo el ejército. No limita el número de miniaturas."
                  >
                    <input
                      type="checkbox"
                      className="accent-maroon"
                      checked={draft.scalar.isUnique}
                      onChange={(e) =>
                        updateDraft((d) => ({ ...d, scalar: { ...d.scalar, isUnique: e.target.checked } }))
                      }
                    />
                    Unidad única (0-1)
                  </label>
                </div>
              )}
            </div>
            {/* "Notas internas" se oculta de la ficha (se dejó de pedir
                mostrarla) pero sigue viajando en draft.scalar.notes tal cual se
                cargó, así que "Guardar cambios" no la borra de la base. */}
          </Panel>

          {/* --------------------------------------------------------------
              EL ALIAS: UN RÓTULO Y UNA CASILLA, EN UNA LÍNEA.
              No son "datos generales" de la unidad —es un dato de dibujo que
              solo existe para el Despliegue—, así que sigue teniendo sitio
              propio; pero tres caracteres no dan para un apartado entero.

              AQUÍ ESTUVO UN PÁRRAFO EXPLICANDO QUÉ ES. Ocupaba cuatro veces
              más que el campo que explicaba, y lo que decía cabe en el
              `title`: quien no sepa qué es lo mira una vez, y quien ya lo sabe
              —que es el caso siempre menos el primero— no vuelve a leerlo
              cada vez que abre una unidad. El sustituto del texto es el
              PLACEHOLDER, que enseña las iniciales que se van a usar si se
              deja en blanco en vez de contarlo con palabras.

              Va en una caja como la de los apartados de al lado para que no
              parezca un campo suelto entre paneles, pero de una sola línea.
              -------------------------------------------------------------- */}
          <section className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-sm border border-rule-dark/40 bg-parchment/70 px-3 py-2">
            <label htmlFor="alias-despliegue" className="font-display text-lg leading-tight font-semibold text-ink">
              Alias
            </label>
            <input
              id="alias-despliegue"
              maxLength={ALIAS_MAX}
              placeholder={inicialesDe(draft.scalar.name) || '—'}
              value={draft.scalar.alias ?? ''}
              onChange={(e) =>
                updateDraft((d) => ({ ...d, scalar: { ...d.scalar, alias: normalizarAlias(e.target.value) } }))
              }
              title="Lo que se escribe dentro de la peana en el Despliegue, tres caracteres como mucho. En blanco se usan las iniciales del nombre. No se usa en ningún otro sitio."
              className={clsx(
                'w-16 rounded-sm border bg-parchment/70 px-2 py-1 text-center text-xs uppercase text-ink outline-none',
                'transition-colors focus:border-bronze focus:ring-2 focus:ring-bronze/25',
                aliasEscritoRepetido ? 'border-danger' : 'border-rule-dark/50',
              )}
            />

            {/* El choque se dice al lado, y debajo cuando no cabe: en un campo
                de tres caracteres no cabe explicar nada.

                Escritas a mano y repetidas → error, y no deja guardar. Si son
                las automáticas del nombre → solo aviso: hay 31 choques
                heredados en el catálogo y bloquear el guardado de todos ellos
                impediría trabajar en una unidad por algo que no se ha tocado. */}
            {choqueDeAlias.length > 0 && (
              <p
                className={clsx(
                  'flex min-w-[14rem] flex-1 items-start gap-1.5 text-xs leading-relaxed',
                  aliasEscritoRepetido ? 'text-danger' : 'text-bronze',
                )}
              >
                <WarningIcon className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>
                  <b>{aliasEfectivo}</b> ya {choqueDeAlias.length === 1 ? 'lo usa' : 'lo usan'}{' '}
                  {choqueDeAlias.map((u) => u.name).join(', ')} en esta facción.{' '}
                  {aliasEscritoRepetido
                    ? 'Escribe otras iniciales para poder guardar.'
                    : 'Escribe unas iniciales propias para distinguirlas en la mesa.'}
                </span>
              </p>
            )}
          </section>

          <Panel title="Opciones de equipo">
            <RelationEditor
              allItems={equipmentItems}
              selectedIds={draft.equipmentIds}
              onToggle={(otherId, enabled) => toggleDraft('equipmentIds', otherId, enabled)}
              addLabel="Añadir opción de equipo"
              onCreateNew={(query) => setCreatingEquipmentQuery(query)}
              createNewLabel="Crear opción de equipo"
              defaultIds={draft.defaultEquipmentIds}
              onToggleDefault={(otherId, isDefault) => toggleDraftDefault('defaultEquipmentIds', otherId, isDefault)}
            />

            {/* De quién es cada opción, solo si la unidad tiene más de una
                tropa. En una normal no habría nada que elegir: todas las
                opciones son de todos. Sin marcar ninguna, la opción sigue
                siendo de toda la unidad. */}
            {draft.tropas.length > 0 && draft.equipmentIds.size > 0 && (
              <div className="mt-3 border-t border-rule-dark/20 pt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-micro font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                      <th className="pb-1 text-left font-semibold">Opción</th>
                      {tropasDeLaUnidad.map((tr) => (
                        <th key={tr.profileId} className="pb-1 px-1 text-center font-semibold">
                          {tr.nombre}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-dark/12">
                    {equipmentItems
                      .filter((item) => draft.equipmentIds.has(item.id))
                      .map((item) => (
                        <tr key={item.id}>
                          {/* Con el coste al lado: es lo que se mira al
                              decidir quién la lleva, y en esta rejilla no se
                              ve el de la lista de arriba. */}
                          <td className="py-1 pr-2 text-ink">
                            {item.name}
                            {item.cost !== undefined && <span className="ml-1 text-ink-soft">({item.cost} pts)</span>}
                          </td>
                          {tropasDeLaUnidad.map((tr) => (
                            <td key={tr.profileId} className="px-1 py-1 text-center">
                              <input
                                type="checkbox"
                                aria-label={`${item.name} para ${tr.nombre}`}
                                checked={(draft.equipoPorTropa[item.id] ?? []).includes(tr.profileId)}
                                onChange={(e) => toggleEquipoDeTropa(item.id, tr.profileId, e.target.checked)}
                                className="h-3.5 w-3.5 accent-maroon"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Opciones de unidad">
            <RelationEditor
              allItems={allUpgrades ?? []}
              selectedIds={draft.upgradeIds}
              onToggle={(otherId, enabled) => toggleDraft('upgradeIds', otherId, enabled)}
              addLabel="Añadir opción de unidad"
              onCreateNew={(query) => setCreatingUpgradeQuery(query)}
              createNewLabel="Crear opción de unidad"
              defaultIds={draft.defaultUpgradeIds}
              onToggleDefault={(otherId, isDefault) => toggleDraftDefault('defaultUpgradeIds', otherId, isDefault)}
            />
          </Panel>

          <Panel title="Reglas especiales">
            <RelationEditor
              allItems={ruleItems}
              selectedIds={draft.specialRuleIds}
              onToggle={(otherId, enabled) => toggleDraft('specialRuleIds', otherId, enabled)}
              addLabel="Añadir regla especial"
              confirmRemove
            />
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* La T.S. vive en la cabecera del PERFIL BASE y no en Datos
              generales: es un atributo más de la miniatura, y ahí se lee junto
              a F, R, H y el resto en vez de a dos cuadros de distancia.

              Lista cerrada porque los únicos valores legales son 0-6. El 0
              ("—") afirma que no tiene salvación, que es distinto de "todavía
              sin rellenar" (vacío). */}
          <Panel
            title="Perfil base"
            headerRight={
              <label className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-ink-soft">T.S.</span>
                <select
                  value={draft.scalar.armorSave ?? ''}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      scalar: { ...d.scalar, armorSave: e.target.value === '' ? null : Number(e.target.value) },
                    }))
                  }
                  className="rounded-sm border border-rule-dark/40 bg-parchment px-1.5 py-1 text-xs text-ink outline-none focus:border-bronze"
                >
                  <option value="" />
                  {ARMOR_SAVE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {formatArmorSave(value)}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            {/* EL NOMBRE DE LA TROPA PRINCIPAL, solo si la unidad tiene más.
                Sin él, la principal se llama como la unidad entera, y en el
                constructor —donde cada tropa tiene su cuadro de cantidad—
                salía "Manada de Bestias (Gors)" sobre un campo de dos cifras
                mientras la de al lado ponía "Ungor". */}
            {baseProfile && draft.tropas.length > 0 && (
              <div className="mb-3 w-40">
                <TextField
                  label="Nombre de esta tropa"
                  value={draft.nombreDeLaPrincipal}
                  placeholder="Gor"
                  onChange={(e) => updateDraft((d) => ({ ...d, nombreDeLaPrincipal: e.target.value }))}
                />
              </div>
            )}
            {baseProfile ? (
              <EditableAttributeTable
                value={draft.profileStats[baseProfile.id] ?? extractProfileInput(baseProfile)}
                onChange={(input) => setProfileStats(baseProfile.id, input)}
              />
            ) : (
              <div>
                <p className="mb-2 text-xs text-ink-soft">Esta unidad todavía no tiene ficha de atributos.</p>
                <Button variant="ghost" onClick={createBaseProfileNow}>
                  <PlusIcon className="h-4 w-4" />
                  Crear ficha base
                </Button>
              </div>
            )}
          </Panel>

          {/* UNIDADES COMPUESTAS. La tropa que ya está arriba —el perfil base,
              con el coste y los tamaños de "Datos generales"— es la PRINCIPAL;
              aquí van las demás. Sin ninguna, la unidad es normal y lo único
              que se ve es el botón. */}
          {unit.unitType !== 'personaje' && (
            <Panel
              title="Otras tropas de la unidad"
              headerRight={
                <Button variant="ghost" onClick={() => void anadirTropa()}>
                  <PlusIcon className="h-4 w-4" />
                  Añadir tropa
                </Button>
              }
            >
              {draft.tropas.length === 0 ? (
                <p className="text-xs italic text-ink-soft/55">Ninguna.</p>
              ) : (
                <div className="space-y-3">
                  {draft.tropas.map((tropa, index) => (
                    <div
                      key={tropa.profileId}
                      className="rounded-sm border border-rule-dark/30 bg-parchment-dark/15 p-3"
                    >
                      <div className="mb-2.5 flex flex-wrap items-end gap-x-3 gap-y-2">
                        <div className="min-w-[7rem] flex-1">
                          <TextField
                            label="Nombre"
                            value={tropa.name}
                            placeholder="Ungor"
                            onChange={(e) => setTropa(tropa.profileId, { name: e.target.value })}
                          />
                        </div>
                        <div className="w-20">
                          <TextField
                            label="Puntos"
                            type="number"
                            max={999}
                            className="text-center"
                            value={tropa.cost}
                            onChange={(e) => setTropa(tropa.profileId, { cost: Number(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="w-16">
                          <TextField
                            label="Mínimo"
                            type="number"
                            max={99}
                            className="text-center"
                            value={tropa.minSize ?? ''}
                            onChange={(e) =>
                              setTropa(tropa.profileId, { minSize: e.target.value ? Number(e.target.value) : null })
                            }
                          />
                        </div>
                        <div className="w-16">
                          <TextField
                            label="Máximo"
                            type="number"
                            max={99}
                            className="text-center"
                            value={tropa.maxSize ?? ''}
                            onChange={(e) =>
                              setTropa(tropa.profileId, { maxSize: e.target.value ? Number(e.target.value) : null })
                            }
                          />
                        </div>
                        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink">
                          <input
                            type="checkbox"
                            checked={tropa.countsTowardSize}
                            onChange={(e) => setTropa(tropa.profileId, { countsTowardSize: e.target.checked })}
                            className="h-3.5 w-3.5 accent-maroon"
                          />
                          Cuenta para el tamaño
                        </label>
                        <div className="ml-auto flex items-center gap-0.5 pb-1">
                          <button
                            type="button"
                            onClick={() => moverTropa(index, -1)}
                            disabled={index === 0}
                            aria-label="Subir"
                            title="Subir"
                            className="rounded-sm p-1 text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze disabled:opacity-30"
                          >
                            <ArrowUpIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moverTropa(index, 1)}
                            disabled={index === draft.tropas.length - 1}
                            aria-label="Bajar"
                            title="Bajar"
                            className="rounded-sm p-1 text-ink-soft transition-colors hover:bg-bronze/10 hover:text-bronze disabled:opacity-30"
                          >
                            <ArrowDownIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTropaPorQuitar(tropa)}
                            aria-label={`Quitar ${tropa.name.trim() || 'la tropa'}`}
                            title="Quitar"
                            className="rounded-sm p-1 text-ink-soft transition-colors hover:bg-danger/10 hover:text-danger"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <EditableAttributeTable
                        value={draft.profileStats[tropa.profileId] ?? FICHA_EN_BLANCO}
                        onChange={(input) => setProfileStats(tropa.profileId, input)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* Solo en unidades de TROPA. Un personaje es una única miniatura:
              no puede llevar músico, portaestandarte ni campeón, así que
              ofrecerle esos puestos era invitar a crear datos imposibles.
              Mismo criterio que los tamaños mínimo/máximo de más arriba.

              Dentro de la tropa el panel se muestra SIEMPRE, tenga o no
              opciones todavía: antes solo aparecía si la unidad ya traía
              alguna, y en una unidad creada desde cero no había forma de
              añadir grupo de mando salvo importándola de un libro o copiando
              otra. */}
          {unit.unitType !== 'personaje' && (
            <Panel title="Grupo de mando">
              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 border-b border-rule-dark/20 pb-3">
                {(commandRoles ?? []).map((role) => (
                  <label key={role.id} className="flex items-center gap-2 text-xs text-ink">
                    <input
                      type="checkbox"
                      className="accent-maroon"
                      disabled={commandBusy}
                      checked={commandOptions.some((o) => o.role.id === role.id)}
                      onChange={(e) => toggleCommandRole(role, e.target.checked)}
                    />
                    {role.name}
                  </label>
                ))}
              </div>

              {commandOptions.length === 0 ? (
                <p className="text-xs text-ink-soft italic">Esta unidad no lleva grupo de mando.</p>
              ) : (
                <ul className="space-y-3 text-xs">
                  {commandOptions.map(({ role, cost, profile }) =>
                    role.code === 'CAMPEON' ? (
                      <li key={role.id}>
                        <div className="flex items-center justify-between gap-3">
                          <input
                            value={draft.championNames[role.id] ?? DEFAULT_CHAMPION_NAME}
                            onChange={(e) => setChampionName(role.id, e.target.value)}
                            placeholder={DEFAULT_CHAMPION_NAME}
                            className="min-w-0 flex-1 rounded-sm border border-rule-dark/40 bg-parchment/70 px-2 py-1 text-xs text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
                          />
                          <label className="flex shrink-0 items-center gap-1 text-ink-soft">
                            +
                            <EnteroInput
                              min={0}
                              value={draft.commandCosts[role.id] ?? cost}
                              onChange={(e) => setCommandCost(role.id, Number(e.target.value) || 0)}
                              className="w-14 rounded-sm border border-rule-dark/40 bg-parchment/70 px-1.5 py-1 text-center text-xs text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
                            />
                            pts
                          </label>
                        </div>
                        {profile ? (
                          <div className="mt-2">
                            <EditableAttributeTable
                              value={draft.profileStats[profile.id] ?? extractProfileInput(profile)}
                              onChange={(input) => setProfileStats(profile.id, input)}
                            />
                          </div>
                        ) : (
                          // Mismo caso que la ficha base: un Campeón recién
                          // añadido no trae perfil, y sin este botón no había
                          // forma de dárselo.
                          <div className="mt-2 flex items-center gap-3">
                            <p className="text-xs text-ink-soft italic">Sin ficha propia todavía.</p>
                            <Button variant="ghost" onClick={() => createCommandProfileNow(role.id)}>
                              <PlusIcon className="h-4 w-4" />
                              Crear ficha del campeón
                            </Button>
                          </div>
                        )}
                      </li>
                    ) : (
                      <li key={role.id} className="flex items-center justify-between gap-3">
                        <span className="text-ink-soft">{role.name}</span>
                        <label className="flex shrink-0 items-center gap-1 text-ink-soft">
                          +
                          <EnteroInput
                            min={0}
                            value={draft.commandCosts[role.id] ?? cost}
                            onChange={(e) => setCommandCost(role.id, Number(e.target.value) || 0)}
                            className="w-14 rounded-sm border border-rule-dark/40 bg-parchment/70 px-1.5 py-1 text-center text-xs text-ink outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/25"
                          />
                          pts
                        </label>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </Panel>
          )}

          <Panel title="Montura/Dotación">
            <RelationEditor
              allItems={mountRelationItems}
              selectedIds={draft.mountProfileIds}
              onToggle={(otherId, enabled) => toggleDraftProfile(otherId, 'montura', enabled)}
              addLabel="Añadir Montura/Dotación"
              emptyLabel="Esta facción todavía no tiene monturas asociadas en el catálogo."
            />
            {draft.mountProfileIds.size > 0 && (
              <div className="mt-4 space-y-4 border-t border-rule-dark/20 pt-4">
                {(mountItems ?? [])
                  .filter((p) => draft.mountProfileIds.has(p.id))
                  .map((p) => (
                    <div key={p.id}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-ink-soft">{p.name}</p>
                        {unit.unitType === 'personaje' && (
                          <div className="w-20">
                            <TextField
                              label="Coste (pts)"
                              type="number"
                              min={0}
                              placeholder="0"
                              value={draft.mountProfileCosts[p.id] ?? ''}
                              onChange={(e) =>
                                setProfileCost(p.id, 'montura', e.target.value ? Number(e.target.value) : null)
                              }
                            />
                          </div>
                        )}
                      </div>
                      <AttributeTable profile={p} />
                    </div>
                  ))}
              </div>
            )}
          </Panel>

          <Panel title="Perfil de carro">
            <RelationEditor
              allItems={chariotRelationItems}
              selectedIds={draft.chariotProfileIds}
              onToggle={(otherId, enabled) => toggleDraftProfile(otherId, 'carro', enabled)}
              addLabel="Añadir perfil de carro"
              emptyLabel="Esta facción todavía no tiene carros asociados en el catálogo."
            />
            {draft.chariotProfileIds.size > 0 && (
              <div className="mt-4 space-y-4 border-t border-rule-dark/20 pt-4">
                {(chariotItems ?? [])
                  .filter((p) => draft.chariotProfileIds.has(p.id))
                  .map((p) => (
                    <div key={p.id}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-ink-soft">{p.name}</p>
                        {unit.unitType === 'personaje' && (
                          <div className="w-20">
                            <TextField
                              label="Coste (pts)"
                              type="number"
                              min={0}
                              placeholder="0"
                              value={draft.chariotProfileCosts[p.id] ?? ''}
                              onChange={(e) =>
                                setProfileCost(p.id, 'carro', e.target.value ? Number(e.target.value) : null)
                              }
                            />
                          </div>
                        )}
                      </div>
                      <AttributeTable profile={p} />
                    </div>
                  ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {showAppendices && (
        <AppendicesModal
          unitId={unitId}
          unitName={unit.name}
          onClose={() => setShowAppendices(false)}
          onChanged={reloadApendices}
        />
      )}

      {tropaPorQuitar && (
        <ConfirmDialog
          title="Quitar la tropa"
          message={`Se quita "${tropaPorQuitar.name.trim() || 'esta tropa'}" de la unidad, con su ficha de atributos. No se puede deshacer.`}
          confirmLabel="Sí, quitarla"
          cancelLabel="No"
          onConfirm={() => quitarTropa(tropaPorQuitar)}
          onCancel={() => setTropaPorQuitar(null)}
        />
      )}

      {creatingEquipmentQuery !== null && (
        <EquipmentCreateModal
          initialName={creatingEquipmentQuery}
          onClose={() => setCreatingEquipmentQuery(null)}
          onCreated={(newId) => {
            toggleDraft('equipmentIds', newId, true)
            setCreatingEquipmentQuery(null)
            reloadEquipment()
          }}
        />
      )}

      {creatingUpgradeQuery !== null && (
        <UpgradeCreateModal
          initialName={creatingUpgradeQuery}
          onClose={() => setCreatingUpgradeQuery(null)}
          onCreated={(newId) => {
            toggleDraft('upgradeIds', newId, true)
            setCreatingUpgradeQuery(null)
            reloadUpgrades()
          }}
        />
      )}

      {blocker.state === 'blocked' && (
        <UnsavedChangesDialog
          saving={saving}
          onKeepEditing={() => blocker.reset()}
          onDiscardAndLeave={() => blocker.proceed()}
          onSaveAndLeave={async () => {
            await handleSave()
            blocker.proceed()
          }}
        />
      )}
    </div>
  )
}
