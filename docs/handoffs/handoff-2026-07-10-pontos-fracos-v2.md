# Handoff — Pontos Fracos v2: 4 fases implementadas (2026-07-10)

Plano executado integralmente: `docs/plans/2026-07-10-pontos-fracos-v2.md` (as
decisões de produto e o desenho por fase estão lá). Cada fase seguiu TDD
(red confirmado → implementação mínima → green) e foi commitada/pushada
separadamente na `main`, com bump automático de APP_VERSION pelo hook.

## Commits (nesta ordem)

| Fase | Commit | Conteúdo |
|---|---|---|
| Plano | `ad6686b` | docs/plans/2026-07-10-pontos-fracos-v2.md |
| 1 — Bayesiana | `a437da0` | `weak-points.js` (prior global, `taxaAjustada`, `insuficientes` removido do retorno, `confiavel` = total≥10), view sem seção "Dados insuficientes" + selo "⚠ poucas questões", testes core/view/e2e atualizados |
| 2 — Memoização | `a819aaa` | `src/js/logic/weak-points-memo.js` novo (cache 1 entrada, chave cutoff+filtros+série, invalidado por `app:invalidateCaches`), view usa `computeWeakPointsMemo`, `tests/unit/weak-points-memo.test.js` novo |
| 3 — Sparkline | `b6cf14a` | núcleo gera `serie` semanal opcional (`seriesWeeks`/`todayStr`, blocos rolantes de 7 dias); `renderSparkline` (utils.js) aceita gaps/null (segmentos + círculos, compat total sem nulls); view exibe mini-gráfico por assunto (≥2 semanas com dado) com tooltip; `.pf-sparkline` em views.css (oculto <600px) |
| 4 — Ciclo | `cab6902` | `suggestConhecimento(taxa)` no núcleo (<40→1, 40-54→2, 55-69→3, 70-84→4, ≥85→5; nunca 0); wizard: `getConhecimentoSugestoes()` (90d, ≥10 respondidas por disciplina), `pwApplyConhecimento`, `pwApplyConhecimentoTodos`; passo 3 mostra "💡 Sugerido: N (X% em Y questões)" + aplicar individual/em lote; 2 ações novas no dispatcher |

APP_VERSION: 9.13 → 9.17 (um bump por fase, via hook pre-commit).

## Testes

- Unit: **2209/2209 verdes** (eram 2180 antes; +29 novos entre core, memo, utils,
  view, wizard, step-renderers e actions).
- E2e gate (`npm run test:e2e`): **148/148 verdes** (rodado após cada fase).
- `tests/e2e/pontos-fracos.spec.js` atualizado na fase 1 (sem "Dados
  insuficientes", com selo).

## Decisões técnicas relevantes

- Núcleo `weak-points.js` permanece **puro** (guard de imports intacto) — memo e
  acesso a estado ficam em `weak-points-memo.js` / view / wizard.
- Prior da bayesiana = média do universo filtrado (recalculada por filtro), m=10.
  Ordenação do ranking pela `taxaAjustada`; exibição continua com a taxa bruta.
- `disciplinas[]` NÃO é suavizada (taxa real da disciplina, usada também pela
  sugestão do Ciclo).
- `renderSparkline` de `utils.js` é o renderer compartilhado (Hábitos + Pontos
  Fracos); a duplicata privada em `home-view.js:110` ficou fora de escopo.
- Sugestão do Ciclo nada aplica sem clique (decisão do usuário); wizard chama o
  memo compartilhado — nos testes do wizard os módulos weak-points reais rodam
  sobre o store mockado, sem mocks novos.

## Pendências / observações

- **Flake pré-existente** na suíte unit completa: ~1 falha intermitente em área de
  sync (aparece em ~metade das rodadas completas, passa isolado e em re-runs;
  não relacionado a este trabalho). Investigar se reincidir com nome capturado.
- Validação manual no browser das 4 features ainda não foi feita nesta sessão
  (cobertura via unit + e2e; recomenda-se um passeio visual na aba e no wizard:
  `npx http-server src -p 8087 -c-1`).
- Possíveis v3 (não planejados): suavizar também a taxa da disciplina; sparkline
  com escala fixa 0-100; sugestão de importância pela relevância de banca.

## Estado do GitHub

`main` sincronizada com `origin/main` até `cab6902`. Working tree limpo.
