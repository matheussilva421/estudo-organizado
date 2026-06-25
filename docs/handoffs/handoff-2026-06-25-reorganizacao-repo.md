# Handoff — Reorganização do repositório e documentação

**Data:** 2026-06-25
**Branch:** `chore/reorganizacao-docs-repo`
**Escopo escolhido pelo usuário:** Completo + documentação única em `docs/` (raiz)

## Resumo do que foi feito

Reorganização de **meta/documentação** (o código em `src/` e `tests/` não foi
tocado). Objetivo: tirar o repositório de um estado desorganizado e alinhá-lo às
boas práticas.

### 1. Documentação consolidada em `docs/`
- `src/docs/` foi **extinto**; todo o conteúdo migrou para `docs/` na raiz via
  `git mv` (histórico preservado — 61 renames).
- Nova estrutura por finalidade: `architecture/`, `api/`, `security/`, `qa/`,
  `releases/`, `guides/`, `plans/`, `specs/`, `sync-hardening/`, `handoffs/`,
  `reports/`.
- Índice criado em `docs/README.md`.
- `src/` passa a conter **apenas código da app**.

### 2. Correções de versionamento
- `CLAUDE.md` e `CHANGELOG.md` agora versionados (faltavam na allowlist do
  `.gitignore`).
- `Abrir_Visual_Layout_Lab.bat` versionado.
- `HANDOFF_CONTEXT.md` movido da raiz → `docs/handoffs/`.

### 3. Limpeza de lixo
- Removidos `debug.log` (140 KB) e `Abrar_Estudo_Organizado_Mock.bat` (typo,
  duplicado) — ambos eram locais/não versionados.

### 4. Referências atualizadas
- `scripts/context-map.mjs` → grava `docs/context-map.json` (antes `src/docs/`).
- Novo script `npm run context:map`.
- `.aiexclude`/`.codexignore`/`.cursorignore`: `src/docs/superpowers/plans/` → `docs/plans/`.
- `AGENTS.md`, `README.md`, `README_DEV.md`: convenção e links de docs atualizados.
- `CHANGELOG.md`: entrada da reorganização em `[Unreleased]`.

## Arquivos criados / alterados / removidos
- **Criados:** `CLAUDE.md`, `CHANGELOG.md`, `docs/README.md`,
  `Abrir_Visual_Layout_Lab.bat` (passaram a ser rastreados).
- **Modificados:** `.gitignore`, `.aiexclude`, `.codexignore`, `.cursorignore`,
  `AGENTS.md`, `README.md`, `README_DEV.md`, `package.json`,
  `scripts/context-map.mjs`.
- **Movidos:** 61 arquivos (ver `git log --follow` / `git status`).
- **Removidos (local):** `debug.log`, `Abrar_Estudo_Organizado_Mock.bat`.

## Testes e validações
- `npm run lint` → **0 erros** (44 warnings pré-existentes de `no-unused-vars`).
- `npm run test:unit` → **1857 testes passaram, 0 falharam** (113 arquivos).
- `node scripts/context-map.mjs` → gera `docs/context-map.json` no novo caminho; OK.
- Verificado: nenhuma referência ativa a `src/docs` em código/configs/READMEs.
- PWA (`sw.js`/`index.html`) não referencia docs — sem impacto na app.

## Status do GitHub
- Branch `chore/reorganizacao-docs-repo` commitada e enviada (push).
- Pendente: abrir PR para `main` (ou merge direto, conforme preferência).

## Pendências / próximos passos
- Abrir PR e revisar antes do merge em `main`.
- (Opcional) Atualizar links internos **históricos** dentro de handoffs antigos
  que ainda citam caminhos `src/docs/...` — deixados como estão por serem
  registros datados.
- (Opcional) Avaliar bump de cache-busting se houver release após o merge.
