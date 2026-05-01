import { expect, test } from '@playwright/test';
import { bootE2EApp, createE2EState, flushSaveAndReload } from '../helpers/e2e-state.js';

test.describe('Fluxo completo de estudo', () => {
  test('cria estrutura de edital, agenda estudo, registra sessão e reflete nas views principais', async ({ page }) => {
    const state = createE2EState();
    state.editais = [];

    await bootE2EApp(page, state);
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    await page.click('[data-view="editais"]');
    await page.click('[data-action="open-edital-modal"]');
    await expect(page.locator('#modal-edital.open')).toBeVisible();
    await page.fill('#edital-nome', 'Concurso Fluxo Completo 2026');
    await page.click('#modal-edital [data-action="save-edital"]');
    await expect(page.locator('#main-content')).toContainText('Concurso Fluxo Completo 2026');

    const editalCard = page.locator('.tree-edital').filter({ hasText: 'Concurso Fluxo Completo 2026' });
    await editalCard.locator('[data-action="open-disc-modal"]').click();
    await expect(page.locator('#modal-disc.open')).toBeVisible();
    await page.fill('#disc-nome', 'Direito Constitucional Aplicado');
    await page.click('#modal-disc [data-action="save-disc"]');
    await expect(editalCard).toContainText('Direito Constitucional Aplicado');

    await editalCard.locator('[data-action="open-disc-manager"]').first().click({ force: true });
    await expect(page.locator('#modal-disc-manager.open')).toBeVisible();
    await page.locator('[data-action="switch-manager-tab"][data-tab="topicos"]').click({ force: true });
    await page.evaluate(() => {
      const input = document.querySelector('#new-assunto-nome');
      if (input) input.value = 'Controle de Constitucionalidade';
      document.querySelector('#tab-manager-topicos [data-action="add-assunto"]')?.click();
    });
    await expect(page.locator('#modal-disc-manager-body')).toContainText('Controle de Constitucionalidade');

    await page.locator('[data-action="switch-manager-tab"][data-tab="aulas"]').click({ force: true });
    await page.evaluate(() => {
      const input = document.querySelector('#new-aula-bulk');
      if (input) input.value = 'Aula 01 - Controle de Constitucionalidade';
      document.querySelector('#tab-manager-aulas [data-action="add-bulk-aulas"]')?.click();
    });
    await expect(page.locator('#modal-disc-manager-body')).toContainText('Aula 01 - Controle de Constitucionalidade');
    await page.click('#modal-disc-manager .modal-close');

    const createdIds = await page.evaluate(() => {
      const edital = window.state.editais.find((item) => item.nome === 'Concurso Fluxo Completo 2026');
      const disc = edital?.disciplinas?.find((item) => item.nome === 'Direito Constitucional Aplicado');
      return {
        discId: disc?.id,
        assuntoId: disc?.assuntos?.[0]?.id,
        aulaId: disc?.aulas?.[0]?.id
      };
    });

    await page.click('[data-view="med"]');
    await page.click('[data-action="open-add-event"]');
    await expect(page.locator('#modal-event.open')).toBeVisible();
    await page.selectOption('#event-disc', createdIds.discId);
    await expect(page.locator(`#event-assunto option[value="${createdIds.assuntoId}"]`)).toHaveCount(1);
    await expect(page.locator(`#event-aula option[value="${createdIds.aulaId}"]`)).toHaveCount(1);
    await page.evaluate((ids) => {
      document.querySelector('#event-assunto').value = ids.assuntoId;
      document.querySelector('#event-aula').value = ids.aulaId;
    }, createdIds);
    await page.fill('#event-titulo', 'Sessão integrada de constitucional');
    await page.selectOption('#event-duracao', '60');
    await page.click('[data-action="save-event"]');
    await expect(page.locator('#toast-container')).toContainText('Estudo iniciado/agendado');

    const eventId = await page.evaluate(() => {
      return window.state.eventos.find((event) => event.titulo === 'Sessão integrada de constitucional')?.id;
    });
    expect(eventId).toBeTruthy();

    await page.click('[data-view="cronometro"]');
    await expect(page.locator('#main-content')).toBeVisible();
    await page.evaluate((id) => {
      const event = window.state.eventos.find((item) => item.id === id);
      if (event) event.tempoAcumulado = 3600;
    }, eventId);
    await page.evaluate((id) => window.openRegistroSessao(id), eventId);

    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();
    await page.selectOption('#reg-disciplina', createdIds.discId);
    await page.selectOption('#reg-assunto', createdIds.assuntoId);
    await page.selectOption('#reg-aula', createdIds.aulaId);
    await page.click('[data-action="toggle-study-type"][data-tipo="questoes"]');
    await page.fill('#reg-q-total', '20');
    await page.fill('#reg-q-acertos', '16');
    await page.fill('#reg-q-erros', '4');
    await page.selectOption('#reg-status-topico', 'finalizado');
    await page.click('[data-action="save-registro-sessao"]');
    await expect(modal).not.toHaveClass(/open/);

    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('#main-content')).toContainText('Direito Constitucional Aplicado');
    await expect(page.locator('#main-content')).toContainText('Controle de Constitucionalidade');

    await page.click('[data-view="calendar"]');
    await expect(page.locator('#main-content')).toContainText('Direito Constitucional Aplicado');

    await page.click('[data-view="med"]');
    await expect(page.locator('#main-content')).toContainText('Tempo Total Hoje');
    await expect(page.locator('#main-content')).toContainText('01:00:00');

    await page.click('[data-view="revisoes"]');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect.poll(() => page.evaluate((ids) => {
      const edital = window.state.editais.find((item) => item.nome === 'Concurso Fluxo Completo 2026');
      const disc = edital?.disciplinas?.find((item) => item.id === ids.discId);
      const assunto = disc?.assuntos?.find((item) => item.id === ids.assuntoId);
      return {
        concluido: assunto?.concluido || false,
        hasRevisionBaseDate: Boolean(assunto?.dataConclusao)
      };
    }, createdIds)).toEqual({
      concluido: true,
      hasRevisionBaseDate: true
    });

    await flushSaveAndReload(page);
    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('#main-content')).toContainText('Direito Constitucional Aplicado');
  });
});
