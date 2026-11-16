# Resultados de teste — auditoria integral

HEAD de código `bdebbcd0d8e76578dedef20e9efa2466623d0c3e`, Windows, Chromium 1248 do Playwright.

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build:e2e` | PASS; `index.esm` 580,47 KB, principal 664,31 KB |
| `npm run test:unit` | PASS — 880/880 em 129 arquivos |
| `npx playwright test --project=chromium` | PASS — 246 testes, 5 skips, 0 falhas em 251 |

## Skips

F3-T40 evidence, F6 evidence, F7-UX evidence e duas capturas premium condicionais. Todos dependem de variável de ambiente de evidência; nenhum esconde falha.

## Acessibilidade e desempenho

- Contraste: 36/36 amostras ≥ 4,5:1; mínimo 7,02:1, máximo 13,56:1.
- Zoom: viewport 640 + `body.zoom` 200% no teste; zoom nativo manual NOT_RUN.
- Árvore de 120 assuntos: paginação 50→100→120; navegação medida em `INSPECTOR_LARGE_TREE_MS`.
- `f6-performance` e `f6-large-tree` mantêm as medições locais; hardware modesto real NOT_RUN.
- Falha de gravação em `localStorage` para o layout manual não tem teste dedicado (P2); o fluxo com armazenamento normal é coberto.

## Ambiente

Node e npm do projeto; Chromium do Playwright reinstalado localmente. Java ausente: Firebase Emulator NOT_RUN_ENVIRONMENT. Nenhum serviço real foi acessado.
