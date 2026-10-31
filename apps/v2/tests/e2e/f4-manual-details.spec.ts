import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('f4 manual session records measurements materials and allocation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['subjects', 'editais', 'edital_disciplines'],
      'readwrite',
    );
    transaction.objectStore('subjects').put({
      id: 'subject-1',
      profileId: 'local-default',
      title: 'Direito Constitucional',
      localRevision: 1,
    });
    transaction.objectStore('editais').put({
      id: 'edital-1',
      profileId: 'local-default',
      title: 'TJPB',
      status: 'ACTIVE',
      localRevision: 1,
    });
    transaction.objectStore('edital_disciplines').put({
      id: 'link-1',
      profileId: 'local-default',
      editalId: 'edital-1',
      subjectId: 'subject-1',
      status: 'ACTIVE',
      localRevision: 1,
      orderKey: 'a',
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByLabel('Duração da sessão (min)').fill('60');
  await page.getByLabel('Nota').fill('sessão detalhada');
  await page.getByText('Detalhes da sessão').click();
  await page.getByTestId('session-questions').fill('10');
  await page.getByTestId('session-correct').fill('7');
  await page.getByTestId('session-pages-from').fill('12');
  await page.getByTestId('session-pages-to').fill('20');
  await page.getByTestId('session-material-title').fill('Material E2E');
  await page.getByTestId('session-material-url').fill('https://example.com/material.pdf');
  await page.getByTestId('session-material-notes').fill('nota material');
  await page.getByTestId('session-allocation-link').selectOption('link-1');
  await page.getByTestId('session-allocation-minutes').fill('30');
  await page.getByTestId('session-allocation-add').click();
  await expect(page.getByTestId('session-allocation-summary')).toContainText('00:30:00');
  await page.getByTestId('session-manual-submit').click();
  await expect(page.locator('[data-testid="session-history"]')).toContainText('MANUAL');
  const sessionId = await page
    .locator('[data-testid="session-history"] li')
    .first()
    .getAttribute('data-session-id');
  await page.getByTestId('session-revisions-' + sessionId).click();
  await expect(page.locator('[data-testid="session-history"]')).toContainText('CORRECTED');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('session-export-json').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const payload = JSON.parse(readFileSync(path as string, 'utf8')) as {
    sessions: Array<{
      origin: string;
      measurements?: Array<{ questions: number; correctAnswers: number }>;
      materials?: Array<{ title: string }>;
      allocations?: Array<{ durationMs: number }>;
      note?: string;
    }>;
  };
  const manual = payload.sessions.find((session) => session.origin === 'MANUAL');
  expect(manual?.measurements?.[0]?.questions).toBe(10);
  expect(manual?.measurements?.[0]?.correctAnswers).toBe(7);
  expect(manual?.materials?.[0]?.title).toBe('Material E2E');
  expect(manual?.allocations?.[0]?.durationMs).toBe(30 * 60_000);
  expect(manual?.note).toBe('sessão detalhada');
});
