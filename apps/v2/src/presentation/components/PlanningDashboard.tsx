import type {
  PlanningScenario,
  ScenarioActivationPreview,
} from '../../domain/planning';

type Props = {
  scenarios: PlanningScenario[];
  selectedId: string | null;
  onSelect: (scenarioId: string) => void;
  onPreviewActivate: (scenarioId: string) => void;
  activationPreview: ScenarioActivationPreview | null;
  onConfirmActivate: () => void;
  onCancelActivate: () => void;
  locked: boolean;
};

export function PlanningDashboard({
  scenarios,
  selectedId,
  onSelect,
  onPreviewActivate,
  activationPreview,
  onConfirmActivate,
  onCancelActivate,
  locked,
}: Props) {
  return (
    <section className="panel" aria-labelledby="planning-dashboard-title" data-testid="planning-dashboard">
      <h2 id="planning-dashboard-title">Cenários de planejamento</h2>
      {scenarios.length === 0 ? (
        <p className="empty-state">Nenhum cenário ainda. Use o wizard para criar o primeiro.</p>
      ) : (
        <ul className="planning-scenarios">
          {scenarios.map((scenario) => (
            <li
              key={scenario.id}
              data-testid={`scenario-${scenario.id}`}
              data-status={scenario.status}
              data-entity-id={scenario.id}
            >
              <button
                type="button"
                className={scenario.id === selectedId ? 'is-selected' : undefined}
                data-action="select-scenario"
                onClick={() => onSelect(scenario.id)}
              >
                {scenario.name}
              </button>
              <span className="planning-badge">{scenario.status}</span>
              <span className="planning-badge">{scenario.kind === 'CYCLE' ? 'Ciclo' : 'Reta Final'}</span>
              {scenario.examDate ? <span className="planning-badge">Prova {scenario.examDate}</span> : null}
              <button
                type="button"
                data-action="activate-scenario"
                disabled={
                  locked ||
                  scenario.status === 'ACTIVE' ||
                  scenario.status === 'CLOSED' ||
                  scenario.status === 'ARCHIVED' ||
                  (scenario.kind === 'FINAL_STRETCH' && !scenario.examDate)
                }
                onClick={() => onPreviewActivate(scenario.id)}
              >
                Pré-visualizar ativação
              </button>
              {activationPreview?.nextScenarioId === scenario.id ? (
                <div
                  className="planning-activation-preview"
                  role="group"
                  aria-label="Prévia da ativação do cenário"
                  data-testid={`activation-preview-${scenario.id}`}
                >
                  <p>
                    {activationPreview.deactivatedScenarioIds.length === 0
                      ? 'Nenhum cenário ativo será substituído.'
                      : `Substitui ${activationPreview.deactivatedScenarioIds.length} cenário(s) ativo(s): ${activationPreview.deactivatedScenarioIds.join(', ')}.`}
                  </p>
                  <p>
                    {activationPreview.affectedBlockIds.length} bloco(s) do cenário
                    substituído deixam de reservar capacidade. O checkpoint atual
                    continua restaurável.
                  </p>
                  {activationPreview.warnings.includes(
                    'ACTIVATION_REQUIRES_CONFIRMATION',
                  ) ? <p>A ativação exige confirmação explícita.</p> : null}
                  <button
                    type="button"
                    data-action="confirm-activate"
                    onClick={onConfirmActivate}
                  >
                    Confirmar ativação
                  </button>
                  <button
                    type="button"
                    data-action="cancel-activate"
                    onClick={onCancelActivate}
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
