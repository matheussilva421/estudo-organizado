# Handoff — Redesign da aba Ciclo de Estudos → Reta Final (2026-07-08)

## O que foi feito

Reorganização visual da view da **Reta Final** (renderizada dentro da aba "Ciclo de
Estudos" quando `plan.tipo === 'reta_final'`, via `ciclo-view.js:210`), com base no
redesign fornecido pelo usuário. A view ganhou paridade com o Ciclo: leitura "de
relance" no topo, um foco do dia e uma distribuição visual. **Toda a mudança é de
apresentação** — nenhuma alteração em sync, rolagem, reconcile, importação ou ações.

Três adições sobre a estrutura de duas colunas já existente:

1. **Cabeçalho com 4 KPIs** — Concluído (% + donut `conic-gradient`, X/Y blocos),
   Faltam (dias para a prova), Horas (restante + "Xh de Yh") e Ritmo necessário
   (h/dia até a dataFinal).
2. **Painel "Foco de Hoje"** — card destacado no topo da coluna esquerda com os blocos
   pendentes de hoje/atrasados (contagem + horas), reusando `renderBlocoCard` (já traz
   as ações concluir/associar). Some quando não há bloco do dia.
3. **Distribuição de Horas** — substituiu o resumo textual (`renderResumoHtml`) por
   barras por disciplina (cor da disciplina, "Xh de Yh") + "Total restante".

### Decisões de produto (confirmadas com o usuário)
- **"Faltam ... dias"** usa `state.config.dataProva` (cai em `retaFinal.dataFinal` se ausente).
- **"Ritmo necessário"** usa `retaFinal.dataFinal`.
- A 3ª tela do redesign ("Análise") ficou **fora de escopo**.

### Arquivos criados
- **`src/js/logic/reta-final-core.js`** → nova função pura `computeRetaFinalHeaderMetrics(retaFinal, { hoje, dataProva })`
  (reusa `computeRetaFinalSummary`; helper interno `diasAte` espelha o countdown de `home-view.js`).
- **`tests/unit/reta-final-header-metrics.test.js`** — 9 testes (TDD) do helper puro.
- **`tests/unit/reta-final-view-dashboard.test.js`** — 12 testes (TDD) de render: KPIs, `formatHours`,
  Foco de Hoje e Distribuição em barras.

### Arquivos editados
- **`src/js/views/reta-final-view.js`** — `formatHours` (horas decimais pt-BR, exportada),
  `renderHeaderMetrics`, `renderFocoHoje`, reescrita de `renderResumoHtml` (barras) e
  remontagem em `renderRetaFinal` (import de métricas + `state.config.dataProva`).
- **`src/css/views/reta-final.css`** — novas classes `rf-metrics-row`, `rf-metric*`, `rf-donut`,
  `rf-foco-*`, `rf-dist-*`. Removidas as `rf-summary-*` (órfãs após a troca por barras).
  Tokens do DESIGN.md (cor de stat por categoria, DM Mono nos valores, rim-light nos cards).

## Estado atual

- **Todos os testes da Reta Final passam (143)**; suíte unit completa verde.
- `css-architecture` (44) e `contrast-audit --enforce` (AA nos 8 temas) sem regressão.
- Lint limpo nos arquivos alterados.
- Verificação visual: preview renderizado via headless Chromium reproduz o mockup
  (22% · 19/86 · 32 dias com os mesmos dados). Screenshot no scratchpad da sessão.
- Branch: `claude/reta-final-redesign-plan-h6jp5y`.

## O que falta / próximos passos

- **Tela "Análise"** (3ª imagem do redesign) não foi implementada — decisão do usuário.
- Opcional: e2e em `tests/e2e/reta-final.spec.js` cobrindo KPIs e Foco de Hoje via `data-*`.
- O painel direito (Distribuição) usa a altura do `.ciclo-side-panel` compartilhado; se
  desejado, ajustar para altura de conteúdo (hoje segue o padrão do Ciclo).
