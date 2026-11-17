# Backup e rollback

## Backup inicial

`backup-inicial.bundle`: SHA-256 `E8599AD0F1B30436B2AD93A4D21B803A8988836A53FE2D59B7236646C90039A4`, 34.463.697 bytes, 33 refs. Clone com HEAD `066a9070`, 1.481 commits, `fsck` sem erro (dangling das refs recovery preservadas).

## Backup final

O bundle final e o SHA-256 estão em `BUNDLE.txt` do ZIP, com cópia local em D:. O bundle contém a branch `v2`, `main`, `origin/v2`, refs recovery e os commits desta rodada.

## Rollback desta rodada

Em clone descartável:

```powershell
git revert --no-commit $(git rev-list 48de3ac0..HEAD) 48de3ac0 c436a6ee a4e74f19
git diff --stat 066a9070
```

O primeiro comando reverte os commits documentais desta rodada; o segundo reverte a correção de código. O resultado deve ter diff vazio contra `066a9070`. O rollback de segurança não foi executado no checkout de produção.

Não usar reset/clean/force no checkout real. A prova fica no clone do bundle final.
