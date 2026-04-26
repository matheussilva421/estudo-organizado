export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC3wPAXvPRqq-xallRgivfkK5NWiW9wDPk',
  authDomain: 'app-de-estudos-14564.firebaseapp.com',
  projectId: 'app-de-estudos-14564',
  storageBucket: 'app-de-estudos-14564.firebasestorage.app',
  messagingSenderId: '824173301356',
  appId: '1:824173301356:web:b346b7d59feca6f5e4d249'
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
