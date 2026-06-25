# Changelog

## [Unreleased]

### Reorganização do repositório e documentação

**Data**: 2026-06-25

- **chore(docs)**: toda a documentação consolidada em `docs/` (raiz); `src/docs/` foi extinto e `src/` passa a conter apenas código da app
- **chore(docs)**: nova estrutura por finalidade — `architecture/`, `api/`, `security/`, `qa/`, `releases/`, `guides/`, `plans/`, `specs/`, `sync-hardening/`, `handoffs/`, `reports/` — com índice em `docs/README.md`
- **chore(repo)**: `CLAUDE.md` e `CHANGELOG.md` passam a ser versionados (faltavam na allowlist do `.gitignore`)
- **chore(repo)**: `HANDOFF_CONTEXT.md` movido da raiz para `docs/handoffs/`
- **chore(repo)**: remoção de lixo (`debug.log`, `.bat` duplicado com typo); launcher `Abrir_Visual_Layout_Lab.bat` versionado
- **chore(build)**: `context-map.json` agora é gerado em `docs/`; novo script `npm run context:map`
- **chore(docs)**: referências atualizadas em `AGENTS.md`, `README.md`, `README_DEV.md` e nos ignores de IA (`.aiexclude`/`.codexignore`/`.cursorignore`)

### Manual Sync Redesign

**Data**: 2025-05-05

#### Mudanças Principais

- **feat(sync)**: Sincronização automática desligada por padrão (`globalSyncPaused: true`)
- **feat(ui)**: Botão "Sincronizar agora" no topbar substitui toggle de pausa/resume
- **feat(sync)**: Sincronização manual funciona mesmo com auto-sync pausado (`ignoreGlobalPause: true`)
- **feat(sync)**: Sincronização multi-canal paralela (Firestore + Cloudflare) com um clique
- **feat(sync)**: Polling automático do Firestore (30s) e Google Drive (5min) para quando auto-sync está OFF
- **feat(settings)**: Toggle "Sincronização automática" nas configurações avançadas do Sync Center
- **feat(ui)**: Painel do Sync Center mostra "Sincronização manual" quando auto-sync está OFF
- **feat(ui)**: Card de Dados mostra "Última sincronização manual" quando auto-sync está OFF
- **feat(sync)**: Proteção contra double-click durante sincronização
- **feat(sync)**: Tratamento de falha parcial (mostra qual canal falhou)

#### Arquivos Modificados

**Core:**
- `src/js/store.js` — Default `globalSyncPaused: true`
- `src/js/ui/actions/config.js` — Actions `sync-now` e `toggle-auto-sync`
- `src/js/sync/sync-coordinator.js` — Listener `globalSyncPauseChanged`
- `src/js/sync/firestore-sync-engine.js` — Polling com gate de pausa
- `src/js/app.js` — `startDrivePolling()` / `stopDrivePolling()`
- `src/js/sync/sync-center.js` — Mensagens manual-first
- `src/js/sync/sync-status-ui.js` — 5 estados do botão sync-now
- `src/js/sync/sync-lock.js` — Getter `isLocked`
- `src/js/cloud-sync.js` — Re-throw de erros para tracking
- `src/js/views/config-view.js` — Toggle + mensagens manual-first

**UI:**
- `src/index.html` — `#sync-now-btn`
- `src/css/styles.css` — Estilos do botão sync-now

**Testes:**
- `tests/unit/sync-manual.test.js` (novo) — 14+ testes de sincronização manual
- `tests/unit/sync-now-button.test.js` (novo) — 14 testes de estados do botão
- `tests/e2e/auto-sync-toggle.spec.js` (novo) — Testes E2E do toggle
- `tests/e2e/manual-sync-ui.spec.js` (novo) — Testes E2E da UI manual
- `tests/unit/app.test.js` — Testes de polling do Drive
- `tests/unit/poll-firestore-remote.test.js` — Testes de polling do Firestore
- `tests/unit/sync-coordinator.test.js` — Testes do coordinator
- `tests/unit/sync-center.test.js` — Testes de mensagens
- `tests/unit/sync-lock.test.js` — Testes de `isLocked`
- `tests/unit/config-view.test.js` — Testes de UI
- `tests/unit/config-actions.test.js` — Testes de actions
- `tests/unit/action-contracts.test.js` — Contratos de actions
- `tests/unit/no-feedback-loop.test.js` — Mock `isGlobalSyncPaused`

#### Testes

- **1291/1291 testes passando** ✅
- **0 erros de lint** ✅
- **77 arquivos de teste** ✅

#### Decisões Técnicas

- Sincronização manual bypassa `globalSyncPaused` via `ignoreGlobalPause: true`
- Firestore e Cloudflare sincronizam em paralelo via `Promise.allSettled()`
- Usuários existentes mantêm sua configuração atual (sem migração forçada)
- Cloudflare boot pull continua funcionando independentemente do auto-sync
