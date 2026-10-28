# Evidência — suíte E2E mock completa (2026-10-28)

**Comando:** `npm run test:e2e:mock:all`
**Ambiente:** Windows 11, Node 24.15.0, Playwright 1.59.1, servidor mock local em `127.0.0.1:18765` e app em `127.0.0.1:18345`.
**Dados:** somente seed sintético do mock; nenhum dado real ou serviço externo.

## Resultado observado

- 166 testes executados em 5,0 min.
- **59 PASS / 107 FAIL**.
- Contagem confirmada pelo arquivo `test-results/.last-run.json`: `status=failed`, `failedTests.length=107`.
- A saída completa não foi preservada em arquivo; esta página registra o resumo, a contagem estruturada e falhas representativas.

## Falhas representativas

| Spec | Local | Erro observado |
| --- | --- | --- |
| `tests/e2e/app.spec.js` | linha 32 | `#main-content` deveria conter `01:30:00`; renderizou `61:02:00` |
| `tests/e2e/ciclo-grade.spec.js` | linha 67 | `.ciclo-header-title` não apareceu com “Planejamento” |
| `tests/e2e/ciclo-grade.spec.js` | linha 293 | botão `[data-action="toggle-edit-seq"]` não visível |
| `tests/e2e/offline-import.spec.js` | linha 32 | timeout de 30 s aguardando `navigator.serviceWorker.ready` |
| `tests/e2e/sessoes.spec.js` | linha 151 | esperava 2 `.session-group-section`; encontrou 15 |

## Interpretação

- A causa dominante aparente é divergência entre o seed sintético e as expectativas fixas dos specs (valores de tempo, contagem de grupos e presença de controles), além de timeouts de Service Worker no modo mock.
- O comando declarado no plano, `npm run test:e2e:mock`, não executa nada porque o projeto `mock` ignora `mock-environment.spec.js` no `playwright.config.js`; esse achado está registrado separadamente.
- A F0 registra as falhas e não corrige a V1. Não há conclusão de causa raiz para cada um dos 107 casos.
- Os artefatos brutos (vídeos, screenshots e `error-context.md`) permanecem em `test-results/`, que é ignorado pelo Git.
