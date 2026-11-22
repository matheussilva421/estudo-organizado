# Convergência visual fiel aos mockups — checkpoint

**Atualizado:** 2026-11-22
**Worktree:** C:/Projetos/estudo-organizado/_v2-candidate · **Branch:** v2
**Estado:** F7_TECHNICAL_HOMOLOGATION_PARTIAL_WITH_EXPLICIT_TOOLING_GATE / UX_TECHNICALLY_REVIEWED / AWAITING_G_F7 / V2_PREMERGE_VERIFIED / MAIN_UNCHANGED

## 2026-11-22 — Bloco C: axe e AC01–AC24

- A auditoria axe-core cobriu 8 rotas em desktop/mobile e os 12 temas na Home: **28 scans, 0 violações** após corrigir o `select-name` crítico da Prioridade contextual em `ReviewWorkspace.tsx`.
- Regressão: teste E2E específico do select, F5 **6/6**, unit **928/928** e E2E serial **251 PASS / 11 SKIP / 0 FAIL** (5,8 min).
- Staging corrigido: versão **ca74c967-9e63-438d-b05c-d01467ecc29d**, bundle `index-uCEOLZ2v.js` SHA-256 `E46DF13D…`, SW `D9D92A55…`; `verify:staging` HTTP_CHECKS_PASS e E2E real 6/6.
- A UI de backup Google continua `NOT_RUN_TOOLING`; não declaro F7 plenamente homologada nem aceite G-F7. Nenhum merge na main.

## 2026-11-22 — Segurança de dependências e staging 6e5d

- Firebase atualizado para **13.4.0** e `@grpc/grpc-js` fixado por override em **1.14.7**; `npm audit --omit=dev` agora reporta **0 HIGH/0 crítico**.
- Staging final após a atualização: **6e5d3c91-c923-472e-9e87-bac3621d1f8c**, bundle `index-DJknrlR3.js` SHA-256 `5F9B59AD…`, SW `2A5AA0D3…`, cache `estudo-organizado-v2-shell-ebe2fcf4b3d5`.
- Regressão: unit **928/928**, Firebase Emulator **37/37**, E2E serial **251 PASS / 11 SKIP / 0 FAIL** em 4,8 min, E2E real 6/6 e axe 28/0.
- A UI de backup Google continua bloqueada por confirmação de plataforma; o status segue `F7_TECHNICAL_HOMOLOGATION_PARTIAL_WITH_EXPLICIT_PLATFORM_CONFIRMATION_GATE`.

## 2026-11-22 — V1: versão ativa e conteúdo público

- O Worker V1 `estudo-organizado` está na versão `de25f803-4ba6-434a-a0d6-07a346d6794e`, com dois deploys em 2026-11-22T00:48:58Z e 00:59:35Z, anteriores aos deploys V2 das 03:07+.
- A evidência anterior de `44ec8568` é histórica. O root público continua V1: mesmos 17 assets e título do `src/index.html` da main local, sem marcadores V2; bytes/hash diferem por formatação/minificação.
- Esta sessão não fez deploy, rollback ou escrita na V1. O fato e os hashes estão em `EVIDENCIAS/V1-ACTIVE-VERSION-20261122.json` no ZIP final.

## 2026-11-22 — M7: staging final, OAuth A/B e origin/v2

- Site V2 ativo: <code>20a461c1-9e5c-4d7e-a4d9-72e75b96f9f4</code>, bundle <code>index-BXuAWcmr.js</code> SHA-256 <code>CAF526BD…</code>, SW <code>BB73111A…</code>, cache <code>estudo-organizado-v2-shell-c3df594d2ca4</code>.
- <code>verify:staging</code>: **HTTP_CHECKS_PASS**; root/handler/iframe 200, COOP <code>same-origin-allow-popups</code>, CSP e assets conferidos; E2E real **6/6 PASS** no build novo.
- OAuth Google real: contas A e B concluíram <code>signInWithRedirect</code>, consentimento, prévia, confirmação e estado <code>READY</code>; logout A voltou a <code>LOCAL_ONLY</code>; B também ficou <code>READY</code>. O projeto tem 2 usuários Google e 4 sintéticos; nenhum UID/e-mail foi registrado.
- Backup Worker: âncora publicada em <code>6e07afe0-af7d-4df5-bbf7-0e3a75822ab2</code>, deny-all; no-auth/bogus 401 e OPTIONS 204. O teste real da âncora ficou **BLOCKED_AUTO_REVIEW_ALLOWLIST** porque a plataforma rejeitou reativar <code>ALLOWED_UIDS</code>; não houve contorno e nenhuma chave sintética foi escrita.
- Git: <code>origin/v2</code> recebeu fast-forward de <code>02b950cd</code> até <code>5fcb7a9b</code>; 0 à frente/0 atrás; <code>main</code>/<code>origin/main</code> em <code>74b2c75e</code>. O ensaio de merge final gerou a árvore <code>d0bf67e2</code>, 0 conflitos e 1400 arquivos.
- Âncora **1/1 PASS** no runtime local do Worker (Miniflare/KV) e Emulator **37/37 PASS** no HEAD <code>5fcb7a9b</code>; o teste real da âncora no Cloudflare segue <code>BLOCKED_AUTO_REVIEW_ALLOWLIST</code>.
- Inventário final: somente main e <code>_v2-candidate</code>; sem PRs/stashes; F5/recovery preservadas; PNGs F4 <code>A11D64D3…</code>, <code>76597B17…</code>, <code>47F20E38…</code>.
- M1/M5: allowlist A/B aceita, âncora real **1/1 PASS** no KV público na versão <code>6d9de312</code>; allowlist final somente Google na versão <code>31f11751</code>; token sintético 401 e KV sintético em 0. Os 4 sintéticos foram removidos, os 2 Google preservados e o provider e-mail/senha desativado (<code>auth/operation-not-allowed</code>). A UI de backup Google ficou <code>NOT_RUN_TOOLING</code>.
- Pendências: aceite UX-H humano/físico, F4-T13 e G5/F8. Nenhum merge com a main foi feito.

## 2026-11-22 — Auth hospedado simplificado para redirect

- HEAD de código/testes: **3f953f38**. O build hospedado passa a usar <code>signInWithRedirect</code> por padrão; <code>popup</code> permanece apenas como opt-in explícito no ambiente.
- Motivo: o popup chegava ao Google, mas o retorno dependia de nonce/armazenamento entre janelas e fechava sem identidade. O redirect mantém o evento na mesma aba e reutiliza o handler same-origin já servido pelo Worker.
- Evidência local: unit **928/928 PASS** (133 arquivos), typecheck/lint/build PASS, E2E serial **250 PASS / 11 SKIP / 0 FAIL** em 5,3 min (captura F4 excluída).
- Build local: <code>index-BXuAWcmr.js</code> SHA-256 <code>CAF526BDC1732456B99F1FDE0DDA1277B5927B3941B0A783F4B636A8DDCB05F4</code>; SW SHA-256 <code>BB73111A112E6C33CB2601301B8F7661298566ADE27FC5E8878B23C8EF27BA7B</code>; cache <code>estudo-organizado-v2-shell-c3df594d2ca4</code>.
- Staging ativo continua **58615698-45b4-4d47-a0f8-a52b65effc86**, com o bundle popup anterior <code>index-DS_DhpUl.js</code>. O build redirect **não foi publicado**; o deploy segue interrompido/não autorizado.
- O teste E2E de staging foi atualizado para exigir redirect na mesma aba, mas não foi executado contra o staging real. OAuth Google interativo continua **NOT_RUN_EXTERNAL_IDENTITY_GATE**; nenhum PASS_REAL é reivindicado para o vínculo.

## 2026-11-21/22 — F7-R3 retomada: login Google same-origin

- HEAD de código: 012f79c1 + o commit desta correção (registrar o hash após o commit).
- Causa raiz confirmada: o popup chegava ao handler Firebase, mas o `authDomain` em `firebaseapp.com` dependia de storage de terceiros; o handler caía no shell/404 e o popup fechava sem usuário nem código visível.
- Correção aplicada: Worker do site passou a proxiar `/__/*` com `run_worker_first = ["/__/*"]`; `authDomain` do build é o host do staging; o service worker ignora `/__/`; CSP usa `frame-src 'self'` e `frame-ancestors 'self'`; o buildId do SW inclui o conteúdo do próprio SW.
- Configuração externa: o cliente OAuth `495694282160-q8rhaobj2b1tb6j94r2b3pihoqu0an3o` do projeto `eo-v2-f7-test-20261117` recebeu a origem JS e o redirect URI do staging. Somente o projeto V2 foi alterado; V1 intocado.
- Evidência headless: `verify:staging` HTTP_CHECKS_PASS; handler/iframe same-origin 200; E2E real 6/6; popup chega a `accounts.google.com` com `redirect_uri` do staging; unit 914/914; typecheck/lint/build PASS.
- Versão ativa do site: `58615698-45b4-4d47-a0f8-a52b65effc86` (100%); bundle `/assets/index-DS_DhpUl.js`, SHA-256 `63a41c4a745a67fa441377ef30e390553b9faeeb5bd29908678451e6cc7b1511`; backup `463a36df-94e2-4e17-8d64-6bb25e141df7`, deny-all.
- Pendente: login humano A/B, captura privada dos dois UIDs, `ALLOWED_UIDS`, testes A↔B/backup/sync e UX-H. Nenhum aceite G-F7 foi presumido.

## 2026-11-17 — G-EXT + G-STAGING

- HEAD local: 5e98396e (teste de viewports reais); commits anteriores b0031697, 654692c0, 4d23a55c, c2230bee, 09042741 e 164ed36d.
- Staging: https://estudo-organizado-v2-f7-test.matheussilva421.workers.dev
- Firebase isolado: eo-v2-f7-test-20261117 (Spark, Firestore Standard, southamerica-east1).
- Backup Worker: https://estudo-organizado-v2-f7-backup.matheussilva421.workers.dev (KV d859d36f26054256b1770d7668786bc4).
- Auth: Google habilitado; fluxo popup e redirect implementados. Revisão independente encontrou P2 de escopo/TTL e popup; corrigidos. Suíte unitária 892/892; typecheck, lint e build PASS. Emulator NOT_RUN_ENVIRONMENT: Java ausente no PATH.
- Staging: read-back HTTP PASS; E2E real 4/4 PASS (shell, reload, offline, 390/768); Firestore anônimo 7/7 negações 403/401; Worker adversarial 8/8 PASS.
- Bloqueio atual: o Chrome/Edge com prevenção estrita de rastreamento bloqueia o armazenamento de terceiros usado pelo Firebase; popup fecha sem opener e o redirect não encontra o evento. Necessário liberar armazenamento de terceiros/prevenção de rastreamento apenas para a origem de staging antes de repetir o login A/B.
- Incidente V1: um `npx wrangler deploy` sem `--config` usou `wrangler.jsonc` da V1 e publicou a versão 44ec8568 no Worker `estudo-organizado` (produção) em 2026-11-17T21:14Z. O conteúdo local `src` e `wrangler.jsonc` não tem diff contra 9046cfa, e index.html/manifest.json/sw.js/js/components.js públicos batem byte a byte com o main local. Versão anterior: 25c8e9c1 (2026-10-27). Rollback rejeitado pelo auto-review por alterar produção sem autorização explícita; aguardar decisão do proprietário.
- Próximo: liberar a configuração de rastreamento no navegador, concluir login A e B, capturar UIDs, configurar ALLOWED_UIDS no Worker de backup e executar S01–S25.

## GOAL atual

Reconstruir a apresentação até parecer o produto dos quatro mockups, preservando F0–F7. O proprietário rejeitou o resultado visual anterior; aceite UX-H pendente.

## Home — marco concluído

- Shell reconstruído: rail de 200 px com marca, ícones e citação; topbar com busca à direita e ações discretas; tema compacto.
- Hero de 260 px com recorte decorativo real dos quatro mockups (WebP 16–19 KB cada), fallback vetorial nos outros oito temas e CTA/HTML reais.
- Saudação editorial, faixa de passos, bento de três cartões com anel real, revisões e série de 7 dias; recursos principais antes do painel configurável.
- Painel de widgets, fórmulas, filtros e indicadores movido para segunda camada; contadores compactos permanecem visíveis.
- Faixa técnica de sincronização removida do estado saudável da Home; conflito/recuperação continuam em alerta e Atenção.
- Medição em 1586×992: nav x16 w200 h960; hero x228 y176 w1342; recursos x228 y~700. Variação vertical dentro de ~2% do mock, exceto conteúdo real/estado vazio.
- Review Studio: subnavegação Visão/Fila/Histórico/Política e histórico visual com eventos concluídos.
- Knowledge Studio: subnavegação Biblioteca/Disciplinas/Árvore/Importação e contagens reais.
- Insights Studio: subnavegação Visão/Explorar/Recortes/Comparação e recorte real por edital ou disciplina.
- Planning Studio: subnavegação Visão/Calendário/Ciclo e Reta Final/Editor e contagens reais por cenário.
- Settings: galeria de aparência antes do diagnóstico técnico, com categorias e integridade separada.
- Faixas contextuais dos módulos compactadas; alerta de conflito no Modo Foco movido para o topo e validado em 320/390.
- Sessions: visão de estado, histórico recente, concluídas hoje e recuperação; timer/Foco inalterados.
- Geometria de referência: rail 295 px, conteúdo em x≈351, hero 270 px, título 40 px, CTAs 48 px, Bento 1/1,08/1,25 e recursos horizontais.
- Pareceres independentes recebidos e tratados: denominador por dimensão no Insights, janela civil de 7 dias, alerta de backup na Home, role do link crítico, rail tablet, escopo do Planning, revisões futuras, série acessível e aviso de histórico truncado.
- Capturas: visual-match-v11 e instrumentos v9 overlay/diff. Matriz e pareceres em docs/superpowers/audits/f7-ux-visual-match/. Suíte completa: 229 PASS, 5 SKIP, 0 FAIL (234).

## Próximo

- Revisão visual independente da Home com overlay 50/50 e tabela de 8 critérios.
- Testar recorte preenchido do Insights, recompor Sessions/Settings e capturar módulos atualizados.
- Atualizar capturas/instrumentos após Settings e consolidar o ZIP VISUAL-PIXEL-MATCH-REVIEW final.
- Estados com dados, quatro temas, mobile 320/390, 200% e acessibilidade; depois FIDELITY-MATRIX, dois pareceres e ZIP VISUAL-PIXEL-MATCH-REVIEW.

## Invariantes

Sem push, main/V1, deploy, staging, Firebase/Cloudflare reais, F8, reset/clean/force. Preservar 133+ commits, refs recovery, bundles e o bundle anterior cfee89e7.


## 2026-11-22 — READY FOR MAIN: M0–M3

- M0: HEAD 7e43d06c; origin/main 74b2c75e (dois commits V1/docs), origin/v2 02b950cd; 220 commits à frente; bundle completo de 35 refs verificado e clone de recuperação criado.
- M1: cinco E2E locais corrigidos com relógio determinístico e espera de prontidão; suíte local completa **250 PASS / 11 SKIP / 0 FAIL** (captura F4 excluída); unit **917/917**; typecheck/lint/build PASS.
- Hardening: Worker do site com allowlist positiva do projeto V2; cache do SW content-addressed; verify-staging exige auth-domain e origem; exemplo de config versionado. O Worker de backup passou a exigir uma cópia de substituição lida diretamente para excluir, em vez de confiar em listagem KV eventualmente consistente.
- M2/M3: duas identidades sintéticas A/B receberam ID tokens reais do Firebase Auth; teste real Firestore **5/5** (create, convergência, conflito, tombstone, negação cross-UID); Worker/KV real com AES-GCM, read-back, restore, última cópia e negação cross-UID **PASS**. A allowlist foi configurada com A/B e revertida para deny-all; Firestore e KV sintéticos foram inventariados, copiados e limpos.
- OAuth Google interativo continua separado e não foi falsificado. Próximo: M4–M8 (jornada, UX-H, F8 pré-merge, regressão, staging final, ensaio de merge e ZIP).



## 2026-11-22 — M4/M5

- M4: suíte E2E local 250 PASS/11 SKIP/0 FAIL; staging real 6/6. Sem ADB, NVDA ou touch físico; Narrator presente mas sem captura automatizada. S25 PARTIAL_REAL e F4-T13 NOT_RUN_ENVIRONMENT.
- M5: `auditLegacyV1DryRun` read-only com fixture sintética de 5 registros e 0 perdas estruturais; 5/5 testes. Nenhum export real, freeze, migração ou cutover executado; G5 pendente.
- Evidências e matriz em `docs/superpowers/audits/v2-ready-for-main-20261122/`.

