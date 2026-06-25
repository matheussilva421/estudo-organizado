# Handoff — Remediação da Critique Impeccable

> **Handoff incremental.** Entrada mais recente no topo. Plano-mestre:
> `docs/plans/2026-06-25-impeccable-critique-remediation-plan.md`.
> Branch: `fix/impeccable-critique-remediation`.

## Estado geral

| Fase | Status |
|------|--------|
| 0 — Preparação, baseline e guardrails | ✅ concluída |
| 1 — Fundação de cor semântica + tokens | ✅ concluída |
| 2 — Unificar stat cards (cor semântica) | ✅ concluída |
| 3 — Primeiro acesso & escopo | ⬜ |
| 4 — Acessibilidade | ⬜ |
| 5 — Side-stripes + movimento/perf | ⬜ |
| 6 — Minors + polish + re-critique | ⬜ |

**Baselines (início, 2026-06-25):**
- Detector (`detect.mjs --json src`): **258** achados (234 advisory, 24 warning, 0 erros).
- Testes unit: **1857 passed / 113 files** (antes da Fase 0). Após Fase 0: **1888 / 114**.
- Contraste WCAG: corpo AA OK nos 6 temas; única exceção `arrakis danger/card = 4.42` (corpo pequeno) — alvo da Fase 4.

---

## Fase 2 - Stat cards semanticos e vermelho-para-pendente (2026-06-25 20:05 -03)

**Resumo:** Fase 2 concluida com TDD. Os stat cards do Dashboard deixaram de usar classes genericas/decorativas (`green/blue/orange/red`) e passaram a usar categorias semanticas (`stat-card--tempo`, `--sessoes`, `--questoes`, `--simulados`). A Home recebeu o mesmo vocabulario de categoria nos KPIs principais. "Aulas Pendentes" agora usa detalhe neutro, reservando `--danger`/`--negative` para erro real. Habitos ganhou hierarquia visual: 3 cards-chave (`questoes`, `paginas`, `videoaula`) e 6 cards de apoio.

**Arquivos alterados:**
- `src/js/views/dashboard-view.js` - classes dos 4 stat cards trocadas para categorias semanticas.
- `src/css/components/cards.css` - mapeamento dos stat cards para tokens por categoria (`--info`, `--success`, `--question`, `--warning`, neutro).
- `src/js/views/home-view.js` - KPIs lifetime com classes de categoria e "Aulas Pendentes" com `dashboard-stat-detail--neutral`.
- `src/css/views/dashboard.css` - `positive/negative` agora apontam para `--success/--danger`; novo `--neutral`.
- `src/js/views/habitos-view.js`, `src/css/views/habitos.css` - tiers `habit-card--key/supporting`, `data-habit-tier` e hierarquia visual.
- `src/js/utils.js` - `HABIT_TYPES` alinhado a categoria: questoes/sumulas `--question`, simulado `--warning`, videoaula `--info`, paginas/leitura neutro.
- `DESIGN.md` - regra "cor de stat = categoria de dado, nao decoracao".
- `tests/unit/views-dashboard.test.js`, `tests/unit/home-view-stat-semantics.test.js`, `tests/unit/habitos-view-ux.test.js` - regressao TDD da fase.

**TDD / validacao:**
- Vermelho: `npx vitest run tests/unit/views-dashboard.test.js tests/unit/home-view-stat-semantics.test.js tests/unit/habitos-view-ux.test.js -t "semantic stat categories|pending lessons|habitos-chave"` falhou nos 3 contratos novos.
- Verde focal: mesmo comando -> 3/3.
- Views relevantes completas: `npx vitest run tests/unit/views-dashboard.test.js tests/unit/home-view-stat-semantics.test.js tests/unit/habitos-view-ux.test.js tests/unit/views-modules.test.js tests/unit/views.test.js` -> 111/111.
- CSS: `npx vitest run tests/unit/css-architecture.test.js` -> 40/40.
- Contraste: `node scripts/contrast-audit.mjs --enforce` -> OK para corpo AA; excecao conhecida `arrakis danger/card = 4.42` permanece para Fase 4.
- Detector: `node C:\Users\slvma\.claude\skills\impeccable\scripts\detect.mjs src --json` -> 56 achados (32 advisory, 24 warning), mesma contagem pos-Fase 1. Por tipo: `design-system-color: 30`, `design-system-radius: 1`, `layout-transition: 11`, `numbered-section-markers: 1`, `overused-font: 4`, `side-tab: 7`, `single-font: 2`.
- Varredura: 0 `stat-card green/blue/orange/red` em `src` fora de `src/lab`; 0 `dashboard-stat-detail--negative` para pendentes/restantes fora de `src/lab`.
- Unit geral: `npm test` -> 115 arquivos, 1897 testes verdes. Logs de stderr simulados/preexistentes: Cloudflare 503/409, IndexedDB mock, notificacoes nao suportadas, sync-yield budget; todos com suite verde.

**Validacao browser / Playwright:**
- Tentado smoke headed: `npx playwright test tests/e2e/app.spec.js --project=chromium --headed --reporter=line -g "boots the app"` -> bloqueado por timeout de 180s antes de resultado util.
- Tentado mesmo smoke headless: `npx playwright test tests/e2e/app.spec.js --project=chromium --reporter=line -g "boots the app"` -> mesmo timeout de 180s.
- Nao ficou servidor temporario identificavel apos timeout; apenas `node.exe` antigo fora do ciclo Playwright. Proximo agente deve tratar este timeout como problema de ambiente/runner E2E a investigar, nao como falha comprovada da Fase 2.

**Status da Fase 2:** concluida e coberta por testes unitarios/arquitetura/contraste/detector. Publicacao pendente deste slice deve commitar/pushar os arquivos listados.

**Proximo passo recomendado:** iniciar Fase 3 - primeiro acesso & escopo do edital principal. Comecar pelo teste de bootstrap sem modal bloqueante e regra de escopo honesta na Home.

---
## Fase 1 - Fechamento de cor semantica e tokens (2026-06-25 19:45 -03)

**Resumo:** Fase 1 concluida. O ultimo slice fechou os 24 achados restantes de `design-system-color` fora de `themes.css`/`lab`/`vendor`, mantendo a escala de raio ja tokenizada e deixando o detector restrito aos escopos aceitos ou as fases futuras.

**Arquivos alterados:**
- `tests/unit/css-architecture.test.js` - novo contrato `PHASE_1_RESIDUAL_COLOR_CONTRACT_FILES`, cobrindo os arquivos residuais de CSS/JS para impedir hex/rgb/rgba crus.
- `src/css/base/layout.css`, `src/css/components/buttons.css`, `src/css/components/sidebar.css`, `src/css/components/toggle-drag.css`, `src/css/styles.css`, `src/css/views/dashboard.css` - sombras mantidas com geometria original e cor via `color-mix()` tokenizado.
- `src/css/components/search.css`, `src/css/views/editais-tree.css`, `src/css/views/revisoes.css` - highlights, superficies, bordas e estados danger usando tokens sem fallbacks crus.
- `src/js/sw-register.js`, `src/js/views/banca-view.js`, `src/js/views/config/sync-center.js` - inline styles migrados para tokens.
- `src/js/utils.js` - `HABIT_TYPES` agora usa tokens canonicos (`--info`, `--success`, `--warning`, `--danger`, `--question`) em vez de hexes.

**TDD / validacao:**
- Vermelho: `npm run test:css` falhou com 40 literais/fallbacks crus nos arquivos residuais.
- Verde: `npm run test:css` -> 40/40.
- Detector atual (`node .agents/skills/impeccable/scripts/detect.mjs --json src`): total **56** achados (**32 advisory**, **24 warning**). Por tipo: `design-system-color: 30`, `layout-transition: 11`, `side-tab: 7`, `overused-font: 4`, `single-font: 2`, `numbered-section-markers: 1`, `design-system-radius: 1`.
- Excluindo `src/lab`, `src/vendor` e `src/css/base/themes.css`: **0** `design-system-color` e **0** `design-system-radius` pendentes; os achados restantes pertencem a temas/lab/vendor ou fases futuras.
- `node scripts/contrast-audit.mjs --enforce` -> OK; excecao conhecida `arrakis danger/card = 4.42` permanece para Fase 4.
- `npm run test:views` -> 254/254.
- `npm run lint` -> 0 erros, 44 warnings preexistentes.
- `npm run test:unit` -> 114 arquivos, 1894 testes verdes.
- `git diff --check` -> sem erros; apenas avisos CRLF esperados do Git.

**Status da Fase 1:** concluida. `tokens.css`/`DESIGN.md` ja cobrem os raios enviados; cor semantica fora de `themes.css`/`lab`/`vendor` esta limpa pelo detector. Nao foi feita validacao visual em browser neste slice porque a alteracao foi de tokenizacao/refactor CSS/JS coberta por contratos, contraste e testes de views.

**Proximo passo recomendado:** iniciar Fase 2 - unificar stat cards com cor semantica. Primeiro teste esperado: remover classes genericas `.green/.blue/.orange/.red` dos stat cards e reservar `danger` para erro/atraso real, nao contagens pendentes.

---

## Fase 1 - Tokens semanticos e cores de views, sub-slice 3 (2026-06-25 19:35 -03)

**Resumo:** terceiro slice da Fase 1 concluido com TDD. O objetivo foi reduzir o maior bloco restante de cores cruas nas views compartilhadas, sem tocar nos achados de fases futuras (`side-tab`, `layout-transition`) e sem mexer em `themes.css`, `lab` ou `vendor`.

**Arquivos alterados:**
- `tests/unit/css-architecture.test.js` - novo contrato `PHASE_1_VIEW_COLOR_CONTRACT_FILES` para impedir hex/rgb/rgba crus em `views.css`, `ciclo.css`, `cronometro.css`, `habitos.css` e `sessions.css`.
- `src/css/views.css` - fallbacks e literais de acento/superficie/text-shadow substituidos por tokens e `color-mix()` tokenizado.
- `src/css/views/ciclo.css` - menu, scrollbar, estado danger e superficies tokenizados.
- `src/css/views/cronometro.css` - ring/progress/pill usando tokens sem fallbacks crus.
- `src/css/views/habitos.css` - badge e deltas convertidos para `--warning`, `--success`, `--danger` e `--text-muted`.
- `src/css/views/sessions.css` - botoes danger/success e bordas convertidos para tokens semanticos e `color-mix()`.

**TDD / validacao:**
- Vermelho: `npm run test:css` falhou com 35 literais/fallbacks crus nos cinco arquivos de view.
- Verde: `npm run test:css` -> 39/39.
- `node scripts/contrast-audit.mjs --enforce` -> OK; excecao conhecida `arrakis danger/card = 4.42` permanece para Fase 4.
- `npm run test:views` -> 254/254.
- `npm run lint` -> 0 erros, 44 warnings preexistentes.
- `npm run test:unit` -> 114 arquivos, 1893 testes verdes.
- `git diff --check` -> sem erros; apenas avisos CRLF esperados do Git.
- Detector atual (`node .agents/skills/impeccable/scripts/detect.mjs --json src`): total **80** achados (**56 advisory**, **24 warning**). Por tipo: `design-system-color: 54`, `layout-transition: 11`, `side-tab: 7`, `overused-font: 4`, `single-font: 2`, `numbered-section-markers: 1`, `design-system-radius: 1`.
- Excluindo `src/lab`, `src/vendor` e `src/css/base/themes.css`: **45** achados restantes; `design-system-color: 24` e os demais de fases futuras.

**Pendencias da Fase 1:**
- Fechar os **24** `design-system-color` restantes fora de `themes.css`/`lab`/`vendor`.
- Maiores proximos grupos: `src/js/sw-register.js` (4), `src/js/utils.js` (4), `src/css/views/revisoes.css` (3), depois pares em `buttons.css`, `editais-tree.css`, `banca-view.js`.
- Depois do fechamento de cor, confirmar se os achados restantes pertencem mesmo as Fases 2/4/5/6.

**Proximo passo recomendado:** continuar com um slice pequeno nos literais restantes de JS/CSS utilitario, com contrato focado antes da troca.

---

## Fase 1 - Tokens semanticos e raios, sub-slice 2 (2026-06-25 19:20 -03)

**Resumo:** segundo slice da Fase 1 concluido com TDD. O objetivo foi eliminar o drift real de `design-system-radius` nos arquivos enviados (mantendo `src/lab/` fora do escopo) e reduzir o maior bloco de cor literal em `src/css/views/config/config-view.css` sem alterar a identidade visual dos temas.

**Arquivos alterados:**
- `tests/unit/css-architecture.test.js` - novo contrato para impedir `border-radius` literal em CSS/JS/HTML enviados e contrato especifico para manter `config-view.css` sem hex/rgb/rgba crus.
- `src/css/tokens.css` - adicionados tokens de raio equivalentes (`xxs`, `compact`, `tight`, `card-sm`, `modal`, `loose`, `xl`) para preservar medidas existentes.
- `DESIGN.md` - escala de raios ampliada para documentar os novos tokens.
- CSS enviado em `src/css/**` - raios literais substituidos por tokens equivalentes.
- JS com estilos inline em `src/js/**` - raios inline substituidos por tokens equivalentes.
- `src/css/views/config/config-view.css` - fallbacks e literais de cor substituidos por tokens semanticos e `color-mix()` tokenizado.

**TDD / validacao:**
- Vermelho: `npm run test:css` falhou com 146 drifts de raio literal.
- Verde parcial: `npm run test:css` passou apos tokenizar raios.
- Vermelho: `npm run test:css` falhou com 29 cores cruas em `config-view.css`.
- Verde final: `npm run test:css` -> 38/38.
- `node scripts/contrast-audit.mjs --enforce` -> OK; excecao conhecida `arrakis danger/card = 4.42` permanece para a Fase 4.
- `npm run lint` -> 0 erros, 44 warnings preexistentes.
- `npm run test:views` -> 254/254.
- `npm run test:unit` -> 114 arquivos, 1892 testes verdes.
- `git diff --check` -> sem erros; apenas avisos CRLF esperados do Git.
- Detector atual (`node .agents/skills/impeccable/scripts/detect.mjs --json src`): total **106** achados (**82 advisory**, **24 warning**). Por tipo: `design-system-color: 80`, `layout-transition: 11`, `side-tab: 7`, `overused-font: 4`, `single-font: 2`, `design-system-radius: 1`, `numbered-section-markers: 1`. O unico `design-system-radius` restante fica em `src/lab/visual-layout-lab.css` e segue fora do escopo da remediacao principal.
- Excluindo `src/lab`, `src/vendor` e `src/css/base/themes.css`: **71** achados restantes; `design-system-color: 50`, `layout-transition: 10`, `side-tab: 7`, `overused-font: 2`, `numbered-section-markers: 1`, `single-font: 1`.

**Pendencias da Fase 1:**
- Continuar a reconciliacao dos **50** `design-system-color` restantes fora de `themes.css`/`lab`/`vendor`, por grupos pequenos e testados.
- Candidatos provaveis para o proximo slice: arquivos de views com paletas/fallbacks restantes e JS utilitario com estilos inline.
- Preservar a regra de identidade: nao substituir temas, fontes, rim-light nem `src/lab/`; apenas mover literais/fallbacks para tokens semanticos documentados.

**Proximo passo recomendado:** fechar Fase 1 com um slice de cor restante, partindo dos maiores grupos do detector e adicionando contratos especificos antes de cada substituicao.

---

## Fase 1 — Tokens semânticos e raios, sub-slice 1 (2026-06-25 18:59 -03)

**Resumo:** primeiro slice da Fase 1 concluído com TDD. O objetivo foi remover os fallbacks genéricos mais arriscados (`var(--token, #hex)`) dos arquivos principais de layout/sync e transformar os raios nomeados da fase em tokens documentados. A Fase 1 **ainda não está completa** porque o detector ainda aponta drift de cor/raio fora de `themes.css`/`lab`.

**Arquivos alterados:**
- `tests/unit/css-architecture.test.js` — novos testes para contratos da Fase 1: arquivos principais sem fallback genérico de cor e componentes-alvo usando escala de raio tokenizada.
- `src/css/tokens.css` — adicionados `--radius-xs` e `--radius-control`; aliases legados (`--blue`, `--orange`, `--yellow`, `--red`, `--green`, `--purple`) agora apontam para tokens canônicos.
- `src/css/base/themes.css` — aliases legados por tema apontam para `--info`, `--warning`, `--danger`, `--success`, `--question`.
- `src/css/base/layout.css`, `src/css/views/dashboard.css` — fallbacks genéricos removidos nos estados de sync/topbar/dashboard cobertos pelo teste.
- `src/css/base/accessibility.css`, `src/css/components/buttons.css`, `src/css/components/cards.css` — raios literais principais trocados por tokens.
- `DESIGN.md` — documentados `xs/control` e regra dos tokens canônicos/aliases.

**TDD / validação:**
- Vermelho: `npm run test:css` falhou nos dois novos contratos (45 fallbacks genéricos + 11 raios literais).
- Verde: `npm run test:css` → 36/36.
- `npm run test:unit` → 114 arquivos, 1890 testes verdes.
- `npm run lint` → 0 erros, 44 warnings preexistentes.
- Detector atual (`node .agents/skills/impeccable/scripts/detect.mjs --json src`): total **185** achados (**161 advisory**, **24 warning**), abaixo do baseline 258. Por tipo: `design-system-color: 106`, `design-system-radius: 54`, `layout-transition: 11`, `side-tab: 7`, `overused-font: 4`, `single-font: 2`, `numbered-section-markers: 1`. Excluindo `src/lab`, `src/vendor` e `src/css/base/themes.css`: **147** achados (127 advisory, 20 warning).

**Pendências da Fase 1:**
- Decidir se o restante dos raios reais (2/3/6/7/12/16/20/24px) vira token nomeado para preservar equivalência visual ou é mapeado para `xs/sm/control/md/lg/pill` aceitando pequenas mudanças.
- Limpar drift restante de cor fora dos arquivos cobertos neste slice, principalmente config/views, sombras literais, paletas utilitárias em JS e achados do detector que não pertencem a fases futuras.
- Re-rodar detector e buscar o alvo do plano: `design-system-color` + `design-system-radius` restritos a `themes.css`/`lab` ou justificados.
- Fazer validação visual antes/depois quando mexer em raios fora deste slice; esta subentrega foi token-equivalente nos componentes tocados.

**Próximo passo recomendado:** continuar Fase 1 pelo restante de `design-system-radius`, preferindo tokens adicionais para preservar equivalência visual, depois atacar os literais de cor restantes por grupos de responsabilidade.

---
## Fase 0 — Preparação, baseline e guardrails ✅ (2026-06-25)

**Resumo:** ambiente, baselines e rede de segurança montados. Zero mudança de comportamento/visual.

**Arquivos criados:**
- `scripts/contrast-audit.mjs` — utilitário Node que lê `themes.css`, extrai os tokens de cada tema e calcula os ratios WCAG. CLI (`node scripts/contrast-audit.mjs [--enforce]`) + API (`auditContrast()`). Reproduz exatamente os números medidos no browser.
- `tests/unit/contrast-themes.test.js` — regressão (31 testes): corpo (primary/secondary/muted) ≥ 4.5 nos 6 temas; success/warning ≥ 4.5; danger ≥ 4.5 em 5 temas; **arrakis danger encodado como exceção conhecida (4.42)** — a Fase 4 vai virar este bloco para exigir ≥ 4.5 em todos.

**Decisões técnicas:**
- Os tokens de cor em `themes.css` são literais (sem `var()` encadeado) → auditoria determinística sem browser.
- Já existe `tests/unit/theme-contrast.test.js` (muted/secondary). O novo teste é complementar (cobre primary + cores semânticas + a exceção arrakis + o utilitário reutilizável). Não foi removido nada.

**Testes executados:**
- `npx vitest run tests/unit/contrast-themes.test.js` → 31/31 verde.
- `npm run test:unit` (baseline) → 1857/1857 verde.

**Validação manual:** `node scripts/contrast-audit.mjs` imprime a tabela dos 6 temas; bate com a auditoria de browser da critique.

**GitHub:** a commitar nesta fase (script + teste + este handoff).

**Pendências/observações:**
- `detect-baseline.json` foi salvo no scratchpad (temporário, fora do repo).
- Guardrails de identidade (§3 do plano) valem para todas as fases: não mexer em paleta/temas/fontes/rim-light/`src/lab/`.

**Próximo passo:** Fase 1 — reconciliar tokens (raio `--radius-xs`/`--radius-control`, trocar hexes genéricos por tokens semânticos, DESIGN.md como fonte da verdade). Começar pelo teste em `tests/unit/css-architecture.test.js` (vermelho), depois implementar.
