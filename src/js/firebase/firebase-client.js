import {
  initializeApp,
  getApps,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  initializeAppCheck,
  ReCaptchaV3Provider
} from '../../vendor/firebase-client.bundle.js?v=8.21';
import { getRuntimeAppCheckSiteKey, getRuntimeFirebaseConfig } from './firebase-config.js?v=8.21';

let services = null;

export function isFirebaseConfigured(config = getRuntimeFirebaseConfig()) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function getFirebaseConfigStatus() {
  const config = getRuntimeFirebaseConfig();
  return {
    configured: isFirebaseConfigured(config),
    projectId: config.projectId || '',
    authDomain: config.authDomain || ''
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
      tabManager: persistentMultipleTabManager()
    })
  });

  const appCheckSiteKey = getRuntimeAppCheckSiteKey();
  if (appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true
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
    throw new Error('Firebase nao configurado. Preencha src/js/firebase/firebase-config.js.');
  }
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
}

export async function signOutFirebase() {
  const { configured, auth } = initFirebaseServices();
  if (configured && auth) {
    await signOut(auth);
  }
}
