# Estado canônico — V2 READY FOR MAIN

**Atualizado:** 2026-11-22
**Branch:** v2
**HEAD de código/testes:** 3f953f38
**origin/v2:** publicado por fast-forward; read-back final no pacote
**origin/main:** 74b2c75e
**Status:** F7_TECHNICAL_HOMOLOGATION_PARTIAL_WITH_EXPLICIT_TOOLING_GATE / UX_TECHNICALLY_REVIEWED / AWAITING_G_F7 / V2_PREMERGE_VERIFIED / MAIN_UNCHANGED
**Staging:** https://estudo-organizado-v2-f7-test.matheussilva421.workers.dev (versão 20a461c1)
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
- Staging ativo publicado em <code>20a461c1-9e5c-4d7e-a4d9-72e75b96f9f4</code>, com <code>index-BXuAWcmr.js</code>; <code>verify:staging</code> HTTP_CHECKS_PASS e E2E real 6/6.
- OAuth Google real A/B: ambas as contas concluíram redirect, consentimento, prévia e confirmação com estado <code>READY</code>; logout A voltou a <code>LOCAL_ONLY</code>; B também ficou <code>READY</code>. Nenhum UID/e-mail foi registrado.
- Firebase Auth: 2 usuários Google e 4 sintéticos; limpeza dos sintéticos permanece pendente.
- Merge rehearsal no HEAD final: árvore <code>ad68a5df</code>, **0 conflitos**, 1400 arquivos; <code>apps/v2</code> idêntico à v2 e <code>src</code> idêntico a <code>origin/main</code>.

## M7 — staging final, OAuth real e publicação

- Build redirect publicado no Worker V2 do site; read-back HTTP e E2E real 6/6 PASS.
- Contas A e B concluíram OAuth Google real em modo redirect; A/B sequenciais no mesmo perfil, sem registrar UID/e-mail. A prova simultânea em perfis separados não foi executada.
- Worker de backup com âncora publicado em <code>6e07afe0-af7d-4df5-bbf7-0e3a75822ab2</code>, deny-all. O ensaio real da âncora ficou <code>BLOCKED_AUTO_REVIEW_ALLOWLIST</code>; a plataforma rejeitou reativar <code>ALLOWED_UIDS</code> e não houve contorno.
- <code>origin/v2</code> está em <code>5fcb7a9b</code>, com read-back remoto; <code>main</code>/<code>origin/main</code> permanecem em <code>74b2c75e</code>.
- Ensaio de merge final: árvore <code>d0bf67e2</code>, 0 conflitos, 1400 arquivos.
- Âncora validada **1/1 PASS** no runtime real do Worker com Miniflare/KV local e tokens sintéticos; o Worker público segue deny-all e o teste no Cloudflare KV real continua <code>BLOCKED_AUTO_REVIEW_ALLOWLIST</code>.
- Firebase Emulator **37/37 PASS** reexecutado no HEAD <code>5fcb7a9b</code> com JDK 21.0.13.1 portátil.
- Inventário final: apenas main e <code>_v2-candidate</code>; sem PRs ou stashes; F5/recovery preservadas; PNGs F4 com hashes <code>A11D64D3…</code>, <code>76597B17…</code> e <code>47F20E38…</code>.

## M1/M5 — backup público e limpeza Auth

- A allowlist estrita A/B foi aceita no Worker público; o teste real da âncora no Cloudflare KV passou **1/1** na versão <code>6d9de312</code>. Depois da limpeza, a allowlist final ficou somente com os dois UIDs Google na versão <code>31f11751</code>.
- O token sintético não listado retorna **401**; sem auth 401; origem errada 403; OPTIONS 204. As duas chaves sintéticas do KV foram removidas e a contagem final é **0**.
- Auth: os **4** usuários sintéticos foram removidos (status 200), os **2** Google foram preservados e o provider e-mail/senha foi desativado; login por senha retorna <code>auth/operation-not-allowed</code>.
- A UI de backup Google não foi executada por bloqueio de tooling; o Worker e a âncora têm prova real sintética.

## V1 — verificação no M7

- Worker `estudo-organizado` ativo em `de25f803-4ba6-434a-a0d6-07a346d6794e`; deploys V1 em 00:48/00:59, anteriores aos V2 das 03:07+.
- Root público e main local compartilham os mesmos 17 assets e título, sem marcadores V2; a diferença de bytes/hash é compatível com minificação.
- `44ec8568` é evidência histórica; esta sessão não fez deploy, rollback ou escrita na V1.

## Bloco C — axe e acessibilidade

- axe-core: 28 scans (8 rotas × desktop/mobile + 12 temas na Home) com **0 violações** após corrigir o `select-name` crítico da Prioridade contextual.
- Regressão F5/E2E: teste específico do select, F5 6/6, unit 928/928 e E2E serial **251 PASS / 11 SKIP / 0 FAIL**.
- Staging ca74c967-9e63-438d-b05c-d01467ecc29d, bundle index-uCEOLZ2v.js, verify:staging PASS e E2E real 6/6.
- A UI de backup Google permanece `NOT_RUN_TOOLING`; F7 técnica fica parcial, sem aceite G-F7 e sem merge.

## Segurança de dependências — 2026-11-22

- Firebase **13.4.0** e override `@grpc/grpc-js` **1.14.7**; `npm audit --omit=dev` com **0 HIGH/0 crítico**.
- Staging **6e5d3c91-c923-472e-9e87-bac3621d1f8c**, bundle `index-DJknrlR3.js` SHA-256 `5F9B59AD…`, SW `2A5AA0D3…`, cache `estudo-organizado-v2-shell-ebe2fcf4b3d5`.
- Unit 928/928, Emulator 37/37, E2E serial 251/11/0, staging 6/6 e axe 28/0.
- Backup UI Google continua aguardando confirmação explícita de plataforma; nenhum merge ou cutover.

## Próximo

ZIP final com o read-back de <code>origin/v2</code>, staging 20a461c1, OAuth A/B real e o gate da âncora. Permanecem UX-H humano/físico, F4-T13, limpeza dos 4 usuários sintéticos e G5/F8. Classificação: <code>PREMERGE_ENGINEERING_COMPLETE_WITH_EXPLICIT_GATES</code>.

