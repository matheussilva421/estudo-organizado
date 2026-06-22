import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import { createBaseState, createEdital } from '../helpers/state-builders.js';

let store;
let views;

function createMockDOM() {
  const elements = {};
  const createElement = (id) => {
    const el = {
      id,
      dataset: {},
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) },
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
      value: '',
      style: {},
      children: [],
      offsetWidth: 0,
      lastElementChild: null,
      firstElementChild: null,
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      append: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      focus: vi.fn(),
      click: vi.fn(),
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
    createElement: vi.fn(() => createElement('_dyn')),
    createTextNode: vi.fn(() => ({})),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    activeElement: { blur: vi.fn() },
    body: { contains: vi.fn(() => true), style: {}, appendChild: vi.fn(), removeChild: vi.fn() },
    elements,
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-22T10:00:00Z'));

  global.document = createMockDOM();
  global.window = {
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn() })),
  };
  global.Notification = { permission: 'granted' };
  global.requestAnimationFrame = vi.fn();
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
  views = modules.views;
});

describe('saveEdital — create makes the new edital the principal', () => {
  it('a new edital becomes the only active, archiving the previous principal', () => {
    store.setState(
      createBaseState({ editais: [createEdital({ id: 'ed_old', nome: 'Antigo', arquivado: false })] })
    );
    global.document.getElementById('edital-nome').value = 'Novo Edital';
    global.document.getElementById('edital-cor').value = '#123456';

    views.saveEdital(null);

    const active = store.state.editais.filter((e) => !e.arquivado);
    expect(active).toHaveLength(1);
    expect(active[0].nome).toBe('Novo Edital');
    expect(active[0].arquivado).toBe(false);
    expect(active[0].arquivadoEm).toBe(null);

    const old = store.state.editais.find((e) => e.id === 'ed_old');
    expect(old.arquivado).toBe(true);
  });

  it('editing an existing edital does not change archive flags', () => {
    store.setState(
      createBaseState({
        editais: [
          createEdital({ id: 'ed_1', nome: 'A', arquivado: false }),
          createEdital({
            id: 'ed_2',
            nome: 'B',
            arquivado: true,
            arquivadoEm: '2026-01-01T00:00:00.000Z',
          }),
        ],
      })
    );
    global.document.getElementById('edital-nome').value = 'A renomeado';
    global.document.getElementById('edital-cor').value = '#abcdef';

    views.saveEdital('ed_1');

    expect(store.state.editais.find((e) => e.id === 'ed_1').nome).toBe('A renomeado');
    expect(store.state.editais.find((e) => e.id === 'ed_1').arquivado).toBe(false);
    expect(store.state.editais.find((e) => e.id === 'ed_2').arquivado).toBe(true);
  });
});

describe('reconcilePrincipalEdital', () => {
  it('does not prompt and keeps a single active when there is at most one active', () => {
    store.setState(
      createBaseState({ editais: [createEdital({ id: 'ed_1', arquivado: false })] })
    );
    expect(() => views.reconcilePrincipalEdital()).not.toThrow();
    expect(store.state.editais.filter((e) => !e.arquivado)).toHaveLength(1);
  });
});
