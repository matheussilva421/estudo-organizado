import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import { exportF2Snapshot } from '../../src/platform/backup/f2-format';
import { resetF7Ux } from './f7-ux-helpers';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('f7 ux recognizes an F2 preview without presenting it as F7 restore', async ({ page }) => {
  await resetF7Ux(page, '/#/settings');
  const legacy = await exportF2Snapshot({
    subjects: [
      {
        id: 'legacy-subject',
        profileId: 'local-default',
        title: 'Arquivo legado',
        localRevision: 1,
      },
    ],
    epoch: 0,
    deletionHistoryComplete: true,
  });
  const input = page.getByTestId('f6-settings').locator('input[type="file"]').first();
  await input.setInputFiles({
    name: 'f2-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect(page.getByText(/Arquivo F1\/F2 reconhecido/)).toBeVisible();
  await expect(page.getByText(/nenhuma restauração direta foi executada/i)).toBeVisible();
  const count = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.countStore('subjects'),
  );
  expect(count).toBe(0);
});
