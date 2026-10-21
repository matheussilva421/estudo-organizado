# Sync Contract

## Current Model

Sync is local-first and Firestore-primary. The local commit point is IndexedDB; Firestore can operate in entity-primary mode, while the versioned snapshot remains a fallback mirror and compatibility/recovery contract.

Firestore is the primary remote channel when configured, signed in, and enabled in `primary` mode. Cloudflare KV and Google Drive are **secondary backup/restore channels only** and are not treated as equivalent stores by the central smart sync flow.

### Secondary Channel Rules (Phase 5)

- Cloudflare and Drive are **manual-only** backup channels. They never participate in automatic sync.
- Toggling Cloudflare sync or triggering Drive sync does **not** fire the primary Firestore sync coordinator.
- Cloudflare and Drive configuration lives inside the Backup Center's advanced panel (`backup-advanced-panel`), keeping them out of the primary sync flow.
- JSON export/import is the **first-class recovery option** and appears as the primary action in the Backup Center.
- The UI describes Cloudflare and Drive explicitly as "secundario" with the note: "Nao participa do sync automatico."

## Firestore Snapshot

Firestore stores one versioned snapshot per authenticated user:

```text
users/{uid}/snapshots/main
```

Envelope:

```json
{
  "version": 1,
  "schemaVersion": 9,
  "deviceId": "web-abc123",
  "baseRemoteUpdatedAt": "2026-04-21T10:00:00.000Z",
  "payloadUpdatedAt": "2026-04-21T11:00:00.000Z",
  "sentAt": "2026-04-21T11:00:01.000Z",
  "entityManifest": [
    {
      "key": "eventos/ev_123",
      "collection": "eventos",
      "id": "ev_123",
      "updatedAt": "2026-04-21T11:00:00.000Z",
      "deletedAt": null,
      "revision": 3,
      "checksum": "8f0a1c2b"
    }
  ],
  "payload": {
    "schemaVersion": 9,
    "editais": [],
    "eventos": []
  },
  "updatedAt": "2026-04-21T11:00:00.000Z"
}
```

`entityManifest` is additive and backward-compatible. Older clients can keep reading
`payload`; newer clients use the manifest to show more precise conflict context.

## Reta Final v2 descriptor

An active Reta Final v2 plan adds a top-level `retaFinalSync` descriptor to the
same `version: 1` envelope. The payload stays readable by older clients; the
descriptor is the barrier that prevents an older client from silently replacing
newer planning revisions.

```json
{
  "retaFinalSync": {
    "schema": 2,
    "planId": "plan-abc",
    "lineageId": "plan-abc",
    "generation": 1,
    "revision": 7,
    "baseRevision": 6,
    "snapshotRevision": 8,
    "baseSnapshotRevision": 7,
    "baseRemoteUpdatedAt": "2026-10-20T11:00:00.000Z",
    "digest": "9f2c1d7a8b4e6f0a1c3d5e7f9a2b4c6d",
    "deviceId": "web-abc123",
    "state": "active",
    "capabilities": {
      "schema": 2,
      "granularMerge": true,
      "guards": { "envelope": "rules-v2", "probe": 1 }
    },
    "minRetainedRevision": 2,
    "removedBlockIds": ["blk-1"]
  }
}
```

`digest` is a deterministic digest of human intent. It ignores derived fields
(`data`, `dataEfetiva`, `categoriaTemporal`, `naoAlocado`, `concluido`,
`atrasoDias`) and sorts object keys, so two devices that hold the same plan
intent produce the same value.

Remote write contract for `users/{uid}/snapshots/main`:

- document with `retaFinalSync` rejects any write without the descriptor
- `planId`, `lineageId` and `generation` are immutable for the lineage
- the payload plan must share the descriptor lineage: `active` payloads need
  `payload.planejamento.planId == descriptor.planId`; `retired` payloads may
  omit `planejamento` or carry an inactive plan with the same `planId`
- an idempotent replay requires the entire `retaFinalSync` descriptor to be
  identical, plus byte-for-byte identical `payload` and `payloadUpdatedAt`
- every accepted write advances `snapshotRevision` by one and sets
  `baseSnapshotRevision == remote.snapshotRevision`. This separates snapshot
  writes from human plan revisions
- an academic-only write keeps `revision`, `digest` and `state` unchanged and
  carries the current tombstones; it may change events, time, questions,
  reviews or other non-plan data
- a plan advance requires `revision == remote.revision + 1` and
  `baseRevision == remote.revision`
- an advance is tombstone append-only: `minRetainedRevision` cannot decrease and
  the new `removedBlockIds` must contain every old id. The one exception is
  compaction: dropping old ids is allowed only when the new floor is at least
  the previous remote revision (`resource.data.retaFinalSync.revision`)
- rollback, revision jumps, digest changes at the same revision, and lineage
  changes are denied
- adoption of a legacy document requires `baseRevision == 0`,
  `state == 'active'`, `snapshotRevision == 1`, `baseSnapshotRevision == 0` and
  `baseRemoteUpdatedAt == remote.payloadUpdatedAt`
- a create requires `baseRevision == 0`, `snapshotRevision == 1`,
  `baseSnapshotRevision == 0` and `state == 'active'`

Every descriptor-bearing write also validates the payload shape: an `active`
descriptor must carry `payload.planejamento` as a map with `ativo == true`; a
`retired` descriptor must not carry an active `planejamento`. This prevents a
replay from swapping the payload while keeping the descriptor intact.

When the base is older than `minRetainedRevision`, the client refuses the merge
with `stale-base`. When `removedBlockIds` names a block, that block is filtered
out of any proposed merge so an old base cannot resurrect it.

The client keeps local removal tombstones in `config.firestoreSync.removedBlocks`
as `{ id, revision }`, capped at 200 entries with the newest first. The
descriptor carries `removedBlockIds` and a `minRetainedRevision` floor equal to
`max(local tombstone floor, remote minRetainedRevision)`. Pulls merge remote
tombstones into the local list and store the remote floor. A push whose
`baseRevision` is below that floor becomes `stale-base` and is not sent.
Tombstones are append-only: a restored block can be in the plan while its
tombstone remains in the lineage. Only the 200 newest tombstones are kept.
When a 201st tombstone would exceed the cap, the oldest entries are dropped and
`minRetainedRevision` rises to `max(current, config.baseRevision, base.revision)`,
so the compaction is accepted only at the previous remote head. Devices whose
base is below that floor become `stale-base` and must pull/reconcile first.

Retirement uses the same advance path with `state: 'retired'`. A retired
lineage may advance only as retired; a new plan with a different `planId`
cannot replace it without an explicit human decision. The client reports a
`reta-final-conflict` with `cause: 'lineage-change'` instead of writing.

The client also writes a deployment probe to
`users/{uid}/syncMeta/reta-final-guard` (`schema`, `guardVersion`, `deviceId`,
`checkedAt`). A legacy ruleset denies that path, so a successful write+read is
positive evidence that the rules-v2 guard is installed. If the probe is denied
or the device is offline, the outbox stays pending and the status is
`blocked-guard`; it is never reported as `synced`.

### Clearing local data with a v2 remote document

If the local state is cleared or the plan is removed while
`users/{uid}/snapshots/main` still has `retaFinalSync`, a write without the
descriptor is **denied on purpose**. The recovery path is to pull the remote
snapshot, or to perform an explicit reset outside this sync contract. There is
no client-side bypass: `forceOverwrite` does not skip the v2 CAS. A known
lineage that becomes inactive is retired with a `state: 'retired'` descriptor;
an unknown lineage must be reconciled with the remote before writing.

`forceOverwrite` remains available for legacy envelopes and explicit recovery,
but for a descriptor-bearing document it still requires the exact remote
revision as the base. A denied write becomes a `reta-final-conflict` with the
local, remote and base plans preserved for human resolution.

### Merge review and pending outbox

An automatic pull never installs a merged plan as official state. The rules are:

- `digest(local) == digest(base)` → fast-forward the remote plan (no local edits)
- `digest(local) == digest(remote)` → no-op; preserve state, base and outbox
- otherwise → `reta-final-conflict` with `cause: 'merge-review'` and a
  `proposedPlan` filtered by `removedBlockIds`; the plan is not applied

The human resolution belongs to a draft/checkpoint/commit flow. If the outbox
has any pending snapshot, pull and merge return `pending-outbox` without
applying state, clearing the base, or marking the snapshot synced. The pending
outbox is preserved.

`pullFromFirestore(true, { discardPending: true })` is the explicit recovery
path used by the confirmed "Baixar Firestore" action; `keep-remote` also passes
the flag. Without it, a forced pull with pending data is refused. Outbox removal
is identity-checked (`queuedAt` + envelope `sentAt`), so a write enqueued during
the pull survives. A no-op pull/merge emits `synced` when local and remote
digests match, otherwise `idle`; it never stays in `syncing`.

### Human conflict resolution

The Firestore block in the Sync Center renders both conflict sources:

- `config.firestoreSync.conflict` with `type: 'reta-final-conflict'`; and
- `config.syncMergeConflicts` with `type: 'reta-final-three-way'` and `items[]`.

Each review item gets a deterministic id. Duplicate `planId`/`blockId`/
`fieldPath` keys receive a numeric suffix instead of silently replacing the
first occurrence. The UI compares base, local and remote values and asks for an
explicit choice. Cancel only clears the form; it never writes state.

Resolution is one local IndexedDB transaction over `app_state` and
`reta_final_journal`. It writes, in the same transaction:

- the official state with only the resolved conflict removed;
- a manual checkpoint of the previous local plan;
- a `conflict_resolution` journal record with `operationId`, `baseRevision`,
  `before`, `after`, `deviceId` and `timestamp`;
- a pending `sync_intent`.

Success is reported only after `oncomplete`. An abort, quota failure or CAS
failure leaves the state, the checkpoint set and the conflict untouched.
The CAS uses the current local plan revision. When a compatible remote plan
exists, the resulting plan revision is `remotePlan.revision + 1` and
`basePlan`/`baseRevision` are rebased on that remote head. Without a compatible
remote plan, only “keep local” is allowed, with a monotonic local revision and
no invented remote base. A retired remote plan may be adopted explicitly;
keeping an active local plan over a retired remote is refused as resurrection.

`lastPushAt` is the only push ACK. The UI shows `synced` only when `lastPushAt`
exists, `hasPendingWrites` is false and no conflict is pending. Offline or
pending local commits remain `pending`; a failed guard probe remains
`blocked-guard`. The Reta Final conflict panel disables the generic pull/push
actions for the Firestore block.

## Entity Sync

The app now supports entity metadata, shadow entity writes, shadow verification,
entity conflict review, and controlled `entitySync.mode === 'primary'`. In
primary mode, entity docs are the active remote source and the snapshot document
is preserved as a fallback mirror.

Tracked entities:

- `editais`
- `disciplinas`
- `assuntos`
- `aulas`
- `eventos`
- `arquivo`
- `revisoes`
- `habitos.*`
- `planejamento.sequencia`

Each tracked entity can carry embedded `_sync` metadata:

```json
{
  "_sync": {
    "createdAt": "2026-04-21T10:00:00.000Z",
    "updatedAt": "2026-04-21T11:00:00.000Z",
    "deletedAt": null,
    "revision": 3,
    "updatedBy": "web-abc123"
  }
}
```

Local saves compare stable checksums that ignore `_sync`. When content changes,
the entity revision is incremented and `updatedAt`/`updatedBy` are updated. When
an entity disappears from the local index, the visible list stays deleted and a
tombstone is stored in `config.entityTombstones`.

Tombstones:

- are synced/exported because they protect multi-device deletes
- live under `config.entityTombstones`
- are capped at 500 records
- expire after 180 days

IndexedDB also stores the local entity index in `entity_meta`:

```json
{
  "key": "eventos/ev_123",
  "collection": "eventos",
  "id": "ev_123",
  "checksum": "8f0a1c2b",
  "updatedAt": "2026-04-21T11:00:00.000Z",
  "revision": 3
}
```

Write rules:

- user must be authenticated with Firebase Auth
- snapshot document path must match `users/{request.auth.uid}/snapshots/main`
- entity document paths must match `users/{request.auth.uid}/entities/{entityId}`
- physical deletes are denied
- local save commits to IndexedDB first
- `stateSaved` is the local commit event
- `sync-coordinator.js` listens to `stateSaved`, queues Firestore snapshots, queues entity batches when entity sync is active, and flushes automatically only in Firestore `primary` mode
- Firestore writes are queued in `firestore_outbox`
- stale remote snapshots create a conflict instead of overwriting automatically
- `shadow` mode never performs automatic pushes
- `entityManifest` is optional but must be a list when present

Automatic primary sync:

- `store.js` does not import Firestore or Cloudflare sync modules.
- `sync-coordinator.js` owns online side effects after local saves.
- Automatic sync requires configured Firebase, signed-in Google user, `firestoreSync.enabled === true`, `firestoreSync.mode === 'primary'`, and no active conflict.
- Failed pushes stay in the outbox and reuse the existing retry/backoff metadata.
- Manual "Sincronizar Firestore" routes through Firestore first; Cloudflare and Drive remain explicit backup actions.

Conflict UX:

- export local JSON before destructive resolution
- pull Firestore to replace local data
- force local push to replace Firestore snapshot
- same-ID merge collisions keep the local item visible and record conflict metadata instead of silently pushing a merged snapshot
- conflicts can list affected entities with collection, id, local/remote revision, and dates
- per-entity conflict resolution: users can choose to keep local or remote version for each conflicting entity individually
- entity conflict review modal shows revision comparison and decision hints (local newer, remote newer, or tie)

## Cloudflare Envelope

```json
{
  "version": 2,
  "deviceId": "web-abc123",
  "baseRemoteUpdatedAt": "2026-04-19T11:00:00.000Z",
  "payloadUpdatedAt": "2026-04-19T12:00:00.000Z",
  "sentAt": "2026-04-19T12:00:01.000Z",
  "payload": {
    "schemaVersion": 7,
    "editais": [],
    "eventos": []
  }
}
```

Field meanings:

- `version`: sync envelope version.
- `deviceId`: stable local browser/device identifier.
- `baseRemoteUpdatedAt`: remote metadata timestamp that the local payload is based on. `null` is valid only for the first push.
- `payloadUpdatedAt`: local state timestamp used as the new remote metadata timestamp after accepted writes.
- `sentAt`: transmission timestamp, informational only. It is not overwrite authority.
- `payload`: app state snapshot.
- `forceOverwrite`: optional explicit override flag for destructive/manual recovery flows.

## Push (`pushToCloudflare`)

- Clones the current state.
- Updates `payload.config._lastUpdated`.
- Removes `config.cfUrl` and `config.cfToken` from the synced payload.
- Sends the envelope above.
- Includes `baseRemoteUpdatedAt` from `state.config.cfRemoteUpdatedAt`.
- On success, stores the Worker-returned `meta.updatedAt` as `state.config.cfRemoteUpdatedAt`.
- On HTTP 409, stores `state.config.cfConflict` and tells the user to pull remote data before pushing again.

## Conflict UX

When `state.config.cfConflict` exists, the Cloudflare settings card renders a conflict panel with three explicit actions:

- Export local backup: downloads the current local state before any destructive resolution.
- Pull remote: confirms and calls `pullFromCloudflare(true)` to replace local data with the current remote snapshot.
- Force local push: confirms and calls `pushToCloudflare(true)` to overwrite the remote snapshot.

Successful remote pull clears `state.config.cfConflict`. Successful forced push also clears the conflict.

## Pull (`pullFromCloudflare`)

- GETs the remote envelope.
- Unwraps versioned or legacy snapshots.
- Compares remote payload time with local `config._lastUpdated`.
- Applies remote data if newer or if manually forced.
- Removes remote `cfUrl` and `cfToken` from local config after applying remote data.
- Stores remote metadata as `state.config.cfRemoteUpdatedAt`.
- Saves via `saveStateToDB(true)` to avoid an immediate sync loop.

## Worker Write Rules

Storage keys:

- `estudo_estado_v1`: last accepted envelope/body.
- `estudo_meta_v1`: current remote metadata.

POST behavior:

- Rejects invalid JSON.
- Rejects payloads over 5 MB.
- Requires bearer token auth.
- For versioned clients, rejects writes when `baseRemoteUpdatedAt` does not match current remote metadata.
- For legacy clients without `baseRemoteUpdatedAt`, falls back to timestamp comparison.
- Accepts stale base only when `forceOverwrite: true` is explicit.
- Returns HTTP 409 with `remoteUpdatedAt` and `remoteDeviceId` for conflicts.

## Origin Configuration

Browser origins can be configured with the Worker environment variable:

```text
ALLOWED_ORIGINS=https://estudo.example.com,http://localhost:8080
```

Behavior:

- If `ALLOWED_ORIGINS` is empty or missing, the Worker keeps backward-compatible permissive CORS.
- If `ALLOWED_ORIGINS` is set, browser requests with an `Origin` outside the list receive HTTP 403.
- Configured preflight requests receive HTTP 204 and echo the accepted origin.
- Non-browser/server requests without an `Origin` header remain allowed when bearer auth is valid.

## Credential Separation

- Cloudflare credentials are stored locally under `estudo_sync_creds`.
- Legacy `state.config.cfUrl` and `state.config.cfToken` remain supported for current UI compatibility.
- Synced payloads strip `cfUrl` and `cfToken`.

## Known Limitations

1. Entity-primary is available but should still be treated as experimental until chaos/browser validation proves real-use stability.
2. Snapshots remain required as fallback mirrors and should not be deleted in this cycle.
3. `ALLOWED_ORIGINS` is still permissive when omitted for backward compatibility and should be configured per deployment.
4. Google Drive sync still has a separate backup/restore conflict model.
5. Entity shadow mode requires manual verification via "Verificar entidades" button.
