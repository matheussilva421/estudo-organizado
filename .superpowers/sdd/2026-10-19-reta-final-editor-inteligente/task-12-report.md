# Task 12 report - protocolo remoto e barreira de compatibilidade

Base original: `98b639e`. Worktree:
`C:/Users/slvma/.codex/worktrees/reta-final-fase-a/estudo-organizado`.

## Resultado

A Reta Final v2 tem descritor versionado no envelope `version: 1`, CAS de
revisao e validacao de payload nas regras Firestore, sonda de deploy obrigatoria
e merge sem instalacao automatica de plano oficial. O cliente legado nao
sobrescreve um documento com `retaFinalSync`; replay so e aceito com payload e
`payloadUpdatedAt` identicos.

O envelope continua `version: 1` e `FIRESTORE_SYNC_VERSION` nao foi alterado.

## Correcoes da revisao independente

1. Replay agora exige `revision`, `digest`, `state`, `payload` e
   `payloadUpdatedAt` iguais. `validRetaFinalPayloadState()` exige plano ativo no
   payload para descriptor `active` e impede plano ativo para `retired`.
2. Merge filtra `removedBlockIds` do `proposedPlan` e recusa `stale-base` quando
   `base.revision < minRetainedRevision`.
3. Pull/merge v2 preserva outbox pendente: retorna `pending-outbox` e nunca
   chama `markFirestoreSnapshotSynced` nesse caminho.
4. Merge nao instala plano oficial. `digest(local) == digest(base)` faz
   fast-forward remoto; `digest(local) == digest(remote)` e no-op; o resto abre
   `merge-review` com `proposedPlan`, `basePlan`, `localPlan` e `remotePlan`.
   A fila nao reescreve `state.planejamento` nem a revision oficial.
5. Entity migration bloqueia qualquer `reta_final` v2, ativo ou aposentado, com
   ou sem descriptor.
6. Precache inclui o protocolo e os modulos de merge/comandos/catalogo/eventos/
   historico/prioridade/redistribuicao/commit/stores/sync e entity-migration.

## Segunda re-revisao

1. Regras exigem que o plano do payload pertenca ao descriptor: `active` exige
   `planejamento.planId == descriptor.planId`; `retired` aceita ausencia/null ou
   plano inativo com o mesmo `planId`. O engine recusa `lineage-payload` antes
   de enfileirar/enviar.
2. Force pull e keep-remote exigem `discardPending: true`; sem a flag devolvem
   `pending-outbox` e preservam a fila. As acoes confirmadas de UI passam a flag.
   `markFirestoreSnapshotSynced` e identidade-checked por `queuedAt`/`sentAt`, e
   uma gravacao enfileirada durante o pull sobrevive.
3. A fila deriva tombstones locais `{id, revision}` em
   `config.firestoreSync.removedBlocks` (max 200), envia `removedBlockIds` e
   `minRetainedRevision`, incorpora tombstones remotos no pull e bloqueia push
   abaixo do piso com `stale-base`.
4. No-op manual em pull/merge/syncNow emite `synced` quando os digests locais e
   remotos coincidem, ou `idle` caso contrario; nao fica preso em `syncing`.

## Terceira re-revisao

1. Replay exige o descriptor inteiro identico (`retaFinalSync` map equality),
   alem de payload e `payloadUpdatedAt` iguais. Reduzir `removedBlockIds` num
   replay e negado.
2. Avanco e tombstone append-only: `minRetainedRevision` nao pode diminuir e
   `removedBlockIds` novo precisa conter todos os ids antigos. O cliente mantem
   tombstones mesmo quando o bloco reaparece no plano (restauracao preserva a
   linhagem), sem remover entradas antigas.
3. `pullFromFirestore(forceOverwrite)` checa pending antes dos ramos v2/legado.
   Sem `discardPending`, devolve `pending-outbox` e nao altera estado. Com a flag,
   limpa a outbox pela identidade capturada, inclusive no caminho legado.
4. Force pull v2 no-op com `discardPending` limpa a outbox pela identidade e so
   entao emite `synced`; sem a flag, preserva e nao emite synced.
5. O teste de corrida da outbox usa o helper de transacao em memoria
   (get/compare/delete) com uma nova gravacao intercalada. Nao e IndexedDB
   nativo multiaba; isso permanece como limitacao NOT_RUN para E2E real.

## Quarta re-revisao

1. Compactacao segura no limite de 200: ao entrar o 201o tombstone, os mais
   antigos saem e `minRetainedRevision` sobe para
   `max(atual, config.baseRevision, base.revision)`. O avanco e aceito pela
   excecao de compactacao somente quando o novo piso alcanca a revision remota
   anterior; dispositivos com base abaixo do piso viram `stale-base`.
2. `validateRetaFinalEnvelopeWrite` aplica a mesma excecao no cliente: reduzir
   `removedBlockIds` so e permitido se o novo piso for >= a revision remota e
   >= piso anterior.
3. O teste de corrida foi ajustado para a sequencia real: ler pending A,
   enfileirar B, marcar com a identidade de A; B sobrevive. A transacao e o
   helper em memoria, nao IndexedDB nativo multiaba.

## Arquivos alterados

- `src/js/sync/reta-final-protocol.js` (novo): capabilities, digest canonico,
  descriptor `active`/`retired`, `minRetainedRevision`, `removedBlockIds`,
  validacao de replay por payload e classificacao de erros.
- `src/js/sync/firestore-schema.js`: descritor opcional no envelope v1.
- `src/js/sync/firestore-repository.js`: sonda `syncMeta/reta-final-guard`.
- `src/js/sync/firestore-sync-engine.js`: fila, CAS, sonda, fast-forward,
  `merge-review`, `pending-outbox`, aposentadoria e lineage-change.
- `src/js/sync/sync-coordinator.js`: `reta-final-conflict` bloqueante.
- `src/js/sync/entity-migration.js`: bloqueio de v2 ativo/aposentado.
- `firestore.rules`: descriptor, payload state, replay integral e guard.
- `docs/api/sync-contract.md`: contrato v2, merge revisavel e outbox.
- `tests/unit/reta-final-protocol.test.js` (novo).
- `tests/unit/reta-final-sync-engine.test.js` (novo).
- `tests/unit/firestore-schema.test.js`.
- `tests/unit/firestore-contracts.test.js`.
- `tests/unit/sync-coordinator.test.js`.
- `tests/unit/firestore-outbox.test.js`.
- `tests/unit/config-view.test.js`.
- `scripts/verify-reta-final-rules.mjs` (novo).
- `src/sw.js`: precache e bump de cache do hook.
- `src/js/ui/actions/config.js`, `src/js/views/config/data-management.js` e
  `src/js/views/config/sync-dialogs.js`: `discardPending: true` nos fluxos
  confirmados de restauracao/keep-remote.

## TDD

RED inicial: 5 arquivos falharam, 7 testes falharam e 76 passaram; as suites
novas falhavam por `reta-final-protocol.js` ausente.

GREEN focado final:

```text
npx vitest run tests/unit/reta-final-protocol.test.js tests/unit/reta-final-sync-engine.test.js tests/unit/firestore-schema.test.js tests/unit/firestore-contracts.test.js tests/unit/sync-coordinator.test.js tests/unit/firestore-outbox.test.js tests/unit/config-view.test.js --reporter=dot
Test Files  7 passed (7)
Tests       185 passed (185)
```

Regressões de sync:

```text
npm run test:sync -- --reporter=dot
Test Files  21 passed (21)
Tests       348 passed (348)
```

Suíte completa:

```text
npm test -- --reporter=dot
Test Files  164 passed (164)
Tests       2744 passed (2744)
Duration    68.07s
exit        0
```

## Prova das regras no emulador

O verificador nao inicia nem encerra emulador. Usa o emulador em
`127.0.0.1:8090` e o harness oficial instalado localmente, sem alterar
`package.json`:

```text
npm install --no-save @firebase/rules-unit-testing@5.0.0
node scripts/verify-reta-final-rules.mjs --rules firestore.rules --host 127.0.0.1 --port 8090
```

Resultado novo (`demo-reta-final-new`):

```text
PASS legacy overwrite over v2: denied (barrier holds)
PASS v2 create with baseRevision 0: allowed
PASS v2 advance with correct base: allowed
PASS v2 stale base after another write: permission-denied
PASS v2 identical replay: allowed
PASS v2 same revision different digest: permission-denied
PASS v2 replay with changed payload: permission-denied
PASS replay with reduced removedBlockIds: permission-denied
PASS v2 rollback: permission-denied
PASS v2 planId change: permission-denied
PASS v2 generation change: permission-denied
PASS advance reducing minRetainedRevision: permission-denied
PASS advance reducing removedBlockIds: permission-denied
PASS advance adding a tombstone: allowed
PASS tombstone compaction raises floor to remote head: allowed
PASS tombstone compaction with floor below remote head: permission-denied
PASS replay with reordered removedBlockIds: permission-denied
PASS active payload with different planId: permission-denied
PASS retired payload with different planId: permission-denied
PASS v2 adoption with matching payloadUpdatedAt: allowed
PASS v2 adoption with divergent payloadUpdatedAt: permission-denied
PASS v2 retirement advance: allowed
PASS v2 retired resurrection: permission-denied
PASS v2 retired create: permission-denied
PASS retired payload with active plan: permission-denied
PASS active descriptor without active plan: permission-denied
PASS active descriptor with retired payload: permission-denied
PASS retired descriptor with absent plan: allowed
PASS guard create by owner: allowed
PASS guard denied to another uid: permission-denied
PASS guard delete denied: permission-denied
PASS intruder cannot overwrite snapshot: permission-denied
RULES_MODE=new TARGET=127.0.0.1:8090
RESULT PASS (34/34)
```

Regras antigas (`98b639e:firestore.rules`, arquivo temporario removido):

```text
PASS legacy overwrite over v2: ALLOWED (vulnerability reproduced)
PASS guard probe denied by legacy rules: permission-denied
PASS intruder cannot write another uid snapshot: permission-denied
RULES_MODE=legacy TARGET=127.0.0.1:8090
RESULT PASS (5/5)
```

## Semantica de merge e outbox

- Pull nao aplica plano mesclado. Fast-forward so ocorre quando o local ainda e
  igual a base; caso contrario o conflito `merge-review` leva `proposedPlan`
  filtrado para a Task 13 decidir via draft/checkpoint/commit.
- `digest(local) == digest(remote)` e no-op: nao altera state, base, outbox nem
  status synced.
- Outbox pendente bloqueia pull/merge com `pending-outbox`; o pendente e
  preservado e nunca marcado como synced.
- `forceOverwrite` nao fura CAS v2; `permission-denied`, 409 e
  `failed-precondition` viram conflito.
- Aposentadoria usa descriptor `retired` com revision de linhagem, sem mutar a
  revision oficial do plano no payload.

## Limitacoes e residuos honestos

- Regras provadas apenas no emulador; nada publicado no Firestore real.
- Sem teste E2E multi-dispositivo nem deploy real.
- O harness depende de `@firebase/rules-unit-testing@5.0.0` com `--no-save`; se
  faltar pacote ou emulador, o script retorna `NOT_RUN` (exit 2), nunca PASS.
- O emulador registra `evaluation error ... for 'update'` ao avaliar creates. A
  regra de create continua autorizando o caso valido e todas as negativas
  continuam negadas; e fail-closed, mas fica como residuo de limpeza.
- Nenhum push, merge ou deploy foi realizado.

## Comandos executados

```text
npx vitest run tests/unit/reta-final-protocol.test.js tests/unit/reta-final-sync-engine.test.js tests/unit/firestore-schema.test.js tests/unit/firestore-contracts.test.js tests/unit/sync-coordinator.test.js tests/unit/firestore-outbox.test.js tests/unit/config-view.test.js --reporter=dot
npm run test:sync -- --reporter=dot
npm test -- --reporter=dot
node scripts/verify-reta-final-rules.mjs --rules firestore.rules --host 127.0.0.1 --port 8090
node scripts/verify-reta-final-rules.mjs --rules .tmp-old-rules.rules --host 127.0.0.1 --port 8090
```

Status final: correcoes locais concluidas, sem push. Commit final informado na
resposta do agente.
