# Estudo Organizado V2 — F4: Execução, sessões, cronômetro e hábitos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **STATUS: `F4_PLAN_APPROVED_FOR_EXECUTION` — APROVADO PELO PROPRIETÁRIO EM 2026-10-30; execução autorizada pelo GOAL F4, com commits locais permitidos. Push, merge, deploy e integração remota continuam condicionados a autorização específica.** Elaborado em 2026-10-30; as decisões D-F4-01–21 e a especificação F4 foram aprovadas pelo proprietário; este *writing-plans* foi aprovado separadamente e incorporado ao repositório.

**Goal:** Implementar na V2 um domínio local-first de execução de estudo com tempo confiável, sessões cronometradas/manuais/Pomodoro, histórico, hábitos, vínculos F2/F3, recuperação e auditabilidade, sem perda ou contabilização silenciosa.

**Architecture:** Domínio puro TypeScript define estados e invariantes; serviços de aplicação coordenam comandos/consultas; um adaptador IndexedDB reutiliza operações, CAS, outbox e eventos da V2. Interface React somente despacha comandos e exibe estados persistidos. Checkpoints são durabilidade *local*, não writes remotos por pulso; fatos de execução são canônicos e suas projeções são regeneráveis.

**Tech Stack:** React 19, TypeScript 6, Vite 8, IndexedDB, Vitest 5 com fake-indexeddb, Playwright 1.64/Chromium; infraestrutura atual da branch `v2`, sem novas dependências salvo gate técnico fundamentado.

**Spec:** `docs/superpowers/specs/2026-10-30-estudo-organizado-v2-f4-execution-design.md` (**aprovada pelo proprietário em 2026-10-30 e incorporada ao repositório**, SHA-256 `5be103a6a48a29d91e26a0ca9b0da22c96fcb1536f789f173846b561a6e5d527` verificado). Não usar a proposta antiga `2026-10-28-...f4-execution-design.md` como substituta. Este documento ocupa `docs/superpowers/plans/2026-10-30-estudo-organizado-v2-f4-execution.md` e foi verificado com SHA-256 `a35881dc6e3cd71083ea61d81eded619f89f78ac23a27255c102d6a5a98ca8b7`.

**Baseline de referência (leitura em 2026-10-30):** `matheussilva421/estudo-organizado`, `origin/v2=68db01542a9d5934c7e45e622001334f91eaaf4f`, `main=9046cfa2283cd293b38df9d52fabfcd5de9ac67c` no último diagnóstico disponível; não assumir que esses SHAs permanecerão atuais. F3 `F3_ACCEPTED_WITH_RESERVATIONS`, F2 com ressalvas. Nenhum teste foi executado durante a elaboração do plano.

## Global Constraints

- **Gates:** plano e GOAL aprovados separadamente antes de escrever código; preservar `main`/V1, `v2` não publicada; push/integração `v2` **somente com autorização específica**. Proibir PRs/branches/Actions novos sem necessidade/autorização.
- **Preflight obrigatório na execução:** `git status --porcelain=v1`, `git branch -vv`, `git worktree list`, `git stash list`, `git log -1 --oneline`, `git fetch origin` seguro, verificar `main`, `origin/v2`, PRs/commits exclusivos e gates F2/F3. Desvios/dirty tree: preservar e parar para diagnóstico, nunca reset destrutivo.
- **Fonte:** usar `apps/v2/`, reusar `domain/planning-execution-contract.ts`, `domain/planning-time.ts`, `platform/indexeddb.ts`, `platform/content-migration.ts`, `platform/local-planning-repository.ts`, `platform/local-events.ts`, `platform/sw-update.ts`, `application/sync-types.ts` e contratos F1–F3. Arquivos listados abaixo são **alvos planejados**, não comprovadamente existentes.
- **Invariantes:** INV-01…INV-12 da spec são normativos. `D-F4-01..21` permanecem exatamente como aprovadas. Tempo medido, declarado e corrigido identificáveis por fato; lacunas não entram como tempo cronometrado; descanso não é estudo; sessão global única, mesmo multi-edital.
- **Sync:** local sem login; única outbox; intenção remota por mutação semântica, **não** por checkpoint periódico; modos remotos bloqueados até F7; não habilitar Firebase, credenciais, writes reais, jobs em background ou serviço pago.
- **Ambientes:** não migrar, acessar ou escrever dados V1 reais; ensaios com dados sintéticos, sem alterações em produção. Mudança de schema V2 exige upgrade aditivo, detecção de cliente antigo e teste de migração em cópia.
- **Sem valores inventados:** limiares de duração/inatividade e checkpoint são preferências configuráveis com validação e fixture nos testes; definir defaults somente por evidência/QA, nunca travar arbitrariamente estudos legítimos.
- **Qualidade:** TDD RED→GREEN→REFACTOR e teste regressivo por tarefa; commits locais pequenos só quando GOAL autorizado; `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:e2e` rodados de `apps/v2`. Não alegar PASS sem log real.
- **UX:** estados `não salvo`, `salvo neste dispositivo`, `sync pendente`, `conflito`, `recuperação necessária`; nada de `sincronizado` sem read-back real. QA A-01 Impeccable, 8 temas `grafite, ardosia, platina, terminal, neon, arrakis, codex, plasma`, desktop 1280, tablet 834 e mobile 390; verificar ferramenta/licença/hook antes de invocar; não instalar sem autorização.
- **Segurança:** notas/URLs/CSV não confiáveis; sanitizar UI/exports, proteger contra fórmula de planilha, sem tokens/corpo completo de notas em logs; importações emergenciais com preview, versão, idempotência e sem overwrite destrutivo.
- **Fronteiras:** F5 revisões/ inteligência, F6 dashboards/redesign, F7 Google/Firebase/backup produtivo/PWA integrados/migração, F8 cutover ficam fora. Quatro HIGH da F0 mantêm `UNVERIFIED`.
- **Resultado e evidência:** para cada F4-T01…T42 registrar fixture, comando, ambiente, observação, `PASS|FAIL|BLOCKED|INCONCLUSIVE|NOT_RUN`, referência ao commit; manter um registro de estado/aceite existente, sem relatórios redundantes.

## Review Focus — cinco falhas que não podem escapar

1. **Repetição após falha na conclusão:** mesmo `operationId` e payload não criam segundo intervalo, outbox ou revisão; payload divergente é erro — **Task 4 / F4-T02–04**.
2. **Retorno após suspensão ou tab obsoleta:** não reaproveitar origin de `performance.now()` nem autorizar writer revogado; lacuna explícita — **Tasks 3, 5, 7 / F4-T10–13, T20**.
3. **Conflito de duas versões offline e tombstone:** preservar duas versões, nunca somar as duas nem ressuscitar exclusão — **Task 15 / F4-T32–33**.
4. **CSV e importação maliciosos:** valores começando por `=,+,-,@` não executam fórmula e envelope importado não injeta perfil/nota/URL — **Tasks 17–18 / F4-T39–41**.
5. **Atualização PWA e IndexedDB antigo:** sessão/formulário não salvos impedem reload automático; cliente antigo não faz write incompatível — **Tasks 1, 19 / F4-T42**.

---

## Mapa de arquivos e fronteiras (proposta, revisar no HEAD antes de criar)

| Unidade | Arquivo-alvo | Responsabilidade única |
| --- | --- | --- |
| Contratos de sessão | `apps/v2/src/domain/session.ts` | Entidade, estados, scope, resultado, invariantes básicas |
| Cronometria | `apps/v2/src/domain/session-clock.ts` | Observação monotônica, continuidade, checkpoint/lacuna |
| Contabilização civil | `apps/v2/src/domain/session-accounting.ts` | Duração, alocações e repartição por data/fuso |
| Pomodoro | `apps/v2/src/domain/session-pomodoro.ts` | Foco/descanso e transições verificáveis |
| Métricas e materiais | `apps/v2/src/domain/session-measurements.ts` | Questões/acertos, páginas, referências e validação |
| Conflitos | `apps/v2/src/domain/session-conflicts.ts` | Comparação causal, merge seguro ou retenção explícita |
| Hábitos | `apps/v2/src/domain/session-habits.ts` | Meta, recorrência, evidências e ocorrência |
| Comandos | `apps/v2/src/application/session-service.ts` | Porta do domínio, coordenação de transições |
| Consultas | `apps/v2/src/application/session-queries.ts` | Histórico indexável, filtro, projeções |
| Exportação | `apps/v2/src/application/session-portability.ts` | CSV/JSON versionados e proteção de conteúdo |
| Emergência | `apps/v2/src/application/session-emergency.ts` | Exportar intenção não persistida, preview/import idempotente |
| Repositório | `apps/v2/src/platform/local-session-repository.ts` | Transações, CAS, audit, outbox e timer único |
| Abas | `apps/v2/src/platform/session-coordination.ts` | Fencing/lease e observação/takeover; não duplica outbox |
| Migração | `apps/v2/src/platform/indexeddb.ts`, `content-migration.ts`, `domain/versions.ts` | Novas stores/índices aditivos sob versão única |
| UI | `apps/v2/src/presentation/SessionWorkspace.tsx` e `components/Session*.tsx` | Fluxos de timer/manual/Pomodoro/recuperação/histórico/hábitos |
| Integração UI | `apps/v2/src/presentation/App.tsx`, `PlanningWorkspace.tsx` | Navegação e iniciar por ID do bloco F3 |
| PWA | `apps/v2/src/platform/sw-update.ts` | Atualização coordenada e bloqueio de reload inseguro |
| Testes | `apps/v2/tests/unit/f4-*.test.ts`, `apps/v2/tests/e2e/f4-*.spec.ts` | F4-T01–42; não apagar testes anteriores |

**Interface compartilhada obrigatória (a criar na Task 2):**

```ts
export type SessionState = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'RECOVERY_REQUIRED';
export type SessionOrigin = 'TIMER' | 'POMODORO' | 'MANUAL';
export type SessionScope = { profileId: string; operationId: string; baseRevision: number | null };
export type SessionOutcome<T> =
  | { kind: 'LOCAL_COMMITTED'; value: T }
  | { kind: 'INVALID'; code: string }
  | { kind: 'CONFLICT'; code: string }
  | { kind: 'FAILED'; reason: string };
export type ClockObservation = { contextId: string; monotonicMs: number; wallInstant: string };
export type SessionInterval = {
  id: string; kind: 'FOCUS'|'BREAK'; verifiedMs: number;
  contextId: string|null; checkpoint: ClockObservation|null;
  recoveryFlag: boolean;
};
export type StudySession = {
  id: string; profileId: string; state: SessionState; origin: SessionOrigin;
  localRevision: number; schemaVersion: number; referenceZone: string|null;
  recordedAtCivilDate?: string; manualDeclaredMs?: number;
  planBlockIds: string[]; editalIds: string[]; intervals: SessionInterval[];
  // Task 11 acrescenta allocations; Task 13, measurements/materials; Task 14, auditoria.
};
```

**Nota de tipos:** `ClockObservation` e `SessionInterval` ficam canônicos em `session.ts` (Task 2), e `session-clock.ts` (Task 3) os consome, sem duplicá-los. Campos de alocação, medições, materiais e revisões entram de modo aditivo nas tarefas proprietárias, não em modelos concorrentes.

**Interface compartilhada de escrita (Task 4):** `LocalSessionRepository.commit(input: SessionCommitInput): Promise<SessionOutcome<StudySession>>`; o discriminante `input.kind` é `CREATE|TRANSITION|CHECKPOINT|EDIT_FACTS|TOMBSTONE`, contém `scope: SessionScope`, `sessionId`, e payload tipado conforme operação. `LocalSessionRepository.load(profileId: string, sessionId: string): Promise<StudySession | null>`; métodos complementares são introduzidos e testados em cada tarefa dona. Comandos da Task 6+ chamarão essa porta, não escreverão IndexedDB diretamente.

## Rastreabilidade das 21 decisões na implementação planejada

| Decisão | Tarefa(s) principal(is) | Contrato verificável |
| --- | --- | --- |
| D-F4-01 | 3, 7, 20 | Recuperação assistida, sem tempo fictício |
| D-F4-02 | 5, 20 | Autoridade entre abas e fencing persistente |
| D-F4-03 | 8, 20 | Foco/descanso separados; descanso não soma |
| D-F4-04 | 10, 20 | Manual retroativo sem timer e com proveniência |
| D-F4-05 | 11, 12 | Tempo multiassunto, resto não atribuído |
| D-F4-06 | 6, 12, 20 | Conciliação explícita com F3, progresso parcial |
| D-F4-07 | 10, 12 | Estudo sem edital; vinculação posterior |
| D-F4-08 | 14, 21 | Nova revisão, snapshot anterior e tombstone |
| D-F4-09 | 16, 21 | Hábito independente e confirmação explícita |
| D-F4-10 | 9, 20 | Limite configurável com revisão assistida |
| D-F4-11 | 13 | Questões/acertos por conteúdo, não classificados |
| D-F4-12 | 15, 21 | Conflito multi-dispositivo fake, sem LWW |
| D-F4-13 | 8, 20 | Foco→descanso, descanso→foco só manual |
| D-F4-14 | 17, 21 | Histórico pesquisável e CSV/JSON |
| D-F4-15 | 4, 18, 20 | Não salvo + retry + exportação emergencial |
| D-F4-16 | 11 | Repartição por `CivilDate` e fuso IANA |
| D-F4-17 | 5, 6, 20 | Um timer ativo por perfil local |
| D-F4-18 | 3, 9, 20 | Segundo plano não é pausa automática |
| D-F4-19 | 3, 4, 7 | Checkpoints híbridos, sem outbox por tick |
| D-F4-20 | 13, 21 | Material por referência; sem copiar arquivo |
| D-F4-21 | 1, 19, 20 | Update PWA coordenado, sem reload inseguro |

## Sequência de execução — cada tarefa exige RED→GREEN→regressão→commit local (somente após GOAL)

### Task 1: Upgrade aditivo do IndexedDB V2 para fatos de F4

**Files:** Modify `apps/v2/src/domain/versions.ts`, `apps/v2/src/platform/indexeddb.ts`, `apps/v2/src/platform/content-migration.ts`; Test `apps/v2/tests/unit/f4-schema.test.ts`.

**Interfaces:** Consumes `openV2Database`, `upgradeV2Schema`, `STORES`, `LOCAL_DB_VERSION`; Produces stores `sessions`, `session_audit`, `session_control`, `session_conflicts`, `session_habits`, `habit_occurrences`, `session_emergency_receipts` e índices de perfil, período e estado; define chaves estáveis na migração em vez de espalhar strings.

- [ ] **Step 1: Escrever teste RED** `f4_upgrade_v3_to_v4_is_additive_and_preserves_f3` criando DB versão atual em fixture e confirmando que F2/F3/outbox/operations permanecem após abrir versão incrementada; `fresh_db_has_f4_indexes` e `older_tab_blocks_upgrade_without_writes` verificam índices/bloqueio. Não fixar a versão literal `4` se HEAD tiver avançado; testar `oldVersion→LOCAL_DB_VERSION`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-schema.test.ts` — esperado **FAIL** enquanto stores/upgrade faltarem.
- [ ] **Step 3: Implementar upgrade mínimo:** aumentar `LOCAL_DB_VERSION` em +1 sobre HEAD real; estender schema aditivo; manter índices e migrações F1–F3; evitar criar segunda outbox; bloquear cliente antigo via `BLOCKED_UPGRADE`.
- [ ] **Step 4: Executar GREEN/regressão:** comando da etapa 2 + `npm run test:unit -- tests/unit/f3-schema.test.ts tests/unit/f2-schema.test.ts tests/unit/versions.test.ts`; esperado **PASS** nos testes executados.
- [ ] **Step 5: Commit local, se autorizado:** `git add apps/v2/src/domain/versions.ts apps/v2/src/platform/indexeddb.ts apps/v2/src/platform/content-migration.ts apps/v2/tests/unit/f4-schema.test.ts && git commit -m "feat(v2-f4): add session storage schema"`.

### Task 2: Domínio de sessão e máquina de estados (F4-T01, T17)

**Files:** Create `apps/v2/src/domain/session.ts`; Test `apps/v2/tests/unit/f4-session-domain.test.ts`.

**Interfaces:** Produces `SessionState`, `SessionOrigin`, `SessionScope`, `SessionOutcome<T>`, `ClockObservation`, `SessionInterval`, `StudySession`, `validateSession(input: StudySession): StudySession`, `transitionSession(session: StudySession, next: SessionState): StudySession`. Future task types extend the session without mutating invalid states.

- [ ] **Step 1: Escrever RED** `allows_draft_running_paused_running_completed` (estados resultantes iguais à sequência esperada); `rejects_completed_to_running` (erro `INVALID_TRANSITION`); `rejects_nan_negative_and_infinite_duration` (`INVALID_DURATION`, nenhum estado alterado) e `manual_completed_without_running` (origem `MANUAL`, sem intervalo fictício).
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-session-domain.test.ts` — esperado **FAIL** por contrato ausente.
- [ ] **Step 3: Implementar:** transições por mapa explícito, validação de identidade/perfil/revisão/esquema/estado/durações, terminalidade do timer; `RECOVERY_REQUIRED` só sai por comando de resolução, não por simples reabertura.
- [ ] **Step 4: Executar GREEN:** mesmo comando; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/domain/session.ts apps/v2/tests/unit/f4-session-domain.test.ts && git commit -m "feat(v2-f4): model session lifecycle"`.

### Task 3: Relógio monotônico, checkpoints e lacunas (F4-T06, T10, T12–13)

**Files:** Create `apps/v2/src/domain/session-clock.ts`; Test `apps/v2/tests/unit/f4-clock.test.ts`.

**Interfaces:** Consumes `ClockObservation` da Task 2; Produces `ClockPort={observe():ClockObservation}`, `ContinuityPolicy={maxUnobservedGapMs:number; maxWallClockDriftMs:number}`, `inspectContinuity(previous:ClockObservation,current:ClockObservation,policy:ContinuityPolicy): {kind:'VALID'; elapsedMs:number}|{kind:'UNCERTAIN'; reason:string}`, `sumVerifiedFocusMs(intervals:SessionInterval[]):number`. Consome `SessionInterval` de `domain/session.ts` (Task 2), sem redefini-lo.

- [ ] **Step 1: Escrever RED** `wall_clock_jump_does_not_create_study_time` (monotonic delta 30_000, wall delta +3_600_000 ⇒ nunca contabilizar 3_600_000; se drift exceder policy, `UNCERTAIN`), `different_context_id_is_uncertain`, `pauses_exclude_unobserved_time`, `crash_preserves_only_last_durable_checkpoint` (último verifiedMs permanece 42 min; acréscimo de 3 min exige recuperação); `suspend_platform_is_not_assumed_pass` separa teste real de fixture.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-clock.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** validação numérica/ordem, continuidade no mesmo contexto, ancoragens de wall clock apenas para atribuição civil, sem diferenciar estudo de ausência por `visibilitychange`, limite configurável.
- [ ] **Step 4: Executar GREEN:** mesmo comando; esperado **PASS**; teste de suspensão física permanece gate próprio `INCONCLUSIVE/NOT_RUN` se não executado.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/domain/session-clock.ts apps/v2/tests/unit/f4-clock.test.ts && git commit -m "feat(v2-f4): verify clock intervals and checkpoints"`.

### Task 4: Repositório atômico e identidade de operação (F4-T02–04, T40)

**Files:** Create `apps/v2/src/platform/local-session-repository.ts`; Modify `apps/v2/src/application/sync-types.ts`; Test `apps/v2/tests/unit/f4-commit.test.ts`.

**Interfaces:** Produces `SessionCommitInput` discriminated union `CREATE|TRANSITION|CHECKPOINT|EDIT_FACTS|TOMBSTONE` with `scope: SessionScope`, `sessionId`, payload; `LocalSessionRepository.commit(input):Promise<SessionOutcome<StudySession>>`, `load(profileId,sessionId)`; extends `OutboxEntityType` with `study-session` (semantic mutations only) using existing single outbox and `deliveryMode:'BLOCKED'` pre-F7.

- [ ] **Step 1: Escrever RED** `replay_same_id_payload_creates_one_session_and_one_semantic_outbox` (contagens não mudam ao repetir), `same_id_different_payload_returns_INVALID_OPERATION_ID_REUSED`, `stale_revision_returns_CONFLICT_without_write`, `abort_and_quota_do_not_notify_or_claim_local_committed`, `checkpoint_does_not_enqueue_remote_mutation`. Fault injection deve usar ambiente de testes sem tocar dados reais.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-commit.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** transação IndexedDB abrangendo sessão, auditoria quando aplicável, `operations` existente e outbox para mudanças semânticas; digest da operação para replays; concluir transação antes de notificar; checkpoint local não escreve outbox em cada tick. Integrar `LocalPersistenceError` existente.
- [ ] **Step 4: Executar GREEN/regressão:** comando anterior + `npm run test:unit -- tests/unit/f3-commit.test.ts tests/unit/outbox-flush.test.ts` — esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/platform/local-session-repository.ts apps/v2/src/application/sync-types.ts apps/v2/tests/unit/f4-commit.test.ts && git commit -m "feat(v2-f4): persist sessions atomically"`.

### Task 5: Autoridade de aba, fencing e timer único (F4-T18–20)

**Files:** Create `apps/v2/src/platform/session-coordination.ts`; Modify `apps/v2/src/platform/local-session-repository.ts`, `apps/v2/src/platform/local-events.ts`; Test `apps/v2/tests/unit/f4-coordination.test.ts` (unitário/integração IndexedDB); E2E `f4-two-tabs.spec.ts` pertence à Task 20.

**Interfaces:** Produces `SessionAuthority={profileId:string; sessionId:string; holderId:string; generation:number}`, `acquireAuthority(sessionId,profileId,holderId,baseRevision,operationId):Promise<SessionOutcome<SessionAuthority>>`, `transferAuthority(...)` via transact repository; `subscribeSessionChanges(profileId,listener):()=>void`. Os escritores devem fornecer autoridade válida e revalidá-la na mesma transação que grava a sessão.

- [ ] **Step 1: Escrever RED** `two_tabs_only_one_authority`, `two_distinct_sessions_one_active_timer_per_profile`, `old_holder_rejected_after_assisted_transfer`, `broadcast_cannot_grant_authority`; a concorrência E2E com `context.newPage()` será adicionada na Task 20, após existir UI.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-coordination.test.ts` — esperado **FAIL** antes da implementação.
- [ ] **Step 3: Implementar:** Web Locks quando disponíveis para serializar intenção, **fencing/geração e CAS em transação IndexedDB** como autoridade final; `BroadcastChannel` notifica após commit; fallback sem Web Locks deve recusar takeover inseguro. Lease expirado nunca prova tempo estudado.
- [ ] **Step 4: Executar GREEN:** teste unitário/integração da etapa 2; esperado **PASS** e zero controladores obsoletos aceitos; E2E ficará para a Task 20.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/platform/session-coordination.ts apps/v2/src/platform/local-session-repository.ts apps/v2/src/platform/local-events.ts apps/v2/tests/unit/f4-coordination.test.ts && git commit -m "feat(v2-f4): coordinate exclusive session timers"`.

### Task 6: Casos de uso de início, pausa, conclusão e troca (F4-T05, T21)

**Files:** Create `apps/v2/src/application/session-service.ts`; Test `apps/v2/tests/unit/f4-session-service.test.ts`.

**Interfaces:** Produces `StudySessionService(repository:LocalSessionRepository,clock:ClockPort)`, methods `startSession(input:StartSessionInput):Promise<SessionOutcome<StudySession>>`, `pauseSession(input:SessionControlInput)`, `resumeSession(input:SessionControlInput)`, `completeSession(input:SessionControlInput)`, `switchActiveSession(input:{scope:SessionScope;fromSessionId:string;toSessionId:string;authority:SessionAuthority})`. Inputs incluem ID da atividade F3 opcional; interfaces consumidoras não escrevem no repositório.

- [ ] **Step 1: Escrever RED** `starting_from_block_links_by_opaque_id_without_completing_plan`, `switch_pauses_old_and_starts_new_in_one_transaction`, `double_complete_is_idempotent`, `failed_switch_leaves_original_timer_intact`. Usar clocks injetados e IDs sintéticos.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-session-service.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** serviço fino sobre comandos atômicos; `switchActiveSession` delega a uma única transação do repositório (`switchTimerAtomic`) sem duas gravações separadas; não marcar bloco F3 concluído automaticamente.
- [ ] **Step 4: Executar GREEN:** mesmo comando; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/application/session-service.ts apps/v2/src/platform/local-session-repository.ts apps/v2/tests/unit/f4-session-service.test.ts && git commit -m "feat(v2-f4): support session commands and safe switching"`.

### Task 7: Recuperação assistida após fechamento, suspensão e retomada (F4-T10–13)

**Files:** Modify `apps/v2/src/application/session-service.ts`, `apps/v2/src/platform/local-session-repository.ts`; Test `apps/v2/tests/unit/f4-recovery.test.ts`; E2E `f4-recovery.spec.ts` pertence à Task 20.

**Interfaces:** Produces `getRecoveryPreview(profileId,sessionId):Promise<RecoveryPreview>` com `durableVerifiedMs`, `uncertainIntervals`, `lastCheckpoint`, `allowedActions`; `recoverSession(input:{scope:SessionScope;sessionId:string;decision:'RESUME'|'COMPLETE'|'CORRECT_MANUALLY'|'KEEP_PENDING';manualAdjustmentMs?:number}):Promise<SessionOutcome<StudySession>>`.

- [ ] **Step 1: Escrever RED** `crash_restores_42min_plus_uncertain_3min`, `reload_does_not_auto_complete`, `stale_tab_cannot_recover_without_authority`, `manual_recovery_keeps_manual_provenance`; recuperação Playwright após fechar/reabrir página será criada na Task 20.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-recovery.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** preview lendo somente dados persistidos; resolução mediante comando auditado/CAS; separar lacuna de correção manual; não concatenar `performance.now()` de contextos distintos; sem presunção de timer com PWA fechada.
- [ ] **Step 4: Executar GREEN:** comando da etapa 2; esperado **PASS**; F4-T13 requer **teste real** ou status `INCONCLUSIVE` com razão e gate impactado.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/application/session-service.ts apps/v2/src/platform/local-session-repository.ts apps/v2/tests/unit/f4-recovery.test.ts && git commit -m "feat(v2-f4): recover interrupted sessions conservatively"`.

### Task 8: Pomodoro, foco, descanso e transição híbrida (F4-T07–09)

**Files:** Create `apps/v2/src/domain/session-pomodoro.ts`; Modify `apps/v2/src/application/session-service.ts`; Test `apps/v2/tests/unit/f4-pomodoro.test.ts`.

**Interfaces:** Produces `PomodoroConfig={focusMs:number;breakMs:number}`, `nextPomodoroStep(input:{stage:'FOCUS'|'BREAK';elapsedVerifiedMs:number;config:PomodoroConfig;continuity:'VALID'|'UNCERTAIN';authorityValid:boolean}):{kind:'BEGIN_BREAK'|'AWAIT_FOCUS_CONFIRMATION'|'RECOVERY_REQUIRED'|'CONTINUE'}`; stage change always persisted by session service.

- [ ] **Step 1: Escrever RED** `focus_25_break_5_counts_only_25_as_study` (fixture, não default), `valid_focus_completion_begins_break`, `break_end_requires_explicit_start`, `suspend_causes_recovery_not_auto_cycles`, `notification_failure_does_not_change_session`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-pomodoro.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** separar intervalos por tipo e estágio; transição atômica com authority/revision; alertas best-effort não autoritativos; valores configuráveis e validados.
- [ ] **Step 4: Executar GREEN:** mesmo comando; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/domain/session-pomodoro.ts apps/v2/src/application/session-service.ts apps/v2/tests/unit/f4-pomodoro.test.ts && git commit -m "feat(v2-f4): add safe pomodoro transitions"`.

### Task 9: Segundo plano, inatividade e limites configuráveis (F4-T14–17)

**Files:** Modify `apps/v2/src/domain/session-clock.ts`, `apps/v2/src/application/session-service.ts`; Test `apps/v2/tests/unit/f4-anomalies.test.ts`; E2E `f4-background.spec.ts` pertence à Task 20.

**Interfaces:** Produces `SessionReviewPolicy={maxUnobservedGapMs:number;anomalousDurationMs:number}`, `reviewDuration(input:{durationMs:number;policy:SessionReviewPolicy;source:'MEASURED'|'MANUAL'}):{kind:'VALID'|'REVIEW_REQUIRED'|'INVALID';code?:string}` e `flagInactiveSession(sessionId,observation):Promise<SessionOutcome<StudySession>>`.

- [ ] **Step 1: Escrever RED** `hidden_tab_does_not_pause`, `long_unobserved_interval_requests_review`, `eight_hour_legitimate_session_is_not_truncated`, `nan_negative_infinity_invalid`, `manual_confirmation_keeps_manual_source`; E2E com aba minimizada será criado na Task 20.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-anomalies.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** política por perfil validada, bandeira de revisão sem auto-pausa por visibilidade, resolução auditada, não inferir estudo/ausência; parâmetros calibráveis sem defaults rígidos injustificados.
- [ ] **Step 4: Executar GREEN:** comando da etapa 2; esperado **PASS**, com limites de background reais explicitamente apontados.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/domain/session-clock.ts apps/v2/src/application/session-service.ts apps/v2/tests/unit/f4-anomalies.test.ts && git commit -m "feat(v2-f4): review inactivity and anomalous duration"`.

### Task 10: Registro manual, data retroativa e sobreposição (F4-T22–23)

**Files:** Modify `apps/v2/src/application/session-service.ts`; Test `apps/v2/tests/unit/f4-manual.test.ts`.

**Interfaces:** Produces `registerManualSession(input:{scope:SessionScope;sessionId:string;civilDate:string;referenceZone:string;durationMs:number;note?:string}):Promise<SessionOutcome<StudySession>>`, `findPotentialOverlaps(profileId,civilDate):Promise<StudySession[]>` (alerta, não exclusão).

- [ ] **Step 1: Escrever RED** `retroactive_session_is_manual_without_monotonic_interval`, `manual_overlap_reports_warning_but_keeps_both_facts`, `invalid_civil_date_rejected`, `other_profile_not_visible`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-manual.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** usar `validateCivilDate` e fuso IANA explícito, registrar fonte manual e revisão, permitir sessão sem edital, expor aviso de sobreposição não destrutivo.
- [ ] **Step 4: Executar GREEN:** mesmo comando; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/application/session-service.ts apps/v2/tests/unit/f4-manual.test.ts && git commit -m "feat(v2-f4): record auditable manual sessions"`.

### Task 11: Alocação multiassunto e distribuição por dia civil (F4-T24, T34–35)

**Files:** Create `apps/v2/src/domain/session-accounting.ts`; Modify `apps/v2/src/domain/planning-execution-contract.ts`; Test `apps/v2/tests/unit/f4-accounting.test.ts`.

**Interfaces:** Produces `SessionAllocation={sessionId:string;allocationId:string;editalDisciplineId?:string;assuntoId?:string;aulaId?:string;durationMs:number}`, `allocateFocus(totalValidMs:number,allocations:SessionAllocation[]):{allocatedMs:number;unallocatedMs:number}`, `splitVerifiedTimeByCivilDate(intervals:SessionInterval[],zone:string):{byCivilDate:Record<string,number>;unassignableMs:number}`; **preservar assinatura e testes legados** de `summarizeExecutionLinks` F3.

- [ ] **Step 1: Escrever RED** `90min_50plus40_allocated_exactly`, `unallocated_remainder_preserved`, `sum_over_total_rejected`, `midnight_23_40_to_00_20_yields_20_and_20_when_anchors_valid`, `dst_fold_requires_explicit_offset`, `missing_temporal_anchors_remain_unassignable`; regressão F3 `one_session_serving_two_editais_counts_sixty_minutes`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-accounting.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** partilha por instantes ancorados verificáveis e `planning-time.ts`, não usar dia com 24h invariável; manter sessão sem edital e porção não atribuível; tempo global deduplicado por sessão/revisão.
- [ ] **Step 4: Executar GREEN/regressão:** teste novo + `npm run test:unit -- tests/unit/f3-f4-contract.test.ts tests/unit/f3-time.test.ts`; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/domain/session-accounting.ts apps/v2/src/domain/planning-execution-contract.ts apps/v2/tests/unit/f4-accounting.test.ts && git commit -m "feat(v2-f4): account study time by content and civil day"`.

### Task 12: Vínculos F2/F3 e conciliação assistida de blocos (F4-T25–28)

**Files:** Modify `apps/v2/src/application/session-service.ts`, `apps/v2/src/domain/planning-execution-contract.ts`; Test `apps/v2/tests/unit/f4-planning-links.test.ts`.

**Interfaces:** Produces `linkSessionToPlan(input:{scope:SessionScope;sessionId:string;blockIds:string[]}):Promise<SessionOutcome<StudySession>>`, `reconcilePlanProgress(input:{scope:SessionScope;sessionId:string;blockId:string;choice:'CONCLUDED'|'PARTIAL'|'NOT_APPLIED';planningBaseRevision:number}):Promise<{kind:'LOCAL_COMMITTED'|'CONFLICT'|'FAILED';planApplied:boolean}>`; consumes F2 `reconcileContentLinks` and F3 planning repository CAS.

- [ ] **Step 1: Escrever RED** `one_session_two_editais_still_60min_globally`, `standalone_link_later_preserves_session_id`, `several_partial_sessions_do_not_auto_complete_block`, `planning_conflict_keeps_session_committed_and_progress_pending`, `archived_F2_link_requires_reconciliation`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-planning-links.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** vínculo por ID com validação de escopo; conciliação F3 em comando explícito pós-salvamento, ou transação compartilhada quando comprovadamente segura; não prometer atomicidade entre duas operações sequenciais; oferecer pendência durável em conflito.
- [ ] **Step 4: Executar GREEN/regressão:** teste novo + `npm run test:unit -- tests/unit/f3-f4-contract.test.ts tests/unit/f3-content-links.test.ts tests/unit/f3-commit.test.ts`; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/application/session-service.ts apps/v2/src/domain/planning-execution-contract.ts apps/v2/tests/unit/f4-planning-links.test.ts && git commit -m "feat(v2-f4): reconcile execution with planning"`.

### Task 13: Questões, acertos, páginas, notas e referências de materiais (F4-T29–30, T38)

**Files:** Create `apps/v2/src/domain/session-measurements.ts`; Modify `apps/v2/src/application/session-service.ts`; Test `apps/v2/tests/unit/f4-measurements.test.ts`.

**Interfaces:** Produces `StudyMeasurement={id:string;sessionId:string;allocationId?:string;questions:number;correctAnswers:number;pages?:{from:number;to:number}}`; `StudyMaterialRef={id:string;kind:'PDF'|'VIDEO'|'BOOK'|'SITE'|'OTHER';title:string;catalogId?:string;url?:string;pages?:{from:number;to:number};videoRangeMs?:{from:number;to:number};notes?:string}`; `validateMeasurement(input:StudyMeasurement):StudyMeasurement`, `validateMaterialRef(input:StudyMaterialRef):StudyMaterialRef`, `summarizeMeasurements(measurements:StudyMeasurement[]):{questions:number;correctAnswers:number;unclassifiedQuestions:number}`. Campos opcionais não criam conteúdo F2 fictício.

- [ ] **Step 1: Escrever RED** `forty_questions_thirty_correct_are_counted_once`, `correct_31_of_30_is_invalid`, `unclassified_15_questions_stays_unclassified`, `page_range_38_before_12_invalid`, `unsafe_url_is_rejected`, `same_material_id_does_not_copy_pdf`. Sanitizar notas ao renderizar; não perder texto legítimo por transformações silenciosas.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-measurements.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** validação pura, IDs por medição, strings e URLs restritas a esquemas seguros; integrar `editSessionFacts` da aplicação com CAS e trilha (Task 14). Não armazenar blobs PDF ou buscar biblioteca externa.
- [ ] **Step 4: Executar GREEN:** comando anterior; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/domain/session-measurements.ts apps/v2/src/application/session-service.ts apps/v2/tests/unit/f4-measurements.test.ts && git commit -m "feat(v2-f4): record study measurements and material references"`.

### Task 14: Auditoria seletiva, edições e tombstones (F4-T31)

**Files:** Modify `apps/v2/src/platform/local-session-repository.ts`, `apps/v2/src/application/session-service.ts`; Test `apps/v2/tests/unit/f4-audit.test.ts`.

**Interfaces:** Produces `SessionAuditRecord={id:string;profileId:string;sessionId:string;operationId:string;baseRevision:number;newRevision:number;mutationKind:string;previousDigest:string;newDigest:string;before:SessionFactsSnapshot;after:SessionFactsSnapshot;source:'MEASURED'|'MANUAL'|'CORRECTED';reason?:string}` — snapshots/diffs auditáveis preservam os valores anteriores sem transformar digest em substituto do histórico, `editSessionFacts(input:{scope:SessionScope;sessionId:string;patch:SessionFactsPatch;reason?:string})`, `deleteSession(input:{scope:SessionScope;sessionId:string;reason?:string})`, `listSessionRevisions(profileId,sessionId):Promise<SessionAuditRecord[]>`; `SessionFactsPatch` só contém campos explicitamente editáveis de duração atribuída, nota, medição, vínculos e materiais.

- [ ] **Step 1: Escrever RED** `edit_90_to_70_preserves_original_measurement_and_new_revision`, `correction_source_is_not_measured`, `delete_creates_tombstone_not_physical_removal`, `stale_edit_conflicts`, `replay_delete_is_idempotent`, `archive_f2_reference_does_not_erase_history`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-audit.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** gravação atômica de nova revisão + trilha + tombstone existente quando aplicável; não introduzir event sourcing completo nem TTL de histórico; impedir efeitos de correção em F3 sem pedido explícito.
- [ ] **Step 4: Executar GREEN:** mesmo comando; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/platform/local-session-repository.ts apps/v2/src/application/session-service.ts apps/v2/tests/unit/f4-audit.test.ts && git commit -m "feat(v2-f4): audit corrections and soft deletion"`.

### Task 15: Conflitos offline simulados e preservação de variantes (F4-T32–33)

**Files:** Create `apps/v2/src/domain/session-conflicts.ts`; Modify `apps/v2/src/platform/local-session-repository.ts`; Test `apps/v2/tests/unit/f4-conflicts.test.ts`.

**Interfaces:** Produces `SessionConflict={id:string;profileId:string;sessionId:string;baseRevision:number;local:StudySession;incoming:StudySession;kind:'SAME_FIELD'|'DELETE_VS_EDIT'|'CAUSALITY'|'INVALID_LINK'}`, `reconcileSessionVersions(base:StudySession,local:StudySession,incoming:StudySession):{kind:'MERGED';session:StudySession}|{kind:'CONFLICT';conflict:SessionConflict}`, `resolveSessionConflict(conflictId,scope,choice):Promise<SessionOutcome<StudySession>>` (decisão humana auditada quando campo colide).

- [ ] **Step 1: Escrever RED** `two_offline_edits_to_same_duration_preserve_both_versions`, `delete_vs_edit_keeps_tombstone_and_variant`, `independent_notes_change_merges_only_with_proven_base_and_invariants`, `conflict_does_not_double_count_global_time`, `no_timestamp_last_write_wins`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-conflicts.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** fake concorrência causal sobre revisão-base e operação ID, persistindo variantes sem transferir conflito para Firebase; somente mesclar campos independentes quando preservados invariantes; manter flags nas consultas e proibir contabilização dupla.
- [ ] **Step 4: Executar GREEN:** mesmo comando + `npm run test:unit -- tests/unit/f2-conflicts.test.ts tests/unit/f3-merge.test.ts`; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/domain/session-conflicts.ts apps/v2/src/platform/local-session-repository.ts apps/v2/tests/unit/f4-conflicts.test.ts && git commit -m "feat(v2-f4): preserve offline session conflicts"`.

### Task 16: Hábitos, ocorrências e evidências derivadas (F4-T36–37)

**Files:** Create `apps/v2/src/domain/session-habits.ts`, `apps/v2/src/application/session-habit-service.ts`; Modify `apps/v2/src/platform/local-session-repository.ts`, `apps/v2/src/application/sync-types.ts`; Test `apps/v2/tests/unit/f4-habits.test.ts`.

**Interfaces:** Produces `StudyHabit={id:string;profileId:string;kind:'TIME'|'QUESTIONS'|'MANUAL';target?:number;referenceZone:string;recurrence:HabitRecurrence;localRevision:number}`, `HabitOccurrence={id:string;habitId:string;profileId:string;civilDate:string;confirmed:boolean;localRevision:number;sourceOperationId:string}`, `getHabitEvidence(habit:StudyHabit,sessions:StudySession[],date:string):{progress:number;targetMet:boolean;needsReview:boolean}`, `confirmHabitOccurrence(input:{scope:SessionScope;habitId:string;civilDate:string}):Promise<SessionOutcome<HabitOccurrence>>`. `HabitRecurrence` reutiliza representação de calendário da F3 onde adequada; decisão de granularidade deve preservar dia/semana explicitamente.

- [ ] **Step 1: Escrever RED** `two_hours_reached_only_suggests_confirmation`, `confirm_occurrence_is_independent_and_idempotent`, `evidence_edited_below_target_marks_review_without_erasing_confirmation`, `subjective_habit_remains_manual`, `midnight_timezone_uses_civil_dates`, `other_profile_cannot_confirm`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-habits.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** duas entidades canônicas, período estável por fuso, eventos de confirmação com CAS/outbox bloqueada, evidências derivadas de uma única versão por sessão; evitar marcação automática de hábito.
- [ ] **Step 4: Executar GREEN:** mesmo comando; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/domain/session-habits.ts apps/v2/src/application/session-habit-service.ts apps/v2/src/platform/local-session-repository.ts apps/v2/src/application/sync-types.ts apps/v2/tests/unit/f4-habits.test.ts && git commit -m "feat(v2-f4): track independent study habits"`.

### Task 17: Histórico indexável, consultas e portabilidade CSV/JSON (F4-T38–39)

**Files:** Create `apps/v2/src/application/session-queries.ts`, `apps/v2/src/application/session-portability.ts`; Modify `apps/v2/src/platform/local-session-repository.ts`; Test `apps/v2/tests/unit/f4-history.test.ts`, `apps/v2/tests/unit/f4-export.test.ts`.

**Interfaces:** Produces `SessionHistoryFilter={profileId:string;from?:string;to?:string;editalId?:string;assuntoId?:string;origin?:SessionOrigin;state?:SessionState}`, `querySessionHistory(filter:SessionHistoryFilter,cursor?:string,limit?:number):Promise<{items:StudySession[];nextCursor?:string}>`, `exportSessionHistory(format:'CSV'|'JSON',filter:SessionHistoryFilter):Promise<{fileName:string;mimeType:string;content:string}>`.

- [ ] **Step 1: Escrever RED** `filters_by_profile_date_edital_origin_and_state`, `stable_cursor_order_for_large_history`, `archived_references_remain_visible`, `csv_multi_edital_rows_do_not_repeat_global_minutes`, `formula_like_cell_is_escaped`, `json_has_schema_and_provenance_but_no_credentials_or_other_profile`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-history.test.ts tests/unit/f4-export.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** consultas por índices com paginação/cursor estável; CSV com escape contra fórmulas e cabeçalhos documentados; JSON versionado para **análise e portabilidade**, não formato de backup/restauração. Revisões e conflitos exibidos conforme critério da consulta.
- [ ] **Step 4: Executar GREEN:** mesmos testes; esperado **PASS**, com fixture de volume/paginação sem carregar indiscriminadamente todas as sessões.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/application/session-queries.ts apps/v2/src/application/session-portability.ts apps/v2/src/platform/local-session-repository.ts apps/v2/tests/unit/f4-history.test.ts apps/v2/tests/unit/f4-export.test.ts && git commit -m "feat(v2-f4): query and export session history"`.

### Task 18: Falha de commit, exportação e reimportação emergencial (F4-T40–41)

**Files:** Create `apps/v2/src/application/session-emergency.ts`; Modify `apps/v2/src/platform/local-session-repository.ts`; Test `apps/v2/tests/unit/f4-emergency.test.ts`; E2E `f4-failed-save.spec.ts` pertence à Task 20.

**Interfaces:** Produces `exportUnsavedSessionIntent(input:{formatVersion:number;command:SessionCommitInput;checkpoint?:unknown}):{fileName:string;content:string;digest:string}`, `previewEmergencyImport(raw:string,profileId:string):{kind:'READY'|'INVALID'|'CONFLICT';reason?:string;operationId?:string}`, `applyEmergencyImport(raw:string,scope:SessionScope):Promise<SessionOutcome<StudySession>>`. O recibo persistente em `session_emergency_receipts` co-commit com a operação, evitando reimportação duplicada.

- [ ] **Step 1: Escrever RED** `quota_abort_has_no_local_committed_badge`, `emergency_file_contains_unsaved_intent_not_fake_backup`, `download_failure_does_not_claim_export_success`, `reimport_twice_creates_one_session`, `import_stale_revision_does_not_overwrite_later_commit`, `untrusted_profile_schema_digest_and_url_rejected`.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-emergency.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** manter comando não salvo em memória apenas enquanto a aba existir; formato de emergência com versão, ID, integridade/digest validado e prévia; importar via mesma porta CAS e recibo atômico; não prometer proteção contra crash anterior à exportação ou salvar automaticamente arquivo sem confirmação do host/browser.
- [ ] **Step 4: Executar GREEN:** comando da etapa 2; esperado **PASS**; falhas browser de download não simuláveis devem ser `NOT_RUN/INCONCLUSIVE` documentadas, sem sucesso fictício.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/application/session-emergency.ts apps/v2/src/platform/local-session-repository.ts apps/v2/tests/unit/f4-emergency.test.ts && git commit -m "feat(v2-f4): export and recover unsaved session intents"`.

### Task 19: Atualização PWA coordenada sem interromper sessão (F4-T42)

**Files:** Modify `apps/v2/src/platform/sw-update.ts`; Test `apps/v2/tests/unit/f4-sw-update.test.ts`; E2E `f4-update.spec.ts` and integration in `App.tsx` belong to Task 20.

**Interfaces:** Produces `UpdateSafety={hasActiveSession:boolean;hasUnsavedForm:boolean;hasPendingRecovery:boolean;databaseCompatible:boolean;otherTabsReady:boolean}`, `canApplyV2Update(safety:UpdateSafety):{allowed:boolean;reason?:string}`, `requestSafeUpdate(registration:ServiceWorkerRegistration,safety:UpdateSafety):Promise<'APPLIED'|'DEFERRED'|'INCOMPATIBLE'|'FAILED'>`.

- [ ] **Step 1: Escrever RED** `active_session_defers_reload`, `unsaved_form_defers_update`, `incompatible_schema_disables_unsafe_writes`, `other_tab_not_ready_defers_update`, `safe_idle_update_can_proceed`, `sw_fetch_failure_does_not_end_session`; E2E de banner/reload será implementado na Task 20.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f4-sw-update.test.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** estender `sw-update.ts` sem recriar SW; usar guardas de sessão/compatibilidade e coordenação entre abas; migrações incompatíveis bloqueiam writes até recuperação, nunca `skipWaiting`/`location.reload` incondicionais; F7 conserva homologação global de versões/rollback.
- [ ] **Step 4: Executar GREEN:** teste unitário da etapa 2; esperado **PASS**. Teste PWA/E2E completo será executado na Task 20, quando a sessão ativa estiver na interface.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/platform/sw-update.ts apps/v2/tests/unit/f4-sw-update.test.ts && git commit -m "feat(v2-f4): defer unsafe PWA updates"`.

### Task 20: UI de sessões, timer, Pomodoro, manual e recuperação (F4-T05–17, T21–23)

**Files:** Create `apps/v2/src/presentation/SessionWorkspace.tsx`, `apps/v2/src/presentation/components/SessionTimer.tsx`, `apps/v2/src/presentation/components/SessionRecovery.tsx`, `apps/v2/src/presentation/components/SessionManualForm.tsx`; Modify `apps/v2/src/presentation/App.tsx`, `apps/v2/src/presentation/PlanningWorkspace.tsx`; Test `apps/v2/tests/e2e/f4-timer-journey.spec.ts`, `f4-planning-journey.spec.ts`, `f4-two-tabs.spec.ts`, `f4-recovery.spec.ts`, `f4-background.spec.ts`, `f4-failed-save.spec.ts`, `f4-update.spec.ts` (todos em `apps/v2/tests/e2e/`).

**Interfaces:** Consumes `StudySessionService`, `SessionHistoryFilter`, `getRecoveryPreview`, `SessionAuthority`; Produces `<SessionWorkspace profileId={...} content={...} locked={...} onNotice={...} />` e ação por bloco F3 `onStartPlannedBlock(blockId:string):void` via navegação/estado da apresentação (sem escrever F3 diretamente).

- [ ] **Step 1: Escrever RED** jornada F3→iniciar→pausar→retomar→concluir com `data-testid` estáveis; manual retroativo sem edital; Pomodoro foco→descanso→confirmação de próximo foco; recarga da página exibe `RECOVERY_REQUIRED` e tempo confirmado; segunda sessão exige confirmação e não sobrepõe timers; mensagem `não salvo` em erro; duas abas em `context.newPage()` verificam fencing; retorno de segundo plano não causa pausa; atualização SW não força reload.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:e2e -- tests/e2e/f4-timer-journey.spec.ts tests/e2e/f4-planning-journey.spec.ts tests/e2e/f4-two-tabs.spec.ts tests/e2e/f4-recovery.spec.ts tests/e2e/f4-background.spec.ts tests/e2e/f4-failed-save.spec.ts tests/e2e/f4-update.spec.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** componentes React enxutos, labels/aria, ações explícitas e mensagens coerentes; `locked`/DB upgrade impede writes; preencher dados existentes F2/F3 sem duplicá-los, acesso aos estados de commit somente via serviços. Evitar refatoração geral de `App.tsx` e `PlanningWorkspace.tsx`.
- [ ] **Step 4: Executar GREEN:** comando da etapa 2 e `npm run test:e2e -- tests/e2e/f3-journey.spec.ts`; esperado **PASS**.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/presentation/SessionWorkspace.tsx apps/v2/src/presentation/components/SessionTimer.tsx apps/v2/src/presentation/components/SessionRecovery.tsx apps/v2/src/presentation/components/SessionManualForm.tsx apps/v2/src/presentation/App.tsx apps/v2/src/presentation/PlanningWorkspace.tsx apps/v2/tests/e2e/f4-timer-journey.spec.ts apps/v2/tests/e2e/f4-planning-journey.spec.ts apps/v2/tests/e2e/f4-two-tabs.spec.ts apps/v2/tests/e2e/f4-recovery.spec.ts apps/v2/tests/e2e/f4-background.spec.ts apps/v2/tests/e2e/f4-failed-save.spec.ts apps/v2/tests/e2e/f4-update.spec.ts && git commit -m "feat(v2-f4): add execution workspace and timer journeys"`.

### Task 21: UI de histórico, hábitos, exportação e acessibilidade (F4-T26–28, T36–39, T42)

**Files:** Create `apps/v2/src/presentation/components/SessionHistory.tsx`, `apps/v2/src/presentation/components/SessionHabits.tsx`, `apps/v2/src/presentation/components/SessionExport.tsx`; Modify `apps/v2/src/presentation/SessionWorkspace.tsx`, `apps/v2/src/presentation/styles.css`; Test `apps/v2/tests/e2e/f4-history-habits.spec.ts`, `apps/v2/tests/e2e/f4-accessibility.spec.ts`.

**Interfaces:** Consumes query/export da Task 17, confirmação de hábitos da Task 16, revisão e conciliação das Tasks 12–15; componentes recebem callbacks de aplicação, não `IDBDatabase` nem sync raw.

- [ ] **Step 1: Escrever RED** E2E: lista/filtros consultam sessões do perfil, revisão aparece com proveniência, conflito F3 não apaga sessão, hábito atingido sugere mas **não confirma sozinho**, CSV/JSON gerados sem segredos, arquivo local referenciado não é importado; acessibilidade teclado/foco, `aria-live`, contraste e touch em 390/834/1280, oito temas, reduced motion/zoom 200%.
- [ ] **Step 2: Executar RED:** `cd apps/v2 && npm run test:e2e -- tests/e2e/f4-history-habits.spec.ts tests/e2e/f4-accessibility.spec.ts` — esperado **FAIL**.
- [ ] **Step 3: Implementar:** UI de histórico paginado com estados vazios/erro, drilldown de auditoria, confirmação de hábito, exportação explícita, mensagens `local/sync` verdadeiras; QA Impeccable conforme A-01 após verificar compatibilidade, escopo e autorização de hooks.
- [ ] **Step 4: Executar GREEN:** mesmos comandos + `npm run test:e2e -- tests/e2e/f3-t40-evidence.spec.ts` (captura condicional não deve ser tratada como executada se estiver skipped); esperado **PASS** para os cenários realmente rodados.
- [ ] **Step 5: Commit local:** `git add apps/v2/src/presentation/components/SessionHistory.tsx apps/v2/src/presentation/components/SessionHabits.tsx apps/v2/src/presentation/components/SessionExport.tsx apps/v2/src/presentation/SessionWorkspace.tsx apps/v2/src/presentation/styles.css apps/v2/tests/e2e/f4-history-habits.spec.ts apps/v2/tests/e2e/f4-accessibility.spec.ts && git commit -m "feat(v2-f4): surface history habits and accessible execution UI"`.

### Task 22: Regressão final, matriz de evidências, revisão independente e higiene Git

**Files:** atualizar `docs/superpowers/v2/ROADMAP.md` e **um único** relatório `docs/superpowers/audits/2026-10-30-v2-f4-acceptance.md` somente se a documentação de execução estiver autorizada. A F4 não tem atualmente esse relatório no repositório: se autorizado, **Create**, não **Modify**. Sem autorização, produzir o resultado fora do GitHub e manter o gate bloqueado. **Não criar testes artificiais de gate**: executar os testes reais das Tasks 1–21.

**Interfaces:** Consumes Tasks 1–21 e F4-T01–42; Produces evidências verificáveis com estados e SHAs, sem escrever em `main` nem marcar automaticamente `F4_ACCEPTED`.

- [ ] **Step 1: Reexecutar unitários e integrações reais:** `cd apps/v2 && npm run typecheck && npm run lint && npm run test:unit`; salvar exit codes, contagens e falhas; não fabricar PASS.
- [ ] **Step 2: Reexecutar E2E e build em HEAD final:** `cd apps/v2 && npm run test:e2e && npm run build`; teste de suspensão física F4-T13 executado e evidenciado ou `INCONCLUSIVE/NOT_RUN` com gate impactado; A-01 Impeccable/T42 com oito temas, três viewports, acessibilidade e status reais.
- [ ] **Step 3: Revisão independente técnica:** examinar contratos/código/todos testes F4-T01–42, fakes A-02, segurança, idempotência, storage, PWA e regressões F1–F3; corrigir falhas materiais com TDD nas tarefas proprietárias e reexecutar a suíte no novo HEAD.
- [ ] **Step 4: Auditar cobertura:** confrontar quatro requisitos F0, 21 decisões e INV-01–12 com código e resultados F4-T01–42; registrar fixture, comando, ambiente, evidência e `PASS|FAIL|BLOCKED|INCONCLUSIVE|NOT_RUN`; quatro riscos HIGH permanecem `UNVERIFIED`, ressalvas F2/F3 preservadas e A-02 sem produção.
- [ ] **Step 5: Inventariar Git/GitHub sem destruição:** HEAD, dirty tree, `origin/v2`, `origin/main`, branches locais/remotas, PRs, worktrees, stashes, arquivos temporários e commits exclusivos; não limpar itens com trabalho não integrado; nenhuma Action/CI nova.
- [ ] **Step 6: Preparar integração, sem presumir autorização:** entregar commits locais para `v2`; efetuar push fast-forward **apenas após autorização específica e revalidação remota**; nunca tocar `main`/V1, habilitar deploy ou declarar aceite humano.
- [ ] **Step 7: Relatório final honesto:** diferenciar `implemented/tested/reviewed/integrated/published/human-accepted`, com SHAs, pendências, riscos, branches/PRs restantes, bloqueios e próximo gate. Consolidar em registro existente, sem relatórios paralelos.

---

## Matriz F4-T01…T42 — alocação verificável de responsabilidade

| Critérios | Tarefa proprietária | Testes-alvo | Prova principal |
| --- | --- | --- | --- |
| F4-T01, F4-T17 | 2 | `f4-session-domain.test.ts` | Transições e validação numérica |
| F4-T02, F4-T03, F4-T04, F4-T40 (commit) | 4 | `f4-commit.test.ts` | Idempotência, CAS, atomicidade |
| F4-T05 | 6, 20 | `f4-session-service.test.ts`, `f4-timer-journey.spec.ts` | Início pelo ID do bloco F3 |
| F4-T06, F4-T10, F4-T12 | 3, 7 | `f4-clock.test.ts`, `f4-recovery.test.ts` | Tempo medido, clock divergente, checkpoint |
| F4-T07, F4-T08, F4-T09 | 8 | `f4-pomodoro.test.ts` | Descanso não somado; transição híbrida |
| F4-T11 | 7 | `f4-recovery.spec.ts` | Reload/crash e retomada assistida |
| F4-T13 | 3, 7, 22 | Protocolo físico + teste simulado | Evidência real ou `INCONCLUSIVE/NOT_RUN` explícito |
| F4-T14, F4-T15, F4-T16 | 9 | `f4-anomalies.test.ts`, `f4-background.spec.ts` | Segundo plano e revisão |
| F4-T18, F4-T19, F4-T20 | 5 | `f4-coordination.test.ts`, `f4-two-tabs.spec.ts` | Exclusividade e fencing |
| F4-T21 | 6 | `f4-session-service.test.ts` | Troca atômica de cronômetro |
| F4-T22, F4-T23 | 10 | `f4-manual.test.ts` | Registro retroativo/overlap |
| F4-T24, F4-T34–F4-T35 | 11 | `f4-accounting.test.ts` | Alocação e repartição civil |
| F4-T25, F4-T26, F4-T27, F4-T28 | 12 | `f4-planning-links.test.ts` | Multi-edital, parcial, conflito F3 |
| F4-T29, F4-T30 | 13 | `f4-measurements.test.ts` | Questões e classificação |
| F4-T31 | 14 | `f4-audit.test.ts` | Revisão, tombstones |
| F4-T32, F4-T33 | 15 | `f4-conflicts.test.ts` | Fakes offline, preservação de variantes |
| F4-T36, F4-T37 | 16 | `f4-habits.test.ts` | Ocorrência independente/evidência |
| F4-T38, F4-T39 | 13, 17, 21 | `f4-history.test.ts`, `f4-export.test.ts`, `f4-history-habits.spec.ts` | Índices, materiais, CSV/JSON |
| F4-T40, F4-T41 | 18 | `f4-emergency.test.ts`, `f4-failed-save.spec.ts` | Erro/quota e reimportação |
| F4-T42 | 19, 21, 22 | `f4-update.spec.ts`, `f4-accessibility.spec.ts` | SW, Impeccable, temas/dispositivos |

**Atenção:** a coluna de testes é planejamento, não relatório de execução. Nada foi rodado na elaboração deste documento.

## Ordem de dependência e gates (sem ramificações desnecessárias)

- **Base obrigatória:** Tasks 1→2→3→4→5→6→7. Tests de clock e domínio podem ser escritos antes de schema, mas a ordem documental evita dependência circular na integração.
- **Funcionalidades após a base:** 8→9→10→11→12→13→14→15→16→17→18. Quando invariantes e assinaturas estiverem estáveis, os arquivos podem ser tratados em sequência no mesmo worktree/branch, sem abrir PR por tarefa.
- **UI e fechamento:** 19→20→21→22. Corrigir falhas dentro da estrutura existente, sem criar worktrees/branches adicionais por rodada.
- **Gate 0:** plano revisado e aprovado pelo usuário; confirmar disponibilidade da spec aprovada no workspace do executor; GOAL de implementação **ainda separado**.
- **Gate 1:** preflight Git/GitHub e dependências F1/F2/F3. Não iniciar código se a `v2` estiver incompatível com a spec aprovada.
- **Gate 2:** TDD por tarefa + revisão de contratos e efeitos globais; lidar com erros críticos antes de ampliar UI.
- **Gate 3:** testes completos, F4-T01–42 com status reais, revisão independente, evidências A-01, riscos F0/F7 sem falsa mitigação.
- **Gate 4:** preparação da integração para `v2`; merge/push apenas após autorização específica, sem `main` ou deploy. Bloqueios devem ser explicitados e trabalho preservado.
- **Gate 5:** aceite humano F4 depois da comprovação; não confundir implementado, testado, integrado, publicado e aceito.

## Auto-revisão do writing-plans — checagens realizadas na elaboração

- **Cobertura da spec:** quatro requisitos F0, 21 decisões, INV-01..12, F2/F3, A-02, atualização PWA, hábitos, materiais, exportação/recuperação e riscos atribuídos a tarefas; F4-T01..42 rastreados na matriz.
- **Tipos e interfaces:** `SessionScope`, `SessionOutcome<T>`, `StudySession`, `SessionCommitInput`, `ClockPort`, `SessionAuthority`, `SessionAllocation`, `StudyMeasurement`, `SessionHistoryFilter` e `HabitOccurrence` têm tarefa proprietária. Nomes são alvos propostos, sujeitos à compatibilidade do HEAD; qualquer desvio material exige revisão da spec, não implementação improvisada.
- **Reuso:** não introduz nova outbox nem event sourcing global; novas stores apenas quando justificadas; não modifica produção V1. O `planning-execution-contract.ts` mantém a assinatura antiga e passa por regressão.
- **Review Focus:** os cinco modos de falha possuem testes específicos nas Tasks 1, 3–5, 7, 15, 17–19.
- **Proporção:** cada tarefa produz uma capacidade/teste independente. O plano define interfaces e comportamentos verificáveis, sem transcrever implementação.
- **Limitação desta revisão:** checagem de mesa feita com spec aprovada fornecida e leitura GitHub `origin/v2=68db015`; **nenhum subagente/revisor independente ou teste do aplicativo foi executado** nesta etapa de planejamento.

## Instruções de entrega e autorização

O presente writing-plans foi **aprovado pelo proprietário em 2026-10-30** e é executável no escopo do GOAL F4. A aprovação autoriza implementação e commits locais na `v2`; não autoriza push, integração remota, deploy ou publicação automática. O executor deve revalidar o HEAD e usar a especificação aprovada incorporada ao repositório. Não criar GitHub Actions, CI/CD, novos PRs ou branches sem necessidade justificada e autorização.
