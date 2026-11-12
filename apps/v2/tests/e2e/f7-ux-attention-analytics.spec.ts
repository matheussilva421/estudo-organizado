import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resetF7Ux } from './f7-ux-helpers';

test('f7 ux attention badge matches deduplicated causal queue', async ({ page }) => {
  await resetF7Ux(page, '/#/attention');
  const badge = page.locator('[data-attention-badge]');
  const count = Number(await badge.getAttribute('data-attention-badge'));
  await expect(page.getByTestId('f7-attention-items').locator('li')).toHaveCount(count);
  if (count > 0) {
    await expect(page.locator('a[data-nav="attention"] .nav-badge')).toHaveText(String(count));
  }
  const causalIds = await page.locator('[data-causal-id]').evaluateAll((items) =>
    items.map((item) => (item as HTMLElement).dataset.causalId),
  );
  expect(new Set(causalIds).size).toBe(causalIds.length);
  const dismiss = page.getByRole('button', { name: 'Dispensar aviso' }).first();
  if (await dismiss.count()) {
    await dismiss.click();
    await expect(page.locator('[data-attention-badge]')).toHaveAttribute(
      'data-attention-badge',
      String(count - 1),
    );
    if (count - 1 > 0) {
      await expect(page.locator('a[data-nav="attention"] .nav-badge')).toHaveText(String(count - 1));
    }
  }
});

test('f7 ux analytics blocks incompatible units, mirrors table and exports methodology', async ({ page }) => {
  await resetF7Ux(page, '/#/analytics');
  const focusKpi = page.locator('.kpi-card').filter({ hasText: 'Tempo de foco executado' });
  await expect(focusKpi.locator('.kpi-value')).toHaveText('—');
  const plannedKpi = page.locator('.kpi-card').filter({ hasText: 'Tempo planejado' });
  await expect(plannedKpi.locator('.kpi-value')).toHaveText('—');
  await page.getByRole('button', { name: 'Explorar indicadores' }).click();
  await expect(page.getByRole('heading', { name: 'Editor de análise' })).toBeFocused();
  await expect(page).toHaveURL(/#\/analytics$/);
  await expect(page.getByTestId('f7-analytics-chart')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Recorte analítico' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Recorte analítico' })).toContainText('Sem recortes');
  await expect(page.getByRole('navigation', { name: 'Seções do Insights Studio' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Aproveitamento \(percent\)/ }).check();
  await expect(page.getByTestId('f7-chart-blocked')).toContainText('unidades diferentes');
  await page.getByRole('checkbox', { name: /Tempo planejado/ }).uncheck();
  await page.getByRole('checkbox', { name: /Tempo de foco executado/ }).uncheck();
  await expect(page.getByTestId('f7-analytics-chart')).toBeVisible();
  const chartRows = await page.getByTestId('f7-analytics-chart').locator('.bar-row').count();
  const tableRows = await page.getByTestId('f7-analytics-table').locator('tbody tr').count();
  expect(tableRows).toBe(chartRows);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = await readFile(path!, 'utf8');
  expect(csv).toContain('metodologia,f7-ux-v1');
  expect(csv).not.toMatch(/(^|,)=cmd/m);
});

test('changing the period reconciles the actual focus value in chart and table', async ({ page }) => {
  await resetF7Ux(page, '/#/sessions');
  const manual = page.getByTestId('session-manual');
  const oldDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() - 12 * 86_400_000));
  await manual.getByLabel('Data', { exact: true }).fill(oldDate);
  await manual.getByLabel('Duração da sessão (min)').fill('30');
  await manual.getByTestId('session-manual-submit').click();
  await expect(page.getByTestId('session-history')).toContainText('00:30:00');
  await page.goto('/#/analytics');
  await page.getByRole('button', { name: 'Explorar indicadores' }).click();
  const chart = page.getByTestId('f7-analytics-chart').locator('.bar-row').filter({ hasText: 'Tempo de foco executado' });
  const row = page.getByTestId('f7-analytics-table').getByRole('row').filter({ hasText: 'Tempo de foco executado' });
  const period = page.locator('#analytics-period');
  await period.selectOption('7');
  await expect(chart.locator('.bar-value')).toHaveText('—');
  await expect(row.getByRole('cell').first()).toHaveText('—');
  await period.selectOption('30');
  await expect(chart.locator('.bar-value')).toHaveText('30 minutes');
  await expect(row.getByRole('cell').first()).toHaveText('30 minutes');
});

test('f7 ux archives an immutable report and reopens it read-only', async ({ page }) => {
  await resetF7Ux(page, '/#/analytics');
  await page.getByRole('button', { name: 'Arquivar relatório imutável' }).click();
  await expect(page.getByText(/snapshot\(s\)/)).toContainText('1 snapshot(s)');
  await page.getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.getByTestId('opened-analytics-snapshot')).toContainText('Snapshot somente leitura');
  await page.reload();
  await expect(page.getByText(/snapshot\(s\)/)).toContainText('1 snapshot(s)');
});
