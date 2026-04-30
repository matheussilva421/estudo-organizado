import {
  initializeApp,
  getApps,
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  initializeAppCheck,
  ReCaptchaV3Provider,
} from '../../vendor/firebase-client.bundle.js?v=8.31';
import {
  getRuntimeAppCheckSiteKey,
  getRuntimeFirebaseConfig,
} from './firebase-config-default.js?v=8.31';

let services = null;

const POPUP_FALLBACK_CODES = new Set([
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
]);

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

export async function signOutFirebase() {
  const { configured, auth } = initFirebaseServices();
  if (configured && auth) {
    await signOut(auth);
  }
}
