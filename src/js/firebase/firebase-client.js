import {
  initializeApp,
  getApps,
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  signOut,
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  initializeAppCheck,
  ReCaptchaV3Provider,
} from '../../vendor/firebase-client.bundle.js?v=8.37';
import {
  getRuntimeAppCheckSiteKey,
  getRuntimeFirebaseConfig,
} from './firebase-config-default.js?v=8.37';

let services = null;

// Erros em que vale a pena trocar o popup por um redirect de pagina inteira:
// o popup nao chegou a abrir ou o ambiente nao o suporta.
const POPUP_FALLBACK_CODES = new Set([
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
  'auth/popup-blocked',
]);

// Erros que significam "o usuario desistiu". Aqui um redirect tiraria a pessoa
// do app sem que ela tenha pedido — tratamos como cancelamento. Ver issue #99.
const POPUP_CANCEL_CODES = new Set(['auth/popup-closed-by-user']);

export function isFirebaseConfigured(config = getRuntimeFirebaseConfig()) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function getFirebaseConfigStatus() {
  const config = getRuntimeFirebaseConfig();
  return {
    configured: isFirebaseConfigured(config),
    projectId: config.projectId || '',
    authDomain: config.authDomain || '',
  };
}

export function initFirebaseServices() {
  if (services) return services;

  const config = getRuntimeFirebaseConfig();
  if (!isFirebaseConfigured(config)) {
    services = { configured: false, app: null, auth: null, db: null };
    return services;
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  const emulator = typeof window !== 'undefined' ? window.__ESTUDO_FIREBASE_EMULATOR__ : null;
  if (emulator?.authHost) {
    connectAuthEmulator(auth, `http://${emulator.authHost}`, { disableWarnings: true });
  }
  if (emulator?.firestoreHost) {
    const separator = String(emulator.firestoreHost).lastIndexOf(':');
    const host = separator > 0
      ? String(emulator.firestoreHost).slice(0, separator)
      : String(emulator.firestoreHost);
    const port = separator > 0
      ? Number(String(emulator.firestoreHost).slice(separator + 1))
      : 8080;
    connectFirestoreEmulator(db, host, port);
  }

  const appCheckSiteKey = getRuntimeAppCheckSiteKey();
  if (appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  services = { configured: true, app, auth, db };
  return services;
}

export function observeFirebaseAuth(callback) {
  const { configured, auth } = initFirebaseServices();
  if (!configured || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function observeFirebaseIdToken(callback) {
  const { configured, auth } = initFirebaseServices();
  if (!configured || !auth) {
    callback(null);
    return () => {};
  }
  return onIdTokenChanged(auth, callback);
}

export async function signInWithGoogle() {
  const { configured, auth } = initFirebaseServices();
  if (!configured || !auth) {
    throw new Error(
      'Firebase nao configurado. Defina window.ESTUDO_FIREBASE_CONFIG antes de carregar o app.'
    );
  }
  const provider = new GoogleAuthProvider();
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    if (POPUP_CANCEL_CODES.has(err?.code)) return { cancelled: true };
    if (!POPUP_FALLBACK_CODES.has(err?.code)) throw err;
    await signInWithRedirect(auth, provider);
    return null;
  }
}

export async function completeGoogleRedirectSignIn() {
  const { configured, auth } = initFirebaseServices();
  if (!configured || !auth) return null;
  return await getRedirectResult(auth);
}

/** Test-only credential sign-in; only reaches an Auth Emulator configured above. */
export async function signInWithTestEmail(email, password, { create = false } = {}) {
  const { configured, auth } = initFirebaseServices();
  if (!configured || !auth || !window.__ESTUDO_FIREBASE_EMULATOR__?.authHost) {
    throw new Error('Auth Emulator não configurado para o teste.');
  }
  return create
    ? createUserWithEmailAndPassword(auth, email, password)
    : signInWithEmailAndPassword(auth, email, password);
}

export async function signOutFirebase() {
  const { configured, auth } = initFirebaseServices();
  if (configured && auth) {
    await signOut(auth);
  }
}
