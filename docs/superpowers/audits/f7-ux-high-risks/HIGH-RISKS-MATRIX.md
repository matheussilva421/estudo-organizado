# Quatro riscos HIGH F0 — mitigação local

| Risco | Cenários/testes locais | Resultado local | Residual externo |
|---|---|---|---|
| R-V1-LEGACY-REMOTE-PLAN | `f7-remote-schema`: schema futuro rejeitado pelo `validateRemoteEnvelope` usado em `change-feed` e `rebaseline`; `f7_rules_deny_future_schema_version`: schema 99 negado pelas Rules no emulador; `f3-import`: V1 sem versão aceito só com preview e payload hostil rejeitado | PASS_LOCAL_FAIL_CLOSED / MIGRAÇÃO_NÃO_INTEGRADA | adoção real não testada; helpers `v1-adapter` sem caller de produto (P2) |
| R-V1-FIRESTORE-DOCUMENT-1MIB | `remote-budget` (4): oversize rejeitado sem truncar, multibyte e orçamento; `f7-sync-budget` (5): avaliação de orçamento e `PAUSE` | PASS_LOCAL_MITIGATION | a garantia de outbox sob quota não é diretamente provada por esse teste; limites reais exigem G-EXT |
| R-V1-MULTITAB-OUTBOX-RACE | `outbox-flush` (7): ACK futuro/ausente rejeitado, retry idempotente, conflito preservado; `f7-real-outbox` (2 E2E com Web Locks); `f7-two-tabs` | PASS_LOCAL_MITIGATION | concorrência distribuída real não testada |
| R-V1-BACKUP-TOMBSTONE-LOSS | `f7-restore` (15): epoch antigo não ressuscita, checksum, rebaseline, idempotência; `restore-preview` (12); `f2-delete` (7) | PASS_LOCAL_MITIGATION | restauração produtiva não executada |

## Método

Os cenários adversariais foram reexecutados: 78 testes unitários em 10 arquivos, 5 casos E2E direcionados e 17 testes no Firestore/Auth Emulator. O caso de schema remoto futuro foi adicionado e passa nas Rules e no runtime. A revisão de segurança desta rodada também adicionou monotonicidade de revisão e binding entity/change/head/receipt.

## Limite

`PASS_LOCAL_MITIGATION` e emulador local não são `PASS_REAL_SERVICE`. Os quatro riscos permanecem `UNVERIFIED_REAL_SERVICE` até G-EXT.
