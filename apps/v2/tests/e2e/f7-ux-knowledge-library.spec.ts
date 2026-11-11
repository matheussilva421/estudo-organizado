import { expect, test } from '@playwright/test';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('knowledge library opens the existing edital tree by stable ID on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetF7Ux(page, '/#/content');
  const library = page.getByRole('region', { name: 'Biblioteca de editais' });
  await expect(library).toContainText('Nenhum edital ativo');
  await seedAcademicData(page);
  await page.reload();
  const link = library.getByRole('link', { name: 'TRT 2026' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/content\/f7ux-edital$/);
  await expect(page.locator('.tree .tree-title').filter({ hasText: 'Controle de constitucionalidade' }).first()).toBeVisible();
  await expect(link).toHaveAttribute('aria-current', 'page');
});

test('a large edital stays navigable from the library on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetF7Ux(page, '/#/content');
  await seedAcademicData(page);
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    for (let index = 0; index < 60; index += 1) {
      await harness.executeContent({
        type: 'UPSERT_ASSUNTO',
        operationId: 'f7ux-large-' + index,
        profileId: 'local-default',
        value: {
          id: 'f7ux-large-' + String(index).padStart(2, '0'),
          profileId: 'local-default',
          editalDisciplineId: 'f7ux-link',
          parentId: null,
          parentKey: '',
          title: 'Assunto grande ' + index,
          orderKey: '',
          localRevision: 0,
        },
      });
    }
  });
  await page.reload();
  await page.getByRole('link', { name: 'TRT 2026' }).click();
  await expect(page).toHaveURL(/#\/content\/f7ux-edital$/);
  const more = page.getByRole('button', { name: /Mostrar mais \d+ assunto/ });
  await expect(more).toBeVisible();
  await more.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
