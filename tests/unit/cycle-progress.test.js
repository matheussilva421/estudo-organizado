import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import {
  createBaseState,
  createEvento,
  createDisciplina,
  createEdital,
} from '../helpers/state-builders.js';

let store;
let logic;

function createMockDOM() {
  const elements = {};
  const createElement = (id) => {
    const el = {
      id,
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
      setAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
      value: '',
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      focus: vi.fn(),
      remove: vi.fn(),
    };
    elements[id] = el;
    return el;
  };
  return {
    getElementById: vi.fn((id) => {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    activeElement: { blur: vi.fn() },
    body: { contains: vi.fn(() => true), style: {} },
    elements,
  };
}

function seqStep(overrides = {}) {
  return {
    id: 'seq_1',
    discId: 'disc_1',
    minutosAlvo: 120,
    concluido: false,
    status: 'pendente',
    ...overrides,
  };
}

function estudeiEvento(overrides = {}) {
  // tempoAcumulado é em SEGUNDOS nos eventos reais
  return createEvento({
    id: 'ev_est_1',
    status: 'estudei',
    discId: 'disc_1',
    data: '2026-04-18',
    dataEstudo: '2026-04-18',
    tempoAcumulado: 120 * 60,
    ...overrides,
  });
}

function planState(sequencia, eventos, planOverrides = {}) {
  return createBaseState({
    editais: [
      createEdital({ id: 'ed_1', disciplinas: [createDisciplina({ id: 'disc_1' })] }),
    ],
    planejamento: {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      relevancia: {},
      horarios: {},
      sequencia,
      skippedSlots: [],
      ciclosCompletos: 0,
      dataInicioCicloAtual: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
      ...planOverrides,
    },
    eventos,
  });
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  global.document = createMockDOM();
  global.window = { innerWidth: 1024, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  const modules = await loadAppModules();
  store = modules.store;
  logic = modules.logic;

  store.setState(createBaseState());
  logic.invalidateDiscCache();
});

describe('distributeStudiedAcrossSeq (fonte única de progresso)', () => {
  it('etapa pulada não consome minutos do pool', () => {
    const seq = [
      seqStep({ id: 'seq_a', status: 'pulada', minutosAlvo: 60 }),
      seqStep({ id: 'seq_b', status: 'pendente', minutosAlvo: 60 }),
    ];
    const dist = logic.distributeStudiedAcrossSeq(seq, { disc_1: 60 });

    expect(dist.seq_a.usedMins).toBe(0);
    expect(dist.seq_a.remaining).toBe(0);
    expect(dist.seq_a.pct).toBe(0);
    // Os 60 min ficam para a etapa pendente, não para a pulada
    expect(dist.seq_b.usedMins).toBe(60);
    expect(dist.seq_b.shouldComplete).toBe(true);
  });

  it('excedente atravessa para a próxima etapa pendente da mesma disciplina', () => {
    const seq = [
      seqStep({ id: 'seq_a1', minutosAlvo: 120 }),
      seqStep({ id: 'seq_b', discId: 'disc_2', minutosAlvo: 60 }),
      seqStep({ id: 'seq_a2', minutosAlvo: 120 }),
    ];
    const dist = logic.distributeStudiedAcrossSeq(seq, { disc_1: 180 });

    expect(dist.seq_a1.usedMins).toBe(120);
    expect(dist.seq_a1.shouldComplete).toBe(true);
    expect(dist.seq_b.usedMins).toBe(0);
    expect(dist.seq_a2.usedMins).toBe(60);
    expect(dist.seq_a2.remaining).toBe(60);
    expect(dist.seq_a2.shouldComplete).toBe(false);
  });

  it('shouldComplete no limite exato (usedMins === alvo)', () => {
    const seq = [seqStep({ id: 'seq_a', minutosAlvo: 120 })];
    const dist = logic.distributeStudiedAcrossSeq(seq, { disc_1: 120 });
    expect(dist.seq_a.shouldComplete).toBe(true);
  });

  it('etapa com alvo 0 nunca tem shouldComplete', () => {
    const seq = [seqStep({ id: 'seq_a', minutosAlvo: 0 })];
    const dist = logic.distributeStudiedAcrossSeq(seq, { disc_1: 60 });
    expect(dist.seq_a.shouldComplete).toBe(false);
  });

  it('etapa concluída manualmente com tempo menor consome o alvo cheio e não marca shouldComplete', () => {
    const seq = [
      seqStep({ id: 'seq_a1', status: 'concluida', concluido: true, minutosAlvo: 120 }),
      seqStep({ id: 'seq_a2', minutosAlvo: 120 }),
    ];
    const dist = logic.distributeStudiedAcrossSeq(seq, { disc_1: 130 });

    expect(dist.seq_a1.usedMins).toBe(120);
    expect(dist.seq_a1.remaining).toBe(0);
    expect(dist.seq_a1.shouldComplete).toBe(false); // já está concluída
    expect(dist.seq_a2.usedMins).toBe(10); // só o que sobrou do pool
  });

  it('disciplinas repetidas consomem em ordem da sequência', () => {
    const seq = [
      seqStep({ id: 'seq_a1', minutosAlvo: 60 }),
      seqStep({ id: 'seq_a2', minutosAlvo: 60 }),
      seqStep({ id: 'seq_a3', minutosAlvo: 60 }),
    ];
    const dist = logic.distributeStudiedAcrossSeq(seq, { disc_1: 90 });
    expect(dist.seq_a1.usedMins).toBe(60);
    expect(dist.seq_a2.usedMins).toBe(30);
    expect(dist.seq_a3.usedMins).toBe(0);
  });
});

describe('getCycleProgress', () => {
  it('deriva a distribuição dos eventos concluídos desde dataInicioCicloAtual', () => {
    store.setState(
      planState(
        [seqStep({ id: 'seq_a', minutosAlvo: 120 })],
        [
          estudeiEvento({ id: 'ev_1', tempoAcumulado: 60 * 60 }),
          // Antes do início do ciclo: não conta
          estudeiEvento({
            id: 'ev_old',
            data: '2026-03-15',
            dataEstudo: '2026-03-15',
            tempoAcumulado: 999 * 60,
          }),
        ]
      )
    );

    const progress = logic.getCycleProgress();
    expect(progress.seq_a.usedMins).toBe(60);
    expect(progress.seq_a.remaining).toBe(60);
  });

  it('conta sessões SEM seqId (sessão livre) para o progresso', () => {
    store.setState(
      planState(
        [seqStep({ id: 'seq_a', minutosAlvo: 120 })],
        [estudeiEvento({ id: 'ev_livre', seqId: undefined, tempoAcumulado: 120 * 60 })]
      )
    );
    const progress = logic.getCycleProgress();
    expect(progress.seq_a.shouldComplete).toBe(true);
  });
});

describe('reconcileCycleProgress', () => {
  it('conclui etapa quando a distribuição atinge o alvo, marcando autoConcluida', () => {
    store.setState(
      planState(
        [seqStep({ id: 'seq_a', minutosAlvo: 120 })],
        [estudeiEvento({ id: 'ev_1', tempoAcumulado: 120 * 60 })]
      )
    );

    const result = logic.reconcileCycleProgress();

    expect(result.changed).toBe(true);
    expect(result.completed).toEqual(['seq_a']);
    const seq = store.state.planejamento.sequencia[0];
    expect(seq.status).toBe('concluida');
    expect(seq.concluido).toBe(true);
    expect(seq.autoConcluida).toBe(true);
    expect(seq.finalizadoEm).toBeTruthy();
  });

  it('é idempotente: segunda chamada não muda nada', () => {
    store.setState(
      planState(
        [seqStep({ id: 'seq_a', minutosAlvo: 120 })],
        [estudeiEvento({ id: 'ev_1', tempoAcumulado: 120 * 60 })]
      )
    );
    logic.reconcileCycleProgress();
    const second = logic.reconcileCycleProgress();
    expect(second.changed).toBe(false);
    expect(second.completed).toEqual([]);
    expect(second.reopened).toEqual([]);
  });

  it('NUNCA altera planejamento.updatedAt (anti ping-pong de sync)', () => {
    store.setState(
      planState(
        [seqStep({ id: 'seq_a', minutosAlvo: 120 })],
        [estudeiEvento({ id: 'ev_1', tempoAcumulado: 120 * 60 })]
      )
    );
    const before = store.state.planejamento.updatedAt;
    logic.reconcileCycleProgress();
    expect(store.state.planejamento.updatedAt).toBe(before);
  });

  it('reabre etapa autoConcluida quando a sessão que a sustentava é removida', () => {
    store.setState(
      planState(
        [seqStep({ id: 'seq_a', minutosAlvo: 120 })],
        [estudeiEvento({ id: 'ev_1', tempoAcumulado: 120 * 60 })]
      )
    );
    logic.reconcileCycleProgress();

    // Usuário exclui a sessão do histórico
    store.state.eventos = [];
    const result = logic.reconcileCycleProgress();

    expect(result.changed).toBe(true);
    expect(result.reopened).toEqual(['seq_a']);
    const seq = store.state.planejamento.sequencia[0];
    expect(seq.status).toBe('pendente');
    expect(seq.concluido).toBe(false);
    expect(seq.autoConcluida).toBeUndefined();
    expect(seq.finalizadoEm).toBeUndefined();
  });

  it('nunca reabre etapa concluída manualmente (sem flag autoConcluida)', () => {
    store.setState(
      planState(
        [
          seqStep({
            id: 'seq_a',
            status: 'concluida',
            concluido: true,
            minutosAlvo: 120,
            finalizadoEm: '2026-04-15T00:00:00.000Z',
          }),
        ],
        [] // nenhum evento sustenta a conclusão
      )
    );
    const result = logic.reconcileCycleProgress();
    expect(result.changed).toBe(false);
    expect(store.state.planejamento.sequencia[0].status).toBe('concluida');
  });

  it('uma sessão grande conclui múltiplas etapas da disciplina de uma vez', () => {
    store.setState(
      planState(
        [
          seqStep({ id: 'seq_a1', minutosAlvo: 60 }),
          seqStep({ id: 'seq_a2', minutosAlvo: 60 }),
        ],
        [estudeiEvento({ id: 'ev_1', tempoAcumulado: 120 * 60 })]
      )
    );
    const result = logic.reconcileCycleProgress();
    expect(result.completed).toEqual(['seq_a1', 'seq_a2']);
    expect(store.state.planejamento.sequencia.every((s) => s.status === 'concluida')).toBe(true);
  });

  it('não conclui etapa pulada mesmo com pool disponível', () => {
    store.setState(
      planState(
        [seqStep({ id: 'seq_a', status: 'pulada', puladaEm: '2026-04-15T00:00:00.000Z' })],
        [estudeiEvento({ id: 'ev_1', tempoAcumulado: 200 * 60 })]
      )
    );
    const result = logic.reconcileCycleProgress();
    expect(result.changed).toBe(false);
    expect(store.state.planejamento.sequencia[0].status).toBe('pulada');
  });

  it('retorna changed:false sem planejamento ativo', () => {
    store.setState(createBaseState());
    const result = logic.reconcileCycleProgress();
    expect(result.changed).toBe(false);
  });
});
