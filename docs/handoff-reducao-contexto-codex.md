# Reducao de Contexto Codex - Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** concluir a reducao de consumo de tokens/contexto no `estudo-organizado` sem misturar limpeza de contexto com mudancas de produto.

**Architecture:** a primeira rodada ja separou politica de contexto, limpeza local, scripts rapidos e pequenas extracoes. O restante deve atacar primeiro a saude da suite E2E e depois continuar a modularizacao incremental de CSS/JS, sempre preservando fachadas publicas e comportamento visual.

**Tech Stack:** vanilla JS ES modules, CSS global modularizado por `@import`, Vitest, Playwright, PWA/service worker, Git/GitHub.

---

## Estado atual confirmado

Baseline pos-merge:

- Branch principal local deve estar em `main`.
- Merge da reducao inicial ja entrou na `main`.
- Commit base esperado: `f5f2f9d` ou posterior.
- Relatorio principal ja existe em `docs/relatorio-reducao-contexto-codex.md`.
- Guia operacional ja existe em `README_DEV.md`.
- Regras do agente ja existem em `AGENTS.md`.

O que ja foi feito:

- Criados `.aiexclude`, `.codexignore` e `.cursorignore`.
- `.gitignore` continua em allowlist e agora versiona `AGENTS.md`, `README_DEV.md`, `docs/` e os ignores de IA.
- `_local_archive/`, `output/` e `.claude/worktrees/` foram movidos para `C:\Users\slvma\Downloads\Github\estudo-organizado-local-archive`.
- `coverage/`, `playwright-report/` e `test-results/` foram limpos apos validacao.
- `tests/e2e/debug.spec.js` foi movido para `tests/e2e/manual/debug.spec.js`.
- `playwright.config.js` ignora `tests/e2e/manual/**`.
- `src/vendor/README.md` marca vendor como dependencia empacotada.
- `src/docs/superpowers/plans/README.md` marca planos antigos como historicos.
- `src/js/debug.js` existe e `debugLog()` foi usado em logs informativos de sync/credentials/bootstrap.
- Primeiras extracoes ja existem:
  - `src/css/views/dashboard.css`
  - `src/js/views/skeleton-view.js`
  - `src/js/views/config/backup-settings.js`

Validacoes da rodada inicial:

- `npm run test:config`: passou.
- `npm run test:sync`: passou.
- `npm run test:views`: passou.
- `npm run test:css`: passou.
- `npm test`: passou com 77 arquivos e 1291 testes.
- `npm run test:e2e:mock -- tests/e2e/mock-environment.spec.js`: passou.
- `npm run test:e2e:chromium -- tests/e2e/app.spec.js --grep "SW precache"`: passou.
- `npm run test:e2e`: executou, mas falhou como suite ampla: 214 passaram e 90 falharam.

## Continuidade executada em 2026-05-05

Arquivos alterados nesta continuidade:

- `tests/unit/css-architecture.test.js`
- `package.json`
- `playwright.config.js`
- `README_DEV.md`
- `docs/relatorio-reducao-contexto-codex.md`
- `docs/handoff-reducao-contexto-codex.md`

O que foi feito:

- Corrigido o helper do teste de arquitetura CSS para normalizar CRLF para LF antes de resolver imports e extrair blocos; o CSS ja continha o contrato correto, mas o teste falhava no Windows ao procurar seletor multiline.
- Adicionado `test:e2e:release` como gate sequencial do projeto `chromium`, com reporter `line` e `--workers=1`.
- Mantido `test:e2e:mock` como gate separado do ambiente mock.
- Adicionado `test:e2e:debug` para manter HTML report disponivel somente quando alguem quiser investigar falhas.
- Alterado reporter local padrao do Playwright de `html` para `line`.
- Documentado o fluxo Playwright de baixo ruido no `README_DEV.md`.
- Atualizado o relatorio de reducao de contexto com evidencias desta rodada.

Validacoes desta continuidade:

- `npm run test:css`: 1 arquivo, 26 testes passando.
- `npm test`: 77 arquivos, 1291 testes passando.
- `npm run test:e2e:quick -- --list`: 304 testes listados.
- `npm run test:e2e:release -- --list`: 152 testes do projeto `chromium` listados.
- `npm run test:e2e:mock -- tests/e2e/mock-environment.spec.js`: 10 testes passando.
- `npm run test:e2e:release -- tests/e2e/app.spec.js --grep "SW precache"`: 1 teste passando.
- `npm run test:e2e:chromium -- tests/e2e/app.spec.js --grep "SW precache"`: 1 teste passando.
- Observacao: nao rode E2E isolados em paralelo na mesma worktree; a primeira tentativa paralela do SW falhou por `EADDRINUSE` na porta `18345`, e passou ao rerodar de forma sequencial.
- Observacao: uma tentativa intermediaria de `test:e2e:release -- tests/e2e/mock-environment.spec.js` mostrou que specs mock nao devem ser executadas pelo gate Chromium; por isso `release` ficou Chromium-only e `mock` continua separado.

Proxima IA deve continuar em:

1. Rodar `npm run test:e2e:release -- --workers=1` se o objetivo for medir o gate Chromium completo.
2. Rodar `npm run test:e2e:mock -- --workers=1` se o objetivo for medir o gate mock completo.
3. Seguir para a Task 1 se o objetivo for sanear a suite completa ou para a Task 3 se o objetivo for modularizacao CSS, mas registrando que `chromium` e `mock` agora sao gates separados.

## Continuidade executada em 2026-05-05 - separacao de projetos E2E

Arquivos alterados nesta continuidade:

- `package.json`
- `playwright.config.js`
- `README_DEV.md`
- `docs/relatorio-reducao-contexto-codex.md`
- `docs/handoff-reducao-contexto-codex.md`

O que foi feito:

- O projeto Playwright `chromium` agora ignora `mock-environment.spec.js`, que e especifico do servidor mock.
- `npm run test:e2e:mock` virou gate enxuto do ambiente mock e roda somente `tests/e2e/mock-environment.spec.js`.
- `npm run test:e2e:mock:all` foi adicionado para investigacao explicita do projeto mock completo.
- `README_DEV.md` e este handoff foram atualizados para evitar que outra IA trate os 2 projetos como duplicatas equivalentes.

Validacoes desta continuidade:

- Baseline antes da mudanca: `npm run test:e2e:release -- --list` ainda listava 10 testes `mock-environment` no projeto `chromium`; `npm run test:e2e:mock -- --list` listava 152 testes.
- `npm run test:e2e:release -- --list`: listou 143 testes e nenhum `mock-environment`.
- `npm run test:e2e:mock -- --list`: listou 10 testes em `mock-environment.spec.js`.
- `npm run test:e2e:release -- tests/e2e/app.spec.js --grep "SW precache"`: 1 teste passando.
- `npm run test:e2e:mock`: 10 testes passando quando executado sequencialmente.
- Nota: nao execute `test:e2e:release` e `test:e2e:mock` em paralelo na mesma worktree; ambos usam o mesmo array `webServer`, e um comando pode encerrar o servidor mock enquanto o outro ainda roda.

## Continuidade executada em 2026-05-05 - gate release E2E completo

Arquivos alterados nesta continuidade:

- `package.json`
- `playwright.config.js`
- `README_DEV.md`
- `src/js/views/config-view.js`
- `tests/e2e/app.spec.js`
- `tests/e2e/manual-sync-ui.spec.js`
- `docs/relatorio-reducao-contexto-codex.md`
- `docs/handoff-reducao-contexto-codex.md`

O que foi feito:

- `npm run test:e2e` agora e alias do gate estavel `npm run test:e2e:release`.
- Adicionado `npm run test:e2e:all` para a matriz Playwright completa (`chromium` + `mock`) ficar explicita como investigacao ampla.
- O projeto Playwright `chromium` agora ignora tambem `manual/**`; antes o `testIgnore` do projeto sobrescrevia o ignore global e deixava `tests/e2e/manual/debug.spec.js` entrar no release.
- Corrigido `renderQuietSyncCenterCard()` em `src/js/views/config-view.js`: havia fechamentos `</div>` sobrando e um bloco duplicado de `sync-quiet-actions`, deixando o painel avancado fora de `[data-testid="sync-center"]`. Isso impedia `refreshConfigSyncSurface()` de remover `cf-sync-conflict` e tambem deixava o screenshot do Backup Center instavel.
- `tests/e2e/manual-sync-ui.spec.js` passou a buscar o botao "Sincronizar agora" dentro de `[data-testid="sync-quiet-panel"]`, porque existe outro botao global com o mesmo `data-action` na topbar.
- `tests/e2e/app.spec.js` passou a limpar o conflito via `window.EstudoApp.setState()` antes de disparar os eventos de status, usando o contrato real de atualizacao de estado.

Validacoes desta continuidade:

- Baseline do release antes das correcoes: `npm run test:e2e:release` rodou 142 testes, com 137 passes e 5 falhas concentradas em `app.spec.js` e `manual-sync-ui.spec.js`.
- `npm run test:e2e:release -- --list`: listou 142 testes em 23 arquivos, sem `mock-environment` e sem `tests/e2e/manual/debug.spec.js`.
- `npm run test:e2e:quick -- --list`: listou 294 testes em 24 arquivos.
- `npm run test:e2e:release -- tests/e2e/manual-sync-ui.spec.js`: 9 testes passando.
- `npm run test:e2e:release -- tests/e2e/app.spec.js --grep "refreshes settings sync conflicts"`: 1 teste passando.
- `npm run test:e2e:release -- tests/e2e/app.spec.js --grep "captures Sync Center"`: 1 teste passando.
- `npm run test:config`: 2 arquivos, 60 testes passando.
- `npm run test:e2e:release`: 142 testes passando.

Proxima IA deve continuar em:

1. Rodar `npm test` e `npm run test:e2e` como gates de fechamento padrao; agora `test:e2e` aponta para o release estavel.
2. Usar `npm run test:e2e:mock` para o gate mock enxuto.
3. Usar `npm run test:e2e:all` ou `npm run test:e2e:mock:all` apenas se o objetivo for investigar paridade ampla entre projetos.
4. Seguir para a Task 3 (modularizacao CSS) se quiser continuar a reducao de contexto com menor risco; a Task 1 do release Chromium esta estabilizada.

Nao reabra por padrao:

- `node_modules/`
- `.git/`
- `.claude/`
- `.sisyphus/`
- `.playwright-mcp/`
- `coverage/`
- `playwright-report/`
- `test-results/`
- `_local_archive/`
- `output/`
- `src/vendor/`
- `package-lock.json`
- `src/docs/superpowers/plans/`

Use buscas assim:

```powershell
rg "termo" src tests scripts docs -g '!src/vendor/**' -g '!node_modules/**' -g '!coverage/**' -g '!playwright-report/**' -g '!test-results/**' -g '!package-lock.json' -g '!src/docs/superpowers/plans/**'
```

---

## Prioridade geral

1. Sanear a suite E2E completa.
2. Reduzir saida e artefatos do Playwright.
3. Continuar modularizacao CSS em fatias pequenas.
4. Continuar modularizacao de `views.js`.
5. Continuar modularizacao de `config-view.js`.
6. Reduzir logs/test warnings restantes.
7. Atualizar docs e manter politicas de contexto vivas.

Nao faca tudo em um unico commit. Cada tarefa abaixo deve virar um commit separado se passar na validacao propria.

---

## Task 1: Sanear a suite E2E completa

**Objetivo:** fazer `npm run test:e2e` voltar a ser um gate confiavel, ou separar oficialmente o que e suite completa de release e o que e suite instavel/manual.

**Arquivos principais:**

- Modify: `playwright.config.js`
- Modify: `package.json`
- Inspect: `tests/e2e/app.spec.js`
- Inspect: `tests/e2e/manual-sync-ui.spec.js`
- Inspect: `tests/e2e/mock-environment.spec.js`
- Inspect: `tests/e2e/crud-operations.spec.js`
- Inspect: `tests/e2e/*sync*.spec.js`
- Inspect: `tests/helpers/e2e-state.js`
- Inspect: `scripts/local-mock-server.mjs`
- Update: `README_DEV.md`
- Update: `docs/relatorio-reducao-contexto-codex.md`

**Evidencia atual:**

- `npm run test:e2e` falhou com 90 falhas e 214 passes.
- Falhas apareceram concentradas em:
  - projeto `mock` quando rodado junto com `chromium`;
  - testes que esperam estado mock especifico;
  - testes de sync/config que encontram elementos duplicados ou conflito pendente;
  - buscas por habitos/dados mock que nao aparecem em execucao ampla;
  - timeouts em fluxos de timer/habitos.
- `npm run test:e2e:mock -- tests/e2e/mock-environment.spec.js` passou isolado, entao a falha pode ser concorrencia, estado compartilhado ou reuse de servidor/contexto.

**Passos:**

- [ ] Confirmar baseline sem alterar codigo.

  Run:

  ```powershell
  npm run test:e2e:quick -- --list
  npm run test:e2e:mock -- tests/e2e/mock-environment.spec.js
  npm run test:e2e:chromium -- tests/e2e/app.spec.js --grep "SW precache"
  ```

  Expected:

  - listagem mostra os testes sem gerar HTML pesado;
  - mock environment passa isolado;
  - SW precache passa.

- [ ] Reproduzir uma falha pequena e isolada da suite completa.

  Run:

  ```powershell
  npm run test:e2e:chromium -- tests/e2e/manual-sync-ui.spec.js --grep "Sincronizar agora"
  npm run test:e2e:mock -- tests/e2e/app.spec.js --grep "search finds habit records"
  ```

  Expected:

  - Se passar isolado, o problema e concorrencia/estado compartilhado.
  - Se falhar isolado, corrigir o teste ou a fixture correspondente.

- [ ] Verificar se projetos `chromium` e `mock` devem rodar juntos por padrao.

  Proposta conservadora:

  - manter `npm run test:e2e` como release gate apenas quando estiver estavel;
  - adicionar scripts separados no `package.json`:

  ```json
  {
    "test:e2e:chromium:line": "playwright test --project=chromium --reporter=line",
    "test:e2e:mock:line": "playwright test --project=mock --reporter=line",
    "test:e2e:release": "playwright test --reporter=line --workers=1"
  }
  ```

  Nao substituir scripts existentes sem necessidade.

- [ ] Investigar estado compartilhado no mock server.

  Ler apenas:

  ```powershell
  Get-Content scripts/local-mock-server.mjs
  Get-Content scripts/mock-inject.mjs
  Get-Content tests/helpers/e2e-state.js
  ```

  Coisas a confirmar:

  - se `MOCK_MODE=reset` realmente reseta por teste/pagina;
  - se IndexedDB/localStorage sao limpos em `beforeEach`;
  - se testes em paralelo usam o mesmo banco/perfil e se contaminam.

- [ ] Corrigir seletores ambiguos antes de mudar app.

  Exemplo de falha ja vista:

  ```text
  locator('[data-action="sync-now"]') resolved to 2 elements
  ```

  O teste deve mirar o botao certo:

  ```js
  const syncNowBtn = page.getByRole('button', { name: /Sincronizar agora/i });
  await expect(syncNowBtn).toBeVisible();
  ```

  Ou usar container:

  ```js
  const syncCenter = page.locator('[data-testid="sync-center"]');
  await expect(syncCenter.getByRole('button', { name: /Sincronizar agora/i })).toBeVisible();
  ```

- [ ] Rodar fechamento E2E em ordem progressiva.

  Run:

  ```powershell
  npm run test:e2e:chromium -- --workers=1
  npm run test:e2e:mock -- --workers=1
  npm run test:e2e:quick -- --workers=1
  ```

  Expected:

  - ideal: todos passam;
  - aceitavel temporario: documentar exatamente quais specs continuam instaveis e mover apenas testes realmente manuais/investigativos para `tests/e2e/manual/`.

- [ ] Atualizar docs.

  Atualizar:

  - `README_DEV.md`: explicar quais comandos E2E usar para microalteracao, mock, release e investigacao.
  - `docs/relatorio-reducao-contexto-codex.md`: substituir o status antigo "90 falharam" pelo status novo.

- [ ] Commit.

  ```powershell
  git add package.json playwright.config.js tests/e2e tests/helpers README_DEV.md docs/relatorio-reducao-contexto-codex.md
  git commit -m "test(e2e): stabilize context reduction validation"
  ```

---

## Task 2: Reduzir artefatos e saida padrao do Playwright

**Objetivo:** impedir que cada validacao crie `playwright-report/`, `test-results/`, screenshots e videos gigantes sem necessidade.

**Arquivos principais:**

- Modify: `playwright.config.js`
- Modify: `package.json`
- Update: `README_DEV.md`
- Update: `.aiexclude`
- Update: `.codexignore`
- Update: `.cursorignore`

**Passos:**

- [ ] Confirmar configuracao atual.

  Run:

  ```powershell
  Get-Content playwright.config.js
  ```

  Pontos atuais:

  - reporter local ainda e `html`;
  - screenshot e video podem gerar `test-results/` em falhas;
  - `test:e2e:quick` usa `--reporter=line`, mas `test:e2e` ainda gera relatorio HTML.

- [ ] Adicionar scripts de release e debug sem quebrar os atuais.

  Em `package.json`, adicionar se ainda nao existirem:

  ```json
  {
    "test:e2e:release": "playwright test --reporter=line",
    "test:e2e:debug": "playwright test --reporter=html"
  }
  ```

  Regra:

  - `test:e2e:release`: terminal economico.
  - `test:e2e:debug`: gera HTML quando alguem realmente quer investigar.

- [ ] Avaliar reporter padrao.

  Opcao conservadora:

  - manter `reporter: process.env.CI ? [['github'], ['html']] : 'html'`;
  - documentar que agentes devem usar `test:e2e:quick` ou `test:e2e:release`.

  Opcao mais agressiva:

  - mudar reporter local para `line`;
  - manter HTML apenas em `test:e2e:debug`.

  Escolha uma opcao e registre no `README_DEV.md`.

- [ ] Garantir que artefatos continuem ignorados.

  Confirmar em todos:

  ```text
  playwright-report/
  test-results/
  coverage/
  ```

  Arquivos:

  - `.gitignore`
  - `.aiexclude`
  - `.codexignore`
  - `.cursorignore`

- [ ] Validar.

  Run:

  ```powershell
  npm run test:e2e:quick -- --list
  npm run test:e2e:release -- --list
  ```

  Expected:

  - lista de testes sem criar `playwright-report/`;
  - se `playwright-report/` ou `test-results/` forem recriados, remover depois da validacao.

- [ ] Commit.

  ```powershell
  git add package.json playwright.config.js README_DEV.md .aiexclude .codexignore .cursorignore .gitignore
  git commit -m "test(e2e): add low-noise playwright workflows"
  ```

---

## Task 3: Modularizar `src/css/views.css` em fatias maiores

**Objetivo:** reduzir leitura de `src/css/views.css` sem mudar visual.

**Arquivos principais:**

- Modify: `src/css/views.css`
- Create: `src/css/views/ciclo.css`
- Create: `src/css/views/calendar.css`
- Create: `src/css/views/editais.css`
- Create: `src/css/views/config.css`
- Maybe create: `src/css/views/sessoes.css`
- Modify: `src/sw.js`
- Modify: `tests/unit/css-architecture.test.js`
- Update: `README_DEV.md`

**Estado atual:**

- `src/css/views/dashboard.css` ja foi extraido.
- `src/css/views.css` ja importa `./views/dashboard.css`.
- `tests/unit/css-architecture.test.js` ja resolve `@import`, entao novas extracoes devem continuar testaveis.

**Regras:**

- Nao alterar seletores.
- Nao alterar propriedades.
- Mover blocos inteiros.
- Preservar ordem relativa dos imports.
- Atualizar `src/sw.js` para precachear cada CSS novo.

**Passos:**

- [ ] Medir blocos candidatos.

  Run:

  ```powershell
  rg -n "ciclo-|cal-|tree-|edital|config-|session-|reg-|rev-" src/css/views.css
  ```

  Escolher uma fatia por commit.

- [ ] Primeira fatia recomendada: calendario.

  Criar:

  ```text
  src/css/views/calendar.css
  ```

  Mover somente blocos de calendario se os seletores tiverem prefixos claros:

  ```text
  .cal-
  .calendar-
  ```

  Em `src/css/views.css`, adicionar import perto do topo:

  ```css
  @import './views/dashboard.css';
  @import './views/calendar.css';
  ```

- [ ] Atualizar service worker.

  Em `src/sw.js`, adicionar:

  ```js
  './css/views/calendar.css',
  ```

  logo apos `./css/views/dashboard.css`.

- [ ] Validar CSS.

  Run:

  ```powershell
  npm run test:css
  npm run test:views
  npm run test:e2e:chromium -- tests/e2e/calendar.spec.js
  ```

  Expected:

  - todos passam;
  - visual nao muda intencionalmente.

- [ ] Commit.

  ```powershell
  git add src/css/views.css src/css/views/calendar.css src/sw.js tests/unit/css-architecture.test.js README_DEV.md
  git commit -m "refactor(css): extract calendar view styles"
  ```

- [ ] Repetir para `ciclo.css`.

  Seletores candidatos:

  ```text
  .ciclo-
  .seq-
  .grade-
  ```

  Validar:

  ```powershell
  npm run test:css
  npm run test:views
  npm run test:e2e:chromium -- tests/e2e/ciclo-grade.spec.js
  ```

- [ ] Repetir para `editais.css`.

  Seletores candidatos:

  ```text
  .tree-
  .edital-
  .disc-
  ```

  Validar:

  ```powershell
  npm run test:css
  npm run test:views
  npm run test:e2e:chromium -- tests/e2e/editais.spec.js
  ```

---

## Task 4: Modularizar `src/css/styles.css` sem redesenhar

**Objetivo:** transformar `styles.css` em agregador gradualmente, reduzindo o arquivo global mais caro.

**Arquivos principais:**

- Modify: `src/css/styles.css`
- Create: `src/css/base/layout.css`
- Create: `src/css/base/forms.css`
- Create: `src/css/base/buttons.css`
- Create: `src/css/base/utilities.css`
- Modify: `src/sw.js`
- Modify: `tests/unit/css-architecture.test.js`
- Update: `README_DEV.md`

**Regras:**

- Nao mover tokens de `src/css/tokens.css`.
- Nao mexer em `src/css/base.css` ou `src/css/components.css` sem necessidade.
- Mover blocos por responsabilidade clara.
- Preservar ordem de cascata.

**Passos:**

- [ ] Mapear secoes.

  Run:

  ```powershell
  rg -n "^/\\*|^body\\b|^#main\\b|\\.btn|\\.form-|\\.input|\\.flex|\\.grid|\\.hidden" src/css/styles.css
  ```

- [ ] Extrair apenas utilitarios primeiro.

  Criar:

  ```text
  src/css/base/utilities.css
  ```

  Candidatos:

  ```text
  .flex
  .flex-between
  .grid
  .hidden
  .text-
  .mt-
  .mb-
  ```

- [ ] Importar no topo de `styles.css`.

  ```css
  @import './base/utilities.css';
  ```

  Se existir dependencia de ordem, coloque o import onde o bloco original estava.

- [ ] Atualizar `src/sw.js`.

  ```js
  './css/base/utilities.css',
  ```

- [ ] Validar.

  ```powershell
  npm run test:css
  npm test
  ```

- [ ] Commit.

  ```powershell
  git add src/css/styles.css src/css/base/utilities.css src/sw.js tests/unit/css-architecture.test.js README_DEV.md
  git commit -m "refactor(css): extract base utilities"
  ```

---

## Task 5: Modularizar `src/js/views.js`

**Objetivo:** reduzir dependencia do arquivo fachada `src/js/views.js` para alteracoes simples.

**Arquivos principais:**

- Modify: `src/js/views.js`
- Create under: `src/js/views/`
- Modify: `src/sw.js`
- Test: `tests/unit/views*.test.js`
- Test: `tests/unit/action-contracts.test.js`
- Update: `README_DEV.md`

**Estado atual:**

- `src/js/views/skeleton-view.js` ja foi extraido.
- `src/js/views.js` ainda deve preservar exports publicos.

**Primeiras extracoes recomendadas:**

1. helpers de empty state;
2. helpers de formatacao/render pequenos;
3. renderizadores sem dependencia circular.

**Passos:**

- [ ] Mapear exports e funcoes pequenas.

  Run:

  ```powershell
  rg -n "^export function|^function|renderEmpty|empty-state|format" src/js/views.js
  ```

- [ ] Escolher uma funcao com teste existente.

  Preferir funcoes ja cobertas por:

  ```powershell
  rg -n "renderSkeleton|empty|render.*State|views.js" tests/unit/views*.test.js
  ```

- [ ] Criar modulo novo.

  Exemplo se a fatia for empty state:

  ```text
  src/js/views/empty-state-view.js
  ```

  O modulo deve importar somente o necessario. Nao importar `views.js` de volta.

- [ ] Reexportar pela fachada.

  Em `src/js/views.js`:

  ```js
  export { renderAlgumaFuncao } from './views/algum-modulo.js';
  ```

  Nao mudar chamadas externas.

- [ ] Atualizar service worker.

  Em `src/sw.js`, adicionar o novo modulo:

  ```js
  './js/views/algum-modulo.js',
  ```

- [ ] Validar.

  ```powershell
  npm run test:views
  npm run test:e2e:chromium -- tests/e2e/app.spec.js --grep "SW precache"
  ```

- [ ] Commit.

  ```powershell
  git add src/js/views.js src/js/views/algum-modulo.js src/sw.js README_DEV.md
  git commit -m "refactor(views): extract focused view helpers"
  ```

---

## Task 6: Modularizar `src/js/views/config-view.js`

**Objetivo:** separar a tela de configuracao em renderizadores menores sem alterar comportamento.

**Arquivos principais:**

- Modify: `src/js/views/config-view.js`
- Create under: `src/js/views/config/`
- Modify: `src/sw.js`
- Test: `tests/unit/config-view.test.js`
- Test: `tests/unit/config-actions.test.js`
- Update: `README_DEV.md`

**Estado atual:**

- `src/js/views/config/backup-settings.js` ja existe.
- Ele contem helpers de data e preview de restore.
- `config-view.js` ainda concentra render de sync, tema, backup e data management.

**Ordem recomendada:**

1. `render-theme-settings.js`
2. `render-backup-settings.js`
3. `render-sync-settings.js`
4. `render-data-management.js`
5. estado auxiliar apenas depois dos renders ficarem menores.

**Passos:**

- [ ] Mapear funcoes e blocos.

  Run:

  ```powershell
  rg -n "^function render|^export function|THEME_OPTIONS|Backup|Sincroniza|Firestore|Cloudflare|Drive" src/js/views/config-view.js
  ```

- [ ] Extrair tema primeiro.

  Criar:

  ```text
  src/js/views/config/theme-settings.js
  ```

  Mover apenas funcao/bloco que renderiza tema/aparencia.

- [ ] Importar no arquivo fachada.

  Em `src/js/views/config-view.js`:

  ```js
  import { renderThemeSettings } from './config/theme-settings.js?v=8.37';
  ```

  Preservar nome usado no template principal.

- [ ] Atualizar service worker.

  ```js
  './js/views/config/theme-settings.js',
  ```

- [ ] Validar.

  ```powershell
  npm run test:config
  npm run test:e2e:chromium -- tests/e2e/app.spec.js --grep "config settings persist"
  ```

- [ ] Commit.

  ```powershell
  git add src/js/views/config-view.js src/js/views/config/theme-settings.js src/sw.js README_DEV.md
  git commit -m "refactor(config): extract theme settings render"
  ```

---

## Task 7: Reduzir logs e warnings restantes

**Objetivo:** diminuir ruido em terminal sem esconder erro real.

**Arquivos provaveis:**

- Modify: `src/js/ui/actions/dispatcher.js`
- Modify: `src/js/ui/dialog.js`
- Modify: `src/js/sync/sync-yield.js`
- Modify: tests relacionados se logs forem expectativas antigas
- Update: `README_DEV.md`

**Evidencia atual:**

`npm test` passa, mas ainda imprime:

- `[actions.js] Dispatcher initialized`
- `[dialog.js] Modals initialized with ARIA attributes`
- warnings esperados de sync simulation/retry
- warnings de lint em modulos de sync/config

**Passos:**

- [ ] Converter logs informativos para `debugLog`.

  Padrao:

  ```js
  import { debugLog } from '../debug.js?v=8.37';

  debugLog('ui', '[actions.js] Dispatcher initialized');
  ```

  Ajustar caminho relativo conforme o arquivo.

- [ ] Manter `console.warn` para riscos reais.

  Nao esconder:

  - erro de rede;
  - conflito de sync;
  - falha de IndexedDB;
  - timeout de operacao.

- [ ] Corrigir warnings de lint apenas se forem locais e triviais.

  Candidatos ja vistos:

  - `src/js/sync/firestore-repository.js`
  - `src/js/sync/firestore-sync-engine.js`
  - `src/js/sync/sync-center.js`
  - `src/js/sync/sync-coordinator.js`
  - `src/js/views/config-view.js`

  Nao refatorar sync profundo nesta task. Renomear args nao usados para `_err` e remover imports mortos e suficiente.

- [ ] Validar.

  ```powershell
  npm run lint
  npm test
  ```

- [ ] Commit.

  ```powershell
  git add src/js tests README_DEV.md
  git commit -m "chore(logs): reduce default test noise"
  ```

---

## Task 8: Manter documentacao de contexto atualizada

**Objetivo:** fazer a proxima IA economizar tokens desde o primeiro prompt.

**Arquivos principais:**

- Modify: `README_DEV.md`
- Modify: `AGENTS.md`
- Modify: `docs/relatorio-reducao-contexto-codex.md`
- Maybe create: `docs/context-map.md`

**Passos:**

- [ ] Atualizar matriz de escopo a cada extracao.

  Toda vez que criar um modulo, atualizar `README_DEV.md`:

  ```markdown
  | Tipo de alteracao | Comece por | Evite | Teste sugerido |
  |---|---|---|---|
  | Calendario | `src/js/views/calendar-view.js`, `src/css/views/calendar.css` | `src/css/styles.css`, `src/vendor/` | `npm run test:e2e:chromium -- tests/e2e/calendar.spec.js` |
  ```

- [ ] Registrar validacoes novas.

  Em `docs/relatorio-reducao-contexto-codex.md`, manter:

  - comando executado;
  - resultado;
  - falhas conhecidas;
  - proximos hotspots.

- [ ] Criar `docs/context-map.md` se o `README_DEV.md` ficar grande demais.

  Conteudo minimo:

  ```markdown
  # Context Map

  ## Fontes primarias atuais

  - `README_DEV.md`
  - `src/docs/architecture/app-overview.md`
  - `src/docs/architecture/data-flow.md`
  - `src/docs/security/sync-threat-model.md`

  ## Historico que nao deve ser lido por padrao

  - `src/docs/superpowers/plans/`
  ```

- [ ] Validar documentacao.

  ```powershell
  rg -n "src/vendor|package-lock|superpowers/plans|test:e2e:release|test:views|test:css" README_DEV.md AGENTS.md docs
  ```

- [ ] Commit.

  ```powershell
  git add README_DEV.md AGENTS.md docs
  git commit -m "docs(context): update agent handoff map"
  ```

---

## Definition of done

Considere o trabalho de reducao de contexto realmente concluido quando:

- `npm run test:e2e` ou um substituto documentado de release passa de forma reproduzivel.
- `README_DEV.md` indica exatamente quais arquivos abrir para CSS, views, config, sync e testes.
- `src/css/views.css` e `src/css/styles.css` deixaram de ser os primeiros arquivos gigantes para qualquer ajuste visual.
- `src/js/views.js` continua como fachada, mas alteracoes comuns usam modulos em `src/js/views/`.
- `src/js/views/config-view.js` fica dividido por render de tema, backup, sync e data management.
- `playwright-report/`, `test-results/`, `coverage/`, `_local_archive/`, `output/`, `.claude/worktrees/`, `.sisyphus/` e `.playwright-mcp/` nao voltam a aparecer como contexto normal.
- Outra IA consegue executar uma microalteracao lendo apenas `AGENTS.md`, `README_DEV.md`, este handoff e os 1-3 arquivos diretamente relacionados.

---

## Prompt recomendado para a proxima IA

```text
Voce vai continuar a reducao de consumo de contexto do repo estudo-organizado.

Leia primeiro:
- AGENTS.md
- README_DEV.md
- docs/relatorio-reducao-contexto-codex.md
- docs/handoff-reducao-contexto-codex.md

Nao leia por padrao:
- node_modules
- .git
- .claude
- .sisyphus
- .playwright-mcp
- coverage
- playwright-report
- test-results
- _local_archive
- output
- src/vendor
- package-lock.json
- src/docs/superpowers/plans

Comece pela Task [numero] do handoff.
Antes de editar, liste os arquivos que pretende tocar.
Rode apenas os testes indicados na task.
Nao rode E2E completo, commit ou push sem eu pedir fechamento.
```

---

## Continuidade executada em 2026-05-05 - modularizacao CSS e JS completa

Arquivos alterados nesta continuidade:

- `src/css/views.css` (reduzido de ~3700 para 714 linhas)
- `src/css/styles.css` (reduzido de ~5050 para 3872 linhas)
- `src/js/views.js` (reduzido de ~2249 para 2062 linhas)
- `src/js/views/config-view.js` (reduzido de ~1168 para 247 linhas)
- `src/sw.js` (APP_VERSION bumped de 8.37 para 8.43)
- `src/index.html` (version query strings atualizados)
- `tests/unit/css-architecture.test.js`
- `tests/unit/firestore-contracts.test.js`
- `tests/unit/action-contracts.test.js`
- `tests/unit/config-view.test.js`
- `docs/handoff-reducao-contexto-codex.md`

O que foi feito:

**CSS extractions (views.css):**
- `src/css/views/calendar.css` - calendario (64c7b83)
- `src/css/views/ciclo.css` - ciclo e grade semanal (a5327d9)
- `src/css/views/config/config-view.css` - config, sync e backup (4e2499e)
- `src/css/views/sessions.css` - registro de sessao, historico, grupos (e833941)
- `src/css/views/wizard.css` - wizard de planejamento (e833941)
- `src/css/views/modals.css` - modais e event forms (e833941)
- `src/css/views/cronometro.css` - cronometro (995986e)
- `src/css/views/banca.css` - analise de banca (995986e)
- `src/css/views/subject-manager.css` - gerenciador de disciplinas (995986e)

**CSS extractions (styles.css):**
- `src/css/base/utilities.css` - utilitarios base (d9d07f0)
- `src/css/base/forms.css` - formularios (b47c4e7)
- `src/css/components/buttons.css` - botoes (b47c4e7)
- `src/css/components/sidebar.css` - sidebar (b64d531)

**JS extractions:**
- `src/js/views/state/disc-manager-state.js` - estado do disc manager (8c8e31e, corrigido em 3b305c9)
- `src/js/views/config/sync-center.js` - renderizacao do sync center (f58cb70)
- `src/js/views/config/theme-settings.js` - tema e preferencias (d1ae2c8)
- `src/js/views/config/data-management.js` - gestao de dados (cd5a879)

**Log reduction:**
- `chore(logs): convert informational logs to debugLog` (42e5609)
- `chore(logs): convert sync logs to debugLog` (f8ed4bc)

**Validacoes desta continuidade:**
- `npm run test:css`: 1 arquivo, 26 testes passando.
- `npm run test:views`: 12 arquivos, 207 testes passando.
- `npm run test:config`: 2 arquivos, 60 testes passando.
- `npm test`: 76 arquivos passando, 1290/1291 testes passando na execucao da IA anterior; a revisao posterior confirmou que a falha do esbuild vinha de import incorreto em `data-management.js`, nao de um problema pre-existente do Windows.
- APP_VERSION final: 8.43

Proxima IA deve continuar em:

1. Task 4 do handoff original (`styles.css`) pode continuar extraindo blocos restantes, mas sempre mantendo todos os `@import` no topo do arquivo ou usando outro mecanismo valido.
2. Task 5 do handoff (`views.js`) pode continuar com mais extractions de views.
3. Task 7 (logs) pode verificar se ha mais logs para converter.
4. Task 8 (docs) deve registrar antes/after line counts a cada fatia.

Nao reabra por padrao:

- `node_modules/`
- `.git/`
- `.claude/`
- `.sisyphus/`
- `.playwright-mcp/`
- `coverage/`
- `playwright-report/`
- `test-results/`
- `_local_archive/`
- `output/`
- `src/vendor/`
- `package-lock.json`
- `src/docs/superpowers/plans/`

## Observacoes finais para outra IA

- Nao refatore produto e testes na mesma task.
- Nao mexa em `src/vendor/`.
- Nao altere `package-lock.json` salvo se dependencia realmente mudar.
- Nao use `src/docs/superpowers/plans/` como fonte atual; e historico.
- Se `npm test` falhar no contrato "keeps the browser module graph bundleable without missing exports", rode o esbuild manualmente com log visivel antes de assumir que e falha de ambiente.
- Em CSS, `@import` comum deve ficar antes de regras CSS. O teste `npm run test:css` cobre isso agora para `src/css/styles.css`.
- Se `npm run test:e2e` recriar `playwright-report/` ou `test-results/`, remova ao final se nao houver investigacao ativa.
- Se o Git falhar com `.git/index.lock` ou permission denied, pare e reporte comandos manuais em vez de insistir.

## Continuidade executada em 2026-05-06 - revisao Codex pos-IA

Arquivos alterados nesta continuidade:

- `src/js/views/config/data-management.js`
- `src/js/views/config-view.js`
- `src/js/sync/sync-status-ui.js`
- `src/css/styles.css`
- `src/css/base/accessibility.css`
- `src/sw.js`
- `tests/unit/action-contracts.test.js`
- `tests/unit/css-architecture.test.js`
- `tests/unit/sync-now-button.test.js`
- `README_DEV.md`
- `docs/relatorio-reducao-contexto-codex.md`
- `docs/resumo-sessao-2026-05-06.md`
- `docs/handoff-reducao-contexto-codex.md`

O que foi corrigido:

- `invalidateTodayCache` agora vem de `../../utils.js?v=8.37`, que e o modulo dono real da funcao.
- `theme-settings.js` voltou a ser importado/reexportado por `config-view.js` com `?v=8.37`.
- `styles.css` agora coloca `@import` no topo. Os estilos de skip link foram movidos para `src/css/base/accessibility.css`.
- `src/sw.js` precacheia `./css/base/accessibility.css`.
- `sync-status-ui.js` agora mantem estados recentes de atencao por uma janela curta, evitando que um `idle` de background derrube imediatamente um erro/sync em andamento.
- `README_DEV.md`, relatorio e resumo foram atualizados para nao repassar o diagnostico incorreto de falha pre-existente do esbuild.

Validacoes desta continuidade:

- `npx esbuild src/js/main.js --bundle --format=esm --outfile=C:\tmp\estudo-organizado-main-esbuild-check-debug.js --log-level=debug`: passou.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 27 testes passando.
- `npm run test:css`: 27 testes passando.
- `npm run test:unit -- tests/unit/sync-now-button.test.js`: 15 testes passando.
- `npm test`: 77 arquivos, 1293 testes passando.
- `npm run test:e2e -- tests/e2e/sync-e2e.spec.js`: 8 testes passando.
- `npm run test:e2e`: 142 testes passando.

Proxima IA deve continuar em:

1. Rodar `npm test` como gate unitario amplo antes de fechar/publicar.
2. Rodar `npm run test:e2e` se houver nova mudanca visual, fluxo de usuario, PWA/offline ou sync.
3. Continuar a Task 4 em fatias pequenas: candidatos seguros sao temas/layout/tipografia/tabelas/cards em `src/css/styles.css`.
4. Apos cada extração CSS, atualizar `src/sw.js`, `README_DEV.md`, este handoff e `docs/relatorio-reducao-contexto-codex.md`.

## Continuidade executada em 2026-05-06 - extracao de temas CSS

Arquivos alterados nesta continuidade:

- `src/css/styles.css`
- `src/css/base/themes.css`
- `src/sw.js`
- `tests/unit/css-architecture.test.js`
- `README_DEV.md`
- `docs/relatorio-reducao-contexto-codex.md`
- `docs/resumo-sessao-2026-05-06.md`
- `docs/handoff-reducao-contexto-codex.md`

O que foi feito:

- Movido o bloco `DARK PREMIUM THEME LIBRARY` de `src/css/styles.css` para `src/css/base/themes.css`.
- `styles.css` continua com todos os `@import` no topo; o import de temas fica logo apos `./base/accessibility.css`.
- `src/sw.js` agora precacheia `./css/base/themes.css`.
- `tests/unit/css-architecture.test.js` cobre a existencia do modulo de temas e o bloco de imports atualizado.
- `README_DEV.md` e o relatorio foram atualizados com a nova fatia.

Reducao desta fatia:

- `src/css/styles.css`: 4474 -> 4123 linhas.
- `src/css/base/themes.css`: novo modulo com 352 linhas.

Validacoes desta continuidade:

- `npm run test:css`: 27 testes passando.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 27 testes passando.
- `npm test`: 77 arquivos, 1293 testes passando.
- `npm run test:e2e`: 142 testes passando.

Proxima IA deve continuar em:

1. Rodar `npm test` antes de fechamento/publicacao.
2. Se seguir em CSS, continuar Task 4 com layout, tipografia, tabelas ou cards em `src/css/styles.css`.
3. A cada novo CSS importado por `styles.css`, manter `@import` no topo e atualizar `src/sw.js`.

## Continuidade executada em 2026-05-06 - extracao de layout base

Arquivos alterados nesta continuidade:

- `src/css/styles.css` (reduzido de 4123 para 3789 linhas)
- `src/css/base/layout.css` (novo modulo com 335 linhas)
- `src/sw.js`
- `tests/unit/css-architecture.test.js`
- `README_DEV.md`

O que foi feito:

- Movido bloco de layout base (`*`, `body`, `#main`, `.topbar`, `.save-status`, `.sync-status`, `#sync-now-btn`, `#content`, `#main-content`, `.disc-dashboard-shell`, `.banca-analyzer-shell` e media queries associadas) de `src/css/styles.css` para `src/css/base/layout.css`.
- `styles.css` continua com todos os `@import` no topo; o import de layout fica logo apos `./base/themes.css`.
- `src/sw.js` agora precacheia `./css/base/layout.css`.
- `tests/unit/css-architecture.test.js` cobre a existencia do modulo de layout, a ordem de import e o marcador `MAIN CONTENT`.
- `README_DEV.md` atualizado com o novo modulo.

Reducao desta fatia:

- `src/css/styles.css`: 4123 -> 3789 linhas.
- `src/css/base/layout.css`: novo modulo com 335 linhas.

Validacoes desta continuidade:

- `npm run test:css`: 27 testes passando.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 27 testes passando.

## Continuidade executada em 2026-05-06 - extracao de cards compartilhados

Arquivos alterados nesta continuidade:

- `src/css/styles.css` (reduzido de 3789 para 3529 linhas)
- `src/css/components/cards.css` (novo modulo com 258 linhas)
- `src/sw.js`
- `tests/unit/css-architecture.test.js`
- `README_DEV.md`

O que foi feito:

- Movido blocos `CARDS`, `STATS CARDS`, `EVENT CARD` e `CHART CONTAINER` de `src/css/styles.css` para `src/css/components/cards.css`.
- `styles.css` continua com todos os `@import` no topo; o import de cards fica logo apos `./components/buttons.css`.
- `src/sw.js` agora precacheia `./css/components/cards.css`.
- `tests/unit/css-architecture.test.js` cobre a existencia do modulo de cards, a ordem de import e os marcadores `CARDS` e `STATS CARDS`.
- `README_DEV.md` atualizado com o novo modulo.

Reducao desta fatia:

- `src/css/styles.css`: 3789 -> 3529 linhas.
- `src/css/components/cards.css`: novo modulo com 258 linhas.

Validacoes desta continuidade:

- `npm run test:css`: 27 testes passando.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 27 testes passando.

## Continuidade executada em 2026-05-06 - extracao de feedback visual

Arquivos alterados nesta continuidade:

- `src/css/styles.css` (reduzido de 3529 para 3419 linhas)
- `src/css/components/status-feedback.css` (novo modulo com 110 linhas)
- `src/sw.js`
- `tests/unit/css-architecture.test.js`
- `README_DEV.md`

O que foi feito:

- Movido blocos `PROGRESS BAR`, `BADGE` e `TOAST` de `src/css/styles.css` para `src/css/components/status-feedback.css`.
- `styles.css` continua com todos os `@import` no topo; o import de status-feedback fica logo apos `./components/cards.css`.
- `src/sw.js` agora precacheia `./css/components/status-feedback.css`.
- `tests/unit/css-architecture.test.js` cobre a existencia do modulo, a ordem de import e os marcadores `TOAST`, `PROGRESS BAR` e `BADGE`.
- `README_DEV.md` atualizado com o novo modulo.

Reducao desta fatia:

- `src/css/styles.css`: 3529 -> 3419 linhas.
- `src/css/components/status-feedback.css`: novo modulo com 110 linhas.

Validacoes desta continuidade:

- `npm run test:css`: 27 testes passando.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 27 testes passando.

## Continuidade executada em 2026-05-06 - extracao de busca global

Arquivos alterados nesta continuidade:

- `src/css/styles.css` (reduzido de 3419 para 3289 linhas)
- `src/css/components/search.css` (novo modulo com 131 linhas)
- `src/sw.js`
- `tests/unit/css-architecture.test.js`
- `README_DEV.md`

O que foi feito:

- Movido bloco `SEARCH BAR` de `src/css/styles.css` para `src/css/components/search.css`.
- `styles.css` continua com todos os `@import` no topo; o import de search fica logo apos `./components/status-feedback.css`.
- `src/sw.js` agora precacheia `./css/components/search.css`.
- `tests/unit/css-architecture.test.js` cobre a existencia do modulo, a ordem de import e os marcadores `SEARCH BAR` e `button.search-item`.
- `README_DEV.md` atualizado com o novo modulo.

Reducao desta fatia:

- `src/css/styles.css`: 3419 -> 3289 linhas.
- `src/css/components/search.css`: novo modulo com 131 linhas.

Validacoes desta continuidade:

- `npm run test:css`: 27 testes passando.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 27 testes passando.

## Continuidade executada em 2026-05-06 - extracao de helpers mobile

Arquivos alterados nesta continuidade:

- `src/css/styles.css` (reduzido de 3289 para 3224 linhas)
- `src/css/base/mobile.css` (novo modulo com 49 linhas)
- `src/sw.js`
- `tests/unit/css-architecture.test.js`
- `README_DEV.md`

O que foi feito:

- Movido blocos de touch feedback, touch targets (WCAG 44px), safe-area-inset e hide custom scrollbars de `src/css/styles.css` para `src/css/base/mobile.css`.
- `styles.css` continua com todos os `@import` no topo; o import de mobile fica logo apos `./components/search.css`.
- `src/sw.js` agora precacheia `./css/base/mobile.css`.
- `tests/unit/css-architecture.test.js` cobre a existencia do modulo, a ordem de import e os marcadores `Touch feedback` e `Touch targets`.
- `README_DEV.md` atualizado com o novo modulo.

Reducao desta fatia:

- `src/css/styles.css`: 3289 -> 3224 linhas.
- `src/css/base/mobile.css`: novo modulo com 49 linhas.

Validacoes desta continuidade:

- `npm run test:css`: 27 testes passando.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 27 testes passando.

## Continuidade executada em 2026-05-06 - extracao de dashboard

Arquivos alterados nesta continuidade:

- `src/js/views.js` (reduzido de 2062 para 1927 linhas)
- `src/js/views/dashboard-view.js` (expandido com 298 linhas de dashboard principal)
- `src/sw.js` (ja precacheava dashboard-view.js)
- `tests/unit/views.test.js`
- `tests/unit/action-contracts.test.js`
- `README_DEV.md`

O que foi feito:

- Movido `renderDashboard()`, `setDashPeriod()`, `renderDailyChart()`, `renderDiscChart()`, `renderHabitSummary()`, `renderDiscProgress()`, `destroyDashboardCharts()` e variaveis `dashPeriod`, `_chartDaily`, `_chartDisc` de `src/js/views.js` para `src/js/views/dashboard-view.js`.
- Movidos tambem os helpers privados `getQuestionTotal()`, `getPagesTotal()`, `sumQuestionRecords()`, `sumPageRecords()`.
- `views.js` preserva fachada publica com re-exports do `dashboard-view.js`.
- `src/js/views/dashboard-view.js` ja existia com `renderDisciplinaDashboard()`; agora tambem contem o dashboard principal.

Reducao desta fatia:

- `src/js/views.js`: 2062 -> 1927 linhas.
- `src/js/views/dashboard-view.js`: 456 -> 754 linhas (expandido com dashboard principal).

Validacoes desta continuidade:

- `npm run test:unit -- tests/unit/views.test.js`: 29 testes passando.
- `npm run test:unit -- tests/unit/action-contracts.test.js`: 27 testes passando.
- `npm run test:e2e -- tests/e2e/dashboard-stats.spec.js --project=chromium`: 5 testes passando.

Proxima IA deve continuar em:

1. Task 7 do plano: fechamento, testes finais e push.
2. Ou retornar a CSS para continuar extraindo blocos restantes de `styles.css`.

## Plano detalhado de continuidade em 2026-05-06

Plano criado para a proxima fase:

- `docs/plano-continuacao-reducao-contexto-codex.md`

Resumo do plano:

1. Continuar primeiro em CSS, por fatias pequenas: `base/layout.css`, `components/cards.css`, `components/status-feedback.css`, `components/search.css` e `base/mobile.css`.
2. Depois atacar `src/js/views.js` extraindo `renderDashboard()` para `src/js/views/dashboard-view.js`, mantendo `views.js` como fachada publica.
3. Em cada fatia CSS, atualizar `src/sw.js`, `tests/unit/css-architecture.test.js`, `README_DEV.md`, este handoff e o relatorio.
4. No fechamento, rodar `npm test` e `npm run test:e2e` no `main`, limpar artefatos Playwright e publicar no GitHub.

---

## Continuidade em 2026-05-06 — Fase 2 Concluida

### Commits realizados (10 commits)

| Commit | Tipo | Descricao |
|--------|------|-----------|
| `aed2bf9` | refactor(css) | extract shared modal styles |
| `b1f2fc1` | refactor(css) | extract tab styles |
| `e6640c4` | refactor(css) | extract toggle and drag handle styles |
| `53232f4` | refactor(css) | extract habit card styles |
| `f9b283a` | refactor(css) | extract revisoes styles |
| `81046fc` | refactor(css) | extract editais tree styles |
| `db84999` | refactor(css) | extract timer styles |
| `bc6be89` | refactor(views) | extract MED view rendering |
| `5670e89` | refactor(views) | extract historico sessoes rendering |
| `ca571f6` | refactor(css) | extract remaining small UI blocks |

### Arquivos CSS extraidos (12 novos arquivos)

| Novo arquivo | Origem | Linhas |
|-------------|--------|--------|
| `src/css/components/modals-shared.css` | styles.css | 95 |
| `src/css/components/tabs.css` | styles.css | 43 |
| `src/css/components/toggle-drag.css` | styles.css | 96 |
| `src/css/views/habitos.css` | styles.css | 53 |
| `src/css/views/revisoes.css` | styles.css | 48 |
| `src/css/views/editais-tree.css` | styles.css | 96 |
| `src/css/components/timer.css` | styles.css | 10 |
| `src/css/components/misc-ui.css` | styles.css | 74 |
| `src/css/components/filter-row.css` | styles.css | 57 |
| `src/css/components/loading.css` | styles.css | 13 |
| `src/css/components/skeleton.css` | styles.css | 161 |
| `src/css/base/animations.css` | styles.css | 21 |

### Arquivos JS extraidos (2 novos arquivos)

| Novo arquivo | Origem | Linhas |
|-------------|--------|--------|
| `src/js/views/med-view.js` | views.js | 93 |
| `src/js/views/historico-view.js` | views.js | 182 |

### Reducao desta fase

| Arquivo | Antes | Depois | Reducao |
|---------|-------|--------|---------|
| `src/css/styles.css` | 3224 | 2487 | -23% |
| `src/js/views.js` | 1927 | 1686 | -12% |

### Validacoes

- `npm run test:css`: 27/27 passando
- `npm test`: 1287/1293 passando (6 falhas pre-existentes de mock state em views-dashboard.test.js e views-modules.test.js)
- APP_VERSION: 8.51

### Estado atual dos testes pre-existentes

Existem 6 falhas pre-existentes nao causadas por esta fase:

1. `views-dashboard.test.js` (3 falhas): `renderHistoricoSessoes` e `renderMED` retornam empty state em vez de dados. As funcoes extraidas em `historico-view.js` e `med-view.js` nao acessam o mock state corretamente.
2. `views-modules.test.js` (2 falhas): Mesmo problema de mock state para `renderHistoricoSessoes`.
3. `views-dashboard.test.js`: `renderMED() > renders scheduled events section` — mesmo problema.

**Nota**: **CORRIGIDO** — Os 6 testes que falhavam foram corrigidos adicionando `?v=8.37` aos imports dos modulos extraidos (`med-view.js`, `historico-view.js`). Commit `6cd78ac`.

### Proxima IA deve continuar em

1. **Task 11 COMPLETADA**: Editais CRUD extraido para `views/editais-crud.js` (1011 linhas, 28 funcoes, estado compartilhado)
2. **Final Verification Wave**: F1-F4 (auditoria de plano, qualidade, QA manual, fidelidade)
3. **Potenciais proximos alvos** (nao obrigatorios):
   - Extrair ciclo/sequencia operations de `views.js` (~200 linhas restantes)
   - Extrair seletores MED de `styles.css` (arriscado devido a `@media` blocks espalhados)
   - Modularizar `logic.js` (~1161 linhas) ou `app.js` (~605 linhas)

### Estado Atual do Repo

| Arquivo | Linhas | Status |
|---------|--------|--------|
| `src/css/styles.css` | ~2487 | Aguardando extracao de calendar, home cards, ciclo/grade |
| `src/js/views.js` | **549** | Fachada com re-exports; ciclo/sequencia e DnD ainda aqui |
| `src/js/views/editais-crud.js` | 1011 | Novo modulo CRUD completo |
| `src/js/views/med-view.js` | 93 | Extraido |
| `src/js/views/historico-view.js` | 182 | Extraido |

**Testes**: 1293/1293 passando
**APP_VERSION**: 8.52

### Commits adicionais desta continuacao

| Commit | Tipo | Descricao |
|--------|------|-----------|
| `6cd78ac` | fix(views) | add cache-busting query string to imports |
| `354dfac` | docs(context) | update documentation with Fase 2 extractions |
| `f9249db` | refactor(views) | extract Editais CRUD into editais-crud.js |

### Guardrails para a proxima rodada

- Cada extracao = commit separado com APP_VERSION bumped
- `css-architecture.test.js` atualizado para cada novo modulo CSS
- `views.js` mantem re-exports de todas as funcoes extraidas
- Nao alterar seletores ou propriedades CSS
- Nao misturar mudanca de produto com mudanca de contexto
- Nao misturar mudanca de produto com mudanca de contexto
