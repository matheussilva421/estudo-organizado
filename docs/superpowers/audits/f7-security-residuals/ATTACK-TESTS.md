# Testes adversariais — RED/GREEN

## RED inicial

| Cenário | Comando/arquivo | Resultado antes |
|---|---|---|
| R1 create isolado | `red-r1-r4.log` | esperado falhar, mas foi aceito |
| R1 update isolado | `red-r1-r4.log` | esperado falhar, mas foi aceito |
| R1 tombstone isolado | `red-r1-r4.log` | esperado falhar, mas foi aceito |
| R4 parent write | `red-r1-r4.log` | esperado falhar, mas foi aceito |
| R2 same operationId | `red-r2.log` | `PERMISSION_DENIED` no `Promise.all` |
| R3 unknown type | `red-r3-old-rules.log` | aceito contra as Rules de `066a9070` |

O RED foi executado no emulador contra o código/Rules anteriores; os logs foram preservados.

## GREEN

| Cenário | Resultado |
|---|---|
| R1 create/update/tombstone sem trilha | negados; read-back não mostra entidade, op, change ou head alterados |
| R1 full transaction | aceita; revision/epoch/change/head coerentes |
| R1 stale head | negado; `getAfter` de estado antigo não basta |
| R1 change órfão sem entity write | negado; feed não avança sem mutação de entidade |
| R2 mesmo ID/mesmo payload | 1 `APPLIED` + 1 `ALREADY_APPLIED`; revision 1; um receipt/change/head |
| R2 mesmo ID/payload divergente | 1 `APPLIED` + 1 rejeição de mismatch; sem double apply |
| R2 IDs distintos/mesma entidade | 1 `APPLIED` + 1 `CONFLICT`; revision 1 |
| R2 concorrência após tombstone | 1 `APPLIED` + 1 `CONFLICT`; revision 3; head 3 |
| R2 retry após recuperação | repetir o mesmo ID retorna `ALREADY_APPLIED` |
| R3 tipo desconhecido | negado; tipo conhecido aceito; allowlist das Rules cobre os 17 tipos |
| R4 pai | create/update/delete negados; owner lê; outro UID não lê |

## Payloads sintéticos

Uid `uid-a`, library `library-a`, entidade `edital-1`, profile `profile-a`, epoch 1, revision 1/2/3 e operationIds `op-1`, `op-2`, `op-a`, `op-b`, `op-del`. Nenhum dado acadêmico real.
