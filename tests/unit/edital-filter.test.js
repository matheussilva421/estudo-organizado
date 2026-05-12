import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('edital-filter.js', () => {
  let storeModule;
  let uiState;
  let editalFilter;

  beforeEach(async () => {
    vi.resetModules();
    uiState = {};
    storeModule = {
      state: {
        editais: [
          { id: 'ed_1', nome: 'Edital A', disciplinas: [{ id: 'disc_1' }] },
          { id: 'ed_2', nome: 'Edital B', disciplinas: [{ id: 'disc_2' }] },
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

  it('resolves the edital that owns a discipline id', () => {
    expect(editalFilter.getEditalForDiscId('disc_2')).toMatchObject({ id: 'ed_2' });
  });

  it('returns all editais when the selected filter is Todos', () => {
    editalFilter.setSelectedEditalId(null);
    expect(editalFilter.getSelectedEditalId({ allowAll: true })).toBeNull();
    expect(editalFilter.getFilteredEditais({ allowAll: true }).map((edital) => edital.id)).toEqual([
      'ed_1',
      'ed_2',
    ]);
  });

  it('uses the last selected edital when Todos is not allowed', () => {
    editalFilter.setSelectedEditalId('ed_2');
    editalFilter.setSelectedEditalId(null);
    expect(editalFilter.getSelectedEditalId({ allowAll: false })).toBe('ed_2');
    expect(editalFilter.getFilteredEditais({ allowAll: false }).map((edital) => edital.id)).toEqual([
      'ed_2',
    ]);
  });

  it('checks whether events and disciplines belong to the selected edital', () => {
    editalFilter.setSelectedEditalId('ed_1');
    expect(editalFilter.disciplineBelongsToSelectedEdital('disc_1')).toBe(true);
    expect(editalFilter.disciplineBelongsToSelectedEdital('disc_2')).toBe(false);
    expect(editalFilter.eventBelongsToSelectedEdital({ discId: 'disc_1' })).toBe(true);
    expect(editalFilter.eventBelongsToSelectedEdital({ discId: 'disc_2' })).toBe(false);
  });

  it('filters active disciplines and events by the selected edital', () => {
    editalFilter.setSelectedEditalId('ed_2');
    expect(editalFilter.getFilteredActiveDisciplinas().map(({ disc }) => disc.id)).toEqual([
      'disc_2',
    ]);
    expect(
      editalFilter
        .filterEventsBySelectedEdital([{ id: 'a', discId: 'disc_1' }, { id: 'b', discId: 'disc_2' }])
        .map((event) => event.id)
    ).toEqual(['b']);
  });
});
