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
    transaction.objectStore('assuntos').put({
      id: 'assunto-2', profileId, editalDisciplineId: 'disc-1', parentId: null,
      parentKey: '', title: 'Assunto secundário', orderKey: '000020', localRevision: 1,
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
  await topics.getByLabel('Assunto').selectOption('assunto-2');
  await topics.getByRole('button', { name: 'Criar tópico de revisão' }).click();
  await expect(topics).toContainText('Assunto secundário');

  const suggestions = page.locator('[data-testid="review-suggestions"]');
  await expect(suggestions).toContainText('Controle de constitucionalidade');
  const suggestionButton = suggestions
    .locator('li')
    .filter({ hasText: 'Controle de constitucionalidade' })
    .first()
    .getByRole('button', { name: 'Confirmar revisão' });
  await expect(suggestionButton).toBeEnabled();
  await suggestionButton.click();

  const agenda = page.locator('[data-testid="review-agenda"]');
  await expect(agenda).toContainText('Pendente');
  await agenda.getByLabel('Avaliação').selectOption('GOOD');
  await agenda.getByRole('button', { name: 'Concluir' }).click();
  await expect(agenda).toContainText('Cumprida');

  const weak = page.locator('[data-testid="review-weak-points"]');
  await expect(weak).toContainText('Controle de constitucionalidade');
  await expect(weak).toContainText('7/10');
  const evidencedPoint = weak
    .locator('[data-topic-key]')
    .filter({ hasText: 'Controle de constitucionalidade' })
    .first();
  const evidence = evidencedPoint.locator('details').first();
  await evidence.locator('summary').first().click();
  await expect(evidence).toContainText('Amostra: 10 questão(ões), 7 acerto(s)');
  const evidenceLink = evidence.getByRole('link', { name: /Sessão F4/ });
  await expect(evidenceLink).toBeVisible();
  await expect(evidenceLink).toContainText('2026-11-01');
  await expect(evidenceLink).toContainText('concluída');
  await expect(evidenceLink).toHaveAttribute('title', 'session-f5');
  await expect(evidence).toContainText('10 questão(ões) · 7 acerto(s)');
  await expect(evidence).not.toContainText('Abrir sessão F4 session-f5');
  const execution = evidence.getByTestId(/review-evidence-execution-/).first();
  await expect(execution).toContainText('Execução de revisão (F5)');
  await expect(execution).toContainText(/boa em \d{4}-\d{2}-\d{2}/);
  await execution.locator('summary').click();
  await expect(execution).toContainText('Cobertura');
  await expect(execution).toContainText('integral');
  await expect(execution).toContainText('Compromisso');
  if (process.env.F7_UXH_STATE_DIR) {
    await weak.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/review-execution-detail.png',
    });
  }
  const commitmentLink = execution.getByRole('button', { name: /ver compromisso/ });
  await expect(commitmentLink).toBeVisible();
  await commitmentLink.click();
  await expect(page.locator('li[id^="review-commitment-"]').first()).toBeFocused();
  await expect(page.locator('li[id^="review-commitment-"]').first()).toBeVisible();
  if (process.env.F7_UXH_STATE_DIR) {
    await weak.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/review-evidence-drilldown.png',
    });
  }

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
  await expect(priorities).toContainText('Assunto secundário');
  await priorities
    .getByRole('button', { name: 'Ver evidência de Assunto secundário' })
    .click();
  await expect(
    page.locator('p.inline-notice[role="alert"]').filter({ hasText: 'não tem amostra individual' }).first(),
  ).toBeVisible();
  await priorities
    .getByRole('button', { name: 'Ver evidência de Controle de constitucionalidade' })
    .click();
  const focusedPoint = evidencedPoint;
  await expect(focusedPoint).toBeFocused();
  await expect(focusedPoint.locator('details').first()).toHaveAttribute('open', '');
  if (process.env.F7_UXH_STATE_DIR) {
    await page.getByTestId('review-weak-points').screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/review-priority-evidence.png',
    });
  }

  await evidenceLink.click();
  await expect(page).toHaveURL(/#\/sessions/);
  await expect(page.getByTestId('session-history')).toContainText('2026-11-01');
});
