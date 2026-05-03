import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from '../../vendor/firebase-client.bundle.js?v=8.34';
import { FIRESTORE_SNAPSHOT_DOC_ID, getEnvelopeUpdatedAt } from './firestore-schema.js?v=8.34';

function snapshotRef(db, uid) {
  return doc(db, 'users', uid, 'snapshots', FIRESTORE_SNAPSHOT_DOC_ID);
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


