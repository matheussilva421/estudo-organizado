# Estudo Organizado V2 — F4: aceite local

**Status:** F4_IMPLEMENTED_LOCAL_READY_FOR_HUMAN_ACCEPTANCE
**Data:** 2026-10-31
**Branch/worktree:** v2 em C:\Users\slvma\.codex\worktrees\v2-f4\estudo-organizado
**HEAD de código:** 3e675dc
**Remoto:** origin/v2 = 68db01542a9d5934c7e45e622001334f91eaaf4f; sem push, merge ou deploy.
**main:** 9046cfa, intocada.

## Entradas aprovadas

- Spec: docs/superpowers/specs/2026-10-30-estudo-organizado-v2-f4-execution-design.md
- Plano: docs/superpowers/plans/2026-10-30-estudo-organizado-v2-f4-execution.md
- SHA-256 originais verificados antes da incorporação: spec 5be103a6a48a29d91e26a0ca9b0da22c96fcb1536f789f173846b561a6e5d527; plano a35881dc6e3cd71083ea61d81eded619f89f78ac23a27255c102d6a5a98ca8b7.
- A comparação com o ZIP original mostra apenas 5+3 linhas de metadados de aprovação; a parte normativa está íntegra. 21 decisões, 12 invariantes e 42 critérios estão presentes.

## O que esta rodada fechou (Tasks 20–22)

- **Integração F3 na UI:** o workspace de planejamento expõe `planning-start-session`; a sessão nasce daí, carrega os blocos do IndexedDB, oferece seleção legível (`session-plan-block`) e concilia o bloco explicitamente (`session-reconcile-<blockId>-concluded|partial|not-applied`). Sessão duplicada por bloco é bloqueada.
- **Transições atômicas:** pausa, retomada e conclusão gravam checkpoint e mudança de estado na mesma transação; a retomada cria o próximo intervalo dentro da transição.
- **Alocações e medições:** o registro manual aceita questões, acertos, páginas, material (tipo/título/URL/comentários) e alocação por disciplina com resumo alocado/não atribuído; `SessionAllocation` passou ao domínio com validação.
- **Importação emergencial pela UI:** exporta a intenção, lê o arquivo, mostra prévia `READY/INVALID/CONFLICT` e aplica reimportação idempotente.
- **Atualização PWA entre abas:** `queryOtherTabsReady()` pergunta às outras abas pelo BroadcastChannel `estudo-organizado-v2-update` em vez de assumir `true`.
- **Histórico e conflitos:** filtro por `assuntoId` via alocações, listagem de revisões de auditoria por sessão e resolução `LOCAL/INCOMING/KEEP_BOTH` na UI.
- **Histórico incremental:** a consulta percorre o índice `by_profile_date` em ordem decrescente com cursor opaco; a UI mostra as sessões mais recentes primeiro e oferece `session-history-more` para a próxima página.
- **Filtro por assunto:** a alocação grava o assunto escolhido da disciplina e o histórico filtra por ele com o mesmo predicado da consulta.
- **Vinculação posterior:** uma sessão livre pode ser ligada a um bloco planejado depois do fato, com nova revisão auditável (`session-link-block-*` e `session-link-apply-*`).
- **Estado de persistência:** a linha de status distingue ocioso, salvo, falha de gravação e conflito de revisão, em vez de afirmar sempre que a persistência local está ativa.
- **Superfície visual e acessibilidade:** estilos compartilhados de controle (altura mínima 44px, `focus-visible`, tokens dos oito temas), cartões de sessão, navegação e estado vazio informativo. Nenhum identificador técnico aparece como texto: blocos usam rótulo legível e conflitos mostram data e origem.

## Evidência executada no HEAD final

| Comando | Resultado |
| --- | --- |
| `npm run test:unit` (apps/v2) | PASS — 71 arquivos, 435 testes |
| `npm run test:e2e` (apps/v2) | PASS — 98 testes, 1 skip intencional |
| `npm run lint` | PASS — 0 erros |
| `npm run build` | PASS — `tsc --noEmit` e Vite |
| E2E F4 | PASS — 13 specs, 21 testes |
| Impeccable detector 3.9.1 em `apps/v2/src` | PASS — `[]`, 0 achados |
| Contraste/foco/toque F4 | PASS — `f4-a11y`: 8 temas, foco ≥2px, alvos ≥44px em mobile |
| Temas/viewports | PASS — oito temas, 1280/834/390 |
| Suspensão física F4-T13 | NOT_RUN — sem ambiente de suspensão controlada |

## Cobertura E2E da F4

`f4-timer-journey` (início/pausa/retomada/conclusão, manual até histórico e CSV), `f4-pomodoro` (foco/descanso, transição explícita, descanso não soma, recuperação após reload), `f4-two-tabs` (transferência assistida de autoridade), `f4-background` (aba oculta não pausa), `f4-update` (update adiado em sessão ativa e com outra aba ativa), `f4-habits` (criação e confirmação explícita), `f4-manual-details` (medições, materiais e alocação), `f4-planning-integration` (início por bloco e conciliação), `f4-emergency-ui` (exportação e reimportação idempotente), `f4-accessibility` (8 temas × 3 viewports), `f4-a11y` (contraste, foco, toque), `f4-evidence` (capturas).

## Matriz F4-T01…T42

| Critério | Status | Evidência |
| --- | --- | --- |
| T01 estados/transições | PASS | unit `f4-domain`, `f4-commit` |
| T02 duplo start/pause/complete | PASS | `f4-commit` |
| T03 replay de `operationId` | PASS | `f4-commit` |
| T04 mesmo `operationId`, payload diverso | PASS | `f4-commit` |
| T05 cronômetro livre/F3 por ID | PASS | `f4-planning-integration` |
| T06 pause/resume múltiplos | PASS | checkpoint atômico + `f4-commit` |
| T07 Pomodoro foco/descanso | PASS | `f4-pomodoro` |
| T08 transição híbrida | PASS | `f4-pomodoro` |
| T09 suspensão em Pomodoro | PASS (simulado) | `f4-pomodoro` recovery |
| T10 crash após checkpoint | PASS | unit `f4-recovery` |
| T11 fechamento/reabertura | PASS | `f4-two-tabs` |
| T12 relógio civil alterado | PASS | unit `f4-clock` |
| T13 suspensão do OS | NOT_RUN | sem ambiente controlado |
| T14 aba minimizada | PASS | `f4-background` |
| T15 inatividade prolongada | PASS | unit `f4-anomaly` |
| T16 duração longa | PASS | unit `f4-duration` |
| T17 duração inválida | PASS | unit `f4-domain` |
| T18 uma sessão, duas abas | PASS | `f4-two-tabs` |
| T19 duas sessões simultâneas | PASS | `f4-two-tabs` |
| T20 transferência + aba ressuscitada | PASS | `f4-two-tabs`, fencing |
| T21 troca assistida de matérias | PASS | transição atômica |
| T22 sessão manual retroativa | PASS | `f4-manual-details` |
| T23 manual sobreposto | PASS | aviso sem exclusão |
| T24 multiassunto/parcela não atribuída | PASS | `f4-manual-details` + `f4-accounting` |
| T25 sessão em dois editais | PASS | `f4-planning-integration` |
| T26 vínculo posterior | PASS | `session-link-apply-*` com nova revisão |
| T27 F3 várias sessões parciais | PASS com ressalva | `session-reconcile-*` grava a decisão na sessão; o bloco F3 não recebe status |
| T28 F3 conflito ao concluir | PASS com ressalva | plano pendente, sessão preservada; aplicação no bloco ainda é intenção |
| T29 questões/acertos incoerentes | PASS | validação no registro manual |
| T30 medição sem classificação | PASS | total não atribuído |
| T31 edição histórica e tombstone | PASS | unit `f4-history` |
| T32 dois dispositivos fake | PASS | unit `f4-conflicts` |
| T33 exclusão vs edição offline | PASS com ressalva | INCOMING aplicado com nova revisão; KEEP_BOTH só no registro |
| T34 duração cruzando meia-noite | PASS | unit `f4-accounting` |
| T35 DST e hora ambígua | PASS | unit `f4-dst` |
| T36 hábito com meta atingida | PASS | `f4-habits` |
| T37 evidência de hábito corrigida | PASS | unit `f4-habits` |
| T38 histórico filtrado/revisão/materiais | PASS | filtro por `assuntoId` com assunto gravado pela UI e cursor sobre `by_profile_date` |
| T39 CSV/JSON e sanitização | PASS | unit `f4-export` |
| T40 quota/abort na conclusão | PASS | unit `f4-commit` (abort injetado) |
| T41 export/reimport emergencial | PASS | `f4-emergency-ui` |
| T42 update SW em sessão + temas | PASS com ressalva | `f4-update`, `f4-a11y`; T13 não executado |

## Auditoria Impeccable (F4)

Executada com a skill instalada 3.9.1 (sem instalar 4.8.0 e sem ativar hooks), sobre `apps/v2/src` e a superfície da F4.

| # | Dimensão | Nota | Achado principal |
| --- | --- | --- | --- |
| 1 | Acessibilidade | 3/4 | Contraste AA nos oito temas, foco de 2 px, alvos de 44 px, teclado sem armadilha e nomes acessíveis; falta região `aria-live` para eventos do relógio |
| 2 | Performance | 3/4 | Bundle 454 kB (128 kB gzip), um único intervalo de 1 s e `prefers-reduced-motion` respeitado; sem medição de frames em hardware modesto |
| 3 | Responsividade | 4/4 | Sem overflow horizontal em 1280/834/390 e alvos ≥44 px no mobile |
| 4 | Theming | 3/4 | 76 usos de token; literais aparecem apenas como fallback de `var()` |
| 5 | Anti-padrões | 4/4 | Detector `[]`; sem gradiente em texto, glassmorphism ou easing elástico |
| **Total** | | **17/20** | **Good** |

Achados P3: fallback de cor duplicado nas regras novas; só duas transições declaradas, então o feedback de estado é discreto; o relógio não usa `aria-live` de propósito, para não anunciar a cada segundo.

Evidência automatizada: `f4-a11y` (contraste, foco, toque), `f4-accessibility` (8 temas × 3 viewports), `f4-keyboard` (alcance por teclado, nomes acessíveis, hierarquia de títulos) e `f4-evidence` (capturas em 1280/834/390). A leitura visual humana das capturas continua sendo parte do gate.

## Revisão independente

Revisor separado do executor, somente leitura.

Primeira rodada, sobre o HEAD 90a3dca: 10 HIGH, 5 MEDIUM e 3 LOW. Correções materiais no commit 4ffa023 — Pomodoro não credita foco fictício; autoridade órfã liberada quando a criação falha; troca de sessão atualiza `session_control`; retomada cria novo intervalo; sessões reais ganham `startedAt`; hábitos ignoram sessões canceladas; exportação aplica filtros e sanitiza; recuperação expõe quatro saídas; conflitos rejeitam versão anterior à base; update aguarda ativação do novo controlador.

Segunda rodada, sobre o HEAD d793b36: 10 HIGH, 12 MEDIUM e 4 LOW, veredito NÃO APTO. Correções materiais no commit 18a561b:

- Checkpoint periódico (15 s) e em `pagehide`, para não perder o foco desde a última transição.
- Total único (`sessionTotalFocusMs`) usado por histórico, hábitos, alocações e exportação: correção manual soma ao medido em vez de substituí-lo.
- `RESUME` abre novo intervalo de foco; `KEEP_PENDING` passou a uma única transação com `patchIntervals`.
- Transferência entre abas pausa no último checkpoint durável antes de assumir a autoridade.
- Registro manual não disputa mais o lease do cronômetro.
- Reimportação emergencial valida o payload e exige CAS para sessões existentes.
- Resolução de conflito aplica a versão incoming com nova revisão e auditoria.
- `applyEmergency` e `resolveConflict` respeitam `locked`.

Ressalvas que a revisão levantou e que seguem abertas: validação de continuidade no caminho de escrita de pausa/conclusão (o serviço confia no delta da aba dona, agora limitado pelo checkpoint periódico); alocações criadas pela UI gravam apenas `editalDisciplineId`, então o filtro por `assuntoId` só funciona com alocação que traga o assunto; paginação do histórico em memória; `KEEP_BOTH` mantém a variante apenas no registro do conflito.

## Ressalvas remanescentes

- F4-T13 (suspensão física do OS por horas) permanece NOT_RUN: não há ambiente de suspensão controlada nesta máquina; a recuperação após interrupção é coberta apenas de forma simulada.
- Quatro HIGH da F0 continuam UNVERIFIED.
- O histórico percorre o índice `by_profile_date` em ordem decrescente e para ao completar a página; filtros de edital, origem e estado são aplicados durante a varredura, então uma página filtrada pode percorrer mais entradas antes de encher.
- A continuidade do relógio é verificada no preview de recuperação, não no caminho de pausa/conclusão; o checkpoint periódico limita a exposição a 15 s por transição.
- `KEEP_BOTH` preserva a variante incoming no registro do conflito, sem criar uma segunda identidade de sessão.
- O gate Impeccable completo (auditoria visual dedicada) não foi executado; o detector automático passa com zero achados.
- Sem push, merge, deploy, Actions ou ativação de Firebase real.

## Git e GitHub

- v2 local: 47 commits à frente de origin/v2; código em 3e675dc, este relatório no commit documental seguinte.
- Commits desta rodada: b6dfec6 (atomicidade), 626f483 (alocações e filtro), c707665 (integração visual e fluxos), d793b36 (evidências visuais), 18a561b (correções da revisão independente), 1615422 (histórico incremental, vinculação posterior e auditoria de teclado), bd5ac7f (estado real de persistência), dcce481 (assunto na alocação e filtro de histórico).
- main: 9046cfa, intocada. V1 não modificada.
- Dois worktrees (main e v2-f4); nenhum PR aberto; nenhum stash.
- Nenhuma Action, deploy ou push.

## Veredito

**Implementada, testada e revisada localmente; pronta para aceite humano.** Não declarar F4_ACCEPTED. A próxima ação é a avaliação humana deste relatório; depois, se aprovado, autorizar o push fast-forward da v2.

