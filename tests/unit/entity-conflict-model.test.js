import { describe, expect, it } from 'vitest';

const model = await import('../../src/js/sync/entity-conflict-model.js?v=8.32');

describe('entity-conflict-model.js', () => {
  it('classifies conflicts with safe and manual decisions', () => {
    const result = model.buildEntityConflictReviewModel([
      { collection: 'eventos', id: 'ev_1', localRevision: 2, remoteRevision: 1 },
      { collection: 'editais', id: 'ed_1', localRevision: null, remoteRevision: null }
    ]);

    expect(result.total).toBe(2);
    expect(result.items[0]).toMatchObject({ decisionHint: 'local-newer' });
    expect(result.items[1]).toMatchObject({ decisionHint: 'manual' });
    expect(result.requiresManualReview).toBe(true);
  });

  it('returns empty model for empty input', () => {
    const result = model.buildEntityConflictReviewModel([]);
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.requiresManualReview).toBe(false);
  });

  it('detects remote-newer conflicts', () => {
    const result = model.buildEntityConflictReviewModel([
      { collection: 'eventos', id: 'ev_1', localRevision: 1, remoteRevision: 3 }
    ]);
    expect(result.items[0].decisionHint).toBe('remote-newer');
    expect(result.requiresManualReview).toBe(false);
  });

  it('marks equal revisions as manual', () => {
    const result = model.buildEntityConflictReviewModel([
      { collection: 'eventos', id: 'ev_1', localRevision: 2, remoteRevision: 2 }
    ]);
    expect(result.items[0].decisionHint).toBe('manual');
    expect(result.requiresManualReview).toBe(true);
  });

  it('preserves original item properties', () => {
    const result = model.buildEntityConflictReviewModel([
      { collection: 'eventos', id: 'ev_1', localRevision: 2, remoteRevision: 1, custom: 'value' }
    ]);
    expect(result.items[0].custom).toBe('value');
    expect(result.items[0].collection).toBe('eventos');
  });

  it('uses hint from entity-state-builder when available', () => {
    const result = model.buildEntityConflictReviewModel([
      { collection: 'eventos', id: 'ev_1', localRevision: 3, remoteRevision: 3, hint: 'same-revision-different-checksum' },
    ]);
    expect(result.items[0].decisionHint).toBe('manual');
    expect(result.requiresManualReview).toBe(true);
  });

  it('classifies remote-delete hint as remote-newer', () => {
    const result = model.buildEntityConflictReviewModel([
      { collection: 'eventos', id: 'ev_1', localRevision: 1, remoteRevision: 5, hint: 'remote-delete' },
    ]);
    expect(result.items[0].decisionHint).toBe('remote-newer');
  });

  it('classifies both-changed hint as manual', () => {
    const result = model.buildEntityConflictReviewModel([
      { collection: 'eventos', id: 'ev_1', localRevision: 5, remoteRevision: 5, hint: 'both-changed' },
    ]);
    expect(result.items[0].decisionHint).toBe('manual');
    expect(result.requiresManualReview).toBe(true);
  });

  it('classifies local-newer hint correctly', () => {
    const result = model.buildEntityConflictReviewModel([
      { collection: 'eventos', id: 'ev_1', localRevision: 5, remoteRevision: 3, hint: 'local-newer' },
    ]);
    expect(result.items[0].decisionHint).toBe('local-newer');
  });

  it('falls back to revision comparison when hint is absent', () => {
    const result = model.buildEntityConflictReviewModel([
      { collection: 'eventos', id: 'ev_1', localRevision: 5, remoteRevision: 3 },
    ]);
    expect(result.items[0].decisionHint).toBe('local-newer');
  });
});
