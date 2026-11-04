import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEditalImport } from '../../src/application/import-service';
import { IMPORT_MAX_BYTES } from '../../src/application/import-types';
import { LocalProfileRepository } from '../../src/platform/local-profile-repository';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';
import { GoogleLink } from '../../src/presentation/components/GoogleLink';
import { BackupControls } from '../../src/presentation/components/BackupControls';

const valid = {
  versao: 1,
  tipo: 'edital',
  nome: 'TJPB 2026',
  disciplinas: [{ nome: 'Português', topicos: [{ nome: 'Crase' }] }],
};

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 security and accessibility inputs', () => {
  it('f7_import_rejects_unbounded_or_prototype_payload', () => {
    const prototype = JSON.stringify(valid).replace('{', '{"__proto__":{"polluted":true},');
    expect(parseEditalImport(prototype, { namespace: 'x' })).toMatchObject({
      ok: false,
      reason: 'UNSAFE_KEY',
    });
    expect(
      parseEditalImport('x'.repeat(IMPORT_MAX_BYTES + 1), { namespace: 'x' }),
    ).toMatchObject({ ok: false, reason: 'TOO_LARGE' });
  });

  it('f7_script_text_is_never_executed', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const result = parseEditalImport(
      {
        ...valid,
        disciplinas: [{ nome: '<script>alert(1)</script>', topicos: [{ nome: 'Crase' }] }],
      },
      { namespace: 'x' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parsed.suspicious.length).toBeGreaterThan(0);
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('f7_logs_never_include_token_or_academic_payload', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    parseEditalImport(valid, { namespace: 'x' });
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });

  it('f7_keyboard_can_reach_sync_actions', () => {
    const markup = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(GoogleLink, { status: 'LINKING', onConfirm: () => undefined }),
        createElement(BackupControls, {
          health: { status: 'VERIFIED', lastVerifiedAt: null, versions: 1 },
          recoverySecretConfigured: true,
          onExport: () => undefined,
          onCreate: () => undefined,
          onRestore: () => undefined,
        }),
      ),
    );
    expect(markup).toContain('Confirmar vínculo');
    expect(markup).toContain('Criar backup agora');
    expect(markup).toContain('Restaurar com prévia');
    expect(markup).not.toContain('tabindex="-1"');
  });

  it('f7_mobile_controls_have_accessible_labels', () => {
    const markup = renderToStaticMarkup(
      createElement(BackupControls, {
        health: { status: 'NONE', lastVerifiedAt: null, versions: 0 },
        recoverySecretConfigured: false,
      }),
    );
    expect(markup).toContain('aria-label="Backup"');
    expect(markup).toContain('Exportar backup local');
    expect(markup).toContain('Criar backup agora');
  });

  it('f7_profile_switch_does_not_expose_other_data', async () => {
    const db = await openV2Database('profile-a');
    const tx = db.transaction(STORES.profiles, 'readwrite');
    tx.objectStore(STORES.profiles).put({
      profileId: 'profile-a',
      uid: 'uid-a',
      remoteLibraryId: 'library-a',
      syncEnabled: true,
      state: 'READY',
      primaryEditalId: null,
      localRevision: 1,
    });
    await transactionDone(tx);
    const other = await new LocalProfileRepository().getProfile('profile-b');
    expect(other.profileId).toBe('profile-b');
    expect(other.uid).toBeNull();
    expect(other.remoteLibraryId).toBeNull();
  });
});
