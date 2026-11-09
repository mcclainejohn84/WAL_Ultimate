// ============================================================================
// Texto con formato: qué se admite y cómo se limpia lo que llega de fuera.
//
// QUÉ SE ADMITE, Y NADA MÁS: párrafos, salto de línea, negrita, cursiva,
// subrayado y listas (con puntos o numeradas), más la ALINEACIÓN del párrafo. Se guarda HTML porque es lo que sabe
// representar eso, pero la lista de etiquetas es CERRADA y todos los atributos
// se tiran: ni estilos, ni clases, ni colores, ni tipos de letra. Un texto
// pegado de un PDF o de Word trae hojas de estilo enteras y, si se dejan
// pasar, la ficha se llena de letras Calibri azules de 14 puntos que ya no hay
// forma de quitar.
//
// Y SOBRE TODO: nada de <script>, <iframe>, <img> ni atributos `on...`. El
// texto se pinta con dangerouslySetInnerHTML —es la única forma de que la
// negrita salga en negrita—, así que lo que entra en la base tiene que estar
// limpio ANTES de guardarse. Este archivo es esa aduana; no hay otra.
//
// LA ALINEACIÓN Y LA SANGRÍA SÍ SE GUARDAN, desde que el usuario las pidió,
// pero no como `style`: se traducen a clases de una lista cerrada (al-izq,
// al-cen, al-der, al-jus para alinear; sa-1 a sa-4 para los cuatro escalones
// de sangría), que es lo único que sobrevive al saneado. Así se puede centrar
// un título, alinear una firma a la derecha o meter un párrafo hacia dentro
// sin abrir la puerta a que entre cualquier CSS pegado de Word. Sin clase, el
// texto va justificado y sin sangrar (ver index.css y RichText).
//
// La sangría llega de dos formas distintas según el navegador: metiendo el
// párrafo en <blockquote> (Chrome) o poniéndole un `margin-left` en píxeles.
// Las dos se traducen al mismo escalón.
// ============================================================================

/** Las únicas etiquetas que sobreviven al saneado. */
const PERMITIDAS = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI'])

/** Las cuatro clases de alineación, y nada más: ni estilos ni clases de otro sitio. */
const ALINEACIONES: Record<string, string> = {
  left: 'al-izq',
  start: 'al-izq',
  center: 'al-cen',
  right: 'al-der',
  end: 'al-der',
  justify: 'al-jus',
}
const CLASES_DE_ALINEACION = new Set(Object.values(ALINEACIONES))

/** Dónde tiene sentido alinear o sangrar: en los bloques, no en una negrita. */
const ALINEABLES = new Set(['P', 'LI', 'UL', 'OL'])

/** Escalones de sangría. Cuatro bastan: más allá el texto ya no se lee como texto. */
const MAX_SANGRIA = 4
const CLASES_DE_SANGRIA = new Set(['sa-1', 'sa-2', 'sa-3', 'sa-4'])
/** Lo que mete `execCommand('indent')` por escalón cuando usa `margin-left`. */
const PX_POR_ESCALON = 40

/** La sangría que ya trae un elemento, venga en clase o en `margin-left`. */
function sangriaDe(el: Element): number {
  const porClase = Array.from(el.classList).find((c) => CLASES_DE_SANGRIA.has(c))
  if (porClase) return Number(porClase.slice(3))
  const margen = (el as HTMLElement).style?.marginLeft ?? ''
  const px = /^(\d+(?:\.\d+)?)px$/.exec(margen.trim())
  if (px) return Math.min(MAX_SANGRIA, Math.round(Number(px[1]) / PX_POR_ESCALON))
  return 0
}

/**
 * La alineación de un elemento, venga como venga: `style="text-align:…"` (lo
 * que escribe execCommand), el viejo atributo `align` o ya la clase nuestra de
 * un texto saneado antes.
 */
function alineacionDe(el: Element): string | null {
  const porClase = Array.from(el.classList).find((c) => CLASES_DE_ALINEACION.has(c))
  if (porClase) return porClase
  const enLinea = (el as HTMLElement).style?.textAlign?.toLowerCase()
  if (enLinea && ALINEACIONES[enLinea]) return ALINEACIONES[enLinea]
  const atributo = el.getAttribute('align')?.toLowerCase()
  if (atributo && ALINEACIONES[atributo]) return ALINEACIONES[atributo]
  return null
}

/**
 * Equivalencias: el navegador y los programas de ofimática escriben lo mismo
 * de varias formas. Se traducen a la forma canónica en vez de tirarlas, que es
 * lo que conserva la negrita de un texto pegado de Word.
 */
const EQUIVALENTES: Record<string, string> = {
  B: 'STRONG',
  I: 'EM',
  H1: 'P',
  H2: 'P',
  H3: 'P',
  H4: 'P',
  H5: 'P',
  H6: 'P',
  DIV: 'P',
  SECTION: 'P',
  ARTICLE: 'P',
  BLOCKQUOTE: 'P',
  PRE: 'P',
}

/** Etiquetas cuyo CONTENIDO también se tira, no solo la etiqueta. */
const VENENOSAS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'HEAD', 'META', 'LINK'])

function limpiarNodo(nodo: Node, doc: Document, sangria = 0): Node[] {
  if (nodo.nodeType === Node.TEXT_NODE) {
    return [doc.createTextNode(nodo.textContent ?? '')]
  }
  if (nodo.nodeType !== Node.ELEMENT_NODE) return []

  const el = nodo as Element
  const etiqueta = el.tagName.toUpperCase()
  if (VENENOSAS.has(etiqueta)) return []

  // UN <blockquote> NO ES UNA CITA AQUÍ: es lo que escribe el navegador al
  // sangrar un párrafo, y puede venir anidado (sangrar dos veces). No se
  // conserva la etiqueta; lo que se conserva es cuánto hacia dentro queda el
  // texto que lleva dentro.
  const propia = Math.min(MAX_SANGRIA, sangria + sangriaDe(el))
  if (etiqueta === 'BLOCKQUOTE') {
    return Array.from(el.childNodes).flatMap((h) => limpiarNodo(h, doc, Math.min(MAX_SANGRIA, sangria + 1)))
  }

  const hijos = Array.from(el.childNodes).flatMap((h) => limpiarNodo(h, doc, propia))
  const destino = PERMITIDAS.has(etiqueta) ? etiqueta : EQUIVALENTES[etiqueta]

  // Una etiqueta desconocida (<span>, <font>, <table>…) desaparece pero su
  // contenido se queda: tirar el texto de una tabla pegada sería perderlo sin
  // avisar.
  if (!destino) return hijos

  const nuevo = doc.createElement(destino)
  // Lo ÚNICO que sobrevive de los atributos: la alineación y la sangría,
  // convertidas a nuestras clases.
  if (ALINEABLES.has(destino)) {
    const clases: string[] = []
    const alineacion = alineacionDe(el)
    if (alineacion && alineacion !== 'al-jus') clases.push(alineacion)
    if (propia > 0) clases.push(`sa-${propia}`)
    if (clases.length > 0) nuevo.className = clases.join(' ')
  }
  for (const hijo of hijos) nuevo.appendChild(hijo)
  return [nuevo]
}

/** ¿Este elemento se puede quitar por no aportar nada? Un <p></p> vacío, sí; un <br>, no. */
function vacio(el: Element): boolean {
  if (el.tagName === 'BR') return false
  return (el.textContent ?? '').trim() === '' && el.querySelector('br') == null
}

/**
 * Deja el HTML en lo permitido: etiquetas de la lista, sin un solo atributo.
 *
 * Se usa en los DOS extremos: al pegar (para no meter basura en el editor) y
 * al guardar (porque nadie garantiza que lo que hay en el editor haya pasado
 * por lo primero). Es idempotente: sanear lo ya saneado no cambia nada.
 */
export function sanearHtml(html: string): string {
  if (!html.trim()) return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const salida = doc.createElement('div')
  for (const hijo of Array.from(doc.body.childNodes)) {
    for (const limpio of limpiarNodo(hijo, doc, 0)) salida.appendChild(limpio)
  }
  // Fuera los párrafos y listas que se han quedado sin nada dentro (los deja
  // el propio saneado al vaciar un <div> de maquetación).
  for (const el of Array.from(salida.querySelectorAll('p, li, ul, ol'))) {
    if (vacio(el)) el.remove()
  }
  return salida.innerHTML.trim()
}

/**
 * Texto plano → HTML. Cada línea en blanco separa un párrafo, que es lo que
 * espera cualquiera que pegue texto sin formato de un correo o de un .txt.
 */
export function textoPlanoAHtml(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean)
    .map((parrafo) => `<p>${escapar(parrafo).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** ¿Este HTML tiene algo escrito? Sirve para no guardar apéndices en blanco. */
export function tieneTexto(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim().length > 0
  )
}

/**
 * El texto sin etiquetas, para resúmenes y listados.
 *
 * El cierre de cada bloque se cambia por un espacio antes de leer el texto: sin
 * eso, "<p>uno</p><li>dos</li>" se leería como "unodos", que en un resumen de
 * una línea es justo lo que no se entiende.
 */
export function aTextoPlano(html: string): string {
  const separado = html.replace(/<\/(p|li|ul|ol)>|<br\s*\/?>/gi, ' ')
  const doc = new DOMParser().parseFromString(`<body>${separado}</body>`, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

// ============================================================================
// EL MISMO TEXTO, PARA DIBUJARLO A MANO
//
// Las exportaciones de las fichas no usan el navegador para pintar: dibujan
// sobre un <canvas> midiendo cada línea (ver features/fichas/exportSheet.ts, y
// el porqué en su cabecera). Un apéndice pegado dentro de la ficha tiene que
// salir también ahí, así que su HTML hay que traducirlo a algo que se pueda
// medir: una lista de bloques, cada uno con sus trozos de texto y las marcas
// de negrita/cursiva/subrayado, su alineación y su sangría.
//
// No es un segundo saneado ni un segundo editor: es LEER lo ya saneado. Si
// aquí apareciera una etiqueta que no está en PERMITIDAS, el problema estaría
// en sanearHtml, no en esta función.
// ============================================================================

/** Un tramo de texto con el mismo formato de principio a fin. */
export interface TrozoDeTexto {
  texto: string
  negrita: boolean
  cursiva: boolean
  subrayado: boolean
}

/** Un párrafo (o un punto de una lista) listo para medir y dibujar. */
export interface BloqueDeTexto {
  trozos: TrozoDeTexto[]
  alineacion: 'izq' | 'cen' | 'der' | 'jus'
  /** Escalones de sangría, 0..4 (ver MAX_SANGRIA). */
  sangria: number
  /** La viñeta o el número que lleva delante, si viene de una lista. */
  vineta: string | null
}

const ALINEACION_POR_CLASE: Record<string, BloqueDeTexto['alineacion']> = {
  'al-izq': 'izq',
  'al-cen': 'cen',
  'al-der': 'der',
  'al-jus': 'jus',
}

/** La alineación que toca, mirando primero el elemento y luego lo que herede. */
function alineacionDelBloque(el: Element, heredada: BloqueDeTexto['alineacion']): BloqueDeTexto['alineacion'] {
  const clase = alineacionDe(el)
  return clase ? (ALINEACION_POR_CLASE[clase] ?? heredada) : heredada
}

/**
 * Los trozos de texto de dentro de un bloque. `<br>` no parte el bloque aquí:
 * devuelve un trozo con un salto de línea dentro, y es quien dibuja el que
 * decide (ver `partirEnLineas` en exportSheet).
 */
function trozosDe(nodo: Node, formato: Omit<TrozoDeTexto, 'texto'>): TrozoDeTexto[] {
  if (nodo.nodeType === 3) {
    const texto = (nodo.textContent ?? '').replace(/\s+/g, ' ')
    return texto ? [{ ...formato, texto }] : []
  }
  if (nodo.nodeType !== 1) return []
  const el = nodo as Element
  if (el.tagName === 'BR') return [{ ...formato, texto: '\n' }]
  const dentro: Omit<TrozoDeTexto, 'texto'> = {
    negrita: formato.negrita || el.tagName === 'STRONG',
    cursiva: formato.cursiva || el.tagName === 'EM',
    subrayado: formato.subrayado || el.tagName === 'U',
  }
  return Array.from(el.childNodes).flatMap((hijo) => trozosDe(hijo, dentro))
}

function bloqueDe(el: Element, heredada: BloqueDeTexto['alineacion'], sangriaBase: number, vineta: string | null) {
  const trozos = trozosDe(el, { negrita: false, cursiva: false, subrayado: false })
  const bloque: BloqueDeTexto = {
    trozos,
    alineacion: alineacionDelBloque(el, heredada),
    sangria: Math.max(sangriaBase, sangriaDe(el)),
    vineta,
  }
  return bloque
}

/**
 * El HTML saneado de un apéndice, convertido en bloques medibles. Los bloques
 * sin nada escrito se tiran: un párrafo vacío en pantalla es un hueco, pero en
 * un canvas sería una línea en blanco a mitad del texto.
 */
export function bloquesDeHtml(html: string): BloqueDeTexto[] {
  if (!html.trim()) return []
  const doc = new DOMParser().parseFromString(`<body>${sanearHtml(html)}</body>`, 'text/html')
  const bloques: BloqueDeTexto[] = []

  function recorrer(nodos: Node[], heredada: BloqueDeTexto['alineacion'], sangriaBase: number) {
    for (const nodo of nodos) {
      if (nodo.nodeType === 3) {
        // Texto suelto, sin párrafo que lo envuelva (lo deja un pegado raro).
        const trozos = trozosDe(nodo, { negrita: false, cursiva: false, subrayado: false })
        if (trozos.length > 0) bloques.push({ trozos, alineacion: heredada, sangria: sangriaBase, vineta: null })
        continue
      }
      if (nodo.nodeType !== 1) continue
      const el = nodo as Element
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        const alineacion = alineacionDelBloque(el, heredada)
        const sangria = Math.max(sangriaBase, sangriaDe(el))
        const puntos = Array.from(el.children).filter((h) => h.tagName === 'LI')
        puntos.forEach((li, indice) => {
          bloques.push(bloqueDe(li, alineacion, sangria, el.tagName === 'OL' ? `${indice + 1}.` : '•'))
        })
        continue
      }
      bloques.push(bloqueDe(el, heredada, sangriaBase, null))
    }
  }

  // Se arranca en JUSTIFICADO porque es lo que hace el programa cuando el
  // párrafo no dice nada (ver RichText: `text-justify`), y por eso `sanearHtml`
  // ni guarda la clase `al-jus`. Si aquí se empezara en 'izq', el mismo texto
  // saldría justificado en pantalla y con el margen derecho irregular en el
  // PNG — justo lo que esta sección promete que no pasa.
  recorrer(Array.from(doc.body.childNodes), 'jus', 0)
  return bloques.filter((b) => b.trozos.some((t) => t.texto.trim()))
}
