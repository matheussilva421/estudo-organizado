import { describe, expect, it, vi } from 'vitest';
import { createBaseState, createEvento } from '../helpers/state-builders.js';

vi.mock('../../src/js/store.js?v=8.24', () => ({
  DEFAULT_SCHEMA_VERSION: 7,
  createExportableState(sourceState) {
    const clone = JSON.parse(JSON.stringify(sourceState));
    if (!clone.config) clone.config = {};
    delete clone.config.cfToken;
    delete clone.config.cfUrl;
    delete clone.config.localBackupAt;
    clone.config.cfSyncEnabled = false;
    return clone;
  }
}));

const schema = await import('../../src/js/sync/firestore-schema.js?v=8.24');

describe('firestore-schema.js', () => {
  it('creates a versioned snapshot envelope without sync secrets', () => {
    localStorage.clear();
    const state = createBaseState({
      eventos: [createEvento({ id: 'ev_firestore' })],
      config: {
        cfSyncEnabled: true,
        cfUrl: 'https://worker.example.test',
        cfToken: 'secret',
        firestoreSync: {
          enabled: true,
          mode: 'shadow',
          remoteUpdatedAt: '2026-04-21T10:00:00.000Z'
        },
        localBackupAt: '2026-04-21T11:00:00.000Z'
      }
    });

    const envelope = schema.createFirestoreSnapshotEnvelope(state, {
      sentAt: '2026-04-21T11:00:01.000Z',
      deviceId: 'web-test'
    });

    expect(envelope).toMatchObject({
      version: 1,
      schemaVersion: 7,
      deviceId: 'web-test',
      baseRemoteUpdatedAt: '2026-04-21T10:00:00.000Z',
      payloadUpdatedAt: '2026-04-21T11:00:00.000Z'
    });
    expect(envelope.payload.eventos[0].id).toBe('ev_firestore');
    expect(envelope.payload.config.cfToken).toBeUndefined();
    expect(envelope.payload.config.cfUrl).toBeUndefined();
    expect(envelope.payload.config.firestoreSync.enabled).toBe(false);
  });

  it('uses the newest local content timestamp when legacy Cloudflare metadata is stale', () => {
    const state = createBaseState({
      config: {
        _lastUpdated: new Date('2026-04-21T10:00:00.000Z').getTime(),
        localBackupAt: '2026-04-21T12:00:00.000Z',
        firestoreSync: {
          enabled: true,
          remoteUpdatedAt: '2026-04-21T09:00:00.000Z'
        }
      }
    });

    const envelope = schema.createFirestoreSnapshotEnvelope(state, {
      sentAt: '2026-04-21T12:00:01.000Z',
      deviceId: 'web-test'
    });

    expect(envelope.payloadUpdatedAt).toBe('2026-04-21T12:00:00.000Z');
    expect(schema.isRemoteNewer(
      { payloadUpdatedAt: '2026-04-21T11:00:00.000Z' },
      state
    )).toBe(false);
  });

  it('applies a remote envelope while keeping Firestore enabled locally', () => {
    const envelope = schema.createFirestoreSnapshotEnvelope(createBaseState({
      eventos: [createEvento({ id: 'ev_remote' })],
      config: { localBackupAt: '2026-04-21T12:00:00.000Z' }
    }), {
      deviceId: 'remote-device',
      payloadUpdatedAt: '2026-04-21T12:00:00.000Z'
    });

    const nextState = schema.applyEnvelopeToLocalState(envelope, {
      enabled: true,
      mode: 'primary',
      uid: 'uid-1'
    });

    expect(nextState.eventos[0].id).toBe('ev_remote');
    expect(nextState.config.firestoreSync).toMatchObject({
      enabled: true,
      mode: 'primary',
      uid: 'uid-1',
      remoteUpdatedAt: '2026-04-21T12:00:00.000Z',
      hasPendingWrites: false
    });
    expect(nextState.config.localBackupAt).toBe('2026-04-21T12:00:00.000Z');
  });
});
