# F7 — Runbook dos gates externos (G-EXT e G-STAGING)

**Estado atual:** `F7_LOCAL_CODE_COMPLETE` / `F7_BLOCKED_G-EXT_G-STAGING`  
**Código local:** `df957f6`; documentação: `188b03a` (este runbook integra o commit documental seguinte)  
**V1/main:** `9046cfa`, intocada.  
**Regra:** este runbook não autoriza nada por si só. G-EXT e G-STAGING exigem consentimento expresso e separado.

**Estabilização de 09/11/2026:** revisão independente, restore/feed/rebaseline aplicados aos stores, checksum/manifesto, Worker imutável/JWKS, PWA precache e runtime local. O checklist detalhado está em [f7-g-ext-staging-prep.md](f7-g-ext-staging-prep.md); a auditoria em [2026-11-09-v2-f7-stabilization.md](../superpowers/audits/2026-11-09-v2-f7-stabilization.md).

## 1. G-EXT — Firebase Spark e Cloudflare Free isolados

### Pré-condições humanas

- Autorização escrita para criar/usar um projeto Firebase Spark **separado** da V1 (`app-de-estudos-14564` proibido).
- Autorização para criar um Worker/KV namespace Free separado, sem R2 e sem billing.
- Conta Google de teste e, se possível, um segundo perfil para provar negação de UID.
- Confirmar que o projeto não tem Blaze, Cloud Functions pagas, TTL/PITR/backup gerenciado ou R2.

### Passos

1. Criar o projeto Spark isolado e anotar `projectId`, `authDomain`, `appId` e a API key pública.
2. Habilitar Google Auth e Firestore Standard; publicar `apps/v2/firebase/firestore.rules` e os índices.
3. Configurar as variáveis públicas V2 no ambiente de homologação, incluindo `VITE_V2_FIREBASE_API_KEY` e `VITE_V2_BACKUP_ENDPOINT`; nunca usar as da V1.
4. Criar o Worker `apps/v2/cloudflare/backup-worker.ts` com binding KV Free, `FIREBASE_PROJECT_ID` isolado e `ALLOWED_ORIGIN`; o JWKS público do Google é o padrão e o arquivo exporta o entrypoint `fetch`. O modelo está em `apps/v2/cloudflare/wrangler.toml.example`.
5. Executar primeiro os testes de emulador e depois o piloto real com dados sintéticos.
6. Provar: login Google real; vínculo consentido; UID A não lê UID B; CAS/deduplicação; timeout/read-back; tombstone; backup criptografado e read-back; quota; dois clientes.

### Comandos de referência

```powershell
# Em apps/v2
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:e2e

# Rules no emulador (JRE 21+; use o caminho local do seu JRE)
$env:JAVA_HOME='<caminho-do-jdk-21>'
$env:PATH=($env:JAVA_HOME + '\bin;' + $env:PATH)
npx firebase emulators:exec --config firebase/firebase.json --project demo-estudo-v2 --only firestore "npm run test:firebase"
```

### Evidência mínima

- Projeto/IDs usados, sem tokens.
- Matriz S01–S25 com `PASS_REAL_ISOLATED`, `FAIL`, `NOT_RUN` ou `INCONCLUSIVE`.
- Quatro HIGH com prova real ou bloqueio explícito.
- Contagens de reads/writes/deletes/bytes e confirmação de que o plano é Spark Free.
- Nenhum dado pessoal ou acadêmico real.

## 2. G-STAGING — URL de avaliação V2

### Pré-condições humanas

- G-EXT concluído ou, no mínimo, projeto Firebase de homologação isolado definido.
- Autorização para publicar em hospedagem gratuita separada (preferência: Cloudflare Pages Free).
- Origem diferente da V1; nenhum domínio, Service Worker, cache ou DNS da V1.
- Dados sintéticos e proteção de acesso apropriada.

### Passos

1. Gerar build de produção com a configuração V2 isolada.
2. Publicar apenas `apps/v2/dist` no projeto/página de homologação.
3. Fazer HTTP read-back real da URL e verificar `index.html`, manifest, SW e assets.
4. Abrir em desktop, viewport mobile e tablet; executar F2–F6, Auth, sync, backup e PWA.
5. Confirmar que `origin` não é V1, que o cache é `estudo-organizado-v2-*` e que nenhum IndexedDB/Firebase V1 foi tocado.
6. Registrar URL, commit/build, limitações e pontos de feedback.

### Critério de parada

- `verifyStagingReadiness` deve retornar `READY_FOR_HUMAN_REVIEW` somente com `liveReadback=true`, `isolatedOrigin=true`, `isolatedFirebase=true`, `v1Unaffected=true`, `testDataOnly=true`, `usesPaidServices=false`, módulos F2–F6 e `unverified=[]`.
- Sem read-back real, o estado é `BLOCKED_G-STAGING`; nenhuma URL deve ser inventada.

## 3. O que não fazer

- Não usar o projeto Firestore/Worker/URL da V1.
- Não habilitar Blaze, R2, backup gerenciado ou qualquer cobrança.
- Não migrar dados pessoais reais.
- Não fazer merge `v2`→`main`, cutover, aposentar a V1 ou ativar ponte bidirecional.
- Não declarar `F7_ACCEPTED` sem o proprietário experimentar a V2.

## 4. Próximo passo

Solicitar um único consentimento consolidado para G-EXT + G-STAGING. Após a autorização, executar este runbook, anexar as evidências ao relatório único e só então pedir avaliação humana.
