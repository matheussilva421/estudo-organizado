import { describe, expect, it } from 'vitest';
import {
  assessSyncHealth,
  previewLink,
  transitionSync,
  type ProfileBinding,
} from '../../src/application/sync-policy';

const local: ProfileBinding = {
  profileId: 'profile-a',
  uid: null,
  syncEnabled: false,
  state: 'LOCAL_ONLY',
};

const NOW = 1_700_000_000_000;

describe('sync policy', () => {
  it('link_requires_preview_and_explicit_consent', () => {
    const linking = transitionSync(local, { type: 'START_LINK' });
    const preview = previewLink('profile-a', 'uid-a', { remoteCount: 0 }, NOW);
    expect(linking.state).toBe('LINKING');

    const refused = transitionSync(linking, {
      type: 'CONSENT_LINK',
      uid: 'uid-a',
      consent: false,
      preview,
    });
    expect(refused.state).toBe('LINKING');
    expect(refused.uid).toBeNull();

    const accepted = transitionSync(
      linking,
      { type: 'CONSENT_LINK', uid: 'uid-a', consent: true, preview },
      NOW,
    );
    expect(accepted).toMatchObject({
      state: 'READY',
      uid: 'uid-a',
      syncEnabled: true,
    });
  });

  it('local_without_google_is_available', () => {
    expect(local).toMatchObject({ state: 'LOCAL_ONLY', uid: null, syncEnabled: false });
    const preview = previewLink('profile-a', 'uid-a', { remoteCount: 0 }, NOW);
    expect(preview).toEqual({
      profileId: 'profile-a',
      uid: 'uid-a',
      remoteCount: 0,
      previewId: `link:profile-a:uid-a:0:${NOW}`,
      issuedAt: NOW,
      expiresAt: NOW + 300_000,
      requiresConsent: true,
      destructiveMerge: false,
    });
  });

  it('empty_preview_id_does_not_link', () => {
    const linking = transitionSync(local, { type: 'START_LINK' });
    const preview = previewLink('profile-a', 'uid-a', { remoteCount: 0 }, NOW);
    const attempted = transitionSync(linking, {
      type: 'CONSENT_LINK',
      uid: 'uid-a',
      consent: true,
      preview: { ...preview, previewId: '   ' },
    });

    expect(attempted.state).toBe('LINKING');
    expect(attempted.uid).toBeNull();
  });

  it('sync_auto_only_after_optin', () => {
    const preview = previewLink('profile-a', 'uid-a', { remoteCount: 0 }, NOW);
    const ready = transitionSync(
      transitionSync(local, { type: 'START_LINK' }),
      { type: 'CONSENT_LINK', uid: 'uid-a', consent: true, preview },
      NOW,
    );
    const disabled = transitionSync(ready, { type: 'DISABLE_AUTO' });
    const enabled = transitionSync(disabled, { type: 'ENABLE_AUTO' });

    expect(disabled.syncEnabled).toBe(false);
    expect(enabled.syncEnabled).toBe(true);
  });

  it('preview_must_match_profile_uid_and_clock', () => {
    const linking = transitionSync(local, { type: 'START_LINK' });
    const valid = previewLink('profile-a', 'uid-a', { remoteCount: 0 }, NOW);
    const attempts = [
      transitionSync(linking, {
        type: 'CONSENT_LINK',
        uid: 'uid-a',
        consent: true,
        preview: { ...valid, profileId: 'profile-b' },
      }),
      transitionSync(linking, {
        type: 'CONSENT_LINK',
        uid: 'uid-a',
        consent: true,
        preview: { ...valid, uid: 'uid-b' },
      }),
      transitionSync(
        linking,
        { type: 'CONSENT_LINK', uid: 'uid-a', consent: true, preview: valid },
        valid.expiresAt + 1,
      ),
      transitionSync(linking, {
        type: 'CONSENT_LINK',
        uid: 'uid-a',
        consent: true,
        preview: { ...valid, previewId: 'arbitrary' },
      }),
    ];

    for (const attempt of attempts) {
      expect(attempt.state).toBe('LINKING');
      expect(attempt.uid).toBeNull();
    }
  });

  it('auth_quota_and_recovery_pause_sync', () => {
    expect(transitionSync(local, { type: 'AUTH_EXPIRED' }).state).toBe('PAUSED_AUTH');
    expect(transitionSync(local, { type: 'QUOTA_EXHAUSTED' }).state).toBe('PAUSED_QUOTA');
    expect(transitionSync(local, { type: 'RECOVERY_REQUIRED' }).state).toBe('RECOVERY_REQUIRED');
  });

  it('converged_requires_verified_remote_cursor', () => {
    const withoutCursor = assessSyncHealth({
      localCommitted: true,
      remoteCommitted: true,
      verifiedCursor: null,
      pendingCount: 0,
      mode: 'READY',
    });
    const withCursor = assessSyncHealth({
      localCommitted: true,
      remoteCommitted: true,
      verifiedCursor: 'cursor-1',
      pendingCount: 0,
      mode: 'READY',
    });

    expect(withoutCursor.converged).toBe(false);
    expect(withCursor.converged).toBe(true);
    expect(withCursor.lastVerifiedCursor).toBe('cursor-1');
  });

  it('pending_operations_block_convergence', () => {
    const pending = assessSyncHealth({
      localCommitted: true,
      remoteCommitted: true,
      verifiedCursor: 'cursor-1',
      pendingCount: 1,
      mode: 'READY',
    });
    const clear = assessSyncHealth({
      localCommitted: true,
      remoteCommitted: true,
      verifiedCursor: 'cursor-1',
      pendingCount: 0,
      mode: 'READY',
    });

    expect(pending.converged).toBe(false);
    expect(clear.converged).toBe(true);
  });
});
