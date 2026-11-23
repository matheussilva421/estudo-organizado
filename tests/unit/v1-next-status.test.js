import { describe, expect, it } from 'vitest';

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
