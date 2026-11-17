# F7 — preparação executável de G-EXT e G-STAGING

**Estado:** preparado para os gates, **não executado**; em 17/11/2026 o local fechou 37/37 no Emulator, 883 unitários e 251/256 E2E (5 skips, 0 falhas).
**Pré-requisito:** autorização humana separada para G-EXT e G-STAGING.  
**Regra:** este documento não autoriza acesso a Firebase/Cloudflare reais, publicação de URL, uso de dados pessoais, billing ou merge `v2`→`main`.

## 1. Pré-condições humanas

- Aprovar um projeto Firebase Spark **novo e separado** da V1 (`app-de-estudos-14564` proibido).
- Aprovar um namespace Workers KV Free separado, sem R2 e sem Blaze.
- Fornecer duas contas Google sintéticas (A e B) para provar negação de UID.
- Confirmar que nenhum dado acadêmico real será usado no piloto.
- Confirmar que a hospedagem será gratuita, em origem diferente da V1.

## 2. Firebase Spark isolado

1. Criar projeto Spark, sem billing, com Firestore Standard e Google Auth.
2. Anotar `projectId`, `authDomain`, `appId` e a **API key pública** (não é segredo; nunca usar service account no frontend).
3. Publicar `apps/v2/firebase/firestore.rules` e `firestore.indexes.json` no projeto isolado.
4. Configurar as variáveis públicas em `apps/v2/.env.local` (não versionar):

```text
VITE_V2_REMOTE_ENABLED=true
VITE_V2_FIREBASE_PROJECT_ID=<spark-isolado>
VITE_V2_FIREBASE_AUTH_DOMAIN=<spark-isolado>.firebaseapp.com
VITE_V2_FIREBASE_APP_ID=<app-id>
VITE_V2_FIREBASE_API_KEY=<api-key-publica>
VITE_V2_APPROVED_PROJECT_ID=<spark-isolado>
VITE_V2_BACKUP_ENDPOINT=https://<worker-v2>.<account>.workers.dev
```

5. O código exige `VITE_V2_APPROVED_PROJECT_ID` e a allowlist de código `APPROVED_REAL_PROJECT_IDS`; sob G-EXT, adicionar **somente** o project ID aprovado e revisar o diff. O app V2 é nomeado por projeto para não reutilizar um app V1/default.
6. Não configurar emulador no build de homologação. Emulador é apenas local e exige host loopback + projeto `demo-*`.

## 3. Worker/KV Free

1. Criar namespace KV Free isolado.
2. Copiar `apps/v2/cloudflare/wrangler.toml.example` para `wrangler.toml` **somente sob G-EXT**; preencher o ID do KV e a origem permitida.
3. Publicar `backup-worker.ts` como módulo Worker. O arquivo exporta `fetch` e usa `createGoogleJwksPort` por padrão (cache de 1 h, seleção por `kid`).
4. Bindings: `BACKUPS` (KV), `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGIN`; `JWKS` é opcional para testes, não necessário em produção.
5. Proibir R2, Blaze, TTL/PITR/backup gerenciado e qualquer plano pago.
6. O cliente envia `Authorization: Bearer <Firebase ID token>`; o Worker deriva o UID do token e nunca aceita UID de path/corpo.

## 4. URL de avaliação independente

1. Gerar `npm run build` em `apps/v2` após o preflight.
2. Publicar somente `dist/` em Cloudflare Pages Free (ou equivalente gratuito), com origem diferente da V1.
3. Confirmar HTTP read-back de `index.html`, manifest, SW e assets.
4. Confirmar que o Service Worker serve o precache gerado no build e que o cache é `estudo-organizado-v2-*`.
5. Não publicar URL antes de G-STAGING; não usar domínio, DNS ou cache da V1.

## 5. Critérios de teste real

### Auth/vínculo

- Login Google A; preview mostra perfil, UID, biblioteca e contagem; consentimento explícito.
- Troca para B sem logout: nenhuma leitura/escrita de A; preview de A não confirma em B.
- Logout interrompe flush, limpa autoridade remota e não apaga dados locais.

### Sync

- Commit local cria outbox; flush recebe ACK com prova remota; recarga mantém estado.
- Pull incremental aplica entidade no store e avança cursor atomicamente.
- Duas abas: um único efeito lógico; conflito preserva as duas versões.
- Timeout pós-commit: lookup/read-back antes de ACK; operação não é marcada confirmada sem prova.
- Exclusão remota não ressuscita; rebaseline não descarta outbox.

### Backup/restore

- Backup manual criptografado; read-back KV; versão só fica VERIFIED após prova.
- Backup >25 MiB falha fechado e mantém exportação local íntegra.
- Senha errada/arquivo adulterado falha; restore exige preview e consentimento.
- Restore aplica entidades, respeita tombstones e não reativa outbox antiga.
- Retenção de 7 versões verificadas; falha de poda não apaga a última cópia.

### PWA/isolamento

- Primeira visita seguida de offline funciona pelo precache.
- Update não aplica com sessão ativa, rascunho sujo, recovery pendente ou schema incompatível.
- V2 não toca IndexedDB, cache, SW, Firebase ou DNS da V1.

## 6. Matriz S01–S25 (mínimo de evidência)

| ID | Caso | Status exigido no piloto |
|---|---|---|
| S01 | PC → celular → tablet | autenticado, convergência observada |
| S02 | duas criações offline | sem perda, convergência |
| S03 | mesma entidade editada offline | conflito explícito, duas versões |
| S04 | exclusão remota + cliente antigo | tombstone/rebaseline, sem ressurreição |
| S05 | timeout pós-commit | lookup/read-back antes de ACK |
| S06 | duas abas, mesma outbox | um efeito lógico |
| S07 | troca de conta/UID | negação cruzada |
| S08 | payload >1 MiB | rejeição segura |
| S09 | reconexões 2/3 aparelhos | consumo medido |
| S10 | quota/Auth/offline | fila preservada, estado honesto |
| S11 | backup antigo + exclusão recente | rebaseline, sem ressurreição |
| S12 | schemas V1 12/11/9/7 | fixtures sintéticas; migração real bloqueada |
| S13 | SW com sessão/rascunho | update adiado |
| S14 | Clear Data V2 | V1 intocada |
| S15 | Rules hostis/UID inválido | acesso negado |
| S16 | backup/export/restore | read-back completo |
| S17 | cobertura V1/V2 | sem PASS fictício |
| S18 | IndexedDB removido | recuperação sem sobrescrever |
| S19 | KV Free/Worker/Auth | UID isolado, cifra, read-back |
| S20 | backup diário/retenção 7 | sem apagar a última cópia |
| S21 | senha/chave/arquivo inválido | falha fechada |
| S22 | URL V2 isolada | V1 intocada |
| S23 | backup >25 MiB | exportação local, sem truncar |
| S24 | todos os tipos F2–F6 | roundtrip/relações locais; serviços reais NOT_RUN |
| S25 | aparelhos disponíveis | PASS real ou NOT_RUN |

Estados permitidos: `PASS_REAL_ISOLATED`, `FAIL`, `NOT_RUN`, `INCONCLUSIVE`, `BLOCKED`. Nunca converter mock em PASS real.

## 7. Cotas gratuitas — reconferir antes do piloto

| Serviço | Referência em 09/11/2026 | Ação |
|---|---|---|
| Firestore Spark | 1 GiB; 50.000 reads/dia; 20.000 writes/dia; 20.000 deletes/dia; 10 GiB outbound/mês | medir por operação e pausar antes de 90% |
| Workers KV Free | 1 GiB; 25 MiB/valor; 1.000 writes/dia | falhar fechado acima de 25 MiB; contar writes |
| Cloudflare Pages Free | conforme plano vigente | conferir antes de publicar |

O orçamento local usa margem de 90%, janela de 24 h e persistência em `meta`. A contagem real só é válida com evidência do provedor.

## 8. Backup e rollback do piloto

- Antes de publicar: registrar SHA do build, URL, projeto, IDs sintéticos e hashes dos artefatos.
- Exportar um backup local antes de cada mudança de Rules/Worker.
- Rollback do Worker: publicar a versão anterior; não apagar o KV.
- Rollback do Firestore: manter Rules/índices versionados; nunca usar dados V1.
- Rollback da URL: despublicar a página de homologação; preservar o build e o commit local.
- Se houver cruzamento de UID, perda de dado, quota paga ou toque na V1: parar, preservar logs sanitizados e não continuar o piloto.

## 9. Critério de parada

- Qualquer leitura/escrita entre UIDs ou bibliotecas.
- Qualquer perda de dado, tombstone ressuscitado ou ACK sem prova.
- Qualquer billing/Blaze/R2 ou dado pessoal real.
- Qualquer alteração em `main`, origem V1, cache V1, DNS ou Firebase V1.
- Revisão independente aberta em Critical/Important material.

## 10. Comandos locais de preparação

```powershell
cd apps/v2
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:e2e
$env:JAVA_HOME='<jdk-21>'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
npx firebase emulators:exec --config firebase/firebase.json --project demo-estudo-v2 --only firestore,auth "npm run test:firebase"
```

Não usar projeto real, URL real ou credenciais neste passo.

## 11. Auditoria do checklist contra o código estabilizado

**Prontos para o piloto isolado:** projeto Spark separado e API key pública no contrato; Auth nomeado por projeto; Rules com tombstone, `changeId`, `getAfter`, igualdade change/entity/recibo e head monotônico; sync local de F2–F6; restore/backup com checksum/manifesto; bloqueio persistente de recovery e de operações posteriores a conflito; Worker imutável, delete da última cópia protegido, list paginado no contrato real do KV e JWKS padrão; listagem/download/descriptografia de versão remota com prévia de restore; PWA com precache/versionamento/presença de abas; retenção de sete versões com hidratação remota; orçamento local de sync.

**Pendentes de prova real ou de insumo:** Firebase/Cloudflare/Auth/Firestore/KV reais; concorrência multi-cliente em serviço real; medição de cotas; URL independente e HTTPS; dispositivos físicos; migração V1 com exportação/fixtures autorizadas; rebaseline com `historyFloor` completo; contagem remota real no consentimento; T26/T27 e aceite humano.

**Regra:** os itens “prontos” acima são `TESTED_LOCAL`, não `PASS_REAL_ISOLATED`. O piloto só pode marcá-los após G-EXT/G-STAGING e evidência do provedor.
