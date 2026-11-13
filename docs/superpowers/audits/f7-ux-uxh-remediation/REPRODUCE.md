# Reprodução

## Testes

```powershell
cd apps/v2
npm run typecheck
npm run lint
npm run build
npm run test:unit
$env:PLAYWRIGHT_PORT='18500'
npx playwright test --project=chromium --reporter=line
```

O Playwright sobe `vite preview` em `127.0.0.1:$env:PLAYWRIGHT_PORT`. Em ambiente com sandbox de rede, execute fora do sandbox.

## Evidências

```powershell
$root = 'C:\...\uxh-remediation-92745e0a'
$env:F7_UX_EVIDENCE_DIR = "$root\evidencia-geral"
$env:F7_UX_PREMIUM_EVIDENCE = "$root\premium"
$env:F7_UX_PREMIUM_COMPARE = "$root\comparacoes"
$env:F7_UXH_EVIDENCE_DIR = "$root\contrast"
$env:F7_UXH_STATE_DIR = "$root\states"
npx playwright test --project=chromium --reporter=line tests/e2e/f7-ux-evidence.spec.ts tests/e2e/f7-ux-premium-evidence.spec.ts
npx playwright test --project=chromium --reporter=line tests/e2e/f7-uxh-remediation.spec.ts tests/e2e/f7-ux-planning-workspace.spec.ts tests/e2e/f3-final-stretch-ui.spec.ts tests/e2e/f4-habits.spec.ts tests/e2e/f5-review-journey.spec.ts
```

## Referências

Os quatro PNGs originais ficam em `references/`; confira com `Get-FileHash -Algorithm SHA256` contra os hashes do manifesto.

