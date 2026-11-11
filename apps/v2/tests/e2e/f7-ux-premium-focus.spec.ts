import { expect, test } from '@playwright/test';
import { resetF7Ux } from './f7-ux-helpers';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

test('local reconciliation exposes a persistent conflict during compact mobile focus', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await resetF7Ux(page, '/#/settings');
  await page.getByLabel('Densidade').selectOption('compact');
  await page.goto('/#/sessions');
  await page.getByTestId('session-start').click();
  await page.getByTestId('session-focus-open').click();
  const other = await context.newPage();
  await other.goto('/#/home');
  await expect(other.locator('[data-db-ready="true"]')).toBeVisible();
  const result = await other.evaluate(async () => {
    const h = (window as unknown as { __v2E2E: V2E2EHarness }).__v2E2E;
    const profileId = 'local-default';
    const entityId = 'conflicting-subject';
    localStorage.setItem('v2-e2e-auth-uid', 'uid-e2e');
    await h.execute({ type: 'create', profileId, operationId: 'create-conflicting-subject', subjectId: entityId, title: 'Local' });
    await h.seedDeliverableOutbox(profileId, 'queued-conflicting-subject', entityId, 'Local');
    return h.applyRemoteChange(profileId, { uid: 'uid-e2e', libraryId: 'library-e2e' },
      { sequence: 1, entityId, revision: 2, deleted: true, epoch: 1 },
      { entityType: 'subject', entityId, revision: 2, deleted: true, epoch: 1, schemaVersion: 1, payload: null });
  });
  expect(result).toBe('CONFLICT');
  // A subsequent committed change refreshes the app through its existing local event channel.
  await other.evaluate(async () => {
    const h = (window as unknown as { __v2E2E: V2E2EHarness }).__v2E2E;
    await h.execute({ type: 'create', profileId: 'local-default', operationId: 'after-conflict', subjectId: 'after-conflict', title: 'Outra disciplina' });
  });
  const focus = page.getByTestId('session-focus');
  await expect(focus.getByRole('alert').filter({ hasText: 'Conflito exige decisão' })).toBeInViewport();
  await expect(focus.getByRole('link', { name: 'Ver conflito' })).toBeVisible();
  await expect(focus).toContainText('RUNNING');
});

test('focus mode uses the same session and clock without duplicating facts', async ({ page }) => {
  await resetF7Ux(page, '/#/sessions');
  await page.getByTestId('session-start').click();
  await expect(page.getByTestId('session-pause')).toBeVisible();
  await page.waitForTimeout(1_500);

  await page.getByTestId('session-focus-open').click();
  const focus = page.getByTestId('session-focus');
  await expect(focus).toBeVisible();
  await expect(page.getByTestId('session-focus-timer')).toContainText('00:00:0');
  await page.getByTestId('session-focus-pause').click();
  await expect(focus).toContainText('PAUSED');
  await page.getByTestId('session-focus-resume').click();
  await expect(focus).toContainText('RUNNING');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('session-workspace')).toBeVisible();
  await expect(page.getByTestId('session-focus-open')).toBeFocused();
  await expect(page.getByTestId('session-pause')).toBeVisible();

  await page.getByTestId('session-complete').click();
  await expect(page.getByTestId('session-start')).toBeVisible();
  await expect(page.getByTestId('session-history').locator('[data-session-id]')).toHaveCount(1);
  await expect(page.getByTestId('session-history')).toContainText('TIMER');
});


for (const width of [320, 390]) {
  test(`focus keeps the clock and primary controls on screen at ${width}px in a short window`, async ({ page }) => {
    await page.setViewportSize({ width, height: 420 });
    await resetF7Ux(page, '/#/sessions');
    await page.getByTestId('session-start').click();
    await page.getByTestId('session-focus-open').click();

    await expect(page.getByTestId('session-focus-timer')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('session-focus-pause')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('session-focus-complete')).toBeInViewport({ ratio: 1 });
  });
}

test('focus exposes real cross-tab authority loss and keeps recovery reachable', async ({ context, page }) => {
  await page.setViewportSize({ width: 320, height: 520 });
  await resetF7Ux(page, '/#/sessions');
  await page.getByTestId('session-start').click();
  await page.getByTestId('session-focus-open').click();

  const second = await context.newPage();
  await second.goto('/#/sessions');
  await expect(second.getByTestId('session-foreign-authority')).toBeVisible();
  await second.getByTestId('session-takeover').click();
  await expect(second.getByTestId('session-resume')).toBeEnabled();
  await second.getByTestId('session-resume').click();

  const focus = page.getByTestId('session-focus');
  const warning = focus.getByRole('alert').filter({ hasText: 'Outra aba controla esta sessão' });
  await expect(warning).toBeInViewport();
  await expect(page.getByTestId('session-focus-complete')).toBeDisabled();
  await focus.getByRole('button', { name: 'Sair do Foco' }).click();
  await expect(page.getByTestId('session-foreign-authority')).toBeVisible();
  await expect(page.getByTestId('session-takeover')).toBeVisible();
});
