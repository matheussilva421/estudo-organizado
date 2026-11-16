# Comandos e exit codes

1. `java -version` → Temurin 21.0.13, exit 0.
2. `node --version` → v26.13.0.
3. `npm --version` → 12.2.2.
4. `node_modules\.bin\firebase.cmd --version` → 15.34.2, exit 0 (com `JAVA_HOME` e `CI=1`).
5. `firebase emulators:exec --only firestore,auth --project demo-estudo-v2 --config firebase/firebase.json "npm run test:firebase"` → 17/17, exit 0.
6. `npm run typecheck` → exit 0.
7. `npm run lint` → exit 0.
8. `npm run test:unit` → 881/881, exit 0.
9. `npx playwright test --project=chromium` → 248 PASS, 5 SKIP, 0 FAIL, exit 0.
10. `npx playwright test tests/e2e/f7-ux-premium-evidence.spec.ts` → 3 PASS, exit 0.
11. `npx playwright test tests/e2e/f7-ux-evidence.spec.ts` → 1 PASS, exit 0.
12. Foco HIGH (10 arquivos) → 78/78, exit 0.

Variáveis usadas apenas na sessão: `JAVA_HOME`, `PATH` prefixado, `CI=1`, `PLAYWRIGHT_PORT`, `F7_UX_PREMIUM_EVIDENCE`, `F7_UX_PREMIUM_COMPARE` e `F7_UX_EVIDENCE_DIR`. Nenhum `firebase login`, `use`, `deploy` ou credencial real.

O sandbox bloqueou loopback para Playwright/emulador (EACCES). As capturas e o emulador foram executados fora do sandbox, somente contra `127.0.0.1`.
