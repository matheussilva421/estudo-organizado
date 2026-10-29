# Estudo Organizado V2 — F3: relatório de implementação e gate

**Data:** 2026-10-29
**Branch:** `v2` (worktree isolado; `main` da V1 intocada)
**Gate proposto:** `F3_BLOCKED` — implementação e testes locais avançados, mas com gates de aceite pendentes (ver §6).

> Este é o registro singular da F3. Nenhum status `ACCEPTED`, `PUBLISHED` ou `CONVERGED` é afirmado: não houve push, merge, deploy, Firebase ou emulador.

## 1. Estado e commits

| Item | Valor |
| --- | --- |
| HEAD inicial | `5eba778` (`origin/v2`, referência do GOAL) |
| HEAD final | ver `git rev-parse HEAD` no commit deste relatório |
| `main` local | `9046cfa` — inalterada |
| `origin/v2` | `5eba778` — sem push nesta execução |
| Commits locais | 13 (`5eba778..HEAD`), todos `feat/fix(v2-f3)` |
| Árvore | limpa após o commit documental |

### Correção de baseline (fora do escopo funcional, registrada)

Uma instalação limpa (`npm ci`) não conseguia rodar `typecheck`, `build` nem `test:e2e`: `apps/v2` usa `node:fs`, `process` e `Buffer` nos testes, mas `@types/node` não estava declarado nem no `package.json` nem no `tsconfig`. Corrigido no commit `1c758a1` com `@types/node@24.19.2` (devDependency) e `"types": ["vite/client", "node"]`. Sem isso os gates exigidos pelo GOAL eram inexecutáveis; a suíte e os 50 E2E da F2 passaram novamente após a correção.

## 2. Entregas

| Área | Arquivos |
| --- | --- |
| Domínio | `domain/planning.ts`, `planning-time.ts`, `planning-capacity.ts`, `planning-cycle.ts`, `planning-priority.ts`, `planning-generator.ts`, `planning-final-stretch.ts`, `planning-merge.ts`, `planning-history.ts`, `planning-execution-contract.ts` |
| Aplicação | `application/planning-service.ts`, `planning-queries.ts`, `planning-portability.ts` |
| Plataforma | `platform/local-planning-repository.ts`, `planning-import-commit.ts`, `indexeddb.ts`, `content-migration.ts`, `sync-types.ts`, `local-events.ts`, `e2e-harness.ts` |
| UI | `presentation/PlanningWorkspace.tsx` + `components/{PlanningDashboard,PlanningWizard,PlanningCalendar,StudyCycle,FinalStretch,PlanningEditor,PlanningHistory,PlanningConflicts,PlanningPortability}.tsx` |
| Testes | 10 arquivos unit `f3-*` e 8 E2E `f3-*` |

Comportamento novo: cenários múltiplos por edital com um único ACTIVE e troca atômica com checkpoint; disponibilidade semanal/exceções com precedência data>período>semanal e capacidade global só de cenários ativos; calendário dia/semana/mês derivado; Ciclo com cursor explícito e projeção em horizonte; Reta Final com data civil, transição e replanejamento; wizard determinístico com prévia e explicação; drafts persistentes com CAS dentro da transação; merge três-vias granular; checkpoints/journal com compensação; importação conservadora e exportação seletiva; redistribuição assistida (domínio).

## 3. Testes executados (evidência real)

| Gate | Comando | Resultado |
| --- | --- | --- |
| typecheck | `npm --prefix apps/v2 run typecheck` | PASS (exit 0) |
| lint | `npm --prefix apps/v2 run lint` | PASS (0 erros, 2 warnings de hooks) |
| unit | `npm --prefix apps/v2 run test:unit` | PASS 284 testes / 49 arquivos |
| E2E | `npm --prefix apps/v2 run test:e2e` | PASS 63/63 (50 F1/F2 + 13 F3) |
| build | `npm --prefix apps/v2 run build` | PASS (360 kB JS, 8.6 kB CSS) |

Baseline antes da F3: 188 unit, 50 E2E, typecheck/lint/build PASS após a correção de tipos.

### Matriz F3-T01..T42

T01–T04 PASS (`f3-scenarios`, `f3-capacity`) · T05–T07 PASS (`f3-time`, `f3-capacity`) · T08–T09 PASS (`f3-priority`) · T10–T12 PASS (`f3-drafts`, `f3-commit`) · T13–T15 PASS (`f3-merge`, `f3-two-tabs`) · T16–T19 PASS (`f3-import`, `f3-import-commit`, `f3-content-links`) · T20–T23 PASS (`f3-cycle`, `f3-cycle-projections`) · T24–T27 PASS (`f3-final-stretch`) · T28–T30 PASS (`f3-capacity`, `f3-generator`) · T31–T33 PASS (`f3-content-links`, `f3-history`) · T34–T35 PASS (`f3-import`, `f3-import-commit`) · T36–T37 PASS (`f3-f4-contract`) · T38–T39 PASS (`f3-generator`, `f3-limits`) · **T40 BLOCKED parcial** · T41 PASS (main intocada, teste de fronteira) · T42 PASS (outbox F3 `deliveryMode: BLOCKED`).

### Matriz D-F3-01..26

D01–D03 cenários/capacidade (T1,T4,T5) · D04 tempo civil/IANA (T2) · D05 histórico compensatório (T13) · D06–D07 prioridade versionada (T9) · D08 draft separado (T11) · D09 import supervisionado (T15) · D10 merge/CAS (T12) · D11–D12 Ciclo/Reta Final e replanejamento (T7,T10) · D13 cursor explícito (T7) · D14 projeção com fixações (T8) · D15–D16 continuidade e refs F2 (T7,T14) · D17–D18 disponibilidade e blocos (T2,T5) · D19–D20 contrato F4 e contagem única (T14) · D21 encerramento assistido (T10) · D22 exportação seletiva (T16) · D23 wizard determinístico (T9,T17) · D24 horizonte/limites medidos (T8,T9,T19) · D25 retenção seletiva (T13) · D26 aceite por riscos (T19,T20).

## 4. Revisão

- **Auto-revisão estruturada:** executada durante as tasks (casos adversariais de quota, CAS, DST, escopo de perfil, vazamento de exportação).
- **Revisão independente:** **NOT_RUN**. Não houve revisor fresco nesta execução; nenhum parecer independente é reivindicado.

## 5. Integridade

Migração IDB v2→v3 aditiva, com F1/F2 preservados (`f3-schema`); outbox única com envelopes F3 discriminados e entrega `BLOCKED` (`f3-commit`); quota/abort sem efeito parcial; CAS dentro da transação (duas abas reais); importação e exportação atômicas/idempotentes; nenhuma sessão F4 persistida (apenas fixtures de contrato); `main`, `firestore.rules`, `.github/**` e V1 intocados.

## 6. Pendências que bloqueiam o aceite

1. **Revisão independente NOT_RUN** — exigida pela D-F3-26 e pelo §6 do GOAL.
2. **F3-T40 parcial** — só há prova de 8 temas/foco nas visões F3 e de ausência de overflow em 375 px; falta contraste medido dos componentes novos, alvos de toque ≥44 px e fluxo completo em tablet/desktop.
3. **Redistribuição** — o motor existe e é testado (`previewRedistribution`), mas não está ligado ao editor/UI.
4. **Conflitos** — a UI lista conflitos; a resolução explícita (escolher base/atual/rascunho) ainda não é oferecida.
5. **Integração** — sem `git push origin v2`; a `v2` local permanece à frente de `origin/v2` até autorização específica.
6. Limites de volume são medidos localmente (180/360 blocos < 3 s de geração); não foram medidos em aparelho modesto.

## 7. Próximo passo

Corrigir os itens 2–4 (UI de redistribuição e resolução de conflitos, a11y medida), solicitar revisão independente do diff `5eba778..HEAD` e, só então, pedir autorização para `git push origin v2`.
