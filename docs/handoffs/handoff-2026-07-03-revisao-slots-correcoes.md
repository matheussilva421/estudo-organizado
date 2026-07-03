# Handoff: correções da revisão de slots reais (commit 23e6895)

Data: 2026-07-03

## Contexto

Revisão do commit `23e6895` ("feat(ciclo): modelar slots reais no planejamento") em busca de
erros e bugs, seguida da correção dos problemas encontrados. Inclui bump de cache 8.98 → 8.99.

## Bugs encontrados e corrigidos

1. **ALTO — substituição mantinha `seqId` da etapa original** (`session-save.js`).
   Ao substituir o próprio evento planejado (disciplina trocada + "Substituir"), o evento
   virava `estudei` com a disciplina nova mas continuava vinculado à etapa original;
   `reconcilePlanningAfterSave` então oferecia "Concluir mesmo assim" para a etapa ERRADA e,
   se confirmado, `markPlanningSequenceCompleted` concluía a etapa substituída indevidamente.
   Fix: no bloco `mode === 'substituir'`, quando `slotEvent.id === ev.id`, remove `seqId` e
   `slotIndex` do evento antes da reconciliação.

2. **MÉDIO — prompt disparava ao editar sessão já estudada** (`getSubstitutionCandidates`).
   Sem checagem de status, editar uma sessão `estudei` trocando a disciplina abria o prompt e,
   pior, gravava `originalDiscId` com a disciplina NOVA (o snapshot só cobria eventos
   pendentes). Fix: o ramo não-livre agora exige `ev.status !== 'estudei' && !ev._isPastSession`.

3. **MÉDIO — HTML sem escape no prompt de substituição**. Nome de disciplina e `slot.id`
   entravam em `innerHTML` sem `esc()`. Fix: ambos escapados.

4. **BAIXO — rótulo "Registrar como extra" ficava preso no botão do modal-prompt** após
   cancelar (o modal é compartilhado; `promptDataProva`/`promptMetas` não redefinem o texto).
   Fix: listeners nos botões `close-modal` do `#modal-prompt` restauram 'Salvar' e se
   auto-removem em qualquer caminho de resolução.

5. **BAIXO — save abortado em silêncio** quando o `modal-prompt` não existe no DOM.
   Fix: `openSubstitutionPrompt` retorna `true` quando abriu; se não abriu, `performSave`
   prossegue como estudo extra em vez de descartar a sessão.

6. **BAIXO — comentário obsoleto** em `skipPlanejamentoEventBeforeDelete` (`cycle.js`)
   descrevia o design antigo (pular a ETAPA). Reescrito para a semântica atual (perda do slot;
   etapa segue pendente; override persistido).

7. **BAIXO — `materiasPorDia` sem clamp** no wizard (digitar 200 passava direto).
   Fix: clamp 1–15 em `pwUpdateHours`.

## Observações sem ação (já registradas no handoff anterior)

- `slotOverrides` no calendário não respeitam o filtro de edital ativo.
- Config global `materiasPorDia` segue como fallback legado.
- skippedSlots migrados aparecem retroativamente como "perdida" no calendário.

## TDD e validação

- Novos testes (RED confirmado antes das correções, GREEN depois):
  - `tests/unit/session-save-slots.test.js` (novo, 5 testes): desvínculo do `seqId` na
    substituição, prompt não dispara em sessão estudada, escape de HTML, fallback sem modal,
    restauração do rótulo do botão.
  - `tests/unit/planejamento-wizard.test.js`: clamp 1–15 de `materiasPorDia`.
  - `tests/unit/css-architecture.test.js`: contrato de cache atualizado para 8.99.
- Suíte unitária completa: **1947/1947 testes passaram** (117 arquivos).
- Lint: 0 erros (44 avisos preexistentes).
- E2E: `tests/e2e/calendar.spec.js` 4/4 e `tests/e2e/sync-devices.spec.js` 1/1 passaram
  (chromium do ambiente via symlink para o build esperado pelo Playwright).

## Estado atual

Branch `claude/code-review-bugs-hlc346` com todas as correções, testes e bump 8.99,
pronta para merge. Nenhuma pendência de código desta revisão.

## Próximos passos sugeridos

- Validar manualmente no navegador o fluxo de substituição (os itens do handoff anterior
  continuam valendo).
- Decidir sobre o filtro de edital para os marcadores de slot no calendário.
