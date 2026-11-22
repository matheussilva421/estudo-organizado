import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import { doc, initializeFirestore, setDoc, type Firestore } from 'firebase/firestore';
import type { OutboxOperation } from '../../src/application/sync-types';
import {
  createFirestorePort,
  FirebaseRemotePort,
  type FirestorePort,
} from '../../src/platform/sync/firebase-remote';

const require = createRequire(import.meta.url);
const firebaseToolsAuth = require('firebase-tools/lib/auth.js') as {
  getGlobalDefaultAccount(): { tokens: { refresh_token: string; scopes?: string[] } } | undefined;
  getAccessToken(refreshToken: string, scopes: string[]): Promise<{ access_token?: string }>;
};

const tokensPath = process.env.EO_SYNTHETIC_TOKENS ?? '';
const projectId = 'eo-v2-f7-test-20261117';
const profileId = 'local-default';
const runId = Date.now().toString(36);
const libraryId = `library-real-${runId}`;
const entityId = `real-entity-${runId}`;
const secondEntityId = `real-entity-2-${runId}`;

type SyntheticUser = { uid: string; email: string };
type Session = { app: FirebaseApp; auth: Auth; db: Firestore; store: FirestorePort; remote: FirebaseRemotePort };

let aUser: SyntheticUser;
let bUser: SyntheticUser;
let a1: Session;
let a2: Session;
let b: Session;
let cliToken = '';
// Populated in beforeAll; kept outside the helper to avoid reading .env twice.
let awaitableEnv = '';

function environment(): Record<string, string> {
  return Object.fromEntries(
    (awaitableEnv ?? '').split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z0-9_]+)\s*=(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], (match[2] ?? '').trim()]),
  );
}

async function adminToken(): Promise<string> {
  const account = firebaseToolsAuth.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI account missing');
  const refreshed = await firebaseToolsAuth.getAccessToken(
    account.tokens.refresh_token,
    account.tokens.scopes ?? [],
  );
  if (!refreshed.access_token) throw new Error('Firebase CLI access token missing');
  return refreshed.access_token;
}

async function setPassword(uid: string, password: string): Promise<void> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cliToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid, password }),
    },
  );
  if (!response.ok) throw new Error(`password update failed: ${response.status}`);
}

async function signIn(name: string, user: SyntheticUser, password: string): Promise<Session> {
  const env = environment();
  const app = initializeApp(
    {
      apiKey: env.VITE_V2_FIREBASE_API_KEY,
      authDomain: env.VITE_V2_FIREBASE_AUTH_DOMAIN,
      projectId,
      appId: env.VITE_V2_FIREBASE_APP_ID,
    },
    `${name}-${runId}`,
  );
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  const credential = await signInWithEmailAndPassword(auth, user.email, password);
  if (credential.user.uid !== user.uid) throw new Error('synthetic uid mismatch');
  const db = initializeFirestore(app, { experimentalForceLongPolling: true });
  const store = await createFirestorePort(db);
  const remote = new FirebaseRemotePort({ uid: user.uid, remoteLibraryId: libraryId, profileId, store });
  return { app, auth, db, store, remote };
}

function operation(overrides: Partial<OutboxOperation> & Pick<OutboxOperation, 'operationId' | 'entityId' | 'kind'>): OutboxOperation {
  const payload = {
    id: overrides.entityId,
    profileId,
    title: 'Synthetic real entity',
    status: 'ACTIVE' as const,
    localRevision: 1,
  };
  return {
    profileId,
    entityType: 'edital',
    baseRevision: null,
    schemaVersion: 1,
    status: 'PENDING',
    deliveryUid: aUser.uid,
    remoteLibraryId: libraryId,
    ...overrides,
    payload: overrides.payload ?? payload,
  };
}

describe.skipIf(!tokensPath)('real Firebase Auth synthetic A/B and Firestore sync', () => {
  beforeAll(async () => {
    awaitableEnv = await readFile('.env.local', 'utf8');
    const tokens = JSON.parse(await readFile(tokensPath, 'utf8')) as {
      users: Array<{ uid: string; email: string }>;
    };
    aUser = tokens.users.find((user) => user.uid.includes('synthetic-a'))!;
    bUser = tokens.users.find((user) => user.uid.includes('synthetic-b'))!;
    if (!aUser || !bUser) throw new Error('synthetic users missing');
    cliToken = await adminToken();
    const aPassword = randomBytes(24).toString('base64url');
    const bPassword = randomBytes(24).toString('base64url');
    await setPassword(aUser.uid, aPassword);
    await setPassword(bUser.uid, bPassword);
    a1 = await signIn('real-a1', aUser, aPassword);
    a2 = await signIn('real-a2', aUser, aPassword);
    b = await signIn('real-b', bUser, bPassword);
  });

  afterAll(async () => {
    for (const session of [a1, a2, b]) {
      if (session) await deleteApp(session.app).catch(() => undefined);
    }
  });

  it('applies a causal create and reads it from a second same-UID client', async () => {
    const created = await a1.remote.apply(
      operation({ operationId: `create-${runId}`, entityId, kind: 'upsert' }),
    );
    expect(created).toEqual({ kind: 'APPLIED', remoteRevision: 1 });
    const read = await a2.remote.readEntity(aUser.uid, libraryId, entityId);
    expect(read?.revision).toBe(1);
    expect(read?.deleted).toBe(false);
    const page = await a2.remote.listAfter(aUser.uid, libraryId, 0, 0, 10);
    expect(page.changes).toHaveLength(1);
    expect(page.changes[0]).toMatchObject({ sequence: 1, entityId, revision: 1, deleted: false });
  });

  it('converges independent creates from two same-UID clients', async () => {
    const second = await a2.remote.apply(
      operation({ operationId: `create-2-${runId}`, entityId: secondEntityId, kind: 'upsert' }),
    );
    expect(second).toEqual({ kind: 'APPLIED', remoteRevision: 1 });
    const page = await a1.remote.listAfter(aUser.uid, libraryId, 0, 1, 10);
    expect(page.changes.map((change) => change.entityId)).toContain(secondEntityId);
  });

  it('rejects a stale base revision without overwriting the newer entity', async () => {
    const updated = await a1.remote.apply(
      operation({
        operationId: `update-${runId}`,
        entityId,
        kind: 'upsert',
        baseRevision: 1,
        payload: { id: entityId, profileId, title: 'Newer title', status: 'ACTIVE', localRevision: 2 },
      }),
    );
    expect(updated).toEqual({ kind: 'APPLIED', remoteRevision: 2 });
    const stale = await a2.remote.apply(
      operation({
        operationId: `stale-${runId}`,
        entityId,
        kind: 'upsert',
        baseRevision: 1,
        payload: { id: entityId, profileId, title: 'Stale title', status: 'ACTIVE', localRevision: 2 },
      }),
    );
    expect(stale.kind).toBe('CONFLICT');
    if (stale.kind === 'CONFLICT') expect(stale.remoteRevision).toBe(2);
    expect(await a1.remote.readEntity(aUser.uid, libraryId, entityId)).toMatchObject({
      revision: 2,
      payload: { title: 'Newer title' },
    });
  });

  it('writes a tombstone and refuses resurrection by an old client', async () => {
    const deleted = await a1.remote.apply(
      operation({ operationId: `delete-${runId}`, entityId, kind: 'delete', baseRevision: 2 }),
    );
    expect(deleted).toEqual({ kind: 'APPLIED', remoteRevision: 3 });
    const tombstone = await a2.remote.readEntity(aUser.uid, libraryId, entityId);
    expect(tombstone).toMatchObject({ revision: 3, deleted: true, payload: null });
    const resurrect = await a2.remote.apply(
      operation({ operationId: `resurrect-${runId}`, entityId, kind: 'upsert', baseRevision: 1 }),
    );
    expect(resurrect.kind).toBe('CONFLICT');
    expect(await a2.remote.readEntity(aUser.uid, libraryId, entityId)).toMatchObject({ deleted: true });
  });

  it('denies cross-UID reads and writes against real Rules', async () => {
    const path = `users/${aUser.uid}/libraries/${libraryId}/entities/${entityId}`;
    await expect(b.store.get(path)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      setDoc(doc(b.db, `users/${aUser.uid}/libraries/${libraryId}/entities/raw-${runId}`), {
        entityId: `raw-${runId}`,
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(a1.store.get(path)).resolves.toBeTruthy();
  });
});
