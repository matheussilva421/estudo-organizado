import { useRef, useState } from 'react';
import type { ImportPreview as Preview } from '../../application/import-types';
import { IMPORT_MAX_BYTES } from '../../application/import-types';

type ImportPreviewProps = {
  onPreview: (text: string, namespace: string) => Promise<Preview | { error: string }>;
  onConfirm: (preview: Preview) => Promise<boolean>;
};

export function ImportPreview({ onPreview, onConfirm }: ImportPreviewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [namespace, setNamespace] = useState('local');

  async function handleFile(file: File | undefined): Promise<void> {
    setMessage(null);
    setPreview(null);
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setMessage('Arquivo acima de 2 MiB. Reduza o arquivo antes de importar.');
      return;
    }
    const text = await file.text();
    setBusy(true);
    try {
      const result = await onPreview(text, namespace.trim() || 'local');
      if ('error' in result) {
        setMessage(`Importação recusada: ${result.error}`);
        return;
      }
      setPreview(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="import-title">
      <h2 id="import-title">Importar edital</h2>
      <p className="hint">
        JSON versionado da V1, tratado como texto. Nada é gravado antes da confirmação.
      </p>
      <label className="file-field" htmlFor="import-namespace">
        Fonte do arquivo (namespace confiável)
      </label>
      <input
        id="import-namespace"
        value={namespace}
        maxLength={60}
        onChange={(event) => setNamespace(event.target.value)}
      />
      <label className="file-field" htmlFor="import-file">
        Arquivo de edital
      </label>
      <input
        ref={inputRef}
        id="import-file"
        type="file"
        accept="application/json,.json"
        onChange={(event) => void handleFile(event.target.files?.[0] ?? undefined)}
      />

      {busy ? <p role="status">Lendo e validando o arquivo…</p> : null}
      {message ? (
        <p className="inline-notice" role="alert">
          {message}
        </p>
      ) : null}

      {preview ? (
        <div className="import-preview" role="region" aria-label="Prévia da importação">
          <h3>{preview.sourceIdentity.nameKey}</h3>
          <dl className="preview-counts">
            <div>
              <dt>Criar</dt>
              <dd>{preview.creates.length}</dd>
            </div>
            <div>
              <dt>Reutilizar</dt>
              <dd>{preview.matches.length}</dd>
            </div>
            <div>
              <dt>Ambíguos</dt>
              <dd>{preview.ambiguous.length}</dd>
            </div>
            <div>
              <dt>Conflitos</dt>
              <dd>{preview.conflicts.length}</dd>
            </div>
            <div>
              <dt>Quarentena</dt>
              <dd>{preview.quarantined.length}</dd>
            </div>
          </dl>

          {preview.conflicts.length > 0 ? (
            <p className="inline-notice" role="alert">
              Divergência de revisão na origem: revise antes de confirmar.
            </p>
          ) : null}

          {preview.ambiguous.length > 0 ? (
            <p className="hint" role="note">
              Nomes parecidos não são mesclados: a importação cria uma disciplina separada com o
              mesmo nome e mantém a existente intacta.
            </p>
          ) : null}

          <ul className="preview-list">
            {preview.creates.slice(0, 20).map((item) => (
              <li key={item.id}>
                <span className="badge">{item.entityType}</span> {item.name}
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="button-primary"
            onClick={() => {
              setBusy(true);
              void onConfirm(preview)
                .then((ok) => {
                  setMessage(
                    ok
                      ? 'Importação concluída e registrada no recibo.'
                      : 'Importação recusada: gere uma nova prévia antes de confirmar.',
                  );
                  if (ok) setPreview(null);
                })
                .finally(() => setBusy(false));
            }}
          >
            Confirmar importação
          </button>
          <button type="button" className="button-ghost" onClick={() => setPreview(null)}>
            Descartar prévia
          </button>
        </div>
      ) : null}
    </section>
  );
}
