# Matriz R1–R4

| ID | Vulnerabilidade/condição | Severidade | Contrato | Antes | Depois | Evidência |
|---|---|---|---|---|---|---|
| R1 | Entidade criada/atualizada sem operation/change/head no mesmo batch | P1 de integridade/auditabilidade | `entity → operation → change → head` na mesma transação | aceita para create, update e tombstone isolados | negada; full transaction verde; stale head e change órfão negados | `red-r1-r4.log`, `firebase-green-6.log`, `r1_denies_orphan_change_without_entity_write`, 5 ciclos finais |
| R2 | Mesmo operationId em dois writers concorrentes | P1 de idempotência/disponibilidade | um receipt, uma revisão, um change, nenhum ACK falso | podia retornar `PERMISSION_DENIED` ao perdedor | um `APPLIED` e um `ALREADY_APPLIED`; divergência rejeitada; IDs distintos geram `CONFLICT` | `red-r2.log`, `firebase-final3-stability-1..5.log` |
| R3 | entityType arbitrário na criação e no envelope | P2 de consistência/feed | allowlist fechada e imutável | qualquer string 1–80 aceita | 17 tipos conhecidos; desconhecido negado; cliente e Rules alinhados | `red-r3-old-rules.log`, testes R3, `f7-remote-schema` |
| R4 | Documento pai da biblioteca gravável | P3 de superfície | pai não usado pelo produto; leitura do owner | qualquer payload do owner | create/update/delete negados; owner lê; outro UID não | testes R4 |
| R5 | Entidade legada sem `meta/head` podia atualizar e iniciar nova cadeia; head 0 permitia contorno | P2 de integridade | update deve continuar de head causal, e head inicial exige change na sequência 1 | nova sequência 1 era aceita; head 0 criava bypass | update sem head é negado; head 0 é negado; create inicial na sequência 1 continua válido | RED/GREEN; 37/37 no Emulator |

## Residuais externos

- G-EXT: quotas, billing, Auth real, multi-dispositivo e Rules publicadas.
- A concorrência distribuída real não é homologada pelo emulador.
- Nenhum dado legado real foi migrado.
