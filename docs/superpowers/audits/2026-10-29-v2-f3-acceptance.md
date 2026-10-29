# Estudo Organizado V2 — F3: relatório de implementação e gate

**Data:** 2026-10-29
**Branch:** `v2` (worktree isolado; `main` da V1 intocada)
**Gate proposto:** `F3_READY_FOR_HUMAN_REVIEW` — implementação, testes locais e revisão independente concluídos; a integração em `origin/v2` depende de autorização humana explícita (ver §6 e §8).

> Este é o registro singular da F3. Nenhum status `ACCEPTED`, `PUBLISHED` ou `CONVERGED` é afirmado: não houve push, merge, deploy, Firebase ou emulador.

## 1. Estado e commits

| Item | Valor |
| --- | --- |
| HEAD inicial | `5eba778` (`origin/v2`, referência do GOAL) |
| HEAD final | ver `git rev-parse HEAD` no commit deste relatório |
| `main` local | `9046cfa` — inalterada |
| `origin/v2` | `5eba778` — sem push nesta execução |
| Commits locais | 19 (`5eba778..HEAD`), todos `feat/fix/test(v2-f3)` |
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
| unit | `npm --prefix apps/v2 run test:unit` | PASS 296 testes / 50 arquivos |
| E2E | `npm --prefix apps/v2 run test:e2e` | PASS 70/70 (50 F1/F2 + 20 F3) |
| build | `npm --prefix apps/v2 run build` | PASS (~364 kB JS, ~9 kB CSS) |

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

1. **Integração** — sem `git push origin v2`; a `v2` local permanece à frente de `origin/v2` até autorização específica.
2. **Limites em aparelho modesto** — 180/360 blocos medidos localmente (< 3 s de geração, < 10 s de commit no teste), sem medição em hardware modesto.
3. **Fora do escopo declarado** — sync real F7, emulador/Firebase, backup produtivo e cutover permanecem `NOT_RUN` por especificação.

## 7. Próximo passo

O revisor independente emitiu `APPROVE_FOR_HUMAN_REVIEW`. O próximo passo é a decisão humana: autorizar `git push origin v2` (fast-forward) e o aceite da fase.

## 8. Revisão independente e correções

**Revisor:** subagente independente (fresh context), somente leitura, sobre `5eba778..6e06f62`. **Veredito inicial:** `CHANGES_REQUIRED` — 0 P0, 8 P1, 9 P2; confirmou como sólidos o CAS dentro da transação, a atomicidade, o bloqueio de entrega do outbox, a migração aditiva e os contratos de data/fuso.

Correções aplicadas em `bd6508e` (todas com teste):

| Achado | Correção |
| --- | --- |
| P1-1 calendário com um único dia / jan-2027 fixo | faixa derivada dos blocos do cenário, Reta Final do primeiro bloco até a prova, navegação dia/semana/mês com janela móvel |
| P1-2 suspender Reta Final falhava e a UI dizia sucesso | cenário `SUSPENDED` sem data agora é válido; UI só anuncia sucesso após `LOCAL_COMMITTED` |
| P1-3 alterar prova ativava sem checkpoint | `previewExamDateChange` preserva o status; ativação continua exclusiva de `activateScenario` com checkpoint |
| P1-4 geração ignorava outros editais | gerador/redistribuição recebem reservas de todos os cenários ativos |
| P1-5 sobreposição fundida escondia overbooking | `OVERLAP` + `conflictBlockIds`; ocupação física continua 90 min no teste |
| P1-6 disciplina de outro edital aceita | `link.editalId !== block.editalId` → `INVALID_SCOPE`; wizard filtra disciplinas pelo edital |
| P1-7 falha ao gravar blocos do wizard ativava parcial | commit de blocos verificado; falha mantém o cenário em rascunho e não ativa |
| P1-8 import criava identidades inexistentes | edital-alvo ativo obrigatório; blocos sem vínculo viram `UNALLOCATED/UNMAPPED_CONTENT` e a ativação fica `BLOCKED` até reconciliação |
| P2-9 `EQUIVALENT` inalcançável | fingerprint semântico comum a arquivo e persistência, com teste real |
| P2-10 colisão de `importId` | fingerprint de conteúdo no id da importação |
| P2-11 restaurar checkpoint incompleto | restaura cenário/ciclo, remove blocos posteriores e usa `previewCompensation` |
| P2-12 segunda aplicação do rascunho impossível | `operationId` inclui o token (revisão + assinatura) |
| P2-14 meia-noite não distribuía capacidade | `dayBounds` + recorte por dia; teste de 22:00–02:00 em dois dias |
| P2-15 transição/encerramento só no domínio | botões de transição Ciclo→Reta Final e encerramento ligados; IDs dos blocos carregados recebem prefixo |
| P2-16 wizard não persistia e só aceitava uma disciplina | estado em `localStorage` e múltiplas disciplinas por edital |

### Segunda rodada de revisão (após `bd6508e`)

O revisor confirmou 12 de 14 correções e apontou 2 P1 remanescentes, corrigidos em `674ca48`:

| Achado | Correção | Prova |
| --- | --- | --- |
| P1 capacidade global não chegava ao wizard/redistribuição | `PlanningWorkspace` calcula `officialReservations` (cenários ACTIVE) e as injeta em `fixedBlocks` e `reservationBlocks` | `f3-generator`: 10 itens ficam `UNALLOCATED` quando outro edital ocupa 100% da janela |
| P1 ativação aceitava Reta Final suspensa sem data | `activateScenario` valida o estado ACTIVE, recusa CLOSED/ARCHIVED e Reta Final sem data (`EXAM_DATE_REQUIRED`); botão desabilitado | `f3-scenarios`: ativação suspensa retorna `BLOCKED` e mantém o status |

P2 também corrigidos: calendário passa o conjunto oficial completo (recorte por dia no motor); dia com `OVERLAP` expõe `remainingMinutes = 0`; seletor de edital de destino na importação e vínculo de bloco não mapeado via rascunho; `importId` inclui hash dos nomes (dois arquivos de blocos iguais com nomes distintos geram dois cenários); falha ao gravar blocos da transição impede sucesso falso; encerramento exige desfecho (ocorrida/remarcada/indefinida) e persiste `closing`; `dayBounds` cai para 01:00 quando 00:00 não existe; `EQUIVALENT` testado via roundtrip real de export; navegação do calendário e persistência do wizard com E2E; carga de 180 blocos verifica 30 dias no mês.

### Terceira rodada (veredito final)

O revisor confirmou os dois P1 fechados no caminho de produto e **não encontrou bloqueio material**: `APPROVE_FOR_HUMAN_REVIEW` (typecheck/unit/E2E reexecutados por ele). Três observações não bloqueantes foram tratadas em seguida:

- a transição Ciclo→Reta Final passou a receber as reservas oficiais dos demais cenários (`capacityBlocks`);
- um novo cenário para o mesmo edital não é cobrado contra o plano ativo que ele substitui;
- `relinkBlock` só anuncia o vínculo quando o rascunho foi realmente salvo.
