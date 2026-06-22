import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('editais-anteriores-view.js', () => {
  let view;
  let archived;
  let uiState;
  let renderDashboardMock;
  let scopeCalledWith;

  beforeEach(async () => {
    vi.resetModules();
    archived = [];
    uiState = {};
    renderDashboardMock = vi.fn();
    scopeCalledWith = [];

    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getArchivedEditais: () => archived,
    }));
    vi.doMock('../../src/js/edital-filter.js?v=8.37', () => ({
      withEditalScope: (id, fn) => {
        scopeCalledWith.push(id);
        return fn();
      },
    }));
    vi.doMock('../../src/js/views/dashboard-view.js', () => ({
      renderDashboard: renderDashboardMock,
    }));
    vi.doMock('../../src/js/ui-state.js?v=8.37', () => ({
      getUiSection: () => uiState,
      setUiSection: (section, patch) => {
        Object.assign(uiState, patch);
        return uiState;
      },
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({ esc: (s) => String(s) }));
    vi.doMock('../../src/js/components.js?v=8.37', () => ({ renderCurrentView: vi.fn() }));

    view = await import('../../src/js/views/editais-anteriores-view.js?v=8.37');
  });

  it('shows an empty state when there are no archived editais', () => {
    const el = { innerHTML: '' };
    view.renderEditaisAnteriores(el);
    expect(el.innerHTML).toContain('Nenhum edital anterior');
    expect(renderDashboardMock).not.toHaveBeenCalled();
  });

  it('renders one tab per archived edital and renders the dashboard scoped to the active one', () => {
    archived = [
      { id: 'ed_1', nome: 'TJ-SP' },
      { id: 'ed_2', nome: 'PRF' },
    ];
    const host = { innerHTML: '' };
    global.document = { getElementById: vi.fn(() => host) };

    const el = { innerHTML: '' };
    view.renderEditaisAnteriores(el);

    expect(el.innerHTML).toContain('TJ-SP');
    expect(el.innerHTML).toContain('PRF');
    expect(el.innerHTML).toContain('data-action="set-anterior-tab"');
    // default active tab = first archived edital
    expect(scopeCalledWith).toEqual(['ed_1']);
    expect(renderDashboardMock).toHaveBeenCalledWith(host);
  });

  it('uses the stored active tab when it is still valid', () => {
    archived = [
      { id: 'ed_1', nome: 'TJ-SP' },
      { id: 'ed_2', nome: 'PRF' },
    ];
    uiState.activeTab = 'ed_2';
    global.document = { getElementById: vi.fn(() => ({ innerHTML: '' })) };

    view.renderEditaisAnteriores({ innerHTML: '' });
    expect(scopeCalledWith).toEqual(['ed_2']);
  });

  it('falls back to the first archived tab when the stored tab is stale', () => {
    archived = [{ id: 'ed_1', nome: 'TJ-SP' }];
    uiState.activeTab = 'ed_gone';
    global.document = { getElementById: vi.fn(() => ({ innerHTML: '' })) };

    view.renderEditaisAnteriores({ innerHTML: '' });
    expect(scopeCalledWith).toEqual(['ed_1']);
  });

  it('setAnteriorTab persists the chosen tab', () => {
    view.setAnteriorTab('ed_2');
    expect(uiState.activeTab).toBe('ed_2');
  });
});
