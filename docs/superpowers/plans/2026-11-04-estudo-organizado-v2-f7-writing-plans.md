# Estudo Organizado V2 — F7 Implementation Plan (Superpowers Writing Plans)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended for critical data/sync work) or `superpowers:executing-plans` to implement **only after an explicit execution GOAL**. Tasks contain checkboxes (`- [ ]`); their presence is **not** permission to execute.

**Goal:** Finalizar a V2 como aplicativo pessoal, local-first e gratuito, homologando autenticação Google, Firestore Spark, sincronização segura entre aparelhos, backups portáteis/Cloudflare KV Free, migração/restauração, PWA, segurança e disponibilização de uma **V2 completa em URL de avaliação independente**, para o proprietário decidir posteriormente sobre a V1.

**Architecture:** Reutilizar `apps/v2` (React/TypeScript, IndexedDB, uma outbox, contratos A-02, F1–F6). Firestore Spark é o **único backend de sincronização V2**; Workers KV Free somente armazena backups criptografados. Piloto e URL V2 permanecem separados da V1. D-F7-17/C preserva a **opção futura** de coexistência V1/V2 com sincronização bidirecional, mas a ponte não será construída nem ativada na F7 antes da avaliação humana e de gate próprio.

**Tech Stack:** React 19, TypeScript 6, Vite 8, IndexedDB, Vitest 5, Playwright, Firebase JS SDK + Firebase Emulator Suite, Firebase Auth Google, Firestore Standard/Spark, Web Crypto, Cloudflare Workers/KV **Free**, Cloudflare Pages Free (ou hospedagem estática equivalente). Versões e instalações adicionais serão verificadas/justificadas **somente na execução autorizada**; o `apps/v2/package.json` consultado **não inclui ainda Firebase**.

**Spec:** Documento **aprovado pelo proprietário nesta conversa**, arquivo entregue `Estudo_Organizado_V2_F7_Especificacao_Formal_Proposta_2026-11-04.md`; **destino documental futuro sugerido (ainda inexistente no repositório):** `docs/superpowers/specs/2026-11-04-estudo-organizado-v2-f7-design.md`. O implementador deve colocar a spec aprovada junto ao plano **somente quando a escrita documental for autorizada**. Fonte complementar histórica, **não aprovada como spec vigente:** `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f7-integration-design.md`. Contrato A-02: `docs/superpowers/specs/2026-10-28-v2-multidevice-sync-f1-contracts.md`.

**Plan path when authorized to persist in Git:** `docs/superpowers/plans/2026-11-04-estudo-organizado-v2-f7-writing-plans.md`.

**Estado:** `F7_PLAN_PROPOSED_NOT_APPROVED` — especificação F7 1.0 aprovada, **plano pendente de revisão e aceite humano**; nenhuma implementação, instalação, publicação, alteração de repositório, acesso a serviços ou migração autorizada.

**Baseline remoto consultado em 04/11/2026:** `origin/v2=53553f291678f943bb6d96a0de56a511d4d5c369`; `origin/main=9046cfa2283cd293b38df9d52fabfcd5de9ac67c` (V1); 0 PR aberto. Isso não comprova o estado da árvore **local** do Codex nem seus worktrees. Revisitar tudo no preflight executório.

## Global Constraints — vinculantes em todas as tarefas

1. **V1 e Git:** produção V1, `main`, `src/**` de raiz, `firestore.rules` produtivo, domínio, cache, Service Worker, Firebase/Cloudflare produtivos e dados V1 são **somente leitura** durante F7. Trabalho funcional futuro em `apps/v2/**` na branch `v2` autorizada. Não abrir PR, branch ou worktree por rotina; branch temporária só quando isolamento for necessário. Proibido Actions/CI novo.
2. **R$ 0 obrigatório:** não habilitar billing, Blaze, Cloud Functions pagas, Cloudflare R2/assinatura, TTL/PITR/backup Firestore gerenciados, serviços com cobrança por excedente ou infraestrutura adicional. Firestore Spark Standard com cota gratuita e Workers/KV **Free**; não inferir que limites no frontend eliminam cobrança em planos faturáveis. **R2 permanece desabilitada.**
3. **Preflight obrigatório:** conferir código real, `git status`, `git branch -vv`, `git worktree list`, `git stash list`, `git log --left-right`, `git remote -v`, `main/v2`, commits locais exclusivos e PRs; comparar spec aprovada, ROADMAP, issue #108, AGENTS e planos. Não apagar branch `codex/f5-local-preserved-20261102` (4 commits exclusivos relatados) nem três PNGs F4 modificadas sem inventário/aceite. Não usar `reset --hard`, force push ou limpeza destrutiva.
4. **Preservação de dados:** operação de negócio + outbox atômicos em IndexedDB; nunca confirmar commit local, ACK remoto, convergência ou backup sem prova. Preservar sessões, questões, revisões, planos, anotações, rascunhos, journal, tombstones, operações pendentes e conflitos.
5. **Identidade:** `profileId` local ≠ `uid` Google ≠ `remoteLibraryId`. Sem merge automático de bibliotecas, sem exposição entre UIDs, sem acesso remoto antes de consentimento válido.
6. **Sync:** Firestore único peer remoto V2; KV/R2/Drive não são sync peers. Web Locks interabas, CAS/ID de operação/ACK com prova remota, conflito conservador, cursores e epochs. Sem segundo offline write-queue do SDK para as mesmas mutações.
7. **Backups:** manual local inclusive offline; automático no máximo um por 24 h quando há mudanças, enquanto app puder executar; até 7 cópias remotas válidas; AES-GCM antes de Cloudflare, chave de recuperação externa. KV Free 1 GB, valor 25 MiB, 1.000 writes/dia como referência — reconfirmar na execução. Sem promessa de backup/sync com app fechado.
8. **Ambientes:** primeiro dados sintéticos e Emulator Suite; Firebase Spark **isolado** e Workers/KV Free **somente após G-EXT**; URL V2 estática e isolada **somente após G-STAGING**. Proibido acessar V1 real ou modificar produção em qualquer tarefa da F7.
9. **Padrão de execução futura:** RED → observar FAIL esperado → GREEN mínimo → testes focados + regressão → commit pequeno na linha autorizada, preferencialmente `v2`; revisão crítica dos módulos de segurança/dados e revisão independente final. **PASS de mock não demonstra integração real.**
10. **Entrega e gates:** distinguir implementado, testado, integrado à `v2`, disponível no ambiente de teste, aceito e publicado produtivamente. A F7 termina com V2 funcional em URL isolada **e avaliação humana**; F8 e G5 seguem bloqueados. Não inventar testes/leituras, não mascarar `NOT_RUN`.
11. **Compatibilidade:** módulos F2–F6 já usam React 19, TypeScript strict, Service Worker, IndexedDB, `LocalProfileRepository`, `RemoteMutationPort`, `flushPending()` e formatos F1/F2 de backup. Ampliar sem quebrar comportamento local. Não usar `AGENTS.md` (voltado à V1 Vanilla JS) para reestruturar V2 sem necessidade.
12. **Cuidado com custo de dados:** casos de carga devem ser limitados e sintéticos; o fluxo gratuito pausa antes de executar novas operações reconhecidamente excessivas. Nenhuma gravação de testes de carga em projeto real isolado sem orçamento demonstrado.

### Comandos reais de referência (na futura execução)

No diretório `apps/v2`:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:e2e
npm run test:unit -- tests/unit/f7-<area>.test.ts
npm run test:e2e -- tests/e2e/f7-<area>.spec.ts
```

A configuração Playwright atual usa Chromium, `http://127.0.0.1:18431`, executa `npm run build:e2e && npm run preview` e utiliza Service Workers. Adicionar emulador Firebase, dependências e tarefas de execução local **apenas após autorização**, sem alterar a V1. Os nomes `f7-<area>` indicam testes que o plano criará, não comandos que já passaram.

### Review Focus — cinco condições de alto risco não triviais

- **V1 e V2 na mesma máquina:** mesmo se o usuário abrir ambos, o ambiente de teste V2 não deve modificar IndexedDB, origem, Service Worker, URL, Firebase ou Cloudflare produtivos V1. Teste de isolamento em T01/T27.
- **Troca de UID durante requisição já iniciada:** resposta tardia da conta anterior jamais escreve no perfil/UID atual nem produz ACK da operação errada. Teste em T03/T09.
- **Backup criptografado de histórico grande:** arquivo completo acima de 25 MiB não pode ser truncado/enviado ao KV; exportação local deve continuar íntegra. Testes em T16/T21.
- **Sessão offline com atualização PWA em duas abas:** não aplicar SW/upgrade enquanto timer, draft ou recuperação estiverem ativos, mesmo com mensagem de outra aba atrasada. Testes em T23/T24.
- **Read-back remoto após timeout combinado com exclusão:** ACK não pode confirmar alteração errada nem reintroduzir entidade deletada. Testes em T08/T11.

---

## 0. Gates e política de avanço (não são autorização desta entrega)

| Gate | Entrada | Saída exigida / condição de parada |
|---|---|---|
| **G-SPEC** | Aprovação da especificação v1.0 | **APROVADO NA CONVERSA**; publicar em Git somente quando autorizado |
| **G-PLAN** | Revisão deste writing-plans | Proprietário aprova o plano; isso permite preparar GOAL, não implementá-lo |
| **G-EXEC** | GOAL único e autorização de implementação | Preflight Git + backups/inventário; seguir T01–T27 sem tocar V1 |
| **G-EXT** | Necessidade de serviço real isolado | Permissão individual para Firebase Spark/Auth e Cloudflare Workers/KV Free; sem uso de projetos produtivos |
| **G-STAGING** | V2 candidata completa e regressões críticas PASS | Permissão expressa para URL de avaliação em hospedagem gratuita, origem e contas isoladas |
| **G-F7** | URL funcional + relatório + experiência do proprietário | Aceite da F7 ou `F7_BLOCKED`, jamais aceite presumido |
| **G5/F8** | Decisão posterior sobre destino da V1 | Não faz parte da F7; opção V1/V2 bidirecional depende de contrato e homologação futuros |

**Estratégia de impedimentos:** trabalho puramente local pode continuar sem G-EXT/G-STAGING, mas testes reais e publicação não podem ser marcados PASS nem executados sem aprovação. Não improvisar uso de conta/projeto produtivo para "desbloquear" a fase. Na ausência de gate, produzir artefatos locais preparados e declarar bloqueio preciso no ponto correto. Não afirmar F7 completa até cumprir o ambiente de avaliação exigido.

## 1. Mapa de arquivos e fronteiras (proposto; conferir novamente antes de editar)

| Unidade | Reuso existente | Arquivos novos ou evoluções previstas |
|---|---|---|
| Ambiente e autenticação | `application/profile-service.ts`, `platform/local-profile-repository.ts` | `platform/firebase/config.ts`, `platform/firebase/auth.ts`, `application/google-link-service.ts` |
| Rules e dados remotos | `application/sync-types.ts`, `platform/sync/document-budget.ts`, `platform/sync/fake-remote.ts` | `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `platform/sync/remote-schema.ts`, `platform/sync/firebase-remote.ts` |
| Coordenação/sync | `platform/sync/{coordination,delivery-policy,flush,retry-policy}.ts`, `platform/indexeddb.ts` | `platform/sync/ack.ts`, `platform/sync/change-feed.ts`, `platform/sync/rebaseline.ts`, `platform/sync/conflict-reconciliation.ts`, `platform/sync/sync-coordinator.ts`, `platform/sync/scheduler.ts`, `platform/sync/budget.ts` |
| Backup/cripto | `platform/backup/{format,f2-format,restore}.ts` | `platform/backup/{f7-format,collect,crypto,restore-commit,scheduler,kv-client}.ts` |
| Cloudflare | Nenhum Worker V2 separado no baseline | `apps/v2/cloudflare/backup-worker.ts`, `apps/v2/cloudflare/token-verifier.ts`, config de deployment **somente sob G-EXT** |
| Legado | `platform/legacy/recognize.ts` e mecanismos de importação | `platform/legacy/v1-adapter.ts`, fixtures sintéticas em testes |
| PWA/UX | `public/sw.js`, `platform/sw-update.ts`, `presentation/components/SyncStatus.tsx`, `presentation/views/SettingsView.tsx` | `platform/storage-health.ts`, `presentation/components/{GoogleLink,BackupControls}.tsx` e pequenas evoluções nas views |
| QA e staging | Vitest/Playwright, `vite.config.ts`, `playwright.config.ts` | `tests/{unit,e2e,firebase}/f7-*`, `vitest.firebase.config.ts`, fixtures e configs isoladas Firebase/Workers, `docs/superpowers/audits/` (registro final enxuto) |

**Interfaces de domínio preexistentes:** `RemoteMutationPort` com `apply`, `lookup`, `lookupRevision?`; `OutboxOperation` com `operationId`, `profileId`, `entityType`, `entityId`, `kind`, `baseRevision`, `remoteBaseRevision?`, `payload`, `schemaVersion`, `status`; `SyncHealth` com `localCommitted`, `remoteCommitted`, `converged`, `pendingCount`, `mode`, `lastVerifiedCursor?`; `ProfileRecord` com `profileId`, `uid`, `remoteLibraryId`, `syncEnabled`, `state`, `localRevision`.

**Regra de tipos:** novas interfaces abaixo são propostas deliberadas deste plano; durante execução autorizada, ajustar apenas detalhes incompatíveis comprovados no preflight, registrando a divergência no relatório e preservando semântica pública. Não criar uma API paralela para funcionalidades existentes.

---
## 2. Tarefas implementáveis — contratos locais e sincronização (T01–T13)

### Task T01 — Fronteira de configuração e isolamento V1/V2

**Files:** Create `apps/v2/src/platform/firebase/config.ts`; Test `apps/v2/tests/unit/f7-environment.test.ts`; Modify `apps/v2/vite.config.ts` **somente** para variáveis públicas de ambiente V2, sem mudar host/scope da V1.

**Interfaces:** `type V2RemoteConfig = { projectId: string; authDomain: string; appId: string; firestoreEmulator?: {host:string;port:number}; authEmulator?: {url:string} }`; `resolveV2RemoteConfig(env: Record<string,string|undefined>): V2RemoteConfig | null`.

- [ ] **RED:** escrever `f7_defaults_to_local_only_without_config` (`expect(resolveV2RemoteConfig({})).toBeNull()`), `f7_rejects_unapproved_project_or_origin` (produção V1 e projectId inesperado são rejeitados), `f7_emulator_config_is_explicit`, `f7_does_not_share_v1_origin_or_database`.
- [ ] **Provar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-environment.test.ts` → FAIL pelas funções ainda ausentes; não interpretar erro de instalação como RED válido.
- [ ] **GREEN mínimo:** resolver config somente após comparação com allowlist de ambiente autorizada, mantendo modo local por padrão. Não embutir credenciais/identificadores privados em código, logs, URL ou teste.
- [ ] **Verificar:** teste focal PASS + `npm run typecheck` + `npm run lint`; inspecionar diffs para garantir ausência de alterações V1.
- [ ] **Commit futuro:** `feat(f7-config): isolate v2 remote environments` apenas sob G-EXEC, com caminhos desta tarefa.

### Task T02 — Porta de autenticação Google testável sem rede real

**Files:** Create `apps/v2/src/platform/firebase/auth.ts`, `apps/v2/src/application/google-auth-types.ts`; Test `apps/v2/tests/unit/f7-auth.test.ts`; Modify `apps/v2/package.json` e lockfile **somente após G-EXEC**, adicionando o SDK Firebase mínimo necessário.

**Interfaces:** `GoogleIdentity = { uid:string; email:string|null }`; `GoogleAuthPort = { signIn():Promise<GoogleIdentity>; signOut():Promise<void>; current():Promise<GoogleIdentity|null>; getIdToken():Promise<string|null>; subscribe(listener:(id:GoogleIdentity|null)=>void):()=>void }`; `createFirebaseGoogleAuthPort(config:V2RemoteConfig):GoogleAuthPort`.

- [ ] **RED:** testes `f7_local_mode_never_requests_google`, `f7_google_cancel_keeps_local_data`, `f7_signout_clears_remote_authority` e `f7_emulator_auth_does_not_contact_production`; `expect(await fake.current()).toBeNull()` sem login.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-auth.test.ts` → FAIL da porta/contrato ausente.
- [ ] **GREEN:** implementar adapter Firebase Auth com injeção de porta fake para testes, Auth emulator explícito e autorização remota somente com identity válido; não adicionar bibliotecas externas desnecessárias.
- [ ] **Verificar:** unit PASS, typecheck, lint; confirmar por inspeção que o app sem login não faz conexão remota. **Google Sign-In real é `NOT_RUN` até G-EXT.**
- [ ] **Commit futuro:** `feat(f7-auth): add isolated google identity port`.

### Task T03 — Vínculo explícito de perfil e prevenção de resposta tardia

**Files:** Create `apps/v2/src/application/google-link-service.ts`; Modify `apps/v2/src/platform/local-profile-repository.ts` e `apps/v2/src/application/profile-service.ts` apenas se estritamente necessário; Test `apps/v2/tests/unit/f7-google-link.test.ts` e ampliar `f2-delivery-identity.test.ts`.

**Interfaces:** `previewGoogleLink(profileId:string, identity:GoogleIdentity, remote:RemoteLibrarySummary):Promise<LinkReview>`; `confirmGoogleLink(review:LinkReview, consent:true):Promise<ProfileRecord>`; `invalidateRemoteBinding(profileId:string, previousUid:string):Promise<void>`. `LinkReview` inclui perfil, UID, biblioteca, contagens, instante/validade, conflitos e geração da sessão; não contém credenciais.

- [ ] **RED:** `f7_link_requires_current_preview`, `f7_prevents_silent_profile_merge`, `f7_logout_does_not_reassign_pending_ops`, `f7_stale_response_from_previous_uid_is_discarded` (`expect(outboxForNewUid).not.toContain(oldOperation)`), `f7_local_mode_survives_cancel`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-google-link.test.ts` → FAIL esperado.
- [ ] **GREEN:** reutilizar `assertDeliveryConsent` e adoção de operações, invalidar geração de sessão em logout/troca UID, validar identidade antes de aplicar resposta e ACK.
- [ ] **Verificar:** testes F7 + `tests/unit/f2-delivery-identity.test.ts`, typecheck e lint PASS.
- [ ] **Commit futuro:** `feat(f7-profile): require consented google binding`.

### Task T04 — Firebase Emulator Suite, Rules e índices isolados

**Files:** Create `apps/v2/firebase/firebase.json`, `apps/v2/firebase/firestore.rules`, `apps/v2/firebase/firestore.indexes.json`, `apps/v2/tests/firebase/f7-firestore-rules.test.ts` e `apps/v2/vitest.firebase.config.ts` (config exclusiva Node para integrações no emulador, sem modificar a suíte unit padrão); Modify `apps/v2/package.json`/lockfile com o script `test:firebase` e ferramentas gratuitas de emulação após G-EXEC. **Não tocar no `firestore.rules` de raiz.**

**Interfaces:** Caminho remoto V2 `users/{uid}/libraries/{remoteLibraryId}/{collection}/{documentId}`; collections previstas `entities`, `operations`, `changes`, `meta`. `meta/head` controla `epoch`/`changeSequence`. Rules exigem UID autenticado correspondente ao escopo e validam envelope/schema/tamanho, inclusive escrita de mudança e recibo sob transação.

- [ ] **RED:** `f7_rules_deny_other_uid`, `f7_rules_deny_unauthenticated`, `f7_rules_deny_invalid_schema`, `f7_rules_allow_authorized_transaction`, `f7_rules_deny_forged_revision_or_scope`; `expect(...).rejects.toThrow()` para operações hostis.
- [ ] **Provar RED:** instalar ferramental apenas sob G-EXEC e executar `firebase emulators:exec --config firebase/firebase.json --project demo-estudo-v2 --only auth,firestore "npm run test:firebase -- tests/firebase/f7-firestore-rules.test.ts"`; regras permissivas ou não existentes devem falhar nos casos hostis.
- [ ] **GREEN:** Rules estritas, índices mínimos demandados pelas consultas reais e bootstrap local do emulador; sem relaxamento de Rules para passar testes e sem publicação real.
- [ ] **Verificar:** suite emulador + typecheck/lint; confirmar `demo-*` e ausência de credenciais produtivas; **projeto Spark real ainda `NOT_RUN`.**
- [ ] **Commit futuro:** `feat(f7-rules): enforce isolated firestore ownership`.

### Task T05 — Modelo remoto pequeno, cursor monotônico e orçamento por documento

**Files:** Create `apps/v2/src/platform/sync/remote-schema.ts`; Modify `apps/v2/src/platform/sync/document-budget.ts` apenas para novos tipos; Test `apps/v2/tests/unit/f7-remote-schema.test.ts`.

**Interfaces:** `RemoteEntity = { entityId:string; entityType:OutboxEntityType; schemaVersion:number; revision:number; deleted:boolean; payload:OutboxPayload|null; epoch:number }`; `RemoteReceipt = { operationId:string; entityId:string; payloadDigest:string; revision:number; changeSequence:number }`; `RemoteChange = { sequence:number; entityId:string; revision:number; deleted:boolean; epoch:number }`; `validateRemoteEnvelope(entity:unknown):{ok:boolean;reason?:string}`.

- [ ] **RED:** `f7_entity_under_budget`, `f7_rejects_giant_document_without_truncation`, `f7_receipt_binds_operation_entity_digest`, `f7_changes_are_orderable`, `f7_delete_retains_tombstone`; `expect(validateRemoteEnvelope(giant).ok).toBe(false)`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-remote-schema.test.ts` → FAIL esperado.
- [ ] **GREEN:** schema de entidades pequenas + `meta/head` com sequência monotônica por biblioteca, receipts e feed de mudanças **compacto**, não event sourcing acadêmico completo. Revisão da entidade e avanço do `head` devem ocorrer na mesma transação; manter índice/armazenamento economicamente mensuráveis.
- [ ] **Verificar:** testes PASS, typecheck; comparar conta de operações por mutação com orçamento preliminar e registrar que será medido no piloto.
- [ ] **Commit futuro:** `feat(f7-sync): define bounded remote envelopes`.

### Task T06 — Adaptador Firestore com CAS, deduplicação e tombstone

**Files:** Create `apps/v2/src/platform/sync/firebase-remote.ts`; Test `apps/v2/tests/unit/f7-firebase-remote.test.ts`, `apps/v2/tests/firebase/f7-remote-transaction.test.ts`; Modify tipos existentes apenas por extensão retrocompatível.

**Interfaces:** `class FirebaseRemotePort implements RemoteMutationPort { apply(operation:OutboxOperation):Promise<RemoteMutationResult>; lookup(operationId:string,entityId?:string):Promise<'APPLIED'|'MISSING'|'UNKNOWN'|'MISMATCH'>; lookupRevision(operationId:string):Promise<number|null> }`; identidade e `remoteLibraryId` injetados.

- [ ] **RED:** `f7_apply_once_under_concurrency`, `f7_identical_replay_returns_already_applied`, `f7_changed_payload_same_operation_id_rejected`, `f7_conflicting_base_revision_preserved`, `f7_delete_marks_tombstone`, `f7_transaction_does_not_write_in_wrong_uid`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-firebase-remote.test.ts` → FAIL esperado; depois `firebase emulators:exec --config firebase/firebase.json --project demo-estudo-v2 --only auth,firestore "npm run test:firebase -- tests/firebase/f7-remote-transaction.test.ts"` → falha de contrato esperada. Nunca projeto produtivo.
- [ ] **GREEN:** transação Firestore lê receipt/entidade/head, valida UID/revisão/hash/opId, escreve entidade ou tombstone, receipt e feed monotônico de forma atômica; nenhuma mutação local dentro de callback transacional repetível. Negar operações de tipo não homologado/`deliveryMode=BLOCKED`.
- [ ] **Verificar:** testes unit + emulador com concorrência/timeout, typecheck, lint; comprovante de 1 efeito lógico para N retransmissões.
- [ ] **Commit futuro:** `feat(f7-sync): implement idempotent firestore mutation port`.

### Task T07 — ACK local transacional condicionado à prova remota

**Files:** Create `apps/v2/src/platform/sync/ack.ts`; Modify `apps/v2/src/platform/indexeddb.ts` apenas para integrações de store/transaction; Test `apps/v2/tests/unit/f7-sync-ack.test.ts`.

**Interfaces:** `confirmRemoteOperation(profileId:string, operationId:string, proof:{uid:string;remoteLibraryId:string;entityId:string;revision:number;operationDigest:string}):Promise<'CONFIRMED'|'ALREADY_CONFIRMED'|'MISMATCH'|'FAILED'>`.

- [ ] **RED:** `f7_ack_rejects_uid_mismatch`, `f7_ack_rejects_future_or_unproven_revision`, `f7_ack_idempotent_for_same_proof`, `f7_quota_abort_leaves_outbox_pending`, `f7_ack_cannot_confirm_another_entity`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-sync-ack.test.ts` → FAIL.
- [ ] **GREEN:** transação local atualiza operação, receipt/meta e estado somente após correlacionar prova com binding e envelope imutável; falha não remove intenção. Não gravar ACK direto a partir de um simples resultado de transporte sem validação.
- [ ] **Verificar:** tests PASS e regressões `f2-delivery-identity` e `f2-retry`, typecheck.
- [ ] **Commit futuro:** `feat(f7-sync): acknowledge only verified remote operations`.

### Task T08 — Coordenador de flush entre abas e retomada após crash

**Files:** Create `apps/v2/src/platform/sync/sync-coordinator.ts`; Extend `apps/v2/src/platform/sync/coordination.ts`, `flush.ts` somente se necessário; Test `apps/v2/tests/unit/f7-sync-coordinator.test.ts` e `apps/v2/tests/e2e/f7-two-tabs.spec.ts`.

**Interfaces:** `class SyncCoordinator { requestFlush(profileId:string, reason:'LOCAL_COMMIT'|'RECONNECT'|'RESUME'|'MANUAL'):Promise<SyncHealth>; stop(profileId:string):void }`; `RemoteMutationPort` da T06, `confirmRemoteOperation` T07, `getEligibleOutbox` existente e `withSafeFlushLock` existente.

- [ ] **RED:** `f7_two_tabs_do_not_double_apply`, `f7_lock_missing_blocks_network_send`, `f7_crash_after_remote_commit_recovers_by_lookup`, `f7_logout_while_request_inflight_rejects_old_ack`, `f7_delete_timeout_not_resurrected`.
- [ ] **Provar RED:** unit focada → FAIL; Playwright com duas abas reproduz concorrência real em contexto de mesma origem.
- [ ] **GREEN:** aplicar lock por UID/biblioteca em ciclo de flush; checar binding e geração de auth antes de ACK; usar `flushPending`, seu lookup após timeout e retry existente; notificar outras abas somente como dica. Liberação de lock após fechamento deve permitir novo ciclo.
- [ ] **Verificar:** `npm run test:unit -- tests/unit/f7-sync-coordinator.test.ts`, `npm run test:e2e -- tests/e2e/f7-two-tabs.spec.ts`, regressões F2 multiaba PASS.
- [ ] **Commit futuro:** `feat(f7-sync): coordinate durable cross-tab flush`.

### Task T09 — Pull incremental com cursor e isolamento em troca de UID

**Files:** Create `apps/v2/src/platform/sync/change-feed.ts`; Modify `apps/v2/src/platform/indexeddb.ts` apenas para meta/cursor e aplicação transacional; Test `apps/v2/tests/unit/f7-change-feed.test.ts`.

**Interfaces:** `RemoteChangePort = { listAfter(uid:string,libraryId:string,epoch:number,cursor:number,limit:number):Promise<{changes:RemoteChange[];head:number;epoch:number}>; readEntity(uid:string,libraryId:string,id:string):Promise<RemoteEntity|null> }`; `pullRemoteChanges(profileId:string, port:RemoteChangePort, limit:number):Promise<'CONVERGED'|'MORE'|'RECOVERY_REQUIRED'|'FAILED'>`.

- [ ] **RED:** `f7_reconnect_fetches_only_missing_changes`, `f7_cursor_does_not_advance_on_local_abort`, `f7_remote_data_does_not_generate_echo_outbox`, `f7_uid_switch_drops_late_pull_result`, `f7_deleted_record_stays_deleted`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-change-feed.test.ts` → FAIL.
- [ ] **GREEN:** consultar feed por sequência/epoch, validar escopo/schema, buscar entidades modificadas, aplicar em transação local com cursor e checkpoint; não transformar leitura remota em novo comando local. Cursor/head monotônico, paginação limitada e tratamento seguro de buracos/reconexões.
- [ ] **Verificar:** testes de feed e F2/F3/F4/F5 de persistência pertinentes; verificar não duplicação e ACK só com prova.
- [ ] **Commit futuro:** `feat(f7-sync): apply incremental remote change feed`.

### Task T10 — Conflitos conservadores de edição, exclusão e projeção

**Files:** Create `apps/v2/src/platform/sync/conflict-reconciliation.ts`; Reuse `apps/v2/src/application/conflict-service.ts` e stores de conflitos; Test `apps/v2/tests/unit/f7-sync-conflicts.test.ts`.

**Interfaces:** `reconcileRemoteEntity(local:OutboxPayload|null, remote:RemoteEntity, pending:readonly OutboxOperation[]):{kind:'APPLY'|'UNCHANGED'|'CONFLICT'; next?:OutboxPayload; conflict?:{local:unknown;remote:unknown;reason:string}}`; `resolveRemoteConflict(conflictId:string, choice:'LOCAL'|'REMOTE'|'MANUAL', baseRemoteRevision:number):Promise<'LOCAL_COMMITTED'|'STALE'|'FAILED'>`.

- [ ] **RED:** `f7_independent_entity_changes_merge`, `f7_same_field_offline_conflict_retains_both_versions`, `f7_delete_vs_edit_needs_decision`, `f7_stale_resolution_rejected`, `f7_conflict_in_one_entity_does_not_block_other_entities`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-sync-conflicts.test.ts` → FAIL.
- [ ] **GREEN:** comparar versão/revisão-base e semântica da entidade, preservar alternativas/proveniência, criar intenção local **nova** ao resolver; não usar timestamps ou mescla de objetos superficial para decidir equivalência.
- [ ] **Verificar:** unit PASS + regressões `f4-conflict-resolution`, `f6-conflicts-integrity` e suites de planejamento relevantes.
- [ ] **Commit futuro:** `feat(f7-sync): preserve and resolve remote conflicts`.

### Task T11 — Rebaseline, exclusão causal e proteção contra clientes antigos

**Files:** Create `apps/v2/src/platform/sync/rebaseline.ts`; Reuse tombstones `apps/v2/src/domain/delete.ts`, stores `indexeddb.ts` e `change-feed.ts`; Test `apps/v2/tests/unit/f7-rebaseline.test.ts`.

**Interfaces:** `assessCursorSafety(local:{epoch:number;cursor:number}, remote:{epoch:number;historyFloor:number;head:number}):'SAFE'|'REBASELINE_REQUIRED'`; `prepareRebaseline(profileId:string, remoteSnapshot:readonly RemoteEntity[]):Promise<{kind:'PREVIEW';created:number;changed:number;deleted:number;conflicts:number}|{kind:'INVALID';reason:string}>`; `commitRebaseline(profileId:string, acceptedPreviewId:string):Promise<'LOCAL_COMMITTED'|'FAILED'>`.

- [ ] **RED:** `f7_old_cursor_forces_recovery`, `f7_no_stale_tombstone_resurrection`, `f7_pending_offline_edit_is_preserved_during_rebaseline`, `f7_repeated_restore_does_not_duplicate`, `f7_timeout_delete_ack_does_not_resurrect`, `f7_epoch_future_rejected`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-rebaseline.test.ts` → FAIL.
- [ ] **GREEN:** preview e snapshot em namespace isolado, sem descarte da outbox; reenquadrar cursores/epoch e conflitos após reconciliação. Não habilitar compactação de tombstones sem prova de barreira remota contra clientes antigos.
- [ ] **Verificar:** testes PASS, E2E offline/reconexão, prova de recuperação após fechamento da aba.
- [ ] **Commit futuro:** `feat(f7-sync): add non-destructive stale-client recovery`.

### Task T12 — Gatilhos automáticos eficientes e estados verdadeiros

**Files:** Create `apps/v2/src/platform/sync/scheduler.ts`; Reuse `apps/v2/src/platform/sync/retry-policy.ts` e `local-events.ts`; Test `apps/v2/tests/unit/f7-sync-scheduler.test.ts`.

**Interfaces:** `SyncTrigger = 'COMMIT'|'OPEN'|'RESUME'|'ONLINE'|'REMOTE_HINT'|'MANUAL'|'RETRY'`; `class AdaptiveSyncScheduler { request(profileId:string, reason:SyncTrigger):void; pause(profileId:string):void; resume(profileId:string):void; dispose():void }` com `SyncCoordinator` injetado. Mapear `COMMIT→LOCAL_COMMIT`, `ONLINE→RECONNECT` e `OPEN/RESUME/REMOTE_HINT/RETRY→RESUME` ao contrato T08; `MANUAL→MANUAL`.

- [ ] **RED:** `f7_commit_requests_single_coalesced_flush`, `f7_offline_does_not_spin`, `f7_no_auth_does_not_send`, `f7_closed_or_disposed_does_not_schedule_work`, `f7_backoff_and_quota_pause`, `f7_manual_request_respects_security_gates`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-sync-scheduler.test.ts` → FAIL com relógio fake controlado.
- [ ] **GREEN:** coalescer pedidos, invalidar timers ao pausar/log-out/unmount, aplicar retry-policy existente; não manter listeners/intervalos constantes em todas as coleções.
- [ ] **Verificar:** teste focal e regressões `f2-retry` PASS, sem envio sob modo local/offline.
- [ ] **Commit futuro:** `feat(f7-sync): trigger economical automatic synchronization`.

### Task T13 — Orçamento Spark e medição de operações

**Files:** Create `apps/v2/src/platform/sync/budget.ts`; Extend `apps/v2/src/platform/sync/document-budget.ts` se necessário; Test `apps/v2/tests/unit/f7-sync-budget.test.ts`.

**Interfaces:** `SyncUsage = { reads:number; writes:number; deletes:number; bytesOut:number; windowStart:string }`; `SyncUsageLimits = {reads:number;writes:number;deletes:number;bytesOut:number;periodMs:number}`; `MeasuredUsage = {kind:'READ'|'WRITE'|'DELETE';count:number;bytesOut:number;source:string}`; `assessSyncBudget(usage:SyncUsage, limits:SyncUsageLimits, next:{reads:number;writes:number;deletes:number}):'ALLOW'|'PAUSE'`; `recordMeasuredSyncUsage(event:MeasuredUsage):void` (logs locais sem payload acadêmico).

- [ ] **RED:** `f7_rejects_negative_or_nonfinite_limits`, `f7_pause_before_local_safety_budget`, `f7_reconnect_amplification_counted`, `f7_quota_error_keeps_outbox`, `f7_unverified_quota_not_reported_as_guaranteed`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-sync-budget.test.ts` → FAIL.
- [ ] **GREEN:** medição sanitizada por operação, orçamento configurável e margem conservadora após dados do emulador/piloto; não usar números arbitrários como prova de consumo; sem billing Cloud Firestore.
- [ ] **Verificar:** testes PASS + relatório reprodutível de estimativas; medição real só em T26 sob G-EXT.
- [ ] **Commit futuro:** `feat(f7-sync): meter and cap spark operations`.

---
## 3. Tarefas implementáveis — backup, criptografia e migração (T14–T21)

### Task T14 — Snapshot íntegro de todas as entidades F2–F6

**Files:** Create `apps/v2/src/platform/backup/collect.ts`, `apps/v2/src/platform/backup/f7-format.ts`; Reuse `apps/v2/src/platform/backup/{format,f2-format}.ts`, `apps/v2/src/platform/indexeddb.ts`; Test `apps/v2/tests/unit/f7-backup-coverage.test.ts`.

**Interfaces:** `BackupScope = {profileId:string; capturedAt:string; schemaVersion:number}`; `F7BackupSnapshot = {manifest:{formatVersion:3; profileId:string; recordCount:number; checksum:string; epoch:number; deletionHistoryComplete:boolean}; payload:Record<string,unknown[]>}`; `collectF7Backup(profileId:string):Promise<F7BackupSnapshot>`; `inspectF7Backup(input:unknown):Promise<{kind:'VALID';snapshot:F7BackupSnapshot}|{kind:'INVALID';reason:string}|{kind:'REBASELINE_REQUIRED';reason:string}>`. **Formato 3 é proposta do plano**, subordinada à compatibilidade de leitor v1/v2.

- [ ] **RED:** `f7_backup_covers_all_persistent_stores_f2_to_f6`, `f7_snapshot_includes_pending_ops_drafts_journal_tombstones_conflicts`, `f7_consistent_snapshot_cannot_mix_two_revisions`, `f7_unknown_schema_preserved_or_rejected_without_loss`, `f7_credentials_removed_without_dropping_academic_data`, `f7_manifest_checksum_and_count_match`.
- [ ] **Provar RED:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-backup-coverage.test.ts` → FAIL de cobertura/contrato, não falha de ambiente.
- [ ] **GREEN:** ler as stores relevantes de forma consistente (transação IndexedDB onde viável), incluir proveniência, metadados de exclusões e operações locais sem tokens, definir tabela de cobertura por store e compatibilidade com readers F1/F2. Evitar cópia superficial de cada `getAll` sem garantir versão e completude.
- [ ] **Verificar:** testes PASS, `tests/unit/backup-format.test.ts`, `tests/unit/f2-backup.test.ts`, typecheck/lint; produzir inventário comparando `STORES` com conteúdo do backup e exclusões justificadas.
- [ ] **Commit futuro:** `feat(f7-backup): capture complete versioned local snapshots`.

### Task T15 — Criptografia automática e recuperação de chave

**Files:** Create `apps/v2/src/platform/backup/crypto.ts`; Test `apps/v2/tests/unit/f7-backup-crypto.test.ts`; Reuse apenas Web Crypto API; **não** criar servidor de chaves.

**Interfaces:** `EncryptedBackup = {format:'eo-v2-encrypted-v1';alg:'AES-256-GCM';iv:string;ciphertext:string;wrappedKey:string;kdf:{name:'PBKDF2';salt:string;iterations:number;hash:'SHA-256'}}`; `createBackupKey():Promise<CryptoKey>`; `encryptBackup(snapshot:F7BackupSnapshot,key:CryptoKey):Promise<{iv:string;ciphertext:string}>`; `wrapBackupKey(key:CryptoKey,recoverySecret:string):Promise<{wrappedKey:string;kdf:EncryptedBackup['kdf']}>`; `decryptBackup(envelope:EncryptedBackup,recoverySecret:string):Promise<F7BackupSnapshot>`. Formato pode ser otimizado como binário sem alterar garantias.

- [ ] **RED:** `f7_encrypt_decrypt_roundtrip`, `f7_ciphertext_contains_no_plain_academic_data`, `f7_wrong_password_fails_closed`, `f7_modified_ciphertext_fails_authentication`, `f7_new_iv_per_encryption`, `f7_recovery_key_works_on_new_device`, `f7_no_exportable_plain_key_in_backup`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-backup-crypto.test.ts` → FAIL.
- [ ] **GREEN:** gerar chave aleatória, criptografia autenticada AES-GCM com nonce fresco, encapsular chave com derivação de senha de recuperação e salt versionado; calibrar PBKDF2 com limite para dispositivo modesto, sem algoritmo próprio. A chave de dados operacional pode ter uma forma protegida localmente, mas nunca prometer resistência contra JavaScript malicioso na mesma origem.
- [ ] **Verificar:** testes de adulteração/recuperação PASS, nenhum segredo no artefato, typecheck/lint; exigir entrega visível de instrução para preservar segredo de recuperação.
- [ ] **Commit futuro:** `feat(f7-backup): encrypt archives with recoverable key`.

### Task T16 — Worker Free mínimo e verificação de identidade

**Files:** Create `apps/v2/cloudflare/backup-worker.ts`, `apps/v2/cloudflare/token-verifier.ts`; Test `apps/v2/tests/unit/f7-kv-auth.test.ts`; config local gratuita/isolada **só sob G-EXT**. Não tocar em Worker ou conta produtiva V1.

**Interfaces:** `KVNamespaceLike` é a porta mínima `get(key):Promise<string|null>`, `put(key,value):Promise<void>`, `delete(key):Promise<void>` e `list(prefix,cursor):Promise<{keys:string[];cursor?:string}>` adaptada para o contrato KV real; `verifyFirebaseIdToken(token:string, expected:{projectId:string;issuer:string}, jwks:JwksPort):Promise<{uid:string}|null>`; `type BackupWorkerBindings={BACKUPS:KVNamespaceLike;FIREBASE_PROJECT_ID:string;ALLOWED_ORIGIN:string}`; `handleBackupRequest(request:Request,bindings:BackupWorkerBindings):Promise<Response>` com rotas mínimas `POST /backups`, `GET /backups`, `GET /backups/:id`, `DELETE /backups/:id` (deleção só mediante política e autorização).

- [ ] **RED:** `f7_worker_rejects_missing_token`, `f7_worker_rejects_wrong_issuer_audience_expiry_signature`, `f7_worker_uid_cannot_read_other_uid`, `f7_worker_rejects_unapproved_origin_and_method`, `f7_no_secrets_or_plain_backup_logged`, `f7_worker_rejects_oversized_request`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-kv-auth.test.ts` → FAIL da verificação/handler ausente, usando JWKS fake e bindings em memória.
- [ ] **GREEN:** verificar assinatura RS256 e claims contra chaves públicas oficiais com cache e limites seguros, usar UID do token (nunca de path arbitrário), limitar tamanhos e métodos, validar CORS, rejeitar conteúdo acadêmico não criptografado. O navegador não recebe segredo R2/KV.
- [ ] **Verificar:** unit PASS, testes negativos de autenticação e inspeção de logs; teste real isolado somente após G-EXT.
- [ ] **Commit futuro:** `feat(f7-backup): authorize isolated cloudflare backup worker`.

### Task T17 — Adaptador Workers KV Free com objetos imutáveis

**Files:** Create `apps/v2/src/platform/backup/kv-client.ts`; Modify `apps/v2/cloudflare/backup-worker.ts` da T16; Test `apps/v2/tests/unit/f7-kv-storage.test.ts`; Cloudflare R2 sem ativação nem `wrangler` de R2.

**Interfaces:** `BackupRemotePort={put(input:{uid:string;id:string;encrypted:EncryptedBackup}):Promise<'VERIFIED'|'PENDING'|'QUOTA'|'FAILED'>;get(id:string):Promise<EncryptedBackup|null>;list():Promise<{id:string;createdAt:string;size:number}[]>;deleteVerifiedOldVersion(id:string):Promise<boolean>}`; `createKvBackupPort(endpoint:string,getIdToken:()=>Promise<string|null>):BackupRemotePort`.

- [ ] **RED:** `f7_backup_id_immutable`, `f7_duplicate_upload_idempotent`, `f7_remote_readback_required_before_success`, `f7_kv_eventual_consistency_not_false_success`, `f7_wrong_uid_denied`, `f7_25mib_value_blocks_cloud_upload`, `f7_cloudflare_quota_failure_keeps_local_export`, `f7_r2_disabled_without_billing_guarantee`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-kv-storage.test.ts` → FAIL.
- [ ] **GREEN:** IDs aleatórios ou derivados de digest sem colisão, conteúdo imutável, confirmação de leitura/integração antes do estado `VERIFIED`, isolamento pelo Worker; nunca apagar versão anterior para fazer espaço antes de verificar a nova. Sem índice mutável global suscetível a perda de atualização por consistência eventual do KV.
- [ ] **Verificar:** unit PASS, simulação de eventual consistency/quota e Cloudflare Worker local quando disponível; upload real `NOT_RUN` até G-EXT.
- [ ] **Commit futuro:** `feat(f7-backup): store encrypted immutable archives in kv free`.

### Task T18 — Backup diário incremental em decisões, retenção de sete versões

**Files:** Create `apps/v2/src/platform/backup/scheduler.ts`; Reuse `collectF7Backup`, `encryptBackup`, `BackupRemotePort`, `local-events.ts`; Test `apps/v2/tests/unit/f7-backup-schedule.test.ts`.

**Interfaces:** `type BackupPolicy={minIntervalMs:86400000;maxRemoteVersions:7}`; `class PersonalBackupScheduler { request(profileId:string, reason:'OPEN'|'CHANGE'|'MANUAL'):Promise<'VERIFIED'|'SKIPPED'|'DEFERRED'|'FAILED'>; dispose():void }`; estado mínimo por perfil inclui digest do último snapshot **confirmado** e confirmação do destino.

- [ ] **RED:** `f7_daily_backup_only_after_material_change`, `f7_minimum_24h_for_automatic_upload`, `f7_manual_backup_allowed_anytime`, `f7_app_closed_does_not_claim_execution`, `f7_keep_at_most_seven_verified_remote_versions`, `f7_new_backup_failure_does_not_delete_last_good_copy`, `f7_kv_quota_pauses_without_paid_fallback`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-backup-schedule.test.ts` → FAIL com relógio fake.
- [ ] **GREEN:** disparo após abertura/uso e alteração relevante, comparar digest com backup válido anterior, limitar uma tentativa efetiva diária ao orçamento, política de retenção após nova versão confirmada; sem timers contínuos nem job remoto pago. Falha de backup jamais modifica sync ou fatos acadêmicos.
- [ ] **Verificar:** testes PASS, read-back simulado da versão nova antes de excluir versão antiga; estado de backup separado do sync.
- [ ] **Commit futuro:** `feat(f7-backup): schedule simple daily verified backups`.

### Task T19 — Preview, restauração isolada e commit recuperável

**Files:** Create `apps/v2/src/platform/backup/restore-commit.ts`; Reuse `apps/v2/src/platform/backup/restore.ts`, `apps/v2/src/platform/import-commit.ts` e `planning-import-commit.ts`; Test `apps/v2/tests/unit/f7-restore.test.ts` e `apps/v2/tests/e2e/f7-restore.spec.ts`.

**Interfaces:** `RestorePreviewF7={id:string;profileId:string;toCreate:number;toUpdate:number;conflicts:number;requiresRebaseline:boolean;sourceEpoch:number}`; `prepareF7Restore(snapshot:F7BackupSnapshot,targetProfileId:string):Promise<{kind:'PREVIEW';preview:RestorePreviewF7}|{kind:'INVALID';reason:string}>`; `commitF7Restore(previewId:string, consent:true):Promise<'LOCAL_COMMITTED'|'STALE'|'INSUFFICIENT_SPACE'|'FAILED'>`.

- [ ] **RED:** `f7_restore_is_readonly_until_consent`, `f7_restore_rejects_checksum_mismatch`, `f7_restore_old_epoch_cannot_resurrect_deleted`, `f7_restore_aborted_commit_preserves_original`, `f7_restore_pending_outbox_not_replayed_automatically`, `f7_wrong_uid_restores_only_to_isolated_namespace`, `f7_idempotent_restore_on_repeat`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-restore.test.ts` → FAIL; E2E focal após GREEN.
- [ ] **GREEN:** preview em armazenamento temporário isolado por perfil, comparação de IDs/referências e conflito; antes do commit, snapshot verificável do estado atual quando possível; aplicar transação/recuperação por journal para grupos que ultrapassam uma transação. Não declarar rollback seguro se cópia prévia indisponível; nesse caso bloquear alteração destrutiva.
- [ ] **Verificar:** unit + `npm run test:e2e -- tests/e2e/f7-restore.spec.ts` PASS, simular crash/quota entre lotes e read-back final.
- [ ] **Commit futuro:** `feat(f7-restore): restore validated archives without data loss`.

### Task T20 — Adaptador de migração V1 sintética e equivalência de Reta Final

**Files:** Create `apps/v2/src/platform/legacy/v1-adapter.ts`; Reuse `apps/v2/src/platform/legacy/recognize.ts`, `content-migration.ts` e importadores; Test `apps/v2/tests/unit/f7-v1-migration.test.ts`, fixtures `apps/v2/tests/fixtures/f7-v1-legacy.ts` (sintéticas).

**Interfaces:** `LegacyMigrationPreview={kind:'SAFE'|'AMBIGUOUS'|'INVALID';recordCount:number;unmapped:number;conflicts:number;provenance:string[]}`; `inspectLegacyV1Export(input:unknown):LegacyMigrationPreview`; `convertLegacyV1InIsolation(input:unknown):Promise<{preview:LegacyMigrationPreview;snapshot:F7BackupSnapshot|null}>`.

- [ ] **RED:** `f7_v1_schema_12_11_9_7_supported_as_test_fixtures`, `f7_v1_db_7_6_migration_fixtures`, `f7_legacy_180_blocks_equivalent_only_if_semantically_equal`, `f7_missing_remote_plan_not_treated_as_absent`, `f7_legacy_ambiguous_ids_quarantined`, `f7_study_time_revisions_questions_notes_preserved`, `f7_real_v1_origin_never_accessed`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-v1-migration.test.ts` → FAIL; não usar dados privados/fixtures coletadas da V1 produtiva.
- [ ] **GREEN:** mapear campos e relações com proveniência explícita, preservar campos desconhecidos sem interpretá-los, diferenciar documento ausente de documento legado não reconhecido; não criar ponte bidirecional nem escrever na V1. Erro de equivalência → `AMBIGUOUS` e quarentena.
- [ ] **Verificar:** unit PASS + auditoria de contagem/referência/soma de sessões em fixtures sintéticas; reexecutar F2/F3 importações.
- [ ] **Commit futuro:** `feat(f7-migration): prepare safe isolated v1 imports`.

### Task T21 — Teste de estresse de backup, corruptela e limite KV (sem serviço pago)

**Files:** Test `apps/v2/tests/unit/f7-backup-boundaries.test.ts`, `apps/v2/tests/e2e/f7-backup.spec.ts`; Reuse tarefas T14–T19; não criar segundo formato de backup.

**Interfaces:** Consome `collectF7Backup`, `encryptBackup`, `createKvBackupPort`, `prepareF7Restore`; produzir relatório de cobertura em evidência de testes, não biblioteca nova.

- [ ] **RED:** `f7_complete_archive_over_25mib_exports_locally`, `f7_large_archive_never_truncated_for_kv`, `f7_backup_readback_equals_original_manifest`, `f7_corrupt_encrypted_backup_never_changes_active_database`, `f7_repeated_export_without_changes_is_stable`, `f7_failed_retention_does_not_drop_last_valid_version`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-backup-boundaries.test.ts` → FAIL somente no comportamento ainda não coberto.
- [ ] **GREEN:** corrigir apenas lacunas reais encontradas nos módulos T14–T19; não adicionar chunking remoto complexo nem assinatura R2 para contornar o KV Free. Se exceder o limite KV, exportação local íntegra e diagnóstico claro.
- [ ] **Verificar:** unit + `npm run test:e2e -- tests/e2e/f7-backup.spec.ts` PASS; hashes e tamanhos no relatório (sem conteúdo de estudo).
- [ ] **Commit futuro:** `test(f7-backup): prove full size integrity and free tier behavior` (se apenas testes; correção focal quando necessária).

---

## 4. Tarefas implementáveis — UI, PWA, hardening e homologação (T22–T27)

### Task T22 — Integrar Auth, sync e backup em uma UX pessoal discreta

**Files:** Create `apps/v2/src/presentation/components/GoogleLink.tsx`, `apps/v2/src/presentation/components/BackupControls.tsx`; Modify `apps/v2/src/presentation/components/SyncStatus.tsx`, `apps/v2/src/presentation/views/SettingsView.tsx`, `apps/v2/src/presentation/App.tsx` **somente nos pontos de integração**; Test `apps/v2/tests/e2e/f7-settings-flow.spec.ts`, `apps/v2/tests/unit/f7-sync-view.test.ts`.

**Interfaces:** `SyncStatus` recebe `SyncHealth` existente; `BackupHealth={status:'NONE'|'PENDING'|'VERIFIED'|'FAILED';lastVerifiedAt:string|null;versions:number}`; `GoogleLink` expõe ações de preview/consentimento sem enviar dados por render; `BackupControls` expõe exportar, restaurar, estado e chave de recuperação. Evitar monolito em `App.tsx`: compor com pequenas portas já previstas em T02/T03/T08/T12/T18/T19.

- [ ] **RED:** `f7_local_saved_is_not_labeled_converged`, `f7_backup_status_distinct_from_sync`, `f7_link_requires_explicit_consent`, `f7_logout_does_not_show_old_uid_data`, `f7_unauthorized_services_are_unavailable_by_default`, `f7_backup_restoration_needs_preview`, `f7_offline_study_flow_not_blocked_by_cloud`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-sync-view.test.ts` → FAIL; E2E novo para UI depois de GREEN.
- [ ] **GREEN:** indicador compacto e acessível; ações “Sincronizar agora”, “Criar backup”, “Restaurar”, estados local/remoto/convergência/backup verdadeiros; sem painel administrativo, pop-ups repetitivos ou dados em logs. Integração só habilita recursos reais com config e opt-in corretos.
- [ ] **Verificar:** unit + `npm run test:e2e -- tests/e2e/f7-settings-flow.spec.ts` PASS, regressões F6 Settings/Home e teste de teclado/mobile.
- [ ] **Commit futuro:** `feat(f7-ui): expose simple sync and backup controls`.

### Task T23 — PWA offline e SW upgrade somente quando seguro

**Files:** Modify `apps/v2/src/platform/sw-update.ts`, `apps/v2/public/sw.js` apenas quando lacuna comprovada; Test `apps/v2/tests/e2e/f7-pwa-safe-update.spec.ts` e regressões `f4-update.spec.ts`, `pwa-offline.spec.ts`.

**Interfaces:** Reuse `canApplyV2Update(safety:UpdateSafety)`, `requestSafeUpdate`, `applyWaitingUpdate` e `registerV2ServiceWorker`; preservar `UpdateSafety` já existente (`hasActiveSession`, `hasUnsavedForm`, `hasPendingRecovery`, `databaseCompatible`, `otherTabsReady`).

- [ ] **RED:** `f7_active_timer_blocks_sw_update`, `f7_unsaved_form_in_other_tab_blocks_update`, `f7_pending_restore_blocks_update`, `f7_old_and_new_client_never_mix_incompatible_assets`, `f7_offline_reload_retains_committed_session`, `f7_sw_cache_does_not_include_v1`.
- [ ] **Provar RED:** `npm run test:e2e -- tests/e2e/f7-pwa-safe-update.spec.ts` → FAIL comportamental esperado; preservar artefatos SW e restaurar alterações geradas por testes existentes.
- [ ] **GREEN:** atualização sem recarga forçada enquanto insegura, atualização de cache com versão e isolamento corretos, proteção do banco sob versionchange; não introduzir Service Worker paralelo ou Background Sync como dependência.
- [ ] **Verificar:** E2E focal + F4 update/PWA offline + sessões F4/F6 e typecheck PASS.
- [ ] **Commit futuro:** `fix(f7-pwa): preserve sessions during safe updates`.

### Task T24 — Persistência local, quota e recuperação sem perda silenciosa

**Files:** Create `apps/v2/src/platform/storage-health.ts`; Reuse `apps/v2/src/platform/indexeddb.ts`, `apps/v2/src/application/session-emergency.ts`; Test `apps/v2/tests/unit/f7-storage-health.test.ts`, `apps/v2/tests/e2e/f7-storage-recovery.spec.ts`.

**Interfaces:** `StorageHealth={persistent:boolean|null;estimatedUsage:number|null;estimatedQuota:number|null;warning:'NONE'|'LOW_SPACE'|'UNAVAILABLE'}`; `getStorageHealth():Promise<StorageHealth>`; `requestBestEffortPersistence():Promise<'GRANTED'|'DENIED'|'UNSUPPORTED'>`. Chamadas a `navigator.storage` somente quando presentes.

- [ ] **RED:** `f7_persistence_denied_does_not_disable_study`, `f7_estimate_is_not_treated_as_exact_available_space`, `f7_quota_abort_has_no_false_commit`, `f7_storage_deleted_offers_recovery_without_overwrite`, `f7_cache_cleanup_does_not_delete_outbox_or_drafts`, `f7_emergency_session_preserved_when_possible`.
- [ ] **Provar RED:** `npm run test:unit -- tests/unit/f7-storage-health.test.ts` → FAIL; E2E após GREEN com simulação controlada de quota e remoção.
- [ ] **GREEN:** usar API StorageManager quando disponível, avisos leves e falha fechada nos commits; recuperação por backup sem auto-restore; limpeza apenas de caches regeneráveis comprovados. Nunca afirmar que conteúdo em memória sobreviverá ao fechamento.
- [ ] **Verificar:** unit + `npm run test:e2e -- tests/e2e/f7-storage-recovery.spec.ts`, testes `f4-emergency`, `f2-atomic-commit` PASS.
- [ ] **Commit futuro:** `feat(f7-storage): surface browser persistence and safe recovery`.

### Task T25 — Segurança, acessibilidade e regressão integrada F1–F6

**Files:** Test `apps/v2/tests/e2e/f7-security-a11y.spec.ts`, `apps/v2/tests/unit/f7-security-inputs.test.ts`; Modify apenas arquivos responsáveis por achados reais (`import-service.ts`, telas F6 etc.); leitura dos oito temas A-01 e inventário de cobertura F0.

**Interfaces:** Não criar serviço novo. Cobrir limites de importação, texto hostil, sanitização de logs, CSP e regras de UID, teclado, foco, touch, contraste, reduz movimento, compatibilidade de navegação e regressões acadêmicas.

- [ ] **RED:** `f7_import_rejects_unbounded_or_prototype_payload`, `f7_script_text_is_never_executed`, `f7_logs_never_include_token_or_academic_payload`, `f7_keyboard_can_reach_sync_actions`, `f7_mobile_controls_have_accessible_labels`, `f7_profile_switch_does_not_expose_other_data`.
- [ ] **Provar RED:** testes focais devem falhar quando for reproduzível a lacuna; testes já cobertos podem ser mantidos como regressão PASS, sem fabricar RED artificial.
- [ ] **GREEN:** corrigir apenas achados materiais dentro dos módulos existentes, revisar CSP/rotas/autenticação, conferir AC24 e ressalvas RF/INCOMING pertinentes; não refazer design system. Marcar NVDA/Narrator e hardware modesto `NOT_RUN` quando não executados.
- [ ] **Verificar:** `npm run typecheck && npm run lint && npm run test:unit && npm run build && npm run test:e2e`, resultados por suite; auditoria visual representativa 8 temas × 3 viewports, usando diretório temporário independente e **sem regravar PNGs F4 preservados**.
- [ ] **Commit futuro:** `fix(f7-hardening): close critical integrated regressions`.

### Task T26 — Homologação real isolada de Firebase/Cloudflare e dispositivos (G-EXT)

**Files:** Create `apps/v2/tests/e2e/f7-multidevice.spec.ts`, `apps/v2/tests/e2e/f7-isolated-pilot.spec.ts`; Reuse contratos T01–T25; Evidence futura em `docs/superpowers/audits/2026-11-04-v2-f7-evidence.md` **somente após execução autorizada**, sem dados reais/segredos.

**Interfaces:** Piloto: uma conta de teste Google no projeto Spark de homologação, 1–3 clientes (PC/Chromium, emulador Android e celular/tablet real quando disponível), dois perfis para negação UID, Worker/KV Free isolado apenas após autorização. Matriz S01–S25 e quatro HIGH F0 vinculantes.

- [ ] **RED / baseline de integração:** antes do serviço real, provar suíte de cenários sintéticos com Emulator Suite; falhas esperadas em integrações ainda desabilitadas, nunca confundir indisponibilidade de credencial real com falha de código.
- [ ] **Gate:** exigir G-EXT para criar/acessar Firebase Spark, Auth Google real ou Worker/KV real. Se não autorizado, **não chamar serviços**, continuar verificações locais e marcar `NOT_RUN` para piloto remoto.
- [ ] **GREEN / execução controlada:** adicionar apenas correções necessárias aos contratos T01–T25, rerodar a suite do Emulator Suite até PASS; sob G-EXT, validar login/vínculo/UID, Rules, duas abas, offline/reconexão, concorrência, timeouts, cursores, backups criptografados e restauração com fixtures. Medir leituras/escritas/deletes/armazenamento e erros, verificar franquias atuais. **Sem teste de carga irrestrito em ambiente real.**
- [ ] **Verificar:** reexecutar os testes do emulador e pilotos autorizados até os critérios críticos PASS; evidências com data, comando, SHA, resultado por S01–S25, IDs sintéticos, logs sanitizados e contagens por cliente; screenshots sem conteúdo pessoal; `NOT_RUN` para dispositivos físicos não disponíveis.
- [ ] **Commit futuro:** apenas testes/ajustes necessários em `v2`; credenciais, logs de tokens, exportações e configurações secretas nunca commitados.

### Task T27 — F7-G: URL de avaliação V2 independente e pacote final de aceite (G-STAGING)

**Files:** Reuse `apps/v2/vite.config.ts`, build Vite, `apps/v2/public/manifest.webmanifest`; Create teste `apps/v2/tests/e2e/f7-staging-isolation.spec.ts`; registrar estado em `docs/superpowers/v2/ROADMAP.md`, issue #108 e **um único** relatório `docs/superpowers/audits/2026-11-04-v2-f7-readiness.md` somente após G-EXEC/G-STAGING; sem workflow GitHub Actions.

**Interfaces:** `StagingReadiness={buildSha:string;url:string;isolatedOrigin:boolean;isolatedFirebase:boolean;v1Unaffected:boolean;criticalTestsPassed:boolean;unverified:string[]}`; `verifyStagingReadiness(input:StagingReadiness):'READY_FOR_HUMAN_REVIEW'|'BLOCKED'`. Verificação por navegador e read-back da URL real depois do deploy autorizado.

- [ ] **RED:** `f7_staging_url_must_differ_from_v1`, `f7_staging_does_not_touch_v1_sw_idb_or_firebase`, `f7_staging_uses_only_test_data`, `f7_staging_candidate_integrates_f2_to_f6`, `f7_staging_does_not_claim_ready_without_live_readback`, `f7_staging_blocks_paid_services`.
- [ ] **Provar RED:** `npm run test:e2e -- tests/e2e/f7-staging-isolation.spec.ts` → FAIL antes de disponibilizar URL; teste local pode comprovar config, mas não substituir navegação externa.
- [ ] **Gate:** G-STAGING explícito antes de qualquer `wrangler` publish, Pages deploy, DNS ou URL externa; escolher opção comprovadamente gratuita. Não colocar domínio produtivo V1 como destino nem habilitar R2.
- [ ] **GREEN/entrega:** construir candidato funcional, configurar projeto/URL V2 isolados, verificar autenticação/test data/CSP/manifest e executar jornadas F2–F6 no endereço real. Publicar somente após G-STAGING; documentar URL e limitações sem criar release V1.
- [ ] **Verificar:** read-back HTTP, navegador desktop + viewport mobile/tablet, smoke PWA/sync/backup e teste de origem cruzada, status dos S01–S25; revisar e corrigir falhas materiais na mesma `v2`, repetir regressões afetadas.
- [ ] **Integração/documentos futuros:** validar commits em `origin/v2` somente com autorização de push, registrar readiness/rollback e limpar **apenas** recursos temporários sem trabalho exclusivo. Preparar pacote ZIP de relatórios/evidências e solicitar **avaliação humana**. **Não** fazer merge `v2`→`main` ou transição V1.
- [ ] **Commit futuro:** `docs(f7): record independent staging readiness and human gate` (após autorização e provas reais).

---

## 5. Matriz de dependências e gates

| Bloco | Tarefas | Depende de | Evidência / gate |
|---|---|---|---|
| Base e auth | T01–T03 | G-EXEC, spec vigente | Tests de identidade, LOCAL_ONLY e consentimento |
| Rules e schema remoto | T04–T07 | T01–T03; emulador local | Rules negativas, CAS, idempotência, ACK |
| Sincronização | T08–T13 | T04–T07 | Duas abas, conflito, cursor, quotas, sem duplicação |
| Backup/cripto | T14–T15 | Stores atuais; sem rede real | Roundtrip de arquivos, chaves e integridade |
| Workers/KV | T16–T18 | T14–T15, G-EXT só para serviço real | JWT/UID, read-back, 24h/sete versões, quota |
| Restauração/legado | T19–T21 | T14–T18, estruturas F1–F6 | Snapshot completo, rollback, schemas e >25 MiB |
| UI/PWA/storage | T22–T24 | T02–T21 | Jornada local, offline e avisos corretos |
| Hardening | T25 | T01–T24 | Testes e revisão independente |
| Piloto isolado | T26 | T25 e G-EXT | S01–S25 reais/simulados corretamente rotulados |
| Avaliação humana | T27 | T26, G-STAGING | URL própria, evidência, readiness e aceite humano posterior |

**Execução sequencial preferencial:** tarefas pequenas no mesmo contexto `v2`; revisores independentes para contratos remotos, criptografia, migração e segurança, sem criar PR por tarefa. A única paralelização razoável é entre testes locais de backup e de Firestore sem mutação nos mesmos arquivos. Não tornar revisão ritualística ou criar loops de correção por artefatos cosméticos.

### Rastreabilidade das decisões arquiteturais → implementação futura

| Decisão aprovada | Tarefas responsáveis | Comprovação |
|---|---|---|
| D-F7-01/B | T01, T04, T26 | Emulator Suite antes do piloto real isolado |
| D-F7-02/B | T02–T04, T22, T26 | Google UID, perfil/biblioteca e consentimento |
| D-F7-03/B | T05–T06, T09 | Schema remoto versionado, documentos pequenos |
| D-F7-04/B | T10–T11 | Conflitos persistidos, mescla independente |
| D-F7-05/B | T07–T08, T26 | Web Locks, outbox, ACK idempotente |
| D-F7-06/B | T09–T11, T19 | Cursor/epoch e rebaseline não destrutivo |
| D-F7-07/B | T12–T13, T26 | Gatilhos adaptativos e orçamento Spark |
| D-F7-08/B revisada | T14, T16–T18, T21 | Manual, automático, KV Free; R2 não ativada |
| D-F7-09/B | T19–T20 | Restore isolado, importação legada com prévia |
| D-F7-10/B simplificada | T15–T17, T21 | AES-GCM e chave de recuperação |
| D-F7-11/B | T18, T21 | 24 h / até 7 cópias válidas |
| D-F7-12/B | T22 | Estados discretos e verdadeiros |
| D-F7-13/B | T23 | Update SW adiado com sessão/draft ativo |
| D-F7-14/B | T24 | Persistência, quota e recuperação local |
| D-F7-15/B | T25–T26 | Testes locais/emulador/piloto real autorizado |
| D-F7-16/B | T25–T27 | Aceite por riscos, evidência e pendências |
| D-F7-17/C | T01, T20, T27 + gate G5/F8 futuro | V1 preservada; possibilidade bidirecional **não ativada** na F7 |

### Cobertura S01–S25 → tarefa responsável

A correspondência abaixo evita que um cenário obrigatório fique apenas citado genericamente no piloto. A cobertura efetiva só será marcada após executar o teste e verificar as evidências.

| Cenário | Tarefas responsáveis | Evidência mínima |
|---|---|---|
| S01 PC→celular→tablet | T06–T09, T22, T26 | IDs, revisões e sessão sem dupla contagem |
| S02 edições offline independentes | T09–T12, T26 | Ambas preservadas e convergidas |
| S03 edições incompatíveis | T10, T22, T26 | Conflito com duas versões recuperáveis |
| S04 cliente antigo após exclusão | T11, T19, T26 | Epoch/rebaseline; tombstone não ressuscita |
| S05 timeout após commit | T06–T08, T26 | Read-back e ACK idempotentes |
| S06 duas abas disputam outbox | T07–T08, T26 | Uma aplicação lógica e locks liberados |
| S07 troca de conta/UID | T02–T04, T09, T22, T26 | Acesso cruzado negado até após resposta tardia |
| S08 documento remoto >1 MiB | T04–T06, T26 | Rejeição íntegra e payload preservado |
| S09 reconexões e quotas | T12–T13, T26 | Contagens reais e orçamento justificado |
| S10 quota/Auth/rede/app fechado | T03, T08, T12–T13, T26 | Pendências duráveis e status correto |
| S11 restore antigo e exclusões | T11, T14, T19, T26 | Sem ressurreição; prévia segura |
| S12 legado V1/Reta Final #107 | T20, T26 | IDs/relacionamentos/contagens comprovados |
| S13 SW com timer/draft | T23, T25–T26 | Adiamento e persistência após reload |
| S14 limpeza de dados V2 | T19, T24, T26 | Consentimento e ausência de impacto V1 |
| S15 Rules hostis / UID | T04, T16, T25–T26 | Negação no emulador e projeto isolado |
| S16 backup portátil roundtrip | T14–T15, T19, T21 | Hash/contagem e leitura íntegra |
| S17 cobertura V1/V2 | T20, T25–T26 | Matriz de capacidades sem PASS fictício |
| S18 remoção do IndexedDB | T19, T24, T26 | Recovery por backup remoto/local disponível |
| S19 Cloudflare Worker/KV read-back | T16–T17, T26 | Cópia criptografada e UID correto |
| S20 agendamento/retention | T17–T18, T21 | ≤1 backup automático/24 h e até 7 versões |
| S21 senha/chave/perda de dispositivo | T15, T19, T21 | Erro criptográfico sem mudança local |
| S22 isolamento URL F7-G | T01, T25–T27 | URL distinta, V1 intocada |
| S23 pacote maior que KV Free | T17, T21, T26 | Nuvem suspensa; exportação local íntegra |
| S24 conteúdo F2–F6 completo | T14, T19, T21–T22 | Inventário por store e restauração |
| S25 avaliação PC/mobile/tablet | T23–T27 | Evidências reais ou `NOT_RUN` declarado |

## 6. Trilha de TDD, testes e evidências

**Por tarefa:** teste focal RED reproduz comportamento ausente (salvo regressões já existentes); registrar falha esperada com comando, caso e motivo. GREEN com mínima implementação e teste focal PASS. Confirmar regressões diretas, `typecheck`/`lint` pertinentes e diff pequeno. Commit pequeno somente após G-EXEC. A cada bloco, executar regressões importantes de F2–F6; ao final `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` e `npm run test:e2e` dentro de `apps/v2`.

**Comprovação externa:** separar `EMULATOR_PASS` de `REAL_ISOLATED_PASS`. O último exige read-back de Firebase/Workers KV **em projeto real autorizado**, sem produção. Teste pendente por ausência de serviço/aparelho recebe `NOT_RUN`/`BLOCKED_ENVIRONMENT`, sem ser inventado como PASS. Acessibilidade com leitor de tela e hardware modesto devem manter limitação explícita quando não executados.

**Evidência mínima por gate:** SHA/branch, comandos e saídas relevantes, matriz S01–S25, métricas de operação e armazenamento, screenshots sanitizadas dos cenários principais, testes de invariantes de dados/backup, resultado da auditoria independente, comparação com spec, inventário Git, impedimentos e ação seguinte. Evitar múltiplos relatórios para o mesmo estado.

## 7. Backup pré-execução e rollback por dimensão

### Backup pré-execução (após G-EXEC, antes de editar)

- [ ] Inventariar worktree, branches, PRs, stashes, commits exclusivos, 3 PNGs F4 modificados e branch preservada F5; registrar hashes e localização de cópias existentes. Verificar capacidade e disponibilidade do destino de backup antes de começar.
- [ ] Preservar alterações locais não commitadas e artefatos insubstituíveis em cópia/hash verificáveis, sem sobrescrever ou `git reset --hard`. Conferir read-back da cópia, inclusive arquivos ignorados relevantes e dados sintéticos de teste.
- [ ] Registrar SHA exatos de `origin/v2` e `origin/main`; `main` e V1 são somente leitura. Capturar estado de configuração de testes sem secrets.
- [ ] Para migração/restauração, criar backup sintético íntegro de referência, comparar hashes e executar read-back de importação em namespace de teste isolado.

### Rollback e recuperação

| Falha | Resposta segura |
|---|---|
| Teste unitário/regressão falha | Reverter **somente** a alteração local não aprovada, após diff/inventário; preservar commits e dados existentes |
| Migração IndexedDB mal sucedida | Suspender upgrade e restaurar cópia de teste verificada; não executar downgrade automático em banco real |
| Falha de Rules/Auth em projeto isolado | Bloquear integração real, restaurar config isolada versionada e revalidar testes; nunca mexer em Rules V1 |
| Quota Firebase/KV | Suspender envios e preservar outbox/backup manual; não contratar upgrade |
| Backup criptografado inválido | Rejeitar e conservar todas as versões anteriores íntegas |
| Publicação de staging falha | Retirar **apenas URL/projeto isolados autorizados**, mantendo V1 e dados locais intactos; registrar ponto de retorno |
| Git contém branch/worktree exclusiva | Inventariar, preservar e pedir autorização antes de remoção; jamais forçar push ou descartar commits |

**Regra:** rollback de código não implica rollback seguro de dados. Não reverter alterações após usuários de teste criarem dados sem preservar essas alterações e verificar suas cópias.

## 8. Critérios de aceite, status e fechamento

| Estado | Condição |
|---|---|
| `F7_PLAN_PROPOSED_NOT_APPROVED` | Estado desta entrega; sem execução |
| `F7_PLAN_APPROVED_FOR_GOAL` | Aprovação humana do plano; permite preparar GOAL, não executar |
| `F7_IMPLEMENTATION_AUTHORIZED` | GOAL/autorização expressa + preflight seguro |
| `F7_LOCAL_CODE_COMPLETE` | Entregas locais concluídas; **não** prova remoto ou staging |
| `F7_READY_FOR_HUMAN_REVIEW` | Testes críticos e piloto real autorizado comprovados, URL de avaliação funcional e relatório entregue |
| `F7_ACCEPTED` | Aceite humano depois de experimentar V2; só com críticos comprovados |
| `F7_BLOCKED` | Risco crítico, gate externo ausente ou evidência obrigatória pendente; não declarar concluído |

**Obrigatórios:** dados sem perda/deduplicação inadequada, Auth/Rules por UID, sync remoto idempotente, cursor/rebaseline/tombstones, backup completo e restaurável F2–F6, cripto e recuperação, migração sintética, PWA segura, quotas gratuitas, cobertura S01–S25 ou justificativa explícita de substituição, quatro HIGH F0 tratados no contexto V2 e **ambiente F7-G acessível para avaliação humana**. Falha crítica não é ressalva aceitável.

**Integração Git/Hygiene:** sem Actions, PRs ou branches extras por padrão. Preparar integração validada em `v2`; push só com autorização prevista em GOAL, conferindo `origin/v2` e proteções. A V1 (`main`) não muda. Verificar trabalho órfão, branches, PRs, worktrees, stashes e arquivos temporários; excluir só com prova de integração e autorização. Atualizar preferencialmente `ROADMAP.md` e issue #108, mais um relatório de aceite, sem duplicatas.

**Pacote de encerramento (quando executado e autorizado):** um `.zip` contendo plano/spec efetivamente usados, matriz de testes e métricas, evidências sanitizadas, inventário Git final, status de URLs e serviços isolados, resultado da revisão independente, checklist backup/rollback e pendências com próxima ação. **Não incluir** `node_modules`, builds desnecessários, tokens, configs secretas nem dados reais.

**Não autorizado por aprovação da F7:** merge para `main`, publicar V2 no domínio V1, migrar dados produtivos, tornar V2 autoridade de escrita produtiva, aposentar V1, ativar R2 ou construir ponte bidirecional produtiva V1↔V2. A opção arquitetural D-F7-17/C permanece como possível decisão de coexistência posterior, sob gate F8 específico e nova prova de compatibilidade.

## 9. Autorrevisão do plano (Superpowers)

| Verificação | Resultado nesta proposta |
|---|---|
| Cobertura da spec | D-F7-01–17; F7-A–G; S01–S25 e quatro HIGH mapeados em T01–T27 |
| Reutilização do código | Portas existentes e uma outbox; nenhum novo framework ou microserviço |
| Tipos/interfaces | Contratos propostos identificados; imports entre T05/T06/T09/T10/T11 e T14–T19 foram mapeados |
| Cinco cenários do Review Focus | Testes apontados em T01/T08/T09/T11/T16/T21/T23/T24/T27 |
| TDD por tarefa | RED/checagem/GREEN/regressão/commit futuro descritos |
| Gates reais | G-EXEC, G-EXT e G-STAGING separados |
| Backup/rollback | Inventário + cópia/hash + ensaio de restauração; sem operação destrutiva |
| Publicação/aceite | URL de teste é gate independente; sem substituição V1 |

**Limites da revisão:** leitura remota do repositório e arquivos entregues nesta conversa; nenhum teste ou código executado, sem conhecimento de alterações locais concorrentes. No GOAL futuro, validar os arquivos e versões reais antes de editar. **A enumeração de etapas não é autorização de execução.**

## 10. Encaminhamento para aprovação

Este writing-plans está entregue **apenas para revisão humana**. Depois de aprovação expressa, preparar um GOAL único e completo para Codex Desktop que referencie spec/plan e determine preflight, TDD, etapas, revisões, integração autorizada em `v2`, preservação da V1, higiene Git e pacote ZIP. **Não disparar esse GOAL agora.**
