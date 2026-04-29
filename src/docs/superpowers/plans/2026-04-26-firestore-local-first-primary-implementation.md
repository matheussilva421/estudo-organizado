# Firestore Local-First Primary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to continue this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firestore as the primary remote sync path while preserving IndexedDB as local storage and recovery.

**Architecture:** The first production-safe version uses a versioned snapshot envelope, matching the existing Cloudflare safety model. `saveStateToDB()` remains the local commit point; `sync-coordinator.js` listens to `stateSaved`, queues the latest snapshot and flushes it automatically only when Firebase is configured, the user is authenticated with Google, and Firestore is in `primary` mode.

**Tech Stack:** Vanilla ES modules, IndexedDB, Firebase JS SDK 12.12.1, Firestore, Firebase Auth, App Check, Vitest, Playwright, PWA service worker.

---

## Task 1: Firebase Runtime Foundation

**Files:**
- Create: `scripts/firebase-bundle-entry.js`
- Create: `scripts/build-firebase-bundle.mjs`
- Create: `src/js/firebase/firebase-config.js`
- Create: `src/js/firebase/firebase-client.js`
- Create: `src/vendor/firebase-client.bundle.js`
- Modify: `package.json`

- [x] Add Firebase and esbuild dependencies.
- [x] Add `npm run build:firebase`.
- [x] Bundle only Firebase APIs used by the app.
- [x] Keep Firebase disabled when config fields are empty, then wire the real Firebase web config when provided.

## Task 2: Local Outbox and Snapshot Contract

**Files:**
- Create: `src/js/sync/firestore-schema.js`
- Create: `src/js/sync/firestore-outbox.js`
- Modify: `src/js/store.js`

- [x] Upgrade IndexedDB to version 2.
- [x] Add `firestore_outbox`, `firestore_meta`, and `firestore_conflicts`.
- [x] Add `config.firestoreSync` defaults.
- [x] Strip Firestore runtime status from exportable backups.
- [x] Queue and flush a Firestore snapshot after local save when Firestore sync is enabled in `primary` mode.

## Task 3: Firestore Repository and Sync Engine

**Files:**
- Create: `src/js/sync/firestore-repository.js`
- Create: `src/js/sync/firestore-sync-engine.js`
- Modify: `src/js/app.js`
- Modify: `src/js/main.js`

- [x] Read and write `users/{uid}/snapshots/main`.
- [x] Require Google login before remote sync.
- [x] Detect stale remote snapshots before pushing.
- [x] Persist conflict metadata locally.
- [x] Expose sign-in, sign-out, enable, disable, pull, flush, and force-push actions through `window.EstudoApp`.

## Task 4: UI and Setup Artifacts

**Files:**
- Modify: `src/js/views.js`
- Modify: `src/js/ui/actions/config.js`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `firebase.json`
- Create: `src/docs/firebase-firestore-setup.md`

- [x] Add Firestore card to Configuracoes.
- [x] Show configured, signed-in, pending, synced, and conflict states.
- [x] Add restore option from Firestore.
- [x] Add owner-scoped Firestore rules with physical deletes denied.
- [x] Document setup, App Check, API key restrictions, deployment, and recovery.

## Task 5: Verification

**Files:**
- Create: `tests/unit/firestore-schema.test.js`
- Create: `tests/unit/firestore-contracts.test.js`
- Modify: existing version-sensitive tests through cache-busting update.

- [x] Test snapshot envelope creation and restore.
- [x] Test service worker caches Firestore runtime files.
- [x] Test rules remain owner-scoped and delete-safe.
- [x] Run `npm test`.
- [x] Run `npm run test:e2e`.
- [x] Commit and push the configured Firebase project.

## Task 6: Firestore Primary Auto-Sync Coordinator

**Files:**
- Create: `src/js/sync/sync-coordinator.js`
- Modify: `src/js/sync/firestore-sync-engine.js`
- Modify: `src/js/sync/sync-center.js`
- Modify: `src/js/ui/actions/config.js`
- Modify: `src/docs/api/sync-contract.md`

- [x] Add a coordinator that listens to `stateSaved` without coupling `store.js` to Firestore.
- [x] Keep automatic sync disabled in `shadow` mode.
- [x] Make `primary` mode the main UI activation path.
- [x] Route smart sync through Firestore primary instead of parallel Cloudflare/Drive tasks.
- [x] Preserve Cloudflare and Drive as manual backup/restore channels.
- [x] Pause same-ID merge collisions for review instead of silently pushing ambiguous data.

## Operational Notes

- Firestore is now activated as `primary` from the main UI path; `shadow` remains available for diagnostics without automatic pushes.
- Cloudflare and Google Drive remain available as secondary manual backup channels.
- The current remote document is a versioned snapshot, not an entity graph. This matches the selected low-risk migration path and avoids a large storage rewrite in the same change.
- A future phase can shard by entity once the Firestore path has proven reliable in real use.

## Phase A: Entity-Ready Snapshot Metadata

**Goal:** Prepare the local model for future per-entity sync without changing the
production remote path.

**Contract:** Firestore still writes only `users/{uid}/snapshots/main`. The
snapshot payload remains complete and backward-compatible, while the envelope
adds optional `entityManifest` for precise conflict context.

**Files:**
- Create: `src/js/sync/entity-metadata.js`
- Modify: `src/js/store.js`
- Modify: `src/js/sync/firestore-schema.js`
- Modify: `src/js/sync/firestore-sync-engine.js`
- Modify: `src/js/sync/sync-center.js`
- Modify: `src/js/views.js`
- Modify: `firestore.rules`
- Modify: sync docs and cache-busting version.

- [x] Add embedded `_sync` metadata for tracked entities.
- [x] Add IndexedDB `entity_meta` store with DB version 4.
- [x] Generate tombstones in `config.entityTombstones` for removed entities.
- [x] Add `entityManifest` to Firestore envelopes while preserving `payload`.
- [x] Keep `shadow`, `primary`, outbox, and explicit conflict behavior.
- [x] Use revisions and update timestamps in same-id merge decisions.
- [x] Show affected entity details in Firestore conflict review.

**Deferred to Phase B:**
- [ ] Dual-write entity collections in shadow mode.
- [ ] Firestore rules for per-entity documents.
- [ ] Deep merge UI by entity/field.
- [ ] Remote cutover from snapshot to entity graph after real-use validation.

**Continuation plan:** `src/docs/superpowers/plans/2026-04-29-firestore-entity-sync-continuation-plan.md`
