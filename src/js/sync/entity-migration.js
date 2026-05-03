/**
 * One-time entity migration script.
 *
 * Migrates data from the old entity-based Firestore structure to the new snapshot-only model.
 * This script should be run ONCE per user after deploying the new sync system.
 *
 * Old structure: users/{uid}/entities/{collection}/{docId}
 * New structure:  users/{uid}/snapshots/main (single document with full state)
 *
 * Usage:
 *   import { migrateEntitiesToSnapshot } from './sync/entity-migration.js?v=8.37';
 *   await migrateEntitiesToSnapshot(db, uid);
 *
 * Note: This script uses Firebase Admin SDK or REST API for entity collection reads.
 * The entity collections are NOT deleted - they become orphaned but harmless.
 * Manual cleanup via Firebase Console is recommended after successful migration.
 */

import {
  doc,
  getDoc,
  setDoc,
} from '../../vendor/firebase-client.bundle.js?v=8.37';
import {
  FIRESTORE_SNAPSHOT_DOC_ID,
  createFirestoreSnapshotEnvelope,
} from './firestore-schema.js?v=8.37';
import { mergeStudyStates } from './sync-center.js?v=8.37';

function snapshotRef(db, uid) {
  return doc(db, 'users', uid, 'snapshots', FIRESTORE_SNAPSHOT_DOC_ID);
}

/**
 * Reads entity collections using the Firestore REST API.
 * This avoids bundle size issues since the REST API doesn't need SDK imports.
 */
async function readEntitiesViaRest(apiKey, projectId, uid) {
  const collections = ['editais', 'eventos', 'arquivo', 'revisoes', 'habitos'];
  const entities = {};
  let totalEntities = 0;

  for (const col of collections) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/entities/${col}?key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) continue; // Collection doesn't exist
        console.warn(`Entity migration: failed to read ${col}: HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      const documents = data.documents || [];
      if (documents.length > 0) {
        entities[col] = documents.map((d) => ({
          id: d.name?.split('/').pop() || '',
          ...convertFirestoreValue(d.fields || {}),
        }));
        totalEntities += documents.length;
      }
    } catch (err) {
      console.warn(`Entity migration: failed to read ${col}:`, err.message);
    }
  }

  return { entities, totalEntities };
}

function convertFirestoreValue(fields) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value.stringValue !== undefined) result[key] = value.stringValue;
    else if (value.integerValue !== undefined) result[key] = parseInt(value.integerValue, 10);
    else if (value.doubleValue !== undefined) result[key] = value.doubleValue;
    else if (value.booleanValue !== undefined) result[key] = value.booleanValue;
    else if (value.timestampValue !== undefined) result[key] = value.timestampValue;
    else if (value.arrayValue !== undefined) {
      result[key] = (value.arrayValue.values || []).map((v) => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.mapValue !== undefined) return convertFirestoreValue(v.mapValue.fields || {});
        return v;
      });
    } else if (value.mapValue !== undefined) {
      result[key] = convertFirestoreValue(value.mapValue.fields || {});
    } else if (value.nullValue !== undefined) {
      result[key] = null;
    }
  }
  return result;
}

export async function migrateEntitiesToSnapshot(db, uid, options = {}) {
  const { dryRun = false, onProgress = null, apiKey = null, projectId = null } = options;
  const report = {
    startedAt: new Date().toISOString(),
    uid,
    dryRun,
    steps: [],
    error: null,
  };

  try {
    // Step 1: Read current snapshot
    onProgress?.('Reading current snapshot...');
    let currentSnapshot = null;
    try {
      const snap = await getDoc(snapshotRef(db, uid));
      if (snap.exists()) currentSnapshot = snap.data();
    } catch (err) {
      console.warn('Entity migration: failed to read snapshot:', err.message);
    }
    report.steps.push({
      step: 'read-snapshot',
      status: currentSnapshot ? 'found' : 'not-found',
    });

    // Step 2: Read entities via REST API
    onProgress?.('Reading entity collections...');
    let entities = {};
    let totalEntities = 0;

    if (apiKey && projectId) {
      const result = await readEntitiesViaRest(apiKey, projectId, uid);
      entities = result.entities;
      totalEntities = result.totalEntities;
    } else {
      // Fallback: try to read from local state if available
      onProgress?.('No API key provided, skipping entity read.');
      report.steps.push({ step: 'read-entities', status: 'skipped', reason: 'no-api-key' });
    }

    report.steps.push({
      step: 'read-entities',
      status: 'complete',
      collections: Object.keys(entities).length,
      totalDocuments: totalEntities,
    });

    if (totalEntities === 0) {
      report.steps.push({ step: 'migrate', status: 'skipped', reason: 'no entities to migrate' });
      report.completedAt = new Date().toISOString();
      return report;
    }

    // Step 3: Merge entities into snapshot state
    onProgress?.(`Merging ${totalEntities} entities into snapshot...`);
    const entityState = {};
    for (const [key, items] of Object.entries(entities)) {
      if (key === 'habitos') {
        entityState.habitos = {};
        for (const item of items) {
          const type = item.type || 'default';
          if (!entityState.habitos[type]) entityState.habitos[type] = [];
          entityState.habitos[type].push(item);
        }
      } else {
        entityState[key] = items;
      }
    }

    const localState = currentSnapshot?.payload || {};
    const mergedState = mergeStudyStates(localState, entityState);

    // Step 4: Write merged snapshot
    if (!dryRun) {
      onProgress?.('Writing merged snapshot...');
      const envelope = createFirestoreSnapshotEnvelope(
        { ...mergedState, config: { ...localState.config, ...mergedState.config } },
        { payloadUpdatedAt: new Date().toISOString() }
      );
      await setDoc(snapshotRef(db, uid), envelope);
      report.steps.push({ step: 'write-snapshot', status: 'complete' });
    } else {
      report.steps.push({ step: 'write-snapshot', status: 'dry-run-skipped' });
    }

    // Step 5: Note about entity cleanup
    report.steps.push({
      step: 'delete-entities',
      status: 'manual-cleanup-required',
      note: 'Entity collections are now orphaned. Delete via Firebase Console.',
    });

    report.completedAt = new Date().toISOString();
    onProgress?.('Migration complete!');
    return report;
  } catch (err) {
    report.error = err.message || String(err);
    report.completedAt = new Date().toISOString();
    onProgress?.(`Migration failed: ${report.error}`);
    throw err;
  }
}

export async function checkEntityMigrationNeeded(db, uid, options = {}) {
  const { apiKey = null, projectId = null } = options;
  try {
    let totalEntities = 0;

    if (apiKey && projectId) {
      const collections = ['editais', 'eventos', 'arquivo', 'revisoes', 'habitos'];
      for (const col of collections) {
        try {
          const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/entities/${col}?key=${apiKey}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            totalEntities += (data.documents || []).length;
          }
        } catch {
          // Ignore errors during check
        }
      }
    }

    return {
      needed: totalEntities > 0,
      entityCount: totalEntities,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      needed: false,
      entityCount: 0,
      error: err.message || String(err),
      checkedAt: new Date().toISOString(),
    };
  }
}
