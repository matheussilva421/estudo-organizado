# Handoff — Auditoria de matemática/estatísticas/lógica de estudo (2026-06-10)

Goal ativo (loop contínuo): validar e corrigir a matemática do app — sessões, tempo,
histórico, hábitos, revisões, progresso, dashboards, ciclo e previsões. Números corretos
e consistentes entre telas. **Sync intocável** (Cloudflare/Firestore/Drive/IndexedDB
estrutural): só registrar achados aqui, nunca corrigir.

## Estado

- Branch `main`, working tree limpo, push em dia.
- Suíte de unidade: **1734/1734 verde** após os 8 ciclos abaixo.
- E2E (chromium): smoke `app.spec.js` 25/25; `revisoes-habitos` + `dashboard-stats` +
  `sessoes` 11/11.

## Ciclo 1 — caches de estatísticas não invalidados ao salvar/excluir sessão (`864b142`)

**Problema**: `performSave` (registro de sessão) usa `saveStateToDB()` direto — não passa
por `scheduleSave()`, que é quem dispara `app:invalidateCaches`. E `deleteCompletedSession`
chama `renderCurrentView()` síncrono ANTES do invalidate debounced de 100ms do
`scheduleSave`. Resultado: Home/Dashboard re-renderizavam com `_aggregatedStatsCache`,
`_streakCache` e `_pendingRevCache` velhos — totais não batiam com o Histórico logo após
registrar/excluir sessão.

**Fix**: invalidação explícita no call-site (`invalidateDashCaches` + `invalidateStreakCache`
+ `invalidatePendingRevCache`), padrão já usado em `delete-operations.js` e
`archiveDiscipline`. Arquivos: `src/js/registro-sessao/session-save.js`,
`src/js/registro-sessao.js`. Testes novos em `tests/unit/registro-sessao.test.js`
(2 testes: salvar e excluir refletem imediatamente em `getAggregatedStats`/streak).

## Ciclo 2 — Histórico: contador, cutoff UTC e baseline dos filtros (`62e28eb`)

Três defeitos em `src/js/views/historico-view.js` (+ `src/js/ui/actions/eventos.js`):

1. **"Exibindo X de Y"**: a lista é sempre escopada ao edital selecionado
   (`eventBelongsToSelectedEdital(..., { allowAll: false })` → sem seleção cai no PRIMEIRO
   edital), mas Y contava TODOS os eventos estudados. Era o "Exibindo 0 de 53" do
   screenshot do usuário. Agora Y = sessões do edital em escopo, e o empty state ganhou o
   caso "Nenhuma sessão neste edital" apontando o seletor da topbar.
2. **Cutoff de período em UTC**: `applyFilters` calculava o corte com
   `toISOString().split('T')[0]` — à noite em UTC-3 o cutoff avançava um dia e excluía
   sessões no limite da janela. Agora usa `cutoffDateStr()` (helper local canônico de
   `utils.js`). NB: não confundir com o achado DESCARTADO de timezone
   (memória `project-auditoria-achados-descartados` — aquele era parse local correto).
3. **Baseline "Limpar filtros"**: o default real é `rangeDays: 'all'`
   (`DEFAULT_UI_STATE.historico` em `ui-state.js`), mas o botão usava `'30'` como
   referência — aparecia em estado pristino e "limpar" estreitava o período. Botão e
   action agora usam `'all'`.

Testes: +3 em `tests/unit/views-modules.test.js`, 2 expectativas ajustadas em
`tests/unit/eventos-actions.test.js`.

## Ciclo 3 — Hábitos: % de aproveitamento e validação de simulado (`88ad29d`)

`src/js/views/habitos-view.js`:
- Histórico calculava % com `r.total`, mas registros manuais de questões gravam
  `quantidade` (só os vindos do registro de sessão têm `total`) — o % nunca aparecia
  para registros manuais. Agora deriva de `total ?? quantidade` com guard anti-NaN.
- Simulado aceitava `acertos > 0` com `total = 0` (a condição `total > 0 && acertos > total`
  não cobria total zerado).
- DESCARTADO: hipótese de dupla contagem de tempo entre tipos de hábito — os cards contam
  registros/questões/páginas, não somam `tempoMin` entre tipos.

## Ciclo 4 — Disciplinas arquivadas fora da recomendação preditiva (`8a5ce81`)

`src/js/logic/progress.js`: `getSubjectStats` alimenta o "foque um pouco mais em X" de
`getPredictiveStats` (Home + notificações); uma arquivada com pouco tempo vencia o sort
por menor tempo e era recomendada. A agregação (`subjectStats`) continua com todas as
disciplinas (ganhou flag `arquivada`); só o resultado exposto filtra.

## Ciclo 5 — Revisões: adiar atrasada e numeração da fila (`b7fefdf`)

`src/js/views/revisao-view.js`:
- `adiarRevisao` somava 1 em `adiamentos`; numa revisão atrasada há N dias a nova data
  continuava `<= hoje` e o item permanecia pendente. Agora desloca `N+1` (próxima
  ocorrência = amanhã). Adiar segue NÃO contando como feita (`revisoesFetas` intacto).
- `getUpcomingRevisoes` numerava como `feitas+1` ignorando a posição na fila restante —
  com uma atrasada pendente, a futura mostrava o mesmo "Nª Rev". Agora `feitas+1+índice`.
- Botão "⏩ +1 dia" → "⏩ Amanhã" (coerente com aria-label e semântica corrigida).
- Auditados e considerados corretos: `marcarRevisao` (avança um nível), `deletarRevisao`
  (skip estrutural via push em `revisoesFetas`), `clearVisibleRevisions`,
  `computeHabitStreak` (hábitos), `calcRevisionDates` (cache por chave completa).

## Ciclo 6 — Dashboard cortava período pela data agendada (`57f9022`)

`src/js/views/dashboard-view.js`: `renderDashboard`, `renderDailyChart` e `renderDiscChart`
usavam `e.data` (agendada) para o corte de período e para acumular minutos por dia,
enquanto Histórico/Home/`getAggregatedStats` usam `dataEstudo || data`. Sessão agendada em
janeiro e estudada ontem não aparecia no dashboard de 7 dias. Teste novo:
`tests/unit/dashboard-period.test.js` (3 testes, incluindo os dois gráficos via mock de
`Chart`).

## Ciclo 7 — Aula concluída via sessão sem dataEstudo (`1595577`)

`src/js/registro-sessao/session-save.js`: concluir aula pelo modal de sessão (status
"finalizado") marcava `estudada=true` sem `dataEstudo`; `getAulasWeeklyStats` ignora aulas
sem essa data → "Aulas concluídas na semana" (Home) nunca contava esse caminho. Agora
grava `ev.dataEstudo || ev.data`.

## Ciclo 8 — dataConclusao do assunto usa a data real do estudo (`5fc1fac`)

`src/js/registro-sessao/session-save.js`: finalizar tópico ao registrar sessão PASSADA
gravava `dataConclusao = hoje`, atrasando o cronograma de revisões (1/7/30/90) em relação
à conclusão real. Agora usa `ev.dataEstudo || ev.data` (mesmo padrão de hábitos/aulas).

## Achados ainda NÃO corrigidos (candidatos aos próximos ciclos)

1. **`getPredictiveStats` ignora o filtro de edital da Home**: a Home escopa weekStats por
   edital quando há seleção, mas a previsão usa `getCurrentWeekStats()` global e
   `subjStats` global (home-view.js:609). Mudança média — decidir com o usuário se a
   previsão deve ser global ou por edital.
2. **Streak zera de manhã**: `getConsistencyStreak` (progress.js) começa a contagem em HOJE —
   se o usuário ainda não estudou hoje, `currentStreak` = 0 mesmo com N dias seguidos até
   ontem. O streak de HÁBITOS (`computeHabitStreak` em habitos-view.js) já permite o gap de
   hoje. Unificar exige decisão de produto (mudança de fórmula visível).
3. **Páginas modo detalhado**: `total = fim - inicio` (não `fim - inicio + 1`) — decisão de
   produto, não mexer sem o usuário pedir.
4. **`revisoesFetas`** (typo) é o nome canônico consistente em todo o código e nos dados
   persistidos — NÃO "corrigir" o nome.
5. **Áreas auditadas e consideradas corretas** (não re-varrer sem motivo): timer
   (`getElapsedSeconds`/pause/retomada/descarte), `calculateContentProgress` (eixos
   tópicos/aulas), `getAggregatedStats` (semana/semana anterior/sparkline/streak dates),
   `calculateRelevanceWeights` + `generatePlanejamento` (pesos/round-robin),
   `distributeStudiedAcrossSeq` e `calculateCyclePredictionsModel` (fonte única
   `getStudiedMinutesByDiscipline`, derivada de eventos), validações de questões/páginas
   do registro de sessão, `computeHabitStreak`, percentuais da Home (guards `|| 0` e
   `Math.min(100, ...)`).

## Bloqueados (sync — não tocar)

- `sync.test.js`/`credentials.test.js` com specifiers `?v=8.28` desatualizados.
- Import sem `?v` em `sync/firestore-sync-engine.js`.

## Como retomar

1. `git status -sb` (deve estar limpo, main = origin/main).
2. Pegar o próximo achado da lista acima, TDD (red→green), suíte completa, commit, push,
   atualizar este handoff.
3. Validação manual sugerida ao final: Home, Dashboard, Histórico, Hábitos, Revisões,
   Ciclo e Calendário com dados populados (ver `scripts/screenshot-historico.mjs` como
   modelo de validação visual com `createE2EState()`).
