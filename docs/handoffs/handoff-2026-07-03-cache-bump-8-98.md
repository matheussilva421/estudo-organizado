# Handoff: bump de cache 8.98

Data: 2026-07-03

## Objetivo

Invalidar o cache estático do app após a entrega de slots reais do planejamento.

## Alterações

- `src/index.html`: URLs dos assets passaram de `8.97` para `8.98`.
- `src/sw.js`: `APP_VERSION` passou de `8.97` para `8.98`.
- `src/js/sync/sync-diagnostic.js`: diagnóstico alinhado de `8.96` para `8.98`.
- `tests/unit/css-architecture.test.js`: contrato agora exige `8.98` nos três pontos.
- Imports de módulos ES em `8.37` foram preservados.

## TDD e validação

- RED confirmado: o teste específico falhou contra os assets `8.97`.
- GREEN confirmado: 44/44 testes de arquitetura passaram.
- Suíte completa serial: 1941/1941 testes passaram.
- E2E focado de precache e reload offline: 2/2 testes passaram.

## Continuação

Nenhuma ação de código restante para este bump. Em um próximo bump, atualizar em
conjunto HTML, service worker, diagnóstico e o teste de arquitetura.
