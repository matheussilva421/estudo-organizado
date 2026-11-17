import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

test('f7 local backup exports a valid F7 manifest without credentials', async ({ page }, testInfo) => {
  await resetF7Ux(page, '/#/settings');
  await seedAcademicData(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar arquivo local' }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('f7-local-backup.json');
  await download.saveAs(backupPath);
  const raw = await readFile(backupPath, 'utf8');
  const backup = JSON.parse(raw) as {
    manifest?: { formatVersion?: number; profileId?: string; recordCount?: number };
    payload?: { subjects?: unknown[]; editais?: unknown[]; operations?: unknown[] };
  };

  expect(backup.manifest).toMatchObject({
    formatVersion: 3,
    profileId: 'local-default',
  });
  expect(backup.manifest?.recordCount).toBeGreaterThan(0);
  expect(backup.payload?.subjects).toHaveLength(1);
  expect(backup.payload?.editais).toHaveLength(1);
  expect(backup.payload?.operations?.length).toBeGreaterThan(0);
  expect(raw).not.toMatch(/"(?:accessToken|refreshToken|idToken|password|authorization|cookie)"/i);
});
