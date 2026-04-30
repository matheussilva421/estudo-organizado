function byKey(items = []) {
  return new Map(items.filter((item) => item && item.key != null).map((item) => [item.key, item]));
}

function signature(item = {}) {
  return [item.revision ?? null, item.checksum ?? null, item.deletedAt ?? null].join('|');
}

export function compareSnapshotManifestToEntityDocs(snapshotEnvelope = {}, entityDocs = []) {
  const snapshot = byKey(snapshotEnvelope.entityManifest || []);
  const remote = byKey(entityDocs || []);
  const missing = [];
  const divergent = [];
  const extra = [];

  for (const [key, item] of snapshot.entries()) {
    const remoteItem = remote.get(key);
    if (!remoteItem) {
      missing.push(item);
    } else if (signature(item) !== signature(remoteItem)) {
      divergent.push({ key, snapshot: item, entity: remoteItem });
    }
  }

  for (const [key, item] of remote.entries()) {
    if (!snapshot.has(key)) extra.push(item);
  }

  return {
    ok: missing.length === 0 && divergent.length === 0 && extra.length === 0,
    missing,
    divergent,
    extra,
  };
}
