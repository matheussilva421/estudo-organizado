# Estudo Organizado V2 — F1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fundação React/TypeScript/Vite da V2 isolada da V1, com uma jornada mínima de disciplinas persistidas no IndexedDB, contratos locais/sync A-02, backup/tombstones, UI Impeccable A-01 e verificações locais reproduzíveis.

**Architecture:** Monólito modular em `apps/v2/`; domínio puro e tipado, comandos/consultas, adapters IndexedDB, clock/ID, sync simulado e backup. O IndexedDB próprio confirma alterações locais e outbox na mesma transação. Google Sign-In e Firestore Spark fazem parte dos contratos aprovados, mas **a F1 não acessará Firebase real nem homologará sincronização entre aparelhos**.

**Tech Stack:** React, TypeScript strict, Vite, IndexedDB nativo, Vitest, Playwright, ESLint escopado à V2 e Impeccable para revisão visual. Resolver versões compatíveis e fixá-las no lockfile **somente durante execução futura autorizada**, não neste planejamento.

**Spec:** `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f1-foundation-design.md`, **aprovada em 2026-10-28** com `docs/superpowers/specs/2026-10-28-v2-f1-architecture-decisions.md` (ADRs F1-01 a 05) e `docs/superpowers/specs/2026-10-28-v2-multidevice-sync-f1-contracts.md` (A-02).

**Status:** **G2/F1: PLANO PROPOSTO PARA REVISÃO HUMANA. NENHUMA IMPLEMENTAÇÃO AUTORIZADA.** A aprovação de spec/ADRs autoriza apenas escrever este plano.

## Global Constraints

- **V1 em produção:** `main` e root `src/**`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, `.impeccable/**`, `firestore.rules`, `.github/workflows/**`, root `package.json` e `package-lock.json`, Cloudflare/deploy, Service Worker e bancos da V1 são **somente leitura**. Nenhuma alteração de código, dados, configuração ou ambiente produtivo da V1.
- **Trabalhar na `v2`**, sem PR/branch extra por padrão; usar checkout/worktree isolado apenas quando necessário. Conferir antes de agir `main`/`v2` HEAD, status, branches, PRs, worktrees, commits exclusivos, deploy triggers e gates de retomada `AGENTS.md`. Não fazer merge para `main` ou deploy da V2.
- **F0 aprovada com ressalvas:** 35 `PRESERVE`, 10 `REFORMULATE`, laboratório `F-V1-VISUAL-LAYOUT-LAB` `UNDECIDED` e fora da F1. 4 HIGH `UNVERIFIED`, 107 E2E V1 FAIL, demais NOT_RUN/INCONCLUSIVE não se tornam verdes automaticamente.
- **Decisões D01–D27 + A-01 + A-02:** app independente React/TS/Vite, local-first IndexedDB, Firebase Auth/Google Sign-In e Firestore Spark como backend remoto único, sync **automático após primeiro opt-in** com pausa possível, custo recorrente obrigatório **R$ 0**, sem perda ou overwrite silenciosos.
- **Sem nuvem real nesta F1:** apenas contratos/doubles/fixtures sintéticas e emulador se posteriormente autorizado no plano e sem tocar projetos reais. Não habilitar billing, criar Cloud Functions, outro backend, GitHub Actions, CI/CD, publicar nem ler dados pessoais.
- **Separação total de origens:** V2 em `127.0.0.1:18431`, distinta da origem do mock V1 `127.0.0.1:18765` e da produção. IndexedDB `estudo-organizado-v2` e Service Worker restritos à origem V2. Não executar root `wrangler deploy`.
- **Dados e sync:** uma única outbox durável; transações locais atômicas; IDs de operação estáveis; ACK remoto só após commit confirmado/read-back; CAS, lock seguro, tombstone causal, rebaseline; não usar timestamps como vencedor de conflito.
- **A-01 Impeccable:** preservar oito temas Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex e Plasma, steel-blue, Plus Jakarta Sans + DM Mono; WCAG AA, teclado, touch, reduced-motion e correção da sobreposição de toasts **na V2**, não na V1. Instalação/hook mutante só com autorização.
- **Testes executados localmente pelo Codex**, TDD RED→GREEN e revisão independente proporcional ao risco. Nunca apresentar contrato fake como prova de sync Firestore real.
- **Higiene:** arquivos só de `apps/v2/` e do relatório/roadmap F1; não alterar root lock/config. Evitar relatórios paralelos, PRs proliferados e exclusão de branches/worktrees com commits únicos.
- **Gates:** F1 escrita/testada/integrada à `v2`/publicada são estados distintos. G2/F1 pendente de aprovação deste plano; G3/F1 precisa de autorização separada. Nenhuma fase F2 ou cutover é autorizada aqui.

## Review Focus

1. **Abort/quota no meio da gravação:** nem entidade nem outbox persistem, e UI não diz salvo — `transaction_failure_has_no_local_or_outbox_commit` (Task 4).
2. **Conta Google simulada diferente do perfil local:** vínculo exige preview e consentimento; acervos não se misturam — `link_requires_preview_and_explicit_consent` (Task 5).
3. **Timeout depois de commit remoto simulado:** read-back confirma operação sem duplo efeito; ACK incerto não avança — `timeout_after_commit_requires_readback_and_is_idempotent` (Task 7).
4. **Web Locks indisponível:** envio remoto suspenso, sem confiar só em BroadcastChannel — `no_web_locks_blocks_remote_flush_without_safe_fallback` (Task 8).
5. **Backup velho ou payload >1 MiB:** rebaseline e rejeição sem ressurreição/truncamento — `stale_backup_requires_rebaseline` (Task 10) e `oversize_remote_entity_is_rejected_without_truncation` (Task 9).

---

## File Structure — somente para futura execução após G3

| Arquivos previstos | Responsabilidade |
| --- | --- |
| `apps/v2/package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `index.html` | Build/dev/test/lint independentes da V1 |
| `apps/v2/src/main.tsx`, `src/presentation/App.tsx` | Bootstrap e shell React |
| `apps/v2/src/domain/subject.ts`, `versions.ts` | Entidade disciplina e versões de formatos V2 |
| `apps/v2/src/application/subject-service.ts`, `sync-types.ts`, `sync-policy.ts` | Comandos, portas, estados, perfis e consentimento |
| `apps/v2/src/platform/indexeddb.ts`, `local-subject-repository.ts`, `local-events.ts` | Persistência, atomicidade, outbox, quotas e atualização entre abas |
| `apps/v2/src/platform/sync/fake-remote.ts`, `flush.ts`, `coordination.ts`, `document-budget.ts` | Fake CAS, ACK, lock, limite de documento e orçamento |
| `apps/v2/src/platform/backup/format.ts`, `restore.ts` | Export, tombstones, integridade e preview seguro |
| `apps/v2/src/platform/legacy/recognize.ts` | Reconhecer schemas e planos legados somente leitura |
| `apps/v2/src/presentation/components/SubjectForm.tsx`, `SubjectList.tsx`, `SyncStatus.tsx`, `src/presentation/styles.css`, `tokens.css` | UI mínima e 8 temas |
| `apps/v2/public/manifest.webmanifest`, `public/sw.js`, `src/platform/sw-update.ts` | PWA e atualização isoladas |
| `apps/v2/tests/unit/*.test.ts`, `tests/e2e/*.spec.ts`, `tests/fixtures/*` | TDD e fixtures sintéticas |
| `docs/superpowers/audits/2026-10-28-v2-f1-acceptance.md` | Relatório canônico único de evidências F1 |
| `docs/superpowers/v2/ROADMAP.md` e issue `#108` | Marcar somente estado, bloqueio e próximo gate |

Se as ferramentas exigirem arquivos mínimos adicionais dentro de `apps/v2/`, registrar razão e verificar com revisor; não migrar a configuração raiz para suportar V2.

## Shared Interfaces — Contratos concretos entre as tarefas

Definir nomes e assinaturas **no código futuro** de modo compatível. Estes símbolos ainda **não existem**. Sem frameworks de estado/ORM desnecessários.

- `StudySubject = {id:string,profileId:string,title:string,localRevision:number}`. ID estável opaco, sem unicidade por título; timestamps nunca são revisão causal.
- `SubjectCommand = {operationId:string,profileId:string,subjectId:string,type:'create'|'rename',title:string}`.
- `applySubjectCommand(current:StudySubject|null, command:SubjectCommand):StudySubject`: pura, valida campos e transição, incrementa revisão uma vez.
- `SubjectRepository = {execute(cmd:SubjectCommand):Promise<StudySubject>;get(profileId:string,id:string):Promise<StudySubject|null>;list(profileId:string):Promise<StudySubject[]>}`.
- `OutboxOperation = {operationId:string,profileId:string,entityType:'subject',entityId:string,kind:'upsert'|'delete',baseRevision:number|null,payload:unknown,schemaVersion:number,status:'PENDING'|'CONFIRMED'|'CONFLICT'}`.
- `ProfileBinding = {profileId:string,uid:string|null,syncEnabled:boolean,state:'LOCAL_ONLY'|'LINKING'|'READY'|'PAUSED_AUTH'|'PAUSED_QUOTA'|'RECOVERY_REQUIRED'}`.
- `RemoteMutationPort = {apply(op:OutboxOperation):Promise<{kind:'APPLIED'|'ALREADY_APPLIED',remoteRevision:number}|{kind:'CONFLICT',remoteRevision:number}>;lookup(operationId:string):Promise<'APPLIED'|'MISSING'|'UNKNOWN'>}`. O fake valida escopo de usuário sem credenciais reais.
- `flushPending(ops:OutboxOperation[], remote:RemoteMutationPort):Promise<{confirmedIds:string[],conflicts:string[],pending:string[]}>`; exige prova de ACK; persistência local de ACK é responsabilidade do adapter IDB.
- `withSafeFlushLock<T>(lockName:string,task:()=>Promise<T>,locks:LockPort|null):Promise<{kind:'EXECUTED',value:T}|{kind:'BLOCKED'}>`. Fallback F1 sem Web Locks: `BLOCKED`, não executar remote flush.
- `BackupManifest = {formatVersion:number,domainSchemaVersion:number,recordCount:number,checksum:string,hasDeletionHistory:boolean}`; `previewRestore(input:unknown,currentEpoch:number):{kind:'SAFE'|'INVALID'|'REBASELINE_REQUIRED',reason?:string}`.
- `SyncHealth = {localCommitted:boolean,remoteCommitted:boolean,converged:boolean,pendingCount:number,mode:string,lastVerifiedCursor?:string}`; três confirmações não são intercambiáveis.

**Comandos padrão futuros (no root do repo):** `npm --prefix apps/v2 run typecheck`, `npm --prefix apps/v2 run lint`, `npm --prefix apps/v2 run test:unit -- tests/unit/<name>.test.ts`, `npm --prefix apps/v2 run test:e2e -- tests/e2e/<name>.spec.ts`, `npm --prefix apps/v2 run build`. O `package.json` da Task 1 deve implementar `typecheck=tsc --noEmit`, `test:unit=vitest run`, `test:e2e=playwright test`, `build=vite build`, `dev=vite --host 127.0.0.1 --port 18431 --strictPort` e `lint=eslint src tests`.

## Task 1: Ambiente independente, bootstrap e testes de arquitetura

**Files:**
- Create: `apps/v2/package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/presentation/App.tsx`.
- Test: `apps/v2/tests/unit/architecture-boundary.test.ts`; `tests/e2e/isolation.spec.ts`.

**Interfaces:** produz comandos npm V2 independentes, `App` raiz mínima e origem `127.0.0.1:18431`.

- [ ] **Step 1 — Preflight read-only:** verificar `git status --short`, `git rev-parse main`, `git rev-parse v2`, `git worktree list`, PRs/branches, hooks de deploy, `node --version`/`npm --version`, documentação canônica e gate `AGENTS.md`. STOP se proteção da V1 não for verificável.
- [ ] **Step 2 — RED:** criar teste `is_v2_independent_of_root_src_and_config` (nenhum import da root `src/` ou dependência SW/config V1); executar `npm --prefix apps/v2 run test:unit -- tests/unit/architecture-boundary.test.ts`; falha esperada por scaffold/export ausente.
- [ ] **Step 3 — Implementação mínima futura:** instalar deps **só após G3**, inspecionando hooks/lifecycle; criar React/TS/Vite/ESLint/Vitest/Playwright locais e `index.html` sem Firebase nem deploy.
- [ ] **Step 4 — GREEN:** rodar teste focal, `npm --prefix apps/v2 run typecheck` e `npm --prefix apps/v2 run build`; esperado exit 0.
- [ ] **Step 5 — Isolamento browser:** `npm --prefix apps/v2 run test:e2e -- tests/e2e/isolation.spec.ts` confirma origem separada, namespace IDB/SW diferente da V1.
- [ ] **Step 6 — Commit:** `git add apps/v2 && git commit -m "feat(v2): isolate React app and local test harness"`.

**Review:** arquivos/protocolos de produção V1 invariáveis, root package/lock intocados; Node compatível com versões fixadas.

## Task 2: Domínio disciplina e versões próprias

**Files:** Create `apps/v2/src/domain/subject.ts`, `versions.ts`; Test `apps/v2/tests/unit/subject.test.ts` e `versions.test.ts`.

**Interfaces:** produz `StudySubject`, `SubjectCommand`, `applySubjectCommand`; `DOMAIN_SCHEMA_VERSION`, `LOCAL_DB_VERSION`, `BACKUP_FORMAT_VERSION`, `SYNC_PROTOCOL_VERSION` independentes.

- [ ] **Step 1 — RED:** testes `rejects_blank_subject`, `id_is_not_title`, `rename_preserves_id_and_profile`, `increments_revision_once`, `independent_version_constants`; asserts de erro e campos exatos.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/subject.test.ts tests/unit/versions.test.ts`; imports/export ausentes falham.
- [ ] **Step 3 — Implementar:** validação pura sem React/IDB/Firestore; V2 com formato próprio inicialmente versionado, sem assumir V1 schema 12 ou DB 7.
- [ ] **Step 4 — GREEN:** testes focalizados e `npm --prefix apps/v2 run typecheck` PASS.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/domain apps/v2/tests/unit && git commit -m "feat(v2): define typed subject domain and independent versions"`.

**Review:** regras determinísticas; nomes iguais não se tornam a mesma entidade.

## Task 3: Repositório IndexedDB e outbox na mesma transação

**Files:** Create `apps/v2/src/application/subject-service.ts`, `sync-types.ts`, `src/platform/indexeddb.ts`, `local-subject-repository.ts`; Test `apps/v2/tests/unit/subject-service.test.ts`, `tests/e2e/idb-atomicity.spec.ts`.

**Interfaces:** implementa `SubjectRepository.execute/get/list`, `openV2Database(profileId):Promise<IDBDatabase>`, `getPendingOutbox(profileId):Promise<OutboxOperation[]>`. DB `estudo-organizado-v2`; stores `subjects`, `outbox`, `operations`, `profiles`, `meta`; escopo composto profileId+subjectId.

- [ ] **Step 1 — RED:** teste `duplicate_command_id_is_idempotent` e `wrong_profile_cannot_read_subject`; navegador `entity_and_outbox_commit_atomically`, `reload_restores_subject`.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/subject-service.test.ts` e `npm --prefix apps/v2 run test:e2e -- tests/e2e/idb-atomicity.spec.ts`.
- [ ] **Step 3 — Implementar:** IndexedDB nativo, índice por perfil, transação readwrite única para entidade/opID/outbox e rollback em abort; local-only não cria UID fake nem perde intenção de futura vinculação.
- [ ] **Step 4 — GREEN:** repetir comandos e typecheck; duplicação sem incremento extra.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/application apps/v2/src/platform apps/v2/tests && git commit -m "feat(v2): commit subjects and sync intentions atomically"`.

**Review:** teste de IndexedDB real no browser, não somente doubles.

## Task 4: Falhas de quota/abort, reload e atualização entre abas

**Files:** Modify `apps/v2/src/platform/indexeddb.ts` e `local-subject-repository.ts`; Create `src/platform/local-events.ts`; Test `apps/v2/tests/unit/local-errors.test.ts`, `tests/e2e/local-recovery.spec.ts`.

**Interfaces:** `LocalPersistenceError = {kind:'QUOTA'|'ABORT'|'UNAVAILABLE',recoverable:boolean}`; `subscribeLocalChanges(profileId,onChange):()=>void`. BroadcastChannel é **notificação**, não lock.

- [ ] **Step 1 — RED:** `transaction_failure_has_no_local_or_outbox_commit`, `quota_never_reports_success`, `two_tabs_observe_only_committed_changes`; injeção de abort/quota apenas em harness de teste local.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/local-errors.test.ts` e `npm --prefix apps/v2 run test:e2e -- tests/e2e/local-recovery.spec.ts`.
- [ ] **Step 3 — Implementar:** erros tipados, status não salvo, texto do formulário preservado em memória para tentativa explícita, evento após commit, unsubscribe correto; não apagar dados essenciais para liberar espaço.
- [ ] **Step 4 — GREEN:** repetir ambos; confirmar ausência de atualização parcial e ACK falso.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/platform apps/v2/tests && git commit -m "fix(v2): handle local commit failures without data loss"`.

**Review:** quota simulada ≠ teste de limite físico real; registrar limitação.

## Task 5: Perfil local, consentimento Google e estado da sincronização A-02

**Files:** Create `apps/v2/src/application/sync-policy.ts`; Modify `sync-types.ts`; Test `apps/v2/tests/unit/sync-policy.test.ts` e `profile-isolation.test.ts`.

**Interfaces:** `transitionSync(binding,event):ProfileBinding`; eventos `START_LINK`, `CONSENT_LINK(uid)`, `ENABLE_AUTO`, `DISABLE_AUTO`, `AUTH_EXPIRED`, `QUOTA_EXHAUSTED`, `RECOVERY_REQUIRED`. `previewLink(profileId,remoteSummary)` só gera prévia sintética sem merge.

- [ ] **Step 1 — RED:** `link_requires_preview_and_explicit_consent`, `logout_and_new_uid_do_not_mix_profiles`, `sync_auto_only_after_optin`, `local_without_google_is_available`, `converged_requires_verified_remote_cursor`.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/sync-policy.test.ts tests/unit/profile-isolation.test.ts`.
- [ ] **Step 3 — Implementar:** políticas e transições puras; sem Firebase SDK, OAuth real ou tokens; status separado `LOCAL_COMMITTED`/`REMOTE_COMMITTED`/`CONVERGED`; perfil diferente não recebe dados.
- [ ] **Step 4 — GREEN:** repetir testes e typecheck.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/application apps/v2/tests/unit && git commit -m "feat(v2): guard Google sync opt-in and profile binding"`.

**Review:** requisito A-02 representado; login ainda NÃO testado em serviços reais.

## Task 6: Fake remoto de CAS, deduplicação e concorrência

**Files:** Create `apps/v2/src/platform/sync/fake-remote.ts`; Test `apps/v2/tests/unit/remote-contract.test.ts`.

**Interfaces:** `FakeRemotePort implements RemoteMutationPort`; `apply`/`lookup`, revisão remota, opID estável; distingue `APPLIED`/`ALREADY_APPLIED`/`CONFLICT` e simula timeout após aplicar.

- [ ] **Step 1 — RED:** `duplicate_operation_has_one_remote_effect`, `stale_base_revision_conflicts`, `different_entities_converge_independently`, `timeout_after_commit_is_lookup_visible`, `wrong_uid_rejected`.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/remote-contract.test.ts`.
- [ ] **Step 3 — Implementar:** fake determinístico e transacional por operação e revisão; sem last-write-wins por timestamp; negar perfil/UID incorreto.
- [ ] **Step 4 — GREEN:** teste focal e typecheck; rotular resultado como **FAKE CONTRACT PASS**, não Firestore Rules PASS.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/platform/sync/fake-remote.ts apps/v2/tests/unit/remote-contract.test.ts && git commit -m "test(v2): model remote CAS and idempotency"`.

**Review:** nenhuma gravação Firestore/Cloudflare/Drive real.

## Task 7: Flush/ACK causal, read-back e conflitos persistidos

**Files:** Create `apps/v2/src/platform/sync/flush.ts`; Modify `src/platform/indexeddb.ts` e `src/application/sync-types.ts` se necessário; Test `apps/v2/tests/unit/outbox-flush.test.ts`.

**Interfaces:** `flushPending(ops,remote)` retorna IDs confirmados/conflitos/pendentes; `markConfirmed(profileId,ids,proof)` só ACK de operação efetivamente provada (commit ou read-back). Manter conflitos e sua proveniência em persistência local.

- [ ] **Step 1 — RED:** `timeout_after_commit_requires_readback_and_is_idempotent`, `ack_future_or_missing_operation_is_rejected`, `network_failure_keeps_outbox`, `concurrent_conflicting_edit_preserves_both_versions`.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/outbox-flush.test.ts`.
- [ ] **Step 3 — Implementar:** flush limitado, reconciliar timeout com lookup, marcar ACK de forma transacional, registrar conflito e deixar sem ACK o incerto.
- [ ] **Step 4 — GREEN:** testes focalizados, typecheck e simulação de dupla entrega.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/platform/indexeddb.ts apps/v2/src/platform/sync/flush.ts apps/v2/src/application/sync-types.ts apps/v2/tests/unit/outbox-flush.test.ts && git commit -m "feat(v2): verify sync ACK and preserve conflicting writes"`.

**Review:** o fato de o fake responder não comprova sincronia multi-dispositivo real.

## Task 8: Coordenação cross-tab com fallback seguro

**Files:** Create `apps/v2/src/platform/sync/coordination.ts`; Test `apps/v2/tests/unit/sync-coordination.test.ts`, `tests/e2e/sync-two-tabs.spec.ts`.

**Interfaces:** `LockPort.request<T>(name,fn)`, `withSafeFlushLock(name,task,locks)`; sem Web Locks a F1 retorna `BLOCKED` e não executa flush (até aprovar/testar fallback que prove fencing).

- [ ] **Step 1 — RED:** `one_flush_owner_across_two_tabs`, `no_web_locks_blocks_remote_flush_without_safe_fallback`, `lock_released_after_exception`, `broadcast_does_not_grant_lock`.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/sync-coordination.test.ts` e `npm --prefix apps/v2 run test:e2e -- tests/e2e/sync-two-tabs.spec.ts`.
- [ ] **Step 3 — Implementar:** Web Locks com chave V2+perfil, cancelamento/erro seguros e notificação facultativa; fallback F1 bloqueante, não lock em memória como garantia.
- [ ] **Step 4 — GREEN:** ambos os comandos; verificar duas abas na mesma origem V2 e apenas uma aplicação lógica.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/platform/sync/coordination.ts apps/v2/tests && git commit -m "feat(v2): serialize outbox flush across tabs"`.

**Review:** sem Web Locks, estudar localmente continua permitido; sync pendente é exibido.

## Task 9: Orçamento Firestore Spark e documento limitado

**Files:** Create `apps/v2/src/platform/sync/document-budget.ts`; Test `apps/v2/tests/unit/remote-budget.test.ts`; Modify `docs/superpowers/audits/2026-10-28-v2-f1-acceptance.md` (se ainda inexistente, criar somente relatório mínimo e ampliar no final).

**Interfaces:** `estimateRemoteEnvelopeBytes(record:unknown):number`, `validateRemoteDocument(record):{ok:boolean,bytes:number,reason?:'OVERSIZE'|'INVALID'}`, `estimateWorkload(entities:number,devices:1|2|3,changesPerDay:number)` com premissas explícitas. Rejeitar tamanho acima da **margem conservadora abaixo de 1.048.576 bytes** (limite teórico máximo de um doc Firestore).

- [ ] **Step 1 — RED:** `oversize_remote_entity_is_rejected_without_truncation`, `utf8_multibyte_counts_bytes`, `single_entity_edit_does_not_resend_archive`, `three_device_budget_has_explicit_cost_assumptions`.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/remote-budget.test.ts`.
- [ ] **Step 3 — Implementar:** validação conservadora e estimador; comparar **entidade por documento vs agregado delimitado** com fixtures sintéticas e 1, 2, 3 dispositivos; não presumir estimativa como custo faturado.
- [ ] **Step 4 — GREEN:** teste focal e registrar premissas/margem no relatório F1; não acessar console Firebase.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/platform/sync/document-budget.ts apps/v2/tests/unit/remote-budget.test.ts docs/superpowers/audits/2026-10-28-v2-f1-acceptance.md && git commit -m "test(v2): budget document size and Spark operations"`.

**Review:** risco de >1 MiB continua HIGH/UNVERIFIED até prova com schema/SDK/emulador pertinente.

## Task 10: Backups versionados, tombstones e rebaseline

**Files:** Create `apps/v2/src/platform/backup/format.ts`, `restore.ts`; Test `apps/v2/tests/unit/backup-format.test.ts`, `restore-preview.test.ts`.

**Interfaces:** `createBackupSnapshot({subjects,tombstones,versions})` com `BackupManifest`; `previewRestore(input,currentEpoch)` apenas valida e aponta `SAFE`/`INVALID`/`REBASELINE_REQUIRED`. Tombstone lógico `{profileId,entityId,operationId,baseRevision,epoch}`.

- [ ] **Step 1 — RED:** `backup_excludes_tokens`, `checksum_detects_truncation`, `deletion_history_survives_export`, `stale_backup_requires_rebaseline`, `preview_does_not_write_database`.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/backup-format.test.ts tests/unit/restore-preview.test.ts`.
- [ ] **Step 3 — Implementar:** formato/manifest próprio, integridade checksum (não assinatura), sem credenciais/caches, tombstones suficientes; histórico causal insuficiente => exigir rebaseline antes de sincronizar.
- [ ] **Step 4 — GREEN:** testes focalizados e typecheck, com backup completamente sintético.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/platform/backup apps/v2/tests/unit && git commit -m "feat(v2): define tombstone-safe versioned backups"`.

**Review:** não realizar restauração real de dados V1; o botão de recuperação completo fica para fase posterior.

## Task 11: Reconhecimento legado e regressão da issue #107 (somente leitura)

**Files:** Create `apps/v2/src/platform/legacy/recognize.ts`; Test `apps/v2/tests/unit/legacy-recognition.test.ts`; Create `apps/v2/tests/fixtures/reta-final-legacy-equivalent.json`, `reta-final-legacy-divergent.json`, `v1-schemas.json`.

**Interfaces:** `recognizeLegacyFormat(input):{kind:'V1_SUPPORTED'|'UNSUPPORTED'|'INVALID',schemaVersion?:number}` e `compareLegacyPlan(left,right):'EQUIVALENT'|'DIVERGENT'|'INCONCLUSIVE'`. Não inferir plano inexistente pela ausência de `schemaVersionRetaFinal`/`planId`/`revision`.

- [ ] **Step 1 — RED:** `legacy_without_v2_metadata_is_not_missing`, `180_equivalent_blocks_compare_without_overwrite`, `divergent_legacy_blocks_do_not_overwrite`, `schema_12_11_9_7_is_explicitly_classified`, `unknown_format_is_quarantined`.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/legacy-recognition.test.ts`.
- [ ] **Step 3 — Implementar:** reconhecimento puro de fixtures sintéticas, comparação semântica conservadora; sem ler IndexedDB ou remote V1, sem transformar/exportar dados reais.
- [ ] **Step 4 — GREEN:** teste focal, typecheck, evidenciar casos INCONCLUSIVE sem tratá-los como equivalentes.
- [ ] **Step 5 — Commit:** `git add apps/v2/src/platform/legacy apps/v2/tests/fixtures apps/v2/tests/unit/legacy-recognition.test.ts && git commit -m "test(v2): recognize legacy plans without data loss"`.

**Review:** risco #107 ainda HIGH/UNVERIFIED até homologação de migração/read-back isolado.

## Task 12: UI real mínima de disciplinas e Impeccable A-01

**Files:** Modify `apps/v2/src/presentation/App.tsx`; Create `apps/v2/src/presentation/components/SubjectForm.tsx`, `SubjectList.tsx`, `SyncStatus.tsx`, `src/presentation/styles.css`, `tokens.css`; Test `apps/v2/tests/unit/ui-state.test.ts`, `tests/e2e/subject-flow.spec.ts`, `visual-a11y.spec.ts`.

**Interfaces:** UI chama `SubjectRepository`, lê `SyncHealth`; exibe create/list/rename com commit real local, vazio/loading/erro; nunca dizer cloud sync quando apenas LOCAL_COMMITTED.

- [ ] **Step 1 — Pré-design:** ler `PRODUCT.md`, `DESIGN.md` e baseline Impeccable F0; verificar skill/CLI/hooks/telemetria antes de usar. Se exigir hook mutante não autorizado, registrar BLOCKED e não homologar UI.
- [ ] **Step 2 — RED:** `blank_title_blocked`, `quota_failure_preserves_input`, `local_only_never_says_cloud_synced`, `toast_does_not_cover_primary_button`, `keyboard_and_focus_accessible`, `eight_themes_sampled_AA`.
- [ ] **Step 3 — Verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/ui-state.test.ts` e `npm --prefix apps/v2 run test:e2e -- tests/e2e/subject-flow.spec.ts tests/e2e/visual-a11y.spec.ts`.
- [ ] **Step 4 — Implementar:** React form/list/status com repository real, tokens de oito temas, foco/labels/aria, touch e reduced motion; Impeccable critique/audit/adapt/harden/polish após verificar comandos reais; sem design genérico nem biblioteca excessiva.
- [ ] **Step 5 — GREEN:** testes focalizados, screenshots sintéticas nos 8 temas × 1440/834/390, contraste/teclado e relatório de achados Impeccable com gravidade; reconhecer limites de auditoria estática.
- [ ] **Step 6 — Commit:** `git add apps/v2/src/presentation apps/v2/tests && git commit -m "feat(v2): add accessible subject UI and eight-theme tokens"`.

**Review:** P1 de toast da V1 não se repete na V2; nenhum arquivo visual da V1 editado.

## Task 13: PWA isolada, E2E V2 e triagem focal E2E V1

**Files:** Create `apps/v2/public/manifest.webmanifest`, `public/sw.js`, `src/platform/sw-update.ts`; Test `apps/v2/tests/e2e/pwa-offline.spec.ts`, `v2-end-to-end.spec.ts`; Modify `apps/v2/playwright.config.ts` apenas se necessário.

**Interfaces:** manifest/SW exclusivos da origem V2, com ativação controlada durante formulários; harness Playwright executa contra `127.0.0.1:18431` e seed sintético. Não alterar root `src/sw.js` nem root `playwright.config.js`.

- [ ] **Step 1 — RED:** `v2_sw_scope_does_not_intersect_v1`, `offline_reload_preserves_committed_subject`, `unsaved_form_not_discarded_during_update`, `e2e_create_rename_reload`.
- [ ] **Step 2 — Verificar RED:** `npm --prefix apps/v2 run test:e2e -- tests/e2e/pwa-offline.spec.ts tests/e2e/v2-end-to-end.spec.ts`.
- [ ] **Step 3 — Implementar:** manifest e cache de app-shell mínimos; update não interrompe formulário/sessão crítica, sem background sync presumido.
- [ ] **Step 4 — GREEN:** repetir E2E em navegador real, com SW habilitado para teste PWA; documentar cenários em que SW é bloqueado no teste.
- [ ] **Step 5 — Triagem V1 somente leitura:** reproduzir pela configuração lida que `npm run test:e2e:mock` aponta para spec ignorada no projeto `mock`; amostrar os 107 FAIL de `test:e2e:mock:all` por fixture, harness, timeout SW e defeito observado **sem modificar V1 nem alegar diagnóstico de todos**. Registrar número de casos classificados/indefinidos.
- [ ] **Step 6 — Commit:** `git add apps/v2/public apps/v2/src/platform/sw-update.ts apps/v2/tests/e2e docs/superpowers/audits/2026-10-28-v2-f1-acceptance.md && git commit -m "test(v2): validate isolated PWA and E2E recovery"`.

**Review:** nenhum deploy/publish de service worker V2; legacy 107 FAIL permanecem como evidência.

## Task 14: Verificação completa, revisão independente, Git hygiene e gate humano

**Files:** Modify `docs/superpowers/audits/2026-10-28-v2-f1-acceptance.md`, `docs/superpowers/v2/ROADMAP.md`; issue `#108` (status somente).

**Interfaces:** `F1_READY_FOR_HUMAN_REVIEW` ou `F1_BLOCKED` em relatório, nunca autoproclamar aprovação humana.

- [ ] **Step 1 — Regressão local V2:** rodar `npm --prefix apps/v2 run typecheck`, `npm --prefix apps/v2 run lint`, `npm --prefix apps/v2 run test:unit`, `npm --prefix apps/v2 run test:e2e`, `npm --prefix apps/v2 run build`; guardar outputs reais e ambientes, marcar FAIL/NOT_RUN corretamente.
- [ ] **Step 2 — Revisão independente:** fronteiras de domínio, Atomic IDB, UIDs, ACK dedup, recovery, XSS, web locks, tamanho Firestore, Impeccable, 8 temas, PWA isolada. Revisor não inventa PASS de cloud real.
- [ ] **Step 3 — Proteção da V1:** `git diff --name-only <base-v2>...HEAD` sem root `src/`, Firebase/Cloudflare/worker configs, root lockfile ou workflows; `main` e origin/main não alterados pela execução; nenhum billing/projeto remoto.
- [ ] **Step 4 — Gate e evidências:** matriz de critérios da spec F1, lista de 4 HIGH que permanecem UNVERIFIED enquanto não houver testes reais pertinentes, 107 E2E V1 FAIL, Impeccable e screenshots; máximo duas tentativas de remediar a mesma falha material antes de STOP e escalonamento.
- [ ] **Step 5 — Git hygiene:** inventariar worktrees/PRs/branches/stashes, não apagar commits únicos; registrar HEAD main/v2, integração de todos os commits de código testado à `v2` ou impedimento preciso; nenhuma integração em `main`/deploy.
- [ ] **Step 6 — Commit relatório:** `git add docs/superpowers/audits/2026-10-28-v2-f1-acceptance.md docs/superpowers/v2/ROADMAP.md && git commit -m "docs(v2): report F1 evidence and human gate"`.
- [ ] **Step 7 — Parada humana:** atualizar issue #108 de forma sucinta e entregar relatório/SHAs, PASS/FAIL/BLOCKED/NOT_RUN, riscos e pendências. **Não iniciar F2 nem sync real, migração, publicação ou cutover**.

**Review:** não confundir implementado/testado/integrado/publicado; fase F1 não está encerrada só porque testes verdes.

## Dependency Map, Critical Risks and Sign-off

Ordem das tarefas: `1→2→3→4`, `3→5→6→7→8`, `6→9`, `3/5→10`, `2→11`, `3/4/5→12→13`, `1–13→14`. Evitar alterações concorrentes no mesmo arquivo por subagentes. TDD, commits focados e revisão independente para cada unidade de risco. Propor correção de uma falha na mesma branch, não nova PR por ajuste.

| Risco HIGH F0 | Tarefas F1 | Prova na F1 | Homologação posterior |
| --- | --- | --- | --- |
| Plano remoto legado #107 | 11, 14 | Fixtures sintéticas e comparação conservadora | F7 migração/read-back |
| Documento Firestore >1 MiB | 9, 14 | Orçamento de bytes, payload e cotas | F7 Firebase isolado |
| Corrida da outbox | 3, 6–8, 14 | Duas abas browser + fake idempotente | F7 dispositivos reais |
| Tombstones perdidos no backup | 10, 14 | Export/restore/rebaseline sintético | F7 integração backup+sync |

**Revisão cruzada:** Task 1→F1 isolamento, Task 2→domínio, Tasks 3–4→persistência e recuperação, Tasks 5–9→A-02 e custo, Tasks 10–11→ADRs legadas/backup, Task 12→A-01, Task 13→PWA/E2E, Task 14→gates/higiene. Não foi omitido nenhum bloco funcional obrigatório da spec F1; tarefas F2–F8 foram excluídas deliberadamente.

## Execution Handoff — SEM IMPLEMENTAÇÃO NESTA ENTREGA

**G1/F1:** spec formal e cinco ADRs **aprovadas em 2026-10-28** ([referência humana](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470639550)).  
**G2/F1:** este plano **PROPOSTO**, publicado para revisão humana.  
**G3/F1:** **NÃO AUTORIZADO**; não instalar dependências, criar scaffold, configurar Firebase, executar testes F1 ou escrever código.  
**F7/G5:** homologação multi-dispositivo e cutover bloqueados.

**Método recomendado:** Superpowers Subagent-driven (revisão por tarefa e holística), pela criticidade da persistência, do sync e do backup. Sua utilização em F0 não implica escolha automática para F1.

**Ação humana seguinte:** revisar este plano, aprová-lo e escolher o método de execução. Somente em etapa posterior preparar GOAL e autorizar G3/F1. Nada começa automaticamente.
