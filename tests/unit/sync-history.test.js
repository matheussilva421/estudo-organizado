import { describe, expect, it } from 'vitest';
import { summarizeSyncConflict } from '../../src/js/sync/sync-history.js';

function plan(overrides = {}) {
  return {
    ativo: true,
    tipo: 'reta_final',
    schemaVersionRetaFinal: 2,
    planId: 'rfplan_local',
    revision: 0,
    retaFinal: {
      dataFinal: '2027-02-28',
      blocos: Array.from({ length: 180 }, (_, index) => ({
        id: 'rf_' + String(index).padStart(3, '0'),
        discId: 'd' + (index % 3),
        topicos: [{ assId: 'a' + (index % 5), aulaId: null }],
        minutos: 60,
        dataPlanejada: '2026-10-26',
        ordem: index,
        notas: 'n'.repeat(80),
      })),
    },
    ...overrides,
  };
}

function hugeConflict() {
  const localPlan = plan();
  const remotePlan = plan({ planId: undefined, schemaVersionRetaFinal: undefined });
  return {
    type: 'reta-final-conflict',
    cause: 'merge-review',
    detectedAt: '2026-10-26T20:00:00.000Z',
    planId: 'rfplan_local',
    baseRevision: 1,
    localRevision: 2,
    remoteRevision: 3,
    remoteUpdatedAt: '2026-10-26T19:00:00.000Z',
    localDigest: 'a'.repeat(32),
    remoteDigest: 'b'.repeat(32),
    remoteSnapshotRevision: 2,
    localPlan,
    remotePlan,
    basePlan: localPlan,
    proposedPlan: localPlan,
    mergeConflicts: Array.from({ length: 50 }, (_, index) => ({
      blockId: 'rf_' + index,
      fieldPath: 'minutos',
      local: localPlan,
      remote: remotePlan,
      base: localPlan,
    })),
    items: Array.from({ length: 10 }, () => ({ localPlan, remotePlan })),
    mergeValid: false,
    reason: 'r'.repeat(5000),
    error: 'e'.repeat(5000),
  };
}

describe('sync-history summarization', () => {
  it('drops full plans and keeps only a bounded operational summary', () => {
    const conflict = hugeConflict();
    const summary = summarizeSyncConflict(conflict);

    expect(summary).toMatchObject({
      type: 'reta-final-conflict',
      cause: 'merge-review',
      planId: 'rfplan_local',
      baseRevision: 1,
      localRevision: 2,
      remoteRevision: 3,
      remoteSnapshotRevision: 2,
      localDigest: 'a'.repeat(32),
      remoteDigest: 'b'.repeat(32),
      mergeConflictCount: 50,
      itemCount: 10,
      hasLocalPlan: true,
      hasRemotePlan: true,
      hasBasePlan: true,
      hasProposedPlan: true,
    });
    expect(summary).not.toHaveProperty('localPlan');
    expect(summary).not.toHaveProperty('remotePlan');
    expect(summary).not.toHaveProperty('basePlan');
    expect(summary).not.toHaveProperty('proposedPlan');
    expect(summary).not.toHaveProperty('mergeConflicts');
    expect(summary).not.toHaveProperty('items');
    expect(summary.reason.length).toBeLessThanOrEqual(241);
    expect(summary.error.length).toBeLessThanOrEqual(241);
    expect(JSON.stringify(summary).length).toBeLessThan(2500);
  });

  it('preserves unknown small fields only through their explicit summary shape', () => {
    const summary = summarizeSyncConflict({
      type: 'firestore-conflict',
      cause: 'pending-outbox',
      arbitrary: { huge: 'x'.repeat(10000) },
    });
    expect(summary.type).toBe('firestore-conflict');
    expect(summary.cause).toBe('pending-outbox');
    expect(summary).not.toHaveProperty('arbitrary');
  });

  it('returns null for non-object inputs and never mutates the conflict', () => {
    expect(summarizeSyncConflict(null)).toBeNull();
    expect(summarizeSyncConflict('conflict')).toBeNull();
    const conflict = hugeConflict();
    const localPlan = conflict.localPlan;
    summarizeSyncConflict(conflict);
    expect(conflict.localPlan).toBe(localPlan);
  });
});
