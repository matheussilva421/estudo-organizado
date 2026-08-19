# Handoff — Fix do login Google via redirect (issue #99)

- **Data:** 2026-08-19
- **Branch:** `fix/issue-99-google-auth-redirect`
- **Issue:** https://github.com/matheussilva421/estudo-organizado/issues/99
- **Status:** implementação concluída e verde; **falta a configuração externa** (ver checklist)

---

## Problema

No Chrome/Android o login Google saía do app e parava em
`https://app-de-estudos-14564.firebaseapp.com/__/auth/handler?...` exibindo
"The requested action is invalid.". O usuário nunca voltava ao Estudo Organizado.

## Causa raiz identificada

O app é servido pelo **Cloudflare Workers** em
`https://estudo-organizado.matheussilva421.workers.dev/`, enquanto o `authDomain` do Firebase
era `app-de-estudos-14564.firebaseapp.com` — outro origin.

Desde o firebase-js-sdk **v9.15** o `signInWithRedirect` depende de acesso a storage de
terceiros no `authDomain`. Navegadores que particionam storage (Chrome no Android) quebram esse
fluxo. O projeto usa **firebase ^12.12.1**. A recomendação oficial do Firebase é servir
`/__/auth/*` **do próprio domínio do app** — foi o que fizemos.

Duas hipóteses da issue foram revisadas durante a investigação:

- **Hipótese 6 (Service Worker) era falsa no estado anterior**: `src/sw.js` já retornava cedo
  para qualquer request cross-origin. Mas passou a ser **verdadeira e crítica** com o proxy,
  porque `/__/auth/*` virou same-origin. As duas mudanças são acopladas.
- O `auth/popup-closed-by-user` em `POPUP_FALLBACK_CODES` era o caminho mais provável pelo qual
  o usuário caía no fluxo de redirect quebrado sem ter pedido.

---

## O que foi feito

### 1. Proxy das rotas reservadas do Firebase (novo)

- **`worker/index.js`** (novo): Worker que faz proxy de `/__/*` para
  `app-de-estudos-14564.firebaseapp.com` com `redirect: 'manual'` (obrigatório — o handler
  responde 302 para `accounts.google.com` e o Worker não pode seguir/reescrever isso). Todo o
  restante é delegado a `env.ASSETS.fetch(request)`.
- **`wrangler.jsonc`**: adicionados `"main": "worker/index.js"` e `"assets".binding = "ASSETS"`.
  O projeto deixa de ser assets-only e passa a ter um Worker.
- **`.gitignore`**: o arquivo usa allowlist (`/*` + exceções), então foi preciso adicionar
  `!/worker/` e `!/worker/**`, senão o Worker novo não seria versionado.

### 2. `authDomain` resolvido em runtime

- **`src/js/firebase/firebase-runtime-config.js`**: `authDomain` passa a ser o próprio
  `location.hostname` quando o host está em `PROXIED_AUTH_HOSTS`
  (`estudo-organizado.matheussilva421.workers.dev`); caso contrário mantém
  `app-de-estudos-14564.firebaseapp.com`.
  Lista explícita de propósito: dev local (`localhost`, `file://`, mock server) não tem proxy e
  continua no comportamento antigo, e um host novo só entra depois de ir para Authorized domains.

### 3. Bypass no Service Worker

- **`src/sw.js`**: no handler `fetch`, após a checagem de origin,
  `if (url.pathname.startsWith('/__/')) return;`. Sem isso o retorno do login receberia o
  `index.html` do fallback offline.

### 4. Fallback popup → redirect mais estrito

- **`src/js/firebase/firebase-client.js`**: `auth/popup-closed-by-user` saiu de
  `POPUP_FALLBACK_CODES` e entrou em um novo `POPUP_CANCEL_CODES`. Nesse caso
  `signInWithGoogle()` retorna `{ cancelled: true }` em vez de disparar redirect.
  Continuam em fallback: `auth/popup-blocked`, `auth/cancelled-popup-request`,
  `auth/operation-not-supported-in-this-environment`.
- **`src/js/sync/firestore-sync-engine.js`** (`firestoreSignIn`): distingue cancelamento
  (emite `signed-out`) de redirect real (mantém `redirecting`). Antes a UI ficaria presa em
  "redirecionando" após o usuário fechar o popup.

### 5. Cache bust

- `npm run bump`: `APP_VERSION` 9.22 → **9.23** (afeta `src/sw.js`, `src/index.html`,
  `src/js/sync/sync-diagnostic.js`, `tests/unit/css-architecture.test.js`).

---

## Arquivos alterados

**Novos**

- `worker/index.js`
- `tests/unit/firebase-auth-fallback.test.js`
- `tests/unit/sw-fetch-routing.test.js`
- `tests/unit/worker-auth-proxy.test.js`
- `tests/unit/firestore-sign-in-cancel.test.js`
- `docs/handoffs/handoff-2026-08-19-login-google-redirect.md` (este arquivo)

**Modificados**

- `wrangler.jsonc`
- `.gitignore`
- `src/js/firebase/firebase-runtime-config.js`
- `src/js/firebase/firebase-client.js`
- `src/js/sync/firestore-sync-engine.js`
- `src/sw.js`
- `src/index.html` (bump)
- `src/js/sync/sync-diagnostic.js` (bump)
- `tests/unit/firestore-contracts.test.js`
- `tests/unit/css-architecture.test.js` (bump)

---

## Testes

TDD: os 4 arquivos de teste foram escritos antes da implementação e confirmados vermelhos
(7 falhas pelos motivos esperados) antes do green.

```txt
Comando: npx vitest run

Resultado:
- 143 arquivos de teste
- 2258 testes executados
- 2258 passaram
- 0 falharam

Status: verde
```

```txt
Comando: npm run lint
Resultado: 0 errors, 44 warnings (todos pré-existentes, de estilo)
```

`npm run format:check` **não** foi executado: falha por CRLF neste ambiente Windows
(`autocrlf=true` vs `endOfLine: lf`). É ambiental — não rodar `prettier --write`.

### Validação manual executada

`npx wrangler@4 dev --port 8788 --local`, com o binding `env.ASSETS` reconhecido:

| Rota | Resultado |
| --- | --- |
| `GET /__/auth/handler?apiKey=...&providerId=google.com` | **200**, conteúdo real do Firebase |
| `GET /__/auth/iframe?apiKey=...` | **200** |
| `GET /__/firebase/init.json` | 404 "Site Not Found" — esperado, o projeto não tem site de Firebase Hosting; o SDK de Auth não usa esse endpoint |
| `GET /` | **200** (assets) |
| `GET /index.html` | 307 → `/` (html_handling padrão do Cloudflare assets) |

---

## Diagnóstico adicional (2026-08-19, com os dashboards em mãos)

Duas consultas diretas ao projeto fecharam o quadro.

### A restrição da API key bloqueava o `firebaseapp.com` — causa original do erro

```txt
POST identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=<browser key>

Referer: https://estudo-organizado.matheussilva421.workers.dev/  -> 200 OK
Referer: https://app-de-estudos-14564.firebaseapp.com/           -> 403 API_KEY_HTTP_REFERRER_BLOCKED
```

A lista "Restrições de sites" da Browser key contém **apenas** os dois `workers.dev`. O handler
antigo rodava em `firebaseapp.com` e chamava o Identity Toolkit de lá — a própria restrição da
chave derrubava a chamada, e o handler exibia "The requested action is invalid.".

Isso também significa que **o dev local está quebrado** enquanto a chave não liberar
`firebaseapp.com` e `localhost`, já que fora dos `PROXIED_AUTH_HOSTS` o `authDomain` continua
sendo `firebaseapp.com`.

### O `redirect_uri` enviado ao Google passa a ser o domínio do app

```txt
continueUri = https://estudo-organizado.matheussilva421.workers.dev/__/auth/handler
-> redirect_uri = https://estudo-organizado.matheussilva421.workers.dev/__/auth/handler
```

O Identity Toolkit deriva o `redirect_uri` do origin onde o handler roda. Com o proxy, o Google
recebe o domínio do Worker — que precisa estar registrado no OAuth Client, senão a resposta é
`Erro 400: redirect_uri_mismatch`.

---

## PENDENTE — ações manuais nos dashboards

**Nada disso é acionável por código.** Precisa estar pronto **antes** de o código chegar em
produção, senão o login quebra para todos.

### Firebase Console — projeto `app-de-estudos-14564`

- [x] Authentication → Sign-in method → provedor **Google** habilitado.
- [x] Authentication → Settings → **Authorized domains**: `estudo-organizado.matheussilva421.workers.dev`
      presente como Custom, junto com `localhost`, `app-de-estudos-14564.firebaseapp.com` e
      `app-de-estudos-14564.web.app`. **Verificado 2026-08-19.**
- [ ] Project settings → conferir se o `firebaseConfig` do Web App bate com
      `src/js/firebase/firebase-runtime-config.js` (apiKey, appId, messagingSenderId).

### Google Cloud → Credentials → OAuth 2.0 Client ID "Aplicativo da Web" (BLOQUEANTE)

- [ ] **Origens JavaScript autorizadas**: adicionar
      `https://estudo-organizado.matheussilva421.workers.dev`.
      (Hoje só existem `http://localhost`, `http://localhost:5000` e
      `https://app-de-estudos-14564.firebaseapp.com`.)
- [ ] **URIs de redirecionamento autorizados**: adicionar
      `https://estudo-organizado.matheussilva421.workers.dev/__/auth/handler`.
      (Hoje só existe `https://app-de-estudos-14564.firebaseapp.com/__/auth/handler`.)
- [ ] Manter as entradas existentes — o dev local ainda usa `firebaseapp.com`.

### Google Cloud → Credentials → Browser key → Restrições de sites

- [x] `https://estudo-organizado.matheussilva421.workers.dev` e `.../*` presentes.
- [ ] Adicionar `https://app-de-estudos-14564.firebaseapp.com/*` — corrige o erro original e
      destrava o dev local.
- [ ] Adicionar `http://localhost/*` e `http://localhost:5000/*` — o app em dev chama o
      Identity Toolkit direto do localhost.
- [x] APIs da chave incluem **Identity Toolkit API** (além de Cloud Firestore, App Check,
      Firebase Installations e Token Service). **Verificado 2026-08-19.**

### Cloudflare Dashboard — Worker `estudo-organizado`

- [ ] Se o deploy usa **integração Git** (Workers → Builds), confirmar que o build respeita o
      `wrangler.jsonc` do repo — sem o `main` novo o Worker de proxy não sobe e o login quebra.
- [ ] Se o deploy é manual (`wrangler deploy`), nada a fazer no dashboard.
- [ ] Após o deploy, checar Workers → Logs por erros em `/__/auth/*`.

---

## Próximos passos

1. Executar a checklist acima (Firebase primeiro).
2. Abrir PR da branch `fix/issue-99-google-auth-redirect` e fazer merge.
3. Deploy.
4. **Teste que reproduz a issue**: Chrome/Android → login Google. Confirmar que o handler abre
   em `https://estudo-organizado.matheussilva421.workers.dev/__/auth/handler` (e **não** em
   `firebaseapp.com`) e que retorna ao app autenticado.
5. Repetir com o app instalado como PWA (SW ativo), para validar o bypass `/__/`.
6. Testar em desktop: popup conclui normalmente; fechar o popup **não** navega a página e a UI
   volta ao estado desconectado.
7. E2E (`npm run test:e2e`) não foi executado nesta sessão — rodar antes do release.

## Rollback

Reverter apenas a Etapa 2 (`authDomain` fixo em `firebase-runtime-config.js`) restaura o
comportamento anterior sem tocar no Worker nem no Service Worker.

## Nota sobre o estado `.ai`

`.ai/CURRENT.md` registra `Commit-base: 3627b1d`, mas o HEAD de `main` no início da sessão era
`e3413fb`. O estado `.ai` está divergente do Git e **não** foi usado como contexto — este
trabalho partiu da issue #99. Reconciliar em uma sessão futura.
