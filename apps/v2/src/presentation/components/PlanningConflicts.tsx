import type { MergeConflict } from '../../domain/planning-merge';

type Props = { conflicts: MergeConflict[] };

export function PlanningConflicts({ conflicts }: Props) {
  return (
    <section className="panel" aria-labelledby="conflicts-title" data-testid="planning-conflicts">
      <h2 id="conflicts-title">Conflitos</h2>
      {conflicts.length === 0 ? (
        <p className="empty-state">Nenhum conflito pendente.</p>
      ) : (
        <ul>
          {conflicts.map((conflict) => (
            <li key={`${conflict.blockId}-${conflict.field}`}>
              {conflict.blockId} · {conflict.field}: atual {String(conflict.current)} × proposta{' '}
              {String(conflict.incoming)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
