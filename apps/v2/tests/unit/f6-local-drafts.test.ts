import { afterEach, describe, expect, it } from 'vitest';
import {
  clearLocalDraft,
  loadLocalDraft,
  localDraftKey,
  saveLocalDraft,
} from '../../src/presentation/local-drafts';

const KEY = localDraftKey('p1', 'subject-new');

afterEach(() => {
  clearLocalDraft(KEY);
  window.localStorage.clear();
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
});

