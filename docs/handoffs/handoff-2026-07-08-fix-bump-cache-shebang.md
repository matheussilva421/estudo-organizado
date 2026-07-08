# Handoff — Fix: bump-cache.test.js quebrado pelo shebang

**Data:** 2026-07-08
**Branch:** `claude/fix-bump-cache-shebang` (a partir de `main` f2da930)
**Estado:** CONCLUÍDO.

## Problema

`tests/unit/bump-cache.test.js` falhava com `SyntaxError: Invalid or unexpected token` ao importar `scripts/bump-cache.mjs`. Causa: o script começava com shebang `#!/usr/bin/env node` (introduzido nos commits 7b0ec2b/fbe7290). O Node tolera shebang ao executar, mas o pipeline de transform do Vitest/Vite não o remove ao **importar** o módulo no teste, quebrando o parse.

## Correção

Removido o shebang de `scripts/bump-cache.mjs` (com comentário explicando o porquê). É seguro porque **nenhum** chamador executa o arquivo diretamente — todos invocam via `node scripts/bump-cache.mjs`:

- `.githooks/pre-commit` (linha 34)
- `.github/workflows/auto-cache-bump.yml` (linha 74)
- `package.json` → `npm run bump` / `npm run bump:check`

## Verificação

- `npx vitest run tests/unit/bump-cache.test.js` → 12/12 passam.
- Suíte completa na branch: **127/127 arquivos, 2064/2064 testes verdes** (era o único pré-falho unitário).
- `node scripts/bump-cache.mjs --check` → executa e sai 0 (mesmo caminho do hook/Action).
- `sh .githooks/pre-commit` → sai 0 (sem assets staged; o caminho de bump real é coberto pelos testes de `bumpFiles`).

## Observações

- O hook pre-commit **não está ativo** nesta máquina (`git config core.hooksPath` vazio — precisaria de `git config core.hooksPath .githooks`). Quem garante o bump hoje é a GitHub Action no push para `main`.
- A branch `claude/study-history-scheduling-f87nop` (quick-mark/associar da Reta Final) menciona este pré-falho no handoff dela; após o merge desta correção, aquela suíte também fica 100% verde.

## Próximos passos

- Abrir PR de `claude/fix-bump-cache-shebang` para `main` (gh CLI ausente — usar a web).
- Opcional: ativar o hook localmente com `git config core.hooksPath .githooks`.
