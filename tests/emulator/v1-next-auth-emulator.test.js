import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

const projectId = 'demo-estudo-v1-t11-auth';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8087';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.AUTH_EMULATOR_HOST || '127.0.0.1:9097';
let env;

function splitHost(value) {
  const separator = value.lastIndexOf(':');
  return { host: value.slice(0, separator), port: Number(value.slice(separator + 1)) };
}

async function signUp(label) {
  const email = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'local-test-password', returnSecureToken: true }),
    },
  );
  if (!response.ok) {
    throw new Error(`Auth Emulator signUp failed with HTTP ${response.status}`);
  }
  return response.json();
}

async function readControl(uid, idToken) {
  const response = await fetch(
    `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/` +
      `users/${uid}/v1SyncControl/current`,
    { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} },
  );
  return response.status;
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      ...splitHost(firestoreHost),
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env?.cleanup();
});

it('uses a real Auth Emulator token for own-UID reads and denies another UID', async () => {
  const userA = await signUp('auth-a');
  const userB = await signUp('auth-b');

  expect(userA.idToken).toBeTruthy();
  expect(userA.localId).toBeTruthy();
  expect(userB.localId).not.toBe(userA.localId);

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const uid of [userA.localId, userB.localId]) {
      await setDoc(doc(db, `users/${uid}/v1SyncControl/current`), {
        schemaVersion: 1,
        generationId: 'g-auth',
        updatedAt: serverTimestamp(),
      });
    }
  });

  await expect(readControl(userA.localId, userA.idToken)).resolves.toBe(200);
  await expect(readControl(userA.localId, userB.idToken)).resolves.toBe(403);
  await expect(readControl(userB.localId, userA.idToken)).resolves.toBe(403);
  await expect(readControl(userA.localId, null)).resolves.toBe(403);
});
