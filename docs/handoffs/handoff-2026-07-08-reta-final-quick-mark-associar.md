# Handoff — Reta Final: marcar como estudado, associar histórico, títulos com tópico e "Próxima Ação"

**Data:** 2026-07-08
**Branch:** `claude/study-history-scheduling-f87nop`
**Estado:** CONCLUÍDO (implementação + testes verdes). Pendências listadas abaixo são pré-existentes ou opcionais.

## O que foi feito

Plano executado na íntegra (4 funcionalidades, TDD red→green em todos os passos):

### 1. Marcar como estudado (quick-mark)

- `quickCompleteRetaFinalBloco(blocoId)` em `src/js/logic/reta-final.js`: promove o evento auto `agendado` do bloco para `estudei` (preserva `tempoAcumulado`), ou cria um se não existir. Seta `dataEstudo = hoje`, título com tópico, `sessao.topicos` do bloco (via `applyTopicosToEvent` + `buildTopicosFromRetaFinalBloco`, `statusTopico: 'em_andamento'`), carimba `ev.updatedAt` e finaliza com `syncRetaFinalToEventos()` + `scheduleSave()`.
- **Não** mexe em hábitos/revisões/`aula.estudada` — o usuário complementa editando a sessão no Histórico. Undo = excluir a sessão (reconcile reabre o bloco).
- Botão ✓ no card pendente (`data-action="rf-quick-mark"`), handler em `src/js/ui/actions/reta-final.js`.

### 2. Associar sessão do Histórico

- `listAssociableHistoryEvents(eventos, bloco)` no core (`reta-final-core.js`): `estudei`, sem `rfBlocoId`, mesma disciplina, ordenado por `dataEstudo` desc, cap 30.
- `associateHistoryEventToBloco(blocoId, eventoId)` em `logic/reta-final.js`: seta `rfBlocoId` + `ev.updatedAt`, **não altera** `data`/`dataEstudo` (data real preservada). Auto `agendado` órfão some no wipe do sync **sem tombstone** (testado).
- Picker novo em `src/js/views/reta-final-associar.js` reusando `#modal-prompt` (padrão de `openSubstitutionPrompt`, inclusive restauração do rótulo do botão salvar). Botão 🔗 no card pendente (`data-action="rf-associar-historico"`). Empty-state: "Nenhuma sessão estudada desta disciplina disponível."

### 3. Títulos com tópico

- `getRetaFinalTopicoLabel(bloco, disc)` movido da view para o core (view agora importa do core) + `buildRetaFinalEventTitle(bloco, disc)` → `"Disciplina — Tópico(s)"`, truncado em 120 chars, fallback `Estudar {nome}`.
- `syncRetaFinalToEventos` usa o título novo na materialização e ganhou um passo de **retítulo** de autos sustentados com título obsoleto — determinístico, **sem** carimbar `ev.updatedAt` nem `planejamento.updatedAt` (anti ping-pong LWW). Eventos preservados (estudei/com tempo) nunca são retitulados.

### 4. Hero "PRÓXIMA AÇÃO" (Página Inicial)

- `getNextRetaFinalBloco(plan, today)` no core: primeiro pendente com `data <= hoje` na ordem do array; senão o pendente futuro de menor data; senão `null`.
- `renderHero` (`home-view.js`) ganhou branch quando o plano ativo é `reta_final`: mostra disciplina + tópico do bloco + nome do plano (🏁); `null` cai no fallback `getNextSuggestedLesson`. CTAs inalterados.

## Arquivos tocados

- `src/js/logic/reta-final-core.js` — 4 funções novas (label, título, lister, next-bloco)
- `src/js/logic/reta-final.js` — quick-mark, associar, retítulo no sync, título na materialização (removido `getDiscNome`)
- `src/js/views/reta-final-view.js` — importa label do core; botões ✓/🔗 nos cards pendentes
- `src/js/views/reta-final-associar.js` — **novo** (picker)
- `src/js/ui/actions/reta-final.js` — ações `rf-quick-mark` e `rf-associar-historico`
- `src/js/views/home-view.js` — branch reta_final no hero
- `src/css/views/reta-final.css` — `.rf-bloco-actions`
- `src/sw.js` — precache de `reta-final-associar.js`
- `tests/unit/logic-cycle-imports.test.js` — guarda atualizado: `reta-final.js` pode importar `session-topics.js` (puro; guarda novo confirma zero imports nele)
- Testes novos/estendidos: `reta-final-core.test.js`, `reta-final-sync-eventos.test.js`, `reta-final-quick-mark.test.js` (novo), `reta-final-associar.test.js` (novo), `reta-final-view-actions.test.js` (novo), `home-view-hero.test.js` (novo), `tests/e2e/reta-final.spec.js` (+3 cenários)

## Verificação

- **Vitest:** 2102/2102 testes passam. Única suíte vermelha: `bump-cache.test.js` — **pré-existente** (falha idêntica em `main` limpo): `scripts/bump-cache.mjs` tem shebang `#!/usr/bin/env node` que o transform do Vitest não remove. Chip de tarefa separada criado para corrigir.
- **Playwright (`--project=chromium`):** `reta-final.spec.js` 6/6 (importação, rolagem, quick-mark, associar, hero, restauração) + `dashboard-fluxos`/`dashboard-stats`/`smoke-critical` 14/14.
- **Projeto `mock` do Playwright:** specs que fazem seed de `localStorage` falham lá **desde antes** desta branch (o servidor mock em 18765 não usa o seed) — não é regressão.
- Obs.: o teste `action-contracts > keeps the browser module graph bundleable` (spawna esbuild) pode flakear sob carga da suíte completa; passa isolado.

## Invariantes respeitadas (com testes de regressão)

- `bloco.status` nunca é mutado direto — sempre evento + reconcile.
- Bloco quick-marked entra em `getRetaFinalOccupiedBlocoIds` → não rola nem re-materializa ("sessão que volta").
- Só quick-mark e associar carimbam `ev.updatedAt`; retítulo/reconcile/rollover jamais; nada toca `planejamento.updatedAt`.
- Autos removidos pelo wipe não ganham tombstone.
- Imports com `?v=8.37` seguindo os pares; módulos puros (core, session-topics) sem sufixo.

## O que falta / próximos passos

1. **Nada obrigatório do plano.** Todos os 7 passos foram concluídos.
2. Opcional: validação manual visual (importar `docs/cronogramas/reta-final-tjce-2026.json`, quick-mark num bloco, conferir Histórico/Calendário/modal "Editar Estudo" e o hero) — os fluxos estão cobertos por E2E, mas ninguém olhou o layout dos botões novos num navegador real.
3. Pré-existente: corrigir `bump-cache.test.js` (shebang em `scripts/bump-cache.mjs`) — chip de tarefa já criado.
4. Pré-existente: seed de estado no projeto `mock` do Playwright não funciona (vários specs falham lá); decidir se o projeto mock deve ignorar specs com seed ou suportá-lo.
