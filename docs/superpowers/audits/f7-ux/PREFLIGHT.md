# PREFLIGHT — consolidação F7-UX e UX-H

Data: 11/11/2026. Checkout: C:/Projetos/estudo-organizado/_v2-candidate.

| Item | Valor efetivo |
|---|---|
| branch | v2 |
| HEAD | 0b8fcfdc |
| HEAD de código validado | 0c31e6ef |
| origin/v2 | 7a7df0f2f9911a0d5956cb9b94ffa03659d24905 |
| origin/main / main | 9046cfa2283cd293b38df9d52fabfcd5de9ac67c |
| ahead/behind | 92 à frente, 0 atrás |
| merge-base origin/v2 v2 | PASS (ancestral) |
| árvore | limpa; sem staged/unstaged/untracked |
| PRs abertos | 0 (gh pr list) |
| stash | nenhum |
| worktrees | principal/main e _v2-candidate/v2 |
| refs F5/recovery | codex/f5-local-preserved-20261102, recovery/f7-preformat-20261104, recovery/v2-f7ux-20261109 |

## Preservação

- Bundles anteriores: f7-ux-preflight-20261110.bundle e f7-ux-integrated-68e83479.bundle, ambos mantidos.
- Comandos destrutivos não foram executados.
- Diff 0c31e6ef..0b8fcfdc: somente docs/superpowers/audits/f7-ux/*.md.

## Pacote de entrada

- ZIP ESTUDO-ORGANIZADO-V2-F7-UX-ADERENCIA-INTEGRADA-0b8fcfdc-20261110.zip.
- SHA-256 35A897FFCB3B1A80B544B7988F400FA12EA7BE6ACCE7FBA45E2D8DEE98B2CF53, 100 entradas.
- Manifesto interno conferido: 99 hashes, 0 divergências.

## Riscos de escrita

- .git exige elevação fora do sandbox; commits serão explícitos e locais.
- Porta 18431 permanece presa; preview usará 18433 e loopback.
- Java ausente: Firebase Emulator NOT_RUN_ENVIRONMENT.

