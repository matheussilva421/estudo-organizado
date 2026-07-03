import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock de app.js
vi.mock('../../src/js/app.js?v=8.37', () => ({
  showToast: vi.fn(),
  showConfirm: vi.fn((msg, cb) => cb()),
  openModal: vi.fn(),
  closeModal: vi.fn()
}));

// Mock de logic.js
vi.mock('../../src/js/logic.js?v=8.37', () => ({
  generatePlanejamento: vi.fn(),
  getActiveDisciplinas: vi.fn().mockReturnValue([
    { disc: { id: 'disc_1', nome: 'Matemática' }, edital: { cor: '#0f766e' } },
    { disc: { id: 'disc_2', nome: 'Português' }, edital: { cor: '#1d4ed8' } }
  ])
}));

// Mock de store.js
vi.mock('../../src/js/store.js?v=8.37', () => {
  const baseState = {
    schemaVersion: 7,
    editais: [],
    eventos: [],
    config: { visualizacao: 'mes' },
    habitos: { videoaula: [] },
    planejamento: {
      ativo: false,
      tipo: null,
      disciplinas: [],
      relevancia: {},
      horarios: {},
      sequencia: [],
      ciclosCompletos: 0,
      dataInicioCicloAtual: null
    }
  };

  return {
    state: baseState,
    scheduleSave: vi.fn()
  };
});

let wizard;
let logic;
let app;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  document.body.innerHTML = `
    <div id="modal-planejamento"></div>
    <div id="modal-planejamento-body"></div>
    <div id="pw-step-1"></div>
    <div id="pw-step-2"></div>
    <div id="pw-step-3"></div>
    <div id="pw-step-4"></div>
    <button id="pw-btn-voltar"></button>
    <button id="pw-btn-proximo"></button>
    <button id="pw-btn-concluir"></button>
  `;

  logic = await import('../../src/js/logic.js?v=8.37');
  app = await import('../../src/js/app.js?v=8.37');
  wizard = await import('../../src/js/planejamento-wizard.js?v=8.37');
});

describe('planejamento-wizard.js', () => {
  describe('openPlanejamentoWizard()', () => {
    it('abre o modal do wizard', () => {
      wizard.openPlanejamentoWizard();
      expect(app.openModal).toHaveBeenCalledWith('modal-planejamento');
    });

    it('exibe step 1 ao abrir', () => {
      wizard.openPlanejamentoWizard();
      const body = document.getElementById('modal-planejamento-body');
      expect(body.innerHTML).toContain('Qual é a sua estratégia de estudo?');
    });

    it('exibe botão voltar oculto no step 1', () => {
      wizard.openPlanejamentoWizard();
      const btnBack = document.getElementById('pw-btn-voltar');
      expect(btnBack.style.visibility).toBe('hidden');
    });
  });

  describe('pwSelectTipo()', () => {
    it('seleciona tipo ciclo e atualiza UI', () => {
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      const body = document.getElementById('modal-planejamento-body');
      expect(body.innerHTML).toContain('is-selected');
    });

    it('habilita botão próximo após selecionar tipo', () => {
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      const btnNext = document.getElementById('pw-btn-proximo');
      expect(btnNext.disabled).toBe(false);
    });
  });

  describe('pwToggleDisc()', () => {
    it('adiciona disciplina à seleção', () => {
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      wizard.pwToggleDisc('disc_1');
      const body = document.getElementById('modal-planejamento-body');
      expect(body.innerHTML).toContain('is-selected');
    });

    it('atualiza contador de disciplinas', () => {
      document.body.innerHTML += '<div id="pw-disc-count"></div>';
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      wizard.pwToggleDisc('disc_1');
      wizard.pwToggleDisc('disc_2');
      const counter = document.getElementById('pw-disc-count');
      expect(counter.textContent).toBe('2 disciplinas selecionadas');
    });
  });

  describe('step 2 edital grouping', () => {
    it('agrupa disciplinas por edital no passo de selecao', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        {
          disc: { id: 'disc_1', nome: 'Direito Administrativo', icone: '📚' },
          edital: { id: 'ed_1', nome: 'TCE - RN', cor: '#0f766e' }
        },
        {
          disc: { id: 'disc_2', nome: 'Direito Civil', icone: '⚖️' },
          edital: { id: 'ed_2', nome: 'PGE-RN', cor: '#1d4ed8' }
        }
      ]);

      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      document.getElementById('pw-btn-proximo').click();

      const body = document.getElementById('modal-planejamento-body');
      expect(body.innerHTML).toContain('pw-edital-group');
      expect(body.innerHTML).toContain('TCE - RN');
      expect(body.innerHTML).toContain('PGE-RN');
      expect(body.innerHTML).toContain('data-action="pw-select-edital-disc"');
      expect(body.innerHTML).toContain('data-edital-id="ed_1"');
      expect(body.innerHTML).toContain('data-edital-id="ed_2"');
    });

    it('seleciona e limpa disciplinas por edital', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'disc_1', nome: 'Administrativo' }, edital: { id: 'ed_1', nome: 'TCE - RN' } },
        { disc: { id: 'disc_2', nome: 'Constitucional' }, edital: { id: 'ed_1', nome: 'TCE - RN' } },
        { disc: { id: 'disc_3', nome: 'Civil' }, edital: { id: 'ed_2', nome: 'PGE-RN' } }
      ]);

      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      document.getElementById('pw-btn-proximo').click();

      wizard.pwSelectEditalDisc('ed_1');
      let cards = document.querySelectorAll('.pw-disc-card.is-selected');
      expect(cards).toHaveLength(2);
      expect(document.getElementById('pw-disc-count').textContent).toBe('2 disciplinas selecionadas');

      wizard.pwClearEditalDisc('ed_1');
      cards = document.querySelectorAll('.pw-disc-card.is-selected');
      expect(cards).toHaveLength(0);
      expect(document.getElementById('pw-disc-count').textContent).toBe('0 disciplinas selecionadas');
    });
  });

  describe('pwUpdateRel()', () => {
    it('atualiza label de importância', () => {
      document.body.innerHTML += '<div id="pw-lbl-importancia-disc_1">3</div>';
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      wizard.pwToggleDisc('disc_1');
      wizard.pwUpdateRel('disc_1', 'importancia', '5');
      const lbl = document.getElementById('pw-lbl-importancia-disc_1');
      expect(lbl.textContent).toBe('5');
    });
  });

  describe('pwRenderWeightPreview()', () => {
    it('calcula peso baseado em importância e conhecimento', () => {
      // Ensure mock returns data
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'disc_1', nome: 'Matemática' }, edital: { cor: '#0f766e' } }
      ]);
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      wizard.pwToggleDisc('disc_1');
      wizard.pwUpdateRel('disc_1', 'importancia', '5');
      wizard.pwUpdateRel('disc_1', 'conhecimento', '1');
      document.body.innerHTML += '<div id="pw-weight-preview"></div>';
      wizard.pwRenderWeightPreview();
      const preview = document.getElementById('pw-weight-preview');
      expect(preview.innerHTML).toContain('Matemática');
      expect(preview.innerHTML).toContain('100.0%');
    });

    it('retorna cedo quando elemento não existe', () => {
      document.body.innerHTML = '';
      expect(() => { wizard.pwRenderWeightPreview(); }).not.toThrow();
    });
  });

  describe('pwSearchDisc()', () => {
    it('filtra disciplinas por texto', () => {
      document.body.innerHTML += `
        <div class="pw-disc-card">Matemática</div>
        <div class="pw-disc-card">Português</div>
      `;
      wizard.pwSearchDisc('mat');
      const cards = document.querySelectorAll('.pw-disc-card');
      expect(cards[0].style.display).toBe('flex');
      expect(cards[1].style.display).toBe('none');
    });
  });

  describe('wizard navigation', () => {
    it('desabilita botão próximo sem tipo selecionado', () => {
      wizard.openPlanejamentoWizard();
      const btnNext = document.getElementById('pw-btn-proximo');
      expect(btnNext.disabled).toBe(true);
    });

    it('exibe botão concluir no step 4', () => {
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      wizard.pwToggleDisc('disc_1');
      document.getElementById('pw-btn-proximo').click();
      document.getElementById('pw-btn-proximo').click();
      document.getElementById('pw-btn-proximo').click();
      const btnDone = document.getElementById('pw-btn-concluir');
      const btnNext = document.getElementById('pw-btn-proximo');
      expect(btnDone.style.display).toBe('block');
      expect(btnNext.style.display).toBe('none');
    });
  });

  describe('wizard completion', () => {
    it('gera planejamento ao concluir', () => {
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      wizard.pwToggleDisc('disc_1');
      document.getElementById('pw-btn-proximo').click();
      document.getElementById('pw-btn-proximo').click();
      document.getElementById('pw-btn-proximo').click();
      wizard.pwUpdateHours('horasSemanais', '30');
      const btnDone = document.getElementById('pw-btn-concluir');
      btnDone.click();
      expect(logic.generatePlanejamento).toHaveBeenCalled();
      expect(app.closeModal).toHaveBeenCalledWith('modal-planejamento');
    });

    it('limita materiasPorDia ao intervalo 1-15 do campo', () => {
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      wizard.pwToggleDisc('disc_1');
      document.getElementById('pw-btn-proximo').click();
      document.getElementById('pw-btn-proximo').click();
      document.getElementById('pw-btn-proximo').click();
      wizard.pwUpdateHours('horasSemanais', '30');

      wizard.pwUpdateHours('materiasPorDia', '200');
      document.getElementById('pw-btn-concluir').click();
      expect(logic.generatePlanejamento).toHaveBeenLastCalledWith(
        expect.objectContaining({ materiasPorDia: 15 })
      );

      wizard.pwUpdateHours('materiasPorDia', '0');
      document.getElementById('pw-btn-concluir').click();
      expect(logic.generatePlanejamento).toHaveBeenLastCalledWith(
        expect.objectContaining({ materiasPorDia: 1 })
      );
    });
  });

  describe('step 2 empty state', () => {
    it('exibe mensagem quando sem disciplinas', () => {
      logic.getActiveDisciplinas.mockReturnValue([]);
      wizard.openPlanejamentoWizard();
      wizard.pwSelectTipo('ciclo');
      document.getElementById('pw-btn-proximo').click();
      const body = document.getElementById('modal-planejamento-body');
      expect(body.innerHTML).toContain('Nenhuma disciplina encontrada');
    });
  });

  describe('module exports', () => {
    it('exporta funções do módulo', () => {
      expect(wizard.pwSelectTipo).toBeDefined();
      expect(wizard.pwToggleDisc).toBeDefined();
      expect(wizard.pwSearchDisc).toBeDefined();
      expect(wizard.pwSelectAllDisc).toBeDefined();
      expect(wizard.pwClearDisc).toBeDefined();
      expect(wizard.pwSelectEditalDisc).toBeDefined();
      expect(wizard.pwClearEditalDisc).toBeDefined();
      expect(wizard.pwUpdateRel).toBeDefined();
      expect(wizard.pwToggleDay).toBeDefined();
      expect(wizard.pwUpdateHours).toBeDefined();
      expect(wizard.pwUpdateDayHour).toBeDefined();
      expect(wizard.pwRenderWeightPreview).toBeDefined();
    });
  });
});
