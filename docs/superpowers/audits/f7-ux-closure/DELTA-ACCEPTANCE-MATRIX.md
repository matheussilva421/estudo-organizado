# Matriz delta — pendências F7-UX

**Código verificado:** `48de3ac0`; documentação reconciliada em 17/11/2026. **Aceite:** `UX_HUMAN_PENDING`. **Testes atuais:** 883 unitários; 248/253 E2E com 5 skips; 36/36 emulador.

## Itens priorizados

| Requisito | Estado | Teste | Captura | Commit |
|---|---|---|---|---|
| DV-14 / VA-14 — Knowledge com inspetor e escala | PASS_VERIFIED (escopo local) | `f2-inspector.spec.ts` (120 assuntos, 50+50+20, desktop/320, seleção e foco para assunto e aula) | `states/content-inspector-*.png` | 819c3c66 |
| UX-21 / R-04 — prioridade → amostra | PASS_VERIFIED | `f5-review-journey.spec.ts`: "Ver evidência" foca o ponto fraco, abre o detalhe e mantém F4/F5; sem amostra exibe aviso | `states/review-execution-detail.png` | 4e7c9575 |
| DV-13 / VA-13 — Insights e Analytics com drill | PASS_LOCAL | `f7-ux-attention-analytics.spec.ts` seleciona recorte por edital e disciplina; `analytics-drill-edital-desktop.png` | `F7-UX-CAPTURES/modules/analytics-drill-edital-desktop.png` | `f7-local-closeout-20261117` |
| T3 — Insights com estado vazio honesto | PASS_VERIFIED | `f7-uxh-remediation.spec.ts` | `screenshots/after/modules-full/analytics-desktop-full.png` | 7f37428f |
| DV-04 / VA-06 — contexto de desempenho | PASS_VERIFIED (fixture) | `f7-ux-premium-home.spec.ts` | `states/home-performance.png` | 819c3c66 |
| DV-05 / VA-07 — consentimento de layout | PASS_VERIFIED | `f7-ux-premium-home.spec.ts` (PERFORMANCE e FINAL_STRETCH) | capturas premium | 3cf1ad56 |
| P-09 — planejamento/capacidade/execução | PASS_VERIFIED (local) | jornada: capacidade 60 min, cenário B, prévia/cancelamento, sessão 30 min, KPIs; capacidade de dois editais em `f3-capacity.test.ts` | `states/planning-capacity.png` | 4e7c9575 |
| R-09 — revisão/fila/política/importação | PASS_VERIFIED (local) | jornada: política 35 min sem aplicar, v1 preservada; `f5-portability.spec.ts`: import compatível/inválido/outro perfil; conflito em `f5-two-tabs`/`f5-import-atomic` | `states/review-execution-detail.png` | 4e7c9575 |
| DV-06 / DV-08 — camadas nos Studios | PARTIAL | duas colunas + inspetor; diferenciação/hierarquia exige UX-H | capturas full-page | 3cf1ad56 |
| DV-17 / VA-17 — sheets para operações rápidas | PASS_LOCAL (escopo implementado) | `f7-ux-review-sheet.spec.ts`: 320/390, foco, Escape e 200% | `review-sheet-mobile.png` | `f7-local-closeout-20261117` |
| DV-18 — alertas persistentes | PASS_LOCAL (amostrado) | `f6-conflicts-integrity.spec.ts`, conflito em Foco | — | anterior |
| VA-20 / AC-22 — a11y manual | PASS_AUTOMATED / MANUAL_NOT_RUN | suítes de contraste | — | — |
| F0 F-V1-VISUAL-LAYOUT-LAB | BLOCKED_NEW_APPROVAL | — | — | — |

## Índice das matrizes completas

- `docs/superpowers/audits/f7-ux/UX-ACCEPTANCE-MATRIX.md` — UX-01–UX-31, AC, P/E/R.
- `docs/superpowers/audits/f7-ux-uxh-remediation/ACCEPTANCE-MATRIX.md` — D, DV, VA, F0.
- `docs/superpowers/audits/f7-ux-premium/ACCEPTANCE-MATRIX.md` — histórico 9457b7ca.

## Pendências remanescentes

1. DV-06/DV-08: a gramática Premium e as duas colunas estão provadas; diferenciação visual/hierarquia exige UX-H.
2. DV-17: o sheet implementado está provado; outras operações rápidas dependem de decisão humana.
3. A-01, C-01 e C-02: P2 humanos documentados em `MATRIZ-UX-DV-VA.md`.
4. Ilustrações secundárias da Home continuam lineares; o herói usa a arte original.
5. Em 320×568 o CTA secundário exige rolagem; o principal permanece inteiro.
6. NVDA/Narrator, toque físico, hardware modesto e zoom nativo manual: `NOT_RUN_ENVIRONMENT`.
