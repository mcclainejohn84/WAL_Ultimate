// ============================================================================
// Editor de texto con formato: negrita, cursiva, subrayado, listas, la
// alineación del párrafo y su sangría (meter y sacar, como en un procesador
// de textos). Nada más — cortar, copiar y pegar son los del navegador, con el
// pegado saneado (ver más abajo).
//
// POR QUÉ `document.execCommand` Y NO UNA BIBLIOTECA. Lo que hace falta cabe en
// cuatro botones sobre un `contentEditable`; meter un editor completo (300 kB
// de dependencia) para poner cuatro negritas no sale a cuenta. `execCommand`
// está marcado como obsoleto desde hace años pero lo implementan todos los
// navegadores y no hay sustituto estándar; el día que lo haya, se cambia aquí
// y en ningún otro sitio.
//
// EL COMPONENTE NO ES CONTROLADO. Reescribir el `innerHTML` en cada tecla
// destruye la selección y el cursor salta al principio: es el fallo clásico de
// un contentEditable "controlado" por React. Así que el texto inicial se
// escribe UNA vez (y solo se vuelve a escribir si cambia de apéndice, ver la
// clave `valorInicialKey`), y a partir de ahí manda el DOM: los cambios salen
// por `onChange`.
//
// AL PEGAR SE SANEA SIEMPRE. Un pegado de Word o de un PDF trae hojas de estilo
// enteras; sin limpiarlo, el apéndice acaba con letras Calibri azules de otro
// programa. Ver shared/richText.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { sanearHtml, textoPlanoAHtml } from '@/shared/richText'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  /**
   * Cambiar esta clave vuelve a cargar `value` en el editor. Se le pasa el id
   * del apéndice que se está editando: mientras sea el mismo, lo que manda es
   * lo que el usuario tiene escrito; al cambiar de apéndice, se recarga.
   */
  valorInicialKey?: string | number
  placeholder?: string
  className?: string
}

interface Herramienta {
  comando:
    | 'bold'
    | 'italic'
    | 'underline'
    | 'insertUnorderedList'
    | 'insertOrderedList'
    | 'justifyLeft'
    | 'justifyCenter'
    | 'justifyRight'
    | 'justifyFull'
    | 'indent'
    | 'outdent'
  etiqueta: string
  titulo: string
  contenido: React.ReactNode
  /** Deja un hueco a su izquierda: separa los grupos de botones. */
  separa?: boolean
}

/** Las rayitas de los botones de alineación, que dibujan lo que hacen. */
function Rayas({ anchos, derecha = false, centro = false }: { anchos: number[]; derecha?: boolean; centro?: boolean }) {
  return (
    <span
      className="flex w-4 flex-col gap-[2px]"
      style={{ alignItems: centro ? 'center' : derecha ? 'flex-end' : 'flex-start' }}
    >
      {anchos.map((ancho, i) => (
        <span key={i} className="block h-[1.5px] bg-current" style={{ width: `${ancho}%` }} />
      ))}
    </span>
  )
}

const HERRAMIENTAS: Herramienta[] = [
  { comando: 'bold', etiqueta: 'Negrita', titulo: 'Negrita (Ctrl+B)', contenido: <span className="font-bold">N</span> },
  {
    comando: 'italic',
    etiqueta: 'Cursiva',
    titulo: 'Cursiva (Ctrl+I)',
    contenido: <span className="font-serif italic">C</span>,
  },
  {
    comando: 'underline',
    etiqueta: 'Subrayado',
    titulo: 'Subrayado (Ctrl+U)',
    contenido: <span className="underline">S</span>,
  },
  {
    comando: 'insertUnorderedList',
    separa: true,
    etiqueta: 'Lista con puntos',
    titulo: 'Lista con puntos',
    contenido: <span className="tracking-tight">• —</span>,
  },
  {
    comando: 'insertOrderedList',
    etiqueta: 'Lista numerada',
    titulo: 'Lista numerada',
    contenido: <span className="tracking-tight">1. —</span>,
  },
  {
    comando: 'justifyLeft',
    etiqueta: 'Alinear a la izquierda',
    titulo: 'Alinear a la izquierda',
    separa: true,
    contenido: <Rayas anchos={[100, 60, 100, 60]} />,
  },
  {
    comando: 'justifyCenter',
    etiqueta: 'Centrar',
    titulo: 'Centrar',
    contenido: <Rayas anchos={[100, 60, 100, 60]} centro />,
  },
  {
    comando: 'justifyRight',
    etiqueta: 'Alinear a la derecha',
    titulo: 'Alinear a la derecha',
    contenido: <Rayas anchos={[100, 60, 100, 60]} derecha />,
  },
  {
    comando: 'justifyFull',
    etiqueta: 'Justificar',
    titulo: 'Justificar',
    contenido: <Rayas anchos={[100, 100, 100, 100]} />,
  },
  {
    comando: 'outdent',
    etiqueta: 'Sacar el párrafo',
    titulo: 'Sacar el párrafo hacia fuera',
    separa: true,
    contenido: <Sangria hacia="fuera" />,
  },
  {
    comando: 'indent',
    etiqueta: 'Meter el párrafo',
    titulo: 'Meter el párrafo hacia dentro',
    contenido: <Sangria hacia="dentro" />,
  },
]

/** Rayas con una flecha: meter o sacar el párrafo, como en cualquier procesador de textos. */
function Sangria({ hacia }: { hacia: 'dentro' | 'fuera' }) {
  return (
    <span className="flex w-4 items-center gap-[3px]">
      <svg viewBox="0 0 6 10" className="h-2.5 w-1.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          d={hacia === 'dentro' ? 'M1.5 1.5 4.5 5l-3 3.5' : 'M4.5 1.5 1.5 5l3 3.5'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="flex flex-1 flex-col gap-[2px]">
        {[100, 100, 100].map((ancho, i) => (
          <span key={i} className="block h-[1.5px] bg-current" style={{ width: `${ancho}%` }} />
        ))}
      </span>
    </span>
  )
}

export function RichTextEditor({ value, onChange, valorInicialKey, placeholder, className }: RichTextEditorProps) {
  const caja = useRef<HTMLDivElement>(null)
  const [activos, setActivos] = useState<Set<string>>(new Set())
  const [vacio, setVacio] = useState(!value)

  // Carga inicial y cambio de apéndice. Fuera de aquí NO se toca el innerHTML.
  useEffect(() => {
    if (!caja.current) return
    caja.current.innerHTML = value
    setVacio(!value)
    // `value` se lee a propósito sin declararlo como dependencia: si estuviera,
    // cada pulsación volvería a escribir el innerHTML y el cursor saltaría al
    // principio, que es justo lo que este componente evita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorInicialKey])

  function emitir() {
    const html = caja.current?.innerHTML ?? ''
    setVacio(!html || html === '<br>')
    onChange(html)
  }

  /** Qué botones se ven pulsados según dónde esté el cursor. */
  function refrescarActivos() {
    const marcados = new Set<string>()
    for (const h of HERRAMIENTAS) {
      try {
        if (document.queryCommandState(h.comando)) marcados.add(h.comando)
      } catch {
        // queryCommandState lanza si el foco no está en un editable. No pasa
        // nada: sin foco no hay nada que marcar.
      }
    }
    setActivos(marcados)
  }

  function aplicar(comando: Herramienta['comando']) {
    caja.current?.focus()
    document.execCommand(comando)
    refrescarActivos()
    emitir()
  }

  return (
    <div className={clsx('rounded-sm border border-rule-dark/40 bg-parchment', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-rule-dark/25 bg-parchment-dark/40 px-1.5 py-1">
        {HERRAMIENTAS.map((h) => (
          <button
            key={h.comando}
            type="button"
            // `onMouseDown` con preventDefault en vez de `onClick`: pulsar un
            // botón le quita el foco al texto y con él la selección, así que la
            // negrita no se aplicaría a nada.
            onMouseDown={(e) => {
              e.preventDefault()
              aplicar(h.comando)
            }}
            aria-label={h.etiqueta}
            aria-pressed={activos.has(h.comando)}
            title={h.titulo}
            className={clsx(
              'flex min-w-7 items-center justify-center rounded-sm px-1.5 py-1 text-xs text-ink-soft transition-colors hover:bg-parchment hover:text-ink',
              h.separa && 'ml-1.5 border-l border-rule-dark/30 pl-2.5',
              activos.has(h.comando) && 'bg-parchment text-maroon shadow-[inset_0_0_0_1px_rgba(122,36,32,.35)]',
            )}
          >
            {h.contenido}
          </button>
        ))}
      </div>

      <div className="relative">
        {vacio && placeholder && (
          <span className="pointer-events-none absolute top-2 left-3 text-xs text-ink-soft/50 italic">
            {placeholder}
          </span>
        )}
        <div
          ref={caja}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          aria-label="Texto del apéndice"
          onInput={emitir}
          onBlur={emitir}
          onKeyUp={refrescarActivos}
          onMouseUp={refrescarActivos}
          onPaste={(e) => {
            e.preventDefault()
            const html = e.clipboardData.getData('text/html')
            const limpio = html ? sanearHtml(html) : textoPlanoAHtml(e.clipboardData.getData('text/plain'))
            document.execCommand('insertHTML', false, limpio)
            emitir()
          }}
          // `text-justify`: el texto de un apéndice va justificado, siempre y
          // en bloque. Y las mismas clases de lista que la vista (ver
          // AppendixText), para que lo que se escribe se vea ya como quedará.
          className="prosa-apendice min-h-40 px-3 py-2 text-xs leading-relaxed text-ink outline-none [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
          style={{ textAlign: 'justify' }}
        />
      </div>
    </div>
  )
}

/**
 * La misma pinta, pero de solo lectura: es lo que se pinta en la ficha y en
 * cualquier sitio donde se enseñe un apéndice ya escrito.
 *
 * `dangerouslySetInnerHTML` con red de seguridad: lo guardado ya viene saneado
 * (ver richText), y aun así se vuelve a sanear al pintar. Sale barato y
 * cubre lo que hubiera podido entrar por otra vía.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={clsx(
        'text-justify [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanearHtml(html) }}
    />
  )
}
