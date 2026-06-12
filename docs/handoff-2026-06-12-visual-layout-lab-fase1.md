# Handoff — Visual Layout Lab (Fase 1 + iteração pixel-perfect) — 2026-06-12

## ATUALIZAÇÃO (mesma data): iteração pixel-perfect + UX

Meta do usuário: lab IGUAL ao app original (pixel-perfect), defaults do primeiro
boot espelhando a organização original, e melhor experiência de reorganização.

O que mudou (commit 2):

1. **Grid de 12 colunas** (era 4) — `SPAN_MAX=12`, `DEFAULTS_VERSION=2` (layouts
   v1 salvos são descartados com toast no boot). Permite as proporções reais:
   home bottom ~6/6, ciclo 7/5 (=58fr/42fr do app), med/habitos 3 colunas (4/4/4).
2. **Masonry por row-span**: `grid-auto-rows: 8px` + a cola mede a altura
   natural de cada card e seta `grid-row: span N`. Alturas default agora são
   'sm' (= altura NATURAL, igual ao app); md/lg/xl viram opções de resize.
   Reproduz o fluxo original (painel alto à esquerda, cards empilhando à
   direita no dash-grid-bottom e no ciclo-layout).
3. **Equalização por linha**: cards na mesma linha visual esticam até o maior
   vizinho de altura SEMELHANTE (razão ≤ 1.8) — replica o stretch das linhas de
   stats do app sem esticar card baixo até painel alto. Desconta margens do
   container (BFC de grid item).
4. **Margens residuais zeradas** no root de cada card (`.lab-card-content > *`)
   — o espaçamento vertical vem do masonry (16px), senão os gaps somavam
   (ex.: habit-grid margin-bottom 20px → gap de 36px).
5. **Defaults do registry** reordenados/recalibrados para a ordem e proporções
   exatas de cada view real; card novo `home-acoes` (Editar prova/metas);
   mock com 16 disciplinas (edital de tribunal realista — também garante o
   fluxo do dash-grid-bottom).
6. **UX do drag**: placeholder ao vivo no slot de destino (mesma largura/altura
   do card), card original sai do fluxo, vizinhos reposicionam com FLIP a cada
   mudança de índice. Corrigido off-by-one do índice de drop.
7. **Auditoria numérica lab × app real** (servidor mock): KPIs 134 vs 133,
   stats do dashboard 108 = 108 (exato), charts 313 vs 314, subject panel
   620 = 620; padding/border-radius/cores idênticos (mesmo CSS). Diferenças
   de poucos px vêm do conteúdo mock, não de estrutura/estilo.
   Compromissos conhecidos: gap vertical único de 16px (app varia 12–24 por
   região); hero 146 vs 162 (texto mock).

Validações: 1823 testes verdes (57 do lab); eslint/prettier do lab OK.
Sync intocado; nenhum arquivo do app alterado nesta iteração.

---

## Objetivo da sessão

Construir a Fase 1 do **Visual Layout Lab**: ferramenta visual ISOLADA (mini-Figma em HTML)
para reorganizar as telas do app com mock data, arrastar/redimensionar/ocultar cards e
exportar o layout em JSON. O JSON + screenshots servem de **especificação** para uma sessão
futura aplicar as mudanças no CSS/HTML real do app.

Prompt de origem: `C:\Users\slvma\Downloads\2026-06-12-prompt-visual-lab-estudo-organizado.md`.
Plano aprovado (com decisões do grill): `C:\Users\slvma\.claude\plans\c-users-slvma-downloads-2026-06-12-prom-groovy-blossom.md`.

## Decisões fechadas no grill (antes de codar)

| Decisão | Resposta |
| --- | --- |
| Objetivo do export | Spec para reimplementação futura (fidelidade importa) |
| Telas da Fase 1 | home, **med** (Study Organizer), ciclo, dashboard, habitos |
| Idioma do chrome | pt-BR (inclusive aria-live) |
| Mock data | Só o que as 5 telas consomem |
| CDNs | Mesmos do app (Google Fonts + Font Awesome). "Zero rede" = zero chamadas de DADOS |
| Service worker | **sw.js intocado**; ver "Armadilha do SW" abaixo |
| Temas | Seletor com os 7 temas na toolbar (`data-theme` no documento) |
| Stage | Só a área de conteúdo; viewport = área útil sem sidebar |
| Granularidade | Card = bloco de topo da view |

## O que foi feito (tudo TDD red→green)

Arquivos novos em `src/lab/` (o app NÃO foi tocado):

- `visual-layout-lab.html` — shell; linka as **mesmas 5 entradas CSS** do index.html
  (tokens, base, components, views, styles) via `../css/`, os mesmos CDNs de fonte/ícone
  e o Chart.js vendorizado (`../vendor/chart.umd.min.js`).
- `visual-layout-lab-core.js` — lógica pura de layout (mover, resize por steps span 1..4 ×
  altura sm/md/lg/xl, collapse, duplicate, hide/restore, export/import com envelope e
  validação, persistência com `DEFAULTS_VERSION`).
- `visual-layout-lab-dnd.js` — geometria pura do drag (threshold 4px, linhas/midpoints,
  auto-scroll, deltas FLIP).
- `visual-layout-lab-history.js` — undo/redo imutável, cap 100.
- `visual-layout-lab-registry.js` — 5 telas, 47 cards (ids estáveis, título pt-BR, defaults).
- `visual-layout-lab-data.js` — mock data realista (edital TRF, 6 disciplinas, 30 dias de
  séries, ciclo com etapa "pulada", hábitos com streaks, eventos do dia).
- `visual-layout-lab-render.js` — renderers puros com o markup REAL das views (classes
  idênticas a home-view/med-view/ciclo-view/dashboard-view/habitos-view; réplicas fiéis de
  `renderEventCard` e dos dois sparklines). Gráficos = Chart.js real com mock data.
- `visual-layout-lab.js` — cola DOM: drag com ghost/placeholder/FLIP/Esc/teclado+aria-live,
  resize por arraste das bordas (preview ao vivo, commit único), undo/redo (Ctrl+Z/Y),
  painéis "Adicionar card" e "Ocultos", autosave 600ms, export/import JSON, print mode (P),
  reset por tela e geral, seletor de tema/viewport/tela com prefs persistidas.
- `visual-layout-lab.css` — só o chrome do lab.

Testes novos em `tests/unit/` (66 asserts no lab):

- `visual-layout-lab-core.test.js` (24) — operações, export/import, DEFAULTS_VERSION.
- `visual-layout-lab-dnd.test.js` (14) — threshold, linhas, drop index, auto-scroll, FLIP.
- `visual-layout-lab-history.test.js` (7) — undo/redo, cap 100.
- `visual-layout-lab-guards.test.js` (11) — **guardas de isolamento**: storage só via
  wrapper com prefixo `estudo-organizado-visual-layout-lab:`; nenhum import de `src/js/`;
  nenhum uso de IndexedDB/firebase/fetch; `src/lab/` fora do `ASSET_PATHS` do sw.js;
  CSS do lab == entradas do index.html (anti-drift); contrato registry×renderers.

Extra: `.claude/launch.json` (config do preview para `npm run mock`, porta 18765).

## Validações executadas

- `npm test`: **110 arquivos, 1822 testes, todos verdes** (inclui os 56 do lab).
- `npx eslint src/lab/`: 0 erros, 0 warnings. `npm run lint` global: 0 erros (43 warnings
  pré-existentes do app).
- `npx prettier --check` nos arquivos do lab: OK.
- Smoke manual via preview (servidor mock, porta 18765, `/lab/visual-layout-lab.html`):
  5 telas renderizam (13/9/6/9/10 cards), gráficos Chart.js funcionam, hide/undo/autosave/
  aria-live verificados via eval, screenshot do dashboard confere com o visual do app.
- Storage: nenhuma chave fora do prefixo foi criada (verificado em runtime).

## Validações que falharam (pré-existente, NÃO causado por esta sessão)

- `npm run format:check` falha com **109 arquivos do app** — problema ambiental conhecido
  de CRLF no Windows (`core.autocrlf=true` × `endOfLine:lf`; índice git está LF). Ver
  memória do projeto. **Nenhum arquivo do lab está na lista.** Não rodar `prettier --write`
  em massa.

## Armadilha do SW (documentação obrigatória)

O `sw.js` cacheia em runtime QUALQUER `.js/.css/.html` same-origin (stale-while-revalidate,
`sw.js:275`), mesmo fora do precache. Ao desenvolver/usar o lab **no mesmo origin em que o
SW do app já está registrado**, edições podem aparecer com 1 reload de atraso. Mitigação:
DevTools aberto com "Update on reload", ou Ctrl+Shift+R. O servidor mock em porta separada
não registra SW por padrão — preferir `npm run mock`.

## Correções descobertas durante a implementação

1. O CSS real define `body` como flex row (sidebar+main) — o lab neutraliza com
   `.lab-body { flex-direction: column }`.
2. `aside[hidden]` era sobreposto pelo `display:flex` do painel — corrigido com
   `.lab-panel[hidden] { display:none }`.
3. A lista de CSS do prompt original estava errada: o app linka 5 entradas e o resto via
   `@import`; o teste anti-drift compara com o index.html (não com `views/*.css`).

## Estado / o que falta (Fases 2–4, SÓ após OK do usuário na Fase 1)

- **FASE 2** — demais 8 telas (cronometro, calendar, revisoes, historico-sessoes, editais,
  vertical, banca-analyzer, config) + botão "Carregar estado existente" (read-only,
  **exige OK explícito do usuário antes de implementar**).
- **FASE 3** — endurecer o teste de contrato (classes reais obrigatórias por card,
  classes fake proibidas).
- **FASE 4** — auditoria de fidelidade: screenshots lab × app real lado a lado por
  tela/tema (Playwright já existe no repo) + correções.
- Avaliar granularidade dos spans da tela `med` (3 stat cards em grid de 4 colunas).

## Confirmação de sync

**O sync NÃO foi alterado.** Nenhum arquivo de `src/js/`, `src/css/`, `index.html` ou
`sw.js` foi modificado. O lab não importa módulos do app, não faz rede e só escreve
localStorage com o prefixo próprio (testes de guarda garantem).

## Como retomar

1. `npm run mock` → abrir `http://127.0.0.1:18765/lab/visual-layout-lab.html`.
2. Testar manualmente: drag (handle ⠿ ou header), resize (bordas/botões ±W ±H), collapse,
   duplicate, hide/restore, undo/redo, export/import, print mode (P), temas, viewports.
3. Feedback do usuário → ajustar Fase 1 ou iniciar Fase 2.
4. Testes do lab: `npx vitest run tests/unit/visual-layout-lab-*.test.js`.
