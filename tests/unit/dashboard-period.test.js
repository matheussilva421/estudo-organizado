import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import {
  createBaseState,
  createEdital,
  createDisciplina,
  createEvento,
} from '../helpers/state-builders.js';

// O dashboard filtra o período e monta os gráficos a partir da DATA REAL do
// estudo (dataEstudo || data) — mesma régua do Histórico, da Home e de
// getAggregatedStats. Usar só a data agendada (e.data) faz uma sessão agendada
// na segunda e estudada na sexta contar no dia errado e divergir entre telas.
describe('dashboard period (data real do estudo)', () => {
  let store;
  let logic;
  let dash;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

    const modules = await loadAppModules();
    store = modules.store;
    logic = modules.logic;
    // mesmo specifier usado por views.js → mesma instância de módulo
    dash = await import('../../src/js/views/dashboard-view.js');

    store.setState(
      createBaseState({
        editais: [
          createEdital({
            disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito' })],
          }),
        ],
        eventos: [
          // agendada há meses, mas estudada ontem — DENTRO do período de 7 dias
          createEvento({
            id: 'ev_1',
            data: '2026-01-05',
            dataEstudo: '2026-04-19',
            status: 'estudei',
            tempoAcumulado: 3600,
            discId: 'disc_1',
          }),
        ],
      })
    );
    logic.invalidateDiscCache();
    logic.invalidateDashCaches();
  });

  it('inclui no período a sessão estudada dentro da janela, mesmo agendada fora dela', () => {
    const container = { innerHTML: '' };
    dash.renderDashboard(container); // dashPeriod default = 7 dias

    // tempo do período (01:00:00) e contagem de sessões devem refletir dataEstudo
    expect(container.innerHTML).toContain('01:00:00');
    expect(container.innerHTML).toMatch(/Sessões Realizadas<\/div>\s*<div class="stat-value">1</);
  });

  it('gráfico de tempo por disciplina usa a data real do estudo no corte do período', () => {
    const captured = [];
    global.Chart = class {
      constructor(ctx, cfg) {
        captured.push(cfg);
      }
      destroy() {}
    };
    document.body.innerHTML = '<canvas id="chart-disc"></canvas>';

    dash.renderDiscChart(7);

    expect(captured).toHaveLength(1);
    expect(captured[0].data.labels).toContain('Direito');
    expect(captured[0].data.datasets[0].data).toEqual([60]);
  });

  it('gráfico diário acumula os minutos no dia real do estudo', () => {
    const captured = [];
    global.Chart = class {
      constructor(ctx, cfg) {
        captured.push(cfg);
      }
      destroy() {}
    };
    document.body.innerHTML = '<canvas id="chart-daily"></canvas>';

    dash.renderDailyChart(7);

    expect(captured).toHaveLength(1);
    const data = captured[0].data.data ?? captured[0].data.datasets[0].data;
    // janela de 7 dias terminando hoje (2026-04-20); ontem = penúltima posição
    expect(data[data.length - 2]).toBe(60);
    expect(data.reduce((a, b) => a + b, 0)).toBe(60);
  });
});
