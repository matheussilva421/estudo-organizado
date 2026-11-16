# Git e rollback

| Item | Valor |
|---|---|
| Branch | `v2` |
| HEAD de código | `6c0353bb7da20338518b36427416343ba23f1835` |
| HEAD documental | hash em BUNDLE.txt |
| `origin/v2` | `02b950cd842decde598820f89da3fa2aaa8274a8` |
| `main` / `origin/main` | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` |
| Divergência vs. `origin/v2` | 193 à frente, 0 atrás |
| Divergência vs. `main` | 476 à frente, 0 atrás |
| Push/PR/merge | não executados |

## Rollback A — somente o endurecimento desta rodada

Em clone descartável:

```powershell
git revert --no-commit $(git log -1 --format=%H -- docs/superpowers/audits/f7-ux-high-risks) 6c0353bb
git diff --stat
```

Resultado: árvore de `ccf03457`. As Rules mantêm schemaVersion == 1, mas perdem monotonicidade de revisão e o binding completo entity/change/head/receipt. Use este alvo apenas para isolar o endurecimento.

## Rollback B — toda a execução desde `e2164e3f`

Em clone descartável:

```powershell
git revert --no-commit $(git log -1 --format=%H -- docs/superpowers/audits/f7-ux-high-risks) 6c0353bb ccf03457 ee04aabc e4339dd0 e0856dc2 92148784 2f43fe60
git diff --stat
```

Resultado: árvore de `e2164e3f`. Reintroduz as Rules permissivas (1..100), o host padrão do emulador e remove os avisos de Home/Reta Final. Não usar reset/clean/force.

O rollback será marcado como testado somente após execução no clone do bundle; a prova fica em `BUNDLE.txt`.
