# Handoff — Bug "excluir sessão → outra matéria volta" (2026-06-10)

Diagnóstico via `/diagnose` a partir de 3 screenshots do usuário (Study Organizer,
edital PGE-RN): ao excluir sessões agendadas, Direito Ambiental "voltava" para hoje.

## Causa raiz (reproduzida em harness determinístico)

Excluir um evento auto-gerado do ciclo gravava um **skip posicional** (`data#slotIndex`
em `planejamento.skippedSlots`) e regenerava a agenda (`syncCicloToEventos`). Três
defeitos faziam a matéria voltar:

1. **Wrap-around**: a sequência repete na janela de 14 dias (`% seq.length`); o skip
   apagava só UMA ocorrência — a matéria voltava 3-4 slots depois (repro: excluída em
   11/06, voltou 15/06, 19/06, 23/06; 4 exclusões para limpar a janela).
2. **Virada do dia**: skip preso à data; no dia seguinte qualquer regen re-agendava a
   matéria imediatamente (etapa continuava `pendente`).
3. **Timer parcial**: evento com `tempoAcumulado > 0` nem registrava skip
   (`skipPlanejamentoEventBeforeDelete` retornava false) — o próximo regen (disparado
   por excluir OUTRO evento) trazia a matéria de volta **para hoje, slot 0**. É o
   padrão exato dos screenshots.

Achado-chave: a tela Ciclo JÁ tinha o badge "⏩ Etapa pulada" + botão "Reabrir etapa"
(`desfazer-etapa`) renderizados para `status === 'pulada'`, mas **nenhum código
atribuía `'pulada'`** — bug de wiring (design original nunca ligado; mesmo padrão da
memória `project-auditoria-achados-descartados`).

## Correção (commit `dce29d7`, decisão do usuário: "excluir = pular a etapa")

`src/js/logic/cycle.js` — `skipPlanejamentoEventBeforeDelete` reescrita: marca a etapa
da sequência como `pulada` (`status`, `puladaEm`, limpa `finalizadoEm`); não grava mais
skips posicionais; o guard de `tempoAcumulado > 0` caiu (só `status === 'estudei'`
continua intocável). `skippedSlots` antigos persistidos seguem respeitados na leitura
(back-compat). `inferSlotIndex` removida (morta).

Comportamento novo: excluir uma sessão do ciclo remove a matéria de TODA a janela
(wrap incluído), não volta na virada do dia nem com timer parcial; reabrível na tela
Ciclo ("Reabrir etapa") e restaurada ao recomeçar o ciclo (`resetCicloAndWipeEvents`).

## Testes

- `tests/unit/logic.test.js`: novo describe "removeEvento → pular etapa do ciclo"
  (6 testes TDD red→green: wrap, virada de dia, timer parcial, estudei intocado,
  manual intocado, desfazerEtapa reabre). 2 testes antigos da semântica posicional
  atualizados; o teste de back-compat de skippedSlots persistidos mantido.
- `tests/e2e/calendar.spec.js`: teste do delete reescrito para a nova semântica
  (status pulada, skipped 0, badge + reabrir via hover — as ações do card só expandem
  no hover em desktop).
- Suíte de unidade: **1740/1740 verde**. E2E chromium: **137/137** (1 chaos test
  flaky de timing falhou na 1ª rodada e passou isolado — não relacionado).

## Achado de SYNC — CORRIGIDO (commit `1e3d329`, autorização expressa do usuário)

Implementação dos tombstones conforme a proposta abaixo (TDD, 17 testes novos):

- `src/js/sync/sync-center.js`: `recordSyncTombstone(state, col, id)` exportado;
  `mergeTombstones` (união por col:id com deletedAt mais novo, poda >180 dias,
  cap 2000); `mergeById` ganhou 3º parâmetro (índice de tombstones) e filtra item
  com tombstone `deletedAt >= updatedAt||criadoEm` — recriação posterior sobrevive.
  `merged.syncTombstones` sai do merge.
- Call-sites que gravam tombstone: `logic.js removeEvento` (exceto auto-gerado
  pendente sem tempo — derivado do plano, id por dispositivo);
  `registro-sessao.js deleteCompletedSession` (evento + hábitos vinculados por
  `eventoId`); `habitos-view.js deleteHabito`.
- Campo aditivo `state.syncTombstones`: viaja no payload (`createExportableState`
  clona o estado inteiro), sobrevive a `setState` (assign integral), clientes
  antigos ignoram (merge sem o campo = comportamento anterior).
- Validações: unit **1757/1757**; e2e chromium **137/137**; lint 43 warnings
  (mesma baseline, 0 erros).
- CORRIGIDO em `9effb30` (pedido do usuário): (a) `voltarPastSessionUI` agora grava
  tombstone do evento removido; (b) `planejamento` propaga entre dispositivos via
  LWW por `planejamento.updatedAt` — `touchPlanejamento()` (cycle.js, exportada por
  logic.js) é chamada em TODA mutação real do plano (pular/reabrir/concluir etapa,
  mover/editar/salvar sequência, reset/recomeçar/zerar ciclo, purgas ao excluir
  disciplina/edital, persistir janela de previsão); `mergeStudyStates` usa o plano
  remoto quando `updatedAt` remoto > local; sem o campo nos dois lados o local
  segue vencendo (clientes antigos = comportamento anterior). NUNCA chamar
  `touchPlanejamento` em regen de eventos (`syncCicloToEventos`) ou salvamentos
  genéricos — todo dispositivo reclamaria autoria e o LWW degeneraria.
  Validações: unit 1764/1764; e2e chromium 137/137; lint baseline (43 warnings).

## Proposta original (referência — implementada acima)

**Exclusões locais ressuscitam no merge.** Evidências:

- `sync-center.js` `mergeById` (linha 28): união por id SEM tombstones — item excluído
  localmente que ainda exista no payload remoto volta. Usado por `mergeStudyStates`
  para `eventos`, `arquivo`, `revisoes`, `habitos.*`, `editais`.
- O merge roda automaticamente: `pullFromCloudflare` aplica `mergeStudyStates` sempre
  que o remoto é mais novo; `forceCloudflareSync` = pull+push; mesmo padrão em
  `drive-sync.js` e `firestore-sync-engine.js:856`.
- Cenário real: dispositivo A exclui e faz push; B (ainda com o item) faz push depois;
  A puxa (remoto mais novo) → união → item volta em A e re-propaga.
- `sync-job-store.js` tem suporte a tombstones (`payload === null`) mas `createSyncJob`
  **nunca é chamado** — entity sync do plano 2026-04-29 ficou inacabado (código morto).
- Eventos não têm `updatedAt` mantido (só `criadoEm`) — LWW por item é fraco.
- Colateral: `mergeStudyStates` faz `{...remote, ...local}` — `planejamento` LOCAL
  sempre vence; mudanças de plano (incl. etapas `pulada`) **não propagam** via merge
  normal entre dispositivos (só em restore/forceOverwrite).

### Proposta (tombstones de exclusão, escopo mínimo)

1. Campo aditivo `state.syncTombstones: [{ col, id, deletedAt }]` (sem mudar storage
   keys; clientes antigos ignoram; precisa entrar no `createExportableState`).
2. Gravar tombstone nas exclusões reais do usuário: `removeEvento` (apenas eventos
   NÃO auto-gerados — autos têm id por device e são regenerados), 
   `deleteCompletedSession`, exclusões de hábitos.
3. `mergeStudyStates`: unir tombstones dos dois lados; `mergeById` filtra item com
   tombstone `deletedAt >= getItemUpdatedAt(item)`; poda (>180 dias) e cap (2000).
4. Fora de escopo: dedup de autos entre devices (auto-cura no regen); sync do
   planejamento (defeito separado, registrar).

### Plano de teste amplo (pré-requisito)

- Unit `sync-center`: exclusão local sobrevive a pull remoto mais novo; exclusão
  remota propaga; item recriado após tombstone (criadoEm > deletedAt) sobrevive;
  payload de cliente antigo sem o campo (sem crash, comportamento atual); poda/cap;
  tombstones viajam no export/import.
- Unit das operações: removeEvento manual grava tombstone, auto não; 
  deleteCompletedSession grava.
- Suíte de sync existente verde (`sync.test.js`, `credentials.test.js` — atenção:
  specifiers `?v=8.28` desatualizados nesses arquivos, pendência antiga).
- Smoke E2E completo + validação manual com 2 dispositivos/abas.

## Como retomar

1. `git status -sb` (limpo; main = origin/main até `8eddb48`).
2. Encerrado em `8eddb48`:
   - **Badge "Etapa pulada" visível sem hover**: movido do bloco de ações
     colapsado para o header do card (`.seq-item-pulada-badge`); "Reabrir etapa"
     segue nas ações (hover/focus em desktop, sempre visível no mobile). E2E em
     calendar.spec.js afirma que o badge não vive em container colapsado.
   - **BUG real pego pelo e2e novo**: `setState` (store.js) normaliza para uma
     whitelist FIXA de chaves e descartava `syncTombstones` — e `setState` roda
     no boot (`_setStateRef`) e nos pulls, então todo reload/pull apagaria os
     tombstones. Campo adicionado à whitelist (replace e merge) + 2 testes em
     store.test.js. Lição: campo novo de estado SEMPRE precisa entrar na
     whitelist do setState.
   - **`tests/e2e/sync-devices.spec.js`** (novo): simula 2 dispositivos no app
     real — A exclui sessão manual + pula etapa via UI do calendário; payload de
     A (`createExportableState`) mesclado em B via `mergeStudyStates` (mesmo
     caminho do pull) + `syncCicloToEventos`; afirma exclusão propagada, etapa
     pulada no plano de B, badge visível, e round-trip B→A sem ressuscitar nada.
   - Validações: unit **1766/1766**; e2e chromium **138/138**; lint baseline.
3. Validação manual opcional: repetir o cenário com 2 dispositivos reais e o
   sync de produção (Cloudflare/Firestore) — o e2e cobre o merge, não o
   transporte/credenciais.

## Extra: README reorganizado (após `67511de`)

`README.md` reescrito para refletir o app atual (pedido do usuário). Correções:
temas reais (Grafite/Ardósia/Platina/Terminal/Neon/Arrakis — antes citava temas
legados Furtivo/Rubi/Matrix), 9 categorias de hábitos (antes 6, incluía "Flash
Cards" inexistente), view Histórico de Sessões adicionada, contagem de testes
(~1760 unit + 24 specs e2e, antes "393"), migrações v1→v10, árvore de pastas
atual (css modularizado, store/, sync/ completo), seção nova "Merge entre
dispositivos" (tombstones + LWW do planejamento), scripts npm atuais e sumário.
Sem mudança de código; nenhum teste referencia o README.

## Extra na mesma sessão (`c5cbc07`)

Bug de UI no Histórico (screenshot do usuário): a toolbar de filtros aparecia
esmagada (~26px) com a lista populada. Causa: `.card` base tem `overflow:hidden`
→ `min-height:auto` = 0 → o flex column do `#main-content` encolhe o card quando
o conteúdo passa da viewport (por isso só com lista populada). Fix: 
`.historico-toolbar.card` na lista de isenção `height:auto/overflow:visible`
(`styles.css`, bloco "Dynamic cards"). E2E geométrico novo em
`tests/e2e/sessoes.spec.js`. Padrão a lembrar: qualquer card novo numa view que
rola PRECISA da isenção, senão é esmagado. Bumps de cache: `492ab0f` (8.91) e
`c5cbc07` (8.92).
