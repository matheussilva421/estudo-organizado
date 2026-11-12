import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('f7 ux workspace routes keep exact content ids while opening planning, sessions and reviews', async ({ page }) => {
  await resetF7Ux(page);
  await seedAcademicData(page);

  await page.goto('/#/content/f7ux-edital?focus=f7ux-assunto');
  await expect(page.getByTestId('f7-content-workspace')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Verticalização.*TRT 2026/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Árvore de Direito' }).getByText('Controle de', { exact: false })).toBeVisible();

  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'f7ux-assunto-second',
      profileId: 'local-default',
      value: {
        id: 'f7ux-assunto-second',
        profileId: 'local-default',
        editalDisciplineId: 'f7ux-link',
        parentId: null,
        parentKey: '',
        title: 'Segundo assunto',
        orderKey: '000020',
        localRevision: 0,
      },
    });
  });
  await page.reload();
  await expect(page.locator('.tree .tree-title').filter({ hasText: 'Segundo assunto' })).toBeVisible();
  await page.getByRole('button', { name: 'Mover Segundo assunto para cima' }).click();
  await expect.poll(async () => page.locator('.tree .tree-title').first().textContent()).toBe('Segundo assunto');

  for (const [route, testId] of [
    ['planning', 'f7-planning-workspace'],
    ['sessions', 'f7-sessions-workspace'],
    ['reviews', 'f7-reviews-workspace'],
  ] as const) {
    await page.goto(`/#/${route}`);
    await expect(page.getByTestId(testId)).toBeVisible();
    await expect(page.locator(`[data-route="${route}"]`)).toBeVisible();
  }
});

test('f7 ux hierarchy move refuses cycles and preserves the tree', async ({ page }) => {
  await resetF7Ux(page);
  await seedAcademicData(page);
  await page.goto('/#/content/f7ux-edital?focus=f7ux-assunto');
  await page.getByText('Mover de hierarquia').click();
  const source = page.getByLabel('Assunto a mover');
  await expect(source.locator('option')).toHaveCount(2);
  await source.selectOption('f7ux-assunto');
  await expect(page.getByLabel('Novo pai').locator('option')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Mover assunto' })).toBeDisabled();
  await expect(page.locator('.tree .tree-title').filter({ hasText: 'Controle de constitucionalidade' })).toBeVisible();
});

test('f7 ux offline refresh preserves the local shell and cached journey', async ({ page, context }) => {
  await resetF7Ux(page);
  await page.goto('/#/content');
  await expect(page.getByTestId('f7-content-workspace')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('f7-content-workspace')).toBeVisible();
  await expect(page.getByText(/Dados locais ficam no IndexedDB/)).toBeVisible();
  await context.setOffline(false);
});
