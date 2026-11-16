# Resultados no Firebase Emulator

HEAD de código `6c0353bb7da20338518b36427416343ba23f1835`.

| Arquivo | Casos | Resultado |
|---|---|---|
| `tests/firebase/f7-firestore-rules.test.ts` | 15 | PASS |
| `tests/firebase/f7-remote-transaction.test.ts` | 2 | PASS |
| **Total** | **17** | **17 PASS, 0 FAIL, 0 SKIP** |

Duração do Vitest: 5,57 s. Exit code do script: 0. Emuladores encerrados ao final. Log final: `fbt-emulator-final6.log`.

## Cobertura real

- Negação sem auth, UID diferente, schema 0, schema futuro 99, tombstone com payload, revisão/escopo forjados, change/head incoerentes.
- Revisão de entidade monotônica: regressão e salto são negados; criação exige revisão 1.
- Entity, change, head e receipt precisam coincidir em entityId, revisão, tombstone, epoch e sequência; change sem entidade ou sem receipt é negado.
- Epoch do change divergente da entidade é negado.
- Transação autorizada com entity, change, head e receipt na mesma transação.
- Idempotência sequencial do mesmo `operationId` e delete com tombstone.
- Rules carregadas de `apps/v2/firebase/firestore.rules`; o teste de schema futuro foi adicionado nesta rodada e passa.

## Limite

`authenticatedContext` simula identidade para Rules; não é login real no Auth Emulator. O teste de retry é sequencial, não uma corrida concorrente real. Não há prova de quotas, billing, multi-dispositivo ou backend real.
