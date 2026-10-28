import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

const IMPORT_JSON = JSON.stringify({
  versao: 1,
  tipo: 'edital',
  nome: 'TJPB 2026',
  centralId: 'tjpb-2026',
  revisao: 'r1',
  disciplinas: [
    {
      nome: 'Direito Constitucional',
      topicos: [{ nome: 'Controle de constitucionalidade' }],
      aulas: [{ nome: 'Aula 01' }],
    },
  ],
});

test('browser_import_is_atomic_and_idempotent_after_reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const aborted = await page.evaluate(
    async ({ profile, json }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      const preview = await harness.previewImport(profile, 'tjpb', json);
      if (!preview.ok) return { ok: false, reason: preview.reason } as const;
      const result = await harness.applyImport(profile, preview.preview, 'abort');
      const counts = await harness.contentCounts(profile);
      return { ok: true, result, counts } as const;
    },
    { profile: profileId, json: IMPORT_JSON },
  );
  expect(aborted.ok).toBe(true);
  if (!aborted.ok) return;
  expect(aborted.result).toEqual({ kind: 'FAILED', reason: 'ABORT' });
  expect(aborted.counts).toMatchObject({ editais: 0, links: 0, operations: 0, outbox: 0 });

  const committed = await page.evaluate(
    async ({ profile, json }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      const preview = await harness.previewImport(profile, 'tjpb', json);
      if (!preview.ok) return { ok: false, reason: preview.reason } as const;
      const first = await harness.applyImport(profile, preview.preview);
      const replay = await harness.applyImport(profile, preview.preview);
      return { ok: true, first, replay, counts: await harness.contentCounts(profile) } as const;
    },
    { profile: profileId, json: IMPORT_JSON },
  );
  expect(committed.ok).toBe(true);
  if (!committed.ok) return;
  expect(committed.first.kind).toBe('LOCAL_COMMITTED');
  expect(committed.replay).toEqual(committed.first);
  expect(committed.counts).toMatchObject({ editais: 1, links: 1, operations: 5, outbox: 5 });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const content = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(content.editais).toHaveLength(1);
  expect(content.assuntos.map((item) => item.title)).toEqual(['Controle de constitucionalidade']);
  expect(content.aulas.map((item) => item.title)).toEqual(['Aula 01']);
});

test('browser_stale_preview_is_rejected_after_another_tab_edit', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/');
  await expect(first.locator('[data-db-ready="true"]')).toBeVisible();
  await first.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const preview = await first.evaluate(
    async ({ profile, json }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      const parsed = await harness.previewImport(profile, 'tjpb', json);
      return parsed.ok ? parsed.preview : null;
    },
    { profile: profileId, json: IMPORT_JSON },
  );
  expect(preview).not.toBeNull();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await second.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-outra-aba',
      profileId: profile,
      editalId: 'edital-outra-aba',
      title: 'Editado em outra aba',
    }),
  profileId);

  const result = await first.evaluate(
    async ({ profile, stale }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      return harness.applyImport(profile, stale!);
    },
    { profile: profileId, stale: preview },
  );
  expect(result).toEqual({ kind: 'INVALID', code: 'IMPORT_STALE_PREVIEW' });

  const counts = await first.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.contentCounts(profile),
  profileId);
  expect(counts.editais).toBe(1);
  expect(counts.links).toBe(0);
  expect(counts.operations).toBe(1);
});
