import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRetaFinalSyncDescriptor,
  computeRetaFinalPlanDigest,
  getRetaFinalSyncCapabilities,
} from "../../src/js/sync/reta-final-protocol.js";
import { migrateRetaFinalV2 } from "../../src/js/logic/reta-final-schema.js";
import {
  createFirestoreSnapshotEnvelope,
  getFirestoreEnvelopeSizeBytes,
  FIRESTORE_ENVELOPE_MAX_BYTES,
} from "../../src/js/sync/firestore-schema.js";

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

function legacyRfPlan({ blocks = 180, ativo = true } = {}) {
  const blocos = [];
  for (let index = 0; index < blocks; index += 1) {
    const data = new Date(Date.UTC(2026, 8, 1 + (index % 100)))
      .toISOString()
      .slice(0, 10);
    blocos.push({
      id: `rf_${String(index).padStart(3, "0")}`,
      data,
      dataOriginal: data,
      discId: `d${index % 3}`,
      topicos: [{ assId: `a${index % 5}`, aulaId: null }],
      minutos: 45 + (index % 3) * 15,
      status: index % 9 === 0 ? "concluido" : "pendente",
      rolagens: 0,
    });
  }
  return {
    ativo,
    tipo: "reta_final",
    disciplinas: ["d0", "d1", "d2"],
    relevancia: {},
    horarios: { dataFinal: "2026-12-20" },
    materiasPorDia: 3,
    sequencia: [],
    skippedSlots: [],
    slotOverrides: [],
    ciclosCompletos: 1,
    dataInicioCicloAtual: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-10-22T17:45:50.000Z",
    retaFinal: {
      nome: "Reta Final legada",
      dataFinal: "2026-12-20",
      minutosPadrao: 60,
      importadoEm: "2026-09-01T12:00:00.000Z",
      blocos,
    },
  };
}

function localV2FromLegacy(legacy, planId = "rfplan_local") {
  const migration = migrateRetaFinalV2(JSON.parse(JSON.stringify(legacy)), {
    makePlanId: () => planId,
  });
  if (!migration.changed) throw new Error("fixture nao migrou");
  return migration.plan;
}

function legacyRfEnvelope(plan, payloadUpdatedAt = "2026-10-22T17:45:50.000Z") {
  return {
    version: 1,
    schemaVersion: 6,
    deviceId: "legacy-device",
    baseRemoteUpdatedAt: null,
    payloadUpdatedAt,
    sentAt: payloadUpdatedAt,
    payload: {
      planejamento: plan,
      config: {},
      eventos: [],
      editais: [],
      disciplinas: [],
    },
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function adoptionDescriptor(
  plan,
  { deviceId = "web-device1", baseRemoteUpdatedAt = null } = {},
) {
  return buildRetaFinalSyncDescriptor({
    plan,
    baseRevision: 0,
    baseRemoteUpdatedAt,
    deviceId,
    capabilities: CAPABILITIES,
    state: "active",
    revision: 0,
    snapshotRevision: 1,
    baseSnapshotRevision: 0,
  });
}

function adoptionEnvelope({
  plan,
  payloadUpdatedAt,
  sentAt = payloadUpdatedAt,
  events = [],
  editais = [],
  deviceId = "web-device1",
  baseRemoteUpdatedAt = null,
}) {
  return {
    version: 1,
    schemaVersion: 6,
    deviceId,
    baseRemoteUpdatedAt,
    payloadUpdatedAt,
    sentAt,
    retaFinalSync: adoptionDescriptor(plan, { deviceId, baseRemoteUpdatedAt }),
    payload: {
      planejamento: cloneJson(plan),
      config: {},
      eventos: cloneJson(events),
      editais: cloneJson(editais),
      arquivo: [],
      revisoes: [],
      disciplinas: [],
    },
  };
}

function mergeAcademicCollections(local, remote) {
  const merged = {
    ...local,
    ...remote,
    config: { ...(remote.config || {}), ...(local.config || {}) },
  };
  for (const key of ["eventos", "editais", "revisoes", "arquivo"]) {
    const map = new Map((remote[key] || []).map((item) => [item.id, item]));
    for (const item of local[key] || []) map.set(item.id, item);
    merged[key] = [...map.values()];
  }
  merged.planejamento = local.planejamento;
  return merged;
}

function hugeConflictAudit(plan, legacy) {
  return {
    type: "reta-final-conflict",
    cause: "merge-review",
    detectedAt: "2026-10-26T20:00:00.000Z",
    planId: plan.planId,
    baseRevision: 1,
    localRevision: 2,
    remoteRevision: 2,
    localPlan: plan,
    remotePlan: legacy,
    basePlan: plan,
    proposedPlan: plan,
    mergeConflicts: Array.from({ length: 30 }, () => ({
      local: plan,
      remote: legacy,
    })),
    items: Array.from({ length: 10 }, () => ({ localPlan: plan, remotePlan: legacy })),
    reason: "r".repeat(2000),
  };
}

function hugeHistoryFor(plan, legacy) {
  return Array.from({ length: 20 }, (_, index) => ({
    at: "2026-10-26T20:" + String(index).padStart(2, "0") + ":00.000Z",
    firestore: "conflict",
    conflicts: {
      firestore:
        index < 6
          ? hugeConflictAudit(plan, legacy)
          : { type: "reta-final-conflict", cause: "small" },
    },
  }));
}

function pendingEnvelopeFor(state, plan, remote, sentAt, withHistory = false) {
  const descriptor = buildRetaFinalSyncDescriptor({
    plan,
    baseRevision: 0,
    baseRemoteUpdatedAt: remote.payloadUpdatedAt,
    deviceId: "web-device1",
    capabilities: CAPABILITIES,
    state: "active",
    snapshotRevision: 1,
    baseSnapshotRevision: 0,
  });
  const envelope = createFirestoreSnapshotEnvelope(state, {
    retaFinalSync: descriptor,
    deviceId: "web-device1",
    baseRemoteUpdatedAt: remote.payloadUpdatedAt,
    sentAt,
  });
  if (withHistory) {
    envelope.payload.config.manualSyncHistory = hugeHistoryFor(
      plan,
      remote.payload.planejamento,
    );
  }
  return envelope;
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
    conflict = null,
    pendingRecord = null,
  } = {}) {
    order = [];
    let pendingEnvelope = null;
    let pendingAcademicOnly = false;
    let currentPendingRecord = pendingRecord;
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
          conflict,
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
      enqueueFirestoreSnapshot: vi.fn(async (envelope, options = {}) => {
        pendingEnvelope = envelope;
        pendingAcademicOnly = options.academicOnly === true;
        currentPendingRecord = null;
        return true;
      }),
      getPendingFirestoreSnapshot: vi.fn(async () =>
        currentPendingRecord ??
        (pendingEnvelope
          ? {
              id: "latest_snapshot",
              status: "pending",
              attempts: 0,
              academicOnly: pendingAcademicOnly,
              envelope: pendingEnvelope,
            }
          : null),
      ),
      setPendingRecord: (record) => {
        currentPendingRecord = record;
        pendingEnvelope = record?.envelope ?? null;
      },
      replacePendingFirestoreSnapshotEnvelope: vi.fn(async (envelope, expected = {}) => {
        if (!currentPendingRecord) return false;
        if (
          expected.queuedAt !== undefined &&
          currentPendingRecord.queuedAt !== expected.queuedAt
        ) {
          return false;
        }
        if (
          expected.sentAt !== undefined &&
          (currentPendingRecord.envelope?.sentAt ?? null) !== expected.sentAt
        ) {
          return false;
        }
        currentPendingRecord = {
          ...currentPendingRecord,
          envelope,
          lastError: null,
        };
        pendingEnvelope = envelope;
        return true;
      }),
      markFirestoreSnapshotSynced: vi.fn(async () => {
        order.push("mark-synced");
        pendingEnvelope = null;
        pendingAcademicOnly = false;
        currentPendingRecord = null;
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
    vi.doUnmock("../../src/js/sync/firestore-schema.js?v=8.37");
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
    syncCenter.mergeStudyStates.mockImplementation((local, remotePayload) => ({
      ...local,
      planejamento: remotePayload.planejamento,
    }));

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
    syncCenter.mergeStudyStates.mockImplementation((local, remotePayload) => ({
      ...local,
      planejamento: remotePayload.planejamento,
    }));

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
    expect(envelope.payload.planejamento).toEqual(remotePlan);
  });

  it("sends the verified remote plan when only derived fields drifted", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    localPlan.retaFinal.blocos[0].data = "2026-10-23";
    const remotePlan = makePlan({ revision: 2, minutos: 40 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan: remotePlan, remote });
    storeModule.state.eventos = [{ id: "ev-derived", status: "estudei" }];

    const result = await engine.queueFirestoreSnapshotFromState(
      storeModule.state,
      { manual: true },
    );

    expect(result).toBe(true);
    const envelope = outbox.enqueueFirestoreSnapshot.mock.calls.at(-1)[0];
    expect(envelope.payload.planejamento).toEqual(remotePlan);
    expect(envelope.payload.planejamento.retaFinal.blocos[0].data).toBe(
      "2026-10-22",
    );
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

  it("merges academic data when fast-forwarding the plan", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 1 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    remote.payload.eventos = [{ id: "ev-remote", status: "estudei" }];
    await boot({ plan: localPlan, basePlan, remote });
    storeModule.state.eventos = [{ id: "ev-local", status: "estudei" }];
    syncCenter.mergeStudyStates.mockImplementation((local, remotePayload) => {
      return {
        ...local,
        planejamento: remotePayload.planejamento,
        eventos: [
          ...(local.eventos || []),
          ...(remotePayload.eventos || []),
        ],
      };
    });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(true);
    expect(storeModule.state.planejamento.revision).toBe(2);
    expect(storeModule.state.eventos).toEqual([
      { id: "ev-local", status: "estudei" },
      { id: "ev-remote", status: "estudei" },
    ]);
  });

  it("aborts a pull when academic data changes during the yield", async () => {
    const basePlan = makePlan({ revision: 1 });
    const localPlan = makePlan({ revision: 1 });
    const remotePlan = makePlan({ revision: 2, minutos: 50 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });
    const yieldModule = await import("../../src/js/sync/sync-yield.js?v=8.37");
    yieldModule.yieldToUIWithBudget.mockImplementationOnce(async () => {
      storeModule.state.eventos = [{ id: "ev-during-yield" }];
    });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(storeModule.state.eventos).toEqual([{ id: "ev-during-yield" }]);
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
    syncCenter.mergeStudyStates.mockImplementation((local, remotePayload) => ({
      ...local,
      planejamento: remotePayload.planejamento,
    }));

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

  it("adopts an equivalent 180-block legacy snapshot instead of missing-remote-plan", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    remote.payload.eventos = [
      { id: "ev-legacy", status: "estudei", tempo: 25, notas: "remota" },
    ];
    await boot({ plan: localPlan, remote });
    syncCenter.mergeStudyStates.mockImplementation((local, remotePayload) => ({
      ...local,
      eventos: [...(local.eventos || []), ...(remotePayload.eventos || [])],
      config: { ...local.config },
    }));

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(true);
    expect(storeModule.state.eventos).toEqual([
      { id: "ev-legacy", status: "estudei", tempo: 25, notas: "remota" },
    ]);
    expect(storeModule.state.planejamento.planId).toBe("rfplan_local");
    expect(storeModule.state.planejamento.retaFinal.blocos).toHaveLength(180);
    expect(
      syncCenter.mergeStudyStates.mock.calls[0][1].planejamento,
    ).toBeUndefined();
    const sync = storeModule.state.config.firestoreSync;
    expect(sync.basePlan).toMatchObject({ planId: "rfplan_local", revision: 0 });
    expect(sync.baseRevision).toBe(0);
    expect(sync.snapshotRevision).toBe(0);
    expect(sync.baseRemoteUpdatedAt).toBe(remote.payloadUpdatedAt);
    expect(sync.conflict).toBeNull();
    expect(outbox.saveFirestoreConflict).not.toHaveBeenCalled();
    expect(statuses()).toContain("synced");
  });

  it("does not re-apply an adoption already recorded in the local base", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });
    syncCenter.mergeStudyStates.mockImplementation((local) => ({
      ...local,
      config: { ...local.config },
    }));

    expect(await engine.pollFirestoreRemote()).toBe(true);
    const calls = syncCenter.mergeStudyStates.mock.calls.length;

    expect(await engine.pollFirestoreRemote()).toBe(false);
    expect(syncCenter.mergeStudyStates.mock.calls.length).toBe(calls);
    expect(outbox.saveFirestoreConflict).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotSynced).toHaveBeenCalledTimes(1);
  });

  it("does not clear the outbox when a write lands during a legacy adoption", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });
    syncCenter.mergeStudyStates.mockImplementation((local) => ({
      ...local,
      config: { ...local.config },
    }));
    const pendingEnvelope = {
      version: 1,
      deviceId: "web-device1",
      sentAt: "race-write",
      payloadUpdatedAt: "2026-10-23T00:00:00.000Z",
      payload: { planejamento: localPlan },
    };
    outbox.getPendingFirestoreSnapshot
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: "latest_snapshot",
        status: "pending",
        attempts: 0,
        envelope: pendingEnvelope,
      });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "pending-outbox" }),
    );
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
  });

  it("blocks the adoption when the legacy planning diverges materially", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    localPlan.retaFinal.blocos[10] = {
      ...localPlan.retaFinal.blocos[10],
      minutos: 120,
    };
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(syncCenter.mergeStudyStates).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotSynced).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "reta-final-conflict",
        cause: "legacy-plan-mismatch",
      }),
    );
    const saved = outbox.saveFirestoreConflict.mock.calls[0][0];
    expect(saved.reason).toContain("anterior ao schema v2");
    expect(saved.differences).toContain(
      "retaFinal.blocos.rf_010.minutos",
    );
    expect(storeModule.state.planejamento).toBe(localPlan);
    expect(storeModule.state.config.firestoreSync.basePlan).toBeNull();
    expect(statuses()).toContain("conflict");
  });

  it("clears a persisted 9.71 missing-remote-plan conflict on the normal poll", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    remote.payload.eventos = [
      { id: "ev_legacy", status: "estudei", tempo: 25 },
    ];
    const persisted = {
      type: "reta-final-conflict",
      cause: "missing-remote-plan",
      detectedAt: "2026-10-26T18:00:00.000Z",
      planId: localPlan.planId,
      localPlan,
      remotePlan: legacy,
    };
    await boot({ plan: localPlan, remote, conflict: persisted });
    syncCenter.mergeStudyStates.mockImplementation((local, remotePayload) => ({
      ...local,
      eventos: [...(local.eventos || []), ...(remotePayload.eventos || [])],
      config: { ...local.config },
    }));

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(true);
    const sync = storeModule.state.config.firestoreSync;
    expect(sync.conflict).toBeNull();
    expect(sync.basePlan).toMatchObject({ planId: "rfplan_local", revision: 0 });
    expect(sync.baseRevision).toBe(0);
    expect(sync.snapshotRevision).toBe(0);
    expect(sync.baseRemoteUpdatedAt).toBe(remote.payloadUpdatedAt);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.clearFirestoreConflict).toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotSynced).toHaveBeenCalled();
    expect(storeModule.state.eventos).toContainEqual({
      id: "ev_legacy",
      status: "estudei",
      tempo: 25,
    });
    expect(storeModule.state.planejamento.planId).toBe("rfplan_local");
    expect(storeModule.state.planejamento.retaFinal.blocos).toHaveLength(180);
    expect(storeModule.saveStateToDB).toHaveBeenCalled();
  });

  it("keeps a persisted missing-remote-plan conflict blocked when the legacy plan diverges", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    localPlan.retaFinal.blocos[9] = {
      ...localPlan.retaFinal.blocos[9],
      minutos: 120,
    };
    const remote = legacyRfEnvelope(legacy);
    const persisted = {
      type: "reta-final-conflict",
      cause: "missing-remote-plan",
      detectedAt: "2026-10-26T18:00:00.000Z",
      planId: localPlan.planId,
      localPlan,
      remotePlan: legacy,
    };
    await boot({ plan: localPlan, remote, conflict: persisted });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    const sync = storeModule.state.config.firestoreSync;
    expect(sync.conflict).toMatchObject({ cause: "legacy-plan-mismatch" });
    expect(sync.basePlan).toBeNull();
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(storeModule.state.planejamento).toBe(localPlan);
  });

  it("clears a persisted missing-remote-plan conflict on the normal auto pull", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    const persisted = {
      type: "reta-final-conflict",
      cause: "missing-remote-plan",
      detectedAt: "2026-10-26T18:00:00.000Z",
      planId: localPlan.planId,
      localPlan,
      remotePlan: legacy,
    };
    await boot({ plan: localPlan, remote, conflict: persisted });
    syncCenter.mergeStudyStates.mockImplementation((local) => ({
      ...local,
      config: { ...local.config },
    }));

    const result = await engine.autoPullRemoteWhenNewer();

    expect(result).toBe(true);
    expect(storeModule.state.config.firestoreSync.conflict).toBeNull();
    expect(storeModule.state.config.firestoreSync.baseRevision).toBe(0);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
  });

  it("recovers a persisted missing-remote-plan conflict through normal sync now", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    const persisted = {
      type: "reta-final-conflict",
      cause: "missing-remote-plan",
      detectedAt: "2026-10-26T18:00:00.000Z",
      planId: localPlan.planId,
      localPlan,
      remotePlan: legacy,
    };
    await boot({ plan: localPlan, remote, conflict: persisted });
    syncCenter.mergeStudyStates.mockImplementation((local) => ({
      ...local,
      config: { ...local.config },
    }));

    const result = await engine.syncFirestoreNow();

    expect(result).toBe(true);
    expect(repository.verifyRetaFinalGuard).toHaveBeenCalled();
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.retaFinalSync).toMatchObject({
      planId: "rfplan_local",
      baseRevision: 0,
      snapshotRevision: 1,
      baseSnapshotRevision: 0,
      state: "active",
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
    });
    expect(storeModule.state.config.firestoreSync.conflict).toBeNull();
    expect(storeModule.state.config.firestoreSync.snapshotRevision).toBe(1);
    expect(storeModule.state.planejamento.retaFinal.blocos).toHaveLength(180);
    expect(outbox.saveFirestoreConflict).not.toHaveBeenCalled();
  });

  it("keeps missing-remote-plan when the legacy document has no planning", async () => {
    const localPlan = localV2FromLegacy(legacyRfPlan());
    const remote = legacyRfEnvelope(legacyRfPlan());
    delete remote.payload.planejamento;
    await boot({ plan: localPlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "missing-remote-plan" }),
    );
    expect(storeModule.state.planejamento).toBe(localPlan);
  });

  it("distinguishes a malformed legacy planning from an absent one", async () => {
    const localPlan = localV2FromLegacy(legacyRfPlan());
    const remote = legacyRfEnvelope(legacyRfPlan());
    remote.payload.planejamento = { ativo: true, tipo: "reta_final" };
    await boot({ plan: localPlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "invalid-remote-plan" }),
    );
    expect(storeModule.state.planejamento).toBe(localPlan);
  });

  it("refuses an adoption push over a divergent legacy planning", async () => {
    const remoteLegacy = legacyRfPlan();
    const localLegacy = legacyRfPlan();
    localLegacy.retaFinal.blocos[4].minutos = 120;
    const localPlan = localV2FromLegacy(localLegacy);
    const remote = legacyRfEnvelope(remoteLegacy);
    await boot({ plan: localPlan, remote });
    storeModule.state.config.firestoreSync.remoteUpdatedAt =
      remote.payloadUpdatedAt;

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);
    const queued = await outbox.getPendingFirestoreSnapshot();
    expect(queued.envelope.retaFinalSync).toMatchObject({
      baseRevision: 0,
      snapshotRevision: 1,
      baseSnapshotRevision: 0,
      state: "active",
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "legacy-plan-mismatch" }),
    );
    expect(outbox.saveFirestoreConflict.mock.calls[0][0].reason).toContain(
      "anterior ao schema v2",
    );
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
    expect(storeModule.state.config.firestoreSync.hasPendingWrites).toBe(true);
  });

  it("publishes the v2 adoption over an equivalent legacy planning", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });
    storeModule.state.config.firestoreSync.remoteUpdatedAt =
      remote.payloadUpdatedAt;

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.retaFinalSync).toMatchObject({
      planId: "rfplan_local",
      revision: 0,
      baseRevision: 0,
      snapshotRevision: 1,
      baseSnapshotRevision: 0,
      state: "active",
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
    });
    expect(outbox.markFirestoreSnapshotSynced).toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync).toMatchObject({
      baseRevision: 0,
      snapshotRevision: 1,
      conflict: null,
    });
  });

  it("blocks the adoption when the legacy document changed after the read", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });
    storeModule.state.config.firestoreSync.remoteUpdatedAt =
      remote.payloadUpdatedAt;

    await engine.queueFirestoreSnapshotFromState(storeModule.state, {
      manual: true,
    });
    remote.payloadUpdatedAt = "2026-10-23T09:00:00.000Z";

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: "adoption-base",
        reason: expect.stringContaining("payloadUpdatedAt diferente"),
      }),
    );
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
  });

  it("syncs the real missing-remote-plan case end-to-end", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });
    syncCenter.mergeStudyStates.mockImplementation((local) => ({
      ...local,
      config: { ...local.config },
    }));

    const result = await engine.syncFirestoreNow();

    expect(result).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.retaFinalSync).toMatchObject({
      planId: "rfplan_local",
      revision: 0,
      baseRevision: 0,
      snapshotRevision: 1,
      baseSnapshotRevision: 0,
      state: "active",
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
    });
    expect(storeModule.state.planejamento.retaFinal.blocos).toHaveLength(180);
    expect(outbox.saveFirestoreConflict).not.toHaveBeenCalled();
    expect(statuses()).toContain("synced");
  });

  it("keeps the verified legacy base on a forced pull", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });
    syncCenter.mergeStudyStates.mockImplementation((local) => ({
      ...local,
      config: { ...local.config },
    }));

    const result = await engine.pullFromFirestore(true, {
      discardPending: true,
    });

    expect(result).toBe(true);
    expect(storeModule.state.config.firestoreSync).toMatchObject({
      baseRevision: 0,
      snapshotRevision: 0,
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
      conflict: null,
    });
    expect(
      storeModule.state.config.firestoreSync.basePlan.planId,
    ).toBe("rfplan_local");
  });

  it("does not let a forced pull bypass a divergent legacy planning", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    localPlan.retaFinal.blocos[8] = {
      ...localPlan.retaFinal.blocos[8],
      notas: "Editado localmente",
    };
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });

    const result = await engine.pullFromFirestore(true, {
      discardPending: true,
    });

    expect(result).toBe(false);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "legacy-plan-mismatch" }),
    );
    expect(storeModule.state.planejamento).toBe(localPlan);
  });

  it("refuses a descriptor-less push over a legacy Reta Final plan", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });
    await outbox.enqueueFirestoreSnapshot({
      version: 1,
      schemaVersion: 6,
      deviceId: "web-device1",
      payloadUpdatedAt: "2026-10-23T00:00:00.000Z",
      sentAt: "2026-10-23T00:00:00.000Z",
      payload: { planejamento: legacy, eventos: [] },
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "legacy-write" }),
    );
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
  });

  it("refuses adopting over a v2 remote planning without a descriptor", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remotePlan = JSON.parse(JSON.stringify(localPlan));
    remotePlan.revision = 5;
    remotePlan.retaFinal.blocos[0].minutos = 30;
    const remote = {
      ...legacyRfEnvelope(legacy),
      payload: { planejamento: remotePlan, config: {}, eventos: [] },
    };
    await boot({ plan: localPlan, remote });
    storeModule.state.config.firestoreSync.remoteUpdatedAt =
      remote.payloadUpdatedAt;

    await engine.queueFirestoreSnapshotFromState(storeModule.state, {
      manual: true,
    });
    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "invalid-remote-plan" }),
    );
  });

  it("does not adopt a legacy plan for a retired local planning", async () => {
    const legacy = legacyRfPlan({ ativo: false });
    const localPlan = localV2FromLegacy(legacy);
    expect(localPlan.ativo).toBe(false);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });

    const result = await engine.pollFirestoreRemote();

    expect(result).toBe(false);
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "missing-remote-plan" }),
    );
    expect(storeModule.state.config.firestoreSync.basePlan).toBeNull();
  });

  it("keeps replace semantics on a forced legacy adoption", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    remote.payload.eventos = [
      { id: "ev_remote", status: "estudei", tempo: 10 },
    ];
    await boot({ plan: localPlan, remote });
    storeModule.state.eventos = [
      { id: "ev_local", status: "estudei", tempo: 20 },
    ];

    const result = await engine.pullFromFirestore(true, {
      discardPending: true,
    });

    expect(result).toBe(true);
    expect(storeModule.state.eventos.map((item) => item.id)).toEqual([
      "ev_remote",
    ]);
    expect(storeModule.state.planejamento.planId).toBe("rfplan_local");
    expect(storeModule.state.planejamento.retaFinal.blocos).toHaveLength(180);
    expect(storeModule.state.config.firestoreSync.baseRevision).toBe(0);
  });

  it("repairs an oversized pending envelope and preserves later academic data", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, basePlan: localPlan, remote });
    const sync = storeModule.state.config.firestoreSync;
    sync.baseRemoteUpdatedAt = remote.payloadUpdatedAt;
    sync.remoteUpdatedAt = remote.payloadUpdatedAt;
    storeModule.state.eventos = [
      { id: "ev_a", status: "estudei", tempo: 10 },
    ];
    storeModule.state.editais = [{ id: "ed_1", nome: "TJPB" }];
    const pending = pendingEnvelopeFor(
      storeModule.state,
      localPlan,
      remote,
      "2026-10-26T20:00:00.000Z",
      true,
    );
    expect(getFirestoreEnvelopeSizeBytes(pending)).toBeGreaterThan(
      FIRESTORE_ENVELOPE_MAX_BYTES,
    );
    outbox.setPendingRecord({
      id: "latest_snapshot",
      status: "pending",
      attempts: 1,
      queuedAt: "2026-10-26T20:00:01.000Z",
      envelope: pending,
    });
    storeModule.state.eventos.push({
      id: "ev_b",
      status: "estudei",
      tempo: 20,
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(
      outbox.replacePendingFirestoreSnapshotEnvelope,
    ).toHaveBeenCalledWith(expect.any(Object), {
      queuedAt: "2026-10-26T20:00:01.000Z",
      sentAt: "2026-10-26T20:00:00.000Z",
    });
    expect(repository.verifyRetaFinalGuard).toHaveBeenCalled();
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.payload.config.manualSyncHistory).toBeUndefined();
    expect(getFirestoreEnvelopeSizeBytes(written)).toBeLessThan(
      FIRESTORE_ENVELOPE_MAX_BYTES,
    );
    expect(written.payload.planejamento.retaFinal.blocos).toHaveLength(180);
    expect(written.payload.eventos.map((item) => item.id)).toEqual(
      expect.arrayContaining(["ev_a", "ev_b"]),
    );
    expect(written.payload.editais.map((item) => item.id)).toContain("ed_1");
    expect(written.retaFinalSync).toMatchObject({
      planId: "rfplan_local",
      baseRevision: 0,
      snapshotRevision: 1,
      baseSnapshotRevision: 0,
      state: "active",
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
    });
    expect(computeRetaFinalPlanDigest(written.payload.planejamento)).toBe(
      computeRetaFinalPlanDigest(localPlan),
    );
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
    expect(storeModule.state.config.firestoreSync.conflict).toBeNull();

    expect(await engine.flushFirestoreOutbox({ manual: true })).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("keeps a repaired pending snapshot blocked when the legacy plan diverges", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    localPlan.retaFinal.blocos[3] = {
      ...localPlan.retaFinal.blocos[3],
      minutos: 120,
    };
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, basePlan: localPlan, remote });
    storeModule.state.config.firestoreSync.baseRemoteUpdatedAt =
      remote.payloadUpdatedAt;
    const pending = pendingEnvelopeFor(
      storeModule.state,
      localPlan,
      remote,
      "2026-10-26T20:00:00.000Z",
      true,
    );
    outbox.setPendingRecord({
      id: "latest_snapshot",
      status: "pending",
      attempts: 1,
      queuedAt: "2026-10-26T20:00:01.000Z",
      envelope: pending,
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "legacy-plan-mismatch" }),
    );
    const remaining = await outbox.getPendingFirestoreSnapshot();
    expect(remaining).not.toBeNull();
    expect(remaining.envelope.payload.config.manualSyncHistory).toBeUndefined();
    expect(getFirestoreEnvelopeSizeBytes(remaining.envelope)).toBeLessThan(
      FIRESTORE_ENVELOPE_MAX_BYTES,
    );
  });

  it("uses a newer pending snapshot instead of overwriting it during repair", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, basePlan: localPlan, remote });
    storeModule.state.config.firestoreSync.baseRemoteUpdatedAt =
      remote.payloadUpdatedAt;
    const oldPending = pendingEnvelopeFor(
      storeModule.state,
      localPlan,
      remote,
      "2026-10-26T20:00:00.000Z",
      true,
    );
    const newer = pendingEnvelopeFor(
      storeModule.state,
      localPlan,
      remote,
      "2026-10-26T20:10:00.000Z",
      false,
    );
    outbox.setPendingRecord({
      id: "latest_snapshot",
      status: "pending",
      attempts: 1,
      queuedAt: "2026-10-26T20:00:01.000Z",
      envelope: oldPending,
    });
    outbox.replacePendingFirestoreSnapshotEnvelope.mockImplementation(async () => {
      outbox.setPendingRecord({
        id: "latest_snapshot",
        status: "pending",
        attempts: 0,
        queuedAt: "2026-10-26T20:10:01.000Z",
        envelope: newer,
      });
      return false;
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.sentAt).toBe("2026-10-26T20:10:00.000Z");
    expect(written.payload.config.manualSyncHistory).toBeUndefined();
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
  });

  it("preserves local manual sync history on a forced adoption pull", async () => {
    const legacy = legacyRfPlan();
    const localPlan = localV2FromLegacy(legacy);
    const remote = legacyRfEnvelope(legacy);
    await boot({ plan: localPlan, remote });
    storeModule.state.config.manualSyncHistory = [{ at: "local-history" }];
    storeModule.state.config.lastManualSyncResults = { at: "local-last" };

    const result = await engine.pullFromFirestore(true, {
      discardPending: true,
    });

    expect(result).toBe(true);
    expect(storeModule.state.config.manualSyncHistory).toEqual([
      { at: "local-history" },
    ]);
    expect(storeModule.state.config.lastManualSyncResults).toEqual({
      at: "local-last",
    });
  });

  it("blocks an academic envelope still above 1 MiB without trimming data", async () => {
    const localPlan = localV2FromLegacy(legacyRfPlan());
    await boot({ plan: localPlan, remote: legacyRfEnvelope(legacyRfPlan()) });
    storeModule.state.editais = [
      { id: "ed_huge", nome: "Huge", conteudo: "x".repeat(1100000) },
    ];

    const result = await engine.queueFirestoreSnapshotFromState(
      storeModule.state,
      { manual: true },
    );

    expect(result).toBe(false);
    expect(outbox.enqueueFirestoreSnapshot).not.toHaveBeenCalled();
    expect(storeModule.state.config.firestoreSync.lastError).toContain(
      "segmentacao necessaria",
    );
    expect(storeModule.state.editais[0].conteudo).toHaveLength(1100000);
  });

  function addLocalOperationalMetadata() {
    Object.assign(storeModule.state.config, {
      manualSyncHistory: [{ at: "local-history", conflicts: { firestore: { cause: "x" } } }],
      lastManualSyncResults: { at: "local-last" },
      cfUrl: "https://local.example",
      cfToken: "local-token",
      cfTokenSaved: true,
      cfConflict: { cause: "local" },
      cfRemoteUpdatedAt: "2026-10-26T20:00:00.000Z",
      cfLastSyncAt: "2026-10-26T20:00:00.000Z",
      cfSyncEnabled: true,
    });
    storeModule.state.driveFileId = "drive-local";
    storeModule.state.lastSync = "2026-10-26T20:00:00.000Z";
  }

  it("does not re-merge when only local operational metadata differs", async () => {
    const basePlan = makePlan({ revision: 1, minutos: 40 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 40 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });
    addLocalOperationalMetadata();
    syncCenter.mergeStudyStates.mockImplementation((local) => ({
      ...local,
      config: { ...local.config },
    }));

    const result = await engine.mergeFromFirestore();

    expect(result).toBe(false);
    expect(outbox.enqueueFirestoreSnapshot).not.toHaveBeenCalled();
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(storeModule.state.config.manualSyncHistory).toEqual([
      { at: "local-history", conflicts: { firestore: { cause: "x" } } },
    ]);
  });

  it("does not re-send when only local operational metadata differs", async () => {
    const basePlan = makePlan({ revision: 1, minutos: 40 });
    const localPlan = makePlan({ revision: 2, minutos: 40 });
    const remotePlan = makePlan({ revision: 2, minutos: 40 });
    const remote = envelopeFor(remotePlan, { revision: 2, baseRevision: 1 });
    await boot({ plan: localPlan, basePlan, remote });
    addLocalOperationalMetadata();
    syncCenter.mergeStudyStates.mockImplementation((local) => ({
      ...local,
      config: { ...local.config },
    }));

    await engine.syncFirestoreNow();

    expect(outbox.enqueueFirestoreSnapshot).not.toHaveBeenCalled();
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(storeModule.state.config.manualSyncHistory).toEqual([
      { at: "local-history", conflicts: { firestore: { cause: "x" } } },
    ]);
  });

  async function bootStaleAdoption({
    localEvents = [],
    remoteEvents = [],
    pendingEvents = [],
    localEditais = [],
    remoteEditais = [],
    pendingEditais = [],
    mutateLocalPlan = null,
  } = {}) {
    const basePlan = localV2FromLegacy(legacyRfPlan());
    const remotePlan = cloneJson(basePlan);
    const pendingPlan = cloneJson(basePlan);
    const localPlan = cloneJson(basePlan);
    if (mutateLocalPlan) mutateLocalPlan(localPlan);
    const remote = adoptionEnvelope({
      plan: remotePlan,
      payloadUpdatedAt: "2026-10-27T17:08:44.079Z",
      events: remoteEvents,
      editais: remoteEditais,
      deviceId: "remote-device",
    });
    const pending = adoptionEnvelope({
      plan: pendingPlan,
      payloadUpdatedAt: "2026-10-27T17:09:00.748Z",
      events: pendingEvents,
      editais: pendingEditais,
      deviceId: "web-device1",
      baseRemoteUpdatedAt: "2026-10-22T17:45:50.000Z",
    });
    await boot({ plan: localPlan, basePlan: localPlan, remote });
    const sync = storeModule.state.config.firestoreSync;
    sync.snapshotRevision = 1;
    sync.baseRevision = 0;
    sync.baseRemoteUpdatedAt = remote.payloadUpdatedAt;
    sync.remoteUpdatedAt = remote.payloadUpdatedAt;
    storeModule.state.eventos = cloneJson(localEvents);
    storeModule.state.editais = cloneJson(localEditais);
    storeModule.state.arquivo = [];
    storeModule.state.revisoes = [];
    outbox.setPendingRecord({
      id: "latest_snapshot",
      status: "pending",
      attempts: 0,
      queuedAt: "2026-10-27T17:09:10.561Z",
      envelope: pending,
    });
    syncCenter.mergeStudyStates.mockImplementation(mergeAcademicCollections);
    return { basePlan, remotePlan, pendingPlan, localPlan, remote, pending };
  }

  it("rebases a stale adoption outbox onto the current remote snapshot", async () => {
    const { remote, localPlan } = await bootStaleAdoption({
      localEvents: [
        { id: "ev_pending", notas: "pending", updatedAt: "2026-10-27T17:08:00.000Z" },
        { id: "ev_local", notas: "local", updatedAt: "2026-10-27T17:10:00.000Z" },
        { id: "ev_edit", notas: "local-edit", updatedAt: "2026-10-27T17:10:00.000Z" },
      ],
      pendingEvents: [
        { id: "ev_pending", notas: "pending", updatedAt: "2026-10-27T17:08:00.000Z" },
        { id: "ev_edit", notas: "base", updatedAt: "2026-10-27T17:05:00.000Z" },
      ],
      remoteEvents: [
        { id: "ev_remote", notas: "remote", updatedAt: "2026-10-27T17:07:00.000Z" },
        { id: "ev_edit", notas: "base", updatedAt: "2026-10-27T17:05:00.000Z" },
      ],
      localEditais: [{ id: "ed_pending" }, { id: "ed_local" }],
      pendingEditais: [{ id: "ed_pending" }],
      remoteEditais: [{ id: "ed_remote" }],
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(outbox.replacePendingFirestoreSnapshotEnvelope).toHaveBeenCalledWith(
      expect.any(Object),
      {
        queuedAt: "2026-10-27T17:09:10.561Z",
        sentAt: "2026-10-27T17:09:00.748Z",
      },
    );
    expect(repository.verifyRetaFinalGuard).toHaveBeenCalled();
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.retaFinalSync).toMatchObject({
      planId: localPlan.planId,
      revision: 0,
      baseRevision: 0,
      snapshotRevision: 2,
      baseSnapshotRevision: 1,
      state: "active",
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
    });
    expect(written.payload.planejamento).toEqual(remote.payload.planejamento);
    expect(written.payload.eventos.map((item) => item.id).sort()).toEqual([
      "ev_edit",
      "ev_local",
      "ev_pending",
      "ev_remote",
    ]);
    expect(
      written.payload.eventos.find((item) => item.id === "ev_edit").notas,
    ).toBe("local-edit");
    expect(written.payload.editais.map((item) => item.id).sort()).toEqual([
      "ed_local",
      "ed_pending",
      "ed_remote",
    ]);
    expect(storeModule.state.config.firestoreSync.conflict).toBeNull();
    expect(storeModule.state.config.firestoreSync.snapshotRevision).toBe(2);
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();

    expect(await engine.flushFirestoreOutbox({ manual: true })).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
  });

  it("acknowledges a stale adoption outbox when the current payload is already remote", async () => {
    const events = [
      { id: "ev_remote", notas: "remote", updatedAt: "2026-10-27T17:07:00.000Z" },
    ];
    await bootStaleAdoption({
      localEvents: events,
      pendingEvents: events,
      remoteEvents: events,
      localEditais: [{ id: "ed_remote" }],
      pendingEditais: [{ id: "ed_remote" }],
      remoteEditais: [{ id: "ed_remote" }],
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.replacePendingFirestoreSnapshotEnvelope).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotSynced).toHaveBeenCalled();
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
    expect(storeModule.state.config.firestoreSync.conflict).toBeNull();
    expect(storeModule.state.config.firestoreSync.lastPushAt).toBeNull();
  });

  it("fails closed when the stale outbox contains a real academic divergence", async () => {
    await bootStaleAdoption({
      localEvents: [{ id: "ev_shared", notas: "local" }],
      pendingEvents: [{ id: "ev_shared", notas: "base" }],
      remoteEvents: [{ id: "ev_shared", notas: "remote" }],
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.replacePendingFirestoreSnapshotEnvelope).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "outbox-rebase-unsafe" }),
    );
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
  });

  it("rebases a stale adoption outbox when only derived projections changed", async () => {
    // syncRetaFinalToEventos materializes the schedule projection (data,
    // status, rolagens) inside the plan without bumping `revision`. A second
    // device can therefore carry different projections for the same intent.
    const { remote } = await bootStaleAdoption({
      localEvents: [{ id: "ev_local", notas: "local" }],
      pendingEvents: [{ id: "ev_pending", notas: "pending" }],
      remoteEvents: [{ id: "ev_remote", notas: "remote" }],
      mutateLocalPlan: (plan) => {
        plan.retaFinal.blocos[3].data = "2026-10-27";
        plan.retaFinal.blocos[3].status = "atrasado";
        plan.retaFinal.blocos[3].rolagens = 2;
        plan.retaFinal.blocos[3].dataEfetiva = "2026-10-27";
      },
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.retaFinalSync).toMatchObject({
      revision: 0,
      baseRevision: 0,
      snapshotRevision: 2,
      baseSnapshotRevision: 1,
      digest: remote.retaFinalSync.digest,
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
    });
    // The wire payload keeps the remote plan verbatim; rules compare the map.
    expect(written.payload.planejamento).toEqual(remote.payload.planejamento);
    // The local projection is not destroyed by the rebase.
    expect(storeModule.state.planejamento.retaFinal.blocos[3].status).toBe(
      "atrasado",
    );
    // The merged academic content written to the remote also lands locally;
    // otherwise the next academic-only push would delete it there.
    expect(storeModule.state.eventos.map((item) => item.id).sort()).toEqual([
      "ev_local",
      "ev_pending",
      "ev_remote",
    ]);
    expect(storeModule.state.config.firestoreSync.snapshotRevision).toBe(2);
    expect(storeModule.state.config.firestoreSync.conflict).toBeNull();
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
  });

  it("fails closed with a stable subcause when the plan intent changed", async () => {
    await bootStaleAdoption({
      mutateLocalPlan: (plan) => {
        plan.retaFinal.blocos[3].dataPlanejada = "2026-12-31";
        plan.retaFinal.blocos[3].minutos = 90;
      },
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: "outbox-rebase-unsafe",
        subcause: "plan-intent-divergence",
        differences: expect.arrayContaining([
          "retaFinal.blocos.rf_003.dataPlanejada",
          "retaFinal.blocos.rf_003.minutos",
        ]),
      }),
    );
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
  });

  it("acknowledges the outbox when only projections changed and academic data is applied", async () => {
    const events = [{ id: "ev_remote", notas: "remote" }];
    await bootStaleAdoption({
      localEvents: events,
      pendingEvents: events,
      remoteEvents: events,
      mutateLocalPlan: (plan) => {
        plan.retaFinal.blocos[7].data = "2026-10-27";
      },
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.markFirestoreSnapshotSynced).toHaveBeenCalled();
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
    expect(storeModule.state.config.firestoreSync.conflict).toBeNull();
  });

  it("queues the verified base plan and its wire digest when only projections drifted", async () => {
    const plan = makePlan({ revision: 0 });
    const basePlan = makePlan({ revision: 0 });
    basePlan.retaFinal.blocos[0].status = "atrasado";
    basePlan.retaFinal.blocos[0].data = "2026-10-20";
    await boot({ plan, basePlan, remote: null });
    const sync = storeModule.state.config.firestoreSync;
    sync.baseRemoteDigest = "ab12cd34ef56ab78";
    sync.snapshotRevision = 0;

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);

    const envelope = outbox.enqueueFirestoreSnapshot.mock.calls.at(-1)[0];
    expect(envelope.payload.planejamento).toEqual(basePlan);
    expect(envelope.retaFinalSync).toMatchObject({
      revision: 0,
      baseRevision: 0,
      snapshotRevision: 1,
      baseSnapshotRevision: 0,
      digest: "ab12cd34ef56ab78",
    });
  });

  it("copies the remote tombstone fields verbatim on an academic-only push", async () => {
    const plan = makePlan({ revision: 0 });
    const basePlan = makePlan({ revision: 0 });
    await boot({ plan, basePlan, remote: null });
    Object.assign(storeModule.state.config.firestoreSync, {
      baseRemoteDigest: "ab12cd34ef56ab78",
      baseRemovedBlockIds: ["rf_removed_2", "rf_removed_1"],
      baseMinRetainedRevision: null,
      snapshotRevision: 0,
    });

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);

    const envelope = outbox.enqueueFirestoreSnapshot.mock.calls.at(-1)[0];
    expect(envelope.retaFinalSync.removedBlockIds).toEqual([
      "rf_removed_2",
      "rf_removed_1",
    ]);
    expect(
      Object.hasOwn(envelope.retaFinalSync, "minRetainedRevision"),
    ).toBe(false);
  });

  it("never produces a negative retention floor from a revision-0 tombstone", async () => {
    const basePlan = makePlan({ revision: 0 });
    const plan = makePlan({ revision: 0 });
    plan.retaFinal.blocos = [];
    await boot({ plan, basePlan, remote: null });
    storeModule.state.config.firestoreSync.snapshotRevision = 0;

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);

    const envelope = outbox.enqueueFirestoreSnapshot.mock.calls.at(-1)[0];
    expect(envelope.retaFinalSync.removedBlockIds).toContain("b1");
    expect(envelope.retaFinalSync.minRetainedRevision).toBe(0);
  });

  it("does not replace an outbox from another snapshot lineage", async () => {
    const plan = makePlan({ revision: 0 });
    const basePlan = makePlan({ revision: 0 });
    const pendingEnvelope = envelopeFor(plan, {
      baseRevision: 0,
      snapshotRevision: 1,
      baseSnapshotRevision: 0,
    });
    await boot({
      plan,
      basePlan,
      pendingRecord: {
        id: "latest_snapshot",
        status: "pending",
        attempts: 1,
        queuedAt: "2026-10-27T17:09:10.561Z",
        envelope: pendingEnvelope,
      },
    });
    storeModule.state.config.firestoreSync.snapshotRevision = 2;

    const result = await engine.queueFirestoreSnapshotFromState(
      storeModule.state,
      { manual: true },
    );

    expect(result).toBe(false);
    expect(outbox.enqueueFirestoreSnapshot).not.toHaveBeenCalled();
    expect((await outbox.getPendingFirestoreSnapshot()).queuedAt).toBe(
      "2026-10-27T17:09:10.561Z",
    );
    expect(statuses()).toContain("pending");
  });

  it("coalesces a same-slot update without resetting the outbox identity", async () => {
    const plan = makePlan({ revision: 0 });
    const basePlan = makePlan({ revision: 0 });
    const pendingEnvelope = envelopeFor(plan, {
      baseRevision: 0,
      snapshotRevision: 1,
      baseSnapshotRevision: 0,
    });
    await boot({
      plan,
      basePlan,
      pendingRecord: {
        id: "latest_snapshot",
        status: "pending",
        attempts: 2,
        queuedAt: "q1",
        envelope: pendingEnvelope,
      },
    });
    storeModule.state.eventos = [{ id: "ev_new", notas: "nova" }];

    expect(
      await engine.queueFirestoreSnapshotFromState(storeModule.state, {
        manual: true,
      }),
    ).toBe(true);
    expect(outbox.enqueueFirestoreSnapshot).toHaveBeenCalledWith(
      expect.any(Object),
      {
        expected: { queuedAt: "q1", sentAt: pendingEnvelope.sentAt },
        academicOnly: true,
      },
    );
  });

  it("recovers a persisted 9.76 outbox-rebase-unsafe through normal sync now", async () => {
    await bootStaleAdoption({
      localEvents: [{ id: "ev_local" }],
      pendingEvents: [{ id: "ev_pending" }],
      remoteEvents: [{ id: "ev_remote" }],
      mutateLocalPlan: (planValue) => {
        planValue.retaFinal.blocos[5].data = "2026-10-27";
      },
    });
    storeModule.state.config.firestoreSync.conflict = {
      type: "reta-final-conflict",
      cause: "outbox-rebase-unsafe",
      subcause: "local-plan-not-exact",
      detectedAt: "2026-10-27T17:09:30.000Z",
    };
    storeModule.state.config.firestoreSync.hasPendingWrites = true;

    const result = await engine.syncFirestoreNow();

    expect(result).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    expect(storeModule.state.config.firestoreSync.conflict).toBeNull();
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
  });

  it("revalidates the remote before writing and keeps the outbox when it changed", async () => {
    const { remote } = await bootStaleAdoption({
      localEvents: [{ id: "ev_local" }],
      pendingEvents: [{ id: "ev_pending" }],
      remoteEvents: [{ id: "ev_remote" }],
      mutateLocalPlan: (planValue) => {
        planValue.retaFinal.blocos[9].data = "2026-10-27";
      },
    });
    const changed = JSON.parse(JSON.stringify(remote));
    changed.payloadUpdatedAt = "2026-10-27T17:30:00.000Z";
    changed.retaFinalSync.snapshotRevision = 2;
    changed.retaFinalSync.baseSnapshotRevision = 1;
    changed.payload.eventos = [{ id: "ev_other", notas: "other" }];
    repository.readFirestoreSnapshot
      .mockResolvedValueOnce(remote)
      .mockResolvedValue(changed);

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(false);
    expect(repository.writeFirestoreSnapshot).not.toHaveBeenCalled();
    expect(outbox.saveFirestoreConflict).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "remote-changed-during-recovery" }),
    );
    expect(await outbox.getPendingFirestoreSnapshot()).not.toBeNull();
  });

  it("keeps a running timer when the rebase merge picks the remote event", async () => {
    const baseEvent = {
      id: "ev_timer",
      tempoAcumulado: 300,
      updatedAt: "2026-10-27T17:08:00.000Z",
    };
    await bootStaleAdoption({
      localEvents: [
        {
          ...baseEvent,
          updatedAt: "2026-10-27T17:09:00.000Z",
          _timerStart: 1793125000000,
        },
      ],
      pendingEvents: [baseEvent],
      remoteEvents: [baseEvent],
      mutateLocalPlan: (planValue) => {
        planValue.retaFinal.blocos[1].data = "2026-10-27";
      },
    });
    syncCenter.mergeStudyStates.mockImplementation((local, remoteState) => {
      const merged = {
        ...local,
        ...(remoteState || {}),
        config: { ...(remoteState?.config || {}), ...(local.config || {}) },
        planejamento: local.planejamento,
      };
      const map = new Map(
        (remoteState?.eventos || []).map((item) => [item.id, item]),
      );
      for (const item of local.eventos || []) map.set(item.id, item);
      merged.eventos = [...map.values()].map(({ _timerStart, ...rest }) => rest);
      return merged;
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(
      written.payload.eventos.find((item) => item.id === "ev_timer")
        ._timerStart,
    ).toBe(1793125000000);
  });

  it("recovers the same persisted outbox after a reload", async () => {
    const { localPlan, basePlan, remote } = await bootStaleAdoption({
      localEvents: [{ id: "ev_local" }],
      pendingEvents: [{ id: "ev_pending" }],
      remoteEvents: [{ id: "ev_remote" }],
      mutateLocalPlan: (planValue) => {
        planValue.retaFinal.blocos[6].data = "2026-10-27";
        planValue.retaFinal.blocos[6].status = "atrasado";
      },
    });
    repository.verifyRetaFinalGuard.mockResolvedValueOnce({
      verified: false,
      reason: "guard-unavailable",
    });

    expect(await engine.flushFirestoreOutbox({ manual: true })).toBe(false);
    const persisted = await outbox.getPendingFirestoreSnapshot();
    expect(persisted).not.toBeNull();

    // Simulated reload: a new engine instance reads the persisted operation.
    vi.resetModules();
    await boot({ plan: localPlan, basePlan, remote });
    storeModule.state.config.firestoreSync.snapshotRevision = 1;
    storeModule.state.config.firestoreSync.baseRevision = 0;
    storeModule.state.config.firestoreSync.baseRemoteUpdatedAt =
      remote.payloadUpdatedAt;
    outbox.setPendingRecord(persisted);
    syncCenter.mergeStudyStates.mockImplementation(mergeAcademicCollections);

    expect(await engine.flushFirestoreOutbox({ manual: true })).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.retaFinalSync.snapshotRevision).toBe(2);
    expect(written.payload.planejamento).toEqual(remote.payload.planejamento);
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
  });

  it("does not overwrite an outbox changed during the stale replay repair", async () => {
    const { remotePlan, remote } = await bootStaleAdoption({
      localEvents: [{ id: "ev_local" }],
      pendingEvents: [{ id: "ev_pending" }],
      remoteEvents: [{ id: "ev_remote" }],
    });
    const newerDescriptor = buildRetaFinalSyncDescriptor({
      plan: remotePlan,
      baseRevision: 0,
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
      deviceId: "web-device1",
      capabilities: CAPABILITIES,
      state: "active",
      revision: 0,
      snapshotRevision: 2,
      baseSnapshotRevision: 1,
    });
    const newer = {
      version: 1,
      schemaVersion: 6,
      deviceId: "web-device1",
      baseRemoteUpdatedAt: remote.payloadUpdatedAt,
      payloadUpdatedAt: "2026-10-27T17:20:00.000Z",
      sentAt: "2026-10-27T17:20:00.000Z",
      retaFinalSync: newerDescriptor,
      payload: {
        planejamento: cloneJson(remotePlan),
        config: {},
        eventos: [{ id: "ev_newer" }],
        editais: [],
        arquivo: [],
        revisoes: [],
        disciplinas: [],
      },
    };
    outbox.replacePendingFirestoreSnapshotEnvelope.mockImplementation(async () => {
      outbox.setPendingRecord({
        id: "latest_snapshot",
        status: "pending",
        attempts: 0,
        queuedAt: "2026-10-27T17:20:01.000Z",
        envelope: newer,
      });
      return false;
    });

    const result = await engine.flushFirestoreOutbox({ manual: true });

    expect(result).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.sentAt).toBe("2026-10-27T17:20:00.000Z");
    expect(written.payload.eventos.map((item) => item.id)).toEqual([
      "ev_newer",
    ]);
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
  });

  it("recovers a persisted replay-payload-mismatch through normal sync now", async () => {
    await bootStaleAdoption({
      localEvents: [{ id: "ev_local" }],
      pendingEvents: [{ id: "ev_pending" }],
      remoteEvents: [{ id: "ev_remote" }],
    });
    storeModule.state.config.firestoreSync.conflict = {
      type: "reta-final-conflict",
      cause: "replay-payload-mismatch",
      detectedAt: "2026-10-27T17:09:30.000Z",
    };
    storeModule.state.config.firestoreSync.hasPendingWrites = true;

    const result = await engine.syncFirestoreNow();

    expect(result).toBe(true);
    expect(repository.writeFirestoreSnapshot).toHaveBeenCalledTimes(1);
    const written = repository.writeFirestoreSnapshot.mock.calls[0][2];
    expect(written.retaFinalSync).toMatchObject({
      revision: 0,
      baseRevision: 0,
      snapshotRevision: 2,
      baseSnapshotRevision: 1,
      state: "active",
    });
    expect(written.payload.eventos.map((item) => item.id).sort()).toEqual([
      "ev_local",
      "ev_pending",
      "ev_remote",
    ]);
    expect(storeModule.state.config.firestoreSync.conflict).toBeNull();
    expect(await outbox.getPendingFirestoreSnapshot()).toBeNull();
  });
});
