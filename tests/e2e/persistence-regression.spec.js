import { expect, test } from '@playwright/test';
import { bootE2EApp, createE2EState, flushSaveAndReload } from '../helpers/e2e-state.js';

test.describe('Persistência local', () => {
  test('preserva eventos, hábitos, configurações e planejamento após reload e nova página', async ({ page, context }) => {
    const state = createE2EState();

    await bootE2EApp(page, state);
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    await page.click('[data-view="med"]');
    await page.click('[data-action="open-add-event"]');
    await page.selectOption('#event-disc', 'disc_1');
    await page.fill('#event-titulo', 'Persistência de Constitucional');
    await page.click('[data-action="save-event"]');
    await expect(page.locator('#toast-container')).toContainText('Estudo iniciado/agendado');

    await page.click('[data-view="config"]');
    await page.evaluate(() => {
      window.state.config.materiasPorDia = 4;
      window.state.config.metas = { horasSemana: 12, questoesSemana: 80 };
      window.state.habitos.questoes.push({
        id: 'hab_persist_questions',
        data: new Date().toISOString().slice(0, 10),
        descricao: 'Bloco persistente',
        quantidade: 30,
        acertos: 24
      });
      window.state.planejamento = {
        ativo: true,
        tipo: 'ciclo',
        disciplinas: ['disc_1'],
        relevancia: { disc_1: 5 },
        horarios: {},
        sequencia: [{ id: 'seq_persist', discId: 'disc_1', minutos: 60, concluido: false }],
        ciclosCompletos: 0,
        dataInicioCicloAtual: new Date().toISOString().slice(0, 10)
      };
    });

    await flushSaveAndReload(page);
    await expect(page.locator('#save-status')).toContainText('Salvo localmente');
    await page.click('[data-view="config"]');
    await expect(page.locator('#config-save-status-detail')).toContainText('Último salvamento local concluído');

    const persistedAfterReload = await page.evaluate(() => ({
      eventExists: window.state.eventos.some((event) => event.titulo === 'Persistência de Constitucional'),
      habitExists: window.state.habitos.questoes.some((habit) => habit.descricao === 'Bloco persistente'),
      materiasPorDia: window.state.config.materiasPorDia,
      metas: window.state.config.metas,
      planejamentoAtivo: window.state.planejamento.ativo,
      sequenciaLength: window.state.planejamento.sequencia.length
    }));

    expect(persistedAfterReload).toEqual({
      eventExists: true,
      habitExists: true,
      materiasPorDia: 4,
      metas: { horasSemana: 12, questoesSemana: 80 },
      planejamentoAtivo: true,
      sequenciaLength: 1
    });

    const newPage = await context.newPage();
    await newPage.goto('/');
    await newPage.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');
    await newPage.click('[data-view="med"]');
    await expect(newPage.locator('#main-content')).toContainText('Persistência de Constitucional');
    await newPage.click('[data-view="habitos"]');
    await expect(newPage.locator('#main-content')).toContainText('Bloco persistente');
  });
});
