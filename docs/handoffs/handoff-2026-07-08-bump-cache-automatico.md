# Handoff — Bump de cache automático (2026-07-08)

## O que foi feito

Automatizado o "bump de cache" do PWA que antes era 100% manual. Agora **nenhum humano ou IA precisa lembrar** de incrementar a versão: um hook `pre-commit` faz isso sozinho sempre que um commit altera assets de `src/`.

### Arquivos criados
- **`scripts/bump-cache.mjs`** — script de bump. Funções puras exportadas (`nextVersion`, `readCurrentVersion`, `bumpFiles`) + CLI. Lê a versão atual de `src/sw.js` (fonte da verdade) e substitui **apenas a versão atual exata** (`?v=X.YY` e `'X.YY'`) nos 4 arquivos sincronizados. Faz sanity check da contagem de ocorrências e só grava se todos os arquivos validarem (bump atômico).
- **`.githooks/pre-commit`** — hook (sh, compatível com Git Bash no Windows). Se o commit toca `src/*.{html,css,js,json,svg,png,webmanifest}` e a `APP_VERSION` staged é igual à do HEAD, roda `node scripts/bump-cache.mjs` e faz `git add` dos 4 arquivos. Escape hatch: `SKIP_CACHE_BUMP=1 git commit ...`.
- **`tests/unit/bump-cache.test.js`** — 12 testes (TDD, escritos antes da implementação): incremento, carry `9.99→10.00`, rejeição de formato, preservação dos `?v=8.37` congelados, atomicidade em caso de erro.

### Arquivos editados
- **`package.json`** — scripts `bump`, `bump:check` e `prepare` (o `prepare` roda `git config core.hooksPath .githooks` em todo `npm install`, ativando o hook automaticamente).
- **`.gitignore`** — allow-list de `.githooks/` (o gitignore usa padrão `/*` de bloqueio total).
- **`README_DEV.md`** — armadilha "Bump de cache" reescrita para documentar o fluxo automático.
- **`docs/releases/release-checklist.md`** — item de bump marcado como automático.

### Os 4 arquivos que o bump mantém em sincronia
1. `src/sw.js` → `APP_VERSION` (1x)
2. `src/index.html` → query strings `?v=X.YY` (9x)
3. `src/js/sync/sync-diagnostic.js` → `DIAGNOSTIC_BUILD_VERSION` (1x)
4. `tests/unit/css-architecture.test.js` → 3 asserções

**Nunca tocados:** os `?v=8.37` dos imports de módulos ES (381 ocorrências em `src/js/**`), versionados separadamente. O script só substitui a versão atual exata, então eles ficam intactos por construção — validado por teste.

## Estado atual

- Versão de cache: **9.02** (inalterada — a feature não mexe em asset de runtime, então não requer bump).
- Todos os 2062 testes unitários passam.
- Hook validado end-to-end: um commit de teste tocando `src/css/base.css` disparou o bump 9.02→9.03 nos 4 arquivos e preservou os 381 `?v=8.37`; o commit de teste foi desfeito para deixar a árvore limpa em 9.02.
- Branch: `claude/automatic-cache-bump-excfz9`.

## Uso

- Automático: só commitar. Se o commit mexe em asset de `src/`, a versão sobe sozinha.
- Manual: `npm run bump` (incrementa) ou `npm run bump -- --set X.YY`.
- Verificar sem alterar: `npm run bump:check` (sai com código 1 se `src/` mudou vs HEAD sem bump — útil para CI).
- Pular o hook num commit específico: `SKIP_CACHE_BUMP=1 git commit ...`.

## Próximos passos (opcional)

- Se um dia houver CI no GitHub Actions, adicionar `npm run bump:check` como gate para pegar bumps esquecidos em quem clonou antes de rodar `npm install` (e portanto sem o hook ativo).
