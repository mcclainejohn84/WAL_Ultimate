// ============================================================================
// Reglas de negocio del constructor de listas ("Ejércitos"): cálculo de
// coste y validación de legalidad. Ninguna consulta SQL aquí — solo lógica
// pura sobre los tipos de dominio, para que sea testeable y reutilizable
// tanto desde la UI del constructor como, en el futuro, desde el PDF.
// ============================================================================
import type { ArmyListEntry, UnitDetail } from '@/domain/types'

export interface ArmyListIssue {
  severity: 'error' | 'warning'
  message: string
}

/** Lo mínimo que hace falta para calcular el coste de una entrada (real o en borrador, antes de tener id). */
export interface EntryCostInput {
  quantity: number
  /**
   * El desglose de una unidad COMPUESTA: ficha de cada tropa -> cuántas
   * miniaturas. Vacío o ausente en una normal, y entonces el cálculo es el de
   * siempre.
   */
  troopQuantities?: Record<number, number>
  equipmentIds: number[]
  upgradeIds: number[]
  hasStandardBearer: boolean
  hasMusician: boolean
  hasChampion: boolean
  mountProfileId: number | null
  chariotProfileId: number | null
  /**
   * Coste a mano que pisa al calculado. Opcional porque también se calcula el
   * coste de una entrada que todavía no existe (el botón "Añadir a la lista"),
   * y ahí no hay nada que pisar.
   */
  costOverride?: number | null
}

/**
 * Coste de una entrada: cantidad*(coste base + equipo elegido por miniatura)
 * + opciones de unidad (coste plano, no se multiplica por cantidad) + grupo
 * de mando (coste plano por rol marcado) + montura/carro (coste plano, ver
 * unit_profiles.cost — normalmente 0, pero los personajes suelen pagar
 * puntos extra por su montura). Misma fórmula que el "Hoja de Ejército"
 * original (`numero * (costeTropa + costeEquipo) + costeUnidad + costeP +
 * costeM + costeC`), generalizada de un único equipo/opción a conjuntos de
 * varios y con el coste de montura añadido para personajes.
 *
 * Si la entrada tiene COSTE A MANO, manda ese y no se calcula nada. Se
 * comprueba aquí, en el único sitio por el que pasan el total, el PDF, el
 * ordenar por coste y el resumen por categorías, para que un coste retocado
 * valga a todos los efectos sin tener que acordarse en cada pantalla.
 */
/**
 * Las tropas de una unidad, con su precio por miniatura: la PRINCIPAL (el
 * perfil base, a `baseCost`) y después las secundarias. En una unidad normal
 * es una sola.
 *
 * Se exporta porque el constructor pinta exactamente esta lista: un campo de
 * cantidad por tropa, en este mismo orden.
 */
export function tropasDeLaUnidad(unit: UnitDetail): Array<{
  profileId: number
  nombre: string
  cost: number
  minSize: number | null
  maxSize: number | null
  countsTowardSize: boolean
  esPrincipal: boolean
}> {
  const principal =
    unit.profiles.base == null
      ? []
      : [
          {
            profileId: unit.profiles.base.id,
            nombre: unit.profiles.base.name?.trim() || unit.name,
            cost: unit.baseCost,
            minSize: unit.minSize,
            maxSize: unit.maxSize,
            countsTowardSize: true,
            esPrincipal: true,
          },
        ]
  return [
    ...principal,
    ...unit.profiles.tropas.map((tropa) => ({
      profileId: tropa.id,
      nombre: tropa.name?.trim() || 'Tropa',
      cost: tropa.cost,
      minSize: tropa.minSize,
      maxSize: tropa.maxSize,
      countsTowardSize: tropa.countsTowardSize,
      esPrincipal: false,
    })),
  ]
}

/** Si esta opción de equipo la puede llevar esta tropa. Sin tropas anotadas, la lleva toda la unidad. */
export function equipoDeLaTropa(opcion: { profileIds: number[] }, profileId: number): boolean {
  return opcion.profileIds.length === 0 || opcion.profileIds.includes(profileId)
}

/**
 * Cuántas miniaturas CUENTAN para el tamaño de la unidad. Es lo que se guarda
 * en `army_list_entries.quantity` y lo que ven el despliegue, el orden de
 * batalla y los PDF.
 *
 * Una tropa con `countsTowardSize` apagado se paga pero no engorda la unidad.
 */
export function totalDeMiniaturas(unit: UnitDetail, troopQuantities: Record<number, number>): number {
  return tropasDeLaUnidad(unit)
    .filter((tropa) => tropa.countsTowardSize)
    .reduce((suma, tropa) => suma + (troopQuantities[tropa.profileId] ?? 0), 0)
}

export function computeEntryCost(unit: UnitDetail, input: EntryCostInput): number {
  // UN PERSONAJE DE RENOMBRE CON EL COSTE OCULTO NO SUMA NADA: ni él, ni su
  // equipo, ni su montura, ni su grupo de mando. Va ANTES que el coste a mano
  // a propósito: "este personaje no paga puntos" es una decisión sobre el
  // personaje entero, más fuerte que un número retocado en una entrada suelta
  // —que además seguirá ahí, intacto, en cuanto se vuelva a activar el coste.
  if (unit.hideCost) return 0
  if (input.costOverride != null) return input.costOverride

  const equipmentCost = unit.equipmentOptions
    .filter((e) => input.equipmentIds.includes(e.id))
    .reduce((sum, e) => sum + e.cost, 0)

  const upgradeCost = unit.upgradeOptions
    .filter((u) => input.upgradeIds.includes(u.id))
    .reduce((sum, u) => sum + u.cost, 0)

  const commandCost = unit.commandOptions.reduce((sum, opt) => {
    if (opt.role.code === 'PORTAESTANDARTE' && input.hasStandardBearer) return sum + opt.cost
    if (opt.role.code === 'MUSICO' && input.hasMusician) return sum + opt.cost
    if (opt.role.code === 'CAMPEON' && input.hasChampion) return sum + opt.cost
    return sum
  }, 0)

  const mountCost = unit.profiles.montura.find((p) => p.id === input.mountProfileId)?.cost ?? 0
  const chariotCost = unit.profiles.carro.find((p) => p.id === input.chariotProfileId)?.cost ?? 0

  // UNA UNIDAD COMPUESTA SE PAGA TROPA A TROPA: cada una tiene su precio por
  // miniatura y su propio equipo, y un escudo que solo pueden llevar los Gor
  // no se le puede cobrar también a los Ungor. Las opciones sin tropa anotada
  // son de toda la unidad y se cobran a todas, que es lo que pasa siempre en
  // una unidad normal.
  //
  // Lo de fuera de la tropa —mejoras, grupo de mando, montura y carro— se
  // paga una vez por unidad, igual que antes.
  if (unit.profiles.tropas.length > 0) {
    const porTropa = tropasDeLaUnidad(unit).reduce((suma, tropa) => {
      const cuantas = input.troopQuantities?.[tropa.profileId] ?? 0
      const suEquipo = unit.equipmentOptions
        .filter((e) => input.equipmentIds.includes(e.id) && equipoDeLaTropa(e, tropa.profileId))
        .reduce((s, e) => s + e.cost, 0)
      return suma + cuantas * (tropa.cost + suEquipo)
    }, 0)
    return porTropa + upgradeCost + commandCost + mountCost + chariotCost
  }

  return input.quantity * (unit.baseCost + equipmentCost) + upgradeCost + commandCost + mountCost + chariotCost
}

export function computeListTotal(entries: ArmyListEntry[]): number {
  return entries.reduce((sum, e) => sum + computeEntryCost(e.unit, e), 0)
}

/**
 * Valida una entrada antes de añadirla/guardarla: tamaño min/max, equipo y
 * opciones de unidad incompatibles entre sí, y unidad única repetida. Son las
 * cosas que de verdad pueden hacer una lista ilegal por sí solas, así que se
 * tratan como error bloqueante (el llamador decide si impide guardar o solo
 * avisa fuerte). `excludeEntryId` se usa al editar una entrada ya existente,
 * para no contarla como "duplicado de sí misma" en la comprobación de
 * unicidad.
 */
export function validateEntryInput(
  unit: UnitDetail,
  input: { quantity: number; equipmentIds: number[]; upgradeIds: number[]; troopQuantities?: Record<number, number> },
  incompatiblePairs: Array<[number, number]>,
  otherEntries: ArmyListEntry[],
  excludeEntryId?: number,
  upgradeIncompatiblePairs: Array<[number, number]> = [],
): ArmyListIssue[] {
  const issues: ArmyListIssue[] = []

  if (input.quantity < 1) {
    issues.push({ severity: 'error', message: `La cantidad debe ser al menos 1.` })
  }

  // EN UNA UNIDAD COMPUESTA el tamaño se mira TROPA A TROPA, y el de la unidad
  // entera no se mira: sumar Gor y Ungor y compararlo con un solo mínimo no
  // dice nada (una manada de 20 Ungor y ningún Gor sumaría 20 y seguiría
  // siendo ilegal).
  //
  // Una tropa a CERO no se valida: no llevarla es una opción —una manada puede
  // ser solo de Gor—, y exigirle su mínimo a algo que no está obligaría a
  // meter de todo en todas las unidades.
  if (unit.profiles.tropas.length > 0) {
    for (const tropa of tropasDeLaUnidad(unit)) {
      const cuantas = input.troopQuantities?.[tropa.profileId] ?? 0
      if (cuantas === 0) continue
      if (tropa.minSize != null && cuantas < tropa.minSize) {
        issues.push({ severity: 'error', message: `${tropa.nombre}: el mínimo es ${tropa.minSize}.` })
      }
      if (tropa.maxSize != null && cuantas > tropa.maxSize) {
        issues.push({ severity: 'error', message: `${tropa.nombre}: el máximo es ${tropa.maxSize}.` })
      }
    }
    if (tropasDeLaUnidad(unit).every((tropa) => (input.troopQuantities?.[tropa.profileId] ?? 0) === 0)) {
      issues.push({ severity: 'error', message: `${unit.name}: no lleva ninguna miniatura.` })
    }
  }
  // "0-1" NO dice nada sobre el tamaño: limita cuántas UNIDADES de ese tipo
  // caben en el ejército (una), no cuántas miniaturas tiene la unidad — que
  // seguirá siendo un regimiento normal, casi siempre de más de una. Esa
  // comprobación de "ya está añadida" está más abajo; aquí el tamaño se
  // valida como en cualquier otra unidad.
  // El tamaño de la unidad ENTERA, solo si no es compuesta: en una compuesta
  // ese mínimo es el de su tropa principal y ya se ha mirado arriba.
  if (unit.profiles.tropas.length === 0) {
    if (unit.minSize != null && input.quantity < unit.minSize) {
      issues.push({ severity: 'error', message: `${unit.name}: el tamaño mínimo es ${unit.minSize}.` })
    }
    if (unit.maxSize != null && input.quantity > unit.maxSize) {
      issues.push({ severity: 'error', message: `${unit.name}: el tamaño máximo es ${unit.maxSize}.` })
    }
  }

  const selected = new Set(input.equipmentIds)
  for (const [a, b] of incompatiblePairs) {
    if (selected.has(a) && selected.has(b)) {
      const nameA = unit.equipmentOptions.find((e) => e.id === a)?.name ?? `#${a}`
      const nameB = unit.equipmentOptions.find((e) => e.id === b)?.name ?? `#${b}`
      issues.push({ severity: 'error', message: `"${nameA}" y "${nameB}" son incompatibles entre sí.` })
    }
  }

  // Mismo mecanismo que el equipo, pero para opciones de unidad (mejoras) —
  // p.ej. las runas de los Golems: solo se puede llevar una a la vez.
  const selectedUpgrades = new Set(input.upgradeIds)
  for (const [a, b] of upgradeIncompatiblePairs) {
    if (selectedUpgrades.has(a) && selectedUpgrades.has(b)) {
      const nameA = unit.upgradeOptions.find((u) => u.id === a)?.name ?? `#${a}`
      const nameB = unit.upgradeOptions.find((u) => u.id === b)?.name ?? `#${b}`
      issues.push({ severity: 'error', message: `"${nameA}" y "${nameB}" son incompatibles entre sí.` })
    }
  }

  if (unit.isUnique) {
    const already = otherEntries.some((e) => e.unit.id === unit.id && e.id !== excludeEntryId)
    if (already) {
      issues.push({
        severity: 'error',
        message: `${unit.name} es 0-1: solo puede haber una unidad de este tipo en el ejército, y ya está añadida.`,
      })
    }
  }

  return issues
}

/**
 * Orden por defecto al AÑADIR una unidad nueva a la lista (no es un orden que
 * se reimponga sobre la lista entera en cada render — el usuario puede
 * reordenar libremente después a mano, ver ArmyListRepository.reorderEntries
 * — solo decide en qué posición cae una unidad recién añadida): primero
 * Personajes, luego Básicas, Especiales y Singulares, y el resto (Asedio,
 * Bestia, o sin categoría) al final, en ese orden.
 */
const CATEGORY_INSERT_ORDER: Record<string, number> = {
  PERSONAJE: 0,
  BASICA: 1,
  ESPECIAL: 2,
  SINGULAR: 3,
}
const DEFAULT_CATEGORY_INSERT_RANK = 4

export function categoryInsertRank(categoryCode: string | null | undefined): number {
  if (categoryCode == null) return DEFAULT_CATEGORY_INSERT_RANK
  return CATEGORY_INSERT_ORDER[categoryCode] ?? DEFAULT_CATEGORY_INSERT_RANK
}

/**
 * Calcula en qué posición (índice 0..N) debe insertarse una unidad nueva
 * dentro del orden ACTUAL de la lista (que puede ya venir alterado a mano por
 * el usuario): justo antes de la primera entrada existente cuya categoría
 * tenga un rango posterior al de la unidad nueva. Si no hay ninguna, va al
 * final. Esto respeta cualquier reordenación manual previa — solo agrupa la
 * unidad nueva con las de su misma categoría (o categorías anteriores), sin
 * reordenar nada que ya estuviera puesto.
 */
export function computeCategoryInsertIndex(
  existingEntries: Array<{ unit: { category: { code: string } | null } }>,
  newUnit: { category: { code: string } | null },
): number {
  const newRank = categoryInsertRank(newUnit.category?.code)
  const idx = existingEntries.findIndex((e) => categoryInsertRank(e.unit.category?.code) > newRank)
  return idx === -1 ? existingEntries.length : idx
}

// ============================================================================
// Reconciliación con el catálogo (ver reconcileEntries)
// ============================================================================

export interface EntryReconcileNote {
  entryId: number
  unitName: string
  /** Opciones que ya no existen (o que ya no pertenecen a la unidad) y se han retirado solas. */
  removed: string[]
  /** Motivos por los que la entrada ha quedado en conflicto y se le han desmarcado TODAS las opciones. */
  conflicts: string[]
}

export interface ReconcileResult {
  entries: ArmyListEntry[]
  notes: EntryReconcileNote[]
  /** true si alguna entrada ha cambiado (hay que guardar para consolidarlo). */
  changed: boolean
}

/**
 * Pone al día una lista ya guardada frente al catálogo ACTUAL, porque entre
 * que se guardó y se vuelve a abrir el editor ha podido cambiar: borrarse una
 * opción, dejar de pertenecer a la unidad, o declararse incompatible con otra
 * que la entrada ya llevaba. `validateEntryInput` solo corre al guardar una
 * entrada, así que sin esto una lista guardada puede quedarse indefinidamente
 * en un estado que hoy sería ilegal, y en silencio.
 *
 * Dos tratamientos distintos, decididos con el usuario:
 *
 * - Opción que ya no existe → se retira sola y se informa. No hay nada que
 *   decidir: la opción no está.
 * - Incompatibilidad nueva → se desmarcan TODAS las opciones de esa entrada y
 *   se pide volver a elegirlas. Se limpia la entrada entera, y no solo una de
 *   las dos piezas en conflicto, porque elegir cuál sobrevive es una decisión
 *   del jugador (y a menudo cambia el resto de la configuración).
 *
 * Importante: solo se tocan las entradas afectadas. Las demás se devuelven tal
 * cual, para que un cambio en el catálogo no obligue a rehacer el ejército
 * entero.
 */
export function reconcileEntries(
  entries: ArmyListEntry[],
  equipmentPairs: Array<[number, number]>,
  upgradePairs: Array<[number, number]>,
): ReconcileResult {
  const notes: EntryReconcileNote[] = []
  let changed = false

  const nextEntries = entries.map((entry) => {
    const validEquipment = new Map(entry.unit.equipmentOptions.map((e) => [e.id, e.name]))
    const validUpgrades = new Map(entry.unit.upgradeOptions.map((u) => [u.id, u.name]))

    // 1) Retirar lo que ya no está en el catálogo de la unidad.
    const removed: string[] = []
    const equipmentIds = entry.equipmentIds.filter((optionId) => {
      if (validEquipment.has(optionId)) return true
      removed.push(`equipo #${optionId}`)
      return false
    })
    const upgradeIds = entry.upgradeIds.filter((optionId) => {
      if (validUpgrades.has(optionId)) return true
      removed.push(`opción #${optionId}`)
      return false
    })

    // 2) Buscar incompatibilidades nuevas entre lo que queda.
    const conflicts: string[] = []
    const selectedEquipment = new Set(equipmentIds)
    for (const [a, b] of equipmentPairs) {
      if (selectedEquipment.has(a) && selectedEquipment.has(b)) {
        conflicts.push(`"${validEquipment.get(a) ?? `#${a}`}" y "${validEquipment.get(b) ?? `#${b}`}"`)
      }
    }
    const selectedUpgrades = new Set(upgradeIds)
    for (const [a, b] of upgradePairs) {
      if (selectedUpgrades.has(a) && selectedUpgrades.has(b)) {
        conflicts.push(`"${validUpgrades.get(a) ?? `#${a}`}" y "${validUpgrades.get(b) ?? `#${b}`}"`)
      }
    }

    if (removed.length === 0 && conflicts.length === 0) return entry

    changed = true
    notes.push({ entryId: entry.id, unitName: entry.unit.name, removed, conflicts })

    // En conflicto se vacía la entrada entera; si solo faltaban opciones
    // borradas, se conserva el resto de la selección.
    return conflicts.length > 0
      ? { ...entry, equipmentIds: [], upgradeIds: [] }
      : { ...entry, equipmentIds, upgradeIds }
  })

  return { entries: nextEntries, notes, changed }
}

/**
 * Avisos a nivel de lista completa: por ahora solo el límite de puntos
 * superado (nunca bloquea — se decidió expresamente que solo avise). Ya no
 * comprueba unidades "obligatorias": ese campo se eliminó de la ficha de
 * unidad por ser redundante.
 */
export function validateList(entries: ArmyListEntry[], pointsLimit: number | null): ArmyListIssue[] {
  const issues: ArmyListIssue[] = []

  if (pointsLimit != null) {
    const total = computeListTotal(entries)
    if (total > pointsLimit) {
      issues.push({
        severity: 'warning',
        message: `La lista supera el límite de ${pointsLimit} pts (lleva ${total} pts).`,
      })
    }
  }

  return issues
}
