import { describe, expect, it } from 'vitest';
import {
  assertProfileMatches,
  previewLink,
  transitionSync,
  type ProfileBinding,
} from '../../src/application/sync-policy';

function ready(uid: string): ProfileBinding {
  return {
    profileId: 'profile-a',
    uid,
    syncEnabled: true,
    state: 'READY',
  };
}

const NOW = 1_700_000_000_000;

describe('profile isolation', () => {
  it('logout_and_new_uid_do_not_mix_profiles', () => {
    const loggedOut = transitionSync(ready('uid-a'), { type: 'LOGOUT' });
    expect(loggedOut).toMatchObject({ uid: null, syncEnabled: false, state: 'LOCAL_ONLY' });

    const relinked = transitionSync(
      transitionSync(loggedOut, { type: 'START_LINK' }),
      {
        type: 'CONSENT_LINK',
        uid: 'uid-b',
        consent: true,
        preview: previewLink('profile-a', 'uid-b', { remoteCount: 0 }, NOW),
      },
      NOW,
    );

    expect(relinked.uid).toBe('uid-b');
    expect(relinked.uid).not.toBe('uid-a');
    expect(relinked.profileId).toBe('profile-a');
  });

  it('rejects_profile_mismatch', () => {
    expect(() => assertProfileMatches(ready('uid-a'), 'profile-b')).toThrowError(
      'PROFILE_MISMATCH',
    );
    expect(() => assertProfileMatches(ready('uid-a'), 'profile-a')).not.toThrow();
    expect(() => assertProfileMatches(ready('uid-a'), 'profile-a', 'uid-b')).toThrowError(
      'PROFILE_MISMATCH',
    );
  });

  it('cannot_replace_uid_without_logout_and_preview', () => {
    const paused = transitionSync(ready('uid-a'), { type: 'AUTH_EXPIRED' });
    const linking = transitionSync(paused, { type: 'START_LINK' });
    const attempted = transitionSync(linking, {
      type: 'CONSENT_LINK',
      uid: 'uid-b',
      consent: true,
      preview: previewLink('profile-a', 'uid-b', { remoteCount: 0 }, NOW),
    });

    expect(attempted.uid).toBe('uid-a');
    expect(attempted.state).toBe('LINKING');
  });

  it('preview_never_merges_implicitly', () => {
    expect(previewLink('profile-a', 'uid-a', { remoteCount: 3 }, NOW)).toEqual({
      profileId: 'profile-a',
      uid: 'uid-a',
      remoteCount: 3,
      previewId: `link:profile-a:uid-a:3:${NOW}`,
      issuedAt: NOW,
      expiresAt: NOW + 300_000,
      requiresConsent: true,
      destructiveMerge: false,
    });
  });
});
