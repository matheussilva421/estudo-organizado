# Firestore Entity Sync Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Firestore sync from an entity-ready snapshot into a safe per-entity sync model without losing the local-first recovery guarantees.

**Architecture:** Continue using IndexedDB as the local commit point and keep `users/{uid}/snapshots/main` as the production fallback until entity collections prove reliable. Add per-entity Firestore collections first in shadow dual-write, then add shadow read verification, then expose entity-aware conflict review, and only then cut over primary sync from snapshot writes to entity writes.

**Tech Stack:** Vanilla ES modules, IndexedDB, Firebase Auth, Firestore, Firebase rules, Vitest, Playwright, PWA service worker.

---

## Baseline for the Next Agent

Start from commit:

```text
622a1a4 feat(sync): prepara metadados por entidade
```

Current behavior already implemented:

- Firestore is the primary remote channel when configured, signed in, enabled, and in `primary` mode.
- IndexedDB remains the local source of truth and first commit.
- Cloudflare and Google Drive are secondary manual backup/restore channels.
- Snapshot document is still the production remote write path:

```text
users/{uid}/snapshots/main
```

- Tracked entities already carry `_sync` metadata:

```js
{
  createdAt: '2026-04-29T10:00:00.000Z',
  updatedAt: '2026-04-29T10:00:00.000Z',
  deletedAt: null,
  revision: 1,
  updatedBy: 'web-device'
}
```

- `src/js/sync/entity-metadata.js` already exports:

```js
normalizeEntityMetadata(state, options)
buildEntityManifest(state)
createEntityIndex(state)
mergeEntityAwareArrays(localArray, remoteArray, options)
prepareEntityMetadataForSave(state, options)
```

- IndexedDB already has `entity_meta`.
- Firestore snapshot envelopes already include `entityManifest`.
- Conflict UI already lists affected entities in the Sync Center.
- Validation at baseline passed:

```powershell
npm test
npm run test:e2e
```

## Non-Negotiable Rules

- Do not remove snapshot sync until Phase D is explicitly completed and validated.
- Do not make Google login mandatory for local app usage.
- Do not run Cloudflare or Drive inside the automatic primary sync path.
- Do not resolve conflicts by "newest wins" when both local and remote changed the same entity without a clear revision/timestamp winner.
- Do not persist Firebase/Auth tokens in exported state.
- Do not silently delete remote entity documents; use tombstones.
- Bump cache version on every shipped frontend module change.

## Target Firestore Shape

Keep the snapshot:

```text
users/{uid}/snapshots/main
```

Add entity docs:

```text
users/{uid}/entities/{entityKey}
```

Use URL-safe encoded keys because entity keys include slashes:

```js
encodeURIComponent('editais/ed_1')
```

Entity document shape:

```json
{
  "version": 1,
  "schemaVersion": 9,
  "key": "editais/ed_1",
  "collection": "editais",
  "id": "ed_1",
  "checksum": "8f0a1c2b",
  "updatedAt": "2026-04-29T10:00:00.000Z",
  "deletedAt": null,
  "revision": 3,
  "updatedBy": "web-abc123",
  "payload": {
    "id": "ed_1",
    "nome": "TRF",
    "_sync": {
      "createdAt": "2026-04-29T09:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z",
      "deletedAt": null,
      "revision": 3,
      "updatedBy": "web-abc123"
    }
  },
  "sentAt": "2026-04-29T10:00:01.000Z"
}
```

Tombstone document shape:

```json
{
  "version": 1,
  "schemaVersion": 9,
  "key": "eventos/ev_1",
  "collection": "eventos",
  "id": "ev_1",
  "checksum": null,
  "updatedAt": null,
  "deletedAt": "2026-04-29T10:00:00.000Z",
  "revision": 4,
  "updatedBy": "web-abc123",
  "payload": null,
  "sentAt": "2026-04-29T10:00:01.000Z"
}
```

## Phase B: Shadow Dual-Write Entity Documents

Purpose: write per-entity Firestore documents in shadow mode while snapshot remains authoritative.

### Task B1: Add Entity Firestore Schema Helpers

**Files:**
- Modify: `src/js/sync/entity-metadata.js`
- Create: `src/js/sync/firestore-entity-schema.js`
- Test: `tests/unit/firestore-entity-schema.test.js`

- [ ] **Step 1: Write failing schema tests**

Create `tests/unit/firestore-entity-schema.test.js`:

```js
import { describe, expect, it } from 'vitest';

const schema = await import('../../src/js/sync/firestore-entity-schema.js?v=8.27');

describe('firestore-entity-schema.js', () => {
  it('encodes entity keys into Firestore-safe doc ids', () => {
    expect(schema.encodeEntityDocId('editais/ed_1')).toBe('editais%2Fed_1');
    expect(schema.decodeEntityDocId('editais%2Fed_1')).toBe('editais/ed_1');
  });

  it('creates an entity document from an active entity', () => {
    const entity = {
      id: 'ed_1',
      nome: 'TRF',
      _sync: {
        createdAt: '2026-04-29T09:00:00.000Z',
        updatedAt: '2026-04-29T10:00:00.000Z',
        deletedAt: null,
        revision: 3,
        updatedBy: 'web-a'
      }
    };

    const doc = schema.createFirestoreEntityDocument({
      key: 'editais/ed_1',
      collection: 'editais',
      id: 'ed_1',
      entity,
      schemaVersion: 9,
      sentAt: '2026-04-29T10:00:01.000Z'
    });

    expect(doc).toMatchObject({
      version: 1,
      schemaVersion: 9,
      key: 'editais/ed_1',
      collection: 'editais',
      id: 'ed_1',
      updatedAt: '2026-04-29T10:00:00.000Z',
      deletedAt: null,
      revision: 3,
      updatedBy: 'web-a',
      sentAt: '2026-04-29T10:00:01.000Z',
      payload: entity
    });
    expect(doc.checksum).toEqual(expect.any(String));
  });

  it('creates a tombstone entity document', () => {
    const doc = schema.createFirestoreTombstoneDocument({
      tombstone: {
        key: 'eventos/ev_1',
        collection: 'eventos',
        id: 'ev_1',
        deletedAt: '2026-04-29T10:00:00.000Z',
        deletedBy: 'web-a',
        revision: 4
      },
      schemaVersion: 9,
      sentAt: '2026-04-29T10:00:01.000Z'
    });

    expect(doc).toMatchObject({
      version: 1,
      key: 'eventos/ev_1',
      collection: 'eventos',
      id: 'ev_1',
      checksum: null,
      updatedAt: null,
      deletedAt: '2026-04-29T10:00:00.000Z',
      revision: 4,
      updatedBy: 'web-a',
      payload: null
    });
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
npm run test:unit -- tests/unit/firestore-entity-schema.test.js
```

Expected: fail because `firestore-entity-schema.js` does not exist.

- [ ] **Step 3: Implement schema module**

Create `src/js/sync/firestore-entity-schema.js`:

```js
import {
  stableEntityChecksum
} from './entity-metadata.js?v=8.27';

export const FIRESTORE_ENTITY_VERSION = 1;

export function encodeEntityDocId(key) {
  return encodeURIComponent(String(key));
}

export function decodeEntityDocId(docId) {
  return decodeURIComponent(String(docId));
}

export function createFirestoreEntityDocument({
  key,
  collection,
  id,
  entity,
  schemaVersion,
  sentAt = new Date().toISOString()
}) {
  const sync = entity?._sync || {};
  return {
    version: FIRESTORE_ENTITY_VERSION,
    schemaVersion,
    key,
    collection,
    id,
    checksum: stableEntityChecksum(entity),
    updatedAt: sync.updatedAt || null,
    deletedAt: sync.deletedAt || null,
    revision: Number(sync.revision || 1),
    updatedBy: sync.updatedBy || null,
    payload: entity,
    sentAt
  };
}

export function createFirestoreTombstoneDocument({
  tombstone,
  schemaVersion,
  sentAt = new Date().toISOString()
}) {
  return {
    version: FIRESTORE_ENTITY_VERSION,
    schemaVersion,
    key: tombstone.key,
    collection: tombstone.collection,
    id: String(tombstone.id),
    checksum: null,
    updatedAt: null,
    deletedAt: tombstone.deletedAt || null,
    revision: Number(tombstone.revision || 1),
    updatedBy: tombstone.deletedBy || tombstone.updatedBy || null,
    payload: null,
    sentAt
  };
}
```

- [ ] **Step 4: Run schema tests**

```powershell
npm run test:unit -- tests/unit/firestore-entity-schema.test.js
```

Expected: pass.

### Task B2: Add Entity Repository Writes

**Files:**
- Modify: `src/js/sync/firestore-repository.js`
- Test: `tests/unit/firestore-entity-repository-contracts.test.js`

- [ ] **Step 1: Write repository contract tests**

Create `tests/unit/firestore-entity-repository-contracts.test.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Firestore entity repository contracts', () => {
  it('exports entity read and write helpers', () => {
    const source = read('src/js/sync/firestore-repository.js');

    expect(source).toContain('export async function writeFirestoreEntityDocuments');
    expect(source).toContain('export async function readFirestoreEntityDocuments');
    expect(source).toContain('collection(db,');
    expect(source).toContain("'entities'");
  });

  it('uses encoded entity keys as document ids', () => {
    const source = read('src/js/sync/firestore-repository.js');

    expect(source).toContain('encodeEntityDocId');
    expect(source).toContain('doc(entityCollection, encodeEntityDocId(entityDoc.key))');
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
npm run test:unit -- tests/unit/firestore-entity-repository-contracts.test.js
```

Expected: fail because repository helpers do not exist.

- [ ] **Step 3: Add Firestore bundle exports if missing**

Open `scripts/firebase-bundle-entry.js`. If it does not export these Firestore APIs, add them:

```js
export {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch
} from 'firebase/firestore';
```

Then run:

```powershell
npm run build:firebase
```

Expected: `src/vendor/firebase-client.bundle.js` is regenerated.

- [ ] **Step 4: Add repository helpers**

In `src/js/sync/firestore-repository.js`, add imports:

```js
import {
  collection,
  doc,
  getDocs,
  writeBatch
} from '../../vendor/firebase-client.bundle.js?v=8.27';
import {
  decodeEntityDocId,
  encodeEntityDocId
} from './firestore-entity-schema.js?v=8.27';
```

Add helpers:

```js
function getEntitiesCollection(db, uid) {
  return collection(db, 'users', uid, 'entities');
}

export async function writeFirestoreEntityDocuments(db, uid, entityDocs = []) {
  if (!Array.isArray(entityDocs) || entityDocs.length === 0) return { count: 0 };
  const entityCollection = getEntitiesCollection(db, uid);
  let count = 0;

  for (let i = 0; i < entityDocs.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = entityDocs.slice(i, i + 450);
    for (const entityDoc of chunk) {
      batch.set(doc(entityCollection, encodeEntityDocId(entityDoc.key)), entityDoc, { merge: true });
    }
    await batch.commit();
    count += chunk.length;
  }

  return { count };
}

export async function readFirestoreEntityDocuments(db, uid) {
  const entityCollection = getEntitiesCollection(db, uid);
  const snapshot = await getDocs(entityCollection);
  return snapshot.docs.map((entry) => ({
    ...entry.data(),
    key: entry.data().key || decodeEntityDocId(entry.id)
  }));
}
```

- [ ] **Step 5: Run repository tests**

```powershell
npm run test:unit -- tests/unit/firestore-entity-repository-contracts.test.js
```

Expected: pass.

### Task B3: Build Entity Outbox

**Files:**
- Modify: `src/js/store.js`
- Create: `src/js/sync/firestore-entity-outbox.js`
- Test: `tests/unit/firestore-entity-outbox.test.js`

- [ ] **Step 1: Write failing outbox tests**

Create `tests/unit/firestore-entity-outbox.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';

describe('firestore-entity-outbox.js', () => {
  it('exports queue and pending helpers', async () => {
    const outbox = await import('../../src/js/sync/firestore-entity-outbox.js?v=8.27');

    expect(outbox.FIRESTORE_ENTITY_OUTBOX_ID).toBe('entity_shadow');
    expect(typeof outbox.queueFirestoreEntityBatchFromState).toBe('function');
    expect(typeof outbox.getPendingFirestoreEntityBatch).toBe('function');
    expect(typeof outbox.markFirestoreEntityBatchSynced).toBe('function');
  });

  it('store declares an entity outbox store', async () => {
    vi.resetModules();
    const store = await import('../../src/js/store.js?v=8.27');

    expect(store.DB_VERSION).toBeGreaterThanOrEqual(5);
    expect(store.FIRESTORE_ENTITY_OUTBOX_STORE).toBe('firestore_entity_outbox');
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
npm run test:unit -- tests/unit/firestore-entity-outbox.test.js
```

Expected: fail because outbox store/module do not exist.

- [ ] **Step 3: Add IndexedDB store**

Modify `src/js/store.js`:

```js
export const DB_VERSION = 5;
export const FIRESTORE_ENTITY_OUTBOX_STORE = 'firestore_entity_outbox';
```

Inside `request.onupgradeneeded`:

```js
if (!db.objectStoreNames.contains(FIRESTORE_ENTITY_OUTBOX_STORE)) {
  db.createObjectStore(FIRESTORE_ENTITY_OUTBOX_STORE, { keyPath: 'id' });
}
```

- [ ] **Step 4: Create entity outbox module**

Create `src/js/sync/firestore-entity-outbox.js`:

```js
import {
  db,
  FIRESTORE_ENTITY_OUTBOX_STORE
} from '../store.js?v=8.27';
import {
  createFirestoreEntityDocument,
  createFirestoreTombstoneDocument
} from './firestore-entity-schema.js?v=8.27';
import {
  createEntityIndex
} from './entity-metadata.js?v=8.27';

export const FIRESTORE_ENTITY_OUTBOX_ID = 'entity_shadow';

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putRecord(record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FIRESTORE_ENTITY_OUTBOX_STORE], 'readwrite');
    const store = transaction.objectStore(FIRESTORE_ENTITY_OUTBOX_STORE);
    store.put(record);
    transaction.oncomplete = () => resolve(record);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function getEntityByKey(state, key) {
  const active = createEntityIndex(state);
  const match = active.find((item) => item.key === key);
  if (!match) return null;
  const segments = key.split('/');
  if (match.collection === 'editais') return (state.editais || []).find((item) => item.id === match.id) || null;
  if (match.collection === 'eventos') return (state.eventos || []).find((item) => item.id === match.id) || null;
  if (match.collection === 'arquivo') return (state.arquivo || []).find((item) => item.id === match.id) || null;
  if (match.collection === 'revisoes') return (state.revisoes || []).find((item) => item.id === match.id) || null;
  if (match.collection.startsWith('habitos.')) {
    const type = match.collection.split('.')[1];
    return (state.habitos?.[type] || []).find((item) => item.id === match.id) || null;
  }
  if (match.collection === 'planejamento.sequencia') {
    return (state.planejamento?.sequencia || []).find((item) => item.id === match.id) || null;
  }
  if (match.collection === 'disciplinas') {
    const edital = (state.editais || []).find((item) => item.id === segments[1]);
    return (edital?.disciplinas || []).find((item) => item.id === match.id) || null;
  }
  if (match.collection === 'assuntos' || match.collection === 'aulas') {
    const edital = (state.editais || []).find((item) => item.id === segments[1]);
    const disciplina = (edital?.disciplinas || []).find((item) => item.id === segments[3]);
    const list = match.collection === 'assuntos' ? disciplina?.assuntos : disciplina?.aulas;
    return (list || []).find((item) => item.id === match.id) || null;
  }
  return null;
}

export async function queueFirestoreEntityBatchFromState(state, options = {}) {
  if (!db || !db.objectStoreNames?.contains(FIRESTORE_ENTITY_OUTBOX_STORE)) return null;
  const schemaVersion = state.schemaVersion || 9;
  const sentAt = options.sentAt || new Date().toISOString();
  const activeDocs = createEntityIndex(state).map((item) => createFirestoreEntityDocument({
    key: item.key,
    collection: item.collection,
    id: item.id,
    entity: getEntityByKey(state, item.key),
    schemaVersion,
    sentAt
  })).filter((item) => item.payload);
  const tombstoneDocs = (state.config?.entityTombstones || []).map((tombstone) => createFirestoreTombstoneDocument({
    tombstone,
    schemaVersion,
    sentAt
  }));
  const record = {
    id: FIRESTORE_ENTITY_OUTBOX_ID,
    status: 'pending',
    attempts: 0,
    queuedAt: sentAt,
    docs: [...activeDocs, ...tombstoneDocs]
  };
  return putRecord(record);
}

export async function getPendingFirestoreEntityBatch() {
  if (!db || !db.objectStoreNames?.contains(FIRESTORE_ENTITY_OUTBOX_STORE)) return null;
  const transaction = db.transaction([FIRESTORE_ENTITY_OUTBOX_STORE], 'readonly');
  const store = transaction.objectStore(FIRESTORE_ENTITY_OUTBOX_STORE);
  return requestToPromise(store.get(FIRESTORE_ENTITY_OUTBOX_ID));
}

export async function markFirestoreEntityBatchSynced() {
  if (!db || !db.objectStoreNames?.contains(FIRESTORE_ENTITY_OUTBOX_STORE)) return;
  const current = await getPendingFirestoreEntityBatch();
  if (!current) return;
  await putRecord({
    ...current,
    status: 'synced',
    syncedAt: new Date().toISOString()
  });
}
```

- [ ] **Step 5: Run outbox tests**

```powershell
npm run test:unit -- tests/unit/firestore-entity-outbox.test.js
```

Expected: pass.

### Task B4: Shadow Dual-Write in Firestore Engine

**Files:**
- Modify: `src/js/sync/firestore-sync-engine.js`
- Modify: `src/js/sync/sync-coordinator.js`
- Test: `tests/unit/firestore-entity-dual-write-contracts.test.js`

- [ ] **Step 1: Write contract tests**

Create `tests/unit/firestore-entity-dual-write-contracts.test.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('entity dual-write contracts', () => {
  it('queues entity shadow batches without replacing snapshot queueing', () => {
    const engine = read('src/js/sync/firestore-sync-engine.js');

    expect(engine).toContain('queueFirestoreEntityBatchFromState');
    expect(engine).toContain('queueFirestoreSnapshotFromState');
    expect(engine).toContain('flushFirestoreEntityOutbox');
  });

  it('keeps entity dual-write gated by explicit shadow setting', () => {
    const engine = read('src/js/sync/firestore-sync-engine.js');

    expect(engine).toContain('entitySync');
    expect(engine).toContain("mode === 'shadow'");
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
npm run test:unit -- tests/unit/firestore-entity-dual-write-contracts.test.js
```

Expected: fail until imports/functions exist.

- [ ] **Step 3: Add config shape**

In `src/js/store.js`, extend defaults:

```js
export const DEFAULT_ENTITY_SYNC_CONFIG = {
  enabled: false,
  mode: 'off',
  lastShadowPushAt: null,
  lastShadowReadAt: null,
  lastShadowDiff: null,
  lastError: null
};
```

Add to config defaults:

```js
entitySync: { ...DEFAULT_ENTITY_SYNC_CONFIG }
```

Normalize in `setState()` after `firestoreSync` normalization:

```js
cloned.config.entitySync = Object.assign(
  {},
  DEFAULT_ENTITY_SYNC_CONFIG,
  cloned.config.entitySync || {}
);
```

- [ ] **Step 4: Add entity flush function**

In `src/js/sync/firestore-sync-engine.js`, import:

```js
import {
  getPendingFirestoreEntityBatch,
  markFirestoreEntityBatchSynced,
  queueFirestoreEntityBatchFromState
} from './firestore-entity-outbox.js?v=8.27';
import {
  writeFirestoreEntityDocuments
} from './firestore-repository.js?v=8.27';
```

Add:

```js
function canShadowWriteEntities(config = getConfig()) {
  const entitySync = state.config?.entitySync || {};
  return Boolean(
    config.enabled
    && config.mode === 'primary'
    && entitySync.enabled
    && entitySync.mode === 'shadow'
  );
}

export async function flushFirestoreEntityOutbox(options = {}) {
  const config = getConfig();
  if (!options.manual && !canShadowWriteEntities(config)) return false;
  const pending = await getPendingFirestoreEntityBatch();
  if (!pending || pending.status !== 'pending') return false;
  const { db, uid } = requireSignedInServices();
  const result = await writeFirestoreEntityDocuments(db, uid, pending.docs || []);
  await markFirestoreEntityBatchSynced();
  if (!state.config.entitySync) state.config.entitySync = {};
  Object.assign(state.config.entitySync, {
    enabled: true,
    mode: 'shadow',
    lastShadowPushAt: new Date().toISOString(),
    lastError: null
  });
  await persistSyncConfig(false);
  emitStatus('synced', { entityShadowCount: result.count });
  return true;
}
```

- [ ] **Step 5: Queue shadow entities after snapshot queueing**

Inside `queueFirestoreSnapshotFromState()` or immediately after it is called by the coordinator, add:

```js
if (state.config?.entitySync?.enabled && state.config.entitySync.mode === 'shadow') {
  await queueFirestoreEntityBatchFromState(sourceState, options);
}
```

Inside successful `flushFirestoreOutbox()`, after snapshot write succeeds:

```js
if (canShadowWriteEntities(config)) {
  await flushFirestoreEntityOutbox({ manual: options.manual });
}
```

- [ ] **Step 6: Run dual-write tests**

```powershell
npm run test:unit -- tests/unit/firestore-entity-dual-write-contracts.test.js
```

Expected: pass.

### Task B5: Firestore Rules for Entity Docs

**Files:**
- Modify: `firestore.rules`
- Test: `tests/unit/firestore-contracts.test.js`

- [ ] **Step 1: Add failing rules expectations**

In `tests/unit/firestore-contracts.test.js`, add:

```js
it('allows owner-scoped entity docs and still denies physical deletes', () => {
  const rules = read('firestore.rules');

  expect(rules).toContain('match /users/{uid}/entities/{entityId}');
  expect(rules).toContain('validEntityDoc()');
  expect(rules).toContain('request.resource.data.key is string');
  expect(rules).toContain('request.resource.data.payload == null || request.resource.data.payload is map');
  expect(rules).toContain('allow delete: if false;');
});
```

- [ ] **Step 2: Run test and confirm failure**

```powershell
npm run test:unit -- tests/unit/firestore-contracts.test.js
```

Expected: fail until rules are updated.

- [ ] **Step 3: Update Firestore rules**

Add:

```js
function validEntityDoc() {
  return request.resource.data.keys().hasOnly([
    'version',
    'schemaVersion',
    'key',
    'collection',
    'id',
    'checksum',
    'updatedAt',
    'deletedAt',
    'revision',
    'updatedBy',
    'payload',
    'sentAt',
    'serverUpdatedAt'
  ])
  && request.resource.data.version == 1
  && request.resource.data.key is string
  && request.resource.data.collection is string
  && request.resource.data.id is string
  && request.resource.data.revision is number
  && (
    request.resource.data.payload == null
    || request.resource.data.payload is map
  );
}
```

Add match:

```js
match /users/{uid}/entities/{entityId} {
  allow read: if owns(uid);
  allow create, update: if owns(uid) && validEntityDoc();
  allow delete: if false;
}
```

- [ ] **Step 4: Run contract tests**

```powershell
npm run test:unit -- tests/unit/firestore-contracts.test.js
```

Expected: pass.

## Phase C: Shadow Read Verification and Entity Merge Model

Purpose: prove that entity docs can reconstruct the snapshot payload and detect drift before cutover.

### Task C1: Rebuild State From Entity Docs

**Files:**
- Create: `src/js/sync/entity-state-builder.js`
- Test: `tests/unit/entity-state-builder.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/entity-state-builder.test.js`:

```js
import { describe, expect, it } from 'vitest';

const builder = await import('../../src/js/sync/entity-state-builder.js?v=8.28');

describe('entity-state-builder.js', () => {
  it('rebuilds editais with nested disciplinas, assuntos and aulas', () => {
    const docs = [
      { key: 'editais/ed_1', collection: 'editais', id: 'ed_1', payload: { id: 'ed_1', nome: 'TRF' }, revision: 1 },
      { key: 'editais/ed_1/disciplinas/disc_1', collection: 'disciplinas', id: 'disc_1', payload: { id: 'disc_1', nome: 'Administrativo' }, revision: 1 },
      { key: 'editais/ed_1/disciplinas/disc_1/assuntos/ass_1', collection: 'assuntos', id: 'ass_1', payload: { id: 'ass_1', nome: 'Atos' }, revision: 1 },
      { key: 'editais/ed_1/disciplinas/disc_1/aulas/aula_1', collection: 'aulas', id: 'aula_1', payload: { id: 'aula_1', nome: 'Aula 01' }, revision: 1 }
    ];

    const partial = builder.rebuildStateFromEntityDocs(docs);

    expect(partial.editais[0]).toMatchObject({
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        assuntos: [{ id: 'ass_1' }],
        aulas: [{ id: 'aula_1' }]
      }]
    });
  });

  it('omits tombstoned docs from visible collections', () => {
    const docs = [
      { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', payload: { id: 'ev_1', titulo: 'Old' }, revision: 1 },
      { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', payload: null, deletedAt: '2026-04-29T10:00:00.000Z', revision: 2 }
    ];

    const partial = builder.rebuildStateFromEntityDocs(docs);

    expect(partial.eventos).toEqual([]);
    expect(partial.config.entityTombstones).toEqual([
      expect.objectContaining({ key: 'eventos/ev_1', revision: 2 })
    ]);
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
npm run test:unit -- tests/unit/entity-state-builder.test.js
```

Expected: fail because builder does not exist.

- [ ] **Step 3: Implement builder**

Create `src/js/sync/entity-state-builder.js` with these exports:

```js
export function pickNewestEntityDocs(docs = []) {
  const byKey = new Map();
  for (const doc of docs) {
    const current = byKey.get(doc.key);
    if (!current || Number(doc.revision || 0) > Number(current.revision || 0)) {
      byKey.set(doc.key, doc);
    }
  }
  return Array.from(byKey.values());
}

export function rebuildStateFromEntityDocs(docs = []) {
  const newest = pickNewestEntityDocs(docs);
  const state = {
    editais: [],
    eventos: [],
    arquivo: [],
    revisoes: [],
    habitos: {},
    planejamento: { sequencia: [] },
    config: { entityTombstones: [] }
  };

  for (const doc of newest) {
    if (doc.deletedAt || doc.payload === null) {
      state.config.entityTombstones.push({
        key: doc.key,
        collection: doc.collection,
        id: doc.id,
        deletedAt: doc.deletedAt,
        deletedBy: doc.updatedBy,
        revision: doc.revision
      });
      continue;
    }

    if (doc.collection === 'editais') state.editais.push({ ...doc.payload, disciplinas: [] });
    if (doc.collection === 'eventos') state.eventos.push(doc.payload);
    if (doc.collection === 'arquivo') state.arquivo.push(doc.payload);
    if (doc.collection === 'revisoes') state.revisoes.push(doc.payload);
    if (doc.collection.startsWith('habitos.')) {
      const type = doc.collection.split('.')[1];
      if (!state.habitos[type]) state.habitos[type] = [];
      state.habitos[type].push(doc.payload);
    }
    if (doc.collection === 'planejamento.sequencia') state.planejamento.sequencia.push(doc.payload);
  }

  for (const doc of newest.filter((item) => item.collection === 'disciplinas' && item.payload)) {
    const editalId = doc.key.split('/')[1];
    const edital = state.editais.find((item) => item.id === editalId);
    if (edital) edital.disciplinas.push({ ...doc.payload, assuntos: [], aulas: [] });
  }

  for (const doc of newest.filter((item) => ['assuntos', 'aulas'].includes(item.collection) && item.payload)) {
    const segments = doc.key.split('/');
    const edital = state.editais.find((item) => item.id === segments[1]);
    const disciplina = (edital?.disciplinas || []).find((item) => item.id === segments[3]);
    if (!disciplina) continue;
    const target = doc.collection === 'assuntos' ? 'assuntos' : 'aulas';
    disciplina[target].push(doc.payload);
  }

  return state;
}
```

- [ ] **Step 4: Run builder tests**

```powershell
npm run test:unit -- tests/unit/entity-state-builder.test.js
```

Expected: pass.

### Task C2: Compare Snapshot Payload With Entity Reconstruction

**Files:**
- Create: `src/js/sync/entity-shadow-verifier.js`
- Modify: `src/js/sync/firestore-sync-engine.js`
- Test: `tests/unit/entity-shadow-verifier.test.js`

- [ ] **Step 1: Write verifier tests**

Create `tests/unit/entity-shadow-verifier.test.js`:

```js
import { describe, expect, it } from 'vitest';

const verifier = await import('../../src/js/sync/entity-shadow-verifier.js?v=8.28');

describe('entity-shadow-verifier.js', () => {
  it('returns ok when snapshot manifest and entity docs agree', () => {
    const snapshot = {
      entityManifest: [
        { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', revision: 1, checksum: 'abc', deletedAt: null }
      ]
    };
    const docs = [
      { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', revision: 1, checksum: 'abc', deletedAt: null }
    ];

    expect(verifier.compareSnapshotManifestToEntityDocs(snapshot, docs)).toEqual({
      ok: true,
      missing: [],
      divergent: [],
      extra: []
    });
  });

  it('reports missing, divergent and extra entity docs', () => {
    const snapshot = {
      entityManifest: [
        { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', revision: 1, checksum: 'abc', deletedAt: null },
        { key: 'editais/ed_1', collection: 'editais', id: 'ed_1', revision: 2, checksum: 'def', deletedAt: null }
      ]
    };
    const docs = [
      { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', revision: 2, checksum: 'xyz', deletedAt: null },
      { key: 'revisoes/rev_1', collection: 'revisoes', id: 'rev_1', revision: 1, checksum: 'zzz', deletedAt: null }
    ];

    const diff = verifier.compareSnapshotManifestToEntityDocs(snapshot, docs);

    expect(diff.ok).toBe(false);
    expect(diff.missing).toEqual([expect.objectContaining({ key: 'editais/ed_1' })]);
    expect(diff.divergent).toEqual([expect.objectContaining({ key: 'eventos/ev_1' })]);
    expect(diff.extra).toEqual([expect.objectContaining({ key: 'revisoes/rev_1' })]);
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
npm run test:unit -- tests/unit/entity-shadow-verifier.test.js
```

Expected: fail until verifier exists.

- [ ] **Step 3: Implement verifier**

Create `src/js/sync/entity-shadow-verifier.js`:

```js
function byKey(items = []) {
  return new Map(items.map((item) => [item.key, item]));
}

function signature(item = {}) {
  return [
    item.revision ?? null,
    item.checksum ?? null,
    item.deletedAt ?? null
  ].join('|');
}

export function compareSnapshotManifestToEntityDocs(snapshotEnvelope = {}, entityDocs = []) {
  const snapshot = byKey(snapshotEnvelope.entityManifest || []);
  const remote = byKey(entityDocs || []);
  const missing = [];
  const divergent = [];
  const extra = [];

  for (const [key, item] of snapshot.entries()) {
    const remoteItem = remote.get(key);
    if (!remoteItem) {
      missing.push(item);
    } else if (signature(item) !== signature(remoteItem)) {
      divergent.push({ key, snapshot: item, entity: remoteItem });
    }
  }

  for (const [key, item] of remote.entries()) {
    if (!snapshot.has(key)) extra.push(item);
  }

  return {
    ok: missing.length === 0 && divergent.length === 0 && extra.length === 0,
    missing,
    divergent,
    extra
  };
}
```

- [ ] **Step 4: Run verifier tests**

```powershell
npm run test:unit -- tests/unit/entity-shadow-verifier.test.js
```

Expected: pass.

### Task C3: Add Manual Shadow Verification Action

**Files:**
- Modify: `src/js/sync/firestore-sync-engine.js`
- Modify: `src/js/ui/actions/config.js`
- Modify: `src/js/views.js`
- Test: `tests/unit/firestore-contracts.test.js`

- [ ] **Step 1: Add contract test**

In `tests/unit/firestore-contracts.test.js`, add:

```js
it('exposes manual entity shadow verification in the sync center', () => {
  const engine = read('src/js/sync/firestore-sync-engine.js');
  const actions = read('src/js/ui/actions/config.js');
  const views = read('src/js/views.js');

  expect(engine).toContain('export async function verifyFirestoreEntityShadow');
  expect(actions).toContain("registerAction('firestore-verify-entity-shadow'");
  expect(views).toContain('data-action="firestore-verify-entity-shadow"');
});
```

- [ ] **Step 2: Implement engine action**

In `firestore-sync-engine.js`, add:

```js
import {
  compareSnapshotManifestToEntityDocs
} from './entity-shadow-verifier.js?v=8.28';
```

Add:

```js
export async function verifyFirestoreEntityShadow() {
  const config = getConfig();
  const { db, uid } = requireSignedInServices();
  const snapshot = await readFirestoreSnapshot(db, uid);
  const entityDocs = await readFirestoreEntityDocuments(db, uid);
  const diff = compareSnapshotManifestToEntityDocs(snapshot || {}, entityDocs);
  if (!state.config.entitySync) state.config.entitySync = {};
  Object.assign(state.config.entitySync, {
    enabled: true,
    mode: state.config.entitySync.mode || 'shadow',
    lastShadowReadAt: new Date().toISOString(),
    lastShadowDiff: diff,
    lastError: diff.ok ? null : 'Entity shadow diverge do snapshot.'
  });
  await persistSyncConfig(false);
  document.dispatchEvent(new Event('app:renderCurrentView'));
  emitStatus(diff.ok ? 'synced' : 'error', { entityShadowDiff: diff });
  return diff;
}
```

- [ ] **Step 3: Register action**

In `src/js/ui/actions/config.js`, add:

```js
registerAction('firestore-verify-entity-shadow', () => window.EstudoApp?.verifyFirestoreEntityShadow?.());
```

- [ ] **Step 4: Expose action in `main.js` namespace**

If `main.js` imports `firestore_sync` with namespace export, no change is needed. Confirm `window.EstudoApp.verifyFirestoreEntityShadow` is present by checking existing namespace assignment. If not present, add it to the object assigned to `window.EstudoApp`.

- [ ] **Step 5: Add button and status**

In `views.js`, inside Firebase source actions, add:

```html
<button type="button" class="btn btn-outline btn-sm" data-action="firestore-verify-entity-shadow" ${status.signedIn ? '' : 'disabled'}>
  <i class="fa fa-list-check"></i> Verificar entidades
</button>
```

In the Firebase source card, show:

```js
${state.config?.entitySync?.lastShadowDiff && !state.config.entitySync.lastShadowDiff.ok
  ? `<div class="sync-source-note sync-source-note--error">Shadow divergiu: ${state.config.entitySync.lastShadowDiff.missing.length} ausentes, ${state.config.entitySync.lastShadowDiff.divergent.length} divergentes.</div>`
  : ''}
```

- [ ] **Step 6: Run tests**

```powershell
npm run test:unit -- tests/unit/firestore-contracts.test.js
```

Expected: pass.

## Phase D: Entity Conflict Review UI

Purpose: let the user review and resolve entity collisions with explicit choices.

### Task D1: Build Conflict Review Model

**Files:**
- Create: `src/js/sync/entity-conflict-model.js`
- Test: `tests/unit/entity-conflict-model.test.js`

- [ ] **Step 1: Write tests**

Create `tests/unit/entity-conflict-model.test.js`:

```js
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
```

- [ ] **Step 2: Implement model**

Create:

```js
export function buildEntityConflictReviewModel(items = []) {
  const normalized = items.map((item) => {
    let decisionHint = 'manual';
    if (Number(item.localRevision) > Number(item.remoteRevision)) decisionHint = 'local-newer';
    if (Number(item.remoteRevision) > Number(item.localRevision)) decisionHint = 'remote-newer';
    return {
      ...item,
      decisionHint
    };
  });

  return {
    total: normalized.length,
    requiresManualReview: normalized.some((item) => item.decisionHint === 'manual'),
    items: normalized
  };
}
```

- [ ] **Step 3: Run tests**

```powershell
npm run test:unit -- tests/unit/entity-conflict-model.test.js
```

Expected: pass.

### Task D2: Render Review Dialog

**Files:**
- Modify: `src/js/views.js`
- Modify: `src/js/ui/actions/config.js`
- Test: `tests/e2e/app.spec.js`

- [ ] **Step 1: Add E2E test**

Add to `tests/e2e/app.spec.js`:

```js
test('shows entity conflict review details in settings', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.EstudoApp.setState({
      schemaVersion: 9,
      editais: [],
      eventos: [],
      arquivo: [],
      habitos: { questoes: [], revisao: [], discursiva: [], simulado: [], leitura: [], informativo: [], sumula: [], videoaula: [], paginas: [] },
      revisoes: [],
      planejamento: { sequencia: [] },
      ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
      config: {
        firestoreSync: {
          enabled: true,
          mode: 'primary',
          conflict: {
            detectedAt: '2026-04-29T10:00:00.000Z',
            items: [
              { collection: 'editais', id: 'ed_1', localRevision: 1, remoteRevision: 2 },
              { collection: 'eventos', id: 'ev_1', localRevision: null, remoteRevision: null }
            ]
          }
        }
      },
      cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
      bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} }
    });
    window.EstudoApp.navigate('config');
  });

  await expect(page.locator('[data-testid="sync-source-conflict-entities"]')).toContainText('editais');
  await page.locator('[data-action="firestore-open-conflict-review"]').click();
  await expect(page.locator('[data-testid="entity-conflict-review"]')).toContainText('ed_1');
  await expect(page.locator('[data-testid="entity-conflict-review"]')).toContainText('ev_1');
});
```

- [ ] **Step 2: Add button**

In `views.js`, when source is Firebase and has conflict items, render:

```html
<button type="button" class="btn btn-outline btn-sm" data-action="firestore-open-conflict-review">
  <i class="fa fa-magnifying-glass"></i> Revisar entidades
</button>
```

- [ ] **Step 3: Add review renderer**

In `views.js`, add:

```js
function renderEntityConflictReview(conflict) {
  const items = Array.isArray(conflict?.items) ? conflict.items : [];
  return `
    <div class="modal-content" data-testid="entity-conflict-review">
      <div class="modal-header">
        <h3>Revisar conflito Firestore</h3>
        <button type="button" class="icon-btn" data-action="close-modal" data-modal="modal-prompt"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        ${items.map((item) => `
          <div class="sync-conflict-entity-review-row">
            <strong>${esc(item.collection || 'entidade')}</strong>
            <code>${esc(item.id || item.key || 'sem-id')}</code>
            <span>Local rev. ${esc(item.localRevision ?? '-')}</span>
            <span>Remoto rev. ${esc(item.remoteRevision ?? '-')}</span>
          </div>
        `).join('')}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" data-action="firestore-export-local">Exportar local</button>
        <button type="button" class="btn btn-primary" data-action="firestore-pull-remote">Baixar Firestore</button>
        <button type="button" class="btn btn-danger" data-action="firestore-force-push">Enviar local</button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 4: Register action**

In `src/js/ui/actions/config.js`, add:

```js
registerAction('firestore-open-conflict-review', () => {
  const conflict = window.EstudoApp?.state?.config?.firestoreSync?.conflict;
  const modal = document.getElementById('modal-prompt');
  if (!modal || typeof window.EstudoApp?.renderEntityConflictReview !== 'function') return;
  modal.innerHTML = window.EstudoApp.renderEntityConflictReview(conflict);
  window.EstudoApp.openModal('modal-prompt');
});
```

Export `renderEntityConflictReview` from `views.js` and ensure it is available through `window.EstudoApp`.

- [ ] **Step 5: Run E2E test**

```powershell
npm run test:e2e -- tests/e2e/app.spec.js
```

Expected: pass.

## Phase E: Controlled Entity Cutover

Purpose: switch production writes from snapshot-only to entity-primary while preserving snapshot fallback.

### Task E1: Add Entity Primary Mode Flag

**Files:**
- Modify: `src/js/store.js`
- Modify: `src/js/sync/sync-center.js`
- Modify: `src/js/views.js`
- Test: `tests/unit/sync-center.test.js`

- [ ] **Step 1: Add test**

In `tests/unit/sync-center.test.js`, add:

```js
it('labels Firestore entity primary as experimental when enabled', () => {
  const model = syncCenter.buildSyncCenterModel({
    state: {
      config: {
        localBackupAt: '2026-04-29T10:00:00.000Z',
        firestoreSync: { enabled: true, mode: 'primary' },
        entitySync: { enabled: true, mode: 'primary' }
      }
    },
    firestoreStatus: { configured: true, signedIn: true, enabled: true, mode: 'primary' }
  });

  expect(model.sources.find((source) => source.id === 'firebase').detail).toContain('Entidades');
});
```

- [ ] **Step 2: Update config defaults**

Set valid entity sync modes:

```js
entitySync: {
  enabled: false,
  mode: 'off'
}
```

Allowed modes:

```text
off -> no entity docs
shadow -> write/read verify entity docs while snapshot remains primary
primary -> entity docs are production write path; snapshot remains fallback mirror
```

- [ ] **Step 3: Update Sync Center model**

When `entitySync.mode === 'primary'`, Firebase detail should read:

```text
Entidades primarias com snapshot de fallback.
```

When `entitySync.mode === 'shadow'`, Firebase detail should read:

```text
Snapshot primario com entidades em shadow.
```

- [ ] **Step 4: Run test**

```powershell
npm run test:unit -- tests/unit/sync-center.test.js
```

Expected: pass.

### Task E2: Entity-Primary Write Path

**Files:**
- Modify: `src/js/sync/firestore-sync-engine.js`
- Test: `tests/unit/firestore-entity-primary-contracts.test.js`

- [ ] **Step 1: Add contract test**

Create `tests/unit/firestore-entity-primary-contracts.test.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('entity primary contracts', () => {
  it('writes entity docs before snapshot fallback when entity primary is enabled', () => {
    const engine = read('src/js/sync/firestore-sync-engine.js');

    expect(engine).toContain('isEntityPrimaryEnabled');
    expect(engine).toContain('await flushFirestoreEntityOutbox({ manual: options.manual, primary: true })');
    expect(engine).toContain('await writeFirestoreSnapshot');
  });
});
```

- [ ] **Step 2: Implement primary gate**

In `firestore-sync-engine.js`, add:

```js
function isEntityPrimaryEnabled() {
  const entitySync = state.config?.entitySync || {};
  return Boolean(entitySync.enabled && entitySync.mode === 'primary');
}
```

- [ ] **Step 3: Change flush order**

In `flushFirestoreOutbox()`, before `writeFirestoreSnapshot`, add:

```js
if (isEntityPrimaryEnabled()) {
  await queueFirestoreEntityBatchFromState(state, {
    manual: options.manual,
    sentAt: pending.envelope.sentAt
  });
  await flushFirestoreEntityOutbox({ manual: options.manual, primary: true });
}
```

Keep snapshot write after this as fallback mirror:

```js
const result = await writeFirestoreSnapshot(db, uid, pending.envelope);
```

- [ ] **Step 4: Add rollback behavior**

If entity write fails, do not write snapshot mirror. Set:

```js
config.lastError = 'Falha no envio de entidades Firestore; snapshot fallback nao foi atualizado.';
config.hasPendingWrites = true;
```

Return `false` and keep outbox pending.

- [ ] **Step 5: Run contract tests**

```powershell
npm run test:unit -- tests/unit/firestore-entity-primary-contracts.test.js
```

Expected: pass.

### Task E3: Entity-Primary Pull Path

**Files:**
- Modify: `src/js/sync/firestore-sync-engine.js`
- Modify: `src/js/sync/entity-state-builder.js`
- Test: `tests/unit/entity-state-builder.test.js`

- [ ] **Step 1: Extend builder to merge with base local state**

Add test:

```js
it('builds an applyable state by overlaying entity docs on base state', () => {
  const base = {
    schemaVersion: 9,
    editais: [],
    eventos: [],
    arquivo: [],
    habitos: { questoes: [] },
    revisoes: [],
    planejamento: { sequencia: [] },
    config: { visualizacao: 'mes' }
  };
  const docs = [
    { key: 'eventos/ev_1', collection: 'eventos', id: 'ev_1', payload: { id: 'ev_1', titulo: 'Remoto' }, revision: 1 }
  ];

  const next = builder.applyEntityDocsToState(base, docs);

  expect(next.config.visualizacao).toBe('mes');
  expect(next.eventos).toEqual([{ id: 'ev_1', titulo: 'Remoto' }]);
});
```

Implement:

```js
export function applyEntityDocsToState(baseState = {}, docs = []) {
  const rebuilt = rebuildStateFromEntityDocs(docs);
  return {
    ...baseState,
    ...rebuilt,
    config: {
      ...(baseState.config || {}),
      ...(rebuilt.config || {})
    },
    planejamento: {
      ...(baseState.planejamento || {}),
      ...(rebuilt.planejamento || {})
    }
  };
}
```

- [ ] **Step 2: Use entity docs in pull when primary**

In `pullFromFirestore()` and `syncFirestoreNow()`, when `isEntityPrimaryEnabled()`:

```js
const entityDocs = await readFirestoreEntityDocuments(db, uid);
const nextState = applyEntityDocsToState(state, entityDocs);
setState(nextState);
await saveStateToDB(true, true, true, { touchLocalBackup: false });
```

Keep snapshot fallback if entity docs are empty:

```js
if (entityDocs.length === 0 && remote) {
  const nextState = applyEnvelopeToLocalState(remote, config);
  setState(nextState);
}
```

- [ ] **Step 3: Run tests**

```powershell
npm run test:unit -- tests/unit/entity-state-builder.test.js
```

Expected: pass.

## Phase F: Cleanup and Release Hardening

Purpose: remove ambiguity after entity-primary has been validated.

### Task F1: Add Migration and Recovery Documentation

**Files:**
- Modify: `src/docs/api/sync-contract.md`
- Modify: `src/docs/architecture/data-flow.md`
- Create: `src/docs/sync/entity-sync-runbook.md`

- [ ] **Step 1: Create runbook**

Create `src/docs/sync/entity-sync-runbook.md`:

```md
# Entity Sync Runbook

## Modes

- `off`: no entity docs are written.
- `shadow`: snapshot remains production; entity docs are written and verified.
- `primary`: entity docs are production; snapshot remains fallback mirror.

## Recovery

1. Export local backup from Settings.
2. If entity primary is divergent, switch `config.entitySync.mode` to `shadow`.
3. Pull Firestore snapshot fallback.
4. Verify entity shadow.
5. Re-enable entity primary only after `lastShadowDiff.ok === true`.

## Rollback

Set:

```json
{
  "config": {
    "entitySync": {
      "enabled": true,
      "mode": "shadow"
    }
  }
}
```

Snapshot sync remains available at `users/{uid}/snapshots/main`.
```

- [ ] **Step 2: Update contract docs**

In `sync-contract.md`, add sections for:

- entity doc shape
- entity primary mode
- snapshot fallback mirror
- rollback path

- [ ] **Step 3: Update data flow docs**

In `data-flow.md`, update Firestore flow to:

```text
Save local concluido
  -> entity metadata normalized
  -> snapshot outbox queued
  -> entity outbox queued when entitySync is shadow/primary
  -> Firestore entity docs written first in primary
  -> snapshot mirror written after successful entity write
```

### Task F2: Full Verification Gate

**Files:**
- Modify version-sensitive files under `src/` and `tests/`.

- [ ] **Step 1: Bump cache version**

Bump current cache/import version from the previous value to the next one. If the project is at `8.29`, use `8.30`.

Files to check:

```text
src/index.html
src/sw.js
src/js/**/*.js
tests/**/*.js
```

Command to find leftovers:

```powershell
rg -n "8\\.29|v=8\\.29|APP_VERSION = '8\\.29'" src tests
```

- [ ] **Step 2: Run unit tests**

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run E2E tests**

```powershell
npm run test:e2e
```

Expected: all tests pass.

- [ ] **Step 4: Manual browser validation**

Run local server:

```powershell
npx http-server src -p 8096 -c-1
```

Validate:

- Settings > Central de Sincronizacao in desktop width `1366x900`
- Settings > Central de Sincronizacao in mobile width `390x844`
- Firestore conflict with entity list does not overflow horizontally
- Exported JSON contains `_sync` and tombstones but not `cfToken`, `cfUrl`, or Firebase credentials
- Offline local save still works before login
- Cloudflare and Drive buttons are still manual backup/restore actions

- [ ] **Step 5: Commit and push**

```powershell
git status --short --branch
git add firestore.rules src tests
git commit -m "feat(sync): habilita firestore por entidades em shadow"
git push origin main
```

Use a more specific commit message if only one phase was completed:

```text
feat(sync): adiciona dual-write shadow por entidade
feat(sync): verifica shadow de entidades firestore
feat(sync): adiciona revisao de conflitos por entidade
feat(sync): habilita cutover controlado por entidade
docs(sync): documenta runbook de entity sync
```

## Suggested Execution Order

Use this order exactly:

1. Phase B only: schema, repository, outbox, rules, shadow dual-write.
2. Commit and push Phase B after full tests pass.
3. Phase C only: shadow read verification and drift reporting.
4. Commit and push Phase C after full tests pass.
5. Phase D only: conflict review UI.
6. Commit and push Phase D after full tests and browser validation pass.
7. Phase E only: entity-primary cutover behind `entitySync.mode === 'primary'`.
8. Commit and push Phase E after full tests and browser validation pass.
9. Phase F docs/runbook and release hardening.

## Stop Conditions

Stop and report instead of continuing if any of these happen:

- Firestore rules require broad write access outside `users/{uid}`.
- Entity docs cannot be reconstructed into the current nested state shape.
- `npm test` or `npm run test:e2e` fails after implementation and the failure is not clearly preexisting.
- Entity-primary mode would overwrite snapshot fallback after a failed entity write.
- Conflict UI cannot show the entity list on mobile without horizontal overflow.
- Exported backups include credentials.

## Handoff Summary for Another AI

The next AI should begin with Phase B. The correct first deliverable is not a cutover; it is shadow dual-write to `users/{uid}/entities/{entityKey}` while continuing to write `users/{uid}/snapshots/main`. The snapshot is still the safety net. Entity-primary mode should not be enabled until shadow writes and shadow reads agree with the snapshot manifest over tests and manual browser validation.
