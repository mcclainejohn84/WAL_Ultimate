// ============================================================================
// UN APÉNDICE PEGADO DENTRO DE LA FICHA — la caja que se coloca en el cuadro
// blanco de la hoja, se arrastra a donde haga falta y se estrecha o ensancha.
//
// Los apéndices nacieron DEBAJO de la hoja (ver SheetAppendices), y ahí siguen
// los que son media página de reglas. Pero un apéndice corto —un párrafo con
// una excepción, una nota de dos líneas— pedía ir dentro, en el hueco que deja
// la ilustración: era lo que se pidió. Cada apéndice elige: dentro (esta caja)
// o debajo (la lista), y se puede mover de uno a otro sin perder el texto.
//
// EL SITIO Y EL ANCHO SON DE LA FICHA, NO DEL APÉNDICE EN ABSTRACTO: se
// guardan en el propio apéndice (in_sheet/sheet_x/sheet_y/sheet_w) porque un
// apéndice cuelga de una unidad y una unidad tiene una sola hoja.
//
// Las medidas son las mismas de la hoja (12,5px, interlineado 1,5) para que
// parezca parte de la ficha y no un recuadro pegado encima. En las
// exportaciones esta caja no se monta: la dibuja a mano exportSheet.ts, con
// estas mismas coordenadas.
// ============================================================================
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from 'react'
import { clsx } from 'clsx'
import { RichText } from '@/shared/ui/RichTextEditor'
import { ArrowDownIcon, PencilIcon } from '@/shared/ui/icons'
import { APENDICE_MIN_W } from '@/features/fichas/sheetContent'
import type { UnitAppendix } from '@/domain/types'

/** Cuánto se deja asomar siempre por los bordes (mismo criterio que la ilustración). */
const KEEP_VISIBLE = 60

export interface CajaDeApendice {
  x: number
  y: number
  w: number
}

export function ApendiceEnFicha({
  apendice,
  anchoUtil,
  editable,
  onCaja,
  onEditar,
  onSacar,
  onAlto,
}: {
  apendice: UnitAppendix
  /** Ancho útil de la ficha (CONTENT_W): el límite del arrastre y del ancho. */
  anchoUtil: number
  editable: boolean
  /** Al soltar el arrastre o el ancho, para guardarlo. */
  onCaja?: (caja: CajaDeApendice) => void
  onEditar?: () => void
  onSacar?: () => void
  /** El alto que ocupa, para que la ficha crezca y no lo recorte. */
  onAlto?: (alto: number) => void
}) {
  const guardada: CajaDeApendice = {
    x: apendice.sheetX ?? 0,
    y: apendice.sheetY ?? 0,
    w: apendice.sheetW ?? anchoUtil,
  }
  const [caja, setCaja] = useState(guardada)
  // Igual que la ilustración: mientras se arrastra NO se acepta lo que llegue
  // de fuera, o un re-render del padre a mitad de gesto devuelve la caja a su
  // sitio anterior y el arrastre "se suelta solo".
  const [gesto, setGesto] = useState<'mover' | 'ancho' | null>(null)
  useEffect(() => {
    if (gesto) return
    setCaja({ x: apendice.sheetX ?? 0, y: apendice.sheetY ?? 0, w: apendice.sheetW ?? anchoUtil })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apendice.id, apendice.sheetX, apendice.sheetY, apendice.sheetW, anchoUtil])

  const cajaRef = useRef(caja)
  cajaRef.current = caja
  const inicio = useRef<{ px: number; py: number; caja: CajaDeApendice } | null>(null)
  const nodoRef = useRef<HTMLDivElement>(null)

  /** Avisa del alto real para que la ficha reserve sitio (ver UnitSheetCard). */
  useEffect(() => {
    const nodo = nodoRef.current
    if (!nodo || !onAlto) return
    const medir = () => onAlto(nodo.offsetHeight)
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(medir)
    observer.observe(nodo)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apendice.bodyHtml, apendice.title, caja.w])

  function acotar(siguiente: CajaDeApendice): CajaDeApendice {
    const w = Math.max(APENDICE_MIN_W, Math.min(anchoUtil, Math.round(siguiente.w)))
    return {
      w,
      // Puede salirse por los bordes (recortar contra el borde es un encuadre
      // legítimo y la ficha ya recorta); lo único que se impide es perderla.
      x: Math.round(Math.max(KEEP_VISIBLE - w, Math.min(anchoUtil - KEEP_VISIBLE, siguiente.x))),
      y: Math.round(Math.max(-40, siguiente.y)),
    }
  }

  function aplicar(siguiente: CajaDeApendice) {
    const acotada = acotar(siguiente)
    cajaRef.current = acotada
    setCaja(acotada)
  }

  function agarrar(cual: 'mover' | 'ancho') {
    return (e: PointerEvent<HTMLElement>) => {
      if (!editable) return
      e.preventDefault()
      e.stopPropagation()
      inicio.current = { px: e.clientX, py: e.clientY, caja: cajaRef.current }
      e.currentTarget.setPointerCapture(e.pointerId)
      setGesto(cual)
    }
  }

  function mover(e: PointerEvent<HTMLElement>) {
    if (!inicio.current || !gesto) return
    const dx = e.clientX - inicio.current.px
    const dy = e.clientY - inicio.current.py
    const desde = inicio.current.caja
    if (gesto === 'ancho') aplicar({ ...desde, w: desde.w + dx })
    else aplicar({ ...desde, x: desde.x + dx, y: desde.y + dy })
  }

  function soltar(e: PointerEvent<HTMLElement>) {
    if (!inicio.current) return
    inicio.current = null
    setGesto(null)
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    onCaja?.(cajaRef.current)
  }

  /** Ajuste fino con el teclado (Mayús = 10 px); con Alt, el ancho. */
  function teclado(e: ReactKeyboardEvent<HTMLDivElement>) {
    const paso = e.shiftKey ? 10 : 1
    const movimientos: Record<string, [number, number]> = {
      ArrowLeft: [-paso, 0],
      ArrowRight: [paso, 0],
      ArrowUp: [0, -paso],
      ArrowDown: [0, paso],
    }
    const movimiento = movimientos[e.key]
    if (!movimiento) return
    e.preventDefault()
    const desde = cajaRef.current
    const siguiente = e.altKey
      ? { ...desde, w: desde.w + movimiento[0] }
      : { ...desde, x: desde.x + movimiento[0], y: desde.y + movimiento[1] }
    aplicar(siguiente)
    onCaja?.(acotar(siguiente))
  }

  return (
    <div
      ref={nodoRef}
      className={clsx('ficha-apendice', editable && 'ficha-apendice--editable')}
      style={{ left: caja.x, top: caja.y, width: caja.w }}
    >
      <div className="ficha-apendice-titulo">{apendice.title}</div>
      <RichText html={apendice.bodyHtml} className="ficha-apendice-texto" />

      {editable && (
        <>
          {/*
            ZONA DE AGARRE, por la misma razón que la de la ilustración (ver
            UnitSheetCard): el texto de la caja se puede seleccionar y el
            navegador entregaría el gesto al párrafo. Un rectángulo transparente
            encima deja agarrar la caja por cualquier punto, menos los botones y
            el tirador de ancho, que van por delante.
          */}
          <div
            role="application"
            aria-label={`Mover el apéndice ${apendice.title}: arrastra, o usa las flechas (Alt + flechas para el ancho)`}
            tabIndex={0}
            className={clsx(
              'absolute inset-0 touch-none outline-none',
              'focus-visible:ring-2 focus-visible:ring-bronze/70',
              gesto === 'mover' ? 'cursor-grabbing' : 'cursor-grab',
            )}
            onPointerDown={agarrar('mover')}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onKeyDown={teclado}
          />
          <div className="ficha-apendice-botones">
            <button
              type="button"
              onClick={onEditar}
              onPointerDown={(e) => e.stopPropagation()}
              title="Editar este apéndice"
              aria-label={`Editar ${apendice.title}`}
            >
              <PencilIcon className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onSacar}
              onPointerDown={(e) => e.stopPropagation()}
              title="Sacarlo de la ficha (vuelve a la lista de debajo)"
              aria-label={`Sacar ${apendice.title} de la ficha`}
            >
              <ArrowDownIcon className="h-3 w-3" />
            </button>
          </div>
          {/* Tirador de ancho: el borde derecho. El alto lo pone el texto. */}
          <div
            role="application"
            aria-label={`Ancho del apéndice ${apendice.title}`}
            className={clsx('ficha-apendice-ancho', gesto === 'ancho' && 'ficha-apendice-ancho--activo')}
            onPointerDown={agarrar('ancho')}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          />
        </>
      )}
    </div>
  )
}
