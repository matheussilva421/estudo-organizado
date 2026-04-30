# Sync Recovery and Backup Hardening Plan

## Baseline

- Current app: vanilla JS/PWA, IndexedDB local-first, Firestore primary remote, Cloudflare and Google Drive as secondary manual backup/restore channels.
- Current IndexedDB version: `DB_VERSION = 6`.
- Local sync stores include `entity_meta`, `firestore_outbox`, `firestore_entity_outbox`, `firestore_meta`, and `firestore_conflicts`.
- Entity sync supports `off`, `shadow`, and `primary`. In `primary`, entity docs are the active remote source and `users/{uid}/snapshots/main` remains a fallback mirror.
- Entity conflict review is already available with keep-local/keep-remote decisions per entity.

## Phase Status

- [x] Phase 0: Baseline and docs corrected so future work does not treat entity-primary as pending.
- [x] Phase 1: Added sync health model with `local_saved`, `queued`, `syncing`, `synced`, `degraded`, `conflict`, and `recovery` states.
- [x] Phase 2: Added local double-buffer helpers and checksum envelopes for `main_state_current` / `main_state_previous`.
- [x] Phase 3: Added reconnect/foreground coordinator triggers and circuit-breaker degradation after repeated flush failures.
- [x] Phase 4: Preserved entity-primary precedence with snapshot fallback behavior documented.
- [x] Phase 5: Sync Center now surfaces retry/ack metrics and entity shadow drift.
- [x] Phase 6: Added restore validation and dry-run impact helpers for JSON backup imports.
- [x] Phase 7: Added focused unit coverage for sync health, backup restore, double-buffer recovery, coordinator degradation, and Sync Center metrics.
- [x] Follow-up: Added Backup Center UI, dedicated restore preview modal, export-before-restore action, richer conflict review hints, conflict decision history, entity-first automatic flush guard, and an operational security checklist.

## Implementation Notes

- Local save still commits before remote sync via `stateSaved`.
- `createLocalStateEnvelope()` stores a checksum and schema stamp around the state payload.
- `pickRecoverableLocalState()` tries current, previous, legacy, then emergency localStorage state.
- `deriveSyncHealthState()` produces the unified health status consumed by coordinator and Sync Center.
- `validateBackupPayload()` rejects malformed JSON and runtime sync credentials before import.
- `previewRestoreImpact()` counts added, removed, and preserved entities before destructive restore confirmation.

## Validation Commands

```powershell
npm run test:unit -- tests/unit/sync-health.test.js tests/unit/backup-restore.test.js tests/unit/store.test.js tests/unit/sync-coordinator.test.js tests/unit/sync-center.test.js
npm test
npm run test:e2e
```

## Remaining Follow-Up

- Add browser screenshots for the Sync Center and Backup Center after visual QA.
- Expand chaos E2E coverage for tab crash, offline reconnect, and two-device entity conflict simulation.
- Turn the restore preview for remote channels into a true remote dry-run once Firestore/Drive/Cloudflare expose a safe read-without-apply adapter.
