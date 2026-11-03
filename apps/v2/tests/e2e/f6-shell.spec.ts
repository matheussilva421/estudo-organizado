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
  await expect(page.getByTestId('f6-global-scope')).toContainText('todos os editais');

  const planning = page.getByRole('link', { name: 'Planejamento', exact: true });
  await planning.click();
  await expect(page).toHaveURL(/#\/planning$/);
  await expect(planning).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#planning-section')).toBeVisible();
  await expect(page.locator('#content-section')).toBeHidden();
  await expect(page.locator('#sessions-section')).toBeHidden();

  await page.goBack();
  await expect(page.getByTestId('f6-home')).toBeVisible();
  await expect(page).toHaveURL(/#\/home$|\/$/);
  await expect(page.locator('#content-section')).toBeHidden();

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

  await page.getByRole('button', { name: 'Restaurar aparência' }).click();
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
  await expect(page.locator('#content-section')).toBeHidden();
  await page.getByRole('link', { name: 'Conteúdo', exact: true }).click();
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

test('f6 home modes and indicator catalog persist without hiding priorities', async ({ page }) => {
  await reset(page);
  await expect(page.getByTestId('f6-home')).toBeVisible();

  await page.getByLabel('Modo de apresentação').selectOption('FINAL_STRETCH');
  await expect(page.getByTestId('f6-home')).toHaveAttribute('data-home-mode', 'FINAL_STRETCH');
  await page.reload();
  await expect(page.getByTestId('f6-home')).toHaveAttribute('data-home-mode', 'FINAL_STRETCH');

  await page.getByText(/Indicadores exibidos/).click();
  const subjects = page.getByRole('checkbox', { name: 'Disciplinas' });
  await expect(subjects).toBeChecked();
  await subjects.uncheck();
  await expect(page.locator('[data-indicator="subjects"]')).toHaveCount(0);
  await expect(page.getByTestId('f6-priorities')).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-indicator="subjects"]')).toHaveCount(0);
  await expect(page.getByTestId('f6-priorities')).toBeVisible();

  await page.getByText(/Indicadores exibidos/).click();
  for (const label of [
    'Editais ativos',
    'Blocos planejados hoje',
    'Sessões concluídas (7 dias)',
    'Revisões vencidas/hoje',
  ]) {
    await page.getByRole('checkbox', { name: label }).uncheck();
  }
  await expect(page.getByText('Todos os indicadores estão ocultos')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Todos os indicadores estão ocultos')).toBeVisible();
});

test('f6 skip link and element anchors never replace the route', async ({ page }) => {
  await reset(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.locator('#main-content')).toBeFocused();

  await page.goto('/#/sessions');
  await expect(page.getByTestId('session-timer')).toBeVisible();
  await page.locator('a[href="#session-history"]').first().click();
  await expect(page).toHaveURL(/#\/sessions$/);
  await expect(page.getByTestId('session-history')).toBeVisible();
});

test('f6 IndexedDB read failure is an error, not an empty profile', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value: () => {
        throw new DOMException('blocked for test', 'InvalidStateError');
      },
    });
  });
  await page.goto('/#/home');
  await page.reload();
  await expect(page.getByTestId('f6-load-error')).toBeVisible();
  await expect(page.getByText(/Falha ao ler os dados locais/).first()).toBeVisible();
  await expect(page.getByText(/Perfil sem dados/)).toHaveCount(0);
});

test('f6 missing edital route never substitutes another edital', async ({ page }) => {
  await reset(page);
  await page.goto('/#/content/edital-inexistente');
  await expect(
    page.getByText(/O edital informado na rota não existe neste perfil/),
  ).toBeVisible();
  await expect(page.getByText('Selecione ou crie um edital para verticalizar o conteúdo.')).toBeVisible();
});

