# Preflight e Git

| Item | Valor |
|---|---|
| Checkout | `C:\Projetos\estudo-organizado\_v2-candidate` |
| Branch | `v2` |
| HEAD inicial | `066a90706ce146f8e02acb5279e623e52c4f0108` |
| HEAD de código final | `48de3ac01ab46d40a9d8776e6ebf2151b935afb1` |
| `origin/v2` | `02b950cd842decde598820f89da3fa2aaa8274a8` |
| `main` / `origin/main` | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` |
| Ahead/behind antes do commit documental | 200 à frente de `origin/v2`, 0 atrás; 483 à frente de `main`, 0 atrás |
| Worktrees | `main` e `_v2-candidate` |
| Stash | nenhum |
| Push/PR/merge | não executados |

## Trabalho não commitado preservado

Dois PNGs F4 estavam modificados no início:

- `2026-10-31-v2-f4-desktop-neon.png` — SHA-256 `13F2E4694A008602CDC766CBB0CE1D54E77E46F19E742528143F30E3E897C642`.
- `2026-10-31-v2-f4-tablet-ardosia.png` — SHA-256 `C702F1C8C0C041850942DF87D64B46169EFC564E7DF993CE2042A51DB8197778`.

Cópias byte a byte e manifesto em `preserved-f4/` externo. Após o primeiro E2E, três PNGs estavam modificados (incluindo mobile-plasma); o estado foi preservado em `preserved-f4-after-tests/`. O E2E final regravou os três novamente; o estado final está em `preserved-f4-final/`. Nenhum PNG F4 entrou nos commits `a4e74f19`, `c436a6ee` ou `48de3ac0`.

## PRs

`gh pr list` falhou por indisponibilidade de rede (`error connecting to api.github.com`). Nenhum PR foi criado ou alterado nesta rodada; o estado remoto conhecido permanece `origin/v2` e `main` acima.

## Backup inicial

Bundle `backup-inicial.bundle`: SHA-256 `E8599AD0F1B30436B2AD93A4D21B803A8988836A53FE2D59B7236646C90039A4`, 34.463.697 bytes, 33 refs. Clone de prova com HEAD `066a9070`, 1.481 commits e `git fsck` apenas com dangling commits das refs recovery preservadas.
