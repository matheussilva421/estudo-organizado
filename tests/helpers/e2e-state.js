export function createE2EState() {
  return {
    schemaVersion: 7,
    ciclo: { ativo: false, ciclosCompletos: 0, disciplinas: [] },
    planejamento: {
      ativo: false,
      tipo: null,
      disciplinas: [],
      relevancia: {},
      horarios: {},
      sequencia: [],
      ciclosCompletos: 0,
      dataInicioCicloAtual: null,
    },
    editais: [
      {
        id: 'ed_1',
        nome: 'Concurso TRF',
        cor: '#0f766e',
        disciplinas: [
          {
            id: 'disc_1',
            nome: 'Direito Constitucional',
            icone: '📚',
            cor: '#0f766e',
            assuntos: [
              {
                id: 'ass_1',
                nome: 'Controle de Constitucionalidade',
                concluido: false,
                dataConclusao: null,
                revisoesFetas: [],
                adiamentos: 0,
                linkedAulaIds: [],
              },
            ],
            aulas: [],
          },
        ],
      },
    ],
    eventos: [],
    arquivo: [],
    habitos: {
      questoes: [],
      revisao: [],
      discursiva: [],
      simulado: [],
      leitura: [],
      informativo: [],
      sumula: [],
      videoaula: [],
      paginas: [],
    },
    revisoes: [],
    config: {
      visualizacao: 'mes',
      primeirodiaSemana: 1,
      mostrarNumeroSemana: false,
      agruparEventos: true,
      frequenciaRevisao: [1, 7, 30, 90],
      materiasPorDia: 3,
      globalSyncPaused: false,
      metas: {
        horasSemana: 10,
        questoesSemana: 50,
      },
    },
    cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
    bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
    driveFileId: null,
    lastSync: null,
  };
}

export function serializeE2EState(state) {
  return JSON.stringify(state);
}

export async function seedE2EState(page, state = createE2EState()) {
  await page.addInitScript((serializedState) => {
    window.Chart = class {
      destroy() {}
    };

    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serializedState);
  }, serializeE2EState(state));
}

export async function bootCleanE2EApp(page) {
  await page.addInitScript(() => {
    window.Chart = class {
      destroy() {}
    };

    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/');
}

export async function bootE2EApp(page, state = createE2EState()) {
  await seedE2EState(page, state);
  await page.goto('/');
}

export function collectConsoleErrors(page) {
  const errors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

export async function flushSaveAndReload(page) {
  await page.evaluate(async () => {
    await window.saveStateToDB?.();
  });
  await page.reload();
}
