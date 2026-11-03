import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearDraftGuards,
  confirmNavigationIntent,
  hasDirtyDrafts,
  installBeforeUnloadGuard,
  listDirtyDrafts,
  setDraftDirty,
  subscribeDraftGuards,
} from '../../src/presentation/draft-guard';

afterEach(() => {
  clearDraftGuards();
  vi.restoreAllMocks();
});

describe('f6 draft guard', () => {
  it('tracks only dirty drafts and sorts by stable id', () => {
    expect(hasDirtyDrafts()).toBe(false);
    setDraftDirty('b', true, 'assunto');
    setDraftDirty('a', true, 'disciplina');
    expect(hasDirtyDrafts()).toBe(true);
    expect(listDirtyDrafts().map((draft) => draft.id)).toEqual(['a', 'b']);
    setDraftDirty('a', false);
    expect(listDirtyDrafts().map((draft) => draft.id)).toEqual(['b']);
  });

  it('asks for an explicit decision and reports the destination', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(confirmNavigationIntent('Planejamento')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();

    setDraftDirty('subject', true, 'nova disciplina');
    expect(confirmNavigationIntent('Planejamento')).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('nova disciplina'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Planejamento'));

    confirm.mockReturnValue(true);
    expect(confirmNavigationIntent('Sessões')).toBe(true);
    expect(listDirtyDrafts()).toHaveLength(1);
  });

  it('notifies subscribers only when the dirty set changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDraftGuards(listener);
    setDraftDirty('subject', true, 'disciplina');
    setDraftDirty('subject', true, 'disciplina');
    expect(listener).toHaveBeenCalledTimes(1);
    setDraftDirty('subject', false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setDraftDirty('subject', true, 'disciplina');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('marks beforeunload as prevented while a draft exists and cleans up', () => {
    const cleanup = installBeforeUnloadGuard();
    const emptyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(emptyEvent);
    expect(emptyEvent.defaultPrevented).toBe(false);

    setDraftDirty('subject', true, 'disciplina');
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    cleanup();
    const afterCleanup = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterCleanup);
    expect(afterCleanup.defaultPrevented).toBe(false);
  });
});

