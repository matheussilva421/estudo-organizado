// Visual Layout Lab — registry declarativo das telas e seus cards.
// Cada card é um bloco de topo da view real (granularidade decidida no grill
// de 2026-06-12): id estável, título pt-BR, span default (1..4) e altura
// default (sm/md/lg/xl).

export const SCREENS = [
  { id: 'home', label: 'Página Inicial' },
  { id: 'med', label: 'Study Organizer' },
  { id: 'ciclo', label: 'Ciclo de Estudos' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'habitos', label: 'Hábitos' },
];

export const REGISTRY = {
  home: [
    { id: 'home-kpi-tempo', title: 'Tempo de Estudo', span: 1, height: 'sm' },
    { id: 'home-kpi-desempenho', title: 'Desempenho', span: 1, height: 'sm' },
    { id: 'home-kpi-edital', title: 'Progresso no Edital', span: 1, height: 'sm' },
    { id: 'home-kpi-paginas', title: 'Páginas Lidas', span: 1, height: 'sm' },
    { id: 'home-hero', title: 'Hero (Countdown + Próxima Ação)', span: 4, height: 'sm' },
    { id: 'home-semana-horas', title: 'Horas Esta Semana', span: 1, height: 'sm' },
    { id: 'home-semana-questoes', title: 'Questões Esta Semana', span: 1, height: 'sm' },
    { id: 'home-semana-aulas', title: 'Aulas Concluídas', span: 1, height: 'sm' },
    { id: 'home-semana-paginas', title: 'Páginas Lidas (Semana)', span: 1, height: 'sm' },
    { id: 'home-progresso-disciplina', title: 'Progresso por Disciplina', span: 2, height: 'xl' },
    { id: 'home-previsao-semana', title: 'Previsão da Semana', span: 2, height: 'md' },
    { id: 'home-estudo-semanal', title: 'Estudo Semanal', span: 2, height: 'md' },
    { id: 'home-constancia', title: 'Constância · 30 dias', span: 2, height: 'sm' },
  ],
  med: [
    { id: 'med-resumo-dia', title: 'Resumo do Dia (Sticky)', span: 4, height: 'sm' },
    { id: 'med-stat-tempo', title: 'Tempo Total Hoje', span: 2, height: 'sm' },
    { id: 'med-stat-pendentes', title: 'Pendentes', span: 1, height: 'sm' },
    { id: 'med-stat-foco', title: 'Maior Foco', span: 1, height: 'sm' },
    { id: 'med-em-andamento', title: 'Em Andamento', span: 4, height: 'sm' },
    { id: 'med-agendado-hoje', title: 'Agendado para Hoje', span: 2, height: 'md' },
    { id: 'med-agendado-amanha', title: 'Amanhã', span: 2, height: 'md' },
    { id: 'med-proximos-dias', title: 'Próximos 7 dias', span: 2, height: 'md' },
    { id: 'med-estudado-hoje', title: 'Estudado Hoje', span: 2, height: 'md' },
  ],
  ciclo: [
    { id: 'ciclo-cabecalho', title: 'Cabeçalho do Planejamento', span: 4, height: 'sm' },
    { id: 'ciclo-stat-completos', title: 'Ciclos Completos', span: 1, height: 'sm' },
    { id: 'ciclo-stat-progresso', title: 'Progresso do Ciclo', span: 3, height: 'sm' },
    { id: 'ciclo-sequencia', title: 'Sequência dos Estudos', span: 2, height: 'xl' },
    { id: 'ciclo-distribuicao', title: 'Distribuição do Ciclo', span: 2, height: 'md' },
    { id: 'ciclo-previsao', title: 'Previsão de Sessões', span: 2, height: 'md' },
  ],
  dashboard: [
    { id: 'dash-filtro-periodo', title: 'Filtro de Período', span: 4, height: 'sm' },
    { id: 'dash-stat-tempo', title: 'Tempo Estudado', span: 1, height: 'sm' },
    { id: 'dash-stat-sessoes', title: 'Sessões Realizadas', span: 1, height: 'sm' },
    { id: 'dash-stat-questoes', title: 'Questões', span: 1, height: 'sm' },
    { id: 'dash-stat-simulados', title: 'Simulados', span: 1, height: 'sm' },
    { id: 'dash-chart-diario', title: 'Horas por Dia', span: 2, height: 'md' },
    { id: 'dash-chart-disciplina', title: 'Tempo por Disciplina', span: 2, height: 'md' },
    { id: 'dash-habitos', title: 'Hábitos (Resumo)', span: 2, height: 'md' },
    { id: 'dash-progresso', title: 'Progresso por Disciplina', span: 2, height: 'md' },
  ],
  habitos: [
    { id: 'hab-questoes', title: 'Questões', span: 1, height: 'sm' },
    { id: 'hab-revisao', title: 'Revisão', span: 1, height: 'sm' },
    { id: 'hab-discursiva', title: 'Discursiva', span: 1, height: 'sm' },
    { id: 'hab-simulado', title: 'Simulado', span: 1, height: 'sm' },
    { id: 'hab-leitura', title: 'Leitura Seca', span: 1, height: 'sm' },
    { id: 'hab-informativo', title: 'Informativos', span: 1, height: 'sm' },
    { id: 'hab-sumula', title: 'Súmulas', span: 1, height: 'sm' },
    { id: 'hab-videoaula', title: 'Videoaula', span: 1, height: 'sm' },
    { id: 'hab-paginas', title: 'Páginas Lidas', span: 1, height: 'sm' },
    { id: 'hab-historico', title: 'Histórico de Hábitos', span: 4, height: 'lg' },
  ],
};

export function getScreenRegistry(screenId) {
  return REGISTRY[screenId] || [];
}

export function findCard(cardId) {
  for (const screen of SCREENS) {
    const card = REGISTRY[screen.id].find((c) => c.id === cardId);
    if (card) return { ...card, screenId: screen.id, screenLabel: screen.label };
  }
  return null;
}
