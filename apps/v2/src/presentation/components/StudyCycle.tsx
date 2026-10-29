import type { PlanningScenario } from '../../domain/planning';
import type { CycleDecision } from '../../domain/planning-cycle';

type Props = {
  scenario: PlanningScenario | null;
  onDecision: (decision: CycleDecision) => void;
  locked: boolean;
};

export function StudyCycle({ scenario, onDecision, locked }: Props) {
  const cycle = scenario?.cycle ?? null;
  const current = cycle?.content[cycle.cursorIndex] ?? null;

  return (
    <section className="panel" aria-labelledby="cycle-title" data-testid="study-cycle">
      <h2 id="cycle-title">Ciclo de estudos</h2>
      {!scenario || scenario.kind !== 'CYCLE' ? (
        <p className="empty-state">Crie um cenário do tipo Ciclo para usar esta área.</p>
      ) : !cycle || cycle.content.length === 0 ? (
        <p className="empty-state">O cenário não possui conteúdo sequenciado.</p>
      ) : (
        <div data-testid="cycle-state" data-cursor={cycle.cursorIndex} data-round={cycle.round}>
          <p>
            Rodada {cycle.round} · posição {cycle.cursorIndex + 1}/{cycle.content.length}
          </p>
          <p>Próximo conteúdo: <strong>{current?.label ?? current?.editalDisciplineId}</strong></p>
          {cycle.pendings.length > 0 ? (
            <p className="planning-warning">{cycle.pendings.length} pendência(s) preservada(s).</p>
          ) : null}
          <div className="planning-actions">
            <button type="button" data-action="cycle-continue" disabled={locked} onClick={() => onDecision({ type: 'CONTINUE' })}>
              Continuar
            </button>
            <button type="button" data-action="cycle-advance" disabled={locked} onClick={() => onDecision({ type: 'ADVANCE' })}>
              Avançar disciplina
            </button>
            <button type="button" data-action="cycle-defer" disabled={locked} onClick={() => onDecision({ type: 'DEFER', reason: 'adiado pelo usuário' })}>
              Adiar
            </button>
            <button type="button" data-action="cycle-skip" disabled={locked} onClick={() => onDecision({ type: 'SKIP_WITH_REASON', reason: 'pulado pelo usuário' })}>
              Pular com motivo
            </button>
            <button type="button" data-action="cycle-new-round" disabled={locked} onClick={() => onDecision({ type: 'NEW_ROUND' })}>
              Nova rodada
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
