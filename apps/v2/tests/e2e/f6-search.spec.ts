import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'f6-subject',
      profileId: 'local-default',
      subjectId: 'subject-f6',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'f6-edital',
      profileId: 'local-default',
      editalId: 'edital-f6',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'f6-link',
      profileId: 'local-default',
      editalId: 'edital-f6',
      subjectId: 'subject-f6',
      linkId: 'link-f6',
    });
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'f6-assunto',
      profileId: 'local-default',
      value: {
        id: 'assunto-crase',
        profileId: 'local-default',
        editalDisciplineId: 'link-f6',
        parentId: null,
        parentKey: '',
        title: 'Crase e acentuação',
        orderKey: '',
        localRevision: 0,
      },
    });
    await harness.executeContent({
      type: 'UPSERT_AULA',
      operationId: 'f6-aula',
      profileId: 'local-default',
      value: {
        id: 'aula-crase',
        profileId: 'local-default',
        editalDisciplineId: 'link-f6',
        title: 'Aula 12 - Crase',
        orderKey: '',
        localRevision: 0,
      },
    });
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'f6-assunto-acao',
      profileId: 'local-default',
      value: {
        id: 'assunto-acao',
        profileId: 'local-default',
        editalDisciplineId: 'link-f6',
        parentId: null,
        parentKey: '',
        title: 'Ação rescisória',
        orderKey: '',
        localRevision: 0,
      },
    });
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'f6-assunto-hostile',
      profileId: 'local-default',
      value: {
        id: 'assunto-hostile',
        profileId: 'local-default',
        editalDisciplineId: 'link-f6',
        parentId: null,
        parentKey: '',
        title: '<img src=x onerror=alert(1)>',
        orderKey: '',
        localRevision: 0,
      },
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f6 local search finds accents and opens the focused entity by id', async ({ page }) => {
  await seed(page);
  await page.goto('/#/search?q=crase');
  await expect(page.getByTestId('f6-search')).toBeVisible();

  const result = page.getByRole('button', { name: /Crase e acentuação/ });
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(/#\/content\/edital-f6\?focus=assunto-crase$/);
  const focused = page.locator('[data-entity-id="assunto-crase"]');
  await expect(focused).toHaveAttribute('data-focus', 'true');
  await expect(focused).toBeVisible();

  await page.goto('/#/search?q=acao');
  await expect(page.getByRole('button', { name: /Ação rescisória/ })).toBeVisible();
});

test('f6 search only returns authorized query data and never executes markup', async ({ page }) => {
  await seed(page);
  await page.goto('/#/search?q=onerror&token=secret');
  await expect(page.getByTestId('f6-search')).toBeVisible();
  await expect(
    page.getByTestId('f6-search').getByText('<img src=x onerror=alert(1)>'),
  ).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.getByTestId('f6-search')).not.toContainText('token=secret');
});

test('f6 planning search opens the focused scenario by id', async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'f6-plan-op' },
      scenarioId: 'scenario-f6',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'scenario-f6',
          profileId: 'local-default',
          editalId: 'edital-f6',
          kind: 'CYCLE',
          name: 'Ciclo de revisão dirigida',
          status: 'DRAFT',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          referenceZone: 'America/Fortaleza',
        },
      },
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'f6-plan-block-op' },
      scenarioId: 'scenario-f6',
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'block-f6',
            profileId: 'local-default',
            editalId: 'edital-f6',
            scenarioId: 'scenario-f6',
            editalDisciplineId: 'link-f6',
            plannedMinutes: 30,
            allocation: 'CONFIRMED_DAY',
            priority: 1,
            localRevision: 1,
            sourceOperationId: 'f6-plan-block-op',
            civilDate: '2027-03-15',
            label: 'Bloco foco distante',
          },
        ],
      },
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.goto('/#/search?q=revis%C3%A3o%20dirigida');
  const result = page
    .getByTestId('f6-search')
    .getByRole('button', { name: /Ciclo de revisão dirigida/ });
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(/#\/planning\?focus=scenario-f6$/);
  const focused = page.locator('[data-entity-id="scenario-f6"]');
  await expect(focused).toBeVisible();
  await expect(focused).toBeFocused();

  await page.goto('/#/search?q=Bloco%20foco%20distante');
  const blockResult = page
    .getByTestId('f6-search')
    .getByRole('button', { name: /Bloco foco distante/ });
  await expect(blockResult).toBeVisible();
  await blockResult.click();
  await expect(page).toHaveURL(/#\/planning\?focus=block-f6$/);
  const block = page.locator('[data-entity-id="block-f6"]');
  await expect(block).toBeVisible();
  await expect(block).toBeFocused();
});

