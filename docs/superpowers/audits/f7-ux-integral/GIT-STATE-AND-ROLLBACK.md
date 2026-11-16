# Estado Git e rollback

| Item | Valor |
|---|---|
| Branch | `v2` |
| HEAD de código | `bdebbcd0d8e76578dedef20e9efa2466623d0c3e` |
| HEAD documental | commit que contém este arquivo |
| `origin/v2` | `02b950cd842decde598820f89da3fa2aaa8274a8` |
| `main` / `origin/main` | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` |
| Worktrees | main e `_v2-candidate` |
| Stash | nenhum |
| Push/PR/merge | não executados |

## Rollback

1. `git revert --no-commit 3cf1ad56 7f37428f 1d77a93a 610a9673 819c3c66 4e7c9575 17ccda36 8824e183 bdebbcd0` e revisar o diff.
2. Não usar `reset --hard`, `clean -fd` ou force.
3. Bundle final, SHA-256, `bundle verify`, clone e `fsck` constam em `BUNDLE.txt`.
4. `main`, `origin/v2` e refs `recovery/*` não foram alterados.
5. O `revert` acima cobre código e testes. Para desfazer também este registro documental, inclua o commit que contém `f7-ux-integral`; o bundle é criado após esse commit.
