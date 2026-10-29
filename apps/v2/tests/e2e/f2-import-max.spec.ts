import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

/** 1.249 disciplinas x (1 topico + 1 aula) => ~4.997 creates reais. */
function buildLargeImport(): string {
  const disciplinas = Array.from({ length: 1_249 }, (_, index) => ({
    nome: `Disciplina ${index}`,
    topicos: [{ nome: `Topico ${index}` }],
    aulas: [{ nome: `Aula ${index}` }],
  }));
  return JSON.stringify({
    versao: 1,
    tipo: 'edital',
    nome: 'Carga Grande',
    centralId: 'carga-grande',
    revisao: 'r1',
    disciplinas,
  });
}

test('max_accepted_import_runs_in_the_browser_within_budget', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const json = buildLargeImport();
  const result = await page.evaluate(
    async ({ profile, text }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      const parsed = await harness.previewImport(profile, 'tjpb', text);
      if (!parsed.ok) return { ok: false as const, reason: parsed.reason };
      const started = performance.now();
      const applied = await harness.applyImport(profile, parsed.preview);
      const elapsed = performance.now() - started;
      const counts = await harness.contentCounts(profile);
      return {
        ok: true as const,
        creates: parsed.preview.creates.length,
        elapsed,
        kind: applied.kind,
        counts,
      };
    },
    { profile: profileId, text: json },
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.kind).toBe('LOCAL_COMMITTED');
  expect(result.creates).toBeGreaterThan(4_900);
  expect(result.counts.editais).toBe(1);
  expect(result.counts.links).toBe(1_249);
  // Generous ceiling: this is the reference desktop, not a modest phone.
  expect(result.elapsed).toBeLessThan(30_000);
  process.stdout.write(
    `max import: creates=${result.creates} elapsed=${Math.round(result.elapsed)}ms\n`,
  );
});

test('over_the_entity_ceiling_is_rejected_before_writing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const disciplinas = Array.from({ length: 1_400 }, (_, index) => ({
    nome: `Disciplina ${index}`,
    topicos: [{ nome: `Topico ${index}` }],
    aulas: [{ nome: `Aula ${index}` }],
  }));
  const json = JSON.stringify({
    versao: 1,
    tipo: 'edital',
    nome: 'Acima do teto',
    centralId: 'acima-do-teto',
    disciplinas,
  });

  const result = await page.evaluate(
    async ({ profile, text }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      const parsed = await harness.previewImport(profile, 'tjpb', text);
      if (!parsed.ok) return { ok: false as const, reason: parsed.reason };
      const applied = await harness.applyImport(profile, parsed.preview);
      return {
        ok: true as const,
        conflicts: parsed.preview.conflicts.map((item) => item.reason),
        creates: parsed.preview.creates.length,
        applied,
        counts: await harness.contentCounts(profile),
      };
    },
    { profile: profileId, text: json },
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.conflicts).toContain('TOO_MANY_ENTITIES');
  expect(result.applied).toEqual({ kind: 'INVALID', code: 'IMPORT_INVALID' });
  expect(result.counts).toMatchObject({ editais: 0, links: 0, operations: 0, outbox: 0 });
});
