# Reprodução

```powershell
cd C:\Projetos\estudo-organizado\_v2-candidate\apps\v2
npm run typecheck
npm run lint
npm run build:e2e
npm run test:unit
$env:PLAYWRIGHT_PORT='18620'
npx playwright test --project=chromium --reporter=line
```

## Foco HIGH — 78 testes em 10 arquivos

```powershell
npx vitest run tests/unit/f7-remote-schema.test.ts tests/unit/f7-v1-migration.test.ts tests/unit/legacy-recognition.test.ts tests/unit/remote-budget.test.ts tests/unit/f7-sync-budget.test.ts tests/unit/outbox-flush.test.ts tests/unit/f7-restore.test.ts tests/unit/restore-preview.test.ts tests/unit/f2-delete.test.ts tests/unit/f2-sync-budget.test.ts
npx playwright test --project=chromium tests/e2e/f7-real-outbox.spec.ts tests/e2e/f7-two-tabs.spec.ts tests/e2e/f7-ux-premium-home.spec.ts tests/e2e/f3-final-stretch-ui.spec.ts
```

O comando executa os arquivos completos; os cinco casos E2E citados no relatório estão dentro deles.

## Firebase Emulator — 17 testes

```powershell
$env:JAVA_HOME='C:\Projetos\_tools\jdk-21\jdk-21.0.13+9'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
$env:CI='1'
cd C:\Projetos\estudo-organizado\_v2-candidate\apps\v2
npx --no-install firebase emulators:exec --only firestore,auth --project demo-estudo-v2 --config firebase/firebase.json "npm run test:firebase"
```

Fixtures são sintéticas; não use IndexedDB pessoal. O comando usa projeto `demo-` e não executa `firebase login`, `use` ou `deploy`. Em sandbox com loopback bloqueado, o Playwright/emulador exige execução fora do sandbox.
