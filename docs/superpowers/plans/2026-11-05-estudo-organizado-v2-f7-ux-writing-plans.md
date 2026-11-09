# Estudo Organizado V2 — F7-UX Implementation Plan (Superpowers Writing Plans)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. **Não executar** as checkboxes antes da autorização expressa de execução/GOAL. O presente documento é o plano para revisão, não a ordem de implementar.

**Goal:** Implementar e validar o redesign integral F7-UX da V2, fiel às decisões aprovadas D01–D71, mantendo consistência de dados, offline-first, acessibilidade e V1 intacta; disponibilização para avaliação depende de gates específicos.

**Architecture:** Evolução incremental do `apps/v2`, preservando os serviços de domínio F2–F5, IndexedDB e contratos funcionais F7. Reutilizar tokens, Shell, roteamento e workspaces F6, acrescentando interfaces orientadas a evidência e componentes somente quando compartilhados por duas ou mais telas. F7-UX é um aditivo obrigatório de UX/qualidade à F7, **não uma segunda implementação** de Auth/Firestore/Worker/KV, nem F8/cutover.

**Tech Stack:** React 19, TypeScript 6, Vite 8, IndexedDB, Vitest 5, Playwright, CSS tokens existentes; dependências e versões existentes do `apps/v2/package.json`. Evitar novas libs pesadas e novos serviços. Preservar os oito temas e fontes locais.

**Spec aprovada (fonte):** `docs/superpowers/specs/2026-11-05-estudo-organizado-v2-f7-ux-design.md` — **F7_UX_SPEC_APPROVED**, em 05/11/2026. SHA-256 do texto aprovado originalmente (antes de publicar): `4babe27132ce2b5096ee09ca07f05c83e491ddeaa4e1cfc168e24945b04d2c7a`.

**Transcrição primária:** `docs/superpowers/v2/transcripts/2026-11-05-f7-ux-conversa-completa.md`; cópia do arquivo fornecido, SHA-256 `687f02d9c599e001774472fc9d7999c2b31d4fd994bd84bb15b70f5f5fe41864`. **A transcrição publicada é histórica e pública porque o repositório é público; não duplicá-la em outros arquivos.**

**Plan path:** `docs/superpowers/plans/2026-11-05-estudo-organizado-v2-f7-ux-writing-plans.md`.

**Estado:** `F7_UX_PLAN_PROPOSED_AWAITING_APPROVAL` — especificação aprovada, este plano preparado para aceite, **GOAL e implementação ainda não autorizados**. A publicação documental na `v2` tem autorização específica do proprietário, distinta da autorização para alterar código, serviços remotos, staging, V1 ou `main`.

**Baseline remoto verificado em 05/11/2026 (sujeito a nova leitura):** `v2@6c70fef3eae20dd212dba9686eb1eaceb10a6292`; `main@9046cfa2283cd293b38df9d52fabfcd5de9ac67c`; zero PRs abertos. A F7 funcional foi relatada localmente com `F7_LOCAL_CODE_COMPLETE / F7_BLOCKED_G-EXT_G-STAGING`, 31 commits não publicados; esse relato **não equivale a evidência Git revisada**. O preflight de execução deverá reconciliar a árvore e os commits locais antes de editar qualquer código.

## Global Constraints

1. **Foco estrito:** implementar a spec F7-UX aprovada; não rediscutir D01–D71 nem reduzir escolhas aprovadas sem evidência nova/gate humano. D30 integra Análises, e sua posição histórica não muda. D35 (Busca) é direção aprovada, mas esforço subordinado aos módulos acadêmicos conforme preferência expressa do usuário.
2. **Autorizações:** este plano não concede G-EXEC, G-EXT, G-STAGING, G-F7 ou F8. Usar dados sintéticos e simuladores nos testes de UX quando serviços reais não estiverem homologados. Não reportar integração remota real, ACK, convergência ou backup restaurável por simulação.
3. **Proteção:** nunca sobrescrever V1, `main`, dados acadêmicos, tombstones, epochs, outbox, rascunhos, intervalos ou histórico causal. Excluir/limpar/restaurar/trocar conta apenas por contratos próprios e consentimento explícito. Sem force push, `reset --hard`, reset de banco, PR ou branch nova por rotina, GitHub Actions/CI, custos ou serviços novos.
4. **Estado Git:** se a execução for autorizada, começar com inventário de `HEAD`, `git status`, `git branch -vv`, `git remote -v`, `git worktree list`, `git stash list`, `git log --left-right`, PRs, commits exclusivos e artefatos locais. Verificar documentação e trabalho F7 local não publicado; proteger commits de F5 preservados e evidências F4. Trabalhar na `v2` somente quando o estado permitir e houver autorização; `main-first` não significa modificar `main` produtiva sem gate.
5. **Fonte da verdade:** os módulos de domínio detêm os fatos; Home, Busca, Atenção, Análises e os widgets apenas consultam/derivam. Leitura não altera dados. `LOCAL_COMMITTED` ≠ ACK ≠ convergência ≠ backup verificado. Vínculo de sessão não equivale a bloco cumprido. Nenhuma métrica fabricada.
6. **Segurança e privacidade:** não incluir tokens ou dados identificáveis em rotas, relatórios, exemplos e screenshots. Não executar fórmulas como JavaScript; parser/AST de operações autorizadas apenas. Importação/CSV com validação e prevenção de injeção.
7. **Acessibilidade/performance:** teclado, leitores de tela, foco, modais, contraste oito temas, movimento reduzido; desktop, tablet e celular (320/390/720/721/1023/1024 px, 200% zoom e janela baixa). Preferência de densidade não reduz alvos de toque nem oculta avisos críticos. Suporte offline, sem integração paga.
8. **Testes locais:** comandos em `apps/v2`: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:e2e -- <arquivo>`; confirmar funcionamento do `npm`/ferramentas no preflight. Nenhuma suíte foi executada na elaboração documental.
9. **Estratégia de commits:** commits pequenos por **conjunto coerente de tarefas validadas**, não um PR/branch por tarefa. Relatório de artefatos e pacotes ao fim do GOAL futuro; os testes pertencem à mesma revisão do código, sem ciclo infinito.
10. **Governança:** F7 T01–T27 permanecem numeradas e com documentação original intacta. O redesign deve ser encaixado depois das funcionalidades locais relevantes e antes do gate de avaliação, respeitando G-EXT e G-STAGING. Não sobrepor código não publicado do Codex.

## Review Focus — cinco entradas adversariais prioritárias

| Entrada / falha provável | Comportamento necessário | Tarefa e teste de prova |
|---|---|---|
| Sessão `COMPLETED` vinculada ao bloco, sem conciliação | Home/Plano não afirmam cumprimento nem escondem atraso por vínculo isolado | UX-03: `f7-ux-plan-execution-truth.test.ts` |
| Mudança de perfil ou registro arquivado durante drill-down | Recusa/consulta protegida; sem substituição por título ou vazamento | UX-04: `f7-ux-context-routes.test.ts` |
| Sessão concluída depois de calcular analytics, com alteração de alocações/questões | Cache invalida e KPIs/tabela/gráfico coincidem por escopo | UX-22: `f7-ux-analytics-provenance.test.ts` |
| Gravação local OK, envio pendente, ACK incerto e backup F2 parcial | UI não mistura persistência, entrega, convergência nem recuperabilidade | UX-02 e UX-26: `f7-ux-evidence-status.test.ts` e `f7-ux-backup-restore.spec.ts` |
| Navegação durante rascunho/sessão ativa ou `BLOCKED_UPGRADE` | Bloquear perda, preservar estado, oferecer ação não destrutiva | UX-05 e UX-27: `f7-ux-draft-navigation.spec.ts` e `f7-ux-settings-safety.spec.ts` |

## Estrutura de arquivos / dependências

Arquivos centrais existentes: `src/presentation/App.tsx`, `AppNav.tsx`, `routing.ts`, `use-hash-route.ts`, `use-focus-scroll.ts`, `draft-guard.ts`, `ui-state.ts`, `tokens.css`, `styles.css`; `views/HomeView.tsx`, `SearchView.tsx`, `AttentionView.tsx`, `AnalyticsView.tsx`, `SettingsView.tsx`; `components/ContentTree.tsx`, `EditalManager.tsx`, `PlanningCalendar.tsx`, `PlanningWizard.tsx`, `PlanningConflicts.tsx`; `PlanningWorkspace.tsx`, `SessionWorkspace.tsx`, `ReviewWorkspace.tsx`; `application/experience-queries.ts`, `experience-cache.ts`, `sync-policy.ts`, serviços/queries de Planejamento, Sessões e Revisões; `platform/indexeddb.ts`, `platform/backup/**`.

Novos arquivos abaixo são **limites propostos**, a serem criados apenas se a funcionalidade exigir. Não duplicar abstrações equivalentes encontradas no preflight. Todos os novos artefatos ficam em `apps/v2/**` e devem ter escopo claro: `application/widget-queries.ts` (consultas), `domain/widget-expression.ts` (fórmulas seguras), `presentation/dashboard-layout.ts` (estado/layout por viewport), `presentation/ux-evidence.ts` (normalização somente para apresentação), `application/analytics-metrics.ts` (metodologia/qualidade) e `presentation/components/{WidgetEditor,ContextInspector,SafeActionDialog}.tsx` (componentes quando realmente reutilizados). **Não criar** outra base canônica, outra outbox ou segundo motor de planejamento.

**Ordem:** preflight → invariantes/roteamento → Shell/centro de atenção → Home/widgets → módulos acadêmicos → Análises → Configurações → design system → E2E/revisão → aceite. Cada tarefa abaixo inclui um ciclo TDD autônomo. Evitar realizar a T25 da F7 funcional novamente; aproveitar o trabalho de UI já presente e completar suas evidências.

---
## Bloco I — Preflight e contratos transversais

### Task UX-01 — Preflight, inventário e baseline de UX

**Rastreabilidade:** T-01/T-04; D01–D71.

**Files:**
- Modify/inspect: `apps/v2/docs/superpowers/v2/ROADMAP.md, apps/v2/src/presentation/{App.tsx,styles.css}, docs/superpowers/audits/2026-11-04-v2-f6-acceptance.md`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Nenhum artefato novo obrigatório`.
- Test: `apps/v2/tests/e2e/f7-ux-baseline.spec.ts`.

**Interfaces:** Sem API nova: inventário verificável e matriz de diferenças entre F6, F7 local e F7-UX aprovado.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `should_preserve_original_routes_and_drafts`: as nove rotas históricas e `overview` continuam acessíveis; nenhuma ação visual em leitura modifica registros. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-baseline.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-baseline.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Registrar screenshots e comportamento por viewport/tema com dados sintéticos; diagnosticar versões locais e remotas; classificar mudanças F7 existentes antes de adaptar código. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** Capturas atuais em desktop/tablet/mobile; baseline real dos fluxos F2–F6; não modificar produção. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. G0: interromper se houver arquivo/branch/commit único sem proteção ou conflito com a F7 não publicada.

### Task UX-02 — Contratos de estado e feedback por evidência

**Rastreabilidade:** T-03; D24–D25/D69–D70.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/App.tsx; src/presentation/components/SyncStatus.tsx; src/presentation/views/{HomeView,SettingsView,AttentionView}.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/src/presentation/ux-evidence.ts (somente se não houver equivalente)`.
- Test: `apps/v2/tests/unit/f7-ux-evidence-status.test.ts`.

**Interfaces:** `describeUxEvidence(input: LocalCommit|Outbox|SyncHealth|BackupState): UiEvidence[]` retorna {kind, scope, proof, severity, action?} sem mutar entrada.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `local_commit_is_not_ack`; `pending_is_not_failed`; `ack_is_not_converged`; `safe_backup_preview_is_not_restore`; `stale_is_not_empty`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-evidence-status.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-evidence-status.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Codificar tradução de estados já existentes (não reinventar enums de domínio); mensagens locais/persistentes/guiadas; nunca disparar escrita pela renderização. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: diferentes telas exibem a mesma evidência com linguagem de escopo apropriada. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não criar um painel global de operações diferente da Central de Atenção.

### Task UX-03 — Semântica cumprido vs. vinculado e indicador de saúde local

**Rastreabilidade:** T-01/T-03/P-07; D12/D52/D61/D69.

**Files:**
- Modify/inspect: `apps/v2/src/application/experience-queries.ts; src/presentation/App.tsx; src/presentation/views/HomeView.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Nenhum arquivo de domínio novo`.
- Test: `apps/v2/tests/unit/f7-ux-plan-execution-truth.test.ts`.

**Interfaces:** `buildHomeSummary` mantém assinatura atual, mas consulta estado verificável de conciliação; saúde local representa prova do store, não existência apenas de edital/disciplina.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `linked_completed_session_does_not_mark_block_fulfilled`; `partial_block_still_pending`; `session_only_database_not_labeled_empty`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-plan-execution-truth.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-plan-execution-truth.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Corrigir heurística `completedBlockIds` de bloco sem execução conciliada e fonte de health.localCommitted, sem mudar dados de origem. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: sessão ligada a bloco parcialmente executado não some da atenção indevidamente. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não realizar conciliação como efeito colateral da consulta.

### Task UX-04 — Rotas profundas seguras e continuidade de contexto

**Rastreabilidade:** T-02/S-05; D22/D35/D69.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/routing.ts; src/presentation/use-hash-route.ts; src/presentation/views/priority-display.ts; src/presentation/App.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/src/presentation/context-navigation.ts (se necessário)`.
- Test: `apps/v2/tests/unit/f7-ux-context-routes.test.ts`.

**Interfaces:** `routeForTarget(target)` deve transportar `entityId` real e filtro aplicável; `resolveDestination(route,profile,lookup)` retorna found/archived/missing/foreign.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `deep_link_targets_exact_id`; `foreign_profile_rejected`; `archived_readonly_not_replaced`; `back_restores_context_without_secrets`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-context-routes.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-context-routes.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Usar contratos tipados atuais e validação em cada destino; preservar scroll/foco sem colocar dados sensíveis na URL. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: Home/Busca/Atenção → entidade → voltar; item excluído não abre homônimo. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não fixar globalmente edital de sessões compartilhadas.

### Task UX-05 — Guarda de rascunho/sessão e gerência de foco

**Rastreabilidade:** T-02/T-04; D22/D23/D69/D70.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/draft-guard.ts; src/presentation/use-focus-scroll.ts; src/presentation/App.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Nenhum novo mecanismo de persistência`.
- Test: `apps/v2/tests/e2e/f7-ux-draft-navigation.spec.ts`.

**Interfaces:** `canNavigateSafely` usa o guard atual; modais de confirmação só operam após resposta explícita, retornando foco ao gatilho.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `unsaved_draft_blocks_switch`; `cancel_preserves_draft`; `save_failure_does_not_navigate`; `modal_returns_focus`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-draft-navigation.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-draft-navigation.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Integrar guard existente com mudanças de rota, perfil, visualização e painéis; preservar sessão em andamento. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E desktop e mobile com edição não confirmada, ação de salvar falha e botão voltar. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Nunca salvar ou descartar implicitamente.

### Task UX-06 — Navegação global D31–D34 e ação Estudar

**Rastreabilidade:** S-01/S-02; D31–D34.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/AppNav.tsx; src/presentation/App.tsx; src/presentation/styles.css`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Componente pequeno de ação Estudar apenas se reutilizado`.
- Test: `apps/v2/tests/e2e/f7-ux-shell-navigation.spec.ts`.

**Interfaces:** Mobile: cinco destinos fixos `Início · Plano · Estudar · Revisões · Mais`; ação Estudar abre opções, não inicia timer.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `mobile_five_destinations`; `study_does_not_autostart`; `tablet_rail_keeps_labels`; `desktop_sidebar_keeps_routes`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-shell-navigation.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-shell-navigation.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Evoluir navegação atual sem apagar destinos nem `overview`; Busca/Atenção/Configurações acessíveis; cabeçalho global em camadas. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E a 320/390/720/721/1023/1024 px, teclado, rolagem e foco. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Evitar novo router e evitar alterar versões de F6 sem justificativa.

### Task UX-07 — Central de Atenção deduplicada e encaminhamento

**Rastreabilidade:** S-04; D36/D69/D70.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/AttentionView.tsx; src/presentation/views/priority-display.ts; src/application/experience-queries.ts; src/presentation/AppNav.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Sem nova fila de persistência, salvo necessidade real demonstrada`.
- Test: `apps/v2/tests/unit/f7-ux-attention-dedupe.test.ts`.

**Interfaces:** `projectAttentionItems(inputs)` usa ocorrência/entidade/escopo como identidade e filtra incidentes sem gravação implícita.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `same_causal_issue_once`; `dismiss_does_not_resolve_academic_fact`; `badge_matches_actionable_scope`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-attention-dedupe.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-attention-dedupe.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Consolidar indicadores acionáveis sem duplicar Home/Configurações; rotas específicas, prioridade explicada e abertura correta do caso. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: contagem no menu concorda com itens apresentados; dispensa não conclui revisão. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Notificações externas somente após autorização e prova de suporte.

### Task UX-08 — Busca progressiva essencial, sem complexo motor novo

**Rastreabilidade:** S-03; D35 + preferência de priorização.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/SearchView.tsx; src/presentation/App.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Componente de pesquisa rápida se justificar duas superfícies`.
- Test: `apps/v2/tests/e2e/f7-ux-search-context.spec.ts`.

**Interfaces:** Pesquisa rápida e tela completa usam mesmo índice local e isolamento de perfil; ao abrir resultado aplicam rota profunda.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `search_stays_offline`; `results_have_context`; `quick_to_full_keeps_query`; `foreign_item_not_shown`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-search-context.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-search-context.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Reaproveitar busca atual, acesso do cabeçalho, agrupamento útil e atalho apenas quando não interferir com navegador; não criar busca semântica. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: pesquisa rápida, lista completa, teclado e retorno. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Prioridade menor que os módulos acadêmicos, conforme decisão expressa.

## Bloco II — Home, widgets e navegação contextual

### Task UX-09 — Layout de dashboard, modelos e persistência por dispositivo

**Rastreabilidade:** H-01/H-02/H-09; D01–D06.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/HomeView.tsx; src/presentation/ui-state.ts; src/presentation/App.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/src/presentation/dashboard-layout.ts`.
- Test: `apps/v2/tests/unit/f7-ux-dashboard-layout.test.ts`.

**Interfaces:** `resolveDashboardLayout(base: DashboardLayout, device: Desktop|Tablet|Mobile, overrides): DashboardLayout` preserva IDs, ordem, visibilidade, limites e sem sobreposição.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `layout_template_and_last_view`; `breakpoint_override_does_not_mutate_base`; `keyboard_move_and_undo`; `invalid_layout_falls_back_without_data_loss`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-dashboard-layout.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-dashboard-layout.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Implementar layouts prontos/last-used, editor explícito e grade com snap e variantes responsivas; persistência de preferências respeita dispositivo/perfil. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: editar por mouse/touch/teclado, salvar, reabrir e restaurar layout. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não persistir fatos acadêmicos ao salvar aparência.

### Task UX-10 — Catálogo de widgets: escopos e fontes acadêmicas internas

**Rastreabilidade:** H-03/H-04/H-06; D07–D09/D11–D16.

**Files:**
- Modify/inspect: `apps/v2/src/application/experience-queries.ts; src/presentation/views/HomeView.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/src/application/widget-queries.ts; src/presentation/components/WidgetEditor.tsx`.
- Test: `apps/v2/tests/unit/f7-ux-widget-data-contract.test.ts`.

**Interfaces:** `queryWidgetMetric(spec: WidgetMetricSpec, snapshots: AcademicSnapshots): WidgetMetricResult` possui unidade, escopo, fonte, sample, quality e provenance; não muta dados.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `shared_exams_not_double_counted`; `unknown_metric_not_zero`; `missing_denom_is_unavailable`; `academic_queries_readonly`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-widget-data-contract.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-widget-data-contract.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Catálogo categorizado; editor básico/avançado com preview e variantes configuráveis, reutilizando consultas dos módulos; permitir configurar fonte internamente compatível. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: criar widget e reabrir após recarregar sem alterar registros. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não integrar CSV, IA ou provedores externos na D09-B.

### Task UX-11 — Fórmulas seguras e regras condicionais

**Rastreabilidade:** H-03/H-05; D10.

**Files:**
- Modify/inspect: `apps/v2/src/application/widget-queries.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/src/domain/widget-expression.ts`.
- Test: `apps/v2/tests/unit/f7-ux-widget-expression.test.ts`.

**Interfaces:** `parseWidgetExpression(source: string): ExprParseResult`; `evaluateWidgetExpression(ast, metrics): MetricResult` somente operadores/funções explicitamente permitidos.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `js_injection_rejected`; `division_by_zero_unavailable`; `unit_mismatch_rejected`; `condition_validates_inputs`; `null_is_not_zero`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-widget-expression.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-widget-expression.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Parser/AST declarativo sem eval/Function/JavaScript arbitrário; limites de recursão, tamanho e custo; resultado com unidade e falha semântica. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: editor visual e fórmula textual produzem mesma métrica válida. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Sem transformar o widget em linguagem genérica executável.

### Task UX-12 — Filtros globais, locais, grupos e interação em camadas

**Rastreabilidade:** H-05/H-07; D18–D22.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/HomeView.tsx; src/presentation/routing.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/src/presentation/components/ContextInspector.tsx (se compartilhado)`.
- Test: `apps/v2/tests/unit/f7-ux-widget-filters.test.ts`.

**Interfaces:** `effectiveWidgetFilter(global, local, group)` explicita origem e escopo efetivo, respeitando não aditividade.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `local_override_preserved`; `linked_group_only_updates_members`; `multi_edital_nonadditive`; `closing_inspector_keeps_filter`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-widget-filters.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-widget-filters.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Filtro global opcional + próprio + grupos; detalhes rápidos, painel responsivo, drill-down com volta; histórico significativo sem cada clique virar rota. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: drill-down desktop/tablet/celular, Escape/retorno de foco. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Filtros nunca modificam registros acadêmicos.

### Task UX-13 — Ações rápidas e estados dos widgets

**Rastreabilidade:** H-07/H-08; D23–D29.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/HomeView.tsx; src/presentation/tokens.css; src/presentation/styles.css`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/src/presentation/components/SafeActionDialog.tsx (apenas se compartilhado)`.
- Test: `apps/v2/tests/e2e/f7-ux-widget-actions.spec.ts`.

**Interfaces:** Comandos explícitos do domínio com confirmação de acordo com risco; configurador de visual apenas altera presentation state.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `view_only_does_not_mutate`; `start_session_explicit`; `replan_previews_impact`; `destructive_action_not_on_card`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-widget-actions.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-widget-actions.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Personalização visual controlada, qualidade progressiva e cores semânticas não confundidas com cores de concurso. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: estados EMPTY/PARTIAL/STALE/ERROR e ações proporcionais nos oito temas. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Sem CSS arbitrário ou gravar evento por render.

## Bloco III — Módulos acadêmicos F2–F5

### Task UX-14 — Conteúdo: explorador, hierarquia, painel de detalhes

**Rastreabilidade:** C-01/C-02/C-07; D37–D39.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/components/{ContentTree,EditalManager}.tsx; src/presentation/App.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Sem novo store; painel reutilizado quando justificado`.
- Test: `apps/v2/tests/e2e/f7-ux-content-explorer.spec.ts`.

**Interfaces:** Seleção e expansão por IDs; `selectedSubjectId` nunca inferido de título; aulas são entidades associadas, não filhos obrigatórios.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `deep_tree_accessible`; `selected_item_retained`; `archived_readonly`; `no_cross_profile_leak`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-content-explorer.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-content-explorer.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Explorador árvore/detalhes desktop e progressivo mobile; pesquisa e contexto; grandes árvores com renderização incremental existente. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: 1000+ nós sintéticos, filtros, retorno de outra aba, 320 px. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não converter aula em nó da árvore hierárquica por aparência.

### Task UX-15 — Conteúdo: editor, reordenação e associações

**Rastreabilidade:** C-03–C-06/C-08; D40–D43.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/components/{SubjectForm,ContentTree,EditalManager}.tsx; src/application/content-service.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Reutilizar operações de domínio existentes`.
- Test: `apps/v2/tests/e2e/f7-ux-content-edit-integrity.spec.ts`.

**Interfaces:** Movimentação validada por IDs e prevenção de ciclo; associar/desassociar aula não exclui entidades; comando exige baseRevision.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `move_under_descendant_rejected`; `keyboard_reorder_equivalent`; `link_unlink_preserves_entities`; `concurrent_edit_reports_conflict`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-content-edit-integrity.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-content-edit-integrity.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Editor híbrido progressivo, prévia de movimento e impacto, administração contextual, importações preservadas. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: mouse/teclado, rascunho, conflito, arquivo, desfazer apenas se suportado. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Sem `drag-and-drop` como único meio de organização.

### Task UX-16 — Planejamento: cenários, calendário, capacidade

**Rastreabilidade:** P-01–P-03/P-08; D44–D46.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/PlanningWorkspace.tsx; src/presentation/components/{PlanningCalendar,PlanningDashboard,PlanningEditor}.tsx; src/application/planning-queries.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Nenhum novo motor de Planejamento`.
- Test: `apps/v2/tests/e2e/f7-ux-planning-workspace.spec.ts`.

**Interfaces:** Cenário ativo/inativo/rascunho; capacidade compartilhada com soma não aditiva; blocos sem horário não ganham hora fictícia.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `scenario_preview_no_autoswap`; `shared_capacity_no_double_count`; `unscheduled_not_faked_time`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-planning-workspace.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-planning-workspace.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Workspace contextual com calendário dia/semana/mês/lista; comparação e prévia de cenários, detalhes sob demanda. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: editar/agendar bloco e mudar cenário sem perder rascunhos. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Reusar planejamento F3 e testes f3-*.

### Task UX-17 — Planejamento: assistente, ciclo/reta final e replanejamento

**Rastreabilidade:** P-04–P-09; D47–D49.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/components/{PlanningWizard,StudyCycle,FinalStretch,PlanningHistory}.tsx; src/presentation/PlanningWorkspace.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Nenhuma dependência de IA paga`.
- Test: `apps/v2/tests/unit/f7-ux-planning-capacity.test.ts`.

**Interfaces:** `previewPlanningAdjustment` utiliza serviço F3 e retorna diff, capacidade, avisos, revisão-base antes de aplicação.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `preview_does_not_commit`; `over_capacity_warns`; `changed_exam_date_preserves_history`; `conflict_requires_review`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-planning-capacity.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-planning-capacity.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Assistente progressivo e avançado, simulação antes/depois, metas, rodadas e exceções; confirmação transacional explícita. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: alteração de data da prova, replanejamento parcial, conflito entre abas. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Nenhuma aplicação por visualizar sugestão.

### Task UX-18 — Sessões: cronômetro seguro e registro progressivo

**Rastreabilidade:** E-01–E-05/E-08; D50–D52.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/SessionWorkspace.tsx; src/application/session-service.ts; src/domain/{session-clock,session-accounting}.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Nenhum cronômetro paralelo`.
- Test: `apps/v2/tests/e2e/f7-ux-session-primary.spec.ts`.

**Interfaces:** Sessão ativa possui intervalos verificados, tempo manual distinto, alocações validadas, vínculos de bloco sem conclusão implícita.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `pause_not_focus`; `manual_not_verified`; `allocations_sum_valid`; `plan_link_not_fulfillment`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-session-primary.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-session-primary.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Priorizar cronômetro/ação contextual responsiva, detalhes progressivos, Pomodoro e registro manual sem alterar contrato F4. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: pausa, retomada, manual, bloco parcial, aba concorrente. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não permitir segunda sessão ativa por mudança de navegação.

### Task UX-19 — Sessões: histórico, hábitos e recuperação

**Rastreabilidade:** E-03/E-06–E-09; D53–D54.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/SessionWorkspace.tsx; src/application/{session-queries,session-emergency,session-habit-service}.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Somente vistas/detalhes; sem novo journal`.
- Test: `apps/v2/tests/e2e/f7-ux-session-recovery.spec.ts`.

**Interfaces:** `RecoveryPreview` distingue intervalos duráveis/incertos; histórico é auditável por sessão, data, perfil e alterações.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `uncertain_time_not_added`; `emergency_intent_not_commit`; `conflict_preserves_variants`; `history_audit_visible`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-session-recovery.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-session-recovery.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Histórico pesquisável com inspetor, recuperação orientada por evidência e hábitos contextualizados. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: interrupção sintética, reentrada, leitura do histórico e conflitos. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. F4-T13 e ensaio físico continuam marcados se não executados.

### Task UX-20 — Revisões: fila, execução e política

**Rastreabilidade:** R-01–R-03/R-08; D55–D56.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/ReviewWorkspace.tsx; src/application/review-service.ts; src/domain/review.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Não criar outro motor de revisão`.
- Test: `apps/v2/tests/e2e/f7-ux-reviews-queue.spec.ts`.

**Interfaces:** Estado de compromisso ≠ início ≠ execução ≠ avaliação; simulação de política retorna diff sem alterar histórico.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `opening_not_execution`; `policy_preview_not_save`; `old_policy_version_preserved`; `archived_content_safe`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-reviews-queue.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-reviews-queue.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Fila inteligente contextual, edição de política com preview/comparação e confirmação explícita. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: revisar, avaliar, alterar política após simulação. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Manter F5-D e rotinas de portabilidade existentes.

### Task UX-21 — Revisões: evidências, agenda e histórico

**Rastreabilidade:** R-04–R-09; D57–D59.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/ReviewWorkspace.tsx; src/application/review-service.ts; src/presentation/PlanningWorkspace.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Reutilizar consultas F5 e blocos F3`.
- Test: `apps/v2/tests/e2e/f7-ux-reviews-evidence.spec.ts`.

**Interfaces:** Encaixe assistido mostra capacidade/prévia, não altera Planejamento; pontuação de ponto fraco tem proveniência.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `weakness_claim_requires_sample`; `review_placement_preview_only`; `import_does_not_overwrite_without_preview`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-reviews-evidence.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-reviews-evidence.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Explorador de evidências e histórico com agenda/horários de silêncio, vínculo ao Plano e confirmação. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: revisão vencida→detalhe→ação, proposta de encaixe, importação parcial. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não inferir retenção científica sem medição.

## Bloco IV — Análises e Configurações

### Task UX-22 — Análises: metodologia, KPIs e cache causal

**Rastreabilidade:** A-01/A-03–A-07; D60–D62/D61.

**Files:**
- Modify/inspect: `apps/v2/src/application/{experience-queries,experience-cache}.ts; src/presentation/views/AnalyticsView.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/src/application/analytics-metrics.ts (se consultas existentes não cobrirem)`.
- Test: `apps/v2/tests/unit/f7-ux-analytics-provenance.test.ts`.

**Interfaces:** `computeMetric(definition, snapshot): MetricWithEvidence` inclui numerador, denominador, unidades, fonte, ressalvas e escopo; cache invalida quando medição/alocação muda.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `measurements_change_invalidates`; `shared_exam_hours_nonadditive`; `insufficient_sample_suppressed`; `missing_day_not_zero`; `linked_block_not_fulfilled`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-analytics-provenance.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-analytics-provenance.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Reconciliar o fingerprint do cache com todas as dependências; filtros compartilhados, comparação 7/30/90 e métodos sem inventar causalidade. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: mesma fonte reproduz KPIs e tabela após edição de medições. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não prometer métricas sem fonte registrada.

### Task UX-23 — Análises: gráficos inteligentes e editor semântico

**Rastreabilidade:** A-02/A-04/A-05/A-09–A-11; D30/D62/D64.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/AnalyticsView.tsx; src/application/analytics-metrics.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Editor de gráficos somente se reuso justificar`.
- Test: `apps/v2/tests/e2e/f7-ux-analytics-visualizations.spec.ts`.

**Interfaces:** `validateChartSpec(metrics,series)` rejeita unidades incompatíveis, total não aditivo e denominador ausente; gráfico e tabela equivalentes.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `invalid_units_blocked`; `bad_denominator_not_plotted`; `table_matches_chart`; `warning_cannot_be_hidden`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-analytics-visualizations.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-analytics-visualizations.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Modelos sugeridos + editor avançado de série/eixo/agrupamento/filtros; leitura visual e tabular responsivas. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: alterar tipo sem perder ressalvas, teclado, 320 px, oito temas. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não confundir filtro visual com recálculo não sustentado.

### Task UX-24 — Análises: snapshots históricos e exportações seguras

**Rastreabilidade:** A-06–A-08/A-11; D63.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/AnalyticsView.tsx; src/application/experience-queries.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Módulo de relatórios versionados pequeno, se necessário`.
- Test: `apps/v2/tests/unit/f7-ux-analytics-export.test.ts`.

**Interfaces:** `exportAnalyticsReport(snapshot,format)` inclui escopo/método/versão; arquivo é somente relatório, não backup.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `historical_snapshot_immutable`; `csv_formula_injection_escaped`; `methodology_in_export`; `no_personal_token_in_export`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/unit/f7-ux-analytics-export.test.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/unit/f7-ux-analytics-export.test.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Arquivar metadados e snapshots com verificações de proveniência; exportar JSON/CSV/impressão-PDF sem serviços externos. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: comparar duas versões, exportar e reabrir relatório somente leitura. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Testar backup separado da exportação de relatório.

### Task UX-25 — Configurações: perfil e sincronização contextual

**Rastreabilidade:** G-01–G-05; D65–D66.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/SettingsView.tsx; src/application/{profile-service,sync-policy}.ts; src/presentation/components/SyncStatus.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Sem nova implementação remota F7`.
- Test: `apps/v2/tests/e2e/f7-ux-profile-sync.spec.ts`.

**Interfaces:** Identidades locais/uid/library distintas; estados da outbox aceitam apenas prova contratual da F7 funcional.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `link_requires_consent`; `account_change_preserves_old_queue`; `ack_not_convergence`; `ineligible_outbox_no_send_action`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-profile-sync.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-profile-sync.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** UI contextual, prévia de vínculo, pausas por autenticação/cota e diagnóstico de operações; backend remoto só se G-EXT real. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E com simuladores; distinguir claramente `NOT_RUN` de homologaçāo externa. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não reaproveitar operações da Conta A na Conta B.

### Task UX-26 — Configurações: cofre local e recuperação protegida

**Rastreabilidade:** G-06–G-08/G-12; D67.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/SettingsView.tsx; src/platform/backup/{format,restore}.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Fluxo de catálogo/manifesto somente sobre APIs reais ou implementações F7 verificadas`.
- Test: `apps/v2/tests/e2e/f7-ux-backup-restore.spec.ts`.

**Interfaces:** Prévia distingue F2 parcial, completo, SAFE, INVALID, REBASELINE_REQUIRED; exportado/read-back/restaurado são provas diferentes.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `f2_partial_never_full`; `safe_preview_not_restore`; `rebaseline_blocks_write`; `pending_outbox_survives_restore`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-backup-restore.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-backup-restore.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Fluxos guiados de cobertura, exportação, read-back, restauração isolada e conferência; sem afirmar que backend atual os suporta. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E sintético antes/depois de restauro em banco descartável, quando implementado. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não copiar credenciais para backups e não realizar reset automático.

### Task UX-27 — Configurações: IndexedDB, privacidade e manutenção proporcional

**Rastreabilidade:** G-09–G-12; D68.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/views/SettingsView.tsx; src/platform/indexeddb.ts; src/presentation/draft-guard.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Reutilizar classificação de erros em vez de novo subsistema`.
- Test: `apps/v2/tests/e2e/f7-ux-settings-safety.spec.ts`.

**Interfaces:** Ações classificadas por risco; apenas caches comprovadamente regeneráveis são limpáveis; diagnósticos redigidos não expõem token.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `blocked_upgrade_no_delete`; `quota_no_auto_cleanup`; `cache_clear_preserves_causal`; `unlink_not_delete`; `draft_blocks_destructive`; `debug_export_redacted`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-settings-safety.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-settings-safety.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Manutenção contextual com prévia/inventário; preferências reversíveis e exclusão de dados com gates específicos. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E: simular cota, outra aba, rascunho, conflito, mudança de conta e cancelamento. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Nenhum botão de apagar banco bruto.

## Bloco V — Design system, jornadas, revisão e aceite

### Task UX-28 — Design system semântico incremental

**Rastreabilidade:** T-04; D26–D29/D71.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/{tokens,styles}.css; src/presentation/ui-state.ts; src/presentation/AppNav.tsx`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Componentes mínimos compartilhados se necessários`.
- Test: `apps/v2/tests/e2e/f7-ux-design-system.spec.ts`.

**Interfaces:** Oito temas, tipografia, densidades existentes; estados semânticos desacoplados da cor acadêmica.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `eight_themes_remain`; `undefined_css_variable_fixed`; `compact_keeps_critical_info`; `reduced_motion`; `focus_visible`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-design-system.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-design-system.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Consolidar CSS redundante e corrigir `var(--text-primary)` sem reescrever temas; padronizar formulários/diálogos/gráficos. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E visual e acessibilidade em desktop/tablet/celular, compare baseline F6. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não instalar biblioteca de UI por estética.

### Task UX-29 — Jornadas ponta a ponta e segurança por perfil

**Rastreabilidade:** T-01–T-04; H/S/C/P/E/R/A/G.

**Files:**
- Modify/inspect: `apps/v2/src/presentation/App.tsx; src/presentation/views/*.tsx; src/presentation/{routing,draft-guard}.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Arquivos de teste end-to-end; sem novos serviços`.
- Test: `apps/v2/tests/e2e/f7-ux-cross-module.spec.ts`.

**Interfaces:** Jornada Conteúdo→Planejamento→Sessões→Revisões→Análises→Configurações↔Atenção; navegação por IDs e estado persistente.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `cross_module_ids_stable`; `offline_journey`; `two_tabs_no_silent_overwrite`; `refresh_keeps_draft`; `notifications_no_duplicate`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-cross-module.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-cross-module.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Executar com fixtures sintéticas e IndexedDB isolado; registrar capturas reais e logs sem PII. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** E2E desktop/tablet/celular mais comparação visual dos oito temas. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Se depender de serviços externos bloqueados, testar simulado e marcar `NOT_RUN_REAL`.

### Task UX-30 — Validação local, desempenho, acessibilidade e regressão completa

**Rastreabilidade:** AC-01–AC-24; D01–D71.

**Files:**
- Modify/inspect: `apps/v2/apps/v2/package.json; apps/v2/tests/e2e/f6-*.spec.ts; apps/v2/tests/unit/f6-*.test.ts`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Nenhum workflow GitHub Actions novo`.
- Test: `apps/v2/tests/e2e/f7-ux-acceptance.spec.ts`.

**Interfaces:** Critérios AC-01–AC-24 ligados a testes/evidências; distinguir `PASS`, `FAIL`, `SKIP`, `BLOCKED`, `NOT_RUN`.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `screenreader_manual_not_faked`; `320px_no_horizontal_overflow`; `zoom_200`; `keyboard_dialog_focus`; `offline_keeps_core_flow`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- tests/e2e/f7-ux-acceptance.spec.ts` se for `tests/unit/`; para E2E, `npm run test:e2e -- tests/e2e/f7-ux-acceptance.spec.ts`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Rodar typecheck/lint/build/unit/E2E local completo, visual e acessibilidade; benchmarks em hardware disponível, revisão Impeccable, corrigir falhas reais. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** Relatório de evidências com status por caso/viewport/tema, logs e screenshots sanitizados. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Não declarar teste humano de NVDA/Narrator sem execução real.

### Task UX-31 — Revisão independente, integração autorizada e higiene Git

**Rastreabilidade:** G-VALIDATION/G-MAIN/G-CLOSURE; D01–D71.

**Files:**
- Modify/inspect: `apps/v2/docs/superpowers/v2/ROADMAP.md; docs/superpowers/audits/ (registro existente)`. Brace groups such as `{A,B}` denote separate existing files, not a literal path; use the actual files found during preflight.
- Create (only if needed): `apps/v2/Atualizar relatório de estado existente antes de criar novo`.
- Test: `apps/v2/docs/superpowers/plans/2026-11-05-estudo-organizado-v2-f7-ux-writing-plans.md`.

**Interfaces:** Checklist de rastreabilidade completa: matriz D01–D71; AC-01–AC-24; gates F7; verificação Git/PR/worktrees.

- [ ] **Step 1 — RED:** criar teste(s) específicos: `document_no_unsupported_pass`; `no_new_actions`; `no_unreviewed_pr`; `no_unique_commit_deleted`; `main_unchanged`. Validar fixtures sem PII e sem serviços reais.
- [ ] **Step 2 — Demonstrar falha:** `cd apps/v2 && npm run test:unit -- docs/superpowers/plans/2026-11-05-estudo-organizado-v2-f7-ux-writing-plans.md` se for `tests/unit/`; para E2E, `npm run test:e2e -- docs/superpowers/plans/2026-11-05-estudo-organizado-v2-f7-ux-writing-plans.md`. Resultado esperado: pelo menos uma asserção-alvo FAIL antes da mudança, salvo requisito já atendido (registrar evidência de PASS e não duplicar).
- [ ] **Step 3 — GREEN:** Revisão crítica sobre resultados e correção material, integração fast-forward a `v2` somente com autorização e sem violar proteções; saneamento seguro. Preservar as invariantes gerais e não alterar interfaces de domínio sem evidência de necessidade.
- [ ] **Step 4 — Verificar:** reexecutar exatamente o teste-alvo até PASS; depois unitários/regressões do domínio relacionado e `npm run typecheck`/`npm run lint`. Não mascarar falhas via `skip`.
- [ ] **Step 5 — Integração/UX:** Read-back GitHub e hashes; relatório claro de integrado/bloqueado/pendente + pacote zip no GOAL futuro. Capturar antes/depois se visual. Conservar relatório de status por evidência.
- [ ] **Step 6 — Revisão e registro:** inspecionar diffs, testes, integridade e escopo; incorporar em commit coeso com outras mudanças relacionadas, sem branch/PR novo. Encerramento exige evidência de integração e higiene, ou impedimento explícito; G-EXT/G-STAGING/G-F7 permanecem independentes.

## Matriz de cobertura da especificação

| Requisito | Tarefas detentoras | Evidência mínima |
|---|---|---|
| T-01/T-03: fonte da verdade, estados | UX-02, UX-03, UX-07, UX-22, UX-25, UX-26 | Unitários de inferência, status e cache + E2E |
| T-02/S-01–S-07 | UX-04–UX-08 | Rotas, Shell, atenção, busca com contexto |
| T-04/H-01–H-10 | UX-09–UX-13, UX-28 | Layouts, construtor, fórmulas, filtros e qualidade |
| C-01–C-08 | UX-14–UX-15 | Explorador e edição protegida |
| P-01–P-09 | UX-03, UX-16–UX-17 | Cenários, calendário, prévias e cumprimento |
| E-01–E-09 | UX-18–UX-19 | Sessões, tempo, recuperação e histórico |
| R-01–R-09 | UX-20–UX-21 | Fila, política, evidência, calendário e portabilidade |
| A-01–A-11 | UX-22–UX-24 | KPIs auditáveis, gráficos e snapshots |
| G-01–G-12 | UX-25–UX-27 | Perfil, backup, armazenamento e riscos |
| AC-01–AC-24 | UX-29–UX-31 + testes de propriedade de cada task | Matriz consolidada PASS/FAIL/BLOCKED com logs e screenshots |
| G-VALIDATION, G-MAIN, G-CLOSURE | UX-01, UX-29–UX-31 | Preflight, testes locais, read-back, inventário Git/GitHub |

## Gate de revisão e critérios de encerramento do Writing Plans

**Gate UX-P (plano):** requer aprovação humana expressa antes de preparar o GOAL. Publicar este documento não autoriza executar tarefas.

**Gate UX-I (implementação local):** exige GOAL/autorização específica; preflight em branch/árvore reais. Se F7 funcional contém trabalho local não publicado, integrar ou isolar de maneira não destrutiva primeiro, respeitando aprovações.

**Gate UX-Q (qualidade):** todos os AC-01–AC-24 classificados por evidência; nenhum defeito crítico de perda de dados, conflito/identidade, acessibilidade impeditiva ou falsa prova de sincronização/backup. Testes locais e QA visual com capturas reais nos três dispositivos; `NOT_RUN` nunca convertido em `PASS`.

**Gate UX-H (avaliação humana):** pacote de avaliação e URLs somente depois de `G-STAGING`; testes manuais e aceite humano separados. A aprovação da UX não concede F8/cutover.

**Gate UX-Git:** repositório limpo, sem commits ou mudanças únicas perdidos. Integração `v2` quando autorizada, com read-back do HEAD e ausência de branch/PR/worktree redundantes; `main` imutável salvo autorização específica. Bloqueios documentados.

### Comandos de validação para o Codex no ambiente real

```bash
# Executar somente quando houver GOAL aprovado e na raiz correta do checkout
cd apps/v2
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:e2e
```

Os comandos precisam ser adaptados se o ambiente real ou um bloqueio existente impedir a execução; nunca supor sucesso. Preferir Playwright local e dados sintéticos; não criar Actions.

### Produto de entrega do GOAL futuro

Uma revisão humana independente sobre invariantes e acessibilidade; lista de tarefas concluídas e pendentes; testes exatos executados com resultados; screenshots sanitizados; diffs/commits; estado de `v2` local/remoto e `main`; branches/PRs/worktrees; dependências dos gates G-EXT/G-STAGING; riscos/rollback; **ZIP de relatórios e documentos essenciais**, conforme instruções do proprietário. Nenhum pacote produzido neste planejamento substitui evidência de execução futura.

### Nota de proveniência

A especificação aprovada tem 24 critérios de aceite e 71 decisões; o histórico literal e as escolhas individuais estão na transcrição primária. O plano contempla UX-01 a UX-31, **sem renumerar F7 T01–T27**. A revisão humana do plano pode ajustar ordenação de tarefas sem alterar decisões aprovadas ou criar trabalho duplicado. Os rótulos de interface propostos são contratos a conferir com o checkout no preflight (e não alegação de que os arquivos novos já existam).
