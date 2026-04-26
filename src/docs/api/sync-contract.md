# Sync Contract

## Current Model

Sync is snapshot-based: the entire app state is pushed/pulled as a single blob. Conflict safety is handled by a versioned envelope around that blob.

Firestore is now the preferred remote channel when configured. Cloudflare remains supported as a secondary/legacy channel with the same conservative overwrite principles.

## Firestore Snapshot

Firestore stores one versioned snapshot per authenticated user:

```text
users/{uid}/snapshots/main
```

Envelope:

```json
{
  "version": 1,
  "schemaVersion": 7,
  "deviceId": "web-abc123",
  "baseRemoteUpdatedAt": "2026-04-21T10:00:00.000Z",
  "payloadUpdatedAt": "2026-04-21T11:00:00.000Z",
  "sentAt": "2026-04-21T11:00:01.000Z",
  "payload": {
    "schemaVersion": 7,
    "editais": [],
    "eventos": []
  },
  "updatedAt": "2026-04-21T11:00:00.000Z"
}
```

Write rules:

- user must be authenticated with Firebase Auth
- document path must match `users/{request.auth.uid}/snapshots/main`
- physical deletes are denied
- local save commits to IndexedDB first
- Firestore writes are queued in `firestore_outbox`
- stale remote snapshots create a conflict instead of overwriting automatically

Conflict UX:

- export local JSON before destructive resolution
- pull Firestore to replace local data
- force local push to replace Firestore snapshot

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

1. Full-state snapshots still do not merge entity-level changes.
2. Conflict UX is intentionally conservative: pull remote or force overwrite, with no merge UI yet.
3. `ALLOWED_ORIGINS` is still permissive when omitted for backward compatibility and should be configured per deployment.
4. Google Drive sync still has a separate conflict model.
