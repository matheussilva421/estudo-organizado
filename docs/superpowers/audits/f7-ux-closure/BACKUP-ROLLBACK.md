# Backup e rollback — fechamento

- Bundle anterior: `f7-uxh-remediation-t1-final.bundle`, SHA-256 `065FB10690A5C1DFE233C5DE3CA92DF4B18FA72AF956DDCA8CB0B65C798AB6C8` (referência histórica).
- Bundle novo: criado após o commit documental, com `--all`, `bundle verify`, clone de prova, `fsck` e cópia em `D:\EstudoOrganizado-Backups\`. Caminho e SHA-256 ficam em `BUNDLE.txt` e `SHA256SUMS.txt` do ZIP.
- `D:` é outra partição; a independência física não foi comprovada. O relatório não trata a cópia como offsite.

## Rollback

1. `git revert --no-commit 3cf1ad56 7f37428f` na branch `v2` e revisar o diff.
2. Não usar `reset --hard`, `clean -fd` ou force.
3. `main`, `origin/v2` e refs `recovery/*` não foram alterados.
