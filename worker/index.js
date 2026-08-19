/**
 * Cloudflare Worker do Estudo Organizado.
 *
 * Serve os assets estaticos de `src/` e faz proxy das rotas reservadas do
 * Firebase (`/__/auth/*`, `/__/firebase/*`) para o dominio do projeto.
 *
 * Por que o proxy existe: desde o firebase-js-sdk v9.15 o `signInWithRedirect`
 * depende de storage de terceiros no `authDomain`. Com o `authDomain` em outro
 * origin (firebaseapp.com), navegadores que particionam storage — Chrome no
 * Android, por exemplo — quebram o retorno do login e o handler exibe
 * "The requested action is invalid.". Servindo o handler do proprio origin do
 * app, o fluxo volta a ser same-origin. Ver issue #99.
 */

const FIREBASE_AUTH_HOST = 'app-de-estudos-14564.firebaseapp.com';
const RESERVED_PREFIX = '/__/';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(RESERVED_PREFIX)) {
      const upstream = new URL(url);
      upstream.protocol = 'https:';
      upstream.host = FIREBASE_AUTH_HOST;
      upstream.port = '';

      // `redirect: 'manual'` e obrigatorio: o handler responde 302 para
      // accounts.google.com e o Worker nao pode seguir nem reescrever isso.
      return fetch(new Request(upstream.toString(), request), { redirect: 'manual' });
    }

    return env.ASSETS.fetch(request);
  },
};
