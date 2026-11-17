# Convergência visual fiel aos mockups — checkpoint

**Atualizado:** 2026-11-17
**Worktree:** C:/Projetos/estudo-organizado/_v2-candidate · **Branch:** v2
**Estado:** F7_EXTERNAL_BLOCKED_WITH_EVIDENCE / UX_HUMAN_PENDING / REMOTE_PUSH_NOT_AUTHORIZED

## 2026-11-17 — G-EXT + G-STAGING

- HEAD local: c2230bee (auth por redirect com marcador escopado/TTL); commits anteriores b0031697, 654692c0 e 4d23a55c.
- Staging: https://estudo-organizado-v2-f7-test.matheussilva421.workers.dev
- Firebase isolado: eo-v2-f7-test-20261117 (Spark, Firestore Standard, southamerica-east1).
- Backup Worker: https://estudo-organizado-v2-f7-backup.matheussilva421.workers.dev (KV d859d36f26054256b1770d7668786bc4).
- Auth: Google habilitado; fluxo popup e redirect implementados. Revisão independente encontrou P2 de escopo/TTL e popup; corrigidos. Suíte unitária 892/892; typecheck, lint e build PASS. Emulator NOT_RUN_ENVIRONMENT: Java ausente no PATH.
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
