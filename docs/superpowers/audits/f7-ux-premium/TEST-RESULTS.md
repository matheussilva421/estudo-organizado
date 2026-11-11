# Resultados de teste — Redesign Premium

HEAD de código: f685425f. Ambiente Windows, Node 26, npm 12, Playwright local, porta 18434.

| Comando | Resultado | Log |
|---|---|---|
| npm run typecheck | PASS, exit 0 | logs-final/typecheck.log |
| npm run lint | PASS, exit 0 | logs-final/lint.log |
| npm run test:unit | PASS, 878 testes / 129 arquivos | logs-final/unit.log |
| npm run build | PASS | logs-final/build.log |
| npm run test:e2e | PASS, 211 + 3 skips / 214 | logs-final/e2e.log |
| Firebase Emulator | NOT_RUN_ENVIRONMENT (Java ausente) | não executado |

## Evidências focais

- f7-ux-premium-themes.test.ts: catálogo 12 e previews.
- f7-ux-premium-theme.spec.ts: galeria, seleção, persistência e conteúdo intacto.
- f7-ux-premium-a11y.spec.ts: contraste 12 temas, reduced motion, 320 px.
- f7-ux-premium-home.spec.ts: onboarding vazio e contexto Reta Final.
- f7-ux-premium-focus.spec.ts: sessão única, pausa/retomada/conclusão.
- f7-ux-command-center.spec.ts: Ctrl+K, navegação, busca, foco e Escape.
- f7-ux-premium-evidence.spec.ts: 21 capturas (12 temas, Home e Foco).

### Skips

Os três skips permanecem gates de captura de evidência: f3-t40-evidence, f6-evidence e f7-ux-evidence. Nenhum novo skip de comportamento.

NVDA/Narrator, hardware modesto e toque físico: NOT_RUN.

