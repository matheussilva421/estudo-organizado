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

describe('profile isolation', () => {
  it('logout_and_new_uid_do_not_mix_profiles', () => {
    const loggedOut = transitionSync(ready('uid-a'), { type: 'LOGOUT' });
    expect(loggedOut).toMatchObject({ uid: null, syncEnabled: false, state: 'LOCAL_ONLY' });

    const relinked = transitionSync(
      transitionSync(loggedOut, { type: 'START_LINK' }),
      { type: 'CONSENT_LINK', uid: 'uid-b', consent: true },
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
  });

  it('preview_never_merges_implicitly', () => {
    expect(previewLink('profile-a', { remoteCount: 3 })).toEqual({
      profileId: 'profile-a',
      remoteCount: 3,
      requiresConsent: true,
      destructiveMerge: false,
    });
  });
});
