# Task 12 report - protocolo remoto e barreira de compatibilidade

Base: `98b639e` (`codex/reta-final-editor-fase-a`). Worktree:
`C:/Users/slvma/.codex/worktrees/reta-final-fase-a/estudo-organizado`.

## Resultado

A Reta Final v2 agora tem descritor versionado no envelope `version: 1`, CAS de
revisao nas regras Firestore e uma sonda de deploy obrigatoria antes de qualquer
escrita. O cliente legado nao consegue sobrescrever um documento que ja possui
`retaFinalSync`; a prova foi executada nas regras antigas e novas com o harness
oficial e um emulador local.

O envelope continua `version: 1` e `FIRESTORE_SYNC_VERSION` nao foi alterado.

## Arquivos alterados

- `src/js/sync/reta-final-protocol.js` (novo): capabilities, plano ativo,
  digest canonico, descritor `active`/`retired`, validacao de escrita remota,
  classificacao de erros e refresh de base.
- `src/js/sync/firestore-schema.js`: `createFirestoreSnapshotEnvelope` aceita
  `options.retaFinalSync` sem mudar a versao do envelope.
- `src/js/sync/firestore-repository.js`: sonda `syncMeta/reta-final-guard`
  (write + read-back) e leitura/escrita existentes preservadas.
- `src/js/sync/firestore-sync-engine.js`: fila com descritor, sonda obrigatoria,
  CAS remoto, conflito `reta-final-conflict`, base local, merge de tres versoes
  nos pulls, aposentadoria, lineage-change e bloqueio de `forceOverwrite` no v2.
- `src/js/sync/sync-coordinator.js`: `reta-final-conflict` e bloqueante;
  `blocked-guard` nao vira `synced`.
- `src/js/sync/entity-migration.js`: aborta com relatorio quando encontra v2 ou
  descritor no snapshot/mescla.
- `firestore.rules`: descritor, allowlist, CAS/replay/adoption/retirement e
  `syncMeta/reta-final-guard`; delete fisico continua negado.
- `docs/api/sync-contract.md`: contrato v2, sonda, retirement e recuperacao de
  dados locais limpos.
- `tests/unit/reta-final-protocol.test.js` (novo).
- `tests/unit/reta-final-sync-engine.test.js` (novo).
- `tests/unit/firestore-schema.test.js`.
- `tests/unit/firestore-contracts.test.js`.
- `tests/unit/sync-coordinator.test.js`.
- `scripts/verify-reta-final-rules.mjs` (novo).
- `src/sw.js`: precache do novo modulo; o hook de commit pode fazer o bump de
  cache esperado.

## TDD

RED inicial, antes da implementacao:

```text
npx vitest run tests/unit/reta-final-protocol.test.js tests/unit/reta-final-sync-engine.test.js tests/unit/firestore-schema.test.js tests/unit/firestore-contracts.test.js tests/unit/sync-coordinator.test.js --reporter=dot
Test Files  5 failed (5)
Tests       7 failed | 76 passed (83)
```

A falha esperada foi `Failed to resolve import .../reta-final-protocol.js` nas
duas suites novas, alem das assercoes de descriptor/CAS/sonda/coordinator.

GREEN focado final:

```text
npx vitest run tests/unit/reta-final-protocol.test.js tests/unit/reta-final-sync-engine.test.js --reporter=verbose
Test Files  2 passed (2)
Tests       47 passed (47)
```

Foco + contratos no mesmo lote:

```text
npx vitest run tests/unit/reta-final-protocol.test.js tests/unit/reta-final-sync-engine.test.js tests/unit/firestore-schema.test.js tests/unit/firestore-contracts.test.js tests/unit/sync-coordinator.test.js --reporter=dot
Test Files  5 passed (5)
Tests       130 passed (130)
```

Regressões de sync:

```text
npm run test:sync -- --reporter=dot
Test Files  21 passed (21)
Tests       347 passed (347)
```

Suíte completa:

```text
npm test -- --reporter=dot
Test Files  164 passed (164)
Tests       2725 passed (2725)
Duration    68.91s
exit        0
```

## Prova das regras no emulador

O verificador nao inicia nem encerra emulador. Ele usa o emulador ja em execucao
em `127.0.0.1:8090` e o harness oficial instalado localmente, sem alterar
`package.json`:

```text
npm install --no-save @firebase/rules-unit-testing@5.0.0
node scripts/verify-reta-final-rules.mjs --rules firestore.rules --host 127.0.0.1 --port 8090
```

Resultado com as regras novas (`demo-reta-final-new`):

```text
PASS minimal legacy snapshot: allowed
PASS baseline legacy create: allowed
PASS legacy overwrite over v2: denied (barrier holds)
PASS v2 create with baseRevision 0: allowed
PASS v2 advance with correct base: allowed
PASS v2 stale base after another write: permission-denied
PASS v2 identical replay: allowed
PASS v2 same revision different digest: permission-denied
PASS v2 rollback: permission-denied
PASS v2 planId change: permission-denied
PASS v2 generation change: permission-denied
PASS v2 adoption with matching payloadUpdatedAt: allowed
PASS v2 adoption with divergent payloadUpdatedAt: permission-denied
PASS v2 retirement advance: allowed
PASS v2 retired resurrection: permission-denied
PASS v2 retired create: permission-denied
PASS guard create by owner: allowed
PASS guard denied to another uid: permission-denied
PASS guard delete denied: permission-denied
PASS intruder cannot overwrite snapshot: permission-denied
RULES_MODE=new TARGET=127.0.0.1:8090
RESULT PASS (20/20)
```

Regras antigas, obtidas com `git show HEAD:firestore.rules` em um arquivo
temporario removido depois da execucao (`demo-reta-final-legacy`):

```text
PASS minimal legacy snapshot: allowed
PASS baseline legacy create: allowed
PASS legacy overwrite over v2: ALLOWED (vulnerability reproduced)
PASS guard probe denied by legacy rules: permission-denied
PASS intruder cannot write another uid snapshot: permission-denied
RULES_MODE=legacy TARGET=127.0.0.1:8090
RESULT PASS (5/5)
```

Isso demonstra a vulnerabilidade antiga e a barreira nova no mesmo emulador,
com projectIds separados. A escrita legada que deveria ser negada recebe
`permission-denied` no modo novo; ela nao recebe sucesso.

## Comportamento de recuperacao

- Documento remoto v2 + dados locais limpos: a escrita sem descritor e negada
  de proposito. A recuperacao e puxar o remoto ou fazer um reset explicito fora
  deste contrato; nao existe bypass no cliente.
- `forceOverwrite` nao fura o CAS v2. Ele continua valendo para envelopes legados
  e recuperacao manual, mas um descritor exige a revisao remota exata como base.
- `permission-denied`, `aborted`, `failed-precondition` e 409 viram conflito,
  nunca sucesso; o outbox permanece pendente.
- A base local (`config.firestoreSync.basePlan`, `baseRevision`, `baseDigest`,
  `baseRemoteUpdatedAt`) e gravada antes de `markFirestoreSnapshotSynced` e
  `lastPushAt`.

## Limitacoes e residuos honestos

- As regras foram provadas no emulador local; nao foram publicadas no Firestore
  real. Nenhum deploy, push ou merge foi feito.
- O harness depende de `@firebase/rules-unit-testing@5.0.0` instalado localmente
  com `--no-save`; se o pacote ou o emulador faltarem, o script sai com codigo 2
  e `NOT_RUN`, nunca `PASS`.
- O emulador registra `evaluation error ... for 'update'` ao avaliar tentativas
  de create; a regra de create continua autorizando o caso valido e todas as
  negativas continuam negadas. O erro e fail-closed e nao amplia acesso, mas
  fica registrado como residuo de limpeza das regras.
- Nao houve teste E2E multi-dispositivo nem prova de deploy real. A prova e de
  regras + cliente/engine com mocks e emulador.
- O teste de regras antigas usa um arquivo temporario com o conteudo de HEAD; o
  arquivo foi removido e nao faz parte do commit.

## Comandos executados

```text
npx vitest run tests/unit/reta-final-protocol.test.js tests/unit/reta-final-sync-engine.test.js --reporter=verbose
npx vitest run tests/unit/firestore-schema.test.js tests/unit/firestore-contracts.test.js tests/unit/sync-coordinator.test.js tests/unit/firestore-outbox.test.js tests/unit/poll-firestore-remote.test.js --reporter=dot
npx vitest run tests/unit/firestore-sync-engine-new.test.js tests/unit/firestore-sync-engine-simple.test.js tests/unit/sync-center.test.js tests/unit/store-reta-final-sync.test.js tests/unit/firestore-sign-in-cancel.test.js tests/unit/sync-coordinator-simple.test.js tests/unit/sync-conflict-fix.test.js --reporter=dot
npm run test:sync -- --reporter=dot
npm test -- --reporter=dot
node scripts/verify-reta-final-rules.mjs --rules firestore.rules --host 127.0.0.1 --port 8090
node scripts/verify-reta-final-rules.mjs --rules .tmp-old-rules.rules --host 127.0.0.1 --port 8090
```

Status final: implementacao local concluida, sem push. Commit pendente no
momento da escrita deste relatorio.
