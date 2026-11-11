# Rastreabilidade F7-UX — UX-16 a UX-21

Base auditada: `0d2ee339`. Delta desta rodada: `34487e30` (integridade de revisão e sessão) e `51cc4a40` (prévia de ativação, calendário em lista, filtros de revisão e Home 320 px).
Classificação: **F7_UX_ADHERENCE_PARTIAL_WITH_EXACT_GAPS**. Nenhum item abaixo foi promovido a PASS sem teste ou comportamento executado.

**Estado vigente (11/11/2026):** os P1 P-04 e R-02 estão fechados; a seção “Atualização integrada” ao final é a fonte corrente. As tabelas seguintes preservam o diagnóstico de 0d2ee339 e não devem ser lidas como pendências atuais.

## Histórico — UX-16 a UX-21 em 0d2ee339

### UX-16 — Planejamento contextual

| ID | Requisito | Código | Prova | Status |
|---|---|---|---|---|
| P-01 | Workspace sem duplicar planejamento; metas/progresso | `PlanningWorkspace.tsx`, `PlanningDashboard.tsx` | `f3-journey.spec.ts` | PARTIAL — workspace existe; metas/progresso não são exibidos |
| P-02 | Prévia antes de ativar/substituir; sem sobrescrita | `PlanningWorkspace.tsx:318-374`; `PlanningDashboard.tsx` | `f7-ux-planning-workspace.spec.ts` (2 casos) | PASS_VERIFIED — ativação só ocorre no segundo clique e mostra cenários substituídos/blocos afetados |
| P-03 | Calendário dia/semana/mês/lista; não alocados | `PlanningCalendar.tsx:94-140` | `f7-ux-planning-workspace.spec.ts`; `f3-calendar.test.ts` | PARTIAL — lista e não alocados agora visíveis; “mês” é janela de 30 dias, não mês civil |
| P-08 | Base stale exige revisão | `ReviewWorkspace`/`LocalPlanningRepository.activateScenario`; `PlanningWorkspace.tsx:337-374` | `f7-ux-planning-activation.test.ts` (stale → CONFLICT) | PASS_VERIFIED para ativação; alteração de data da prova segue coberta só por domínio |

## UX-17 — Assistente, ciclo e Reta Final

| ID | Requisito | Código | Prova | Status |
|---|---|---|---|---|
| P-04 | Disponibilidade/exceções/metas editáveis | `PlanningWorkspace.tsx:53` (constante `weekly`) | — | FAIL — disponibilidade semanal é constante; store `planning_availability` não tem leitura/escrita nem UI |
| P-05 | Simulação antes do commit; Reta Final | `PlanningWizard.tsx`; `FinalStretch.tsx`; `planning-final-stretch.ts` | `f3-final-stretch-ui.spec.ts`; `f3-final-stretch.test.ts` | PARTIAL — data da prova tem prévia; adiamento/suspensão ainda commitam direto |
| P-06 | Checkpoint restaurável | `local-planning-repository.ts` (`activateScenario`) | `f7-ux-planning-activation.test.ts` | PASS_VERIFIED — ativação preserva `snapshot` completo; antes sobrescrevia com manifesto |
| P-09 | Jornada única de aceite | — | nenhum teste único | PARTIAL — cobertura distribuída em F3 + novos testes |

## UX-18 — Sessões

| ID | Requisito | Código | Prova | Status |
|---|---|---|---|---|
| E-01 | Estudar contextual sem autostart | shell F6 | `f7-ux-shell-navigation.spec.ts` | PASS_VERIFIED |
| E-02 | Cronômetro, pausa, retomada, Pomodoro | `SessionWorkspace.tsx` | `f4-timer-journey.spec.ts`; `f4-pomodoro.spec.ts` | PASS_VERIFIED |
| E-03 | Pausa não entra em foco | `SessionWorkspace.tsx`; service | `f4-timer-journey.spec.ts`; `f7-ux-session-integrity.test.ts` | PASS_VERIFIED — lacuna não observada não é creditada |
| E-04 | Manual ≠ verificado | `session-accounting.ts` | `f4-manual.test.ts` | PASS_VERIFIED |
| E-05 | Vínculo ≠ cumprimento | `experience-queries.ts` | `f7-ux-plan-execution-truth.test.ts` | PASS_VERIFIED |
| E-08 | Segunda aba não duplica | coordenação F4 | `f4-two-tabs.spec.ts` | PASS_VERIFIED |
| E-09 | Alocação válida e pertencente à sessão | `session-service.ts`; `SessionWorkspace.tsx` | `f7-ux-session-integrity.test.ts`; guarda de conteúdo na UI | PARTIAL — soma e `sessionId` validados; existência/arquivamento só na UI |

## UX-19 — Histórico e recuperação

| ID | Requisito | Código | Prova | Status |
|---|---|---|---|---|
| E-06 | Histórico consultável/auditável | `SessionWorkspace.tsx` | `f4-export.test.ts`; tela de histórico | PARTIAL — resumo e exportação; falta inspetor de detalhes/filtros |
| E-07 | Recuperação sem inventar tempo | `session-service.ts:226-330`; `local-session-repository.ts` | `f7-ux-session-integrity.test.ts` | PASS_VERIFIED — pausa/conclusão não creditam lacuna; conclusão incerta vai para `RECOVERY_REQUIRED` |
| E-09 | Conflitos preservam variantes | `session-conflicts.ts` | `f4-conflicts.test.ts` | PASS_VERIFIED |

## UX-20 — Fila de revisões

| ID | Requisito | Código | Prova | Status |
|---|---|---|---|---|
| R-01 | Fila contextual com filtros/estados | `ReviewWorkspace.tsx:150-270, 1150-1220` | `f7-ux-reviews-queue.spec.ts` (2 casos) | PASS_VERIFIED — atrasadas/hoje/futuras, edital, disciplina, ordenação por prioridade |
| R-02 | Abrir ≠ iniciar ≠ concluir ≠ avaliar | `ReviewWorkspace.tsx:588-615` | `f7-ux-reviews-queue.spec.ts`; `f5-review-service.test.ts` | PARTIAL — abrir não executa; não existe estado “revisão iniciada” |
| R-03 | Política versionada com prévia | `ReviewWorkspace.tsx:932-1030` | `f5-review-service.test.ts`; UI de impacto | PARTIAL — prévia por assunto bloqueia gravação; política base grava sem diff explícito |
| R-08 | Conteúdo arquivado/ausente tratado | `ReviewWorkspace.tsx` (links ativos) | testes F5 | PARTIAL — filtros usam vínculos ativos; conflito de importação ainda é mensagem genérica |

## UX-21 — Evidência e encaixe

| ID | Requisito | Código | Prova | Status |
|---|---|---|---|---|
| R-04 | Fatores explicados e amostra rastreável | `ReviewWorkspace.tsx` (lista de prioridade) | `f5-review-service.test.ts` | PARTIAL — fatores agora têm rótulo e explicação; vínculo por evidência ainda não é navegável |
| R-05 | Encaixe é prévia e respeita capacidade | `review-service.ts:890-990` | `f7-ux-review-placement.test.ts` (4 casos) | PASS_VERIFIED — sobreposição, meia-noite e capacidade; prévia não grava bloco |
| R-06 | Histórico de compromissos/versões | `ReviewWorkspace.tsx` | — | FAIL — sem visão de histórico de compromisso/política |
| R-07 | Integração F5→F3 por IDs | `review-service.applyPlacement` | `f5-review-service.test.ts` | PASS_VERIFIED |

## Lacunas exatas e próxima ação

1. **Disponibilidade persistida (P-04, P1)**: criar leitura/escrita de `planning_availability`, editor semanal com exceções e uso no wizard/calendário; hoje a constante em `PlanningWorkspace.tsx:53` ignora o que o usuário já configurou.
2. **Estado “revisão iniciada” (R-02, P1)**: persistir início explícito antes da avaliação; hoje abrir e concluir são os únicos estados visíveis.
3. **Diff da política base (R-03, P2)**: mostrar campos alterados antes de gravar a política global.
4. **Histórico de compromissos e conflito de importação (R-06/R-08, P2)**: visão de versões e mensagem específica por motivo.
5. **Inspetor de sessão (E-06, P2)**: detalhes, filtros por data/origem e visão de excluídos.
6. **Calendário mensal civil (P-03, P2)**: trocar a janela de 30 dias por mês alinhado ao calendário.

Nenhuma dessas lacunas foi mascarada como PASS. A Home em 320 px foi corrigida e está comprovada em `HOME-320-AUDIT.md`.


## Atualização integrada — HEAD 68e83479

| ID | Status | Evidência |
|---|---|---|
| P-01 | PARTIAL | metas semanais/progresso no painel; diagnóstico de capacidade ainda resumido |
| P-03 | PASS_VERIFIED | mês civil real, lista, não alocados e capacidade compartilhada |
| P-04 | PASS_VERIFIED | disponibilidade/exceções/metas persistidas e usadas por wizard/calendário/revisão |
| P-05 | PARTIAL | adiamento/suspensão/transição com prévia; encerramento ainda direto |
| P-06 | PARTIAL | checkpoint restaurável e rascunhos; comparação lado a lado pendente |
| P-09 | PARTIAL | jornada integrada e capacidade provadas; aceite único distribuído |
| E-06 | PASS_VERIFIED | filtros e inspetor de histórico de sessões |
| E-09 | PASS_VERIFIED | validação de alvo de alocação no serviço |
| R-02 | PASS_VERIFIED | startedAt durável, idempotente e separado da execução |
| R-03 | PASS_VERIFIED | prévia obrigatória da política base com STALE_POLICY |
| R-04 | PARTIAL | fatores explicados; navegação por amostra parcial |
| R-06 | PASS_VERIFIED | histórico, versões e links por ID |
| R-08 | PASS_VERIFIED | mensagens específicas de importação/conflito |

