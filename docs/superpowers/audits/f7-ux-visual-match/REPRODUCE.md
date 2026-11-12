# Reproduzir os testes e as capturas

## Testes

    cd C:/Projetos/estudo-organizado/_v2-candidate/apps/v2
    npm ci
    npm run typecheck
    npm run lint
    npm run build
    npm run test:unit
    $env:PLAYWRIGHT_PORT='18436'
    $env:PLAYWRIGHT_BROWSERS_PATH='C:/Users/slvma/AppData/Local/ms-playwright'
    npm run test:e2e

## Home vazia

    $env:F7_UX_PREMIUM_COMPARE='C:/caminho/visual-match-v15'
    npm run test:e2e -- tests/e2e/f7-ux-premium-evidence.spec.ts -g "capture actual home for each original premium concept"

## Home com fixtures

    $env:F7_UX_PREMIUM_COMPARE='C:/caminho/visual-match-v15/data'
    npm run test:e2e -- tests/e2e/f7-ux-premium-evidence.spec.ts -g "capture the populated home"

## Módulos e 12 temas

    $env:F7_UX_EVIDENCE_DIR='C:/caminho/visual-match-v15/evidencia-modulos'
    npm run test:e2e -- tests/e2e/f7-ux-evidence.spec.ts

## Comparações e réguas

    python visual-match-v15/instrumentos/render_comparisons.py

O script gera oito comparações, overlays, diferenças e as linhas-guia do hero.

## Preview local

    npx vite preview --host 127.0.0.1 --port 18433 --strictPort

Use perfil anônimo ou temporário. Não há Firebase, Cloudflare, staging ou dados reais.

O roteiro UX-H é comparar as quatro referências com as capturas vazias e revisar a Home com dados, os Studios, 320x568, tablet, os 12 temas e o Modo Foco.
