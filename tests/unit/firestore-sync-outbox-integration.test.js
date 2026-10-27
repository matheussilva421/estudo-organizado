import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRetaFinalSyncDescriptor,
  computeRetaFinalPlanDigest,
  getRetaFinalSyncCapabilities,
} from "../../src/js/sync/reta-final-protocol.js";
import { createFirestoreSnapshotEnvelope } from "../../src/js/sync/firestore-schema.js";

// Integration of the real outbox module (real transactions over an in-memory
// IndexedDB shape) with the engine. The unit suite mocks the outbox; this test
// proves that a persisted conflicting operation survives a reload, is rebased
// once, and that the second sync is a no-op.

const CAPABILITIES = getRetaFinalSyncCapabilities({});

function makePlan() {
  return {
    ativo: true,
    tipo: "reta_final",
    schemaVersionRetaFinal: 2,
    planId: "rfplan_it",
    generation: 1,
    revision: 0,
    updatedAt: "2026-10-27T17:00:00.000Z",
    retaFinal: {
      dataFinal: "2026-12-20",
      blocos: Array.from({ length: 6 }, (_, index) => ({
        id: "rf_" + index,
        discId: "d1",
        topicos: [{ assId: "a1" }],
        minutos: 45,
        ordem: index,
        dataOriginal: "2026-10-2" + index,
        dataPlanejada: "2026-10-2" + index,
        data: "2026-10-2" + index,
        status: "pendente",
        rolagens: 0,
      })),
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeIdb() {
  const stores = {
    outbox: new Map(),
    meta: new Map(),
    conflicts: new Map(),
  };
  const makeRequest = (work) => {
    const request = {};
    queueMicrotask(() => work(request));
    return request;
  };
  const db = {
    objectStoreNames: { contains: (name) => name in stores },
    transaction(names) {
      const name = Array.isArray(names) ? names[0] : names;
      const map = stores[name] || new Map();
      const tx = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => store,
      };
      const settle = () => {
        queueMicrotask(() => {
          tx.oncomplete?.();
        });
      };
      const store = {
        get(key) {
          return makeRequest((request) => {
            request.result = map.get(key) ?? null;
            request.onsuccess?.();
          });
        },
        put(entry) {
          return makeRequest((request) => {
            map.set(entry.id, entry);
            request.onsuccess?.();
            settle();
          });
        },
        delete(key) {
          return makeRequest((request) => {
            map.delete(key);
            request.onsuccess?.();
            settle();
          });
        },
      };
      return tx;
    },
  };
  return { db, stores };
}

function mergeAcademicCollections(local, remote) {
  const merged = {
    ...local,
    ...remote,
    config: { ...(remote.config || {}), ...(local.config || {}) },
    planejamento: local.planejamento,
  };
  for (const key of ["eventos", "editais", "revisoes", "arquivo"]) {
    const map = new Map((remote[key] || []).map((item) => [item.id, item]));
    for (const item of local[key] || []) map.set(item.id, item);
    merged[key] = [...map.values()];
  }
  return merged;
}

describe("firestore outbox integration (real outbox + persisted store)", () => {
  let idb;
  let state;
  let repository;
  let syncCenter;
  let writes;

  function mockModules() {
    const storeModule = {
      state,
      db: idb.db,
      DEFAULT_SCHEMA_VERSION: 6,
      FIRESTORE_OUTBOX_STORE: "outbox",
      FIRESTORE_META_STORE: "meta",
      FIRESTORE_CONFLICT_STORE: "conflicts",
      createExportableState: (value) => clone(value),
      setState: vi.fn((next, options = {}) => {
        if (options.merge) Object.assign(state, next);
        else {
          for (const key of Object.keys(state)) delete state[key];
          Object.assign(state, next);
        }
      }),
      saveStateToDB: vi.fn(async () => {}),
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
    return storeModule;
  }

  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    localStorage.clear();
    global.document = { dispatchEvent: vi.fn(), addEventListener: vi.fn() };
    idb = makeIdb();
    writes = [];
  });

  it("persists the conflict across a reload, rebases once and then no-ops", async () => {
    const plan = makePlan();
    const basePlan = clone(plan);
    const localPlan = clone(plan);
    localPlan.retaFinal.blocos[1].data = "2026-10-27";
    localPlan.retaFinal.blocos[1].status = "atrasado";
    localPlan.retaFinal.blocos[1].rolagens = 2;

    const remoteEnvelope = createFirestoreSnapshotEnvelope(
      {
        ...clone(plan),
        config: {},
        planejamento: clone(plan),
        eventos: [{ id: "ev_remote" }],
        editais: [],
        disciplinas: [],
      },
      {
        retaFinalSync: buildRetaFinalSyncDescriptor({
          plan: clone(plan),
          baseRevision: 0,
          baseRemoteUpdatedAt: "2026-10-22T17:45:36.439Z",
          deviceId: "remote-device",
          capabilities: CAPABILITIES,
          state: "active",
          revision: 0,
          snapshotRevision: 1,
          baseSnapshotRevision: 0,
        }),
        deviceId: "remote-device",
        baseRemoteUpdatedAt: "2026-10-22T17:45:36.439Z",
        payloadUpdatedAt: "2026-10-27T17:08:44.079Z",
        sentAt: "2026-10-27T17:08:44.079Z",
      },
    );

    const pendingEnvelope = createFirestoreSnapshotEnvelope(
      {
        ...clone(plan),
        config: {},
        planejamento: clone(plan),
        eventos: [{ id: "ev_pending" }],
        editais: [],
        disciplinas: [],
      },
      {
        retaFinalSync: buildRetaFinalSyncDescriptor({
          plan: clone(plan),
          baseRevision: 0,
          baseRemoteUpdatedAt: "2026-10-22T17:45:36.439Z",
          deviceId: "web-local",
          capabilities: CAPABILITIES,
          state: "active",
          revision: 0,
          snapshotRevision: 1,
          baseSnapshotRevision: 0,
        }),
        deviceId: "web-local",
        baseRemoteUpdatedAt: "2026-10-22T17:45:36.439Z",
        payloadUpdatedAt: "2026-10-27T17:09:00.748Z",
        sentAt: "2026-10-27T17:09:00.748Z",
      },
    );

    idb.stores.outbox.set("latest_snapshot", {
      id: "latest_snapshot",
      type: "snapshot",
      status: "pending",
      attempts: 1,
      queuedAt: new Date().toISOString(),
      nextAttemptAt: null,
      lastError: null,
      envelope: pendingEnvelope,
    });

    state = {
      config: {
        firestoreSync: {
          enabled: true,
          mode: "primary",
          uid: "uid-1",
          basePlan: clone(basePlan),
          baseDigest: computeRetaFinalPlanDigest(basePlan),
          baseRemoteDigest: remoteEnvelope.retaFinalSync.digest,
          baseRevision: 0,
          snapshotRevision: 1,
          baseRemoteUpdatedAt: remoteEnvelope.payloadUpdatedAt,
          remoteUpdatedAt: remoteEnvelope.payloadUpdatedAt,
          hasPendingWrites: true,
          conflict: null,
          lastError: null,
        },
      },
      planejamento: localPlan,
      eventos: [{ id: "ev_local" }],
      editais: [],
      disciplinas: [],
    };

    repository = {
      readFirestoreSnapshot: vi.fn(async () => remoteEnvelope),
      writeFirestoreSnapshot: vi.fn(async (_db, _uid, envelope) => {
        writes.push(envelope);
        return { updatedAt: envelope.payloadUpdatedAt };
      }),
      verifyRetaFinalGuard: vi
        .fn()
        .mockResolvedValueOnce({ verified: false, reason: "guard-unavailable" })
        .mockResolvedValue({ verified: true }),
    };
    syncCenter = {
      canAutoSyncFirestore: vi.fn(() => true),
      isGlobalSyncPaused: vi.fn(() => false),
      isRemoteStateNewer: vi.fn(() => true),
      mergeStudyStates: vi.fn(mergeAcademicCollections),
    };

    mockModules();
    let engine = await import("../../src/js/sync/firestore-sync-engine.js?v=8.37");
    engine.__setCurrentUser({ uid: "uid-1" });

    // First attempt: transient guard failure. The operation must persist.
    expect(await engine.flushFirestoreOutbox({ manual: true })).toBe(false);
    expect(idb.stores.outbox.has("latest_snapshot")).toBe(true);
    expect(writes).toHaveLength(0);

    // Reload: fresh module registry, same persisted store.
    vi.resetModules();
    mockModules();
    engine = await import("../../src/js/sync/firestore-sync-engine.js?v=8.37");
    engine.__setCurrentUser({ uid: "uid-1" });

    expect(await engine.flushFirestoreOutbox({ manual: true })).toBe(true);
    expect(writes).toHaveLength(1);
    const written = writes[0];
    expect(written.retaFinalSync).toMatchObject({
      revision: 0,
      baseRevision: 0,
      snapshotRevision: 2,
      baseSnapshotRevision: 1,
      baseRemoteUpdatedAt: remoteEnvelope.payloadUpdatedAt,
      digest: remoteEnvelope.retaFinalSync.digest,
    });
    expect(written.payload.planejamento).toEqual(remoteEnvelope.payload.planejamento);
    expect(written.payload.eventos.map((item) => item.id).sort()).toEqual([
      "ev_local",
      "ev_pending",
      "ev_remote",
    ]);
    expect(idb.stores.outbox.has("latest_snapshot")).toBe(false);
    expect(state.eventos.map((item) => item.id).sort()).toEqual([
      "ev_local",
      "ev_pending",
      "ev_remote",
    ]);
    expect(state.config.firestoreSync.snapshotRevision).toBe(2);
    expect(state.config.firestoreSync.conflict).toBeNull();

    // Second sync is idempotent: no pending operation, no new write.
    expect(await engine.flushFirestoreOutbox({ manual: true })).toBe(true);
    expect(writes).toHaveLength(1);
  });
});

