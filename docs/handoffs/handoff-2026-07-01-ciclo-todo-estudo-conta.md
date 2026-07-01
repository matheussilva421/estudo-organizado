# Handoff — Ciclo de Estudos: modelo "todo estudo da disciplina conta"

**Data:** 2026-07-01

**Branch:** `claude/stoic-margulis-1334ad` (worktree)

**Contexto:** implementação das correções da auditoria
`docs/reports/2026-06-29-analise-fluxo-ciclo-calendario-study-organizer.md`.
O usuário decidiu pelo modelo da seção 20 do relatório (**todo estudo da
disciplina conta**, com reconciliação automática) — o OPOSTO da recomendação
original do relatório (vínculo explícito por `seqId`).

## O que foi feito

### Núcleo — fonte única de progresso

- **Novo módulo puro `src/js/logic/cycle-progress.js`** (sem dependências):
  - `getSeqStatus`, `computeStudiedMinutesByDiscipline(eventos, opts)`;
  - `distributeStudiedAcrossSeq(sequencia, minutosPorDisc)` — agora etapas
    `pulada` **não consomem** minutos do pool (bugfix descoberto na
    implementação, não estava no relatório) e o retorno ganhou o campo
    `shouldComplete`;
  - `reconcileSequenceWithEvents(plan, eventos)` — reconciliação idempotente:
    etapa pendente coberta pelo consumo vira `concluida` com a flag nova
    **`autoConcluida`**; etapa `autoConcluida` sem sustentação nos eventos
    reabre; conclusões manuais (sem a flag, inclui todo o legado) nunca
    regridem. Usa uma "sequência-sombra" em que etapas autoConcluida são
    reavaliadas como pendentes. **Nunca altera `planejamento.updatedAt`.**
- `src/js/logic/cycle.js`: wrappers de estado `getCycleProgress()` e
  `reconcileCycleProgress()`; removidas as versões locais de
  `getStudiedMinutesForSeq`/`getRemainingMinutesForSeq` (a cópia duplicada em
  session-save.js também foi removida).

### Convergência de leitura

- `syncCicloToEventos()` reconcilia no topo e usa `getCycleProgress` para a
  duração dos eventos (sessões sem `seqId` reduzem o restante agendado).
- `calculateCyclePredictionsModel()` e `iniciarEtapaPlanejamento()` usam a
  mesma distribuição. Previsão e agendador agora retornam o mesmo restante.
- A barra da Sequência (ciclo-view) já consumia o distribute compartilhado.

### Escrita

- `performSave` (session-save.js): `reconcilePlanningAfterSave(ev)` — toda
  sessão da disciplina avança o ciclo; o prompt "Concluir mesmo assim?"
  permanece apenas no fluxo vinculado (evento com `seqId`) quando a etapa
  segue pendente; sessões livres nunca mostram prompt.
- O checkbox opt-in "Vincular à próxima etapa pendente" foi **removido** do
  modal (modal-renderer.js) junto com seus helpers; substituído por nota
  informativa.
- Exclusão de sessão (`deleteCompletedSession`): reconcilia via
  `syncCicloToEventos()`; etapas `autoConcluida` reabrem silenciosamente; o
  prompt "Reabrir etapa?" permanece só para conclusões manuais.

### Sync e boot

- `mergeStudyStates` (sync-center.js) chama `reconcileSequenceWithEvents`
  sobre o resultado do merge — convergência entre dispositivos sem disputar
  autoria LWW do plano (não toca `updatedAt`).
- `loadStateFromDB` (store/indexeddb.js) reconcilia no boot.

### Achados secundários da auditoria

- **A4:** `dupSeqItem`/`updateSeqItem` (views.js) — duplicata nasce
  `pendente`; trocar disciplina reseta status/timestamps.
- **A5:** texto do confirm de "Limpar agendados" explica que são projeções
  recriáveis (removido o "não pode ser desfeita").
- **A6:** card "Pendentes hoje" e badge "N pendente(s) hoje" no Organizer.
- **A3:** rollover permanece **manual** (decisão: auto-rollover geraria
  conflito de `ciclosCompletos` entre dispositivos offline). Banner
  "Ciclo completo! 🎉" com CTA para `recomecarCiclo()` quando todas as
  etapas não-puladas estão concluídas; texto do wizard corrigido
  (step-renderers.js) para não prometer rollover automático.

## Testes (TDD red-green em todas as fases)

- Novo `tests/unit/cycle-progress.test.js` (16 testes do motor puro).
- Novos casos em `logic.test.js` (sessão sem seqId reduz evento; etapa 100%
  não reagendada), `registro-sessao.test.js` (auto-conclusão por sessão
  livre; reabertura silenciosa; modal sem checkbox), `sync-center.test.js`
  (4 testes de convergência no merge), `views-crud-more.test.js` (A4),
  `views-dashboard.test.js` (A6), `eventos-actions.test.js` (A5),
  `views-modules.test.js` (banner A3).
- Testes atualizados deliberadamente: os dois testes do checkbox opt-in
  (registro-sessao), guard de imports de cycle.js
  (logic-cycle-imports.test.js, agora permite `cycle-progress`), asserts
  `toEqual` do distribute (novo campo `shouldComplete`).

## Estado atual

- Suíte unit: verde (ver último run; ~1940 testes).
- Suíte sync (`npm run test:sync`): 332 testes verdes.
- CSS (`npm run test:css`): verde.
- Commits na branch `claude/stoic-margulis-1334ad`, um por fase.

## Pendências e ressalvas

1. **`npm run format:check` falha no repo inteiro (pré-existente):** não há
   `.prettierrc` no repositório e os defaults do Prettier (aspas duplas)
   conflitam com o estilo do código (aspas simples) — 152 arquivos falham,
   incluindo arquivos nunca tocados nesta sessão. NÃO reformatei. Sugestão:
   adicionar `.prettierrc` com `singleQuote: true` em tarefa própria.
2. **`action-contracts.test.js` ("bundleable")** mostrou uma falha flaky em
   um run completo do baseline; passa isolado e nos runs seguintes.
3. **E2E: 138/139 verdes** (`npm run test:e2e:release`, após
   `npx playwright install chromium`). A única falha —
   `tests/e2e/editais.spec.js` ("creates a new Edital...") — é
   **pré-existente**: reproduzida identicamente num worktree no commit
   `89e796f` (anterior a todas as mudanças desta sessão). O edital criado
   não aparece em `#main-content` após salvar. Investigar em tarefa própria.
   Nenhum spec e2e de ciclo/planejamento/sessões quebrou com o novo modelo.
4. **Edge conhecido:** recomeçar o ciclo no mesmo dia de sessões estudadas
   faz essas sessões contarem para a nova rodada (o corte `since` é por dia,
   `substring(0,10)` de `dataInicioCicloAtual`). Comportamento herdado da
   barra visual antiga; documentado, não alterado.
5. **`skippedSlots` legado** continua respeitado na leitura (sem mudança).
6. **Auto-revisão (2026-07-01):** achado e corrigido — "Desfazer etapa
   concluída"/"Reabrir etapa" viravam no-op silencioso quando o tempo da
   disciplina ainda cobria o alvo (a reconciliação re-concluía na hora).
   Agora `desfazerEtapa` detecta a re-conclusão e mostra toast explicando
   que é preciso excluir/editar sessões no Histórico para reabrir. Também
   adicionado o estilo `.reg-note` que faltava para a nota do modal.
7. **Consequência de migração (documentar ao usuário):** planos antigos sem
   `dataInicioCicloAtual` contam TODO o histórico de eventos — no primeiro
   boot após o update, etapas cujas barras já estavam em 100% serão
   auto-concluídas (e a agenda regenerada). É o comportamento pedido pelo
   modelo, mas pode surpreender.
8. **Nota de design:** `mergeStudyStates` agora muta o objeto de plano
   vencedor do LWW (reconcilia in-place). Os consumidores atuais aplicam o
   merged via setState logo em seguida, então é seguro — mas o merge deixou
   de ser puro em relação às entradas.

## Próximos passos sugeridos

1. Investigar a falha pré-existente de `tests/e2e/editais.spec.js`.
2. Adicionar `.prettierrc` (`singleQuote: true`) e normalizar o repo.
3. Considerar migração visual: badge na Sequência distinguindo conclusão
   automática (`autoConcluida`) de manual.
4. Atualizar o adendo do relatório da auditoria (feito em
   `docs/reports/...` — ver seção 23) caso o comportamento evolua.
