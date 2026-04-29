import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch
} from '../../vendor/firebase-client.bundle.js?v=8.29';
import { FIRESTORE_SNAPSHOT_DOC_ID, getEnvelopeUpdatedAt } from './firestore-schema.js?v=8.29';
import {
  decodeEntityDocId,
  encodeEntityDocId
} from './firestore-entity-schema.js?v=8.29';

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

export function watchFirestoreSnapshot(db, uid, onRemoteSnapshot, onError) {
  return onSnapshot(
    snapshotRef(db, uid),
    (snap) => onRemoteSnapshot(snap.exists() ? snap.data() : null),
    onError
  );
}

function getEntitiesCollection(db, uid) {
  return collection(db, 'users', uid, 'entities');
}

export async function writeFirestoreEntityDocuments(db, uid, entityDocs = []) {
  if (!Array.isArray(entityDocs) || entityDocs.length === 0) return { count: 0 };
  const entityCollection = getEntitiesCollection(db, uid);
  let count = 0;

  for (let i = 0; i < entityDocs.length; i += 450) {
    const batch = writeBatch(db);
    const chunk = entityDocs.slice(i, i + 450);
    for (const entityDoc of chunk) {
      batch.set(doc(entityCollection, encodeEntityDocId(entityDoc.key)), entityDoc, { merge: true });
    }
    await batch.commit();
    count += chunk.length;
  }

  return { count };
}

export async function readFirestoreEntityDocuments(db, uid) {
  const entityCollection = getEntitiesCollection(db, uid);
  const snapshot = await getDocs(entityCollection);
  return snapshot.docs.map((entry) => ({
    ...entry.data(),
    key: entry.data().key || decodeEntityDocId(entry.id)
  }));
}
