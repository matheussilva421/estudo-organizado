# Resultados locais — revisão de espaçamento v13

**Data:** 2026-11-12 · **Código:** 08700060db3edacd9f7ae49e89892c6cf824efda · **Branch:** v2 local · **Ambiente:** Windows, Node.js v26.13.0, Chromium do Playwright local.

## Comandos e resultados

| Verificação | Comando | Resultado |
|---|---|---|
| Typecheck | npm run typecheck em apps/v2 | PASS, exit 0 |
| Lint | npm run lint em apps/v2 | PASS, exit 0 |
| Unitários | npm run test:unit | PASS, 129 arquivos, 880 testes |
| E2E completo | npm run test:e2e | PASS, 236 testes, 231 aprovados, 5 skips, 0 falhas |
| Evidência premium | f7-ux-premium-evidence.spec.ts -g "capture actual home..." | PASS, 4 temas x 4 viewports |
| Geometria desktop | f7-ux-premium-layout.spec.ts | PASS, desvios ≤3 px |
| Móvel 200% | f7-ux-home-320.spec.ts | PASS após correção do min-height dos cards |

## Histórico da falha encontrada

A primeira execução completa após a mudança registrou 229 PASS, 5 SKIP e 1 FAIL. O teste f7-ux-home-320 detectou 336 px de scrollWidth contra 320 px de clientWidth no estado com 200% de texto. O elemento causal era resource-grid/resource-card, cujo min-height desktop havia sido aplicado com uma exclusão ampla no seletor móvel de links.

A correção restaurou o seletor móvel original e aplicou a altura de 95 px por seletor desktop mais específico.

A revisão visual independente posterior apontou que o breakpoint de 1400 px ainda permitia overflow entre 1400 e 1585 px. Foi adicionado um teste em 1440 px, o breakpoint foi movido para 1586 px e a suíte final passou com 231 PASS, 5 SKIP, 0 FAIL.

## Skips

Os cinco skips são execuções de captura condicionais, não falhas:

- F3-T40 evidence sem diretório explícito.
- F6 evidence sem F6_EVIDENCE_DIR.
- F7-UX evidence sem F7_UX_EVIDENCE_DIR.
- Duas capturas comparativas sem F7_UX_PREMIUM_COMPARE.

As capturas premium foram executadas separadamente com o diretório definido.

## Não executado

- NVDA/Narrator, hardware modesto e toque em dispositivo físico: NOT_RUN_ENVIRONMENT.
- Firebase, Firestore, Auth, Cloudflare, staging e qualquer serviço real: fora do escopo autorizado.
- Push, PR, merge remoto, deploy e F8: não realizados.

As quatro capturas históricas F4 modificadas pela suíte foram restauradas do Git antes do commit documental.
