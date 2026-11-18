import { describe, expect, it, vi } from 'vitest';
import { GoogleAuthError, type GoogleIdentity } from '../../src/application/google-auth-types';
import {
  clearGoogleAuthError,
  consumeRedirectPending,
  createFirebaseGoogleAuthPort,
  GOOGLE_AUTH_ERROR_KEY,
  GOOGLE_REDIRECT_PENDING_KEY,
  GOOGLE_REDIRECT_PENDING_MAX_AGE_MS,
  readGoogleAuthError,
  type FirebaseModules,
  type GoogleAuthBackend,
} from '../../src/platform/firebase/auth';
import { resolveV2RemoteConfig, V2_EMULATOR_PROJECT_ID } from '../../src/platform/firebase/config';

const identity: GoogleIdentity = { uid: 'uid-test', email: 'test@example.com' };

function fakeBackend(overrides: Partial<GoogleAuthBackend> = {}): GoogleAuthBackend {
  let current: GoogleIdentity | null = null;
  const listeners = new Set<(value: GoogleIdentity | null) => void>();
  const notify = () => {
    for (const listener of listeners) listener(current);
  };
  return {
    async signIn() {
      current = identity;
      notify();
      return identity;
    },
    async signOut() {
      current = null;
      notify();
    },
    async current() {
      return current;
    },
    async getIdToken() {
      return current ? 'token' : null;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    ...overrides,
  };
}

describe('F7 Google auth port', () => {
  it('f7_local_mode_never_requests_google', async () => {
    const load = vi.fn(() => {
      throw new Error('Firebase must not load in local mode');
    });
    const port = createFirebaseGoogleAuthPort(null, { load });
    await expect(port.current()).resolves.toBeNull();
    await expect(port.getIdToken()).resolves.toBeNull();
    await expect(port.signIn()).rejects.toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    expect(load).not.toHaveBeenCalled();
  });

  it('f7_google_cancel_keeps_local_data', async () => {
    const cancel = new GoogleAuthError('AUTH_CANCELLED', 'cancelled');
    const port = createFirebaseGoogleAuthPort(null, {
      backend: fakeBackend({
        async signIn() {
          throw cancel;
        },
      }),
    });
    await expect(port.signIn()).rejects.toBe(cancel);
    await expect(port.current()).resolves.toBeNull();
  });

  it('f7_signout_clears_remote_authority', async () => {
    const backend = fakeBackend();
    const port = createFirebaseGoogleAuthPort(null, { backend });
    await expect(port.signIn()).resolves.toEqual(identity);
    await expect(port.current()).resolves.toEqual(identity);
    await port.signOut();
    await expect(port.current()).resolves.toBeNull();
    await expect(port.getIdToken()).resolves.toBeNull();
  });

  it('f7_emulator_auth_does_not_contact_production', async () => {
    const config = resolveV2RemoteConfig({
      VITE_V2_REMOTE_ENABLED: 'true',
      VITE_V2_FIREBASE_PROJECT_ID: V2_EMULATOR_PROJECT_ID,
      VITE_V2_FIREBASE_AUTH_DOMAIN: 'demo-estudo-v2.firebaseapp.com',
      VITE_V2_FIREBASE_APP_ID: '1:1:web:demo',
      VITE_V2_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
      VITE_V2_FIRESTORE_EMULATOR_PORT: '8080',
      VITE_V2_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
    });
    expect(config).not.toBeNull();

    const connectAuthEmulator = vi.fn();
    const initializeApp = vi.fn(() => ({}));
    const getApps = vi.fn(() => []);
    const getApp = vi.fn(() => ({}));
    const getAuth = vi.fn(() => ({
      currentUser: null,
    }));
    const onAuthStateChanged = vi.fn(() => () => undefined);
    const setPersistence = vi.fn(async () => undefined);
    const getRedirectResult = vi.fn(async () => null);
    const signInWithPopup = vi.fn();
    const signOut = vi.fn();
    const GoogleAuthProvider = class {};
    const modules = {
      app: { getApps, getApp, initializeApp },
      auth: {
        getAuth,
        onAuthStateChanged,
        setPersistence,
        browserLocalPersistence: {},
        getRedirectResult,
        connectAuthEmulator,
        signInWithPopup,
        signOut,
        GoogleAuthProvider,
      },
    } as unknown as FirebaseModules;

    const port = createFirebaseGoogleAuthPort(config, { load: async () => modules });
    await expect(port.current()).resolves.toBeNull();
    expect(getRedirectResult).not.toHaveBeenCalled();
    expect(connectAuthEmulator).toHaveBeenCalledWith(
      expect.anything(),
      'http://127.0.0.1:9099',
      { disableWarnings: true },
    );
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: V2_EMULATOR_PROJECT_ID }),
      `estudo-organizado-v2:${V2_EMULATOR_PROJECT_ID}`,
    );
  });

  it('f7_redirect_mode_reuses_the_redirected_identity_without_popup', async () => {
    const currentUser = { uid: 'uid-redirect', email: 'redirect@example.com' };
    const getRedirectResult = vi.fn(async () => ({ user: currentUser }));
    const signInWithPopup = vi.fn();
    const signInWithRedirect = vi.fn();
    const modules = {
      app: {
        getApps: () => [],
        getApp: () => ({}),
        initializeApp: () => ({}),
      },
      auth: {
        getAuth: () => ({ currentUser }),
        onAuthStateChanged: () => () => undefined,
        setPersistence: async () => undefined,
        browserLocalPersistence: {},
        getRedirectResult,
        signInWithPopup,
        signInWithRedirect,
        signOut: async () => undefined,
        GoogleAuthProvider: class {},
      },
    } as unknown as FirebaseModules;

    const port = createFirebaseGoogleAuthPort(
      {
        projectId: 'demo-redirect',
        authDomain: 'demo-redirect.firebaseapp.com',
        appId: '1:1:web:demo',
        apiKey: 'demo-api-key',
        authMode: 'redirect',
      },
      { load: async () => modules },
    );

    await expect(port.signIn()).resolves.toEqual({
      uid: 'uid-redirect',
      email: 'redirect@example.com',
    });
    expect(getRedirectResult).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).not.toHaveBeenCalled();
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it('f7_redirect_mode_starts_a_redirect_instead_of_a_popup', async () => {
    sessionStorage.clear();
    const signInWithPopup = vi.fn();
    const signInWithRedirect = vi.fn(async () => undefined);
    const modules = {
      app: {
        getApps: () => [],
        getApp: () => ({}),
        initializeApp: () => ({}),
      },
      auth: {
        getAuth: () => ({ currentUser: null }),
        onAuthStateChanged: () => () => undefined,
        setPersistence: async () => undefined,
        browserLocalPersistence: {},
        getRedirectResult: async () => null,
        signInWithPopup,
        signInWithRedirect,
        signOut: async () => undefined,
        GoogleAuthProvider: class {},
      },
    } as unknown as FirebaseModules;

    const port = createFirebaseGoogleAuthPort(
      {
        projectId: 'demo-redirect',
        authDomain: 'demo-redirect.firebaseapp.com',
        appId: '1:1:web:demo',
        apiKey: 'demo-api-key',
        authMode: 'redirect',
      },
      { load: async () => modules },
    );

    await expect(port.signIn()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY)).toBeNull();
  });

  it('f7_redirect_failure_clears_the_pending_marker', async () => {
    sessionStorage.clear();
    const signInWithRedirect = vi.fn(async () => {
      throw new Error('redirect failed');
    });
    const modules = {
      app: {
        getApps: () => [],
        getApp: () => ({}),
        initializeApp: () => ({}),
      },
      auth: {
        getAuth: () => ({ currentUser: null }),
        onAuthStateChanged: () => () => undefined,
        setPersistence: async () => undefined,
        browserLocalPersistence: {},
        getRedirectResult: async () => null,
        signInWithPopup: vi.fn(),
        signInWithRedirect,
        signOut: async () => undefined,
        GoogleAuthProvider: class {},
      },
    } as unknown as FirebaseModules;

    const port = createFirebaseGoogleAuthPort(
      {
        projectId: 'demo-redirect',
        authDomain: 'demo-redirect.firebaseapp.com',
        appId: '1:1:web:demo',
        apiKey: 'demo-api-key',
        authMode: 'redirect',
      },
      { load: async () => modules },
    );

    await expect(port.signIn()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY)).toBeNull();
  });

  it('f7_redirect_marker_is_project_scoped_and_expires', () => {
    sessionStorage.clear();
    const marker = (projectId: string, createdAt: number) =>
      JSON.stringify({ version: 1, projectId, createdAt });

    sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, marker('project-a', 1_000));
    expect(consumeRedirectPending('project-b', 2_000)).toBe(false);
    expect(sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY)).toBeNull();

    sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, marker('project-a', 1_000));
    expect(consumeRedirectPending('project-a', 1_000 + GOOGLE_REDIRECT_PENDING_MAX_AGE_MS + 1)).toBe(false);

    sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, marker('project-a', 1_000));
    expect(consumeRedirectPending('project-a', 2_000)).toBe(true);
    expect(consumeRedirectPending('project-a', 2_000)).toBe(false);
  });

  it('f7_redirect_error_is_sanitized_for_the_ui', async () => {
    sessionStorage.clear();
    const getRedirectResult = vi.fn(async () => {
      throw { code: 'auth/network-request-failed' };
    });
    const modules = {
      app: {
        getApps: () => [],
        getApp: () => ({}),
        initializeApp: () => ({}),
      },
      auth: {
        getAuth: () => ({ currentUser: null }),
        onAuthStateChanged: () => () => undefined,
        setPersistence: async () => undefined,
        browserLocalPersistence: {},
        getRedirectResult,
        signInWithPopup: vi.fn(),
        signInWithRedirect: vi.fn(),
        signOut: async () => undefined,
        GoogleAuthProvider: class {},
      },
    } as unknown as FirebaseModules;

    const port = createFirebaseGoogleAuthPort(
      {
        projectId: 'demo-redirect',
        authDomain: 'demo-redirect.firebaseapp.com',
        appId: '1:1:web:demo',
        apiKey: 'demo-api-key',
        authMode: 'redirect',
      },
      { load: async () => modules },
    );

    await expect(port.current()).resolves.toBeNull();
    expect(readGoogleAuthError()).toBe('auth/network-request-failed');
    expect(sessionStorage.getItem(GOOGLE_AUTH_ERROR_KEY)).toBe('auth/network-request-failed');
    clearGoogleAuthError();
    expect(readGoogleAuthError()).toBeNull();
  });
});
