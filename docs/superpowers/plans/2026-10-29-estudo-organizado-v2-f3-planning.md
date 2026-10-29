# Estudo Organizado V2 — F3 Planning, Calendário, Ciclo e Reta Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar, em uma única F3 na `v2`, as 11 capacidades do inventário F0 — calendário/organização, Ciclo sem data de prova, Reta Final com prova marcada, wizard, editor, rascunhos, importação/exportação, prioridade, conflitos, histórico e redistribuição — conforme as 26 decisões D-F3-01..26, sem implementar sessões F4 nem sincronização real F7.

**Architecture:** Estender o monólito modular `apps/v2` e seus contratos F1/F2: modelos TypeScript puros, comandos de aplicação, IndexedDB V2 canônico com transações e outbox únicas, projeções reconstituíveis de calendário e UI React. Manter múltiplos cenários independentes por edital, um cenário ativo por edital, capacidade global oficial apenas para cenários ativos, motor de planejamento determinístico e commits com CAS; todas as operações sensíveis têm prévia, não há mutação por renderização.

**Tech Stack:** React 19, TypeScript 6 strict, Vite 8, IndexedDB nativo, Vitest 5, Playwright 1.64, ESLint 10, CSS/tokens A-01; versões atualmente declaradas em `apps/v2/package.json`, confirmar no preflight e preservar lockfile. Sem Firebase SDK/CLI/emulador, serviços remotos reais, bibliotecas de agendamento ou novos pacotes por padrão.

**Spec:** `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f3-planning-design.md` — `F3_SPEC_APPROVED` em 2026-10-29, decisões D-F3-01..26, commit documental de referência `1f9a58dfbe966868096f9393d79f157fa758910f`. A spec-mestra D01–D27/A-01/A-02 e a F2 são vinculantes.

**Estado deste plano:** **`F3_PLAN_APPROVED_FOR_GOAL`**, aprovação integral e explícita do proprietário em 2026-10-29 para as **20 tarefas**. O plano está autorizado como base documental para preparar um GOAL único do Codex Desktop; **a aprovação não autoriza execução**, testes, instalação, integração, deploy, Firebase ou qualquer mudança de código. A leitura do repositório no planejamento foi remota; trabalho local, stashes e worktrees deverão ser verificados no preflight do GOAL.

## Global Constraints

- **Repositório:** `matheussilva421/estudo-organizado`. Trabalho funcional futuro **somente em `apps/v2/**` na `v2`**; `main`/V1, root `src/**`, `firestore.rules`, `.github/**`, deploy, SW e configs de produção da V1 são somente leitura. Sem merge V2→`main`, publicação, billing ou Action nova.
- **Estado anterior:** F2 `F2_ACCEPTED_WITH_RESERVATIONS`: referência `8e4dc71`, 188 testes unitários/50 E2E **reportados**, sem assumir nova execução. Três lacunas F7 (CAS/remoto, ciclos remotos, supressão de eco); 4 HIGH F0 `UNVERIFIED`; `F2-T22 NOT_RUN`. Dados reais, OAuth/Firebase e backup produtivo não homologados.
- **Ambiente V2:** origem `http://127.0.0.1:18431`, banco `estudo-organizado-v2`, `LOCAL_DB_VERSION=2` no baseline remoto, `DOMAIN_SCHEMA_VERSION=1`; não reutilizar versões numéricas da V1. Migração é aditiva, preserva stores F1/F2, `operations`, `outbox`, `conflicts`, tombstones, recibos e perfis.
- **Identidade F2:** `StudySubject` disciplina canônica; `EditalDiscipline` vínculo por edital/alias; `Assunto` e `Aula` possuem `editalDisciplineId`; sem matching autoritativo por nome. `profileId` local não equivale a UID remoto. Sem cross-profile acidental.
- **Dados e sync:** usar única outbox durável F1/F2; registrar envelopes F3 com identidade e versão, **sem** habilitar entrega remota real; fake de contrato não prova Firebase. Não inserir snapshot gigante do plano em um único documento remotamente elegível. Guard de envio F1/F2 permanece fail-closed.
- **Tempos:** `CivilDate` para prova sem hora; zona IANA para horários; UTC auditável; sem inferir horário da prova; DST inexistente é rejeitado, ambíguo exige seleção explícita. Janelas que cruzam meia-noite e mudança de zona do dispositivo exigem testes.
- **Capacidade:** uma capacidade global por perfil apenas de cenários `ACTIVE`; projeção não é compromisso; confirmado não é execução; dia sem estudo válido; exceção de data > período especial > semanal. Fixações nunca remanejadas silenciosamente. Excesso é `UNALLOCATED` visível.
- **Persistência:** toda mutação oficial valida revisão no interior da transação IndexedDB, inclui `operationId`, journal/metadados e outbox quando aplicável; erro/abort/quota não confirma, não apaga draft, não duplica operação. Dados críticos, checkpoints manuais e tombstones não recebem purge automático.
- **UX:** oito temas A-01 (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex, Plasma), desktop/tablet/celular, teclado, foco, contraste, touch, offline e estados honestos de local/remoto. Reutilizar `styles.css`, `tokens.css`, padrões dos componentes F2, sem refazer design system.
- **Sem overengineering:** um domínio lógico Planejamento com arquivos focados, sem microserviços, CRDT, event sourcing total, engine externa, jobs remotos ou staging de importação indiscriminado. Reusar o `CommitResult` F2 ou ampliá-lo com discriminante `BLOCKED` de maneira compatível.
- **Qualidade:** TDD RED→GREEN→regressão por tarefa, testes sintéticos, revisão independente ao fechar módulos críticos e revisão holística final. `npm --prefix apps/v2 run typecheck|lint|test:unit|test:e2e|build`. Testes locais são futuros, **nenhum PASS novo é afirmado aqui**.
- **Git/GitHub hygiene:** preflight `git status`, HEAD local/remoto, branches, PRs, worktrees, stashes, commits exclusivos e tarefas concorrentes no outro PC. Preferir `v2`; worktree temporária apenas para isolamento exigido, e limpeza somente com prova de integração e autorização. Sem `reset --hard`, `push --force`, fechamento de PR com mudanças únicas ou deletes destrutivos.
- **Gates:** **plano aprovado exclusivamente para preparação do GOAL**; execução exige autorização expressa do GOAL. Cada task poderá produzir um commit pequeno e verificável durante a execução autorizada, **sem push/merge automático**. Códigos integrados na `v2`, testes, aceite e publicação são estados distintos.

## Review Focus — cinco riscos prioritários não triviais

1. **Duas abas e mesmo plano:** uma aba ativa/corrige o cenário enquanto outra aplica draft antigo. Commit transacional rejeita ou oferece merge e conserva draft (`F3-T02`, `T13`–`T15`; Tasks 4, 12, 13).
2. **Fuso/DST com blocos fixos:** horário local inexistente/ambíguo e intervalo cruzando meia-noite não devem criar vaga falsa ou modificar a data civil da prova (`F3-T05`–`T07`, `T29`; Tasks 2, 5, 6).
3. **Plano grande + quota no meio:** geração/importação com centenas de blocos deve falhar integralmente ou dividir por proposta aprovada, sem ativação parcial ou descarte de `UNALLOCATED` (`F3-T11`, `T12`, `T30`, `T38`, `T39`; Tasks 3, 9, 16, 19).
4. **Contaminação por perfil/edital/UID:** referência homônima ou importação entre bibliotecas não cria vinculação implícita; export seletivo não vaza credenciais, sessões ou outro edital (`F3-T19`, `T31`, `T34`, `T35`; Tasks 3, 15, 16).
5. **Restaurar checkpoint após F4:** undo/redo e aproveitamento acadêmico entre editais nunca transformam a mesma sessão em dois registros nem reescrevem fatos (`F3-T32`, `T36`, `T37`; Tasks 14, 17).

---

## 0. Preflight obrigatório ANTES da Task 1 (sem mutações)

**Referências remotas lidas no planejamento:** `v2=1f9a58d` e `main=9046cfa` no registro documental; **não presumir que permanecem iguais** na execução. Arquivo principal de spec e roadmap previamente verificados; branches documentais históricas da V2 existem; PRs abertos eram zero no último diagnóstico remoto. Estado de árvore e worktrees locais **não observado**.

- [ ] Verificar repositório, `git rev-parse HEAD`, `git status --short --branch`, `git branch -avv`, `git worktree list --porcelain`, `git stash list`, `git log --oneline --left-right --cherry-pick origin/v2...v2`, `git ls-remote origin refs/heads/main refs/heads/v2`; consultar PRs e Actions existentes sem modificar.
- [ ] Conferir `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f3-planning-design.md`, `ROADMAP.md`, decisões D-F3-01..26 e artefatos F2; parar se houver spec divergente, alterações exclusivas concorrentes ou tarefa de outro Codex sobre a mesma área.
- [ ] Conferir origens, dependências, lockfile e `apps/v2/src/**`; inspecionar os contratos reais antes de aplicar arquivos propostos abaixo. Se algum símbolo mudou, ajustar apenas caminhos compatíveis e documentar equivalência; decisão arquitetural material exige gate humano.
- [ ] Executar baseline **localmente**, capturando código de saída e logs: `npm --prefix apps/v2 run typecheck`, `npm --prefix apps/v2 run lint`, `npm --prefix apps/v2 run test:unit`, `npm --prefix apps/v2 run test:e2e`, `npm --prefix apps/v2 run build`. Nunca tratar status histórico como execução nova.
- [ ] Identificar se há triggers de publicação no push `v2`; não acionar workflows, PRs, Firebase ou deploy. Confirmar autorização de integração futura separadamente. Criar registro de baseline no relatório existente/singular da F3 somente na fase executada.

## 1. Mapa de arquivos e ownership — decisões de decomposição

**Arquivos existentes a reutilizar/estender**, conforme leitura remota da `v2`:

| Arquivo | Intervenção prevista |
| --- | --- |
| `apps/v2/src/domain/edital.ts`, `content.ts`, `delete.ts` | Somente tipos e validações F2; evitar mutações se não exigidas por contrato |
| `apps/v2/src/domain/versions.ts` | Incrementar `LOCAL_DB_VERSION` sob migração; outros números só com contrato explícito |
| `apps/v2/src/application/content-service.ts`, `content-commands.ts` | Consumir `ContentSnapshot` e `CommitResult`; estender só quando indispensável |
| `apps/v2/src/application/sync-types.ts` | Extensão **delimitada** de envelopes de operações F3, sem habilitar delivery remoto |
| `apps/v2/src/platform/content-migration.ts` | Adicionar stores/índices F3 no único `upgradeV2Schema` |
| `apps/v2/src/platform/indexeddb.ts` | Adicionar constantes `STORES` F3; preservar `openV2Database`, erro, helpers e outbox existentes |
| `apps/v2/src/platform/local-content-repository.ts`, `import-commit.ts` | **Ler e reaproveitar padrões**, sem incorporar F3 ao switch gigante de F2 |
| `apps/v2/src/platform/local-events.ts` | Manter compatibilidade do evento; não quebrar notificações F2; agregar tipo opcional de mudança de planejamento se necessário |
| `apps/v2/src/platform/e2e-harness.ts`, `e2e-fault.ts` | Acrescentar somente comandos F3 de testes e faults consistentes |
| `apps/v2/src/presentation/App.tsx`, `styles.css`, `tokens.css` | Entradas de navegação/fluxos F3 e estilos com tokens existentes |
| `apps/v2/playwright.config.ts`, `vitest.config.ts` | Reusar Chromium local/JSdom; só alterar para projetos mobile se comprovadamente necessário |

**Novos arquivos propostos** (sob `apps/v2/`, nomes e interfaces normativos do plano; divisão final pode ser compactada se já existir equivalente):

| Caminho | Responsabilidade exclusiva |
| --- | --- |
| `src/domain/planning.ts` | Cenários, blocos, IDs, estados e invariantes estruturais |
| `src/domain/planning-time.ts` | Data civil, zona IANA, DST e recorrência |
| `src/domain/planning-capacity.ts` | Disponibilidade semanal/exceções e cálculo de viabilidade |
| `src/domain/planning-cycle.ts` | Cursores, decisões de avanço e projeções flexíveis |
| `src/domain/planning-priority.ts` | Perfis versionados e critérios determinísticos |
| `src/domain/planning-generator.ts` | Proposta/explicação de alocação de blocos |
| `src/domain/planning-final-stretch.ts` | Transição para Reta Final e estados de prova |
| `src/domain/planning-merge.ts` | Merge três-vias e detecção granular de conflitos |
| `src/domain/planning-history.ts` | Operações compensatórias e regras de checkpoint |
| `src/domain/planning-execution-contract.ts` | Referências planejado↔sessão, sem implementar F4 |
| `src/application/planning-service.ts` | Comandos/casos de uso e resultado de commit F3 |
| `src/application/planning-queries.ts` | Consultas e agregações derivadas de calendário/cenários |
| `src/application/planning-portability.ts` | Parse/preview/export, adaptadores legados seguros |
| `src/platform/local-planning-repository.ts` | Transações/índices/escopo CAS/ops/outbox da F3 |
| `src/platform/planning-import-commit.ts` | Commit atômico da importação de cenário aprovado |
| `src/presentation/components/PlanningDashboard.tsx` | Lista, estados e comparação de cenários |
| `src/presentation/components/PlanningCalendar.tsx` | Visões dia/semana/mês e capacidade/overbooking |
| `src/presentation/components/PlanningWizard.tsx` | Wizard com preview e confirmação |
| `src/presentation/components/StudyCycle.tsx` | Sequência, cursor, pendências e ações do Ciclo |
| `src/presentation/components/FinalStretch.tsx` | Reta Final, prova e replanejamento assistido |
| `src/presentation/components/PlanningEditor.tsx` | Draft, seleção e edição por bloco/lote |
| `src/presentation/components/PlanningHistory.tsx` | Checkpoints, compensação e auditoria |
| `src/presentation/components/PlanningPortability.tsx` | Import/export com reconciliação e recibos |
| `src/presentation/components/PlanningConflicts.tsx` | Resolver conflitos por alternativa, sem LWW |
| `tests/unit/f3-*.test.ts`, `tests/e2e/f3-*.spec.ts` | TDD tipado e E2E V2 sem dados reais |
| `tests/fixtures/f3-*.json` | JSON V1/V2 sintético, datas/zonas e cenários adversariais |

Não criar novas abstrações genéricas, mock servers ou estruturas replicadas se o código atual fornecer interface equivalente.

## 2. Contratos transversais — nomes e assinaturas a implementar

**Em `src/domain/planning.ts`:**

```ts
export type PlanningKind = 'CYCLE' | 'FINAL_STRETCH';
export type ScenarioStatus = 'DRAFT'|'ACTIVE'|'INACTIVE'|'SUSPENDED'|'CLOSED'|'ARCHIVED';
export type BlockAllocation = 'PROJECTED'|'CONFIRMED_DAY'|'CONFIRMED_TIME'|'UNALLOCATED';
export type CivilDate = string; // validateCivilDate() comprova YYYY-MM-DD gregoriano
export type PlanningScenario = {
  id:string; profileId:string; editalId:string; kind:PlanningKind; name:string;
  status:ScenarioStatus; localRevision:number; schemaVersion:number;
  priorityProfileId:string; priorityProfileRevision:number; provenance?:string;
  examDate?:CivilDate|null; referenceZone:string;
};
export type PlanBlock = {
  id:string; profileId:string; editalId:string; scenarioId:string;
  editalDisciplineId:string; assuntoId?:string; aulaId?:string;
  plannedMinutes:number; allocation:BlockAllocation; civilDate?:CivilDate;
  localStart?:string; localEnd?:string; timeZone?:string; offsetChoice?:string;
  priority:number; localRevision:number; sourceOperationId:string;
};
export type PlanningScope = { profileId:string; operationId:string; baseRevision?:number|null };
export type PlanningOutcome<T> =
  | {kind:'LOCAL_COMMITTED';value:T}
  | {kind:'CONFLICT';current?:unknown}
  | {kind:'INVALID';code:string}
  | {kind:'BLOCKED';reason:string}
  | {kind:'FAILED';reason:string};
export function validateScenario(value:PlanningScenario):PlanningScenario;
export function validatePlanBlock(value:PlanBlock):PlanBlock;
```

**Nota de compatibilidade:** `LOCAL_DB_VERSION=2` lido no baseline, F3 deverá avançar com migração F3 de stores/índices; não reusar a versão do backup como schema de planejamento. `OutboxOperation` existente em `application/sync-types.ts` hoje usa `ContentEntityType` e `ContentEntity` restritos à F2. Task 3 deve expandir envelopes de forma **discriminada, sem dependência circular**; nunca enfileirar um snapshot único gigante com todo o cenário. Guard de entrega para F3 fica `BLOCKED`/fake até F7.

**Interfaces de domínio entre tarefas** (contratos exatos deste plano; tipos auxiliares locais definidos no arquivo que os produz):

```ts
// planning-time.ts
export function validateCivilDate(value:string):CivilDate;
export function resolveZonedInterval(input:{date:CivilDate; start:string; end:string; zone:string; offsetChoice?:string}):
  {ok:true;startInstant:string;endInstant:string}|{ok:false;code:'NONEXISTENT_TIME'|'AMBIGUOUS_TIME'|'INVALID_INTERVAL'|'INVALID_ZONE'};
// planning-capacity.ts
export type CapacityInput = {date:CivilDate; zone:string; weekly:WeeklyAvailability; exceptions:AvailabilityException[]; reservations:PlanBlock[]; fixedCommitments?:FixedCommitment[]};
export function evaluateDailyCapacity(input:CapacityInput):{availableMinutes:number;reservedMinutes:number;remainingMinutes:number;conflictBlockIds:string[]};
// planning-cycle.ts
export function advanceCycle(input:CycleState, decision:CycleDecision):CycleState;
export function projectCycle(input:CycleProjectionInput):PlanBlock[];
// planning-priority.ts
export function rankContent(input:PriorityInput):RankedContent[];
// planning-generator.ts
export function generatePlanPreview(input:PlanGenerationInput):PlanGenerationPreview;
// planning-final-stretch.ts
export function previewFinalStretchTransition(input:TransitionInput):TransitionPreview;
export function previewExamDateChange(input:ExamDateChangeInput):TransitionPreview;
// planning-merge.ts
export function mergePlanningDraft(input:{base:PlanningScenarioSnapshot;current:PlanningScenarioSnapshot;draft:PlanningDraft}):MergePreview;
// planning-history.ts
export function previewCompensation(input:CompensationInput):CompensationPreview;
// planning-execution-contract.ts
export function summarizeExecutionLinks(input:ExecutionLinkFixture[]):{uniqueMinutes:number;coverageByEdital:Record<string,string[]>};
// application/planning-service.ts
export interface PlanningRepository {
  commit(input:PlanningCommit):Promise<PlanningOutcome<PlanningScenarioSnapshot>>;
  loadScenario(profileId:string,scenarioId:string):Promise<PlanningScenarioSnapshot|null>;
  listScenarios(profileId:string,editalId?:string):Promise<PlanningScenario[]>;
  saveDraft(draft:PlanningDraft):Promise<PlanningOutcome<PlanningDraft>>;
  loadDraft(profileId:string,scenarioId:string):Promise<PlanningDraft|null>;
}
```

**Contratos auxiliares obrigatórios:** `WeeklyAvailability`, `AvailabilityException`, `FixedCommitment`, `CycleState`, `CycleDecision`, `CycleProjectionInput`, `PriorityInput`, `RankedContent`, `PlanGenerationInput`, `PlanGenerationPreview`, `TransitionInput`, `ExamDateChangeInput`, `TransitionPreview`, `PlanningScenarioSnapshot`, `PlanningDraft`, `MergePreview`, `CompensationInput`, `CompensationPreview`, `ExecutionLinkFixture` e `PlanningCommit` devem ser exportados **nos arquivos responsáveis acima**, com campos suficientes às asserções de sua task, e importados por outras tasks. Não definir aliases concorrentes em arquivos diferentes. `PlanningCommit` carrega `scope`, `scenarioId`, `baseRevision`, `changes` e `approvedPreviewToken` quando aplicável. Revisão-base é verificada **dentro** da transação. O snapshot de cenário contém cenário+blocos, mas é apenas resultado de consulta/preview; não é payload monolítico de sync.

**Comandos locais atuais — verificados no remoto:** `npm --prefix apps/v2 run typecheck`, `... run lint`, `... run test:unit -- tests/unit/<name>.test.ts`, `... run test:e2e -- tests/e2e/<name>.spec.ts`, `... run build`. Para rodar Playwright via script usa `127.0.0.1:18431`, `playwright.config.ts` com build:e2e/preview e Chromium; verificar dependências instaladas antes do baseline. Comandos de teste só na futura execução autorizada.

---

## Task 1 — Contratos puros de planejamento e validação de escopo

**Files:** Create `apps/v2/src/domain/planning.ts`; Test `apps/v2/tests/unit/f3-planning-domain.test.ts`.

**Interfaces:** produz `PlanningKind`, `ScenarioStatus`, `BlockAllocation`, `PlanningScenario`, `PlanBlock`, `PlanningScope`, `PlanningOutcome`, `validateScenario`, `validatePlanBlock`; consome IDs F2 (`EditalDiscipline`), sem importar React/IndexedDB.

- [ ] **Step 1 — RED:** escrever `scenario_is_scoped_and_requires_exam_date_for_final_stretch` e `block_rejects_invalid_scope_or_minutes`; asserções: cenário `FINAL_STRETCH` sem `examDate` é `INVALID`, `CYCLE` sem data é válido (não atribuir exame implicitamente); `plannedMinutes=0`, IDs vazios e `profileId` divergente são rejeitados, sem modificação do input.
- [ ] **Step 2 — verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/f3-planning-domain.test.ts`; esperado FAIL por import/função ausente, sem alterar testes F2.
- [ ] **Step 3 — GREEN:** implementar os tipos e validadores nas assinaturas compartilhadas, com mensagens/códigos determinísticos; congelar estados, revisão e schema sem assumir nome de pessoa como identidade.
- [ ] **Step 4 — verificar:** mesmo teste PASS + `npm --prefix apps/v2 run typecheck` PASS. Acrescentar caso perfil misturado entre edital/bloco e validar que nenhuma propriedade é removida por `validate*`.
- [ ] **Step 5 — commit apenas no GOAL autorizado:** `git add apps/v2/src/domain/planning.ts apps/v2/tests/unit/f3-planning-domain.test.ts && git commit -m "feat(v2-f3): define planning scenarios and blocks"`.

**Cobertura:** D-F3-01/02/11/16/18; preparação F3-T01/T02/T24/T31.

## Task 2 — CivilDate, IANA, DST e intervalos

**Files:** Create `apps/v2/src/domain/planning-time.ts`; Test `apps/v2/tests/unit/f3-time.test.ts`; Test fixture opcional `apps/v2/tests/fixtures/f3-timezones.json`.

**Interfaces:** produz `validateCivilDate`, `resolveZonedInterval`; consome `CivilDate`. `resolveZonedInterval` retorna discriminação explícita conforme contrato compartilhado.

- [ ] **Step 1 — RED:** teste `civil_date_never_moves_with_device_zone` com `2027-01-24`; testar ano bissexto/data inválida, mudança UTC/browser e nenhuma hora inferida. Teste `dst_gap_rejected_overlap_requires_offset` com zona sintética concreta `America/New_York`, horário inexistente `2026-03-08 02:30`, horário ambíguo `2026-11-01 01:30` e resolução por offset escolhido; cruzamento de meia-noite.
- [ ] **Step 2 — verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/f3-time.test.ts`; FAIL esperado.
- [ ] **Step 3 — GREEN:** validar calendário civil; resolver horário IANA com `Intl.DateTimeFormat`/API já disponível sem depender do fuso do dispositivo; detectar gap/fold por candidatos de offset, exigir escolha no fold. Se a plataforma não oferecer API estável, a dependência específica requer medição, justificativa e gate antes de instalação.
- [ ] **Step 4 — verificar PASS:** casos de DST/gap/fold, datas inválidas e intervalo cruzando dia; typecheck e teste isolado PASS.
- [ ] **Step 5 — commit:** `git add apps/v2/src/domain/planning-time.ts apps/v2/tests/unit/f3-time.test.ts && git commit -m "feat(v2-f3): validate civil dates and zoned intervals"`.

**Cobertura:** F3-T05/06/07; D-F3-04.

## Task 3 — Migração aditiva F3 e repositório transacional mínimo

**Files:** Modify `apps/v2/src/domain/versions.ts`, `src/platform/indexeddb.ts`, `src/platform/content-migration.ts`, `src/application/sync-types.ts`; Create `src/application/planning-service.ts`, `src/platform/local-planning-repository.ts`; Test `tests/unit/f3-schema.test.ts`, `f3-commit.test.ts`.

**Interfaces:** produz `PlanningRepository.commit/loadScenario/listScenarios/saveDraft/loadDraft`, `PlanningCommit`, `PlanningScenarioSnapshot`, `PlanningDraft` e novos nomes `STORES.planningScenarios`, `planningBlocks`, `planningDrafts`, `planningCheckpoints`, `planningPriorityProfiles`, `planningAvailability`, `planningImports`; usa única `STORES.operations`, `outbox`, `conflicts`. Objetos por `[profileId,id]`; índices por `[profileId,editalId]`, `[profileId,scenarioId]`, status e `civilDate`, conforme consultas. Não criar stores até provar necessidade de cada um: índices existentes e reuso têm precedência.

- [ ] **Step 1 — RED:** em `f3-schema`, abrir DB V2 com dados F2, simular upgrade v2→v3, garantir conteúdo/IDs/operations/outbox intactos; testar abertura concorrente bloqueada sem drop. Em `f3-commit`: `same_operation_id_is_idempotent`, `different_payload_rejected`, `abort_quota_preserve_all_and_draft`, `cross_profile_refused`; asserts operações/outbox não criam efeito parcial.
- [ ] **Step 2 — verificar RED:** executar isoladamente `f3-schema.test.ts` e `f3-commit.test.ts`; FAIL esperado.
- [ ] **Step 3 — GREEN:** atualizar versão de DB de maneira aditiva pelo `upgradeV2Schema`; implementar repo com leitura, validação/CAS **na transação IDB**, persistir records + registro de operação + outbox F3 na mesma transação; integrar notificação pós-commit. **Sync envelope:** adaptar união F1/F2 de forma discriminada por tipos sem ciclo de imports; delivery F3 explícito `BLOCKED`/fake até F7. Não enviar plano inteiro como um payload remoto.
- [ ] **Step 4 — verificar PASS:** testes schema/commit e regressão F2 schema/import/outbox + typecheck/lint; comparar contagens antes/depois e erro QUOTA/ABORT. Validar que o fake não permite envio real por padrão.
- [ ] **Step 5 — commit:** adicionar somente arquivos da Task 3; `git commit -m "feat(v2-f3): migrate planning stores and atomic repository"`.

**Risco/gate:** integração da união de `ContentEntityType`/`OutboxOperation` pode revelar restrição arquitetural. Não contornar criando segunda outbox; pausar por gate se a alteração exigir decisão material A-02. **Cobertura:** F3-T11/12/15/41/42.

## Task 4 — Cenários múltiplos e isolamento sem ativação prematura

**Files:** Modify `src/domain/planning.ts`, `src/platform/local-planning-repository.ts`; Create `tests/unit/f3-scenarios.test.ts`, `tests/e2e/f3-scenarios.spec.ts`.

**Interfaces:** adicionar `previewScenarioActivation(input:{profileId:string;editalId:string;nextScenarioId:string;scenarios:PlanningScenario[];blocks:PlanBlock[]}):{affectedScenarioIds:string[];affectedBlockIds:string[]}`; `PlanningRepository.commit()` grava criação e mudanças de estado com CAS. A **ativação atômica com checkpoint** será completada e testada pela Task 13; a Task 4 não libera ativação sem checkpoint. Não utilizar `primaryEdital` como sinônimo de cenário ativo.

- [ ] **Step 1 — RED:** dois cenários no edital TJPB podem existir sem ativação; uma tentativa de ativação sem checkpoint retorna `BLOCKED` sem modificar estados; DPE-PB pode possuir cenário ativo independente; cenário alternativo não ocupa capacidade; duas abas com base antiga conflitam sem perder mudanças.
- [ ] **Step 2 — verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/f3-scenarios.test.ts`; esperado FAIL.
- [ ] **Step 3 — GREEN:** implementar preview, CRUD mínimo de cenários e restrição de máximo um ACTIVE; a ativação **sem checkpoint deve retornar BLOCKED** nesta Task. Não criar mecanismo de checkpoint temporário ou contornar pré-condição; a Task 13 implementa ativação com checkpoint atômico no repo.
- [ ] **Step 4 — verificar PASS:** unitário e E2E `f3-scenarios.spec.ts`; recarregar e conferir cenários persistidos/perfis separados, ativação prematura `BLOCKED`; teste completo de ativação passa na Task 13.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): manage isolated scenarios and activation"`.

**Cobertura:** F3-T01/04; F3-T02/03 dependem da Task 13 para ativação completa. **A Task 4 deve ficar testável sem relaxar a exigência de checkpoint.**

## Task 5 — Disponibilidade semanal, exceções e capacidade global

**Files:** Create `src/domain/planning-capacity.ts`, `tests/unit/f3-capacity.test.ts`.

**Interfaces:** `WeeklyAvailability` por dia e janelas; `AvailabilityException` por `CivilDate`/período; `evaluateDailyCapacity(CapacityInput)` conforme contrato; entrada de blocos somente ACTIVE em chamadas de produção (validação explícita no service).

- [ ] **Step 1 — RED:** rotina de 180 minutos, exceção quarta zero, período especial de 120 e override pontual de 60; confirmar precedência específica>período>semana, nenhum desconto duplo para dois compromissos fixos parcialmente sobrepostos, reserva F3 de outro edital soma uma vez, INACTIVE não entra.
- [ ] **Step 2 — verificar RED:** `npm --prefix apps/v2 run test:unit -- tests/unit/f3-capacity.test.ts`.
- [ ] **Step 3 — GREEN:** implementar normalização e união de janelas de tempo, incluindo compromissos não acadêmicos declarados explicitamente no calendário, cálculo por fuso/dia civil; conflito entre exceções da mesma precedência retorna diagnóstico em vez de escolha arbitrária. Para intervalos fixos cruzando meia-noite, usar `resolveZonedInterval` da Task 2.
- [ ] **Step 4 — verificar PASS:** 0 min, >0, sobreposição, janela insuficiente apesar de minutos suficientes, dois editais, fim de semana e DST; unit/typecheck.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): evaluate shared availability and capacity"`.

**Cobertura:** F3-T03/04/07/28/29/30; D-F3-03/17/18.

## Task 6 — Consultas de calendário e elegibilidade temporal

**Files:** Create `src/application/planning-queries.ts`, `tests/unit/f3-calendar.test.ts`; Modificar `src/platform/local-planning-repository.ts` somente para índices/queries que faltarem.

**Interfaces:** `queryCalendar(input:{profileId:string;rangeStart:CivilDate;rangeEnd:CivilDate;activeOnly:boolean;blocks:PlanBlock[];scenarios:PlanningScenario[]}):CalendarDay[]`; `CalendarDay` inclui `civilDate`, `blocks`, `availableMinutes`, `reservedMinutes`, `unallocatedIds`, `conflicts` a partir da Task 5 (se disponibilidade fornecida ao serviço, definir parâmetro explícito e atualizar testes).

- [ ] **Step 1 — RED:** agenda mensal, semanal e diária do mesmo conjunto de IDs; histórico fechado é consultável por filtro mas não ocupa capacidade; prova sem hora mantém dia civil; block fixado preserva data em fuso do dispositivo diferente.
- [ ] **Step 2 — verificar RED:** teste `f3-calendar.test.ts` deve falhar.
- [ ] **Step 3 — GREEN:** consulta indexada do plano confirmado, projeções em memória regeneráveis, paginação por faixa; derivação de capacidade sem gravações no React. Usar resolver temporal e disponibilidade anteriores, sem engine duplicada.
- [ ] **Step 4 — verificar PASS:** testes unit + typecheck; verificar que range grande não dispara `getAll()` sem filtro em todos os stores.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): query calendar without duplicate state"`.

**Cobertura:** F3-T05/07/28/29/38; F0 Calendar/Organizer.

## Task 7 — Máquina de Ciclo: cursor, continuidade e avanços explícitos

**Files:** Create `src/domain/planning-cycle.ts`, `tests/unit/f3-cycle.test.ts`.

**Interfaces:** `CycleState` contém IDs de cenário/disciplina, sequência, cursor por disciplina, pendências e revisão; `CycleDecision` discriminada `ADVANCE|CONTINUE|DEFER|SKIP_WITH_REASON|REOPEN|NEW_ROUND`; `advanceCycle(input,decision):CycleState` pura.

- [ ] **Step 1 — RED:** cenário sem exame; sequência Constitucional→Administrativo; retorno a Constitucional propõe assunto seguinte; adiar mantém pendência; pular exige justificativa; round preserva histórico; mudar data do sistema **não** avança cursor.
- [ ] **Step 2 — verificar RED:** `f3-cycle.test.ts` FAIL.
- [ ] **Step 3 — GREEN:** implementar transições imutáveis e validação de IDs F2; conservar semântica de conclusão do **planejamento**, não execução F4.
- [ ] **Step 4 — verificar PASS:** sequência, aula N:N F2, conteúdo arquivado sinalizado, mudança de ordem sem apagar cursor; unit/typecheck.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): implement explicit cycle progression"`.

**Cobertura:** F3-T20/21/31; D-F3-11/13/15/16.

## Task 8 — Projeção flexível do Ciclo e compromissos fixados

**Files:** Modify `src/domain/planning-cycle.ts`; Create `tests/unit/f3-cycle-projections.test.ts`.

**Interfaces:** `projectCycle(CycleProjectionInput):PlanBlock[]` recebe sequência/cursor, horizonte de dias, prioridades, capacidade da Task 5 e reservas fixadas; marca novos itens `PROJECTED` ou `UNALLOCATED`, sem gravar.

- [ ] **Step 1 — RED:** janela de 14 dias **como fixture, não padrão de produto**; gerar apenas horizonte; alteração de sequência refaz projeções sem mudar bloco `CONFIRMED_TIME`; capacidade zero gera `UNALLOCATED`; duas execuções com mesmas entradas têm resultado semântico igual.
- [ ] **Step 2 — verificar RED:** `f3-cycle-projections.test.ts` FAIL.
- [ ] **Step 3 — GREEN:** projetar sobre slots livres sem considerar projeções anteriores como compromissos confirmados; não criar tempo estudado; fornecer razão para não alocação; limitar processamento por configuração.
- [ ] **Step 4 — verificar PASS:** preservar pin fora da janela, replay idempotente, sem sobreposição de intervalos, ordenação estável; unit/typecheck.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): project cycle while preserving fixed blocks"`.

**Cobertura:** F3-T22/23/28/30; D-F3-14/24.

## Task 9 — Prioridade versionada e wizard gerador determinístico

**Files:** Create `src/domain/planning-priority.ts`, `src/domain/planning-generator.ts`, `tests/unit/f3-priority.test.ts`, `f3-generator.test.ts`.

**Interfaces:** `rankContent(PriorityInput):RankedContent[]` usa revisão fixada, pesos/overrides e fatores observáveis; `generatePlanPreview(PlanGenerationInput):PlanGenerationPreview` retorna blocos, justificativas, `unallocated`, `inputRevisionSignature`, `limits`; sem efeitos persistentes.

- [ ] **Step 1 — RED:** perfis prioridade V1→V2 versionados (exemplo `p1@1` não muda ao criar `p1@2`); ranking com empate determinístico por IDs estáveis; 8 disciplinas, 120 assuntos fixture; disponibilidade limitada gera itens `UNALLOCATED` íntegros, nenhuma previsão silenciosa de desempenho.
- [ ] **Step 2 — verificar RED:** executar `f3-priority.test.ts`, `f3-generator.test.ts` → FAIL.
- [ ] **Step 3 — GREEN:** implementar pesos configurados, overrides e justificativas; gerador reutiliza Tasks 2/5/7/8 e não faz heurísticas externas. IDs propostos são estáveis por operação/entrada e commit não duplica; sem ativação implícita.
- [ ] **Step 4 — verificar PASS:** cargas de 180 e 360 blocos sintéticos com contagem preservada; medir tempo/memória para **propor** limites, não fixar teto sem evidência; typecheck e unit.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): generate explainable planning previews"`.

**Cobertura:** F3-T08/09/30/38/39; D-F3-06/07/23/24.

## Task 10 — Reta Final, transição e alteração de prova

**Files:** Create `src/domain/planning-final-stretch.ts`, `tests/unit/f3-final-stretch.test.ts`.

**Interfaces:** `previewFinalStretchTransition(TransitionInput):TransitionPreview`; `previewExamDateChange(ExamDateChangeInput):TransitionPreview`; tipos de saída com `preservedBlockIds`, `affectedBlockIds`, `unallocatedBlockIds`, `newScenario`, `requiresConfirmation`.

- [ ] **Step 1 — RED:** sem data não gera Reta Final; data `2027-01-24` mantém CivilDate; transição Ciclo→Reta Final preserva refs, não duplica; prova antecipada/adiada muda somente planejamento futuro; suspensa/cancelada suspende projeções.
- [ ] **Step 2 — verificar RED:** `f3-final-stretch.test.ts` FAIL.
- [ ] **Step 3 — GREEN:** criar somente prévias puras, exigindo confirmação via `PlanningRepository.commit` (Task 3); encerramento após data é assistido e não presume prova realizada, preserva histórico.
- [ ] **Step 4 — verificar PASS:** fechamento/retorno Ciclo/nova prova, outro edital intocado, timezone não altera CivilDate; unit/typecheck.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): model final stretch and assisted transitions"`.

**Cobertura:** F3-T24/25/26/27; D-F3-11/12/21.

## Task 11 — Rascunho local persistente e operações de edição

**Files:** Modify `src/application/planning-service.ts`, `src/platform/local-planning-repository.ts`; Create `tests/unit/f3-drafts.test.ts`.

**Interfaces:** `PlanningDraft` exportado por `planning-service.ts` com `id,profileId,scenarioId,baseRevision,changes,lastSavedAt`; comandos `saveDraft/loadDraft`, `previewDraftCommit(profileId,scenarioId,draft):DraftCommitPreview`, `applyPlanningDraft(profileId,scenarioId,draft,approval):Promise<PlanningOutcome<...>>` em aplicação (repositório faz transação).

- [ ] **Step 1 — RED:** editar em lote e salvar draft; fechar/reabrir mantém 2 alterações e baseRevision; mudar cenário não aplica draft; erro QUOTA/ABORT preserva último draft confirmado e plano; `operationId` replay sem duplicação.
- [ ] **Step 2 — verificar RED:** `f3-drafts.test.ts` FAIL.
- [ ] **Step 3 — GREEN:** staging local próprio por cenário/perfil, autosave sem mutar plano oficial, preview com revisão e capacidade; commit transacional revisa escopo e sinaliza conflito, não limpa draft em falha.
- [ ] **Step 4 — verificar PASS:** garantir `LOCAL_COMMITTED` apenas após read-back e draft não aplicado ainda visível ao usuário; unit/typecheck.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): persist drafts and validate apply"`.

**Cobertura:** F3-T10/11/12/15; D-F3-08/18.

## Task 12 — Merge granular de três vias e concorrência real

**Files:** Create `src/domain/planning-merge.ts`, `tests/unit/f3-merge.test.ts`, `tests/e2e/f3-two-tabs.spec.ts`; Modify `src/application/planning-service.ts`, `src/platform/local-planning-repository.ts`.

**Interfaces:** `mergePlanningDraft({base,current,draft}):MergePreview`; 
`MergePreview` discriminado `MERGEABLE|CONFLICT` com `changes`, `conflicts: {blockId,field,base,current,incoming}[]`, `capacityImpact`.

- [ ] **Step 1 — RED:** aba A renomeia ou altera horário de bloco 1, aba B altera bloco 2 e consegue merge **após recalcular capacidade**; mesmo campo/mesmo bloco gera conflito; delete vs edit exige resolução; duas alterações independentes que excedem capacidade não fazem merge automático.
- [ ] **Step 2 — verificar RED:** `f3-merge.test.ts` FAIL; E2E `f3-two-tabs.spec.ts` definido mas ainda falha.
- [ ] **Step 3 — GREEN:** implementar merge de três vias puro, revalidar revisões na transação de escrita mesmo após preview e coordenar via mecanismo existente; preservar conflito/draft em IDB com identidade estável.
- [ ] **Step 4 — verificar PASS:** unit + Playwright duas abas reais + regressões F2 `f2-two-tabs-ui.spec.ts` e `f2-conflicts.test.ts`; sem `last-write-wins` por relógio.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): reconcile concurrent planning edits"`.

**Cobertura:** F3-T13/14/15/29; D-F3-10. **Gate independente:** revisor testa TOCTOU entre prévia e transação e tenta violar capacidade.

## Task 13 — Checkpoints, journal, undo/redo e retenção segura

**Files:** Create `src/domain/planning-history.ts`, `tests/unit/f3-history.test.ts`; Modify `src/platform/local-planning-repository.ts`, `src/application/planning-service.ts`.

**Interfaces:** `previewCompensation(CompensationInput):CompensationPreview`; `createCheckpoint(input:{profileId:string;scenarioId:string;operationId:string;kind:'MANUAL'|'AUTO'}):Promise<PlanningOutcome<...>>`; `previewRestoreCheckpoint(...)`; `applyCompensation(...)`. Checkpoint armazena snapshot/manifest versionado com integridade; journal usa operação existente quando possível, sem segunda trilha autoritativa.

- [ ] **Step 1 — RED:** checkpoint manual antes da troca de cenário; undo não reescreve uma sessão F4 sintética vinculada ao bloco; delete→undo gera nova operação; checkpoint dependente nunca é descartado; falha QUOTA no checkpoint impede ativação, não ativa parcialmente.
- [ ] **Step 2 — verificar RED:** `f3-history.test.ts` FAIL.
- [ ] **Step 3 — GREEN:** implementar checkpoint+manifest versionado, preview de restauração/compensação, dependências de draft/conflito/tombstones e retenção segura; **completar nesta Task a troca atômica de cenário ativo (desativar anterior + checkpoint + ativar novo)**, bloqueada desde a Task 4, e integrar aplicação Task 11; não limpar historicamente apenas por idade.
- [ ] **Step 4 — verificar PASS:** replay, caso de sessão futura sintética, dependência de versões, concorrência e falha no meio; testar `operations` e `outbox` persistidos, typecheck.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): checkpoint and compensate planning operations"`.

**Cobertura:** F3-T02/03/11/12/32/33; D-F3-02/05/25.

## Task 14 — Reconciliação F2 e contrato F4 multi-edital

**Files:** Create `src/domain/planning-execution-contract.ts`, `tests/unit/f3-content-links.test.ts`, `f3-f4-contract.test.ts`; Modify `src/application/planning-service.ts` para validação contextual.

**Interfaces:** `summarizeExecutionLinks(ExecutionLinkFixture[]):{uniqueMinutes:number;coverageByEdital:Record<string,string[]>}`; contratos de IDs 
`plannedBlockId?`, `sessionId`, `editalId`, `editalDisciplineId`, `assuntoId?`, `aulaId?`, `durationMinutes`; **não persistir sessão F4**.

- [ ] **Step 1 — RED:** assunto renomeado conserva referência; alias de disciplina não muda outros editais; soft delete/arquivamento sinaliza bloco futuro e impede uso inválido; duas refs homônimas não se mesclam; uma sessão sintética 60 min de dois editais retorna `uniqueMinutes=60`, sem concluir automaticamente dois blocos.
- [ ] **Step 2 — verificar RED:** `f3-content-links.test.ts`, `f3-f4-contract.test.ts` FAIL.
- [ ] **Step 3 — GREEN:** validar escopo e cadeia F2 antes de gerar/ativar/aplicar; referências órfãs→diagnóstico/reconciliação; sumarizador de cobertura conta sessão uma vez e preserva suas relações contextuais, sem escrever F4.
- [ ] **Step 4 — verificar PASS:** unidade + regressão F2 de hierarquia/exclusão, typecheck; provar ausência de gravação em stores de sessões (não existem nesta fase).
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): protect F2 links and define F4 reference contract"`.

**Cobertura:** F3-T19/31/32/36/37; D-F3-15/16/19/20.

## Task 15 — Importação de planejamentos V1/V2 com prévia conservadora

**Files:** Create `src/application/planning-portability.ts`, `src/platform/planning-import-commit.ts`, `tests/unit/f3-import.test.ts`, `f3-import-commit.test.ts`; Reuse fixtures existing `tests/fixtures/reta-final-legacy-equivalent.json`, `reta-final-legacy-equivalent-derived.json`, `reta-final-legacy-divergent.json`; Create `tests/fixtures/f3-plan-v2.json`.

**Interfaces:** `parsePlanningImport(input:string|Uint8Array,options:{namespace:string}):ParsePlanningResult`; `previewPlanningImport(parsed:ParsedPlanning,existing:PlanningScenarioSnapshot[]):PlanningImportPreview`; `LocalPlanningImportCommitter.apply(profileId:string,preview:PlanningImportPreview,approval:{confirmed:true;targetSignature:string}):Promise<PlanningOutcome<...>>`. Adaptador V1 **read-only**.

- [ ] **Step 1 — RED:** arquivos legados sem `schemaVersionRetaFinal`, `planId`, `revision` reconhecidos quando semanticamente válidos; equivalente não duplica; divergente preserva ambas as versões; mesmo nome/origem não confiável→ambíguo; JSON hostil/inválido/profundo/oversize rejeitado sem efeito.
- [ ] **Step 2 — verificar RED:** `f3-import.test.ts`/`f3-import-commit.test.ts` FAIL.
- [ ] **Step 3 — GREEN:** reutilizar `canonicalJson`, `sha256Hex`, políticas seguras de import F2; normalizar cópia, fingerprint com provenance estável, prévia e capacidade, assinatura de destino e revalidação CAS **na mesma transação**; recibo e entidades+outbox atômicos, sem staging/jobs novos.
- [ ] **Step 4 — verificar PASS:** repetir import, falha QUOTA/ABORT, revisão de destino alterada entre preview e apply, outros perfis não tocados; regressões F2 import; typecheck.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): conservatively import planning JSON"`.

**Cobertura:** F3-T16/17/18/19/30/35; D-F3-09/22. **Revisor:** confrontar fixtures legadas V1 reais do repositório, sem inferir campos ausentes.

## Task 16 — Exportação seletiva e roundtrip seguro

**Files:** Modify `src/application/planning-portability.ts`; Create `tests/unit/f3-export.test.ts`, `tests/fixtures/f3-portable-roundtrip.json` quando pertinente.

**Interfaces:** `exportPlanningScenarios(input:{scenarioIds:string[];profileId:string;snapshots:PlanningScenarioSnapshot[]}):string`; formato com `formatVersion`, `sourceNamespace`, `scenarios`, refs/contexto e proveniência, **sem** tokens/UID/outbox/sessões reais.

- [ ] **Step 1 — RED:** exportar apenas cenário TJPB escolhido, sem DPE-PB; conteúdo estrutural suficiente para importar em outro perfil mediante remapeamento explícito; não conter campos sensíveis aninhados; roundtrip equivalência semântica, não bytes.
- [ ] **Step 2 — verificar RED:** `f3-export.test.ts` FAIL.
- [ ] **Step 3 — GREEN:** projetar whitelist de serialização, não serializar modelos IDB completos ou status de sync; versões explícitas e validadores reutilizados; garantir limite de tamanho e rejeição segura.
- [ ] **Step 4 — verificar PASS:** JSON sanitizado, sem dependência de dados pessoais, import→export→import com mesmas contagens e proveniência; unit/typecheck.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): export portable academic scenarios"`.

**Cobertura:** F3-T34/35; D-F3-22.

## Task 17 — UI: painel de cenários, wizard, calendário e Ciclo

**Files:** Create `src/presentation/components/PlanningDashboard.tsx`, `PlanningWizard.tsx`, `PlanningCalendar.tsx`, `StudyCycle.tsx`; Modify `src/presentation/App.tsx`, `styles.css`; Test `tests/e2e/f3-planning-flow.spec.ts`, `f3-cycle-ui.spec.ts`, `f3-calendar-ui.spec.ts`.

**Interfaces:** componentes recebem serviços/queries existentes por props, sem acesso direto a IDB; state do wizard e draft persistidos por application; calendário consulta `queryCalendar`, Ciclo chama `advanceCycle` via comandos; perfil e edital da F2 são os mesmos da aplicação.

- [ ] **Step 1 — RED:** Playwright fluxo criar edital/conteúdo F2→abrir Planejamento→novo Ciclo→wizard→prévia→ativar→calendário→avançar explicitamente; cenário alternativo não altera agenda; carga de 180 blocos navegável; navegação teclado e reload preservam dados.
- [ ] **Step 2 — verificar RED:** `npm --prefix apps/v2 run test:e2e -- tests/e2e/f3-planning-flow.spec.ts`; FAIL esperado.
- [ ] **Step 3 — GREEN:** implementar apenas superfícies F3 necessárias, reaproveitar temas/tokens/componente F2; não inserir formulários invasivos nem mutações em efeitos React; estado `UNALLOCATED` acessível, labels com assunto/duração/dia; identificar plano confirmado vs rascunho.
- [ ] **Step 4 — verificar PASS:** E2E três arquivos, tabulação, touch/viewport e regressões F2 principais; typecheck/lint/build PASS antes de commit.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): add planning wizard calendar and cycle UI"`.

**Cobertura:** F3-T01/02/20/21/22/23/28/30/38/40; F0 Study Organizer/Calendar/Cycle/Wizard.

## Task 18 — UI: Reta Final, editor, histórico, conflitos e portabilidade

**Files:** Create `src/presentation/components/FinalStretch.tsx`, `PlanningEditor.tsx`, `PlanningHistory.tsx`, `PlanningConflicts.tsx`, `PlanningPortability.tsx`; Modify `src/presentation/App.tsx`, `styles.css`; Test `tests/e2e/f3-final-stretch-ui.spec.ts`, `f3-editor-ui.spec.ts`, `f3-portability-ui.spec.ts`.

**Interfaces:** usa application services Tasks 10–16; toda aplicação com confirmação, prévia e estado honesto. Componentes UI não serializam DB nem manipulam outbox.

- [ ] **Step 1 — RED:** criar Reta Final TJPB com exame `2027-01-24`→gerar prévia→editar dois blocos→fechar/reabrir mantém draft→aplicar→histórico; alterar prova, confirmar replanejamento, preservar blocos fixados e caso `UNALLOCATED`; importar V1 divergente exige escolha humana; exportar só cenário escolhido.
- [ ] **Step 2 — verificar RED:** E2E dos três arquivos FAIL.
- [ ] **Step 3 — GREEN:** implementar views reutilizando classes/tokens existentes; resolução de conflitos com comparação base/atual/rascunho; status de commit local ≠ sync remoto; painel de checkpoint/undo; fechar Reta Final assistidamente; manter UI usável touch/keyboard/offline.
- [ ] **Step 4 — verificar PASS:** E2E, regressões, a11y, prevenção de perda em quota/two tabs; typecheck/lint/build; registrar screenshots apenas como evidências de execução, não novos documentos de status.
- [ ] **Step 5 — commit:** `git commit -m "feat(v2-f3): add final stretch editor history and portability UI"`.

**Cobertura:** F3-T10/12/14/16–18/24–27/32/34/35/40; F0 RF Overview/Editor/Import/History/Conflicts/Portability/Redistribution.

## Task 19 — Performance, limites medidos, fault injection, UX A-01

**Files:** Modify arquivos específicos identificados no profiling em `apps/v2/src/**`; Create `tests/unit/f3-limits.test.ts`, `tests/e2e/f3-load.spec.ts`, `f3-a11y.spec.ts`, `f3-failure.spec.ts`; Modify `src/platform/e2e-harness.ts` somente para faults sintéticos F3; registrar evidência no **relatório singular de F3** em `docs/superpowers/audits/` na execução autorizada.

**Interfaces:** motor retorna diagnóstico explícito acima de limite comprovado, sem truncar; nenhum teto definitivo vem deste plano; UI continua responsiva e segura. Revisões F3 não devem alterar a F2 sem teste de regressão.

- [ ] **Step 1 — RED:** testes de 180 e >=360 blocos em gerador, calendário, editor e importação; falha quota/abort após mutações planejadas, two-tabs e upgrade bloqueado; oito temas, desktop/tablet/mobile e foco/contraste. Teste acima do teto medido deve retornar `BLOCKED/INVALID`, sem item sumir.
- [ ] **Step 2 — medir baseline:** executar perfis locais reproduzíveis e registrar ambiente, tamanho dos dados, tempo de geração, gravação e abertura; não inventar metas numéricas. Selecionar limites conservadores documentados por evidência e revisar custo local/outbox por entidade (sem habilitar Firestore).
- [ ] **Step 3 — GREEN:** ajustar consultas/índices/renderização (virtualização/paginação se necessário), granularidade de geração e validação pré-commit; sem criar jobs assíncronos duráveis ou dividir um commit aprovado em commits parciais sem decisão humana.
- [ ] **Step 4 — verificar PASS:** `f3-load.spec.ts`, `f3-failure.spec.ts`, `f3-a11y.spec.ts`, `f3-limits.test.ts`; verificar datas/fusos, 8 temas, tap targets, keyboard, `prefers-reduced-motion`; regressão F2.
- [ ] **Step 5 — commit:** `git commit -m "test(v2-f3): validate loads failures and responsive UX"` (incluir ajustes funcionais realmente necessários, com descrição do motivo).

**Cobertura:** F3-T06/11/12/15/29/30/38/39/40/42; D-F3-24/25/26. Gate de limites deve ser aprovado como critério mensurado antes de depender deles, sem fixação arbitrária.

## Task 20 — Auditoria holística, integração autorizada e higiene

**Files:** Revisar `apps/v2/**`, `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f3-planning-design.md` **somente se correção de spec for aprovada**, `docs/superpowers/v2/ROADMAP.md`; atualizar **um único** relatório F3 em `docs/superpowers/audits/2026-10-29-v2-f3-acceptance.md` durante a execução, com logs em caminho de evidência já padronizado. Não criar 20 relatórios por tarefa.

**Interfaces:** entrega relatório de gate 
`F3_READY_FOR_HUMAN_REVIEW|F3_BLOCKED`, com matriz F3-T01..42, 11 funcionalidades F0, D-F3-01..26, hashes e árvore Git. Não declarar `ACCEPTED`, `PUBLISHED` ou `CONVERGED` sem evidências/gates próprios.

- [ ] **Step 1 — rastreabilidade:** revisão cruzada da spec por IDs D-F3-01..26 e funcionalidades F0; identificar exceções e pendências; executar teste de arquitetura para impedir imports V1/Firebase indevidos e verificar identidade/capacidade/undo/portabilidade.
- [ ] **Step 2 — suíte local integral:** `npm --prefix apps/v2 run typecheck`, `lint`, `test:unit`, `test:e2e`, `build`; registrar output real/códigos de saída, sem afirmar PASS de testes não rodados; E2E não modifica dados reais.
- [ ] **Step 3 — revisão independente:** solicitar revisor fresco para invariantes críticos (CAS IDB, outbox envelope, DST, importação, F4), depois revisão holística; corrigir falhas materiais na **mesma `v2`/estrutura existente** e repetir testes afetados + regressão. Se revisão indisponível, registrar `NOT_RUN`, não substituir por falso parecer.
- [ ] **Step 4 — integração e higiene:** inventariar HEAD, árvore, stashes, branches, PRs e worktrees; empacotar commits validados na `v2` **somente com autorização de integração** e proteção satisfeita; sem push para `main`, Actions, deploy. Não excluir branches históricas/commits não integrados; documentar bloqueios e custo futuro F7.
- [ ] **Step 5 — relatório/commit de estado:** atualizar o relatório singular com testes, arquivos, revisões, local/remote verificados, status `F3_READY_FOR_HUMAN_REVIEW|F3_BLOCKED`, pendências, integração autorizada ou impedimento, e próximos gates. Commit documental final somente se execução autorizada.

## 3. Matriz de rastreabilidade F3-T01..42 → tasks

| IDs | Tarefas proprietárias (principal) | Critério de aceite |
| --- | --- | --- |
| T01–T04 | 1, 4, 5, 17 | Vários cenários por edital e um ativo; capacidade apenas ativos |
| T05–T07 | 2, 5, 6 | CivilDate, DST, recorrência e meia-noite |
| T08–T09 | 9 | Ranking e revisão congelada do perfil |
| T10–T12 | 3, 11, 13, 18, 19 | Draft, atomicidade e falha quota |
| T13–T15 | 3, 12 | Merge granular e duas abas com CAS transacional |
| T16–T19 | 14, 15 | Legado sem campos, idempotência, divergência e homônimos |
| T20–T23 | 7, 8, 17 | Ciclo, avanço explícito, projeção, fixação |
| T24–T27 | 10, 18 | Reta Final, transição, remarcação, encerramento |
| T28–T30 | 5, 8, 19 | Disponibilidade, intervalos e UNALLOCATED |
| T31–T33 | 13, 14 | Referências F2, checkpoints, undo preservando fatos F4 |
| T34–T35 | 15, 16, 18 | Portabilidade sem dados privados e roundtrip |
| T36–T37 | 14 | Sessões F4 simuladas e sem dupla contagem |
| T38–T40 | 9, 17, 19 | 180+, mobile/desktop/tablet, oito temas e a11y |
| T41–T42 | 3, 20 | V1/main isoladas; fake ≠ sync real |

**Nota:** além dos 42 IDs, rodar testes de consistência dos próprios contratos (idempotência em todos os commands, validação de escopo, não dar feedback de commit antes do read-back) e regressões F1/F2. Um teste `PASS` não implica cobertura de toda decisão; relatório especifica evidência por requisito.

## 4. Sequência, riscos, gates e aceite

**Grafo lógico:** preflight → T1/T2 → T3 → T4/T5/T6 → T7/T8/T9/T10 → T11/T12/T13 → T14 → T15/T16 → T17/T18 → T19 → T20. Dependências menores podem rodar em paralelo **apenas se independentes e sem branch/PR adicional**; nenhuma task pode declarar operacional o que depende de checkpoint/transação ainda não entregues. Em particular, T4 só entrega cenários consultáveis e ativação `BLOCKED` enquanto T13 não completar a troca atômica com checkpoint.

**Fatias da fase única:** F3-A calendário/disponibilidade/Ciclo (T1–8, parcialmente 9); F3-B Reta Final/importação/portabilidade (T9–10, 15–16); F3-C editor/histórico/conflitos (T11–13); F3-D UI integrada e qualidade (T14,17–20). Essa ordenação não cria quatro projetos independentes nem quatro PRs.

**Plano deliberadamente não inclui:** integração real Firebase/Rules/Google Sign-In, teste produtivo de múltiplos celulares, migração de dados V1 reais, backup/restauração F7, sessão de estudo F4, release e deploy. Manter status `NOT_RUN/BLOCKED` explícito para estes.

**Aceite técnico:** todas as 11 funcionalidades do inventário F0 implementadas ou exceção humana; D-F3-01..26 e F3-T01..42 rastreáveis a resultados; testes locais, typecheck, lint, build, E2E e revisão independente documentados; regressões F1/F2; integração autorizada na `v2` demonstrada ou impedimento; Git/GitHub higienizado com preservação de branches/PRs não integrados. Relatório separa `IMPLEMENTED`, `TESTED`, `INTEGRATED_TO_V2`, `ACCEPTED`, `PUBLISHED`. **Somente proprietário pode aceitar F3**.

**Gate após aprovação do plano:** preparar e entregar o **GOAL único, completo e detalhado para o Codex Desktop**; não executá-lo sem envio/autorização específica do proprietário. A aprovação deste writing-plans não autoriza push/merge de código na `v2`, limpeza destrutiva, publicação, Actions ou Firebase real.

## 5. Conferência individual das decisões aprovadas

| Decisão | Task(s) | Estado neste plano |
| --- | --- | --- |
| D-F3-01 | T1, T4 | PLANNED, não executado |
| D-F3-02 | T4, T13 | PLANNED, não executado |
| D-F3-03 | T5, T6 | PLANNED, não executado |
| D-F3-04 | T2, T5 | PLANNED, não executado |
| D-F3-05 | T13 | PLANNED, não executado |
| D-F3-06 | T9 | PLANNED, não executado |
| D-F3-07 | T9 | PLANNED, não executado |
| D-F3-08 | T11 | PLANNED, não executado |
| D-F3-09 | T15 | PLANNED, não executado |
| D-F3-10 | T12 | PLANNED, não executado |
| D-F3-11 | T7, T10 | PLANNED, não executado |
| D-F3-12 | T10 | PLANNED, não executado |
| D-F3-13 | T7 | PLANNED, não executado |
| D-F3-14 | T8 | PLANNED, não executado |
| D-F3-15 | T7, T14 | PLANNED, não executado |
| D-F3-16 | T14 | PLANNED, não executado |
| D-F3-17 | T5 | PLANNED, não executado |
| D-F3-18 | T5, T6 | PLANNED, não executado |
| D-F3-19 | T14 | PLANNED, não executado |
| D-F3-20 | T14 | PLANNED, não executado |
| D-F3-21 | T10 | PLANNED, não executado |
| D-F3-22 | T15, T16 | PLANNED, não executado |
| D-F3-23 | T9, T17 | PLANNED, não executado |
| D-F3-24 | T8, T9, T19 | PLANNED, não executado |
| D-F3-25 | T13, T19 | PLANNED, não executado |
| D-F3-26 | T19, T20 | PLANNED, não executado |

## 6. Conferência individual dos testes exigidos

| Teste | Task principal | Estado |
| --- | --- | --- |
| F3-T01 | Task 4 | PLANNED, não executado |
| F3-T02 | Task 13 | PLANNED, não executado |
| F3-T03 | Task 5 | PLANNED, não executado |
| F3-T04 | Task 4 | PLANNED, não executado |
| F3-T05 | Task 2 | PLANNED, não executado |
| F3-T06 | Task 2 | PLANNED, não executado |
| F3-T07 | Task 2 | PLANNED, não executado |
| F3-T08 | Task 9 | PLANNED, não executado |
| F3-T09 | Task 9 | PLANNED, não executado |
| F3-T10 | Task 11 | PLANNED, não executado |
| F3-T11 | Task 3 | PLANNED, não executado |
| F3-T12 | Task 11 | PLANNED, não executado |
| F3-T13 | Task 12 | PLANNED, não executado |
| F3-T14 | Task 12 | PLANNED, não executado |
| F3-T15 | Task 12 | PLANNED, não executado |
| F3-T16 | Task 15 | PLANNED, não executado |
| F3-T17 | Task 15 | PLANNED, não executado |
| F3-T18 | Task 15 | PLANNED, não executado |
| F3-T19 | Task 14 | PLANNED, não executado |
| F3-T20 | Task 7 | PLANNED, não executado |
| F3-T21 | Task 7 | PLANNED, não executado |
| F3-T22 | Task 8 | PLANNED, não executado |
| F3-T23 | Task 8 | PLANNED, não executado |
| F3-T24 | Task 10 | PLANNED, não executado |
| F3-T25 | Task 10 | PLANNED, não executado |
| F3-T26 | Task 10 | PLANNED, não executado |
| F3-T27 | Task 10 | PLANNED, não executado |
| F3-T28 | Task 5 | PLANNED, não executado |
| F3-T29 | Task 5 | PLANNED, não executado |
| F3-T30 | Task 5 | PLANNED, não executado |
| F3-T31 | Task 14 | PLANNED, não executado |
| F3-T32 | Task 13 | PLANNED, não executado |
| F3-T33 | Task 13 | PLANNED, não executado |
| F3-T34 | Task 16 | PLANNED, não executado |
| F3-T35 | Task 16 | PLANNED, não executado |
| F3-T36 | Task 14 | PLANNED, não executado |
| F3-T37 | Task 14 | PLANNED, não executado |
| F3-T38 | Task 9 | PLANNED, não executado |
| F3-T39 | Task 19 | PLANNED, não executado |
| F3-T40 | Task 19 | PLANNED, não executado |
| F3-T41 | Task 20 | PLANNED, não executado |
| F3-T42 | Task 3 | PLANNED, não executado |


## 7. Oráculos TDD mínimos para os cinco Review Focus

Os snippets abaixo fixam asserções essenciais, **não** são corpos de implementação nem substituem as fixtures específicas das tasks. Adicionar aos testes nos caminhos indicados; interfaces e nomes são os declarados neste plano.

**RF-01 — duas abas / CAS, Tasks 12 e 13:**

```ts
expect(secondApply.kind).toBe('CONFLICT');
expect(await repository.loadDraft('profile-local', 'scenario-tjpb')).not.toBeNull();
expect((await repository.loadScenario('profile-local', 'scenario-tjpb'))?.scenario.localRevision)
  .toBe(firstApply.value.scenario.localRevision);
```

**RF-02 — DST e prova CivilDate, Task 2:**

```ts
expect(validateCivilDate('2027-01-24')).toBe('2027-01-24');
expect(resolveZonedInterval({date:'2026-03-08',start:'02:30',end:'03:30',zone:'America/New_York'}))
  .toEqual({ok:false,code:'NONEXISTENT_TIME'});
expect(resolveZonedInterval({date:'2026-11-01',start:'01:30',end:'02:30',zone:'America/New_York'}))
  .toEqual({ok:false,code:'AMBIGUOUS_TIME'});
```

**RF-03 — quota e commit atômico, Tasks 3/11/19:**

```ts
expect(quotaResult.kind).toBe('FAILED');
expect(await repository.loadDraft('profile-local', 'scenario-tjpb')).not.toBeNull();
expect(await readPlanningOperationCount()).toBe(beforeOperations);
expect(await readPendingOutboxCount()).toBe(beforeOutbox);
```

**RF-04 — importação seletiva e identidade, Tasks 15/16:**

```ts
expect(preview.ambiguous).toHaveLength(1); // mesmo nome, outra provenance
expect(preview.automaticMerges).toHaveLength(0);
expect(exported.scenarios.map((x) => x.id)).toEqual(['scenario-tjpb']);
expect(JSON.stringify(exported)).not.toMatch(/refreshToken|accessToken|deliveryUid/);
```

**RF-05 — sessão única multi-edital, Task 14:**

```ts
expect(summarizeExecutionLinks(twoEditalLinksToSameSixtyMinuteSession).uniqueMinutes).toBe(60);
expect(new Set(twoEditalLinksToSameSixtyMinuteSession.map((x) => x.sessionId)).size).toBe(1);
```

O Codex adapta os helpers de fixture (`readPlanningOperationCount`, `beforeOperations`, etc.) nos arquivos de teste donos dos contratos, sem transformar nomes ilustrativos em APIs de produção. Os cinco oráculos são **asserções-alvo**, não afirmações de teste executado.
