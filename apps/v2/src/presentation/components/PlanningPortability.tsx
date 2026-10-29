import { useState } from 'react';

type Props = {
  onExport: () => string;
  onImport: (text: string) => Promise<string>;
  locked: boolean;
};

export function PlanningPortability({ onExport, onImport, locked }: Props) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [exported, setExported] = useState('');

  return (
    <section className="panel" aria-labelledby="portability-title" data-testid="planning-portability">
      <h2 id="portability-title">Importar e exportar</h2>
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
          disabled={locked || text.trim().length === 0}
          onClick={async () => setStatus(await onImport(text))}
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
