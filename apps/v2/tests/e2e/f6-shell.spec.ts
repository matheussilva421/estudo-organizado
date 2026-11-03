import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

async function reset(page: Page): Promise<void> {
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f6 shell exposes home, typed navigation and browser history', async ({ page }) => {
  await reset(page);
  await expect(page.getByTestId('f6-home')).toBeVisible();

  const planning = page.getByRole('link', { name: 'Planejamento', exact: true });
  await planning.click();
  await expect(page).toHaveURL(/#\/planning$/);
  await expect(planning).toHaveAttribute('aria-current', 'page');

  await page.goBack();
  await expect(page.getByTestId('f6-home')).toBeVisible();
  await expect(page).toHaveURL(/#\/home$|\/$/);

  await page.getByRole('link', { name: 'Revisões', exact: true }).click();
  await expect(page).toHaveURL(/#\/reviews$/);
  await expect(page.getByTestId('f6-home')).toHaveCount(0);
});

test('f6 settings persist device preferences and keep integrity dimensions separate', async ({ page }) => {
  await reset(page);
  await page.goto('/#/settings');
  await expect(page.getByTestId('f6-settings')).toBeVisible();

  await page.getByLabel('Tema da interface').selectOption('neon');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe('neon');
  await page.getByLabel('Densidade').selectOption('compact');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.density))
    .toBe('compact');

  await page.reload();
  await expect(page.getByTestId('f6-settings')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe('neon');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.density))
    .toBe('compact');

  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe('grafite');
});

test('f6 invalid routes fail neutral and hide academic modules', async ({ page }) => {
  await reset(page);
  await page.goto('/#/rota-inexistente');
  await expect(page.getByTestId('f6-notfound')).toBeVisible();
  await expect(page.getByText('Nenhum dado foi revelado ou alterado.')).toBeVisible();
  await expect(page.locator('#content-section')).toBeHidden();
  await expect(page.locator('#sessions-section')).toBeHidden();

  await page.getByRole('link', { name: 'Ir para o início' }).click();
  await expect(page.getByTestId('f6-home')).toBeVisible();
  await expect(page.locator('#content-section')).toBeVisible();
});

test('f6 attention separates local, remote and backup evidence', async ({ page }) => {
  await reset(page);
  await page.goto('/#/attention');
  await expect(page.getByTestId('f6-attention')).toBeVisible();
  await expect(page.locator('[data-integrity="local"]')).toContainText('Sem dados locais');
  await expect(page.locator('[data-integrity="remote"]')).toContainText('F7 não implementada');
  await expect(page.locator('[data-integrity="backup"]')).toContainText('Não verificado');
  await expect(page.getByText('Outbox pendente: 0')).toBeVisible();
});

