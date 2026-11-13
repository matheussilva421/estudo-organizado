import { expect, test } from '@playwright/test';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

test('session history exposes filters and an auditable inspector', async ({ page }) => {
  await resetF7Ux(page, '/#/sessions');
  await seedAcademicData(page);
  await page.goto('/#/sessions');
  await expect(page.getByTestId('session-manual')).toBeVisible();

  const manual = page.getByTestId('session-manual');
  await manual.getByLabel('Duração da sessão (min)').fill('45');
  await manual.getByLabel('Nota').fill('Sessão sintética de auditoria');
  await manual.getByTestId('session-manual-submit').click();

  const history = page.getByTestId('session-history');
  await expect(history.locator('[data-session-id]')).toHaveCount(1);
  await expect(history).toContainText('registro manual');
  await expect(history).toContainText('00:45:00');
  await expect(page.getByTestId('session-stat-state')).toHaveText('LIVRE');
  await expect(page.getByTestId('session-stat-history')).toHaveText('1');
  await expect(page.getByTestId('session-stat-today')).toHaveText('1');
  await expect(page.getByTestId('session-stat-recovery')).toHaveText('NENHUMA');

  await history.locator('[data-testid^="session-details-"] summary').first().click();
  await expect(history).toContainText('manual: 00:45:00');
  await expect(history).toContainText('Sessão sintética de auditoria');

  await page.getByTestId('session-history-origin').selectOption('TIMER');
  await expect(history).toContainText('Nenhuma sessão corresponde aos filtros atuais.');
  await page.getByTestId('session-history-origin').selectOption('MANUAL');
  await expect(history.locator('[data-session-id]')).toHaveCount(1);

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.getByTestId('session-history-from').fill(tomorrow);
  await expect(history).toContainText('Nenhuma sessão corresponde aos filtros atuais.');
  await page.getByTestId('session-history-from').fill('');
  await page.getByTestId('session-history-state').selectOption('COMPLETED');
  await expect(history.locator('[data-session-id]')).toHaveCount(1);
});

