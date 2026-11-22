# Estado canônico — V2 READY FOR MAIN

**Atualizado:** 2026-11-22
**Branch:** v2
**HEAD de código/testes:** 3f953f38
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
- Suíte local paralela: **250 PASS / 11 SKIP / 0 FAIL**; serial final: **250 PASS / 11 SKIP / 0 FAIL** em 5,3 min (captura F4 excluída).
- Unit: **928/928 PASS** em 133 arquivos; typecheck, lint e build PASS.
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

## M6 — Auth redirect e regressão final

- Builds hospedados usam **redirect** por padrão; popup ficou como opt-in explícito. O objetivo é remover a dependência de nonce/armazenamento entre janelas que fazia o popup fechar sem identidade.
- Build local <code>index-BXuAWcmr.js</code> SHA-256 <code>CAF526BDC1732456B99F1FDE0DDA1277B5927B3941B0A783F4B636A8DDCB05F4</code>; SW <code>BB73111A…</code>; cache <code>estudo-organizado-v2-shell-c3df594d2ca4</code>.
- Staging ativo permanece 58615698 com o bundle popup anterior; o build redirect não foi publicado. OAuth Google interativo continua <code>NOT_RUN_EXTERNAL_IDENTITY_GATE</code>.
- Merge rehearsal no HEAD final: árvore <code>ad68a5df</code>, **0 conflitos**, 1400 arquivos; <code>apps/v2</code> idêntico à v2 e <code>src</code> idêntico a <code>origin/main</code>.

## Próximo

M7 depende de autorização para publicar o build redirect no staging e repetir o E2E real; M8 ZIP final. Push, merge e limpeza Auth continuam gates separados. Classificação: <code>PREMERGE_ENGINEERING_COMPLETE_WITH_EXPLICIT_GATES</code>.

