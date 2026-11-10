import { expect, test } from '@playwright/test';

async function boot(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('v2_sw_scope_does_not_intersect_v1', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cachesKeys = 'caches' in window ? await caches.keys() : [];
    return { scope: registration.scope, cachesKeys };
  });

  const expectedScope = new URL(test.info().project.use.baseURL ?? page.url()).origin + '/';
  expect(result.scope).toBe(expectedScope);
  expect(result.cachesKeys.every((key) => key.startsWith('estudo-organizado-v2-'))).toBe(true);
  expect(result.cachesKeys.join(' ')).not.toContain('EstudoOrganizado');
});

test('offline_reload_preserves_committed_subject', async ({ page, context }) => {
  await boot(page);
  await page.getByLabel('Nova disciplina').fill('Direito Previdenciário');
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click();
  await expect(page.getByText('Direito Previdenciário', { exact: true })).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await expect(page.getByText('Direito Previdenciário', { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('unsaved_form_not_discarded_during_update', async ({ page }) => {
  await boot(page);
  await page.getByLabel('Nova disciplina').fill('Rascunho não salvo');

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.waitForTimeout(500);

  await expect(page.getByLabel('Nova disciplina')).toHaveValue('Rascunho não salvo');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
});

test('first_visit_after_install_survives_offline', async ({ page, context }) => {
  await boot(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      });
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await context.setOffline(false);
});
