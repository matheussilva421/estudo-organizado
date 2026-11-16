# Fechamento local F0/F7 — 16/11/2026

Código `6c0353bb7da20338518b36427416343ba23f1835`, branch `v2`. Documentação no commit final deste pacote.

## Entregue

- Firebase Emulator (Firestore/Auth) executado em loopback, projeto `demo-estudo-v2`, com **17/17** testes PASS e exit 0.
- Rules endurecidas: `schemaVersion == 1`; criação de entidade com revisão 1; update monotônico; `entityType` e `epoch` imutáveis; change com `operationId`; binding entity/change/head/receipt; epoch e sequência coerentes.
- Revisão de segurança independente apontou dois P1 e ambos foram fechados com testes.
- Regressão: typecheck, lint, **881/881** unitários, **248/253** E2E (5 skips, 0 falhas) e capturas 3/3 + 1/1.
- Evidências visuais em desktop, tablet, mobile 390, mobile 320 e 320×568; 12 temas; oito módulos; estados funcionais.
- Bundle Git será gerado após o commit documental, verificado em clone e registrado em BUNDLE.txt; a prova de empacotamento fica no próprio pacote.

## Estado

`FIREBASE_EMULATOR_LOCAL_VERIFIED` / `F0_HIGH_LOCAL_MITIGATIONS_TESTED_WITH_RESIDUALS` / `F7_SECURITY_P1_CLOSED` / `F7_EXTERNAL_PENDING` / `UX_HUMAN_PENDING` / `REMOTE_PUSH_NOT_AUTHORIZED` / `MAIN_UNCHANGED`.

## Pendências reais

- UX-H é decisão humana; não houve aprovação.
- G-EXT: backend Firebase real, quotas, billing, Auth real e multi-dispositivo não testados.
- G-STAGING, F8 e F4-T13 não executados.
- Migração V1 permanece fail-closed e não integrada ao produto.
- `entityType` não é correlacionado ao receipt; tipos desconhecidos falham no cliente.
- NVDA/Narrator, toque físico, zoom nativo manual e hardware modesto: NOT_RUN_ENVIRONMENT.

## Limites

Nenhum push, PR, merge, deploy, staging, serviço real, dado acadêmico real ou F8. O emulador não homologa produção.
