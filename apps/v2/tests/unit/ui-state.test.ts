import { describe, expect, it } from 'vitest';
import {
  canSubmitTitle,
  initialFormState,
  markSubmitFailure,
  semanticStateLabel,
  syncStatusLabel,
  THEMES,
} from '../../src/presentation/ui-state';
import type { SyncHealth } from '../../src/application/sync-types';

const localOnly: SyncHealth = {
  localCommitted: true,
  remoteCommitted: false,
  converged: false,
  pendingCount: 1,
  mode: 'LOCAL_ONLY',
};

describe('subject UI state', () => {
  it('keeps semantic states distinct from service codes', () => {
    expect(semanticStateLabel('EMPTY')).not.toBe(semanticStateLabel('LOADING'));
    expect(semanticStateLabel('FAILED')).not.toBe(semanticStateLabel('EMPTY'));
    expect(semanticStateLabel('PENDING')).not.toBe(
      semanticStateLabel('LOCAL_COMMITTED'),
    );
    expect(semanticStateLabel('CONFLICT')).toContain('Conflito');
  });

  it('blank_title_blocked', () => {
    expect(canSubmitTitle('   ')).toBe(false);
    expect(canSubmitTitle('Direito')).toBe(true);
  });

  it('quota_failure_preserves_input', () => {
    const state = { ...initialFormState, title: 'Direito Civil' };
    const failed = markSubmitFailure(state, 'Não foi possível salvar neste dispositivo.');

    expect(failed.title).toBe('Direito Civil');
    expect(failed.error).toContain('Não foi possível salvar');
    expect(failed.submitting).toBe(false);
  });

  it('local_only_never_says_cloud_synced', () => {
    const label = syncStatusLabel(localOnly);

    expect(label).toBe('Salvo neste dispositivo · 1 pendente');
    expect(label.toLowerCase()).not.toContain('nuvem');
    expect(label.toLowerCase()).not.toContain('sincronizado');
  });

  it('converged_status_requires_verified_cursor', () => {
    expect(
      syncStatusLabel({
        ...localOnly,
        remoteCommitted: true,
        converged: true,
        lastVerifiedCursor: 'cursor-1',
        pendingCount: 0,
      }),
    ).toContain('cursor verificado');
  });

  it('keeps_the_twelve_approved_themes', () => {
    expect(THEMES.map((theme) => theme.id)).toEqual([
      'grafite',
      'ardosia',
      'platina',
      'terminal',
      'neon',
      'arrakis',
      'codex',
      'plasma',
      'neon-teal',
      'esmeralda-dourado',
      'azul-ambar',
      'azul-glacial',
    ]);
  });
});
