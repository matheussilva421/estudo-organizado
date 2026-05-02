import { createEntityIndex } from './entity-metadata.js?v=8.32';
import {
  createFirestoreEntityDocument,
  createFirestoreTombstoneDocument,
} from './firestore-entity-schema.js?v=8.32';

const MAX_WRITES_PER_BATCH = 450;

export function buildEntityDelta({ state, previousMeta = [], now, deviceId }) {
  const currentIndex = createEntityIndex(state);
  const previousByChecksum = new Map(
    (Array.isArray(previousMeta) ? previousMeta : []).map((m) => [m.key, m])
  );
  const currentKeys = new Set(currentIndex.map((m) => m.key));

  const changedDocs = [];
  let unchangedCount = 0;
  let tombstoneCount = 0;

  const schemaVersion = state.config?.entitySync?.schemaVersion || 1;
  const sentAt = now || new Date().toISOString();

  const tombstones = state.config?.entityTombstones || [];
  const existingTombstoneKeys = new Map(tombstones.map((t) => [t.key, t]));

  const previousKeys = new Map(
    (Array.isArray(previousMeta) ? previousMeta : []).map((m) => [m.key, m])
  );

  for (const record of currentIndex) {
    const previous = previousByChecksum.get(record.key);
    const entity = getEntityByRecord(state, record);

    if (!entity) {
      unchangedCount++;
      continue;
    }

    if (!previous) {
      changedDocs.push(
        createFirestoreEntityDocument({
          key: record.key,
          collection: record.collection,
          id: record.id,
          entity,
          schemaVersion,
          sentAt,
        })
      );
      continue;
    }

    if (record.checksum !== previous.checksum || record.revision !== previous.revision) {
      changedDocs.push(
        createFirestoreEntityDocument({
          key: record.key,
          collection: record.collection,
          id: record.id,
          entity,
          schemaVersion,
          sentAt,
        })
      );
      continue;
    }

    unchangedCount++;
  }

  for (const tombstone of tombstones) {
    const previous = previousKeys.get(tombstone.key);
    if (!previous || Number(tombstone.revision) > Number(previous.revision)) {
      changedDocs.push(
        createFirestoreTombstoneDocument({
          tombstone,
          schemaVersion,
          sentAt,
        })
      );
      tombstoneCount++;
    }
  }

  for (const [key, record] of previousKeys.entries()) {
    if (!currentKeys.has(key) && !existingTombstoneKeys.has(key)) {
      changedDocs.push(
        createFirestoreTombstoneDocument({
          tombstone: {
            key,
            collection: record.collection || key.split('/')[0],
            id: record.id || key.split('/').pop(),
            deletedAt: sentAt,
            deletedBy: deviceId || null,
            revision: Number(record.revision || 0) + 1,
          },
          schemaVersion,
          sentAt,
        })
      );
      tombstoneCount++;
    }
  }

  const fullRebuild = previousMeta.length === 0 && currentIndex.length > 0;

  return {
    docs: changedDocs,
    unchangedCount,
    changedCount: changedDocs.length - tombstoneCount,
    tombstoneCount,
    skippedCount: unchangedCount,
    batchBytesEstimate: changedDocs.reduce((sum, doc) => sum + JSON.stringify(doc).length, 0),
    fullRebuild,
  };
}

function getEntityByRecord(state, record) {
  const { collection, id, key } = record;
  if (collection === 'editais') return (state.editais || []).find((e) => e.id === id);
  if (collection === 'eventos') return (state.eventos || []).find((e) => e.id === id);
  if (collection === 'arquivo') return (state.arquivo || []).find((e) => e.id === id);
  if (collection === 'revisoes') return (state.revisoes || []).find((e) => e.id === id);
  if (collection.startsWith('habitos.')) {
    const type = collection.split('.')[1];
    return (state.habitos?.[type] || []).find((e) => e.id === id);
  }
  if (collection === 'planejamento.sequencia') {
    return (state.planejamento?.sequencia || []).find((e) => e.id === id);
  }
  if (collection === 'disciplinas') {
    const editalId = key.split('/')[1];
    const edital = (state.editais || []).find((e) => e.id === editalId);
    return (edital?.disciplinas || []).find((d) => d.id === id);
  }
  if (collection === 'assuntos' || collection === 'aulas') {
    const segments = key.split('/');
    const edital = (state.editais || []).find((e) => e.id === segments[1]);
    const disciplina = (edital?.disciplinas || []).find((d) => d.id === segments[3]);
    return (disciplina?.[collection] || []).find((a) => a.id === id);
  }
  return null;
}

export function splitDeltaIntoPages(delta = {}) {
  const docs = delta.docs || [];
  if (docs.length <= MAX_WRITES_PER_BATCH) return [delta];

  const pages = [];
  for (let i = 0; i < docs.length; i += MAX_WRITES_PER_BATCH) {
    const pageDocs = docs.slice(i, i + MAX_WRITES_PER_BATCH);
    pages.push({
      ...delta,
      docs: pageDocs,
      batchBytesEstimate: pageDocs.reduce((sum, doc) => sum + JSON.stringify(doc).length, 0),
    });
  }
  return pages;
}
