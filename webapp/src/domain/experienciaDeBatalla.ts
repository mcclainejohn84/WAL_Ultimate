// ============================================================================
// EXPERIENCIA DE BATALLA: la tabla de acciones del reglamento de campaña y lo
// que vale cada una, para apuntarle a un personaje lo que hizo en una batalla
// eligiendo de la lista en vez de escribir puntos a mano.
//
// La tabla es la del reglamento, tal cual. Tres clases de puntos:
//  - Los de las acciones EN CURSIVA (las del propio personaje: sobrevivir,
//    capturar, matar un monstruo…) son obligatoriamente para quien las
//    consiguió.
//  - El resto los gana el BANDO y su jugador los reparte entre los personajes
//    que hayan participado. Los de ganar la batalla son por defecto del
//    General del ejército, aunque se pueden repartir siempre que al menos
//    1 punto sea para el General.
// Por eso los puntos de cada línea se pueden corregir una vez elegida: lo que
// se reparte entre varios no le llega entero a cada uno.
//
// Reglas puras (sin pantalla ni base de datos): las usa ExperienciaDeBatallaModal
// y se prueban sin navegador.
// ============================================================================

export type GrupoDeAccion = 'personaje' | 'victoria' | 'bajas' | 'diferencia'

export interface AccionDeBatalla {
  clave: string
  /** Como en la tabla del reglamento. */
  texto: string
  /** Para el apunte del libro de experiencia, sin el "Por". */
  corto: string
  /** Lo que vale (por cada una, si es "por cada"). */
  puntos: number
  grupo: GrupoDeAccion
  /** "Por cada…": se puede apuntar varias veces y cada una suma. */
  porCada?: boolean
  /**
   * Sus puntos dependen del RANGO de la unidad aniquilada: 1 + rango − 2. Cada
   * unidad va en su propia línea, porque cada una tiene el suyo.
   */
  porRango?: boolean
  /** Solo una del mismo conjunto (los tramos de bajas, por ejemplo). */
  excluyente?: string
  /** La aclaración del reglamento (los asteriscos de la tabla). */
  nota?: string
}

export interface GrupoDeAcciones {
  clave: GrupoDeAccion
  titulo: string
  /** Las acciones del personaje van en cursiva, como en el reglamento. */
  cursiva: boolean
  /** Para quién son los puntos. */
  reparto: string
  /** Aclaración del reglamento que vale para todo el grupo (los dos asteriscos de la tabla). */
  nota?: string
}

const NOTA_INCURSOR = 'Tanto si es una incursión frontal como si el ejército incursor ha sido sorprendido y emboscado.'
const NOTA_ASEDIO =
  'En un asedio se duplican estos valores y se contabiliza partiendo de que el atacante tendrá el doble de puntos ' +
  'que el defensor. Ej.: un ejército asediado de 1500 puntos que vence al atacante de 3400 puntos no obtiene ' +
  'bonificación extra por diferencia de puntos (debería ser de al menos 3600 puntos para obtenerla).'

export const GRUPOS_DE_ACCIONES: GrupoDeAcciones[] = [
  {
    clave: 'personaje',
    titulo: 'Acciones del personaje',
    cursiva: true,
    reparto: 'Los puntos de estas acciones son obligatoriamente para el personaje que las ha conseguido.',
  },
  {
    clave: 'victoria',
    titulo: 'Victoria',
    cursiva: false,
    reparto:
      'Los puntos por ganar la batalla son por defecto para el personaje que actúa como General del ejército. ' +
      'El jugador puede repartirlos entre sus personajes, pero al menos 1 punto debe ser para el General.',
  },
  {
    clave: 'bajas',
    titulo: 'Bajas enemigas',
    cursiva: false,
    reparto: 'Los gana el bando: el jugador los reparte entre los personajes que hayan participado en la batalla.',
  },
  {
    clave: 'diferencia',
    titulo: 'Diferencia de puntos',
    cursiva: false,
    reparto: 'Los gana el bando: el jugador los reparte entre los personajes que hayan participado en la batalla.',
    nota: NOTA_ASEDIO,
  },
]

const a = (
  clave: string,
  texto: string,
  puntos: number,
  grupo: GrupoDeAccion,
  extra: Partial<AccionDeBatalla> = {},
): AccionDeBatalla => ({
  clave,
  texto,
  corto: texto.replace(/^Por (cada )?/, '').replace(/^./, (c) => c.toUpperCase()),
  puntos,
  grupo,
  ...extra,
})

export const ACCIONES_DE_BATALLA: AccionDeBatalla[] = [
  // --- Del personaje (en cursiva en el reglamento) ---
  a('sobrevivir', 'Por sobrevivir a la batalla', 1, 'personaje'),
  a('evitar-captura', 'Por evitar ser capturado si su unidad es aniquilada', 1, 'personaje'),
  a('sobrevivir-cicatriz', 'Por sobrevivir a una cicatriz de guerra', 2, 'personaje', { porCada: true }),
  a('valor-insensato', 'Por llevar a cabo una acción de Valor insensato', 1, 'personaje', { porCada: true }),
  a('estandarte', 'Por cada estandarte capturado', 1, 'personaje', { porCada: true }),
  a('unidad-con-rango', 'Por cada unidad con rango aniquilada', 1, 'personaje', { porRango: true }),
  a('monstruo', 'Por matar un monstruo de 4 o más heridas', 1, 'personaje', { porCada: true }),
  a('campeon-capturado', 'Por cada campeón veterano enemigo capturado', 1, 'personaje', { porCada: true }),
  a('heroe-capturado', 'Por cada héroe enemigo capturado', 2, 'personaje', { porCada: true }),
  a('comandante-capturado', 'Por cada comandante enemigo capturado', 3, 'personaje', { porCada: true }),
  a('general-campana', 'Por capturar al general de la campaña enemigo', 4, 'personaje'),
  a('general-enemigo', 'Por capturar al general enemigo', 2, 'personaje'),
  // --- Victoria (del bando; por defecto, del General) ---
  a('victoria', 'Por obtener la victoria', 2, 'victoria'),
  a('asedio', 'Por vencer en un asedio', 2, 'victoria'),
  a('emboscado', 'Por vencer habiendo sido emboscado', 2, 'victoria'),
  a('incursor', 'Por aniquilar a un ejército incursor', 2, 'victoria', { nota: NOTA_INCURSOR }),
  a('dos-frentes', 'Por ganar una batalla con dos frentes enemigos', 2, 'victoria'),
  a('compuesto-2', 'Por vencer a un ejército compuesto por 2 jugadores', 2, 'victoria', { excluyente: 'compuesto' }),
  a('compuesto-3', 'Por vencer a un ejército compuesto por 3 jugadores', 3, 'victoria', { excluyente: 'compuesto' }),
  a('compuesto-4', 'Por vencer a un ejército compuesto por 4 jugadores', 4, 'victoria', { excluyente: 'compuesto' }),
  // --- Bajas enemigas (un tramo) ---
  a('bajas-0', 'Por causar entre 0 – 499 bajas enemigas', 1, 'bajas', { excluyente: 'bajas' }),
  a('bajas-500', 'Por causar entre 500 – 999 bajas enemigas', 2, 'bajas', { excluyente: 'bajas' }),
  a('bajas-1000', 'Por causar entre 1000 – 1499 bajas enemigas', 3, 'bajas', { excluyente: 'bajas' }),
  a('bajas-1500', 'Por causar entre 1500 – 1999 bajas enemigas', 4, 'bajas', { excluyente: 'bajas' }),
  a('bajas-2000', 'Por causar entre 2000 – 2999 bajas enemigas', 5, 'bajas', { excluyente: 'bajas' }),
  a('bajas-3000', 'Por causar más de 3000 bajas enemigas', 6, 'bajas', { excluyente: 'bajas' }),
  // --- Diferencia de puntos (un tramo) ---
  a('diferencia-300', 'Por ganar a un ejército 300 puntos mayor que el tuyo', 1, 'diferencia', {
    excluyente: 'diferencia',
  }),
  a('diferencia-500', 'Por ganar a un ejército 500 puntos mayor que el tuyo', 2, 'diferencia', {
    excluyente: 'diferencia',
  }),
  a('diferencia-700', 'Por ganar a un ejército 700 puntos mayor que el tuyo', 3, 'diferencia', {
    excluyente: 'diferencia',
  }),
  a('diferencia-900', 'Por ganar a un ejército 900 puntos mayor que el tuyo', 4, 'diferencia', {
    excluyente: 'diferencia',
  }),
  a('diferencia-1000', 'Por ganar a un ejército 1000 puntos mayor que el tuyo', 5, 'diferencia', {
    excluyente: 'diferencia',
  }),
]

export const ACCION_POR_CLAVE = new Map(ACCIONES_DE_BATALLA.map((x) => [x.clave, x]))

// ---------------------------------------------------------------------------
// Lo que se va apuntando
// ---------------------------------------------------------------------------

/** Una línea de lo que se le apunta: una acción, cuántas veces y sus puntos. */
export interface LineaApuntada {
  id: number
  clave: string
  cantidad: number
  /** Solo en "unidad con rango aniquilada". */
  rango: number | null
  puntos: number
  /** Se le han corregido los puntos a mano: ya no se recalculan solos. */
  editada: boolean
}

/** Rango con el que nace la línea de una unidad aniquilada: el que vale 1 punto. */
export const RANGO_INICIAL = 2

/** "1 + Rango − 2", sin bajar de 0. */
export function puntosPorRango(rango: number): number {
  return Math.max(0, 1 + rango - 2)
}

export function puntosPorDefecto(accion: AccionDeBatalla, cantidad: number, rango: number | null): number {
  if (accion.porRango) return puntosPorRango(rango ?? RANGO_INICIAL)
  return accion.puntos * cantidad
}

/**
 * PINCHAR UNA ACCIÓN de la lista:
 *  - "Por cada…": si ya está, una más.
 *  - Unidad con rango: siempre una línea nueva (cada unidad tiene su rango).
 *  - De un conjunto excluyente (un tramo de bajas): sustituye a la otra.
 *  - Cualquier otra: si ya estaba, se quita (el clic la enciende y la apaga).
 */
export function pincharAccion(lineas: LineaApuntada[], clave: string, nuevoId: number): LineaApuntada[] {
  const accion = ACCION_POR_CLAVE.get(clave)
  if (!accion) return lineas
  if (accion.porRango) {
    return [
      ...lineas,
      { id: nuevoId, clave, cantidad: 1, rango: RANGO_INICIAL, puntos: puntosPorRango(RANGO_INICIAL), editada: false },
    ]
  }
  const ya = lineas.find((l) => l.clave === clave)
  if (ya && accion.porCada) return cambiarCantidad(lineas, ya.id, ya.cantidad + 1)
  if (ya) return lineas.filter((l) => l.id !== ya.id)
  const sinRivales = accion.excluyente
    ? lineas.filter((l) => ACCION_POR_CLAVE.get(l.clave)?.excluyente !== accion.excluyente)
    : lineas
  return [...sinRivales, { id: nuevoId, clave, cantidad: 1, rango: null, puntos: accion.puntos, editada: false }]
}

/** Cuántas veces (en "por cada"). A 0 se quita. Si los puntos estaban corregidos, se suma o resta lo que vale cada una. */
export function cambiarCantidad(lineas: LineaApuntada[], id: number, cantidad: number): LineaApuntada[] {
  if (cantidad <= 0) return lineas.filter((l) => l.id !== id)
  return lineas.map((l) => {
    if (l.id !== id) return l
    const accion = ACCION_POR_CLAVE.get(l.clave)
    if (!accion) return l
    const puntos = l.editada
      ? Math.max(0, l.puntos + accion.puntos * (cantidad - l.cantidad))
      : puntosPorDefecto(accion, cantidad, l.rango)
    return { ...l, cantidad, puntos }
  })
}

/** El rango de la unidad aniquilada. Recalcula los puntos salvo que se hayan corregido a mano. */
export function cambiarRango(lineas: LineaApuntada[], id: number, rango: number): LineaApuntada[] {
  const r = Math.max(1, Math.round(rango))
  return lineas.map((l) => (l.id !== id ? l : { ...l, rango: r, puntos: l.editada ? l.puntos : puntosPorRango(r) }))
}

/** Corrige a mano los puntos de una línea (lo que le toca a este personaje del reparto). */
export function cambiarPuntos(lineas: LineaApuntada[], id: number, puntos: number): LineaApuntada[] {
  const p = Math.max(0, Math.round(Number.isFinite(puntos) ? puntos : 0))
  return lineas.map((l) => (l.id !== id ? l : { ...l, puntos: p, editada: true }))
}

export function quitarLinea(lineas: LineaApuntada[], id: number): LineaApuntada[] {
  return lineas.filter((l) => l.id !== id)
}

export function totalDeBatalla(lineas: LineaApuntada[]): number {
  return lineas.reduce((s, l) => s + l.puntos, 0)
}

/** Cuántas veces está elegida una acción (para el contador de la lista). */
export function vecesElegida(lineas: LineaApuntada[], clave: string): number {
  return lineas.filter((l) => l.clave === clave).reduce((s, l) => s + l.cantidad, 0)
}

/**
 * EL APUNTE del libro de experiencia: la batalla y el desglose, en una línea.
 * "Batalla del Paso Negro — Sobrevivir a la batalla: 1 · Estandarte capturado ×2: 2"
 */
export function notaDeBatalla(nombre: string, lineas: LineaApuntada[]): string {
  const titulo = nombre.trim() ? `Batalla: ${nombre.trim()}` : 'Batalla'
  const desglose = lineas
    .map((l) => {
      const accion = ACCION_POR_CLAVE.get(l.clave)
      if (!accion) return null
      const veces = l.cantidad > 1 ? ` ×${l.cantidad}` : ''
      const rango = l.rango != null ? ` (rango ${l.rango})` : ''
      return `${accion.corto}${veces}${rango}: ${l.puntos}`
    })
    .filter(Boolean)
    .join(' · ')
  return desglose ? `${titulo} — ${desglose}` : titulo
}

// ===========================================================================
// UNA BATALLA ENTERA, CON VARIOS PERSONAJES
//
// Lo de cada personaje (las acciones en cursiva) es suyo y se apunta a cada
// uno. Lo del bando (victoria, bajas, diferencia de puntos) se apunta UNA vez
// para la batalla y se reparte entre los que fueron: la suma de lo repartido
// tiene que ser exactamente lo que ganó el bando, ni un punto más ni uno
// menos. Y si hubo puntos por ganar, el General se lleva al menos 1.
// ===========================================================================

export const GRUPOS_DEL_PERSONAJE = GRUPOS_DE_ACCIONES.filter((g) => g.clave === 'personaje')
export const GRUPOS_DEL_BANDO = GRUPOS_DE_ACCIONES.filter((g) => g.clave !== 'personaje')

/** Lo que suman las líneas de un grupo. */
export function totalDelGrupo(lineas: LineaApuntada[], grupo: GrupoDeAccion): number {
  return totalDeBatalla(lineas.filter((l) => ACCION_POR_CLAVE.get(l.clave)?.grupo === grupo))
}

/**
 * Quién puede ir a una batalla de una campaña: los personajes de esa campaña y
 * los que no están en ninguna.
 */
export function puedeIrALaCampana(susCampanas: readonly number[], campanaId: number): boolean {
  return susCampanas.length === 0 || susCampanas.includes(campanaId)
}

/** El reparto de partida: todo para el General (los puntos de ganar son suyos por defecto). */
export function repartoAlGeneral(
  participantes: readonly number[],
  general: number | null,
  total: number,
): Map<number, number> {
  return new Map(participantes.map((id) => [id, id === general ? total : 0]))
}

export interface EstadoDelReparto {
  /** Lo que ganó el bando. */
  total: number
  /** Lo repartido entre los personajes. */
  repartido: number
  /** total − repartido: 0 es lo único que se puede guardar. Negativo = sobra. */
  pendiente: number
  /** Hubo puntos por ganar y el General no se lleva ninguno. */
  generalSinPunto: boolean
}

export function revisarReparto(
  lineasDelBando: LineaApuntada[],
  reparto: ReadonlyMap<number, number>,
  participantes: readonly number[],
  general: number | null,
): EstadoDelReparto {
  const total = totalDeBatalla(lineasDelBando)
  const repartido = participantes.reduce((s, id) => s + (reparto.get(id) ?? 0), 0)
  const victoria = totalDelGrupo(lineasDelBando, 'victoria')
  return {
    total,
    repartido,
    pendiente: total - repartido,
    generalSinPunto: victoria > 0 && (general == null || (reparto.get(general) ?? 0) < 1),
  }
}

/**
 * EL APUNTE de un personaje en una batalla con varios: la batalla (y su
 * campaña), lo suyo con su desglose y su parte de lo del bando, con el
 * desglose del bando para saber de dónde salió.
 * "Batalla: El vado del Reik (Imperio en llamas) — Sobrevivir a la batalla: 1 ·
 *  Del bando: 3 de 7 (Obtener la victoria 2, Causar entre 1000 – 1499 bajas enemigas 5)"
 */
export function notaDeBatallaConjunta(
  nombre: string,
  campana: string | null,
  propias: LineaApuntada[],
  parteDelBando: number,
  lineasDelBando: LineaApuntada[],
): string {
  const base = notaDeBatalla(nombre, propias)
  const titulo = campana ? base.replace(/^Batalla(: [^—]*?)?(?= —|$)/, (m) => `${m} (${campana})`) : base
  if (parteDelBando <= 0) return titulo
  const total = totalDeBatalla(lineasDelBando)
  const deDonde = lineasDelBando
    .map((l) => {
      const accion = ACCION_POR_CLAVE.get(l.clave)
      return accion ? `${accion.corto}${l.cantidad > 1 ? ` ×${l.cantidad}` : ''} ${l.puntos}` : null
    })
    .filter(Boolean)
    .join(', ')
  const delBando = `Del bando: ${parteDelBando} de ${total}${deDonde ? ` (${deDonde})` : ''}`
  return titulo.includes(' — ') ? `${titulo} · ${delBando}` : `${titulo} — ${delBando}`
}
