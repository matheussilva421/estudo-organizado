import { expect, test } from '@playwright/test';
import {
  createSingleEventState,
  createV1T11Harness,
  waitForAppReady,
} from './v1-next-t11-harness.js';

const PROJECT_ID = 'demo-estudo-v1-native';
const GENERATION = 'gen_native_sdk';
const AUTH_HOST = process.env.AUTH_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9097';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
let harness;
let environment;
let sequence = 0;

test.skip(!process.env.AUTH_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST,
  'exige Auth Emulator real');

function nextEmail() {
  sequence += 1;
  return `native-${Date.now()}-${sequence}@example.test`;
}

async function signUp(email, password) {
  const response = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!response.ok) throw new Error(`Auth Emulator signUp: ${response.status}`);
  return response.json();
}

async function openNativePage(browser, { email, password, uid }) {
  // O emulador local vive em outro host/porta; bypassCSP evita bloquear o
  // loopback e mantém o teste fiel ao SDK nativo servido pelo app.
  const context = await browser.newContext({ bypassCSP: true });
  const page = await context.newPage();
  await page.addInitScript(({ authHost, firestoreHost }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_v1_sync_enabled', 'true');
    window.__ESTUDO_FIREBASE_EMULATOR__ = {
      authHost,
      firestoreHost,
    };
  }, { authHost: AUTH_HOST, firestoreHost: FIRESTORE_HOST });
  await page.route('**/*', async route => {
    if (route.request().url().includes('/js/firebase/firebase-runtime-config.js')) {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `window.ESTUDO_FIREBASE_CONFIG = ${JSON.stringify({
          apiKey: 'demo-key',
          authDomain: 'localhost',
          projectId: PROJECT_ID,
          appId: 'demo-app',
        })}; window.ESTUDO_APP_CHECK_SITE_KEY = '';`,
      });
      return;
    }
    await route.continue();
  });
  await page.goto('/');
  await page.evaluate(async ({ email: value, password: secret }) => {
    const client = await import('/js/firebase/firebase-client.js?v=8.37');
    await client.signInWithTestEmail(value, secret);
  }, { email, password });
  await waitForAppReady(page);
  await expect.poll(() => page.evaluate(async ({ accountUid }) => {
    const local = await import('/js/sync/v1-next/local.js');
    return (await local.getPendingOperations(accountUid, 'gen_native_sdk')).length;
  }, { accountUid: uid })).toBe(0);
  return { context, page };
}

test.describe('V1 native Firebase SDK', () => {
  test.beforeEach(async () => {
    const created = await createV1T11Harness({ projectId: PROJECT_ID });
    harness = created.hub;
    environment = created.environment;
    await harness.reset();
  });

  test.afterEach(async () => {
    await environment?.cleanup();
  });

  test('login, write, remote read and second real context converge through the native SDK', async ({ browser }) => {
    const email = nextEmail();
    const password = 'native-test-password';
    const user = await signUp(email, password);
    const uid = user.localId;
    await harness.seedUser({
      uid,
      generationId: GENERATION,
      state: createSingleEventState('Native inicial'),
    });

    const first = await openNativePage(browser, { email, password, uid });
    await expect.poll(() => first.page.evaluate(() =>
      window.state.eventos.find(event => event.id === 'ev_t11')?.titulo))
      .toBe('Native inicial');

    await first.page.evaluate(async () => {
      const event = window.state.eventos.find(item => item.id === 'ev_t11');
      event.titulo = 'Native A';
      await window.saveStateToDB({
        skipCloudSync: true,
        skipFirestoreSync: true,
        skipDriveSync: true,
      });
    });
    await expect.poll(() => first.page.evaluate(async ({ accountUid }) => {
      const local = await import('/js/sync/v1-next/local.js');
      return (await local.getPendingOperations(accountUid, 'gen_native_sdk')).length;
    }, { accountUid: uid }), { timeout: 20_000 }).toBe(0);
    const remote = await harness.readEntity(uid, GENERATION, 'eventos', 'evento', 'ev_t11');
    expect(JSON.parse(remote.data).data.titulo).toBe('Native A');

    const second = await openNativePage(browser, { email, password, uid });
    await expect.poll(() => second.page.evaluate(() =>
      window.state.eventos.find(event => event.id === 'ev_t11')?.titulo))
      .toBe('Native A');

    await second.page.evaluate(async () => {
      const event = window.state.eventos.find(item => item.id === 'ev_t11');
      event.titulo = 'Native B';
      await window.saveStateToDB({
        skipCloudSync: true,
        skipFirestoreSync: true,
        skipDriveSync: true,
      });
    });
    await expect.poll(() => first.page.evaluate(() =>
      window.state.eventos.find(event => event.id === 'ev_t11')?.titulo), {
      timeout: 20_000,
    }).toBe('Native B');
    await Promise.all([first.context.close(), second.context.close()]);
  });
});
