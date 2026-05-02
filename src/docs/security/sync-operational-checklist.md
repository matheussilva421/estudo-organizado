# Sync Operational Security Checklist

## Firestore

- Firestore rules must scope every read/write to `request.auth.uid == uid`.
- Entity documents live under `users/{uid}/entities/{entityKey}` and should be written as upserts or tombstones, not physical deletes.
- Entity rules must keep `key`, `collection`, and `id` immutable after creation.
- Entity writes must use an allowed collection name, positive numeric `revision`, and tombstone payloads only when `deletedAt` is present.
- Snapshot fallback remains at `users/{uid}/snapshots/main`; it is a recovery and audit mirror, not a reason to bypass entity-primary conflict checks.
- Destructive actions in the app must require explicit confirmation: pull remote, force push, restore, tombstone/delete, and clear all data.

## Exports And Restore

- JSON exports must be produced through `createExportableState()` so runtime sync status, tokens, local credentials, conflicts, and queue state are not included.
- Restore must validate payload shape before applying state.
- Restore must show a dry-run impact preview and offer a local export before replacing data.
- Restore and export must not carry Firestore `uid`, conflict history, Google Drive file id, remote timestamps, Cloudflare URL, or Cloudflare token markers.
- Firestore, Cloudflare, and Drive restores are manual recovery actions; they do not run automatically inside the primary sync loop.

## Conflict Review

- The default conflict review must show human labels and per-entity actions, not raw JSON.
- `Manter este dispositivo` removes the conflict item and queues the local entity state for upload.
- `Usar nuvem` applies the remote entity or tombstone, then removes the conflict item.
- Conflict decision history is stored in `config.firestoreSync.conflictHistory` with `entityKey`, `decision`, `decidedAt`, and hint metadata only.
- The history must not include payload data from editais, eventos, habits, lessons, or notes.

## Performance And Chaos

- Keep sync performance metrics numeric-only under `config.syncPerformance.metrics`.
- Normal Sync Center text must not show raw metrics; metrics are advanced/debug diagnostics only.
- Chaos gates must cover rapid local edits, offline persistence, permission-denied recovery, same-entity conflict CTA, reload persistence, and export after conflict.

## Cloudflare

- Worker CORS origins should be configured explicitly per environment.
- Worker auth tokens must stay in isolated local credentials, never in exported study data.
- Cloudflare remains a secondary/manual channel while Firestore entity-primary is enabled.

## Release Gate

- Run `npm run lint`, `npm run format:check`, `npm test`, and `npm run test:e2e`.
- Confirm conflict UI shows export-before-resolve and per-entity decisions.
- Confirm Backup Center shows last local, Firestore, Cloudflare, and Drive status.
- Confirm no test requires real Firestore, Cloudflare, or Drive credentials.
- Confirm `firestore.rules` has owner scope, no physical deletes, immutable entity identity, allowed entity collections, positive revision, and tombstone validation.
