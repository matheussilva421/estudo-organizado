# Rollback

| Item | Valor |
|---|---|
| Código desta rodada | `6c0353bb7da20338518b36427416343ba23f1835` |
| Documentação | hash em BUNDLE.txt |
| Baseline antes da execução | `e2164e3f1e383da4bcf0567b18b55e0ef1a35b4e` |
| `main` / `origin/main` | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` |
| `origin/v2` | `02b950cd842decde598820f89da3fa2aaa8274a8` |

## Alvos

O comando git rev-list 6c0353bb..HEAD inclui todos os commits documentais desde 6c0353bb, inclusive este.

1. **Só o endurecimento:** `git revert --no-commit $(git rev-list 6c0353bb..HEAD) 6c0353bb c5abdf6c`. Volta à árvore de `ccf03457`.
2. **Toda a execução F0/F7:** `git revert --no-commit $(git rev-list 6c0353bb..HEAD) 6c0353bb c5abdf6c ccf03457 ee04aabc e4339dd0 e0856dc2 92148784 2f43fe60`. Volta à árvore de `e2164e3f`.

## Avisos

- O alvo 2 reintroduz Rules com `schemaVersion` 1..100, sem monotonicidade de revisão e sem o binding completo entre entity, change, head e receipt.
- O alvo 2 também remove `host: 127.0.0.1` da config do emulador e os avisos de falha de persistência/Prova vencida.
- Executar em clone descartável, revisar `git diff --stat` e não usar reset/clean/force.

A prova de bundle verify, clone, fsck e rollback fica em `BUNDLE.txt`.
