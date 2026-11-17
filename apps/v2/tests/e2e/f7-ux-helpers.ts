import { expect, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

export async function resetF7Ux(page: Page, route = '/#/home'): Promise<void> {
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
  });
  await page.goto(route);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

export async function seedAcademicData(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.execute({
      operationId: 'f7ux-subject',
      profileId: 'local-default',
      subjectId: 'f7ux-subject',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'f7ux-edital',
      profileId: 'local-default',
      editalId: 'f7ux-edital',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'f7ux-link',
      profileId: 'local-default',
      editalId: 'f7ux-edital',
      subjectId: 'f7ux-subject',
      linkId: 'f7ux-link',
    });
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'f7ux-assunto',
      profileId: 'local-default',
      value: {
        id: 'f7ux-assunto',
        profileId: 'local-default',
        editalDisciplineId: 'f7ux-link',
        parentId: null,
        parentKey: '',
        title: 'Controle de constitucionalidade',
        orderKey: '',
        localRevision: 0,
      },
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

export async function seedAnalyticsSessions(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.execute({
      operationId: 'f7ux-subject-2',
      profileId: 'local-default',
      subjectId: 'f7ux-subject-2',
      type: 'create',
      title: 'Direito Administrativo',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'f7ux-edital-2',
      profileId: 'local-default',
      editalId: 'f7ux-edital-2',
      title: 'TJRO 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'f7ux-link-2',
      profileId: 'local-default',
      editalId: 'f7ux-edital-2',
      subjectId: 'f7ux-subject-2',
      linkId: 'f7ux-link-2',
    });
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Fortaleza',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('sessions', 'readwrite');
    transaction.objectStore('sessions').put({
      id: 'analytics-session-1',
      profileId: 'local-default',
      state: 'COMPLETED',
      origin: 'TIMER',
      localRevision: 1,
      schemaVersion: 1,
      referenceZone: 'America/Fortaleza',
      recordedAtCivilDate: today,
      planBlockIds: [],
      editalIds: ['f7ux-edital'],
      intervals: [
        {
          id: 'analytics-interval-1',
          kind: 'FOCUS',
          verifiedMs: 1_800_000,
          contextId: null,
          checkpoint: null,
          recoveryFlag: false,
        },
      ],
      measurements: [],
      allocations: [
        {
          sessionId: 'analytics-session-1',
          allocationId: 'analytics-allocation-1',
          editalDisciplineId: 'f7ux-link',
          durationMs: 1_800_000,
        },
      ],
    });
    transaction.objectStore('sessions').put({
      id: 'analytics-session-2',
      profileId: 'local-default',
      state: 'COMPLETED',
      origin: 'TIMER',
      localRevision: 1,
      schemaVersion: 1,
      referenceZone: 'America/Fortaleza',
      recordedAtCivilDate: today,
      planBlockIds: [],
      editalIds: ['f7ux-edital-2'],
      intervals: [
        {
          id: 'analytics-interval-2',
          kind: 'FOCUS',
          verifiedMs: 600_000,
          contextId: null,
          checkpoint: null,
          recoveryFlag: false,
        },
      ],
      measurements: [],
      allocations: [
        {
          sessionId: 'analytics-session-2',
          allocationId: 'analytics-allocation-2',
          editalDisciplineId: 'f7ux-link-2',
          durationMs: 600_000,
        },
      ],
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });
}
