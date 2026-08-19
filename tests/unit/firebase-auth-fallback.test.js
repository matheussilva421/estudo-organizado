import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const BUNDLE = '../../src/vendor/firebase-client.bundle.js?v=8.37';
const CONFIG = '../../src/js/firebase/firebase-config-default.js?v=8.37';

let signInWithPopup;
let signInWithRedirect;

function authError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

async function loadClient() {
  return await import('../../src/js/firebase/firebase-client.js?v=8.37');
}

beforeEach(async () => {
  vi.resetModules();

  signInWithPopup = vi.fn();
  signInWithRedirect = vi.fn(() => Promise.resolve());

  vi.doMock(BUNDLE, () => ({
    initializeApp: vi.fn(() => ({ name: 'app' })),
    getApps: vi.fn(() => []),
    getAuth: vi.fn(() => ({ name: 'auth' })),
    GoogleAuthProvider: class GoogleAuthProvider {},
    getRedirectResult: vi.fn(() => Promise.resolve(null)),
    onAuthStateChanged: vi.fn(() => () => {}),
    signInWithPopup: (...args) => signInWithPopup(...args),
    signInWithRedirect: (...args) => signInWithRedirect(...args),
    signOut: vi.fn(() => Promise.resolve()),
    initializeFirestore: vi.fn(() => ({ name: 'db' })),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
    initializeAppCheck: vi.fn(),
    ReCaptchaV3Provider: class ReCaptchaV3Provider {},
  }));

  vi.doMock(CONFIG, () => ({
    getRuntimeFirebaseConfig: () => ({
      apiKey: 'k',
      authDomain: 'example.test',
      projectId: 'p',
      appId: 'a',
    }),
    getRuntimeAppCheckSiteKey: () => '',
  }));
});

afterEach(() => {
  vi.resetModules();
});

describe('signInWithGoogle popup/redirect selection', () => {
  it('returns the popup credential without ever redirecting', async () => {
    const credential = { user: { uid: 'u1' } };
    signInWithPopup.mockResolvedValue(credential);

    const { signInWithGoogle } = await loadClient();
    await expect(signInWithGoogle()).resolves.toBe(credential);
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it('falls back to redirect when the popup is blocked', async () => {
    signInWithPopup.mockRejectedValue(authError('auth/popup-blocked'));

    const { signInWithGoogle } = await loadClient();
    await expect(signInWithGoogle()).resolves.toBeNull();
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('falls back to redirect when popups are unsupported in the environment', async () => {
    signInWithPopup.mockRejectedValue(
      authError('auth/operation-not-supported-in-this-environment')
    );

    const { signInWithGoogle } = await loadClient();
    await expect(signInWithGoogle()).resolves.toBeNull();
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('treats a user-closed popup as a cancellation, not a redirect', async () => {
    signInWithPopup.mockRejectedValue(authError('auth/popup-closed-by-user'));

    const { signInWithGoogle } = await loadClient();
    await expect(signInWithGoogle()).resolves.toEqual({ cancelled: true });
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it('still falls back to redirect when a concurrent popup request cancels the first', async () => {
    signInWithPopup.mockRejectedValue(authError('auth/cancelled-popup-request'));

    const { signInWithGoogle } = await loadClient();
    await expect(signInWithGoogle()).resolves.toBeNull();
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('propagates unknown auth errors', async () => {
    signInWithPopup.mockRejectedValue(authError('auth/network-request-failed'));

    const { signInWithGoogle } = await loadClient();
    await expect(signInWithGoogle()).rejects.toThrow('auth/network-request-failed');
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });
});
