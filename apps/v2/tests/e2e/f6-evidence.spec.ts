import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const OUT =
  process.env.F6_EVIDENCE_DIR ?? resolve(process.cwd(), 'test-results', 'f6-evidence');

test('f6 representative visual evidence', async ({ page }) => {
  test.skip(!process.env.F6_EVIDENCE_DIR, 'F6_EVIDENCE_DIR must point to a dedicated F6 directory');
  await mkdir(OUT, { recursive: true });

  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'ev-subject',
      profileId: 'local-default',
      subjectId: 'ev-subject',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'ev-edital',
      profileId: 'local-default',
      editalId: 'ev-edital',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'ev-link',
      profileId: 'local-default',
      editalId: 'ev-edital',
      subjectId: 'ev-subject',
      linkId: 'ev-link',
    });
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'ev-assunto',
      profileId: 'local-default',
      value: {
        id: 'ev-assunto',
        profileId: 'local-default',
        editalDisciplineId: 'ev-link',
        parentId: null,
        parentKey: '',
        title: 'Controle de constitucionalidade',
        orderKey: '',
        localRevision: 0,
      },
    });
  });

  const shots = [
    { route: '/#/home', name: 'f6-home-desktop.png', width: 1280, height: 900, anchor: 'f6-home' },
    { route: '/#/search?q=constitucional', name: 'f6-search-desktop.png', width: 1280, height: 900, anchor: 'f6-search' },
    { route: '/#/analytics', name: 'f6-analytics-desktop.png', width: 1280, height: 900, anchor: 'f6-analytics' },
    { route: '/#/attention', name: 'f6-attention-desktop.png', width: 1280, height: 900, anchor: 'f6-attention' },
    { route: '/#/settings', name: 'f6-settings-desktop.png', width: 1280, height: 900, anchor: 'f6-settings' },
    { route: '/#/home', name: 'f6-home-tablet.png', width: 834, height: 1112, anchor: 'f6-home' },
    { route: '/#/home', name: 'f6-home-mobile.png', width: 390, height: 844, anchor: 'f6-home' },
  ];

  for (const shot of shots) {
    await page.setViewportSize({ width: shot.width, height: shot.height });
    await page.goto(shot.route);
    await expect(page.getByTestId(shot.anchor)).toBeVisible();
    await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
    await page.waitForTimeout(150);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    await page.screenshot({ path: resolve(OUT, shot.name), fullPage: false });
  }
});

