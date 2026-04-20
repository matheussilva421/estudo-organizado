# Implementacao App Maturity Plan - Fases

Este documento acompanha o progresso do plano de maturidade em `2026-04-18-app-maturity-implementation-plan.md`.

Nota de estado: o plano principal foi supersedido para fins de estabilizacao pelo plano `2026-04-19-regression-recovery-implementation-plan.md`. A lista abaixo registra o estado real apos a auditoria e as recuperacoes ja implementadas.

## Fase 1: Baseline e Documentacao

**Status:** completa.

- `src/docs/architecture/app-overview.md`
- `src/docs/architecture/data-flow.md`
- `src/docs/security/sync-threat-model.md`
- `README.md` atualizado com comandos de teste, CI e links de documentacao.

## Fase 2: CSP e Inline Handlers

**Status:** completa para scripts e handlers de evento.

- Criado `src/js/ui/dom.js`.
- Criado `src/js/ui/actions.js`.
- Migrados handlers inline app-owned para contratos `data-action`.
- Criado `tests/unit/inline-handlers.test.js` para bloquear regressao de handlers inline, scripts inline app-owned e `script-src` inseguro.
- Movida a registracao do service worker para `src/js/sw-register.js`.
- Removidos `'unsafe-inline'` e `'unsafe-eval'` de `script-src`.
- `style-src 'unsafe-inline'` permanece deliberadamente ate a conclusao da limpeza de estilos inline legados.

## Fase 3: Acessibilidade Basica

**Status:** completa no escopo automatizado atual.

- Criado `src/js/ui/dialog.js`.
- Adicionados `role="dialog"`, `aria-modal`, `aria-labelledby` e regiao `aria-live`.
- Adicionada utility `.sr-only`.
- Busca global validada com resultados em botoes, navegacao ArrowUp/ArrowDown, Enter e Escape.
- Tabs, chips e botoes criticos migrados para controles semanticos nas areas recuperadas.

## Fase 4: Modularizacao de Views

**Status:** completa no primeiro corte, com compatibilidade preservada.

- Extraidos:
  - `src/js/views/home-view.js`
  - `src/js/views/calendar-view.js`
  - `src/js/views/editais-view.js`
  - `src/js/views/dashboard-view.js`
  - `src/js/views/banca-view.js`
- `calendar-view.js` e `banca-view.js` estao no caminho runtime validado por testes.
- `views.js` permanece como barrel de compatibilidade para funcoes ainda legadas.
- `main.js` expoe os modulos runtime necessarios para a ponte `window`.

## Fase 5: Design System

**Status:** em andamento.

- Criados `src/css/tokens.css`, `src/css/base.css`, `src/css/components.css` e `src/css/views.css`.
- Movidos tokens raiz para `tokens.css`.
- Linkada a ordem de CSS no `index.html`: tokens, base, components, views e legado.
- Adicionado `tests/unit/css-architecture.test.js` para proteger a arquitetura CSS.
- Empty states e varias superficies criticas foram consolidadas em classes.
- Ainda pendente: classificar/remover estilos inline restantes, substituir `transition: all` e `outline: none` remanescentes, e so entao remover `style-src 'unsafe-inline'`.

## Fase 6: PWA Quality

**Status:** completa no escopo de runtime atual.

- Service worker inclui os modulos `ui/*` e `views/*` necessarios ao runtime.
- Manifest e estrategias de cache foram revisados.
- E2E valida que o precache contem os modulos runtime extraidos.
- E2E valida reload offline apos precache do service worker.

## Fase 7: Sync Hardening

**Status:** completa no contrato Cloudflare atual.

- Envelope de sync versionado.
- Protecao contra sobrescrita obsoleta via `baseRemoteUpdatedAt`.
- Worker rejeita writes stale com 409.
- UI de conflito oferece export local, pull remoto e force overwrite.
- `ALLOWED_ORIGINS` documentado para deploy.
- `src/docs/api/sync-contract.md` atualizado.

## Fase 8: Testes e CI

**Status:** em andamento continuo, com cobertura de regressao ampliada.

- Unit tests atuais: logic, store, utils, action contracts, sync conflict, CSS architecture e inline handlers.
- E2E atuais cobrem boot, criacao de evento, calendario, editais, planejamento, ciclo, revisoes, habitos, sessoes, busca, configuracoes, banca, mobile overflow e PWA precache.
- CI documentado no `README.md` e configurado em `.github/workflows/ci.yml`.
- Import validation coberta por E2E com JSON invalido.

## Fase 9: Release Discipline

**Status:** completa como documentacao operacional, em manutencao continua.

- `src/docs/qa/manual-regression-checklist.md`
- `src/docs/releases/release-checklist.md`
- Severidade de bugs documentada.
- Definicao de pronto documentada.

## Verificacao 2026-04-20

- `npm test` - 70 tests passing.
- `npm run test:e2e -- tests/e2e/revisoes-habitos.spec.js tests/e2e/sessoes.spec.js` - 4 tests passing.
- `npm run test:e2e -- tests/e2e/calendar.spec.js tests/e2e/app.spec.js tests/e2e/planejamento.spec.js` - 20 tests passing.
- `npm run test:e2e -- tests/e2e/offline-import.spec.js` - 2 tests passing.
- `npm run test:e2e` - 27 tests passing.

## Proximas pendencias reais

- Concluir Fase 6 do plano de recuperacao: inventario e migracao dos `style=` restantes, `transition: all`, `outline: none` e CSP de estilos.
- Adicionar evidencia manual ou screenshot para a verificacao mobile de CTA em empty states.
