# Quatro riscos HIGH F0 — mitigação local

| Risco | Cenários/testes locais | Resultado local | Residual externo |
|---|---|---|---|
| R-V1-LEGACY-REMOTE-PLAN | `f7-remote-schema`: schema futuro rejeitado pelo `validateRemoteEnvelope` usado em `change-feed` e `rebaseline`; `f3-import`: V1 sem versão aceito só com preview e payload hostil rejeitado; `legacy-recognition`: helpers de quarentena (não chamados pelo runtime) | PASS_LOCAL_MITIGATION | adoção real não testada; helpers `v1-adapter` não integrados (P2) |
| R-V1-FIRESTORE-DOCUMENT-1MIB | `remote-budget` (4): oversize rejeitado sem truncar, multibyte, orçamento; `f7-sync-budget` (5): quota mantém outbox, sem falso garantido | PASS_LOCAL_MITIGATION | limites/quotas reais exigem G-EXT |
| R-V1-MULTITAB-OUTBOX-RACE | `outbox-flush` (7): ACK futuro/ausente rejeitado, retry idempotente, conflito preservado; `f7-real-outbox` (2 E2E com Web Locks); `f7-two-tabs` | PASS_LOCAL_MITIGATION | concorrência distribuída real não testada |
| R-V1-BACKUP-TOMBSTONE-LOSS | `f7-restore` (15): epoch antigo não ressuscita, checksum, rebaseline, idempotência; `restore-preview` (12); `f2-delete` (7) | PASS_LOCAL_MITIGATION | restauração produtiva não executada |

## Método

Os cenários adversariais foram reexecutados: 60 testes unitários em 9 arquivos e 5 casos E2E direcionados. Nenhum RED novo permaneceu; o caso de schema remoto futuro foi adicionado e passa.

## Limite

`PASS_LOCAL_MITIGATION` não é `PASS_REAL_SERVICE`. Os quatro riscos permanecem `UNVERIFIED_REAL_SERVICE` até G-EXT.
