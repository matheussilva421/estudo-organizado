# Resultados — fechamento

Execução em `apps/v2`, Windows, Chromium 1248 do Playwright, HEAD `17ccda36`.

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build:e2e` | PASS; `index.esm` 580,47 KB, principal 664,31 KB (aviso >500 KB mantido) |
| `npm run test:unit` | PASS — 880/880 em 129 arquivos |
| `npx playwright test --project=chromium` | PASS — 245 testes, 5 skips, 0 falhas em 250 (2,1 min) |

## Novos testes

- `f2-inspector.spec.ts` — edital com 120 assuntos; paginação 50→100→120; inspeção do último nó; foco e retorno; 320 px sem overflow. Tempo de navegação registrado em `INSPECTOR_LARGE_TREE_MS`.
- `f7-ux-premium-home.spec.ts` — contexto PERFORMANCE com cenário ativo e sessão concluída; consentimento de ordem (nada muda antes de aplicar).
- `f5-review-journey.spec.ts` — detalhe F5 com tópico, avaliação, cobertura, duração, compromisso e identidade.
- `f7-ux-integrated-journey.spec.ts` — capacidade compartilhada, plano preservado após sessão e revisão; KPI de foco 30 min e planejado 60 min.
- `f5-portability.spec.ts` — exportação real, prévia compatível, arquivo inválido e outro perfil; nada é aplicado.
- `f7-ux-integrated-journey.spec.ts` (R-09) — prévia de política 35 min sem aplicar; política v1 preservada após reload.
- `f5-review-journey.spec.ts` (UX-21) — prioridade "Ver evidência" foca o ponto fraco e abre o detalhe.

## Limitações

O Chromium do Playwright teve de ser reinstalado nesta máquina (`npx playwright install chromium`) porque o cache local estava ausente; isso não altera `package.json` nem o lockfile. NVDA, toque e hardware continuam `NOT_RUN_ENVIRONMENT`.
