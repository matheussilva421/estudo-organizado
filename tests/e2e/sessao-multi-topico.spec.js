import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

function serializeState(state) {
  return JSON.stringify(state);
}

async function seedLegacyState(page, state) {
  await page.addInitScript((serializedState) => {
    window.Chart = class {
      destroy() {}
    };

    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serializedState);
  }, serializeState(state));
}

test.describe('Registro de sessão multi-tópico', () => {
  test('registra dois tópicos numa sessão com somas derivadas e promoção', async ({ page }) => {
    const state = createE2EState();
    const disc = state.editais[0].disciplinas[0];
    disc.assuntos.push({
      id: 'ass_2',
      nome: 'Poder Constituinte',
      concluido: false,
      dataConclusao: null,
      revisoesFetas: [],
      adiamentos: 0,
      linkedAulaIds: [],
    });
    state.eventos.push({
      id: 'ev_multi',
      titulo: 'Sessao multi-topico',
      data: new Date().toISOString().slice(0, 10),
      dataEstudo: null,
      duracao: 60,
      status: 'agendado',
      tempoAcumulado: 3600,
      tipo: 'conteudo',
      discId: 'disc_1',
      assId: null,
      habito: null,
      criadoEm: '2026-04-20T10:00:00.000Z',
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.waitForFunction(
      () =>
        typeof window.openRegistroSessao === 'function' &&
        window.EstudoApp?.state?.eventos?.some((e) => e.id === 'ev_multi')
    );

    await page.evaluate(() => {
      window.openRegistroSessao('ev_multi');
    });
    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();

    await page.selectOption('#reg-disciplina', 'disc_1');

    // Item 1: assunto 1
    await page.selectOption('#reg-assunto', 'ass_1');
    await page.click('[data-action="add-topico-sessao"]');
    await expect(page.locator('.reg-topico-item')).toHaveCount(1);

    // Item 2: assunto 2
    await page.selectOption('#reg-assunto', 'ass_2');
    await page.click('[data-action="add-topico-sessao"]');
    await expect(page.locator('.reg-topico-item')).toHaveCount(2);

    // Questões por item + status finalizado no item 1
    await page.fill('[data-topico-idx="0"][data-field="q-total"]', '10');
    await page.fill('[data-topico-idx="0"][data-field="q-acertos"]', '8');
    await page.fill('[data-topico-idx="0"][data-field="q-erros"]', '2');
    await page.selectOption('select[data-topico-idx="0"][data-field="status"]', 'finalizado');
    await page.fill('[data-topico-idx="1"][data-field="q-total"]', '5');
    await page.fill('[data-topico-idx="1"][data-field="q-acertos"]', '5');

    // Seções unificadas: resultados viram resumo somado (sem inputs globais)
    // e o progresso vira nota por item (sem o select global).
    await expect(page.locator('#reg-resultados')).toContainText('Somado automaticamente');
    await expect(page.locator('#reg-resultados')).toContainText('87% de aproveitamento'); // 13/15
    await expect(page.locator('#reg-q-total')).toHaveCount(0);
    await expect(page.locator('#reg-status-topico')).toHaveCount(0);
    await expect(page.locator('#reg-progresso')).toContainText('definido por item');
    await expect(page.locator('.reg-progresso-pill-done')).toHaveCount(1);

    await page.click('[data-action="toggle-study-type"][data-tipo="questoes"]');
    await page.click('[data-action="save-registro-sessao"]');
    await expect(modal).not.toHaveClass(/open/);

    const snapshot = await page.evaluate(() => {
      const ev = window.EstudoApp.state.eventos.find((e) => e.id === 'ev_multi');
      const disciplina = window.EstudoApp.state.editais[0].disciplinas[0];
      return {
        status: ev.status,
        topicos: ev.sessao.topicos,
        questoes: ev.sessao.questoes,
        assId: ev.assId,
        statusTopico: ev.sessao.statusTopico,
        ass1Concluido: disciplina.assuntos.find((a) => a.id === 'ass_1').concluido,
        ass2Concluido: disciplina.assuntos.find((a) => a.id === 'ass_2').concluido,
        habitosQuestoes: window.EstudoApp.state.habitos.questoes,
      };
    });

    expect(snapshot.status).toBe('estudei');
    expect(snapshot.topicos).toHaveLength(2);
    // Derivados: escalares = 1º item; somas nos campos atuais
    expect(snapshot.assId).toBe('ass_1');
    expect(snapshot.questoes).toEqual({ total: 15, acertos: 13, erros: 2 });
    expect(snapshot.statusTopico).toBe('finalizado');
    // Promoção por item: só o finalizado conclui
    expect(snapshot.ass1Concluido).toBe(true);
    expect(snapshot.ass2Concluido).toBe(false);
    // Hábito usa a soma
    expect(snapshot.habitosQuestoes).toHaveLength(1);
    expect(snapshot.habitosQuestoes[0].total).toBe(15);

    // Histórico mostra a sessão com o contador de tópicos
    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');

    // Reeditar: a lista volta populada com os 2 itens
    await page.evaluate(() => {
      window.openRegistroSessao('ev_multi');
    });
    await expect(page.locator('.reg-topico-item')).toHaveCount(2);
    await expect(page.locator('[data-topico-idx="0"][data-field="q-total"]')).toHaveValue('10');
  });
});
