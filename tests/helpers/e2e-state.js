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
      dataInicioCicloAtual: null
    },
    editais: [
      {
        id: 'ed_1',
        nome: 'Concurso TRF',
        cor: '#10b981',
        disciplinas: [
          {
            id: 'disc_1',
            nome: 'Direito Constitucional',
            icone: '📚',
            cor: '#10b981',
            assuntos: [
              {
                id: 'ass_1',
                nome: 'Controle de Constitucionalidade',
                concluido: false,
                dataConclusao: null,
                revisoesFetas: [],
                adiamentos: 0,
                linkedAulaIds: []
              }
            ],
            aulas: []
          }
        ]
      }
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
      paginas: []
    },
    revisoes: [],
    config: {
      visualizacao: 'mes',
      primeirodiaSemana: 1,
      mostrarNumeroSemana: false,
      agruparEventos: true,
      frequenciaRevisao: [1, 7, 30, 90],
      materiasPorDia: 3,
      metas: {
        horasSemana: 10,
        questoesSemana: 50
      }
    },
    cronoLivre: { _timerStart: null, tempoAcumulado: 0 },
    bancaRelevance: { hotTopics: [], userMappings: {}, lessonMappings: {} },
    driveFileId: null,
    lastSync: null
  };
}
