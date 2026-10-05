import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: { editais: [] },
  app: {
    openModal: vi.fn(),
    closeModal: vi.fn((modalId) => {
      document.getElementById(modalId)?.dispatchEvent(new Event('modal:beforeclose'));
    }),
    showToast: vi.fn(),
  },
  components: { renderCurrentView: vi.fn() },
  logic: { invalidateDiscCache: vi.fn(), invalidateDashCaches: vi.fn() },
  scheduleSave: vi.fn(),
  uid: vi.fn(),
}));

vi.mock('../../src/js/app.js?v=8.37', () => mocks.app);
vi.mock('../../src/js/components.js?v=8.37', () => mocks.components);
vi.mock('../../src/js/logic.js?v=8.37', () => mocks.logic);
vi.mock('../../src/js/store.js?v=8.37', () => ({
  state: mocks.state,
  scheduleSave: mocks.scheduleSave,
}));
vi.mock('../../src/js/utils.js?v=8.37', () => ({
  uid: (...args) => mocks.uid(...args),
  esc: (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]),
}));

const payload = (overrides = {}) => ({
  versao: 1,
  tipo: 'edital',
  nome: 'Concurso Exemplo',
  sourceRevision: 'rev-2026-10',
  centralId: 'central-100',
  disciplinas: [
    {
      nome: 'Direito Penal',
      topicos: [{ nome: 'Dolo' }, { nome: 'Culpa' }],
      aulas: [{ nome: 'Introdução' }],
    },
  ],
  ...overrides,
});

function activeEdital(id = 'ed_main', overrides = {}) {
  return {
    id,
    nome: 'Concurso Exemplo',
    cor: '#123456',
    arquivado: false,
    disciplinas: [
      {
        id: `${id}_disc`,
        nome: 'Direito Penal',
        icone: '⚖️',
        cor: '#123456',
        assuntos: [
          {
            id: `${id}_ass`,
            nome: 'Dolo',
            concluido: true,
            dataConclusao: '2026-09-20',
            revisoesFetas: ['2026-09-21'],
            adiamentos: 2,
            linkedAulaIds: [],
          },
        ],
        aulas: [
          {
            id: `${id}_aula`,
            nome: 'Introdução',
            estudada: true,
            dataEstudo: '2026-09-22',
            progress: 75,
            linkedAssuntoIds: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function mountPrompt() {
  document.body.innerHTML = `
    <div id="modal-prompt">
      <h2 id="modal-prompt-title"></h2>
      <div id="modal-prompt-body"></div>
      <button id="modal-prompt-save">Salvar</button>
      <button data-action="close-modal" data-modal="modal-prompt">Cancelar</button>
    </div>
  `;
}

function dispatchChange(selector, update) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Controle não encontrado: ${selector}`);
  update(element);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function selectJsonFile(contents) {
  const input = document.querySelector('input[type="file"]');
  const file = new window.File([contents], 'edital.json', { type: 'application/json' });
  Object.defineProperty(file, 'importText', { value: contents });
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await Promise.resolve();
}

let view;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const key of Object.keys(mocks.state)) delete mocks.state[key];
  Object.assign(mocks.state, {
    editais: [],
    eventos: [{ id: 'ev_1', status: 'estudei' }],
    habitos: { revisao: [{ id: 'hab_1' }] },
    revisoes: [{ id: 'rev_1' }],
    config: { tema: 'dark' },
    planejamento: { ativo: true, sequencia: [{ id: 'seq_1' }] },
  });
  mocks.uid.mockImplementation(() => `generated-${mocks.uid.mock.calls.length}`);
  mountPrompt();
  vi.stubGlobal(
    'FileReader',
    class {
      readAsText(file) {
        this.onload?.({ target: { result: file.importText } });
        this.onloadend?.();
      }
    }
  );
  view = await import('../../src/js/views/edital-import.js?v=8.37');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('importação de edital — arquivo e preview', () => {
  it('abre um seletor local que aceita arquivos JSON', () => {
    const click = vi.spyOn(window.HTMLInputElement.prototype, 'click').mockImplementation(() => {});

    view.openEditalImport();

    const input = document.querySelector('input[type="file"]');
    expect(input.accept).toBe('.json');
    expect(click).toHaveBeenCalledOnce();
  });

  it('JSON malformado mostra erro sem abrir preview nem mutar estado', async () => {
    const before = structuredClone(mocks.state);
    view.openEditalImport();

    await selectJsonFile('{ invalid');

    expect(mocks.app.showToast).toHaveBeenCalledWith(expect.stringMatching(/JSON/i), 'error');
    expect(mocks.app.openModal).not.toHaveBeenCalled();
    expect(view.getEditalImportDraft()).toBeNull();
    expect(mocks.state).toEqual(before);
  });

  it('schema inválido mostra o primeiro caminho de erro e não muta estado', () => {
    const before = structuredClone(mocks.state);

    expect(view.openEditalImportPreview({ tipo: 'edital', versao: 2 })).toBe(false);

    expect(mocks.app.showToast).toHaveBeenCalledWith(
      expect.stringContaining('versao: deve ser 1.'),
      'error'
    );
    expect(mocks.app.openModal).not.toHaveBeenCalled();
    expect(view.getEditalImportDraft()).toBeNull();
    expect(mocks.state).toEqual(before);
  });

  it('payload válido abre preview com proveniência arquivada apenas informativa', () => {
    const active = activeEdital();
    const archived = activeEdital('ed_old', {
      nome: 'Concurso Arquivado',
      arquivado: true,
      importMetadata: { tipo: 'edital', centralId: 'central-100' },
    });
    mocks.state.editais = [active, archived];

    expect(view.openEditalImportPreview(payload())).toBe(true);

    const draft = view.getEditalImportDraft();
    expect(draft.importPlan).not.toBeNull();
    expect(draft.destinationConfirmed).toBe(false);
    expect(mocks.app.openModal).toHaveBeenCalledWith('modal-prompt');
    expect(document.getElementById('modal-prompt-title').textContent).toContain('Importar Edital');
    expect(document.getElementById('modal-prompt-body').textContent).toContain('rev-2026-10');
    expect(document.getElementById('modal-prompt-body').textContent).toContain('Concurso Arquivado');
    expect(document.querySelector(`[data-import-target] option[value="${archived.id}"]`)).toBeNull();
    expect(document.querySelector('[data-import-archived-candidate]')).not.toBeNull();
    expect(document.getElementById('modal-prompt-save').disabled).toBe(true);
    expect(mocks.state.editais).toEqual([active, archived]);
  });

  it('mostra revisões anterior e atual quando reconhece proveniência compatível', () => {
    mocks.state.editais = [
      activeEdital('ed_previous', {
        importMetadata: {
          tipo: 'edital',
          centralId: 'central-100',
          sourceRevision: 'rev-2026-09',
        },
      }),
    ];

    view.openEditalImportPreview(payload({ sourceRevision: 'rev-2026-10' }));

    expect(document.getElementById('modal-prompt-body').textContent).toContain('Anterior: rev-2026-09');
    expect(document.getElementById('modal-prompt-body').textContent).toContain('Atual: rev-2026-10');
  });

  it('preview sinaliza que um item de conflito já foi importado no mesmo destino', () => {
    const seed = activeEdital('ed_main', {
      disciplinas: [
        { id: 'disc_known_1', nome: 'Direito Penal', assuntos: [], aulas: [] },
        { id: 'disc_known_2', nome: ' direito penal ', assuntos: [], aulas: [] },
      ],
    });
    const source = payload({ disciplinas: [{ nome: 'Direito Penal', topicos: [], aulas: [] }] });
    mocks.state.editais = [seed];

    view.openEditalImportPreview(source);
    expect(view.setEditalImportDestination({ mode: 'merge', editalId: seed.id })).toBe(true);
    expect(document.getElementById('modal-prompt-body').textContent).toContain('Conflito: criar novo');
    expect(view.confirmEditalImport()).toBe(true);
    expect(mocks.state.editais[0].disciplinas).toHaveLength(3);

    view.openEditalImportPreview(source);
    expect(view.setEditalImportDestination({ mode: 'merge', editalId: seed.id })).toBe(true);

    expect(document.getElementById('modal-prompt-body').textContent).toContain('Conflito já importado');
    expect(document.getElementById('modal-prompt-body').textContent).not.toContain('Conflito: criar novo');
  });

  it('descarta o draft ao fechar o preview pelo controlador real do modal', async () => {
    view.openEditalImportPreview(payload());
    expect(view.getEditalImportDraft()).not.toBeNull();

    const { closeModal, openModal } = await import('../../src/js/ui/dialog.js');
    openModal('modal-prompt');
    closeModal('modal-prompt');

    expect(view.getEditalImportDraft()).toBeNull();
    expect(document.getElementById('modal-prompt-save').textContent).toBe('Salvar');
  });

  it('limpa o preview e restaura o botão quando o ciclo real do modal fecha', async () => {
    view.openEditalImportPreview(payload());
    expect(view.setEditalImportDestination({ mode: 'create' })).toBe(true);

    const saveButton = document.getElementById('modal-prompt-save');
    expect(saveButton.textContent).toBe('Confirmar importação');
    expect(saveButton.disabled).toBe(false);
    expect(saveButton.onclick).toBe(view.confirmEditalImport);

    const { closeModal, openModal } = await import('../../src/js/ui/dialog.js');
    openModal('modal-prompt');
    closeModal('modal-prompt');

    expect(view.getEditalImportDraft()).toBeNull();
    expect(saveButton.textContent).toBe('Salvar');
    expect(saveButton.className).toBe('btn btn-primary');
    expect(saveButton.disabled).toBe(false);
    expect(saveButton.onclick).toBeNull();

    saveButton.textContent = 'Excluir dados';
    saveButton.className = 'btn btn-danger';
    saveButton.disabled = true;
    const otherPromptAction = vi.fn();
    saveButton.onclick = otherPromptAction;
    openModal('modal-prompt');
    closeModal('modal-prompt');

    expect(saveButton.textContent).toBe('Excluir dados');
    expect(saveButton.className).toBe('btn btn-danger');
    expect(saveButton.disabled).toBe(true);
    expect(saveButton.onclick).toBe(otherPromptAction);
  });
});

describe('importação de edital — destino e confirmação', () => {
  it('um candidato ativo pode ser escolhido para merge, sem confirmar silenciosamente', () => {
    const target = activeEdital();
    mocks.state.editais = [target];
    view.openEditalImportPreview(payload());

    expect(view.getEditalImportDraft().destinationConfirmed).toBe(false);
    expect(document.getElementById('modal-prompt-save').disabled).toBe(true);
    dispatchChange('[data-import-mode="merge"]', (radio) => {
      radio.checked = true;
    });

    expect(view.getEditalImportDraft().destination).toEqual({
      mode: 'merge',
      editalId: target.id,
      makePrincipal: false,
    });
    expect(document.getElementById('modal-prompt-save').disabled).toBe(false);
    expect(document.querySelector('[data-import-summary]').textContent).toContain('1 reutilizada');
    expect(document.querySelector('[data-import-mode="create"]')).not.toBeNull();
  });

  it('com vários candidatos ativos não escolhe destino e permite merge somente após seleção', () => {
    const first = activeEdital('ed_first');
    const second = activeEdital('ed_second', {
      nome: 'Outro concurso',
      importMetadata: { tipo: 'edital', centralId: 'central-100' },
    });
    mocks.state.editais = [first, second];
    view.openEditalImportPreview(payload());

    expect(view.getEditalImportDraft().destination).toBeNull();
    expect(view.getEditalImportDraft().importPlan).toBeNull();
    expect(document.getElementById('modal-prompt-save').disabled).toBe(true);
    expect(document.querySelectorAll('[data-import-target] option')).toHaveLength(3);

    dispatchChange('[data-import-mode="merge"]', (radio) => {
      radio.checked = true;
    });
    dispatchChange('[data-import-target]', (select) => {
      select.value = second.id;
    });

    expect(view.getEditalImportDraft().destination).toMatchObject({ mode: 'merge', editalId: second.id });
    expect(view.getEditalImportDraft().importPlan.edital.existingId).toBe(second.id);
  });

  it('permite escolher qualquer edital ativo, mesmo sem sugestão por nome ou proveniência', () => {
    const unrelated = activeEdital('ed_unrelated', { nome: 'Outro edital' });
    mocks.state.editais = [unrelated];
    view.openEditalImportPreview(payload());

    expect(view.getEditalImportDraft().candidates.active).toHaveLength(0);
    expect(document.querySelector('[data-import-target] option[value="ed_unrelated"]')).not.toBeNull();
    dispatchChange('[data-import-mode="merge"]', (radio) => {
      radio.checked = true;
    });
    dispatchChange('[data-import-target]', (select) => {
      select.value = unrelated.id;
    });

    expect(view.getEditalImportDraft().destination).toMatchObject({
      mode: 'merge',
      editalId: 'ed_unrelated',
    });
    expect(view.getEditalImportDraft().importPlan.summary.disciplinasReutilizadas).toBe(1);
  });

  it('alternar merge para create recalcula o plano e mostra o checkbox de principal', () => {
    const target = activeEdital();
    mocks.state.editais = [target];
    const stateBeforePreview = structuredClone(mocks.state.editais);
    view.openEditalImportPreview(payload());
    dispatchChange('[data-import-mode="merge"]', (radio) => {
      radio.checked = true;
    });
    expect(document.querySelector('[data-import-summary]').textContent).toContain('1 reutilizada');

    dispatchChange('[data-import-mode="create"]', (radio) => {
      radio.checked = true;
    });

    expect(view.getEditalImportDraft().destination).toMatchObject({ mode: 'create', makePrincipal: false });
    expect(view.getEditalImportDraft().importPlan.summary.disciplinasReutilizadas).toBe(0);
    expect(document.querySelector('[data-import-summary]').textContent).toContain('0 reutilizadas');
    expect(document.querySelector('[data-import-make-principal]').checked).toBe(false);
    expect(document.querySelector('[data-import-principal-warning]').textContent).toContain('arquivado');

    dispatchChange('[data-import-make-principal]', (checkbox) => {
      checkbox.checked = true;
    });
    expect(view.getEditalImportDraft().destination.makePrincipal).toBe(true);
    expect(document.querySelector('[data-import-principal-warning]').textContent).toContain(
      'editais ativos atuais serão arquivados'
    );
    expect(mocks.state.editais).toEqual(stateBeforePreview);
    expect(mocks.scheduleSave).not.toHaveBeenCalled();
  });

  it('mostra badge de conflito quando o matching cria nova disciplina ambígua', () => {
    const target = activeEdital();
    const duplicate = structuredClone(target.disciplinas[0]);
    duplicate.id = 'disc_duplicate';
    mocks.state.editais = [
      { ...target, disciplinas: [...target.disciplinas, duplicate] },
    ];
    view.openEditalImportPreview(payload());
    dispatchChange('[data-import-mode="merge"]', (radio) => {
      radio.checked = true;
    });

    expect(view.getEditalImportDraft().importPlan.summary.disciplinasConflitantes).toBe(1);
    expect(document.querySelector('.edital-import-badge--conflict').textContent).toContain('Conflito');
    expect(document.querySelector('[data-import-summary]').textContent).toContain('1 conflito');
  });

  it('sem edital ativo força o novo edital como principal e desabilita a opção', () => {
    mocks.state.editais = [activeEdital('ed_archived', { arquivado: true })];
    view.openEditalImportPreview(payload());
    dispatchChange('[data-import-mode="create"]', (radio) => {
      radio.checked = true;
    });

    const checkbox = document.querySelector('[data-import-make-principal]');
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
    expect(view.getEditalImportDraft().destination).toMatchObject({ mode: 'create', makePrincipal: true });
    expect(view.getEditalImportDraft().importPlan.principalForced).toBe(true);
    expect(document.querySelector('[data-import-principal-warning]').textContent).toContain('será o edital principal');
  });

  it('confirma o plano exibido e substitui somente editais, com persistência e render após sucesso', () => {
    const target = activeEdital();
    mocks.state.editais = [target];
    const untouched = {
      eventos: structuredClone(mocks.state.eventos),
      habitos: structuredClone(mocks.state.habitos),
      revisoes: structuredClone(mocks.state.revisoes),
      config: structuredClone(mocks.state.config),
      planejamento: structuredClone(mocks.state.planejamento),
    };
    const previousEditais = mocks.state.editais;
    view.openEditalImportPreview(payload());
    dispatchChange('[data-import-mode="merge"]', (radio) => {
      radio.checked = true;
    });

    expect(view.confirmEditalImport()).toBe(true);

    expect(mocks.state.editais).not.toBe(previousEditais);
    expect(mocks.state.editais[0].disciplinas[0].assuntos[0].concluido).toBe(true);
    expect(mocks.state.editais[0].disciplinas[0].aulas[0].progress).toBe(75);
    expect(mocks.state.eventos).toEqual(untouched.eventos);
    expect(mocks.state.habitos).toEqual(untouched.habitos);
    expect(mocks.state.revisoes).toEqual(untouched.revisoes);
    expect(mocks.state.config).toEqual(untouched.config);
    expect(mocks.state.planejamento).toEqual(untouched.planejamento);
    expect(mocks.logic.invalidateDiscCache).toHaveBeenCalledOnce();
    expect(mocks.logic.invalidateDashCaches).toHaveBeenCalledOnce();
    expect(mocks.scheduleSave).toHaveBeenCalledOnce();
    expect(mocks.app.closeModal).toHaveBeenCalledWith('modal-prompt');
    expect(mocks.components.renderCurrentView).toHaveBeenCalledOnce();
    expect(mocks.app.showToast).toHaveBeenCalledWith(expect.stringMatching(/mesclad/i), 'success');
    expect(view.getEditalImportDraft()).toBeNull();
  });

  it('aborta preview stale sem substituir estado, salvar ou invalidar cache', () => {
    const target = activeEdital();
    mocks.state.editais = [target];
    view.openEditalImportPreview(payload());
    dispatchChange('[data-import-mode="merge"]', (radio) => {
      radio.checked = true;
    });
    target.disciplinas[0].nome = 'Alteração externa';
    const before = mocks.state.editais;

    expect(view.confirmEditalImport()).toBe(false);

    expect(mocks.state.editais).toBe(before);
    expect(mocks.scheduleSave).not.toHaveBeenCalled();
    expect(mocks.logic.invalidateDiscCache).not.toHaveBeenCalled();
    expect(mocks.app.closeModal).not.toHaveBeenCalled();
    expect(mocks.app.showToast).toHaveBeenCalledWith(expect.stringMatching(/desatualizad|novo preview/i), 'error');
  });

  it('erro de apply deixa o estado original intacto e não agenda salvamento', () => {
    const target = activeEdital();
    mocks.state.editais = [target];
    view.openEditalImportPreview(payload());
    dispatchChange('[data-import-mode="merge"]', (radio) => {
      radio.checked = true;
    });
    const before = mocks.state.editais;
    mocks.uid.mockImplementation(() => {
      throw new Error('falha de UID');
    });

    expect(view.confirmEditalImport()).toBe(false);

    expect(mocks.state.editais).toBe(before);
    expect(mocks.scheduleSave).not.toHaveBeenCalled();
    expect(mocks.app.closeModal).not.toHaveBeenCalled();
    expect(mocks.app.showToast).toHaveBeenCalledWith(expect.stringContaining('falha de UID'), 'error');
  });

  it('diferencia o toast de criação e deixa o novo edital arquivado por padrão', () => {
    const target = activeEdital();
    mocks.state.editais = [target];
    view.openEditalImportPreview(payload());
    dispatchChange('[data-import-mode="create"]', (radio) => {
      radio.checked = true;
    });

    expect(document.querySelector('[data-import-make-principal]').checked).toBe(false);
    expect(view.confirmEditalImport()).toBe(true);

    const created = mocks.state.editais.at(-1);
    expect(created.arquivado).toBe(true);
    expect(created.arquivadoEm).toBeTruthy();
    expect(mocks.state.editais[0]).toBe(target);
    expect(mocks.app.showToast).toHaveBeenCalledWith(expect.stringMatching(/criado/i), 'success');
  });
});
