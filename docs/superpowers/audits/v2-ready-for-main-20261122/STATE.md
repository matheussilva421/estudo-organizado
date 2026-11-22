# Estado canônico — V2 READY FOR MAIN

**Atualizado:** 2026-11-22
**Branch:** v2
**HEAD de código/testes:** 1fb4ad27 (após 7e43d06c)
**origin/v2:** 02b950cd (antes da publicação final)
**origin/main:** 74b2c75e
**Staging:** https://estudo-organizado-v2-f7-test.matheussilva421.workers.dev
**Firebase:** eo-v2-f7-test-20261117 (Spark, billing desabilitado)
**Workers:** estudo-organizado-v2-f7-test / estudo-organizado-v2-f7-backup

## M0 — preflight e recuperação

- HEAD local confirmado em 7e43d06c no início; 220 commits à frente de origin/v2, 0 atrás.
- main/origin/main em 74b2c75e; dois commits posteriores a 9046cfa2, apenas V1/docs.
- Sem PRs abertos, stashes ou worktrees extras; branch F5 preservada.
- Bundle completo de 35 refs verificado e clone de recuperação em `%TEMP%`.
- PNGs F4 preservados com hashes `a11d64d3…`, `76597b1…`, `47f20e3…`.

## M1 — E2E, hardening e P2

- Cinco E2E locais corrigidos: relógio determinístico compartilhado, espera de DB pronta antes do Tab, foco do Foco aguardando RUNNING.
- Suíte local completa: **250 PASS / 11 SKIP / 0 FAIL** (captura F4 excluída).
- Unit: **917/917 PASS**; typecheck, lint e build PASS.
- Worker do site com allowlist positiva do project ID V2; cache do SW content-addressed; verify-staging exige auth-domain e origem; exemplo de config versionado.
- Worker de backup: DELETE agora exige `replacement` lido diretamente, fail-closed; não confia na listagem eventual do KV.

## M2/M3 — autenticação sintética e backend real

- Duas identidades sintéticas A/B no Firebase Auth V2, com ID tokens reais (provider email/senha; OAuth Google real continua separado).
- Firestore real: 5/5 PASS — create causal, leitura por segundo cliente do mesmo UID, convergência, conflito stale, tombstone sem ressurreição e cross-UID read/write negado.
- Worker/KV real: allowlist A/B, AES-GCM, upload, list, get, decrypt, wrong key, cross-UID e preservação da última cópia; **PASS**.
- Allowlist revertida para deny-all; Firestore e KV sintéticos inventariados, copiados e limpos; 0 resíduos.

## M4 — UX e acessibilidade

- E2E local 250/11/0 e staging real 6/6.
- Sem ADB, emulador Android, NVDA ou touch físico; Narrator presente mas sem captura automatizada.
- S25 PARTIAL_REAL; F4-T13 NOT_RUN_ENVIRONMENT.

## M5 — F8 pré-cutover

- `auditLegacyV1DryRun` read-only, com 5/5 testes e fixture sintética de 5 registros/0 perdas estruturais.
- Nenhum dado real, freeze, migração ou cutover executado; G5 pendente.

## Próximo

M6 regressão final e revisão independente; M7 staging final, push fast-forward em origin/v2 e merge rehearsal; M8 ZIP final.

