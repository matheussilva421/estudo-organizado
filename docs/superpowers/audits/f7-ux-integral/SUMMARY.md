# Auditoria integral do Estudo Organizado V2

**Código:** `bdebbcd0d8e76578dedef20e9efa2466623d0c3e` (branch `v2`).
**Status:** `LOCAL_V2_PARTIAL_WITH_EVIDENCE` / `UX_HUMAN_PENDING` / `REMOTE_PUSH_NOT_AUTHORIZED`.

## Escopo

Auditoria das oito abas, Shell/Busca, F0–F7 local, F7-UX e Redesign Premium, com dados sintéticos. Não houve redesign, troca de motor ou reconstrução de fase. O delta desta rodada foi uma prova explícita de layout manual/fixado (DV-05/VA-07) e a consolidação documental.

## Situação por módulo

| Módulo | Estado local | Principal prova |
|---|---|---|
| Home/widgets | PASS_LOCAL, com ressalvas visuais | `f7-ux-premium-home`, `f7-ux-premium-layout`, layout manual + undo |
| Conteúdo/Knowledge | PASS_LOCAL | `f2-*`, `f2-inspector` (120 assuntos, 320 px) |
| Planejamento | PASS_LOCAL | `f3-*`, `f7-ux-planning-workspace`, P-09 |
| Sessões/Foco | PASS_LOCAL | `f4-*`, `f7-ux-premium-focus`, duas abas |
| Revisões | PASS_LOCAL | `f5-*`, R-09, UX-21 prioridade→evidência |
| Análises | PASS_LOCAL | `f7-ux-attention-analytics`, `f7-ux-analytics` |
| Atenção/Busca/Shell | PASS_LOCAL | `f6-search`, `f7-ux-command-center`, `f6-shell` |
| Configurações/backup | PASS_LOCAL em fake | `f7-ux-backup-restore`, `f7-settings-flow` |

## Testes desta rodada

- typecheck, lint e build PASS.
- 880/880 unitários em 129 arquivos.
- 251 E2E: 246 PASS, 5 SKIP, 0 FAIL.
- Contraste 36/36 ≥ 4,5:1 (mínimo 7,02:1).

## Pendências materiais

1. Quatro riscos HIGH F0 permanecem `UNVERIFIED`: plano remoto legado, documento Firestore de 1 MiB, corrida multi-tab da outbox e perda de tombstone no backup.
2. F4-T13 e as verificações com NVDA/Narrator, toque físico, hardware modesto e zoom nativo manual seguem `NOT_RUN_ENVIRONMENT`.
3. F7 real (Auth, Firestore, Rules, convergência, quota, Cloudflare, staging) permanece `BLOCKED_EXTERNAL` por G-EXT/G-STAGING.
4. DV-06/DV-08, DV-17/DV-18 e VA-06 têm ressalvas registradas; não há mock 1:1 dos Studios.
5. F-V1-VISUAL-LAYOUT-LAB continua `BLOCKED_NEW_APPROVAL`.

## O que não foi feito

Push, PR, merge, deploy, staging, serviços reais, migração produtiva, F8 e aceite UX-H. Nenhum dado pessoal foi usado.
