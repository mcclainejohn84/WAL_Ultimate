// ============================================================================
// FORJA DE OBJETOS MÁGICOS
//
// Un objeto mágico se forja imbuyéndole CARACTERÍSTICAS MÁGICAS: hasta tres,
// de la tabla de su tipo (armas, armaduras, estandartes o amuletos). Puede
// llevar además un SELLO, que cuenta como una de esas tres.
//
// EL COSTE SE PAGA AL ASIGNARLO, NO AL FORJARLO. Forjar es gratis: se arma el
// objeto, se le ponen características y se le cambia lo que haga falta. Lo que
// cuesta es ponérselo a alguien: el personaje paga de su experiencia la suma de
// todo lo que lleva el objeto. Y desde ese momento el objeto queda CERRADO —no
// se le tocan ni las características ni el sello—, porque si no, se le podría
// añadir poder a un objeto ya pagado.
//
// Quitárselo devuelve la experiencia entera, que es lo que permite pasarse un
// objeto de un personaje a otro sin que el cambio cueste nada: el primero
// recupera lo que pagó y el segundo lo paga.
//
// CUÁNTOS PUEDE LLEVAR CADA UNO lo dice su rango: uno un campeón veterano, dos
// un héroe y tres un comandante. Sin rango no lleva ninguno. Y de cada TIPO
// solo puede llevar uno (un arma, una armadura...).
//
// El catálogo de aquí es la SEMILLA: lo que de verdad manda es la tabla
// `magic_item_traits`, que se edita en Editor > Objetos mágicos. Mismo
// criterio que las habilidades de personaje y las de magia.
// ============================================================================

/** Los cuatro tipos de objeto. El sello no es un tipo: es una marca aparte. */
export type TipoDeObjeto = 'arma' | 'armadura' | 'estandarte' | 'amuleto'

/** Lo que puede llevar grabado un objeto: una característica de su tipo, o un sello. */
export type TipoDeCaracteristica = TipoDeObjeto | 'sello'

export const TIPOS_DE_OBJETO: TipoDeObjeto[] = ['arma', 'armadura', 'estandarte', 'amuleto']

export const ETIQUETAS_DE_OBJETO: Record<TipoDeObjeto, string> = {
  arma: 'Arma',
  armadura: 'Armadura',
  estandarte: 'Estandarte',
  amuleto: 'Amuleto',
}

/** En plural, para las cabeceras de las listas. */
export const ETIQUETAS_EN_PLURAL: Record<TipoDeCaracteristica, string> = {
  arma: 'Armas',
  armadura: 'Armaduras',
  estandarte: 'Estandartes',
  amuleto: 'Amuletos',
  sello: 'Sellos mágicos',
}

/** Hasta tres, y el sello cuenta como una. */
export const MAX_CARACTERISTICAS = 3

export interface CaracteristicaMagica {
  clave: string
  nombre: string
  tipo: TipoDeCaracteristica
  coste: number
  descripcion: string | null
  sortOrder: number
}

/** Cuántos objetos puede llevar cada rango. Sin rango, ninguno. */
export const OBJETOS_POR_RANGO: Record<string, number> = {
  'rango:campeon-veterano': 1,
  'rango:heroe': 2,
  'rango:comandante': 3,
}

/**
 * Cuántos objetos mágicos admite un personaje, según el rango que haya
 * comprado. Si tuviera varios rangos apuntados manda el más alto.
 */
export function topeDeObjetos(clavesDeHabilidad: string[]): number {
  let tope = 0
  for (const clave of clavesDeHabilidad) tope = Math.max(tope, OBJETOS_POR_RANGO[clave] ?? 0)
  return tope
}

/** Lo que cuesta un objeto: la suma de todo lo que lleva grabado. */
export function costeDelObjeto(caracteristicas: { coste: number }[]): number {
  return caracteristicas.reduce((suma, c) => suma + c.coste, 0)
}

/**
 * POR QUÉ NO SE LE PUEDE DAR ESTE OBJETO A ESTE PERSONAJE, en una frase corta,
 * o null si sí se puede.
 *
 * Vive aquí, y no en la pantalla ni en el repositorio, porque hacen falta las
 * DOS COSAS a la vez: la lista de personajes tiene que decir de antemano quién
 * no puede y por qué —ofrecer un nombre que luego da error es hacer perder un
 * clic—, y el repositorio tiene que volver a comprobarlo antes de cobrar nada.
 * Escrito dos veces, las dos versiones se habrían separado al primer cambio de
 * reglamento.
 */
export function motivoParaNoAsignar(datos: {
  /** Cuántos objetos admite por su rango (ver topeDeObjetos). */
  tope: number
  /** Los que ya lleva. */
  suyos: { tipo: TipoDeObjeto }[]
  /** El tipo del objeto que se le quiere dar. */
  tipo: TipoDeObjeto
  /** Su experiencia disponible y lo que cuesta el objeto. */
  saldo: number
  coste: number
}): string | null {
  if (datos.tope === 0) return 'todavía no tiene rango'
  if (datos.suyos.length >= datos.tope) {
    return `su rango no le deja llevar más de ${datos.tope}`
  }
  if (datos.suyos.some((o) => o.tipo === datos.tipo)) {
    return `ya lleva ${ETIQUETAS_DE_OBJETO[datos.tipo].toLowerCase()}`
  }
  if (datos.saldo < datos.coste) return `le faltan ${datos.coste - datos.saldo} de experiencia`
  return null
}

/** Las notas al pie de la tabla del reglamento, metidas en la descripción de quien las lleva. */
const UNA_VEZ = 'Puede utilizarse una vez por batalla.'
const SE_DESTRUYE = 'Se destruye al usar el objeto.'

function arma(clave: string, nombre: string, coste: number, descripcion: string | null = null) {
  return { clave: `arma:${clave}`, nombre, tipo: 'arma' as const, coste, descripcion }
}
function armadura(clave: string, nombre: string, coste: number, descripcion: string | null = null) {
  return { clave: `armadura:${clave}`, nombre, tipo: 'armadura' as const, coste, descripcion }
}
function estandarte(clave: string, nombre: string, coste: number, descripcion: string | null = null) {
  return { clave: `estandarte:${clave}`, nombre, tipo: 'estandarte' as const, coste, descripcion }
}
function amuleto(clave: string, nombre: string, coste: number, descripcion: string | null = null) {
  return { clave: `amuleto:${clave}`, nombre, tipo: 'amuleto' as const, coste, descripcion }
}
function sello(clave: string, nombre: string, coste: number, descripcion: string) {
  return { clave: `sello:${clave}`, nombre, tipo: 'sello' as const, coste, descripcion }
}

/**
 * LA TABLA DE CARACTERÍSTICAS MÁGICAS, en el orden y con los costes del
 * reglamento. El orden de cada lista es el de la tabla (de más barato a más
 * caro), y se respeta a propósito: así se busca igual en la pantalla que en el
 * papel.
 */
const SIN_ORDEN: Omit<CaracteristicaMagica, 'sortOrder'>[] = [
  // ---- ARMAS -------------------------------------------------------------
  arma('iniciativa', '+1 Iniciativa', 5),
  arma('hp', '+1 Hp', 6),
  arma('f10', 'Puede efectuar sus ataques con F10', 8, SE_DESTRUYE),
  arma('ha', '+1 Ha', 10),
  arma('experiencia-por-unidad', '+1 de experiencia por cada unidad aniquilada', 10),
  arma('menos-salvacion', '-1 a la tirada de salvación por armadura', 12),
  arma('1d3-heridas', 'Causa 1D3 Heridas', 12),
  arma('golpe-letal', 'Golpe Letal', 14),
  arma('ataque', '+1 Ataque', 15),
  arma('bola-de-fuego', 'Posee el hechizo bola de fuego', 15),
  arma('repetir-impactar', 'Repetir las tiradas falladas para impactar', 15),
  arma('hiere-3', 'Hiere con 3+', 18),
  arma('repetir-herir', 'Repetir las tiradas falladas para herir', 18),
  arma('fuerza', '+1 Fuerza', 20),
  arma('al-impactar', '+1 al impactar', 20),

  // ---- ARMADURAS ---------------------------------------------------------
  armadura('salvacion', '+1 a la tirada de salvación', 10),
  armadura('herida', '+1 Herida', 11),
  armadura('resistencia', '+1 Resistencia', 12),
  armadura('terror', 'Causa Terror', 12),
  armadura('ignora-armas-magicas', 'Ignora los efectos de las armas mágicas', 12),
  armadura('salvacion-sin-fuerza', 'La tirada de salvación no puede reducirse por fuerza', 12),
  armadura('liderazgo', '+1 Liderazgo', 13),
  armadura('hieren-4', 'Los ataques enemigos hieren con un máximo de 4+', 15),
  armadura('primera-herida', 'Ignora la primera herida sufrida', 16, UNA_VEZ),
  armadura('resta-ataques', 'Resta 1D3 ataques a una miniatura enemiga', 18),

  // ---- ESTANDARTES -------------------------------------------------------
  estandarte('terreno-dificil', 'Ignorar el Terreno Difícil', 8),
  estandarte('impactos-f4', '1D6 impactos de F4 a 45 cm.', 10, UNA_VEZ),
  estandarte('temor', 'Causa Temor', 10),
  estandarte('dispersa', 'Dispersa con 4+ hechizos lanzados contra la unidad', 12),
  estandarte('movimiento', '+2 cm. al movimiento', 15),
  estandarte('repetir-tirada', 'Repetir una tirada de dados por batalla', 15),
  estandarte('menos-proyectiles', '-1 al impactar con proyectiles a la unidad', 15),
  estandarte('monturas-no-atacan', 'Las monturas no atacan el turno de carga', 18, UNA_VEZ),
  estandarte('resultado-combate', '+1 al resultado del combate', 20),
  estandarte('salvacion', '+1 a la tirada de salvación', 22),

  // ---- AMULETOS ----------------------------------------------------------
  amuleto('hechizo-nivel-1', 'Posee un hechizo de nivel 1', 8, UNA_VEZ),
  amuleto('experiencia-por-batalla', '+1 de experiencia por batalla', 8),
  amuleto('vidente', 'Habilidad Mágica Vidente', 12),
  amuleto('liderazgo', '+1 al Liderazgo', 13),
  amuleto('salvacion-especial', 'Tirada de salvación especial 5+', 15),
  amuleto('repite-tirada', 'Repite una tirada de dados', 15, UNA_VEZ),
  amuleto('ignora-cicatriz', 'Ignora una cicatriz de guerra', 15, SE_DESTRUYE),
  amuleto('anula-objetos', 'Anula los objetos mágicos enemigos en combate', 15),
  amuleto('ignora-desmoralizacion', 'Ignora un fallo en un chequeo de desmoralización', 18, UNA_VEZ),
  amuleto('escapar', '+1 a la tirada para escapar', 20),

  // ---- SELLOS MÁGICOS ----------------------------------------------------
  sello(
    'marcado',
    'Marcado',
    0,
    'El objeto mágico fue forjado para ser utilizado contra un enemigo concreto y su poder solo aflora cuando su dueño lucha contra esa facción. Las características mágicas cuestan la mitad (redondeando hacia arriba).',
  ),
  sello(
    'arcano',
    'Arcano',
    0,
    'El objeto contiene energías místicas que solo los hechiceros son capaces de controlar. El objeto solo puede ser usado por un hechicero.',
  ),
  sello(
    'protegido',
    'Protegido',
    6,
    'Durante su forja, el objeto fue imbuido con poderosas protecciones mágicas que impiden que cualquiera pueda usarlo. Cuando el objeto sea robado, el personaje enemigo que intente utilizarlo no podrá hacerlo si obtiene un resultado de 1 o 2 en 1D6 antes de cada batalla.',
  ),
  sello(
    'dedicado',
    'Dedicado',
    10,
    'El objeto mágico está dedicado a una raza, y su poder solo surge cuando es utilizado por personajes de una facción determinada.',
  ),
  sello(
    'maldito',
    'Maldito',
    12,
    'Sobre el objeto pesa una terrible maldición que afecta a cualquiera que utilice el objeto sin el beneplácito de su dueño. Si un personaje enemigo intenta utilizar este objeto, no podrá hacerlo si obtiene un resultado de 1 o 2 en 1D6 antes de cada batalla. Además, el personaje estará obligado a repetir una tirada de dados por batalla, a elección del antiguo propietario del objeto.',
  ),
  sello(
    'oculto',
    'Oculto',
    14,
    'Cuando el personaje cae en batalla el objeto se torna invisible a ojos del enemigo. El objeto solo podrá ser robado con un resultado de 5+ en 1D6.',
  ),
  sello(
    'escogido',
    'Escogido',
    14,
    'Este sello permite a quien forje el objeto mantener su naturaleza y entrelazarla con características mágicas. Las características mágicas son grabadas en un objeto especial (un arma a dos manos, una lanza, una armadura de Gromril…).',
  ),
]

/**
 * El catálogo con su orden ya puesto: el de la tabla del reglamento. Se calcula
 * aquí y no a mano para que añadir una línea en medio no obligue a renumerar
 * las cuarenta de abajo.
 */
export const CATALOGO_DE_OBJETOS: CaracteristicaMagica[] = SIN_ORDEN.map((c, indice) => ({
  ...c,
  sortOrder: indice + 1,
}))

export const CARACTERISTICA_POR_CLAVE = new Map(CATALOGO_DE_OBJETOS.map((c) => [c.clave, c]))

/** De qué tipo es una clave, leyéndolo de la propia clave ('arma:fuerza' → 'arma'). */
export function tipoDeClave(clave: string): TipoDeCaracteristica | null {
  const prefijo = clave.split(':')[0]
  return prefijo === 'sello' || (TIPOS_DE_OBJETO as string[]).includes(prefijo)
    ? (prefijo as TipoDeCaracteristica)
    : null
}
