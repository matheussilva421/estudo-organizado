# Handoff — Issue #100: Importação de Edital via JSON

**Data:** 2026-10-05
**Branch:** `codex/issue-100-edital-json-import`
**Base sincronizada:** `e2b90ef96786ca908b563c0ad9e7b87cd034dfd1`
**Issue:** [#100](https://github.com/matheussilva421/estudo-organizado/issues/100) — aberta

## Objetivo e fontes

Implementar o importador especializado de edital JSON conforme a spec aprovada em `9b3d5ca6e758eb18a230296e38917187e7bce2f7` e o plano em `e2b90ef96786ca908b563c0ad9e7b87cd034dfd1`. Ambos foram lidos integralmente após fast-forward da `main`. A spec é a autoridade de comportamento; o plano organiza sete tarefas.

## Trabalho concluído

- Sincronizei a `main` de `f44dc85` para `e2b90ef` por fast-forward e criei a branch dedicada.
- Task 1: implementei o core puro com validação do schema `tipo: "edital"`, versão 1, normalização de nomes, canonicalização de duplicatas dentro do JSON, identidade/fingerprint de proveniência e candidatos separados por estado ativo/arquivado.
- Task 2: implementei matching 0/1/2+ no destino explícito, import plan com conflitos/summary e assinatura seletiva para stale preview.
- Task 3: implementei apply aditivo, construção imutável, stale guard, preservação de progresso, principal único, metadados e idempotência no merge.
- Task 4: implementei seleção local de JSON, validação e preview, escolha explícita de destino, confirmação atômica de `state.editais`, avisos de preservação, CSS responsivo e precache offline.
- Task 5: registrei a action `open-edital-import`, expus Importar Edital no topbar e nos empty states, mantendo Criar/Novo Edital.
- Task 6 (E2E completo) ainda não foi implementada.

## Arquivos alterados nesta fase

- Criados: `src/js/logic/edital-import-core.js`, `tests/unit/edital-import-core.test.js`.
- Criado para continuidade: este handoff.
- Tasks 2–3 também modificaram core e testes unitários.
- Task 4 criou `src/js/views/edital-import.js`, `src/css/views/edital-import.css`, `tests/unit/edital-import-view.test.js` e modificou `src/css/views.css` e `src/sw.js`.
- Task 5 modificou `src/js/ui/actions/editais.js`, `src/js/components.js`, `src/js/views/editais-view.js`, `tests/unit/editais-actions.test.js`, `tests/unit/editais-view-render.test.js` e `tests/unit/components.test.js`.
- O hook atualizou `src/sw.js`, `src/index.html`, `src/js/sync/sync-diagnostic.js` e `tests/unit/css-architecture.test.js` para os bumps `9.23 → 9.24 → 9.25 → 9.26 → 9.27 → 9.28`.
- Nenhum arquivo de `src/` fora do novo core foi alterado manualmente.

## Decisões técnicas

- A identidade usa `centralId` > `sourceRef` > nome normalizado; `sourceRevision` não compõe o fingerprint.
- Candidatos são devolvidos todos, em ordem de estado, sem seleção automática; arquivados ficam numa lista separada.
- Canonicalização mantém a primeira grafia e ordem, une filhos e preserva propriedades de proveniência/campos extras.
- `applyEditalImport` resolve o estado atual pelo plano e devolve uma nova lista; entidades reutilizadas preservam todas as propriedades e progresso. Somente `importMetadata` do edital destino é atualizado no merge.
- IDs e objetos novos são construídos antes do retorno; stale ou erro de `uid()` não modifica a entrada. Create como principal arquiva todos os editais então ativos; sem principal ativo, o importado é forçado como principal.
- O plano de preview é profundamente congelado; matching de merge é idempotente e create repetido continua deliberadamente permitido.
- O seletor de merge lista todos os editais ativos; nomes/proveniência apenas marcam sugestões e editais arquivados são exibidos informativamente, sem opção de destino.
- A UI deixa confirmação desabilitada até uma escolha explícita. A confirmação chama o apply sobre o estado atual, e somente depois substitui `state.editais`, invalida caches, agenda salvamento, fecha e renderiza.
- A action é um import dinâmico awaitable com o import specifier exigido `../../views/edital-import.js?v=8.37`; o topbar só mostra Importar Edital fora do dashboard de disciplina.
- `core.hooksPath` é `.githooks`; o pre-commit incrementa cache automaticamente para assets staged de `src/`. `APP_VERSION` na base é `9.23`; o mecanismo troca apenas essa versão e não os imports congelados `?v=8.37`.
- O helper SDD distribuído é Bash-only e falhou ao iniciar no sandbox Windows (`Win32 error 5` ao criar signal pipe); o workspace/brief/ledger foram preparados equivalentemente em PowerShell e cruzados com o plano.

## Testes e validações

- RED inicial: `npx vitest run tests/unit/edital-import-core.test.js` falhou pela ausência esperada de `edital-import-core.js`.
- Canonicalização e proveniência: REDs nas funções ainda ausentes, seguidos de GREEN.
- Atual: `npx vitest run tests/unit/edital-import-core.test.js` — 1 arquivo, 20 testes aprovados.
- Lint focado `npx eslint src/js/logic/edital-import-core.js` — aprovado.
- Task 2: RED inicial de matching (11 falhas por funções ausentes); um GREEN intermediário detectou contagem de tópicos na chave errada, reproduzida isoladamente e corrigida; stale RED (8 falhas) confirmou assinatura inicial insuficiente.
- Pós-Task 2: `npx vitest run tests/unit/edital-import-core.test.js` — 1 arquivo, 42 testes aprovados; ESLint focado aprovado; `npm run bump:check` aprovado.
- Task 3: RED inicial — 42 testes existentes passaram e 4 testes de apply/freeze falharam pela ausência de `applyEditalImport` e congelamento do plano; após implementação, `npx vitest run tests/unit/edital-import-core.test.js` — 1 arquivo, 54 testes aprovados.
- Task 3: `npx eslint src/js/logic/edital-import-core.js tests/unit/edital-import-core.test.js` e `git diff --check` — aprovados. O caso adversarial confirmou que progresso atualizado depois do preview segue intacto, que stale não pede IDs, e que erro intermediário de `uid()` mantém o JSON de entrada byte-for-byte igual.
- Task 4 RED inicial: `npx vitest run tests/unit/edital-import-view.test.js` falhou por ausência esperada do módulo de preview; após implementação, `npx vitest run tests/unit/edital-import-view.test.js tests/unit/edital-import-core.test.js` — 2 arquivos, 68 testes aprovados.
- Task 4: `npm run test:css` — 1 arquivo, 45 testes aprovados; ESLint focado e `git diff --check` — aprovados.
- Task 5 RED: action ausente e botões ausentes; após correção do setup de navegação no teste do topbar, o RED isolado confirmou a falta do botão no estado correto. GREEN: `npx vitest run tests/unit/editais-actions.test.js tests/unit/editais-view-render.test.js tests/unit/components.test.js` — 3 arquivos, 75 testes aprovados.
- Task 5: lint focado nos módulos/action/render e nos testes de action/render — aprovado. `tests/unit/components.test.js` retorna 19 erros pré-existentes `global is not defined`; `git show HEAD:tests/unit/components.test.js | npx eslint --stdin --stdin-filename tests/unit/components.test.js` confirmou os mesmos 19 erros na base, sem erro novo.
- `npm run bump:check` antes do commit apontou corretamente que o novo asset de `src/` precisa do bump `9.25`; o pre-commit fez `9.25 → 9.26`. Pós-commit, `npm run bump:check` passou sem assets pendentes.
- Baseline completo em `e2b90ef`: 143 arquivos e 2.258 testes aprovados, mas Vitest terminou com 1 erro não tratado (`TypeError: cache.match is not a function`, `src/sw.js:228`, atribuído a `tests/unit/sw-fetch-routing.test.js`). O mesmo teste isolado teve 5 testes aprovados e reproduziu o mesmo erro; portanto o problema antecede esta feature.
- Execuções Vitest precisam de permissão para spawn do esbuild; sem isso o sandbox retorna `EPERM` antes de iniciar a suíte.
- Validação manual no navegador ainda não realizada.

## GitHub e commits

- Issue #100 permanece aberta.
- Commit da Task 1: `36191534c0ad86be33a879b6bbfd30fc4d89445e` (`feat(edital-import): add pure validation and source identity`).
- Commit do handoff da Task 1: `c4fdbec` (`docs(handoff): record edital import task 1`).
- Commit da Task 2: `24fbc53400be755a277bda95e8c00e192bda3384` (`feat(edital-import): build safe import plans`).
- Commit da Task 3: `ecf95de` (`feat(edital-import): apply plans atomically`).
- Branch `codex/issue-100-edital-json-import` publicada em `origin` até `ecf95de`.
- Commit da Task 4: `b7646ff` (`feat(edital-import): add preview and atomic confirmation`).
- Branch `codex/issue-100-edital-json-import` publicada em `origin` até `b7646ff`.
- Commit da Task 5: `11e3299` (`feat(editais): expose JSON edital import`).
- Branch `codex/issue-100-edital-json-import` publicada em `origin` até `11e3299`.

## Pendências e retomada

1. Executar Task 6: E2E completo de preview → confirmação → persistência.
2. Executar Task 7: lint, design, bump check, `npm test`, E2E de release, revisão adversarial e verificação final.
3. Atualizar este handoff após cada fase; registrar commits, push e resultados finais.

O ledger detalhado e os logs de teste ficam em `.superpowers/sdd/2026-10-05-edital-json-import/` (ignorado pelo Git). O `pending.json` do hook SessionStart não existe para o `CODEX_SESSION_ID` desta sessão; não reutilizei o arquivo de outra sessão.
