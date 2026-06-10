# Handoff — Auditoria de abas + correções (2026-06-09)

## Contexto

Auditoria prática de todas as abas do app (Página Inicial, Study Organizer, Cronômetro, Calendário, Ciclo de Estudos, Dashboard, Revisões, Histórico, Hábitos, Editais, Ed. Verticalizado, Intelig. de Banca) com foco em bugs reais, fluxos quebrados, acessibilidade, mobile e performance. **Restrição absoluta respeitada: nenhum arquivo, fluxo, contrato ou teste de sync foi tocado** (`src/js/sync/`, `cloud-sync.js`, `drive-sync.js`, `credentials.js`).

Metodologia: 4 varreduras paralelas por grupo de abas → verificação manual de cada achado no código (vários achados dos agentes foram descartados como falsos) → correções TDD (red → green) → suíte completa.

## Bugs reais corrigidos (todos com TDD)

1. **Intelig. de Banca — filtros completamente quebrados** (`src/js/ui/actions/editais.js`)
   - `filtrar-view-por-disciplina`, `mudar-edital-analisador` e `carregar-analise-banca` eram registrados passando a função direto, mas o dispatcher chama `handler(element, event)` — as funções recebiam o **elemento** em vez de `el.value`/`el.dataset.discId`. Trocar o edital no select, filtrar por disciplina e clicar numa análise salva falhavam silenciosamente.
   - Fix: wrappers `(el) => fn(el.value)` / `(el) => fn(el.dataset.discId)`. Havia inclusive um teste consolidando o comportamento errado (`expect(handler).toBe(...)`) — atualizado.
   - Testes: `tests/unit/editais-actions.test.js` (+3 testes).

2. **Hábitos — crash ao salvar questões com disciplina removida** (`src/js/views/habitos-view.js:479`)
   - `getDisc(discId)` pode retornar `null` → `d.disc.nome` lançava TypeError e o registro não era salvo, sem feedback.
   - Fix: guard `if (d)` — salva sem `gabaritoPorDisc` quando a disciplina não existe mais.
   - Testes: novo `tests/unit/habitos-view-save.test.js` (2 testes: null e caminho feliz).

3. **Hábitos — handler morto `edit-habit`** (`src/js/ui/actions/habitos.js`)
   - Importava dinamicamente `editHabit`, que nunca existiu em `habitos-view.js` (lançaria TypeError se acionado). Nenhum markup usa `data-action="edit-habit"`. Removido; teste atualizado para garantir que NÃO é registrado.

4. **Ciclo — minutos por passo aceitava 0/negativo** (`src/js/views.js:updateSeqItem` + `ciclo-view.js:281`)
   - `parseInt(val) || 0` permitia alvo 0/negativo na edição da sequência. Clampado para ≥1 e `min="1"` no input. (Downstream em `logic/cycle.js` já era guardado com `Math.max(0,…)`, então o impacto era passo inútil, não crash.)
   - Testes: `tests/unit/views-crud-more.test.js` (+3 testes `updateSeqItem`).

5. **Editais — `deleteAula` quebrava com disciplina sem array `assuntos`** (`src/js/views/editais/aula-operations.js:99,105`)
   - Dados antigos/incompletos sem `assuntos` → TypeError ao excluir aula. Fix: `(d.disc.assuntos || [])` e `(d.disc.aulas || [])`.
   - Testes: novo `tests/unit/aula-operations-delete.test.js` (2 testes).

## Acessibilidade

6. **Ativação por teclado de cards clicáveis** (`src/js/ui/actions/dispatcher.js`)
   - Divs com `role="button"` + `tabindex="0"` (cards da Home) eram focáveis mas Enter/Space não fazia nada — o dispatcher só tratava click/change/input. Adicionada delegação `keydown` (Enter/Space) para `[data-action][role="button"]` não-nativos, sem duplicar ativação de botões nativos.
   - Testes: `tests/unit/actions-dispatcher.test.js` (+5 testes).
7. **Hábitos — cards inacessíveis por teclado** (`habitos-view.js`): `role="button" tabindex="0" aria-label="Registrar <hábito>"` nos `.habit-card`.
8. **Foco visível** (`src/css/base/accessibility.css`): regra `[role='button'][data-action]:focus-visible` com outline.
9. **Revisões — `aria-selected` não atualizava ao trocar de aba** (`revisao-view.js:switchRevTab`); também escopado o seletor para `.rev-tabs .tab-btn` (antes limpava `.tab-btn` global). Teste novo: `tests/unit/revisao-view-tabs.test.js`.
10. **Editais — botões icon-only sem `aria-label`** (`editais-view.js:371-377`): chevrons de mover, 📝, 🧠, ✏️, 🗑️ ganharam `aria-label`; ícones decorativos com `aria-hidden="true"`.
11. **Home — cards clicáveis com `aria-label`** (`home-view.js`).

## Achados de agentes DESCARTADOS após verificação (não corrigir de novo)

- `utils.js:69 formatDate` "timezone bug": **falso** — `new Date('YYYY-MM-DDT00:00:00')` sem sufixo Z é parseado como hora LOCAL por spec; o padrão está correto. Mesmo para o countdown em `home-view.js:176`.
- `planejamento-wizard.js` "listeners perdidos após renderStep": **falso** — os botões ficam fora de `#modal-planejamento-body`; `renderStep` não os recria.
- `ciclo-view.js:308` "null deref em `d.disc.icone`": **falso** — guard na linha 248 (`!getIsEditingSequence() && !d`) cobre o branch estático.
- `habitos.css` "grid sem media query": **falso** — overrides em `styles.css:647` (2 col) e `:886` (1 col).
- `delete-operations.js` "`delete e.assId` corrompe JSON": **não é bug** — propriedade ausente é equivalente a undefined nos consumidores.
- `revisao-view.js:23-28` cálculo de data: usa o padrão local correto (`getTime() - offset`).

## Observações registradas (não corrigidas — fora de escopo ou risco/benefício ruim)

- **Timer continua em background ao navegar entre abas** (`logic/timer.js`): aparenta ser intencional (sessão continua contando). Não tocado por ser adjacente ao fluxo crítico de sessões.
- `editais-crud.js:toggleEdital` re-renderiza a view inteira no expand/collapse — perf aceitável hoje; otimização cirúrgica fica como melhoria futura.
- Tabela do Ed. Verticalizado tem `overflow-x:auto` sem hint visual de scroll no mobile.
- `calcSimuladoPerc` silencioso quando total=0 (UX menor).
- Histórico mantém filtros persistidos sem indicador visual de "filtro ativo".

## Testes

- `npm test`: **96 arquivos, 1630 testes, 0 falhas** (inclui os 15 testes novos).
- `npm run test:css`: 31/31.
- eslint nos arquivos alterados: 0 erros (2 warnings pré-existentes de imports não usados em arquivo não relacionado à mudança).
- E2E não rodado: mudanças são correções pontuais cobertas por unit tests; nenhuma mudança de PWA/offline/sync. Validação manual de navegação recomendada no PR.

## Arquivos alterados

Fonte: `ui/actions/{dispatcher,editais,habitos}.js`, `views.js`, `views/{habitos-view,revisao-view,editais-view,ciclo-view,home-view}.js`, `views/editais/aula-operations.js`, `css/base/accessibility.css`.
Testes: `actions-dispatcher`, `editais-actions`, `habitos-actions`, `views-crud-more` (atualizados); `habitos-view-save`, `revisao-view-tabs`, `aula-operations-delete` (novos).

## GitHub

- Rodada 1: branch `claude/auditoria-abas-fixes`, commit `75d73c4` → **PR #76, mergeado em 2026-06-09**.
- Rodada 2: commit `060e61e` direto na `main` (o PR #76 já havia sido mergeado e o checkout local estava em `main`; suíte completa verde antes do push).

## Rodada 2 (mesma sessão, mesma branch)

12. **Hábitos — paginação confusa**: «⇉ Anterior» / «Próxima ⇆» (setas erradas) → «← Anterior» / «Próxima →».
13. **Hábitos — título do modal obsoleto**: trocar o tipo dentro do modal não atualizava o título; `selectHabitType` agora sincroniza. Teste novo: `tests/unit/habitos-view-ux.test.js`.
14. **Hábitos — percentual obsoleto no simulado**: apagar o total deixava o % antigo na tela; `calcSimuladoPerc` agora limpa. Mesmo arquivo de teste.
15. **Histórico — "Limpar filtros"**: filtros persistem entre navegações sem reset rápido; botão aparece na toolbar quando período≠30d, disciplina ou busca ativos. Ação `historico-clear-filters` em `ui/actions/eventos.js`. Testes em `eventos-actions.test.js` (+mocks de historico-view/components).
16. **Ed. Verticalizado — hint de scroll**: tabela de tópicos ganhou sombras de borda CSS (`.table-scroll-hint`, `background-attachment: local/scroll`) indicando colunas fora da viewport no mobile. Validação: test:css verde + validação manual recomendada.

Mais achados verificados como **falsos** na rodada 2: `toggleEdital` já faz update cirúrgico de DOM (não re-renderiza tudo); trocar modo mês/semana no Calendário **preserva** a data navegada (`setCalViewMode` não toca `calDate`).

Suíte após rodada 2: **97 arquivos, 1634 testes, 0 falhas**; test:css 31/31; eslint 0 erros.

## Rodada 3 (loop contínuo — PR #78)

17. **Erros de console no boot** (achados via smoke E2E do mock):
    - `logic/timer.js`: `new Audio(CDN)` top-level baixava mp3 remoto em todo boot + violação CSP onde `media-src 'self'`. Audio agora lazy no primeiro `play()` (mesma API). Testes em `logic-timer.test.js`.
    - `sw-register.js`: `reg.addEventListener is not a function` com stub mínimo de registration (ambiente mock). Guards tipados (`checkForUpdate`). Teste em `sw-register.test.js`.
    - Validação: smoke-critical mock 2/2, gate mock 10/10, chromium 27/27, npm test 1637 verdes.

Auditoria de contratos `data-action`×`registerAction`: **íntegra** (nenhuma ação usada sem handler). Registros sem uso no markup: `clear-search`, `open-event-from-calo`, `restore-backup` (alias morto de `open-restore-preview`) — limpeza opcional de baixo valor; `sync-center-smart-sync` e `toggle-global-sync` são de sync, **não tocados**.

**Pré-existente (fora de escopo)**: 12 specs de `app.spec.js` falham no projeto **mock** (paridade do ambiente; vários são de sync). Chromium passa 27/27. Gate oficial do mock (`mock-environment.spec.js`) verde.

18. **A11y — Calendário (semana) e Cronômetro**: chips de evento da view semanal eram `<div>` clicáveis (sem teclado) → agora `<button>` como na view de mês; "+" do dia da semana ganhou `aria-label`/`title`; botões ±5min e input de meta do Cronômetro Livre ganharam `aria-label`. Validação: calendar-view/components unit 48 verdes + `calendar.spec.js` chromium 4/4.
19. **Editais — `editLessonInline` tolera disciplina removida**: mesmo null-deref de `getDisc` já corrigido em `deleteAula`/`saveHabit`. Demais call-sites de `getDisc` auditados — todos guardados (classe de bug fechada). Teste novo: `tests/unit/inline-editing-guards.test.js`.
20. **Limpeza**: registros de ação mortos removidos (`open-event-from-calo`, `clear-search` — nenhum markup os usava). `restore-backup` mantido (contrato em `import-export-contracts.test.js`); ações de sync intocadas.
21. **Validação E2E ampla (chromium)**: app+smoke 27/27, calendar 4/4, revisões/hábitos/sessões/timer/editais 11/11, dashboard/ciclo/crud/persistência/revision-flow 45/45 — todas as abas do menu cobertas por E2E verde após as mudanças.
22. **Ciclo — guards de índice NaN** em `dup/rem/move-seq-item` (`ui/actions/planejamento.js`): `splice(NaN,1)` removeria o primeiro passo da sequência com `data-index` inválido; `update-seq-item` já tinha o guard. +3 testes.

Sondagens finais sem achados (codebase saudável): listeners em render (delegação ok), `setInterval` fora do timer (crono singleton auto-guardado; engine de notificações com clear antes de set), call-sites de `getDisc` todos guardados.

24. **`saveEvent` valida data vazia** (`ui/event-modals.js`): evento salvo com `data: ''` ficava invisível no Calendário e no MED (indexados por data) — "evento fantasma" no state. Agora rejeita com toast, em criação e edição. +2 testes em `event-modals-edit.test.js`.
25. **`savePastEvent` tolera disciplina removida**: mesmo null-deref de `getDisc` (classe já fechada nos outros módulos); agora rejeita com toast. +1 teste.

Specs de busca do mock também confirmadas como ambientais: `seedLegacyState` + `goto('/')` → o reset-on-load do mock apaga o seed do teste antes do app ler.

23. **Causa-raiz das 12 falhas do mock em `app.spec.js` resolvida**: o servidor mock em modo `reset` (default) **apaga o IndexedDB e re-seeda a cada page load** (`scripts/mock-inject.mjs`), então specs de "persiste após reload" não podem passar nesse projeto por design — não são bugs do app. Fix de tooling: `test:e2e:quick` agora é escopado a `--project=chromium` (era o comando documentado que gerava as falhas espúrias); `test:e2e:all`/`test:e2e:mock:all` mantêm a matriz completa para investigação de paridade. README_DEV atualizado.

26. **Calendário — navegação por teclado no grid mensal (roving tabindex)**: células `.cal-cell` agora têm `role="button"`, `aria-label` ("D de mês, N evento(s)") e tabindex rotativo — um único Tab-stop entra no grid (hoje, ou 1º dia do mês), setas movem o foco entre células e Enter/Space seleciona o dia (via delegação keydown do dispatcher já existente). Handler exportado `handleCalGridKeydown` em `calendar-view.js` + 5 testes. E2E calendar+smoke 6/6.

27. **Temas — contraste AA do `--text-muted`**: 5 dos 6 temas premium reprovavam WCAG AA (4.5:1) sobre `--card` — ardosia 3.73, platina 3.92, terminal 4.50⁻, neon 4.09, arrakis 3.82. Tokens clareados preservando o matiz (todos ≥4.55 agora). Teste de regressão novo `tests/unit/theme-contrast.test.js` (audita muted e secondary de todos os temas) + script `scripts/check-theme-contrast.mjs` para auditoria manual. `grafite` já passava (5.09).

28. **Smoke E2E ampliado (commits `667c008`, `096ca30` na main)**: (a) overflow horizontal mobile agora é verificado **por view** (12 views em 390px) e a view `vertical` entrou no sweep de erros de console (estava fora das listas); (b) novo teste com **dados populados e nomes longos** (edital/disciplina/tópico/evento extensos) navegando as 11 views de conteúdo — tudo passa hoje; fica como rede de regressão de layout mobile.
29. **E2E chromium completo validado**: full-study-flow, offline-import, phase6-chaos, planejamento e ciclo-step-flow 20/20 — toda a superfície E2E não-sync verde.

Nota: `Abrar_Estudo_Organizado_Mock.bat` (typo de `Abrir_`) existe na raiz mas **não é rastreado pelo git** — arquivo local do usuário, não tocado.

## Rodada 4 — validação manual headed + bug sistêmico de instâncias duplas

30. **BUG GRAVE encontrado e corrigido — módulos com instância dupla**: `views.js` importava 7 módulos **sem** `?v=8.37` (`banca-view`, `historico-view`, `calendar-view`, `habitos-view`, `ciclo-view`, `config-view`, `event-modals`) enquanto actions/components importavam **com** — o browser cria DUAS instâncias com estado de módulo separado. Sintoma comprovado: entrar direto na Intelig. de Banca e filtrar por disciplina retornava vazio (o render usava uma instância, os handlers mutavam outra; só funcionava depois de trocar o edital, que transferia a posse do DOM). Mesma ameaça pairava sobre `editingEventId` (edição de evento), paginação do Histórico e listener de teclado do Calendário. Fix: specifiers alinhados (+ `migrations.js`→utils, `dispatcher/dialog`→debug). **Guard-rail permanente**: `tests/unit/module-specifier-consistency.test.js` (varredura estática; exclui `sync/`). Import sem `?v` remanescente apenas em `sync/firestore-sync-engine.js` (não tocado — restrição).
31. **Validação manual headed (Playwright)**: `scripts/manual-validation.mjs` — 15/15 PASS com screenshots em `test-results/manual-validation/`: fluxos da Banca (trocar edital, filtrar disciplina, abrir análise salva), teclado do Calendário (tabindex único, setas, Enter), 6 temas com contraste AA medido em runtime, `toggleEdital` a ~0,2ms/click (cirúrgico, sem problema de perf — observação antiga do handoff superada), zero erros de console.
32. **E2E do Analisador de Banca**: nova `tests/e2e/banca-analyzer.spec.js` (3 specs) cobrindo os fluxos de select — foi ela que **revelou** o bug das instâncias duplas (a validação manual mascarava, pois trocar o edital "consertava" a tela). Release gate completo: **137/137** chromium.
33. **Paridade do mock (test:e2e:mock equivalente, sem specs de sync)**: 29 falham / 32 passam nos 6 arquivos não-sync. Conclusão definitiva: o injetor do mock (`mock-inject.mjs`, modo `reset`) limpa localStorage/IndexedDB DEPOIS do `addInitScript` dos testes — toda spec que pré-semeia estado ou exige persistência pós-reload falha **por design**; as que passam constroem dados via UI sem reload. Não é bug do app. Recomendação registrada: se quiser paridade ampla um dia, rodar o servidor mock com `MOCK_MODE=preserve` para a suíte exploratória (não implementado — infra do mock toca o stub do Firebase, adjacente a sync).

## Rodada 5 (sessão 2026-06-10, direto na main)

34. **Histórico — "Limpar filtros" não cancelava o debounce da busca** (`ui/actions/eventos.js`): digitar e clicar em Limpar em <250ms deixava o timer antigo reaplicar a busca obsoleta e roubar o foco. Fix + 2 testes (fake timers) em `eventos-actions.test.js`. Commit `3ad0691`.
35. **Dashboard — cópia duplicada de `toggleAulaDashboard` removida** (`dashboard-view.js`): divergia da canônica (`editais-crud.js`, a usada pelas actions via views.js) — não preservava scroll do painel nem interrompia o loop. Guard em `views-modules.test.js`; imports órfãos limpos. Commit `0fbf5d2`.
36. **Views — cópia legada de `getFilteredVertItems` removida** (`views.js`): ignorava edital global, disciplinas arquivadas e busca normalizada; zero call sites (a real é a de `editais-view.js`). Removidos também `onVertSearch` e vars `vert*` mortas. **Guard-rail novo**: `tests/unit/duplicate-exports.test.js` — varredura estática que falha se uma função exportada ganhar segunda definição (allowlist comentada para wrappers legítimos: `esc`, `createExportableState`, `runMigrations`, `pwRenderWeightPreview`, `openModal`/`closeModal`, firebase-config local). Commit `435261a`.

Achados verificados como **falsos** na rodada 5 (de varredura por agentes): `saveEvent` duração NaN (campo é `<select>` com valores controlados); `savePastEvent` duração negativa (validação `duracao <= 0` na linha 437 já cobre); `registro-sessao.js:420` deref de `eventToDelete` (early-return na linha 414 cobre); `add-minutes` NaN (data-minutes hardcoded no markup).

**Observação registrada (decisão pendente, não corrigida)**: `ui/dialog.js` exporta `openModal`/`closeModal` com pilha de modais + restauração de foco, mas **ninguém os importa** — o app usa os de `app/modals.js` (sem restauração de foco). Migrar seria ganho de a11y, mas é mudança de comportamento em todos os modais (médio risco); só `initModals`/`announce` do dialog.js são usados hoje.

Suíte após rodada 5: **101 arquivos, 1667 testes, 0 falhas**. Push feito (`291fbcf..435261a`).

## Próximos passos sugeridos

1. Validação manual no navegador: aba Intelig. de Banca (trocar edital no select, filtrar disciplina, abrir análise salva — fluxos que estavam quebrados); Tab+setas+Enter no grid do Calendário; conferência visual dos 5 temas com `--text-muted` clareado.
2. Avaliar as observações não corrigidas acima (perf do toggleEdital).
3. Se desejar, subir cobertura E2E para o fluxo do Analisador de Banca (não existia teste que pegasse o wiring quebrado).
4. Investigação de paridade do ambiente mock (apenas se houver interesse): rodar `test:e2e:mock:all` e decidir se as specs de persistência devem ser excluídas do projeto mock via `testIgnore`.
