export const V1_FIREBASE_PROJECT_ID = 'app-de-estudos-14564';

/**
 * Origins/hosts that belong to the productive V1. They are rejected even when
 * a developer accidentally exports the wrong Vite environment.
 */
export const V1_HOSTS = [
  'app-de-estudos-14564.firebaseapp.com',
  'app-de-estudos-14564.web.app',
  'estudo-organizado.matheussilva421.workers.dev',
] as const;

export const V2_EMULATOR_PROJECT_ID = 'demo-estudo-v2';
export const V2_APP_NAME = 'estudo-organizado-v2';

/**
 * Real Firebase projects require an explicit G-EXT decision. Keeping this list
 * empty means a production-looking .env alone can never enable remote access.
 */
const APPROVED_REAL_PROJECT_IDS: readonly string[] = [];

export type V2RemoteConfig = {
  projectId: string;
  authDomain: string;
  appId: string;
  apiKey: string;
  firestoreEmulator?: { host: string; port: number };
  authEmulator?: { url: string };
};

function read(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedHost(value: string): string | null {
  const candidate = value.trim().toLowerCase().replace(/\.$/, '');
  if (!candidate || candidate.includes('/') || candidate.includes(' ') || candidate.includes('\\')) {
    return null;
  }
  return candidate;
}

function isV1Value(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (!lower) return false;
  if (lower.includes(V1_FIREBASE_PROJECT_ID)) return true;
  const host = normalizedHost(lower);
  return host !== null && (V1_HOSTS as readonly string[]).includes(host);
}

function isLoopbackHost(host: string): boolean {
  const normalized = normalizedHost(host);
  if (!normalized) return false;
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1' || normalized === '[::1]';
}

function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Resolves the public V2 Firebase configuration.
 *
 * Local-only is the default: without an explicit V2 flag, complete public
 * fields and an approved project, this returns null. Emulator mode is explicit
 * and restricted to loopback plus a demo project. No secret belongs here.
 */
export function resolveV2RemoteConfig(
  env: Record<string, string | undefined>,
): V2RemoteConfig | null {
  if (read(env, 'VITE_V2_REMOTE_ENABLED') !== 'true') return null;

  const projectId = read(env, 'VITE_V2_FIREBASE_PROJECT_ID');
  const authDomain = read(env, 'VITE_V2_FIREBASE_AUTH_DOMAIN');
  const appId = read(env, 'VITE_V2_FIREBASE_APP_ID');
  if (!projectId || !authDomain || !appId) return null;

  if (projectId === V1_FIREBASE_PROJECT_ID) return null;
  if (isV1Value(projectId) || isV1Value(authDomain) || isV1Value(appId)) return null;
  if (normalizedHost(authDomain) === null) return null;

  const firestoreHost = read(env, 'VITE_V2_FIRESTORE_EMULATOR_HOST');
  const firestorePortRaw = read(env, 'VITE_V2_FIRESTORE_EMULATOR_PORT');
  const authEmulatorUrl = read(env, 'VITE_V2_AUTH_EMULATOR_URL');
  const emulatorParts = [firestoreHost, firestorePortRaw, authEmulatorUrl].filter(Boolean).length;

  if (emulatorParts > 0) {
    // Emulator configuration is all-or-nothing; a half-configured adapter must
    // fail closed instead of silently falling back to a real project.
    if (emulatorParts !== 3) return null;
    if (!isLoopbackHost(firestoreHost)) return null;
    if (!isLoopbackUrl(authEmulatorUrl)) return null;

    const port = Number(firestorePortRaw);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;

    const emulatorProject =
      projectId === V2_EMULATOR_PROJECT_ID || projectId.startsWith('demo-');
    if (!emulatorProject) return null;

    return {
      projectId,
      authDomain,
      appId,
      apiKey: read(env, 'VITE_V2_FIREBASE_API_KEY') || 'demo-api-key',
      firestoreEmulator: { host: firestoreHost, port },
      authEmulator: { url: authEmulatorUrl },
    };
  }

  const approved = read(env, 'VITE_V2_APPROVED_PROJECT_ID');
  if (!approved || approved !== projectId) return null;
  if (!APPROVED_REAL_PROJECT_IDS.includes(projectId)) return null;
  const apiKey = read(env, 'VITE_V2_FIREBASE_API_KEY');
  if (!apiKey) return null;

  return { projectId, authDomain, appId, apiKey };
}
