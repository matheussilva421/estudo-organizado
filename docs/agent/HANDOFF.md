# Convergência visual fiel aos mockups — checkpoint

**Atualizado:** 2026-11-12
**Worktree:** C:/Projetos/estudo-organizado/_v2-candidate · **Branch:** v2
**Estado:** LOCAL_VISUAL_MATCH_IN_PROGRESS / UX_HUMAN_PENDING / REMOTE_PUSH_NOT_AUTHORIZED

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
- Geometria de referência: rail 295 px, conteúdo em x≈351, hero 270 px, título 40 px, CTAs 48 px, Bento 1/1,08/1,25 e recursos horizontais.
- Pareceres independentes recebidos e tratados: denominador por dimensão no Insights, janela civil de 7 dias, alerta de backup na Home, role do link crítico, rail tablet, escopo do Planning, revisões futuras, série acessível e aviso de histórico truncado.
- Capturas: visual-match-v11 e instrumentos v9 overlay/diff. Matriz e pareceres em docs/superpowers/audits/f7-ux-visual-match/. Suíte completa: 229 PASS, 5 SKIP, 0 FAIL (234).

## Próximo

- Revisão visual independente da Home com overlay 50/50 e tabela de 8 critérios.
- Testar recorte preenchido do Insights, recompor Sessions/Settings e capturar módulos atualizados.
- Recompor Sessions/Settings, atualizar capturas/instrumentos v11 e produzir ZIP VISUAL-PIXEL-MATCH-REVIEW com pareceres e matriz.
- Estados com dados, quatro temas, mobile 320/390, 200% e acessibilidade; depois FIDELITY-MATRIX, dois pareceres e ZIP VISUAL-PIXEL-MATCH-REVIEW.

## Invariantes

Sem push, main/V1, deploy, staging, Firebase/Cloudflare reais, F8, reset/clean/force. Preservar 133+ commits, refs recovery, bundles e o bundle anterior cfee89e7.
