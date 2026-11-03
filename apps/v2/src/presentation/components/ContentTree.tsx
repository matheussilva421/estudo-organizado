import { useEffect, useState } from 'react';
import type { EditalDiscipline } from '../../domain/edital';
import type { Assunto, Aula, LessonTopicLink } from '../../domain/content';
import { displayName } from '../../domain/edital';
import type { StudySubject } from '../../domain/subject';
import { useDraftGuard } from '../draft-guard';
import {
  clearLocalDraft,
  loadLocalDraft,
  localDraftKey,
  saveLocalDraft,
} from '../local-drafts';

type ContentTreeProps = {
  profileId: string;
  links: EditalDiscipline[];
  assuntos: Assunto[];
  aulas: Aula[];
  lessonTopics: LessonTopicLink[];
  subjects: StudySubject[];
  onCreateAssunto: (
    link: EditalDiscipline,
    title: string,
    parentId: string | null,
  ) => Promise<boolean>;
  onCreateAula: (link: EditalDiscipline, title: string) => Promise<boolean>;
  onLinkTopic: (aula: Aula, assunto: Assunto) => Promise<boolean>;
  onUnlinkTopic: (link: LessonTopicLink) => Promise<boolean>;
  locked?: boolean;
  focusId?: string | null;
};

export function ContentTree({
  profileId,
  links,
  assuntos,
  aulas,
  lessonTopics,
  subjects,
  onCreateAssunto,
  onCreateAula,
  onLinkTopic,
  onUnlinkTopic,
  locked = false,
  focusId = null,
}: ContentTreeProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [parentChoices, setParentChoices] = useState<Record<string, string>>({});
  const [topicSelection, setTopicSelection] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  function localKeyFor(linkId: string, kind: 'assunto' | 'aula'): string {
    return localDraftKey(profileId, kind + '-new', linkId);
  }

  function draftValue(key: string, localKey: string): string {
    return drafts[key] ?? loadLocalDraft(localKey)?.value ?? '';
  }

  function changeTreeDraft(key: string, localKey: string, value: string): void {
    setDrafts((current) => ({ ...current, [key]: value }));
    if (value.trim()) {
      saveLocalDraft({
        key: localKey,
        profileId,
        entityId: localKey.split(':').pop() ?? null,
        baseRevision: null,
        value,
      });
    } else {
      clearLocalDraft(localKey);
    }
  }

  function clearTreeDraft(key: string, localKey: string): void {
    clearLocalDraft(localKey);
    setDrafts((current) => ({ ...current, [key]: '' }));
  }

  const persistedDirty = links.some((link) => {
    const assunto = loadLocalDraft(localKeyFor(link.id, 'assunto'));
    const aula = loadLocalDraft(localKeyFor(link.id, 'aula'));
    return Boolean(assunto?.value.trim() || aula?.value.trim());
  });
  const draftDirty =
    Object.values(drafts).some((value) => value.trim().length > 0) || persistedDirty;
  useDraftGuard('f2-content-tree', draftDirty, 'novo assunto ou aula');

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  useEffect(() => {
    if (!focusId) return;
    if (!/^[A-Za-z0-9._~-]{1,128}$/.test(focusId)) return;
    const element = document.querySelector('[data-entity-id="' + focusId + '"]');
    if (element) element.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [focusId, links, assuntos, aulas]);

  function renderAssunto(linkId: string, assunto: Assunto, depth: number): React.ReactNode {
    const children = assuntos.filter(
      (item) => item.editalDisciplineId === linkId && item.parentId === assunto.id,
    );
    const topics = lessonTopics.filter((item) => item.assuntoId === assunto.id);
    return (
      <li
        key={assunto.id}
        className={assunto.id === focusId ? 'tree-node tree-node-focused' : 'tree-node'}
        data-depth={depth}
        data-entity-id={assunto.id}
        data-focus={assunto.id === focusId ? 'true' : undefined}
      >
        <div className="tree-row">
          <span className="tree-title">{assunto.title}</span>
          <span className="tree-meta">{topics.length} aula(s)</span>
        </div>
        {children.length > 0 ? (
          <ul className="tree-children">
            {children.map((child) => renderAssunto(linkId, child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  }

  if (links.length === 0) {
    return (
      <p className="empty-state">
        Nenhuma disciplina vinculada a este edital ainda. Vincule uma disciplina acima.
      </p>
    );
  }

  return (
    <div className="content-tree">
      {links.map((link) => {
        const subject = subjectById.get(link.subjectId);
        const label = subject ? displayName(subject, link) : '(disciplina indisponível)';
        const roots = assuntos.filter(
          (item) => item.editalDisciplineId === link.id && item.parentId === null,
        );
        const linkAulas = aulas.filter((item) => item.editalDisciplineId === link.id);
        const draftKey = `${link.id}:assunto`;
        const draftLocalKey = localKeyFor(link.id, 'assunto');
        const assuntoDraft = draftValue(draftKey, draftLocalKey);
        const selectedParent = parentChoices[link.id] ?? '';

        return (
          <section
            key={link.id}
            className="discipline"
            aria-label={`Disciplina ${label}`}
            data-entity-id={link.id}
            data-focus={link.id === focusId ? 'true' : undefined}
          >
            <header className="discipline-header">
              <h3>{label}</h3>
              <span className="badge">{roots.length} assunto(s)</span>
            </header>

            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const value = assuntoDraft.trim();
                if (!value) return;
                setBusy(true);
                void onCreateAssunto(link, value, selectedParent || null)
                  .then((ok) => {
                    if (ok) clearTreeDraft(draftKey, draftLocalKey);
                  })
                  .finally(() => setBusy(false));
              }}
            >
              <label htmlFor={`assunto-${link.id}`}>Novo assunto em {label}</label>
              <input
                id={`assunto-${link.id}`}
                value={assuntoDraft}
                maxLength={120}
                onChange={(event) =>
                  changeTreeDraft(draftKey, draftLocalKey, event.target.value)
                }
              />
              <select
                aria-label={`Pai do novo assunto em ${label}`}
                value={selectedParent}
                onChange={(event) =>
                  setParentChoices((current) => ({ ...current, [link.id]: event.target.value }))
                }
              >
                <option value="">Raiz</option>
                {assuntos
                  .filter((item) => item.editalDisciplineId === link.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
              <button type="submit" className="button-primary" disabled={busy || locked}>
                Adicionar assunto
              </button>
            </form>

            {roots.length === 0 ? (
              <p className="empty-state">Sem assuntos nesta disciplina.</p>
            ) : (
              <ul className="tree" aria-label={`Árvore de ${label}`}>
                {roots.map((root) => renderAssunto(link.id, root, 0))}
              </ul>
            )}

            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const key = `${link.id}:aula`;
                const localKey = localKeyFor(link.id, 'aula');
                const value = draftValue(key, localKey).trim();
                if (!value) return;
                setBusy(true);
                void onCreateAula(link, value)
                  .then((ok) => {
                    if (ok) clearTreeDraft(key, localKey);
                  })
                  .finally(() => setBusy(false));
              }}
            >
              <label htmlFor={`aula-${link.id}`}>Nova aula em {label}</label>
              <input
                id={`aula-${link.id}`}
                value={draftValue(`${link.id}:aula`, localKeyFor(link.id, 'aula'))}
                maxLength={120}
                onChange={(event) =>
                  changeTreeDraft(
                    `${link.id}:aula`,
                    localKeyFor(link.id, 'aula'),
                    event.target.value,
                  )
                }
              />
              <button type="submit" className="button-primary" disabled={busy || locked}>
                Adicionar aula
              </button>
            </form>

            {linkAulas.length > 0 ? (
              <ul className="aula-list" aria-label={`Aulas de ${label}`}>
                {linkAulas.map((aula) => {
                  const linked = lessonTopics.filter((item) => item.aulaId === aula.id);
                  const available = assuntos.filter(
                    (item) =>
                      item.editalDisciplineId === link.id &&
                      !linked.some((topic) => topic.assuntoId === item.id),
                  );
                  return (
                    <li
                      key={aula.id}
                      data-entity-id={aula.id}
                      data-focus={aula.id === focusId ? 'true' : undefined}
                    >
                      <div className="aula-row">
                        <span>{aula.title}</span>
                        <span className="tree-meta">{linked.length} assunto(s) mapeado(s)</span>
                      </div>
                      <div className="aula-map">
                        <select
                          aria-label={`Assunto para ${aula.title}`}
                          value={topicSelection[aula.id] ?? ''}
                          onChange={(event) =>
                            setTopicSelection((current) => ({
                              ...current,
                              [aula.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Escolha um assunto</option>
                          {available.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="button-ghost"
                          disabled={!topicSelection[aula.id] || busy || locked}
                          onClick={() => {
                            const target = available.find(
                              (item) => item.id === topicSelection[aula.id],
                            );
                            if (!target) return;
                            setBusy(true);
                            void onLinkTopic(aula, target)
                              .then((ok) => {
                                if (ok) {
                                  setTopicSelection((current) => ({ ...current, [aula.id]: '' }));
                                }
                              })
                              .finally(() => setBusy(false));
                          }}
                        >
                          Mapear aula → assunto
                        </button>
                      </div>
                      {linked.length > 0 ? (
                        <ul className="topic-links">
                          {linked.map((topic) => {
                            const assunto = assuntos.find((item) => item.id === topic.assuntoId);
                            return (
                              <li key={topic.id}>
                                <span>{assunto?.title ?? topic.assuntoId}</span>
                                <button
                                  type="button"
                                  className="button-ghost"
                                  disabled={busy}
                                  onClick={() => {
                                    setBusy(true);
                                    void onUnlinkTopic(topic).finally(() => setBusy(false));
                                  }}
                                >
                                  Desfazer vínculo
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
