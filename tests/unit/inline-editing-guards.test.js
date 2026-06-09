import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('inline-editing editLessonInline', () => {
  let mod;
  let logicModule;

  beforeEach(async () => {
    vi.resetModules();
    logicModule = { getDisc: vi.fn(() => null) };

    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      scheduleSave: vi.fn(),
      state: { editais: [] },
    }));
    vi.doMock('../../src/js/components.js?v=8.37', () => ({ renderCurrentView: vi.fn() }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => logicModule);
    vi.doMock('../../src/js/views/editais/shared-state.js', () => ({
      getEditingSubjectCtx: vi.fn(() => ({ editaId: 'ed_1' })),
    }));
    vi.doMock('../../src/js/views/editais/disc-manager.js', () => ({
      openDiscManager: vi.fn(),
    }));

    mod = await import('../../src/js/views/editais/inline-editing.js');
  });

  it('does not throw when the discipline no longer exists', () => {
    const el = document.createElement('div');
    expect(() => mod.editLessonInline('disc_x', 'aula_1', el)).not.toThrow();
  });

  it('replaces the element content with an input when the aula exists', () => {
    logicModule.getDisc.mockReturnValue({
      disc: { id: 'disc_1', aulas: [{ id: 'aula_1', nome: 'Aula 1' }] },
      edital: { id: 'ed_1' },
    });
    const el = document.createElement('div');
    document.body.appendChild(el);
    mod.editLessonInline('disc_1', 'aula_1', el);
    const input = el.querySelector('input');
    expect(input).not.toBeNull();
    expect(input.value).toBe('Aula 1');
  });
});
