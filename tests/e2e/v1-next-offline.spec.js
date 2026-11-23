import { expect, test } from '@playwright/test';
import {
  acceptDialogs,
  clearV1LocalStores,
  createEventItem,
  createEventOperation,
  createSingleEventState,
  createV1T11Harness,
  editEvent,
  localEventTitle,
  pendingCount,
  waitForAppReady,
  waitForOfflineShell,
} from './v1-next-t11-harness.js';

const PROJECT_ID = 'demo-estudo-v1-t11-offline';
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

async function openCachedPage(browser, ids) {
  const context = await browser.newContext();
  const page = await context.newPage();
  acceptDialogs(page);
  await harness.installPage(page, { uid: ids.uid });
  await page.goto('/');
  await waitForAppReady(page);
  await expect.poll(() => page.evaluate(() =>
    window.__T11_BRIDGE_STATS__?.subscribe || 0)).toBe(1);
  await waitForOfflineShell(page);
  await expect.poll(() => localEventTitle(page, 'ev_t11')).not.toBeNull();
  return { context, page };
}

async function remoteTitle(ids) {
  const record = await harness.readEntity(
    ids.uid,
    ids.generationId,
    'eventos',
    'evento',
    'ev_t11',
  );
  return record ? JSON.parse(record.data).data.titulo : null;
}

test.describe('V1 NEXT offline e recuperação', () => {
  test.use({ serviceWorkers: 'allow' });

  test.beforeEach(async () => {
    const created = await createV1T11Harness({ projectId: PROJECT_ID });
    harness = created.hub;
    environment = created.environment;
    await harness.reset();
  });

  test.afterEach(async () => {
    await environment?.cleanup();
  });

  test('offline antes do save mantém um único opId na outbox e confirma na reconexão', async ({
    browser,
  }) => {
    const ids = nextIds('before_save');
    await harness.seedUser({ ...ids, state: createSingleEventState('Offline inicial') });
    const session = await openCachedPage(browser, ids);
    const appliesBefore = harness.applyCalls.get(ids.uid) || 0;

    await session.context.setOffline(true);
    await expect.poll(() => session.page.evaluate(() => navigator.onLine)).toBe(false);
    await editEvent(session.page, { id: 'ev_t11', title: 'Salvo offline' });
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId)).toBe(1);
    expect(harness.applyCalls.get(ids.uid) || 0).toBe(appliesBefore);
    expect(await remoteTitle(ids)).toBe('Offline inicial');

    await session.context.setOffline(false);
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId), {
      timeout: 15_000,
    }).toBe(0);
    expect(await remoteTitle(ids)).toBe('Salvo offline');
    const inspected = await harness.inspect(ids.uid, ids.generationId);
    expect(inspected.total).toBe(1);
    expect(inspected.uniqueOpIds).toBe(1);
    expect(new Set(inspected.applyTrace.filter(row => row.acknowledged).map(row => row.opId))
      .size).toBe(1);
    await session.context.close();
  });

  test('queda imediatamente após o commit IDB preserva a operação já durável', async ({
    browser,
  }) => {
    const ids = nextIds('after_idb');
    await harness.seedUser({ ...ids, state: createSingleEventState('IDB inicial') });
    const session = await openCachedPage(browser, ids);
    const appliesBefore = harness.applyCalls.get(ids.uid) || 0;

    await editEvent(session.page, { id: 'ev_t11', title: 'Commit local durável' });
    await session.context.setOffline(true);
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId)).toBe(1);
    expect(harness.applyCalls.get(ids.uid) || 0).toBe(appliesBefore);

    await session.context.setOffline(false);
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId), {
      timeout: 15_000,
    }).toBe(0);
    expect(await remoteTitle(ids)).toBe('Commit local durável');
    expect((await harness.inspect(ids.uid, ids.generationId)).total).toBe(1);
    await session.context.close();
  });

  test('timeout depois do write remoto mantém o recibo e confirma no replay do mesmo opId', async ({
    browser,
  }) => {
    const ids = nextIds('lost_ack');
    await harness.seedUser({ ...ids, state: createSingleEventState('ACK inicial') });
    const session = await openCachedPage(browser, ids);
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId)).toBe(0);
    harness.dropNextAck.add(ids.uid);

    await editEvent(session.page, { id: 'ev_t11', title: 'ACK recuperado' });
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId)).toBe(1);
    await session.page.evaluate(() => document.dispatchEvent(
      new CustomEvent('stateSaved', { detail: { reason: 't11-lost-ack' } }),
    ));
    await expect.poll(() => harness.applyTrace.some(row =>
      row.uid === ids.uid && row.acknowledged === true && row.transportLost === true))
      .toBe(true);
    expect(await remoteTitle(ids)).toBe('ACK recuperado');
    let inspected = await harness.inspect(ids.uid, ids.generationId);
    expect(inspected.total).toBe(1);
    expect(inspected.uniqueOpIds).toBe(1);
    const retriedOpId = inspected.opIds[0];

    await session.context.setOffline(true);
    const cdp = await session.context.newCDPSession(session.page);
    const crashed = session.page.waitForEvent('crash');
    void cdp.send('Page.crash').catch(() => {});
    await crashed;
    await session.page.close();
    session.page = await session.context.newPage();
    acceptDialogs(session.page);
    await harness.installPage(session.page, { uid: ids.uid });
    await session.page.goto('/');
    await waitForAppReady(session.page);
    expect(await pendingCount(session.page, ids.uid, ids.generationId)).toBe(1);
    await session.context.setOffline(false);

    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId), {
      timeout: 15_000,
    }).toBe(0);
    inspected = await harness.inspect(ids.uid, ids.generationId);
    expect(inspected.total).toBe(2);
    expect(inspected.uniqueOpIds).toBe(1);
    expect(inspected.applyTrace.filter(row =>
      row.opId === retriedOpId && row.acknowledged)).toEqual([
      expect.objectContaining({ acknowledged: true, transportLost: true }),
      expect.objectContaining({ acknowledged: true, transportLost: false }),
    ]);
    expect(await harness.readEntity(
      ids.uid, ids.generationId, 'eventos', 'evento', 'ev_t11',
    )).toEqual(expect.objectContaining({ revision: 2 }));
    await session.context.close();
  });

  test('reload depois de save offline restaura a fila durável e efetiva o opId uma única vez', async ({
    browser,
  }) => {
    const ids = nextIds('reload');
    await harness.seedUser({ ...ids, state: createSingleEventState('Reload inicial') });
    const session = await openCachedPage(browser, ids);

    await session.context.setOffline(true);
    await expect.poll(() => session.page.evaluate(() => navigator.onLine)).toBe(false);
    await editEvent(session.page, { id: 'ev_t11', title: 'Antes do reload' });
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId)).toBe(1);

    await session.page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(session.page);
    await expect.poll(() => localEventTitle(session.page, 'ev_t11')).toBe('Antes do reload');
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId)).toBe(1);

    await session.context.setOffline(false);
    await expect.poll(() => pendingCount(session.page, ids.uid, ids.generationId), {
      timeout: 15_000,
    }).toBe(0);
    expect(await remoteTitle(ids)).toBe('Antes do reload');
    expect((await harness.inspect(ids.uid, ids.generationId)).total).toBe(1);
    await session.context.close();
  });

  test('primeiro acesso offline sem cache verificado bloqueia a edição sem tocar o remoto', async ({
    browser,
  }) => {
    const ids = nextIds('first_offline');
    await harness.seedUser({ ...ids, state: createSingleEventState('Baseline remota') });
    const session = await openCachedPage(browser, ids);
    await clearV1LocalStores(session.page);

    await session.context.setOffline(true);
    await session.page.reload({ waitUntil: 'domcontentloaded' });

    await expect(session.page.locator('[data-v1-sync-gate="requires-network"]')).toBeVisible();
    await expect(session.page.locator('#topbar-title')).toHaveText('Preparando dados');
    await expect(session.page.locator('#sidebar')).toHaveAttribute('inert', '');
    await expect(session.page.locator('#main-content')).not.toContainText('Baseline remota');
    expect(await session.page.evaluate(() => window.__T11_BRIDGE_STATS__))
      .toEqual({ apply: 0, get: 0, fetch: 0, subscribe: 0,
        createPoll: 0, poll: 0, pollErrors: 0 });
    await session.context.close();
  });

  test('cache verificado alterna offline/online e recebe o delta remoto sem clique', async ({
    browser,
  }) => {
    const ids = nextIds('cache_switch');
    await harness.seedUser({ ...ids, state: createSingleEventState('Cache inicial') });
    const session = await openCachedPage(browser, ids);

    await session.context.setOffline(true);
    await session.page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(session.page);
    await expect.poll(() => localEventTitle(session.page, 'ev_t11')).toBe('Cache inicial');
    expect(await session.page.evaluate(() => window.__T11_BRIDGE_STATS__.fetch)).toBe(0);

    await harness.applyOperation(createEventOperation({
      ...ids,
      opId: 'remote_while_cached_offline',
      baseRevision: 1,
      item: createEventItem('Delta após cache offline'),
    }));
    await session.context.setOffline(false);
    await expect.poll(() => session.page.evaluate(() => navigator.onLine)).toBe(true);
    await expect.poll(() => localEventTitle(session.page, 'ev_t11'), {
      timeout: 15_000,
    }).toBe('Delta após cache offline');
    expect((await harness.inspect(ids.uid, ids.generationId)).total).toBe(1);
    await session.context.close();
  });
});
