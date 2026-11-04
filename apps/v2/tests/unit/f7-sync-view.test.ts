import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SyncHealth } from '../../src/application/sync-types';
import { SyncStatus } from '../../src/presentation/components/SyncStatus';
import { GoogleLink } from '../../src/presentation/components/GoogleLink';
import { BackupControls, type BackupHealth } from '../../src/presentation/components/BackupControls';

function health(overrides: Partial<SyncHealth> = {}): SyncHealth {
  return {
    localCommitted: true,
    remoteCommitted: false,
    converged: false,
    pendingCount: 0,
    mode: 'LOCAL_ONLY',
    ...overrides,
  };
}

const backup: BackupHealth = {
  status: 'VERIFIED',
  lastVerifiedAt: '2026-11-04T12:00:00.000Z',
  versions: 2,
};

describe('F7 sync and backup view', () => {
  it('f7_local_saved_is_not_labeled_converged', () => {
    const markup = renderToStaticMarkup(createElement(SyncStatus, { health: health() }));
    expect(markup).toContain('Salvo neste dispositivo');
    expect(markup).not.toContain('Sincronizado');
  });

  it('f7_backup_status_distinct_from_sync', () => {
    const markup = renderToStaticMarkup(
      createElement(SyncStatus, { health: health(), backupHealth: backup }),
    );
    expect(markup).toContain('Salvo neste dispositivo');
    expect(markup).toContain('Backup confirmado');
  });

  it('f7_link_requires_explicit_consent', () => {
    const markup = renderToStaticMarkup(createElement(GoogleLink, { status: 'LINKING' }));
    expect(markup).toContain('Confirmar vínculo');
    expect(markup).toContain('disabled');
  });

  it('f7_logout_does_not_show_old_uid_data', () => {
    const markup = renderToStaticMarkup(
      createElement(GoogleLink, { status: 'LOCAL_ONLY', email: null }),
    );
    expect(markup).not.toContain('old@example.com');
    expect(markup).toContain('Estudo local');
  });

  it('f7_unauthorized_services_are_unavailable_by_default', () => {
    const markup = renderToStaticMarkup(
      createElement(BackupControls, {
        health: { status: 'NONE', lastVerifiedAt: null, versions: 0 },
        recoverySecretConfigured: false,
      }),
    );
    expect(markup).toContain('Criar backup agora');
    expect(markup).toContain('disabled');
  });

  it('f7_backup_restoration_needs_preview', () => {
    const markup = renderToStaticMarkup(
      createElement(BackupControls, { health: backup, recoverySecretConfigured: true }),
    );
    expect(markup).toContain('Restaurar com prévia');
    expect(markup).toContain('disabled');
  });

  it('f7_offline_study_flow_not_blocked_by_cloud', () => {
    const markup = renderToStaticMarkup(
      createElement(SyncStatus, {
        health: health({ pendingCount: 3, mode: 'PENDING_OFFLINE' }),
      }),
    );
    expect(markup).toContain('Salvo neste dispositivo');
    expect(markup).not.toContain('modal');
  });
});
