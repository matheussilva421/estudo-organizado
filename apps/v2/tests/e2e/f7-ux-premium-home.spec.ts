import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('empty home opens with onboarding and dismisses without creating facts', async ({ page }) => {
  await resetF7Ux(page);
  const hero = page.getByTestId('home-hero');
  await expect(hero).toHaveAttribute('data-context', 'ONBOARDING');
  await expect(hero).toContainText('Comece pelo essencial');
  await expect(page.locator('.home-onboarding li')).toHaveCount(4);
  await page.getByRole('button', { name: 'Dispensar primeiros passos' }).click();
  await expect(page.locator('.home-onboarding')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('home-hero')).toBeVisible();
  await expect(page.locator('.home-onboarding')).toHaveCount(0);
});

test('final stretch context uses the registered exam date', async ({ page }) => {
  await resetF7Ux(page);
  await seedAcademicData(page);
  const exam = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await page.evaluate(async (examDate) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'premium-rf' },
      scenarioId: 'premium-rf',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'premium-rf',
          profileId: 'local-default',
          editalId: 'f7ux-edital',
          kind: 'FINAL_STRETCH',
          name: 'Reta Premium',
          status: 'ACTIVE',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          referenceZone: 'America/Fortaleza',
          examDate,
        },
      },
    });
  }, exam);
  await page.reload();
  const hero = page.getByTestId('home-hero');
  await expect(hero).toHaveAttribute('data-context', 'FINAL_STRETCH');
  await expect(hero).toContainText('Reta Premium');
  await expect(hero).toContainText('10 dia(s)');
  await page.getByText('Explorar painel e widgets').click();
  const widgets = page.getByRole('region', { name: 'Widgets da Home' }).locator('[data-widget]');
  await expect(widgets.first()).toHaveAttribute('data-widget', 'next-action');
  await hero.getByText('Ver sugestão de ordem').click();
  await expect(widgets.first()).toHaveAttribute('data-widget', 'next-action');
  await hero.getByRole('button', { name: 'Aplicar ordem sugerida' }).click();
  await expect(widgets.first()).toHaveAttribute('data-widget', 'planning');
  await expect(widgets.first()).toBeFocused();
  await expect(hero).toContainText('Ordem atualizada para');
  await page.reload();
  await page.getByText('Explorar painel e widgets').click();
  await expect(widgets.first()).toHaveAttribute('data-widget', 'planning');
  await expect(hero.getByText('Ver sugestão de ordem')).toHaveCount(0);
});

test('an active session takes precedence in the home hero', async ({ page }) => {
  await resetF7Ux(page, '/#/sessions');
  await seedAcademicData(page);
  await page.goto('/#/sessions');
  await page.getByTestId('session-start').click();
  await expect(page.getByTestId('session-pause')).toBeVisible();
  await page.goto('/#/home');
  await page.reload();
  const hero = page.getByTestId('home-hero');
  await expect(hero).toHaveAttribute('data-context', 'ACTIVE');
  await expect(hero).toContainText('Sessão em andamento');
  await expect(hero.getByRole('link', { name: 'Continuar sessão' })).toBeVisible();
  await expect(hero.getByText('Ver sugestão de ordem')).toHaveCount(0);
});

test('academic priority leads the hero while diagnostics stay out of it', async ({ page }) => {
  await resetF7Ux(page, '/#/home');
  await seedAcademicData(page);
  await page.reload();
  const hero = page.getByTestId('home-hero');
  await expect(hero).toHaveAttribute('data-context', 'DAILY');
  await expect(hero).not.toContainText('envio remoto');
  await expect(hero.getByRole('link', { name: 'Começar agora' })).toBeVisible();
  const repeated = page.getByText(/aguardando envio remoto/i);
  expect(await repeated.count()).toBeLessThanOrEqual(1);
});

test('performance context follows recent sessions and offers no automatic reorder', async ({ page }) => {
  await resetF7Ux(page, '/#/home');
  await seedAcademicData(page);
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'perf-scenario' },
      scenarioId: 'scenario-perf',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'scenario-perf',
          profileId: 'local-default',
          editalId: 'f7ux-edital',
          kind: 'CYCLE',
          name: 'Ciclo desempenho',
          status: 'ACTIVE',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          referenceZone: 'America/Fortaleza',
        },
      },
    });
  });
  await page.goto('/#/sessions');
  await page.getByLabel('Duração da sessão (min)').fill('25');
  await page.locator('[data-testid="session-manual-submit"]').click();
  await page.goto('/#/home');
  const hero = page.getByTestId('home-hero');
  await expect(hero).toHaveAttribute('data-context', 'PERFORMANCE');
  await expect(hero).toContainText('Acompanhe o que já rendeu');
  await expect(hero).toContainText('Tempo, revisões e evidências derivados dos seus dados locais.');
  if (process.env.F7_UXH_STATE_DIR) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/home-performance.png',
      fullPage: false,
    });
  }
  await page.getByText('Explorar painel e widgets').click();
  const widgets = page.getByRole('region', { name: 'Widgets da Home' }).locator('[data-widget]');
  const firstBefore = await widgets.first().getAttribute('data-widget');
  expect(firstBefore).not.toBe('study-time');
  await hero.getByText('Ver sugestão de ordem').click();
  await expect(widgets.first()).toHaveAttribute('data-widget', firstBefore ?? '');
  await hero.getByRole('button', { name: 'Aplicar ordem sugerida' }).click();
  await expect(widgets.first()).toHaveAttribute('data-widget', 'study-time');
});

test('manual widget order persists, undoes and is not overridden by suggestion', async ({ page }) => {
  await resetF7Ux(page, '/#/home');
  await seedAcademicData(page);
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'layout-scenario' },
      scenarioId: 'layout-scenario',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'layout-scenario',
          profileId: 'local-default',
          editalId: 'f7ux-edital',
          kind: 'CYCLE',
          name: 'Ciclo layout',
          status: 'ACTIVE',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          referenceZone: 'America/Fortaleza',
        },
      },
    });
  });
  await page.goto('/#/sessions');
  await page.getByLabel('Duração da sessão (min)').fill('20');
  await page.locator('[data-testid="session-manual-submit"]').click();
  await page.goto('/#/home');
  await page.getByText('Explorar painel e widgets').click();
  await page.getByText('Personalizar widgets e fontes').click();
  const order = page.locator('.dashboard-order li');
  const firstBefore = await order.nth(0).getAttribute('data-widget');
  const secondBefore = await order.nth(1).getAttribute('data-widget');
  expect(firstBefore).not.toBe(secondBefore);

  await order.nth(1).getByRole('button', { name: 'Mover para cima' }).click();
  await expect(order.nth(0)).toHaveAttribute('data-widget', secondBefore ?? '');
  await expect(order.nth(1)).toHaveAttribute('data-widget', firstBefore ?? '');

  await page
    .getByRole('button', { name: 'Desfazer alteração de layout nesta sessão' })
    .click();
  await expect(order.nth(0)).toHaveAttribute('data-widget', firstBefore ?? '');

  await order.nth(1).getByRole('button', { name: 'Mover para cima' }).click();
  await expect(order.nth(0)).toHaveAttribute('data-widget', secondBefore ?? '');
  if (process.env.F7_UXH_STATE_DIR) {
    await page.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/home-manual-layout.png',
      fullPage: false,
    });
  }
  await page.reload();
  await page.getByText('Explorar painel e widgets').click();
  await page.getByText('Personalizar widgets e fontes').click();
  await expect(order.nth(0)).toHaveAttribute('data-widget', secondBefore ?? '');
  await expect(page.getByTestId('home-hero')).toBeVisible();
});

test('layout write failure is explicit and does not fake persistence', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (String(key).includes('home-dashboard')) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  });
  await resetF7Ux(page, '/#/home');
  await seedAcademicData(page);
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'ls-fail-scenario' },
      scenarioId: 'ls-fail-scenario',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'ls-fail-scenario',
          profileId: 'local-default',
          editalId: 'f7ux-edital',
          kind: 'CYCLE',
          name: 'Ciclo falha',
          status: 'ACTIVE',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          referenceZone: 'America/Fortaleza',
        },
      },
    });
  });
  await page.goto('/#/sessions');
  await page.getByLabel('Duração da sessão (min)').fill('20');
  await page.locator('[data-testid="session-manual-submit"]').click();
  await page.goto('/#/home');
  await page.getByText('Explorar painel e widgets').click();
  await page.getByText('Personalizar widgets e fontes').click();
  const order = page.locator('.dashboard-order li');
  const firstBefore = await order.nth(0).getAttribute('data-widget');
  await page.getByText('Ver sugestão de ordem').click();
  await page.getByRole('button', { name: 'Aplicar ordem sugerida' }).click();
  await expect(page.getByTestId('home-layout-unsaved-top')).toBeVisible();
  await expect(page.getByText(/Ordem atualizada para/)).toHaveCount(0);
  const secondAfterSuggestion = await order.nth(1).getAttribute('data-widget');
  await order.nth(1).getByRole('button', { name: 'Mover para cima' }).click();
  await expect(order.nth(0)).toHaveAttribute('data-widget', secondAfterSuggestion ?? '');
  await expect(page.getByTestId('home-layout-unsaved')).toBeVisible();
  await expect(page.getByTestId('home-layout-unsaved-top')).toBeVisible();
  await page.reload();
  await page.getByText('Explorar painel e widgets').click();
  await page.getByText('Personalizar widgets e fontes').click();
  await expect(page.locator('.dashboard-order li').nth(0)).toHaveAttribute(
    'data-widget',
    firstBefore ?? '',
  );
});

