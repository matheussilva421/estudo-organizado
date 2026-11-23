# T6 - Worker unico, realtime e recuperacao automatica

Data: 2026-11-23

## Resultado

IMPLEMENTED e TESTED no escopo focado. A flag V1 permanece desligada por padrao e o caminho legado continua ativo quando nao existe contexto V1.

## Entregas

- `src/js/sync/v1-next/worker.js`: `startV1Sync`, `stopV1Sync` e `drainPendingOperations` com contexto unico, single-flight, debounce, listeners de `stateSaved`, `online`, `focus` e visibilidade, drain inicial, retry duravel e backoff.
- O drain mantem o Web Lock durante toda a varredura. Um follower nao chama `applyRemoteOperation` nem ACK; quando Web Locks nao existe, usa lease atomico em IndexedDB com TTL, renovacao e release.
- Deltas remotos passam por `reconcileRemoteDelta`, atualizam o cache e a UI por `setState`, e nao criam outbox nem enviam eco remoto.
- Conflitos sao isolados por operacao/entidade, persistidos no conflict store e removidos apenas da listagem ativa, preservando a operacao na outbox para o merge do T7.
- `local.js` ganhou metadados de retry/conflito e lease de worker sem alterar as interfaces existentes.
- `sync-coordinator.js` roteia flush manual/agendado para o worker quando o contexto V1 esta ativo e evita snapshot/auto-pull/outbox legado.
- `app.js` inicia o worker somente depois de um bootstrap V1 `ready`; sem contexto V1, continua chamando `initFirestoreSync`.

## Integracao T5/T6

- O adaptador remoto de producao aceita manifesto `verified` ou `active` e continua rejeitando `staging`, `retired` e outros estados.
- O bootstrap devolve UID e a API remota injetada quando a geracao esta pronta, permitindo que o worker de producao e o harness usem o mesmo contrato.
- O cache online verificado inicia `subscribeGeneration` automaticamente no worker. O E2E comprova aplicacao de delta remoto na UI e no cache apos `ready`, inclusive apos reload usando cache verificado, sem fetch do baseline e sem escrita de outbox.
- Um registro removido comum nao revoga a geracao; a validacao continua baseada no manifesto/controle.

## TDD e correcoes de regressao

- RED inicial: E2E usava `encodeRecordData` do modulo errado e o segundo cenario nao iniciava o listener a partir do cache verificado.
- RED de concorrencia: o follower chamava `applyRemoteOperation` enquanto a varredura exclusiva estava em andamento.
- GREEN: harness importa `encodeRecordData` de `contracts.js`; `app.js` inicia o worker no contexto V1; Web Lock ocupado retorna `queued` sem fallback e sem envio.

## Testes

| Validacao | Resultado |
| --- | --- |
| `tests/unit/v1-next-worker.test.js` | PASS - 9/9 |
| Suite focada de integracao (7 arquivos) | PASS - 198/198 |
| `npm run test:e2e:release -- tests/e2e/v1-next-sync.spec.js` | PASS - 2/2 Chromium |
| ESLint focado dos arquivos T6 | PASS - sem erros/avisos |
| `git diff --check` | PASS |
| `npm test` | FAIL preexistente - 3117 PASS, 18 FAIL |

As falhas da suite completa ficaram em testes legados nao alterados: 16 por isolamento de `IndexedDB unavailable` em `firestore-sync-engine-new`, `store`, `sync` e `sync-simulation-contracts`, e 1 por raio `16px` ja presente em `app.js` no HEAD. A suite completa nao foi declarada verde.

## Preocupacoes e limites

- O merge assistido de conflitos permanece no T7; T6 apenas suspende e preserva a operacao conflitante.
- O E2E usa uma API remota sintetica injetada no browser. Ele valida o contrato, listener, cache e UI, mas nao substitui um teste contra Firestore real.
- Nao houve push, deploy, backup, V2 ou subagentes.
