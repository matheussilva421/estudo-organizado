# Estado Git do preflight e da entrega

## Preflight

| Item | Valor |
|---|---|
| checkout | `C:\Projetos\estudo-organizado\_v2-candidate` |
| branch | `v2` |
| baseline | `3145e95440f0c38178a205f4247b67a180564214` |
| `origin/v2` | `7a7df0f2f9911a0d5956cb9b94ffa03659d24905` |
| `main` / `origin/main` | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` |
| vantagem inicial | 73 commits à frente, 0 atrás |
| worktree inicial | limpo |
| stash | nenhum |
| PRs abertos | 0 pela API pública |
| rulesets públicos | 0 pela API pública |

Branches encontradas: `v2`, `main`, `recovery/f7-preformat-20261104`, `recovery/v2-f7ux-20261109` e `codex/f5-local-preserved-20261102`. A branch F5 tem quatro commits não ancestrais; nenhum foi apagado. Dois worktrees existem: principal na `main` e `_v2-candidate` na `v2`.

## Preservação

- Bundle: `_resgate-estudo-organizado/f7-ux-preflight-20261110.bundle`.
- `git bundle verify`: PASS; histórico completo conforme verificação do Git.
- O bundle inclui 24 refs e os 14 commits unreachable listados no preflight.
- Nenhum `git gc`, `prune`, `clean`, reset destrutivo ou remoção de branch foi executado.
- Os PNGs F4 rastreados foram restaurados ao HEAD após a suíte histórica regravá-los.

## Entrega local

| Commit | Conteúdo |
|---|---|
| `6d51b328` | contratos puros, testes de evidência, widgets, rotas e analytics |
| `9ecf7afc` | shell, Home, Atenção, Análises, Configurações, Conteúdo, recovery e pacote de evidências |
| commit documental final | ajustes finais desta matriz/estado, se necessários após a revisão |

A árvore foi limpa após o commit de implementação; o commit documental final e o HEAD exato do ZIP estão registrados em `HEAD.txt` no pacote. Os commits permanecem locais; `origin/v2` não foi alterado.
