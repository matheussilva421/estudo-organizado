import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from '../../vendor/firebase-client.bundle.js?v=8.37';
import { FIRESTORE_SNAPSHOT_DOC_ID, getEnvelopeUpdatedAt } from './firestore-schema.js?v=8.37';

function snapshotRef(db, uid) {
  return doc(db, 'users', uid, 'snapshots', FIRESTORE_SNAPSHOT_DOC_ID);
}

function retaFinalGuardRef(db, uid) {
  return doc(db, 'users', uid, 'syncMeta', 'reta-final-guard');
}

export async function readFirestoreSnapshot(db, uid) {
  try {
    const snap = await getDoc(snapshotRef(db, uid));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.error('Firestore read snapshot failed:', err);
    throw err;
  }
}

export async function readFirestoreRemoteManifest(db, uid) {
  try {
    const snap = await getDoc(snapshotRef(db, uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      remoteUpdatedAt: data?.payloadUpdatedAt || data?.updatedAt || null,
      deviceId: data?.deviceId || null,
    };
  } catch (err) {
    console.error('Firestore read manifest failed:', err);
    return null;
  }
}

export async function writeFirestoreSnapshot(db, uid, envelope) {
  try {
    const updatedAt = getEnvelopeUpdatedAt(envelope) || new Date().toISOString();
    await setDoc(snapshotRef(db, uid), {
      ...envelope,
      updatedAt,
      serverUpdatedAt: serverTimestamp(),
    });
    return { updatedAt };
  } catch (err) {
    console.error('Firestore write snapshot failed:', err);
    throw err;
  }
}

/**
 * Deployment probe for the v2 rules. A legacy ruleset denies this path, so a
 * successful write+read is positive evidence that the guard is installed.
 */
export async function verifyRetaFinalGuard(db, uid, deviceId) {
  const ref = retaFinalGuardRef(db, uid);
  const payload = {
    schema: 2,
    guardVersion: 1,
    deviceId,
    checkedAt: new Date().toISOString(),
  };
  try {
    await setDoc(ref, payload);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { verified: false, reason: 'guard-missing' };
    const data = snap.data() || {};
    const verified =
      data.schema === 2 &&
      data.guardVersion === 1 &&
      data.deviceId === deviceId &&
      typeof data.checkedAt === 'string' &&
      data.checkedAt.length > 0;
    return { verified, reason: verified ? 'accepted' : 'guard-mismatch' };
  } catch (err) {
    return {
      verified: false,
      reason: err?.code || err?.message || 'guard-unavailable',
    };
  }
}


