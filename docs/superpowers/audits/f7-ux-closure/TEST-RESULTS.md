# Resultados — fechamento

Execução em `apps/v2`, Windows, Chromium 1248 do Playwright, HEAD `819c3c66`.

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build:e2e` | PASS; `index.esm` 580,47 KB, principal 664,31 KB (aviso >500 KB mantido) |
| `npm run test:unit` | PASS — 880/880 em 129 arquivos |
| `npx playwright test --project=chromium` | PASS — 244 testes, 5 skips, 0 falhas em 249 (1,6 min) |

## Novos testes

- `f2-inspector.spec.ts` — edital com 120 assuntos; paginação 50→100→120; inspeção do último nó; foco e retorno; 320 px sem overflow. Tempo de navegação registrado em `INSPECTOR_LARGE_TREE_MS`.
- `f7-ux-premium-home.spec.ts` — contexto PERFORMANCE com cenário ativo e sessão concluída; consentimento de ordem (nada muda antes de aplicar).
- `f5-review-journey.spec.ts` — detalhe F5 com tópico, avaliação, cobertura, duração, compromisso e identidade.
- `f7-ux-integrated-journey.spec.ts` — capacidade compartilhada, plano preservado após sessão e revisão; KPI de foco 30 min e planejado 60 min.

## Limitações

O Chromium do Playwright teve de ser reinstalado nesta máquina (`npx playwright install chromium`) porque o cache local estava ausente; isso não altera `package.json` nem o lockfile. NVDA, toque e hardware continuam `NOT_RUN_ENVIRONMENT`.
