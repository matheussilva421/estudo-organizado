# Reproduzir o candidato premium

    cd C:/Projetos/estudo-organizado/_v2-candidate/apps/v2
    npm ci
    npm run typecheck
    npm run lint
    npm run build
    npm run test:unit
    PLAYWRIGHT_PORT=18434 npm run test:e2e

Para abrir localmente:

    npx vite preview --host 127.0.0.1 --port 18434 --strictPort

Use perfil de navegador temporário. Não há Firebase/Cloudflare/credenciais. A avaliação humana dos 12 temas e do Modo Foco é o gate UX-H.

