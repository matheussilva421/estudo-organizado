import { expect, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

export async function resetF7Ux(page: Page, route = '/#/home'): Promise<void> {
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
  });
  await page.goto(route);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

export async function seedAcademicData(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.execute({
      operationId: 'f7ux-subject',
      profileId: 'local-default',
      subjectId: 'f7ux-subject',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'f7ux-edital',
      profileId: 'local-default',
      editalId: 'f7ux-edital',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'f7ux-link',
      profileId: 'local-default',
      editalId: 'f7ux-edital',
      subjectId: 'f7ux-subject',
      linkId: 'f7ux-link',
    });
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'f7ux-assunto',
      profileId: 'local-default',
      value: {
        id: 'f7ux-assunto',
        profileId: 'local-default',
        editalDisciplineId: 'f7ux-link',
        parentId: null,
        parentKey: '',
        title: 'Controle de constitucionalidade',
        orderKey: '',
        localRevision: 0,
      },
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}
