# Estudo Organizado V2 — F2: relatório de aceite para revisão humana

**Data:** 2026-10-28
**Branch:** `v2` (somente local; `main` intocada)
**Gate proposto:** `F2_READY_FOR_HUMAN_REVIEW` (após o GOAL corretivo C1–C7; ver §10)

> **Estado atual:** `F2_ACCEPTED_WITH_RESERVATIONS` — aceite do proprietário registrado em 2026-10-29 (§15). O gate abaixo descreve a recomendação técnica que precedeu a decisão.

## 15. Aceite do proprietário — `F2_ACCEPTED_WITH_RESERVATIONS` (2026-10-29)

**Decisão registrada:** o proprietário aprovou expressamente a F2 com ressalvas, sob o veredito `F2_ACCEPTED_WITH_RESERVATIONS`, em mensagem direta de 2026-10-29, autorizando exclusivamente a consolidação documental desta decisão.

**Referência de implementação:** `v2` em `8e4dc71` — 188 testes unitários e 50 E2E aprovados, typecheck, lint e build PASS (logs em `evidence/2026-10-29-v2-f2-final-goal-*.txt`).

**Escopo do aceite:** as seis capacidades funcionais F2, implementadas e validadas localmente, com `main` e V1 preservadas.

**Fora do escopo do aceite:** homologação de Firebase, sincronização real, recuperação produtiva de backups, desempenho mobile e publicação da V2. O aceite cobre implementação local e simulada.

**Requisitos obrigatórios antes de habilitar a sincronização real na F7** (registrados na §14): revalidação transacional de conflitos, ciclos em conteúdo remoto e eco de operações recebidas.

**Estado dos riscos:** os quatro riscos HIGH da F0 permanecem `UNVERIFIED`. Firebase Emulator e serviços reais seguem **sem autorização de execução**; `F2-T22` permanece `NOT_RUN`.

**Próxima etapa:** arquitetura e planejamento F3 conduzidos pelo ChatGPT com Superpowers, com aprovação humana antes de qualquer GOAL de execução pelo Codex. Nenhuma implementação F3 foi iniciada.

**Histórico preservado:** as duas branches documentais antigas (`2a2736c`, `cfe4a25`) e todos os commits exclusivos foram mantidos; nenhum arquivo de evidência foi removido.

**Escopo executado:** 16 tarefas do writing-plans F2, matriz F2-T01..T40.
**Evidência publicada:** [comentário inicial](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6480464454), [atualização após a revisão holística](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6481351665) e [fechamento do GOAL corretivo C1–C7](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6482855514).

Este relatório é o único pacote de evidências da F2. Ele descreve o que foi implementado, testado e observado; **não** declara F2 aprovada, homologada ou publicada.

## 1. Resumo executivo

As seis capacidades F2 estão implementadas em `apps/v2/` sobre a F1:

1. **CRUD de editais** com renomear, arquivar e reativar preservando histórico.
2. **Edital principal único por perfil**, com decisão explícita ao arquivar o principal.
3. **Editais arquivados consultáveis**, sem perda de vínculos.
4. **Verticalização** edital → disciplina → assunto (árvore) → aula, com ordem determinística.
5. **Importação JSON** versionada com prévia, limites, quarentena e commit atômico/idempotente.
6. **Mapeamento aula ↔ assunto N:N** dentro da mesma disciplina de edital.

Exclusões deliberadas: nenhum Firebase SDK/CLI/Emulator, nenhum dado real, nenhum deploy, nenhuma alteração na V1/`main`, nenhum GitHub Actions novo, nenhum F3.

## 2. Gates finais executados

| Gate | Comando | Resultado | Evidência |
| --- | --- | --- | --- |
| typecheck | `npm --prefix apps/v2 run typecheck` | PASS (exit 0) | `evidence/2026-10-28-v2-f2-final-typecheck.txt` |
| lint | `npm --prefix apps/v2 run lint` | PASS (exit 0) | `evidence/2026-10-28-v2-f2-final-lint.txt` |
| unit | `npm --prefix apps/v2 run test:unit` | PASS 181/181 em 29 arquivos | `evidence/2026-10-28-v2-f2-c-goal-unit.txt` |
| E2E | `npm --prefix apps/v2 run test:e2e` | PASS 50/50 (20 F1 + 30 F2) | `evidence/2026-10-28-v2-f2-c-goal-e2e.txt` |
| build | `npm --prefix apps/v2 run build` | PASS | `evidence/2026-10-28-v2-f2-c-goal-build.txt` |

Baseline registrada antes de qualquer código F2: 84 unit + 20 E2E + typecheck/lint/build PASS (`evidence/2026-10-28-v2-f2-baseline-*`). A F1 continua verde; a suíte cresceu para 168 unit e 45 E2E.

## 3. Matriz F2-T01..T40

Comando comum: `npm --prefix apps/v2 run test:unit -- <arquivo>` ou `... test:e2e -- <arquivo>`, em `127.0.0.1:18431`, dados sintéticos.

| ID | Teste | Camada | Resultado |
| --- | --- | --- | --- |
| F2-T01 | `create_rename_edital_preserves_ids` + `browser_create_rename_reload_full_content_tree` | unit + E2E | PASS |
| F2-T02 | `subject_can_link_to_two_editais_without_clone` + persistência no commit | unit | PASS (domínio + `LINK_SUBJECT` grava dois vínculos com um subject) |
| F2-T03 | `homonymous_subjects_are_distinct` + índice único por par | unit | PASS (homônimos nunca se fundem; unicidade `(profile,edital,subject)` testada) |
| F2-T04 | `invalid_parent_or_cycle_is_rejected` (+ `parent_from_another_edital_discipline_is_rejected`) | unit | PASS |
| F2-T05 | `lesson_can_have_many_topics_but_no_cross_edital_link` | unit | PASS |
| F2-T06 | `concurrent_sibling_reorder_conflicts` | unit | PASS |
| F2-T07 | `archiving_primary_requires_explicit_replacement_or_none` + `browser_archive_primary_with_explicit_choice` | unit + E2E | PASS |
| F2-T08 | `archive_reactivate_keeps_data` | unit | PASS |
| F2-T09 | `delete_parent_with_dependents_is_blocked_or_quarantined` | unit | PASS |
| F2-T10 | `same_trusted_file_twice_has_one_logical_import` | unit | PASS |
| F2-T11 | `same_name_different_source_is_not_merged` | unit | PASS |
| F2-T12 | `same_source_different_revision_requires_conflict_preview` | unit | PASS (prévia sinaliza e o commit bloqueia qualquer conflito) |
| F2-T13 | `import_abort_has_no_partial_visibility` + `browser_import_is_atomic_and_idempotent_after_reload` | unit + E2E | PASS |
| F2-T14 | `same_operation_id_same_payload_is_noop_divergent_rejected` | unit | PASS |
| F2-T15 | `two_tabs_edit_same_entity_without_lost_update` + `real_ui_two_tabs_editing_the_same_edital_never_lose_an_update` | E2E (2 abas, controles reais) | PASS |
| F2-T16 | `independent_entities_converge_with_fake_port` + `fake_multiclient_contract_does_not_claim_spark_quota` | unit | **SIMULATED** (fake, sem Firestore) |
| F2-T17 | `aborted_content_commit_writes_neither_entity_nor_outbox` + `browser_abort_never_reports_saved_content` | unit + E2E | PASS |
| F2-T18 | `old_backup_with_tombstones_requires_safe_rebaseline` | unit | PASS |
| F2-T19 | `wrong_uid_denied_same_uid_different_local_profile_allowed` | unit | PASS |
| F2-T20 | `eight_themes_three_viewports_and_accessible_controls` + `coarse_pointer_targets_are_at_least_44px` | E2E | PASS (24 capturas 8×3, sem overflow, foco visível e devolvido, alvo ≥44 px, contraste de controle ≥3:1 medido nos 8 temas; detector Impeccable **NOT_RUN**) |
| F2-T21 | regressão F1 completa | unit + E2E | PASS (168 unit, 45 E2E) |
| F2-T22 | emulador CAS/ACK/Rules | — | **NOT_RUN** — `F2_EMULATOR_NOT_AUTHORIZED` |
| F2-T23 | `f1_subject_adoption_keeps_identity_and_never_auto_links` + `f1_subjects_stay_unassigned_until_an_explicit_decision` | unit + E2E | PASS |
| F2-T24 | `v1_edital_fixture_preserves_counts_or_quarantines_unknown` | unit (fixture V1) | PASS |
| F2-T25 | `resolve_remote_conflict_preserves_both_versions_until_choice` + stale/atômico | unit | PASS (payloads preservados; decisão obsoleta recusada; escrita e marcação na mesma transação) |
| F2-T26 | `delete_never_synced_creates_tombstone_and_requires_restore` | unit | PASS |
| F2-T27 | `logout_rebind_does_not_transfer_old_operations` | unit | PASS |
| F2-T28 | `invalid_title_returns_invalid_not_unavailable` | unit | PASS |
| F2-T29 | `upgrade_f1_preserves_subject_operations_outbox` + `upgrade_preserves_exact_operation_and_outbox_records` | unit + E2E | PASS |
| F2-T30 | `concurrent_primary_switch_never_creates_two_primaries` | unit + E2E (2 abas) | PASS |
| F2-T31 | `f1_backup_readback_and_subject_tombstone_collision_rejected` + colisão por tipo | unit | PASS (F1 nunca `SAFE`; colisão subject/edital/vínculo/assunto/aula/tópico) |
| F2-T32 | `canonical_rename_keeps_explicit_contextual_alias` | unit | PASS |
| F2-T33 | `same_central_id_different_namespace_is_not_same_entity` | unit | PASS |
| F2-T34 | `max_accepted_import_quota_abort_rolls_back_every_store` + `max_accepted_import_runs_in_the_browser_within_budget` | unit + E2E | PASS — rollback por quota e carga próxima do teto (1.249 disciplinas, **4.997 criações**) medida no Chromium: **529 ms**; acima do teto é recusado antes de escrever |
| F2-T35 | `stale_preview_after_tab_edit_is_rejected` + `browser_stale_preview_is_rejected_after_another_tab_edit` | unit + E2E | PASS |
| F2-T36 | `wrong_uid_denied_same_uid_different_local_profile_allowed` (dois profileId, mesma biblioteca) | unit | **SIMULATED** |
| F2-T37 | `local_only_command_is_immutable_and_not_sent` | unit | PASS |
| F2-T38 | `sixth_transient_failure_stays_pending_and_auto_retries` + `sixth_failure_survives_reload_and_recovers_automatically` | unit + E2E | PASS |
| F2-T39 | `blocked_upgrade_never_deletes_existing_database` + `browser` equivalente | unit + E2E | PASS |
| F2-T40 | `archive_never_invents_f4_progress_or_erases_future_history` | unit | PASS |

## 4. Inventário de implementação

**Domínio:** `edital.ts` (Edital, EditalDiscipline, alias contextual, ordem canônica), `content.ts` (Assunto/Aula/LessonTopicLink, `parentKey`, ciclo, ordem), `delete.ts` (tombstone, epoch, `SEM_DADOS_DE_EXECUCAO`), `versions.ts` (`LOCAL_DB_VERSION=2`).

**Aplicação:** `content-commands.ts`, `content-service.ts`, `profile-service.ts`, `conflict-service.ts`, `import-types.ts`, `import-service.ts`.

**Plataforma:** `content-migration.ts` (upgrade aditivo + adoção F1), `local-content-repository.ts` (commit único), `local-profile-repository.ts` (perfil, principal, logout, adoção de entrega), `import-commit.ts` (transação única), `sync/delivery-policy.ts`, `sync/retry-policy.ts`, `backup/f2-format.ts`.

**UI:** `EditalManager.tsx`, `ContentTree.tsx`, `ImportPreview.tsx`, `App.tsx` reescrito sobre os tokens/temas da F1.

**Schemas:** stores `editais`, `edital_disciplines`, `assuntos`, `aulas`, `lesson_topic_links`, `tombstones`, `quarantine`, `import_receipts` (todos com `by_profile`), índices `by_edital_subject` e `by_aula_assunto` únicos, `by_scope_order`, `by_parent_order` (sobre `parentKey`), `by_profile_entity`, `by_profile_epoch`.

## 5. Auditoria A-02 (local-first)

- **Uma outbox:** `STORES.outbox` é a única fila; nenhuma fila paralela.
- **Comando imutável:** a adoção de entrega grava apenas `deliveryUid`/`remoteLibraryId`; `operationId`, payload e `baseRevision` não mudam (teste dedicado).
- **Perfil/UID/biblioteca:** `profileId` local ≠ `uid` ≠ `remoteLibraryId`; `canDeliver` exige os três coerentes e estado sincronizável.
- **Fail-closed no envio:** `getEligibleOutbox` devolve `[]` sem perfil consentido; nada sai antes do consentimento.
- **Consentimento:** prova derivada de `previewLink` (perfil + uid + contagem + emissão/expiração) e agora também vinculada à biblioteca.
- **Retry:** base 1 s, teto 5 min, jitter 0–20%; após a 5ª falha transitória a operação continua `PENDING` com cooldown; auth/quota/determinístico entram em cooldown sem hot loop.
- **Conflito/read-back:** `ConflictRecord` guarda os dois payloads, revisões e `deleted`; `lookup` valida `entityId` para impedir ACK de outra entidade.
- **Tombstone/epoch:** store próprio, epoch monotônico em `meta` (ou no maior tombstone), restauração explícita e validação referencial.
- **Limite de documento:** 900.000 bytes conservadores; acima disso a rejeição é explícita, sem truncar.
- **Custo sintético:** 3 × 7.840 = 23.520 escritas/dia > premissa de 20.000; recomendação de seed único + leituras incrementais; `isBillingMeasurement=false`.

## 6. Revisões independentes

**Registro da aprovação (auditoria de preflight).** No HEAD de partida (`f5b114a`) a spec já abria com `F2_SPEC_APPROVED` e o writing-plans com `F2_PLAN_APPROVED_FOR_EXECUTION`; roadmap e handoff já registravam o aceite em conversa. Esses três documentos foram conferidos contra os anexos do GOAL e **não** foram reescritos. Desvio honesto: o comentário consolidador na issue #108 foi publicado **ao final** da execução (`#issuecomment-6480464454`), não antes dela; o registro prévio existia apenas na própria `v2`.

**Lacunas de evidência TDD (registradas, não maquiadas).**

- Tasks 1–8 e 12–14 têm RED capturado antes da implementação (falha por contrato ausente ou asserção).
- Task 9 e Task 15 tiveram o RED provado por **mutação controlada** (o teste falha quando a regra é desativada), não por uma execução pré-implementação.
- Task 11 (parser) foi escrita e implementada em sequência; o teste passou na primeira execução, sem RED anterior. A matriz marca o cenário como PASS porque o comportamento é exercitado (limites, `__proto__`, quarentena, namespace, fingerprint), mas a cronologia TDD dessa tarefa não é a ideal e fica declarada.
- Task 16 não cria RED artificial: a condição é a suíte completa regredir ou não, conforme o próprio GOAL permite.

| Revisão | Escopo | Achados materiais | Situação |
| --- | --- | --- | --- |
| R1 | Task 1 (upgrade IDB) | P1 `by_parent_order` com `parentId: null`; P2/P3 de cobertura, versionchange, UI bloqueada, `onclose` | **corrigidos** em `64d0514` |
| R2 | Tasks 2–5 | P1 archive do principal pelo caminho de conteúdo, mudança de escopo em upsert, `baseRevision` ignorado, repontamento de vínculo; P2 vários | **corrigidos** em `c8fb544` |
| R3 | Task 7 (tombstones) | P1 restore sem integridade referencial, `baseRevision` opcional no delete, revisão do outbox do restore; P2/P3 | **corrigidos** em `5639611` |
| R4 | Tasks 9–10 (UID/retry) | **P0** `canDeliver` não ligado ao envio; P1 biblioteca não vinculada à prova, perfil pausado ressuscitado, falhas não-transientes sem pausa, ACK cruzado; P2/P3 | **corrigidos** em `c646084` |
| R5 | Holística final (integração, importação, backup, UI, matriz) | **5 P1** (ordem do `targetSignature`; reuso de subject por nome; ids colidindo em homônimos; edital arquivado não consultável; prova de consentimento sem vínculo com o `uid`) e 18 P2, incluindo limite de entidades contado a menos e `RangeError` em JSON profundo | **corrigidos** em `f39bba4` + commit de correções P1 desta rodada; P2/P3 restantes listados em §7 |
| R6 | Tasks 12–13 (dedicada) | não retornou a tempo; importação e backup foram cobertos por R5, que gerou os achados acima | limitação registrada |

Correções desta última rodada (R5), com teste focal novo:

- `targetSignatureOf` ordena cada coleção por `id` → segunda importação em perfil populado deixou de ser recusada como “stale” (teste `second_import_in_a_populated_profile_is_not_stale`).
- Importação **não** reutiliza subject por nome; cria sempre um subject próprio e mantém o candidato apenas como ambiguidade visível.
- IDs determinísticos incluem o índice de ocorrência → dois irmãos homônimos não colapsam (teste `homonymous_siblings_get_distinct_deterministic_ids`).
- Edital arquivado fica selecionável e consultável na UI, com aviso de somente leitura (E2E `archived_edital_stays_consultable_after_reload`).
- `assertDeliveryConsent` exige `proof.uid === uid` e `proof.remoteLibraryId === remoteLibraryId` (teste `consent_for_one_uid_cannot_bind_another_uid`).
- Commit recusa prévia com qualquer conflito (`SOURCE_REVISION_DIVERGED`, `EDITAL_ARCHIVED`, `TOO_MANY_ENTITIES`); o teto passa a contar `creates` reais.
- `hasUnsafeKey` virou iterativo com limite de nós (JSON hostil profundo não derruba mais a prévia).
- `recordCount` do backup F2 é conferido; `--muted` inexistente corrigido para `--text-muted`.

Cada correção foi seguida de reexecução do teste focal e da suíte completa.

## 7. Limitações e riscos residuais

> **Como ler esta seção:** itens marcados **(histórico)** vêm da F0/V1 e continuam rastreados, mas **não** são pendências abertas da F2. Os demais são limites atuais desta fase, com a fase de destino indicada.

- **(histórico)** Quatro riscos HIGH da F0 continuam `UNVERIFIED`. Nenhum teste desta fase os mitiga.
- **F2-T22 NOT_RUN:** nenhum Firebase Emulator/SDK/Rules foi instalado ou executado. `F1`/Firestore/Google Auth reais não foram homologados.
- **F2-T16 e F2-T36 são SIMULATED:** provam o contrato do fake, não convergência entre dispositivos reais.
- **Retomada automática** é uma API com relógio injetado (`getEligibleOutbox`); não existe timer/background garantido nesta fase (pertence à F4/F7).
- **F2-T34** foi exercitado com ~360 entidades, não com o teto de 5.000; o limite máximo aceito ainda precisa de medição em dispositivo modesto antes de produção.
- **Impeccable 3.9.1** não foi executado como ferramenta; a evidência visual é composta por 24 capturas Chromium (8 temas × 3 viewports), verificação de overflow, foco visível e alvo de 44 px em coarse pointer. Detector automático de contraste/a11y: `NOT_RUN`.
- As 24 capturas ficam em `apps/v2/test-results/impeccable/` (diretório ignorado pelo Git) e estão inventariadas com hash em `evidence/2026-10-28-v2-f2-visual-manifest.md`; uma delas (`neon-mobile.png`) foi inspecionada visualmente nesta execução.
- **(histórico)** 107 FAIL E2E da V1 permanecem baseline, sem alteração.
- Vínculos aula↔assunto desfeitos usam exclusão física (com operação `delete` na outbox), sem tombstone; backups antigos podem reintroduzir o vínculo. Registrado como decisão de F2, a revisar na F7.
- Três motores de commit coexistem (subject F1 congelado, conteúdo F2, perfil); o de arquivamento já foi unificado no de conteúdo. Unificação completa fica para revisão arquitetural posterior.

**P2/P3 da revisão holística que permanecem abertos (deliberadamente não corrigidos nesta execução):**

- Reimportar a mesma origem com revisão divergente agora **bloqueia** em vez de reconciliar; não existe fluxo de “criar nova versão” nem reconciliação por caminho.
- Replay por recibo devolve sucesso mesmo se o usuário apagou entidades depois do primeiro import; o recibo não guarda IDs para detectar divergência.
- Importação não consulta `tombstones` nem persiste `quarantine`; após restauração de backup (F7) um ID tombstoned poderia ser recriado.
- A UI não envia `baseRevision` nas mutações (CAS existe no repositório e no harness, não no produto); duas abas com edição real podem sobrescrever.
- Escritas de conteúdo/importação/perfil não publicam no `BroadcastChannel`; a segunda aba fica com estado velho até reload.
- Com `BLOCKED_UPGRADE`, só o formulário de disciplina fica travado; os demais botões de escrita seguem ativos.
- Formulários F2 não têm estado de “enviando” (duplo clique cria dois registros) e o select de substituto de arquivamento vaza entre editais.
- Nomes acessíveis repetem quando há títulos homônimos; foco cai no `body` ao abrir/fechar formulário.
- Bordas de controle têm contraste ~1,2–1,4:1 nos oito temas (texto está acima de 7:1); contraste AA dos controles segue `NOT_RUN`.
- Outbox sem `sequence` causal preenchida; entrega depende da ordem do índice.
- `flushPending` não exige consentimento por si; a proteção está em `getEligibleOutbox`.
- `ACCEPT_REMOTE` grava/apaga direto no store, sem tombstone nem validação de dependentes.
- Backup F2 não inclui `import_receipts`, `quarantine`, `operations` ou `outbox`, e `deletionHistoryComplete` assume `true` quando omitido.
- Namespace de importação é a constante `local`; dois arquivos de fontes distintas com o mesmo `centralId` colidem.

## 8. Higiene Git

- `main`/`origin/main`: `9046cfa` antes e depois; nenhuma alteração.
- `v2`: partiu de `f5b114a`; commits desta execução listados em `git log --oneline f5b114a..HEAD`.
- Read-back remoto após o push final: `origin/v2` = HEAD local desta rodada, `origin/main = 9046cfa` (ver comentário mais recente na issue #108).
- Worktrees: apenas os dois já existentes (`estudo-organizado` em `main`, `v2-f0-audit/estudo-organizado` em `v2`).
- Nenhum PR aberto, nenhum stash, nenhuma branch nova, nenhum Actions novo.
- Push previsto apenas para `origin/v2`; `.github/workflows/auto-cache-bump.yml` dispara somente em `main`.

## 9. Próxima ação humana

Revisar este pacote e decidir o aceite da F2. A F2 **não** está aprovada, publicada ou homologada por este relatório; o gate permanece humano. F3 não foi iniciada.

## 10. GOAL corretivo C1–C7 (2026-10-28, após revisão do ChatGPT)

| Item | Problema | Alteração | Prova |
| --- | --- | --- | --- |
| C1 | UI não enviava `baseRevision`; o E2E injetava a revisão pelo harness | `baseRevision` em renomear/arquivar/principal e em `StudySubject` (opcional, retrocompatível); a base é capturada ao abrir o editor | `f2-two-tabs-ui.spec.ts` (controles reais): aba obsoleta recebe `CONFLICT`, mantém o texto e não sobrescreve |
| C2 | Formulários limpavam draft em `INVALID`/`CONFLICT`/`FAILED`; só a disciplina era travada em `BLOCKED_UPGRADE` | Callbacks devolvem sucesso real, draft limpo só em `LOCAL_COMMITTED`, estado `busy`, trava em bloqueio/arquivado | `f2-form-integrity.spec.ts` (quota preserva texto, retry funciona, arquivado é read-only) |
| C3 | Recibo devolvia sucesso após exclusão; importação não olhava tombstones; quarentena não persistia; namespace fixo | Divergência vira `IMPORT_ALREADY_APPLIED_BUT_DIVERGED`; tombstone bloqueia recriação; quarentena e `entityIds` no recibo; namespace escolhido na UI | `f2-import-commit.test.ts` (9), `f2-import-ui`/`f2-import-atomic` |
| C4 | Unlink apagava fisicamente; `ACCEPT_REMOTE` de tombstone não passava pelo repositório | `UNLINK_LESSON_TOPIC` exige `baseRevision` e grava tombstone/epoch; deleção remota delega ao `SOFT_DELETE` | `f2-delete.test.ts` (7) |
| C5 | `deletionHistoryComplete ?? true` permitia `SAFE` sem histórico | Completude declarada, epoch sem tombstone = `REBASELINE`, `currentEpoch` validado, colisão por tipo, forma de payload exigida, tokens removidos | `f2-backup.test.ts` (12) |
| C6 | Outbox sem ordem causal; gate de consentimento só no produtor | `sequence` monotônica por perfil e ordenação na entrega; `flushPending.canSend` recusa operação fora do gate; notificação entre abas após commit | `f2-retry.test.ts` (9) + E2E de retry |
| C7 | Contraste de controle abaixo de 3:1; foco e nomes repetidos | `--control-border` por tema (≥3:1 medido), foco devolvido ao gatilho, `aria-label` com título+índice, alvo 44 px | `f2-a11y.spec.ts` (8 temas medidos), `f2-import-max.spec.ts` (carga máxima 414 ms) |

**Limitações que permanecem e sua fase de destino:** reconciliação de revisão importada (F7), recibo fora do backup F2 (F7), `ACCEPT_REMOTE` de payload não deletado fora do repositório (revisão arquitetural), três motores de commit (F3/F7), staging de importação (não autorizado), Firebase/Rules/quota reais e multi-dispositivo físico (**NOT_RUN**, F7), quatro riscos HIGH da F0 (**UNVERIFIED**), detector Impeccable (**NOT_RUN**), e a medição de 414 ms refere-se a desktop, não a aparelho modesto.

## 11. Revisão do GOAL corretivo — limitação e auto-revisão estruturada

A revisão independente do diff corretivo (`774ddc3..8ca8b60`) **não pôde ser executada**: o ambiente recusou a criação de novo subagente por limite de threads (`agent thread limit reached`). Conforme o GOAL, isso fica registrado como limitação; **não há atestado de revisão independente** desta rodada. As rodadas R1–R5 valem apenas para os commits que revisaram.

Em substituição, foi feita auto-revisão estruturada do diff corretivo:

| Verificação | Resultado |
| --- | --- |
| `baseRevision` capturada ao abrir pode prender o usuário? | Não: o conflito mantém o formulário aberto com o texto; cancelar e reabrir recarrega a base atual. |
| Conflito no rename de `StudySubject` preserva o texto? | Sim: a exceção sobe ao App, que avisa e não fecha o editor. |
| Chamador de `UNLINK_LESSON_TOPIC` sem `baseRevision`? | Nenhum: `rg` mostra só `App.tsx` (corrigido) e testes. |
| `sequence` duplica sob concorrência? | Não: leitura e escrita do contador no mesmo `readwrite` de `meta`; import grava o valor final. |
| Operações F1 sem `sequence` (0) invertem create/delete? | Não na prática: são as mais antigas e o desempate é por `operationId`. |
| Caminho real envia sem gate? | Não: `getEligibleOutbox` filtra por `canDeliver`; `flushPending.canSend` é segunda barreira, não obrigatória (residual). |
| Backup F1 continua legível e nunca `SAFE`? | Sim, com teste dedicado. |
| Snapshot legítimo vira `INVALID` pela regra de epoch? | Backup pós-restore passa a exigir rebaseline: conservador por escolha. |
| Import grava quarentena e recibo na mesma transação? | Sim; `receipt.entityIds` só lista o que foi criado. |
| Dois perfis com o mesmo arquivo colidem? | Não: `operationId` inclui `profileId`. |
| `ACCEPT_REMOTE` marca `RESOLVED` sem escrever? | Não; falha posterior deixa `OPEN`. A marcação não é atômica com a escrita (residual). |
| `aria-label` novos quebraram nomes? | Não: E2E verde após renomear gatilho e submit de arquivamento. |
| Algum teste enfraquecido? | Asserções ajustadas ao novo contrato; nenhuma removida para obter verde. |

**Residual de maior risco (corrigido depois, ver §12):** naquele momento a marcação de conflito resolvido não era transacional com a escrita de `ACCEPT_REMOTE`.

## 12. GOAL final de fechamento (2026-10-29)

Correções sobre o HEAD `0793b16`, sem reabrir C1–C7.

| Item | Correção | Prova |
| --- | --- | --- |
| P1 conflitos | `resolveConflict` compara a revisão local atual com a do `localPayload` e recusa decisão obsoleta (`RESOLUTION_STALE`), mantendo os dois payloads e o conflito `OPEN`. `KEEP_LOCAL` grava conteúdo + `RESOLVED` na **mesma** transação (`CommitOptions.markConflict`). `ACCEPT_REMOTE` de tombstone delega ao `SOFT_DELETE` (nunca cria upsert outbound) e `ACCEPT_REMOTE` de payload valida tombstones, escopo, pais e vínculos antes do `put`, também atômico com a marcação. Replay da mesma decisão é idempotente; decisão divergente falha. | `f2-conflicts.test.ts` — 11 testes: stale, replay idempotente, decisão divergente, exclusão remota sem upsert, falha no meio mantendo `OPEN`, referência órfã recusada |
| P1 gate de envio | `FlushOptions.canSend` é obrigatório e `flushPending` falha fechado: sem autorização explícita nada alcança `remote.apply` (vai para `blocked`). `getEligibleOutbox` permanece como filtro anterior; o harness monta a autorização real com `canDeliver` + perfil. | `f2-retry`/`f2-conflicts` com chamada sem gate + 50 E2E verdes |
| P2 recibos | O recibo guarda `entityRevisions`; o replay só é no-op se nenhuma entidade importada foi apagada **ou editada** depois. Divergência devolve `IMPORT_ALREADY_APPLIED_BUT_DIVERGED` com `missing`/`changed` e preserva a edição do usuário. | `f2-import-commit.test.ts` — 10 testes (edição local, exclusão, replay idêntico, duas importações) |
| Desempenho | Carga sintética de **1.249 disciplinas (~4.997 criações)**, próxima do teto, medida no Chromium: **529 ms**, recibo único; acima do teto segue recusado antes de escrever. | `f2-import-max.spec.ts` |

Gates desta rodada (logs completos em `evidence/2026-10-29-v2-f2-final-goal-*.txt`): typecheck PASS · lint PASS · unit **188/188** · E2E **50/50** · build PASS.

Revisão independente desta rodada: **não executada** (limite de threads do ambiente, registrado em §11); os quatro P1/P2 acima foram cobertos por testes focados e auto-revisão.

**Documentação corrigida:** a seção de riscos passou a separar itens **(histórico)** (F0/V1) das pendências atuais; o corpo da issue #108 foi atualizado de “F2 ainda não comprovada” para o estado real (`publicada na branch v2 (53e15fb)`, gate `F2_READY_FOR_HUMAN_REVIEW`); o texto publicado está preservado em `evidence/issue-108-body.md`.

## 13. Inventário das branches documentais antigas (preservadas)

Levantamento somente leitura, sem exclusão de branches ou commits.

| Branch | Tip | Commits à frente de `main` | Não ancestrais da `v2` | Situação | Ação |
| --- | --- | --- | --- | --- | --- |
| `docs/superpowers-estudo-organizado-v2-design` | `2a2736c` | 2 | 2 | Histórica: propõe a spec mestra e registra o G1; superada pelas revisões da spec na `v2` | Preservar — nenhuma exclusão |
| `docs/superpowers-estudo-organizado-v2-f0-plan` | `cfe4a25` | 8 (inclui os 2 acima) | 8 | Histórica: planeja a F0 e registra G2; a `v2` traz revisões posteriores do GOAL F0 e o `ROADMAP.md`, que a branch não possui | Preservar — nenhuma exclusão |

Verificação executada: `git rev-list --count origin/v2..<branch>` retorna 2 e 8; `git rev-list --count <branch>..origin/v2` retorna 254 nas duas. O conteúdo documental desses commits não é fonte corrente — a `v2` tem versões revisadas (o GOAL F0 difere em 28 linhas; o `ROADMAP.md` tem 363 linhas a mais). Nenhum arquivo exclusivo ficou órfão.

A `main` permaneceu em `9046cfa` e nenhum PR foi aberto durante o levantamento.

## 14. Lacunas a fechar antes da sincronização real (F7)

Itens técnicos conhecidos, independentes de qualquer decisão de aceite, que precisam de correção e teste antes de ligar sincronização real entre dispositivos.

1. **Revalidação transacional de conflitos.** A resolução usa CAS da revisão atual e grava conteúdo + marcação na mesma transação de IndexedDB, mas a leitura que decide a resolução ocorre antes de abrir a transação de escrita. Um cenário multi-aba que altere a entidade nessa janela não tem teste dedicado, e um adaptador remoto real precisará revalidar também o lado remoto.
2. **Ciclos em conteúdo remoto.** `validateAssuntoTree`/`assertAssuntoParent` protegem a escrita local; o caminho de adoção remota (`ACCEPT_REMOTE`) valida existência e escopo do pai imediato, não a árvore inteira nem ciclos vindos de um payload remoto.
3. **Eco de operações recebidas.** Conteúdo adotado do remoto é gravado sem outbox no caminho de atualização, mas operações já pendentes para a mesma entidade podem ser reenviadas depois do `ACCEPT_REMOTE`; falta teste que prove supressão/coalescência desse reenvio.

Estado atual: sem emulador autorizado e sem Firebase real, esses três itens não podem ser provados nesta fase — permanecem abertos para F7.





