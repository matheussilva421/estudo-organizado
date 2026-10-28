import { useState } from 'react';
import type { Edital } from '../../domain/edital';
import type { StudySubject } from '../../domain/subject';

type EditalManagerProps = {
  editais: Edital[];
  primaryEditalId: string | null;
  subjects: StudySubject[];
  selectedId: string | null;
  onSelect: (editalId: string) => void;
  onCreate: (title: string) => Promise<void>;
  onRename: (edital: Edital, title: string) => Promise<void>;
  onArchive: (edital: Edital, replacementPrimaryId: string | null | undefined) => Promise<void>;
  onReactivate: (editalId: string) => Promise<void>;
  onSetPrimary: (editalId: string | null) => Promise<void>;
  onLinkSubject: (editalId: string, subjectId: string) => Promise<void>;
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
}: EditalManagerProps) {
  const [title, setTitle] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [archiving, setArchiving] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<string>('none');
  const [subjectToLink, setSubjectToLink] = useState('');

  const active = editais.filter((edital) => edital.status === 'ACTIVE');
  const archived = editais.filter((edital) => edital.status === 'ARCHIVED');
  const selected = editais.find((edital) => edital.id === selectedId) ?? null;
  const isPrimary = (editalId: string) => primaryEditalId === editalId;

  async function create(): Promise<void> {
    const normalized = title.trim();
    if (!normalized) return;
    await onCreate(normalized);
    setTitle('');
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
          <button type="submit" className="button-primary" disabled={!title.trim()}>
            Criar edital
          </button>
        </div>
      </form>

      <h3 className="group-title">Ativos</h3>
      {active.length === 0 ? (
        <p className="empty-state">Nenhum edital ativo. Crie o primeiro acima.</p>
      ) : (
        <ul className="edital-list" aria-label="Editais ativos">
          {active.map((edital) => (
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
                      void onRename(edital, next).then(() => setRenaming(null));
                    }}
                  >
                    <label htmlFor={`rename-edital-${edital.id}`}>Novo nome</label>
                    <input
                      id={`rename-edital-${edital.id}`}
                      value={renameDraft}
                      maxLength={120}
                      onChange={(event) => setRenameDraft(event.target.value)}
                    />
                    <button type="submit" className="button-primary">Salvar</button>
                    <button type="button" className="button-ghost" onClick={() => setRenaming(null)}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => {
                        setRenaming(edital.id);
                        setRenameDraft(edital.title);
                      }}
                    >
                      Renomear {edital.title}
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => void onSetPrimary(isPrimary(edital.id) ? null : edital.id)}
                    >
                      {isPrimary(edital.id) ? 'Remover principal' : 'Tornar principal'}
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => setArchiving(edital.id)}
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
                    void onArchive(edital, choice).then(() => setArchiving(null));
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
                  <button type="submit" className="button-primary">
                    Arquivar edital
                  </button>
                  <button type="button" className="button-ghost" onClick={() => setArchiving(null)}>
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
                  onClick={() => void onReactivate(edital.id)}
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
            <button type="submit" className="button-primary" disabled={!subjectToLink}>
              Vincular
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
