# Continuacao da Reducao de Contexto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** continuar a reducao de contexto do `estudo-organizado` em fatias pequenas, preservando comportamento, testes e handoff para outra IA.

**Architecture:** manter `src/css/styles.css` e `src/js/views.js` como fachadas/legado enquanto blocos coesos saem para modulos por responsabilidade. Cada extracao deve atualizar imports, precache do service worker, contratos unitarios e documentacao antes de commit.

**Tech Stack:** HTML/CSS/JavaScript vanilla ES modules, Vitest, Playwright, service worker local, Git/GitHub.

---

## Estado de Partida

- Branch base: `main`.
- Ultimo commit publicado: `3b92fe8 refactor(css): extrai temas premium`.
- Gates atuais: `npm test` com 1293 testes passando e `npm run test:e2e` com 142 testes passando.
- Hotspots atuais:
  - `src/css/styles.css`: 4123 linhas.
  - `src/js/views.js`: 2062 linhas.
  - `src/js/components.js`: potencial posterior, mas nao deve ser misturado com CSS.
- Nao usar `src/docs/superpowers/plans/` como fonte atual; o handoff vigente esta em `docs/handoff-reducao-contexto-codex.md`.

---

## Estrutura de Arquivos Planejada

Criar ou modificar estes arquivos ao longo da continuacao:

- Create: `src/css/base/layout.css`
  - Responsavel por `body`, `.main-content`, `.topbar`, espacamentos globais e guardas de layout de pagina.
- Create: `src/css/components/cards.css`
  - Responsavel por `.card`, `.card-header`, `.stats-*`, `.event-card` generico e variantes compartilhadas.
- Create: `src/css/components/status-feedback.css`
  - Responsavel por `.toast-*`, `.badge-*`, `.progress-*`, foco visivel e feedback visual generico.
- Create: `src/css/components/search.css`
  - Responsavel por `.search-*` e resets de botao de resultado de busca.
- Create: `src/css/base/mobile.css`
  - Responsavel por helpers touch/mobile, safe area, scrollbars touch e ajustes responsivos realmente globais.
- Create: `src/js/views/dashboard-view.js`
  - Responsavel por `renderDashboard()` e helpers imediatamente privados do dashboard.
- Modify: `src/css/styles.css`
  - Manter somente imports no topo e blocos ainda nao extraidos.
- Modify: `src/sw.js`
  - Incluir cada novo CSS em `ASSET_PATHS`.
- Modify: `tests/unit/css-architecture.test.js`
  - Exigir existencia, import order e conteudo marcador dos novos modulos CSS.
- Modify: `tests/unit/action-contracts.test.js`
  - Manter o grafo browser bundleable e, se necessario, exigir import versionado do novo modulo JS.
- Modify: `tests/unit/views.test.js` e/ou `tests/unit/views-modules.test.js`
  - Preservar contratos de `renderDashboard()` via fachada `views.js`.
- Modify: `README_DEV.md`
  - Atualizar mapa de modulos extraidos.
- Modify: `docs/handoff-reducao-contexto-codex.md`
  - Registrar cada fatia, validacoes e proximo ponto de entrada.
- Modify: `docs/relatorio-reducao-contexto-codex.md`
  - Registrar antes/depois de linhas e resultado dos gates.
- Modify: `docs/resumo-sessao-2026-05-06.md`
  - Acrescentar resumo curto se a sessao continuar no mesmo contexto historico.

---

## Regras de Execucao

- Trabalhar em worktree separada:

```powershell
git worktree add .worktrees/codex-continuacao-reducao-contexto -b codex/continuacao-reducao-contexto
```

- Antes de cada fatia CSS:

```powershell
npm run test:css
```

- Ao tocar `src/js/views.js`:

```powershell
npm run test:unit -- tests/unit/views.test.js
npm run test:unit -- tests/unit/views-modules.test.js
npm run test:unit -- tests/unit/action-contracts.test.js
```

- Fechamento de qualquer fatia publicada:

```powershell
npm test
npm run test:e2e
git status --short --branch
```

- Se `npm run test:e2e` recriar `test-results/` ou `playwright-report/`, remover esses artefatos se nao houver investigacao ativa.
- Commitar em fatias pequenas com mensagens convencionais.
- Push para `main` ao final, conforme `AGENTS.md`.

---

### Task 1: Extrair Layout Base de `styles.css`

**Files:**
- Create: `src/css/base/layout.css`
- Modify: `src/css/styles.css`
- Modify: `src/sw.js`
- Modify: `tests/unit/css-architecture.test.js`
- Modify: `README_DEV.md`
- Modify: `docs/handoff-reducao-contexto-codex.md`
- Modify: `docs/relatorio-reducao-contexto-codex.md`

- [ ] **Step 1: Confirmar baseline CSS**

Run:

```powershell
npm run test:css
```

Expected: `27 passed`.

- [ ] **Step 2: Medir linhas antes**

Run:

```powershell
(Get-Content 'src/css/styles.css').Count
```

Expected: registrar o numero atual no relatorio.

- [ ] **Step 3: Criar `src/css/base/layout.css`**

Mover de `src/css/styles.css` os blocos marcados por:

```text
body
/* MAIN CONTENT */
/* CONTENT SPACING */
/* Neutralize ad-hoc top-level margins from specific views */
/* Fallback spacing when stack mode is disabled */
/* Disciplina dashboard layout guard */
/* Verticalizado */
/* Inteligencia de Banca */
```

Manter a ordem original dos seletores dentro do novo arquivo.

- [ ] **Step 4: Importar layout no topo de `styles.css`**

O topo esperado de `src/css/styles.css` fica:

```css
@import './base/accessibility.css';
@import './base/themes.css';
@import './base/layout.css';
@import './components/sidebar.css';
@import './components/buttons.css';
@import './base/utilities.css';
@import './base/forms.css';
```

- [ ] **Step 5: Atualizar service worker**

Adicionar em `src/sw.js`:

```js
'./css/base/layout.css',
```

logo apos `./css/base/themes.css`.

- [ ] **Step 6: Atualizar contrato CSS**

Em `tests/unit/css-architecture.test.js`, incluir:

```js
'base/layout.css'
```

na lista de arquivos esperados, adicionar o import no bloco esperado e validar:

```js
expect(read('src/css/base/layout.css')).toContain('MAIN CONTENT');
```

- [ ] **Step 7: Rodar teste focado**

Run:

```powershell
npm run test:css
```

Expected: `27 passed`.

- [ ] **Step 8: Atualizar documentacao**

Adicionar em `README_DEV.md`:

```markdown
- `src/css/base/layout.css`: layout base, topbar e espacamentos globais.
```

Registrar no handoff e relatorio:

```markdown
- `src/css/styles.css`: <antes> -> <depois> linhas.
- `src/css/base/layout.css`: novo modulo com <linhas> linhas.
- Validacao: `npm run test:css`.
```

- [ ] **Step 9: Commit**

Run:

```powershell
git add src/css/styles.css src/css/base/layout.css src/sw.js tests/unit/css-architecture.test.js README_DEV.md docs/handoff-reducao-contexto-codex.md docs/relatorio-reducao-contexto-codex.md
git commit -m "refactor(css): extrai layout base"
```

---

### Task 2: Extrair Cards e Estatisticas Compartilhadas

**Files:**
- Create: `src/css/components/cards.css`
- Modify: `src/css/styles.css`
- Modify: `src/sw.js`
- Modify: `tests/unit/css-architecture.test.js`
- Modify: `README_DEV.md`
- Modify: docs de handoff/relatorio

- [ ] **Step 1: Confirmar baseline**

Run:

```powershell
npm run test:css
```

Expected: `27 passed`.

- [ ] **Step 2: Criar `src/css/components/cards.css`**

Mover de `src/css/styles.css` os blocos:

```text
/* CARDS */
/* STATS CARDS */
/* EVENT CARD */
/* CHART CONTAINER */
```

Nao mover blocos especificos de `DASHBOARD REDESIGN`, `CICLO DE ESTUDOS` ou view-specific nesta task.

- [ ] **Step 3: Importar cards no topo de `styles.css`**

Adicionar:

```css
@import './components/cards.css';
```

apos `@import './components/buttons.css';`.

- [ ] **Step 4: Atualizar SW e teste**

Adicionar `./css/components/cards.css` em `src/sw.js`.

Em `tests/unit/css-architecture.test.js`, validar:

```js
expect(read('src/css/components/cards.css')).toContain('CARDS');
expect(read('src/css/components/cards.css')).toContain('STATS CARDS');
```

- [ ] **Step 5: Rodar testes**

Run:

```powershell
npm run test:css
npm run test:e2e -- tests/e2e/app.spec.js --grep "no horizontal overflow"
```

Expected: CSS com `27 passed`; E2E focado com `1 passed`.

- [ ] **Step 6: Documentar e commit**

Atualizar `README_DEV.md`, handoff e relatorio com line counts.

Run:

```powershell
git add src/css/styles.css src/css/components/cards.css src/sw.js tests/unit/css-architecture.test.js README_DEV.md docs/handoff-reducao-contexto-codex.md docs/relatorio-reducao-contexto-codex.md
git commit -m "refactor(css): extrai cards compartilhados"
```

---

### Task 3: Extrair Feedback Visual Compartilhado

**Files:**
- Create: `src/css/components/status-feedback.css`
- Modify: `src/css/styles.css`
- Modify: `src/sw.js`
- Modify: `tests/unit/css-architecture.test.js`
- Modify: docs/mapa

- [ ] **Step 1: Criar modulo de feedback**

Mover de `src/css/styles.css`:

```text
/* Foco visivel para acessibilidade - navegacao por teclado */
/* PROGRESS BAR */
/* BADGE */
/* TOAST */
```

- [ ] **Step 2: Importar no topo**

Adicionar:

```css
@import './components/status-feedback.css';
```

apos `@import './components/buttons.css';`.

- [ ] **Step 3: Atualizar contrato**

Adicionar em `tests/unit/css-architecture.test.js`:

```js
expect(read('src/css/components/status-feedback.css')).toContain('TOAST');
expect(read('src/css/components/status-feedback.css')).toContain('PROGRESS BAR');
expect(read('src/css/components/status-feedback.css')).toContain('BADGE');
```

- [ ] **Step 4: Validar**

Run:

```powershell
npm run test:css
npm run test:e2e -- tests/e2e/app.spec.js --grep "keeps empty-state CTA text readable"
```

Expected: CSS com `27 passed`; E2E focado com `1 passed`.

- [ ] **Step 5: Documentar e commit**

Run:

```powershell
git add src/css/styles.css src/css/components/status-feedback.css src/sw.js tests/unit/css-architecture.test.js README_DEV.md docs/handoff-reducao-contexto-codex.md docs/relatorio-reducao-contexto-codex.md
git commit -m "refactor(css): extrai feedback visual"
```

---

### Task 4: Extrair Busca Global

**Files:**
- Create: `src/css/components/search.css`
- Modify: `src/css/styles.css`
- Modify: `src/sw.js`
- Modify: `tests/unit/css-architecture.test.js`
- Modify: docs/mapa

- [ ] **Step 1: Mover bloco de busca**

Mover:

```text
/* SEARCH BAR */
```

incluindo `.search-wrap`, `.search-input`, `.search-results`, `.search-item`, `button.search-item` e estados de hover/focus ate antes de `/* MOBILE HAMBURGER */`.

- [ ] **Step 2: Importar**

Adicionar:

```css
@import './components/search.css';
```

apos `@import './components/status-feedback.css';`.

- [ ] **Step 3: Atualizar testes**

Adicionar:

```js
expect(read('src/css/components/search.css')).toContain('SEARCH BAR');
expect(read('src/css/components/search.css')).toContain('button.search-item');
```

- [ ] **Step 4: Validar busca**

Run:

```powershell
npm run test:css
npm run test:e2e -- tests/e2e/app.spec.js --grep "search finds disciplines"
npm run test:e2e -- tests/e2e/app.spec.js --grep "search finds habit records"
```

Expected: comandos passando.

- [ ] **Step 5: Documentar e commit**

Run:

```powershell
git add src/css/styles.css src/css/components/search.css src/sw.js tests/unit/css-architecture.test.js README_DEV.md docs/handoff-reducao-contexto-codex.md docs/relatorio-reducao-contexto-codex.md
git commit -m "refactor(css): extrai busca global"
```

---

### Task 5: Extrair Helpers Mobile Globais

**Files:**
- Create: `src/css/base/mobile.css`
- Modify: `src/css/styles.css`
- Modify: `src/sw.js`
- Modify: `tests/unit/css-architecture.test.js`
- Modify: docs/mapa

- [ ] **Step 1: Mover helpers mobile globais**

Mover apenas blocos globais, nao os especificos de calendario ou ciclo:

```text
/* TOUCH DEVICE */
/* Touch feedback on interactive elements */
/* Touch targets: WCAG 44px minimum */
/* Safe-area-inset for notched devices */
/* Hide custom scrollbars on touch devices */
/* Screen reader only utility */
/* Mobile visual stability */
```

- [ ] **Step 2: Deixar blocos especificos no lugar**

Nao mover nesta task:

```text
/* Mobile Calendar */
/* CICLO DE ESTUDOS */
/* WIZARD STEPPER */
```

Esses blocos pertencem aos modulos `views/calendar.css`, `views/ciclo.css` ou `views/wizard.css` e devem ser avaliados em outra fatia.

- [ ] **Step 3: Importar**

Adicionar:

```css
@import './base/mobile.css';
```

depois dos componentes e antes dos blocos legados restantes.

- [ ] **Step 4: Validar mobile**

Run:

```powershell
npm run test:css
npm run test:e2e -- tests/e2e/smoke-critical.spec.js --grep "viewport mobile"
npm run test:e2e -- tests/e2e/app.spec.js --grep "no horizontal overflow"
```

Expected: comandos passando.

- [ ] **Step 5: Documentar e commit**

Run:

```powershell
git add src/css/styles.css src/css/base/mobile.css src/sw.js tests/unit/css-architecture.test.js README_DEV.md docs/handoff-reducao-contexto-codex.md docs/relatorio-reducao-contexto-codex.md
git commit -m "refactor(css): extrai helpers mobile"
```

---

### Task 6: Extrair `renderDashboard()` de `views.js`

**Files:**
- Create: `src/js/views/dashboard-view.js`
- Modify: `src/js/views.js`
- Modify: `tests/unit/views.test.js`
- Modify: `tests/unit/action-contracts.test.js`
- Modify: `README_DEV.md`
- Modify: docs de handoff/relatorio

- [ ] **Step 1: Confirmar baseline JS**

Run:

```powershell
npm run test:unit -- tests/unit/views.test.js
npm run test:unit -- tests/unit/action-contracts.test.js
```

Expected: ambos passando.

- [ ] **Step 2: Criar modulo de dashboard**

Criar `src/js/views/dashboard-view.js` movendo `renderDashboard(el)` de `src/js/views.js` e apenas os helpers privados usados exclusivamente por esse renderizador.

O export publico deve ser:

```js
export function renderDashboard(el) {
  // corpo movido de src/js/views.js, preservando comportamento
}
```

- [ ] **Step 3: Preservar fachada de `views.js`**

Substituir a implementacao removida por re-export:

```js
export { renderDashboard } from './views/dashboard-view.js';
```

Se algum import interno precisar da fachada versionada, manter o padrao existente:

```js
import { algumaFuncao } from '../views.js?v=8.37';
```

Nao trocar versoes nesta task, salvo se testes existentes exigirem.

- [ ] **Step 4: Atualizar contrato de bundle**

Em `tests/unit/action-contracts.test.js`, se houver lista de imports versionados, adicionar uma assercao para o modulo novo somente se o padrao do arquivo ja fizer isso. O contrato minimo e manter:

```powershell
npm run test:unit -- tests/unit/action-contracts.test.js
```

passando, porque ele bundleia `src/js/main.js`.

- [ ] **Step 5: Rodar testes focados**

Run:

```powershell
npm run test:unit -- tests/unit/views.test.js
npm run test:unit -- tests/unit/views-dashboard.test.js
npm run test:unit -- tests/unit/action-contracts.test.js
npm run test:e2e -- tests/e2e/dashboard-stats.spec.js
```

Expected: comandos passando.

- [ ] **Step 6: Documentar e commit**

Atualizar `README_DEV.md`:

```markdown
- `src/js/views/dashboard-view.js`: dashboard de disciplina e estatisticas.
```

Run:

```powershell
git add src/js/views.js src/js/views/dashboard-view.js tests/unit/views.test.js tests/unit/action-contracts.test.js README_DEV.md docs/handoff-reducao-contexto-codex.md docs/relatorio-reducao-contexto-codex.md
git commit -m "refactor(views): extrai dashboard"
```

---

### Task 7: Fechamento e Publicacao

**Files:**
- Modify: `docs/handoff-reducao-contexto-codex.md`
- Modify: `docs/relatorio-reducao-contexto-codex.md`
- Modify: `docs/resumo-sessao-2026-05-06.md`, se a sessao ainda estiver vinculada a esse resumo.

- [ ] **Step 1: Revisar diff**

Run:

```powershell
git diff --stat
git status --short --branch
```

Expected: somente arquivos intencionais modificados.

- [ ] **Step 2: Rodar gates finais**

Run:

```powershell
npm test
npm run test:e2e
```

Expected:

```text
1293 passed
142 passed
```

Se o numero aumentar por novos testes, registrar o novo total em vez de forcar esses valores.

- [ ] **Step 3: Limpar artefatos Playwright**

Run:

```powershell
Test-Path 'test-results'
Test-Path 'playwright-report'
```

Se algum retornar `True` e nao houver investigacao ativa:

```powershell
Remove-Item -LiteralPath 'test-results' -Recurse -Force
Remove-Item -LiteralPath 'playwright-report' -Recurse -Force
```

- [ ] **Step 4: Atualizar documentos finais**

Registrar:

```markdown
- Commits criados nesta continuacao.
- Arquivos extraidos.
- Line counts antes/depois.
- Comandos executados e totais de testes.
- Proxima IA deve continuar por CSS view-specific ou por proxima extracao de `views.js`, nao pelos dois ao mesmo tempo.
```

- [ ] **Step 5: Commit de docs se necessario**

Run:

```powershell
git add docs/handoff-reducao-contexto-codex.md docs/relatorio-reducao-contexto-codex.md docs/resumo-sessao-2026-05-06.md
git commit -m "docs(context): atualiza plano de continuidade"
```

- [ ] **Step 6: Integrar e publicar**

Se estiver em worktree/branch:

```powershell
git switch main
git merge --ff-only codex/continuacao-reducao-contexto
npm test
npm run test:e2e
git push origin main
```

Expected: `main...origin/main` alinhado no final.

---

## Ordem Recomendada

1. Task 1: `base/layout.css`.
2. Task 2: `components/cards.css`.
3. Task 3: `components/status-feedback.css`.
4. Task 4: `components/search.css`.
5. Task 5: `base/mobile.css`.
6. Task 6: `views/dashboard-view.js`.
7. Task 7: fechamento, docs finais e push.

Nao executar Tasks 1-5 e Task 6 no mesmo commit. CSS e JS devem ficar separados para facilitar review e reversao.

---

## Gatilhos de Parada

Pausar e corrigir antes de continuar se:

- `npm run test:css` falhar por import depois de regra CSS.
- `npm test` falhar no bundle esbuild de `src/js/main.js`.
- Um E2E mobile indicar overflow horizontal apos mover CSS.
- `src/sw.js` nao incluir um CSS novo importado por `styles.css`.
- O diff mostrar `package-lock.json`, `src/vendor/`, `test-results/` ou `playwright-report/`.

---

## Checklist de Handoff para Outra IA

- [ ] Cada fatia tem commit proprio.
- [ ] Cada novo modulo aparece em `README_DEV.md`.
- [ ] Cada novo CSS importado por `styles.css` aparece em `src/sw.js`.
- [ ] `tests/unit/css-architecture.test.js` cobre existencia e ordem de imports.
- [ ] `docs/handoff-reducao-contexto-codex.md` tem a ultima secao de continuidade.
- [ ] `docs/relatorio-reducao-contexto-codex.md` tem line counts antes/depois.
- [ ] `npm test` e `npm run test:e2e` foram rodados no `main` antes do push final.
