# Preflight Git e preservação

## Estado no início da rodada

| Item | Valor |
|---|---|
| Checkout | `C:\Projetos\estudo-organizado\_v2-candidate` |
| Branch | `v2` |
| HEAD documental | `b257afe54c0b6afc2e1bf3b553996ca2c14ba055` |
| HEAD de código | `48de3ac01ab46d40a9d8776e6ebf2151b935afb1` |
| `origin/v2` | `02b950cd842decde598820f89da3fa2aaa8274a8` |
| `main` / `origin/main` | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` |
| `v2...origin/v2` | 201 à frente, 0 atrás |
| `main...origin/main` | 0 e 0 |
| Worktrees | principal em `main`; `_v2-candidate` em `v2` |
| Stash | nenhum |
| PRs | nenhum PR local criado; consulta remota disponível anteriormente registrou 0 |
| Push/merge/deploy | não executados |

Os três PNGs F4 estavam modificados fora do Git no início e foram preservados antes de qualquer teste.

## Hashes dos PNGs no snapshot inicial

| Arquivo | SHA-256 |
|---|---|
| `2026-10-31-v2-f4-desktop-neon.png` | `a11d64d3743ff9351dd7e0e8e97f4d10afab10a96eb387ada2e846420f96d7d8` |
| `2026-10-31-v2-f4-mobile-plasma.png` | `76597b17728a433941f3b63401e86a5e45bf56c062da7a9d2dfd9f4853601fa5` |
| `2026-10-31-v2-f4-tablet-ardosia.png` | `47f20e38c6fa3aee7d8850c4d096db4a84a05884ac5e1c69bf9a06fa12713a16` |

Cópias byte a byte, patch binário e `MANIFEST-SHA256.txt` ficam em `preserved-f4/` externo, sob `C:\Projetos\estudo-organizado-preservacao-20261104\f7-local-closeout-20261117`.

As imagens regravadas pelos múltiplos ciclos E2E foram salvas em `preserved-f4-after-tests/`. Antes do commit, o checkout foi restaurado byte a byte para o snapshot inicial do usuário, com conferência de hash; portanto os três PNGs continuam deliberadamente fora do commit.

## Bundle e prova de recuperação

- Bundle: `backup-inicial.bundle`, 34.472.690 bytes, 33 refs, histórico completo.
- SHA-256 do bundle: `e7c752c255142a451a2288f4a004c1356ba2907c0cabe070bdd6dc4f2cfa1b7f`.
- `git bundle verify`: OK.
- Clone de prova: HEAD `b257afe5`, 1.485 commits; `git fsck --full --no-reflogs` sem corrupção, apenas objetos dangling esperados das refs históricas preservadas.

## Branches e trabalho exclusivo

- `codex/f5-local-preserved-20261102@6cad56ce`: quatro commits exclusivos preservados; não integrada nem apagada.
- `recovery/f7-preformat-20261104@d069bf4f`: preservada.
- `recovery/v2-f7ux-20261109@7a7df0f2`: preservada.
- Quatro branches remotas conhecidas em `origin`; nenhuma branch/worktree nova criada.

## Integridade e rollback

`git fsck --full --no-reflogs` não reportou corrupção. Objetos dangling são o estado esperado de refs recuperadas e snapshots locais. Não houve `reset --hard`, `clean -fd`, force push, rebase destrutivo, prune, exclusão de worktree ou remoção de refs.

O rollback desta rodada está descrito em `REVIEW-AND-CORRECTIONS.md`; nenhuma operação de rollback foi executada no checkout real.
