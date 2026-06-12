// Visual Layout Lab — registry declarativo das telas e seus cards.
// Grid de 12 colunas. Spans e ORDEM default copiam o layout original do app:
//   home: dash-grid-top 4 col (3+3+3+3), hero full, dash-week-grid 4 col,
//         dash-grid-bottom 1.1fr/1fr (~6/6), quick actions full.
//   med:  sticky full, med-stats-row 3 col (4/4/4), seções full-width.
//   ciclo: header full, coluna esquerda 58fr (completos 2 + progresso 5,
//          sequência 7) e painel lateral 42fr (5/5).
//   dashboard: filtro full, stats-grid 4 col, grid-2 charts 6/6, grid-2 6/6.
//   habitos: habit-grid 3 col (4/4/4), histórico full.
// Altura default 'sm' = altura NATURAL do conteúdo (igual ao app);
// md/lg/xl são alturas fixas opcionais do lab.

export const SCREENS = [
  { id: 'home', label: 'Página Inicial' },
  { id: 'med', label: 'Study Organizer' },
  { id: 'ciclo', label: 'Ciclo de Estudos' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'habitos', label: 'Hábitos' },
];

export const REGISTRY = {
  home: [
    { id: 'home-kpi-tempo', title: 'Tempo de Estudo', span: 3, height: 'sm' },
    { id: 'home-kpi-desempenho', title: 'Desempenho', span: 3, height: 'sm' },
    { id: 'home-kpi-edital', title: 'Progresso no Edital', span: 3, height: 'sm' },
    { id: 'home-kpi-paginas', title: 'Páginas Lidas', span: 3, height: 'sm' },
    { id: 'home-hero', title: 'Hero (Countdown + Próxima Ação)', span: 12, height: 'sm' },
    { id: 'home-semana-horas', title: 'Horas Esta Semana', span: 3, height: 'sm' },
    { id: 'home-semana-questoes', title: 'Questões Esta Semana', span: 3, height: 'sm' },
    { id: 'home-semana-aulas', title: 'Aulas Concluídas', span: 3, height: 'sm' },
    { id: 'home-semana-paginas', title: 'Páginas Lidas (Semana)', span: 3, height: 'sm' },
    { id: 'home-progresso-disciplina', title: 'Progresso por Disciplina', span: 6, height: 'sm' },
    { id: 'home-previsao-semana', title: 'Previsão da Semana', span: 6, height: 'sm' },
    { id: 'home-estudo-semanal', title: 'Estudo Semanal', span: 6, height: 'sm' },
    { id: 'home-constancia', title: 'Constância · 30 dias', span: 6, height: 'sm' },
    { id: 'home-acoes', title: 'Ações Rápidas (Prova/Metas)', span: 12, height: 'sm' },
  ],
  med: [
    { id: 'med-resumo-dia', title: 'Resumo do Dia (Sticky)', span: 12, height: 'sm' },
    { id: 'med-stat-tempo', title: 'Tempo Total Hoje', span: 4, height: 'sm' },
    { id: 'med-stat-pendentes', title: 'Pendentes', span: 4, height: 'sm' },
    { id: 'med-stat-foco', title: 'Maior Foco', span: 4, height: 'sm' },
    { id: 'med-em-andamento', title: 'Em Andamento', span: 12, height: 'sm' },
    { id: 'med-agendado-hoje', title: 'Agendado para Hoje', span: 12, height: 'sm' },
    { id: 'med-agendado-amanha', title: 'Amanhã', span: 12, height: 'sm' },
    { id: 'med-proximos-dias', title: 'Próximos 7 dias', span: 12, height: 'sm' },
    { id: 'med-estudado-hoje', title: 'Estudado Hoje', span: 12, height: 'sm' },
  ],
  ciclo: [
    { id: 'ciclo-cabecalho', title: 'Cabeçalho do Planejamento', span: 12, height: 'sm' },
    { id: 'ciclo-stat-completos', title: 'Ciclos Completos', span: 2, height: 'sm' },
    { id: 'ciclo-stat-progresso', title: 'Progresso do Ciclo', span: 5, height: 'sm' },
    { id: 'ciclo-distribuicao', title: 'Distribuição do Ciclo', span: 5, height: 'sm' },
    { id: 'ciclo-sequencia', title: 'Sequência dos Estudos', span: 7, height: 'sm' },
    { id: 'ciclo-previsao', title: 'Previsão de Sessões', span: 5, height: 'sm' },
  ],
  dashboard: [
    { id: 'dash-filtro-periodo', title: 'Filtro de Período', span: 12, height: 'sm' },
    { id: 'dash-stat-tempo', title: 'Tempo Estudado', span: 3, height: 'sm' },
    { id: 'dash-stat-sessoes', title: 'Sessões Realizadas', span: 3, height: 'sm' },
    { id: 'dash-stat-questoes', title: 'Questões', span: 3, height: 'sm' },
    { id: 'dash-stat-simulados', title: 'Simulados', span: 3, height: 'sm' },
    { id: 'dash-chart-diario', title: 'Horas por Dia', span: 6, height: 'sm' },
    { id: 'dash-chart-disciplina', title: 'Tempo por Disciplina', span: 6, height: 'sm' },
    { id: 'dash-habitos', title: 'Hábitos (Resumo)', span: 6, height: 'sm' },
    { id: 'dash-progresso', title: 'Progresso por Disciplina', span: 6, height: 'sm' },
  ],
  habitos: [
    { id: 'hab-questoes', title: 'Questões', span: 4, height: 'sm' },
    { id: 'hab-revisao', title: 'Revisão', span: 4, height: 'sm' },
    { id: 'hab-discursiva', title: 'Discursiva', span: 4, height: 'sm' },
    { id: 'hab-simulado', title: 'Simulado', span: 4, height: 'sm' },
    { id: 'hab-leitura', title: 'Leitura Seca', span: 4, height: 'sm' },
    { id: 'hab-informativo', title: 'Informativos', span: 4, height: 'sm' },
    { id: 'hab-sumula', title: 'Súmulas', span: 4, height: 'sm' },
    { id: 'hab-videoaula', title: 'Videoaula', span: 4, height: 'sm' },
    { id: 'hab-paginas', title: 'Páginas Lidas', span: 4, height: 'sm' },
    { id: 'hab-historico', title: 'Histórico de Hábitos', span: 12, height: 'sm' },
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
