# Handoff — Aba "Pontos Fracos" (2026-07-09)

## O que foi feito

Nova aba **Pontos Fracos** (🎯, sidebar "Principal", `data-view="pontos-fracos"`): ranking dos
assuntos por taxa de acerto em questões (pior → melhor), agrupado por disciplina, com ação
rápida para estudar/agendar o assunto fraco. Implementado em 4 fases, todas com TDD e cada
uma commitada e pushada na `main` separadamente.

### Decisões de produto (confirmadas com o usuário em entrevista)

1. **Sinal**: taxa de acerto medida em questões (sem autoavaliação).
2. **Granularidade**: assunto, agrupado por disciplina (com taxa agregada da disciplina).
3. **Confiabilidade**: mínimo de 10 questões (`MIN_QUESTOES_CONFIAVEL`) para o ranking;
   abaixo → seção "Dados insuficientes"; zero → "Sem questões registradas".
4. **Janela**: padrão 90 dias; tabs 30d / 90d / Tudo ("Tudo" inclui `state.arquivo[]`).
5. **Escopo**: diagnóstico + botão "Estudar / Agendar" (abre o modal Iniciar Estudo
   pré-selecionado, via ação existente `add-evento-para-assunto`).
6. **Exibição**: todos os assuntos com dados, ordenados, faixas do Dashboard
   (<50% vermelho, 50–69% accent, ≥70% verde).
7. **Universo**: disciplinas não-arquivadas de todos os editais + filtros por edital/disciplina.

### Arquivos

| Fase | Commit | Arquivos |
|---|---|---|
| 1 | `feat: núcleo puro de pontos fracos` | `src/js/logic/weak-points.js` (novo, puro, zero imports — padrão `cycle-progress.js`), `tests/unit/weak-points-core.test.js` (22 testes) |
| 2 | `fix: pré-seleção de assunto concluído e editais no modal de evento` | `src/js/views.js` (`addEventoParaAssunto` insere option de assunto concluído), `src/js/ui/event-modals.js` (`allowAllEditaisInEventModal` inclui `pontos-fracos`), `tests/unit/pontos-fracos-modal-prereqs.test.js` |
| 3 | `feat: aba Pontos Fracos...` | `src/js/views/pontos-fracos-view.js` (novo), `src/index.html` (nav-item), `src/js/components.js` (titles + branch de view leve), `src/js/views.js` (barrel), `src/js/ui/actions/navegacao.js` (`set-pf-window`, `set-pf-edital-filter`, `set-pf-disc-filter`), describe novo em `tests/unit/views-modules.test.js` |
| 4 | `test: e2e da aba Pontos Fracos` | `tests/e2e/pontos-fracos.spec.js` (novo, 2 cenários), `tests/e2e/smoke-critical.spec.js` (view nas 3 listas) |

### Detalhes técnicos importantes

- `computeWeakPoints({ eventos, arquivo, editais, cutoffStr, editalFilterId, discFilterId })`
  → `{ disciplinas[], ranking[], insuficientes[], semQuestoes[], orfaos }`. `cutoffStr`
  ('YYYY-MM-DD' ou null) é pré-calculado pelo caller (`cutoffDateStr` de utils) — função
  determinística, testável sem fake timers.
- **Anti-dupla-contagem**: quando `ev.sessao.topicos[]` existe, só os itens contam
  (`ev.sessao.questoes` é soma derivada por `applyTopicosToEvent`). Legados: fallback
  `ev.sessao.questoes || ev.questoes` com `acertos??certas` / `erros??erradas` (espelha
  `getAggregatedStats`).
- Órfãos (assId que não existe mais) somam em `orfaos` + `naoAtribuidas` da disciplina do
  evento, apenas se a disciplina está no universo.
- Especificadores: view importada com `?v=8.37` (barrel), núcleo `../logic/weak-points.js`
  sem sufixo (consistente com `logic/progress.js`) — guardas `module-specifier-consistency`
  e `css-architecture` (radius tokens: usar `var(--radius-*)`) passam.
- `.claude/launch.json` criado (não versionado, `.claude` ignorado) para preview local:
  `npx http-server src -p 8087 -c-1`.

## Estado atual

- Suíte unit completa verde (136 arquivos / ~2200 testes). E2e `pontos-fracos.spec.js` e
  `smoke-critical.spec.js` verdes (chromium). `editais.spec.js` e2e continua pré-falho no
  repo (problema pré-existente, não relacionado).
- Validação manual no browser: navegação, empty state, tabs de janela e filtros OK, sem
  erros de console.
- Tudo commitado e pushado na `main`.

## O que falta / próximos passos possíveis (v2, não iniciados)

- Integrar pontos fracos ao peso do Ciclo (hoje o campo "conhecimento" da relevância é
  manual — poderia ser sugerido pela taxa medida).
- Suavização estatística (média bayesiana) em vez do corte fixo de 10 questões.
- Memoizar `computeWeakPoints` por `(cutoffStr, filtros)` se o modo "Tudo" pesar com
  milhares de eventos arquivados (hoje recalcula por render, como o Dashboard).
- Sparkline de evolução da taxa por assunto (reuso do padrão `getDisciplineSparkline`).
