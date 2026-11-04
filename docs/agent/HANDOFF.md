# F6 — aceite com ressalvas e integração

**Atualizado:** 2026-11-04
**Worktree:** `C:\Users\slvma\.codex\worktrees\v2-f4\estudo-organizado`
**Branch:** `v2`
**Código aprovado:** `482900429bed1eccc87e32646062f35e1b63f368`
**Estado:** `F6_ACCEPTED_WITH_RESERVATIONS` — [registro formal](../audits/2026-11-04-v2-f6-acceptance.md)

## Objetivo e escopo

Registrar o aceite humano com ressalvas e integrar exclusivamente à `origin/v2`,
por fast-forward, os 26 commits F6 que culminam em `4829004`, com um commit
documental adicional. Sem F7/F8, deploy, PR, Actions ou alteração da `main`.

## Concluído

- Registro formal `F6_ACCEPTED_WITH_RESERVATIONS` em 2026-11-04.
- Navegação adaptativa conforme D-F6-01 B: sidebar desktop, rail tablet e bottom
  mobile em duas linhas; DOM/foco alinhados e Label in Name corrigido.
- Testes reexecutados na integração: typecheck/lint PASS, 572 unitários PASS,
  156 E2E PASS + 2 skips, build PASS.
- Commit documental com o aceite, ROADMAP e HANDOFF atualizados.
- Integração fast-forward à `origin/v2` autorizada nesta rodada, com read-back
  registrado no relatório de integração.

## Ressalvas preservadas

- H-02 (NVDA/Narrator) e H-16 (hardware modesto): `NOT_RUN`/`BLOCKED_ENVIRONMENT`.
- H-03, H-06 e H-17: verificações humanas não integralmente confirmadas.
- AC24 `DEFERRED_F7`; RF04, RF06, RF13, RF15, RF25, RF28, RF30 e RF31 `PARTIAL`.
- Quatro HIGH F0 `UNVERIFIED`; F4-T13 `NOT_RUN`; limitação histórica de INCOMING parcial.
- Quatro commits exclusivos da branch F5 preservados.
- Este aceite não é deploy, publicação produtiva da V2 ou autorização da F7.

## Estado Git

- `main` e `origin/main`: `9046cfa` (intactas).
- `origin/v2` antes do push: `789e1bc`.
- `v2`: 26 commits funcionais + 1 commit documental de aceite, publicados por fast-forward.
- Worktree: apenas os três PNGs F4 modificados, preservados fora dos commits.
- Branch `codex/f5-local-preserved-20261102`: 4 commits exclusivos; não é ancestral da v2.

## Testes e evidências

```powershell
cd apps/v2
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright test --grep-invert "f4 representative visual evidence"
```

- Unitários: 572 PASS em 85 arquivos (36,90 s).
- E2E: 156 PASS + 2 skips (~1,1 min).
- Build: principal 388,77 kB (100,59 kB gzip) + vendor React 218,77 kB (68,25 kB gzip).
- Pacote de integração: `F6-ACCEPTANCE-INTEGRATION-REVIEW.zip`.

## Próxima ação

O aceite está registrado e a integração à `origin/v2` é o encerramento desta fase.
F7/F8 permanecem propostas e exigem novo gate humano; `main`, Cloudflare, Firebase e
produção continuam intocados.
