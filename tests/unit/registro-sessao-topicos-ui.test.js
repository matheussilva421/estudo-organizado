import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAppModules } from '../helpers/module-loader.js';
import {
  createBaseState,
  createEvento,
  createDisciplina,
  createAssunto,
  createEdital,
} from '../helpers/state-builders.js';

vi.mock('../../src/js/app.js?v=8.37', () => ({
  openModal: vi.fn(),
  closeModal: vi.fn(),
  showToast: vi.fn(),
  showConfirm: vi.fn(),
  navigate: vi.fn(),
  renderCurrentView: vi.fn(),
  updateBadges: vi.fn(),
  currentView: 'home',
}));

let store;
let logic;
let app;
let registro;
let renderer;

function createMockDOM() {
  const elements = {};

  const createElement = (id) => {
    const el = {
      id,
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
      setAttribute: vi.fn(),
      textContent: '',
      innerHTML: '',
      value: '',
      style: { display: '' },
      dataset: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      focus: vi.fn(),
      remove: vi.fn(),
      querySelectorAll: vi.fn(() => []),
    };
    elements[id] = el;
    return el;
  };

  const mockDocument = {
    getElementById: vi.fn((id) => {
      if (!elements[id]) elements[id] = createElement(id);
      return elements[id];
    }),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: { contains: vi.fn(() => true), style: {}, appendChild: vi.fn() },
    elements,
  };

  return mockDocument;
}

function setupState({ evento = {} } = {}) {
  const disc = createDisciplina({
    id: 'disc_a',
    nome: 'Materia A',
    assuntos: [
      createAssunto({ id: 'ass_1', nome: 'Topico 1', linkedAulaIds: ['aula_2'] }),
      createAssunto({ id: 'ass_2', nome: 'Topico 2' }),
    ],
    aulas: [
      { id: 'aula_1', nome: 'Aula 01', estudada: false },
      { id: 'aula_2', nome: 'Aula 02', estudada: false },
    ],
  });
  const edital = createEdital({ disciplinas: [disc] });
  const ev = createEvento({
    id: 'ev_ui',
    data: '2026-04-20',
    status: 'agendado',
    tempoAcumulado: 1800,
    discId: 'disc_a',
    ...evento,
  });
  store.setState(createBaseState({ editais: [edital], eventos: [ev] }));
  logic.invalidateDiscCache();
  return ev;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));

  global.document = createMockDOM();
  global.window = {
    innerWidth: 1024,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  global.Notification = { permission: 'granted' };
  global.Audio = vi.fn(() => ({ play: vi.fn(() => Promise.resolve()) }));
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
  logic = modules.logic;
  app = await import('../../src/js/app.js?v=8.37');
  registro = await import('../../src/js/registro-sessao.js?v=8.37');
  renderer = await import('../../src/js/registro-sessao/modal-renderer.js?v=8.37');

  store.setState(createBaseState());
  logic.invalidateDiscCache();
});

describe('registro multi-tópico — estado e ações da UI', () => {
  it('addTopicoSessao adiciona item dos selects e bloqueia duplicado', () => {
    setupState();
    registro.openRegistroSessao('ev_ui');
    document.getElementById('reg-disciplina').value = 'disc_a';
    document.getElementById('reg-assunto').value = 'ass_1';
    document.getElementById('reg-aula').value = '';

    registro.addTopicoSessao();
    expect(registro.getSessionTopicos()).toEqual([
      { assId: 'ass_1', aulaId: null, questoes: null, paginas: null, statusTopico: 'em_andamento' },
    ]);

    registro.addTopicoSessao(); // duplicado
    expect(registro.getSessionTopicos()).toHaveLength(1);
    expect(app.showToast).toHaveBeenCalledWith('Este item já está na lista', 'info');

    document.getElementById('reg-assunto').value = 'ass_2';
    registro.addTopicoSessao();
    expect(registro.getSessionTopicos()).toHaveLength(2);
  });

  it('addTopicoSessao exige disciplina e assunto/aula', () => {
    setupState();
    registro.openRegistroSessao('ev_ui');
    document.getElementById('reg-disciplina').value = '';
    registro.addTopicoSessao();
    expect(registro.getSessionTopicos()).toEqual([]);

    document.getElementById('reg-disciplina').value = 'disc_a';
    document.getElementById('reg-assunto').value = '';
    document.getElementById('reg-aula').value = '';
    registro.addTopicoSessao();
    expect(registro.getSessionTopicos()).toEqual([]);
  });

  it('removeTopicoSessao e updateTopicoField manipulam a lista', () => {
    setupState();
    registro.openRegistroSessao('ev_ui');
    document.getElementById('reg-disciplina').value = 'disc_a';
    document.getElementById('reg-assunto').value = 'ass_1';
    registro.addTopicoSessao();
    document.getElementById('reg-assunto').value = 'ass_2';
    registro.addTopicoSessao();

    registro.updateTopicoField(0, 'q-total', '10');
    registro.updateTopicoField(0, 'q-acertos', '8');
    registro.updateTopicoField(0, 'q-erros', '2');
    registro.updateTopicoField(1, 'pag-total', '12');
    registro.updateTopicoField(1, 'status', 'finalizado');

    let topicos = registro.getSessionTopicos();
    expect(topicos[0].questoes).toEqual({ total: 10, acertos: 8, erros: 2 });
    expect(topicos[1].paginas).toEqual({ modo: 'simples', total: 12 });
    expect(topicos[1].statusTopico).toBe('finalizado');

    registro.removeTopicoSessao(0);
    topicos = registro.getSessionTopicos();
    expect(topicos).toHaveLength(1);
    expect(topicos[0].assId).toBe('ass_2');
  });

  it('reeditar sessão antiga converte escalares em topicos[] de 1 item', () => {
    setupState({
      evento: {
        status: 'estudei',
        assId: 'ass_1',
        aulaId: null,
        sessao: {
          tiposEstudo: ['questoes'],
          questoes: { total: 10, acertos: 9, erros: 1 },
          statusTopico: 'finalizado',
        },
      },
    });

    registro.openRegistroSessao('ev_ui');

    expect(registro.getSessionTopicos()).toEqual([
      {
        assId: 'ass_1',
        aulaId: null,
        questoes: { total: 10, acertos: 9, erros: 1 },
        paginas: null,
        statusTopico: 'finalizado',
      },
    ]);
  });

  it('sessão nova (agendada) começa com lista vazia (caminho legado)', () => {
    setupState({ evento: { assId: 'ass_1' } });
    registro.openRegistroSessao('ev_ui');
    expect(registro.getSessionTopicos()).toEqual([]);
  });

  it('evento da reta final (rfBlocoId) pré-preenche a lista com os tópicos do bloco', () => {
    setupState({ evento: { rfBlocoId: 'rf_1' } });
    store.state.planejamento = {
      ativo: true,
      tipo: 'reta_final',
      disciplinas: ['disc_a'],
      sequencia: [],
      retaFinal: {
        nome: 'RF',
        dataFinal: '2026-08-15',
        minutosPadrao: 60,
        blocos: [
          {
            id: 'rf_1',
            data: '2026-04-20',
            dataOriginal: '2026-04-20',
            discId: 'disc_a',
            topicos: [
              { assId: 'ass_1', aulaId: null },
              { assId: null, aulaId: 'aula_1' },
            ],
            minutos: 60,
            status: 'pendente',
            rolagens: 0,
          },
        ],
      },
    };

    registro.openRegistroSessao('ev_ui');

    expect(registro.getSessionTopicos()).toEqual([
      { assId: 'ass_1', aulaId: null, questoes: null, paginas: null, statusTopico: 'nao_iniciado' },
      { assId: null, aulaId: 'aula_1', questoes: null, paginas: null, statusTopico: 'nao_iniciado' },
    ]);
  });

  it('trocar de disciplina com itens na lista esvazia a lista', () => {
    setupState();
    registro.openRegistroSessao('ev_ui');
    document.getElementById('reg-disciplina').value = 'disc_a';
    document.getElementById('reg-assunto').value = 'ass_1';
    registro.addTopicoSessao();
    expect(registro.getSessionTopicos()).toHaveLength(1);

    document.getElementById('reg-disciplina').value = 'disc_b';
    registro.onDisciplinaChange();

    expect(registro.getSessionTopicos()).toEqual([]);
  });

  it('onAssuntoChange coloca aulas vinculadas (linkedAulaIds) primeiro', () => {
    setupState();
    registro.openRegistroSessao('ev_ui');
    document.getElementById('reg-disciplina').value = 'disc_a';
    document.getElementById('reg-assunto').value = 'ass_1'; // linked: aula_2

    registro.onAssuntoChange();

    const html = document.getElementById('reg-aula').innerHTML;
    expect(html.indexOf('aula_2')).toBeLessThan(html.indexOf('aula_1'));
    expect(html).toContain('🔗');
  });

  it('renderTopicosList emite campos por item com data-topico-idx e não mexe nos ids #reg-*', () => {
    setupState();
    const html = renderer.renderTopicosList({
      topicos: [
        {
          assId: 'ass_1',
          aulaId: null,
          questoes: { total: 5, acertos: 4, erros: 1 },
          paginas: null,
          statusTopico: 'em_andamento',
        },
      ],
      discId: 'disc_a',
    });

    expect(html).toContain('data-topico-idx="0"');
    expect(html).toContain('data-field="q-total"');
    expect(html).toContain('data-field="status"');
    expect(html).toContain('Topico 1');
    expect(html).not.toContain('id="reg-q-total"'); // ids globais intactos

    const form = renderer.renderRegistroForm({
      ev: { id: 'ev_ui', discId: 'disc_a', tempoAcumulado: 0, sessao: {} },
      sessionStartTime: null,
      sessionEndTime: null,
      sessionMode: 'cronometro',
      selectedTipos: [],
      selectedMateriais: [],
      sessionTopicos: [],
    });
    for (const id of ['reg-disciplina', 'reg-assunto', 'reg-aula', 'reg-status-topico']) {
      expect(form).toContain(`id="${id}"`);
    }
    expect(form).toContain('data-action="add-topico-sessao"');
    expect(form).toContain('id="reg-topicos-lista"');
  });
});

describe('unificação das seções duplicadas — resumo derivado no modo multi-tópico', () => {
  const topicosDemo = [
    {
      assId: 'ass_1',
      aulaId: null,
      questoes: { total: 10, acertos: 8, erros: 2 },
      paginas: { modo: 'simples', total: 12 },
      statusTopico: 'finalizado',
    },
    {
      assId: 'ass_2',
      aulaId: null,
      questoes: { total: 5, acertos: 3, erros: 2 },
      paginas: null,
      statusTopico: 'em_andamento',
    },
  ];

  it('renderConditionalFields com lista vira resumo somente-leitura, sem inputs globais', () => {
    const html = renderer.renderConditionalFields({
      selectedTipos: ['questoes', 'leitura'],
      selectedMateriais: [],
      sessao: {},
      discId: '',
      aulaId: '',
      sessionTopicos: topicosDemo,
    });

    expect(html).not.toContain('id="reg-q-total"');
    expect(html).not.toContain('id="reg-q-acertos"');
    expect(html).not.toContain('id="reg-q-erros"');
    expect(html).not.toContain('id="reg-pag-total"');
    expect(html).not.toContain('id="reg-pag-inicio"');
    expect(html).toContain('Somado automaticamente');
    expect(html).toContain('>15<'); // questões: 10 + 5
    expect(html).toContain('>11<'); // acertos: 8 + 3
    expect(html).toContain('>4<'); // erros: 2 + 2
    expect(html).toContain('>12<'); // páginas: 12 + 0
    expect(html).toContain('73%'); // aproveitamento 11/15
  });

  it('renderConditionalFields com lista vazia mantém os campos globais editáveis (legado)', () => {
    const html = renderer.renderConditionalFields({
      selectedTipos: ['questoes'],
      selectedMateriais: [],
      sessao: {},
      discId: '',
      aulaId: '',
      sessionTopicos: [],
    });
    expect(html).toContain('id="reg-q-total"');
    expect(html).toContain('id="reg-q-acertos"');
  });

  it('vídeoaula continua editável no modo multi-tópico (não tem equivalente por item)', () => {
    const html = renderer.renderConditionalFields({
      selectedTipos: ['videoaula'],
      selectedMateriais: [],
      sessao: {},
      discId: '',
      aulaId: '',
      sessionTopicos: topicosDemo,
    });
    expect(html).toContain('id="reg-video-titulo"');
    expect(html).toContain('id="reg-video-tempo"');
  });

  it('renderProgressoTopico: nota por item no multi-tópico, select no legado', () => {
    setupState();
    const multi = renderer.renderProgressoTopico({
      sessionTopicos: topicosDemo,
      discId: 'disc_a',
    });
    expect(multi).not.toContain('id="reg-status-topico"');
    expect(multi).toContain('definido por item');
    expect(multi).toContain('Topico 1');
    expect(multi).toContain('Finalizado');

    const legado = renderer.renderProgressoTopico({ sessionTopicos: [], discId: '' });
    expect(legado).toContain('id="reg-status-topico"');
  });

  it('renderRegistroForm envolve o progresso em container re-renderizável', () => {
    const baseArgs = {
      ev: { id: 'ev_ui', discId: 'disc_a', tempoAcumulado: 0, sessao: {} },
      sessionStartTime: null,
      sessionEndTime: null,
      sessionMode: 'cronometro',
      selectedTipos: ['questoes'],
      selectedMateriais: [],
    };

    const formMulti = renderer.renderRegistroForm({ ...baseArgs, sessionTopicos: topicosDemo });
    expect(formMulti).toContain('id="reg-progresso"');
    expect(formMulti).not.toContain('id="reg-status-topico"');
    expect(formMulti).toContain('Somado automaticamente');
    expect(formMulti).not.toContain('id="reg-q-total"');

    const formLegado = renderer.renderRegistroForm({ ...baseArgs, sessionTopicos: [] });
    expect(formLegado).toContain('id="reg-progresso"');
    expect(formLegado).toContain('id="reg-status-topico"');
    expect(formLegado).toContain('id="reg-q-total"');
  });

  it('add/update/remove de itens re-renderizam resumo e progresso ao vivo', () => {
    setupState({ evento: { sessao: { tiposEstudo: ['questoes'] } } });
    registro.openRegistroSessao('ev_ui');
    document.getElementById('reg-disciplina').value = 'disc_a';
    document.getElementById('reg-assunto').value = 'ass_1';
    document.getElementById('reg-aula').value = '';

    registro.addTopicoSessao();
    const resultados = document.getElementById('reg-resultados');
    const progresso = document.getElementById('reg-progresso');
    expect(resultados.innerHTML).toContain('Somado automaticamente');
    expect(resultados.innerHTML).not.toContain('id="reg-q-total"');
    expect(progresso.innerHTML).not.toContain('id="reg-status-topico"');
    expect(progresso.innerHTML).toContain('definido por item');

    registro.updateTopicoField(0, 'q-total', '10');
    registro.updateTopicoField(0, 'q-acertos', '8');
    expect(resultados.innerHTML).toContain('80%');

    registro.removeTopicoSessao(0);
    expect(resultados.innerHTML).toContain('id="reg-q-total"');
    expect(progresso.innerHTML).toContain('id="reg-status-topico"');
  });
});
