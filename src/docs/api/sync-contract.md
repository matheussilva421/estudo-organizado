# Sync Contract

## Current Model

Sync is snapshot-based: the entire app state is pushed/pulled as a single blob. Conflict safety is handled by a versioned envelope around that blob.

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

## Credential Separation

- Cloudflare credentials are stored locally under `estudo_sync_creds`.
- Legacy `state.config.cfUrl` and `state.config.cfToken` remain supported for current UI compatibility.
- Synced payloads strip `cfUrl` and `cfToken`.

## Known Limitations

1. Full-state snapshots still do not merge entity-level changes.
2. Conflict UX is intentionally conservative: pull remote or force overwrite, with no merge UI yet.
3. `ALLOWED_ORIGINS` is still empty by default for backward compatibility and should be configured per deployment.
4. Google Drive sync still has a separate conflict model.
