import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('empty home opens with onboarding and dismisses without creating facts', async ({ page }) => {
  await resetF7Ux(page);
  const hero = page.getByTestId('home-hero');
  await expect(hero).toHaveAttribute('data-context', 'ONBOARDING');
  await expect(hero).toContainText('Comece pelo essencial');
  await expect(hero.locator('.home-onboarding li')).toHaveCount(3);
  await page.getByRole('button', { name: 'Dispensar primeiros passos' }).click();
  await expect(hero.locator('.home-onboarding')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('home-hero')).toBeVisible();
  await expect(page.getByTestId('home-hero').locator('.home-onboarding')).toHaveCount(0);
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
});

