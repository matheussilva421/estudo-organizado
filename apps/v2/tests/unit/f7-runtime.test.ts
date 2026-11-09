import { beforeEach, describe, expect, it } from 'vitest';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { F7Runtime } from '../../src/platform/f7-runtime';

const profileId = 'profile-runtime';

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 runtime composition', () => {
  it('f7_runtime_defaults_to_local_only_without_config', async () => {
    const runtime = new F7Runtime(profileId, {});
    await runtime.init();
    expect(runtime.getState()).toMatchObject({
      ready: true,
      cloudAvailable: false,
      syncAvailable: false,
      googleStatus: 'LOCAL_ONLY',
      lastError: null,
    });
    await expect(runtime.previewGoogleLink()).rejects.toThrow('nuvem não está configurada');
    runtime.dispose();
  });

  it('f7_runtime_exports_a_local_snapshot_without_cloud', async () => {
    const runtime = new F7Runtime(profileId, {});
    await runtime.init();
    const snapshot = (await runtime.exportBackup()) as {
      manifest: { formatVersion: number };
      payload: Record<string, unknown[]>;
    };
    expect(snapshot.manifest.formatVersion).toBe(3);
    expect(typeof snapshot.payload).toBe('object');
    runtime.dispose();
  });

  it('f7_runtime_requires_a_secret_and_a_cloud_destination_for_backup', async () => {
    const runtime = new F7Runtime(profileId, {});
    await runtime.init();
    await expect(runtime.createBackup()).resolves.toBe('FAILED');
    runtime.setRecoverySecret('uma-chave-de-recuperacao-longa');
    expect(runtime.getState().recoverySecretConfigured).toBe(true);
    await expect(runtime.createBackup()).resolves.toBe('FAILED');
    runtime.dispose();
  });
});
