# Sync Hardening — Documento de Analise e Plano

**Maio 2026**

Análise completa do sistema de dados, sync e backup do Estudo Organizado, com plano detalhado para tornar o salvamento e sync zero fricção.

## Documentos

| # | Arquivo | Conteúdo |
|---|---------|----------|
| 1 | [01-exploracao-persistencia.md](./01-exploracao-persistencia.md) | Analise de store.js: estado global, IndexedDB, double-buffer, scheduleSave, emergency fallback, migracoes, credenciais |
| 2 | [02-exploracao-sync-backup.md](./02-exploracao-sync-backup.md) | Analise de todos os 4 canais de sync: Firestore, Cloudflare, Drive, Local. Conflitos, offline, backup/restore, UX |
| 3 | [03-exploracao-testes-patterns.md](./03-exploracao-testes-patterns.md) | Infraestrutura de testes, o que e testado, gaps criticos (12 gaps identificados) |
| 4 | [04-design-sync-effectiveness.md](./04-design-sync-effectiveness.md) | Design document: entity-primary estavel, auto-resolve, sync incremental, background sync, unificacao de conflito, backup automatizado |
| 5 | [05-plano-implementacao.md](./05-plano-implementacao.md) | Plano detalhado em 5 fases: salvamento local, entity-primary, sync effectiveness, backup, testes |

## Resumo Executivo

O sistema atual e funcional mas tem lacunas criticas:

1. **Race condition:** `stateSaved` dispara antes do IndexedDB commit
2. **Conflito excessivo:** casos seguros exigem resolucao manual
3. **Sync ineficiente:** todas as entidades sao enviadas em cada sync (97% desnecessario)
4. **Sem backup historico:** so double-buffer, sem point-in-time recovery
5. **Entity-primary experimental:** funcional mas sem verificacao automatica

## Plano em 5 Fases

| Fase | Escopo | Impacto |
|------|--------|---------|
| 1 | Salvamento local seguro | Fix race condition, save coalescing |
| 2 | Entity-primary estavel | Auto shadow verify, auto-resolve, sync incremental |
| 3 | Sync effectiveness | Background Sync API, progresso, unificacao |
| 4 | Backup & recovery | Rotacao automatizada, health monitoring, timeline |
| 5 | Testes | 5 suites de testes novos cobrindo gaps criticos |

## Referencias Existentes

- `src/docs/api/sync-contract.md` — contrato de sync (envelopes, regras, limites)
- `src/docs/architecture/data-flow.md` — fluxo de dados
- `src/docs/architecture/app-overview.md` — visao geral da arquitetura
- `src/docs/security/sync-threat-model.md` — threat model de sync
- `src/docs/firebase-firestore-setup.md` — setup Firebase
