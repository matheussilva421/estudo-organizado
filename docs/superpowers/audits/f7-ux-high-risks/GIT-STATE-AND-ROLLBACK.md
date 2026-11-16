# Git e rollback

| Item | Valor |
|---|---|
| Branch | `v2` |
| HEAD de código | `e4339dd0b761a815617d89c33c30a22028bd4202` |
| HEAD documental | commit que contém este arquivo |
| `origin/v2` | `02b950cd842decde598820f89da3fa2aaa8274a8` |
| `main` / `origin/main` | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` |
| Divergência | 189 à frente no código, 0 atrás |
| Push/PR/merge | não executados |

## Rollback

1. Em clone descartável: `git revert --no-commit e4339dd0 e0856dc2 92148784 2f43fe60 bdebbcd0 8824e183 17ccda36 4e7c9575 819c3c66 610a9673 1d77a93a 7f37428f 3cf1ad56` (mais novo primeiro).
2. Revisar o diff; o commit documental desta rodada é revertido separadamente.
3. Não usar reset/clean/force.
4. Bundle final, SHA-256, verify, clone e fsck em `BUNDLE.txt`.
