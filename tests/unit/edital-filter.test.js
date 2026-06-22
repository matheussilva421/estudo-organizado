import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('edital-filter.js (single-principal model)', () => {
  let storeModule;
  let uiState;
  let editalFilter;

  beforeEach(async () => {
    vi.resetModules();
    uiState = {};
    storeModule = {
      state: {
        editais: [
          {
            id: 'ed_1',
            nome: 'Principal',
            arquivado: false,
            disciplinas: [{ id: 'disc_1', arquivada: false }],
          },
          {
            id: 'ed_2',
            nome: 'Arquivado',
            arquivado: true,
            disciplinas: [{ id: 'disc_2', arquivada: false }],
          },
        ],
      },
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/ui-state.js?v=8.37', () => ({
      getUiSection: vi.fn((section) => uiState[section] || {}),
      setUiSection: vi.fn((section, patch) => {
        uiState[section] = { ...(uiState[section] || {}), ...patch };
        return uiState[section];
      }),
    }));

    editalFilter = await import('../../src/js/edital-filter.js?v=8.37');
  });

  it('resolves the edital that owns a discipline id, including archived editais', () => {
    expect(editalFilter.getEditalForDiscId('disc_1')).toMatchObject({ id: 'ed_1' });
    // The link must keep resolving for archived editais (powers stats + the
    // "Editais Anteriores" page).
    expect(editalFilter.getEditalForDiscId('disc_2')).toMatchObject({ id: 'ed_2' });
  });

  it('getSelectedEditalId returns the principal (first non-archived), ignoring stored selection', () => {
    editalFilter.setSelectedEditalId('ed_2'); // stale per-device value must be ignored
    expect(editalFilter.getSelectedEditalId()).toBe('ed_1');
    expect(editalFilter.getSelectedEditalId({ allowAll: false })).toBe('ed_1');
    expect(editalFilter.getSelectedEditalId({ allowAll: true })).toBe('ed_1');
  });

  it('getFilteredEditais returns only the principal', () => {
    expect(editalFilter.getFilteredEditais().map((e) => e.id)).toEqual(['ed_1']);
    expect(editalFilter.getFilteredEditais({ allowAll: false }).map((e) => e.id)).toEqual(['ed_1']);
  });

  it('getFilteredActiveDisciplinas returns the principal active disciplines', () => {
    expect(editalFilter.getFilteredActiveDisciplinas().map(({ disc }) => disc.id)).toEqual([
      'disc_1',
    ]);
  });

  it('event/discipline membership follows the principal', () => {
    expect(editalFilter.disciplineBelongsToSelectedEdital('disc_1')).toBe(true);
    expect(editalFilter.disciplineBelongsToSelectedEdital('disc_2')).toBe(false);
    expect(editalFilter.eventBelongsToSelectedEdital({ discId: 'disc_1' })).toBe(true);
    expect(editalFilter.eventBelongsToSelectedEdital({ discId: 'disc_2' })).toBe(false);
  });

  it('getEditalFilterLabel returns the principal name', () => {
    expect(editalFilter.getEditalFilterLabel()).toBe('Principal');
  });

  it('withEditalScope temporarily scopes to a given (e.g. archived) edital and restores after', () => {
    const inside = editalFilter.withEditalScope('ed_2', () => editalFilter.getSelectedEditalId());
    expect(inside).toBe('ed_2');
    // restored to principal after the callback
    expect(editalFilter.getSelectedEditalId()).toBe('ed_1');

    const belongs = editalFilter.withEditalScope('ed_2', () =>
      editalFilter.eventBelongsToSelectedEdital({ discId: 'disc_2' })
    );
    expect(belongs).toBe(true);

    const scopedEvents = editalFilter.withEditalScope('ed_2', () =>
      editalFilter.filterEventsBySelectedEdital([
        { id: 'a', discId: 'disc_1' },
        { id: 'b', discId: 'disc_2' },
      ])
    );
    expect(scopedEvents.map((e) => e.id)).toEqual(['b']);
  });

  it('filters events by the principal edital by default', () => {
    expect(
      editalFilter
        .filterEventsBySelectedEdital([
          { id: 'a', discId: 'disc_1' },
          { id: 'b', discId: 'disc_2' },
        ])
        .map((event) => event.id)
    ).toEqual(['a']);
  });

  it('falls back to the first edital when none is active (transient/edge state)', () => {
    storeModule.state.editais.forEach((e) => {
      e.arquivado = true;
    });
    expect(editalFilter.getSelectedEditalId()).toBe('ed_1');
  });
});
