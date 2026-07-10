# Plano — Pontos Fracos v2 em 4 fases (2026-07-10)

## Contexto

A aba Pontos Fracos (v1, entregue em 2026-07-09) ranqueia assuntos por taxa de
acerto em questões. Este plano cobre as 4 evoluções listadas no backlog do handoff
`docs/handoffs/handoff-2026-07-09-aba-pontos-fracos.md`. Decisões de produto já
tomadas pelo usuário:

1. **Bayesiana**: todo assunto com ≥1 questão respondida entra no ranking, ordenado
   pela taxa suavizada; selo "poucas questões" quando `total < 10`; a seção
   "Dados insuficientes" deixa de existir; "Sem questões registradas" permanece.
2. **Ciclo**: sugestão de "conhecimento" ao lado do slider (passo 3 do wizard) com
   botão "Aplicar" por disciplina + "Aplicar todas". Nada muda sem clique.
3. **Sparkline**: taxa por semana (buckets semanais, máx. 12; "Tudo" = 12 semanas).

Cada fase é independente, segue TDD (red→green→refactor) e termina com commit +
push na `main` (o hook/bot bumpa APP_VERSION quando `src/` muda — fazer
`git pull --rebase` após o push).

Restrições permanentes: `src/js/logic/weak-points.js` é **puro, zero imports**
(guard em `tests/unit/weak-points-core.test.js`); guards
`module-specifier-consistency` e `css-architecture` ativos; gate e2e =
`npm run test:e2e` (nunca `playwright test` cru).

---

## Fase 1 — Média bayesiana no ranking

**Objetivo:** eliminar o corte binário de 10 questões. Ranking ordenado por
`taxaAjustada = (acertos + m·p) / (respondidas + m)`, com `m = MIN_QUESTOES_CONFIAVEL
(10)` e prior `p` = taxa média global do universo filtrado (acertos/respondidas de
todos os assuntos; fallback 0.5 sem dados).

**Núcleo (`src/js/logic/weak-points.js`):**
- Bucket de assunto ganha `taxaAjustada` (inteiro 0-100, null se `respondidas === 0`).
  `taxa` (bruta) e `faixa` continuam como estão — são o que o usuário vê.
- `confiavel` passa a significar apenas `total >= MIN_QUESTOES_CONFIAVEL` (vira o selo).
- Partição nova: `ranking` = todo bucket com `total > 0` (inclui os raros com
  `respondidas === 0`, que ficam com taxa/taxaAjustada null e ordenam por último);
  `semQuestoes` = `total === 0` (inalterado); **`insuficientes` é removido do retorno**.
- Ordenação do ranking: `taxaAjustada` asc (null por último) → `total` desc → nome.
  `disciplinas[]` mantém ordenação atual (taxa bruta) — a taxa da disciplina é exibida
  como número real, sem suavização.

**View (`src/js/views/pontos-fracos-view.js`):**
- Remover o bloco `insufHtml` (linhas ~167-176) e a referência em `el.innerHTML`.
- `grupos`: filtrar por `a.total > 0` (era `a.confiavel`) e ordenar por
  `taxaAjustada` (null último).
- `assuntoRow`: selo quando `!a.confiavel && a.total > 0`:
  `<span class="text-sm text-muted">· poucas questões</span>` após a contagem.
- Empty-state: trocar a mensagem "pelo menos N questões" por "Nenhuma questão
  registrada em {período}...".

**Testes primeiro (red):**
- `tests/unit/weak-points-core.test.js`: atualizar os casos de partição (9 questões
  agora entra no `ranking` com `confiavel:false`; 10 entra com `confiavel:true`);
  novos casos: `taxaAjustada` puxa taxa extrema com poucos dados em direção ao prior
  (ex.: 1/1 = 100% bruto mas ajustada ≈ prior); prior calculado do universo filtrado;
  fallback p=0.5; ordenação por ajustada ≠ ordenação por bruta em caso construído;
  `respondidas===0 && total>0` fica no fim com taxa null; retorno não tem mais
  `insuficientes`.
- `tests/unit/views-modules.test.js` (describe pontos-fracos): sem `<details>` de
  insuficientes; selo "poucas questões" presente para assunto com 4 questões; assunto
  com 4 questões aparece no ranking.
- `tests/e2e/pontos-fracos.spec.js`: remover asserções de "Dados insuficientes";
  o assunto de 4 questões do seed agora aparece no ranking com selo.

**Aceite:** unit + e2e verdes; validação manual da aba (ranking, selo, seções).

---

## Fase 2 — Memoização de `computeWeakPoints`

**Objetivo:** evitar recomputo por render quando nada mudou (modo "Tudo" com muitos
eventos arquivados).

**Novo módulo `src/js/logic/weak-points-memo.js`** (o núcleo não pode ganhar imports):
- `computeWeakPointsMemo(args)` — cache module-level de 1 entrada com chave
  `${cutoffStr}|${editalFilterId}|${discFilterId}` (padrão
  `src/js/views/calendar/calendar-events.js:9-66`). Retorna o MESMO objeto em hit.
- `invalidateWeakPointsMemo()` exportado; listener
  `document.addEventListener('app:invalidateCaches', invalidate)` registrado no
  módulo, guardado por `typeof document !== 'undefined'` (testes puros).
- Import do núcleo sem sufixo (`./weak-points.js`), consistente com `logic/`.
- Justificativa da chave: `eventos/arquivo/editais` só mudam via mutações que já
  disparam `app:invalidateCaches` (emissor debounced em
  `src/js/store/indexeddb.js:347-359`; fan-out em `src/js/main.js:163-169`).
  `cutoffStr` embute a virada de dia.

**View:** trocar import para `computeWeakPointsMemo`.

**Testes primeiro (red):** novo `tests/unit/weak-points-memo.test.js`:
- mesma chamada 2x → mesma referência de resultado;
- chave diferente (outro cutoff/filtro) → nova referência;
- `invalidateWeakPointsMemo()` → nova referência;
- disparo do evento `app:invalidateCaches` num `document` fake → invalida.

**Aceite:** unit verde; aba funciona igual (e2e existente cobre); editar uma sessão
e voltar à aba mostra dados novos (validação manual — invalidação funciona).

---

## Fase 3 — Sparkline de evolução da taxa por assunto

**Objetivo:** mini-gráfico por assunto no ranking: taxa de acerto por semana.

**Núcleo (`src/js/logic/weak-points.js`):**
- `computeWeakPoints` ganha params opcionais `seriesWeeks = 0` e `todayStr = null`.
  Quando `seriesWeeks > 0`: cada bucket de assunto ganha
  `serie: Array(seriesWeeks)` (antiga→recente), cada item `{ taxa: number|null }`
  — taxa da semana (bloco rolante de 7 dias terminando em `todayStr`); semana sem
  questões respondidas = `taxa: null`. Acumulado na MESMA passada de eventos
  (mapa assId→semana→{acertos,erros}); determinístico via `todayStr`.
- `seriesWeeks` derivado pelo caller de modo que a janela da série caiba na janela
  principal: 30d→4, 90d→12, Tudo→12.

**Renderer (`src/js/utils.js`):** estender `renderSparkline(data, opts)` (linha 223,
já exportada e usada por Hábitos) para aceitar `null` nos dados: polyline segmentada
nos gaps (múltiplos `<polyline>`; pontos isolados viram `<circle>`). Sem mudança de
comportamento para arrays sem null (Hábitos intacto). A duplicata privada de
`home-view.js:110` fica como está (fora de escopo).

**View:** `assuntoRow` renderiza `renderSparkline(serie.map(s => s.taxa), { width: 56,
height: 16, stroke: FAIXA_COLORS[faixa] })` quando a série tem ≥2 semanas com dado,
com `title` listando as taxas semanais. Ocultar no mobile (padrão
`src/css/views/dashboard.css:700-732`); classe `.pf-sparkline` em
`src/css/views/dashboard.css` ou arquivo próprio conforme wiring existente.

**Testes primeiro (red):**
- `weak-points-core.test.js`: série com semanas corretas (evento há 3 dias na última
  semana, há 10 dias na penúltima); semana sem dados = null; `seriesWeeks=0` não gera
  série; determinismo com `todayStr` fixo.
- novo teste de `renderSparkline` com nulls (segmentos/círculos; array sem null
  idêntico ao atual).
- `views-modules.test.js`: HTML contém `<svg class="sparkline"` quando há série.

**Aceite:** unit + e2e verdes; visual conferido no browser (gaps, cores por faixa,
mobile esconde).

---

## Fase 4 — Sugestão de "conhecimento" no wizard do Ciclo

**Objetivo:** no passo 3 do wizard (sliders de importância/conhecimento por
disciplina), sugerir o valor de conhecimento a partir da taxa de acerto real.

**Núcleo (`src/js/logic/weak-points.js`):** nova função pura exportada
`suggestConhecimento(taxa)` → `<40→1 | 40-54→2 | 55-69→3 | 70-84→4 | ≥85→5`
(0 não é sugerido: significa "nunca estudou", incompatível com ter questões).

**Wizard (`src/js/planejamento-wizard.js`):**
- `getConhecimentoSugestoes()`: chama `computeWeakPointsMemo` (fase 2) com
  `cutoffStr = cutoffDateStr(90)` e monta
  `{ [discId]: { valor, taxa, questoes } }` só para disciplinas com
  `acertos+erros >= 10`. Passada ao `htmlStep3` como parâmetro (testes do wizard
  mockam `logic.js`, não `weak-points-memo` — sem quebra; conferir).
- `pwApplyConhecimento(discId, valor)`: reusa `pwUpdateRel(discId, 'conhecimento',
  valor)` e sincroniza o `input[type=range]` correspondente no DOM.
- `pwApplyConhecimentoTodos()`: aplica todas as sugestões.

**Passo 3 (`src/js/planejamento/step-renderers.js`, `htmlStep3` :156-218):**
- Abaixo do slider de conhecimento, quando há sugestão:
  `Sugerido: N (X% em Y questões)` + botão `data-action="pw-apply-conhecimento"
  data-disc-id data-valor`. No topo do passo: botão
  `data-action="pw-apply-conhecimento-todos"` com contagem.
- Nada é aplicado automaticamente.

**Ações (`src/js/ui/actions/planejamento.js`):** registrar as duas ações novas.

**Testes primeiro (red):**
- `weak-points-core.test.js`: faixas de `suggestConhecimento` (bordas 39/40, 54/55,
  69/70, 84/85).
- `planejamento-wizard.test.js`: `pwApplyConhecimento` atualiza draft + label +
  slider; `getConhecimentoSugestoes` exige ≥10 respondidas.
- `planejamento-step-renderers.test.js`: markup do passo 3 contém
  `pw-apply-conhecimento` quando há sugestões e omite quando não há.
- `planejamento-actions.test.js`: dispatcher registra as 2 ações.
- E2e: não adicionar cenário novo (custo alto); validação manual do wizard.

**Aceite:** unit + e2e verdes; wizard validado manualmente (sugestão exibida,
aplicar por disciplina e em lote, preview de pesos atualiza).

---

## Verificação (todas as fases)

1. `npm test` (unit, ~2180) — resumir resultados.
2. `npm run test:e2e` (gate chromium, 148+).
3. Manual: `npx http-server src -p 8087 -c-1` → aba Pontos Fracos e wizard do Ciclo.
4. Commit por fase (feat:/test: em pt-BR) + push + `git pull --rebase` (bot de bump).
5. Handoff do repo atualizado ao final (docs/handoffs/).
