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
});
