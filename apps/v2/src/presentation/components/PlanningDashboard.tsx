import type { PlanningScenario } from '../../domain/planning';

type Props = {
  scenarios: PlanningScenario[];
  selectedId: string | null;
  onSelect: (scenarioId: string) => void;
  onActivate: (scenarioId: string) => void;
  locked: boolean;
};

export function PlanningDashboard({
  scenarios,
  selectedId,
  onSelect,
  onActivate,
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
            <li key={scenario.id} data-testid={`scenario-${scenario.id}`} data-status={scenario.status}>
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
                disabled={locked || scenario.status === 'ACTIVE'}
                onClick={() => onActivate(scenario.id)}
              >
                Ativar com checkpoint
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
