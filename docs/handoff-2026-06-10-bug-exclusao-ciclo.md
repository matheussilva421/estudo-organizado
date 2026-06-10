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

## Achado de SYNC (NÃO corrigido — aguarda aprovação; usuário autorizou investigar e propor)

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

1. `git status -sb` (limpo; main = origin/main até `dce29d7`).
2. Se o usuário aprovar a proposta de sync: TDD conforme plano acima (ALTO RISCO —
   área de sync, mudanças mínimas, sem tocar storage keys/schema destrutivo).
3. UX menor (opcional, decidir com usuário): no desktop, o badge "Etapa pulada" fica
   no bloco de ações que só aparece no hover — etapa pulada não é visível à primeira
   vista no card (no mobile aparece sempre).
