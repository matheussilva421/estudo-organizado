import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { expect } from '@playwright/test';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { convertBackupV12 } from '../../src/js/sync/v1-next/backup-codec.js';
import { encodeDocId, encodeRecordData } from '../../src/js/sync/v1-next/contracts.js';
import { createE2EState } from '../helpers/e2e-state.js';
import {
  applyRemoteOperation,
  fetchPlanRevision,
  fetchGenerationRecords,
  getCurrentGeneration,
  wireFirestores,
} from '../../src/js/sync/v1-next/remote.js';

const COLLECTIONS = [
  'editais',
  'disciplinas',
  'eventos',
  'habitos',
  'retaFinalBlocos',
  'meta',
  'tombstones',
];

const sha256 = value => createHash('sha256').update(value ?? 'null').digest('hex');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function normalizeForBrowser(value) {
  if (value === null || value === undefined) return value;
  if (typeof value?.toMillis === 'function') {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (Array.isArray(value)) return value.map(normalizeForBrowser);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      normalizeForBrowser(item),
    ]));
  }
  return value;
}

function browserResult(value) {
  return { ok: true, value: normalizeForBrowser(value) };
}

function browserFailure(error) {
  return {
    ok: false,
    error: {
      code: error?.code || 'V1_T11_BRIDGE_FAILED',
      message: error?.message || 'Falha no harness remoto do T11.',
    },
  };
}

function fingerprint(record) {
  return JSON.stringify([
    record.revision,
    record.opId,
    record.opDigest,
    record.deleted,
    record.data,
  ]);
}

export function createSingleEventState(title, id = 'ev_t11') {
  const state = createE2EState();
  state.schemaVersion = 12;
  state.eventos = [{
    id,
    titulo: title,
    data: '2026-11-24',
    status: 'agendado',
    tempoAcumulado: 0,
    discId: 'disc_1',
    assId: 'ass_1',
  }];
  return state;
}

export function createEventItem(title, id = 'ev_t11') {
  return {
    key: `evento:${id}`,
    entityType: 'evento',
    entityId: id,
    path: ['eventos', 0],
    data: {
      id,
      titulo: title,
      data: '2026-11-24',
      status: 'agendado',
      tempoAcumulado: 0,
      discId: 'disc_1',
      assId: 'ass_1',
    },
  };
}

export function createEventOperation({
  uid,
  generationId,
  opId,
  baseRevision,
  item,
}) {
  const dataText = encodeRecordData(item);
  return {
    uid,
    generationId,
    opId,
    entityKey: item.key,
    entityType: item.entityType,
    entityId: item.entityId,
    collection: 'eventos',
    path: item.path,
    baseRevision,
    revision: baseRevision + 1,
    action: 'upsert',
    data: item.data,
    dataText,
    opDigest: sha256(dataText),
    status: 'pending',
  };
}

function recordsByDocumentId(snapshot, collectionName) {
  const records = new Map();
  for (const row of snapshot.docs) {
    const record = normalizeForBrowser(row.data());
    records.set(row.id, { collection: collectionName, record });
  }
  return records;
}

export class V1T11Harness {
  constructor(environment) {
    this.environment = environment;
    this.userDatabases = new Map();
    this.polls = new Map();
    this.pollSequence = 0;
    this.dropNextAck = new Set();
    this.pausedUsers = new Set();
    this.applyTrace = [];
    this.applyCalls = new Map();
  }

  async reset() {
    await this.environment.clearFirestore();
    this.userDatabases.clear();
    this.polls.clear();
    this.dropNextAck.clear();
    this.pausedUsers.clear();
    this.applyTrace.length = 0;
    this.applyCalls.clear();
  }

  async seedUser({ uid, generationId, state }) {
    const converted = convertBackupV12(state);
    const counts = Object.fromEntries(COLLECTIONS.map(name => [name, 0]));
    const records = Object.entries(converted.records).flatMap(([collectionName, items]) =>
      items.map(item => ({ collectionName, item })));
    for (const { collectionName } of records) counts[collectionName] += 1;
    const total = records.length;
    const manifest = {
      schemaVersion: 1,
      generationId,
      migrationId: `migration_${generationId}`,
      state: 'active',
      revision: 0,
      sourceSha256: 'a'.repeat(64),
      businessDigest: converted.manifestDraft.businessDigest,
      counts: { total, byCollection: counts },
      updatedAt: serverTimestamp(),
    };

    await this.environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (let offset = 0; offset < records.length; offset += 400) {
        const batch = writeBatch(db);
        const slice = records.slice(offset, offset + 400);
        slice.forEach(({ collectionName, item }, index) => {
          const data = encodeRecordData(item);
          batch.set(doc(
            db,
            'users',
            uid,
            'v1SyncNamespaces',
            generationId,
            collectionName,
            encodeDocId(item.key),
          ), {
            schemaVersion: 1,
            generationId,
            collection: collectionName,
            entityType: item.entityType,
            entityId: String(item.entityId),
            baseRevision: 0,
            revision: 1,
            opId: `seed_${offset + index}`,
            opDigest: sha256(data),
            deleted: false,
            data,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      const activation = writeBatch(db);
      activation.set(doc(db, 'users', uid, 'v1SyncControl', 'current'), {
        schemaVersion: 1,
        generationId,
        updatedAt: serverTimestamp(),
      });
      activation.set(
        doc(db, 'users', uid, 'v1SyncNamespaces', generationId),
        manifest,
      );
      await activation.commit();
    });

    return { generationId, manifest, records: records.length };
  }

  userDatabase(uid) {
    let db = this.userDatabases.get(uid);
    if (!db) {
      db = this.environment.authenticatedContext(uid).firestore();
      this.userDatabases.set(uid, db);
    }
    return db;
  }

  wireUser(uid) {
    wireFirestores({
      db: this.userDatabase(uid),
      auth: { currentUser: { uid } },
      firestore: {
        collection,
        doc,
        getDoc,
        getDocs,
        getDocsFromServer,
        onSnapshot,
        runTransaction: (db, callback) => runTransaction(db, transaction => callback({
          get: ref => transaction.get(ref),
          set: (ref, value) => transaction.set(ref, value),
        })),
        serverTimestamp,
      },
      isOnline: () => !this.pausedUsers.has(uid),
    });
  }

  async getGeneration(uid) {
    if (this.pausedUsers.has(uid)) {
      throw Object.assign(new Error('Rede pausada pelo harness.'), {
        code: 'V1_REMOTE_UNAVAILABLE',
      });
    }
    this.wireUser(uid);
    return getCurrentGeneration(uid);
  }

  async fetchGeneration(uid, generationId) {
    if (this.pausedUsers.has(uid)) {
      throw Object.assign(new Error('Rede pausada pelo harness.'), {
        code: 'V1_REMOTE_UNAVAILABLE',
      });
    }
    this.wireUser(uid);
    return fetchGenerationRecords(uid, generationId);
  }

  async fetchPlan(uid, generationId) {
    this.wireUser(uid);
    return fetchPlanRevision(uid, generationId);
  }

  async applyOperation(operation) {
    const calls = this.applyCalls.get(operation.uid) || 0;
    this.applyCalls.set(operation.uid, calls + 1);
    if (this.pausedUsers.has(operation.uid)) {
      throw Object.assign(new Error('Rede pausada pelo harness.'), {
        code: 'V1_REMOTE_UNAVAILABLE',
      });
    }
    this.wireUser(operation.uid);
    try {
      const outcome = await applyRemoteOperation(operation);
      const transportLost = outcome?.acknowledged === true &&
        this.dropNextAck.has(operation.uid);
      this.applyTrace.push({
        uid: operation.uid,
        generationId: operation.generationId,
        opId: operation.opId,
        entityId: operation.entityId,
        revision: operation.revision,
        acknowledged: outcome?.acknowledged === true,
        transportLost,
      });
      if (transportLost && this.dropNextAck.delete(operation.uid)) {
        throw Object.assign(new Error('Resposta remota perdida depois do commit.'), {
          code: 'V1_REMOTE_TIMEOUT',
        });
      }
      return outcome;
    } catch (error) {
      if (!this.applyTrace.some(row => row.uid === operation.uid &&
        row.opId === operation.opId && row.transportLost === true)) {
        this.applyTrace.push({
          uid: operation.uid,
          generationId: operation.generationId,
          opId: operation.opId,
          entityId: operation.entityId,
          revision: operation.revision,
          acknowledged: false,
          transportLost: false,
          code: error?.code || 'V1_T11_APPLY_FAILED',
        });
      }
      throw error;
    }
  }

  async readCollections(uid, generationId) {
    const db = this.userDatabase(uid);
    const result = new Map();
    const snapshots = await Promise.all(COLLECTIONS.map(async collectionName => [
      collectionName,
      await getDocsFromServer(collection(
        db,
        'users',
        uid,
        'v1SyncNamespaces',
        generationId,
        collectionName,
      )),
    ]));
    snapshots.sort(([left], [right]) => left.localeCompare(right));
    for (const [collectionName, snapshot] of snapshots) {
      for (const [documentId, row] of recordsByDocumentId(snapshot, collectionName)) {
        result.set(documentId, row);
      }
    }
    return result;
  }

  async createPoll(uid, generationId) {
    if (this.pausedUsers.has(uid)) {
      throw Object.assign(new Error('Rede pausada pelo harness.'), {
        code: 'V1_REMOTE_UNAVAILABLE',
      });
    }
    const current = await this.readCollections(uid, generationId);
    const id = `poll_${++this.pollSequence}`;
    const currentWithFingerprint = new Map([...current].map(([documentId, row]) => [
      documentId,
      { ...row, fingerprint: fingerprint(row.record) },
    ]));
    this.polls.set(id, {
      uid,
      generationId,
      current: currentWithFingerprint,
    });
    return {
      id,
      deltas: [...currentWithFingerprint.values()].map(row => ({
        collection: row.collection,
        entityId: row.record.entityId,
        record: row.record,
        changeType: 'added',
        baseline: true,
      })),
    };
  }

  async poll(id) {
    const state = this.polls.get(id);
    if (!state) throw new Error('Poll remoto desconhecido.');
    if (this.pausedUsers.has(state.uid)) {
      throw Object.assign(new Error('Rede pausada pelo harness.'), {
        code: 'V1_REMOTE_UNAVAILABLE',
      });
    }
    const next = await this.readCollections(state.uid, state.generationId);
    const deltas = [];
    const nextWithFingerprint = new Map();
    for (const [documentId, row] of next) {
      const nextFingerprint = fingerprint(row.record);
      nextWithFingerprint.set(documentId, { ...row, fingerprint: nextFingerprint });
      const previous = state.current.get(documentId);
      if (previous?.fingerprint === nextFingerprint) continue;
      deltas.push({
        collection: row.collection,
        entityId: row.record.entityId,
        record: row.record,
        changeType: previous ? 'modified' : 'added',
        baseline: false,
      });
    }
    for (const [documentId, row] of state.current) {
      if (nextWithFingerprint.has(documentId)) continue;
      deltas.push({
        collection: row.collection,
        entityId: row.record.entityId,
        record: null,
        changeType: 'removed',
        baseline: false,
      });
    }
    state.current = nextWithFingerprint;
    deltas.sort((left, right) =>
      `${left.collection}:${left.entityId}`.localeCompare(
        `${right.collection}:${right.entityId}`,
      ));
    return { deltas };
  }

  closePoll(id) {
    this.polls.delete(id);
  }

  async inspect(uid, generationId) {
    const rows = this.applyTrace.filter(row => row.uid === uid &&
      row.generationId === generationId);
    const opIds = rows.filter(row => row.acknowledged).map(row => row.opId);
    return {
      total: opIds.length,
      uniqueOpIds: new Set(opIds).size,
      opIds,
      applyTrace: rows,
    };
  }

  async readEntity(uid, generationId, collectionName, entityType, entityId) {
    const recordKey = `${entityType}:${entityId}`;
    const snapshot = await getDoc(doc(
      this.userDatabase(uid),
      'users',
      uid,
      'v1SyncNamespaces',
      generationId,
      collectionName,
      encodeDocId(recordKey),
    ));
    return snapshot.exists() ? normalizeForBrowser(snapshot.data()) : null;
  }

  async exposeToPage(page) {
    await page.exposeFunction('__v1t11_get_generation', async uid => {
      try {
        return browserResult(await this.getGeneration(uid));
      } catch (error) {
        return browserFailure(error);
      }
    });
    await page.exposeFunction('__v1t11_fetch_generation', async (uid, generationId) => {
      try {
        return browserResult(await this.fetchGeneration(uid, generationId));
      } catch (error) {
        return browserFailure(error);
      }
    });
    await page.exposeFunction('__v1t11_fetch_plan', async (uid, generationId) => {
      try {
        return browserResult(await this.fetchPlan(uid, generationId));
      } catch (error) {
        return browserFailure(error);
      }
    });
    await page.exposeFunction('__v1t11_apply_operation', async operation => {
      try {
        return browserResult(await this.applyOperation(operation));
      } catch (error) {
        return browserFailure(error);
      }
    });
    await page.exposeFunction('__v1t11_create_poll', async (uid, generationId) => {
      try {
        return browserResult(await this.createPoll(uid, generationId));
      } catch (error) {
        return browserFailure(error);
      }
    });
    await page.exposeFunction('__v1t11_poll', async id => {
      try {
        return browserResult(await this.poll(id));
      } catch (error) {
        return browserFailure(error);
      }
    });
    await page.exposeFunction('__v1t11_close_poll', async id => {
      this.closePoll(id);
      return { ok: true, value: true };
    });
  }

  async installPage(page, { uid }) {
    await this.exposeToPage(page);
    await page.addInitScript(({ accountUid }) => {
      window.Chart = class {
        destroy() {}
      };
      localStorage.clear();
      sessionStorage.clear();
      window.__T11_BRIDGE_STATS__ = {
        apply: 0, get: 0, fetch: 0, subscribe: 0,
        createPoll: 0, poll: 0, pollErrors: 0,
      };

      async function callBridge(name, ...args) {
        const response = await window[name](...args);
        if (response?.ok) return response.value;
        const error = new Error(response?.error?.message || 'Falha na ponte T11.');
        error.code = response?.error?.code || 'V1_T11_BRIDGE_FAILED';
        throw error;
      }

      function assertOnline() {
        if (navigator.onLine === false) {
          throw Object.assign(new Error('Navegador offline.'), {
            code: 'V1_REMOTE_UNAVAILABLE',
          });
        }
      }

      const remoteApi = {
        async getCurrentGeneration(uid) {
          assertOnline();
          window.__T11_BRIDGE_STATS__.get += 1;
          return callBridge('__v1t11_get_generation', uid);
        },
        async fetchGenerationRecords(uid, generationId) {
          assertOnline();
          window.__T11_BRIDGE_STATS__.fetch += 1;
          return callBridge('__v1t11_fetch_generation', uid, generationId);
        },
        async fetchPlanRevision(uid, generationId) {
          assertOnline();
          return callBridge('__v1t11_fetch_plan', uid, generationId);
        },
        async applyRemoteOperation(operation) {
          assertOnline();
          window.__T11_BRIDGE_STATS__.apply += 1;
          return callBridge('__v1t11_apply_operation', operation);
        },
        subscribeGeneration(uid, generationId, handlers) {
          window.__T11_BRIDGE_STATS__.subscribe += 1;
          let stopped = false;
          let pollId = null;
          let created = false;
          const retryableTransportCodes = new Set([
            'V1_REMOTE_OFFLINE',
            'V1_REMOTE_TIMEOUT',
            'V1_REMOTE_UNAVAILABLE',
          ]);
          const run = async () => {
            while (!stopped) {
              try {
                assertOnline();
                if (!created) {
                  window.__T11_BRIDGE_STATS__.createPoll += 1;
                  const initial = await callBridge(
                    '__v1t11_create_poll', uid, generationId,
                  );
                  pollId = initial.id;
                  created = true;
                  for (const delta of initial.deltas) {
                    if (stopped) return;
                    await handlers.onDelta(delta);
                  }
                } else {
                  window.__T11_BRIDGE_STATS__.poll += 1;
                  const result = await callBridge('__v1t11_poll', pollId);
                  for (const delta of result.deltas) {
                    if (stopped) return;
                    await handlers.onDelta(delta);
                  }
                }
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (error) {
                if (stopped) return;
                window.__T11_BRIDGE_STATS__.pollErrors += 1;
                if (retryableTransportCodes.has(error?.code)) {
                  // Firestore listeners survive temporary transport loss.
                  await new Promise(resolve => setTimeout(resolve, 100));
                  continue;
                }
                handlers.onError(error);
                return;
              }
            }
          };
          void run();
          return () => {
            stopped = true;
            if (pollId) void window.__v1t11_close_poll(pollId);
          };
        },
      };
      window.__ESTUDO_V1_SYNC_TEST__ = {
        enabled: true,
        uid: accountUid,
        remoteApi,
      };
    }, { accountUid: uid });
  }
}

export async function createV1T11Harness({ projectId }) {
  const emulatorHost = globalThis.process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
  const separator = emulatorHost.lastIndexOf(':');
  const host = emulatorHost.slice(0, separator);
  const port = Number(emulatorHost.slice(separator + 1));
  const environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port,
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
  return { environment, hub: new V1T11Harness(environment) };
}

export async function waitForAppReady(page) {
  await page.waitForFunction(() => {
    const title = document.querySelector('#topbar-title')?.textContent;
    return Boolean(title && title !== 'Preparando dados' &&
      !document.querySelector('[data-v1-sync-gate]') && window.state);
  }, null, { timeout: 20_000 });
}

export async function waitForWorker(page) {
  await expect.poll(() => page.evaluate(() =>
    window.__T11_BRIDGE_STATS__?.subscribe || 0)).toBe(1);
}

export async function editEvent(page, { id, title }) {
  await page.evaluate(async ({ eventId, nextTitle }) => {
    const event = window.state.eventos.find(item => item.id === eventId);
    if (!event) throw new Error(`Evento sintético ausente: ${eventId}`);
    event.titulo = nextTitle;
    await window.saveStateToDB({
      skipCloudSync: true,
      skipFirestoreSync: true,
      skipDriveSync: true,
    });
  }, { eventId: id, nextTitle: title });
}

export async function pendingCount(page, uid, generationId) {
  return page.evaluate(async ({ accountUid, activeGeneration }) => {
    const local = await import('/js/sync/v1-next/local.js');
    return (await local.getPendingOperations(accountUid, activeGeneration)).length;
  }, { accountUid: uid, activeGeneration: generationId });
}

export async function waitForOfflineShell(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
    }
  });
}

export async function clearV1LocalStores(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('EstudoOrganizadoDB');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const names = [...db.objectStoreNames].filter(name => name.startsWith('v1_'));
      const transaction = db.transaction(names, 'readwrite');
      names.forEach(name => transaction.objectStore(name).clear());
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };
  }));
}

export async function localEventTitle(page, id) {
  return page.evaluate(eventId => window.state?.eventos
    ?.find(event => event.id === eventId)?.titulo ?? null, id);
}

export async function acceptDialogs(page) {
  page.on('dialog', dialog => void dialog.accept());
}

export async function waitUntil(predicate, timeoutMs = 12_000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error('Tempo esgotado aguardando condição do T11.');
}
