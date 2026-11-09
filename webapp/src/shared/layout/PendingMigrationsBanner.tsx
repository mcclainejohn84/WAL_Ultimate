// ============================================================================
// Aviso de "a la base de datos le faltan cosas". Ver
// data/repositories/schemaHealth.ts para el porqué: sin él, una migración
// pendiente se manifiesta como errores sueltos y datos que desaparecen, sin
// pista de la causa común.
//
// POR QUÉ YA NO DICE SIEMPRE "FALTA DESPLEGAR EL WORKER". Porque no siempre es
// eso, y decirlo igualmente hacía que quien lo leía desplegara una y otra vez
// algo que ya estaba desplegado. Desplegar el Worker solo SUBE EL CÓDIGO con
// las migraciones dentro; quien las ejecuta es el navegador, llamando a
// /admin/migrate. Entre una cosa y la otra hay dos sitios donde se puede quedar
// parado:
//
//   1. El Worker desplegado no tiene todavía esa migración → sí, falta desplegar.
//   2. Se piden, el Worker las intenta y alguna FALLA → el mensaje tiene que
//      traer el motivo, no repetir el consejo de siempre.
//
// El aviso distingue los dos y trae un botón para reintentar en el sitio, sin
// recargar: si el problema era (1) y acabas de desplegar, se arregla desde
// aquí y se ve que se ha arreglado.
//
// LO VE TODO EL MUNDO, no solo el administrador. Mientras fue solo para él, el
// resto del grupo seguía trabajando contra una base a medias sin que nada se
// lo dijera: unas cosas se guardaban, otras no, y los descuadres aparecían
// días después sin causa aparente. Ahora lo ve quien esté dentro, y además
// mientras falte algo el programa SE PONE EN SOLO LECTURA (ver
// marcarEsquemaAtrasado en data/sqlite/client): se puede mirar todo, pero no
// guardar. Eso es lo que de verdad evita los datos a medias; el cartel solo lo
// explica.
//
// NO SE PUEDE OCULTAR cuando bloquea: un aviso que se quita de en medio y deja
// la aplicación sin guardar sería lo peor de las dos cosas.
// ============================================================================
import { useEffect, useState } from 'react'
import { findPendingMigrations } from '@/data/repositories/schemaHealth'
import {
  marcarEsquemaAtrasado,
  migrationsAttempted,
  runMigrations,
  ultimoResultadoDeMigraciones,
} from '@/data/sqlite/client'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Tope de espera a las migraciones: si no llegan (Worker caído), se comprueba igualmente. */
const MIGRATIONS_WAIT_MS = 8000
/** Margen para que un ALTER TABLE recién aplicado llegue a las réplicas de lectura de D1. */
const REPLICA_LAG_MS = 3000

export function PendingMigrationsBanner() {
  const [pending, setPending] = useState<string[]>([])
  const [reintentando, setReintentando] = useState(false)
  const [resultado, setResultado] = useState(ultimoResultadoDeMigraciones())

  async function comprobar(): Promise<string[]> {
    let list = await findPendingMigrations()
    // Antes de acusar, insistir una vez. Las lecturas de D1 pueden ir a una
    // réplica que todavía no tenga el ALTER TABLE recién aplicado (ver Read
    // Replication en worker/src/index.ts), y ese retraso de unos segundos daría
    // un falso positivo. Solo se avisa si sigue ahí en el segundo intento.
    if (list.length > 0) {
      await wait(REPLICA_LAG_MS)
      list = await findPendingMigrations()
    }
    return list
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      // Esperar a que las migraciones se hayan intentado. Sin esto, el aviso
      // comprobaba el esquema mientras seguían en vuelo (las dos cosas arrancan
      // a la vez desde DatabaseGate) y acusaba justo después de desplegar.
      await Promise.race([migrationsAttempted, wait(MIGRATIONS_WAIT_MS)])
      if (cancelled) return
      const list = await comprobar()
      if (cancelled) return
      setResultado(ultimoResultadoDeMigraciones())
      anotar(list)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  /** Lo que falta se apunta EN LOS DOS SITIOS: en la pantalla y en el candado de las escrituras. */
  function anotar(list: string[]) {
    setPending(list)
    marcarEsquemaAtrasado(list)
  }

  /** Reintentar aquí mismo: pedir las migraciones y volver a comprobar. */
  async function reintentar() {
    setReintentando(true)
    try {
      // El candado se abre para que las migraciones no se queden fuera por su
      // propia culpa; si siguen faltando, `anotar` lo vuelve a cerrar.
      marcarEsquemaAtrasado([])
      await runMigrations().catch(() => undefined)
      setResultado(ultimoResultadoDeMigraciones())
      anotar(await comprobar())
    } finally {
      setReintentando(false)
    }
  }

  if (pending.length === 0) return null

  const fallidas = resultado?.estado === 'aplicadas' ? resultado.fallidas : []

  return (
    <div className="border-b border-bronze/40 bg-bronze/10 px-6 py-3">
      <div className="mx-auto flex max-w-4xl items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            {fallidas.length > 0
              ? 'La base de datos no está al día: el Worker intentó actualizarla y no pudo.'
              : 'La base de datos no está al día.'}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            No se puede guardar nada hasta que esté al día. Lo que falta: <b>{pending.join(', ')}</b>.
          </p>

          {/* El motivo REAL, cuando se sabe. Un consejo genérico repetido sobre
              un problema que no es ese hace perder más tiempo que no decir nada. */}
          {fallidas.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {fallidas.map((f) => (
                <li key={f.sql} className="font-mono text-[11px] break-words text-danger">
                  {f.error}
                </li>
              ))}
            </ul>
          )}
          {resultado?.estado === 'error' && (
            <p className="mt-1.5 font-mono text-[11px] text-danger">{resultado.motivo}</p>
          )}
          {(resultado == null || (resultado.estado === 'aplicadas' && fallidas.length === 0)) && (
            <p className="mt-1.5 text-xs text-ink-soft">
              El Worker desplegado todavía no trae estas migraciones. Despliégalo y pulsa <b>Aplicar ahora</b> — no hace
              falta recargar.
            </p>
          )}
          <p className="mt-1.5 font-mono text-[11px] text-ink-soft">cd webapp/worker &amp;&amp; npx wrangler deploy</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={reintentar}
            disabled={reintentando}
            className="rounded-sm border border-bronze/50 bg-parchment px-2 py-1 text-xs font-medium text-ink hover:bg-parchment-dark disabled:opacity-50"
          >
            {reintentando ? 'Aplicando…' : 'Aplicar ahora'}
          </button>
        </div>
      </div>
    </div>
  )
}
