import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveV1SyncStatus, shouldWarnV1BeforeUnload } from '../../src/js/sync/v1-next/status.js';

describe('deriveV1SyncStatus()', () => {
  it('keeps a local save distinct from a server-confirmed state', () => {
    expect(
      deriveV1SyncStatus({
        outbox: [],
        network: { online: true, listenerActive: true },
        auth: { authenticated: true },
        conflicts: [],
        remoteAck: null,
      })
    ).toMatchObject({
      state: 'salvo-neste-dispositivo',
      label: 'Salvo neste dispositivo',
      ariaLive: 'polite',
    });
  });

  it('reports a pending online write as syncing without inventing an ACK', () => {
    const result = deriveV1SyncStatus({
      outbox: { pending: 1 },
      network: true,
      auth: true,
      conflicts: 0,
      remoteAck: { acknowledged: false },
    });

    expect(result.state).toBe('sincronizando');
    expect(result.label).toBe('Sincronizando');
    expect(result.pendingCount).toBe(1);
    expect(result.ariaLive).toBe('polite');
  });

  it('requires remote acknowledgement before reporting synchronized', () => {
    expect(
      deriveV1SyncStatus({
        outbox: [],
        network: { online: true, listenerActive: true },
        auth: true,
        conflicts: [],
        remoteAck: { acknowledged: true, receipt: { opId: 'op_1' } },
      })
    ).toMatchObject({
      state: 'sincronizado',
      label: 'Sincronizado',
      ariaLive: 'polite',
    });

    expect(
      deriveV1SyncStatus({
        outbox: [],
        network: { online: true, listenerActive: true },
        auth: true,
        conflicts: [],
        remoteAck: { listenerActive: true },
      }).state
    ).toBe('salvo-neste-dispositivo');
  });

  it('explains when offline preserves changes locally', () => {
    const result = deriveV1SyncStatus({
      outbox: { pending: 2 },
      network: { online: false },
      auth: true,
      conflicts: [],
      remoteAck: false,
    });

    expect(result.state).toBe('salvo-neste-dispositivo');
    expect(result.message).toContain('offline');
    expect(result.message).toContain('dispositivo');
  });

  it('keeps local saving available when authentication is absent', () => {
    const result = deriveV1SyncStatus({
      outbox: { pending: 1 },
      network: true,
      auth: { signedIn: false },
      conflicts: [],
      remoteAck: null,
    });

    expect(result.state).toBe('salvo-neste-dispositivo');
    expect(result.message).toContain('Entre com Google');
  });

  it('surfaces a persistent error as attention instead of syncing forever', () => {
    const result = deriveV1SyncStatus({
      outbox: { pending: 1, persistentError: 'V1_REMOTE_UNAVAILABLE' },
      network: true,
      auth: true,
      conflicts: [],
      remoteAck: false,
    });

    expect(result.state).toBe('atencao-necessaria');
    expect(result.label).toBe('Atenção necessária');
    expect(result.ariaLive).toBe('assertive');
  });

  it('isolates one entity conflict without blocking the rest of the queue', () => {
    const result = deriveV1SyncStatus({
      outbox: { pending: 0, acked: 3 },
      network: true,
      auth: true,
      conflicts: [{ conflictId: 'op_evento', entityId: 'ev_1' }],
      remoteAck: { acknowledged: true },
    });

    expect(result.state).toBe('atencao-necessaria');
    expect(result.conflictCount).toBe(1);
    expect(result.message).toContain('1 item');
    expect(result.message).toContain('demais');
  });

  it('ignores resolved conflicts while keeping open conflicts actionable', () => {
    const resolved = { conflictId: 'old', status: 'resolved' };
    const result = deriveV1SyncStatus({ conflicts: [resolved], remoteAck: true });
    expect(result).toMatchObject({ state: 'sincronizado', pendingCount: 0, conflictCount: 0 });
    expect(shouldWarnV1BeforeUnload(result)).toBe(false);
    expect(deriveV1SyncStatus({ conflicts: [resolved, { status: 'open' }] }))
      .toMatchObject({ state: 'atencao-necessaria', conflictCount: 1 });
  });

  it('counts an in-flight operation as pending even with an earlier receipt', () => {
    const result = deriveV1SyncStatus({ outbox: [{ status: 'in-flight' }], remoteAck: true });
    expect(result).toMatchObject({ state: 'sincronizando', pendingCount: 1 });
    expect(shouldWarnV1BeforeUnload(result)).toBe(true);
  });
});

describe('V1 status bridge recovery', () => {
  let status;
  let localStatus;
  let operations;
  let conflicts;
  let readStatus;

  function emit(detail) {
    document.dispatchEvent(new CustomEvent('app:primarySyncStatus', {
      detail: { mode: 'v1', uid: 'user', generationId: 'gen', ...detail },
    }));
  }

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('document', new EventTarget());
    const windowRef = new EventTarget();
    windowRef.__ESTUDO_V1_SYNC_TEST__ = { enabled: true };
    vi.stubGlobal('window', windowRef);
    localStatus = { pending: 0, retry: 0, acked: 1, conflicts: 0 };
    operations = [];
    conflicts = [];
    readStatus = vi.fn(async () => ({ ...localStatus }));
    vi.doMock('../../src/js/store.js?v=8.37', () => ({
      getActiveV1Context: () => ({ uid: 'user', generationId: 'gen' }),
      getLocalSyncStatus: readStatus,
      getPendingOperations: async () => operations,
      listLocalConflicts: async () => conflicts,
    }));
    status = await import('../../src/js/sync/v1-next/status.js');
    await status.refreshV1SyncStatus();
  });

  afterEach(() => {
    vi.doUnmock('../../src/js/store.js?v=8.37');
    vi.unstubAllGlobals();
  });

  it('does not retain resolved persistent conflicts in the exit warning', async () => {
    conflicts = [{ status: 'resolved', conflictId: 'old' }];
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot()).toMatchObject({
      state: 'sincronizado', pendingCount: 0, conflictCount: 0,
    });
    expect(status.shouldWarnV1BeforeUnload()).toBe(false);
  });

  it('recovers authentication on an actual successful ACK', async () => {
    emit({ status: 'auth-required' });
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot().message).toContain('Entre com Google');
    emit({ status: 'synced', acked: 1, pending: 0, conflicts: 0 });
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot().state).toBe('sincronizado');
  });

  it('updates missing and restored authentication from the application Auth callback', async () => {
    status.setV1SyncStatusAuth(null);
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot().message).toContain('Entre com Google');
    localStatus = { pending: 1, retry: 0, acked: 0, conflicts: 0 };
    status.setV1SyncStatusAuth({ uid: 'user' });
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot()).toMatchObject({ state: 'sincronizando', pendingCount: 1 });
  });

  it.each(['queued', 'syncing', 'backoff'])('preserves known pending writes through a partial %s event', async (phase) => {
    localStatus.pending = 2;
    await status.refreshV1SyncStatus();
    emit({ status: phase });
    expect(status.getV1SyncStatusSnapshot()).toMatchObject({ state: 'sincronizando', pendingCount: 2 });
    expect(status.shouldWarnV1BeforeUnload()).toBe(true);
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot().pendingCount).toBe(2);
  });

  it.each(['queued', 'syncing', 'backoff'])('does not reuse an old ACK during %s before the outbox read completes', async (phase) => {
    let release;
    readStatus.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    emit({ status: phase });
    expect(status.getV1SyncStatusSnapshot().state).toBe('sincronizando');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release({ pending: 1, retry: 0, acked: 1, conflicts: 0 });
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot()).toMatchObject({ state: 'sincronizando', pendingCount: 1 });
  });

  it('checks the durable outbox before accepting a zero-pending synced event', async () => {
    localStatus.pending = 1;
    await status.refreshV1SyncStatus();
    emit({ status: 'synced', acked: 1, pending: 0, conflicts: 0 });
    expect(status.getV1SyncStatusSnapshot().state).toBe('sincronizando');
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot()).toMatchObject({ state: 'sincronizando', pendingCount: 1 });
    localStatus.pending = 0;
    emit({ status: 'synced', acked: 1, pending: 0, conflicts: 0 });
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot().state).toBe('sincronizado');
    expect(status.shouldWarnV1BeforeUnload()).toBe(false);
  });

  it('retains pending writes when the persistent status read fails', async () => {
    localStatus.pending = 1;
    await status.refreshV1SyncStatus();
    readStatus.mockRejectedValueOnce(new Error('read failed'));
    await status.refreshV1SyncStatus();
    expect(status.getV1SyncStatusSnapshot()).toMatchObject({ state: 'atencao-necessaria', pendingCount: 1 });
    expect(status.shouldWarnV1BeforeUnload()).toBe(true);
  });
});

describe('shouldWarnV1BeforeUnload()', () => {
  it('warns only while writes still lack final handling', () => {
    expect(
      shouldWarnV1BeforeUnload(
        deriveV1SyncStatus({
          outbox: { pending: 1 },
          network: true,
          auth: true,
        })
      )
    ).toBe(true);
    expect(
      shouldWarnV1BeforeUnload(
        deriveV1SyncStatus({
          outbox: [],
          network: true,
          auth: true,
          remoteAck: true,
        })
      )
    ).toBe(false);
  });
});
