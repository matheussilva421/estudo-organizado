import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };
const profileId = 'local-default';
const remoteSubject = {
  entityId: 'subject-recovered',
  entityType: 'subject' as const,
  schemaVersion: 1,
  revision: 1,
  deleted: false,
  epoch: 2,
  payload: {
    id: 'subject-recovered',
    profileId,
    title: 'Disciplina recuperada',
    status: 'ACTIVE',
    localRevision: 1,
  },
};

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

async function seedRecovery(page: Page, withSnapshot = true): Promise<void> {
  await page.evaluate(
    (profile) =>
      (window as unknown as HarnessWindow).__v2E2E.seedRecovery(
        profile,
        'uid-e2e',
        'library-e2e',
      ),
    profileId,
  );
  if (withSnapshot) {
    await page.evaluate(
      (entity) =>
        (window as unknown as HarnessWindow).__v2E2E.setRecoverySnapshot(
          [entity],
          2,
          5,
        ),
      remoteSubject,
    );
  } else {
    await page.evaluate(() => localStorage.removeItem('v2-e2e-recovery-snapshot'));
  }
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f7 recovery shows preview, exports backup and commits a verified snapshot', async ({ page }) => {
  await boot(page);
  await seedRecovery(page);
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Recuperação da sincronização' })).toBeVisible();
  await expect(page.getByText('E2E_STALE_CURSOR')).toBeVisible();

  await page.getByRole('button', { name: 'Verificar recuperação' }).click();
  await expect(page.locator('[data-recovery-preview]')).toBeVisible();
  await expect(page.getByText('1 novo(s)')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar cópia de segurança' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('recovery');

  page.once('dialog', (dialog) => {
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Aplicar rebaseline verificado' }).click();
  await expect(page.locator('[data-recovery-status="RECUPERADO"]')).toBeVisible();

  const state = await page.evaluate(
    (profile) => (window as unknown as HarnessWindow).__v2E2E.recoveryState(profile),
    profileId,
  );
  expect(state.marker).toBe(false);
  expect(state.cursor).toEqual({ epoch: 2, cursor: 5 });
  expect(state.subjects).toBe(1);
});

test('f7 recovery without a stable remote snapshot stays blocked', async ({ page }) => {
  await boot(page);
  await seedRecovery(page, false);
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Verificar recuperação' }).click();
  await expect(page.locator('[data-recovery-panel]')).toContainText('snapshot remoto não está disponível');
  const state = await page.evaluate(
    (profile) => (window as unknown as HarnessWindow).__v2E2E.recoveryState(profile),
    profileId,
  );
  expect(state.marker).toBe(true);
});

test('f7 recovery preserves a pending offline operation for later reconciliation', async ({ page }) => {
  await boot(page);
  await seedRecovery(page);
  await page.evaluate(
    (profile) =>
      (window as unknown as HarnessWindow).__v2E2E.seedDeliverableOutbox(
        profile,
        'op-recovery-pending',
        'subject-pending',
        'Pendência offline',
      ),
    profileId,
  );
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Verificar recuperação' }).click();
  await expect(page.locator('[data-recovery-preview]')).toContainText('1 operação(ões) offline');
  page.once('dialog', (dialog) => {
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Aplicar rebaseline verificado' }).click();
  await expect(page.locator('[data-recovery-status="RECUPERADO"]')).toBeVisible();
  await expect(
    page.evaluate(
      (profile) =>
        (window as unknown as HarnessWindow).__v2E2E.outboxStatus(
          profile,
          'op-recovery-pending',
        ),
      profileId,
    ),
  ).resolves.toBe('PENDING');
  const remote = await page.evaluate(
    (profile) => (window as unknown as HarnessWindow).__v2E2E.readRemote(profile),
    profileId,
  );
  expect(remote.effects).toBe(0);
});

test('f7 recovery commits once across two tabs with a pending offline edit', async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([boot(first), boot(second)]);
  await first.evaluate(
    (profile) =>
      (window as unknown as HarnessWindow).__v2E2E.seedRecovery(
        profile,
        'uid-e2e',
        'library-e2e',
      ),
    profileId,
  );
  await first.evaluate(
    (entity) =>
      (window as unknown as HarnessWindow).__v2E2E.setRecoverySnapshot([entity], 2, 5),
    remoteSubject,
  );
  await first.evaluate(
    (profile) =>
      (window as unknown as HarnessWindow).__v2E2E.seedDeliverableOutbox(
        profile,
        'op-two-tabs-pending',
        'subject-two-tabs',
        'Edição em duas abas',
      ),
    profileId,
  );
  await Promise.all([first.reload(), second.reload()]);
  await Promise.all([
    expect(first.locator('[data-db-ready="true"]')).toBeVisible(),
    expect(second.locator('[data-db-ready="true"]')).toBeVisible(),
  ]);
  await Promise.all([first.goto('/#/settings'), second.goto('/#/settings')]);

  await first.getByRole('button', { name: 'Verificar recuperação' }).click();
  await expect(first.locator('[data-recovery-preview]')).toBeVisible();
  first.once('dialog', (dialog) => {
    void dialog.accept();
  });
  await first.getByRole('button', { name: 'Aplicar rebaseline verificado' }).click();
  await expect(first.locator('[data-recovery-status="RECUPERADO"]')).toBeVisible();

  await second.reload();
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(second.locator('[data-recovery-panel]')).toHaveCount(0);
  const state = await second.evaluate(
    (profile) => (window as unknown as HarnessWindow).__v2E2E.recoveryState(profile),
    profileId,
  );
  expect(state.marker).toBe(false);
  await expect(
    second.evaluate(
      (profile) =>
        (window as unknown as HarnessWindow).__v2E2E.outboxStatus(
          profile,
          'op-two-tabs-pending',
        ),
      profileId,
    ),
  ).resolves.toBe('PENDING');
  await context.close();
});
