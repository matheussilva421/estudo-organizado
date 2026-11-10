# Matriz F7-UX — UX-01 a UX-31 e AC-01 a AC-24

**Legenda:** `PASS_LOCAL` = implementação e teste local verificáveis; `PARTIAL_LOCAL` = comportamento local coberto com limitação documentada; `NOT_RUN` = gate externo/manual não executado. Nenhum `NOT_RUN` foi convertido em PASS.

## Tarefas do Writing Plans

| ID | Resultado | Evidência principal |
|---|---|---|
| UX-01 | PASS_LOCAL | preflight Git, baseline F6 preservado, `f7-ux-baseline.spec.ts`, hashes do bundle |
| UX-02 | PASS_LOCAL | `f7-ux-core-contracts.test.ts`; evidência em Home/Atenção/Configurações; snapshot e backup |
| UX-03 | PASS_LOCAL | `f7-ux-plan-execution-truth.test.ts`; vínculo não cumpre bloco; sessão isolada não é perfil vazio |
| UX-04 | PASS_LOCAL | `f7-ux-context-routes.test.ts`; recusa de ID inexistente em E2E; `overview` |
| UX-05 | PASS_LOCAL | `f7-ux-draft-navigation.spec.ts`; guarda existente e retorno de foco; diálogo modal acessível |
| UX-06 | PASS_LOCAL | `f7-ux-shell-navigation.spec.ts`; cinco destinos móveis; rail/sidebar; `Estudar` sem autostart |
| UX-07 | PASS_LOCAL | `f7-ux-core-contracts.test.ts`; `f7-ux-attention-analytics.spec.ts`; badge e identidade causal |
| UX-08 | PASS_LOCAL | busca agrupada em `SearchView`; E2E F6 de busca offline e isolamento de perfil |
| UX-09 | PASS_LOCAL | `f7-ux-dashboard-widgets.test.ts`; templates, persistência por dispositivo, mover e desfazer |
| UX-10 | PASS_LOCAL | `widget-queries`; catálogo interno; procedência, unidade e estado indisponível |
| UX-11 | PASS_LOCAL | `f7-ux-dashboard-widgets.test.ts`; parser declarativo sem `eval`/`Function` |
| UX-12 | PASS_LOCAL | `f7-ux-widget-filters.test.ts`; filtro global/local/grupo, inspetor e não mutação |
| UX-13 | PASS_LOCAL | cards e comandos explícitos; foco de procedência; testes de ação/render e regressões F2–F5 |
| UX-14 | PASS_LOCAL | explorador F2 reutilizado; navegação por ID, arquivo somente leitura e árvore incremental F6 |
| UX-15 | PASS_LOCAL | reordenação por drag/teclado, movimentação hierárquica, rejeição de ciclo e preservação de vínculos |
| UX-16 | PARTIAL_LOCAL | prévia de ativação, baseRevision, calendário em lista e não alocados provados em f7-ux-planning-workspace.spec.ts e f7-ux-planning-activation.test.ts; “mês” é janela de 30 dias e metas/progresso seguem ausentes. Ver UX16-UX21-TRACEABILITY.md |
| UX-17 | PARTIAL_LOCAL | prévia determinística, Reta Final e checkpoint restaurável cobertos; disponibilidade/exceções/metas editáveis continuam hardcoded (PlanningWorkspace.tsx:53) — P1 em aberto |
| UX-18 | PARTIAL_LOCAL | pausa/conclusão não creditam lacuna (f7-ux-session-integrity.test.ts); E2E F4 cobre foco, manual, duas abas e vínculo. Alocação valida soma e sessionId; existência/arquivamento só na UI |
| UX-19 | PARTIAL_LOCAL | recuperação sem tempo inventado provada; conflitos preservam variantes; falta inspetor/filtros de histórico — P2 |
| UX-20 | PARTIAL_LOCAL | filtros de fila, buckets e ordenação provados em f7-ux-reviews-queue.spec.ts; estado “revisão iniciada” não existe (P1) e diff da política base falta (P2) |
| UX-21 | PARTIAL_LOCAL | encaixe é prévia, recusa sobreposição e não grava antes de aplicar (f7-ux-review-placement.test.ts); fatores têm explicação, mas histórico de compromisso e rastro por evidência faltam |
| UX-22 | PASS_LOCAL | `f7-ux-analytics.test.ts` e `f7-ux-analytics-cache.test.ts`; medições/alocações invalidam cache |
| UX-23 | PASS_LOCAL | editor de métricas, validação de unidades, barras/linha e tabela equivalente |
| UX-24 | PASS_LOCAL | snapshot congelado em profundidade, exportação CSV/JSON com metodologia e escape de fórmula |
| UX-25 | PASS_LOCAL | perfil, vínculo e outbox separados; operações remotas reais `NOT_RUN` |
| UX-26 | PASS_LOCAL | cofre existente, prévia `SAFE`, rebaseline bloqueado, read-back e diálogo acessível; serviço real `NOT_RUN` |
| UX-27 | PASS_LOCAL | IndexedDB bloqueado, quota/estimativa, diagnóstico redigido, sem exclusão bruta; quota física `NOT_RUN` |
| UX-28 | PASS_LOCAL | oito temas, `--text-primary` corrigido, foco visível, reduced motion e contraste automatizado |
| UX-29 | PASS_LOCAL | `f7-ux-cross-module.spec.ts`, testes F2–F7, duas abas e offline em fake/local |
| UX-30 | PASS_LOCAL / A11Y_MANUAL_NOT_RUN | typecheck, lint, build, unit e E2E completos; NVDA/Narrator e hardware não executados |
| UX-31 | PASS_LOCAL | revisão independente solicitada, higiene Git, bundle, hashes e pacote de auditoria |

## Critérios de aceite

| AC | Resultado | Evidência |
|---|---|---|
| AC-01 | PASS_LOCAL | templates, editor, persistência e rejeição de fórmula |
| AC-02 | PASS_LOCAL | matriz de oito temas; contraste e foco F6/F7-UX |
| AC-03 | PASS_LOCAL | 320/390/desktop/tablet; screenshots e testes de overflow |
| AC-04 | PASS_LOCAL | rota por ID, perfil, arquivo e recusa de ID ausente; retorno por histórico |
| AC-05 | PASS_LOCAL | rascunho bloqueia navegação; cancelar mantém texto e foco no gatilho |
| AC-06 | PASS_LOCAL | árvore, reordenação, hierarquia e vínculos F2 |
| AC-07 | PASS_LOCAL | cenários e capacidade compartilhada F3 |
| AC-08 | PASS_LOCAL | sessão vinculada não declara bloco cumprido |
| AC-09 | PASS_LOCAL | tempo verificado/incerto e registro manual separados |
| AC-10 | PASS_LOCAL | fila F5 coerente com compromisso/execução |
| AC-11 | PASS_LOCAL | simulação e versão de política preservadas |
| AC-12 | PASS_LOCAL | gráfico e tabela usam as mesmas linhas/valores |
| AC-13 | PASS_LOCAL | amostra/stale não viram zero; testes explícitos de ausência |
| AC-14 | PASS_LOCAL | snapshot imutável reaberto com método/período e valores congelados |
| AC-15 | PASS_LOCAL | commit local + outbox pendente sem alegação de entrega |
| AC-16 | PASS_LOCAL | ACK sem cursor convergido aparece como estado parcial |
| AC-17 | PASS_LOCAL | backup parcial/prévia SAFE não são recuperabilidade integral |
| AC-18 | PASS_LOCAL | rebaseline/incompatibilidade bloqueia restauração direta |
| AC-19 | PASS_LOCAL | `BLOCKED_UPGRADE` sem exclusão automática |
| AC-20 | PASS_LOCAL | desvincular não apaga fatos; risco/pendências protegidos |
| AC-21 | PASS_LOCAL | identidade causal única e badge compartilhado |
| AC-22 | PASS_AUTOMATED / MANUAL_NOT_RUN | foco, rótulos, modal e contraste automatizados; NVDA/Narrator `NOT_RUN` |
| AC-23 | PASS_LOCAL | offline, quota/autenticação simuladas preservam locais e rascunhos |
| AC-24 | PASS_LOCAL | `overview` e links diretos cobertos |

## Gates externos

- G-EXT: `NOT_RUN`.
- G-STAGING: `NOT_RUN`.
- G-F7/UX-H: aceite humano `NOT_RUN`.
- F8/G-MAIN: não iniciados.
- Acessibilidade manual e hardware modesto: `NOT_RUN`.

## P/E/R da rodada integrada (HEAD 68e83479)

| ID | Status | Evidência |
|---|---|---|
| P-01 | PARTIAL | workspace, metas semanais e progresso em PlanningAvailabilityPanel; diagnóstico de capacidade ainda resumido |
| P-02 | PASS_VERIFIED | f7-ux-planning-workspace.spec.ts: prévia explícita, substituição visível, sem autoswap |
| P-03 | PASS_VERIFIED | calendário dia/semana/mês civil/lista; f7-ux-planning-calendar.test.ts; f3-journey |
| P-04 | PASS_VERIFIED | disponibilidade, exceções, metas e CAS em f7-ux-planning-availability.test.ts + E2E |
| P-05 | PARTIAL | adiamento/suspensão/transição com prévia; encerramento ainda direto |
| P-06 | PARTIAL | checkpoint restaurável e rascunhos; comparação lado a lado de revisões ainda resumida |
| P-07 | PASS_VERIFIED | f7-ux-plan-execution-truth.test.ts |
| P-08 | PASS_VERIFIED | baseRevision e STALE em ativação, encaixe e política |
| P-09 | PARTIAL | jornada integrada e capacidade compartilhada provadas; aceite único distribuído |
| E-01 | PASS_VERIFIED | f7-ux-shell-navigation; f4-timer-journey |
| E-02 | PASS_VERIFIED | f4-timer-journey; f4-pomodoro |
| E-03 | PASS_VERIFIED | f7-ux-session-integrity.test.ts |
| E-04 | PASS_VERIFIED | f4-manual.test.ts |
| E-05 | PASS_VERIFIED | f7-ux-plan-execution-truth.test.ts |
| E-06 | PASS_VERIFIED | f7-ux-sessions-history.spec.ts: filtros, inspetor, tempos separados |
| E-07 | PARTIAL | hábitos/metas existentes; consistência contextual ainda resumida |
| E-08 | PASS_VERIFIED | estados F4/F7 e fake remote; externo NOT_RUN |
| E-09 | PASS_VERIFIED | session-service valida sessionId, existência, arquivamento e vínculo |
| R-01 | PASS_VERIFIED | f7-ux-reviews-queue.spec.ts: filtros e prioridade |
| R-02 | PASS_VERIFIED | startedAt durável, idempotente, f7-ux-review-started.test.ts |
| R-03 | PASS_VERIFIED | prévia base obrigatória e STALE_POLICY em f7-ux-review-policy.test.ts |
| R-04 | PARTIAL | fatores explicados na UI; navegação por amostra/evidência ainda parcial |
| R-05 | PASS_VERIFIED | f7-ux-review-placement.test.ts: sobreposição, meia-noite, prévia vencida |
| R-06 | PASS_VERIFIED | histórico de compromisso, versões e links por ID |
| R-07 | PASS_VERIFIED | integração por IDs canônicos e applyPlacement |
| R-08 | PASS_VERIFIED | mensagens específicas de importação e conflito; variantes preservadas |
| R-09 | PARTIAL | fila e política coerentes; aceite final distribuído em testes |

