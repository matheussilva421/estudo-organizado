import { useEffect } from 'react';

/**
 * Small, component-agnostic registry for unsaved academic edits. It is not a
 * second draft store: components keep owning their text. The registry only
 * lets the shell ask for an explicit decision before leaving a form.
 */
export type DirtyDraft = {
  id: string;
  label: string;
};

const drafts = new Map<string, DirtyDraft>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function setDraftDirty(id: string, dirty: boolean, label = 'edição'): void {
  const changed = dirty ? !drafts.has(id) : drafts.has(id);
  if (dirty) drafts.set(id, { id, label });
  else drafts.delete(id);
  if (changed) notify();
}

export function clearDraftGuards(): void {
  if (drafts.size === 0) return;
  drafts.clear();
  notify();
}

export function listDirtyDrafts(): DirtyDraft[] {
  return [...drafts.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function hasDirtyDrafts(): boolean {
  return drafts.size > 0;
}

export function subscribeDraftGuards(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Keeps beforeunload as a supplement; it never replaces in-app guards. */
export function installBeforeUnloadGuard(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: BeforeUnloadEvent) => {
    if (drafts.size === 0) return;
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}

/**
 * A confirmation is an explicit continue/discard decision. Dismissing keeps
 * the current area and the component state; accepting navigates. The text is
 * never silently cleared by this module.
 */
export function confirmNavigationIntent(destination: string): boolean {
  if (drafts.size === 0) return true;
  const labels = listDirtyDrafts()
    .map((draft) => draft.label)
    .join(', ');
  const target = destination.trim() || 'outra área';
  return window.confirm(
    'Há edição não confirmada (' +
      labels +
      '). Sair para ' +
      target +
      '? O texto continua nesta aba; recarregar ou fechar pode descartá-lo.',
  );
}

export function useDraftGuard(id: string, dirty: boolean, label: string): void {
  useEffect(() => {
    setDraftDirty(id, dirty, label);
    return () => setDraftDirty(id, false);
  }, [id, dirty, label]);
}

