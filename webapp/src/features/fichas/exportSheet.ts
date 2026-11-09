// ============================================================================
// Renderizado de la ficha para exportar (PNG / Word con imágenes).
//
// SIN html2canvas. Se dibuja la tarjeta directamente sobre un <canvas> con la
// API Canvas 2D, controlando cada píxel: posición del logo, centrado vertical
// del texto, y SOLO las líneas de tabla que deben existir.
//
// ¿Por qué? html2canvas no dibuja: reinterpreta el CSS. Y esa reinterpretación
// era la que rompía la exportación una y otra vez (logo desplazado hacia
// arriba tapando el texto, líneas fantasma bajo la tabla, textos sin centrar en
// altura). Dibujando a mano no hay intérprete de por medio: lo que se calcula
// aquí es exactamente lo que sale.
//
// Las medidas están copiadas del CSS del card de CodexMaker (index.html):
// #card 760px, padding 22/26/34, barra gris con logo de 50px que sobresale
// 14px por arriba y por abajo, tabla de características con línea de 1.5px bajo
// la cabecera y 1px bajo cada fila, cuerpo a 12.5px con interlineado 1.5.
// ============================================================================
import { sectionWidth, type SheetSection } from '@/domain/sheetSections'
import type { AttributeProfile, UnitAppendix, UnitDetail, UnitSheet } from '@/domain/types'
import { bloquesDeHtml, tieneTexto, type BloqueDeTexto } from '@/shared/richText'
import { ATTRIBUTE_LABELS } from '@/shared/ui/AttributeTable'
import {
  APENDICE_MIN_W,
  commandGroupText,
  monturaItems,
  optionsList,
  pointsLabel,
  sizeLabel,
  specialRulesText,
  unifiedProfileRows,
} from '@/features/fichas/sheetContent'
import { bakeIllustration, grayscaleCanvasInPlace } from '@/features/fichas/imageProcessing'

// ---------------------------------------------------------------------------
// Medidas y tipografías (copiadas del CSS de CodexMaker)
// ---------------------------------------------------------------------------
const CARD_W = 760
const PAD_X = 26
const PAD_TOP = 22
const PAD_BOTTOM = 34
const CONTENT_W = CARD_W - PAD_X * 2 // 708
const CONTENT_MIN_H = 380 // .content-wrap { min-height:380px }

const INK = '#1c1a16'
const BAR_GRAY = '#d9d5c6'
const BAR_BORDER = '#7d795f'
const ROW_LINE = '#d6cfba'
const LOGO_BG = '#efeadd'

const TITLE_FONT = '700 26px Cinzel, Georgia, serif'
const TITLE_SIZE = 26
// Separación entre el título y la barra gris. Ojo: el logo sobresale 14px por
// encima de la barra (su borde superior queda en barTop-11), así que este
// margen es lo que evita que el icono se pegue a las letras del título.
const TITLE_MB = 24

const SUBBAR_PAD_X = 12
const SUBBAR_PAD_Y = 2
const SUBBAR_CONTENT_H = 22 // logo 50px con margin -14px arriba/abajo => 22px de caja
const SUBBAR_MB = 16
const LOGO_SIZE = 50
const LOGO_GAP = 9
const UNAME_FONT = 'bold 11.5px "PT Serif", Georgia, serif'
const PTS_FONT = '10px "PT Serif", Georgia, serif'

const TH_FONT = 'bold 11px "Trebuchet MS", Helvetica, sans-serif'
const TD_FONT = '12.5px "PT Serif", Georgia, serif'
const TD_FIRST_FONT = 'bold 12.5px "PT Serif", Georgia, serif'
const CELL_PAD_X = 7
const CELL_PAD_Y = 3
const FIRST_CELL_PAD_L = 2
const FIRST_CELL_PAD_R = 14
const TABLE_MB = 14

const BODY_SIZE = 12.5
const BODY_FONT = '12.5px "PT Serif", Georgia, serif'
const BODY_BOLD_FONT = 'bold 12.5px "PT Serif", Georgia, serif'
const RULES_FONT = 'italic 12.5px "PT Serif", Georgia, serif'
const LINE_H = Math.round(BODY_SIZE * 1.5) // line-height:1.5 => 19
const FIELD_MB = 10
const TITLE_SMALL_MB = 4
const UL_PAD_L = 18
const LI_MB = 2

const SCALE = 2 // igual que CodexMaker (html2canvas scale:2)

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    // IMPRESCINDIBLE desde que las imágenes viven en R2 y las sirve el Worker,
    // que está en OTRO dominio que la app. Una imagen de otro origen dibujada
    // en un canvas lo deja "contaminado", y a partir de ahí toDataURL/toBlob
    // lanzan una excepción de seguridad: la exportación a PNG y a Word
    // fallaría entera. Pedirla con CORS (el Worker responde
    // Access-Control-Allow-Origin: *) evita esa contaminación.
    //
    // Va ANTES de asignar `src`, que es cuando el navegador decide cómo pedir
    // la imagen; después ya no tendría efecto. Es inocuo para las data: y
    // blob: URL que se siguen usando en otros sitios.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Dibuja una línea JUSTIFICADA: reparte el espacio sobrante entre sus huecos
 * para que acabe justo en `maxWidth`.
 *
 * Hace falta porque el canvas no sabe justificar (no hay `text-align` que
 * valga: aquí se dibuja letra a letra). Sin esto, "Reglas especiales" saldría
 * justificado en pantalla y con el margen derecho irregular en el PNG y en el
 * Word — y esta sección promete que exportas lo que ves.
 *
 * La ÚLTIMA línea de un párrafo no se justifica, igual que hace el navegador:
 * estirar cuatro palabras hasta el borde es justo lo que afea un texto.
 */
function drawJustifiedLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  maxWidth: number,
  isLast: boolean,
): void {
  const words = line.split(' ').filter(Boolean)
  if (isLast || words.length < 2) {
    ctx.fillText(line, x, y)
    return
  }
  const wordsW = words.reduce((sum, w) => sum + ctx.measureText(w).width, 0)
  const gap = (maxWidth - wordsW) / (words.length - 1)
  // Un hueco desmesurado (línea con muy pocas palabras largas) se ve peor que
  // no justificar: en ese caso se deja al natural.
  if (gap > ctx.measureText(' ').width * 6) {
    ctx.fillText(line, x, y)
    return
  }
  let cx = x
  for (const word of words) {
    ctx.fillText(word, cx, y)
    cx += ctx.measureText(word).width + gap
  }
}

/** Parte `text` en líneas que quepan en `maxWidth` con la fuente ya fijada en `ctx`. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let line = words[0]
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`
    if (ctx.measureText(test).width <= maxWidth) line = test
    else {
      lines.push(line)
      line = words[i]
    }
  }
  lines.push(line)
  return lines
}

/**
 * Dibuja "Etiqueta: valor" con la etiqueta en negrita, ajustando a `maxWidth`
 * y devolviendo el alto consumido. La primera línea lleva la etiqueta; las
 * siguientes son continuación del valor.
 */
function drawLabelledField(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  maxWidth: number,
  label: string,
  value: string,
): number {
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.font = BODY_BOLD_FONT
  const labelW = ctx.measureText(label).width
  ctx.fillText(label, x, y)

  ctx.font = BODY_FONT
  // Primera línea: lo que quepa a la derecha de la etiqueta.
  const firstMax = maxWidth - labelW
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  let isFirst = true
  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    const limit = isFirst ? firstMax : maxWidth
    if (ctx.measureText(test).width <= limit) {
      current = test
    } else {
      lines.push(current)
      current = w
      isFirst = false
    }
  }
  lines.push(current)

  lines.forEach((ln, i) => {
    if (i === 0) ctx.fillText(ln, x + labelW, y)
    else ctx.fillText(ln, x, y + i * LINE_H)
  })
  return lines.length * LINE_H
}

// ---------------------------------------------------------------------------
// Apéndices pegados DENTRO de la ficha
// ---------------------------------------------------------------------------
// En pantalla los pinta el navegador (ver ApendiceEnFicha.tsx); aquí hay que
// dibujarlos a mano, como el resto de la hoja, y respetando lo que trae el
// texto: negrita, cursiva, subrayado, alineación, viñetas y sangría. Es la
// única parte de la ficha con formato DENTRO del párrafo, así que necesita su
// propio medidor de líneas: `wrapText` mide con una sola fuente fija y aquí
// cada palabra puede llevar la suya.
//
// Las coordenadas y el ancho son los mismos que se guardaron arrastrando la
// caja en pantalla (sheet_x / sheet_y / sheet_w), así que lo exportado sale
// donde se dejó.

/** Lo que mete cada escalón de sangría: 1,6em a 12,5px (ver .sa-* en index.css). */
const SANGRIA_PX = 20
/** Separación bajo el título del apéndice, y de su línea (ver .ficha-apendice-titulo). */
const APENDICE_TITULO_MB = 3
const APENDICE_TITULO_PB = 2
/** Hueco entre dos párrafos del apéndice (el `my-1` de RichText, 4px). */
const APENDICE_PARRAFO_MB = 4

interface PalabraMedida {
  texto: string
  negrita: boolean
  cursiva: boolean
  subrayado: boolean
  ancho: number
}

interface LineaDeApendice {
  palabras: PalabraMedida[]
  /** Ancho del texto tal cual, sin justificar. */
  ancho: number
  /** Última línea del párrafo: no se justifica (igual que hace el navegador). */
  ultima: boolean
  alineacion: BloqueDeTexto['alineacion']
  sangria: number
  /** Viene de un punto de lista: el texto entero va desplazado a la derecha. */
  esDeLista: boolean
  /** La viñeta, solo en la primera línea del punto. */
  vineta: string | null
  /** Dónde empieza, contando desde el principio del apéndice. */
  arriba: number
}

interface TrazadoDeApendice {
  lineas: LineaDeApendice[]
  alto: number
}

function fuenteDe(negrita: boolean, cursiva: boolean): string {
  return `${cursiva ? 'italic ' : ''}${negrita ? 'bold ' : ''}${BODY_SIZE}px "PT Serif", Georgia, serif`
}

/**
 * Las palabras de un bloque, ya medidas con la fuente que le toca a cada una y
 * agrupadas por tiradas: un `<br>` corta el párrafo y cada tirada se maqueta
 * por separado.
 */
function tiradasDe(ctx: CanvasRenderingContext2D, bloque: BloqueDeTexto): PalabraMedida[][] {
  const tiradas: PalabraMedida[][] = [[]]
  for (const trozo of bloque.trozos) {
    ctx.font = fuenteDe(trozo.negrita, trozo.cursiva)
    const partes = trozo.texto.split('\n')
    partes.forEach((parte, indice) => {
      if (indice > 0) tiradas.push([])
      for (const palabra of parte.split(' ')) {
        if (!palabra) continue
        tiradas[tiradas.length - 1].push({
          texto: palabra,
          negrita: trozo.negrita,
          cursiva: trozo.cursiva,
          subrayado: trozo.subrayado,
          ancho: ctx.measureText(palabra).width,
        })
      }
    })
  }
  return tiradas.filter((t) => t.length > 0)
}

/**
 * Reparte el texto del apéndice en líneas que quepan en `ancho` y dice cuánto
 * alto ocupa todo. Se traza UNA vez y se reutiliza para dibujar: así el alto
 * que reserva la tarjeta y el que de verdad se pinta son el mismo número.
 */
function trazarApendice(ctx: CanvasRenderingContext2D, titulo: string, html: string, ancho: number): TrazadoDeApendice {
  const lineas: LineaDeApendice[] = []
  let alto = titulo.trim() ? LINE_H + APENDICE_TITULO_PB + APENDICE_TITULO_MB : 0

  ctx.font = BODY_FONT
  const anchoDelEspacio = ctx.measureText(' ').width

  for (const bloque of bloquesDeHtml(html)) {
    const esDeLista = bloque.vineta !== null
    const disponible = Math.max(40, ancho - bloque.sangria * SANGRIA_PX - (esDeLista ? UL_PAD_L : 0))
    tiradasDe(ctx, bloque).forEach((tirada, indiceDeTirada) => {
      // Reparto codicioso, el mismo criterio que `wrapText`, pero sumando el
      // ancho ya medido de cada palabra con su propia fuente.
      const envueltas: PalabraMedida[][] = [[]]
      let anchoActual = 0
      for (const palabra of tirada) {
        const actual = envueltas[envueltas.length - 1]
        const suma = actual.length === 0 ? palabra.ancho : anchoActual + anchoDelEspacio + palabra.ancho
        if (actual.length > 0 && suma > disponible) {
          envueltas.push([palabra])
          anchoActual = palabra.ancho
        } else {
          actual.push(palabra)
          anchoActual = suma
        }
      }
      envueltas.forEach((palabras, indice) => {
        if (palabras.length === 0) return
        const anchoDeLinea = palabras.reduce((suma, p, i) => suma + p.ancho + (i > 0 ? anchoDelEspacio : 0), 0)
        lineas.push({
          palabras,
          ancho: anchoDeLinea,
          ultima: indice === envueltas.length - 1,
          alineacion: bloque.alineacion,
          sangria: bloque.sangria,
          esDeLista,
          vineta: indiceDeTirada === 0 && indice === 0 ? bloque.vineta : null,
          arriba: alto,
        })
        alto += LINE_H
      })
    })
    alto += APENDICE_PARRAFO_MB
  }
  if (lineas.length > 0) alto -= APENDICE_PARRAFO_MB
  return { lineas, alto }
}

/** Dibuja en (x, y) un apéndice ya trazado, con el ancho con el que se trazó. */
function dibujarApendice(
  ctx: CanvasRenderingContext2D,
  trazado: TrazadoDeApendice,
  titulo: string,
  x: number,
  y: number,
  ancho: number,
): void {
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = INK

  if (titulo.trim()) {
    ctx.font = BODY_BOLD_FONT
    ctx.fillText(titulo, x, y)
    ctx.fillStyle = ROW_LINE
    ctx.fillRect(x, y + LINE_H + APENDICE_TITULO_PB, ancho, 1)
    ctx.fillStyle = INK
  }

  ctx.font = BODY_FONT
  const anchoDelEspacio = ctx.measureText(' ').width

  for (const linea of trazado.lineas) {
    const ly = y + linea.arriba
    const sangrado = x + linea.sangria * SANGRIA_PX
    const izquierda = sangrado + (linea.esDeLista ? UL_PAD_L : 0)
    const anchoUtil = ancho - (izquierda - x)

    if (linea.vineta) {
      ctx.font = BODY_FONT
      ctx.fillText(linea.vineta, sangrado, ly)
    }

    const justificar = linea.alineacion === 'jus' && !linea.ultima && linea.palabras.length > 1
    const reparto = justificar
      ? (anchoUtil - linea.palabras.reduce((suma, p) => suma + p.ancho, 0)) / (linea.palabras.length - 1)
      : anchoDelEspacio
    // Un hueco desmesurado se ve peor que no justificar (mismo criterio que
    // drawJustifiedLine).
    const separacion = reparto > anchoDelEspacio * 6 ? anchoDelEspacio : reparto

    let cx = izquierda
    if (!justificar) {
      if (linea.alineacion === 'cen') cx = izquierda + Math.max(0, anchoUtil - linea.ancho) / 2
      else if (linea.alineacion === 'der') cx = izquierda + Math.max(0, anchoUtil - linea.ancho)
    }
    for (const palabra of linea.palabras) {
      ctx.font = fuenteDe(palabra.negrita, palabra.cursiva)
      ctx.fillText(palabra.texto, cx, ly)
      // El subrayado se dibuja a mano: el canvas no tiene text-decoration.
      if (palabra.subrayado) ctx.fillRect(cx, ly + LINE_H - 4, palabra.ancho, 1)
      cx += palabra.ancho + separacion
    }
  }
}

/** Un apéndice colocado en la ficha, ya medido y listo para dibujar. */
interface ApendiceColocado {
  trazado: TrazadoDeApendice
  titulo: string
  x: number
  y: number
  ancho: number
}

/**
 * Mide los apéndices pegados en la ficha con las coordenadas que traen. Los
 * que no tienen nada escrito se quedan fuera: un título huérfano en medio de
 * la hoja es peor que no poner nada.
 */
function colocarApendices(
  ctx: CanvasRenderingContext2D,
  apendices: UnitAppendix[],
  anchoUtil: number,
): ApendiceColocado[] {
  return apendices
    .filter((a) => a.inSheet && tieneTexto(a.bodyHtml))
    .map((a) => {
      const ancho = Math.max(APENDICE_MIN_W, Math.min(anchoUtil, a.sheetW ?? anchoUtil))
      return {
        trazado: trazarApendice(ctx, a.title, a.bodyHtml, ancho),
        titulo: a.title,
        x: a.sheetX ?? 0,
        y: a.sheetY ?? 0,
        ancho,
      }
    })
}

// ---------------------------------------------------------------------------
// Geometría de la tabla de características
// ---------------------------------------------------------------------------
interface TableGeom {
  colWidths: number[] // [etiqueta, ...9 atributos]
  headerH: number
  rowH: number
  totalH: number
  rows: Array<{ label: string; profile: AttributeProfile }>
}

function measureTable(ctx: CanvasRenderingContext2D, unit: UnitDetail, sheet: UnitSheet): TableGeom | null {
  const rows = unifiedProfileRows(unit, sheet.hiddenProfiles)
  if (rows.length === 0) return null

  // Ancho de la primera columna: la etiqueta más ancha.
  ctx.font = TD_FIRST_FONT
  let firstW = 0
  for (const r of rows) firstW = Math.max(firstW, ctx.measureText(r.label).width)
  firstW += FIRST_CELL_PAD_L + FIRST_CELL_PAD_R

  // Ancho de cada columna de atributo: máximo entre cabecera y valores.
  const colWidths: number[] = [firstW]
  for (const { key, label } of ATTRIBUTE_LABELS) {
    ctx.font = TH_FONT
    let w = ctx.measureText(label).width
    ctx.font = TD_FONT
    for (const r of rows) w = Math.max(w, ctx.measureText(r.profile[key] || '–').width)
    colWidths.push(w + CELL_PAD_X * 2)
  }

  const headerH = 11 + CELL_PAD_Y * 2 + 4
  const rowH = Math.round(BODY_SIZE * 1.2) + CELL_PAD_Y * 2
  return { colWidths, headerH, rowH, totalH: headerH + rowH * rows.length, rows }
}

function drawTable(ctx: CanvasRenderingContext2D, geom: TableGeom, x: number, y: number): number {
  const { colWidths, headerH, rowH, rows } = geom
  const tableW = colWidths.reduce((a, b) => a + b, 0)

  // Cabecera: la 1ª columna (etiqueta) va vacía; las 9 de atributos, centradas.
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = TH_FONT
  let hx = x + colWidths[0]
  ATTRIBUTE_LABELS.forEach(({ label }, i) => {
    const w = colWidths[i + 1]
    ctx.fillText(label, hx + w / 2, y + headerH / 2)
    hx += w
  })

  // Línea bajo la cabecera (1.5px) — SOLO el ancho de la tabla
  ctx.fillStyle = INK
  ctx.fillRect(x, y + headerH - 1.5, tableW, 1.5)

  // Filas
  let ry = y + headerH
  for (const r of rows) {
    ctx.fillStyle = INK
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = TD_FIRST_FONT
    ctx.fillText(r.label, x + FIRST_CELL_PAD_L, ry + rowH / 2)

    ctx.font = TD_FONT
    ctx.textAlign = 'center'
    let vx = x + colWidths[0]
    ATTRIBUTE_LABELS.forEach(({ key }, i) => {
      const w = colWidths[i + 1]
      ctx.fillText(r.profile[key] || '–', vx + w / 2, ry + rowH / 2)
      vx += w
    })

    // Línea bajo la fila (1px) — SOLO el ancho de la tabla
    ctx.fillStyle = ROW_LINE
    ctx.fillRect(x, ry + rowH - 1, tableW, 1)
    ry += rowH
  }
  ctx.textAlign = 'left'
  return geom.totalH
}

// ---------------------------------------------------------------------------
// Medición del bloque de texto de la columna izquierda
// ---------------------------------------------------------------------------
interface BodyBlock {
  kind: 'field' | 'title' | 'list' | 'rules'
  label?: string
  value?: string
  items?: string[]
  /**
   * Ancho de ESTE bloque en px, ya resuelto desde el % de su apartado (ver
   * domain/sheetSections.ts). Va por bloque y no como un único ancho de
   * columna porque cada apartado se puede estrechar por separado para
   * esquivar la ilustración — y lo exportado tiene que salir igual que la
   * vista previa, que es la promesa de esta sección ("exportas lo que ves").
   */
  width: number
}

function buildBlocks(unit: UnitDetail, sheet: UnitSheet): BodyBlock[] {
  const blocks: BodyBlock[] = []
  /** % del apartado -> px sobre el ancho útil de la tarjeta. */
  const w = (section: SheetSection) => Math.round((CONTENT_W * sectionWidth(sheet.sectionWidths, section)) / 100)

  if (unit.unitType === 'tropa') {
    blocks.push({ kind: 'field', label: 'Tamaño de la unidad: ', value: sizeLabel(unit), width: w('tamano') })
  }
  blocks.push({ kind: 'field', label: 'Equipo: ', value: unit.equipmentText || '–', width: w('equipo') })

  const monturas = monturaItems(unit)
  if (monturas.length) {
    blocks.push({ kind: 'title', value: 'Montura:', width: w('montura') })
    blocks.push({ kind: 'list', items: monturas, width: w('montura') })
  }
  const options = optionsList(unit)
  if (options.length) {
    blocks.push({ kind: 'title', value: 'Opciones:', width: w('opciones') })
    blocks.push({ kind: 'list', items: options, width: w('opciones') })
  }
  const cmd = commandGroupText(unit)
  if (cmd) blocks.push({ kind: 'field', label: 'Grupo de mando: ', value: cmd, width: w('mando') })

  blocks.push({ kind: 'title', value: 'Reglas especiales:', width: w('reglas') })
  blocks.push({ kind: 'rules', value: specialRulesText(unit) || '–', width: w('reglas') })
  return blocks
}

function measureBlocks(ctx: CanvasRenderingContext2D, blocks: BodyBlock[]): number {
  let h = 0
  for (const b of blocks) {
    const maxW = b.width
    if (b.kind === 'field') {
      ctx.font = BODY_BOLD_FONT
      const labelW = ctx.measureText(b.label ?? '').width
      ctx.font = BODY_FONT
      const first = wrapText(ctx, b.value ?? '', Math.max(20, maxW - labelW))
      // Reajuste aproximado: la 1ª línea va junto a la etiqueta, el resto completo.
      const rest = first.length > 1 ? wrapText(ctx, first.slice(1).join(' '), maxW) : []
      h += (1 + rest.length) * LINE_H + FIELD_MB
    } else if (b.kind === 'title') {
      h += Math.round(BODY_SIZE * 1.2) + TITLE_SMALL_MB
    } else if (b.kind === 'list') {
      ctx.font = BODY_FONT
      for (const item of b.items ?? []) {
        h += wrapText(ctx, item, maxW - UL_PAD_L).length * LINE_H + LI_MB
      }
      h += FIELD_MB
    } else {
      ctx.font = RULES_FONT
      h += wrapText(ctx, b.value ?? '', maxW).length * LINE_H
    }
  }
  return h
}

function drawBlocks(ctx: CanvasRenderingContext2D, blocks: BodyBlock[], x: number, y: number): number {
  let cy = y
  for (const b of blocks) {
    const maxW = b.width
    if (b.kind === 'field') {
      cy += drawLabelledField(ctx, x, cy, maxW, b.label ?? '', b.value ?? '') + FIELD_MB
    } else if (b.kind === 'title') {
      ctx.font = BODY_BOLD_FONT
      ctx.fillStyle = INK
      ctx.textBaseline = 'top'
      ctx.fillText(b.value ?? '', x, cy)
      cy += Math.round(BODY_SIZE * 1.2) + TITLE_SMALL_MB
    } else if (b.kind === 'list') {
      ctx.font = BODY_FONT
      ctx.fillStyle = INK
      ctx.textBaseline = 'top'
      for (const item of b.items ?? []) {
        const lines = wrapText(ctx, item, maxW - UL_PAD_L)
        ctx.fillText('•', x + 4, cy)
        lines.forEach((ln, i) => ctx.fillText(ln, x + UL_PAD_L, cy + i * LINE_H))
        cy += lines.length * LINE_H + LI_MB
      }
      cy += FIELD_MB
    } else {
      ctx.font = RULES_FONT
      ctx.fillStyle = INK
      ctx.textBaseline = 'top'
      const lines = wrapText(ctx, b.value ?? '', maxW)
      // Solo este bloque va justificado, igual que en pantalla (ver
      // .ficha-section--justify en index.css).
      lines.forEach((ln, i) => drawJustifiedLine(ctx, ln, x, cy + i * LINE_H, maxW, i === lines.length - 1))
      cy += lines.length * LINE_H
    }
  }
  return cy - y
}

// ---------------------------------------------------------------------------
// Fuentes
// ---------------------------------------------------------------------------
async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('700 26px Cinzel'),
      document.fonts.load('bold 11.5px "PT Serif"'),
      document.fonts.load('12.5px "PT Serif"'),
      document.fonts.load('italic 12.5px "PT Serif"'),
    ])
    await document.fonts.ready
  } catch {
    // Sin Font Loading API: se dibuja con lo que haya cargado.
  }
}

export interface ExportView {
  grayscale: boolean
  showFrame: boolean
}

/**
 * Dibuja la ficha de una unidad en un canvas y lo devuelve (a escala 2x, igual
 * que CodexMaker). El blanco y negro se aplica sobre los píxeles al final.
 */
export async function captureUnitCanvas(
  unit: UnitDetail,
  sheet: UnitSheet,
  view: ExportView,
  /** Los apéndices de la ficha; se dibujan los pegados dentro (ver colocarApendices). */
  apendices: UnitAppendix[] = [],
): Promise<HTMLCanvasElement> {
  await ensureFonts()

  // Ilustración con brillo/volteo ya aplicados en los píxeles.
  const bakedIllu = await bakeIllustration(sheet.illuUrl, sheet.illuFlipped, sheet.illuBrightness)
  const emblemUrl = sheet.emblemUrl ?? unit.faction.emblemUrl
  const [illuImg, logoImg] = await Promise.all([
    bakedIllu ? loadImage(bakedIllu) : Promise.resolve(null),
    emblemUrl ? loadImage(emblemUrl) : Promise.resolve(null),
  ])

  // --- Medición (canvas auxiliar) ---
  const measureCanvas = document.createElement('canvas')
  const mctx = measureCanvas.getContext('2d')!
  const tableGeom = measureTable(mctx, unit, sheet)
  const blocks = buildBlocks(unit, sheet)
  const bodyH = (tableGeom ? tableGeom.totalH + TABLE_MB : 0) + measureBlocks(mctx, blocks)
  // Los apéndices van en posición absoluta, así que no empujan nada: hay que
  // reservarles sitio a mano o el alto de la tarjeta los cortaría.
  const colocados = colocarApendices(mctx, apendices, CONTENT_W)
  const fondoDeApendices = colocados.reduce((max, a) => Math.max(max, a.y + a.trazado.alto + 10), 0)

  const subbarH = 1 + SUBBAR_PAD_Y + SUBBAR_CONTENT_H + SUBBAR_PAD_Y + 1
  const headerH = PAD_TOP + TITLE_SIZE + TITLE_MB + subbarH + SUBBAR_MB
  const contentH = Math.max(CONTENT_MIN_H, bodyH, fondoDeApendices)
  const naturalH = headerH + contentH + PAD_BOTTOM
  const cardH = Math.min(naturalH, sheet.cardMaxHeight)

  // --- Canvas real ---
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W * SCALE
  canvas.height = Math.round(cardH) * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.textAlign = 'left'

  // Fondo
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CARD_W, cardH)

  // Recorte al interior de la tarjeta (como overflow:hidden)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, CARD_W, cardH)
  ctx.clip()

  // 1) Ilustración (va DEBAJO del texto, como en CodexMaker: illu-layer z-index 1)
  const contentTop = headerH
  if (illuImg) {
    const illuW = Math.round(CONTENT_W * (sheet.illuWidthPct / 100))
    const illuH = illuImg.naturalHeight ? (illuW * illuImg.naturalHeight) / illuImg.naturalWidth : illuW
    const defaultX = Math.max(0, CONTENT_W - illuW)
    const ix = PAD_X + (sheet.illuPosX ?? defaultX)
    const iy = contentTop + (sheet.illuPosY ?? -24)
    ctx.drawImage(illuImg, ix, iy, illuW, illuH)
  }

  // 2) Título
  ctx.fillStyle = INK
  ctx.textBaseline = 'top'
  ctx.font = TITLE_FONT
  ctx.fillText(unit.name.toUpperCase(), PAD_X, PAD_TOP)

  // 3) Barra gris
  const barTop = PAD_TOP + TITLE_SIZE + TITLE_MB
  const barInnerTop = barTop + 1 + SUBBAR_PAD_Y
  const barCenterY = barInnerTop + SUBBAR_CONTENT_H / 2
  ctx.fillStyle = BAR_GRAY
  ctx.fillRect(PAD_X, barTop, CONTENT_W, subbarH)
  ctx.fillStyle = BAR_BORDER
  ctx.fillRect(PAD_X, barTop, CONTENT_W, 1)
  ctx.fillRect(PAD_X, barTop + subbarH - 1, CONTENT_W, 1)

  // Logo: 50px centrado en la línea de 22px => sobresale 14px arriba y abajo
  const logoX = PAD_X + SUBBAR_PAD_X
  const logoY = barCenterY - LOGO_SIZE / 2
  ctx.fillStyle = LOGO_BG
  ctx.fillRect(logoX, logoY, LOGO_SIZE, LOGO_SIZE)
  ctx.strokeStyle = BAR_BORDER
  ctx.lineWidth = 1
  ctx.strokeRect(logoX + 0.5, logoY + 0.5, LOGO_SIZE - 1, LOGO_SIZE - 1)
  if (logoImg) {
    // object-fit: contain dentro del cuadro del logo
    const bw = LOGO_SIZE - 2
    const scale = Math.min(bw / logoImg.naturalWidth, bw / logoImg.naturalHeight)
    const dw = logoImg.naturalWidth * scale
    const dh = logoImg.naturalHeight * scale
    ctx.drawImage(logoImg, logoX + 1 + (bw - dw) / 2, logoY + 1 + (bw - dh) / 2, dw, dh)
  }

  // Nombre y puntos: CENTRADOS EN ALTURA respecto a la barra
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  ctx.font = UNAME_FONT
  ctx.textAlign = 'left'
  // "0-1" solo en tropas: un personaje es siempre una sola miniatura.
  const namePrefix = unit.isUnique && unit.unitType !== 'personaje' ? '0-1 ' : ''
  ctx.fillText(namePrefix + unit.name, logoX + LOGO_SIZE + LOGO_GAP, barCenterY)

  ctx.font = PTS_FONT
  ctx.textAlign = 'right'
  ctx.fillText(pointsLabel(unit), PAD_X + CONTENT_W - SUBBAR_PAD_X, barCenterY)
  ctx.textAlign = 'left'

  // 4) Tabla + cuerpo (columna izquierda), encima de la ilustración
  let cy = contentTop
  if (tableGeom) {
    drawTable(ctx, tableGeom, PAD_X, cy)
    cy += tableGeom.totalH + TABLE_MB
  }
  drawBlocks(ctx, blocks, PAD_X, cy)

  // 5) Apéndices pegados en la ficha, lo último: van por encima del texto y de
  // la ilustración, igual que en pantalla (z-4).
  for (const a of colocados) {
    dibujarApendice(ctx, a.trazado, a.titulo, PAD_X + a.x, contentTop + a.y, a.ancho)
  }

  ctx.restore()

  // 6) Marco
  if (view.showFrame) {
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, CARD_W - 2, cardH - 2)
  }

  if (view.grayscale) grayscaleCanvasInPlace(canvas)
  return canvas
}

// ---------------------------------------------------------------------------
// Reglas especiales DESCRITAS (para "Exportar Hojas de unidad" en PDF)
// ---------------------------------------------------------------------------
/**
 * La ficha lista los NOMBRES de las reglas ("Miedo, Odio, Tozudez"), que es
 * todo lo que cabe en la tarjeta. Este bloque las desarrolla: nombre en
 * negrita seguido de su texto, para poder llevar el ejército a la partida sin
 * el reglamento al lado.
 *
 * Se dibuja con las MISMAS fuentes, el mismo ancho de tarjeta y el mismo
 * interlineado que la ficha, y sobre el mismo fondo blanco, para que en el PDF
 * parezca la continuación de la hoja y no un anexo pegado.
 *
 * Devuelve null si la unidad no tiene reglas: media página en blanco con un
 * título huérfano es peor que no poner nada.
 */
export async function captureSpecialRulesCanvas(unit: UnitDetail, view: ExportView): Promise<HTMLCanvasElement | null> {
  if (unit.specialRules.length === 0) return null
  await ensureFonts()

  const maxW = CONTENT_W
  const measure = document.createElement('canvas').getContext('2d')!

  // Se mide antes de dibujar porque la altura del canvas depende de cuánto
  // texto haya, y cambiar el tamaño de un canvas borra su contenido.
  interface Entrada {
    nombre: string
    lineas: string[]
  }
  const entradas: Entrada[] = []
  let alto = PAD_TOP + Math.round(BODY_SIZE * 1.2) + TITLE_SMALL_MB + 4
  for (const regla of unit.specialRules) {
    measure.font = BODY_BOLD_FONT
    const anchoNombre = measure.measureText(`${regla.name}: `).width
    measure.font = BODY_FONT
    // La primera línea comparte hueco con el nombre en negrita; el resto va a
    // ancho completo, igual que hace drawLabelledField en la tarjeta.
    const todas = wrapText(measure, regla.description || '–', Math.max(20, maxW - anchoNombre))
    const resto = todas.length > 1 ? wrapText(measure, todas.slice(1).join(' '), maxW) : []
    const lineas = [todas[0] ?? '', ...resto]
    entradas.push({ nombre: regla.name, lineas })
    alto += lineas.length * LINE_H + LI_MB * 2
  }
  alto += PAD_BOTTOM

  const canvas = document.createElement('canvas')
  canvas.width = CARD_W * SCALE
  canvas.height = Math.round(alto) * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CARD_W, alto)

  let y = PAD_TOP
  ctx.font = BODY_BOLD_FONT
  ctx.fillStyle = INK
  ctx.textBaseline = 'top'
  ctx.fillText('Reglas especiales:', PAD_X, y)
  y += Math.round(BODY_SIZE * 1.2) + TITLE_SMALL_MB

  // Filete bajo el título, del mismo color y grosor que los de la tabla de
  // características: es el separador que ya usa la ficha.
  ctx.strokeStyle = ROW_LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD_X, y + 0.5)
  ctx.lineTo(CARD_W - PAD_X, y + 0.5)
  ctx.stroke()
  y += 4

  for (const entrada of entradas) {
    ctx.font = BODY_BOLD_FONT
    ctx.fillStyle = INK
    const etiqueta = `${entrada.nombre}: `
    ctx.fillText(etiqueta, PAD_X, y)
    const anchoNombre = ctx.measureText(etiqueta).width

    ctx.font = BODY_FONT
    entrada.lineas.forEach((linea, i) => {
      const x = i === 0 ? PAD_X + anchoNombre : PAD_X
      ctx.fillText(linea, x, y + i * LINE_H)
    })
    y += entrada.lineas.length * LINE_H + LI_MB * 2
  }

  if (view.grayscale) grayscaleCanvasInPlace(canvas)
  return canvas
}
