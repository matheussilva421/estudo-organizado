import { expect, test } from '@playwright/test';

const profileId = 'local-default';

test('f5 review journey: topic, commitment, execution, weak point and board', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async ({ profileId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['subjects', 'editais', 'edital_disciplines', 'assuntos', 'sessions'],
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
    transaction.objectStore('sessions').put({
      id: 'session-f5', profileId, state: 'COMPLETED', origin: 'TIMER',
      localRevision: 1, schemaVersion: 1, referenceZone: 'America/Fortaleza',
      recordedAtCivilDate: '2026-11-01', planBlockIds: [], editalIds: ['edital-1'], intervals: [],
      allocations: [{
        sessionId: 'session-f5', allocationId: 'allocation-f5', editalDisciplineId: 'disc-1',
        assuntoId: 'assunto-1', durationMs: 30 * 60_000,
      }],
      measurements: [{
        id: 'measurement-f5', sessionId: 'session-f5', allocationId: 'allocation-f5',
        questions: 10, correctAnswers: 7,
      }],
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
  await expect(page.locator('[data-testid="review-workspace"]')).toBeVisible();

  const topics = page.locator('[data-testid="review-topics"]');
  await topics.getByLabel('Edital').selectOption('edital-1');
  await topics.getByLabel('Disciplina').selectOption('disc-1');
  await topics.getByLabel('Assunto').selectOption('assunto-1');
  await topics.getByRole('button', { name: 'Criar tópico de revisão' }).click();
  await expect(topics).toContainText('Controle de constitucionalidade');

  const suggestions = page.locator('[data-testid="review-suggestions"]');
  await expect(suggestions).toContainText('Controle de constitucionalidade');
  await suggestions.getByRole('button', { name: 'Confirmar revisão' }).click();

  const agenda = page.locator('[data-testid="review-agenda"]');
  await expect(agenda).toContainText('Pendente');
  await agenda.getByLabel('Avaliação').selectOption('GOOD');
  await agenda.getByRole('button', { name: 'Concluir' }).click();
  await expect(agenda).toContainText('Cumprida');

  const weak = page.locator('[data-testid="review-weak-points"]');
  await expect(weak).toContainText('Controle de constitucionalidade');
  await expect(weak).toContainText('7/10');

  const board = page.locator('[data-testid="review-board"]');
  await board.getByLabel('Título/fonte').fill('Banca TJPB');
  await board.getByLabel('Texto da evidência').fill('Controle de constitucionalidade cai muito.');
  await board.getByRole('button', { name: 'Importar fonte' }).click();
  await expect(board.getByRole('button', { name: /Confirmar Controle de constitucionalidade/ })).toBeVisible();
  await board.getByRole('button', { name: /Confirmar Controle de constitucionalidade/ }).click();
  await expect(page.locator('p.inline-notice').last()).toContainText('Correspondência confirmada');

  const priorities = page.locator('[data-testid="review-priorities"]');
  await priorities.getByRole('button', { name: 'Recalcular prioridade' }).click();
  await expect(priorities).toContainText('Controle de constitucionalidade');
});
