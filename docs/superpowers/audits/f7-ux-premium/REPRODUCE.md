# Reproduzir o candidato

    cd C:/Projetos/estudo-organizado/_v2-candidate/apps/v2
    npm ci
    npm run typecheck
    npm run lint
    npm run build
    npm run test:unit
    $env:PLAYWRIGHT_PORT='18436'
    $env:PLAYWRIGHT_BROWSERS_PATH='C:/Users/slvma/AppData/Local/ms-playwright'
    npm run test:e2e

Para ver localmente:

    npx vite preview --host 127.0.0.1 --port 18434 --strictPort

Capturas comparativas:

    $env:F7_UX_PREMIUM_COMPARE='C:/caminho/capturas'
    npm run test:e2e -- tests/e2e/f7-ux-premium-evidence.spec.ts
    $env:F7_UX_EVIDENCE_DIR='C:/caminho/modulos'
    npm run test:e2e -- tests/e2e/f7-ux-evidence.spec.ts

As suítes de evidência regravam quatro PNGs históricos em docs/superpowers/audits/evidence; restaure com git restore desses quatro arquivos. Use perfil sintético; não há Firebase/Cloudflare.

## Roteiro UX-H

1. Avaliar as oito comparações lado a lado em comparacoes/.
2. Abrir Home vazia e com dados, os quatro temas novos, Modo Foco em 320/390, filtros de Revisões e Configurações.
3. Registrar ACEITO, ACEITO COM RESSALVAS, REPROVO ou ADIAR. Não inferir aceite.
