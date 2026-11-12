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
- Planning Studio: subnavegação Visão/Calendário/Ciclo e Reta Final/Editor e contagens reais de cenários, blocos, minutos e blocos sem data.
- Capturas: visual-match-v8 e instrumentos/overlay. Testes dirigidos Home: 19 PASS; Review/Knowledge/Planning: 18 PASS; suíte completa: 229 PASS, 5 SKIP, 0 FAIL (234).

## Próximo

- Revisão visual independente da Home com overlay 50/50 e tabela de 8 critérios.
- Testar recorte preenchido do Insights, recompor Sessions/Settings e capturar módulos atualizados.
- Overlay 50/50, medida das oito regiões e revisão visual independente.
- Estados com dados, quatro temas, mobile 320/390, 200% e acessibilidade; depois FIDELITY-MATRIX, dois pareceres e ZIP VISUAL-PIXEL-MATCH-REVIEW.

## Invariantes

Sem push, main/V1, deploy, staging, Firebase/Cloudflare reais, F8, reset/clean/force. Preservar 133+ commits, refs recovery, bundles e o bundle anterior cfee89e7.
