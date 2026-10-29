import type { MergeConflict } from '../../domain/planning-merge';

type Props = { conflicts: MergeConflict[] };
type Resolution = 'CURRENT' | 'INCOMING';

export function PlanningConflicts({
  conflicts,
  onResolve,
}: Props & { onResolve: (conflict: MergeConflict, choice: Resolution) => void }) {
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
              <button
                type="button"
                data-action="keep-current"
                onClick={() => onResolve(conflict, 'CURRENT')}
              >
                Manter atual
              </button>
              <button
                type="button"
                data-action="use-incoming"
                onClick={() => onResolve(conflict, 'INCOMING')}
              >
                Usar rascunho
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
