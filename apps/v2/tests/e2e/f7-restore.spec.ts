import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('f7 local restore previews before writing and verifies read-back', async ({ page }, testInfo) => {
  await resetF7Ux(page, '/#/settings');
  await seedAcademicData(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar arquivo local' }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('f7-restore-source.json');
  await download.saveAs(backupPath);

  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.countStore('subjects')),
  ).toBe(0);

  await page
    .getByTestId('f6-settings')
    .locator('input[type="file"]')
    .first()
    .setInputFiles(backupPath);
  const dialog = page.getByRole('dialog', { name: 'Aplicar restauração local?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/[1-9]\d* criação\(ões\), 0 atualização\(ões\), 0 conflito\(s\)/);
  await expect.poll(() =>
    page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.countStore('subjects')),
  ).toBe(0);

  const safetyCopy = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Aplicar restauração' }).click();
  const safety = await safetyCopy;
  const safetyPath = testInfo.outputPath('f7-pre-restore.json');
  await safety.saveAs(safetyPath);
  const safetySnapshot = JSON.parse(await readFile(safetyPath, 'utf8')) as {
    manifest?: { formatVersion?: number; profileId?: string };
  };
  expect(safetySnapshot.manifest).toMatchObject({
    formatVersion: 3,
    profileId: 'local-default',
  });
  await expect(page.getByText(/Backup restaurado e verificado por read-back transacional/i)).toBeVisible();
  for (const [store, expected] of [
    ['subjects', 1],
    ['editais', 1],
    ['edital_disciplines', 1],
    ['assuntos', 1],
  ] as const) {
    await expect.poll(() =>
      page.evaluate(
        (name) => (window as unknown as HarnessWindow).__v2E2E.countStore(name),
        store,
      ),
    ).toBe(expected);
  }
});
