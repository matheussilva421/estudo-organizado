import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from '../../vendor/firebase-client.bundle.js?v=8.18';
import { FIRESTORE_SNAPSHOT_DOC_ID, getEnvelopeUpdatedAt } from './firestore-schema.js?v=8.18';

function snapshotRef(db, uid) {
  return doc(db, 'users', uid, 'snapshots', FIRESTORE_SNAPSHOT_DOC_ID);
}

export async function readFirestoreSnapshot(db, uid) {
  const snap = await getDoc(snapshotRef(db, uid));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function writeFirestoreSnapshot(db, uid, envelope) {
  const updatedAt = getEnvelopeUpdatedAt(envelope) || new Date().toISOString();
  await setDoc(snapshotRef(db, uid), {
    ...envelope,
    updatedAt,
    serverUpdatedAt: serverTimestamp()
  });
  return { updatedAt };
}
