import { useRef, useState } from 'react';
import type { Edital } from '../../domain/edital';
import type { StudySubject } from '../../domain/subject';

type EditalManagerProps = {
  editais: Edital[];
  primaryEditalId: string | null;
  subjects: StudySubject[];
  selectedId: string | null;
  onSelect: (editalId: string) => void;
  onCreate: (title: string) => Promise<boolean>;
  onRename: (edital: Edital, title: string, baseRevision: number) => Promise<boolean>;
  onArchive: (edital: Edital, replacementPrimaryId: string | null | undefined) => Promise<boolean>;
  onReactivate: (editalId: string) => Promise<boolean>;
  onSetPrimary: (editalId: string | null) => Promise<boolean>;
  onLinkSubject: (editalId: string, subjectId: string) => Promise<boolean>;
  locked?: boolean;
};

export function EditalManager({
  editais,
  primaryEditalId,
  subjects,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onArchive,
  onReactivate,
  onSetPrimary,
  onLinkSubject,
  locked = false,
}: EditalManagerProps) {
  const [title, setTitle] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameBase, setRenameBase] = useState<number | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<string>('none');
  const [subjectToLink, setSubjectToLink] = useState('');
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  function openForm(trigger: HTMLElement, open: () => void): void {
    triggerRef.current = trigger;
    open();
  }

  function closeForm(close: () => void): void {
    close();
    // Keyboard users must land back on the control that opened the editor.
    triggerRef.current?.focus();
  }

  const active = editais.filter((edital) => edital.status === 'ACTIVE');
  const archived = editais.filter((edital) => edital.status === 'ARCHIVED');
  const selected = editais.find((edital) => edital.id === selectedId) ?? null;
  const isPrimary = (editalId: string) => primaryEditalId === editalId;

  async function create(): Promise<void> {
    const normalized = title.trim();
    if (!normalized || busy) return;
    setBusy(true);
    try {
      // Only a real commit clears the draft.
      if (await onCreate(normalized)) setTitle('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="editais-title">
      <h2 id="editais-title">Editais</h2>

      <form
        className="subject-form"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label htmlFor="edital-title">Novo edital</label>
        <div className="subject-form-row">
          <input
            id="edital-title"
            value={title}
            maxLength={120}
            placeholder="Ex.: TJPB 2026"
            onChange={(event) => setTitle(event.target.value)}
          />
          <button
            type="submit"
            className="button-primary"
            disabled={!title.trim() || busy || locked}
          >
            Criar edital
          </button>
        </div>
      </form>

      <h3 className="group-title">Ativos</h3>
      {active.length === 0 ? (
        <p className="empty-state">Nenhum edital ativo. Crie o primeiro acima.</p>
      ) : (
        <ul className="edital-list" aria-label="Editais ativos">
          {active.map((edital, index) => (
            <li key={edital.id} className="edital-item" data-active={selectedId === edital.id}>
              <div className="edital-row">
                <button
                  type="button"
                  className="link-button"
                  aria-pressed={selectedId === edital.id}
                  onClick={() => onSelect(edital.id)}
                >
                  {edital.title}
                </button>
                {isPrimary(edital.id) ? <span className="badge">principal</span> : null}
              </div>
              <div className="edital-actions">
                {renaming === edital.id ? (
                  <form
                    className="rename-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const next = renameDraft.trim();
                      if (!next) return;
                      // The base revision is the one the user saw when opening
                      // the editor, not whatever a background refresh brought.
                      void onRename(edital, next, renameBase ?? edital.localRevision).then((ok) => {
                        if (ok) closeForm(() => setRenaming(null));
                      });
                    }}
                  >
                    <label htmlFor={`rename-edital-${edital.id}`}>Novo nome</label>
                    <input
                      id={`rename-edital-${edital.id}`}
                      value={renameDraft}
                      maxLength={120}
                      autoFocus
                      onChange={(event) => setRenameDraft(event.target.value)}
                    />
                    <button type="submit" className="button-primary" disabled={busy}>
                      Salvar
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => closeForm(() => setRenaming(null))}
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="button-ghost"
                      aria-label={`Renomear ${edital.title} (${index + 1})`}
                      onClick={(event) => {
                        openForm(event.currentTarget, () => setRenaming(edital.id));
                        setRenameDraft(edital.title);
                        setRenameBase(edital.localRevision);
                      }}
                    >
                      Renomear {edital.title}
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      aria-label={`Tornar principal ${edital.title} (${index + 1})`}
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void onSetPrimary(isPrimary(edital.id) ? null : edital.id).finally(() =>
                          setBusy(false),
                        );
                      }}
                    >
                      {isPrimary(edital.id) ? 'Remover principal' : 'Tornar principal'}
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      aria-label={`Abrir arquivamento de ${edital.title} (${index + 1})`}
                      disabled={busy}
                      onClick={(event) => {
                        openForm(event.currentTarget, () => setArchiving(edital.id));
                        setReplacement('none');
                      }}
                    >
                      Arquivar
                    </button>
                  </>
                )}
              </div>
              {archiving === edital.id ? (
                <form
                  className="rename-form archive-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const choice = isPrimary(edital.id)
                      ? replacement === 'none'
                        ? null
                        : replacement
                      : undefined;
                    setBusy(true);
                    void onArchive(edital, choice)
                      .then((ok) => {
                        if (ok) closeForm(() => setArchiving(null));
                      })
                      .finally(() => setBusy(false));
                  }}
                >
                  <label htmlFor={`archive-${edital.id}`}>
                    {isPrimary(edital.id)
                      ? 'Este edital é o principal: escolha o substituto'
                      : 'Confirmar arquivamento'}
                  </label>
                  {isPrimary(edital.id) ? (
                    <select
                      id={`archive-${edital.id}`}
                      value={replacement}
                      onChange={(event) => setReplacement(event.target.value)}
                    >
                      <option value="none">Ficar sem principal</option>
                      {active
                        .filter((item) => item.id !== edital.id)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                    </select>
                  ) : null}
                  <button type="submit" className="button-primary" disabled={busy}>
                    Confirmar arquivamento
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => closeForm(() => setArchiving(null))}
                  >
                    Cancelar
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <details className="archived-editais">
          <summary>Editais arquivados ({archived.length})</summary>
          <ul aria-label="Editais arquivados">
            {archived.map((edital) => (
              <li key={edital.id} className="edital-row">
                <button
                  type="button"
                  className="link-button"
                  aria-pressed={selectedId === edital.id}
                  onClick={() => onSelect(edital.id)}
                >
                  {edital.title}
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void onReactivate(edital.id).finally(() => setBusy(false));
                  }}
                >
                  Reativar {edital.title}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {selected ? (
        <form
          className="subject-form link-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!subjectToLink) return;
            void onLinkSubject(selected.id, subjectToLink);
            setSubjectToLink('');
          }}
        >
          <label htmlFor="link-subject">Vincular disciplina existente a {selected.title}</label>
          <div className="subject-form-row">
            <select
              id="link-subject"
              value={subjectToLink}
              onChange={(event) => setSubjectToLink(event.target.value)}
            >
              <option value="">Escolha uma disciplina</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="button-primary"
              disabled={!subjectToLink || locked}
            >
              Vincular
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
