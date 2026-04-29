import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/js/sync/firestore-schema.js?v=8.29', () => ({
  FIRESTORE_SNAPSHOT_DOC_ID: 'main',
  getEnvelopeUpdatedAt: vi.fn((env) => env?.updatedAt || null)
}));

vi.mock('../../src/js/sync/firestore-entity-schema.js?v=8.29', () => ({
  encodeEntityDocId: vi.fn((key) => key.replace(/\//g, '__')),
  decodeEntityDocId: vi.fn((id) => id.replace(/__/g, '/'))
}));

const firebaseMock = {
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  setDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn(() => Promise.resolve())
  }))
};

vi.mock('../../src/vendor/firebase-client.bundle.js?v=8.29', () => firebaseMock);

const repository = await import('../../src/js/sync/firestore-repository.js?v=8.29');
const schema = await import('../../src/js/sync/firestore-schema.js?v=8.29');
const entitySchema = await import('../../src/js/sync/firestore-entity-schema.js?v=8.29');

describe('firestore-repository.js - readFirestoreSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when document does not exist', async () => {
    firebaseMock.getDoc.mockResolvedValue({ exists: () => false });
    const result = await repository.readFirestoreSnapshot({ id: 'db' }, 'user123');
    expect(result).toBeNull();
  });

  it('returns data when document exists', async () => {
    const mockData = { payload: { eventos: [] }, updatedAt: '2026-04-19T12:00:00.000Z' };
    firebaseMock.getDoc.mockResolvedValue({ exists: () => true, data: () => mockData });
    const result = await repository.readFirestoreSnapshot({ id: 'db' }, 'user123');
    expect(result).toEqual(mockData);
  });

  it('uses correct document path', async () => {
    firebaseMock.getDoc.mockResolvedValue({ exists: () => false });
    await repository.readFirestoreSnapshot({ id: 'db' }, 'user123');
    expect(firebaseMock.doc).toHaveBeenCalledWith(
      { id: 'db' }, 'users', 'user123', 'snapshots', 'main'
    );
  });
});

describe('firestore-repository.js - writeFirestoreSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes envelope with updatedAt and serverTimestamp', async () => {
    const envelope = { payload: { eventos: [] }, updatedAt: '2026-04-19T12:00:00.000Z' };
    const result = await repository.writeFirestoreSnapshot({ id: 'db' }, 'user123', envelope);
    expect(firebaseMock.setDoc).toHaveBeenCalled();
    const writtenData = firebaseMock.setDoc.mock.calls[0][1];
    expect(writtenData.updatedAt).toBe('2026-04-19T12:00:00.000Z');
    expect(writtenData.serverUpdatedAt).toEqual({ __type: 'serverTimestamp' });
    expect(result.updatedAt).toBe('2026-04-19T12:00:00.000Z');
  });

  it('falls back to current time when envelope has no updatedAt', async () => {
    vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
    const envelope = { payload: {} };
    const result = await repository.writeFirestoreSnapshot({ id: 'db' }, 'user123', envelope);
    expect(result.updatedAt).toBe('2026-04-19T12:00:00.000Z');
  });
});

describe('firestore-repository.js - watchFirestoreSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to snapshot changes', () => {
    const onRemoteSnapshot = vi.fn();
    const onError = vi.fn();
    const db = { id: 'db' };
    const uid = 'user123';

    repository.watchFirestoreSnapshot(db, uid, onRemoteSnapshot, onError);

    expect(firebaseMock.onSnapshot).toHaveBeenCalled();
    const callback = firebaseMock.onSnapshot.mock.calls[0][1];

    callback({ exists: () => true, data: () => ({ payload: {} }) });
    expect(onRemoteSnapshot).toHaveBeenCalledWith({ payload: {} });
  });

  it('passes null when document does not exist', () => {
    const onRemoteSnapshot = vi.fn();
    repository.watchFirestoreSnapshot({ id: 'db' }, 'user123', onRemoteSnapshot, vi.fn());
    const callback = firebaseMock.onSnapshot.mock.calls[0][1];
    callback({ exists: () => false });
    expect(onRemoteSnapshot).toHaveBeenCalledWith(null);
  });

  it('calls onError on subscription error', () => {
    const onError = vi.fn();
    repository.watchFirestoreSnapshot({ id: 'db' }, 'user123', vi.fn(), onError);
    const errorCallback = firebaseMock.onSnapshot.mock.calls[0][2];
    const mockError = new Error('connection lost');
    errorCallback(mockError);
    expect(onError).toHaveBeenCalledWith(mockError);
  });

  it('returns unsubscribe function', () => {
    const unsubscribe = vi.fn();
    firebaseMock.onSnapshot.mockReturnValue(unsubscribe);
    const result = repository.watchFirestoreSnapshot({ id: 'db' }, 'user123', vi.fn(), vi.fn());
    expect(result).toBe(unsubscribe);
  });
});

describe('firestore-repository.js - writeFirestoreEntityDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns count 0 for empty array', async () => {
    const result = await repository.writeFirestoreEntityDocuments({ id: 'db' }, 'user123', []);
    expect(result.count).toBe(0);
    expect(firebaseMock.writeBatch).not.toHaveBeenCalled();
  });

  it('returns count 0 for non-array input', async () => {
    const result = await repository.writeFirestoreEntityDocuments({ id: 'db' }, 'user123', null);
    expect(result.count).toBe(0);
  });

  it('writes entity documents in batches of 450', async () => {
    const docs = Array.from({ length: 500 }, (_, i) => ({
      key: `editais/ed_${i}`,
      collection: 'editais',
      id: `ed_${i}`,
      entity: { nome: `Edital ${i}` }
    }));
    const result = await repository.writeFirestoreEntityDocuments({ id: 'db' }, 'user123', docs);
    expect(result.count).toBe(500);
    expect(firebaseMock.writeBatch).toHaveBeenCalledTimes(2);
  });

  it('uses encoded doc ID for each entity', async () => {
    const docs = [{ key: 'editais/ed_1', collection: 'editais', id: 'ed_1', entity: { nome: 'Test' } }];
    await repository.writeFirestoreEntityDocuments({ id: 'db' }, 'user123', docs);
    expect(entitySchema.encodeEntityDocId).toHaveBeenCalledWith('editais/ed_1');
  });

  it('uses merge: true when setting documents', async () => {
    const batchMock = { set: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
    firebaseMock.writeBatch.mockReturnValue(batchMock);
    const docs = [{ key: 'editais/ed_1', collection: 'editais', id: 'ed_1', entity: { nome: 'Test' } }];
    await repository.writeFirestoreEntityDocuments({ id: 'db' }, 'user123', docs);
    const setCall = batchMock.set.mock.calls[0];
    expect(setCall[1]).toEqual(docs[0]);
    expect(setCall[2]).toEqual({ merge: true });
  });
});

describe('firestore-repository.js - readFirestoreEntityDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no documents', async () => {
    firebaseMock.getDocs.mockResolvedValue({ docs: [] });
    const result = await repository.readFirestoreEntityDocuments({ id: 'db' }, 'user123');
    expect(result).toEqual([]);
  });

  it('returns documents with decoded keys', async () => {
    const mockDocs = [
      { id: 'editais__ed_1', data: () => ({ key: 'editais/ed_1', collection: 'editais', entity: { nome: 'Test' } }) },
      { id: 'disciplinas__disc_1', data: () => ({ collection: 'disciplinas', entity: { nome: 'Disc' } }) }
    ];
    firebaseMock.getDocs.mockResolvedValue({ docs: mockDocs });
    const result = await repository.readFirestoreEntityDocuments({ id: 'db' }, 'user123');
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('editais/ed_1');
    expect(result[1].key).toBe('disciplinas/disc_1');
  });

  it('decodes key from doc ID when key is missing', async () => {
    const mockDocs = [
      { id: 'editais__ed_1', data: () => ({ collection: 'editais', entity: { nome: 'Test' } }) }
    ];
    firebaseMock.getDocs.mockResolvedValue({ docs: mockDocs });
    const result = await repository.readFirestoreEntityDocuments({ id: 'db' }, 'user123');
    expect(entitySchema.decodeEntityDocId).toHaveBeenCalledWith('editais__ed_1');
    expect(result[0].key).toBeDefined();
  });
});
