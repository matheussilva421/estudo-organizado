import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAssunto,
  createDisciplina,
  createEdital,
  createEvento,
} from '../helpers/state-builders.js';

// A memoização vive FORA do núcleo (weak-points.js é puro, guard proíbe imports).
// Contrato: mesmo (cutoffStr, editalFilterId, discFilterId) → mesmo objeto de
// resultado, sem recomputo; invalidação via função exportada ou pelo evento
// 'app:invalidateCaches' no document (mesmo fan-out dos demais caches).

let listeners;
let memo;

function buildArgs(overrides = {}) {
  return {
    eventos: [
      createEvento({
        id: 'e1',
        status: 'estudei',
        dataEstudo: '2026-07-01',
        discId: 'disc_1',
        assId: 'ass_1',
        sessao: { questoes: { total: 10, acertos: 4, erros: 6 } },
      }),
    ],
    arquivo: [],
    editais: [
      createEdital({
        id: 'ed_1',
        disciplinas: [
          createDisciplina({
            id: 'disc_1',
            assuntos: [createAssunto({ id: 'ass_1', nome: 'Licitações' })],
          }),
        ],
      }),
    ],
    cutoffStr: '2026-06-01',
    editalFilterId: null,
    discFilterId: null,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  listeners = {};
  global.document = {
    addEventListener: vi.fn((event, handler) => {
      listeners[event] = handler;
    }),
  };
  memo = await import('../../src/js/logic/weak-points-memo.js');
});

describe('computeWeakPointsMemo', () => {
  it('mesma chave retorna o mesmo objeto (cache hit)', () => {
    const r1 = memo.computeWeakPointsMemo(buildArgs());
    const r2 = memo.computeWeakPointsMemo(buildArgs());
    expect(r2).toBe(r1);
    expect(r1.ranking).toHaveLength(1);
  });

  it('chave diferente (cutoff ou filtros) recomputa', () => {
    const r1 = memo.computeWeakPointsMemo(buildArgs());
    const r2 = memo.computeWeakPointsMemo(buildArgs({ cutoffStr: null }));
    expect(r2).not.toBe(r1);
    const r3 = memo.computeWeakPointsMemo(buildArgs({ discFilterId: 'disc_1' }));
    expect(r3).not.toBe(r2);
  });

  it('params de série (seriesWeeks/todayStr) fazem parte da chave', () => {
    const r1 = memo.computeWeakPointsMemo(buildArgs({ seriesWeeks: 4, todayStr: '2026-07-10' }));
    const r2 = memo.computeWeakPointsMemo(buildArgs({ seriesWeeks: 4, todayStr: '2026-07-11' }));
    expect(r2).not.toBe(r1);
    const r3 = memo.computeWeakPointsMemo(buildArgs({ seriesWeeks: 8, todayStr: '2026-07-11' }));
    expect(r3).not.toBe(r2);
  });

  it('includeArquivados faz parte da chave', () => {
    const r1 = memo.computeWeakPointsMemo(buildArgs());
    const r2 = memo.computeWeakPointsMemo(buildArgs({ includeArquivados: true }));
    expect(r2).not.toBe(r1);
  });

  it('invalidateWeakPointsMemo força recomputo da mesma chave', () => {
    const r1 = memo.computeWeakPointsMemo(buildArgs());
    memo.invalidateWeakPointsMemo();
    const r2 = memo.computeWeakPointsMemo(buildArgs());
    expect(r2).not.toBe(r1);
  });

  it('registra listener de app:invalidateCaches e invalida quando dispara', () => {
    expect(typeof listeners['app:invalidateCaches']).toBe('function');
    const r1 = memo.computeWeakPointsMemo(buildArgs());
    listeners['app:invalidateCaches']();
    const r2 = memo.computeWeakPointsMemo(buildArgs());
    expect(r2).not.toBe(r1);
  });
});
