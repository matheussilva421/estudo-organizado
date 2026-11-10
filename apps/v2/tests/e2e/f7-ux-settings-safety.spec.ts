import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resetF7Ux } from './f7-ux-helpers';

test('f7 ux settings separates appearance, identity, backup, storage and privacy', async ({ page }) => {
  await resetF7Ux(page, '/#/settings');
  for (const heading of [
    'Aparência deste dispositivo',
    'Perfil e conexão',
    'Cofre local e recuperação',
    'Armazenamento e manutenção',
    'Privacidade e diagnóstico',
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await expect(page.getByText('Exclusão direta não oferecida')).toBeVisible();
  await expect(page.getByRole('button', { name: /apagar banco|excluir banco/i })).toHaveCount(0);
});

test('f7 ux diagnostics download uses an allowlisted schema without credentials', async ({ page }) => {
  await resetF7Ux(page, '/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar diagnóstico redigido' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const raw = await readFile(path!, 'utf8');
  expect(raw).toContain('f7-ux-diagnostics-v1');
  expect(raw).not.toMatch(/secret-token|id-token|person@example\.test/);
});
