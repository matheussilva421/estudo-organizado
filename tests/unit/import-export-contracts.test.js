import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createBaseState, createEvento } from '../helpers/state-builders.js';

describe('import/export safety contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  it('exports study data without Cloudflare credentials or transient sync conflict details', async () => {
    const store = await import('../../src/js/store.js?v=8.30');
    const source = createBaseState({
      eventos: [createEvento({ id: 'ev_export', titulo: 'Exportável' })],
      config: {
        cfUrl: 'https://sync.example.test',
        cfToken: 'secret-token',
        cfTokenSaved: true,
        cfSyncEnabled: true,
        cfConflict: {
          remoteUpdatedAt: '2026-04-29T20:00:00.000Z',
          remoteDeviceId: 'remote-device',
          detectedAt: '2026-04-29T21:00:00.000Z'
        },
        cfRemoteUpdatedAt: '2026-04-29T20:00:00.000Z',
        cfLastSyncAt: '2026-04-29T20:05:00.000Z',
        localBackupAt: '2026-04-29T20:10:00.000Z',
        syncMergeConflicts: [{ path: 'eventos/ev_export' }]
      }
    });

    const exported = store.createExportableState(source);

    expect(exported.eventos).toHaveLength(1);
    expect(exported.config.cfUrl).toBeUndefined();
    expect(exported.config.cfToken).toBeUndefined();
    expect(exported.config.cfTokenSaved).toBeUndefined();
    expect(exported.config.cfConflict).toBeUndefined();
    expect(exported.config.cfRemoteUpdatedAt).toBeUndefined();
    expect(exported.config.cfLastSyncAt).toBeUndefined();
    expect(exported.config.localBackupAt).toBeUndefined();
    expect(exported.config.syncMergeConflicts).toBeUndefined();
    expect(exported.config.cfSyncEnabled).toBe(false);
  });

  it('restores an exported backup into a normalized local state shape', async () => {
    const store = await import('../../src/js/store.js?v=8.30');
    const exported = store.createExportableState(createBaseState({
      eventos: [createEvento({ id: 'ev_restore', titulo: 'Restaurado' })],
      habitos: { questoes: [{ id: 'hab_restore', descricao: 'Questões restauradas' }] },
      config: { cfSyncEnabled: true, cfToken: 'secret-token' }
    }));

    store.setState(exported);

    expect(store.state.eventos).toEqual([expect.objectContaining({ id: 'ev_restore' })]);
    expect(store.state.habitos.questoes).toEqual([
      expect.objectContaining({ id: 'hab_restore' })
    ]);
    expect(store.state.config.cfToken).toBeUndefined();
    expect(store.state.config.cfSyncEnabled).toBe(false);
    expect(store.state.config.firestoreSync).toMatchObject(store.DEFAULT_FIRESTORE_SYNC_CONFIG);
    expect(store.state.config.entitySync).toMatchObject(store.DEFAULT_ENTITY_SYNC_CONFIG);
  });

  it('keeps all backup/export recovery actions registered through data-action contracts', () => {
    const source = readFileSync('src/js/ui/actions/config.js', 'utf8');

    for (const action of [
      "registerAction('export-data'",
      "registerAction('restore-backup'",
      "registerAction('cloud-conflict-export-local'",
      "registerAction('sync-center-export-local'"
    ]) {
      expect(source).toContain(action);
    }
  });
});
