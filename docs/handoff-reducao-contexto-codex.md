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

## Observacoes finais para outra IA

- Nao refatore produto e testes na mesma task.
- Nao mexa em `src/vendor/`.
- Nao altere `package-lock.json` salvo se dependencia realmente mudar.
- Nao use `src/docs/superpowers/plans/` como fonte atual; e historico.
- Se `npm run test:e2e` recriar `playwright-report/` ou `test-results/`, remova ao final se nao houver investigacao ativa.
- Se o Git falhar com `.git/index.lock` ou permission denied, pare e reporte comandos manuais em vez de insistir.
