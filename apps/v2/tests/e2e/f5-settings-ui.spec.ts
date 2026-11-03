import { expect, test, type Page } from '@playwright/test';

const profileId = 'local-default';

async function seedContent(page: Page): Promise<void> {
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
      id: 'subject-1', profileId, title: 'Direito Constitucional', localRevision: 1,
    });
    transaction.objectStore('editais').put({
      id: 'edital-1', profileId, title: 'TJPB', status: 'ACTIVE', localRevision: 1,
    });
    transaction.objectStore('edital_disciplines').put({
      id: 'disc-1', profileId, editalId: 'edital-1', subjectId: 'subject-1',
      orderKey: '000010', status: 'ACTIVE', localRevision: 1,
    });
    transaction.objectStore('assuntos').put({
      id: 'assunto-1', profileId, editalDisciplineId: 'disc-1', parentId: null,
      parentKey: '', title: 'Controle de constitucionalidade', orderKey: '000010', localRevision: 1,
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { profileId });
}

async function createTopic(page: Page): Promise<void> {
  const topics = page.locator('[data-testid="review-topics"]');
  await topics.getByLabel('Edital').selectOption('edital-1');
  await topics.getByLabel('Disciplina').selectOption('disc-1');
  await topics.getByLabel('Assunto').selectOption('assunto-1');
  await topics.getByRole('button', { name: 'Criar tópico de revisão' }).click();
  await expect(topics).toContainText('Controle de constitucionalidade');
}

async function readReviewFacts(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['review_commitments', 'review_executions'],
      'readonly',
    );
    const read = <T>(store: string): Promise<T[]> =>
      new Promise((resolve, reject) => {
        const request = transaction.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });
    const commitments = await read('review_commitments');
    const executions = await read('review_executions');
    database.close();
    return { commitments, executions };
  });
}

async function seedOverdueCommitment(page: Page): Promise<void> {
  await page.evaluate(async ({ profileId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['review_commitments'], 'readwrite');
    transaction.objectStore('review_commitments').put({
      id: 'commitment-ui',
      profileId,
      canonicalTopicKey: 'disc-1::assunto-1',
      topicLinkId: 'topic-ui',
      editalId: 'edital-1',
      assuntoId: 'assunto-1',
      label: 'Revisão vencida de interface',
      originalDueDate: '2026-10-01',
      currentDueDate: '2026-10-01',
      status: 'PENDING',
      coverage: 'UNKNOWN',
      policyVersion: 1,
      source: 'MANUAL',
      localRevision: 1,
      history: [],
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { profileId });
}

test('F5-T16 applies a subject override through preview without rewriting commitments', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await seedContent(page);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await createTopic(page);

  const suggestions = page.locator('[data-testid="review-suggestions"]');
  await suggestions.getByRole('button', { name: 'Confirmar revisão' }).click();
  const agenda = page.locator('[data-testid="review-agenda"]');
  await expect(agenda).toContainText('Pendente');
  await agenda.getByRole('button', { name: 'Registrar parcial' }).click();
  await expect(agenda).toContainText('Parcial');
  const factsBefore = await readReviewFacts(page);

  const overrides = page.locator('[data-testid="review-policy-overrides"]');
  await overrides.getByLabel('Assunto vinculado').selectOption('disc-1::assunto-1');
  await overrides.getByLabel('Intervalo inicial (dias)').fill('10');
  await overrides.getByLabel('Observação (opcional)').fill('Ajuste de teste');
  await overrides.getByRole('button', { name: 'Prévia do impacto' }).click();
  const impact = page.locator('[data-testid="review-policy-impact"]');
  await expect(impact).toContainText('muda');
  await expect(impact).toContainText('compromissos e execuções existentes permanecem intactos');

  await overrides.getByRole('button', { name: 'Aplicar ajuste' }).click();
  await expect(page.locator('.inline-notice')).toContainText('Ajuste por assunto versionado');
  await expect(page.locator('[data-testid="review-policy"]')).toContainText(/política v2/i);
  await expect(overrides).toContainText('Ajustes salvos');
  await expect(agenda.locator('ul > li')).toHaveCount(1);
  await expect(agenda).toContainText('Parcial');
  expect(await readReviewFacts(page)).toEqual(factsBefore);
});

test('F5-T46 dismisses a UI notice while keeping the commitment and permission state visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async ({ profileId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['review_commitments'], 'readwrite');
    transaction.objectStore('review_commitments').put({
      id: 'commitment-ui',
      profileId,
      canonicalTopicKey: 'disc-1::assunto-1',
      topicLinkId: 'topic-ui',
      editalId: 'edital-1',
      assuntoId: 'assunto-1',
      label: 'Revisão vencida de interface',
      originalDueDate: '2026-10-01',
      currentDueDate: '2026-10-01',
      status: 'PENDING',
      coverage: 'UNKNOWN',
      policyVersion: 1,
      source: 'MANUAL',
      localRevision: 1,
      history: [],
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { profileId });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const reminders = page.locator('[data-testid="review-reminders"]');
  await expect(reminders).toContainText('Revisão vencida de interface');
  await expect(reminders.getByTestId('notification-permission')).toHaveText(
    /Permissão: (concedida|negada|ainda não solicitada|não suportada)/,
  );
  await reminders.getByRole('button', { name: /Dispensar aviso de/ }).click();
  await expect(reminders).toContainText('aviso dispensado');
  await expect(page.locator('[data-testid="review-agenda"]')).toContainText('Pendente');
  await expect(page.locator('.inline-notice')).toContainText('não foi cancelado');
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(reminders).toContainText('aviso dispensado');
  await expect(page.locator('[data-testid="review-agenda"]')).toContainText('Pendente');
});

test('F5-T46 manual external notice deduplicates and honors quiet hours', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = async (): Promise<NotificationPermission> => 'granted';
      constructor(title: string, options?: NotificationOptions) {
        const target = window as unknown as { __f5Notifications?: unknown[] };
        target.__f5Notifications = [
          ...(target.__f5Notifications ?? []),
          { title, body: options?.body },
        ];
      }
    }
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: FakeNotification,
    });
  });
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await seedOverdueCommitment(page);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const reminders = page.locator('[data-testid="review-reminders"]');
  await reminders.getByRole('checkbox').check();
  await reminders.getByLabel('Silêncio começa').fill('00:00');
  await reminders.getByLabel('Silêncio termina').fill('00:00');
  await reminders.getByRole('button', { name: 'Gravar preferências' }).click();
  await expect(page.locator('.inline-notice')).toContainText('Preferências de lembrete salvas');
  const testButton = reminders.getByRole('button', { name: 'Testar aviso externo' });
  await expect(testButton).toBeEnabled();
  await testButton.click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __f5Notifications?: unknown[] }).__f5Notifications?.length ?? 0,
      ),
    )
    .toBe(1);
  await testButton.click();
  await expect(page.locator('.inline-notice')).toContainText('já foi emitido por outra aba');
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __f5Notifications?: unknown[] }).__f5Notifications?.length ?? 0,
      ),
    )
    .toBe(1);

  await reminders.getByLabel('Silêncio começa').fill('00:00');
  await reminders.getByLabel('Silêncio termina').fill('23:59');
  await reminders.getByRole('button', { name: 'Gravar preferências' }).click();
  await testButton.click();
  await expect(page.locator('.inline-notice')).toContainText('Horário de silêncio');
  expect(
    await page.evaluate(
      () => (window as unknown as { __f5Notifications?: unknown[] }).__f5Notifications?.length ?? 0,
    ),
  ).toBe(1);
});
