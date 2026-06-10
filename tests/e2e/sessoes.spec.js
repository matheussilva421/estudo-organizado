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

test.describe('Registro de Sessoes', () => {
  test('manual session registration creates a valid history entry', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_manual_session',
      titulo: 'Sessao manual E2E',
      data: new Date().toISOString().slice(0, 10),
      dataEstudo: null,
      duracao: 45,
      status: 'agendado',
      tempoAcumulado: 2700,
      tipo: 'conteudo',
      discId: 'disc_1',
      assId: 'ass_1',
      habito: null,
      criadoEm: '2026-04-20T10:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('#main-content')).toContainText('Nenhuma sess');

    await page.evaluate(() => {
      window.openRegistroSessao('ev_manual_session');
    });

    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();
    await page.selectOption('#reg-disciplina', 'disc_1');
    await page.selectOption('#reg-assunto', 'ass_1');
    await page.click('[data-action="toggle-study-type"][data-tipo="questoes"]');
    await page.fill('#reg-q-total', '10');
    await page.fill('#reg-q-acertos', '8');
    await page.fill('#reg-q-erros', '2');
    await page.click('[data-action="save-registro-sessao"]');

    await expect(modal).not.toHaveClass(/open/);
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');
    await expect(page.locator('#main-content')).toContainText('45');
  });

  test('chronometer saves a new session with tracked time', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="cronometro"]');

    await page.click('[data-action="toggle-timer"][data-event-id="crono_livre"]');
    await page.waitForTimeout(1100);
    await page.click('[data-action="mark-studied"][data-event-id="crono_livre"]');

    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();
    await page.selectOption('#reg-disciplina', 'disc_1');
    await page.selectOption('#reg-assunto', 'ass_1');
    await page.click('[data-action="toggle-study-type"][data-tipo="revisao"]');
    await page.click('[data-action="save-registro-sessao"]');

    await expect(modal).not.toHaveClass(/open/);
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');
  });

  test('keeps session history as stacked rectangular discipline rows', async ({ page }) => {
    const state = createE2EState();
    const disciplinas = [
      { id: 'disc_1', nome: 'Direito Previdenciario', icone: 'P', cor: '#06b6d4', assuntos: [{ id: 'ass_1', nome: 'Regimes previdenciarios', concluido: true }], aulas: [] },
      { id: 'disc_2', nome: 'Direito Constitucional', icone: 'C', cor: '#8b5cf6', assuntos: [{ id: 'ass_2', nome: 'Interpretacao constitucional', concluido: true }], aulas: [] },
      { id: 'disc_3', nome: 'Lingua Portuguesa', icone: 'L', cor: '#10b981', assuntos: [{ id: 'ass_3', nome: 'Dominio da ortografia oficial', concluido: true }], aulas: [] },
      { id: 'disc_4', nome: 'Controle Externo e Legislacao Institucional', icone: 'E', cor: '#64748b', assuntos: [{ id: 'ass_4', nome: 'Jurisdicao da administracao publica', concluido: true }], aulas: [] }
    ];
    state.editais[0].disciplinas = disciplinas;
    state.eventos = [
      {
        id: 'ev_hist_single',
        titulo: 'Direito Previdenciario - Aula 01 - Regimes Previdenciarios: distincoes entre RGPS, RPPS e RPC, filiacao, inscricao e segurados do RGPS.',
        data: '2026-03-19',
        dataEstudo: '2026-03-19',
        status: 'estudei',
        tempoAcumulado: 4780,
        tipo: 'conteudo',
        discId: 'disc_1',
        assId: 'ass_1',
        sessao: { questoes: { total: 0 }, paginas: 9 }
      },
      {
        id: 'ev_hist_a',
        titulo: 'Controle Externo e Legislacao Institucional - competencias e jurisdicao administrativa',
        data: '2026-03-02',
        dataEstudo: '2026-03-02',
        status: 'estudei',
        tempoAcumulado: 960,
        tipo: 'conteudo',
        discId: 'disc_4',
        assId: 'ass_4'
      },
      {
        id: 'ev_hist_b',
        titulo: 'Direito Constitucional - Aula de controle de constitucionalidade',
        data: '2026-03-02',
        dataEstudo: '2026-03-02',
        status: 'estudei',
        tempoAcumulado: 6360,
        tipo: 'questoes',
        discId: 'disc_2',
        assId: 'ass_2',
        questoes: { acertos: 24, erros: 6, total: 30 },
        paginas: 21
      },
      {
        id: 'ev_hist_c',
        titulo: 'Lingua Portuguesa - Aula 01 - dominio da ortografia oficial',
        data: '2026-03-02',
        dataEstudo: '2026-03-02',
        status: 'estudei',
        tempoAcumulado: 3420,
        tipo: 'conteudo',
        discId: 'disc_3',
        assId: 'ass_3'
      }
    ];
    await page.setViewportSize({ width: 1536, height: 768 });
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('.session-group-section')).toHaveCount(2);
    await expect(page.locator('.session-history-hint')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const summary = document.querySelector('.session-history-summary')?.getBoundingClientRect();
      return Array.from(document.querySelectorAll('.session-group-section')).map(section => {
        const title = section.querySelector('.session-group-title')?.textContent || '';
        const list = section.querySelector('.session-group-list');
        const cards = Array.from(section.querySelectorAll('.session-disc-card'));
        const detailCards = Array.from(section.querySelectorAll('.session-detail-card'));
        const firstDetailTitle = section.querySelector('.session-detail-title')?.getBoundingClientRect();
        return {
          title,
          listWidth: list?.getBoundingClientRect().width || 0,
          cardWidths: cards.map(card => card.getBoundingClientRect().width),
          cardTops: cards.map(card => Math.round(card.getBoundingClientRect().top)),
          detailOverflows: detailCards.map(card => card.scrollWidth > card.clientWidth + 1),
          firstDetailTitleHeight: firstDetailTitle?.height || 0
        };
      }).concat([{ title: '__summary__', summaryHeight: summary?.height || 0 }]);
    });

    const summary = metrics.find(group => group.title === '__summary__');
    const singleDay = metrics.find(group => group.title.includes('19/03/2026'));
    const multiDay = metrics.find(group => group.title.includes('02/03/2026'));
    expect(summary.summaryHeight).toBeGreaterThan(60);
    expect(singleDay.cardWidths).toHaveLength(1);
    expect(singleDay.cardWidths[0]).toBeGreaterThan(singleDay.listWidth * 0.95);
    expect(singleDay.firstDetailTitleHeight).toBeGreaterThan(20);
    expect(singleDay.detailOverflows.some(Boolean)).toBe(false);
    expect(multiDay.cardWidths).toHaveLength(3);
    expect(multiDay.cardWidths.every(width => width > multiDay.listWidth * 0.95)).toBe(true);
    expect(new Set(multiDay.cardTops).size).toBe(3);
    expect(multiDay.detailOverflows.some(Boolean)).toBe(false);
  });
});

test.describe('Historico de Sessoes - toolbar', () => {
  test('toolbar de filtros nao e esmagada quando a lista esta populada', async ({ page }) => {
    // #main-content e flex column; .card tem overflow:hidden, entao min-height:auto
    // vira 0 e o flex encolhe a toolbar para ~26px quando o conteudo passa da
    // viewport - os selects/botoes ficavam cortados (bug visto em producao).
    const state = createE2EState();
    for (let i = 0; i < 12; i++) {
      state.eventos.push({
        id: `ev_hist_${i}`,
        titulo: `Sessao ${i + 1}`,
        data: '2026-06-08',
        dataEstudo: `2026-06-0${(i % 8) + 1}`,
        duracao: 60,
        status: 'estudei',
        tempoAcumulado: 1800,
        tipo: 'conteudo',
        discId: 'disc_1',
        assId: 'ass_1',
        habito: null,
      });
    }

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="historico-sessoes"]');

    const toolbar = page.locator('.historico-toolbar');
    await expect(toolbar).toBeVisible();
    await expect(page.locator('.session-group-section').first()).toBeVisible();

    const toolbarBox = await toolbar.boundingBox();
    const selectBox = await page.locator('[data-action="historico-set-range"]').boundingBox();
    const buscaBox = await page.locator('[data-action="historico-set-busca"]').boundingBox();

    // os controles precisam caber DENTRO da area visivel da toolbar
    expect(selectBox.y + selectBox.height).toBeLessThanOrEqual(toolbarBox.y + toolbarBox.height + 1);
    expect(buscaBox.y + buscaBox.height).toBeLessThanOrEqual(toolbarBox.y + toolbarBox.height + 1);
  });
});
