# Editor Inteligente da Reta Final — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Permitir consulta integral, edição individual e em massa, redistribuição assistida, importação supervisionada, histórico recuperável e sincronização segura do cronograma da Reta Final sem alterar retroativamente estudos realizados.

**Architecture:** Preservar \`state.planejamento\` como plano ativo e extrair serviços pequenos de domínio puro, projeção temporal, draft, commit, importação e merge. IndexedDB confirma alterações locais de modo transacional; o coordenador existente sincroniza após o commit. Interfaces acionam comandos validados e simulados, não fazem mutações diretas no planejamento.

**Tech Stack:** JavaScript ES modules nativos, HTML/CSS vanilla, IndexedDB, PWA/Service Worker, Firebase/Firestore já existente, Vitest, Playwright, ESLint, Prettier; sem novo framework ou serviço pago.

**Spec:** \`docs/superpowers/specs/2026-10-19-reta-final-editor-inteligente-design.md\` (PR #102, \`b54b6509e9ccab26fc373136c4f045280132b09f\`).

## Global Constraints

- **Gate:** este plano está em revisão humana; NÃO executar tarefas, alterar código, mesclar PR ou fazer deploy sem autorização separada do plano e do método de execução.
- Local-first: commit local confirmado em IndexedDB **antes** de notificar sucesso; Firestore é remoto primário quando habilitado; Cloudflare/Google Drive permanecem backup/restore manuais.
- Um só \`state.planejamento\` ativo; \`tipo === 'reta_final'\`; \`rfBlocoId\`, \`assId\` e \`aulaId\` persistem; estudo real, \`dataEstudo\`, questões, revisões e \`tempoAcumulado\` não são reescritos por ações de planejamento.
- Datas civis \`YYYY-MM-DD\` no fuso local; revisão humana do plano separada da projeção derivada por rollover/reconcile; intervalos fechados em \`retaFinal.dataFinal\`.
- JSON v1 continua aceito; novo JSON v2 traz identidade e proveniência; matching ambíguo pede decisão humana; nenhuma exclusão implícita em reimportação.
- Capacidade diária em minutos inteiros, dia livre com zero; prioridade de proposta \`0.50 × manual + 0.30 × peso de edital + 0.20 × dificuldade\`, fonte ausente neutra \`0.5\`, desempenho com amostra **mínima de 20 questões válidas**.
- Checkpoints manuais até exclusão explícita; até **20 automáticos por plano** sem descartar pendências, conflitos ou única cópia recuperável.
- UI em português (pt-BR), oito temas **Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex, Plasma**, contraste WCAG AA, alvo de toque **≥44px**, foco visível, teclado funcional, \`prefers-reduced-motion\`.
- Sem IA remota nem custo obrigatório adicional; reusar design tokens, dispatcher \`data-action\` e módulos existentes; mudanças de Service Worker exigem precache e bump conforme convenção.
- **TDD obrigatório:** para cada tarefa, demonstrar RED específico, corrigir até GREEN, executar regressões focadas, revisão independente e commit convencional. Não continuar com evidência inconclusiva. Baseline real no futuro workspace/worktree antes de implementar.
- **Isolamento na execução:** somente depois de autorizado, criar worktree via \`superpowers:using-git-worktrees\`; não executar sobre \`main\`, nem confundir plano documental com autorização de código.
- **Gate remoto especial:** não liberar sync v2 multidispositivo antes de comprovar bloqueio de cliente legado incompatível no servidor; se inviável no free tier, não liberar sync arriscado (fail-closed) e escalar ao humano.

## Review Focus

Cinco inputs prováveis que costumam passar despercebidos, com teste obrigatório no dono do código:

1. **Virada de dia/fuso local:** rascunho aberto às 23h59 e aplicado após meia-noite não pode materializar data vencida sem revisão; fixado em Task 2 (também Task 7).
2. **Nomes repetidos entre editais e aulas repetidas no mesmo edital:** o editor não escolhe a primeira correspondência; fixado em Task 4 e Task 10.
3. **Duplo clique/aplicação duplicada e concorrência entre abas:** mesmo \`operationId\`/draft publicado duas vezes não duplica bloco nem emite dois commits; fixado em Task 7.
4. **Assunto com 500+ caracteres ou texto com \`<script>\`:** painel mostra tudo como texto inerte, sem executar HTML; fixado em Task 14.
5. **Selecionar tudo sob filtro ativo:** seleção não inclui blocos ocultos até comando explícito “todo o cronograma”; fixado em Task 16.

---

## Sequência de dependências e gates intermediários

**Fase A — Fundamentos (Tasks 1–5):** identidade/migração, projeção temporal, comandos, catálogo e eventos puros. Gate A: testes existentes da Reta Final/Historico/Timer passam, sem alterações de estudos.

**Fase B — Persistência confiável (Tasks 6–8):** rascunhos, commit durável e checkpoints. Gate B: falhas de transação, quota e concorrência não corrompem dados; nenhum “salvo” antes de \`tx.oncomplete\`.

**Fase C — Planejamento e formatos (Tasks 9–10):** motor determinístico e JSON v2/merge supervisionado. Gate C: dados sem evidência geram score neutro; v1 conserva IDs após migração.

**Fase D — Multi-dispositivo (Tasks 11–13):** merge, protocolo remoto fail-closed e UX de conflito. Gate D: caos offline, versão incompatível e exclusão antiga não geram sobrescrita silenciosa.

**Fase E — UX (Tasks 14–17):** consulta, painel de edição, calendário/massa e fluxo de aplicação. Gate E: desktop/mobile/teclado/toque e compatibilidade dos fluxos atuais.

**Fase F — Homologação (Task 18):** testes ponta a ponta, documentação, evidências e aprovação humana separada. Nenhum gate implica merge automático.

Os módulos abaixo são nomes de interfaces planejadas; tarefas devem mantê-los consistentes, sem extrapolar o escopo. Código legado fora desses pontos só muda mediante necessidade demonstrada pelo teste.

### Task 1: Schema v2 e migração idempotente

**Files:**
- Create: \`src/js/logic/reta-final-schema.js\`
- Modify: \`src/js/store/migrations.js\`; \`src/js/logic/reta-final.js\`; \`src/js/store/indexeddb.js\` (somente boot/migration necessários)
- Test: \`tests/unit/reta-final-schema-v2.test.js\`; \`tests/unit/store-migrations.test.js\`; \`tests/unit/reta-final-activation.test.js\`

**Interfaces:**
- Produces: \`migrateRetaFinalV2(plan, { makePlanId, today }): { plan, changed, diagnostics }\`; \`validateRetaFinalV2(plan): { valid, errors }\`.
- Retains: IDs de bloco e catálogo, \`dataOriginal\`, \`rolagens\`, \`rfBlocoId\`; \`planId\` e \`schemaVersionRetaFinal: 2\`.
- Consumes: legado \`state.planejamento\` e IDs gerados uma vez durante migração persistida.

- [ ] **Step 1: Escrever RED** em \`tests/unit/reta-final-schema-v2.test.js\` para migrar bloco legado rolado (\`dataOriginal='2026-10-18'\`, \`data='2026-10-19'\`, \`rolagens=1\`) preservando \`id='rf_1'\` e definindo \`dataPlanejada='2026-10-18'\`; segunda migração não altera o resultado. Cobrir bloco sem dataOriginal, conclusão e IDs referenciados.
- [ ] **Step 2: Executar RED**: \`npx vitest run tests/unit/reta-final-schema-v2.test.js\`; esperado FAIL por função ausente.
- [ ] **Step 3: Implementar** ambas funções puras; integrar somente migração persistente em \`store/migrations.js\` e criação/importação em \`reta-final.js\`; aumentar \`DEFAULT_SCHEMA_VERSION\` apenas com teste de compatibilidade e preservação de versões antigas; nunca regenerar IDs por render.
- [ ] **Step 4: Executar GREEN**: mesmo teste + \`npx vitest run tests/unit/store-migrations.test.js tests/unit/reta-final-activation.test.js\`; esperado PASS, inclusive importação v1 existente.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): add versioned plan migration\`; anexar evidência da inalterabilidade de eventos.

### Task 2: Projeção temporal separada de autoria

**Files:**
- Create: \`src/js/logic/reta-final-schedule.js\`
- Modify: \`src/js/logic/reta-final-core.js\`; \`src/js/logic/reta-final.js\` (adaptação de rollover)
- Test: \`tests/unit/reta-final-schedule.test.js\`; \`tests/unit/reta-final-rollover.test.js\`

**Interfaces:**
- Consumes: plano v2 da Task 1 e \`occupiedBlocoIds\` de eventos preservados.
- Produces: \`projectRetaFinalSchedule(plan, { today, occupiedBlocoIds }): { blocos, alerts }\`; cada projeção tem \`dataEfetiva\`, \`categoriaTemporal\` e \`naoAlocado\`.
- Não modifica \`dataPlanejada\`, \`updatedAt\`, \`revision\`, nem eventos; legado v1 conserva rolagem anterior até migração.

- [ ] **Step 1: RED**: testes para pendente atrasado ir à projeção de hoje, fixado/reagendado não rolar, após \`dataFinal\` ser não coberto, status concluído vir de evento e virada local \`2026-10-19\`→\`2026-10-20\` sem desvio UTC. Confirmar plano de entrada byte-a-byte imutável.
- [ ] **Step 2: Executar RED**: \`npx vitest run tests/unit/reta-final-schedule.test.js\`; esperado FAIL pela função ausente.
- [ ] **Step 3: Implementar** projeção pura, compatibilizar as leituras legadas de \`bloco.data\` com a projeção sem criar ping-pong de \`updatedAt\`; distinguir atraso de “não alocado” e “não coberto”.
- [ ] **Step 4: GREEN**: rodar testes novos e \`tests/unit/reta-final-rollover.test.js\`; confirmar que zero mudanças derivadas incrementam revision.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): separate schedule intent from rollover\`.

### Task 3: Comandos puros com proteção do histórico

**Files:**
- Create: \`src/js/logic/reta-final-commands.js\`
- Modify: \`src/js/logic/reta-final-core.js\` (somente utilitários necessários)
- Test: \`tests/unit/reta-final-commands.test.js\`

**Interfaces:**
- Consumes: \`applyRetaFinalCommand(plan, command, { events, catalog, activeTimerIds, today, makeId }): { plan, diff, diagnostics, valid }\`.
- \`command: { operationId, type, blockIds?, patch?, targetDate?, targetOrder?, input? }\` com tipos \`CREATE|PATCH|MOVE|DUPLICATE|ARCHIVE|SET_DURATION|SET_PRIORITY|SET_CAPACITY|EXTEND_DEADLINE\`.
- Produces plano imutável e diff canônico \`{blockId, before, after, fieldsChanged}\`; sem write em store/DOM.

- [ ] **Step 1: RED**: testar MOVE mantendo id, DUPLICATE criando \`rf_novo\` sem sessão, ARCHIVE de estudado mantendo referência, erro estruturado para evento com timer ativo, e operação coletiva que falha inteira quando um alvo é protegido.
- [ ] **Step 2: Executar RED**: \`npx vitest run tests/unit/reta-final-commands.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** comando puro, validação de tipos/datas/minutos e preservação dos eventos. \`SET_CAPACITY\` só altera configuração; prorrogação explícita não altera \`config.dataProva\`.
- [ ] **Step 4: GREEN**: teste focado PASS; verificar que nenhum \`event.status\`, \`dataEstudo\` ou \`tempoAcumulado\` muda nas fixtures.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): add protected editor commands\`.

### Task 4: Catálogo acadêmico e resolução ambígua

**Files:**
- Create: \`src/js/logic/reta-final-catalog.js\`
- Test: \`tests/unit/reta-final-catalog.test.js\`
- Modify: \`src/js/logic/reta-final.js\` e \`src/js/logic/reta-final-commands.js\` (contrato de aplicação do catálogo)

**Interfaces:**
- Produces: \`resolveRetaFinalCatalog(catalog, { discId, assuntos, aulas, makeId }): { refs, createIntents, conflicts }\`.
- Usa \`normalizeNameKey\`, mas não escolhe automaticamente entre IDs homônimos; \`createIntents\` permanece no draft até commit.

- [ ] **Step 1: RED**: único assunto casa pelo ID; dois assuntos “Ação Penal” em editais distintos não se misturam; dois homônimos na mesma disciplina geram \`conflicts\` e **não** escolhem o primeiro; novo assunto gera apenas \`createIntent\` sem mutar edital.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-catalog.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** resolução pura e reconciliar input \`PATCH/CREATE\` da Task 3; nenhum \`createIntent\` materializado na chamada de render.
- [ ] **Step 4: GREEN** com ambos testes de comandos/catálogo; verificar não duplicar após repetir a mesma proposta.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): resolve catalog references safely\`.

### Task 5: Materialização pura dos eventos e integridade

**Files:**
- Create: \`src/js/logic/reta-final-events.js\`
- Modify: \`src/js/logic/reta-final.js\`; \`src/js/logic/reta-final-core.js\`
- Test: \`tests/unit/reta-final-events.test.js\`; regressões \`reta-final-sync-eventos\`, \`reta-final-quick-mark\`, \`reta-final-associar\`

**Interfaces:**
- Produces: \`rebuildRetaFinalAutoEvents(plan, events, { today, makeId }): { events, changed, diagnostics }\`.
- Consumes projeção da Task 2, respeita \`isAutoGenerated\`, \`rfBlocoId\`, \`status='estudei'\`, \`tempoAcumulado>0\`.
- Reconcile acadêmico é pós-merge/pós-commit, nunca marca plano concluído por alteração de texto.

- [ ] **Step 1: RED**: remover auto pendente obsoleto mas preservar evento com 1 minuto, preservar título e data de estudado, atualizar auto não preservado após MOVE, não ressuscitar arquivado, chamada dupla idempotente.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-events.test.js\`; esperado FAIL.
- [ ] **Step 3: Extrair** lógica pura de \`syncRetaFinalToEventos\` sem ciclo de import e adaptar wrapper existente, com agendamento de save apenas quando houver mudança real.
- [ ] **Step 4: GREEN**: testes novos e três suítes legadas especificadas; confirmar contrato de Timer e \`rfBlocoId\`.
- [ ] **Step 5: Revisar commit** \`refactor(reta-final): isolate event projection\`.

### Task 6: Rascunhos recuperáveis em IndexedDB

**Files:**
- Create: \`src/js/logic/reta-final-drafts.js\`; \`src/js/store/reta-final-draft-store.js\`
- Modify: \`src/js/store/indexeddb.js\` (adicionar as stores \`reta_final_drafts\` e \`reta_final_journal\` no mesmo upgrade DB_VERSION a 7); \`src/sw.js\` (precache quando aplicável)
- Test: \`tests/unit/reta-final-drafts.test.js\`; \`tests/unit/reta-final-draft-store.test.js\`

**Interfaces:**
- Pure: \`createRetaFinalDraft(plan, { draftId, now }): Draft\`; \`appendRetaFinalDraftOperation(draft, command, context): DraftResult\`; \`validateRetaFinalDraft(draft, currentPlan, context): {status,diff,errors}\`.
- IndexedDB: \`loadRetaFinalDraft(db, draftId)\`, \`saveRetaFinalDraft(db, draft)\`, \`discardRetaFinalDraft(db,draftId)\` com promises resolvidas só após \`tx.oncomplete\`.
- Draft fica separado de \`state.planejamento\` e não entra em sync remoto como plano aplicado.

- [ ] **Step 1: RED**: rascunho criado/reeditado sobrevive a reabertura da DB, \`baseRevision\` divergente vira \`stale\`, descarte não muda plano, falha de quota rejeita sem afirmar sucesso.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-drafts.test.js tests/unit/reta-final-draft-store.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** domínio puro e store IDB usando a instância DB atual, migração incremental e cleanup explícito; evitar dependência de sync remoto.
- [ ] **Step 4: GREEN** com testes novos e \`tests/unit/store-indexeddb-imports.test.js\`; conferir isolamento do estado oficial.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): persist isolated drafts\`.

### Task 7: Commit local durável, revisão e concorrência

**Files:**
- Create: \`src/js/store/reta-final-commit.js\`
- Modify: \`src/js/store/indexeddb.js\`; \`src/js/store.js\` (exposição mínima); \`src/js/logic/reta-final.js\`
- Test: \`tests/unit/reta-final-commit.test.js\`; \`tests/unit/store-reta-final-sync.test.js\`

**Interfaces:**
- \`commitRetaFinalDraft({ db, draftId, expectedPlanId, expectedRevision, context }): Promise<{ plan, revision, localCommitted, syncPending }>\`.
- Usa \`rebuildRetaFinalAutoEvents\` da Task 5 e intents de catálogo da Task 4 para construir **snapshot final completo**.
- Stores a persistir atomicamente: \`app_state\` (envelope current/previous e legado), \`reta_final_drafts\` (marca applied), \`reta_final_journal\` (checkpoint+operações) e intenção de outbox compatível. DB_VERSION=7 já criado na Task 6; criar stores faltantes no mesmo upgrade v7 da Task 6 (pré-requisito explícito).
- Só propagar estado à memória/notificar \`stateSaved\` depois da transação completa; nunca usar \`scheduleSave\` como prova de commit.

- [ ] **Step 1: RED**: CAS falha se revisão mudou; duas abas ou dois cliques com \`draftId/operationId\` repetidos produzem **um** commit; abort por falha em qualquer store deixa app_state antigo intacto; sucesso produz snapshot com eventos consistentes e status local.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-commit.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** transação única e recuperação determinística; não expor novo plano em \`state\` antes de \`tx.oncomplete\`; usar bloqueio/revisão persistida para corrida multiaba; se \`outbox\` remoto exigir pós-commit, registrar intenção atômica no journal e reconstituir idempotentemente a fila.
- [ ] **Step 4: GREEN** dos testes novos e \`tests/unit/store-reta-final-sync.test.js\`; simular quota/abort/aba concorrente e verificar não emitir “salvo” em falha.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): commit editor changes atomically\`.

### Task 8: Operações auditáveis, undo/redo e checkpoints

**Files:**
- Create: \`src/js/logic/reta-final-history.js\`; \`src/js/store/reta-final-history-store.js\`
- Modify: \`src/js/store/reta-final-commit.js\`; \`src/js/store/indexeddb.js\` (store da Task 7)
- Test: \`tests/unit/reta-final-history.test.js\`; \`tests/unit/reta-final-history-store.test.js\`

**Interfaces:**
- \`createRetaFinalCheckpoint(plan, {checkpointId, createdAt, kind, label?})\`; \`proposeRetaFinalRestore(plan, checkpoint, { blockIds?, events }): { operations, diff, diagnostics }\`; \`invertRetaFinalOperation(operation): command\`.
- Store: \`listRetaFinalCheckpoints(db,planId)\`, \`pruneRetaFinalCheckpoints(db,planId,{keepAutomatic:20})\`.
- Reverter/restore **volta ao draft** e reaplica por Task 7 com nova revisão.

- [ ] **Step 1: RED**: criar checkpoint pré-ação, restaurar só bloco \`rf_2\`, preservar sessão criada depois do checkpoint, manual protegido da compactação, 21º automático remove somente o mais antigo elegível; operação pendente ou conflito não pode ser eliminada.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-history.test.js tests/unit/reta-final-history-store.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** inversões e checkpoints no journal da Task 7, integridade/checksum, limpeza seletiva; histórico não modifica \`eventos\` históricos.
- [ ] **Step 4: GREEN** dos testes + \`tests/unit/backup-restore.test.js\`; conferir rollback sob falha.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): add safe history and checkpoints\`.

### Task 9: Motor determinístico de capacidade e prioridade

**Files:**
- Create: \`src/js/logic/reta-final-priority.js\`; \`src/js/logic/reta-final-redistribution.js\`
- Test: \`tests/unit/reta-final-priority.test.js\`; \`tests/unit/reta-final-redistribution.test.js\`

**Interfaces:**
- \`scoreRetaFinalBlock(block, { manual, editalWeight, maxEditalWeight, questions }): {score, reasons, sourcesUsed}\`.
- \`proposeRetaFinalRedistribution(plan, { today, capacityByWeekday, exceptionsByDate, pinnedBlockIds, evidence }): {operations, dailyLoad, unallocated, explanations, valid}\`.
- Produz apenas comandos da Task 3; nunca chama store/IA/rede.

- [ ] **Step 1: RED**: com manual=5→1, peso edital máximo e \`10/20\` questões, score \`0.50*1+0.30*1+0.20*0.5=0.90\`; com 19 questões desempenho é neutro; dia com \`0\` minutos fica vazio; bloco fixo não move; empate data/ordem/id reproduz mesmo plano.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-priority.test.js tests/unit/reta-final-redistribution.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** função de score e alocador estável, limites inteiros, dataFinal estrita, explicações e retorno de não alocados; nunca encurtar aulas silenciosamente.
- [ ] **Step 4: GREEN** com casos de inviabilidade e sem dados, ordem determinística em duas chamadas, contagem e duração invariantes.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): propose deterministic redistribution\`.

### Task 10: JSON v2, diff e importação supervisionada

**Files:**
- Create: \`src/js/logic/reta-final-portable.js\`; \`src/js/logic/reta-final-import-compare.js\`
- Modify: \`src/js/views/reta-final-import.js\`; \`src/js/logic/reta-final-core.js\`
- Test: \`tests/unit/reta-final-portable.test.js\`; \`tests/unit/reta-final-import-compare.test.js\`; \`tests/unit/reta-final-core.test.js\`

**Interfaces:**
- \`validateRetaFinalPortable(payload): {valid, version, errors}\`; \`exportRetaFinalPortable(plan): object\`; \`compareRetaFinalImport(plan, payload, { catalog, basePlan? }): {entries, conflicts, summary}\`.
- Entries: \`{kind:'CREATE'|'UNCHANGED'|'UPDATE'|'MOVE'|'ARCHIVE_CANDIDATE'|'CONFLICT', blockId?, proposed, reason}\`. Escolhas humanas são convertidas em comandos da Task 3 dentro de draft.

- [ ] **Step 1: RED**: JSON v1 reconhecido, v2 exportado/reimportado sem duplicar IDs, v1 com duas aulas de título idêntico cria conflito; JSON com IDs repetidos/referência quebrada é rejeitado; conteúdo ausente não remove bloco.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-portable.test.js tests/unit/reta-final-import-compare.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** codec versionado e diff; preservar importação inicial legada, desviando **atualização de plano existente** para a prévia e draft, nunca ativar diretamente em caso de conflito.
- [ ] **Step 4: GREEN** com novos testes, \`tests/unit/reta-final-core.test.js\` e \`tests/unit/reta-final-activation.test.js\`.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): add versioned portable schedule import\`.

### Task 11: Merge de três versões por bloco

**Files:**
- Create: \`src/js/logic/reta-final-merge.js\`
- Modify: \`src/js/sync/sync-center.js\` (delegação somente para mesmo planId v2)
- Test: \`tests/unit/reta-final-merge.test.js\`; \`tests/unit/store-reta-final-sync.test.js\`; \`tests/unit/sync-center.test.js\`

**Interfaces:**
- \`mergeRetaFinalPlans({basePlan,localPlan,remotePlan,events}): {plan,conflicts,appliedOperationIds}\`.
- \`conflicts\` inclui \`planId\`, \`blockId\`, \`fieldPath\`, \`base\`, \`local\`, \`remote\`, \`reason\`.
- Se \`basePlan\` indisponível, ou planId difere, devolver conflito **sem** LWW destrutivo para reta_final v2. Outros tipos mantêm regras existentes.

- [ ] **Step 1: RED**: bloco A movido em L e bloco B criado em R convergem; mesmo campo divergente conflita; ARCHIVE versus PATCH conflita; ID de operação repetido deduplica; sem base ou linhagens diferentes retorna conflito; merge de \`tipo='ciclo'\` mantém LWW legado.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-merge.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** merge puro de base verificada, revalidar capacidade e referências após mescla, integrar ao \`mergeStudyStates\` sem apagar \`planejamentoArquivado\` do lado vencedor na troca legítima de plano.
- [ ] **Step 4: GREEN** com testes de merge, sync-center e store; verificar reconcile de conclusão depois da fusão.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): reconcile plan edits by revision\`.

### Task 12: Protocolo remoto, retenção e barreira de compatibilidade

**Files:**
- Create: \`src/js/sync/reta-final-protocol.js\`
- Modify: \`src/js/sync/firestore-schema.js\`; \`src/js/sync/firestore-sync-engine.js\`; \`src/js/sync/sync-coordinator.js\`; \`src/js/sync/entity-migration.js\`; \`src/js/store/export-state.js\`; \`firestore.rules\` (quando regras reais puderem aplicar o precondition); \`docs/api/sync-contract.md\`
- Test: \`tests/unit/reta-final-protocol.test.js\`; \`tests/unit/firestore-schema.test.js\`; \`tests/unit/firestore-contracts.test.js\`; \`tests/e2e/sync-devices.spec.js\`; testes de integração das regras reais quando houver ambiente de teste seguro

**Interfaces:**
- \`validateRetaFinalRemoteWrite({clientCapabilities,remotePlan,localPlan,baseRevision}): {allowed,reason}\` e \`getRetaFinalSyncCapabilities(state): {schema,granularMerge,guards}\`.
- Guard obrigatório em caminho remoto real: versão/capability precondition verificável, inclusive para clientes antigos que enviem apenas snapshot v1; **não presumir que guard no frontend novo impede cliente antigo**.
- Tombstones do domínio mantêm linhagem/revisão; retenção antiga não torna uma exclusão “viva” novamente.

- [ ] **Step 1: RED**: tentativa de cliente v1 sobrescrever planId v2 é rejeitada pelo caminho de escrita efetivo; reenvio atrasado (>180 dias) não recria bloco; rejeição \`409\` preserva versão local; protocolo detecta duplicações e não promove \`synced\` sem ACK.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-protocol.test.js tests/unit/firestore-contracts.test.js\`; esperado FAIL ou gate de segurança inconclusivo que bloqueia ativação.
- [ ] **Step 3: Implementar** capability e comparação de revisão compatíveis com as Firestore Rules/worker realmente usados, snapshots fallback e entity-primary. Se impossibilidade de blindagem do cliente legado for constatada, implementar **fail-closed**: manter editor local e bloquear publicação remota insegura de v2; registrar impedimento para aceite humano, sem enviar dados para um destino não protegido.
- [ ] **Step 4: GREEN/GATE** com testes de contrato, engine e simulação realista de cliente antigo e offline; auditar consumos/quotas no free tier. **Sem prova do guard remoto, Task 12 não recebe PASS**.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): guard versioned sync against legacy writes\`; anexar evidências da barreira remota.

### Task 13: Resolução de conflitos e status de sincronização

**Files:**
- Create: \`src/js/views/reta-final-conflicts.js\`; \`src/js/ui/actions/reta-final-conflicts.js\`
- Modify: \`src/js/views/config/sync-center.js\`; \`src/js/sync/sync-status-ui.js\`; \`src/sw.js\` (precache)
- Test: \`tests/unit/reta-final-conflicts-ui.test.js\`; \`tests/unit/sync-center.test.js\`

**Interfaces:**
- \`renderRetaFinalConflictReview(conflicts): string\` (HTML escapado); \`resolveRetaFinalConflict(conflictId, {choice:'local'|'remote'|'manual',patch?})\` prepara nova operação no draft com checkpoint.
- Consome conflito da Task 11 e estado de ACK remoto da Task 12.

- [ ] **Step 1: RED**: comparar base/local/remoto, escolher local/remoto/manual gera draft sem alterar estudo histórico, cancelar mantém conflito, offline permanece “pendente”, ACK muda para “sincronizado” somente depois de confirmação.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-conflicts-ui.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** painel de conflito seguro e rotas delegadas, respeitando UX atual de Sync Center e bloqueio de push arriscado.
- [ ] **Step 4: GREEN** com teste novo e \`tests/unit/sync-center.test.js\`; conferir cancelamento e acesso por teclado.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): review merge conflicts explicitly\`.

### Task 14: Consulta integral e acessível dos assuntos

**Files:**
- Create: \`src/js/views/reta-final-detail.js\`
- Modify: \`src/js/views/reta-final-view.js\`; \`src/js/ui/actions/reta-final.js\`; \`src/css/views/reta-final.css\`; \`src/sw.js\`
- Test: \`tests/unit/reta-final-detail-view.test.js\`; \`tests/e2e/reta-final-editor.spec.js\`

**Interfaces:**
- \`renderRetaFinalBlockDetail(block, {disciplina,events,projection}): string\`; \`openRetaFinalBlockDetail(blockId): void\`.
- Delegated \`data-action='rf-open-detail'\` em botão nativo, inclusive card concluído.

- [ ] **Step 1: RED**: botão abre assunto inteiro com **mais de 500 caracteres**, \`<script>alert(1)</script>\` aparece como texto literal e nunca executa; Enter/Space acessíveis; clicar em quick-mark ou cronômetro não abre detalhes.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-detail-view.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** view enxuta, escape de conteúdo e botão Editar; no desktop drawer, no mobile tela/sheet; sem alterar objeto nem sessão.
- [ ] **Step 4: GREEN** com testes e \`tests/unit/reta-final-view-actions.test.js\`, \`tests/e2e/reta-final.spec.js\`.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): display complete block details\`.

### Task 15: Formulário individual integrado ao draft

**Files:**
- Create: \`src/js/views/reta-final-editor-form.js\`; \`src/js/ui/actions/reta-final-editor.js\`
- Modify: \`src/js/ui/actions/reta-final.js\`; \`src/css/views/reta-final.css\`; \`src/sw.js\`
- Test: \`tests/unit/reta-final-editor-form.test.js\`; \`tests/e2e/reta-final-editor.spec.js\`

**Interfaces:**
- \`renderRetaFinalEditorForm(draft, blockId, {catalog,projection}): string\`; \`handleRetaFinalEditField({draftId,blockId,field,value}): Promise<DraftResult>\`.
- Todos os campos fazem proposta da Task 3 e persistência da Task 6, não \`state.planejamento\`.

- [ ] **Step 1: RED**: alterar data/duração e assunto existente gera comando no draft; novo tópico gera createIntent; cancelar/fechar e reabrir restaura draft; bloco com timer ativo exibe restrição clara.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-editor-form.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** UI e ações delegadas, validação de minutos/data, sugestão de catálogo sem associação ambígua, debounce de edição sem sucesso falso.
- [ ] **Step 4: GREEN** com teste novo, regressão de UI, E2E de formulário e visual em oito temas.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): edit blocks through persistent draft\`.

### Task 16: Calendário visual e operações em massa

**Files:**
- Create: \`src/js/views/reta-final-planner.js\`; \`src/js/views/reta-final-bulk-actions.js\`; \`src/css/views/reta-final-editor.css\`
- Modify: \`src/js/views/reta-final-view.js\`; \`src/js/ui/actions/reta-final-editor.js\`; \`src/css/views.css\`; \`src/sw.js\`
- Test: \`tests/unit/reta-final-planner.test.js\`; \`tests/unit/reta-final-bulk-actions.test.js\`; \`tests/e2e/reta-final-editor.spec.js\`

**Interfaces:**
- \`renderRetaFinalPlanner(draft, {today,filter,selection}): string\`; \`createBulkRetaFinalCommand(selection,action,input): command\`.
- Seleção mantém \`visibleBlockIds\` separado de \`allBlockIds\`; drag-and-drop e comando por botão geram **o mesmo MOVE**.

- [ ] **Step 1: RED**: sob filtro Direito Penal, selecionar todos seleciona apenas visíveis; “todo o cronograma” expande explicitamente; drag e mover por teclado produzem comando idêntico; lote inválido não grava subset; duplicação em massa não clona sessões.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-planner.test.js tests/unit/reta-final-bulk-actions.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** grade dia/semana, seleção, atalhos e fallback de toque, ações de massa e alertas via motor das Tasks 3/9.
- [ ] **Step 4: GREEN** com unit + E2E desktop/mobile; validar foco, contraste, \`prefers-reduced-motion\`, touch ≥44px.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): add visual bulk planning\`.

### Task 17: Prévia unificada, aplicação e indicadores

**Files:**
- Create: \`src/js/views/reta-final-apply-preview.js\`; \`src/js/ui/actions/reta-final-apply.js\`
- Modify: \`src/js/views/reta-final-view.js\`; \`src/js/ui/actions/reta-final.js\`; \`src/js/views/reta-final-import.js\`; \`src/sw.js\`
- Test: \`tests/unit/reta-final-apply-preview.test.js\`; \`tests/e2e/reta-final-editor.spec.js\`; \`tests/unit/reta-final-view-dashboard.test.js\`

**Interfaces:**
- \`buildRetaFinalImpactPreview({basePlan,draft,events,today}): {diff,officialMetrics,simulatedMetrics,diagnostics}\`.
- \`applyRetaFinalDraftAction(draftId): Promise<{localCommitted,syncPending}>\` usa Task 7; importação/restauração/redistribuição também alimentam draft e passam pela mesma prévia.

- [ ] **Step 1: RED**: draft altera apenas KPI simulado; comparação lista horas/dias e blocos não alocados; botão Aplicar bloqueia em conflito; sucesso local exibe “aplicado localmente” e nunca “sincronizado” sem ACK; Cancelar mantém oficial intacto.
- [ ] **Step 2: Executar RED** \`npx vitest run tests/unit/reta-final-apply-preview.test.js\`; esperado FAIL.
- [ ] **Step 3: Implementar** prévia e operações finais, integrar renderizações com snapshot pós-commit, limpar draft apenas após durabilidade; revalidar data local e versão-base imediatamente antes do commit.
- [ ] **Step 4: GREEN** unit + E2E de importação/redistribuição/restore e regressões de dashboard, Calendário, Histórico, Timer.
- [ ] **Step 5: Revisar commit** \`feat(reta-final): preview and apply changes safely\`.

### Task 18: Homologação, recuperação e encerramento sem merge automático

**Files:**
- Modify: \`tests/e2e/reta-final-editor.spec.js\`; \`tests/e2e/reta-final.spec.js\`; \`docs/architecture/app-overview.md\`; \`README_DEV.md\`; \`src/sw.js\` (precache/version bump conforme regras do projeto)
- Create: \`docs/qa/reta-final-editor-acceptance-2026-10-19.md\`
- Test: todas as suites afetadas + \`npm test\`; \`npm run test:e2e:release\`; \`npm run test:design\`; \`npm run lint\`; \`npm run format:check\`; \`npm run bump:check\`.

**Interfaces:** matriz de requisitos D01–D13/AC01–AC22 ↔ teste/evidência/commit; status **PASS | FAIL | BLOCKED | NOT_RUN**. Não inventar pass/fail se indisponível.

- [ ] **Step 1: RED de aceite**: acrescentar cenários Playwright de v1→v2, reload de draft, consulta de texto longo, seleção filtrada, rollover à meia-noite, timeout/falha IDB, multiaba, dispositivo offline, cliente legado remoto, JSON ambíguo e restore pós-sessão; registrar teste inicialmente faltante como RED.
- [ ] **Step 2: Executar RED** \`npx playwright test tests/e2e/reta-final-editor.spec.js --project=chromium --reporter=line\`; esperado FAIL nos cenários ainda não cobertos, sem tratar falha de ambiente como produto.
- [ ] **Step 3: Completar** somente integrações ou documentação faltantes comprovadas; definir instruções de migração, compatibilidade, capacidade gratuita, rollback e atualização segura do Service Worker; executar revisão independente de design e integridade.
- [ ] **Step 4: GREEN/GATE**: comandos acima, mais caos offline/duas abas e navegador mobile em viewport; documentar evidências, baseline e exceções. Falha de barreira remota da Task 12 ⇒ **BLOCKED** para sync v2 multi-device.
- [ ] **Step 5: Revisar commit** \`test(reta-final): verify editor safety and acceptance\`; abrir PR de implementação apenas quando autorizado pelo usuário; solicitar **aceite humano explícito** antes de merge/release.

## Self-review e rastreabilidade

**Cobertura por requisito:** D01→T3/T14–17; D02→T14–16; D03→T3/T5/T7/T8; D04→T9/T17; D05→T3/T9; D06→T9; D07→T4/T15; D08→T11–13; D09→T7–8/T17; D10→T10/T17; D11→T6–7/T17; D12→T3/T16; D13→T2/T9/T17. Migração T1, integridade/eventos T5, QA final T18. AC01–AC22 possuem testes de Task 1–18 e correspondência obrigatória na matriz final.

**Type consistency:** \`planId/revision\` em T1, \`projectRetaFinalSchedule\` em T2, \`applyRetaFinalCommand\` em T3, \`resolveRetaFinalCatalog\` em T4, \`rebuildRetaFinalAutoEvents\` em T5, \`create/append/validateRetaFinalDraft\` em T6, \`commitRetaFinalDraft\` em T7, \`createRetaFinalCheckpoint\` em T8, \`scoreRetaFinalBlock/proposeRetaFinalRedistribution\` em T9, \`compareRetaFinalImport\` em T10, \`mergeRetaFinalPlans\` em T11, \`validateRetaFinalRemoteWrite\` em T12, UI T13–17. Instâncias concretas de banco, ids e clocks são injetados nos testes.

**Review Focus:** cinco casos estão ancorados nos testes das Tasks 2, 4/10, 7, 14 e 16. Nenhum teste pode ser declarado PASS sem execução/saída comprovada. A implementação dependerá de julgamento de integração onde o contrato real do armazenamento remoto exigir, preservando fail-closed se barreira não puder ser demonstrada.

**Proporção:** uma linha de decisão por interface/contrato, exemplos reduzidos aos valores determinantes da spec, sem copiar corpo do código de implementação.

## Execution Handoff — AGUARDANDO APROVAÇÃO

Esta publicação é o plano documental, não sua autorização. Após sua revisão, escolher modo de execução:

- **Subagent-driven (recomendado):** agente implementador isolado por task, revisão independente a cada tarefa e revisão integral da branch ao final; indicado pelo risco de perda de histórico e colisões multi-device.
- **Native:** implementação sequencial em uma única sessão, com revisão independente da branch ao final; reduz custo de contexto mas aumenta intervalo entre revisões.

**Nenhum código deve começar antes do aceite do plano e da escolha explícita do método.** O PR documental deste plano não deve ser mesclado automaticamente; PR #102 continua sendo a especificação-base aprovada, ainda sem merge.
