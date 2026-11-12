# Resultados de teste — v15

**Data:** 2026-11-12
**Código validado:** a4b56e5e
**Branch:** v2 local
**Ambiente:** Windows, Node.js v26.13.0, Chromium do Playwright local.

## Resultado final

| Verificação | Comando | Resultado |
|---|---|---|
| Typecheck | npm run typecheck em apps/v2 | PASS, exit 0 |
| Lint | npm run lint em apps/v2 | PASS, exit 0 |
| Build | npm run build em apps/v2 | PASS, exit 0; aviso de chunks >500 KB permanece |
| Unitários | npm run test:unit | PASS, 880/880 em 129 arquivos |
| E2E | npm run test:e2e | PASS, 235/240, 5 skips, 0 falhas |
| Layout v15 | f7-ux-premium-layout.spec.ts | PASS, 6/6 |
| Captura premium | f7-ux-premium-evidence.spec.ts | PASS nos quatro temas |
| Evidência de módulos | f7-ux-evidence.spec.ts | PASS, 12 temas e 8 módulos |

## Cobertura visual e responsiva

- 1586x992: geometria do rail, busca, título, hero, passos, Bento, recursos, anel e ações.
- 1440x900: onboarding quebra sem overflow.
- 1024x900: Bento e recursos em duas colunas; ação dentro do cartão.
- 900x1100: Bento 2+1, recursos em duas colunas e rótulo compacto de Atenção.
- 390x844: CTA e arte empilhados; barra D33 preservada.
- 320x568: header em duas linhas, CTA principal inteiro na primeira dobra e barra D33 visível.
- 320x720 e 320 com texto a 200%: sem scroll horizontal.
- Quatro temas: rail, hero, cartões e recursos têm identidade própria.
- Oito módulos em quatro viewports: conteúdo, planning, sessions, reviews, attention, analytics, settings e Home.

## Skips

Os cinco skips são execuções de captura condicionais sem diretório de saída explícito:

- F3-T40 evidence.
- F6 evidence.
- F7-UX evidence.
- Duas capturas premium comparativas no runner padrão.

As capturas foram executadas separadamente com seus diretórios e passaram.

## Falhas corrigidas durante a rodada

- A primeira versão do novo header móvel deixava o CTA em 619 px contra a dobra de 568 px. O header foi reduzido a duas linhas, subtítulo técnico saudável foi ocultado e o CTA passou a terminar dentro da viewport.
- O tablet inicial usava três colunas estreitas; foi alterado para duas colunas com evolução em largura total.
- A ação do cartão foi ampliada de ~24 para 36 px.
- O teste de 1440 px impede que o nowrap entre 1400 e 1585 px volte a criar overflow.

## Não executado

- NVDA/Narrator, hardware modesto e toque físico: NOT_RUN_ENVIRONMENT.
- Firebase, Firestore, Auth, Cloudflare, Drive e staging reais: NOT_RUN/NOT_AUTHORIZED.
- Push, PR, merge remoto, deploy e F8: não realizados.

As capturas históricas F4 alteradas pelo Playwright foram restauradas do Git após cada execução.
