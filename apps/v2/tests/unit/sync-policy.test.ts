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

describe('sync policy', () => {
  it('link_requires_preview_and_explicit_consent', () => {
    const linking = transitionSync(local, { type: 'START_LINK' });
    expect(linking.state).toBe('LINKING');

    const refused = transitionSync(linking, {
      type: 'CONSENT_LINK',
      uid: 'uid-a',
      consent: false,
      previewId: 'link:profile-a:0',
    });
    expect(refused.state).toBe('LINKING');
    expect(refused.uid).toBeNull();

    const accepted = transitionSync(linking, {
      type: 'CONSENT_LINK',
      uid: 'uid-a',
      consent: true,
      previewId: 'link:profile-a:0',
    });
    expect(accepted).toMatchObject({
      state: 'READY',
      uid: 'uid-a',
      syncEnabled: true,
    });
  });

  it('local_without_google_is_available', () => {
    expect(local).toMatchObject({ state: 'LOCAL_ONLY', uid: null, syncEnabled: false });
    const preview = previewLink('profile-a', { remoteCount: 0 });
    expect(preview).toEqual({
      profileId: 'profile-a',
      remoteCount: 0,
      previewId: 'link:profile-a:0',
      requiresConsent: true,
      destructiveMerge: false,
    });
  });

  it('empty_preview_id_does_not_link', () => {
    const linking = transitionSync(local, { type: 'START_LINK' });
    const attempted = transitionSync(linking, {
      type: 'CONSENT_LINK',
      uid: 'uid-a',
      consent: true,
      previewId: '   ',
    });

    expect(attempted.state).toBe('LINKING');
    expect(attempted.uid).toBeNull();
  });

  it('sync_auto_only_after_optin', () => {
    const ready = transitionSync(
      transitionSync(local, { type: 'START_LINK' }),
      { type: 'CONSENT_LINK', uid: 'uid-a', consent: true, previewId: 'link:profile-a:0' },
    );
    const disabled = transitionSync(ready, { type: 'DISABLE_AUTO' });
    const enabled = transitionSync(disabled, { type: 'ENABLE_AUTO' });

    expect(disabled.syncEnabled).toBe(false);
    expect(enabled.syncEnabled).toBe(true);
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
});
