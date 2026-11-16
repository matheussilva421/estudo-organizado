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

## Foco HIGH

```powershell
npx vitest run tests/unit/legacy-recognition.test.ts tests/unit/remote-budget.test.ts tests/unit/f7-sync-budget.test.ts tests/unit/outbox-flush.test.ts tests/unit/f7-restore.test.ts tests/unit/restore-preview.test.ts tests/unit/f2-delete.test.ts tests/unit/f2-sync-budget.test.ts
npx playwright test --project=chromium tests/e2e/f7-real-outbox.spec.ts tests/e2e/f7-two-tabs.spec.ts tests/e2e/f7-ux-premium-home.spec.ts tests/e2e/f3-final-stretch-ui.spec.ts
```

O comando executa os arquivos completos; os cinco casos citados no relatório estão dentro deles.

Fixtures são sintéticas; não use IndexedDB pessoal. Emulador exige Java e Firebase CLI, ausentes neste ambiente.
