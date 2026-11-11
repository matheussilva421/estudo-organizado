# Riscos, gates e P2 — Redesign Premium

## Gates

| Gate | Estado |
|---|---|
| P0/P1 locais conhecidos | NENHUM |
| UX-H premium | PENDING_HUMAN |
| push origin/v2 | NOT_AUTHORIZED |
| G-EXT | BLOCKED |
| G-STAGING | BLOCKED |
| F8/main | NÃO INICIADO |
| NVDA/hardware | NOT_RUN_ENVIRONMENT |

## P2 e parciais

- DV-04/DV-05/VA-07: Home não reorganiza widgets automaticamente; layout fixo preservado, sem sugestão de rearranjo.
- DV-06/DV-08/DV-12–DV-14/VA-08/09/12–14: recomposição visual profunda de Knowledge, Insights e Review Studios parcial.
- DV-17/VA-17: bottom sheets dedicados não foram introduzidos; responsividade e detalhes existentes preservados.
- VA-03: troca de tema não foi testada com sessão ativa, embora não recarregue a página.
- VA-19: alerta crítico em Foco implementado; conflito real em tela pequena não exercitado.
- Links inline <24 px da Home seguem como P2 de toque.
- Firestore Rules, migração V1, consentimento remoto e homologação real continuam gates separados.

## Segurança

Nenhum dado real, serviço externo, credencial, push, PR, Action, deploy ou migração foi usado.

