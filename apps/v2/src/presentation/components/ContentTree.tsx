import { useEffect, useRef, useState } from 'react';
import type { EditalDiscipline } from '../../domain/edital';
import type { Assunto, Aula, LessonTopicLink } from '../../domain/content';
import { sortByOrder } from '../../domain/content';
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
  onReorderAssunto: (assunto: Assunto, orderKey: string) => Promise<boolean>;
  onMoveAssunto: (assunto: Assunto, parentId: string | null) => Promise<boolean>;
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
  onReorderAssunto,
  onMoveAssunto,
  locked = false,
  focusId = null,
}: ContentTreeProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [parentChoices, setParentChoices] = useState<Record<string, string>>({});
  const [topicSelection, setTopicSelection] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [rootLimits, setRootLimits] = useState<Record<string, number>>({});
  const [childLimits, setChildLimits] = useState<Record<string, number>>({});
  const [draftSaveFailed, setDraftSaveFailed] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [draggedAssunto, setDraggedAssunto] = useState<string | null>(null);
  const [moveSource, setMoveSource] = useState<Record<string, string>>({});
  const [moveParent, setMoveParent] = useState<Record<string, string>>({});
  const [inspector, setInspector] = useState<{ kind: 'assunto' | 'aula'; id: string } | null>(
    null,
  );
  const inspectorHeading = useRef<HTMLHeadingElement | null>(null);
  const inspectorTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (inspector) inspectorHeading.current?.focus();
  }, [inspector]);

  function openInspector(
    kind: 'assunto' | 'aula',
    id: string,
    trigger: HTMLElement,
  ): void {
    inspectorTrigger.current = trigger;
    setInspector({ kind, id });
  }

  function closeInspector(): void {
    setInspector(null);
    requestAnimationFrame(() => inspectorTrigger.current?.focus());
  }
  function localKeyFor(linkId: string, kind: 'assunto' | 'aula'): string {
    return localDraftKey(profileId, kind + '-new', linkId);
  }

  function draftValue(key: string, localKey: string): string {
    return drafts[key] ?? loadLocalDraft(localKey)?.value ?? '';
  }

  function changeTreeDraft(key: string, localKey: string, value: string): void {
    setDrafts((current) => ({ ...current, [key]: value }));
    if (value.trim()) {
      const saved = saveLocalDraft({
        key: localKey,
        profileId,
        entityId: localKey.split(':').pop() ?? null,
        baseRevision: null,
        value,
      });
      setDraftSaveFailed(!saved);
    } else {
      clearLocalDraft(localKey);
      setDraftSaveFailed(false);
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

  function orderedSiblings(linkId: string, parentId: string | null): Assunto[] {
    return sortByOrder(
      assuntos.filter(
        (item) =>
          item.editalDisciplineId === linkId && (item.parentId ?? null) === parentId,
      ),
    );
  }

  function keyBefore(siblings: Assunto[], index: number): string | null {
    const before = index > 0 ? Number.parseInt(siblings[index - 1]!.orderKey, 10) : 0;
    const after =
      index < siblings.length
        ? Number.parseInt(siblings[index]!.orderKey, 10)
        : before + 20;
    const lower = Number.isFinite(before) ? before : 0;
    const upper = Number.isFinite(after) ? after : lower + 20;
    if (upper - lower <= 1) return null;
    return String(Math.floor((lower + upper) / 2)).padStart(6, '0');
  }

  async function moveSibling(assunto: Assunto, direction: -1 | 1): Promise<void> {
    const siblings = orderedSiblings(assunto.editalDisciplineId, assunto.parentId ?? null);
    const currentIndex = siblings.findIndex((item) => item.id === assunto.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex]!,
      reordered[currentIndex]!,
    ];
    const insertAt = reordered.findIndex((item) => item.id === assunto.id);
    const orderKey = keyBefore(reordered.filter((item) => item.id !== assunto.id), insertAt);
    if (!orderKey) {
      setOrderError('Não há espaço de ordem entre estes itens. Nenhuma alteração foi gravada.');
      return;
    }
    setBusy(true);
    try {
      const ok = await onReorderAssunto(assunto, orderKey);
      setOrderError(ok ? null : 'A reordenação falhou; a árvore permanece como estava.');
    } finally {
      setBusy(false);
    }
  }

  async function dropBefore(target: Assunto): Promise<void> {
    setDraggedAssunto(null);
    if (!draggedAssunto || draggedAssunto === target.id) return;
    const dragged = assuntos.find((item) => item.id === draggedAssunto);
    if (!dragged || dragged.editalDisciplineId !== target.editalDisciplineId) return;
    if ((dragged.parentId ?? null) !== (target.parentId ?? null)) {
      setOrderError('Arraste entre assuntos do mesmo nível. Para mudar de pai, use “Mover de hierarquia”.');
      return;
    }
    const siblings = orderedSiblings(target.editalDisciplineId, target.parentId ?? null).filter(
      (item) => item.id !== dragged.id,
    );
    const insertAt = siblings.findIndex((item) => item.id === target.id);
    const orderKey = keyBefore(siblings, insertAt);
    if (!orderKey) {
      setOrderError('Não há espaço de ordem para soltar neste ponto.');
      return;
    }
    setBusy(true);
    try {
      const ok = await onReorderAssunto(dragged, orderKey);
      setOrderError(ok ? null : 'A reordenação falhou; a árvore permanece como estava.');
    } finally {
      setBusy(false);
    }
  }

  function descendantIdsOf(assuntoId: string): Set<string> {
    const result = new Set<string>();
    const pending = [assuntoId];
    while (pending.length > 0) {
      const current = pending.pop()!;
      for (const child of assuntos.filter((item) => item.parentId === current)) {
        if (result.has(child.id)) continue;
        result.add(child.id);
        pending.push(child.id);
      }
    }
    return result;
  }

  useEffect(() => {
    if (!focusId) return;
    if (!/^[A-Za-z0-9._~-]{1,128}$/.test(focusId)) return;
    const element = document.querySelector<HTMLElement>('[data-entity-id="' + focusId + '"]');
    if (element) {
      element.tabIndex = -1;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }, [focusId, links, assuntos, aulas]);

  function renderAssunto(linkId: string, assunto: Assunto, depth: number): React.ReactNode {
    const siblings = orderedSiblings(linkId, assunto.parentId ?? null);
    const siblingIndex = siblings.findIndex((item) => item.id === assunto.id);
    const children = assuntos.filter(
      (item) => item.editalDisciplineId === linkId && item.parentId === assunto.id,
    );
    const childLimit = childLimits[assunto.id] ?? 50;
    const visibleChildren = children.slice(0, childLimit);
    const topics = lessonTopics.filter((item) => item.assuntoId === assunto.id);
    return (
      <li
        key={assunto.id}
        className={assunto.id === focusId ? 'tree-node tree-node-focused' : 'tree-node'}
        data-depth={depth}
        data-entity-id={assunto.id}
        data-focus={assunto.id === focusId ? 'true' : undefined}
        data-selected={inspector?.kind === 'assunto' && inspector.id === assunto.id ? 'true' : undefined}
        draggable={!locked}
        onDragStart={(event) => {
          setDraggedAssunto(assunto.id);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', assunto.id);
        }}
        onDragOver={(event) => {
          if (draggedAssunto) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void dropBefore(assunto);
        }}
      >
        <div className="tree-row">
          <span className="tree-title">{assunto.title}</span>
          <span className="tree-meta">{topics.length} aula(s)</span>
          <span className="tree-actions">
            <button
              type="button"
              className="button-ghost"
              aria-label={`Ver detalhes de ${assunto.title}`}
              onClick={(event) => openInspector('assunto', assunto.id, event.currentTarget)}
            >
              Detalhes
            </button>
            <button
              type="button"
              className="button-ghost"
              aria-label={`Mover ${assunto.title} para cima`}
              disabled={locked || busy || siblingIndex <= 0}
              onClick={() => void moveSibling(assunto, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="button-ghost"
              aria-label={`Mover ${assunto.title} para baixo`}
              disabled={locked || busy || siblingIndex < 0 || siblingIndex >= siblings.length - 1}
              onClick={() => void moveSibling(assunto, 1)}
            >
              ↓
            </button>
          </span>
        </div>
        {children.length > 0 ? (
          <ul className="tree-children">
            {visibleChildren.map((child) => renderAssunto(linkId, child, depth + 1))}
            {children.length > childLimit ? (
              <li className="tree-more">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() =>
                    setChildLimits((current) => ({
                      ...current,
                      [assunto.id]: childLimit + 50,
                    }))
                  }
                >
                  Mostrar mais {children.length - childLimit} assunto(s) em {assunto.title}
                </button>
              </li>
            ) : null}
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

  const inspectedAssunto =
    inspector?.kind === 'assunto'
      ? assuntos.find((item) => item.id === inspector.id) ?? null
      : null;
  const inspectedAula =
    inspector?.kind === 'aula'
      ? aulas.find((item) => item.id === inspector.id) ?? null
      : null;
  const inspectedLink =
    links.find(
      (item) =>
        item.id ===
        (inspectedAssunto?.editalDisciplineId ?? inspectedAula?.editalDisciplineId),
    ) ?? null;
  const inspectedSubject = inspectedLink
    ? subjects.find((item) => item.id === inspectedLink.subjectId) ?? null
    : null;
  const inspectedParent =
    inspectedAssunto?.parentId
      ? assuntos.find((item) => item.id === inspectedAssunto.parentId) ?? null
      : null;
  const inspectorOpen = Boolean(inspectedAssunto || inspectedAula);
  const inspectorId = inspectedAssunto?.id ?? inspectedAula?.id ?? '';
  const inspectorChildren = inspectedAssunto
    ? assuntos.filter((item) => item.parentId === inspectedAssunto.id).length
    : 0;
  const inspectorTopics = lessonTopics.filter((item) =>
    inspectedAssunto ? item.assuntoId === inspectedAssunto.id : item.aulaId === inspectedAula?.id,
  ).length;

  return (
    <div className="content-tree">
      {draftSaveFailed ? (
        <p className="hint" role="status" data-testid="f6-draft-save-failed">
          Não foi possível preservar este rascunho da árvore. O texto continua nesta aba; não
          navegue antes de adicionar ou copiar.
        </p>
      ) : null}
      {orderError ? (
        <p className="inline-notice" role="alert" data-testid="f7-order-error">{orderError}</p>
      ) : null}
      {inspectorOpen ? (
        <aside
          className="content-inspector"
          aria-labelledby="content-inspector-title"
          data-testid="content-inspector"
        >
          <header>
            <div>
              <p className="eyebrow">Inspetor de conteúdo</p>
              <h3 id="content-inspector-title" ref={inspectorHeading} tabIndex={-1}>
                {inspectedAssunto?.title ?? inspectedAula?.title}
              </h3>
            </div>
            <button type="button" onClick={closeInspector} aria-label="Fechar detalhes">
              Fechar
            </button>
          </header>
          <dl>
            <div>
              <dt>Tipo</dt>
              <dd>{inspectedAssunto ? 'Assunto' : 'Aula'}</dd>
            </div>
            <div>
              <dt>Identidade</dt>
              <dd>
                <code>{inspectorId}</code>
              </dd>
            </div>
            <div>
              <dt>Disciplina</dt>
              <dd>
                {inspectedSubject?.title ??
                  inspectedLink?.displayAlias ??
                  inspectedLink?.id ??
                  'não vinculada'}
              </dd>
            </div>
            {inspectedAssunto ? (
              <div>
                <dt>Assunto pai</dt>
                <dd>{inspectedParent?.title ?? 'Raiz'}</dd>
              </div>
            ) : null}
            <div>
              <dt>Estrutura</dt>
              <dd>
                {inspectedAssunto
                  ? `${inspectorChildren} subassunto(s) · ${inspectorTopics} aula(s) mapeada(s)`
                  : `${inspectorTopics} assunto(s) mapeado(s)`}
              </dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                {locked ? 'somente leitura' : 'editável'} · ordem{' '}
                {inspectedAssunto?.orderKey || inspectedAula?.orderKey || 'não definida'}
              </dd>
            </div>
          </dl>
          <div className="session-actions">
            <button
              type="button"
              onClick={() => {
                [...document.querySelectorAll('[data-entity-id]')]
                  .find((element) => element.getAttribute('data-entity-id') === inspectorId)
                  ?.scrollIntoView({ block: 'center', behavior: 'auto' });
              }}
            >
              Destacar na árvore
            </button>
          </div>
        </aside>
      ) : null}
      {links.map((link) => {
        const subject = subjectById.get(link.subjectId);
        const label = subject ? displayName(subject, link) : '(disciplina indisponível)';
        const roots = assuntos.filter(
          (item) => item.editalDisciplineId === link.id && item.parentId === null,
        );
        const rootLimit = rootLimits[link.id] ?? 50;
        const visibleRoots = roots.slice(0, rootLimit);
        const linkAulas = aulas.filter((item) => item.editalDisciplineId === link.id);
        const draftKey = `${link.id}:assunto`;
        const draftLocalKey = localKeyFor(link.id, 'assunto');
        const assuntoDraft = draftValue(draftKey, draftLocalKey);
        const selectedParent = parentChoices[link.id] ?? '';
        const selectedMoveSource = moveSource[link.id] ?? '';
        const moveSourceEntity = assuntos.find((item) => item.id === selectedMoveSource);
        const selectedMoveParent = moveParent[link.id] ?? '';
        const targetMoveParent = selectedMoveParent || null;
        const moveIsNoop = (moveSourceEntity?.parentId ?? null) === targetMoveParent;
        const blockedParents = moveSourceEntity ? descendantIdsOf(moveSourceEntity.id) : new Set<string>();
        const availableMoveParents = sortByOrder(
          assuntos.filter(
            (item) =>
              item.editalDisciplineId === link.id &&
              item.id !== selectedMoveSource &&
              !blockedParents.has(item.id),
          ),
        );

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
                {visibleRoots.map((root) => renderAssunto(link.id, root, 0))}
                {roots.length > rootLimit ? (
                  <li className="tree-more">
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() =>
                        setRootLimits((current) => ({
                          ...current,
                          [link.id]: rootLimit + 50,
                        }))
                      }
                    >
                      Mostrar mais {roots.length - rootLimit} assunto(s) em {label}
                    </button>
                  </li>
                ) : null}
              </ul>
            )}

            <details className="inline-move-hierarchy">
              <summary>Mover de hierarquia</summary>
              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!moveSourceEntity || moveIsNoop) return;
                  setBusy(true);
                  void onMoveAssunto(moveSourceEntity, targetMoveParent)
                    .then((ok) => {
                      if (ok) {
                        setMoveSource((current) => ({ ...current, [link.id]: '' }));
                        setMoveParent((current) => ({ ...current, [link.id]: '' }));
                        setOrderError(null);
                      } else {
                        setOrderError('Não foi possível mover; a hierarquia atual foi preservada.');
                      }
                    })
                    .finally(() => setBusy(false));
                }}
              >
                <label htmlFor={`move-source-${link.id}`}>Assunto a mover</label>
                <select
                  id={`move-source-${link.id}`}
                  value={selectedMoveSource}
                  onChange={(event) =>
                    setMoveSource((current) => ({ ...current, [link.id]: event.target.value }))
                  }
                >
                  <option value="">Escolha um assunto</option>
                  {sortByOrder(assuntos.filter((item) => item.editalDisciplineId === link.id)).map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
                <label htmlFor={`move-parent-${link.id}`}>Novo pai</label>
                <select
                  id={`move-parent-${link.id}`}
                  value={selectedMoveParent}
                  onChange={(event) =>
                    setMoveParent((current) => ({ ...current, [link.id]: event.target.value }))
                  }
                >
                  <option value="">Raiz</option>
                  {availableMoveParents.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
                <button type="submit" className="button-ghost" disabled={locked || busy || !moveSourceEntity || moveIsNoop}>
                  Mover assunto
                </button>
              </form>
            </details>

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
                      data-selected={
                        inspector?.kind === 'aula' && inspector.id === aula.id
                          ? 'true'
                          : undefined
                      }
                    >
                      <div className="aula-row">
                        <span>{aula.title}</span>
                        <span className="tree-meta">{linked.length} assunto(s) mapeado(s)</span>
                        <button
                          type="button"
                          className="button-ghost"
                          aria-label={`Ver detalhes da aula ${aula.title}`}
                          onClick={(event) => openInspector('aula', aula.id, event.currentTarget)}
                        >
                          Detalhes
                        </button>
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
