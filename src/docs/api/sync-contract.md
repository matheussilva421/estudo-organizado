# Sync Contract

## Current Model

Sync is **snapshot-based**: the entire app state is pushed/pulled as a single blob.

### Push (`pushToCloudflare`)

- POSTs `structuredClone(state)` with fresh `Date.now()` timestamp in `config._lastUpdated`
- Rate-limited to 30-second minimum intervals
- Overwrites remote completely

### Pull (`pullFromCloudflare`)

- GETs remote state
- Compares `config._lastUpdated` timestamps (remote vs local)
- Applies remote if newer or if forced
- Saves via `saveStateToDB(true)` (skips push to avoid loop)

### Storage

- Cloudflare KV key: `estudo_estado_v1`
- Credentials: `cfUrl` and `cfToken` stored in `state.config` (same domain as study data)

## Known Limitations

1. **No entity versioning** — full state overwrite, no merge
2. **Credentials mixed with data** — sync tokens travel with exported payloads
3. **Client-only timestamp comparison** — Worker does not validate timestamps
4. **No conflict resolution** — last writer wins (based on `_lastUpdated`)
5. **No device awareness** — no deviceId, no device-specific conflict handling

## Target Model (Task 7)

### Versioned Envelope

```json
{
  "version": 1,
  "deviceId": "web-abc123",
  "updatedAt": "2026-04-18T18:00:00.000Z",
  "payload": {
    "schemaVersion": 7,
    "editais": [],
    "eventos": []
  }
}
```

### Credential Separation

- Sync credentials (`cfUrl`, `cfToken`) moved out of `state` into separate `syncSettings` object
- Stored in `localStorage`, not in IndexedDB state
- Not included in sync payloads or JSON exports

### Worker Validation

- Origin whitelist (not `Access-Control-Allow-Origin: *`)
- Request body schema validation
- Method restriction (GET/POST only)
- Server-side timestamp comparison before write

### UI Separation

- **Sync now** — push local state to cloud
- **Restore latest cloud backup** — pull and apply remote state
- **Export local JSON backup** — download state as file
- **Import local JSON backup** — upload and apply state from file
