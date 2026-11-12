# Reproduzir

    cd C:/Projetos/estudo-organizado/_v2-candidate/apps/v2
    npm ci
    npm run typecheck
    npm run lint
    npm run build
    npm run test:unit
    $env:PLAYWRIGHT_PORT='18436'
    $env:PLAYWRIGHT_BROWSERS_PATH='C:/Users/slvma/AppData/Local/ms-playwright'
    npm run test:e2e

Capturas:

    $env:F7_UX_PREMIUM_COMPARE='C:/caminho/saida'
    npm run test:e2e -- tests/e2e/f7-ux-premium-evidence.spec.ts
    $env:F7_UX_EVIDENCE_DIR='C:/caminho/modulos'
    npm run test:e2e -- tests/e2e/f7-ux-evidence.spec.ts

Preview: npx vite preview --host 127.0.0.1 --port 18434 --strictPort. Perfil sintético; nenhum Firebase/Cloudflare. Roteiro UX-H: comparar as oito imagens lado a lado e os overlays, abrir os 12 temas, Home vazia/dados, Foco em 320/390 e estúdios.
