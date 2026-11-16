import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

function remapProfile(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(remapProfile);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      next[key] = key === 'profileId' ? 'other-profile' : remapProfile(entry);
    }
    return next;
  }
  return value;
}

test('F5 portability preview discriminates compatible, invalid and foreign profiles without writing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.seedReviewCommitments('local-default', 1);
  });
  await page.reload();
  await page.goto('/#/reviews');
  const portability = page.getByTestId('review-portability');
  await expect(portability).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await portability.getByRole('button', { name: 'Exportar JSON acadêmico' }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  if (!filePath) throw new Error('download sem caminho');
  const raw = readFileSync(filePath, 'utf8');

  const input = portability.getByLabel('Importar JSON');
  await input.setInputFiles({
    name: 'revisoes-f5.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect(portability).toContainText('Prévia:');
  await expect(portability.getByRole('button', { name: 'Aplicar importação' })).toBeVisible();
  if (process.env.F7_UXH_STATE_DIR) {
    await portability.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/review-import-preview.png',
    });
  }

  await input.setInputFiles({
    name: 'invalido.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(portability).toContainText('Inválido:');
  await expect(portability.getByRole('button', { name: 'Aplicar importação' })).toHaveCount(0);

  const foreign = JSON.stringify(remapProfile(JSON.parse(raw)));
  await input.setInputFiles({
    name: 'outro-perfil.json',
    mimeType: 'application/json',
    buffer: Buffer.from(foreign),
  });
  await expect(portability).toContainText('Conflito:');
  await expect(portability).toContainText('outro perfil');
  await expect(portability.getByRole('button', { name: 'Aplicar importação' })).toHaveCount(0);

  await expect(page.getByTestId('review-agenda')).toContainText('Pendente');
});

