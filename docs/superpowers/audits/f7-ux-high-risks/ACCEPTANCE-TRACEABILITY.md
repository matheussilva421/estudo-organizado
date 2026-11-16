# Rastreabilidade de aceite

| Critério | Evidência correta | Estado |
|---|---|---|
| DV-13 / VA-13 | Análises: visão geral, drill por edital/disciplina, gráfico×tabela, amostra e exportação — `f7-ux-attention-analytics`, `f7-ux-analytics` | PASS_LOCAL_VERIFIED |
| VA-06 | contextos diário/reta/desempenho com projeções coerentes — `f7-ux-premium-home`; benchmark de hardware é gate separado | PASS_LOCAL_VERIFIED (fixtures) |
| DV-05 / VA-07 | sugestão com consentimento, layout manual, undo e persistência — `f7-ux-premium-home` | DV-05 PARTIAL_JUSTIFIED; VA-07 PASS_LOCAL_VERIFIED |
| F3 prova vencida | `tests/e2e/f3-final-stretch-ui.spec.ts` | PASS_LOCAL |
| UX-21 / R-04 | prioridade → ponto fraco → F5 → F4; duas prioridades e sem amostra — `tests/e2e/f5-review-journey.spec.ts` | PASS_LOCAL_VERIFIED |
| P-09 / R-09 | jornada integrada — `tests/e2e/f7-ux-integrated-journey.spec.ts` | PASS_LOCAL_VERIFIED |
| F7 Rules/schema/transação | `f7-firestore-rules` (15) e `f7-remote-transaction` (2) no emulador | PASS_EMULATOR_LOCAL |

## Matrizes

- `docs/superpowers/audits/f7-ux/UX-ACCEPTANCE-MATRIX.md`
- `docs/superpowers/audits/f7-ux-uxh-remediation/ACCEPTANCE-MATRIX.md`
- `docs/superpowers/audits/f7-ux-high-risks/MODULES-ACCEPTANCE-MATRIX.md`
- `docs/superpowers/audits/f7-ux-high-risks/FULL-DV-VA-MATRIX.md`
