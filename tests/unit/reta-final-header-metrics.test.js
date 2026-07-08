import { describe, expect, it } from 'vitest';
import {
  computeRetaFinalHeaderMetrics,
  computeRetaFinalSummary,
} from '../../src/js/logic/reta-final-core.js';

// Métricas do cabeçalho da Reta Final (4 KPIs): Concluído (% + blocos),
// Faltam (dias para a prova — usa dataProva, cai em dataFinal), Horas
// (restante/total) e Ritmo necessário (minutosRestantes / dias até dataFinal).
// Função pura: recebe `hoje` e `dataProva`, não lê state.

const HOJE = '2026-07-10';

function rfBloco(overrides = {}) {
  return {
    id: 'rf_1',
    data: HOJE,
    dataOriginal: HOJE,
    discId: 'disc_1',
    topicos: [{ assId: 'ass_1', aulaId: null }],
    minutos: 60,
    status: 'pendente',
    rolagens: 0,
    ...overrides,
  };
}

function buildRetaFinal({ dataFinal = '2026-08-11', blocos } = {}) {
  return {
    nome: 'Reta Final TJCE 2026',
    dataFinal,
    minutosPadrao: 60,
    blocos: blocos || [rfBloco()],
  };
}

describe('computeRetaFinalHeaderMetrics', () => {
  it('percConcluido = round(concluídos/total × 100) e conta blocos', () => {
    const rf = buildRetaFinal({
      blocos: [
        rfBloco({ id: 'a', status: 'concluido' }),
        rfBloco({ id: 'b', status: 'concluido' }),
        rfBloco({ id: 'c', status: 'pendente' }),
        rfBloco({ id: 'd', status: 'pendente' }),
      ],
    });
    const m = computeRetaFinalHeaderMetrics(rf, { hoje: HOJE, dataProva: null });
    expect(m.blocosConcluidos).toBe(2);
    expect(m.totalBlocos).toBe(4);
    expect(m.percConcluido).toBe(50);
  });

  it('arredonda o percentual (2 de 3 → 67%)', () => {
    const rf = buildRetaFinal({
      blocos: [
        rfBloco({ id: 'a', status: 'concluido' }),
        rfBloco({ id: 'b', status: 'concluido' }),
        rfBloco({ id: 'c', status: 'pendente' }),
      ],
    });
    const m = computeRetaFinalHeaderMetrics(rf, { hoje: HOJE, dataProva: null });
    expect(m.percConcluido).toBe(67);
  });

  it('sem blocos não quebra (0% e sem NaN)', () => {
    const m = computeRetaFinalHeaderMetrics(buildRetaFinal({ blocos: [] }), {
      hoje: HOJE,
      dataProva: null,
    });
    expect(m.percConcluido).toBe(0);
    expect(m.totalBlocos).toBe(0);
    expect(Number.isNaN(m.ritmoMinutosPorDia)).toBe(false);
    expect(m.ritmoMinutosPorDia).toBe(0);
  });

  it('diasParaProva usa dataProva quando presente', () => {
    const rf = buildRetaFinal({ dataFinal: '2026-08-11' });
    const m = computeRetaFinalHeaderMetrics(rf, { hoje: HOJE, dataProva: '2026-08-11' });
    expect(m.diasParaProva).toBe(32); // 10/07 → 11/08
  });

  it('diasParaProva cai na dataFinal quando não há dataProva', () => {
    const rf = buildRetaFinal({ dataFinal: '2026-08-11' });
    const m = computeRetaFinalHeaderMetrics(rf, { hoje: HOJE, dataProva: null });
    expect(m.diasParaProva).toBe(32);
  });

  it('diasParaProva no passado vira 0', () => {
    const rf = buildRetaFinal({ dataFinal: '2026-07-01' });
    const m = computeRetaFinalHeaderMetrics(rf, { hoje: HOJE, dataProva: '2026-07-01' });
    expect(m.diasParaProva).toBe(0);
  });

  it('horas: restante/concluído/total batem com computeRetaFinalSummary', () => {
    const rf = buildRetaFinal({
      blocos: [
        rfBloco({ id: 'a', status: 'concluido', minutos: 120 }),
        rfBloco({ id: 'b', status: 'pendente', minutos: 90 }),
      ],
    });
    const summary = computeRetaFinalSummary(rf);
    const m = computeRetaFinalHeaderMetrics(rf, { hoje: HOJE, dataProva: null });
    expect(m.totalMinutos).toBe(summary.totalMinutos);
    expect(m.minutosConcluidos).toBe(summary.minutosConcluidos);
    expect(m.minutosRestantes).toBe(summary.minutosRestantes);
    expect(m.minutosRestantes).toBe(90);
  });

  it('ritmoMinutosPorDia = minutosRestantes / dias até dataFinal', () => {
    // 108h restantes em 32 dias ≈ 202,5 min/dia (3,4h)
    const blocos = Array.from({ length: 108 }, (_, i) =>
      rfBloco({ id: 'r' + i, status: 'pendente', minutos: 60 })
    );
    const rf = buildRetaFinal({ dataFinal: '2026-08-11', blocos });
    const m = computeRetaFinalHeaderMetrics(rf, { hoje: HOJE, dataProva: '2026-08-11' });
    expect(m.diasAteDataFinal).toBe(32);
    expect(m.minutosRestantes).toBe(6480);
    expect(m.ritmoMinutosPorDia).toBeCloseTo(6480 / 32, 5);
  });

  it('ritmo usa no mínimo 1 dia (sem divisão por zero no último dia)', () => {
    const rf = buildRetaFinal({
      dataFinal: HOJE,
      blocos: [rfBloco({ status: 'pendente', minutos: 120 })],
    });
    const m = computeRetaFinalHeaderMetrics(rf, { hoje: HOJE, dataProva: HOJE });
    expect(m.diasAteDataFinal).toBe(0);
    expect(m.ritmoMinutosPorDia).toBe(120); // 120 / max(1, 0)
  });
});
