export function createAssunto(overrides = {}) {
  return {
    id: 'ass_1',
    nome: 'Assunto',
    concluido: false,
    dataConclusao: null,
    revisoesFetas: [],
    adiamentos: 0,
    linkedAulaIds: [],
    ...overrides
  };
}

export function createDisciplina(overrides = {}) {
  return {
    id: 'disc_1',
    nome: 'Disciplina',
    icone: '📚',
    cor: '#10b981',
    assuntos: [],
    aulas: [],
    ...overrides
  };
}

export function createEdital(overrides = {}) {
  return {
    id: 'ed_1',
    nome: 'Edital',
    cor: '#10b981',
    disciplinas: [],
    ...overrides
  };
}

export function createEvento(overrides = {}) {
  return {
    id: 'ev_1',
    titulo: 'Sessao de estudo',
    data: '2026-04-18',
    status: 'agendado',
    tempoAcumulado: 0,
    discId: null,
    assId: null,
    criadoEm: '2026-04-18T12:00:00.000Z',
    ...overrides
  };
}

export function createBaseState(overrides = {}) {
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
      dataInicioCicloAtual: null
    },
    editais: [],
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
      paginas: []
    },
    revisoes: [],
    config: {
      visualizacao: 'mes',
      primeirodiaSemana: 1,
      mostrarNumeroSemana: false,
      agruparEventos: true,
      frequenciaRevisao: [1, 7, 30, 90],
      materiasPorDia: 3
    },
    cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
    bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
    driveFileId: null,
    lastSync: null,
    ...overrides
  };
}
