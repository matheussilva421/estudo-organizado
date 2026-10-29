import { useState } from 'react';
import type { PlanningDraft } from '../../application/planning-service';
import type { PlanBlock } from '../../domain/planning';

type Props = {
  blocks: PlanBlock[];
  draft: PlanningDraft | null;
  onSaveDraft: (changes: { blockId: string; field: 'plannedMinutes' | 'civilDate'; value: string | number; baseValue: string | number }) => void;
  onApplyDraft: () => void;
  locked: boolean;
};

export function PlanningEditor({ blocks, draft, onSaveDraft, onApplyDraft, locked }: Props) {
  const [selectedId, setSelectedId] = useState(blocks[0]?.id ?? '');
  const [minutes, setMinutes] = useState(60);
  const selected = blocks.find((block) => block.id === selectedId) ?? blocks[0] ?? null;

  return (
    <section className="panel" aria-labelledby="editor-title" data-testid="planning-editor">
      <h2 id="editor-title">Editor e rascunho</h2>
      {blocks.length === 0 ? (
        <p className="empty-state">Nenhum bloco para editar.</p>
      ) : (
        <div>
          <label>
            Bloco
            <select value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.label ?? block.id} · {block.plannedMinutes} min
                </option>
              ))}
            </select>
          </label>
          <label>
            Minutos
            <input
              type="number"
              min={5}
              max={480}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            data-action="save-draft"
            disabled={locked || !selected}
            onClick={() =>
              selected &&
              onSaveDraft({
                blockId: selected.id,
                field: 'plannedMinutes',
                value: minutes,
                baseValue: selected.plannedMinutes,
              })
            }
          >
            Salvar rascunho
          </button>
          <p data-testid="draft-state" data-changes={draft?.changes.length ?? 0}>
            {draft ? `Rascunho com ${draft.changes.length} alteração(ões), base ${draft.baseRevision}` : 'Sem rascunho salvo'}
          </p>
          <button
            type="button"
            data-action="apply-draft"
            disabled={locked || !draft || draft.changes.length === 0}
            onClick={onApplyDraft}
          >
            Aplicar rascunho
          </button>
        </div>
      )}
    </section>
  );
}
