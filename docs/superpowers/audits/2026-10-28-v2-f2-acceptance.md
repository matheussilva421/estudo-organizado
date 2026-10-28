# Estudo Organizado V2 — F2: relatório de aceite para revisão humana

**Data:** 2026-10-28
**Branch:** `v2` (somente local; `main` intocada)
**Gate proposto:** `F2_READY_FOR_HUMAN_REVIEW`
**Escopo executado:** 16 tarefas do writing-plans F2, matriz F2-T01..T40.
**Evidência publicada:** [comentário na issue #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6480464454).

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
| unit | `npm --prefix apps/v2 run test:unit` | PASS 162/162 em 29 arquivos | `evidence/2026-10-28-v2-f2-final-unit.txt` |
| E2E | `npm --prefix apps/v2 run test:e2e` | PASS 44/44 (20 F1 + 24 F2) | `evidence/2026-10-28-v2-f2-final-e2e.txt` |
| build | `npm --prefix apps/v2 run build` | PASS 291,12 kB / 87,00 kB gzip | `evidence/2026-10-28-v2-f2-final-build.txt` |

Baseline registrada antes de qualquer código F2: 84 unit + 20 E2E + typecheck/lint/build PASS (`evidence/2026-10-28-v2-f2-baseline-*`). A F1 continua verde; a suíte cresceu para 162 unit e 44 E2E.

## 3. Matriz F2-T01..T40

Comando comum: `npm --prefix apps/v2 run test:unit -- <arquivo>` ou `... test:e2e -- <arquivo>`, em `127.0.0.1:18431`, dados sintéticos.

| ID | Teste | Camada | Resultado |
| --- | --- | --- | --- |
| F2-T01 | `create_rename_edital_preserves_ids` + `browser_create_rename_reload_full_content_tree` | unit + E2E | PASS |
| F2-T02 | `subject_can_link_to_two_editais_without_clone` | unit | PASS |
| F2-T03 | `homonymous_subjects_are_distinct` | unit | PASS |
| F2-T04 | `invalid_parent_or_cycle_is_rejected` (+ `parent_from_another_edital_discipline_is_rejected`) | unit | PASS |
| F2-T05 | `lesson_can_have_many_topics_but_no_cross_edital_link` | unit | PASS |
| F2-T06 | `concurrent_sibling_reorder_conflicts` | unit | PASS |
| F2-T07 | `archiving_primary_requires_explicit_replacement_or_none` + `browser_archive_primary_with_explicit_choice` | unit + E2E | PASS |
| F2-T08 | `archive_reactivate_keeps_data` | unit | PASS |
| F2-T09 | `delete_parent_with_dependents_is_blocked_or_quarantined` | unit | PASS |
| F2-T10 | `same_trusted_file_twice_has_one_logical_import` | unit | PASS |
| F2-T11 | `same_name_different_source_is_not_merged` | unit | PASS |
| F2-T12 | `same_source_different_revision_requires_conflict_preview` | unit | PASS |
| F2-T13 | `import_abort_has_no_partial_visibility` + `browser_import_is_atomic_and_idempotent_after_reload` | unit + E2E | PASS |
| F2-T14 | `same_operation_id_same_payload_is_noop_divergent_rejected` | unit | PASS |
| F2-T15 | `two_tabs_edit_same_entity_without_lost_update` | E2E (2 abas) | PASS |
| F2-T16 | `independent_entities_converge_with_fake_port` + `fake_multiclient_contract_does_not_claim_spark_quota` | unit | **SIMULATED** (fake, sem Firestore) |
| F2-T17 | `aborted_content_commit_writes_neither_entity_nor_outbox` + `browser_abort_never_reports_saved_content` | unit + E2E | PASS |
| F2-T18 | `old_backup_with_tombstones_requires_safe_rebaseline` | unit | PASS |
| F2-T19 | `wrong_uid_denied_same_uid_different_local_profile_allowed` | unit | PASS |
| F2-T20 | `eight_themes_three_viewports_and_accessible_controls` + `coarse_pointer_targets_are_at_least_44px` | E2E | PASS (24 capturas 8×3, sem overflow, foco visível, alvo ≥44 px) |
| F2-T21 | regressão F1 completa | unit + E2E | PASS (162 unit, 44 E2E) |
| F2-T22 | emulador CAS/ACK/Rules | — | **NOT_RUN** — `F2_EMULATOR_NOT_AUTHORIZED` |
| F2-T23 | `f1_subject_adoption_keeps_identity_and_never_auto_links` + `f1_subjects_stay_unassigned_until_an_explicit_decision` | unit + E2E | PASS |
| F2-T24 | `v1_edital_fixture_preserves_counts_or_quarantines_unknown` | unit (fixture V1) | PASS |
| F2-T25 | `resolve_remote_conflict_preserves_both_versions_until_choice` | unit | PASS |
| F2-T26 | `delete_never_synced_creates_tombstone_and_requires_restore` | unit | PASS |
| F2-T27 | `logout_rebind_does_not_transfer_old_operations` | unit | PASS |
| F2-T28 | `invalid_title_returns_invalid_not_unavailable` | unit | PASS |
| F2-T29 | `upgrade_f1_preserves_subject_operations_outbox` + `upgrade_preserves_exact_operation_and_outbox_records` | unit + E2E | PASS |
| F2-T30 | `concurrent_primary_switch_never_creates_two_primaries` | unit + E2E (2 abas) | PASS |
| F2-T31 | `f1_backup_readback_and_subject_tombstone_collision_rejected` | unit | PASS |
| F2-T32 | `canonical_rename_keeps_explicit_contextual_alias` | unit | PASS |
| F2-T33 | `same_central_id_different_namespace_is_not_same_entity` | unit | PASS |
| F2-T34 | `max_accepted_import_quota_abort_rolls_back_every_store` | unit | PASS com lote de ~360 entidades (não os 5.000 máximos) |
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
| R5 | Task 12/13 + holística final | revisão final solicitada; ver §9 | em andamento / pendente |

Cada correção foi seguida de reexecução do teste focal e da suíte completa.

## 7. Limitações e riscos residuais

- **Quatro riscos HIGH da F0 continuam `UNVERIFIED`.** Nenhum teste desta fase os mitiga.
- **F2-T22 NOT_RUN:** nenhum Firebase Emulator/SDK/Rules foi instalado ou executado. `F1`/Firestore/Google Auth reais não foram homologados.
- **F2-T16 e F2-T36 são SIMULATED:** provam o contrato do fake, não convergência entre dispositivos reais.
- **Retomada automática** é uma API com relógio injetado (`getEligibleOutbox`); não existe timer/background garantido nesta fase (pertence à F4/F7).
- **F2-T34** foi exercitado com ~360 entidades, não com o teto de 5.000; o limite máximo aceito ainda precisa de medição em dispositivo modesto antes de produção.
- **Impeccable 3.9.1** não foi executado como ferramenta; a evidência visual é composta por 24 capturas Chromium (8 temas × 3 viewports), verificação de overflow, foco visível e alvo de 44 px em coarse pointer. Detector automático de contraste/a11y: `NOT_RUN`.
- As 24 capturas ficam em `apps/v2/test-results/impeccable/` (diretório ignorado pelo Git) e estão inventariadas com hash em `evidence/2026-10-28-v2-f2-visual-manifest.md`; uma delas (`neon-mobile.png`) foi inspecionada visualmente nesta execução.
- **107 FAIL E2E da V1** permanecem baseline histórico, sem alteração.
- Vínculos aula↔assunto desfeitos usam exclusão física (com operação `delete` na outbox), sem tombstone; backups antigos podem reintroduzir o vínculo. Registrado como decisão de F2, a revisar na F7.
- Três motores de commit coexistem (subject F1 congelado, conteúdo F2, perfil); o de arquivamento já foi unificado no de conteúdo. Unificação completa fica para revisão arquitetural posterior.

## 8. Higiene Git

- `main`/`origin/main`: `9046cfa` antes e depois; nenhuma alteração.
- `v2`: partiu de `f5b114a`; commits desta execução listados em `git log --oneline f5b114a..HEAD`.
- Read-back remoto após o push: `origin/v2 = cca624b`, `origin/main = 9046cfa`.
- Worktrees: apenas os dois já existentes (`estudo-organizado` em `main`, `v2-f0-audit/estudo-organizado` em `v2`).
- Nenhum PR aberto, nenhum stash, nenhuma branch nova, nenhum Actions novo.
- Push previsto apenas para `origin/v2`; `.github/workflows/auto-cache-bump.yml` dispara somente em `main`.

## 9. Próxima ação humana

Revisar este pacote e decidir o aceite da F2. A F2 **não** está aprovada, publicada ou homologada por este relatório; o gate permanece humano. F3 não foi iniciada.

