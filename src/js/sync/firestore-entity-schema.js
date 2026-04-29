import { stableEntityChecksum } from './entity-metadata.js?v=8.29';

export const FIRESTORE_ENTITY_VERSION = 1;

export function encodeEntityDocId(key) {
  return encodeURIComponent(String(key));
}

export function decodeEntityDocId(docId) {
  return decodeURIComponent(String(docId));
}

export function createFirestoreEntityDocument({
  key,
  collection,
  id,
  entity,
  schemaVersion,
  sentAt = new Date().toISOString(),
}) {
  const sync = entity?._sync || {};
  return {
    version: FIRESTORE_ENTITY_VERSION,
    schemaVersion,
    key,
    collection,
    id,
    checksum: stableEntityChecksum(entity),
    updatedAt: sync.updatedAt || null,
    deletedAt: sync.deletedAt || null,
    revision: Number(sync.revision || 1),
    updatedBy: sync.updatedBy || null,
    payload: entity,
    sentAt,
  };
}

export function createFirestoreTombstoneDocument({
  tombstone,
  schemaVersion,
  sentAt = new Date().toISOString(),
}) {
  return {
    version: FIRESTORE_ENTITY_VERSION,
    schemaVersion,
    key: tombstone.key,
    collection: tombstone.collection,
    id: String(tombstone.id),
    checksum: null,
    updatedAt: null,
    deletedAt: tombstone.deletedAt || null,
    revision: Number(tombstone.revision || 1),
    updatedBy: tombstone.deletedBy || tombstone.updatedBy || null,
    payload: null,
    sentAt,
  };
}
