# Estudo Organizado V2 — F3: saneamento final e candidato à integração

**Data:** 2026-10-29
**Branch:** `v2` (worktree isolado; `main` da V1 intocada)
**Gate proposto:** `F3_READY_FOR_INTEGRATION_REVIEW`
**Estados:** IMPLEMENTED · TESTED · REVIEWED · **NOT_INTEGRATED_TO_ORIGIN_V2** · **NOT_ACCEPTED** · **NOT_PUBLISHED**

> Este é o registro singular da F3. Não houve push, merge em `main`, deploy, Firebase, emulador ou sync real nesta fase.

## 1. Baseline e HEADs

Preflight executado neste worktree em 2026-10-29. O comando `git fetch origin --prune=false` do GOAL foi rejeitado por esta versão do Git (`option 'prune' takes no value`); a substituição segura foi `git fetch origin`, sem prune, com exit 0.

| Item | Valor |
| --- | --- |
| Worktree | `C:\Users\slvma\.codex\worktrees\v2-f3-planning\estudo-organizado` |
| Branch | `v2` |
| HEAD de código/teste | `6183b5d` (antes deste relatório) |
| HEAD documental | commit que contém este arquivo — consultar `git log -1 -- docs/superpowers/audits/2026-10-29-v2-f3-acceptance.md` |
| `origin/v2` | `5eba778` |
| `main` local/remota | `9046cfa` — inalterada |
| Ancestralidade | `git merge-base --is-ancestor origin/v2 HEAD` → exit 0 |
| Árvore | limpa antes deste commit documental |
| Stashes | nenhum |
| PRs abertos | 0 |
| Worktrees | principal (`main`) e este worktree (`v2`); sem órfãos |
| Caminhos V1 | `git diff --name-status origin/main...HEAD -- src firestore.rules .github wrangler.jsonc worker package.json` vazio |
| Commits exclusivos | 25 antes deste relatório (23 de código/teste + 2 documentais); 26 com o commit final deste relatório |

O HEAD é citado por função para evitar SHA circular: o código revisado termina em `6183b5d`; o relatório é o commit seguinte, verificável pelo comando acima.

## 2. Entregas e cobertura das 11 funcionalidades F0

| F0 | Estado | Implementação e prova |
| --- | --- | --- |
| `F-V1-STUDY-ORGANIZER` | IMPLEMENTED/TESTED | cenários, blocos e agenda derivada (`planning.ts`, `planning-queries.ts`, `PlanningWorkspace`); `f3-scenarios`, `f3-calendar` |
| `F-V1-CALENDAR` | IMPLEMENTED/TESTED | dia/semana/mês com janela móvel e capacidade; `f3-calendar`, `f3-planning-flow`, `f3-journey` |
| `F-V1-CYCLE` | IMPLEMENTED/TESTED | cursor explícito, decisões e projeção; `f3-cycle`, `f3-cycle-projections`, `f3-planning-flow` |
| `F-V1-PLANNING-WIZARD` | IMPLEMENTED/TESTED | wizard determinístico com prévia, múltiplas disciplinas e persistência local; `f3-generator`, `f3-planning-flow`, `f3-journey` |
| `F-V1-RF-OVERVIEW` | IMPLEMENTED/TESTED | Reta Final com data civil, capacidade e não alocados; `f3-final-stretch`, `f3-journey` |
| `F-V1-RF-IMPORT` | IMPLEMENTED/TESTED | importação V1/V2 conservadora com prévia, recibo e reconciliação; `f3-import`, `f3-import-commit` |
| `F-V1-RF-EDITOR-PLANNER` | IMPLEMENTED/TESTED | editor por bloco/lote, rascunho durável e commit transacional; `f3-drafts`, `f3-editor-ui` |
| `F-V1-RF-HISTORY` | IMPLEMENTED/TESTED | checkpoints, journal, compensação e retenção; `f3-history` |
| `F-V1-RF-CONFLICTS` | IMPLEMENTED/TESTED | CAS transacional, merge três-vias e resolução explícita; `f3-merge`, `f3-two-tabs`, `f3-editor-ui` |
| `F-V1-RF-PORTABILITY` | IMPLEMENTED/TESTED | exportação seletiva e roundtrip sem vazamento; `f3-import`, `f3-portability-ui` |
| `F-V1-RF-REDISTRIBUTION` | IMPLEMENTED/TESTED | redistribuição assistida com prévia e confirmação; `f3-redistribution`, `f3-redistribution-ui` |

## 3. Matriz F3-T01..T42

| ID | Status | Prova |
| --- | --- | --- |
| T01 múltiplos cenários | PASS | `f3-scenarios.test.ts` |
| T02 um ACTIVE + troca atômica | PASS | `f3-scenarios.test.ts` (swap + guardas), `f3-scenarios.spec.ts` |
| T03 múltiplos editais/capacidade global | PASS | `f3-capacity.test.ts`, `f3-generator.test.ts` |
| T04 inativo não consome | PASS | `selectOfficialReservations` + `f3-capacity` |
| T05 CivilDate estável | PASS | `f3-time.test.ts` |
| T06 DST gap/fold | PASS | `f3-time.test.ts` |
| T07 recorrência/meia-noite | PASS | `f3-time` + `f3-capacity` (22:00–02:00 em dois dias) |
| T08 prioridade determinística | PASS | `f3-priority.test.ts` |
| T09 revisão do perfil fixada | PASS | `f3-priority.test.ts` |
| T10 draft sobrevive a reload | PASS | `f3-drafts.test.ts`, `f3-editor-ui.spec.ts` |
| T11 apply atômico/idempotente | PASS | `f3-drafts`, `f3-commit` |
| T12 quota sem perda | PASS | `f3-commit`, `f3-drafts`, `f3-failure.spec.ts` |
| T13 merge 3-way | PASS | `f3-merge.test.ts` |
| T14 delete vs edit | PASS | `f3-merge.test.ts` |
| T15 CAS duas abas | PASS | `f3-two-tabs.spec.ts` |
| T16 import V1 sem versões | PASS | `f3-import.test.ts` |
| T17 import repetido sem duplicar | PASS | `f3-import-commit` (recibo idempotente), `f3-import` (EQUIVALENT) |
| T18 divergente preservado | PASS | `f3-import` (DIVERGENT) + bloqueio de reconciliação |
| T19 homônimo sem auto-merge | PASS | `f3-import` (AMBIGUOUS), `f3-content-links` |
| T20 Ciclo sem prova | PASS | `f3-cycle.test.ts` |
| T21 continuar/adiar/pular/avançar | PASS | `f3-cycle.test.ts` |
| T22 projeção no horizonte | PASS | `f3-cycle-projections.test.ts` |
| T23 fixação preservada | PASS | `f3-cycle-projections.test.ts` |
| T24 Reta Final exige data | PASS | `f3-final-stretch`, `f3-scenarios` (ativação bloqueada sem data) |
| T25 transição preserva histórico | PASS | `f3-final-stretch` + `f3-final-stretch-ui.spec.ts` (Ciclo preservado) |
| T26 adiar/antecipar/suspender | PASS | `f3-final-stretch`, `f3-final-stretch-ui.spec.ts` |
| T27 prova vencida não presumida | PASS (com nota) | `EXPIRE_CHECK` e encerramento exigem desfecho explícito; não há encerramento automático. A UI não exibe banner de vencimento. |
| T28 exceções/dias zero | PASS | `f3-capacity.test.ts` |
| T29 sobreposição sem desconto duplo | PASS | `f3-capacity` (OVERLAP, ocupação única, `remaining=0`) |
| T30 `UNALLOCATED` sem perda | PASS | `f3-capacity`, `f3-generator`, `f3-redistribution` |
| T31 F2 arquivado/órfão | PASS | `f3-content-links.test.ts` |
| T32 undo/restore não altera F4 | PASS | `f3-history` (`executionFacts`) |
| T33 checkpoints/journal/dependências | PASS | `f3-history` + retenção |
| T34 roundtrip semântico | PASS | `f3-import` (export→parse→EQUIVALENT) |
| T35 sem vazamento | PASS | `f3-import` (regex de tokens/outbox) |
| T36 sessão parcial/avulsa | PASS | `f3-f4-contract.test.ts` |
| T37 sessão multi-edital única | PASS | `f3-f4-contract.test.ts` (60 min) |
| T38 180 blocos íntegros | PASS | `f3-limits`, `f3-load` (180 persistidos, 30 dias no mês) |
| T39 ≥360 + falha segura | PASS | `f3-limits` (360 sem truncar, teto falha fechado) |
| T40 desktop/tablet/mobile, 8 temas, offline, a11y | PASS | `f3-journey` (3 viewports), `f3-a11y`, `f3-a11y-states`, `f3-offline`, capturas §5.4 (gerador sob flag) |
| T41 V1/main preservadas | PASS | diff de caminhos protegidos vazio + `architecture-boundary` |
| T42 fake ≠ sync real | PASS | outbox F3 `deliveryMode: BLOCKED`, `delivery-policy`, `f3-commit` |

## 4. Matriz D-F3-01..26

| Decisão | Prova |
| --- | --- |
| D01 múltiplos cenários | `f3-scenarios` |
| D02 um ACTIVE com checkpoint | `f3-scenarios` (swap + guardas), `f3-history` |
| D03 capacidade global | `f3-capacity`, `f3-generator` (reservas de outros editais) |
| D04 CivilDate/IANA/Instant | `f3-time` |
| D05 histórico compensatório | `f3-history` (`previewCompensation`) |
| D06 prioridades explicáveis | `f3-priority` (explicação por critério) |
| D07 perfis versionados | `f3-priority` (`nextPriorityRevision`) |
| D08 draft separado | `f3-drafts` |
| D09 import com identidade/proveniência | `f3-import`, `f3-import-commit` |
| D10 merge granular/CAS | `f3-merge`, `f3-two-tabs` |
| D11 Ciclo vs Reta Final | `f3-cycle`, `f3-final-stretch` |
| D12 replanejamento de prova | `f3-final-stretch` + E2E |
| D13 cursor explícito | `f3-cycle` |
| D14 projeção com fixações | `f3-cycle-projections` |
| D15 continuidade por assunto/aula | `f3-cycle` |
| D16 identidades F2 | `f3-content-links` |
| D17 disponibilidade/exceções | `f3-capacity` |
| D18 blocos com data/duração | `planning.ts` + `f3-planning-domain` |
| D19 contrato F4 parcial/avulso | `f3-f4-contract` |
| D20 contagem única entre editais | `f3-f4-contract` |
| D21 encerramento assistido | `closeFinalStretch` + UI (desfecho obrigatório) |
| D22 exportação seletiva | `f3-import` (export) |
| D23 wizard determinístico | `f3-generator`, `f3-journey` |
| D24 horizonte/limites medidos | `f3-limits` + §5.3 |
| D25 retenção seletiva | `planRetention` + `f3-history` |
| D26 aceite por riscos/evidências | este relatório + revisão §6 |

## 5. Testes e evidências

### 5.1 Gates finais (HEAD de código `6183b5d`)

| Gate | Comando | Resultado |
| --- | --- | --- |
| typecheck | `npm --prefix apps/v2 run typecheck` | PASS (exit 0) |
| lint | `npm --prefix apps/v2 run lint` | PASS (exit 0, 0 problemas) |
| unit | `npm --prefix apps/v2 run test:unit` | PASS 297/297 em 50 arquivos |
| E2E | `npm --prefix apps/v2 run test:e2e` | PASS 77 + 1 skip (78 specs: 50 F1/F2 + 28 F3; o skip é o gerador de capturas) |
| build | `npm --prefix apps/v2 run build` | PASS (376,84 kB JS / 109,32 kB gzip) |

Baseline anterior à F3: 188 unit e 50 E2E verdes após a correção de tipos (`1c758a1`). O histórico de lint passou de 2 warnings (revisão inicial) a 0 problemas na execução final; o valor anterior fica registrado como histórico, não como estado atual.

### 5.2 F3-T40 — jornada, temas, acessibilidade e offline

| Critério | Evidência | Resultado |
| --- | --- | --- |
| Desktop 1280×900 | `f3-journey.spec.ts` — wizard→calendário→rascunho→conflito→Reta Final→export/import | PASS |
| Tablet 834×1112 | idem, mesmo fluxo | PASS |
| Mobile 390×844 | idem, mesmo fluxo; overflow horizontal ≤1 px | PASS |
| Oito temas | `f3-a11y` + `f3-a11y-states` (grafite, ardósia, platina, terminal, neon, arrakis, codex, plasma) | PASS |
| Contraste texto comum | ≥4,5:1 medido por cor computada + luminância WCAG; pior caso `heading` 15,24:1 (ardósia) | PASS |
| Contraste botão habilitado | 15,39:1 a 16,45:1, variando por tema (botão temado, não o padrão do navegador) | PASS |
| Contraste da borda do controle | 3,29:1 a 3,44:1 (token `--control-border` composto sobre o fundo) | PASS |
| Contraste mensagem de erro/status | pior caso 15,24:1 | PASS |
| Disabled (isento pelo WCAG 1.4.3, meta de produto ≥3:1) | 6,50:1 a 7,48:1 após corrigir o fundo nativo do Chromium | PASS |
| Foco visível | anel sólido de 3 px em `var(--accent)`, contraste medido 6,91:1 a 7,34:1 | PASS |
| Teclado/ordem/labels | 40 tabs cobrem wizard e calendário; sem prisão de foco; `aria-pressed` nas visões | PASS |
| Alvos touch ≥44 px | `f3-a11y` mede `calendar-day`, `preview-generation`, `preview-redistribution` com `hasTouch` | PASS |
| Reduced motion | transição real de 120 ms vira ≤0,01 ms sob `prefers-reduced-motion: reduce` (teste mede os dois modos) | PASS |
| Zoom/overflow | zoom 200% (1280→640 px) sem overflow e sem clipping interno | PASS |
| Offline/PWA | `f3-offline.spec.ts`: reload offline mantém cenário e rascunho; edição offline responde “salvo neste dispositivo” | PASS |

Método: Playwright 1.64.1 (Chromium headless shell 1248), build `build:e2e` + `vite preview` em `127.0.0.1:18431`, dados sintéticos. As amostras de contraste são calculadas no próprio navegador (cor computada + composição alfa + luminância relativa WCAG) e impressas no log do teste (`F3_CONTRAST_SAMPLES`, `F3_FOCUS_RING`).

### 5.3 Desempenho medido

Ambiente: Windows 11 Pro 10.0.26300, Intel Core i5-13450HX (10 núcleos/16 threads), 15,7 GiB de RAM, Chromium headless do Playwright.

| Medida | Resultado |
| --- | --- |
| Commit de 180 blocos no IndexedDB | 31,2 ms (`f3-load`) |
| Geração de 180 blocos | < 3 s (asserção `f3-limits`) |
| Geração de 360 blocos | sem truncamento (360 contabilizados) |
| Teto medido excedido | falha fechada (`GenerationLimitError`), sem truncar |
| Hardware modesto real | **NOT_RUN** — nenhum aparelho modesto disponível; ressalva explícita |

### 5.4 Capturas representativas

10 PNGs em `docs/superpowers/audits/evidence/2026-10-29-f3-t40/` (~953 kB): `desktop-<tema>.png` para os oito temas, `tablet-834.png` e `mobile-390.png`, regenerados após o ajuste de tema dos botões. O spec `f3-t40-evidence.spec.ts` fica **skip por padrão** e só grava com `F3_T40_CAPTURE=1`, para não sujar o worktree em execuções normais.

## 6. Revisão independente

### 6.1 Rodada 1 — `5eba778..6e06f62`

Revisor independente (contexto novo, somente leitura): `CHANGES_REQUIRED`, 0 P0 / 8 P1 / 9 P2. Confirmou sólidos o CAS dentro da transação, a atomicidade, o bloqueio de entrega do outbox, a migração aditiva e os contratos de data/fuso. Correções em `bd6508e` (calendário, suspensão, ativação, capacidade global, sobreposição, escopo F2, falha parcial do wizard, import sem identidade e 6 P2).

### 6.2 Rodada 2 — `6e06f62..bd6508e`

Confirmou 12 de 14 correções e apontou 2 P1 (capacidade global não chegava ao wizard/redistribuição; ativação aceitava Reta Final suspensa sem data). Corrigidos em `674ca48`, com testes dedicados.

### 6.3 Rodada 3 — parecer

Sobre `bd6508e..674ca48`: **APPROVE_FOR_HUMAN_REVIEW**, sem bloqueio material; reexecutou typecheck, 295 unit e 70 E2E. Três observações não bloqueantes (capacidade na transição, substituição do plano vigente, aviso falso no relink) foram corrigidas em `a98ed56`.

### 6.4 Rodada 4 — commits posteriores ao parecer (`674ca48..c08da7c`)

Revisor novo (contexto limpo, somente leitura), focado nos testes F3-T40 e nos caminhos críticos alterados depois do APPROVE. **Veredito: `CHANGES_REQUIRED`** — 0 P0, 1 P1 e 7 P2. Confirmou sem regressão: CAS transacional, drafts/merge, wizard/redistribuição, ativação, import/export, outbox `BLOCKED`, DST/CivilDate, alvos 44 px e ARIA labels.

| Achado | Correção | Prova |
| --- | --- | --- |
| P1: transição tratava `capacityReservations` como substituição e superalocava o dia (300 min em 180) | `projectCycle` soma os blocos fixos próprios às reservas dos demais cenários, deduplicando por `profileId::id` | `f3-final-stretch`: dono 120 min + outro edital 60 min → 0 projetados novos, 3 `UNALLOCATED`, dia ≤180 |
| P2: botões habilitados usavam o estilo claro padrão do navegador | tema base `var(--card)/var(--text)/var(--border)` e hover por token | contraste por tema 15,64–16,45 e fundo variando nos 8 temas |
| P2: anel de foco preto com 1,18:1 nos botões | `outline: 3px solid var(--accent)` | contraste do anel 6,91–7,34 em todos os focos medidos |
| P2: reduced motion/zoom passavam de forma vazia | transição real de 120 ms + media query `reduce` (0,01 ms); zoom 200% com checagem de clipping | teste mede os dois modos e varre `scrollWidth > clientWidth` |
| P2: jornada com asserções fracas | passou a exigir cenário `ACTIVE`, 30 dias no mês com conteúdo, conflito resolvido em 90 min e cenário importado pelo nome | `f3-journey` |
| P2: falha de ativação no wizard era ignorada | `createFromWizard` verifica `activateScenario` e informa o estado real | E2E de ativação |
| P2: evidência não hermética | gerador de capturas sob `F3_T40_CAPTURE=1` (skip padrão) | suíte normal 77 PASS + 1 skip |
| P2: relatório defasado | este arquivo, reescrito com matrizes e HEAD corretos | §1, §3–§5 |
| P2: teste do P1 usava janela de 120 min e blocos sobrepostos | teste refeito com 180 min e blocos 08–10 + 10–11; sem `capacityBlocks` sobraria 60 min e 1 unidade seria projetada | `f3-final-stretch`: 0 PROJECTED / 3 UNALLOCATED |
| P2: borda de controle com 1,26–1,39:1 | botão usa `--control-border`; teste mede a borda composta sobre o fundo | 3,29–3,44:1 nos 8 temas |

Também corrigido: a data de início da transição/redistribuição passou a usar `America/Fortaleza` (`todayInZone`) em vez do dia UTC do dispositivo.

### 6.5 Verificação final dos ajustes

O mesmo revisor verificou `c08da7c..6183b5d` (teste do P1 e borda de controle) e respondeu **`APPROVE_FOR_INTEGRATION_REVIEW`**, sem bloqueio remanescente.

## 7. Integridade e segurança

- Migração IndexedDB v2→v3 aditiva; F1/F2 preservados (`f3-schema`).
- Outbox única com envelopes F3 discriminados e `deliveryMode: 'BLOCKED'`; `canDeliver` recusa tipos de planejamento.
- CAS lido **dentro** da transação em `commit`, `activateScenario` e checkpoints; quota/abort sem efeito parcial.
- Draft é staging separado; falha não apaga plano nem rascunho.
- Nenhuma sessão F4 persistida; apenas fixtures de contrato.
- Exportação com whitelist de campos; teste rejeita tokens/UID/outbox/sessões.
- `main`, `src/` da V1, `firestore.rules`, `.github/**`, `wrangler.jsonc`, `worker/` e `package.json` raiz sem diff.

## 8. Higiene Git/GitHub

| Item | Estado |
| --- | --- |
| `main` | `9046cfa` — inalterada local e remotamente |
| `origin/v2` | `5eba778` — sem push |
| Commits exclusivos | 22 de código/teste + este relatório |
| Worktrees | principal + este; sem órfãos |
| Stashes | nenhum |
| PRs | 0 abertos |
| Branches documentais | `2a2736c` e `cfe4a25` preservadas |
| Workflows | somente `auto-cache-bump.yml`, gatilho `push` em `main`; push em `v2` não aciona CI |
| Destruição | nenhuma |

## 9. Limitações e ressalvas

1. **Hardware modesto:** desempenho medido apenas neste desktop; `NOT_RUN` em aparelho modesto.
2. **F7/F8 fora de escopo:** sync real, Firebase/emulador, backup produtivo e cutover permanecem `NOT_RUN`; nenhuma homologação remota é afirmada.
3. **F2 com ressalvas:** as três lacunas F2→F7 e `F2-T22 NOT_RUN` continuam abertas.
4. **T27:** o encerramento exige desfecho explícito, mas a UI não exibe banner automático de prova vencida.
5. **Aceite:** qualquer veredito de aceite é humano e separado da integração.

## 10. Gate humano de integração

| Item | Valor |
| --- | --- |
| Candidato local | `6183b5d` (código/teste) + commit documental deste relatório |
| Remoto | `origin/v2` = `5eba778` |
| Ancestralidade | `git merge-base --is-ancestor origin/v2 HEAD` → exit 0 |
| Commits a enviar | 26 (23 de código/teste + 3 documentais) |
| Arquivos afetados | `apps/v2/**`, `docs/superpowers/**` |
| Testes finais | 297 unit, 77 E2E + 1 skip, typecheck/lint/build PASS |
| Revisor | parecer final em §6 |
| Actions/deploy | nenhum gatilho para `v2`; sem deploy |
| `main`/V1 | intactas |
| Itens não integrados | a própria `v2` (20+ commits), branches documentais antigas preservadas, 0 PRs |

**Decisão solicitada:** autorização expressa para `git push origin v2` do candidato acima (fast-forward, sem `--force`, sem merge em `main`). Este relatório **não** autoriza push, aceite, deploy ou exclusões.
