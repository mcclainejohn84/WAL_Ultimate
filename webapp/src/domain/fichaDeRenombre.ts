// ============================================================================
// LA FICHA DE UN PERSONAJE DE RENOMBRE: todo lo que ha ganado y perdido,
// resuelto desde las claves que guarda la base contra los catálogos.
//
// Nació dentro de la exportación a PDF (exportArmyListPdf), que es quien la
// usó primero. Vive ahora en el dominio porque la necesitan DOS sitios: la hoja
// de ejército y la ficha del personaje en la vista avanzada de Personajes de
// Renombre. Importarla desde el módulo del PDF arrastraba jsPDF entero a una
// pantalla que no imprime nada.
// ============================================================================
import { CICATRIZ_POR_CLAVE, type CicatrizDeRenombre } from '@/domain/cicatricesDeRenombre'
import type { HabilidadDeRenombre, TipoDeHabilidad } from '@/domain/habilidadesDeRenombre'
import { spellIdDePergamino, type HabilidadMagica } from '@/domain/magiaDeRenombre'

/**
 * TODO LO QUE UN PERSONAJE DE RENOMBRE HA GANADO Y PERDIDO, resuelto desde las
 * claves que guarda la base (ver specialCharacterRepository) contra los
 * catálogos, que viven en el código.
 *
 * Separado de la función que dibuja —y exportado— para poder comprobarlo sin
 * montar un PDF: es la parte donde se puede colar un dato, no la del tipo de
 * letra.
 *
 * Una clave que no está en el catálogo se IGNORA en silencio: pasa si el
 * personaje se apuntó con una versión más nueva del programa, y vale más
 * imprimir su hoja sin esa línea que no imprimirla.
 */
export interface FichaDeRenombre {
  rangos: HabilidadDeRenombre[]
  atributos: HabilidadDeRenombre[]
  habilidades: HabilidadDeRenombre[]
  sociales: HabilidadDeRenombre[]
  cicatrices: CicatrizDeRenombre[]
  /** Habilidades mágicas y sus avanzadas, para los personajes hechiceros. */
  magicas: HabilidadMagica[]
  avanzadas: HabilidadMagica[]
  saberes: HabilidadMagica[]
  /** Pergaminos: ids de hechizos del catálogo, que resuelve quien dibuja. */
  pergaminos: number[]
}

export function fichaDeRenombre(
  clavesDeHabilidad: string[],
  clavesDeCicatriz: string[],
  catalogos: { habilidades: Map<string, HabilidadDeRenombre>; magia: Map<string, HabilidadMagica> },
): FichaDeRenombre {
  const suyas = clavesDeHabilidad
    .map((clave) => catalogos.habilidades.get(clave))
    .filter((h): h is HabilidadDeRenombre => h != null)
  // Las de magia viven en la misma tabla que las de personaje y se distinguen
  // por el prefijo de su clave (ver domain/magiaDeRenombre).
  const magia = clavesDeHabilidad
    .map((clave) => catalogos.magia.get(clave))
    .filter((h): h is HabilidadMagica => h != null)
  const deMagia = (tipo: HabilidadMagica['tipo']) =>
    magia.filter((h) => h.tipo === tipo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  // Rangos y atributos se quedan en el ORDEN DEL CATÁLOGO, que es el del
  // reglamento (de más barato a más caro): son tres y ocho, se leen de un
  // vistazo y así "Héroe" va siempre antes que "Comandante". Las otras tres
  // listas son largas y se buscan por nombre, así que van alfabéticas.
  const porTipo = (tipo: TipoDeHabilidad) => suyas.filter((h) => h.tipo === tipo)
  const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es')
  return {
    rangos: porTipo('rango'),
    atributos: porTipo('atributo'),
    habilidades: porTipo('habilidad').sort(porNombre),
    sociales: porTipo('social').sort(porNombre),
    cicatrices: clavesDeCicatriz
      .map((clave) => CICATRIZ_POR_CLAVE.get(clave))
      .filter((c): c is CicatrizDeRenombre => c != null)
      .sort(porNombre),
    magicas: deMagia('habilidad'),
    avanzadas: deMagia('avanzada'),
    // Los saberes, por nivel: así se leen como la tabla del reglamento.
    saberes: magia.filter((h) => h.tipo === 'saber').sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0) || porNombre(a, b)),
    pergaminos: clavesDeHabilidad.map(spellIdDePergamino).filter((id): id is number => id != null),
  }
}

/**
 * LO QUE DICE UNA MEJORA DE ATRIBUTO, escrita entera.
 *
 * El catálogo no les pone descripción porque en pantalla "+1 HA" se entiende
 * solo (ver habilidadesDeRenombre), pero en la tabla del PDF la celda de la
 * derecha quedaría vacía y una fila a medias se lee como un dato que falta.
 *
 * Aquí SOLO se desarrolla la abreviatura: no se añade ninguna regla que el
 * reglamento no diga, y el asterisco de los atributos que lo llevan se queda
 * donde está, en su nombre.
 */
const ATRIBUTO_EN_LETRA: Record<string, string> = {
  'atributo:iniciativa': 'Iniciativa',
  'atributo:hp': 'Habilidad de Proyectiles',
  'atributo:ha': 'Habilidad de Armas',
  'atributo:herida': 'Heridas',
  'atributo:resistencia': 'Resistencia',
  'atributo:liderazgo': 'Liderazgo',
  'atributo:ataque': 'Ataques',
  'atributo:fuerza': 'Fuerza',
}

export function lineaDeAtributo(h: HabilidadDeRenombre): { nombre: string; descripcion: string | null } {
  const atributo = ATRIBUTO_EN_LETRA[h.clave]
  return { nombre: h.nombre, descripcion: atributo ? `Suma +1 a su atributo de ${atributo}.` : h.descripcion }
}

/** Si no tiene absolutamente nada, no se le imprime un apartado vacío. */
export function fichaDeRenombreVacia(ficha: FichaDeRenombre): boolean {
  return (
    ficha.rangos.length === 0 &&
    ficha.atributos.length === 0 &&
    ficha.habilidades.length === 0 &&
    ficha.sociales.length === 0 &&
    ficha.cicatrices.length === 0 &&
    ficha.magicas.length === 0 &&
    ficha.avanzadas.length === 0 &&
    ficha.saberes.length === 0 &&
    ficha.pergaminos.length === 0
  )
}
