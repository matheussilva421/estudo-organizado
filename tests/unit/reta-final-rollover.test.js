import { describe, expect, it } from 'vitest';
import {
  rolloverRetaFinalBlocks,
  reconcileRetaFinalWithEvents,
} from '../../src/js/logic/reta-final-core.js';

const HOJE = '2026-07-10';

function bloco(overrides = {}) {
  return {
    id: 'rf_1',
    data: '2026-07-10',
    dataOriginal: '2026-07-10',
    discId: 'disc_1',
    topicos: [{ assId: 'ass_1', aulaId: null }],
    minutos: 60,
    status: 'pendente',
    rolagens: 0,
    ...overrides,
  };
}

function retaFinal(blocos, overrides = {}) {
  return {
    nome: 'RF',
    dataFinal: '2026-08-15',
    minutosPadrao: 60,
    importadoEm: '2026-07-01T10:00:00.000Z',
    blocos,
    ...overrides,
  };
}

describe('rolloverRetaFinalBlocks', () => {
  it('bloco pendente de ontem rola para hoje somando rolagens', () => {
    const rf = retaFinal([bloco({ id: 'rf_a', data: '2026-07-09', dataOriginal: '2026-07-09' })]);
    const result = rolloverRetaFinalBlocks(rf, { today: HOJE });

    expect(result.changed).toBe(true);
    expect(result.rolados).toEqual(['rf_a']);
    const b = rf.blocos[0];
    expect(b.data).toBe(HOJE);
    expect(b.dataOriginal).toBe('2026-07-09');
    expect(b.rolagens).toBe(1);
    expect(b.status).toBe('pendente');
  });

  it('bloco rolado entra DEPOIS dos blocos que já eram de hoje (empilha no fim)', () => {
    const rf = retaFinal([
      bloco({ id: 'rf_ontem', data: '2026-07-09', dataOriginal: '2026-07-09' }),
      bloco({ id: 'rf_hoje', data: HOJE }),
      bloco({ id: 'rf_amanha', data: '2026-07-11', dataOriginal: '2026-07-11' }),
    ]);

    rolloverRetaFinalBlocks(rf, { today: HOJE });

    expect(rf.blocos.map((b) => b.id)).toEqual(['rf_hoje', 'rf_ontem', 'rf_amanha']);
  });

  it('pós-dataFinal, bloco pendente atrasado vira nao_coberto (sem mudar data)', () => {
    const rf = retaFinal([bloco({ id: 'rf_a', data: '2026-08-14', dataOriginal: '2026-08-14' })]);
    const result = rolloverRetaFinalBlocks(rf, { today: '2026-08-16' });

    expect(result.changed).toBe(true);
    expect(result.naoCobertos).toEqual(['rf_a']);
    expect(rf.blocos[0].status).toBe('nao_coberto');
    expect(rf.blocos[0].data).toBe('2026-08-14');
  });

  it('bloco com evento preservado não rola', () => {
    const rf = retaFinal([bloco({ id: 'rf_a', data: '2026-07-09' })]);
    const result = rolloverRetaFinalBlocks(rf, {
      today: HOJE,
      preservedBlocoIds: new Set(['rf_a']),
    });

    expect(result.changed).toBe(false);
    expect(rf.blocos[0].data).toBe('2026-07-09');
    expect(rf.blocos[0].rolagens).toBe(0);
  });

  it('blocos concluídos e de hoje/futuro não mudam (idempotência)', () => {
    const rf = retaFinal([
      bloco({ id: 'rf_done', data: '2026-07-08', status: 'concluido' }),
      bloco({ id: 'rf_hoje', data: HOJE }),
      bloco({ id: 'rf_fut', data: '2026-07-12' }),
    ]);

    const result = rolloverRetaFinalBlocks(rf, { today: HOJE });
    expect(result.changed).toBe(false);

    // segunda passada continua estável
    const again = rolloverRetaFinalBlocks(rf, { today: HOJE });
    expect(again.changed).toBe(false);
    expect(rf.blocos.map((b) => b.data)).toEqual(['2026-07-08', HOJE, '2026-07-12']);
  });

  it('retaFinal ausente retorna changed=false', () => {
    expect(rolloverRetaFinalBlocks(null, { today: HOJE }).changed).toBe(false);
    expect(rolloverRetaFinalBlocks({ blocos: null }, { today: HOJE }).changed).toBe(false);
  });
});

describe('reconcileRetaFinalWithEvents', () => {
  function plan(blocos) {
    return {
      ativo: true,
      tipo: 'reta_final',
      updatedAt: '2026-07-01T10:00:00.000Z',
      retaFinal: retaFinal(blocos),
    };
  }

  it('bloco com evento rfBlocoId estudado vira concluido', () => {
    const p = plan([bloco({ id: 'rf_a' })]);
    const eventos = [
      { id: 'ev_1', rfBlocoId: 'rf_a', status: 'estudei', tempoAcumulado: 3600, data: HOJE },
    ];

    const result = reconcileRetaFinalWithEvents(p, eventos);

    expect(result.changed).toBe(true);
    expect(result.completed).toEqual(['rf_a']);
    expect(p.retaFinal.blocos[0].status).toBe('concluido');
  });

  it('bloco nao_coberto com evento estudado também vira concluido', () => {
    const p = plan([bloco({ id: 'rf_a', status: 'nao_coberto' })]);
    const eventos = [
      { id: 'ev_1', rfBlocoId: 'rf_a', status: 'estudei', tempoAcumulado: 3600, data: HOJE },
    ];

    reconcileRetaFinalWithEvents(p, eventos);
    expect(p.retaFinal.blocos[0].status).toBe('concluido');
  });

  it('bloco concluido sem evento de sustentação reabre para pendente', () => {
    const p = plan([bloco({ id: 'rf_a', status: 'concluido' })]);

    const result = reconcileRetaFinalWithEvents(p, []);

    expect(result.reopened).toEqual(['rf_a']);
    expect(p.retaFinal.blocos[0].status).toBe('pendente');
  });

  it('NUNCA altera planejamento.updatedAt (anti ping-pong LWW)', () => {
    const p = plan([bloco({ id: 'rf_a' })]);
    const eventos = [
      { id: 'ev_1', rfBlocoId: 'rf_a', status: 'estudei', tempoAcumulado: 3600, data: HOJE },
    ];

    reconcileRetaFinalWithEvents(p, eventos);

    expect(p.updatedAt).toBe('2026-07-01T10:00:00.000Z');
  });

  it('plano de outro tipo ou nulo é no-op', () => {
    expect(reconcileRetaFinalWithEvents(null, []).changed).toBe(false);
    expect(
      reconcileRetaFinalWithEvents({ ativo: true, tipo: 'ciclo', sequencia: [] }, []).changed
    ).toBe(false);
  });

  it('idempotente: segunda passada não muda nada', () => {
    const p = plan([bloco({ id: 'rf_a' })]);
    const eventos = [
      { id: 'ev_1', rfBlocoId: 'rf_a', status: 'estudei', tempoAcumulado: 3600, data: HOJE },
    ];

    reconcileRetaFinalWithEvents(p, eventos);
    const again = reconcileRetaFinalWithEvents(p, eventos);
    expect(again.changed).toBe(false);
  });
});
