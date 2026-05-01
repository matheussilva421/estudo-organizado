const STORE_NAME = 'sync_jobs';
const DB_NAME = 'estudo_sync_jobs';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('channel', 'channel', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateJobId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  return `job_${date}_${rand}`;
}

function makeOpId(entityKey, revision) {
  return `${entityKey}@rev${revision}`;
}

export async function createSyncJob({ channel = 'firestore', kind = 'entity_delta', reason = 'local-save', docs = [], summary = {} }) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const existing = await new Promise((resolve) => {
    const req = store.index('status').getAll('pending');
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  const matchingJob = existing.find(
    (j) => j.channel === channel && j.kind === kind && j.status === 'pending'
  );

  if (matchingJob) {
    const mergedOpIds = new Set([...matchingJob.opIds, ...docs.map((d) => makeOpId(d.key, d.revision))]);
    const mergedDocs = coalesceDocs(matchingJob.docs || [], docs);

    const updatedJob = {
      ...matchingJob,
      opIds: Array.from(mergedOpIds),
      docs: mergedDocs,
      summary: {
        docsCount: mergedDocs.length,
        tombstonesCount: mergedDocs.filter((d) => d.payload === null).length,
      },
      reason,
      updatedAt: new Date().toISOString(),
    };
    store.put(updatedJob);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return updatedJob;
  }

  const job = {
    id: generateJobId(),
    channel,
    kind,
    reason,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nextAttemptAt: null,
    opIds: docs.map((d) => makeOpId(d.key, d.revision)),
    docs,
    summary: {
      docsCount: docs.length,
      tombstonesCount: docs.filter((d) => d.payload === null).length,
      ...summary,
    },
    lastError: null,
  };
  store.add(job);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return job;
}

function coalesceDocs(existing, incoming) {
  const byKey = new Map();
  for (const doc of existing) {
    byKey.set(doc.key, doc);
  }
  for (const doc of incoming) {
    const current = byKey.get(doc.key);
    if (!current || Number(doc.revision) >= Number(current.revision)) {
      byKey.set(doc.key, doc);
    }
  }
  return Array.from(byKey.values());
}

export async function getPendingSyncJob() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('status');

  return new Promise((resolve, reject) => {
    const req = index.get('pending');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function markSyncJobAttempt(jobId, error = null) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const getReq = store.get(jobId);
    getReq.onsuccess = () => {
      const job = getReq.result;
      if (!job) {
        resolve(null);
        return;
      }
      job.attempts += 1;
      job.updatedAt = new Date().toISOString();
      if (error) {
        job.lastError = String(error);
      }
      if (job.attempts >= 5) {
        job.status = 'failed';
      }
      store.put(job);
      const putTx = store.transaction;
      putTx.oncomplete = () => resolve(job);
      putTx.onerror = () => reject(putTx.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function markSyncJobCompleted(jobId) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const getReq = store.get(jobId);
    getReq.onsuccess = () => {
      const job = getReq.result;
      if (!job) {
        resolve(null);
        return;
      }
      job.status = 'completed';
      job.updatedAt = new Date().toISOString();
      job.finishedAt = new Date().toISOString();
      store.put(job);
      const putTx = store.transaction;
      putTx.oncomplete = () => resolve(job);
      putTx.onerror = () => reject(putTx.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getAllSyncJobs(limit = 20) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const jobs = (req.result || [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
      resolve(jobs);
    };
    req.onerror = () => reject(req.error);
  });
}
