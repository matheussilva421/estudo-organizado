import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRetaFinalSyncDescriptor,
  computeRetaFinalPlanDigest,
  getRetaFinalSyncCapabilities,
} from "../../src/js/sync/reta-final-protocol.js";

const CAPABILITIES = getRetaFinalSyncCapabilities({});

function makePlan({
  revision = 2,
  minutos = 30,
  updatedAt = "2026-10-20T12:00:00.000Z",
  planId = "plan-1",
  ativo = true,
} = {}) {
  return {
    ativo,
    tipo: "reta_final",
    schemaVersionRetaFinal: 2,
    planId,
    generation: 1,
    revision,
    updatedAt,
    retaFinal: {
      dataFinal: "2026-12-20",
      blocos: [
        {
          id: "b1",
          discId: "d1",
          topicos: [{ assId: "a1" }],
          minutos,
          ordem: 0,
          dataPlanejada: "2026-10-22",
          data: "2026-10-22",
        },
      ],
    },
  };
}

function envelopeFor(plan, descriptorOverrides = {}) {
  const descriptor = buildRetaFinalSyncDescriptor({
    plan,
    baseRevision:
      descriptorOverrides.baseRevision ?? Math.max(0, plan.revision - 1),
    baseRemoteUpdatedAt: "2026-10-20T11:00:00.000Z",
    deviceId: "web-device1",
    capabilities: CAPABILITIES,
    ...descriptorOverrides,
  });
  return {
    version: 1,
    schemaVersion: 6,
    deviceId: "web-device1",
    payloadUpdatedAt: plan.updatedAt,
    sentAt: plan.updatedAt,
    payload: {
      planejamento: plan,
      config: {},
      eventos: [],
      editais: [],
      disciplinas: [],
    },
    retaFinalSync: descriptor,
  };
}

describe("reta-final sync engine integration", () => {
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
    write = async () => ({ updatedAt: "2026-10-20T12:30:00.000Z" }),
  } = {}) {
    order = [];
    let pendingEnvelope = null;
    const state = {
      config: {
        firestoreSync: {
          enabled: true,
          mode: "primary",
          uid: "uid-1",
          basePlan,
          baseDigest: basePlan ? computeRetaFinalPlanDigest(basePlan) : null,
          baseRevision: basePlan?.revision ?? null,
          snapshotRevision: remote?.retaFinalSync?.snapshotRevision ?? 0,
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
        order.push("persist");
      }),
    };

    outbox = {
      enqueueFirestoreSnapshot: vi.fn(async (envelope) => {
        pendingEnvelope = envelope;
        return true;
      }),
      getPendingFirestoreSnapshot: vi.fn(async () =>
        pendingEnvelope
          ? {
              id: "latest_snapshot",
              status: "pending",
              attempts: 0,
              envelope: pendingEnvelope,
            }
          : null,
      ),
      markFirestoreSnapshotSynced: vi.fn(async () => {
        order.push("mark-synced");
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
            config: {
              ...local.config,
              syncMergeConflicts: { total: 1, items: [] },
            },
          };
        }
        return {
          ...local,
          config: { ...local.config },
          planejamento: {
            ...local.planejamento,
            retaFinal: { ...local.planejamento.retaFinal, merged: true },
          },
        };
      }),
    };

    vi.doMock("../../src/js/store.js?v=8.37", () => storeModule);
    vi.doMock("../../src/js/firebase/firebase-client.js?v=8.37", () => ({
      completeGoogleRedirectSignIn: vi.fn(async () => null),
      getFirebaseConfigStatus: vi.fn(() => ({
        projectId: "demo",
        authDomain: "demo",
      })),
      initFirebaseServices: vi.fn(() => ({
        configured: true,
        db: { _mock: true },
      })),
      observeFirebaseAuth: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOutFirebase: vi.fn(),
    }));
    vi.doMock("../../src/js/sync/firestore-outbox.js?v=8.37", () => outbox);
    vi.doMock(
      "../../src/js/sync/firestore-repository.js?v=8.37",
      () => repository,
    );
    vi.doMock("../../src/js/sync/sync-center.js?v=8.37", () => syncCenter);
    vi.doMock("../../src/js/sync/entity-migration.js?v=8.37", () => ({
      checkEntityMigrationNeeded: vi.fn(async () => ({ needed: false })),
      migrateEntitiesToSnapshot: vi.fn(),
    }));
    vi.doMock("../../src/js/sync/sync-lock.js?v=8.37", () => ({
      firestoreLock: { withLock: (operation) => operation() },
    }));
    vi.doMock("../../src/js/sync/sync-yield.js?v=8.37", () => ({
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
    engine = await import("../../src/js/sync/firestore-sync-engine.js?v=8.37");
    engine.__setCurrentUser({ uid: "uid-1" });
    return engine;
  }

  function statuses() {
    return global.document.dispatchEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event?.type === "app:firestoreSyncStatus")
      .map((event) => event.detail.status);
  }

  it("keeps a v2 snapshot pending when the guard probe is denied", async () => {
    await boot({
      plan: makePlan({ revision: 2 }),
      guard: { verified: false, reason: "permission-denied" },
    });

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotFailed).toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.hasPendingWrites).toBe(true);
    expect(statuses()).toContain("blocked-guard");
    expect(statuses()).not.toContain("synced");
  });

  it("allows the write after an accepted guard probe and records the new base before synced", async () => {
    const localPlan = makePlan({ revision: 2 });
    await boot({ plan: localPlan });

    await engine.queueFirestoreSnapshotFromState(storeModule.state, {
      manual: true,
    });
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(repository.verifyRetaFinalGuard).toHaveBeenCalledWith(
      expect.anything(),
      "uid-1",
      expect.any(String),
    );
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({
      planId: "plan-1",
      revision: 2,
    });
    expect(storeModule.state.config.firestoreSync.baseRevision).toBe(2);
    expect(storeModule.state.config.firestoreSync.baseDigest).toBe(
      computeRetaFinalPlanDigest(localPlan),
    );
    expect(storeModule.state.config.firestoreSync.baseRemoteUpdatedAt).toBe(
      "2026-10-20T12:30:00.000Z",
    );
    expect(order.indexOf("persist")).toBeLessThan(order.indexOf("mark-synced"));
    expect(statuses().at(-1)).toBe("synced");
  });

  it("turns a divergent remote CAS into a blocking conflict and preserves local data", async () => {
    const localPlan = makePlan({ revision: 3 });
    const remotePlan = makePlan({ revision: 5 });
    const remote = envelopeFor(remotePlan, { revision: 5, baseRevision: 4 });
    await boot({ plan: localPlan, remote });

    await engine.queueFirestoreSnapshotFromState(storeModule.state, {
      manual: true,
    });
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reta-final-conflict",
        localRevision: 3,
        remoteRevision: 5,
      }),
    );
    expect(storeModule.state.config.firestoreSync.conflict).toMatchObject({
      type: "reta-final-conflict",
    });
    expect(storeModule.state.planejamento).toBe(localPlan);
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
  });

  it("does not let forceOverwrite bypass the v2 CAS", async () => {
    const localPlan = makePlan({ revision: 3 });
    const remotePlan = makePlan({ revision: 5 });
    const remote = envelopeFor(remotePlan, { revision: 5, baseRevision: 4 });
    await boot({ plan: localPlan, remote });

    await engine.queueFirestoreSnapshotFromState(storeModule.state, {
      manual: true,
    });
    const result = await engine.flushFirestoreOutbox({
      manual: true,
      forceOverwrite: true,
    });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.conflict.type).toBe(
      "reta-final-conflict",
    );
  });

  it("publishes a retired descriptor when the local plan is deactivated", async () => {
    const basePlan = makePlan({ revision: 2 });
    const retiredPlan = makePlan({ revision: 2, ativo: false });
    const remote = envelopeFor(basePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: retiredPlan, basePlan, remote });

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    const sent =
      repository.writeFirestoreSnapshot.mock.calls[0][2].retaFinalSync;
    expect(sent).toMatchObject({
      state: "retired",
      revision: 3,
      baseRevision: 2,
    });
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({
      planId: "plan-1",
      revision: 2,
      ativo: false,
    });
    expect(storeModule.state.planejamento.revision).toBe(2);
  });

  it("fails closed with lineage-change when a new planId replaces a known lineage", async () => {
    const basePlan = makePlan({ revision: 2 });
    const changedPlan = makePlan({ revision: 3, planId: "plan-2" });
    await boot({ plan: changedPlan, basePlan });

    const result = await engine.queueFirestoreSnapshotFromState(
      storeModule.state,
      { manual: true },
    );

    expect(result).toBe(false);
    expect(outbox.enqueueFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reta-final-conflict",
        cause: "lineage-change",
      }),
    );
    expect(storeModule.state.config.firestoreSync.conflict.cause).toBe(
      "lineage-change",
    );
  });

  it("fails closed when local data was cleared and the remote document is v2", async () => {
    const remotePlan = makePlan({ revision: 3 });
    const remote = envelopeFor(remotePlan, { revision: 3, baseRevision: 2 });
    await boot({ plan: null, basePlan: null, remote });

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reta-final-conflict",
        cause: "legacy-write",
      }),
    );
  });

  it("keeps the snapshot pending when the remote ACK fails after the local commit", async () => {
    await boot({
      plan: makePlan({ revision: 2 }),
      write: async () => {
        throw Object.assign(new Error("network down"), { code: "unavailable" });
      },
    });

    await engine.queueFirestoreSnapshotFromState(storeModule.state, {
      manual: true,
    });
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotFailed).toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.basePlan).toBeNull();
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
    expect(storeModule.state.config.firestoreSync.lastError).toMatch(
      /network down/,
    );
  });

  it("opens a merge-review conflict with a proposed plan instead of applying it", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(storeModule.state.planejamento).toBe(localPlan);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reta-final-conflict",
        cause: "merge-review",
        proposedPlan: expect.objectContaining({ planId: "plan-1" }),
        basePlan: expect.objectContaining({ revision: 1 }),
        localPlan: expect.objectContaining({ revision: 2 }),
        remotePlan: expect.objectContaining({ revision: 2 }),
      }),
    );
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({
      revision: 1,
    });
  });

  it("fast-forwards a v2 pull when the local digest equals the base", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 1 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(true);
    expect(storeModule.state.planejamento.revision).toBe(2);
    expect(storeModule.state.planejamento.retaFinal.blocos[0].minutos).toBe(50);
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({
      revision: 2,
    });
    expect(outbox.markFirestoreSnapshotSynced).toHaveBeenCalled();
  });

  it("does not apply, clear the base, or mark synced when local and remote digests match", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 40 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.mergeFromFirestore();

    expect(result).toBe(false);
    expect(storeModule.state.planejamento).toBe(localPlan);
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({
      revision: 1,
    });
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
  });

  it("applies remote academic data even when the plan digest matches", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 40 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    remote.payload.eventos = [{ id: "ev-remote", status: "estudei" }];
    await boot({ plan: localPlan, basePlan, remote });
    syncCenter.mergeStudyStates.mockImplementation((local, remotePayload) => ({
      ...local,
      eventos: [...(local.eventos || []), ...(remotePayload.eventos || [])],
    }));

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(true);
    expect(storeModule.state.eventos).toEqual([
      { id: "ev-remote", status: "estudei" },
    ]);
    expect(storeModule.state.planejamento).toEqual(localPlan);
  });

  it("queues an academic-only snapshot without bumping the plan revision", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 40 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });
    storeModule.state.eventos = [{ id: "ev-local", status: "estudei" }];
    syncCenter.mergeStudyStates.mockImplementation((local, remotePayload) => {
      const result = {
        ...local,
        eventos: [...(local.eventos || []), ...(remotePayload.eventos || [])],
      };
      return result;
    });

    const result = await engine.syncFirestoreNow();

    expect(result).toBe(true);
    const envelope = outbox.enqueueFirestoreSnapshot.mock.calls.at(-1)[0];
    expect(envelope.retaFinalSync).toMatchObject({
      revision: 2,
      baseRevision: 2,
      snapshotRevision: 3,
      baseSnapshotRevision: 2,
    });
    expect(envelope.payload.eventos).toEqual([
      { id: "ev-local", status: "estudei" },
    ]);
    expect(envelope.payload.planejamento.revision).toBe(2);
  });

  it("aborts a pull when the local plan changes during the yield", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 1 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });
    const yieldModule = await import("../../src/js/sync/sync-yield.js?v=8.37");
    yieldModule.yieldToUIWithBudget.mockImplementationOnce(async () => {
      storeModule.state.planejamento = makePlan({ revision: 3, minutos: 70 });
    });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(storeModule.state.planejamento.revision).toBe(3);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "local-changed-during-pull" }),
    );
  });

  it("preserves a pending outbox and refuses a v2 merge", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });
    await outbox.enqueueFirestoreSnapshot({
      version: 1,
      deviceId: "web-device1",
      payloadUpdatedAt: "2026-10-20T12:10:00.000Z",
      payload: { planejamento: localPlan },
    });

    const result = await engine.mergeFromFirestore();

    expect(result).toBe(false);
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reta-final-conflict",
        cause: "pending-outbox",
      }),
    );
  });

  it("refuses a forced pull with pending outbox unless discardPending is explicit", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });
    const pendingEnvelope = {
      version: 1,
      deviceId: "web-device1",
      sentAt: "pending-1",
      payloadUpdatedAt: "2026-10-20T12:10:00.000Z",
      payload: { planejamento: localPlan },
    };
    await outbox.enqueueFirestoreSnapshot(pendingEnvelope);

    const refused = await engine.pullFromFirestore(true);

    expect(refused).toBe(false);
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "pending-outbox" }),
    );

    const accepted = await engine.pullFromFirestore(true, {
      discardPending: true,
    });

    expect(accepted).toBe(true);
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
    expect(outbox.markFirestoreSnapshotSynced).toHaveBeenCalled();
  });

  it("refuses a legacy force pull with pending and applies it with discardPending", async () => {
    const legacyRemote = {
      version: 1,
      schemaVersion: 6,
      deviceId: "legacy-device",
      payloadUpdatedAt: "2026-10-20T12:00:00.000Z",
      sentAt: "2026-10-20T12:00:00.000Z",
      payload: {
        config: {},
        planejamento: { ativo: true, tipo: "sequencia", revision: 5 },
        eventos: [],
      },
    };
    await boot({ plan: null, basePlan: null, remote: legacyRemote });
    await outbox.enqueueFirestoreSnapshot({
      version: 1,
      deviceId: "web-device1",
      sentAt: "legacy-pending",
      payloadUpdatedAt: "2026-10-20T12:10:00.000Z",
      payload: { planejamento: null },
    });

    const refused = await engine.pullFromFirestore(true);

    expect(refused).toBe(false);
    expect(storeModule.state.planejamento).toBeNull();
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();

    const accepted = await engine.pullFromFirestore(true, {
      discardPending: true,
    });

    expect(accepted).toBe(true);
    expect(storeModule.state.planejamento).toMatchObject({ revision: 5 });
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
    expect(outbox.markFirestoreSnapshotSynced).toHaveBeenCalled();
  });

  it("clears pending and reports synced on a forced v2 no-op with discardPending", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 40 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });
    await outbox.enqueueFirestoreSnapshot({
      version: 1,
      deviceId: "web-device1",
      sentAt: "noop-pending",
      payloadUpdatedAt: "2026-10-20T12:10:00.000Z",
      payload: { planejamento: localPlan },
    });

    const refused = await engine.pullFromFirestore(true);

    expect(refused).toBe(false);
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
    expect(statuses()).not.toContain("synced");

    const accepted = await engine.pullFromFirestore(true, {
      discardPending: true,
    });

    expect(accepted).toBe(true);
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
    expect(statuses().at(-1)).toBe("synced");
  });

  it("emits a terminal status for a manual pull no-op", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 40 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pullFromFirestore(false);

    expect(result).toBe(false);
    expect(statuses().at(-1)).toBe("synced");
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({
      revision: 1,
    });
  });

  it("emits a terminal status for a manual merge no-op", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 40 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.mergeFromFirestore();

    expect(result).toBe(false);
    expect(statuses().at(-1)).toBe("synced");
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
  });

  it("derives local block tombstone ids and retention floor in the descriptor", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2 });
    localPlan.retaFinal.blocos = [];
    await boot({ plan: localPlan, basePlan });

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);
    const pending = await outbox.getPendingFirestoreSnapshot();

    expect(pending.envelope.retaFinalSync.removedBlockIds).toEqual(["b1"]);
    expect(pending.envelope.retaFinalSync.minRetainedRevision).toBe(1);
    expect(storeModule.state.config.firestoreSync.removedBlocks).toEqual([
      { id: "b1", revision: 2 },
    ]);
  });

  it("compacts 201 tombstones to 200 and raises the floor to the base head", async () => {
    const basePlan = makePlan({ revision: 100 });
    const template = basePlan.retaFinal.blocos[0];
    basePlan.retaFinal.blocos = Array.from({ length: 201 }, (_, index) => ({
      ...template,
      id: `b${index}`,
      ordem: index,
    }));
    const localPlan = makePlan({ revision: 101 });
    localPlan.retaFinal.blocos = [];
    await boot({ plan: localPlan, basePlan });

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);
    const pending = await outbox.getPendingFirestoreSnapshot();

    expect(pending.envelope.retaFinalSync.removedBlockIds).toHaveLength(200);
    expect(pending.envelope.retaFinalSync.minRetainedRevision).toBe(100);
    expect(storeModule.state.config.firestoreSync.removedBlocks).toHaveLength(
      200,
    );
    expect(storeModule.state.config.firestoreSync.minRetainedRevision).toBe(
      100,
    );
  });

  it("incorporates remote tombstones and retention floor on pull", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    remotePlan.retaFinal.removedBlockIds = ["b9"];
    const remote = envelopeFor(remotePlan, {
      revision: 2,
      baseRevision: 1,
      minRetainedRevision: 4,
    });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(storeModule.state.config.firestoreSync.removedBlocks).toContainEqual(
      {
        id: "b9",
        revision: 2,
      },
    );
    expect(storeModule.state.config.firestoreSync.minRetainedRevision).toBe(4);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "stale-base" }),
    );
  });

  it("blocks a push when the base revision is below the retention floor", async () => {
    await boot({
      plan: makePlan({ revision: 2 }),
      basePlan: makePlan({ revision: 1 }),
    });
    storeModule.state.config.firestoreSync.baseRevision = 1;
    storeModule.state.config.firestoreSync.minRetainedRevision = 5;

    await engine.queueFirestoreSnapshotFromState(storeModule.state, {
      manual: true,
    });
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "stale-base" }),
    );
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
  });

  it("fails closed when the descriptor and payload use different planIds", async () => {
    const localPlan = makePlan({ revision: 1, planId: "plan-2" });
    await boot({ plan: localPlan, basePlan: null });
    const descriptor = buildRetaFinalSyncDescriptor({
      plan: makePlan({ revision: 1, planId: "plan-1" }),
      baseRevision: 0,
      baseRemoteUpdatedAt: null,
      deviceId: "web-device1",
      capabilities: CAPABILITIES,
    });
    await outbox.enqueueFirestoreSnapshot({
      version: 1,
      deviceId: "web-device1",
      sentAt: "lineage-payload",
      payloadUpdatedAt: "2026-10-20T12:00:00.000Z",
      payload: { planejamento: localPlan },
      retaFinalSync: descriptor,
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "lineage-payload" }),
    );
  });

  it("filters remotely removed block ids from a merge proposal", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    localPlan.retaFinal.blocos.push({
      ...localPlan.retaFinal.blocos[0],
      id: "b2",
    });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    remotePlan.retaFinal.blocos = [];
    remotePlan.retaFinal.removedBlockIds = ["b1"];
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });
    storeModule.state.config.firestoreSync.removedBlocks = [
      { id: "b2", revision: 2 },
    ];

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    const conflict = outbox.saveFirestoreConflict.mock.calls[0][0];
    expect(conflict.cause).toBe("merge-review");
    expect(conflict.proposedPlan.retaFinal.blocos).toEqual([]);
  });

  it("refuses a merge when the base is older than minRetainedRevision", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, {
      revision: 2,
      baseRevision: 1,
      minRetainedRevision: 5,
    });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reta-final-conflict",
        cause: "stale-base",
      }),
    );
    expect(storeModule.state.planejamento).toBe(localPlan);
  });

  it("turns a v2 pull without a verified base into a conflict without applying remote", async () => {
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan: null, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(syncCenter.mergeStudyStates).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reta-final-conflict",
        cause: "missing-base",
      }),
    );
    expect(storeModule.state.planejamento).toBe(localPlan);
  });

  it("pulls a newer retired revision without treating it as an active plan", async () => {
    const basePlan = makePlan({ revision: 3, ativo: false });
    const localPlan = makePlan({ revision: 3, ativo: false });
    const remotePlan = makePlan({ revision: 4, ativo: false });
    const remote = envelopeFor(remotePlan, {
      revision: 4,
      baseRevision: 3,
      state: "retired",
    });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(true);
    expect(storeModule.state.planejamento).toMatchObject({
      revision: 4,
      ativo: false,
    });
    expect(storeModule.state.config.firestoreSync.basePlan).toMatchObject({
      revision: 4,
    });
  });

  it("opens a retirement-mismatch conflict when only one side is retired", async () => {
    const basePlan = makePlan({ revision: 2 });
    const localPlan = makePlan({ revision: 2 });
    const remotePlan = makePlan({ revision: 3, ativo: false });
    const remote = envelopeFor(remotePlan, {
      revision: 3,
      baseRevision: 2,
      state: "retired",
    });
    await boot({ plan: localPlan, basePlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reta-final-conflict",
        cause: "retirement-mismatch",
      }),
    );
    expect(storeModule.state.planejamento).toBe(localPlan);
  });

  it("aborts entity migration instead of overwriting a v2 snapshot", async () => {
    vi.resetModules();
    vi.doUnmock("../../src/js/sync/entity-migration.js?v=8.37");
    const setDoc = vi.fn();
    const v2Plan = makePlan({ revision: 4, ativo: false });
    const snapshot = envelopeFor(v2Plan, { revision: 4, baseRevision: 3 });
    delete snapshot.retaFinalSync;

    vi.doMock("../../src/vendor/firebase-client.bundle.js?v=8.37", () => ({
      doc: vi.fn(() => ({})),
      getDoc: vi.fn(async () => ({ exists: () => true, data: () => snapshot })),
      setDoc,
    }));
    vi.doMock("../../src/js/sync/firestore-schema.js?v=8.37", () => ({
      FIRESTORE_SNAPSHOT_DOC_ID: "main",
      createFirestoreSnapshotEnvelope: vi.fn(),
    }));
    vi.doMock("../../src/js/sync/sync-center.js?v=8.37", () => ({
      mergeStudyStates: vi.fn((local) => local),
    }));

    const { migrateEntitiesToSnapshot } =
      await import("../../src/js/sync/entity-migration.js?v=8.37");
    const report = await migrateEntitiesToSnapshot({}, "uid-1", {});

    expect(report.blocked).toBe(true);
    expect(report.steps).toContainEqual(
      expect.objectContaining({ step: "retafinal-guard", status: "blocked" }),
    );
    expect(setDoc).not.toHaveBeenCalled();
  });
});
