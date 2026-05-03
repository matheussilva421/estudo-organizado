# Exploracao: Testes e Patterns

**Analise da infraestrutura de testes e gaps — Maio 2026**

---

## Framework e Configuracao

- **Unit tests:** Vitest 3.2.4, ambiente jsdom, setup em `tests/helpers/test-env.js`
- **E2E tests:** Playwright 1.54.2, timeout 30s, http-server na porta 4173 (no-cache)
- **Coverage:** 45% linhas/branches/functions (limite baixo)

## Test Helpers

- `state-builders.js` — factories: `createAssunto`, `createDisciplina`, `createEdital`, `createEvento`, `createBaseState` (schema v9)
- `module-loader.js` — `loadAppModules()` reseta e importa store, logic, app, components, views
- `test-env.js` — mocks: Audio, Notification, matchMedia, localStorage, sessionStorage, indexedDB (lanca erro se nao configurado), fetch
- `e2e-state.js` — `createE2EState()`, `seedE2EState()`, `bootE2EApp()`, `flushSaveAndReload()`, `collectConsoleErrors()`

---

## O que e Testado

### Persistencia IndexedDB / Local State
- Double-buffer envelope: checksum validation, corruption rejection
- Recovery ordering: current → previous → emergency
- Export sanitization: remove credentials, preserves tombstones
- State normalization: null arrays → empty, default config
- Migrations: v1 → v9, aulas migration, _sync metadata
- Debounced rapid saves, large state (10k events), circular references
- IndexedDB mock tests: full transaction flow, save status events
- Remote shadow writes: `touchLocalBackup: false` nao cria novas revisoes

### Cloud Sync (Cloudflare Worker)
- `setSyncCreds()`: salva em IndexedDB + backward-compat
- Push/pull/merge flows com fetch
- Cloudflare Worker contract: stale write rejection (409), force overwrite, origin blocking (403), CORS preflight (204), isolated credentials

### Google Drive Sync
- UI state transitions: connected/syncing/disconnected
- File creation (no driveFileId) vs update (existing driveFileId)
- Remote-more-recent offers merge
- Pull rejects invalid data
- Merge from Drive with toast feedback

### Backup and Restore
- `validateBackupPayload()`: rejeita malformed, credentials, enabled Firestore
- `previewRestoreImpact()`: added/removed/kept/changed counts
- Rejeita driveFileId, lastSync, Firestore uid, conflictHistory

### Firestore Sync Engine
- Status: `configured: false` quando Firebase nao configurado
- Outbox queue functions exported
- Config safety: empty defaults, runtime-overrideable
- Auth redirect fallback
- Entity conflict resolution: reads entity docs before snapshot
- Firestore rules: owner-scoped, no physical deletes, immutable identity
- Local-save nao le remoto primeiro (separacao de concerns)

### Sync Coordinator
- `getSyncCoordinatorStatus()`: health tracking
- Degraded health apos falhas repetidas
- `schedulePrimarySync()`: false quando nao configurado ou conflito
- `flushPrimarySyncNow()`: snapshot queue, entity batch, retry backoff, force overwrite, auto-pull
- `initSyncCoordinator()`: stateSaved listener (ignora metadataOnly), online/visibility listeners

### Sync Conflict Model
- Cloudflare Worker: 409 rejection, force overwrite, origin blocking, CORS

### E2E Tests
- Persistence regression: event via UI, config/habits/planejamento via evaluate, reload
- Sync dados: backup export/import, Cloudflare status, simulated pull/push, Drive state, conflict resolution
- Sync simulation expanded: route-level mock de `**/__e2e/cloud-sync` (pull-vazio, push-success, 503 error, 409 conflict)
- Offline import: SW precache offline, local changes persist through offline/reconnect
- Phase 6 chaos: offline reconnect, export-before-restore, 20 rapid edits with Firestore, permission-denied, 500 error, tab crash persistence, entity conflict CTA buttons

---

## Test Gaps (O que NAO e testado)

1. **Sem testes de integracao real com Firebase** — Todos os testes Firestore usam mocking completo. Nao ha testes contra Firebase Emulator Suite (apesar de `firebase.json` estar configurado).

2. **Sem testes de concorrencia IndexedDB** — Nao ha testes para acessos concorrentes, version upgrades em DB_VERSION bumps, ou `QuotaExceededError` recovery alem do teste basico.

3. **Sem testes de race condition `stateSaved`** — Coordinator filtra `metadataOnly` events, mas nao ha teste para multiplos `stateSaved` simultaneos ou `stateSaved` durante flush in-flight.

4. **Sem E2E com Firebase mockado** — E2E usa estado simulado, mas nao ha teste que exercite o caminho do Firestore sync engine com Firebase SDK mockado.

5. **Sem testes de entity shadow verification end-to-end** — `verifyFirestoreEntityShadow` tem documentacao e action registration, mas nenhum teste unitario exercita a logica.

6. **Sem testes de `reconcileFirestorePendingState`** — Startup/auth-change repair de flags `hasPendingWrites` so verificado por analise estatica.

7. **Sem testes de `entityManifest` generation** — Snapshot envelope inclui `entityManifest`, mas nenhum teste verifica geracao com checksums, revisoes, collection names.

8. **Sem testes de tombstone lifecycle** — Tombstones (500 cap, 180 dias) documentados mas nunca testados para comportamento de capping ou expiracao.

9. **Sem testes de debounce `scheduleSave` em interacao rapida** — `store-edge-cases.test.js` so avanca timers, nao verifica numero real de writes IndexedDB.

10. **Sem testes de `mergeStudyStates` conflict resolution** — Mockado em todos os testes; logica real nunca testada com dados conflitantes local/remoto.

11. **Sem testes de SW update/fallback** — SW cacheia modulos Firebase, mas nao ha teste para SW outdated com novas features Firestore.

12. **Sem testes de carga/stress** — 10k events testado mas sem medicao de performance real ou uso de memoria.

13. **CSP rules so verificadas por analise estatica** — Nao ha tentativa real de fetches bloqueados em browser.
