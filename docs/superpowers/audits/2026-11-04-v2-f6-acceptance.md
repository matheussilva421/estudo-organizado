# F6 — aceite humano com ressalvas

**Estado:** `F6_ACCEPTED_WITH_RESERVATIONS`
**Data:** 04/11/2026
**Origem:** aprovação expressa do proprietário em conversa no Codex Desktop.
**Código aprovado:** `482900429bed1eccc87e32646062f35e1b63f368`
**Branch:** `v2`. **Integração autorizada:** fast-forward exclusivo para `origin/v2`; `main` não é tocada.

## Escopo aprovado

O aceite cobre a entrega técnica F6 revisada, incluindo as decisões **D-F6-01 a D-F6-22, todas na opção B**, a navegação adaptativa (sidebar desktop, rail tablet e bottom mobile), shell/rotas, Home, busca, atenção/integridade, configurações, analytics, rascunhos, paginação, fontes locais e os testes/evidências do pacote final. Não cobre F7, F8, Firebase, Cloudflare, deploy ou publicação em produção.

## Resultados reportados no pacote

- 572 testes unitários PASS.
- 156 E2E PASS + 2 skips justificados, excluindo o gerador histórico de capturas F4.
- Navegação: 6 testes de geometria/foco; RED 6/6 contra `cada926` e GREEN 6/6 no código corrigido.
- Build: principal 388,77 kB (100,59 kB gzip) + vendor React 218,77 kB (68,25 kB gzip).
- Matriz visual 8 temas × 3 viewports; contraste mínimo global 6,78:1, navegação ativa 14,09:1 e inativa 10,37:1.
- 31 capturas F6; nenhuma captura F4 regravada.

## Testes realmente reexecutados na integração (2026-11-04)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | PASS — 85 arquivos, 572 testes, 36,90 s |
| `npm run build` | PASS — principal 388,77 kB (100,59 kB gzip) + vendor 218,77 kB (68,25 kB gzip) |
| Playwright direcionado (navegação, shell, a11y, F2/F3/F4) | PASS — 31/31 |
| Playwright completo (exceto gerador F4) | PASS — 156 PASS + 2 skips, 1,1 min |

Os resultados reportados acima permanecem como evidência da rodada de fechamento; os reexecutados nesta integração são os que fundamentam o aceite e a publicação.

## Ressalvas obrigatórias

- **H-02:** NVDA/Narrator não executado; `NOT_RUN`/`BLOCKED_ENVIRONMENT`.
- **H-16:** hardware modesto real não executado; `NOT_RUN`.
- **H-03, H-06 e H-17:** verificações humanas não integralmente confirmadas.
- **AC24:** `DEFERRED_F7` — isolamento local por `profileId` verificado; troca de identidade/perfil não homologada.
- **RF04, RF06, RF13, RF15, RF25, RF28, RF30 e RF31:** `PARTIAL`, conforme a matriz.
- **Quatro riscos HIGH F0:** `UNVERIFIED`.
- **F4-T13:** `NOT_RUN`.
- **INCOMING parcial:** limitação histórica preservada; projeções afetadas são diagnósticas, não conciliação integral.
- **F5:** branch `codex/f5-local-preserved-20261102` mantida com seus quatro commits exclusivos (`2f556da`, `9654fcd`, `90a1d9a`, `6cad56c`).

## Preservação

- Três PNGs F4 modificados permanecem intocados, com SHA-256:
  - desktop-neon: `47226C6658D1C53608BF8286A4ADBB84CE146BF2E6F507BDAE76115337F0ADF5`
  - mobile-plasma: `CDCAAC9B9E62D814F2BDA326CDDF795E99F9DE239B130BE363633D0BF1748136`
  - tablet-ardosia: `FEBF535CD9FA321223A7DEBFF268C66A9074E3F6A0CD044DE0F5562120B32C4A`
- `main` e `origin/main` permanecem em `9046cfa`; nenhum deploy ou cutover.
- Nenhuma alteração em Firebase, Cloudflare, workflows ou V1.

## Limite do aceite

Este registro **não** declara deploy, publicação produtiva da V2, homologação Firebase/F7 ou autorização para iniciar F7/F8. O aceite é da entrega local F6 integrada à branch `v2`, com as ressalvas acima.
