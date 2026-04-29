import { describe, expect, it } from 'vitest';

const model = await import('../../src/js/sync/entity-conflict-model.js?v=8.29');

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
});
