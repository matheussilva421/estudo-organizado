# Jornadas integradas — F2 a F7

Teste principal: apps/v2/tests/e2e/f7-ux-integrated-journey.spec.ts (PASS no HEAD 68e83479).

1. Conteúdo: fixture cria disciplina, edital, vínculo e assunto com IDs canônicos.
2. Planejamento: cenário ACTIVE com bloco CONFIRMED_DAY do conteúdo; calendário exibe o bloco e não inventa horário.
3. Sessões: registro manual de 30 min aparece no histórico como MANUAL/COMPLETED, com tempo manual separado do verificado.
4. Revisões: compromisso semeado é iniciado, depois concluído com avaliação GOOD; a agenda passa a exibir Cumprida.
5. Home e Análises: renderizam sem erro de leitura; nenhuma renderização grava fatos.

Provas complementares:
- f7-ux-cross-module.spec.ts: rotas por ID exato, árvore de conteúdo e offline.
- f7-ux-reviews-queue.spec.ts: abrir ≠ iniciar ≠ concluir, filtros e política com prévia.
- f7-ux-sessions-history.spec.ts: inspetor e filtros de histórico.
- f7-ux-planning-workspace.spec.ts: disponibilidade, ativação com prévia, calendário em lista e mês civil.

Limite: sincronização remota, ACK, staging e multi-dispositivo continuam NOT_RUN/G-EXT; nenhum fake remote foi apresentado como convergência real.

