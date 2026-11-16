# Resultados de teste — HEAD final

HEAD de código `6c0353bb7da20338518b36427416343ba23f1835`, Windows, Chromium 1248.

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build:e2e` | PASS |
| `npm run test:unit` | PASS — 881/881 em 129 arquivos |
| `npx playwright test --project=chromium` | PASS — 248 testes, 5 skips, 0 falhas em 253 |
| `firebase emulators:exec ... "npm run test:firebase"` | PASS — 17/17, exit 0 |

## Foco HIGH

- 78 unitários em 10 arquivos: `f7-remote-schema` (6), `f7-v1-migration` (13), `legacy-recognition` (6), `remote-budget` (4), `f7-sync-budget` (5), `outbox-flush` (7), `f7-restore` (15), `restore-preview` (12), `f2-delete` (7) e `f2-sync-budget` (3).
- 4 arquivos E2E, 5 casos direcionados: `f7-real-outbox` (2), `f7-two-tabs` (1) e os fluxos de Home e Reta Final.
- 2 arquivos Firebase, 17 casos: `f7-firestore-rules` (15) e `f7-remote-transaction` (2), com Rules reais carregadas no emulador.
- Capturas: `f7-ux-premium-evidence` 3/3 e `f7-ux-evidence` 1/1.

## Skips

F3-T40 evidence, F6 evidence, F7-UX evidence e duas capturas premium condicionais. Nenhum skip oculta falha.

## Limites

O Firebase Emulator foi executado em loopback; backend real, quotas, billing, NVDA/Narrator, toque, hardware e zoom nativo manual continuam NOT_RUN.
