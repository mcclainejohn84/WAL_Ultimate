// ============================================================================
// "OTRO HA CAMBIADO ESTE EJÉRCITO MIENTRAS LO EDITABAS."
//
// Con los ejércitos compartidos con edición, dos personas pueden tener la
// misma lista abierta. El constructor trabaja sobre un borrador y guarda la
// lista ENTERA de una vez (ver ArmyListRepository.replaceAllEntries), así que
// sin esto el último en guardar borraría lo del otro sin que nadie se
// enterase. Antes de guardar se mira si alguien la ha guardado entretanto y,
// si es así, se pregunta: quedarse con lo suyo o con lo tuyo. No se mezclan:
// con unidades que se añaden, se quitan y se reordenan, una mezcla automática
// acabaría en una lista que no ha montado nadie.
//
// Si el otro la ha dado por COMPLETADA, no hay elección: una lista cerrada no
// se cambia (hay que reabrirla), así que solo se puede cargar como está.
// ============================================================================
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'

export type CambiosDeOtro = { tipo: 'cambios' | 'completada'; editor: string | null }

export function CambiosDeOtroDialog({
  conflicto,
  ocupado,
  onCargarLosSuyos,
  onGuardarLosMios,
  onCancelar,
}: {
  conflicto: CambiosDeOtro
  ocupado: boolean
  onCargarLosSuyos: () => void
  onGuardarLosMios: () => void
  onCancelar: () => void
}) {
  const quien = conflicto.editor ?? 'Otro jugador'
  const completada = conflicto.tipo === 'completada'
  return (
    <Modal
      title={completada ? `${quien} ha dado este ejército por completado` : `${quien} ha cambiado este ejército`}
      onClose={onCancelar}
      widthClassName="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancelar} disabled={ocupado}>
            Cancelar
          </Button>
          {!completada && (
            <Button variant="secondary" onClick={onGuardarLosMios} disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar los míos'}
            </Button>
          )}
          <Button variant="primary" onClick={onCargarLosSuyos} disabled={ocupado}>
            {completada ? 'Cargar la lista' : 'Cargar los suyos'}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-soft">
        {completada
          ? 'Lo cerró mientras lo editabas. Tus cambios sin guardar se perderán al cargarlo.'
          : 'Lo guardó mientras lo editabas. Si cargas los suyos, se pierden tus cambios sin guardar; si guardas los tuyos, se pierden los suyos.'}
      </p>
    </Modal>
  )
}
