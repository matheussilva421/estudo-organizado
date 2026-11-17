# Regressão

HEAD de código `48de3ac01ab46d40a9d8776e6ebf2151b935afb1`.

| Suíte | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:unit` | 883/883 em 129 arquivos |
| `npx playwright test --project=chromium` | 253 testes: 248 PASS, 5 SKIP, 0 FAIL |
| Foco HIGH/sync (13 arquivos) | 141/141 |
| Firebase Emulator | 37/37 em 17/11/2026 (R1–R5, head vazio negado, 17 tipos); cinco ciclos anteriores de 34/34 preservados |

## E2E crítico

A suíte completa inclui `f7-real-outbox.spec.ts` (duas abas com Web Locks e lost ACK) e `f7-two-tabs.spec.ts` (sem double apply). Nenhum teste F7 foi convertido em SKIP.

## Skips

F3-T40 evidence, F6 evidence, F7-UX evidence e duas capturas premium condicionais; nenhum oculta falha de segurança.

## Delta

O commit altera Rules, envelope remoto, reconcilição de transação e testes. Não altera layout, dependências, IndexedDB, domínio acadêmico ou serviços reais.
