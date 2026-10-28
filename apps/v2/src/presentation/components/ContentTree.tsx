import { useState } from 'react';
import type { EditalDiscipline } from '../../domain/edital';
import type { Assunto, Aula, LessonTopicLink } from '../../domain/content';
import { displayName } from '../../domain/edital';
import type { StudySubject } from '../../domain/subject';

type ContentTreeProps = {
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
};

export function ContentTree({
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
}: ContentTreeProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [parentChoices, setParentChoices] = useState<Record<string, string>>({});
  const [topicSelection, setTopicSelection] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  function renderAssunto(linkId: string, assunto: Assunto, depth: number): React.ReactNode {
    const children = assuntos.filter(
      (item) => item.editalDisciplineId === linkId && item.parentId === assunto.id,
    );
    const topics = lessonTopics.filter((item) => item.assuntoId === assunto.id);
    return (
      <li key={assunto.id} className="tree-node" data-depth={depth}>
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
        const selectedParent = parentChoices[link.id] ?? '';

        return (
          <section key={link.id} className="discipline" aria-label={`Disciplina ${label}`}>
            <header className="discipline-header">
              <h3>{label}</h3>
              <span className="badge">{roots.length} assunto(s)</span>
            </header>

            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const value = (drafts[draftKey] ?? '').trim();
                if (!value) return;
                setBusy(true);
                void onCreateAssunto(link, value, selectedParent || null)
                  .then((ok) => {
                    if (ok) setDrafts((current) => ({ ...current, [draftKey]: '' }));
                  })
                  .finally(() => setBusy(false));
              }}
            >
              <label htmlFor={`assunto-${link.id}`}>Novo assunto em {label}</label>
              <input
                id={`assunto-${link.id}`}
                value={drafts[draftKey] ?? ''}
                maxLength={120}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [draftKey]: event.target.value }))
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
                const value = (drafts[key] ?? '').trim();
                if (!value) return;
                setBusy(true);
                void onCreateAula(link, value)
                  .then((ok) => {
                    if (ok) setDrafts((current) => ({ ...current, [key]: '' }));
                  })
                  .finally(() => setBusy(false));
              }}
            >
              <label htmlFor={`aula-${link.id}`}>Nova aula em {label}</label>
              <input
                id={`aula-${link.id}`}
                value={drafts[`${link.id}:aula`] ?? ''}
                maxLength={120}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [`${link.id}:aula`]: event.target.value }))
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
                    <li key={aula.id}>
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
