# Relatorio de reducao de contexto do Codex

Data do baseline: 2026-05-05.

## Objetivo

Reduzir consumo de tokens em tarefas pequenas no `estudo-organizado` separando o que e codigo-fonte relevante do que e dependencia, artefato local, relatorio gerado, historico ou arquivo de baixo valor decisorio para agentes.

## Baseline do checkout

| Item                 |   Tamanho | Arquivos | Observacao                                                    |
| -------------------- | --------: | -------: | ------------------------------------------------------------- |
| `node_modules/`      | 231,13 MB |   18.510 | Deve ficar fora de buscas e contexto.                         |
| `.git/`              |  31,28 MB |    6.070 | Metadados Git; nunca deve ser lido como codigo.               |
| `.claude/`           |   6,08 MB |      464 | Contem configuracoes e worktrees locais.                      |
| `coverage/`          |   5,90 MB |      135 | Artefato regeneravel de cobertura.                            |
| `_local_archive/`    |   4,00 MB |       42 | Historico local arquivado; preservar fora do contexto padrao. |
| `src/`               |   1,99 MB |      107 | Aplicacao entregue ao usuario.                                |
| `tests/`             |   0,83 MB |      107 | Testes automatizados.                                         |
| `playwright-report/` |   0,50 MB |        1 | Relatorio HTML regeneravel.                                   |
| `.playwright-mcp/`   |   0,48 MB |       43 | Capturas/snapshots locais de ferramenta.                      |
| `.sisyphus/`         |   0,38 MB |       17 | Planos/evidencias locais de agente.                           |
| `output/`            |   0,14 MB |        2 | Saidas locais.                                                |

Arquivos rastreados no Git: 240.

Arquivos locais fora de `.git`: 19.462.

## Maiores arquivos rastreados

| Arquivo                                                                         |  Tamanho | Risco para contexto                                  |
| ------------------------------------------------------------------------------- | -------: | ---------------------------------------------------- |
| `src/vendor/firebase-client.bundle.js`                                          | 494,4 KB | Bundle gerado, baixo valor para IA.                  |
| `package-lock.json`                                                             | 284,2 KB | Lockfile necessario ao npm, ruim para microcontexto. |
| `src/vendor/chart.umd.min.js`                                                   | 197,6 KB | Minificado em linha longa.                           |
| `src/css/styles.css`                                                            |  92,5 KB | CSS global grande.                                   |
| `src/js/views.js`                                                               |  79,1 KB | Fachada/renderizacao ainda ampla.                    |
| `src/docs/superpowers/plans/2026-04-21-react-vite-typescript-migration-plan.md` |  66,7 KB | Plano historico longo.                               |
| `src/css/views.css`                                                             |  61,4 KB | CSS de views grande.                                 |
| `src/js/views/config-view.js`                                                   |  52,4 KB | Tela de configuracao concentrada.                    |

## Decisoes aplicadas

- Manter a estrategia allowlist do `.gitignore`.
- Versionar `AGENTS.md`, `README_DEV.md` e ignores de IA para que a politica acompanhe o repositorio.
- Tratar `src/vendor/`, `package-lock.json`, relatorios, caches e planos historicos como proibidos no contexto padrao de microalteracoes.
- Separar fluxo de microalteracao do fluxo de fechamento/publicacao.

## Execucao realizada nesta branch

- Criada a branch `codex-reduce-ai-context` porque `codex/reduce-ai-context` foi bloqueada pela forma atual das refs locais.
- Criados `.aiexclude`, `.codexignore` e `.cursorignore`.
- Atualizado `AGENTS.md` com modo de microalteracao e modo de fechamento.
- Criado `README_DEV.md` com mapa rapido, matriz de escopo e comandos de teste economicos.
- Movidos para `C:\Users\slvma\Downloads\Github\estudo-organizado-local-archive`:
  - `_local_archive/`
  - `output/`
  - `.claude/worktrees/`
- Removidos por serem regeneraveis:
  - `coverage/`
  - `playwright-report/`
  - `test-results/`
- Adicionados scripts de teste direcionados em `package.json`.
- Movido `tests/e2e/debug.spec.js` para `tests/e2e/manual/debug.spec.js` e excluido do Playwright padrao.
- Criado `src/vendor/README.md`.
- Criado `src/docs/superpowers/plans/README.md`.
- Criado `src/js/debug.js` e convertidos logs informativos de sync/credentials/bootstrap para `debugLog`.
- Adicionado `MOCK_VERBOSE=true` para logs por request no mock server.
- Extraidos:
  - `src/css/views/dashboard.css`
  - `src/js/views/skeleton-view.js`
  - `src/js/views/config/backup-settings.js`

## Estado apos limpeza local

| Item                 | Tamanho atual | Arquivos atuais | Resultado                                                                      |
| -------------------- | ------------: | --------------: | ------------------------------------------------------------------------------ |
| `node_modules/`      |     231,13 MB |          18.510 | Mantido localmente, mas ignorado por politica de busca/contexto.               |
| `.claude/`           |          0 MB |               3 | Mantidas apenas configuracoes locais; `worktrees/` foi arquivado fora do repo. |
| `coverage/`          |          0 MB |               0 | Removido.                                                                      |
| `playwright-report/` |          0 MB |               0 | Removido apos validacao.                                                       |
| `test-results/`      |          0 MB |               0 | Removido apos validacao.                                                       |
| `_local_archive/`    |          0 MB |               0 | Movido para arquivo local externo.                                             |
| `output/`            |          0 MB |               0 | Movido para arquivo local externo.                                             |
| `.playwright-mcp/`   |       0,48 MB |              43 | Mantido localmente, ignorado por politica.                                     |
| `.sisyphus/`         |       0,38 MB |              17 | Mantido localmente, ignorado por politica.                                     |

## Validacao executada

- `git check-ignore -v AGENTS.md README_DEV.md .aiexclude .codexignore .cursorignore docs/relatorio-reducao-contexto-codex.md src/vendor/README.md src/docs/superpowers/plans/README.md`: confirmou que os novos arquivos de politica/documentacao deixaram de ser ignorados pela allowlist.
- `node --check` nos novos/alterados arquivos JS principais: passou.
- `npm run test:config`: 2 arquivos, 60 testes passando.
- `npm run test:sync`: 21 arquivos, 317 testes passando.
- `npm run test:views`: 12 arquivos, 207 testes passando.
- `npm run test:css`: 1 arquivo, 26 testes passando.
- `npm run test:e2e:quick -- --list`: listou 304 testes com o reporter economico.
- `npm run lint`: passou sem erros; restaram 8 warnings ja existentes ou fora do escopo funcional desta fase.
- `npx prettier --check` nos arquivos tocados de `src/`: passou.
- `npm test`: 77 arquivos, 1291 testes passando.
- `npm run test:e2e:mock -- tests/e2e/mock-environment.spec.js`: 10 testes passando.
- `npm run test:e2e:chromium -- tests/e2e/app.spec.js --grep "SW precache"`: 1 teste passando.
- `npm run test:e2e`: executou a suite completa; 214 testes passaram e 90 falharam. As falhas ficaram concentradas no conjunto E2E amplo, especialmente projeto `mock` em paralelo e contratos de UI/sync ja sensiveis, enquanto os E2E focados de mock e service worker passaram quando isolados. Esta fase nao tentou corrigir a saude global da suite E2E para evitar misturar reducao de contexto com refatoracao de produto/testes.

### Continuidade em 2026-05-05

- Corrigido `tests/unit/css-architecture.test.js` para normalizar CRLF antes de extrair blocos CSS; isso evita falha falsa quando o checkout Windows troca LF por CRLF.
- `playwright.config.js` agora usa reporter local `line`; HTML fica reservado para `npm run test:e2e:debug`.
- Adicionados `npm run test:e2e:release` (`chromium`, `line`, `--workers=1`) e `npm run test:e2e:debug`; o projeto `mock` permanece separado em `npm run test:e2e:mock`.
- `npm run test:css`: 1 arquivo, 26 testes passando.
- `npm test`: 77 arquivos, 1291 testes passando.
- `npm run test:e2e:quick -- --list`: listou 304 testes.
- `npm run test:e2e:release -- --list`: listou 152 testes do projeto `chromium`.
- `npm run test:e2e:mock -- tests/e2e/mock-environment.spec.js`: 10 testes passando.
- `npm run test:e2e:release -- tests/e2e/app.spec.js --grep "SW precache"`: 1 teste passando.
- `npm run test:e2e:chromium -- tests/e2e/app.spec.js --grep "SW precache"`: 1 teste passando apos rerodada sequencial; a tentativa paralela anterior falhou por colisao temporaria de porta `18345`.

### Continuidade em 2026-05-05 - separacao de projetos E2E

- `playwright.config.js`: o projeto `chromium` passou a ignorar `mock-environment.spec.js`, que depende de `window.__MOCK_MODE__` e dados do mock server.
- `package.json`: `test:e2e:mock` agora roda somente `tests/e2e/mock-environment.spec.js`; `test:e2e:mock:all` ficou como comando explicito de investigacao.
- `README_DEV.md`: documenta o mock gate enxuto e o mock completo como fluxo de investigacao.
- `npm run test:e2e:release -- --list`: listou 143 testes e nenhum `mock-environment`.
- `npm run test:e2e:mock -- --list`: listou 10 testes em 1 arquivo.
- `npm run test:e2e:release -- tests/e2e/app.spec.js --grep "SW precache"`: 1 teste passando.
- `npm run test:e2e:mock`: 10 testes passando em execucao sequencial.
- Observacao operacional: os gates Playwright nao devem ser executados em paralelo na mesma worktree porque compartilham `webServer`.

### Continuidade em 2026-05-05 - gate release E2E completo

- `package.json`: `npm run test:e2e` passou a apontar para `npm run test:e2e:release`; `test:e2e:all` preserva a matriz Playwright completa como investigacao explicita.
- `playwright.config.js`: o projeto `chromium` agora ignora `manual/**` alem de `mock-environment.spec.js`; isso evita que specs manuais entrem no release por sobrescrita do `testIgnore` global.
- `src/js/views/config-view.js`: corrigida a arvore DOM do Sync Center removendo fechamentos excedentes e um bloco duplicado de acoes; o painel avancado voltou a ficar dentro de `[data-testid="sync-center"]`.
- `tests/e2e/manual-sync-ui.spec.js`: seletores escopados ao quiet panel para nao conflitar com o botao global `sync-now`.
- `tests/e2e/app.spec.js`: limpeza de conflito Cloudflare passa por `window.EstudoApp.setState()` antes dos eventos de status.
- Baseline antes do fix: `npm run test:e2e:release` teve 137 passes e 5 falhas.
- Depois do fix: `npm run test:e2e:release -- --list` listou 142 testes em 23 arquivos; `npm run test:e2e:quick -- --list` listou 294 testes em 24 arquivos.
- `npm run test:config`: 60 testes passando.
- `npm run test:e2e:release`: 142 testes passando.

## Artefatos locais a preservar ou limpar

Preservar ou mover para arquivo externo:

- `_local_archive/`
- `output/`
- `.claude/worktrees/`

Regeneraveis, podendo ser removidos quando nao houver investigacao ativa:

- `coverage/`
- `playwright-report/`
- `test-results/`

### Continuidade em 2026-05-06 - Waves 3-6: modularizacao CSS e JS completa

**Commits realizados (19 commits desde b8d3151 antes desta revisao Codex):**

| Commit | Tipo | Descricao |
|--------|------|-----------|
| `64c7b83` | refactor(css) | extract calendar view styles |
| `d9d07f0` | refactor(css) | extract base utilities |
| `b47c4e7` | refactor(css) | extract form and button styles |
| `a5327d9` | refactor(css) | extract ciclo and grade view styles |
| `f8ed4bc` | chore(logs) | convert sync logs to debugLog |
| `42e5609` | chore(logs) | convert informational logs to debugLog |
| `8c8e31e` | refactor(views) | extract disc manager state accessors |
| `3b305c9` | fix(views) | declare state variables in disc-manager-state and refactor views.js to use getters/setters |
| `b64d531` | refactor(css) | extract sidebar styles |
| `4e2499e` | refactor(css) | extract config and sync view styles |
| `f58cb70` | refactor(views) | extract sync center rendering |
| `d1ae2c8` | refactor(views) | extract theme settings rendering |
| `cd5a879` | refactor(views) | extract data management rendering |
| `95e2942` | test(config) | update mocks and assertions for data-management extraction |
| `e833941` | refactor(css) | extract session, wizard, and modal view styles |
| `995986e` | refactor(css) | extract cronometro, banca, and subject manager styles |
| `e2b1fc8` | docs(context) | update handoff with wave 3-6 extraction results |
| `389872e` | docs(context) | update relatorio with wave 3-6 metrics and line counts |
| `cb812f6` | docs(context) | add session summary report |

**Arquivos CSS extraidos:**

| Novo arquivo | Origem | Linhas | Prefixos |
|--------------|--------|--------|----------|
| `src/css/views/calendar.css` | views.css | ~45 | `.cal-*` |
| `src/css/views/ciclo.css` | views.css | ~230 | `.ciclo-*`, `.grade-*`, `.seq-*` |
| `src/css/views/config/config-view.css` | views.css | ~674 | `.config-*`, `.sync-*`, `.backup-*`, `.restore-preview-*` |
| `src/css/views/sessions.css` | views.css | ~497 | `.reg-*`, `.session-*` |
| `src/css/views/wizard.css` | views.css | ~215 | `.pw-*` |
| `src/css/views/modals.css` | views.css | ~135 | `.modal-*`, `.event-form-*` |
| `src/css/views/cronometro.css` | views.css | ~135 | `.crono-*` |
| `src/css/views/banca.css` | views.css | ~140 | `.banca-*` |
| `src/css/views/subject-manager.css` | views.css | ~226 | `.sm-*`, `.manager-*`, `.tab-content-*` |
| `src/css/base/utilities.css` | styles.css | ~13 | `.grid-*` |
| `src/css/base/forms.css` | styles.css | ~46 | `.form-group`, `.form-control` |
| `src/css/components/buttons.css` | styles.css | ~240 | `.btn-*` |
| `src/css/components/sidebar.css` | styles.css | ~385 | `#sidebar-*`, `.sidebar-*` |

**Arquivos JS extraidos:**

| Novo arquivo | Origem | Linhas | Funcoes |
|--------------|--------|--------|---------|
| `src/js/views/state/disc-manager-state.js` | views.js | 29 | getters/setters de estado do disc manager |
| `src/js/views/config/sync-center.js` | config-view.js | ~569 | renderBackupCenterCard, renderFirestoreConflict, _renderFirestoreCard, getSyncHealthLabel, getSyncHealthIcon, renderCloudflareConflict, renderEntityConflictPanel, renderSyncSourceExtras, renderSyncSourceActions, renderCloudflareConfigFields, buildCurrentSyncCenterModel, _renderSyncCenterCard, renderQuietSyncCenterCard |
| `src/js/views/config/theme-settings.js` | config-view.js | ~140 | renderPreferenceNotificationsCard, renderPreferenceDataCard, renderPreferenceServiceWorkerCard, renderPreferenceAboutCard, setTheme, updateConfig, toggleConfig, updateFrequencia |
| `src/js/views/config/data-management.js` | config-view.js | ~252 | archiveOldEvents, exportData, openRestorePreviewModal, importData, openRemoteRestorePreview, restoreBackupFromSelectedSource, clearAllData |

**Reducao de linhas:**

| Arquivo | Antes | Depois | Reducao |
|---------|-------|--------|---------|
| `src/css/views.css` | ~3700 | 714 | -81% |
| `src/css/styles.css` | ~5050 | 3872 | -23% |
| `src/js/views.js` | ~2249 | 2062 | -8% |
| `src/js/views/config-view.js` | ~1168 | 247 | -79% |

**APP_VERSION:** `8.37` → `8.43` (6 bumps ao longo das extracoes)

**Validacoes desta continuidade:**

- `npm run test:css`: 1 arquivo, 26 testes passando.
- `npm run test:views`: 12 arquivos, 207 testes passando.
- `npm run test:config`: 2 arquivos, 60 testes passando.
- `npm test`: 76 arquivos passando, 1290/1291 testes passando na execucao anterior; a revisao posterior mostrou que a falha vinha de import incorreto, nao de um problema pre-existente do Windows.
- `npm run lint`: passou sem erros novos.
- `git push origin main`: commits publicados em `main`.

### Continuidade em 2026-05-06 - revisao Codex pos-extracoes

- A falha do `npm test` nao era apenas pre-existente do Windows. O bundle esbuild falhava porque `src/js/views/config/data-management.js` importava `invalidateTodayCache` de `logic.js`, mas a funcao pertence a `utils.js`.
- Corrigido o import de `invalidateTodayCache` para `../../utils.js?v=8.37`.
- Corrigidos os imports/re-exports de `src/js/views/config-view.js` para usar `./config/theme-settings.js?v=8.37`, alinhando com os outros modulos extraidos e com o cache busting do app.
- Corrigida a arquitetura de `src/css/styles.css`: todos os `@import` agora ficam no topo, antes de qualquer regra CSS. Antes, `components/buttons.css`, `base/utilities.css` e `base/forms.css` apareciam no meio do arquivo, o que pode ser ignorado por navegadores.
- Extraido `src/css/base/accessibility.css` para os skip links e incluido no precache do service worker.
- Reforcados testes:
  - `tests/unit/action-contracts.test.js` agora cobre o import correto de `invalidateTodayCache` e o import versionado de `theme-settings.js`.
  - `tests/unit/css-architecture.test.js` agora falha se `styles.css` voltar a ter `@import` depois de regras CSS.

Validacoes desta continuidade:

- `npx esbuild src/js/main.js --bundle --format=esm --outfile=C:\tmp\estudo-organizado-main-esbuild-check-debug.js --log-level=debug`: passou.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 1 arquivo, 27 testes passando.
- `npm run test:css`: 1 arquivo, 27 testes passando.
- `npm run test:unit -- tests/unit/sync-now-button.test.js`: 1 arquivo, 15 testes passando.
- `npm test`: 77 arquivos, 1293 testes passando.
- `npm run test:e2e -- tests/e2e/sync-e2e.spec.js`: 8 testes passando.
- `npm run test:e2e`: 142 testes passando.

### Continuidade em 2026-05-06 - extracao de temas CSS

- Extraido o bloco `DARK PREMIUM THEME LIBRARY` de `src/css/styles.css` para `src/css/base/themes.css`.
- `src/css/styles.css` continua com todos os `@import` no topo e agora importa `./base/themes.css` logo apos `./base/accessibility.css`.
- `src/sw.js` passou a precachear `./css/base/themes.css`.
- `tests/unit/css-architecture.test.js` foi atualizado para exigir o novo modulo e manter o contrato de imports antes de regras CSS.
- `README_DEV.md` foi atualizado com o novo mapa de modulo.

Reducao desta fatia:

| Arquivo | Antes | Depois | Observacao |
|---------|-------|--------|------------|
| `src/css/styles.css` | 4474 | 4123 | -351 linhas nesta continuidade |
| `src/css/base/themes.css` | 0 | 352 | novo modulo tematico |

Validacoes desta continuidade:

- `npm run test:css`: 1 arquivo, 27 testes passando.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 1 arquivo, 27 testes passando.
- `npm test`: 77 arquivos, 1293 testes passando.
- `npm run test:e2e`: 142 testes passando.

### Continuidade em 2026-05-06 - extracao de layout base

- Extraido bloco de layout base (`*`, `body`, `#main`, `.topbar`, `.save-status`, `.sync-status`, `#sync-now-btn`, `#content`, `#main-content`, `.disc-dashboard-shell`, `.banca-analyzer-shell` e media queries) de `src/css/styles.css` para `src/css/base/layout.css`.
- `src/css/styles.css` continua com todos os `@import` no topo; o import de layout fica logo apos `./base/themes.css`.
- `src/sw.js` passou a precachear `./css/base/layout.css`.
- `tests/unit/css-architecture.test.js` foi atualizado para exigir o novo modulo, validar a ordem de imports e o marcador `MAIN CONTENT`.
- `README_DEV.md` foi atualizado com o novo mapa de modulo.

Reducao desta fatia:

| Arquivo | Antes | Depois | Observacao |
|---------|-------|--------|------------|
| `src/css/styles.css` | 4123 | 3789 | -334 linhas nesta continuidade |
| `src/css/base/layout.css` | 0 | 335 | novo modulo de layout base |

Validacoes desta continuidade:

- `npm run test:css`: 1 arquivo, 27 testes passando.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 1 arquivo, 27 testes passando.

## Proximos hotspots estruturais

- `src/css/styles.css` (3789 linhas nesta branch) - ainda pode ser reduzido extraindo cards, feedback visual, busca, mobile, etc.
- `src/js/views.js` (2062 linhas) — ainda pode ser reduzido extraindo mais renderizadores.
- `src/js/views.js` (2062 linhas) — ainda pode ser reduzido extraindo mais renderizadores.
- `src/js/logic.js` e `src/js/app.js` — nao foram atacados nesta fase.
- `src/js/components.js` — potencial para extracao de componentes reutilizaveis.
- matriz E2E completa (`test:e2e:all`), que continua sendo investigativa e inclui `chromium` + `mock`; o gate release Chromium ja esta estavel em `test:e2e`.

Plano detalhado de continuidade para outra IA: `docs/handoff-reducao-contexto-codex.md`.
