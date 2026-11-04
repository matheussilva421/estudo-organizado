import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

async function seedEdital(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async ({ profileId }) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-two-tabs',
      profileId,
      editalId: 'edital-two-tabs',
      title: 'Título original',
    });
  }, { profileId });
  await page.goto('/#/content');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f6 second tab refreshes from a committed rename without reload', async ({ page, context }) => {
  await seedEdital(page);
  const second = await context.newPage();
  await second.goto('/#/content');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByRole('button', { name: /Renomear Título original/ }).click();
  await page.getByLabel('Novo nome').fill('Título da primeira aba');
  await page.locator('form.rename-form').getByRole('button', { name: 'Salvar' }).click();
  await expect(
    page.getByRole('button', { name: 'Título da primeira aba', exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole('button', { name: 'Título da primeira aba', exact: true }),
  ).toBeVisible({ timeout: 8000 });
});

test('f6 concurrent writes commit once and both tabs converge', async ({ page, context }) => {
  await seedEdital(page);
  const second = await context.newPage();
  await second.goto('/#/content');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();

  const outcomes = await Promise.all([
    page.evaluate(async ({ profileId }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      return harness.executeContent({
        type: 'RENAME_EDITAL',
        operationId: 'op-two-tabs-a',
        profileId,
        editalId: 'edital-two-tabs',
        title: 'Título concorrente A',
        baseRevision: 1,
      });
    }, { profileId }),
    second.evaluate(async ({ profileId }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      return harness.executeContent({
        type: 'RENAME_EDITAL',
        operationId: 'op-two-tabs-b',
        profileId,
        editalId: 'edital-two-tabs',
        title: 'Título concorrente B',
        baseRevision: 1,
      });
    }, { profileId }),
  ]);

  expect(outcomes.filter((outcome) => outcome.kind === 'LOCAL_COMMITTED')).toHaveLength(1);
  expect(outcomes.filter((outcome) => outcome.kind === 'CONFLICT')).toHaveLength(1);

  await page.reload();
  await second.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();

  const canonical = await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    const content = await harness.loadContent('local-default');
    return content.editais.find((edital) => edital.id === 'edital-two-tabs');
  });
  expect(canonical?.localRevision).toBe(2);
  expect(['Título concorrente A', 'Título concorrente B']).toContain(canonical?.title);
  await expect(
    page.getByRole('button', { name: canonical!.title, exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole('button', { name: canonical!.title, exact: true }),
  ).toBeVisible();
  const loser = canonical!.title === 'Título concorrente A' ? 'Título concorrente B' : 'Título concorrente A';
  await expect(page.getByRole('button', { name: loser, exact: true })).toHaveCount(0);
  await expect(second.getByRole('button', { name: loser, exact: true })).toHaveCount(0);
});

test('f6 open form with an obsolete base never overwrites the newer title', async ({ page, context }) => {
  await seedEdital(page);
  const second = await context.newPage();
  await second.goto('/#/content');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByRole('button', { name: /Renomear Título original/ }).click();
  await page.getByLabel('Novo nome').fill('Texto antigo da primeira aba');

  await second.getByRole('button', { name: /Renomear Título original/ }).click();
  await second.getByLabel('Novo nome').fill('Título mais recente');
  await second.locator('form.rename-form').getByRole('button', { name: 'Salvar' }).click();
  await expect(
    second.getByRole('button', { name: 'Título mais recente', exact: true }),
  ).toBeVisible();

  await expect(page.getByTestId('f6-draft-stale')).toBeVisible({ timeout: 8000 });
  await expect(
    page.locator('form.rename-form').getByRole('button', { name: 'Salvar' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Título mais recente', exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Título mais recente', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Texto antigo da primeira aba', exact: true }),
  ).toHaveCount(0);
});
