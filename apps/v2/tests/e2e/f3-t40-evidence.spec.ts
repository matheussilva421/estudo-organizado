import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const THEMES = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];
const OUT = resolve(process.cwd(), '../../docs/superpowers/audits/evidence/2026-10-29-f3-t40');

async function seed(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'ev-subject',
      profileId: 'local-default',
      subjectId: 'subject-ev',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'ev-edital',
      profileId: 'local-default',
      editalId: 'edital-ev',
      title: 'TJPB Evidência',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'ev-link',
      profileId: 'local-default',
      editalId: 'edital-ev',
      subjectId: 'subject-ev',
      linkId: 'link-ev',
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'ev-scenario' },
      scenarioId: 'scenario-ev',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'scenario-ev',
          profileId: 'local-default',
          editalId: 'edital-ev',
          kind: 'FINAL_STRETCH',
          name: 'Plano de evidência',
          status: 'DRAFT',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          examDate: '2027-03-01',
          referenceZone: 'America/Fortaleza',
        },
      },
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'ev-blocks' },
      scenarioId: 'scenario-ev',
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'ev-block',
            profileId: 'local-default',
            editalId: 'edital-ev',
            scenarioId: 'scenario-ev',
            editalDisciplineId: 'link-ev',
            plannedMinutes: 60,
            allocation: 'PROJECTED',
            civilDate: '2027-01-05',
            priority: 1,
            localRevision: 1,
            sourceOperationId: 'ev-blocks',
            label: 'Constitucional',
          },
        ],
      },
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('capture_f3_t40_evidence', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  const workspace = page.locator('[data-testid="planning-workspace"]');
  await workspace.scrollIntoViewIfNeeded();

  for (const theme of THEMES) {
    await page.getByLabel('Tema').selectOption(theme);
    await expect(page.locator('[data-testid="planning-dashboard"]')).toBeVisible();
    await workspace.screenshot({ path: resolve(OUT, `desktop-${theme}.png`) });
  }

  await page.setViewportSize({ width: 834, height: 1112 });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.locator('[data-testid="planning-workspace"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="planning-workspace"]').screenshot({
    path: resolve(OUT, 'tablet-834.png'),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.locator('[data-testid="planning-workspace"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="planning-workspace"]').screenshot({
    path: resolve(OUT, 'mobile-390.png'),
  });
});
