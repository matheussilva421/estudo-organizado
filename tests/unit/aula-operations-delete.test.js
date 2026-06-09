import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('aula-operations deleteAula', () => {
  let mod;
  let disc;

  beforeEach(async () => {
    vi.resetModules();
    disc = {
      id: 'disc_1',
      aulas: [
        { id: 'aula_1', nome: 'Aula 1' },
        { id: 'aula_2', nome: 'Aula 2' },
      ],
      // sem array `assuntos` — cenário de dados antigos/incompletos
    };

    vi.doMock('../../src/js/app.js?v=8.37', () => ({
      showConfirm: vi.fn((msg, cb) => cb()),
      showToast: vi.fn(),
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      todayStr: vi.fn(() => '2026-06-09'),
      uid: vi.fn(() => 'mock_uid'),
    }));
    vi.doMock('../../src/js/store.js?v=8.37', () => ({ scheduleSave: vi.fn() }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getDisc: vi.fn(() => ({ disc, edital: { id: 'ed_1' } })),
    }));
    vi.doMock('../../src/js/lesson-mapper.js?v=8.37', () => ({
      mapAulasToAssuntos: vi.fn(() => 0),
    }));
    vi.doMock('../../src/js/views/editais/disc-manager.js', () => ({
      captureDiscManagerScroll: vi.fn(() => null),
      openDiscManager: vi.fn(),
    }));
    vi.doMock('../../src/js/views/editais/shared-state.js', () => ({
      getEditingSubjectCtx: vi.fn(() => ({ editaId: 'ed_1' })),
    }));

    mod = await import('../../src/js/views/editais/aula-operations.js');
  });

  it('does not throw when disc.assuntos is missing and still removes the aula', () => {
    expect(() => mod.deleteAula('disc_1', 'aula_1')).not.toThrow();
    expect(disc.aulas.map((a) => a.id)).toEqual(['aula_2']);
  });

  it('removes backlinks from assuntos when present', () => {
    disc.assuntos = [{ id: 'ass_1', nome: 'A', linkedAulaIds: ['aula_1', 'aula_2'] }];
    mod.deleteAula('disc_1', 'aula_1');
    expect(disc.assuntos[0].linkedAulaIds).toEqual(['aula_2']);
  });
});
