// Hosts que servem /__/auth/* pelo proxy do Cloudflare Worker (worker/index.js).
// Neles o authDomain passa a ser o proprio origin do app, para que o
// signInWithRedirect nao dependa de storage de terceiros — ver issue #99.
// Lista explicita de proposito: um host novo so entra aqui depois de ser
// adicionado aos Authorized domains do Firebase Authentication.
const PROXIED_AUTH_HOSTS = ['estudo-organizado.matheussilva421.workers.dev'];
const FALLBACK_AUTH_DOMAIN = 'app-de-estudos-14564.firebaseapp.com';

window.ESTUDO_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC3wPAXvPRqq-xallRgivfkK5NWiW9wDPk',
  authDomain: PROXIED_AUTH_HOSTS.includes(window.location.hostname)
    ? window.location.hostname
    : FALLBACK_AUTH_DOMAIN,
  projectId: 'app-de-estudos-14564',
  storageBucket: 'app-de-estudos-14564.firebasestorage.app',
  messagingSenderId: '824173301356',
  appId: '1:824173301356:web:b346b7d59feca6f5e4d249',
};

window.ESTUDO_APP_CHECK_SITE_KEY = '';
