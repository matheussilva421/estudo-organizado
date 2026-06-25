# Handoff: aviso de carga diaria no calendario

Data: 2026-05-25

## Contexto

O usuario reportou que, mesmo apagando sessoes de estudo agendadas, o modal de adicionar sessao ainda exibia o aviso:

`2 evento(s) ja agendado(s) neste dia - 4.0h previstas`.

O sintoma foi reproduzido com um teste E2E focado: um evento visivel no edital ativo foi apagado pelo calendario, mas dois eventos de outro edital, escondidos pelo filtro visual, continuavam sendo contados pelo aviso de carga do dia.

## Causa raiz

`src/js/ui/event-modals.js` calculava o aviso com `state.eventos` inteiro. Ja o calendario e o painel do dia usam `filterEventsBySelectedEdital(..., { allowAll: false })`, ou seja, mostram apenas eventos do edital ativo.

Com isso, a UI podia mostrar o dia como vazio no calendario filtrado, mas o modal ainda somava eventos escondidos de outro edital.

## Alteracao feita

- `src/js/ui/event-modals.js`
  - Adicionado escopo compartilhado para o modal de evento.
  - O modal permite todos os editais apenas na Home.
  - Em telas filtradas, como Calendario/MED/Ciclo, o aviso de carga diaria e a confirmacao de sobrecarga usam o mesmo filtro de edital da tela.

- `tests/e2e/calendar.spec.js`
  - Adicionado E2E que apaga o evento visivel do edital ativo e verifica que o aviso mostra `Dia livre`, ignorando eventos escondidos por outro edital.

## Validacao

- RED: o novo E2E falhou antes da correcao com:
  - recebido: `2 evento(s) ja agendado(s) neste dia - 4.0h previstas`
  - esperado: `Dia livre`
- GREEN: o mesmo E2E passou apos a correcao (`ok 1`, 2.9s/3.0s), mas o processo Playwright ficou preso no teardown do runner ate o timeout do comando.
- Validacao limpa complementar:
  - `npm test -- tests/unit/eventos-actions.test.js tests/unit/edital-filter.test.js`
  - Resultado: 2 arquivos, 39 testes passando.

## Observacoes

- O Browser in-app tentou abrir `http://127.0.0.1:18345`, mas foi bloqueado com `ERR_BLOCKED_BY_CLIENT`; a reproducao foi feita em Chromium via Playwright.
- Antes desta tarefa, `git status --short` ja mostrava `D HANDOFF_CONTEXT.md`. Essa exclusao nao foi feita nesta correcao e nao deve ser incluida por engano em staging/commit.

## Proximo passo sugerido

Se outra IA continuar, rodar novamente o E2E focado ou a suite de calendario depois de investigar o teardown do Playwright local. O comportamento do teste ja ficou verde, mas o processo nao encerrou limpo neste ambiente.
