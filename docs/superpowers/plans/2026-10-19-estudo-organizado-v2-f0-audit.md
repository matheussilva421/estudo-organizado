# Estudo Organizado V2 — F0 Audit and Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditar integralmente o produto V1 com evidências verificáveis, sem modificar a V1, e produzir o gate humano que habilita a especificação detalhada da fundação V2.

**Architecture:** F0 é uma auditoria read-only do legado. Contratos de validação puros e pequenos, fontes de inventário JSON e relatórios Markdown são separados de `src/` e dos dados reais. F0 não cria nem migra bancos e não constrói a V2.

**Tech Stack:** Node.js ES Modules; Vitest e Playwright já existentes; mock isolado da V1; arquivos Markdown e JSON; Impeccable para baseline visual com verificação de instalação/hook.

**Spec:** `docs/superpowers/specs/2026-10-19-estudo-organizado-v2-design.md` (G1 aprovado em 2026-10-19).

## Global Constraints

- **R$ 0 de custo recorrente obrigatório**. Não habilitar billing, acessar produção Firebase ou dados reais do usuário.
- F0 **não altera** `src/**`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, `.impeccable/**`, regras Firebase nem o banco de produção. Os únicos scripts criados são ferramentas de auditoria.
- O app futuro usa React + TypeScript + Vite, PWA local-first, IndexedDB e Firebase opcional; **F0 não scaffolda esse código**.
- Rastrear integralmente Decisões Arquiteturais **01–27** e a Emenda **A-01 Impeccable**; nunca inventar comportamento ou aceite.
- Manter a identidade documentada em PRODUCT.md/DESIGN.md: oito temas Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex, Plasma; steel-blue; Plus Jakarta Sans + DM Mono; WCAG AA como alvo.
- Resultados de testes usam somente PASS, FAIL, BLOCKED, INCONCLUSIVE ou NOT_RUN. Não considerar PASS algo que não foi executado.
- Nunca usar exportações privadas, tokens, cookies ou IndexedDB de produção como fixture. Somente dados sintéticos/ambiente mock isolado.
- Impeccable obrigatório na avaliação de UX; examinar configuração já existente antes de instalar, executar init ou habilitar hooks. Com ferramenta indisponível, declarar BLOCKED.
- TDD dos validadores (RED→GREEN) com testes focados; revisão independente por tarefa. Falhas da V1 são registradas, **não corrigidas** pela F0.
- **G2 pendente** de aprovação deste plano e método de execução; **G3 não autorizado**. Instruções abaixo não estão sendo executadas agora.

## Review Focus

1. Recurso sem cobertura de teste → exigir `test_gap` justificado, não classificar implicitamente como coberto (Task 1).
2. Arquivo de funcionalidade não mapeado → apresentar `unmapped` e impedir conclusão do inventário (Task 2).
3. Versões de esquema divergentes entre código e docs → registrar discrepância, não escolher versão arbitrária (Task 3).
4. Teste/Impeccable não executado → manter BLOCKED/NOT_RUN, nunca converter em PASS (Task 5).
5. Aprovação de F0 ausente ou risco crítico não tratado → não declarar gate APPROVED (Task 6).

---

## File Structure

**Novos arquivos exclusivamente de auditoria (a criar somente na execução autorizada):**

| Arquivo | Responsabilidade |
| --- | --- |
| `scripts/v2-audit/validate-inventory.mjs` | Verificar contrato do inventário funcional |
| `scripts/v2-audit/source-coverage.mjs` | Descobrir fontes e detectar superfícies sem mapeamento |
| `scripts/v2-audit/validate-schema-matrix.mjs` | Verificar evidência de schemas e versões |
| `scripts/v2-audit/validate-risk-matrix.mjs` | Validar matriz de riscos e testes propostos |
| `scripts/v2-audit/validate-baseline.mjs` | Exigir evidências reais de QA e Impeccable |
| `scripts/v2-audit/validate-gate.mjs` | Consolidar condições para aceite humano de F0 |
| `tests/unit/v2-audit-*.test.js` | Uma suíte Vitest sintética por validador |
| `docs/superpowers/audits/2026-10-19-v1-feature-inventory.json` | Inventário funcional canônico V1 |
| `docs/superpowers/audits/2026-10-19-v1-source-coverage.json` | Fontes mapeadas e exclusões justificadas |
| `docs/superpowers/audits/2026-10-19-v1-schema-matrix.json` | Schemas, versões, proveniência e relações |
| `docs/superpowers/audits/2026-10-19-v1-risk-matrix.json` | Riscos de sync, segurança e recuperação |
| `docs/superpowers/audits/2026-10-19-v1-qa-baseline.json` | Comandos e resultados efetivamente observados |
| `docs/superpowers/audits/2026-10-19-v1-design-baseline.md` | Design, temas e crítica Impeccable com evidências |
| `docs/superpowers/audits/2026-10-19-f0-acceptance.md` | Reconciliacão, gaps, rastreabilidade e gate F0 |

## Task 1: Contrato do inventário de funcionalidades

**Files:**
- Create: `scripts/v2-audit/validate-inventory.mjs`
- Test: `tests/unit/v2-audit-inventory.test.js`

**Interfaces:**
- Produces: `validateInventory(rows: unknown): {ok: boolean, errors: string[]}`.
- Campos por entrada: `id: string` (prefixo F-V1-), `name: string`, `domain: string`, `observed_behavior: string`, `source_paths: string[]`, `tests: string[]`, `test_gap: string|null`, `evidence_level: "CODE_AND_TEST"|"CODE_ONLY"|"DOC_ONLY"|"UNCERTAIN"`, `proposed_disposition: "PRESERVE"|"REFORMULATE"|"UNIFY"|"ADD"|"DEPRECATE"|"UNDECIDED"`, `risk: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL"`, `decision_status: "PROPOSED"|"APPROVED"`, `approval_reference: string|null`.
- Reject: duplicidade de IDs, campos vazios, nível inválido, ausência de fonte sem nível DOC_ONLY, ausência de testes sem `test_gap` e status APPROVED sem referência de aceite humano.
- Errors: lista estável de códigos como `DUPLICATE_ID`, `NO_PROVENANCE`, `MISSING_TEST_GAP` e `APPROVAL_WITHOUT_REFERENCE`.

- [ ] **Step 1: Write failing tests** `rejects_duplicate_and_unproven_rows` e `accepts_synthetic_proposed_row` com asserts de `ok=false`/códigos respectivos e `ok=true` para um registro completo.
- [ ] **Step 2: Verify RED:** `npx vitest run tests/unit/v2-audit-inventory.test.js` — esperado FAIL devido ao import/export ausente.
- [ ] **Step 3: Implement** somente `validateInventory`, puro, sem leituras de dados ou efeitos colaterais.
- [ ] **Step 4: Verify GREEN:** repetir o mesmo comando — esperado PASS.
- [ ] **Step 5: Commit:** `git add scripts/v2-audit/validate-inventory.mjs tests/unit/v2-audit-inventory.test.js && git commit -m "test(audit): validate V1 inventory contract"`.

**Review gate:** o inventário não pode fabricar cobertura, status de aprovação ou fontes.

## Task 2: Descoberta de superfícies e inventário funcional V1

**Files:**
- Create: `scripts/v2-audit/source-coverage.mjs`
- Test: `tests/unit/v2-audit-coverage.test.js`
- Create: `docs/superpowers/audits/2026-10-19-v1-feature-inventory.json`
- Create: `docs/superpowers/audits/2026-10-19-v1-source-coverage.json`

**Interfaces:**
- Consumes: `validateInventory` (Task 1).
- Produces: `discoverLegacySurfaces(repoRoot: string): Promise<string[]>`; percorre recursivamente `src/js/views/`, `src/js/logic/`, `src/js/ui/actions/` e facades `src/js/main.js`, `src/js/store.js`, `src/js/logic.js`, `src/js/views.js`, `src/js/components.js`; retorna caminhos POSIX relativos em ordem estável sem carregar scripts.
- Produces: `assessSourceCoverage(surfaces: string[], rows: AuditFeature[], exclusions: {path: string, reason: string}[]): {unmapped: string[], invalid_exclusions: string[], mapped_count: number}`. Exclusões requerem razão não vazia e devem existir no conjunto descoberto.

- [ ] **Step 1: Write failing tests** `reports_unmapped_source` (esperado `unmapped=["src/js/views/unknown.js"]`), `accepts_justified_exclusion` e `discovers_nested_source_file`, usando pastas sintéticas temporárias.
- [ ] **Step 2: Verify RED:** `npx vitest run tests/unit/v2-audit-coverage.test.js` — esperado FAIL.
- [ ] **Step 3: Implement** descoberta read-only e comparação, sem import dinâmico dos módulos de navegador.
- [ ] **Step 4: Verify GREEN:** mesmo comando — esperado PASS.
- [ ] **Step 5: Inventariar manualmente** telas, rotas, ações e testes reais: home, Study Organizer, calendário, ciclo, reta final, editais, disciplinas, assuntos/aulas, timer/Pomodoro, sessões, histórico, revisões, hábitos, dashboards, pontos fracos, banca, configurações, import/export, backup, sync, temas, PWA; descobrir capacidades adicionais em vez de assumir lista exaustiva. Cada comportamento deve indicar fonte e evidência ou nível UNCERTAIN.
- [ ] **Step 6: Escrever JSON de inventário** com destinos PROPOSTOS e `decision_status="PROPOSED"` até aprovação humana; gerar matriz de fontes mapeadas e justificativas de exclusões.
- [ ] **Step 7: Revalidar** `npx vitest run tests/unit/v2-audit-inventory.test.js tests/unit/v2-audit-coverage.test.js` e executar o verificador sobre o inventário real; somente afirmar mapeamento completo quando `unmapped=[]` e sem exclusões inválidas.
- [ ] **Step 8: Commit:** `git add scripts/v2-audit/source-coverage.mjs tests/unit/v2-audit-coverage.test.js docs/superpowers/audits/2026-10-19-v1-feature-inventory.json docs/superpowers/audits/2026-10-19-v1-source-coverage.json && git commit -m "docs(audit): map legacy features and sources"`.

**Review gate:** cobertura do escopo de fontes declarado; nenhuma afirmação de que varredura estática prova todos os comportamentos reais.

## Task 3: Proveniência, schemas, importações e dados V1

**Files:**
- Create: `scripts/v2-audit/validate-schema-matrix.mjs`
- Test: `tests/unit/v2-audit-schema.test.js`
- Create: `docs/superpowers/audits/2026-10-19-v1-schema-matrix.json`

**Interfaces:**
- Produces: `validateSchemaMatrix(rows: unknown): {ok: boolean, errors: string[]}`.
- Cada linha: `id, entity, storage, source_paths: string[], versions: {declared: string[], observed: string[], conflicts: string[]}, export_paths: string[], import_paths: string[], sync_paths: string[], relations: string[], migration_risks: string[], evidence_gaps: string[]`.
- Se versions.declared ≠ versions.observed, exigir `conflicts` explicativo. Referências ausentes precisam figurar como lacuna; nenhuma versão pode ser presumida do README.

- [ ] **Step 1: Write failing tests** `requires_explanation_for_schema_conflict`, `rejects_missing_source_evidence` e `accepts_explicit_import_gap` com entradas sintéticas.
- [ ] **Step 2: Verify RED:** `npx vitest run tests/unit/v2-audit-schema.test.js` — esperado FAIL.
- [ ] **Step 3: Implement** validador puro.
- [ ] **Step 4: Verify GREEN:** mesmo comando — esperado PASS.
- [ ] **Step 5: Auditar somente leitura** `src/js/store/indexeddb.js`, `src/js/store/migrations.js`, `src/js/backup-restore.js`, `src/js/sync/`, testes de import/export, `docs/api/sync-contract.md` e documentação relacionada; registrar versões de código versus docs, chaves, relações, campos de origem, tombstones e formatos de backup.
- [ ] **Step 6: Validar arquivo real** `2026-10-19-v1-schema-matrix.json`; reportar casos sem evidência como lacunas, não como migráveis.
- [ ] **Step 7: Commit:** `git add scripts/v2-audit/validate-schema-matrix.mjs tests/unit/v2-audit-schema.test.js docs/superpowers/audits/2026-10-19-v1-schema-matrix.json && git commit -m "docs(audit): inventory V1 data and schema variants"`.

**Review gate:** nenhuma migração real executada; versões conflitantes seguem explícitas até reconciliação.

## Task 4: Diagnóstico de sync, segurança, backup e falhas

**Files:**
- Create: `scripts/v2-audit/validate-risk-matrix.mjs`
- Test: `tests/unit/v2-audit-risks.test.js`
- Create: `docs/superpowers/audits/2026-10-19-v1-risk-matrix.json`

**Interfaces:**
- Produces: `validateRiskMatrix(rows: unknown): {ok: boolean, errors: string[]}`.
- Campos: `id, area, severity: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", trigger, consequence, evidence_paths: string[], evidence_level, v2_invariant, proposed_test, suggested_phase, mitigation, status: "OPEN"|"MITIGATED"|"UNVERIFIED"`.
- HIGH/CRITICAL precisam de evidência, cenário reproduzível proposto, mitigação e fase responsável. MITIGATED requer prova concreta já observada.

- [ ] **Step 1: Write failing tests** `rejects_unowned_critical_risk` e `rejects_unproven_mitigation` com códigos de erro específicos.
- [ ] **Step 2: Verify RED:** `npx vitest run tests/unit/v2-audit-risks.test.js` — esperado FAIL.
- [ ] **Step 3: Implement** validador sem tocar redes, dados reais ou a V1.
- [ ] **Step 4: Verify GREEN:** repetir comando — esperado PASS.
- [ ] **Step 5: Auditar read-only** `docs/api/sync-contract.md`, `docs/security/sync-threat-model.md`, `src/js/sync/`, Firestore rules, IndexedDB, Service Worker e testes relacionados. Cobrir conflitos, perda de gravação, usuário remoto errado, XSS, quota, tab race, restauração, exclusões e atualizações.
- [ ] **Step 6: Gerar matriz** com classificação entre observação confirmada e hipótese de risco; nenhuma vulnerabilidade presumida como explorável sem evidência.
- [ ] **Step 7: Commit:** `git add scripts/v2-audit/validate-risk-matrix.mjs tests/unit/v2-audit-risks.test.js docs/superpowers/audits/2026-10-19-v1-risk-matrix.json && git commit -m "docs(audit): assess legacy integrity and security risks"`.

**Review gate:** riscos críticos rastreados até cenário de teste e responsável, sem autorização de hotfix V1.

## Task 5: QA baseline e revisão visual Impeccable

**Files:**
- Create: `scripts/v2-audit/validate-baseline.mjs`
- Test: `tests/unit/v2-audit-baseline.test.js`
- Create: `docs/superpowers/audits/2026-10-19-v1-qa-baseline.json`
- Create: `docs/superpowers/audits/2026-10-19-v1-design-baseline.md`

**Interfaces:**
- Produces: `validateBaseline(rows: unknown): {ok: boolean, errors: string[]}`; `computeBaselineGate(rows): "PASS"|"BLOCKED"`.
- Cada linha: `id, area, command_or_check, status: "PASS"|"FAIL"|"BLOCKED"|"INCONCLUSIVE"|"NOT_RUN", environment, evidence_ref: string|null, executed_at: string|null, notes`. PASS exige timestamp e evidência; linha de area IMPECCABLE obrigatória; IMPECCABLE não executado bloqueia gate visual.

- [ ] **Step 1: Write failing tests** `rejects_pass_without_output`, `preserves_not_run_status`, `blocks_visual_gate_without_impeccable` e `accepts_evidenced_pass`.
- [ ] **Step 2: Verify RED:** `npx vitest run tests/unit/v2-audit-baseline.test.js` — esperado FAIL.
- [ ] **Step 3: Implement** os dois métodos puros.
- [ ] **Step 4: Verify GREEN:** repetir comando — esperado PASS.
- [ ] **Step 5: Executar somente após autorização** `npm test`, `npm run lint`, `npm run test:design` e `npm run test:e2e:mock` quando o navegador/mock estiver disponível; registrar saída real e motivos de FAIL/BLOCKED/NOT_RUN sem corrigir código legado.
- [ ] **Step 6: Auditar identidade e UX** lendo `PRODUCT.md`, `DESIGN.md`, CSS de temas e `.impeccable/`; capturar imagens só do mock isolado/fixtures. Verificar instalação, comandos e hooks Impeccable antes de executar critique/audit; pedir aprovação específica se instalar/habilitar hooks for necessário. Produzir relatório com versão/fonte, 8 temas, desktop/tablet/mobile, contraste, teclado, alvos de toque e reduced-motion. Se indisponível, marcar BLOCKED; nunca executar init que sobrescreva arquivos existentes.
- [ ] **Step 7: Validar relatórios** e confirmar nenhum artefato contenha dados pessoais ou credenciais; registrar resultados nos dois documentos.
- [ ] **Step 8: Commit:** `git add scripts/v2-audit/validate-baseline.mjs tests/unit/v2-audit-baseline.test.js docs/superpowers/audits/2026-10-19-v1-qa-baseline.json docs/superpowers/audits/2026-10-19-v1-design-baseline.md && git commit -m "docs(audit): record QA and Impeccable evidence"`.

**Review gate:** evidência real de execução e capturas seguras; falha ou ausência do Impeccable impede declarar QA visual aprovado.

## Task 6: Consolidação F0, rastreabilidade e gate humano

**Files:**
- Create: `scripts/v2-audit/validate-gate.mjs`
- Test: `tests/unit/v2-audit-gate.test.js`
- Create: `docs/superpowers/audits/2026-10-19-f0-acceptance.md`

**Interfaces:**
- Consumes: validadores e relatórios das Tasks 1–5.
- Produces: `evaluateF0Gate({inventory, coverage, schemas, risks, baseline, decision_refs, human_approval_ref}): {status:"BLOCKED"|"READY_FOR_HUMAN_REVIEW"|"APPROVED", reasons: string[]}`.
- APPROVED somente se todas as verificações obrigatórias são reais e satisfatórias, D01–D27 + A-01 estão vinculadas, propostas de destino receberam aceite humano rastreável, achados críticos estão resolvidos ou possuem exceção humana válida, e `human_approval_ref` não é vazio. Sem referência humana: estado máximo READY_FOR_HUMAN_REVIEW.

- [ ] **Step 1: Write failing tests** `cannot_approve_without_human`, `blocks_missing_a01_or_decision`, `blocks_open_critical_risk` e `approves_synthetic_complete_case`; usar objetos sintéticos, nunca inventar aprovação para arquivos reais.
- [ ] **Step 2: Verify RED:** `npx vitest run tests/unit/v2-audit-gate.test.js` — esperado FAIL.
- [ ] **Step 3: Implement** `evaluateF0Gate` reutilizando os validadores anteriores.
- [ ] **Step 4: Verify GREEN:** repetir comando — esperado PASS.
- [ ] **Step 5: Redigir relatório** com cobertura, decisões propostas, status dos schemas, divergências, riscos, testes legados, QA Impeccable, matriz D01–D27/A-01 e critérios mensuráveis para uma futura spec F1; citar referências do repositório e artefatos sanitizados.
- [ ] **Step 6: Verificar testes próprios** `npx vitest run tests/unit/v2-audit` — esperado PASS nos validadores, sem implicar que a auditoria real esteja aprovada.
- [ ] **Step 7: Solicitar revisão independente** de proveniência, identidade, falsos positivos, dados pessoais e riscos de migração; anotar status real PASS/FAIL/BLOCKED.
- [ ] **Step 8: Commit:** `git add scripts/v2-audit/validate-gate.mjs tests/unit/v2-audit-gate.test.js docs/superpowers/audits/2026-10-19-f0-acceptance.md && git commit -m "docs(audit): prepare F0 human-acceptance evidence"`.
- [ ] **Step 9: Entregar F0 e parar:** apresentar evidências e propor F1. Sem aceite humano explícito não declarar F0 concluída nem começar scaffold, migração ou sincronização de produção.

**Review gate:** o programa de QA não concede aceites humanos; faltas e bloqueios permanecem visíveis.

---

## Final Verification (após execução autorizada, não nesta conversa)

1. Comparar diff do branch de execução; apenas `scripts/v2-audit/`, `tests/unit/v2-audit-*.test.js`, `docs/superpowers/audits/` e registros de aprovação cabíveis. Alteração em `src/`, regras Firebase, dados ou identidade visual exige STOP.
2. Executar `npx vitest run tests/unit/v2-audit`; guardar stdout/stderr e ambiente.
3. Confirmar que testes legados, mock, QA visual e Impeccable têm status real e evidências, incluindo indisponibilidades.
4. Conferir matriz de risco, diferenciação de inferências e observações e cobertura de superfícies declaradas.
5. Revisão independente e gate humano da F0 antes de iniciar especificação/plano F1.

## Execution Handoff

**Status:** PROPOSTO / G2 EM REVISÃO. A aprovação do G1 autorizou a **redação** deste plano, mas não sua execução. A sequência futura requer aceite explícito do plano, escolha de método e autorização independente de G3/F0.

**Método recomendado:** Subagent-driven, com um subagente por tarefa e revisor independente por tarefa, seguido de revisão final; evita que um erro de inventário contamine a arquitetura V2. O método Native permanece possível mediante escolha humana.

**Fim do escopo deste plano:** Gate humano da auditoria F0. Detalhar F1–F8 em specs e planos separados, a partir das evidências F0, sem presumir contratos não auditados.
