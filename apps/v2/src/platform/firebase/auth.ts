import type { Auth, User } from 'firebase/auth';
import { V2_APP_NAME, type V2RemoteConfig } from './config';
import {
  GoogleAuthError,
  type GoogleAuthPort,
  type GoogleIdentity,
} from '../../application/google-auth-types';

export type FirebaseModules = {
  app: typeof import('firebase/app');
  auth: typeof import('firebase/auth');
};

export type FirebaseLoader = () => Promise<FirebaseModules>;

/** Test seam: the real loader is the only path that imports the SDK. */
export type GoogleAuthBackend = {
  signIn(): Promise<GoogleIdentity>;
  signOut(): Promise<void>;
  current(): Promise<GoogleIdentity | null>;
  getIdToken(): Promise<string | null>;
  subscribe(listener: (identity: GoogleIdentity | null) => void): () => void;
  dispose?(): void;
};

export type GoogleAuthOptions = {
  backend?: GoogleAuthBackend;
  load?: FirebaseLoader;
};

/** Session marker used to resume the consent preview after a redirect. */
export const GOOGLE_REDIRECT_PENDING_KEY = 'eo-v2-google-link-pending';
export const GOOGLE_REDIRECT_PENDING_MAX_AGE_MS = 30 * 60 * 1000;
export const GOOGLE_AUTH_ERROR_KEY = 'eo-v2-google-auth-error';

function safeErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Za-z0-9/_-]{1,80}$/.test(code)
    ? code
    : 'AUTH_UNKNOWN';
}

function recordGoogleAuthError(error: unknown): void {
  try {
    globalThis.sessionStorage?.setItem(GOOGLE_AUTH_ERROR_KEY, safeErrorCode(error));
  } catch {
    // Diagnostics must never break the auth lifecycle.
  }
}

export function readGoogleAuthError(): string | null {
  try {
    const value = globalThis.sessionStorage?.getItem(GOOGLE_AUTH_ERROR_KEY) ?? null;
    return value && /^[A-Za-z0-9/_-]{1,80}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearGoogleAuthError(): void {
  try {
    globalThis.sessionStorage?.removeItem(GOOGLE_AUTH_ERROR_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

type RedirectPending = {
  version: 1;
  projectId: string;
  createdAt: number;
};

function setRedirectPending(projectId: string, now = Date.now()): void {
  try {
    const pending: RedirectPending = { version: 1, projectId, createdAt: now };
    globalThis.sessionStorage?.setItem(GOOGLE_REDIRECT_PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Session storage may be unavailable; the redirect still works.
  }
}

function clearRedirectPending(): void {
  try {
    globalThis.sessionStorage?.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/** Consumes and validates a redirect marker for the expected project. */
export function consumeRedirectPending(projectId: string, now = Date.now()): boolean {
  let raw: string | null;
  try {
    raw = globalThis.sessionStorage?.getItem(GOOGLE_REDIRECT_PENDING_KEY) ?? null;
    if (raw) globalThis.sessionStorage?.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  try {
    const pending = JSON.parse(raw) as Partial<RedirectPending>;
    const age = now - (typeof pending.createdAt === 'number' ? pending.createdAt : NaN);
    return pending.version === 1
      && pending.projectId === projectId
      && Number.isFinite(age)
      && age >= 0
      && age <= GOOGLE_REDIRECT_PENDING_MAX_AGE_MS;
  } catch {
    return false;
  }
}

const defaultLoad: FirebaseLoader = async () => {
  const [app, auth] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  return { app, auth };
};

function mapUser(user: User | null): GoogleIdentity | null {
  if (!user || typeof user.uid !== 'string' || !user.uid.trim()) return null;
  return { uid: user.uid, email: typeof user.email === 'string' ? user.email : null };
}

function notify(listeners: Set<(identity: GoogleIdentity | null) => void>, identity: GoogleIdentity | null): void {
  for (const listener of [...listeners]) {
    try {
      listener(identity);
    } catch {
      // A rendering listener must never break the auth lifecycle.
    }
  }
}

function isPopupCancelled(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
}

async function createFirebaseBackend(
  config: V2RemoteConfig,
  load: FirebaseLoader,
): Promise<GoogleAuthBackend> {
  const { app: appModule, auth: authModule } = await load();
  const appName = `${V2_APP_NAME}:${config.projectId}`;
  const existing = appModule.getApps().find((candidate) => candidate.name === appName);
  const app = existing ?? appModule.initializeApp({
        projectId: config.projectId,
        authDomain: config.authDomain,
        appId: config.appId,
        // Public key only; G-EXT supplies the isolated project value.
        apiKey: config.apiKey,
      }, appName);
  const auth: Auth = authModule.getAuth(app);

  if (config.authEmulator) {
    authModule.connectAuthEmulator(auth, config.authEmulator.url, { disableWarnings: true });
  }

  await authModule.setPersistence(auth, authModule.browserLocalPersistence).catch(() => undefined);

  // Completes a pending redirect before the auth listener is registered. The
  // call is a no-op when there is no redirect event in this browser session.
  if (config.authMode === 'redirect' && typeof authModule.getRedirectResult === 'function') {
    await authModule.getRedirectResult(auth).catch((error) => {
      recordGoogleAuthError(error);
    });
  }

  const listeners = new Set<(identity: GoogleIdentity | null) => void>();
  let identity = mapUser(auth.currentUser);
  const unsubscribe = authModule.onAuthStateChanged(auth, (user) => {
    identity = mapUser(user);
    notify(listeners, identity);
  });

  return {
    async signIn() {
      clearGoogleAuthError();
      try {
        const provider = new authModule.GoogleAuthProvider();
        if (config.authMode === 'redirect') {
          const existingIdentity = mapUser(auth.currentUser);
          if (existingIdentity) {
            identity = existingIdentity;
            notify(listeners, identity);
            return existingIdentity;
          }
          setRedirectPending(config.projectId);
          try {
            await authModule.signInWithRedirect(auth, provider);
          } catch (error) {
            clearRedirectPending();
            recordGoogleAuthError(error);
            throw new GoogleAuthError('AUTH_FAILED', 'Google sign-in redirect failed', { cause: error });
          }
          clearRedirectPending();
          throw new GoogleAuthError('AUTH_FAILED', 'Google sign-in redirect did not navigate');
        }
        const result = await authModule.signInWithPopup(auth, provider);
        const next = mapUser(result.user);
        if (!next) throw new GoogleAuthError('AUTH_FAILED', 'Google did not return a valid identity');
        clearGoogleAuthError();
        identity = next;
        notify(listeners, identity);
        return next;
      } catch (error) {
        if (error instanceof GoogleAuthError) throw error;
        if (isPopupCancelled(error)) {
          clearGoogleAuthError();
          throw new GoogleAuthError('AUTH_CANCELLED', 'Google sign-in was cancelled', { cause: error });
        }
        recordGoogleAuthError(error);
        throw new GoogleAuthError('AUTH_FAILED', 'Google sign-in failed', { cause: error });
      }
    },
    async signOut() {
      clearRedirectPending();
      clearGoogleAuthError();
      await authModule.signOut(auth);
      identity = null;
      notify(listeners, null);
    },
    async current() {
      identity = mapUser(auth.currentUser);
      return identity;
    },
    async getIdToken() {
      return auth.currentUser ? auth.currentUser.getIdToken() : null;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(identity);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}

function localOnlyPort(): GoogleAuthPort {
  return {
    async signIn() {
      throw new GoogleAuthError('AUTH_UNAVAILABLE', 'remote authentication is disabled');
    },
    async signOut() {
      // Local mode has no remote authority to clear.
    },
    async current() {
      return null;
    },
    async getIdToken() {
      return null;
    },
    subscribe(listener) {
      listener(null);
      return () => undefined;
    },
  };
}

/**
 * Builds the Google Auth port. With no V2 config it is strictly local and the
 * Firebase SDK is never imported. The loader/backend seams exist so tests can
 * prove cancellation and emulator isolation without contacting Google.
 */
export function createFirebaseGoogleAuthPort(
  config: V2RemoteConfig | null,
  options: GoogleAuthOptions = {},
): GoogleAuthPort {
  if (options.backend) return options.backend;
  if (!config) return localOnlyPort();

  const load = options.load ?? defaultLoad;
  let backendPromise: Promise<GoogleAuthBackend> | null = null;
  const backend = (): Promise<GoogleAuthBackend> => {
    backendPromise ??= createFirebaseBackend(config, load);
    return backendPromise;
  };

  return {
    async signIn() {
      return (await backend()).signIn();
    },
    async signOut() {
      return (await backend()).signOut();
    },
    async current() {
      return (await backend()).current();
    },
    async getIdToken() {
      return (await backend()).getIdToken();
    },
    subscribe(listener) {
      let disposed = false;
      let unsubscribe: (() => void) | null = null;
      void backend()
        .then((resolved) => {
          if (!disposed) unsubscribe = resolved.subscribe(listener);
        })
        .catch(() => {
          if (!disposed) listener(null);
        });
      return () => {
        disposed = true;
        unsubscribe?.();
      };
    },
  };
}
