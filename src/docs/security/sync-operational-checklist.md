# Sync Operational Security Checklist

## Firestore

- Firestore rules must scope every read/write to `request.auth.uid == uid`.
- Entity documents live under `users/{uid}/entities/{entityKey}` and should be written as upserts or tombstones, not physical deletes.
- Snapshot fallback remains at `users/{uid}/snapshots/main`; it is a recovery and audit mirror, not a reason to bypass entity-primary conflict checks.
- Destructive actions in the app must require explicit confirmation: pull remote, force push, restore, tombstone/delete, and clear all data.

## Exports And Restore

- JSON exports must be produced through `createExportableState()` so runtime sync status, tokens, local credentials, conflicts, and queue state are not included.
- Restore must validate payload shape before applying state.
- Restore must show a dry-run impact preview and offer a local export before replacing data.
- Firestore, Cloudflare, and Drive restores are manual recovery actions; they do not run automatically inside the primary sync loop.

## Cloudflare

- Worker CORS origins should be configured explicitly per environment.
- Worker auth tokens must stay in isolated local credentials, never in exported study data.
- Cloudflare remains a secondary/manual channel while Firestore entity-primary is enabled.

## Release Gate

- Run `npm run lint`, `npm run format:check`, `npm test`, and `npm run test:e2e`.
- Confirm conflict UI shows export-before-resolve and per-entity decisions.
- Confirm Backup Center shows last local, Firestore, Cloudflare, and Drive status.
- Confirm no test requires real Firestore, Cloudflare, or Drive credentials.
