# F7 — fechamento local com evidências — 17/11/2026

**Estado:** `F7_LOCAL_CLOSED_WITH_EVIDENCE` / `UX_HUMAN_PENDING` / `G_EXT_PENDING` / `G_STAGING_PENDING` / `F7_NOT_ACCEPTED` / `F8_NOT_STARTED` / `REMOTE_PUSH_NOT_AUTHORIZED` / `MAIN_UNCHANGED`.

**Checkout:** `C:\Projetos\estudo-organizado\_v2-candidate`, branch `v2`.

**Base documental:** `b257afe54c0b6afc2e1bf3b553996ca2c14ba055`.

**HEAD de código:** `48de3ac01ab46d40a9d8776e6ebf2151b935afb1`.

**Remoto:** `origin/v2@02b950cd842decde598820f89da3fa2aaa8274a8`, 201 commits locais à frente e 0 atrás no início.
**V1/main:** `main` e `origin/main` em `9046cfa2283cd293b38df9d52fabfcd5de9ac67c`, intocadas.

## Resultado

A rodada repetiu os checks essenciais no HEAD atual, fechou duas lacunas E2E de backup/restauração, provou o drill-down de Análises e corrigiu um resíduo P2 de integridade: uma entidade legada sem `meta/head` não pode mais reabrir a cadeia em uma nova sequência 1.

| Verificação | Resultado atual |
|---|---|
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS; apenas aviso de chunks acima de 500 kB |
| Unitários | **883/883 em 129 arquivos** |
| E2E final | **251 PASS, 5 SKIP, 0 FAIL em 256 testes** |
| Firebase Emulator | **37/37 em 3 arquivos** |
| UX visual automatizada | capturas atuais sanitizadas em desktop, tablet, mobile e 320 px |

## O que continua fora do aceite

- `UX_HUMAN_PENDING`: nenhum `PASS_HUMAN_UX` foi emitido. Faltam julgamento visual do proprietário, NVDA/Narrator, toque físico, zoom nativo e hardware modesto.
- `G-EXT`: Firebase/Auth/Firestore/Rules publicadas, Worker/KV real, quotas medidas, duas contas Google reais e múltiplos aparelhos não foram executados.
- `G-STAGING`: nenhuma URL externa foi publicada ou submetida a read-back HTTP real.
- `G-F7`: a V2 não foi homologada nem aceita pelo proprietário.
- `F4-T13`: suspensão/retomada física prolongada `NOT_RUN_ENVIRONMENT`.
- `S14` mantém limpeza real de site data/origem dependente de staging; `S25` mantém aparelhos físicos e aceite humano pendentes.

## Entrega

Os documentos canônicos desta rodada, o CSV T01–T27/S01–S25, a matriz DV/VA, os relatórios de testes/segurança/gates, o próximo passo, as capturas úteis e o manifesto SHA-256 integram o ZIP único de revisão. Nenhum dado pessoal, token ou credencial foi incluído.

**Integração:** não houve push, merge, PR, deploy, staging, Firebase real, Cloudflare real, Actions/CI novo ou operação F8.
