# Reprodução — fechamento

```powershell
cd C:\Projetos\estudo-organizado\_v2-candidate\apps\v2
npm run typecheck
npm run lint
npm run build:e2e
npm run test:unit
$env:PLAYWRIGHT_PORT='18600'
npx playwright test --project=chromium --reporter=line
```

## Evidências

```powershell
$root = 'C:\...\closure-final-7f37428f'
$env:F7_UX_EVIDENCE_DIR = "$root\evidencia-geral"
$env:F7_UX_PREMIUM_EVIDENCE = "$root\premium"
$env:F7_UX_PREMIUM_COMPARE = "$root\comparacoes"
$env:F7_UXH_EVIDENCE_DIR = "$root\contrast"
$env:F7_UXH_STATE_DIR = "$root\states"
npx playwright test --project=chromium tests/e2e/f7-ux-evidence.spec.ts tests/e2e/f7-ux-premium-evidence.spec.ts
npx playwright test --project=chromium tests/e2e/f7-uxh-remediation.spec.ts tests/e2e/f7-ux-planning-workspace.spec.ts tests/e2e/f3-final-stretch-ui.spec.ts tests/e2e/f4-habits.spec.ts tests/e2e/f5-review-journey.spec.ts tests/e2e/f2-inspector.spec.ts
```
