export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
};

export const FIREBASE_APP_CHECK_SITE_KEY = '';

export function getRuntimeFirebaseConfig() {
  const runtimeConfig = window.ESTUDO_FIREBASE_CONFIG || {};
  return {
    ...FIREBASE_CONFIG,
    ...runtimeConfig
  };
}

export function getRuntimeAppCheckSiteKey() {
  return window.ESTUDO_FIREBASE_APP_CHECK_SITE_KEY || FIREBASE_APP_CHECK_SITE_KEY;
}
