import { expect, test } from '@playwright/test';
import { installFixedClock } from './f7-ux-helpers';

test('f4 habit creation and explicit confirmation', async ({ page }) => {
  await installFixedClock(page);
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByTestId('session-habit-create').click();
  await expect(page.locator('[data-testid="session-habits"]')).toContainText('Tempo diário');

  await page.getByRole('button', { name: 'Confirmar hoje' }).click();
  await expect(page.locator('[data-testid="session-habits"]')).toContainText('Tempo diário');

  await page.getByLabel('Duração da sessão (min)').fill('30');
  await page.locator('[data-testid="session-manual-submit"]').click();
  const history = page.locator('[data-testid="session-history"]');
  await expect(history).toContainText('registro manual');
  const todayDetails = history.locator('details').first();
  await todayDetails.locator('summary').click();
  const todayContext = todayDetails.locator('[data-testid^="session-habit-context-"]');
  await expect(todayContext).toHaveAttribute('data-habit-attribution', 'CURRENT');
  await expect(todayContext).toContainText('Hábitos vigentes hoje');
  await expect(todayContext).toContainText('Tempo diário');
  await expect(todayContext).toContainText('não confirma cumprimento');
  await expect(todayContext).not.toContainText('TIME');
  await expect(todayContext).not.toContainText('DAILY');

  const yesterday = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  });
  const manual = page.getByTestId('session-manual');
  await manual.getByLabel('Data', { exact: true }).fill(yesterday);
  await page.getByLabel('Duração da sessão (min)').fill('15');
  await page.locator('[data-testid="session-manual-submit"]').click();
  const pastRow = history.locator('li').filter({ hasText: yesterday }).first();
  await expect(pastRow).toBeVisible();
  await pastRow.locator('summary').click();
  const pastContext = pastRow.locator('[data-testid^="session-habit-context-"]');
  await expect(pastContext).toHaveAttribute('data-habit-attribution', 'UNDEMONSTRATED');
  await expect(pastContext).toContainText('Hábitos atuais que cobrem esta data');
  await expect(pastContext).toContainText('vínculo com esta sessão antiga não está demonstrado');
  if (process.env.F7_UXH_STATE_DIR) {
    await history.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/session-habit-context.png',
    });
  }
});

