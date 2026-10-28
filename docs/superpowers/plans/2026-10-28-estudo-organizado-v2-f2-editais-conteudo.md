# Estudo Organizado V2 — F2 Editais e Conteúdo Implementation Plan

**Gate vigente:** `F2_PLAN_APPROVED_FOR_EXECUTION` — aprovação do proprietário registrada em conversa de 2026-10-28, após aprovação da spec F2 com D-F2-01..06 e E-F2-01..08. **Execução apenas na branch `v2`, conforme [GOAL F2](../goals/2026-10-28-estudo-organizado-v2-f2-codex.md), sem Firebase Emulator, deploy ou alteração da V1.** Referências de autorização ao final deste documento refletem o momento anterior ao aceite do plano.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as seis funcionalidades F2 do inventário F0 — editais, principal, arquivamento, verticalização, importação e mapeamento de aulas — sobre a F1 existente, sem alterar a V1, introduzir sync paralelo ou perder dados offline.

**Architecture:** Extensão incremental do monólito `apps/v2` com `StudySubject` canônico e associação contextual `EditalDiscipline`; novos tipos de domínio puros e stores IndexedDB versionados. Mutação local autoritativa em transação única (entidades + recibo/idempotência + outbox), identidades de perfil locais separadas da futura biblioteca remota por UID; importação por prévia conservadora e commit atômico, sem staging/job prematuro.

**Tech Stack:** React 19, TypeScript strict, Vite 8, IndexedDB nativo, Vitest 5, Playwright, CSS/tokens F1 e Impeccable A-01. **Não instalar** Firebase CLI/SDK/emulador nem ligar serviços reais neste GOAL.

**Spec:** `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f2-content-design.md` — D-F2-01..06 + E-F2-01..08 **aprovadas pelo usuário em 2026-10-28 nesta conversa**. A aprovação documental ainda precisa ser registrada no GitHub: **as operações de escrita do conector foram bloqueadas ao preparar esta versão do plano**. O Codex não deve pressupor publicação/aceite remoto sem confirmação; o proprietário deve primeiro providenciar o registro sem modificar a arquitetura. O presente **writing-plans é PROPOSTO**, ainda sujeito à aprovação humana própria, e **não autoriza execução**.

**Estado-base remoto lido:** `main=9046cfa2283cd293b38df9d52fabfcd5de9ac67c`; `v2=b1fbd2784c9b1cbd19326ccba5f4d47a3f9ee598` (2026-10-28, antes deste plano); **0 PRs abertos**, branches remotas `main`, `v2` e duas documentais antigas. A árvore local/worktrees/stashes são DESCONHECIDOS nesta revisão remota: verificar no preflight, não inventar estado limpo.

## Global Constraints — exigências transversais

- **F1 aceita com ressalvas:** conservar 84 testes unitários e 20 E2E reportados, sem apresentá-los como reexecutados até teste local; 4 riscos HIGH F0 `UNVERIFIED`, 107 E2E FAIL V1 baseline. Firebase/Rules/quotas/multidispositivo real `NOT_RUN`.
- **Isolamento:** usar exclusivamente `apps/v2/`, origem `http://127.0.0.1:18431`, DB `estudo-organizado-v2`, SW V2. **Read-only**: `main`, root `src/**`, root `package*.json`, `.github/**`, `firestore.rules`, arquivos Cloudflare/deploy, `PRODUCT.md`, `DESIGN.md`, `.impeccable/**` e dados/perfis V1. Nenhum deploy, billing ou ação de CI.
- **Fonte única de fatos:** `StudySubject` F1 mantém `{id, profileId, title, localRevision}`; vínculo `EditalDiscipline` com `displayAlias?` opcional, sem clonagem automática de subject; assuntos/aulas contextualizados; outbox F1 **única**, sem queue da UI/Firestore SDK.
- **A-02:** local-first; nenhum envio de operações `LOCAL_ONLY` sem preview + consentimento; `profileId` **local** ≠ Firebase `uid` ≠ `remoteLibraryId`. Nenhum status `CONVERGED` sem cursor/ACK real. Erros de rede transientes não eliminam operações.
- **Importação:** tetos **candidatos**: 2 MiB JSON (bytes), profundidade 20, até 5.000 entidades, título 120 caracteres, matching key 200; confirmar/reduzir por medição em dispositivo modesto. Acima do limite recusar; abaixo, pré-validar e **uma** transação para entidades+recibo+outbox. Sem `import_jobs`, staging persistente ou publicação multitransação nesta fase.
- **Relações/exclusão:** soft delete/tombstone causal e arquivo reversível; sem purge físico, cascata destrutiva, expiração arbitrária de tombstones ou reescrita do histórico F1. Progresso baseado em sessões F4 ainda indisponível: mostrar `SEM_DADOS_DE_EXECUCAO`.
- **Impeccable A-01:** reutilizar oito temas da F1 (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex e Plasma), design tokens, 44px em coarse, teclado, foco, redução de movimento e feedback não bloqueante. Auditar mudanças visuais, não modificar design system V1.
- **Qualidade:** RED→GREEN por tarefa; testes de integração contra IndexedDB real onde a atomicidade importa; revisão independente depois de partes críticas (upgrade, commit, import, identity/outbox, backup), revisão final holística. Comandos só via `npm --prefix apps/v2 ...`, sem instalar dependências novas sem necessidade comprovada.
- **Git:** trabalhar diretamente na `v2` se seguro, ou reaproveitar worktree isolado existente; novos PRs somente quando proteção exigir. Não limpar branches/worktrees com commits exclusivos. Push apenas para `origin/v2` quando seguro e autorizado na execução futura, após verificar triggers. Nunca `main`/deploy.
- **Gates:** este artefato é um plano **PARA REVISÃO**. Nenhum código F2, testes F2, emulador ou GOAL de execução está autorizado nesta etapa. Após aprovação, ChatGPT escreve GOAL único; Codex **executa**, não redesenha o plano. Ao terminar, Codex reporta `F2_READY_FOR_HUMAN_REVIEW`/`F2_BLOCKED`; ChatGPT revisa e propõe correções.

## Review Focus — cinco falhas mais perigosas

1. **Perda de dados F1 no upgrade multiaba:** aba antiga mantém banco aberto durante incremento de schema; V2 deve bloquear sem apagar os subjects/outbox (`F2-T29`, `F2-T39`, Tasks 1 e 6).
2. **Mistura de biblioteca entre aparelhos/UIDs:** dois `profileId` locais diferentes usam mesma biblioteca apenas após vínculo correto; logout não transfere outbox (`F2-T19`, `T27`, `T36`, `T37`, Tasks 9–10).
3. **Importação parcialmente visível:** quota/abort ou revisão de destino alterada entre preview/commit impede qualquer parte da árvore/outbox de aparecer (`F2-T13`, `T34`, `T35`, Task 12).
4. **Identidade ambígua em importação:** mesmo nome ou `centralId` em namespaces distintos **não** auto-mescla; repetir arquivo confiável é idempotente (`F2-T10`–`T12`, `T33`, Tasks 11–12).
5. **Exclusão e ressurreição de dependências:** tombstone de entidade nunca sincronizada bloqueia upsert posterior, sem apagar planos/sessões futuros (`F2-T09`, `T26`, `T31`, `T40`, Tasks 7 e 13).

---

## Arquivos e contratos compartilhados

**Arquivos F1 existentes, preservar e estender:** `apps/v2/src/domain/subject.ts`, `src/domain/versions.ts`, `src/application/subject-service.ts`, `src/application/sync-types.ts`, `src/application/sync-policy.ts`, `src/platform/indexeddb.ts`, `src/platform/local-subject-repository.ts`, `src/platform/sync/{flush,fake-remote,coordination}.ts`, `src/platform/backup/{format,restore}.ts`, `src/platform/legacy/recognize.ts`, `src/presentation/{App.tsx,styles.css,tokens.css,ui-state.ts}`.

**Novos arquivos por responsabilidade:**

| Caminho em `apps/v2/` | Responsabilidade |
| --- | --- |
| `src/domain/edital.ts` | `Edital`, `EditalDiscipline`, `displayAlias`, invariantes de associação |
| `src/domain/content.ts` | `Assunto`, `Aula`, `LessonTopicLink`, árvore e ordem |
| `src/domain/delete.ts` | Tombstones, arquivamento, restore e dependências |
| `src/application/content-commands.ts` | União discriminada de comandos F2; resultados/erros sem rede |
| `src/application/content-service.ts` | Queries, comandos de conteúdo e portas para camada UI |
| `src/application/profile-service.ts` | Binding persistido e edital principal |
| `src/application/import-types.ts` | Tipos `ImportPreview`, recibo e plano de alterações |
| `src/application/import-service.ts` | Parser/preview/dedup/validação de importação |
| `src/platform/local-content-repository.ts` | Transações IndexedDB F2; reutiliza stores/operations/outbox F1 |
| `src/platform/local-profile-repository.ts` | Store `profiles`, principal único e binding consentido |
| `src/platform/content-migration.ts` | Upgrade de schema e decisões de vínculo F1 explicitamente consentidas |
| `src/platform/import-commit.ts` | Commit atômico de toda importação aprovada + recibo |
| `src/platform/sync/delivery-policy.ts` | UID/biblioteca remota distintos de `profileId` local |
| `src/platform/sync/retry-policy.ts` | Backoff/cooldown automático para falhas transitórias |
| `src/platform/backup/f2-format.ts` | Formato e preview sintéticos F1→F2 sem UI de restore |
| `src/presentation/components/EditalManager.tsx` | CRUD/lista/arquivo, escolha de principal |
| `src/presentation/components/ContentTree.tsx` | Árvore vertical, alias, ordenação, mapeamento de aulas |
| `src/presentation/components/ImportPreview.tsx` | Preview, conflitos/validação e confirmação explícita |
| `tests/unit/f2-*.test.ts`, `tests/e2e/f2-*.spec.ts` | TDD nomeado e testes browser V2 |
| `docs/superpowers/audits/2026-10-28-v2-f2-acceptance.md` | **Um** relatório de implementação, apenas quando autorizado |

**Contratos normativos para futuras tarefas** (nomes a implementar no caminho indicado, mantendo tipos F1 existentes):

```ts
type Id = string;
type CommandScope = { operationId: Id; profileId: Id; baseRevision?: number | null };
type Edital = { id: Id; profileId: Id; title: string; status: 'ACTIVE'|'ARCHIVED'; localRevision: number; sourceRef?: string };
type EditalDiscipline = { id: Id; profileId: Id; editalId: Id; subjectId: Id; orderKey: string; displayAlias?: string; localRevision: number; status: 'ACTIVE'|'ARCHIVED' };
type Assunto = { id: Id; profileId: Id; editalDisciplineId: Id; parentId: Id|null; title: string; orderKey: string; localRevision: number; provenance?: string };
type Aula = { id: Id; profileId: Id; editalDisciplineId: Id; title: string; orderKey: string; localRevision: number; provenance?: string };
type LessonTopicLink = { id: Id; profileId: Id; aulaId: Id; assuntoId: Id; localRevision: number };
type CommitResult<T> = { kind:'LOCAL_COMMITTED'; value:T } | {kind:'INVALID'; code:string} | {kind:'CONFLICT'; current?:unknown} | {kind:'FAILED'; reason:string};
type EditalCommand = CommandScope & ({type:'CREATE_EDITAL';editalId:Id;title:string}|{type:'RENAME_EDITAL';editalId:Id;title:string}|{type:'SET_PRIMARY';editalId:Id|null}|{type:'ARCHIVE_EDITAL';editalId:Id});
type ContentCommand = CommandScope & ({type:'LINK_SUBJECT';editalId:Id;subjectId:Id;linkId:Id;displayAlias?:string}|{type:'UPSERT_ASSUNTO';value:Assunto}|{type:'UPSERT_AULA';value:Aula}|{type:'LINK_LESSON_TOPIC';link:LessonTopicLink}|{type:'UNLINK_LESSON_TOPIC';linkId:Id}|{type:'SOFT_DELETE';entityType:string;entityId:Id}|{type:'RESTORE_ENTITY';entityType:string;entityId:Id});
type ProfileRecord = {profileId:Id;uid:string|null;remoteLibraryId:string|null;syncEnabled:boolean;state:string;primaryEditalId:Id|null};
type DeliveryBinding = {operationId:Id;profileId:Id;deliveryUid:string|null;remoteLibraryId:string|null;attempts:number;nextRetryAt:number|null};
// `SubjectCommand` e `StudySubject` permanecem exatamente como definidos na F1.
```

**Identidade remota:** não reescrever `SubjectCommand`/`operationId` histórico. `DeliveryBinding` pode ser metadado do mesmo registro outbox, **separado logicamente do payload imutável**. Os contratos físicos finais devem preservar semântica quando o fake F1 exige `profileId` local; adapter remoto troca escopo explicitamente, sem alterar origem/UID. Não criar segundo outbox/store concorrente.

**Comandos de teste existentes:** `npm --prefix apps/v2 run typecheck`; `npm --prefix apps/v2 run lint`; `npm --prefix apps/v2 run test:unit -- tests/unit/<arquivo>.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/<arquivo>.spec.ts`; `npm --prefix apps/v2 run build`. Cada comando é **para execução futura**, não foi rodado nesta redação documental.

## Task 1: Migração IndexedDB F1→F2 sem perda e sem lock eterno

**Files:** Modify: `apps/v2/src/domain/versions.ts`, `apps/v2/src/platform/indexeddb.ts`; Create: `apps/v2/src/platform/content-migration.ts`; Test: `apps/v2/tests/e2e/f2-idb-migration.spec.ts`, `tests/unit/f2-schema.test.ts`.

**Interfaces:**
- Consumes: `LOCAL_DB_VERSION=1`, `openV2Database`, stores F1, `transactionDone`.
- Produces: `LOCAL_DB_VERSION=2`; `upgradeV2Schema(db:IDBDatabase, oldVersion:number, tx:IDBTransaction):void`; stores `editais`, `edital_disciplines`, `assuntos`, `aulas`, `lesson_topic_links`, `tombstones`, `quarantine`, `import_receipts`, índices `by_profile`, `by_parent_order`, `by_edital_subject` único; `onversionchange` encerra conexão em cache.

- [ ] **Step 1: Write RED test `upgrade_f1_preserves_subject_operations_outbox`** (`F2-T29`). Assert: seeds F1 subject/op/outbox, abre v2 e prova IDs/revisões/índices íntegros; reabertura idempotente.
- [ ] **Step 2: Write RED test `blocked_upgrade_never_deletes_existing_database`** (`F2-T39`). Assert: aba antiga impede upgrade; mostra `BLOCKED_UPGRADE`, conserva DB, após fechar tab upgrade retoma.
- [ ] **Step 3: Prove RED.** Execute `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-idb-migration.spec.ts`; `npm --prefix apps/v2 run test:unit -- tests/unit/f2-schema.test.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 4: Implement the minimum.** Incrementar apenas DB version para 2; criar stores/índices novos na transação `onupgradeneeded`; tratar `onblocked`/`onversionchange`/cache de conexões sem `deleteDatabase` e sem tentar migration de dados reais V1.
- [ ] **Step 5: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-idb-migration.spec.ts`; `npm --prefix apps/v2 run test:unit -- tests/unit/f2-schema.test.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 6: Independent review.** Preflight: base 84/20 e DB F1 preservados em navegador; nenhum rename/reindex destrutivo. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 7: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-01 migração indexeddb f1→f2 sem perda `. Não fazer push para `main`.

## Task 2: Edital e vínculo canônico com alias

**Files:** Create: `apps/v2/src/domain/edital.ts`, `src/application/content-commands.ts`; Test: `apps/v2/tests/unit/f2-edital-domain.test.ts`.

**Interfaces:**
- Consumes: `StudySubject` e título max 120 da F1; D-F2-01=B e E-F2-01.
- Produces: `Edital`, `EditalDiscipline`, `EditalCommand`, `displayName(subject:StudySubject,link:EditalDiscipline):string`; `validateEditalLink(edital,subject,link):void`.

- [ ] **Step 1: Write RED test `create_rename_edital_preserves_ids`** (`F2-T01`). Assert: criação/rename incrementa revisão uma vez; ID e perfil estáveis.
- [ ] **Step 2: Write RED test `subject_can_link_to_two_editais_without_clone`** (`F2-T02`). Assert: um `StudySubject.id` e dois links distintos; título original não duplicado.
- [ ] **Step 3: Write RED test `homonymous_subjects_are_distinct`** (`F2-T03`). Assert: nomes iguais nunca tornam IDs equivalentes.
- [ ] **Step 4: Write RED test `canonical_rename_keeps_explicit_contextual_alias`** (`F2-T32`). Assert: rename canônico aparece sem alias; `displayAlias` não muda.
- [ ] **Step 5: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-edital-domain.test.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 6: Implement the minimum.** Implementar domínio puro; unicidade `(profileId,editalId,subjectId)` será garantida por índice do Task 1 e comando do Task 3; alias exclusivamente de apresentação e perfil validado.
- [ ] **Step 7: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-edital-domain.test.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 8: Independent review.** Não adicionar `editalId` a `StudySubject`, nem gerar subject duplicado por vínculo. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 9: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-02 edital e vínculo canônico com alias`. Não fazer push para `main`.

## Task 3: CommitService e outbox única com erro de domínio explícito

**Files:** Create: `apps/v2/src/platform/local-content-repository.ts`, `src/application/content-service.ts`; Modify: `src/application/sync-types.ts`, `src/platform/local-subject-repository.ts` se preciso sem quebra F1; Test: `apps/v2/tests/unit/f2-commit.test.ts`, `tests/e2e/f2-atomic-commit.spec.ts`.

**Interfaces:**
- Consumes: Task 1 stores, Task 2 comandos, `OutboxOperation` F1, operações persistidas.
- Produces: `executeContentCommand(command:EditalCommand|ContentCommand):Promise<CommitResult<unknown>>`; outbox discriminada por `entityType` com payload canônico; `loadContent(profileId)` consulta via índice.

- [ ] **Step 1: Write RED test `same_operation_id_same_payload_is_noop_divergent_rejected`** (`F2-T14`). Assert: replay exato mantém 1 revisão/operação; ID com payload diferente é INVALID/CONFLICT.
- [ ] **Step 2: Write RED test `aborted_content_commit_writes_neither_entity_nor_outbox`** (`F2-T17`). Assert: IDB abort/Quota browser não deixa parte do commit nem informa salvo.
- [ ] **Step 3: Write RED test `invalid_title_returns_invalid_not_unavailable`** (`F2-T28`). Assert: 121 caracteres/duplicata inválida retornam `INVALID`, não erro genérico de armazenamento.
- [ ] **Step 4: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-commit.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-atomic-commit.spec.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 5: Implement the minimum.** Extrair helper mínimo que usa uma transação readwrite de entidade+operations+outbox; domínio validado fora da transação quando possível; idempotência compara comando imutável normalizado. Usar F1 stores, sem novo writer nem duplicar outbox; não transformar `SubjectValidationError` em `UNAVAILABLE`.
- [ ] **Step 6: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-commit.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-atomic-commit.spec.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 7: Independent review.** Testes de abort em IndexedDB real; status LOCAL_COMMITTED só após `transactionDone`. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 8: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-03 commitservice e outbox única com er`. Não fazer push para `main`.

## Task 4: Edital principal por perfil e perfil persistente

**Files:** Create: `apps/v2/src/application/profile-service.ts`, `src/platform/local-profile-repository.ts`; Modify: `src/platform/indexeddb.ts` onde necessário; Test: `apps/v2/tests/unit/f2-profile.test.ts`, `tests/e2e/f2-primary-two-tabs.spec.ts`.

**Interfaces:**
- Consumes: Stores `profiles`, `meta`, `EditalCommand` Task 2 e commit Task 3.
- Produces: `getProfile(profileId):Promise<ProfileRecord>`; `setPrimaryEdital(profileId,editalId:null|string,operationId):Promise<CommitResult<ProfileRecord>>`; `archiveEdital` coordena principal explícito.

- [ ] **Step 1: Write RED test `archiving_primary_requires_explicit_replacement_or_none`** (`F2-T07`). Assert: não elege principal ocultamente; histórico/vínculos sobrevivem.
- [ ] **Step 2: Write RED test `concurrent_primary_switch_never_creates_two_primaries`** (`F2-T30`). Assert: duas abas, uma preferência por perfil, revisão-base conflita ou último commit auditado.
- [ ] **Step 3: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-profile.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-primary-two-tabs.spec.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 4: Implement the minimum.** Guardar **único** `primaryEditalId` em `profiles`; não criar segundo `Edital.primaryChoice`. Persistir binding local no mesmo store, sem Google real; validar edital ativo e pertencente ao perfil.
- [ ] **Step 5: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-profile.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-primary-two-tabs.spec.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 6: Independent review.** Nenhuma alteração de configuração V1; principal determinístico com concorrência. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 7: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-04 edital principal por perfil e perfi`. Não fazer push para `main`.

## Task 5: Árvore de assuntos/aulas, ordem e vínculos N:N

**Files:** Create: `apps/v2/src/domain/content.ts`; Modify: `src/platform/local-content-repository.ts`, `src/application/content-service.ts`; Test: `apps/v2/tests/unit/f2-hierarchy.test.ts`, `tests/e2e/f2-links.spec.ts`.

**Interfaces:**
- Consumes: `EditalDiscipline`, IDs perfil/edital, stores Task 1, commit Task 3.
- Produces: `validateAssuntoTree(items:Assunto[]):void`; `upsertAssunto(value,scope)`; `upsertAula(value,scope)`; `linkLessonTopic(link,scope)`; `reorderSibling(profileId,id,orderKey,baseRevision)`.

- [ ] **Step 1: Write RED test `invalid_parent_or_cycle_is_rejected`** (`F2-T04`). Assert: parent diferente de associação, próprio ID e ciclo detectados como INVALID_PARENT.
- [ ] **Step 2: Write RED test `lesson_can_have_many_topics_but_no_cross_edital_link`** (`F2-T05`). Assert: vínculos múltiplos únicos e mesmo EditalDiscipline.
- [ ] **Step 3: Write RED test `concurrent_sibling_reorder_conflicts`** (`F2-T06`). Assert: baseRevision obsoleta dá conflito; ordem com `orderKey` + ID estável.
- [ ] **Step 4: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-hierarchy.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-links.spec.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 5: Implement the minimum.** Queries por índice, check relacional na mesma transação de link, ordem determinística e reindexação limitada quando preciso; não adicionar CRDT/fractional indexing por antecipação.
- [ ] **Step 6: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-hierarchy.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-links.spec.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 7: Independent review.** Proteger `parentId`/escopo/UID, sem loops ou link órfão. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 8: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-05 árvore de assuntos/aulas, ordem e v`. Não fazer push para `main`.

## Task 6: Adoção explícita dos subjects F1 não vinculados

**Files:** Modify: `apps/v2/src/platform/content-migration.ts`, `src/application/content-service.ts`; Test: `apps/v2/tests/unit/f2-adoption.test.ts`, `tests/e2e/f2-unassigned.spec.ts`.

**Interfaces:**
- Consumes: Subjects F1 (Task 1), vínculos e commit Tasks 2–3, editais Task 4.
- Produces: `listUnassignedSubjects(profileId):Promise<StudySubject[]>`; `applySubjectAdoption(profileId,operationId,decisions:AdoptionDecision[]):Promise<CommitResult<AdoptionReport>>`, `AdoptionDecision={subjectId, decision:"LINK_EXISTING"|"CREATE_EDITAL_AND_LINK"|"LEAVE_UNASSIGNED",editalId?,newEdital?}`.

- [ ] **Step 1: Write RED test `f1_subject_adoption_keeps_identity_and_never_auto_links`** (`F2-T23`). Assert: seeds F1, lista sem vínculo; três decisões com IDs preservados, replay igual, rollback se inválido.
- [ ] **Step 2: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-adoption.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-unassigned.spec.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 3: Implement the minimum.** Nenhum auto-link no schema upgrade; vinculação só em comando confirmado, com `LINK_EXISTING` exigindo edital ativo; `CREATE_EDITAL_AND_LINK` atômico; `LEAVE_UNASSIGNED` sem outbox duplicada.
- [ ] **Step 4: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-adoption.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-unassigned.spec.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 5: Independent review.** Não gravar edits de migração em banco V1; nenhum subject F1 perde ID/revisão. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 6: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-06 adoção explícita dos subjects f1 nã`. Não fazer push para `main`.

## Task 7: Arquivamento, exclusão lógica e tombstones causais

**Files:** Create: `apps/v2/src/domain/delete.ts`; Modify: `src/platform/local-content-repository.ts`, `src/platform/indexeddb.ts`; Test: `apps/v2/tests/unit/f2-delete.test.ts`, `tests/e2e/f2-archive.spec.ts`.

**Interfaces:**
- Consumes: Entidades Task 2/5, store tombstones Task 1, commit Task 3, principal Task 4.
- Produces: `archiveEdital`, `softDeleteEntity(profileId,entityType,entityId,operationId,baseRevision)` e `restoreEntity(...)`; `LogicalTombstone` com entityType/epoch; `currentEpoch` por perfil/biblioteca.

- [ ] **Step 1: Write RED test `archive_reactivate_keeps_data`** (`F2-T08`). Assert: arquivamento reversível mantém relações sem apagar dados.
- [ ] **Step 2: Write RED test `delete_parent_with_dependents_is_blocked_or_quarantined`** (`F2-T09`). Assert: nenhuma cascata destrutiva, motivo explícito.
- [ ] **Step 3: Write RED test `delete_never_synced_creates_tombstone_and_requires_restore`** (`F2-T26`). Assert: rev1 tombstone; upsert posterior não ressuscita.
- [ ] **Step 4: Write RED test `archive_never_invents_f4_progress_or_erases_future_history`** (`F2-T40`). Assert: preserva vínculos e indicador sem execução.
- [ ] **Step 5: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-delete.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-archive.spec.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 6: Implement the minimum.** Tombstone e operação/outbox no mesmo commit; nenhuma exclusão física, TTL nem cascade; dependência irresolúvel ⇒ conflito/quarentena. Evitar tombstones de outro UID/profileId.
- [ ] **Step 7: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-delete.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-archive.spec.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 8: Independent review.** Integridade sob restore antigo e edição concorrente; status não muda antes do commit. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 9: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-07 arquivamento, exclusão lógica e tom`. Não fazer push para `main`.

## Task 8: Conflitos de conteúdo e fake remoto conservador

**Files:** Modify: `apps/v2/src/application/sync-types.ts`, `src/platform/sync/fake-remote.ts`, `src/platform/indexeddb.ts`; Create: `apps/v2/src/application/conflict-service.ts`; Test: `apps/v2/tests/unit/f2-conflicts.test.ts`, `tests/e2e/f2-two-tabs.spec.ts`.

**Interfaces:**
- Consumes: F1 `markConflict`, `flushPending`, novas entidades Task 5, tombstones Task 7.
- Produces: `ConflictRecord` com `entityType`, localPayload, remotePayload|null, base/remoteRevision, deleted e status; `resolveConflict(profileId,conflictId,choice,operationId)` gera nova operação explícita.

- [ ] **Step 1: Write RED test `two_tabs_edit_same_entity_without_lost_update`** (`F2-T15`). Assert: duas tabs Chromium; CAS local impede overwrite silencioso.
- [ ] **Step 2: Write RED test `independent_entities_converge_with_fake_port`** (`F2-T16`). Assert: dois perfis sintéticos do mesmo escopo e operações independentes preservadas; sem alegar Firestore real.
- [ ] **Step 3: Write RED test `resolve_remote_conflict_preserves_both_versions_until_choice`** (`F2-T25`). Assert: payloads mantidos, resolução gera op novo e read-back simulado.
- [ ] **Step 4: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-conflicts.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-two-tabs.spec.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 5: Implement the minimum.** Estender, não substituir, fake/flush F1; revisão-base valida o estado persistido; `deleted` representa remoto tombstone. Em testes F2 usar fake: não iniciar emulador.
- [ ] **Step 6: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-conflicts.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-two-tabs.spec.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 7: Independent review.** Provar que resolução não retrocede ACK nem apaga versão rejeitada sem rastro. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 8: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-08 conflitos de conteúdo e fake remoto`. Não fazer push para `main`.

## Task 9: Identidade de entrega UID/biblioteca separada do perfil local

**Files:** Create: `apps/v2/src/platform/sync/delivery-policy.ts`; Modify: `src/application/sync-policy.ts`, `src/application/sync-types.ts`, `src/platform/local-profile-repository.ts`; Test: `apps/v2/tests/unit/f2-delivery-identity.test.ts`.

**Interfaces:**
- Consumes: `LinkPreview`, binding F1, perfil Task 4, outbox Task 3, fake Task 8.
- Produces: `canDeliver(op,binding):boolean`; `adoptLocalOperations(profileId,uid,remoteLibraryId,consentProof):Promise<CommitResult<{adopted:number}>>`; comando imutável e metadados `DeliveryBinding` separados.

- [ ] **Step 1: Write RED test `wrong_uid_denied_same_uid_different_local_profile_allowed`** (`F2-T19`). Assert: dois dispositivos simulados com IDs locais distintos e UID/biblioteca vinculados; UID errado negado.
- [ ] **Step 2: Write RED test `logout_rebind_does_not_transfer_old_operations`** (`F2-T27`). Assert: logout uid-a e login uid-b não envia conteúdo antigo.
- [ ] **Step 3: Write RED test `same_remote_library_is_explicitly_mapped_across_devices`** (`F2-T36`). Assert: perfil local diferente pode compartilhar biblioteca sintética consentida.
- [ ] **Step 4: Write RED test `local_only_command_is_immutable_and_not_sent`** (`F2-T37`). Assert: sem UID não envia; consentimento cria metadados de entrega sem mutar opId/payload.
- [ ] **Step 5: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-delivery-identity.test.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 6: Implement the minimum.** `remoteLibraryId` verificado no fake e perfil persistido, sem confiar em token local como prova de autenticação real. Não implementar OAuth Google ou Rules reais. O escopo remoto será validado por UID no futuro emulador.
- [ ] **Step 7: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-delivery-identity.test.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 8: Independent review.** Nenhum estado `CONVERGED` baseado apenas em bindings locais; não enviar operação após logout. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 9: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-09 identidade de entrega uid/bibliotec`. Não fazer push para `main`.

## Task 10: Backoff automático, retry e confirmação segura

**Files:** Create: `apps/v2/src/platform/sync/retry-policy.ts`; Modify: `src/platform/sync/flush.ts`, `src/platform/indexeddb.ts`; Test: `apps/v2/tests/unit/f2-retry.test.ts`, `tests/e2e/f2-reconnect.spec.ts`.

**Interfaces:**
- Consumes: `DeliveryBinding`, `canDeliver` Task 9, outbox F1, Web Locks F1.
- Produces: `planRetry(attempts:number,now:number,jitter:number):{nextRetryAt:number,terminal:false}`; `selectEligiblePending(profileId,now)`; cooldown/transient/auth/quota/deterministic reason.

- [ ] **Step 1: Write RED test `sixth_transient_failure_stays_pending_and_auto_retries`** (`F2-T38`). Assert: após 5 falhas + sexta sem rede: outbox intacta; reconecta e retoma no app ativo com limite/cooldown.
- [ ] **Step 2: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-retry.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-reconnect.spec.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 3: Implement the minimum.** Base 1 s, teto 5 min, jitter 0–20%, inject clock/RNG testáveis; nunca ACK após timeout incerto; `PAUSED_AUTH`/`PAUSED_QUOTA` não fazer loop; sem timer infinito/processo background garantido.
- [ ] **Step 4: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-retry.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-reconnect.spec.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 5: Independent review.** Controlar amplificação de operações Spark, nunca descartar tarefa após limite de tentativas. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 6: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-10 backoff automático, retry e confirm`. Não fazer push para `main`.

## Task 11: Parser/importação legado, identidade e prévia segura

**Files:** Create: `apps/v2/src/application/import-types.ts`, `src/application/import-service.ts`; Add: `apps/v2/tests/fixtures/f2-edital-v1.json`, `f2-namespaces.json`; Test: `apps/v2/tests/unit/f2-import-parse.test.ts`.

**Interfaces:**
- Consumes: Formatos V1 read-only e F0, entidades Tasks 2/5, função `canonicalJson`/checksum F1 (inspecionar antes de reusar).
- Produces: `parseEditalImport(input:Uint8Array):ParseResult`; `previewEditalImport(profileId,parsed:ParsedEdital,existing:ContentSnapshot):ImportPreview`; `ImportPreview={importId,sourceIdentity,fingerprint,targetSignature,creates,links,ambiguous,conflicts}`.

- [ ] **Step 1: Write RED test `same_name_different_source_is_not_merged`** (`F2-T11`). Assert: prévia separa nome igual/proveniência distinta.
- [ ] **Step 2: Write RED test `same_source_different_revision_requires_conflict_preview`** (`F2-T12`). Assert: sem overwrite silencioso.
- [ ] **Step 3: Write RED test `v1_edital_fixture_preserves_counts_or_quarantines_unknown`** (`F2-T24`). Assert: reconcilia árvore sintética com mapeamento de IDs, desconhecidos em quarentena.
- [ ] **Step 4: Write RED test `same_central_id_different_namespace_is_not_same_entity`** (`F2-T33`). Assert: namespace confiável obrigatório; nameKey nunca autoriza merge.
- [ ] **Step 5: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-import-parse.test.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 6: Implement the minimum.** Teto candidato 2 MiB/depth20/5k/título120/key200, medidas bytes UTF-8; validar tipo `versao:1, tipo:edital` quando válido; texto hostil escapado, bloquear __proto__/HTML ativo. Fingerprint de conteúdo/proveniência estáveis, sem timestamps voláteis. Parser não abre IDB write.
- [ ] **Step 7: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-import-parse.test.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 8: Independent review.** Testar limites + Unicode, versão desconhecida e input malformado; nenhum browser XSS. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 9: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-11 parser/importação legado, identidad`. Não fazer push para `main`.

## Task 12: Importação idempotente: preview + commit transacional único

**Files:** Create: `apps/v2/src/platform/import-commit.ts`; Modify: `src/application/import-service.ts`, `src/platform/local-content-repository.ts`; Test: `apps/v2/tests/unit/f2-import-commit.test.ts`, `tests/e2e/f2-import-atomic.spec.ts`.

**Interfaces:**
- Consumes: ImportPreview Task 11, stores Task 1, CommitService Task 3, IDs/proveniência.
- Produces: `applyEditalImport(profileId,preview:ImportPreview,approval:{confirmed:true;targetSignature:string}):Promise<CommitResult<ImportReceipt>>` e `ImportReceipt={profileId,importId,fingerprint,entityCounts,operationIds}`.

- [ ] **Step 1: Write RED test `same_trusted_file_twice_has_one_logical_import`** (`F2-T10`). Assert: mesmo ID/fingerprint e recibo retornam no-op, sem entidade/outbox adicional.
- [ ] **Step 2: Write RED test `import_abort_has_no_partial_visibility`** (`F2-T13`). Assert: browser abort com batch dentro do limite aceito: zero entidades/recibos/outbox parciais.
- [ ] **Step 3: Write RED test `max_accepted_import_quota_abort_rolls_back_every_store`** (`F2-T34`). Assert: carga-limite aceita/abort real; se não couber no orçamento, rejeitar ANTES do commit.
- [ ] **Step 4: Write RED test `stale_preview_after_tab_edit_is_rejected`** (`F2-T35`). Assert: assinatura/revisão diferente impede commit; pede nova prévia.
- [ ] **Step 5: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-import-commit.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-import-atomic.spec.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 6: Implement the minimum.** Executar parse e planejamento antes de abrir transação; dentro de uma única transação sincronizar targetSignature + persistir todas entidades, operações e outbox, recibo único. IDB transaction não deve aguardar `await` externo (hash/IO/network) depois de abrir; se lote for pesado em mobile, reduzir limite seguro com evidência. Nenhum import_jobs/staging.
- [ ] **Step 7: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-import-commit.test.ts`; `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-import-atomic.spec.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 8: Independent review.** Nenhum commit parcial e nenhuma transação longa com promessas externas; audit de importação reutiliza o mesmo serviço de commit. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 9: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-12 importação idempotente: preview + c`. Não fazer push para `main`.

## Task 13: Compatibilidade de backups F1→F2 e recuperação sintética

**Files:** Create: `apps/v2/src/platform/backup/f2-format.ts`; Modify: `src/platform/backup/restore.ts` só se compatível; Test: `apps/v2/tests/unit/f2-backup.test.ts`.

**Interfaces:**
- Consumes: Manifest F1, `deletionHistoryComplete`, LogicalTombstone, schema F2, epoch Task 7.
- Produces: `exportF2Snapshot(profileId,records):BackupSnapshotF2`; `previewF1OrF2Backup(input,currentEpoch):{kind:"SAFE"|"INVALID"|"REBASELINE_REQUIRED";reason?:string}`.

- [ ] **Step 1: Write RED test `old_backup_with_tombstones_requires_safe_rebaseline`** (`F2-T18`). Assert: backup sintético stale não ressuscita soft delete.
- [ ] **Step 2: Write RED test `f1_backup_readback_and_subject_tombstone_collision_rejected`** (`F2-T31`). Assert: leitor F1 explícito, colisão entidade+tombstone rejeitada/REBASELINE, não falso SAFE.
- [ ] **Step 3: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-backup.test.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 4: Implement the minimum.** Format version próprio F2 compatível com v1 via leitor explícito; checksum e metadata não incluem tokens; apenas preview/export sintéticos — sem UI de restore nem tocar bancos V1.
- [ ] **Step 5: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-backup.test.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 6: Independent review.** Não declarar recuperação real homologada; testes de checksum não equivalem a assinatura de autenticidade. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 7: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-13 compatibilidade de backups f1→f2 e `. Não fazer push para `main`.

## Task 14: UI editais, principal, árvore, aula e importação com A-01

**Files:** Create: `apps/v2/src/presentation/components/EditalManager.tsx`, `ContentTree.tsx`, `ImportPreview.tsx`; Modify: `src/presentation/App.tsx`, `styles.css`, `ui-state.ts`; Test: `apps/v2/tests/e2e/f2-editais-flow.spec.ts`, `f2-import-ui.spec.ts`, `f2-a11y.spec.ts`.

**Interfaces:**
- Consumes: Portas Tasks 2–13, componentes F1 SubjectForm/List/SyncStatus, temas F1.
- Produces: Jornadas create/edit/archive/reactivate edital, principal, link subject sem duplicar, árvore assunto/aula N:N, upload/preview/confirmação/rejeição; estados offline, `SEM_DADOS_DE_EXECUCAO` e erros sinceros.

- [ ] **Step 1: Write RED test `browser_create_rename_reload_full_content_tree`** (`F2-T01`). Assert: fluxo editais/disciplinas/assuntos/aulas persiste após reload.
- [ ] **Step 2: Write RED test `browser_archive_primary_with_explicit_choice`** (`F2-T07`). Assert: principal/arquivados permanecem consultáveis.
- [ ] **Step 3: Write RED test `eight_themes_three_viewports_and_accessible_controls`** (`F2-T20`). Assert: 24 capturas sintéticas, foco/teclado/contrast AA amostrado, touch >=44px, toast não cobre ação.
- [ ] **Step 4: Prove RED.** Execute `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-editais-flow.spec.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 5: Implement the minimum.** UI React sobre serviços tipados sem acesso direto ao IDB; upload com limite antes do parse e confirmação explícita; reuso dos 8 temas e estilos existentes. `SyncStatus` local não anuncia cloud real. Acessibilidade Impeccable: verificar ferramenta instalada e hooks antes de qualquer execução futura.
- [ ] **Step 6: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:e2e -- tests/e2e/f2-editais-flow.spec.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 7: Independent review.** Nenhum `window.EstudoApp` global; evitar redesenho total de shell que pertence à F6. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 8: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-14 ui editais, principal, árvore, aula`. Não fazer push para `main`.

## Task 15: Orçamento Firestore e gate do ensaio Emulator (documentação apenas)

**Files:** Modify (durante futura execução autorizada): `docs/superpowers/audits/2026-10-28-v2-f2-acceptance.md`; Test: `apps/v2/tests/unit/f2-sync-budget.test.ts`; Do not create: Firebase SDK/CLI, `apps/v2/firebase/**` sem gate específico.

**Interfaces:**
- Consumes: Entidades F2, `document-budget.ts` F1, análise F2 readiness e demo protocol.
- Produces: Tabela de bytes/doc, writes/reads por 1–3 clientes, margem, operação import/seed único, estado separado `F2_EMULATOR_NOT_AUTHORIZED/NOT_RUN`.

- [ ] **Step 1: Record deferred gate `F2-T22`.** Document expected future emulator assertion `emulator_rules_and_cas_are_not_run_without_separate_authorization`: NÃO EXECUTAR emulator; marcar NOT_RUN/BLOCKED por gate, não inventar PASS. **Do not write or execute emulator tests, install SDK/CLI, create rules, or claim RED/GREEN.** Mark NOT_RUN.
- [ ] **Step 2: Write RED test `fake_multiclient_contract_does_not_claim_spark_quota`** (`F2-T16`). Assert: fake exercita formato, orçamento é estimativa sintética, não cota real.
- [ ] **Step 3: Prove RED.** Execute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-sync-budget.test.ts`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 4: Implement the minimum.** Documentar premissas; validar envelope conservador F1 900.000 bytes; no cenário de 7.840 documentos x 3 gravações = 23.520 > 20.000 gravações/dia da premissa analisada: propor seed único e leituras incrementais, não três imports independentes. Revisar quotas oficiais no ensaio autorizado, não usar billing. Protocolo demo-* futuro em spec, NÃO instalar/executar.
- [ ] **Step 5: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit -- tests/unit/f2-sync-budget.test.ts` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 6: Independent review.** Sem configurar serviço, credenciais, .github Actions ou Firestore Rules produtivas. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 7: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-15 orçamento firestore e gate do ensai`. Não fazer push para `main`.

## Task 16: Regressão final, revisão holística e gate F2

**Files:** Modify (futura execução): `docs/superpowers/audits/2026-10-28-v2-f2-acceptance.md`, `docs/superpowers/v2/ROADMAP.md`, `docs/agent/HANDOFF.md`; Issue: #108 status/evidências.

**Interfaces:**
- Consumes: Tasks 1–15 e matriz F2-T01..T40; baseline da F1.
- Produces: Relatório único com evidências reais, status `F2_READY_FOR_HUMAN_REVIEW` ou `F2_BLOCKED` e gates humanos; sem autoaproveitamento.

- [ ] **Step 1: Write RED test `f1_regression_baseline_after_f2`** (`F2-T21`). Assert: executar 84 unit + 20 E2E existentes (contagem pode crescer), typecheck/lint/build; comparar com baseline e investigar regressões.
- [ ] **Step 2: Prove RED.** Execute `npm --prefix apps/v2 run test:unit`; os testes novos devem falhar por contrato/função ausente ou assert específico; erro de sintaxe/harness não conta como RED de negócio.
- [ ] **Step 3: Implement the minimum.** Run `npm --prefix apps/v2 run typecheck`, `lint`, `test:unit`, `test:e2e`, `build` e inspeção de diff V1. Auditoria independente de upgrade, transação, cross-tab, import, perfis e UX; classificar PASS/FAIL/INCONCLUSIVE/NOT_RUN, corrigir erros materiais na própria v2 e reexecutar testes. Não converter quatro HIGH em mitigados por mock. Consolidar commits na `v2` e fazer higiene sem apagar commits exclusivos.
- [ ] **Step 4: Prove GREEN.** Reexecute `npm --prefix apps/v2 run test:unit` e `npm --prefix apps/v2 run typecheck`; resultados esperados PASS/exit 0. Testes não executáveis por gate específico devem permanecer NOT_RUN (não simular RED/GREEN).
- [ ] **Step 5: Independent review.** Fim de execução não implica F2 homologada, integração à main ou deploy. Apresentar gate humano e não iniciar F3. Corrigir P0/P1/P2 materiais e reexecutar o teste focal antes do commit.
- [ ] **Step 6: Commit scoped changes.** Conferir `git diff --check` e `git diff --name-only` (somente F2, sem V1); usar `git add` apenas nos arquivos desta tarefa e commit `feat(v2/f2): task-16 regressão final, revisão holística `. Não fazer push para `main`.

## Metodologia de execução para o Codex — somente **após** GOAL autorizado

1. Preflight local completo: `git status --short`, `git rev-parse main`, `git rev-parse v2`, `git branch -avv`, `git worktree list`, PRs e stashes; conferir README/AGENTS, versões Node, scripts e deploy triggers. Nunca assumir que SHAs deste plano são atuais na execução.
2. Ler spec F2 aprovada, ADRs e plano; método Superpowers **Subagent-driven**. Cada tarefa: testes RED, prova RED, implementação mínima, GREEN, commit focado, **revisor independente** (especialmente Tasks 1, 3, 7, 9, 12, 13), correção no mesmo escopo. Não reabrir arquitetura aprovada.
3. Regressão local e segurança após cada grupo: (1–3), (4–7), (8–10), (11–13), (14–16). Sem instalar ferramentas ou usar rede real sem autorização. Não executar projetos Firebase/Cloudflare/Drive reais.
4. Integração segura **só em `v2`**, sem PR se não for exigido por proteção; confirmar nenhum trigger de deploy antes de push. Todo trabalho validado integrado à `v2` ou formalmente bloqueado. **Não tocar `main`.**
5. Package de evidência para revisão ChatGPT: relatório de aceite único com mapa `F2-T01..T40`, logs do run real, hashes/HEAD, arquivos, diffs, itens não executados (especialmente T22 emulator), 4 HIGH, 107 FAIL V1, custo sintético, capturas Impeccable, status de branch/PR/worktree, próximos gates. Não declarar “fase concluída” sem aprovação humana.
6. Se um impedimento exigir alteração arquitetural (staging persistente, OAuth real, purge, outro sync, alteração de produção), **STOP**, descrever alternativas/impactos e devolver ao ChatGPT/usuário antes de agir.

### Dependências e divisão em grupos de revisão

`1 → 2 → 3`; `3 → 4–7`; `5/7 → 8`; `4/8 → 9 → 10`; `2/5/7 → 11 → 12`; `7/11 → 13`; `4–13 → 14`; `8–13 → 15`; `1–15 → 16`. Os contratos compartilhados são as assinaturas de referência; detalhes internos triviais são decisão de implementação do Codex **desde que** não mudem a semântica aprovada.

### Mapa de cobertura F2-T01..T40

A coluna “Tarefa” aponta o **teste dono principal**; cenários podem se repetir na UI/E2E sem duplicar a responsabilidade. **T22 é deliberadamente NOT_RUN** até gate independente do Firebase Emulator.

| Cenário | Dono | Estado antes da execução |
| --- | --- | --- |
| `F2-T01` | Task 2 | PLANNED |
| `F2-T02` | Task 2 | PLANNED |
| `F2-T03` | Task 2 | PLANNED |
| `F2-T04` | Task 5 | PLANNED |
| `F2-T05` | Task 5 | PLANNED |
| `F2-T06` | Task 5 | PLANNED |
| `F2-T07` | Task 4 | PLANNED |
| `F2-T08` | Task 7 | PLANNED |
| `F2-T09` | Task 7 | PLANNED |
| `F2-T10` | Task 12 | PLANNED |
| `F2-T11` | Task 11 | PLANNED |
| `F2-T12` | Task 11 | PLANNED |
| `F2-T13` | Task 12 | PLANNED |
| `F2-T14` | Task 3 | PLANNED |
| `F2-T15` | Task 8 | PLANNED |
| `F2-T16` | Task 8 | PLANNED |
| `F2-T17` | Task 3 | PLANNED |
| `F2-T18` | Task 13 | PLANNED |
| `F2-T19` | Task 9 | PLANNED |
| `F2-T20` | Task 14 | PLANNED |
| `F2-T21` | Task 16 | PLANNED |
| `F2-T22` | Task 15 | NOT_RUN por gate próprio de Emulator |
| `F2-T23` | Task 6 | PLANNED |
| `F2-T24` | Task 11 | PLANNED |
| `F2-T25` | Task 8 | PLANNED |
| `F2-T26` | Task 7 | PLANNED |
| `F2-T27` | Task 9 | PLANNED |
| `F2-T28` | Task 3 | PLANNED |
| `F2-T29` | Task 1 | PLANNED |
| `F2-T30` | Task 4 | PLANNED |
| `F2-T31` | Task 13 | PLANNED |
| `F2-T32` | Task 2 | PLANNED |
| `F2-T33` | Task 11 | PLANNED |
| `F2-T34` | Task 12 | PLANNED |
| `F2-T35` | Task 12 | PLANNED |
| `F2-T36` | Task 9 | PLANNED |
| `F2-T37` | Task 9 | PLANNED |
| `F2-T38` | Task 10 | PLANNED |
| `F2-T39` | Task 1 | PLANNED |
| `F2-T40` | Task 7 | PLANNED |

**Aceite:** seis capacidades F0 (CRUD editais, principal, arquivados, verticalização, importação, aula↔assunto), integridade e idempotência, UI acessível A-01, operações e backup sem perda, custo/limites documentados, código revisado e integrado à `v2`, V1 intacta e **gate humano**. F2 não inclui timer F4, calendário/Reta Final F3, dashboard F6, sync real Firebase F7, migração/cutover F8.

**Próxima ação humana:** revisar e aprovar **este writing-plans**. Somente depois o ChatGPT escreverá o GOAL de execução para Codex. A aprovação da spec F2 não autorizou execução F2 nem instalação de emulator.
