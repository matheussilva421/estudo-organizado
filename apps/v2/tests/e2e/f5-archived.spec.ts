import { expect, test } from '@playwright/test';

const profileId = 'local-default';

test('F5-T20 keeps an archived link visible but out of new associations', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async ({ profileId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['subjects', 'editais', 'edital_disciplines', 'assuntos', 'review_topics'],
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
    transaction.objectStore('editais').put({
      id: 'edital-old',
      profileId,
      title: 'Antigo',
      status: 'ARCHIVED',
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
    transaction.objectStore('edital_disciplines').put({
      id: 'disc-old',
      profileId,
      editalId: 'edital-old',
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
    transaction.objectStore('assuntos').put({
      id: 'assunto-old',
      profileId,
      editalDisciplineId: 'disc-old',
      parentId: null,
      parentKey: '',
      title: 'Controle de constitucionalidade',
      orderKey: '000010',
      localRevision: 1,
    });
    transaction.objectStore('review_topics').put({
      id: 'review-topic-old',
      profileId,
      canonicalTopicKey: 'disc-old::assunto-old',
      editalId: 'edital-old',
      editalDisciplineId: 'disc-old',
      assuntoId: 'assunto-old',
      label: 'Controle de constitucionalidade (histórico)',
      provenance: 'MANUAL',
      localRevision: 1,
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

  const topics = page.locator('[data-testid="review-topics"]');
  const options = await topics.getByLabel('Edital').locator('option').allTextContents();
  expect(options).toContain('TJPB');
  expect(options).not.toContain('Antigo');
  await expect(topics).toContainText('Controle de constitucionalidade (histórico)');
  await expect(topics).toContainText('edital arquivado (vínculo preservado)');

  const board = page.locator('[data-testid="review-board"]');
  await board.getByLabel('Título/fonte').fill('Banca antiga');
  await board.getByLabel('Texto da evidência').fill('Controle de constitucionalidade cai muito.');
  await board.getByRole('button', { name: 'Importar fonte' }).click();
  await expect(board).toContainText('Banca antiga');
  await expect(board.getByRole('button', { name: /Confirmar/ })).toHaveCount(0);
});
