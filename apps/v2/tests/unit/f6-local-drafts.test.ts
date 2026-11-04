import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearEntityDraft,
  clearLocalDraft,
  draftIsStale,
  findLocalDraft,
  loadLocalDraft,
  localDraftKey,
  saveLocalDraft,
} from '../../src/presentation/local-drafts';

const KEY = localDraftKey('p1', 'subject-new');

afterEach(() => {
  clearLocalDraft(KEY);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('f6 local drafts', () => {
  it('round-trips a profile-scoped non-authoritative draft', () => {
    expect(loadLocalDraft(KEY)).toBeNull();
    expect(
      saveLocalDraft({
        key: KEY,
        profileId: 'p1',
        entityId: null,
        baseRevision: null,
        value: 'Rascunho',
      }),
    ).toBe(true);
    const draft = loadLocalDraft(KEY);
    expect(draft?.profileId).toBe('p1');
    expect(draft?.value).toBe('Rascunho');
    expect(draft?.savedAt).toBeTruthy();
  });

  it('clears only the requested draft', () => {
    const other = localDraftKey('p1', 'edital-new');
    saveLocalDraft({ key: KEY, profileId: 'p1', entityId: null, baseRevision: null, value: 'A' });
    saveLocalDraft({ key: other, profileId: 'p1', entityId: null, baseRevision: null, value: 'B' });
    clearLocalDraft(KEY);
    expect(loadLocalDraft(KEY)).toBeNull();
    expect(loadLocalDraft(other)?.value).toBe('B');
  });

  it('rejects malformed or mismatched records instead of restoring them', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ key: 'other', profileId: 'p1', value: 'x' }));
    expect(loadLocalDraft(KEY)).toBeNull();
    window.localStorage.setItem(KEY, 'not-json');
    expect(loadLocalDraft(KEY)).toBeNull();
  });

  it('flags a draft written against an older entity revision', () => {
    const draft = {
      key: KEY,
      profileId: 'p1',
      entityId: 'edital-1',
      baseRevision: 2,
      value: 'Texto antigo',
      savedAt: '2026-11-04T00:00:00.000Z',
    };
    expect(draftIsStale(draft, 2)).toBe(false);
    expect(draftIsStale(draft, 3)).toBe(true);
    expect(draftIsStale(null, 3)).toBe(false);
    expect(draftIsStale({ ...draft, baseRevision: null }, 3)).toBe(false);
  });

  it('reports storage failure instead of claiming the draft was preserved', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(
      saveLocalDraft({
        key: KEY,
        profileId: 'p1',
        entityId: null,
        baseRevision: null,
        value: 'Não cabe no armazenamento',
      }),
    ).toBe(false);
    spy.mockRestore();
  });

  it('keeps per-tab entity drafts and recovers the remaining one after another tab commits', () => {
    const base = localDraftKey('p1', 'edital-rename', 'e1');
    const keyA = base + ':w:tab-a';
    saveLocalDraft({
      key: keyA,
      profileId: 'p1',
      entityId: 'e1',
      baseRevision: 1,
      value: 'Texto da aba A',
    });

    const keyB = base + ':w:tab-b';
    saveLocalDraft({
      key: keyB,
      profileId: 'p1',
      entityId: 'e1',
      baseRevision: 1,
      value: 'Texto da aba B',
    });
    clearLocalDraft(keyB);

    const recovered = findLocalDraft('p1', 'edital-rename', 'e1');
    expect(recovered?.value).toBe('Texto da aba A');
    expect(recovered?.baseRevision).toBe(1);
    // The committing tab clears its own key; the source key is cleared only
    // when that draft is explicitly resolved.
    clearEntityDraft('p1', 'edital-rename', 'e1', keyA);
    expect(findLocalDraft('p1', 'edital-rename', 'e1')).toBeNull();
  });

  it('recovers a legacy shared entity draft without keeping it after a commit', () => {
    const legacyKey = localDraftKey('p1', 'edital-rename', 'e1');
    saveLocalDraft({
      key: legacyKey,
      profileId: 'p1',
      entityId: 'e1',
      baseRevision: 1,
      value: 'Rascunho legado',
    });
    expect(findLocalDraft('p1', 'edital-rename', 'e1')?.value).toBe('Rascunho legado');
    clearEntityDraft('p1', 'edital-rename', 'e1');
    expect(findLocalDraft('p1', 'edital-rename', 'e1')).toBeNull();
  });
});

