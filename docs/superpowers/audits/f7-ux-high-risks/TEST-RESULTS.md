# Resultados de teste — riscos HIGH

HEAD de código `e4339dd0b761a815617d89c33c30a22028bd4202`, Windows, Chromium 1248.

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build:e2e` | PASS |
| `npm run test:unit` | PASS — 881/881 em 129 arquivos |
| `npx playwright test --project=chromium` | PASS — 248 testes, 5 skips, 0 falhas em 253 |

## Foco HIGH

- 60 unitários em 9 arquivos: `f7-remote-schema` (schema futuro rejeitado), `f7-v1-migration`, `legacy-recognition`, `remote-budget`, `f7-sync-budget`, `outbox-flush`, `f7-restore`, `restore-preview`, `f2-delete`, `f2-sync-budget`.
- 4 arquivos E2E, 5 casos direcionados: `f7-real-outbox` (2), `f7-two-tabs` (1) e os novos fluxos de Home e Reta Final.
- Nenhum RED novo reproduzido; as falhas seguras já estão implementadas.

## Skips

F3-T40 evidence, F6 evidence, F7-UX evidence e duas capturas premium condicionais. Nenhum skip oculta falha.

## Limites

Firebase Emulator, NVDA/Narrator, toque, hardware e zoom nativo manual não foram executados.
