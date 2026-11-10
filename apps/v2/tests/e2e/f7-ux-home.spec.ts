import { expect, test } from '@playwright/test';
import { resetF7Ux } from './f7-ux-helpers';

test('f7 ux dashboard templates and per-device widget choices persist', async ({ page }) => {
  await resetF7Ux(page);
  await page.getByLabel('Modelo da Home').selectOption('FINAL_STRETCH');
  await expect(page.getByTestId('f6-home')).toHaveAttribute('data-dashboard-template', 'FINAL_STRETCH');
  await page.reload();
  await expect(page.getByTestId('f6-home')).toHaveAttribute('data-dashboard-template', 'FINAL_STRETCH');

  await page.getByText('Personalizar widgets e fontes').click();
  await page.getByRole('checkbox', { name: 'Revisões', exact: true }).uncheck();
  await expect(page.locator('[data-widget="reviews"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-widget="reviews"]')).toHaveCount(0);
});

test('f7 ux controlled formula rejects JavaScript and persists a valid widget', async ({ page }) => {
  await resetF7Ux(page);
  await page.getByText('Construtor de widget seguro').click();
  const formula = page.getByLabel('Fórmula controlada');
  await formula.fill('alert(1)');
  await expect(page.getByTestId('widget-formula-preview')).toContainText('Fórmula rejeitada');
  await expect(page.getByRole('button', { name: 'Salvar widget personalizado' })).toBeDisabled();

  await formula.fill('1 + 2');
  await expect(page.getByTestId('widget-formula-preview')).toContainText('Prévia: 3');
  await page.getByRole('button', { name: 'Salvar widget personalizado' }).click();
  await expect(page.getByTestId('custom-widget')).toContainText('Meu indicador');
});

test('f7 ux home filter, evidence and inspector do not mutate academic facts', async ({ page }) => {
  await resetF7Ux(page);
  const allWidgets = await page.locator('[data-widget]').count();
  await page.getByLabel('Filtro global').selectOption('INTEGRITY');
  await expect(page.getByText('Nenhum item neste filtro. O filtro não alterou os dados.')).toBeVisible();
  await expect.poll(async () => page.locator('[data-widget]').count()).toBeLessThan(allWidgets);
  await expect(page.getByText('Integridade por evidência')).toBeVisible();
  await page.getByLabel('Filtro global').selectOption('ALL');
  await page.getByRole('button', { name: 'Ver procedência' }).first().click();
  await expect(page.getByTestId('context-inspector')).toContainText('Consulta somente leitura');
  await expect(page.getByText(/Fonte: .*Período:/)).toBeVisible();
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByTestId('context-inspector')).toHaveCount(0);
});
