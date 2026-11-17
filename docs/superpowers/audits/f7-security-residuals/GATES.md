# Gates mantidos

| Gate | Estado | Observação |
|---|---|---|
| F7_EXTERNAL_PENDING | pendente | Firebase/Auth/Firestore/Rules reais, quotas, billing e multi-dispositivo |
| UX_HUMAN_PENDING | pendente | decisão humana; não emitida nesta rodada |
| REMOTE_PUSH_NOT_AUTHORIZED | mantido | nenhum push/PR/merge |
| MAIN_UNCHANGED | mantido | `main` e `origin/main` em `9046cfa` |
| G-STAGING | pendente | nenhum staging |
| F8/G5 | não iniciado | cutover fora do escopo |
| F4-T13 | NOT_RUN_ENVIRONMENT | suspensão física do sistema não executada |
| A11y manual | NOT_RUN_ENVIRONMENT | NVDA/Narrator, toque, hardware e zoom nativo |
| Restauração produtiva | pendente | backup real/offsite não testado |

O emulador local não homologa concorrência distribuída, quotas, Auth real ou produção.
