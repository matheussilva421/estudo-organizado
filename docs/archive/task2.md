# Redesign da Página Inicial (Dashboard)

- [x] **Fase 1: Preparação de Dados e Estado**
  - [x] Adicionar campos `dataProva`, `metaHorasSemanais`, `metaQuestoesSemanais` no `state.config` (store.js).
  - [ ] Criar funções auxiliares em [logic.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/logic.js) para cálculos estatísticos:
    - [ ] Obter questões totais, acertos e erros de todo o histórico.
    - [ ] Calcular constância (current streak, max streak, e mapa de calor dos últimos dias).
    - [ ] Agrupar e calcular estatísticas de estudo por disciplina (tempo, questões, aproveitamento).
    - [ ] Calcular total de estudo e questões na semana atual.
    
- [ ] **Fase 2: Estrutura HTML da nova Home**
  - [ ] Substituir o conteúdo do [renderHome](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/views.js#36-185) em [views.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/views.js) para usar o novo grid layout (3 linhas principais).
  - [ ] **Linha 1:** Cards de "Tempo de Estudo" (Total), "Desempenho" (Acertos/Erros), "Progresso no Edital", Frase Motivacional.
  - [ ] **Linha 2:** Painel de "Constância nos Estudos" com texto de recorde e heatmap diário.
  - [ ] **Linha 3 (Esquerda):** Painel de "Disciplinas" contendo a tabela com Nome, Tempo, V(acertos), X(erros), %(aproveitamento).
  - [ ] **Linha 3 (Direita):** Cards de "Data da Prova" (countdown), "Metas de Estudo Semanal" (Barras de progresso para Horas e Questões), e "Estudo Semanal" (Gráfico em barras da atividade na semana).

- [ ] **Fase 3: Implementação Visual e CSS**
  - [ ] Adicionar estilos para os novos painéis, tabelas com scroll vertical, contadores de calendário e barras de progresso das metas.
  - [ ] Integrar ações interativas como edição de metas através de modais ou inputs "in-place".

- [ ] **Fase 4: Validação**
  - [ ] Testar cálculo da Constância com datas simuladas.
  - [ ] Verificar cálculos matemáticos do aproveitamento das questões e dos tópicos do edital.
  - [ ] Confirmar responsividade do layout em telas menores.
