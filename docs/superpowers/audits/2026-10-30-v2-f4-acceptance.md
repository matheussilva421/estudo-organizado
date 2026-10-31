# Estudo Organizado V2 — F4: aceite local com ressalvas

**Status:** F4_IMPLEMENTED_LOCAL_READY_FOR_HUMAN_ACCEPTANCE_WITH_RESERVATIONS
**Data:** 2026-10-31
**Branch/worktree:** v2 em C:\Users\slvma\.codex\worktrees\v2-f4\estudo-organizado
**HEAD de código:** 4ffa023
**Remoto:** origin/v2 = 68db01542a9d5934c7e45e622001334f91eaaf4f; sem push, merge ou deploy.

## Entradas aprovadas

- Spec: docs/superpowers/specs/2026-10-30-estudo-organizado-v2-f4-execution-design.md
- Plano: docs/superpowers/plans/2026-10-30-estudo-organizado-v2-f4-execution.md
- SHA-256 originais verificados antes da incorporação: spec 5be103a6a48a29d91e26a0ca9b0da22c96fcb1536f789f173846b561a6e5d527; plano a35881dc6e3cd71083ea61d81eded619f89f78ac23a27255c102d6a5a98ca8b7.
- A comparação com o ZIP original mostra apenas 5+3 linhas de metadados de aprovação; a parte normativa está íntegra. 21 decisões, 12 invariantes e 42 testes estão presentes.

## Evidência executada no HEAD final

| Comando | Resultado |
| --- | --- |
| npm run test:unit | PASS — 71 arquivos, 427 testes |
| npm run test:e2e | PASS — 88 testes, 1 skip intencional |
| npm run lint | PASS |
| npm run build | PASS — tsc e Vite |
| E2E F4 | PASS — timer, manual, Pomodoro, recovery, duas abas, hábitos, background, update PWA, temas/viewports e evidência visual |
| Impeccable detector 3.9.1 | PASS — 0 achados em apps/v2/src |
| Gate Impeccable completo (audit/critique visual F4) | BLOCKED — detector PASS; auditoria visual/contraste F4 dedicada não executada |
| Temas/viewports F4 | PASS — oito temas, 1280/834/390 |
| Contraste/foco/toque F2/F3 | PASS na suíte completa |
| Suspensão física F4-T13 | NOT_RUN |

## Revisão independente

Revisor separado do executor, somente leitura, sobre o HEAD 90a3dca; emitiu 10 HIGH, 5 MEDIUM e 3 LOW. Correções materiais aplicadas no commit 4ffa023:

- Pomodoro não credita mais foco fictício: usa tempo real, rejeita conclusão imediata e o descanso não soma foco.
- Autoridade órfã é liberada quando a criação da sessão falha.
- Troca de sessão atualiza session_control; a nova sessão aceita pausa/checkpoint.
- Retomada cria novo intervalo de foco.
- Sessões reais ganham startedAt; intervalos de recuperação não entram na contabilização civil.
- Hábitos ignoram sessões canceladas e suportam recorrência semanal.
- Exportação aplica filtros, usa todas as sessões e sanitiza notas/URLs de materiais.
- Recuperação expõe retomar, corrigir manualmente, manter pendente e concluir; registro manual avisa sobreposição.
- Conflitos rejeitam versão anterior à base.
- Atualização PWA aguarda a ativação do novo controlador.

## Ressalvas remanescentes

- F3: a UI aceita ID de bloco e vincula a sessão, mas não há botão de iniciar pelo workspace de planejamento nem conciliação com planApplied verdadeiro; T05 e T25–T28 são parciais.
- Alocações, medições e importação emergencial permanecem no domínio/serviço, sem fluxo de UI dedicado; T24, T29, T30 e T41 são parciais.
- Pausa/conclusão usam checkpoint + transição em transações separadas; um crash entre elas deixa checkpoint válido, mas não uma única transação; T06/T21 são parciais.
- Histórico ignora assuntoId e pagina em memória; T38 é parcial.
- otherTabsReady é fixado em true; não há negociação entre abas para atualização PWA.
- KEEP_BOTH preserva a variante no registro de conflito, mas o helper puro devolve a versão local; falta fluxo de resolução na UI.
- O teste F4 de acessibilidade cobre alcance nos oito temas/viewports; contraste/foco/toque específicos da F4 não têm amostragem dedicada, embora os testes F2/F3 e o detector Impeccable passem. O gate Impeccable completo permanece BLOCKED.
- F4-T13 (suspensão física) permanece NOT_RUN; quatro HIGH da F0 permanecem UNVERIFIED.

## Matriz resumida F4-T01…T42

| Faixa | Status |
| --- | --- |
| T01–T04 | PASS |
| T05 | PARCIAL — vínculo por ID na UI, sem início pelo workspace F3 |
| T06 | PARCIAL — checkpoint e transição separados |
| T07–T08 | PASS — tempo real e descanso separado |
| T09 | PASS simulado; T13 NOT_RUN |
| T10–T12 | PASS |
| T14–T20 | PASS |
| T21 | PARCIAL — autoridade corrigida, transição não única |
| T22–T23 | PASS — registro manual e aviso de sobreposição |
| T24 | PARCIAL — domínio sem UI de alocação |
| T25–T28 | PARCIAL — vínculo/realidade F3 incompletos |
| T29–T30 | PARCIAL — domínio sem UI de medições |
| T31 | PASS |
| T32–T33 | PASS com ressalva KEEP_BOTH |
| T34–T35 | PASS — âncoras civis e DST determinístico |
| T36–T37 | PASS |
| T38 | PARCIAL — assuntoId e índice |
| T39 | PASS — filtros, volume e sanitização |
| T40 | PASS com ressalva de caminho de falha da UI |
| T41 | PARCIAL — domínio sem UI de importação |
| T42 | PASS — E2E de update e temas; negociação entre abas parcial |

## Git e GitHub

- v2 local: 80e33ec (documental; código 4ffa023), 33 commits à frente de origin/v2.
- main: 9046cfa, intocada.
- Sem PRs abertos, sem stashes; dois worktrees (main e v2-f4).
- Nenhuma Action, deploy ou push.

## Veredito

**Aceite com ressalvas, não aceite integral.** A F4 está implementada e testada localmente, com correções materiais da revisão independente. Os blockers restantes são de integração/UX F3, alocação/medição/emergência, atomicidade única de pausa/conclusão, índice de histórico e negociação de atualização entre abas. Não declarar F4_ACCEPTED. A próxima ação é o aceite humano; depois, se aprovado, autorizar push fast-forward da v2.

