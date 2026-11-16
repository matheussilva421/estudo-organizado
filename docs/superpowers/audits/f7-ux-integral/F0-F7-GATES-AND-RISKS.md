# Gates e riscos F0–F7

## Riscos HIGH F0

| ID | Situação | Mitigação/evidência | Impacto na V2 |
|---|---|---|---|
| R-V1-LEGACY-REMOTE-PLAN | UNVERIFIED | importação/portabilidade F3 com preview; nenhum plano remoto real adotado | sync real bloqueado |
| R-V1-FIRESTORE-DOCUMENT-1MIB | UNVERIFIED | limites/particionamento em F7 fake; documento real não testado | G-EXT |
| R-V1-MULTITAB-OUTBOX-RACE | UNVERIFIED | testes de duas abas F2/F4/F5/F6; outbox real não exercitada | G-EXT |
| R-V1-BACKUP-TOMBSTONE-LOSS | UNVERIFIED | preview/SAFE/INVALID e tombstone em testes de backup | restauração real bloqueada |

## Ressalvas históricas

| Item | Estado |
|---|---|
| F2-T22 (importação/associações) | coberto por testes de importação/atomicidade; histórico preservado |
| F3 aviso de prova vencida | não implementado como alerta automático; planejamento exibe datas |
| F4-T13 | NOT_RUN_ENVIRONMENT |
| F4 INCOMING parcial | documentado; conciliação preservada |
| F6 AC24 | diferido para F7 |
| F7 Auth/Firestore/Rules/convergência/quota | BLOCKED_EXTERNAL (G-EXT) |
| F7 staging/PWA em URL própria | BLOCKED_EXTERNAL (G-STAGING) |
| F8/G5 cutover | não iniciado |
| F-V1-VISUAL-LAYOUT-LAB | BLOCKED_NEW_APPROVAL |

## Gates humanos

- UX-H: HUMAN_PENDING.
- Push/integração de origin/v2: REMOTE_PUSH_NOT_AUTHORIZED.
- Main/V1: MAIN_UNCHANGED.
- Serviços reais, staging, deploy e F8: não autorizados.
