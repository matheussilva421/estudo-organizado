# Handoff: fix do slot re-populado ("sessão apagada que volta")

Data: 2026-07-07

## O que foi feito

### Diagnóstico (skill /diagnose, com o backup real do usuário)

Sintoma relatado: apagar uma sessão de estudo fazia ela "voltar", re-populando o slot.

Feedback loop: teste vitest temporário que carregava o backup real
(`D:/Gdrive/Projects AI/estudo-organizado-backup-2026-07-07.json`), congelava o relógio em
2026-07-07 e rodava `syncCicloToEventos`. Reproduzido de primeira (arquivo temporário
removido depois — continha caminho para dados pessoais; NÃO recriar no repo).

Causa raiz confirmada: o gerador em `syncCicloToEventos` (`src/js/logic/cycle.js`) itera
`m = 0..materiasPorDia-1` por dia e pulava apenas `skippedSlots`/`slotOverrides` — nunca
checava se o slot já estava OCUPADO por um evento preservado (sessão `estudei` ou com
`tempoAcumulado > 0`). Como a etapa segue pendente quando o alvo não foi batido ("todo
estudo conta"), qualquer regen (pós-save, pós-delete, boot) criava um novo pendente no
mesmo slot do dia da sessão estudada. O usuário apagava, o regen preenchia o outro slot,
ele apagava de novo — por isso o backup tinha pares de `slotOverrides` "perdido"
encadeados em milissegundos (dias 03, 06 e 07/07) e marcas "perdida" falsas no calendário
em dias em que ele de fato estudou.

Hipóteses descartadas: override não persistido no delete (o fluxo
`removeEvento → skipPlanejamentoEventBeforeDelete` funciona — testado com o backup);
ressurreição via sync/tombstones (não envolvida).

### Fix (TDD: RED confirmado antes, GREEN depois)

- `getOccupiedSlotKeySet(eventos)` em `src/js/logic/cycle.js`: conjunto de chaves
  `data#slotIndex` de eventos auto-gerados preservados (`estudei` ou tempo > 0, com
  `slotIndex` numérico).
- `syncCicloToEventos`: slots ocupados entram no mesmo skip de
  `skippedSlots`/`slotOverrides` (avançando a rotação, como os demais skips).
- `calculateCyclePredictionsModel`: mesma regra, mantendo a paridade previsão ↔ agenda
  que o próprio comentário do código promete.
- Bump de cache 8.99 → 9.00 (`src/index.html`, `src/sw.js`,
  `src/js/sync/sync-diagnostic.js`, contrato em `tests/unit/css-architecture.test.js`).

### Testes

- Novo `tests/unit/cycle-sync-occupied-slots.test.js` (6 testes): slot estudado não
  re-preenchido; dia cheio sem novos pendentes; timer parcial ocupa slot; ocupado +
  override zera o dia; previsão não conta slot ocupado; fluxo completo
  estudar → regen → apagar fantasma → nada volta.
- Suíte unitária completa: 1953/1953 (118 arquivos) antes do bump; css-architecture
  re-validado depois do bump. Lint: 0 erros nos arquivos alterados.

## Comportamento esperado após o fix (validar com o usuário)

- Estudar uma sessão não recria pendente no mesmo slot do dia.
- Com `materiasPorDia: 2` e só 1 sessão estudada no dia, ainda aparece 1 pendente no
  slot livre — isso é design (capacidade do dia), não o bug. Apagar esse pendente cria
  override "perdido" e ele não volta (coberto por teste).
- Os overrides "perdido" falsos já gravados no backup do usuário (dias 03, 06, 07/07)
  continuam no estado dele — são dados, não código. Se incomodarem no calendário, é
  limpeza de dados a discutir.

## Estado atual

- Branch `main` com fix, testes, CHANGELOG e bump 9.00 commitados e enviados ao GitHub
  (ver commit `fix(ciclo): agendador não re-popula slot ocupado por sessão preservada`).

## Próximos passos sugeridos

- Validação manual no navegador: estudar uma sessão do ciclo e confirmar que o slot não
  re-popula; apagar o pendente restante do dia e confirmar que não volta.
- Decidir se haverá limpeza/ocultação dos overrides "perdido" falsos históricos gerados
  pelo bug (aparecem como "perdida" no calendário em dias estudados).
- Pendências antigas seguem: filtro de edital para marcadores de slot no calendário;
  `materiasPorDia` global como fallback legado.
