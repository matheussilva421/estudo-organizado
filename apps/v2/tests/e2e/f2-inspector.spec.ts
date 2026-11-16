import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

async function seedLargeEdital(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'insp-subject',
      profileId: profile,
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'insp-edital',
      profileId: profile,
      editalId: 'edital-1',
      title: 'Edital Grande 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'insp-link',
      profileId: profile,
      editalId: 'edital-1',
      subjectId: 'subject-1',
      linkId: 'link-1',
    });
    for (let index = 0; index < 120; index += 1) {
      const id = 'assunto-' + index;
      await harness.executeContent({
        type: 'UPSERT_ASSUNTO',
        operationId: 'insp-op-' + id,
        profileId: profile,
        value: {
          id,
          profileId: profile,
          editalDisciplineId: 'link-1',
          parentId: index === 0 ? null : null,
          parentKey: '',
          title: 'Assunto ' + String(index).padStart(3, '0'),
          orderKey: String(index * 10).padStart(6, '0'),
          localRevision: 0,
        },
      });
      if (index < 12) {
        await harness.executeContent({
          type: 'UPSERT_ASSUNTO',
          operationId: 'insp-child-op-' + index,
          profileId: profile,
          value: {
            id: 'assunto-0-child-' + index,
            profileId: profile,
            editalDisciplineId: 'link-1',
            parentId: 'assunto-0',
            parentKey: 'assunto-0',
            title: 'Subassunto ' + index,
            orderKey: String(index * 10).padStart(6, '0'),
            localRevision: 0,
          },
        });
      }
    }
    await harness.executeContent({
      type: 'UPSERT_AULA',
      operationId: 'insp-aula-op',
      profileId: profile,
      value: {
        id: 'aula-1',
        profileId: profile,
        editalDisciplineId: 'link-1',
        title: 'Aula magna',
        orderKey: '000010',
        localRevision: 0,
      },
    });
  }, profileId);
}

test('large content tree exposes an inspector with identity, structure and focus return', async ({ page }) => {
  await seedLargeEdital(page);
  const started = Date.now();
  await page.goto('/#/content/edital-1');
  await expect(page.getByTestId('f7-content-workspace')).toBeVisible();
  const tree = page.locator('#tree-title');
  await expect(tree).toContainText('Edital Grande 2026');
  const elapsed = Date.now() - started;
  console.log('INSPECTOR_LARGE_TREE_MS', elapsed);

  const roots = page.locator('.tree > .tree-node');
  await expect(roots).toHaveCount(50);
  const more = page.getByRole('button', { name: /Mostrar mais 70 assunto/ });
  await expect(more).toBeVisible();
  await more.click();
  await expect(page.locator('.tree > .tree-node')).toHaveCount(100);
  await page.getByRole('button', { name: /Mostrar mais 20 assunto/ }).click();
  await expect(page.locator('.tree > .tree-node')).toHaveCount(120);
  expect(elapsed).toBeLessThan(5000);

  const node = page.locator('[data-entity-id="assunto-3"]');
  await node.getByRole('button', { name: 'Ver detalhes de Assunto 003' }).click();
  const inspector = page.getByTestId('content-inspector');
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('Assunto');
  await expect(inspector).toContainText('assunto-3');
  await expect(inspector).toContainText('Direito Constitucional');
  await expect(inspector).toContainText('Raiz');
  await expect(inspector).toContainText('0 subassunto(s)');
  await expect(inspector.getByRole('heading', { name: 'Assunto 003' })).toBeFocused();
  await expect(node).toHaveAttribute('data-selected', 'true');
  if (process.env.F7_UXH_STATE_DIR) {
    await inspector.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/content-inspector-desktop.png',
      fullPage: false,
    });
  }

  await inspector.getByRole('button', { name: 'Fechar' }).click();
  await expect(inspector).toHaveCount(0);
  await expect(
    node.getByRole('button', { name: 'Ver detalhes de Assunto 003' }),
  ).toBeFocused();

  const rootNode = page.locator('[data-entity-id="assunto-0"]');
  await rootNode.getByRole('button', { name: 'Ver detalhes de Assunto 000' }).click();
  await expect(page.getByTestId('content-inspector')).toContainText('12 subassunto(s)');
  await page.getByTestId('content-inspector').getByRole('button', { name: 'Fechar' }).click();

  const lastNode = page.locator('[data-entity-id="assunto-119"]');
  await lastNode.getByRole('button', { name: 'Ver detalhes de Assunto 119' }).click();
  await expect(page.getByTestId('content-inspector')).toContainText('Assunto 119');
  await page.getByTestId('content-inspector').getByRole('button', { name: 'Fechar' }).click();

  const aula = page.locator('[data-entity-id="aula-1"]');
  await aula.getByRole('button', { name: 'Ver detalhes da aula Aula magna' }).click();
  await expect(page.getByTestId('content-inspector')).toContainText('Aula magna');
  await expect(page.getByTestId('content-inspector')).toContainText('0 assunto(s) mapeado(s)');
});

test('content inspector remains usable at 320px without horizontal overflow', async ({ page }) => {
  await seedLargeEdital(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/content/edital-1');
  await expect(page.getByTestId('f7-content-workspace')).toBeVisible();
  const node = page.locator('[data-entity-id="assunto-2"]');
  await node.getByRole('button', { name: 'Ver detalhes de Assunto 002' }).click();
  const inspector = page.getByTestId('content-inspector');
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('Assunto 002');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const box = await inspector.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(320);
  if (process.env.F7_UXH_STATE_DIR) {
    await inspector.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/content-inspector-320.png',
      fullPage: false,
    });
  }
  await inspector.getByRole('button', { name: 'Fechar' }).click();
  await expect(
    node.getByRole('button', { name: 'Ver detalhes de Assunto 002' }),
  ).toBeFocused();
});

