import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import {
  createBaseState,
  createEdital,
  createDisciplina,
  createEvento,
} from '../helpers/state-builders.js';

let store;
let logic;
let views;
let app;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  const modules = await loadAppModules();
  store = modules.store;
  logic = modules.logic;
  views = modules.views;
  app = modules.app;

  store.setState(createBaseState());
  logic.invalidateDiscCache();
  logic.invalidateDashCaches();
});

describe('editais-view.js', () => {
  describe('renderEditalTree()', () => {
    it('renderiza árvore de edital com disciplinas', () => {
      const edital = createEdital({
        id: 'ed_1',
        nome: 'Concurso TRF',
        disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Constitucional' })],
      });

      const html = views.renderEditalTree(edital);

      expect(html).toContain('Concurso TRF');
      expect(html).toContain('Direito Constitucional');
    });

    it('inclui cor do edital no header', () => {
      const edital = createEdital({
        id: 'ed_1',
        nome: 'Concurso TRF',
        cor: '#10b981',
      });

      const html = views.renderEditalTree(edital);

      expect(html).toContain('#10b981');
    });

    it('inclui atributos data-action', () => {
      const edital = createEdital({
        id: 'ed_1',
        nome: 'Concurso TRF',
      });

      const html = views.renderEditalTree(edital);

      expect(html).toContain('data-action="toggle-edital"');
      expect(html).toContain('data-edital-id="ed_1"');
    });

    it('card de disciplina é acionável por teclado', () => {
      const edital = createEdital({
        id: 'ed_1',
        nome: 'Concurso TRF',
        disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Constitucional' })],
      });

      const html = views.renderEditalTree(edital);
      const cardTag = html.match(/<div class="disc-card[^>]*>/)[0];

      expect(cardTag).toContain('role="button"');
      expect(cardTag).toContain('tabindex="0"');
      expect(cardTag).toContain('aria-label=');
    });
  });

  describe('toggleEdital()', () => {
    it('existe e é função', () => {
      expect(views.toggleEdital).toBeDefined();
      expect(typeof views.toggleEdital).toBe('function');
    });

    it('header é acionável por teclado e expõe aria-expanded', () => {
      const edital = createEdital({ id: 'ed_1', nome: 'Concurso TRF' });
      const html = views.renderEditalTree(edital);
      expect(html).toMatch(/data-action="toggle-edital"[^>]*role="button"/);
      expect(html).toMatch(/data-action="toggle-edital"[^>]*tabindex="0"/);
      expect(html).toMatch(/data-action="toggle-edital"[^>]*aria-expanded="true"/);
    });

    it('sincroniza aria-expanded ao recolher/expandir', () => {
      const edital = createEdital({ id: 'ed_1', nome: 'Concurso TRF' });
      store.setState(createBaseState({ editais: [edital] }));
      document.body.innerHTML = views.renderEditalTree(edital);

      views.toggleEdital('ed_1');
      const header = document.querySelector('[data-action="toggle-edital"]');
      expect(header.getAttribute('aria-expanded')).toBe('false');

      views.toggleEdital('ed_1');
      expect(header.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('toggleAssunto()', () => {
    it('existe e é função', () => {
      expect(views.toggleAssunto).toBeDefined();
      expect(typeof views.toggleAssunto).toBe('function');
    });
  });
});

describe('dashboard-view.js', () => {
  describe('toggleAulaDashboard()', () => {
    it('é exportado apenas por editais-crud (sem cópia duplicada no dashboard-view)', async () => {
      const dashboardView = await import('../../src/js/views/dashboard-view.js');
      const editaisCrud = await import('../../src/js/views/editais-crud.js');
      expect(typeof editaisCrud.toggleAulaDashboard).toBe('function');
      // cópia antiga divergia da canônica (sem preservar scroll, sem return no loop)
      expect(dashboardView.toggleAulaDashboard).toBeUndefined();
      expect(dashboardView.default.toggleAulaDashboard).toBeUndefined();
    });
  });

  describe('renderDisciplinaDashboard()', () => {
    it('check-circle de assunto é toggle acionável por teclado (aria-pressed)', () => {
      const edital = createEdital({
        disciplinas: [
          createDisciplina({
            id: 'disc_1',
            nome: 'Direito',
            assuntos: [{ id: 'ass_1', nome: 'Teste', concluido: true }],
          }),
        ],
      });
      const disc = edital.disciplinas[0];

      const html = views.renderDisciplinaDashboard(edital, disc);
      const checkTag = html.match(/<div class="check-circle[^>]*data-action="toggle-assunto"[^>]*>/)[0];

      expect(checkTag).toContain('role="button"');
      expect(checkTag).toContain('tabindex="0"');
      expect(checkTag).toContain('aria-pressed="true"');
    });

    it('renderiza dashboard de disciplina com shell', () => {
      const edital = createEdital({
        disciplinas: [
          createDisciplina({
            id: 'disc_1',
            nome: 'Direito Constitucional',
            assuntos: [{ id: 'ass_1', nome: 'Teste', concluido: false }],
          }),
        ],
      });
      const disc = edital.disciplinas[0];

      const html = views.renderDisciplinaDashboard(edital, disc);

      expect(html).toContain('disc-dashboard-shell');
    });

    it('renderiza lista de assuntos', () => {
      const edital = createEdital({
        disciplinas: [
          createDisciplina({
            id: 'disc_1',
            assuntos: [
              { id: 'ass_1', nome: 'Assunto 1', concluido: false },
              { id: 'ass_2', nome: 'Assunto 2', concluido: true },
            ],
          }),
        ],
      });
      const disc = edital.disciplinas[0];

      const html = views.renderDisciplinaDashboard(edital, disc);

      expect(html).toContain('Assunto 1');
      expect(html).toContain('Assunto 2');
    });

    it('inclui data-actions para interação', () => {
      const edital = createEdital({
        disciplinas: [
          createDisciplina({
            id: 'disc_1',
            assuntos: [{ id: 'ass_1', nome: 'Teste' }],
          }),
        ],
      });
      const disc = edital.disciplinas[0];

      const html = views.renderDisciplinaDashboard(edital, disc);

      expect(html).toContain('data-action="toggle-assunto"');
    });
  });

  describe('toggleAssunto()', () => {
    it('marca assunto como concluído', () => {
      const state = createBaseState({
        editais: [
          createEdital({
            disciplinas: [
              createDisciplina({
                id: 'disc_1',
                assuntos: [{ id: 'ass_1', nome: 'Teste', concluido: false }],
              }),
            ],
          }),
        ],
      });
      store.setState(state);

      views.toggleAssunto('disc_1', 'ass_1');

      const disc = store.state.editais[0].disciplinas.find((d) => d.id === 'disc_1');
      expect(disc.assuntos[0].concluido).toBe(true);
    });

    it('preserva a rolagem da lista ao marcar assunto no dashboard', () => {
      document.body.innerHTML = `
        <div id="topbar-title"></div>
        <div id="topbar-actions"></div>
        <main id="main-content"></main>
      `;
      const state = createBaseState({
        editais: [
          createEdital({
            id: 'ed_1',
            disciplinas: [
              createDisciplina({
                id: 'disc_1',
                assuntos: Array.from({ length: 20 }, (_, index) => ({
                  id: `ass_${index + 1}`,
                  nome: `Assunto ${index + 1}`,
                  concluido: false,
                  dataConclusao: null,
                  revisoesFetas: [],
                })),
              }),
            ],
          }),
        ],
      });
      store.setState(state);

      views.openDiscDashboard('ed_1', 'disc_1');
      const panel = document.querySelector('[data-dashboard-scroll="topicos"]');
      panel.scrollTop = 128;

      views.toggleAssunto('disc_1', 'ass_18');

      expect(document.querySelector('[data-dashboard-scroll="topicos"]').scrollTop).toBe(128);
    });

    it('preserva a rolagem da lista ao marcar aula no dashboard', () => {
      document.body.innerHTML = `
        <div id="topbar-title"></div>
        <div id="topbar-actions"></div>
        <main id="main-content"></main>
      `;
      const state = createBaseState({
        editais: [
          createEdital({
            id: 'ed_1',
            disciplinas: [
              createDisciplina({
                id: 'disc_1',
                aulas: Array.from({ length: 20 }, (_, index) => ({
                  id: `aula_${index + 1}`,
                  nome: `Aula ${index + 1}`,
                  estudada: false,
                  dataEstudo: null,
                })),
              }),
            ],
          }),
        ],
      });
      store.setState(state);

      views.openDiscDashboard('ed_1', 'disc_1');
      views.switchDashboardTab('aulas');
      const panel = document.querySelector('[data-dashboard-scroll="aulas"]');
      panel.scrollTop = 96;

      views.toggleAulaDashboard('ed_1', 'disc_1', 'aula_18');

      expect(document.querySelector('[data-dashboard-scroll="aulas"]').scrollTop).toBe(96);
    });

    it('preserva a rolagem do gerenciador ao marcar aula como estudada', () => {
      document.body.innerHTML = `
        <div id="modal-disc-manager" class="modal">
          <div id="modal-disc-manager-title"></div>
          <div id="modal-disc-manager-body"></div>
        </div>
      `;
      const state = createBaseState({
        editais: [
          createEdital({
            id: 'ed_1',
            disciplinas: [
              createDisciplina({
                id: 'disc_1',
                aulas: Array.from({ length: 20 }, (_, index) => ({
                  id: `aula_${index + 1}`,
                  nome: `Aula ${index + 1}`,
                  estudada: false,
                  dataEstudo: null,
                })),
              }),
            ],
          }),
        ],
      });
      store.setState(state);

      views.openDiscManager('ed_1', 'disc_1');
      views.switchManagerTab('aulas');
      const panel = document.querySelector('#tab-manager-aulas .sm-list');
      panel.scrollTop = 144;

      views.toggleAulaEstudada('disc_1', 'aula_18');

      expect(document.querySelector('#tab-manager-aulas .sm-list').scrollTop).toBe(144);
    });
  });
});

describe('ciclo-view.js', () => {
  describe('renderCiclo()', () => {
    it('renderiza container vazio quando sem ciclo ativo', () => {
      const container = { innerHTML: '' };
      views.renderCiclo(container);

      expect(container.innerHTML).toBeDefined();
    });

    it('renderiza ciclo com sequência', () => {
      const state = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }],
          ciclosCompletos: 0,
        },
        editais: [
          createEdital({
            disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Teste' })],
          }),
        ],
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderCiclo(container);

      expect(container.innerHTML).toContain('Ciclo');
    });

    it('renderiza progresso do ciclo em formato humano e sem casas decimais', () => {
      const sequencia = Array.from({ length: 12 }, (_, index) => ({
        id: `seq_${index + 1}`,
        discId: 'disc_1',
        minutosAlvo: 120,
        concluido: false,
      }));
      const state = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia,
          ciclosCompletos: 0,
          dataInicioCicloAtual: '2026-04-20T00:00:00.000Z',
        },
        editais: [
          createEdital({
            disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Teste' })],
          }),
        ],
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderCiclo(container);

      expect(container.innerHTML).toContain('0h de 24h');
      expect(container.innerHTML).toContain('faltam 24h');
      expect(container.innerHTML).toContain('0 de 12 sessões concluídas');
      expect(container.innerHTML).toContain('0%');
      expect(container.innerHTML).not.toContain('0.00%');
      expect(container.innerHTML).not.toContain('/ 24h');
    });

    it('renderiza resumo agregado da previsÃ£o de sessÃµes', () => {
      document.body.innerHTML = '<main id="test-root"></main>';
      const state = createBaseState({
        config: {
          ...createBaseState().config,
          materiasPorDia: 2,
        },
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }],
          ciclosCompletos: 0,
          horarios: {
            diasAtivos: [1, 2],
            horasPorDia: { 1: '02:00', 2: '02:00' },
            dataInicial: '2026-04-20',
            dataFinal: '2026-04-21',
          },
        },
        editais: [
          createEdital({
            disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Teste' })],
          }),
        ],
      });
      store.setState(state);

      const container = document.getElementById('test-root');
      views.renderCiclo(container);
      views.calculateCyclePredictions();

      expect(container.innerHTML).toContain('4 sessões previstas');
      expect(container.innerHTML).toContain('4h totais');
      expect(container.innerHTML).toContain('20/04/2026 a 21/04/2026');
    });

    it('persiste a janela de datas da previsão no estado ao recalcular', () => {
      document.body.innerHTML = '<main id="test-root"></main>';
      store.setState(
        createBaseState({
          config: { ...createBaseState().config, materiasPorDia: 2 },
          planejamento: {
            ativo: true,
            tipo: 'ciclo',
            disciplinas: ['disc_1'],
            sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }],
            ciclosCompletos: 0,
            horarios: { diasAtivos: [1, 2], dataInicial: '2026-04-20', dataFinal: '2026-04-21' },
          },
          editais: [createEdital({ disciplinas: [createDisciplina({ id: 'disc_1', nome: 'T' })] })],
        })
      );

      const container = document.getElementById('test-root');
      views.renderCiclo(container);
      // Usuário muda a data final no input e dispara o recálculo.
      document.getElementById('predict-end-date').value = '2026-04-28';
      views.calculateCyclePredictions();

      expect(store.state.planejamento.horarios.dataFinal).toBe('2026-04-28');
      expect(store.state.planejamento.horarios.dataInicial).toBe('2026-04-20');
    });

    it('reduz a previsão ao registrar uma sessão livre (sem seqId) na disciplina', () => {
      document.body.innerHTML = '<main id="test-root"></main>';
      store.setState(
        createBaseState({
          config: { ...createBaseState().config, materiasPorDia: 1 },
          planejamento: {
            ativo: true,
            tipo: 'ciclo',
            disciplinas: ['disc_1'],
            sequencia: [{ id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }],
            ciclosCompletos: 0,
            dataInicioCicloAtual: '2026-04-01',
            horarios: { diasAtivos: [1], dataInicial: '2026-04-20', dataFinal: '2026-04-20' },
          },
          // Sessão livre: discId correto, SEM seqId.
          eventos: [
            createEvento({
              id: 'ev_livre',
              status: 'estudei',
              discId: 'disc_1',
              tempoAcumulado: 1500,
              data: '2026-04-19',
            }),
          ],
          editais: [createEdital({ disciplinas: [createDisciplina({ id: 'disc_1', nome: 'T' })] })],
        })
      );
      logic.invalidateDiscCache();

      const container = document.getElementById('test-root');
      views.renderCiclo(container);
      views.calculateCyclePredictions();

      // 1 slot, restante = 60 - 25 = 35min.
      expect(container.innerHTML).toContain('1 sessão previstas');
      expect(container.innerHTML).toContain('35min totais');
    });

    it('mostra etapa concluida manualmente como 100% mesmo com tempo parcial', () => {
      const state = createBaseState({
        planejamento: {
          ativo: true,
          tipo: 'ciclo',
          disciplinas: ['disc_1'],
          sequencia: [
            { id: 'seq_1', discId: 'disc_1', minutosAlvo: 120, concluido: true, status: 'concluida' },
          ],
          ciclosCompletos: 0,
          dataInicioCicloAtual: '2026-04-20T00:00:00.000Z',
        },
        editais: [
          createEdital({
            disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' })],
          }),
        ],
        eventos: [
          createEvento({
            id: 'ev_partial',
            data: '2026-04-20',
            dataEstudo: '2026-04-20',
            status: 'estudei',
            tempoAcumulado: 4260,
            discId: 'disc_1',
            seqId: 'seq_1',
          }),
        ],
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderCiclo(container);

      expect(container.innerHTML).toContain('100%');
      expect(container.innerHTML).toContain('2h</span> de 2h');
    });
  });

  describe('recomecarCiclo()', () => {
    it('existe e é função', () => {
      expect(views.recomecarCiclo).toBeDefined();
      expect(typeof views.recomecarCiclo).toBe('function');
    });
  });

  describe('zerarCiclosCounter()', () => {
    it('existe e é função', () => {
      expect(views.zerarCiclosCounter).toBeDefined();
      expect(typeof views.zerarCiclosCounter).toBe('function');
    });
  });
});

describe('ciclo history modal', () => {
  it('mostra progresso, tempo restante e status da etapa parcial', () => {
    document.body.innerHTML = `
      <div id="modal-ciclo-history" class="modal-overlay" aria-hidden="true"></div>
      <h2 id="modal-ciclo-history-title"></h2>
      <div id="modal-ciclo-history-body"></div>
    `;
    const state = createBaseState({
      planejamento: {
        ativo: true,
        tipo: 'ciclo',
        disciplinas: ['disc_1'],
        sequencia: [
          { id: 'seq_1', discId: 'disc_1', minutosAlvo: 120, concluido: false, status: 'pendente' },
        ],
        ciclosCompletos: 0,
        dataInicioCicloAtual: '2026-04-20T00:00:00.000Z',
      },
      editais: [
        createEdital({
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' })],
        }),
      ],
      eventos: [
        createEvento({
          id: 'ev_partial',
          data: '2026-04-20',
          dataEstudo: '2026-04-20',
          status: 'estudei',
          tempoAcumulado: 4260,
          discId: 'disc_1',
          seqId: 'seq_1',
        }),
      ],
    });
    store.setState(state);
    logic.invalidateDiscCache();

    views.openCicloHistory('seq_1');

    const body = document.getElementById('modal-ciclo-history-body').innerHTML;
    expect(body).toContain('1h 11min de 2h');
    expect(body).toContain('49min restantes');
    expect(body).toContain('Status: pendente');
  });
});

describe('habitos-view.js', () => {
  describe('renderHabitos()', () => {
    it('renderiza grid de hábitos', () => {
      const container = { innerHTML: '' };
      views.renderHabitos(container);

      expect(container.innerHTML).toContain('habit-grid');
    });

    it('renderiza cards de hábitos', () => {
      const container = { innerHTML: '' };
      views.renderHabitos(container);

      expect(container.innerHTML).toContain('habit-card');
      expect(container.innerHTML).toContain('Videoaula');
    });

    it('renderiza histórico de hábitos', () => {
      const container = { innerHTML: '' };
      views.renderHabitos(container);

      expect(container.innerHTML).toContain('habit-hist');
    });

    it('renderiza detalhes completos no histórico de hábitos', () => {
      const state = createBaseState({
        habitos: {
          questoes: [],
          revisao: [],
          discursiva: [
            {
              id: 'hab_disc_1',
              data: '2026-04-19',
              descricao: 'Peca sobre controle externo',
              nota: '8.5',
            },
          ],
          simulado: [],
          leitura: [],
          informativo: [],
          sumula: [],
          videoaula: [],
          paginas: [
            {
              id: 'hab_pag_1',
              data: '2026-04-18',
              descricao: 'Lei 8.112',
              total: 42,
            },
          ],
        },
      });
      store.setState(state);

      const container = document.createElement('div');
      document.body.appendChild(container);
      views.renderHabitos(container);

      expect(container.innerHTML).toContain('Peca sobre controle externo');
      expect(container.innerHTML).toContain('Nota 8.5');
      expect(container.innerHTML).toContain('Lei 8.112');
      expect(container.innerHTML).toContain('42 páginas');
    });

    it('usa volume real nos cards de hábitos, incluindo campos legados e sessões', () => {
      const state = createBaseState({
        eventos: [
          createEvento({
            id: 'ev_questoes',
            sessao: { questoes: { acertos: 7, erros: 3 } },
          }),
        ],
        habitos: {
          questoes: [{ id: 'hab_q1', data: '2026-04-20', eventoId: 'ev_questoes' }],
          revisao: [],
          discursiva: [],
          simulado: [],
          leitura: [{ id: 'hab_l1', data: '2026-04-20', paginas: 24 }],
          informativo: [],
          sumula: [],
          videoaula: [
            { id: 'hab_v1', data: '2026-04-20', tempoMin: 30 },
            { id: 'hab_v2', data: '2026-04-20', aulas: 2, tempo: 45 },
          ],
          paginas: [{ id: 'hab_p1', data: '2026-04-20', total: 12 }],
        },
      });
      store.setState(state);

      const container = document.createElement('div');
      views.renderHabitos(container);

      expect(container.innerHTML).toContain('10');
      expect(container.innerHTML).toContain('24');
      expect(container.innerHTML).toContain('75');
      expect(container.innerHTML).toContain('min acumulados');
      expect(container.innerHTML).toContain('páginas');
    });
  });

  describe('calcSimuladoPerc()', () => {
    it('existe e é função', () => {
      expect(views.calcSimuladoPerc).toBeDefined();
      expect(typeof views.calcSimuladoPerc).toBe('function');
    });
  });

  describe('deleteHabito()', () => {
    it('existe e é função', () => {
      expect(views.deleteHabito).toBeDefined();
      expect(typeof views.deleteHabito).toBe('function');
    });

    it('grava tombstone de sync ao excluir um registro de hábito', async () => {
      // Sem tombstone, o registro excluído ressuscita no merge (união por id).
      const state = createBaseState();
      state.habitos.questoes = [{ id: 'hab_1', data: '2026-04-20', quantidade: 10 }];
      store.setState(state);

      // monta o modal real de confirmação e liga os handlers (mesma instância
      // de módulo usada por habitos-view via app.js)
      document.body.innerHTML = `
        <div id="modal-confirm">
          <div id="confirm-title"></div>
          <div id="confirm-msg"></div>
          <button id="confirm-ok-btn"></button>
          <button id="confirm-cancel-btn"></button>
        </div>`;
      const modals = await import('../../src/js/app/modals.js');
      modals.setupConfirmHandlers();

      views.deleteHabito('questoes', 'hab_1');
      document.getElementById('confirm-ok-btn').click();

      expect(store.state.habitos.questoes).toHaveLength(0);
      expect(store.state.syncTombstones).toContainEqual(
        expect.objectContaining({ col: 'habitos.questoes', id: 'hab_1' })
      );
    });
  });

  describe('setHabitPage()', () => {
    it('existe e é função', () => {
      expect(views.setHabitPage).toBeDefined();
      expect(typeof views.setHabitPage).toBe('function');
    });
  });
});

describe('home-view.js', () => {
  describe('renderHome()', () => {
    it('renderiza home com estatísticas', () => {
      const state = createBaseState({
        eventos: [
          createEvento({ id: 'ev_1', titulo: 'Sessão 1', data: '2026-04-20', status: 'concluido' }),
        ],
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toBeDefined();
    });

    it('renderiza home vazia sem eventos', () => {
      const state = createBaseState({ eventos: [], arquivo: [] });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toBeDefined();
    });

    it('renderiza stats de sessões', () => {
      const state = createBaseState({
        eventos: [createEvento({ id: 'ev_1', titulo: 'Sessão', status: 'concluido' })],
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toContain('stat');
    });

    it('mantém a área de estudo semanal renderizável mesmo sem dados', () => {
      const state = createBaseState({ eventos: [] });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toContain('home-weekly-study-card');
      expect(container.innerHTML).toContain('home-weekly-study-chart');
      expect(container.innerHTML).toContain('Nenhuma sessão de estudo registrada esta semana');
    });
    it('mostra no painel apenas as disciplinas do edital principal', () => {
      const editalA = createEdital({
        id: 'ed_1',
        nome: 'PGE-RN',
        disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' })],
      });
      const editalB = createEdital({
        id: 'ed_2',
        nome: 'TRF 6',
        disciplinas: [createDisciplina({ id: 'disc_2', nome: 'Direito Civil' })],
      });
      store.setState(
        createBaseState({
          editais: [editalA, editalB],
          eventos: [
            createEvento({
              id: 'ev_1',
              data: '2026-04-20',
              status: 'estudei',
              tempoAcumulado: 3600,
              discId: 'disc_1',
              questoes: { acertos: 8, erros: 2 },
            }),
            createEvento({
              id: 'ev_2',
              data: '2026-04-20',
              status: 'estudei',
              tempoAcumulado: 1800,
              discId: 'disc_2',
              questoes: { acertos: 3, erros: 1 },
            }),
          ],
        })
      );
      logic.invalidateDashCaches();

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toContain('dash-subject-panel');
      // Modelo de edital principal único: o painel mostra o principal (ed_1) e
      // não há mais abas de troca de edital.
      expect(container.innerHTML).toContain('Direito Administrativo');
      expect(container.innerHTML).not.toContain('data-action="set-active-edital"');
    });

    it('mostra escolha inline de edital principal quando ha varios ativos pendentes', () => {
      const editalA = createEdital({
        id: 'ed_1',
        nome: 'PGE-RN',
        arquivado: false,
        disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' })],
      });
      const editalB = createEdital({
        id: 'ed_2',
        nome: 'TRF',
        arquivado: false,
        disciplinas: [createDisciplina({ id: 'disc_2', nome: 'Direito Constitucional' })],
      });
      store.setState(createBaseState({ editais: [editalA, editalB] }));
      logic.invalidateDiscCache();
      logic.invalidateDashCaches();

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toContain('home-principal-choice');
      expect(container.innerHTML).toContain('Defina seu edital principal');
      expect(container.innerHTML).toContain('data-action="make-edital-principal"');
      expect(container.innerHTML).toContain('data-edital-id="ed_1"');
      expect(container.innerHTML).toContain('data-edital-id="ed_2"');
    });

    it('usa todos os editais ativos na Home enquanto a escolha do principal esta pendente', () => {
      const editalA = createEdital({
        id: 'ed_1',
        nome: 'PGE-RN',
        arquivado: false,
        disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' })],
      });
      const editalB = createEdital({
        id: 'ed_2',
        nome: 'TRF',
        arquivado: false,
        disciplinas: [createDisciplina({ id: 'disc_2', nome: 'Direito Constitucional' })],
      });
      store.setState(
        createBaseState({
          editais: [editalA, editalB],
          eventos: [
            createEvento({
              id: 'ev_ed2',
              status: 'estudei',
              data: '2026-04-20',
              dataEstudo: '2026-04-20',
              discId: 'disc_2',
              tempoAcumulado: 3600,
              sessao: { questoes: { acertos: 8, erros: 2 } },
            }),
          ],
        })
      );
      logic.invalidateDiscCache();
      logic.invalidateDashCaches();

      const container = { innerHTML: '' };
      views.renderHome(container);

      expect(container.innerHTML).toContain('01:00:00');
      expect(container.innerHTML).toContain('8 Acertos');
      expect(container.innerHTML).toContain('2 Erros');
      expect(container.innerHTML).toContain('Direito Constitucional');
    });
  });
});

describe('historico-sessoes view', () => {
  it('renderiza detalhes e usa a data real de estudo no histórico global', () => {
    const state = createBaseState({
      editais: [
        createEdital({
          disciplinas: [
            createDisciplina({
              id: 'disc_1',
              nome: 'Direito Constitucional',
              assuntos: [{ id: 'ass_1', nome: 'Controle de Constitucionalidade' }],
            }),
          ],
        }),
      ],
      eventos: [
        createEvento({
          id: 'ev_done_1',
          titulo: 'Sessão registrada',
          data: '2026-03-19',
          dataEstudo: '2026-04-19',
          status: 'estudei',
          tempoAcumulado: 2700,
          discId: 'disc_1',
          assId: 'ass_1',
          questoes: { acertos: 8, erros: 2 },
          paginas: 12,
        }),
      ],
    });
    store.setState(state);
    logic.invalidateDiscCache();

    const container = { innerHTML: '' };
    views.renderHistoricoSessoes(container);

    expect(container.innerHTML).toContain('19/04/2026');
    expect(container.innerHTML).not.toContain('19/03/2026');
    expect(container.innerHTML).toContain('Direito Constitucional');
    expect(container.innerHTML).toContain('Sessão registrada');
    expect(container.innerHTML).toContain('Controle de Constitucionalidade');
    expect(container.innerHTML).toContain('8/10 (80%)');
    expect(container.innerHTML).toContain('12');
  });

  it('inclui sessões arquivadas com os mesmos detalhes do histórico ativo', () => {
    const state = createBaseState({
      editais: [
        createEdital({
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' })],
        }),
      ],
      eventos: [],
      arquivo: [
        createEvento({
          id: 'ev_archived_1',
          titulo: 'Sessão arquivada',
          data: '2026-03-18',
          dataEstudo: '2026-03-18',
          status: 'estudei',
          tempoAcumulado: 3600,
          discId: 'disc_1',
        }),
      ],
    });
    store.setState(state);
    logic.invalidateDiscCache();

    const container = { innerHTML: '' };
    views.renderHistoricoSessoes(container);

    expect(container.innerHTML).toContain('Sessão arquivada');
    expect(container.innerHTML).toContain('Direito Administrativo');
    expect(container.innerHTML).toContain('01:00:00');
  });

  it('escopa o contador "Exibindo X de Y" ao edital selecionado e explica no empty state', () => {
    // Sem seleção explícita, o histórico usa allowAll:false → cai no PRIMEIRO edital (ed_a).
    // As sessões pertencem ao ed_b: a lista fica vazia e o denominador não pode contar essas
    // sessões como se estivessem "disponíveis" para os filtros locais.
    const state = createBaseState({
      editais: [
        createEdital({
          id: 'ed_a',
          nome: 'Edital A',
          disciplinas: [createDisciplina({ id: 'disc_a', nome: 'Disciplina A' })],
        }),
        createEdital({
          id: 'ed_b',
          nome: 'Edital B',
          disciplinas: [createDisciplina({ id: 'disc_b', nome: 'Disciplina B' })],
        }),
      ],
      eventos: [
        createEvento({
          id: 'ev_b1',
          data: '2026-04-19',
          dataEstudo: '2026-04-19',
          status: 'estudei',
          tempoAcumulado: 1800,
          discId: 'disc_b',
        }),
      ],
    });
    store.setState(state);
    logic.invalidateDiscCache();

    const container = { innerHTML: '' };
    views.renderHistoricoSessoes(container);

    expect(container.innerHTML).toContain('Exibindo 0 de 0 sessões');
    expect(container.innerHTML).not.toContain('Exibindo 0 de 1');
    // A dica precisa apontar a causa real (edital), não os filtros locais.
    expect(container.innerHTML.toLowerCase()).toContain('edital');
  });

  it('aplica o corte de período com data local, não UTC', async () => {
    const utils = await import('../../src/js/utils.js?v=8.37');
    const uiState = await import('../../src/js/ui-state.js?v=8.37');
    // 23:30 em UTC-3 → o dia UTC já virou. Um cutoff via toISOString() avançaria
    // um dia e excluiria a sessão estudada exatamente no limite da janela local.
    vi.setSystemTime(new Date('2026-04-20T23:30:00-03:00'));
    const limite = utils.cutoffDateStr(7); // dia mais antigo DENTRO da janela local
    const foraDaJanela = utils.cutoffDateStr(8);

    const state = createBaseState({
      editais: [
        createEdital({
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Disciplina' })],
        }),
      ],
      eventos: [
        createEvento({
          id: 'ev_limite',
          data: limite,
          dataEstudo: limite,
          status: 'estudei',
          tempoAcumulado: 1800,
          discId: 'disc_1',
        }),
        createEvento({
          id: 'ev_fora',
          data: foraDaJanela,
          dataEstudo: foraDaJanela,
          status: 'estudei',
          tempoAcumulado: 1800,
          discId: 'disc_1',
        }),
      ],
    });
    store.setState(state);
    logic.invalidateDiscCache();
    uiState.setUiSection('historico', { rangeDays: '7', disciplinaId: '', busca: '' });

    const container = { innerHTML: '' };
    views.renderHistoricoSessoes(container);

    uiState.setUiSection('historico', { rangeDays: 'all', disciplinaId: '', busca: '' });

    expect(container.innerHTML).toContain('Exibindo 1 de 2 sessões');
  });

  it('não mostra "Limpar filtros" no estado padrão (Tudo) e mostra quando o período muda', async () => {
    const uiState = await import('../../src/js/ui-state.js?v=8.37');
    const state = createBaseState({
      editais: [
        createEdital({
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Disciplina' })],
        }),
      ],
      eventos: [
        createEvento({
          id: 'ev_1',
          data: '2026-04-20',
          dataEstudo: '2026-04-20',
          status: 'estudei',
          tempoAcumulado: 1800,
          discId: 'disc_1',
        }),
      ],
    });
    store.setState(state);
    logic.invalidateDiscCache();
    uiState.setUiSection('historico', { rangeDays: 'all', disciplinaId: '', busca: '' });

    const container = { innerHTML: '' };
    views.renderHistoricoSessoes(container);
    expect(container.innerHTML).not.toContain('historico-clear-filters');

    uiState.setUiSection('historico', { rangeDays: '30', disciplinaId: '', busca: '' });
    views.renderHistoricoSessoes(container);
    uiState.setUiSection('historico', { rangeDays: 'all', disciplinaId: '', busca: '' });
    expect(container.innerHTML).toContain('historico-clear-filters');
  });

  it('estiliza os controles da toolbar de filtros com form-control', () => {
    const state = createBaseState({
      editais: [
        createEdital({
          disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Direito Administrativo' })],
        }),
      ],
      eventos: [
        createEvento({
          id: 'ev_1',
          data: '2026-04-20',
          dataEstudo: '2026-04-20',
          status: 'estudei',
          tempoAcumulado: 1800,
          discId: 'disc_1',
        }),
      ],
    });
    store.setState(state);
    logic.invalidateDiscCache();

    const container = { innerHTML: '' };
    views.renderHistoricoSessoes(container);

    const rangeSelect = container.innerHTML.match(
      /<select[^>]*data-action="historico-set-range"[^>]*>/
    )?.[0];
    const discSelect = container.innerHTML.match(
      /<select[^>]*data-action="historico-set-disciplina"[^>]*>/
    )?.[0];
    const buscaInput = container.innerHTML.match(
      /<input[^>]*data-action="historico-set-busca"[^>]*>/
    )?.[0];

    expect(rangeSelect).toContain('form-control');
    expect(discSelect).toContain('form-control');
    expect(buscaInput).toContain('form-control');
  });
});

describe('revisoes view actions', () => {
  it('confirma e remove da fila todas as revisões vencidas do assunto', () => {
    document.body.innerHTML = `
      <div id="modal-confirm" class="modal-overlay" aria-hidden="true">
        <div id="confirm-title"></div>
        <div id="confirm-msg"></div>
        <button id="confirm-ok-btn"></button>
        <button id="confirm-cancel-btn"></button>
      </div>
    `;
    app.setupConfirmHandlers();

    const state = createBaseState({
      editais: [
        createEdital({
          disciplinas: [
            createDisciplina({
              id: 'disc_1',
              assuntos: [
                {
                  id: 'ass_1',
                  nome: 'Orçamento público',
                  concluido: true,
                  dataConclusao: '2026-03-16',
                  revisoesFetas: ['2026-03-17'],
                },
              ],
            }),
          ],
        }),
      ],
    });
    store.setState(state);
    logic.invalidateRevCache();
    logic.invalidatePendingRevCache();

    expect(logic.getPendingRevisoes()).toHaveLength(1);

    views.deletarRevisao('ass_1');
    document.getElementById('confirm-ok-btn').click();

    expect(logic.getPendingRevisoes()).toHaveLength(0);
    expect(store.state.editais[0].disciplinas[0].assuntos[0].revisoesFetas).toEqual([
      '2026-03-17',
      '2026-03-23',
      '2026-04-15',
    ]);
  });

  it('adiar revisão atrasada move a pendência para amanhã e não conta como feita', () => {
    // Sistema em 2026-04-20. Concluído em 2026-04-14 com frequência [1,7,...]:
    // 1ª revisão prevista para 2026-04-15 → atrasada há 5 dias.
    const state = createBaseState({
      editais: [
        createEdital({
          disciplinas: [
            createDisciplina({
              id: 'disc_1',
              assuntos: [
                {
                  id: 'ass_1',
                  nome: 'Controle de Constitucionalidade',
                  concluido: true,
                  dataConclusao: '2026-04-14',
                  revisoesFetas: [],
                },
              ],
            }),
          ],
        }),
      ],
    });
    store.setState(state);
    logic.invalidateRevCache();
    logic.invalidatePendingRevCache();

    expect(logic.getPendingRevisoes()).toHaveLength(1);

    views.adiarRevisao('ass_1');

    const ass = store.state.editais[0].disciplinas[0].assuntos[0];
    // Adiar NÃO pode contar como revisão feita.
    expect(ass.revisoesFetas).toEqual([]);
    // "+1 dia" significa próxima ocorrência AMANHÃ — somar só 1 em adiamentos
    // deixaria a data ainda <= hoje e o item continuaria pendente.
    expect(logic.getPendingRevisoes()).toHaveLength(0);
    const upcoming = views.getUpcomingRevisoes(30);
    expect(upcoming[0]?.data).toBe('2026-04-21');
  });

  it('remove revisão inicial atrasada mesmo quando ainda não há revisões feitas', () => {
    document.body.innerHTML = `
      <div id="modal-confirm" class="modal-overlay" aria-hidden="true">
        <div id="confirm-title"></div>
        <div id="confirm-msg"></div>
        <button id="confirm-ok-btn"></button>
        <button id="confirm-cancel-btn"></button>
      </div>
    `;
    app.setupConfirmHandlers();

    const state = createBaseState({
      editais: [
        createEdital({
          disciplinas: [
            createDisciplina({
              id: 'disc_1',
              assuntos: [
                {
                  id: 'ass_1',
                  nome: 'Orçamento público',
                  concluido: true,
                  dataConclusao: '2026-03-16',
                  revisoesFetas: [],
                },
              ],
            }),
          ],
        }),
      ],
    });
    store.setState(state);
    logic.invalidateRevCache();
    logic.invalidatePendingRevCache();

    expect(logic.getPendingRevisoes()[0].assunto.id).toBe('ass_1');

    views.deletarRevisao('ass_1');
    document.getElementById('confirm-ok-btn').click();

    expect(logic.getPendingRevisoes()).toHaveLength(0);
    expect(store.state.editais[0].disciplinas[0].assuntos[0].revisoesFetas).toEqual([
      '2026-03-17',
      '2026-03-23',
      '2026-04-15',
    ]);
  });

  it('permite remover uma revisão futura específica sem apagar o assunto concluído', () => {
    document.body.innerHTML = `
      <div id="modal-confirm" class="modal-overlay" aria-hidden="true">
        <div id="confirm-title"></div>
        <div id="confirm-msg"></div>
        <button id="confirm-ok-btn"></button>
        <button id="confirm-cancel-btn"></button>
      </div>
    `;
    app.setupConfirmHandlers();

    const state = createBaseState({
      config: { frequenciaRevisao: [1, 7, 30, 90] },
      editais: [
        createEdital({
          disciplinas: [
            createDisciplina({
              id: 'disc_1',
              assuntos: [
                {
                  id: 'ass_1',
                  nome: 'Orçamento público',
                  concluido: true,
                  dataConclusao: '2026-04-20',
                  revisoesFetas: [],
                },
              ],
            }),
          ],
        }),
      ],
    });
    store.setState(state);
    logic.invalidateRevCache();
    logic.invalidatePendingRevCache();

    views.deletarRevisao('ass_1', '2026-04-21');
    document.getElementById('confirm-ok-btn').click();

    const assunto = store.state.editais[0].disciplinas[0].assuntos[0];
    expect(assunto.concluido).toBe(true);
    expect(assunto.revisoesFetas).toContain('2026-04-21');
  });
});

describe('banca-view.js', () => {
  describe('renderBancaAnalyzerModule()', () => {
    it('renderiza módulo de análise de banca', () => {
      const container = { innerHTML: '' };
      views.renderBancaAnalyzerModule?.(container);

      expect(container.innerHTML).toBeDefined();
    });
  });

  describe('renderBancaAnalyzerContent()', () => {
    it('renderiza conteúdo do analisador', () => {
      const state = createBaseState({
        editais: [
          createEdital({
            id: 'ed_1',
            nome: 'Concurso TRF',
            disciplinas: [createDisciplina({ id: 'disc_1', nome: 'Teste' })],
          }),
        ],
      });
      store.setState(state);

      const container = { innerHTML: '' };
      views.renderBancaAnalyzerContent?.(container);

      expect(container.innerHTML).toBeDefined();
    });
  });

  describe('mudarEditalAnalisador()', () => {
    it('existe e é função', () => {
      expect(views.mudarEditalAnalisador).toBeDefined();
      expect(typeof views.mudarEditalAnalisador).toBe('function');
    });
  });

  describe('filtrarViewPorDisciplina()', () => {
    it('existe e é função', () => {
      expect(views.filtrarViewPorDisciplina).toBeDefined();
      expect(typeof views.filtrarViewPorDisciplina).toBe('function');
    });
  });

  describe('carregarAnaliseBanca()', () => {
    it('existe e é função', () => {
      expect(views.carregarAnaliseBanca).toBeDefined();
      expect(typeof views.carregarAnaliseBanca).toBe('function');
    });
  });
});
