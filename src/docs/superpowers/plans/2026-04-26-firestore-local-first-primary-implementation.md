# Firestore Local-First Primary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to continue this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firestore as the primary remote sync path while preserving IndexedDB as local storage and recovery.

**Architecture:** The first production-safe version uses a versioned snapshot envelope, matching the existing Cloudflare safety model. `saveStateToDB()` remains the local commit point, then a Firestore outbox queues the latest snapshot and flushes it only when Firebase is configured and the user is authenticated with Google.

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
- [x] Queue a Firestore snapshot after local save when Firestore sync is enabled.

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

## Operational Notes

- Firestore is currently activated as `shadow`; this is intentional for the first rollout.
- Cloudflare and Google Drive remain available as secondary backup channels.
- The current remote document is a versioned snapshot, not an entity graph. This matches the selected low-risk migration path and avoids a large storage rewrite in the same change.
- A future phase can shard by entity once the Firestore path has proven reliable in real use.
