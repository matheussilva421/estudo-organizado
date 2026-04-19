# Implementacao App Maturity Plan - Fases

Este documento acompanha o progresso da implementacao do plano de maturidade do app em `2026-04-18-app-maturity-implementation-plan.md`.

## Fase 1: Baseline e Documentacao

**Status:** completa.

- `src/docs/architecture/app-overview.md`
- `src/docs/architecture/data-flow.md`
- `src/docs/security/sync-threat-model.md`
- `README.md` atualizado com comandos de teste e links de documentacao.

## Fase 2: CSP e Inline Handlers

**Status:** completa para scripts e handlers de evento.

- Criado `src/js/ui/dom.js`.
- Criado `src/js/ui/actions.js`.
- Migrados handlers inline app-owned para contratos `data-action`.
- Criado `tests/unit/inline-handlers.test.js` para bloquear regressao de handlers inline, scripts inline app-owned e `script-src` inseguro.
- Movida a registracao do service worker para `src/js/sw-register.js`.
- Removidos `'unsafe-inline'` e `'unsafe-eval'` de `script-src`.
- `style-src 'unsafe-inline'` permanece de forma deliberada ate a Fase 5 remover estilos inline legados.

## Fase 3: Acessibilidade Basica

**Status:** completa no escopo basico, com pendencias avancadas.

- Criado `src/js/ui/dialog.js`.
- Adicionados `role="dialog"`, `aria-modal`, `aria-labelledby` e regiao `aria-live`.
- Adicionada utility `.sr-only`.
- Pendencias: botoes semanticos em superfices clicaveis, acessibilidade da busca, focus styles completos, reduced motion e verificacao manual de teclado.

## Fase 4: Modularizacao de Views

**Status:** completa no primeiro corte.

- Extraidos:
  - `src/js/views/home-view.js`
  - `src/js/views/calendar-view.js`
  - `src/js/views/editais-view.js`
  - `src/js/views/dashboard-view.js`
  - `src/js/views/banca-view.js`
- `src/js/views.js` permanece como barrel de compatibilidade.
- Imports dos modulos extraidos foram corrigidos para usar o mesmo grafo versionado (`?v=8.3`) do app.
- Funcoes legadas ainda pertencentes a `views.js` continuam acessadas pela ponte de compatibilidade `window`.

## Fase 5: Design System

**Status:** em andamento.

- Criados `src/css/tokens.css`, `src/css/base.css`, `src/css/components.css` e `src/css/views.css`.
- Movidos tokens raiz para `tokens.css`.
- Linkada a ordem de CSS no `index.html`: tokens, base, components, views e legado.
- Adicionado `tests/unit/css-architecture.test.js` para proteger a arquitetura CSS.
- Migrado o layout repetido dos cards estatisticos da home para `.dashboard-stat-card`.
- Migrada a tipografia repetida dos valores e detalhes dos cards da home para `.dashboard-stat-value` e `.dashboard-stat-detail-*`.
- Remover estilos inline gradualmente.
- So depois disso remover `style-src 'unsafe-inline'`.

## Fase 6: PWA Quality

**Status:** pendente.

- Melhorar manifest/icons.
- Refinar estrategia do service worker.
- Vendorizar dependencias externas quando aplicavel.

## Fase 7: Sync Hardening

**Status:** pendente.

- Versionar envelope de sync.
- Proteger sobrescrita destrutiva.
- Reforcar validacao no Worker.

## Fase 8: Testes e CI

**Status:** em andamento.

- Unit tests atuais: store, logic, utils e inline-handler guard.
- E2E smoke tests atuais: bootstrap da home e criacao/persistencia de evento.
- Pendente: GitHub Actions, cobertura ampliada por fluxo critico e matriz de regressao.

## Fase 9: Release Discipline

**Status:** pendente.

- Checklist manual de regressao.
- Checklist de release.
- Severidade de bugs.
- Definicao de pronto.

## Verificacao 2026-04-19

- `npm run test:unit` - 51 tests passing.
- `npm run test:e2e` - 2 tests passing.
- grep de handlers/scripts inline - limpo, exceto `style-src 'unsafe-inline'` esperado.

## Verificacao 2026-04-19 - Task 5

- `npm run test:unit -- tests/unit/css-architecture.test.js` - 4 tests passing.
