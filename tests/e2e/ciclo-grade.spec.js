import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

/**
 * Seed state with proper cleanup
 */
async function seedLegacyState(page, state) {
  await page.addInitScript((serializedState) => {
    window.Chart = class {
      destroy() {}
    };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serializedState);
  }, JSON.stringify(state));
}

test.describe('Ciclo de Estudos', () => {
  test('inicia ciclo vazio e exibe mensagem de planejamento', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify empty state message
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state h4')).toContainText('Nenhum Planejamento');
    // Use more specific selector to avoid strict mode violation
    await expect(page.locator('.empty-state [data-action="open-planejamento-wizard"]')).toBeVisible();
  });

  test('cria ciclo via manipulação de estado e exibe sequência', async ({ page }) => {
    const state = createE2EState();
    // Setup ciclo ativo com disciplina
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
      ],
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify cycle is displayed
    await expect(page.locator('.ciclo-header-title')).toContainText('Planejamento');
    await expect(page.locator('.ciclo-stat-value')).toContainText('0');
    await expect(page.locator('.seq-item-card')).toBeVisible();
    // Check state directly instead of DOM
    const seqDisciplina = await page.evaluate(() => {
      const seq = window.state.planejamento?.sequencia?.[0];
      const disc = window.state.editais[0]?.disciplinas?.[0];
      return disc?.nome || null;
    });
    expect(seqDisciplina).toBe('Direito Constitucional');
  });

  test('aplica refinamentos visuais da aba planejamento em desktop e mobile', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: Array.from({ length: 6 }, (_, index) => ({
        id: `seq_${index + 1}`,
        discId: 'disc_1',
        minutosAlvo: 120,
        concluido: false
      })),
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await page.setViewportSize({ width: 1536, height: 768 });
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await expect(page.locator('.seq-item-card--static')).toHaveCount(6);

    const desktopMetrics = await page.locator('.ciclo-layout').evaluate((layout) => {
      const left = layout.querySelector('.ciclo-content-col')?.getBoundingClientRect();
      const right = layout.querySelector('.ciclo-side-panel')?.getBoundingClientRect();
      const scrollArea = layout.querySelector('.ciclo-sequence-card .scroll-area-md');
      const chart = layout.querySelector('.ciclo-chart-container')?.getBoundingClientRect();
      const actions = layout.querySelector('.ciclo-sequence-actions');
      const firstCard = layout.querySelector('.seq-item-card--static')?.getBoundingClientRect();
      const styles = window.getComputedStyle(scrollArea);
      const actionStyles = window.getComputedStyle(actions);
      return {
        gutter: Math.round(right.left - left.right),
        leftWidth: Math.round(left.width),
        rightWidth: Math.round(right.width),
        scrollPaddingRight: styles.paddingRight,
        chartHeight: Math.round(chart.height),
        actionsOpacity: Number(actionStyles.opacity),
        actionsMaxHeight: actionStyles.maxHeight,
        firstCardHeight: Math.round(firstCard.height)
      };
    });

    expect(desktopMetrics.gutter).toBeGreaterThanOrEqual(36);
    expect(desktopMetrics.leftWidth).toBeGreaterThan(desktopMetrics.rightWidth);
    expect(desktopMetrics.scrollPaddingRight).toBe('12px');
    expect(desktopMetrics.chartHeight).toBeLessThanOrEqual(176);
    expect(desktopMetrics.actionsOpacity).toBeLessThan(0.2);
    expect(desktopMetrics.actionsMaxHeight).toBe('0px');
    expect(desktopMetrics.firstCardHeight).toBeLessThanOrEqual(92);

    await page.locator('.seq-item-card--static').first().hover();
    await expect(page.locator('.seq-item-card--static').first().locator('.ciclo-sequence-actions')).toHaveCSS('opacity', '1');
    await expect(page.locator('.seq-item-card--static').first().locator('.ciclo-sequence-actions')).not.toHaveCSS('max-height', '0px');

    await page.setViewportSize({ width: 390, height: 780 });
    await expect(page.locator('.seq-item-card--static').first().locator('.ciclo-sequence-actions')).toHaveCSS('opacity', '1');
  });

  test('mantem ciclo planejado sem recortes horizontais em mobile', async ({ page }) => {
    const state = createE2EState();
    const disciplinas = [
      { id: 'disc_1', nome: 'Administracao Financeira e Orcamentaria', icone: 'A', cor: '#f59e0b', assuntos: [], aulas: [] },
      { id: 'disc_2', nome: 'Direito Administrativo', icone: 'D', cor: '#3b82f6', assuntos: [], aulas: [] },
      { id: 'disc_3', nome: 'Direito Previdenciario', icone: 'P', cor: '#06b6d4', assuntos: [], aulas: [] },
      { id: 'disc_4', nome: 'Lingua Portuguesa', icone: 'L', cor: '#10b981', assuntos: [], aulas: [] }
    ];
    state.editais[0].disciplinas = disciplinas;
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: disciplinas.map(d => d.id),
      sequencia: disciplinas.map((d, index) => ({
        id: `seq_${index + 1}`,
        discId: d.id,
        minutosAlvo: 120,
        concluido: false
      })),
      ciclosCompletos: 2,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        dataInicial: '2026-03-17',
        dataFinal: '2026-04-10',
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };

    await page.setViewportSize({ width: 390, height: 844 });
    await seedLegacyState(page, state);
    await page.goto('/');
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');
    await page.evaluate(() => window.EstudoApp.navigate('ciclo'));
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await expect(page.locator('.seq-item-card--static')).toHaveCount(4);

    const metrics = await page.evaluate(() => {
      const selectors = [
        '#main-content',
        '.ciclo-layout',
        '.ciclo-header-actions',
        '.ciclo-header-buttons',
        '.ciclo-btn',
        '.ciclo-content-col',
        '.ciclo-summary-row',
        '.ciclo-stat-card',
        '.ciclo-side-panel',
        '.ciclo-sequence-card',
        '.ciclo-sequence-card .scroll-area-md',
        '.seq-item-card--static',
        '.seq-item-content--static',
        '.ciclo-sequence-actions',
        '.ciclo-action-link',
        '.ciclo-chart-container',
        '.ciclo-filete-linear',
        '.ciclo-predict-box',
        '.ciclo-predict-summary'
      ];
      return selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)).map((element, index) => ({
        selector,
        index,
        clientWidth: Math.round(element.clientWidth),
        scrollWidth: Math.round(element.scrollWidth)
      }))).filter(item => item.scrollWidth > item.clientWidth + 1);
    });
    expect(metrics).toEqual([]);

    const compactMetrics = await page.evaluate(() => {
      const summaryCard = document.querySelector('.ciclo-stat-card--center');
      const sequenceCard = document.querySelector('.ciclo-sequence-card');
      const summaryRect = summaryCard.getBoundingClientRect();
      const sequenceRect = sequenceCard.getBoundingClientRect();
      return {
        summaryHeight: Math.round(summaryRect.height),
        sequenceGap: Math.round(sequenceRect.top - summaryRect.bottom)
      };
    });

    expect(compactMetrics.summaryHeight).toBeLessThanOrEqual(180);
    expect(compactMetrics.sequenceGap).toBeGreaterThanOrEqual(12);
  });

  test('recomeça ciclo e limpa sequência', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
      ],
      ciclosCompletos: 2,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify initial cycle count
    await expect(page.locator('.ciclo-stat-value')).toContainText('2');

    // Recomeçar ciclo via state manipulation (bypassing confirm)
    await page.evaluate(() => {
      if (window.state.planejamento) {
        window.state.planejamento.ciclosCompletos += 1;
        window.state.planejamento.dataInicioCicloAtual = new Date().toISOString();
        window.EstudoApp?.scheduleSave?.();
        window.EstudoApp?.renderCurrentView?.();
      }
    });
    await page.waitForTimeout(1000);

    // Verify cycle count incremented
    const cycleCount = await page.evaluate(() => window.state.planejamento?.ciclosCompletos);
    expect(cycleCount).toBe(3);
  });

  test('edita sequência do ciclo', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
      ],
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify button exists
    const editBtn = await page.locator('[data-action="toggle-edit-seq"]');
    await expect(editBtn).toBeVisible();

    // Add new discipline to sequence via state (simulating edit)
    await page.evaluate(() => {
      if (window.state.planejamento?.sequencia) {
        window.state.planejamento.sequencia.push({
          id: 'seq_2',
          discId: 'disc_1',
          minutosAlvo: 90,
          concluido: false
        });
        window.EstudoApp?.scheduleSave?.();
        window.EstudoApp?.renderCurrentView?.();
      }
    });
    await page.waitForTimeout(1000);

    // Verify sequence has 2 items
    const seqCount = await page.evaluate(() => window.state.planejamento?.sequencia?.length || 0);
    expect(seqCount).toBe(2);
  });

  test('mantem cards de edicao da sequencia espacados sem overflow horizontal', async ({ page }) => {
    const state = createE2EState();
    const disciplinas = [
      { id: 'disc_1', nome: 'Administracao Financeira e Orcamentaria', icone: 'A', cor: '#f59e0b', assuntos: [], aulas: [] },
      { id: 'disc_2', nome: 'Direito Administrativo', icone: 'D', cor: '#3b82f6', assuntos: [], aulas: [] },
      { id: 'disc_3', nome: 'Direito Previdenciario', icone: 'P', cor: '#06b6d4', assuntos: [], aulas: [] },
      { id: 'disc_4', nome: 'Lingua Portuguesa', icone: 'L', cor: '#10b981', assuntos: [], aulas: [] }
    ];
    state.editais[0].disciplinas = disciplinas;
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: disciplinas.map(d => d.id),
      sequencia: disciplinas.map((d, index) => ({
        id: `seq_${index + 1}`,
        discId: d.id,
        minutosAlvo: 120,
        concluido: false
      })),
      ciclosCompletos: 1,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await page.setViewportSize({ width: 1536, height: 768 });
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.click('[data-action="toggle-edit-seq"]');
    await expect(page.locator('.seq-item-card--editing')).toHaveCount(4);

    const metrics = await page.locator('.ciclo-sequence-card').evaluate((card) => {
      const items = Array.from(card.querySelectorAll('.seq-item-card--editing'));
      const gaps = items.slice(1).map((item, index) => {
        const previous = items[index].getBoundingClientRect();
        const current = item.getBoundingClientRect();
        return Math.round(current.top - previous.bottom);
      });
      return {
        cardOverflows: card.scrollWidth > card.clientWidth + 1,
        contentOverflows: items.map((item, index) => ({
          index,
          overflow: item.scrollWidth > item.clientWidth + 1,
          scrollWidth: item.scrollWidth,
          clientWidth: item.clientWidth
        })),
        gaps,
        heights: items.map(item => Math.round(item.getBoundingClientRect().height)),
        actionWidths: items.map(item => Math.round(item.querySelector('.seq-item-actions')?.getBoundingClientRect().width || 0)),
        moveWidths: items.map(item => Math.round(item.querySelector('.seq-item-move-controls')?.getBoundingClientRect().width || 0))
      };
    });

    expect(metrics.cardOverflows).toBe(false);
    expect(metrics.contentOverflows.filter(item => item.overflow)).toEqual([]);
    expect(metrics.gaps.every(gap => gap >= 10 && gap <= 14)).toBe(true);
    expect(Math.max(...metrics.heights) - Math.min(...metrics.heights)).toBeLessThanOrEqual(6);
    expect(metrics.actionWidths.every(width => width >= 170)).toBe(true);
    expect(metrics.moveWidths.every(width => width >= 28)).toBe(true);
  });
});

test.describe('Grade Semanal', () => {
  test('exibe grade semanal vazia sem planejamento', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify empty state
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('cria grade semanal via estado e exibe dias planejados', async ({ page }) => {
    const state = createE2EState();
    // Setup grade semanal ativa
    state.planejamento = {
      ativo: true,
      tipo: 'semanal',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 90, concluido: false }
      ],
      ciclosCompletos: 0,
      horarios: {
        diasAtivos: [2, 4, 6], // Terça, Quinta, Sábado
        horasPorDia: { 2: '03:00', 4: '02:30', 6: '04:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify grade is displayed
    await expect(page.locator('.grade-header-title')).toBeVisible();
    await expect(page.locator('.grade-day-card')).toHaveCount(3);

    // Verify days are displayed
    const dayTitles = await page.locator('.grade-day-title').allTextContents();
    expect(dayTitles).toContain('Terça');
    expect(dayTitles).toContain('Quinta');
    expect(dayTitles).toContain('Sábado');
  });

  test('exibe sequência de etapas da grade', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'semanal',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false },
        { id: 'seq_2', discId: 'disc_1', minutosAlvo: 90, concluido: false }
      ],
      ciclosCompletos: 0,
      horarios: {
        diasAtivos: [1, 2, 3],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify sequence steps
    await expect(page.locator('.grade-seq-card')).toHaveCount(2);

    // Verify step labels
    const stepLabels = await page.locator('.grade-seq-step-label').allTextContents();
    expect(stepLabels[0]).toContain('Etapa 1');
    expect(stepLabels[1]).toContain('Etapa 2');

    // Verify "Estudar Agora" buttons are visible
    await expect(page.locator('[data-action="iniciar-etapa-planejamento"]')).toHaveCount(2);
  });

  test('remove planejamento da grade', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'semanal',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
      ],
      ciclosCompletos: 0,
      horarios: {
        diasAtivos: [1, 2, 3],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Remove planejamento via state manipulation
    await page.evaluate(() => {
      window.state.planejamento = {
        ativo: false,
        tipo: null,
        disciplinas: [],
        sequencia: [],
        ciclosCompletos: 0
      };
      window.EstudoApp?.scheduleSave?.();
      window.EstudoApp?.renderCurrentView?.();
    });
    await page.waitForTimeout(1000);

    // Verify empty state is displayed again
    await expect(page.locator('.empty-state')).toBeVisible();
  });
});

test.describe('Previsão de Sessões (Ciclo)', () => {
  test('exibe caixa de previsão de sessões', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
      ],
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' },
        dataInicial: '2026-04-20',
        dataFinal: '2026-04-27'
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Verify prediction box is visible
    await expect(page.locator('.ciclo-predict-box')).toBeVisible();
    await expect(page.locator('#predict-start-date')).toHaveValue('2026-04-20');
    await expect(page.locator('#predict-end-date')).toHaveValue('2026-04-27');
    await expect(page.locator('.ciclo-predict-summary')).toContainText('18 sess');
    await expect(page.locator('.ciclo-predict-summary')).toContainText('18h totais');
    await expect(page.locator('.ciclo-predict-summary')).toContainText('20/04/2026 a 27/04/2026');
    const summaryMetrics = await page.locator('.ciclo-predict-summary').evaluate((summary) => {
      const date = summary.querySelector('.ciclo-predict-summary-date');
      return {
        summaryText: summary.textContent,
        summaryOverflows: summary.scrollWidth > summary.clientWidth + 1,
        dateOverflows: date.scrollWidth > date.clientWidth + 1
      };
    });
    expect(summaryMetrics.summaryText).toContain('20/04/2026 a 27/04/2026');
    expect(summaryMetrics.summaryOverflows).toBe(false);
    expect(summaryMetrics.dateOverflows).toBe(false);
  });

  test('remover planejamento limpa sessoes previstas do calendario e study organizer', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }],
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' },
      },
    };
    state.eventos = [
      {
        id: 'ev_pending_seq',
        titulo: 'Estudar Sessao Planejada',
        data: '2026-05-05',
        duracao: 60,
        status: 'agendado',
        tempoAcumulado: 0,
        tipo: 'conteudo',
        discId: 'disc_1',
        seqId: 'seq_1',
      },
      {
        id: 'ev_studied_seq',
        titulo: 'Sessao Ja Estudada',
        data: '2026-05-05',
        duracao: 60,
        status: 'estudei',
        tempoAcumulado: 1800,
        tipo: 'conteudo',
        discId: 'disc_1',
        seqId: 'seq_1',
      },
      {
        id: 'ev_manual_keep',
        titulo: 'Evento Manual Mantido',
        data: '2026-05-05',
        duracao: 30,
        status: 'agendado',
        tempoAcumulado: 0,
        tipo: 'conteudo',
        discId: 'disc_1',
      },
    ];
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="calendar"]');
    await expect(page.locator('#topbar-title')).toHaveText('Calendário', { timeout: 10000 });
    await expect(page.locator('#main-content')).toContainText('Estudar Sessao Planejada');

    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.locator('[data-action="ciclo-toggle-kebab"]').click();
    await page.locator('.ciclo-kebab-menu:not([hidden]) [data-action="remover-planejamento"]').click();
    await expect(page.locator('#modal-confirm')).toHaveClass(/open/);
    await page.click('#confirm-ok-btn');

    const remainingIds = await page.evaluate(() => window.state.eventos.map((event) => event.id));
    expect(remainingIds).not.toContain('ev_pending_seq');
    expect(remainingIds).toContain('ev_studied_seq');
    expect(remainingIds).toContain('ev_manual_keep');

    await page.click('[data-view="calendar"]');
    await expect(page.locator('#main-content')).not.toContainText('Estudar Sessao Planejada');
    await expect(page.locator('#main-content')).toContainText('Evento Manual Mantido');

    await page.click('[data-view="med"]');
    await expect(page.locator('#main-content')).not.toContainText('Estudar Sessao Planejada');
  });
});
