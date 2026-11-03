import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

const profileId = 'local-default';

async function seedContent(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async ({ profileId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['subjects', 'editais', 'edital_disciplines', 'assuntos'],
      'readwrite',
    );
    transaction.objectStore('subjects').put({
      id: 'subject-1',
      profileId,
      title: 'Direito Constitucional',
      localRevision: 1,
    });
    transaction.objectStore('editais').put({
      id: 'edital-1',
      profileId,
      title: 'TJPB',
      status: 'ACTIVE',
      localRevision: 1,
    });
    transaction.objectStore('edital_disciplines').put({
      id: 'disc-1',
      profileId,
      editalId: 'edital-1',
      subjectId: 'subject-1',
      orderKey: '000010',
      status: 'ACTIVE',
      localRevision: 1,
    });
    transaction.objectStore('assuntos').put({
      id: 'assunto-1',
      profileId,
      editalDisciplineId: 'disc-1',
      parentId: null,
      parentKey: '',
      title: 'Controle de constitucionalidade',
      orderKey: '000010',
      localRevision: 1,
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { profileId });
}

test('F5-T42 two tabs share IndexedDB and never duplicate a semantic commitment', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await seedContent(page);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const topics = page.locator('[data-testid="review-topics"]');
  await topics.getByLabel('Edital').selectOption('edital-1');
  await topics.getByLabel('Disciplina').selectOption('disc-1');
  await topics.getByLabel('Assunto').selectOption('assunto-1');
  await topics.getByRole('button', { name: 'Criar tópico de revisão' }).click();
  await expect(topics).toContainText('Controle de constitucionalidade');

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(second.locator('[data-testid="review-topics"]')).toContainText(
    'Controle de constitucionalidade',
  );

  const suggestionsA = page.locator('[data-testid="review-suggestions"]');
  const suggestionsB = second.locator('[data-testid="review-suggestions"]');
  await expect(suggestionsA).toContainText('Controle de constitucionalidade');
  await expect(suggestionsB).toContainText('Controle de constitucionalidade');

  const applyA = suggestionsA.getByRole('button', { name: 'Confirmar revisão' });
  const applyB = suggestionsB.getByRole('button', { name: 'Confirmar revisão' });
  await expect(applyA).toBeEnabled();
  await expect(applyB).toBeEnabled();
  await Promise.all([
    applyA.click(),
    applyB.click(),
  ]);
  await page.waitForTimeout(800);
  const applyNotices = await Promise.all([
    page.locator('.inline-notice').textContent(),
    second.locator('.inline-notice').textContent(),
  ]);
  expect(
    applyNotices.filter((text) => /Revisão confirmada|compromisso registrado/.test(text ?? '')),
  ).toHaveLength(1);
  expect(
    applyNotices.filter((text) => /Já existe compromisso|duplicado/.test(text ?? '')),
  ).toHaveLength(1);

  await page.reload();
  await second.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  const agendaA = page.locator('[data-testid="review-agenda"]');
  const agendaB = second.locator('[data-testid="review-agenda"]');
  await expect(agendaA.locator('ul > li')).toHaveCount(1);
  await expect(agendaB.locator('ul > li')).toHaveCount(1);
  await agendaA.getByLabel('Avaliação').selectOption('GOOD');
  await agendaB.getByLabel('Avaliação').selectOption('GOOD');

  const concludeA = agendaA.getByRole('button', { name: 'Concluir' });
  const concludeB = agendaB.getByRole('button', { name: 'Concluir' });
  await expect(concludeA).toBeEnabled();
  await expect(concludeB).toBeEnabled();
  await Promise.all([
    concludeA.click(),
    concludeB.click(),
  ]);
  await page.waitForTimeout(800);

  await page.reload();
  await second.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-testid="review-agenda"]')).toContainText('Cumprida');
  await expect(second.locator('[data-testid="review-agenda"]')).toContainText('Cumprida');
  await expect(page.locator('[data-testid="review-weak-points"]')).toContainText('boa 1');
  await expect(second.locator('[data-testid="review-weak-points"]')).toContainText('boa 1');
});

test('F5-T42 concurrent opt-in auto-approval publishes one commitment', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await seedContent(page);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const topics = page.locator('[data-testid="review-topics"]');
  await topics.getByLabel('Edital').selectOption('edital-1');
  await topics.getByLabel('Disciplina').selectOption('disc-1');
  await topics.getByLabel('Assunto').selectOption('assunto-1');
  await topics.getByRole('button', { name: 'Criar tópico de revisão' }).click();
  await expect(topics).toContainText('Controle de constitucionalidade');

  const policy = page.locator('[data-testid="review-policy"]');
  await policy.getByRole('checkbox').check();
  await policy.getByRole('button', { name: 'Gravar política' }).click();
  await expect(page.locator('.inline-notice')).toContainText('Política de revisão versionada');

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  const autoA = page.getByRole('button', { name: 'Aplicar opt-in no horizonte' });
  const autoB = second.getByRole('button', { name: 'Aplicar opt-in no horizonte' });
  await expect(autoA).toBeEnabled();
  await expect(autoB).toBeEnabled();
  await Promise.all([autoA.click(), autoB.click()]);
  await page.waitForTimeout(800);

  await page.reload();
  await second.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-testid="review-agenda"] ul > li')).toHaveCount(1);
  await expect(second.locator('[data-testid="review-agenda"] ul > li')).toHaveCount(1);
});
