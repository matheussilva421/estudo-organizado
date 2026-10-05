# Handoff — Issue #100: Importação de Edital via JSON

**Data:** 2026-10-05
**Branch:** `codex/issue-100-edital-json-import`
**Base sincronizada:** `e2b90ef96786ca908b563c0ad9e7b87cd034dfd1`
**Issue:** [#100](https://github.com/matheussilva421/estudo-organizado/issues/100) — aberta

## Objetivo e fontes

Implementar o importador especializado de edital JSON conforme a spec aprovada em `9b3d5ca6e758eb18a230296e38917187e7bce2f7` e o plano em `e2b90ef96786ca908b563c0ad9e7b87cd034dfd1`. Ambos foram lidos integralmente após fast-forward da `main`. A spec é a autoridade de comportamento; o plano organiza sete tarefas.

## Trabalho concluído

- Sincronizei a `main` de `f44dc85` para `e2b90ef` por fast-forward e criei a branch dedicada.
- Task 1: implementei o início do core puro com validação do schema `tipo: "edital"`, versão 1, normalização de nomes, canonicalização de duplicatas dentro do JSON, identidade/fingerprint de proveniência e candidatos separados por estado ativo/arquivado.
- O preview/matching/apply/UI ainda não foram implementados.

## Arquivos alterados nesta fase

- Criados: `src/js/logic/edital-import-core.js`, `tests/unit/edital-import-core.test.js`.
- Criado para continuidade: este handoff.
- Nenhum arquivo de `src/` da aplicação fora do novo core foi alterado manualmente.

## Decisões técnicas

- A identidade usa `centralId` > `sourceRef` > nome normalizado; `sourceRevision` não compõe o fingerprint.
- Candidatos são devolvidos todos, em ordem de estado, sem seleção automática; arquivados ficam numa lista separada.
- Canonicalização mantém a primeira grafia e ordem, une filhos e preserva propriedades de proveniência/campos extras.
- `core.hooksPath` é `.githooks`; o pre-commit incrementa cache automaticamente para assets staged de `src/`. `APP_VERSION` na base é `9.23`; o mecanismo troca apenas essa versão e não os imports congelados `?v=8.37`.
- O helper SDD distribuído é Bash-only e falhou ao iniciar no sandbox Windows (`Win32 error 5` ao criar signal pipe); o workspace/brief/ledger foram preparados equivalentemente em PowerShell e cruzados com o plano.

## Testes e validações

- RED inicial: `npx vitest run tests/unit/edital-import-core.test.js` falhou pela ausência esperada de `edital-import-core.js`.
- Canonicalização e proveniência: REDs nas funções ainda ausentes, seguidos de GREEN.
- Atual: `npx vitest run tests/unit/edital-import-core.test.js` — 1 arquivo, 20 testes aprovados.
- Lint focado `npx eslint src/js/logic/edital-import-core.js` — aprovado.
- Baseline completo em `e2b90ef`: 143 arquivos e 2.258 testes aprovados, mas Vitest terminou com 1 erro não tratado (`TypeError: cache.match is not a function`, `src/sw.js:228`, atribuído a `tests/unit/sw-fetch-routing.test.js`). O mesmo teste isolado teve 5 testes aprovados e reproduziu o mesmo erro; portanto o problema antecede esta feature.
- Execuções Vitest precisam de permissão para spawn do esbuild; sem isso o sandbox retorna `EPERM` antes de iniciar a suíte.
- Validação manual no navegador ainda não realizada.

## GitHub e commits

- Issue #100 permanece aberta.
- Branch local criada; commits da Task 1 estão em preparação neste checkpoint. Push ainda não realizado.

## Pendências e retomada

1. Fechar Task 1 com commit scoped e registrar o SHA aqui.
2. Executar Tasks 2–3: matching/import plan, stale signature, apply atômico, preservação, principal único e idempotência.
3. Executar Tasks 4–6: UI/preview/actions, precache e E2E completo.
4. Executar Task 7: lint, design, bump check, `npm test`, E2E de release, revisão adversarial e verificação final.
5. Atualizar este handoff após cada fase; registrar commits, push e resultados finais.

O ledger detalhado e os logs de teste ficam em `.superpowers/sdd/2026-10-05-edital-json-import/` (ignorado pelo Git). O `pending.json` do hook SessionStart não existe para o `CODEX_SESSION_ID` desta sessão; não reutilizei o arquivo de outra sessão.
