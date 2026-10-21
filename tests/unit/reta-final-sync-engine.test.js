import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRetaFinalSyncDescriptor,
  computeRetaFinalPlanDigest,
  getRetaFinalSyncCapabilities,
} from '../../src/js/sync/reta-final-protocol.js';

const CAPABILITIES = getRetaFinalSyncCapabilities({});

function makePlan({
  revision = 2,
  minutos = 30,
  updatedAt = '2026-10-20T12:00:00.000Z',
  planId = 'plan-1',
  ativo = true,
} = {}) {
  return {
    ativo,
    tipo: 'reta_final',
    schemaVersionRetaFinal: 2,
    planId,
    generation: 1,
    revision,
    updatedAt,
    retaFinal: {
      dataFinal: '2026-12-20',
      blocos: [
        {
          id: 'b1',
          discId: 'd1',
          topicos: [{ assId: 'a1' }],
          minutos,
          ordem: 0,
          dataPlanejada: '2026-10-22',
          data: '2026-10-22',
        },
      ],
    },
  };
}

function envelopeFor(plan, descriptorOverrides = {}) {
  const descriptor = buildRetaFinalSyncDescriptor({
    plan,
    baseRevision: descriptorOverrides.baseRevision ?? Math.max(0, plan.revision - 1),
    baseRemoteUpdatedAt: '2026-10-20T11:00:00.000Z',
    deviceId: 'web-device1',
    capabilities: CAPABILITIES,
    ...descriptorOverrides,
  });
  return {
    version: 1,
    schemaVersion: 6,
    deviceId: 'web-device1',
    payloadUpdatedAt: plan.updatedAt,
    sentAt: plan.updatedAt,
    payload: { planejamento: plan, config: {}, eventos: [] },
    retaFinalSync: descriptor,
  };
}

describe('reta-final sync engine integration', () => {
  let storeModule;
  let outbox;
  let repository;
  let syncCenter;
  let engine;
  let order;

  function setup({
    plan = makePlan(),
    basePlan = null,
    remote = null,
    guard = { verified: true },
    write = async () => ({ updatedAt: '2026-10-20T12:30:00.000Z' }),
  } = {}) {
    order = [];
    let pendingEnvelope = null;
    const state = {
      config: {
        firestoreSync: {
          enabled: true,
          mode: 'primary',
          uid: 'uid-1',
          basePlan,
          baseDigest: basePlan ? computeRetaFinalPlanDigest(basePlan) : null,
          baseRevision: basePlan?.revision ?? null,
        },
      },
      planejamento: plan,
      eventos: [],
      editais: [],
      disciplinas: [],
    };

    storeModule = {
      state,
      DEFAULT_SCHEMA_VERSION: 6,
      createExportableState: (value) => JSON.parse(JSON.stringify(value)),
      setState: vi.fn((next, options = {}) => {
        if (options.merge) {
          Object.assign(state, next);
        } else {
          for (const key of Object.keys(state)) delete state[key];
          Object.assign(state, next);
        }
      }),
      saveStateToDB: vi.fn(async () => {
        order.push('persist');
      }),
    };

    outbox = {
      enqueueFirestoreSnapshot: vi.fn(async (envelope) => {
        pendingEnvelope = envelope;
        return true;
      }),
      getPendingFirestoreSnapshot: vi.fn(async () =>
        pendingEnvelope
          ? { id: 'latest_snapshot', status: 'pending', attempts: 0, envelope: pendingEnvelope }
          : null
      ),
      markFirestoreSnapshotSynced: vi.fn(async () => {
        order.push('mark-synced');
        pendingEnvelope = null;
        return true;
      }),
      markFirestoreSnapshotFailed: vi.fn(async () => true),
      saveFirestoreMeta: vi.fn(async () => true),
      saveFirestoreConflict: vi.fn(async () => true),
      clearFirestoreConflict: vi.fn(async () => true),
    };

    repository = {
      readFirestoreSnapshot: vi.fn(async () => remote),
      writeFirestoreSnapshot: vi.fn(write),
      verifyRetaFinalGuard: vi.fn(async () => guard),
    };

    syncCenter = {
      canAutoSyncFirestore: vi.fn(() => true),
      isGlobalSyncPaused: vi.fn(() => false),
      isRemoteStateNewer: vi.fn(() => true),
      mergeStudyStates: vi.fn((local, _remote, options) => {
        if (!options?.basePlan) {
          return {
            ...local,
            config: { ...local.config, syncMergeConflicts: { total: 1, items: [] } },
          };
        }
        return {
          ...local,
          config: { ...local.config },
          planejamento: { ...local.planejamento, retaFinal: { ...local.planejamento.retaFinal, merged: true } },
        };
      }),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/firebase/firebase-client.js?v=8.37', () => ({
      completeGoogleRedirectSignIn: vi.fn(async () => null),
      getFirebaseConfigStatus: vi.fn(() => ({ projectId: 'demo', authDomain: 'demo' })),
      initFirebaseServices: vi.fn(() => ({ configured: true, db: { _mock: true } })),
      observeFirebaseAuth: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOutFirebase: vi.fn(),
    }));
    vi.doMock('../../src/js/sync/firestore-outbox.js?v=8.37', () => outbox);
    vi.doMock('../../src/js/sync/firestore-repository.js?v=8.37', () => repository);
    vi.doMock('../../src/js/sync/sync-center.js?v=8.37', () => syncCenter);
    vi.doMock('../../src/js/sync/entity-migration.js?v=8.37', () => ({
      checkEntityMigrationNeeded: vi.fn(async () => ({ needed: false })),
      migrateEntitiesToSnapshot: vi.fn(),
    }));
    vi.doMock('../../src/js/sync/sync-lock.js?v=8.37', () => ({
      firestoreLock: { withLock: (operation) => operation() },
    }));
    vi.doMock('../../src/js/sync/sync-yield.js?v=8.37', () => ({
      yieldToUIWithBudget: vi.fn(async () => {}),
    }));

    global.document = { dispatchEvent: vi.fn(), addEventListener: vi.fn() };
    localStorage.clear();
  }

  beforeEach(() => {
    vi.resetModules();
  });

  async function boot(options) {
    setup(options);
    engine = await import('../../src/js/sync/firestore-sync-engine.js?v=8.37');
    engine.__setCurrentUser({ uid: 'uid-1' });
    return engine;
  }

  function statuses() {
    return global.document.dispatchEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event?.type === 'app:firestoreSyncStatus')
      .map((event) => event.detail.status);
  }

  it('keeps a v2 snapshot pending when the guard probe is denied', async () => {
    await boot({ plan: makePlan({ revision: 2 }), guard: { verified: false, reason: 'permission-denied' } });

    expect(await engine.queueFirestoreSnapshotFromState(storeModule.state, { manual: true })).toBe(true);
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotFailed).toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.hasPendingWrites).toBe(true);
    expect(statuses()).toContain('blocked-guard');
    expect(statuses()).not.toContain('synced');
  });

  it('allows the write after an accepted guard probe and records the new base before synced', async () => {
    const localPlan = makePlan({ revision: 2 });
    await boot({ plan: localPlan });

    await engine.queueFirestoreSnapshotFromState(storeModule.state, { manual: true });
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(repository.verifyRetaFinalGuard).toHaveBeenCalledWith(
      expect.anything(),
      'uid-1',
      expect.any(String)
    );
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({ planId: 'plan-1', revision: 2 });
    expect(storeModule.state.config.firestoreSync.baseRevision).toBe(2);
    expect(storeModule.state.config.firestoreSync.baseDigest).toBe(
      computeRetaFinalPlanDigest(localPlan)
    );
    expect(storeModule.state.config.firestoreSync.baseRemoteUpdatedAt).toBe(
      '2026-10-20T12:30:00.000Z'
    );
    expect(order.indexOf('persist')).toBeLessThan(order.indexOf('mark-synced'));
    expect(statuses().at(-1)).toBe('synced');
  });

  it('turns a divergent remote CAS into a blocking conflict and preserves local data', async () => {
    const localPlan = makePlan({ revision: 3 });
    const remotePlan = makePlan({ revision: 5 });
    const remote = envelopeFor(remotePlan, { revision: 5, baseRevision: 4 });
    await boot({ plan: localPlan, remote });

    await engine.queueFirestoreSnapshotFromState(storeModule.state, { manual: true });
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reta-final-conflict', localRevision: 3, remoteRevision: 5 })
    );
    expect(storeModule.state.config.firestoreSync.conflict).toMatchObject({
      type: 'reta-final-conflict',
    });
    expect(storeModule.state.planejamento).toBe(localPlan);
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
  });

  it('does not let forceOverwrite bypass the v2 CAS', async () => {
    const localPlan = makePlan({ revision: 3 });
    const remotePlan = makePlan({ revision: 5 });
    const remote = envelopeFor(remotePlan, { revision: 5, baseRevision: 4 });
    await boot({ plan: localPlan, remote });

    await engine.queueFirestoreSnapshotFromState(storeModule.state, { manual: true });
    const result = await engine.flushFirestoreOutbox({ manual: true, forceOverwrite: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.conflict.type).toBe('reta-final-conflict');
  });

  it('publishes a retired descriptor when the local plan is deactivated', async () => {
    const basePlan = makePlan({ revision: 2 });
    const retiredPlan = makePlan({ revision: 2, ativo: false });
    const remote = envelopeFor(basePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: retiredPlan, basePlan, remote });

    expect(await engine.queueFirestoreSnapshotFromState(storeModule.state, { manual: true })).toBe(true);
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    const sent = repository.writeFirestoreSnapshot.mock.calls[0][2].retaFinalSync;
    expect(sent).toMatchObject({ state: 'retired', revision: 3, baseRevision: 2 });
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({
      planId: 'plan-1',
      revision: 3,
      ativo: false,
    });
  });

  it('fails closed with lineage-change when a new planId replaces a known lineage', async () => {
    const basePlan = makePlan({ revision: 2 });
    const changedPlan = makePlan({ revision: 3, planId: 'plan-2' });
    await boot({ plan: changedPlan, basePlan });

    const result = await engine.queueFirestoreSnapshotFromState(storeModule.state, { manual: true });

    expect(result).toBe(false);
    expect(outbox.enqueueFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reta-final-conflict', cause: 'lineage-change' })
    );
    expect(storeModule.state.config.firestoreSync.conflict.cause).toBe('lineage-change');
  });

  it('fails closed when local data was cleared and the remote document is v2', async () => {
    const remotePlan = makePlan({ revision: 3 });
    const remote = envelopeFor(remotePlan, { revision: 3, baseRevision: 2 });
    await boot({ plan: null, basePlan: null, remote });

    expect(await engine.queueFirestoreSnapshotFromState(storeModule.state, { manual: true })).toBe(true);
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reta-final-conflict', cause: 'legacy-write' })
    );
  });

  it('keeps the snapshot pending when the remote ACK fails after the local commit', async () => {
    await boot({
      plan: makePlan({ revision: 2 }),
      write: async () => {
        throw Object.assign(new Error('network down'), { code: 'unavailable' });
      },
    });

    await engine.queueFirestoreSnapshotFromState(storeModule.state, { manual: true });
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotFailed).toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.basePlan).toBeNull();
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
    expect(storeModule.state.config.firestoreSync.lastError).toMatch(/network down/);
  });

  it('merges a v2 pull with a verified base and advances the merged revision', async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(true);
    expect(syncCenter.mergeStudyStates).toHaveBeenCalledWith(
      storeModule.state,
      remote.payload,
      expect.objectContaining({ basePlan })
    );
    expect(storeModule.state.planejamento.revision).toBe(3);
    expect(storeModule.state.planejamento.retaFinal.merged).toBe(true);
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({ revision: 2 });
    expect(storeModule.state.config.firestoreSync.baseRevision).toBe(2);
  });

  it('turns a v2 pull without a verified base into a conflict without applying remote', async () => {
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan: null, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(syncCenter.mergeStudyStates).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reta-final-conflict', cause: 'missing-base' })
    );
    expect(storeModule.state.planejamento).toBe(localPlan);
  });

  it('pulls a newer retired revision without treating it as an active plan', async () => {
    const basePlan = makePlan({ revision: 3, ativo: false });
    const localPlan = makePlan({ revision: 3, ativo: false });
    const remotePlan = makePlan({ revision: 4, ativo: false });
    const remote = envelopeFor(remotePlan, { revision: 4, baseRevision: 3, state: 'retired' });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(true);
    expect(storeModule.state.planejamento).toMatchObject({ revision: 4, ativo: false });
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({ revision: 4 });
  });

  it('opens a retirement-mismatch conflict when only one side is retired', async () => {
    const basePlan = makePlan({ revision: 2 });
    const localPlan = makePlan({ revision: 2 });
    const remotePlan = makePlan({ revision: 3, ativo: false });
    const remote = envelopeFor(remotePlan, { revision: 3, baseRevision: 2, state: 'retired' });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reta-final-conflict', cause: 'retirement-mismatch' })
    );
    expect(storeModule.state.planejamento).toBe(localPlan);
  });

  it('aborts entity migration instead of overwriting a v2 snapshot', async () => {
    vi.resetModules();
    vi.doUnmock('../../src/js/sync/entity-migration.js?v=8.37');
    const setDoc = vi.fn();
    const v2Plan = makePlan({ revision: 4 });
    const snapshot = envelopeFor(v2Plan, { revision: 4, baseRevision: 3 });

    vi.doMock('../../src/vendor/firebase-client.bundle.js?v=8.37', () => ({
      doc: vi.fn(() => ({})),
      getDoc: vi.fn(async () => ({ exists: () => true, data: () => snapshot })),
      setDoc,
    }));
    vi.doMock('../../src/js/sync/firestore-schema.js?v=8.37', () => ({
      FIRESTORE_SNAPSHOT_DOC_ID: 'main',
      createFirestoreSnapshotEnvelope: vi.fn(),
    }));
    vi.doMock('../../src/js/sync/sync-center.js?v=8.37', () => ({
      mergeStudyStates: vi.fn((local) => local),
    }));

    const { migrateEntitiesToSnapshot } = await import(
      '../../src/js/sync/entity-migration.js?v=8.37'
    );
    const report = await migrateEntitiesToSnapshot({}, 'uid-1', {});

    expect(report.blocked).toBe(true);
    expect(report.steps).toContainEqual(
      expect.objectContaining({ step: 'retafinal-guard', status: 'blocked' })
    );
    expect(setDoc).not.toHaveBeenCalled();
  });
});
