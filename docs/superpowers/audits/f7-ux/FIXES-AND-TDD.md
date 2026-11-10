# Correções e TDD — F7-UX integrada

Base: 92d96016. HEAD de código: 68e83479. Diff: 26 arquivos, +2078/−96.

| Commit | Entrega |
|---|---|
| a5ff467f | disponibilidade persistida com CAS, exceções, meta semanal, minutos por disciplina e mês civil real |
| fb7c2f8e | estado durável de revisão iniciada, idempotente e separado da execução |
| e25e6ee7 | prévia da política base, filtros e inspetores de histórico de sessão e revisão |
| 32417120 | prévia e confirmação para adiar, suspender e transicionar a Reta Final |
| 68e83479 | jornada integrada F2→F6 e mensagens específicas de importação |

## P1

| Lacuna | RED | GREEN | Resultado |
|---|---|---|---|
| P-04 disponibilidade fixa | f7-ux-planning-availability.test.ts (roundtrip/CAS/inválidos) e E2E de persistência | PlanningAvailability + LocalPlanningRepository.load/saveAvailability; painel; wizard/calendário/revisão leem a mesma fonte | PASS_VERIFIED |
| R-02 sem revisão iniciada | f7-ux-review-started.test.ts e E2E de início durável | startedAt + histórico STARTED; startReview idempotente; filtro “Em andamento” | PASS_VERIFIED |
| E-09 alocação só na UI | caso de alvo ausente/arquivado/divergente em f7-ux-session-integrity.test.ts | validateAllocationTargets no serviço com consulta por perfil | PASS_VERIFIED |

## P2

| Lacuna | Teste | Correção | Status |
|---|---|---|---|
| P-03 mês de 30 dias | f7-ux-planning-calendar.test.ts (28/29/30/31 e virada de ano) | firstDayOfMonth/lastDayOfMonth no domínio; calendário usa meses reais | PASS_VERIFIED |
| P-05 mudança de prova direta | f3-final-stretch-ui.spec.ts (prévia sem commit) | preview + confirm para adiar/suspender/transicionar | PASS_VERIFIED |
| R-03 política base sem diff | f7-ux-review-policy.test.ts (STALE_POLICY) | prévia obrigatória campo a campo e applyPolicyChange | PASS_VERIFIED |
| R-06 histórico resumido | f7-ux-sessions-history.spec.ts; E2E de revisão | filtros de período/origem/estado e detalhes de intervalos/alocações/medições | PASS_VERIFIED |
| R-08 mensagem genérica | E2E de importação existente | rótulos específicos por motivo e mensagem de fila filtrada | PASS_VERIFIED |

Limitações mantidas: P-01 (diagnóstico de capacidade resumido), P-05 encerramento ainda direto, P-06 comparação lado a lado de revisões, R-04 navegação por amostra/evidência, R-09 aceite final distribuído.


Commits adicionais: da329670 (correções dos P1 da revisão: tempo verificado, escopo de prévia, CAS nulo, turnos e a11y) e 0c31e6ef (reconciliação das jornadas existentes e layout do painel no zoom).
