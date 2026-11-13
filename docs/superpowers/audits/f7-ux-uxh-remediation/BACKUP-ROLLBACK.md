# Backup e rollback

## T0 — protegido antes da rodada

`C:\Projetos\estudo-organizado-preservacao-20261104\f7-ux-premium-comparacao\f7-uxh-remediation-t0-48548168.bundle`

- SHA-256: `2828EA557365B115867726960666621F285756E4076C3303B904DB908C3D6AA9`
- 32.087.688 bytes; `git bundle verify`, clone normal, clone `--mirror` e `fsck` PASS.
- Cópia idêntica em `D:\EstudoOrganizado-Backups\f7-uxh-remediation-20261113\`.

## T1 — fechamento

Bundle `--all` criado após o commit documental, com `git bundle verify` e clone de prova. O caminho e o SHA-256 são registrados em `BUNDLE.txt` e `SHA256SUMS.txt` na raiz do ZIP, porque um bundle não pode conter o hash de si mesmo.

## Rollback

1. Não use `reset --hard` nem `clean -fd`.
2. Para inspecionar o baseline: `git clone <bundle-T0> t0-check` e `git -C t0-check log --oneline -1` (deve mostrar `48548168`).
3. Para desfazer a rodada mantendo o histórico: `git revert --no-commit 2ae4d012 92745e0a 454f27e5` na branch `v2` e revisar o diff antes de commitar.
4. Para voltar o checkout ao estado do T0 sem perder trabalho: criar uma branch nova a partir do bundle e comparar; não mover `v2` com force.
5. `main`, `origin/v2` e as refs `recovery/*` não foram alterados; qualquer rollback local não os atinge.

