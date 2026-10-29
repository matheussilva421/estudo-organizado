import { useState } from 'react';

type Props = {
  onExport: () => string;
  onImport: (text: string, targetEditalId: string) => Promise<string>;
  editais: { id: string; title: string }[];
  locked: boolean;
};

export function PlanningPortability({ onExport, onImport, editais, locked }: Props) {
  const [text, setText] = useState('');
  const [targetEditalId, setTargetEditalId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [exported, setExported] = useState('');
  const activeTarget = targetEditalId || editais[0]?.id || '';

  return (
    <section className="panel" aria-labelledby="portability-title" data-testid="planning-portability">
      <h2 id="portability-title">Importar e exportar</h2>
      <label>
        Edital de destino
        <select
          aria-label="Edital de destino da importação"
          value={activeTarget}
          onChange={(event) => setTargetEditalId(event.target.value)}
        >
          {editais.map((edital) => (
            <option key={edital.id} value={edital.id}>
              {edital.title}
            </option>
          ))}
        </select>
      </label>
      <textarea
        aria-label="JSON de planejamento"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
      />
      <div className="planning-actions">
        <button
          type="button"
          data-action="import-planning"
          disabled={locked || text.trim().length === 0 || !activeTarget}
          onClick={async () => setStatus(await onImport(text, activeTarget))}
        >
          Importar com prévia
        </button>
        <button
          type="button"
          data-action="export-planning"
          disabled={locked}
          onClick={() => {
            const json = onExport();
            setExported(json);
            setStatus('Exportado');
          }}
        >
          Exportar selecionado
        </button>
      </div>
      {status ? <p data-testid="portability-status">{status}</p> : null}
      {exported ? (
        <textarea aria-label="Exportação" readOnly value={exported} rows={4} data-testid="export-output" />
      ) : null}
    </section>
  );
}
