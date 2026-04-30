import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from '../../vendor/firebase-client.bundle.js?v=8.32';
import { FIRESTORE_SNAPSHOT_DOC_ID, getEnvelopeUpdatedAt } from './firestore-schema.js?v=8.32';
import { decodeEntityDocId, encodeEntityDocId } from './firestore-entity-schema.js?v=8.32';

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

  try {
    for (let i = 0; i < entityDocs.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = entityDocs.slice(i, i + 450);
      for (const entityDoc of chunk) {
        batch.set(doc(entityCollection, encodeEntityDocId(entityDoc.key)), entityDoc, {
          merge: true,
        });
      }
      await batch.commit();
      count += chunk.length;
    }
    return { count };
  } catch (err) {
    console.error('Firestore write entity documents failed:', err);
    throw err;
  }
}

export async function readFirestoreEntityDocuments(db, uid) {
  try {
    const entityCollection = getEntitiesCollection(db, uid);
    const snapshot = await getDocs(entityCollection);
    return snapshot.docs.map((entry) => ({
      ...entry.data(),
      key: entry.data().key || decodeEntityDocId(entry.id),
    }));
  } catch (err) {
    console.error('Firestore read entity documents failed:', err);
    throw err;
  }
}
