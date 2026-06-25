# AI Handoff Template — Estudo Organizado

Use este documento ao iniciar uma nova sessão de trabalho no repositório
`estudo-organizado`. Leia-o primeiro, depois consulte `AGENTS.md` e
`README_DEV.md` para regras operacionais detalhadas.

> **Propósito**: guia rápido de contexto para uma IA que nunca viu o projeto.
> Mantenha-o atualizado sempre que a estrutura de módulos mudar.

---

## 1. Quick Context

| Item | Resposta |
|------|----------|
| **Propósito** | SPA para planejamento e organização de estudos para concursos públicos (Ciclo PDCA) |
| **Stack** | Vanilla JS ES Modules, HTML5, CSS3 (sem frameworks) |
| **Persistência** | IndexedDB (primário) + localStorage (emergencial/beforeunload) |
| **Gráficos** | Chart.js 4.4 (CDN via vendor) |
| **Ícones** | Font Awesome 6.4 |
| **Testes unitários** | Vitest — 78 arquivos, 393+ testes |
| **Testes E2E** | Playwright — 23 arquivos (~142 testes release gate) |
| **Service Worker** | Cache-first com stale-while-revalidate para JS/CSS |
| **APP_VERSION atual** | `8.83` (em `src/sw.js`) |
| **Query string de cache-busting** | `?v=8.37` (defasada em relação ao APP_VERSION — usar `8.37` nos imports) |

## 2. Module Graph Summary

Todos os 7 arquivos-fonte originais foram refatorados em módulos-fachada que
re-exportam de sub-módulos especializados. **NUNCA importe de um sub-módulo
diretamente** sem passar pela fachada, a menos que já seja um padrão
estabelecido (ex.: os sub-módulos de `views/editais/` são importados
diretamente por `editais-crud.js`).

### Parent → Sub-modules

| Arquivo Fachada (Parent) | Linhas | Sub-módulos | Domínio |
|---|---|---|---|
| `src/js/store.js` | 316 | `store/migrations.js`, `store/indexeddb.js`, `store/normalize-state.js`, `store/export-state.js` | Schema, estado global, IndexedDB |
| `src/js/logic.js` | 178 | `logic/timer.js`, `logic/revisions.js`, `logic/cycle.js`, `logic/disc.js`, `logic/progress.js` | Regras de domínio, timer, revisões, ciclo |
| `src/js/app.js` | 179 | `app/themes.js`, `app/modals.js`, `app/navigation.js`, `app/toast.js`, `app/save-status.js` | Orquestração, navegação, modais |
| `src/js/registro-sessao.js` | 385 | `registro-sessao/modal-renderer.js`, `registro-sessao/session-save.js` | Modal de registro pós-estudo |
| `src/js/planejamento-wizard.js` | 295 | `planejamento/step-renderers.js`, `planejamento/validation.js` | Wizard 4 etapas de planejamento |
| `src/js/views/calendar-view.js` | 327 | `views/calendar/calendar-state.js`, `views/calendar/calendar-events.js`, `views/calendar/calendar-day-panel.js` | Calendário mensal/semanal |
| `src/js/views/editais-crud.js` | 332 | `views/editais/shared-state.js`, `views/editais/delete-operations.js`, `views/editais/disc-crud.js`, `views/editais/disc-manager.js`, `views/editais/inline-editing.js`, `views/editais/aula-operations.js` | CRUD de editais, disciplinas, assuntos |

### Outros módulos relevantes

| Arquivo | Linhas | Função |
|---|---|---|
| `src/js/main.js` | 172 | Entry point — inicializa módulos e expõe `window.EstudoApp` |
| `src/js/views.js` | 504 | Fachada de views gerais (re-exports de `views/`) |
| `src/js/components.js` | 524 | Componentes reutilizáveis (event cards, cronômetro, badges) |
| `src/js/utils.js` | 258 | Formatação, escape, constantes (HABIT_TYPES, getEventStatus) |
| `src/js/sync/` (15 arquivos) | — | Sync Firestore + Cloudflare + Drive |
| `src/js/ui/actions/` (10 arquivos) | — | Handlers delegados (data-action) |
| `src/css/styles.css` | ~2487 | Folha de estilo principal (modularizada) |
| `src/css/views/` (13+ arquivos) | — | Estilos por view extraídos |

## 3. Critical Constraints

### Re-export Facade Pattern

Arquivos-fachada importam de sub-módulos e re-exportam. **Não quebre este
contrato.** Exemplo de `logic.js`:

```js
// ── Importa de sub-módulos ──
export { startTimerForEvent, toggleTimer } from './logic/timer.js';
import { timerIntervals } from './logic/timer.js';

// ── Funções locais usam os imports acima ──
```

### No Circular Imports

A dependência flui em uma direção: `sub-módulo → fachada(s) → main.js`.
Nunca importe uma fachada de volta dentro de um sub-módulo.

### APP_VERSION Bump Rule

Sempre que um novo arquivo JS ou CSS for criado:
1. Adicione-o a `ASSET_PATHS` em `src/sw.js`
2. Bump `APP_VERSION` em `src/sw.js`
3. Atualize as query strings `?v=...` nos imports se necessário

### Version Query Strings

Todos os imports entre módulos usam `?v=8.37` (cache-busting do Service
Worker). Mantenha este padrão ao criar novos imports.

## 4. Test Strategy

| Escopo | Comando | Quando usar |
|--------|---------|-------------|
| Teste CSS | `npm run test:css` | Após qualquer mudança em CSS |
| Views | `npm run test:views` | Após mudar views ou componentes |
| Config | `npm run test:config` | Após mudar configuração ou sync |
| Sync | `npm run test:sync` | Após mudar Firestore/Drive/Cloudflare |
| Unitário completo | `npm test` | Antes de fechar/publicar |
| E2E release gate | `npm run test:e2e` | Mudança visual, fluxo de usuário, PWA |
| E2E mock | `npm run test:e2e:mock` | Testes do ambiente mock |

Sempre comece pelo teste específico da área, depois suba para `npm test`.

## 5. Common Pitfalls

### Version Query Strings

Imports usam `?v=8.37`, **não** o APP_VERSION atual (`8.83`). Não "corrija"
isto — o desalinhamento é proposital (a query string é atualizada em lote
quando necessário).

### Import Paths

- Sub-módulos de `views/editais/` usam caminhos relativos a partir de
  `editais-crud.js`: `'./editais/shared-state.js'`
- Sub-módulos de `views/calendar/` usam caminhos relativos a partir de
  `calendar-view.js`: `'./calendar/calendar-state.js'`
- Módulos do `app/`, `store/`, `logic/` são importados sem sub-pasta extra
  (ex.: `'../app/themes.js'`)

### sw.js ASSET_PATHS

A lista de ativos em `ASSET_PATHS` no `src/sw.js` deve conter **todo** arquivo
JS e CSS do app shell. Se um arquivo existe mas não está na lista, o Service
Worker falhará ao fazer precache (erro silencioso — o app funciona mas o
arquivo não fica disponível offline).

### Re-export Naming

Quando um sub-módulo exporta algo com nome genérico que conflitaria na
fachada o padrão é renomear:

```js
import { validateStep as _validateStep } from './planejamento/validation.js';
```

O `_` prefix indica que é um alias interno (não re-exportado).

### Testes com Esbuild

Se `npm test` falhar com erro de bundle (esbuild), verifique se os imports
usam caminhos corretos e extensões `.js`. O teste
`action-contracts.test.js` valida que o module graph é bundleable.

---

## 6. Documentação Relacionada

| Documento | Localização | Conteúdo |
|-----------|-------------|----------|
| Regras do repositório | `AGENTS.md` | Regras essenciais, estrutura, comandos |
| Guia operacional | `README_DEV.md` | Mapa de arquivos, matriz de escopo, comandos rápidos |
| Handoff de redução de contexto | `docs/handoff-reducao-contexto-codex.md` | Histórico completo das refatorações |
| Relatório de redução | `docs/relatorio-reducao-contexto-codex.md` | Métricas de redução por fase |
| Playbook de contexto | `docs/context-budget-playbook.md` | Políticas de economia de contexto |
| Mapa de contexto | `src/docs/context-map.json` | Dados gerados pelo script `scripts/context-map.mjs` |
