import { expect, test } from '@playwright/test';
import {
  acceptDialogs,
  createEventItem,
  createEventOperation,
  createSingleEventState,
  createV1T11Harness,
  editEvent,
  localEventTitle,
  pendingCount,
  waitForAppReady,
  waitForWorker,
} from './v1-next-t11-harness.js';

const PROJECT_ID = 'demo-estudo-v1-t11-multidevice';
let harness;
let environment;
let sequence = 0;

function nextIds(label) {
  sequence += 1;
  return {
    uid: `uid_t11_${label}_${sequence}`,
    generationId: `gen_t11_${label}_${sequence}`,
  };
}

async function openPage(browser, ids) {
  const context = await browser.newContext();
  const page = await context.newPage();
  acceptDialogs(page);
  await harness.installPage(page, { uid: ids.uid });
  await page.goto('/');
  await waitForAppReady(page);
  await waitForWorker(page);
  await expect.poll(() => localEventTitle(page, 'ev_t11')).toBeTruthy();
  return { context, page };
}

async function waitAcknowledged(page, ids) {
  await expect.poll(() => pendingCount(page, ids.uid, ids.generationId), {
    timeout: 15_000,
  }).toBe(0);
}

test.beforeEach(async () => {
  const created = await createV1T11Harness({ projectId: PROJECT_ID });
  harness = created.hub;
  environment = created.environment;
  await harness.reset();
});

test.afterEach(async () => {
  await environment?.cleanup();
});

test.describe('V1 NEXT multidispositivo', () => {
  test('A edita e confirma; B recebe no primeiro acesso; B altera; A reabre e sobrevive a reload', async ({
    browser,
  }) => {
    const ids = nextIds('shared');
    await harness.seedUser({
      ...ids,
      state: createSingleEventState('Título inicial'),
    });

    const first = await openPage(browser, ids);
    await editEvent(first.page, { id: 'ev_t11', title: 'Edição de A' });
    await waitAcknowledged(first.page, ids);
    await first.context.close();

    const second = await openPage(browser, ids);
    await expect.poll(() => localEventTitle(second.page, 'ev_t11')).toBe('Edição de A');
    await editEvent(second.page, { id: 'ev_t11', title: 'Edição de B' });
    await waitAcknowledged(second.page, ids);
    await second.context.close();

    const reopened = await openPage(browser, ids);
    await expect.poll(() => localEventTitle(reopened.page, 'ev_t11')).toBe('Edição de B');
    await reopened.page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(reopened.page);
    await expect.poll(() => localEventTitle(reopened.page, 'ev_t11')).toBe('Edição de B');
    const inspected = await harness.inspect(ids.uid, ids.generationId);
    const eventOps = inspected.applyTrace.filter(row =>
      row.entityId === 'ev_t11' && row.acknowledged);
    expect(new Set(eventOps.map(row => row.opId)).size).toBe(2);
    await reopened.context.close();
  });

  test('duas abas do mesmo UID convergem e mantêm um único recibo por opId', async ({ browser }) => {
    const ids = nextIds('tabs');
    const state = createSingleEventState('Aba A');
    state.eventos.push({ ...state.eventos[0], id: 'ev_t11_b', titulo: 'Aba B' });
    await harness.seedUser({ ...ids, state });

    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    acceptDialogs(pageA);
    acceptDialogs(pageB);
    await harness.installPage(pageA, { uid: ids.uid });
    await harness.installPage(pageB, { uid: ids.uid });
    // Open the second tab after the first access settles; a simultaneous cold
    // start races the shared IndexedDB schema upgrade.
    await pageA.goto('/');
    await waitForAppReady(pageA);
    await pageB.goto('/');
    await waitForAppReady(pageB);
    await Promise.all([waitForWorker(pageA), waitForWorker(pageB)]);

    await Promise.all([
      editEvent(pageA, { id: 'ev_t11', title: 'Salvo pela aba A' }),
      editEvent(pageB, { id: 'ev_t11_b', title: 'Salvo pela aba B' }),
    ]);
    await Promise.all([waitAcknowledged(pageA, ids), waitAcknowledged(pageB, ids)]);
    const remoteA = await harness.readEntity(ids.uid, ids.generationId,
      'eventos', 'evento', 'ev_t11');
    const remoteB = await harness.readEntity(ids.uid, ids.generationId,
      'eventos', 'evento', 'ev_t11_b');
    expect(JSON.parse(remoteA.data).data.titulo).toBe('Salvo pela aba A');
    expect(JSON.parse(remoteB.data).data.titulo).toBe('Salvo pela aba B');
    await expect.poll(() => localEventTitle(pageA, 'ev_t11_b')).toBe('Salvo pela aba B');
    await expect.poll(() => localEventTitle(pageB, 'ev_t11')).toBe('Salvo pela aba A');

    const inspected = await harness.inspect(ids.uid, ids.generationId);
    const eventOps = inspected.applyTrace.filter(row =>
      (row.entityId === 'ev_t11' || row.entityId === 'ev_t11_b') &&
      row.acknowledged);
    expect(new Set(eventOps.map(row => row.opId)).size).toBe(2);
    await context.close();
  });

  test('UIDs diferentes não compartilham cache, listener ou resultados remotos', async ({ browser }) => {
    const idsA = nextIds('account_a');
    const idsB = nextIds('account_b');
    await harness.seedUser({ ...idsA, state: createSingleEventState('Somente A') });
    await harness.seedUser({ ...idsB, state: createSingleEventState('Somente B') });

    const accountA = await openPage(browser, idsA);
    const accountB = await openPage(browser, idsB);
    await editEvent(accountA.page, { id: 'ev_t11', title: 'A atualizado' });
    await waitAcknowledged(accountA.page, idsA);
    await expect.poll(() => localEventTitle(accountB.page, 'ev_t11')).toBe('Somente B');

    await editEvent(accountB.page, { id: 'ev_t11', title: 'B atualizado' });
    await waitAcknowledged(accountB.page, idsB);
    await expect.poll(() => localEventTitle(accountA.page, 'ev_t11')).toBe('A atualizado');

    expect((await harness.inspect(idsA.uid, idsA.generationId)).applyTrace
      .filter(row => row.entityId === 'ev_t11' && row.acknowledged).length).toBe(1);
    expect((await harness.inspect(idsB.uid, idsB.generationId)).applyTrace
      .filter(row => row.entityId === 'ev_t11' && row.acknowledged).length).toBe(1);
    await Promise.all([accountA.context.close(), accountB.context.close()]);
  });

  test('perda e retorno de Auth bloqueiam o trabalho e retomam a geração da mesma conta', async ({
    browser,
  }) => {
    const ids = nextIds('auth');
    await harness.seedUser({
      ...ids,
      state: createSingleEventState('Antes da perda de Auth'),
    });
    const session = await openPage(browser, ids);

    await session.page.evaluate(async uid => {
      const { init } = await import('/js/app.js?v=8.37');
      await init({
        windowRef: {},
        storage: { getItem: () => 'true' },
        initFirebaseServices: () => ({ configured: true, db: {}, auth: {} }),
        wireFirestores: () => {},
        observeFirebaseAuth: callback => {
          window.changeT11User = callback;
          callback({ uid });
          return () => {};
        },
        observeFirebaseIdToken: () => () => {},
        remoteApi: window.__ESTUDO_V1_SYNC_TEST__.remoteApi,
        online: true,
      });
      window.changeT11User(null);
    }, ids.uid);

    await expect(session.page.locator('[data-v1-sync-gate="blocked"]')).toBeVisible();
    await expect(session.page.locator('#sidebar')).toHaveAttribute('inert', '');
    await harness.applyOperation(createEventOperation({
      ...ids,
      opId: 'remote_during_auth_loss',
      baseRevision: 1,
      item: createEventItem('Atualização durante Auth perdida'),
    }));
    const callsWhileSignedOut = harness.applyCalls.get(ids.uid) || 0;
    await expect.poll(() => session.page.evaluate(() =>
      window.__T11_BRIDGE_STATS__.apply)).toBe(0);

    await session.page.evaluate(uid => window.changeT11User({ uid }), ids.uid);
    await expect(session.page.locator('[data-v1-sync-gate]')).toHaveCount(0);
    await expect.poll(() => localEventTitle(session.page, 'ev_t11'))
      .toBe('Atualização durante Auth perdida');
    expect(harness.applyCalls.get(ids.uid)).toBe(callsWhileSignedOut);
    await session.context.close();
  });

  test('rede flapping mantém a fila local, reconecta sem clique e recebe deltas perdidos', async ({
    browser,
  }) => {
    const ids = nextIds('flap');
    await harness.seedUser({ ...ids, state: createSingleEventState('Flapping inicial') });
    const session = await openPage(browser, ids);
    await session.context.setOffline(true);
    await expect.poll(() => session.page.evaluate(() => navigator.onLine)).toBe(false);
    await harness.applyOperation(createEventOperation({
      ...ids,
      opId: 'remote_during_network_flap',
      baseRevision: 1,
      item: createEventItem('Delta remoto durante queda'),
    }));

    await session.context.setOffline(false);
    await expect.poll(() => session.page.evaluate(() => navigator.onLine)).toBe(true);
    await expect.poll(() => localEventTitle(session.page, 'ev_t11'), {
      timeout: 15_000,
    }).toBe('Delta remoto durante queda');
    expect((await harness.inspect(ids.uid, ids.generationId)).applyTrace
      .filter(row => row.entityId === 'ev_t11' && row.acknowledged).length).toBe(1);

    const appliesBeforeLocal = harness.applyCalls.get(ids.uid) || 0;
    await session.context.setOffline(true);
    await expect.poll(() => session.page.evaluate(() => navigator.onLine)).toBe(false);
    await editEvent(session.page, { id: 'ev_t11', title: 'Salvo durante queda' });
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId)).toBe(1);
    expect(harness.applyCalls.get(ids.uid) || 0).toBe(appliesBeforeLocal);
    await session.context.setOffline(false);
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId), {
      timeout: 15_000,
    }).toBe(0);
    await expect.poll(() => localEventTitle(session.page, 'ev_t11'))
      .toBe('Salvo durante queda');
    expect(new Set((await harness.inspect(ids.uid, ids.generationId)).applyTrace
      .filter(row => row.entityId === 'ev_t11' && row.acknowledged)
      .map(row => row.opId)).size).toBe(2);
    await session.context.close();
  });
});
