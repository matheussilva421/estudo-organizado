# Handoff — Remediação da Critique Impeccable

> **Handoff incremental.** Entrada mais recente no topo. Plano-mestre:
> `docs/plans/2026-06-25-impeccable-critique-remediation-plan.md`.
> Branch: `fix/impeccable-critique-remediation`.

## Estado geral

| Fase | Status |
|------|--------|
| 0 — Preparação, baseline e guardrails | ✅ concluída |
| 1 — Fundação de cor semântica + tokens | ⏳ próxima |
| 2 — Unificar stat cards (cor semântica) | ⬜ |
| 3 — Primeiro acesso & escopo | ⬜ |
| 4 — Acessibilidade | ⬜ |
| 5 — Side-stripes + movimento/perf | ⬜ |
| 6 — Minors + polish + re-critique | ⬜ |

**Baselines (início, 2026-06-25):**
- Detector (`detect.mjs --json src`): **258** achados (234 advisory, 24 warning, 0 erros).
- Testes unit: **1857 passed / 113 files** (antes da Fase 0). Após Fase 0: **1888 / 114**.
- Contraste WCAG: corpo AA OK nos 6 temas; única exceção `arrakis danger/card = 4.42` (corpo pequeno) — alvo da Fase 4.

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
