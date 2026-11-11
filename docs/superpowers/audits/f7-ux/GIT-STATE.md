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

## Rodada de aderência UX-16 a UX-21 (10/11/2026)

| Item | Valor |
|---|---|
| HEAD de código | `8f2fee85` |
| commits novos | `34487e30`, `51cc4a40`, `906ef7c6`, `59f07f89`, `8f2fee85`, `f93e6f69`, `11ce66a2` |
| vantagem sobre origin/v2 | 83 commits à frente, 0 atrás, após os sete commits |
| origin/v2 | `7a7df0f2f9911a0d5956cb9b94ffa03659d24905` (intacto) |
| main / origin/main | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` (intactos) |
| PRs / rulesets | 0 e 0 pela API pública |
| worktrees | principal na main e `_v2-candidate` na v2 |
| stash | nenhum |
| bundle | `_resgate-estudo-organizado/f7-ux-preflight-20261110.bundle`, verificado |

Os PNGs F4 regravados pela suíte serão restaurados ao HEAD após os gates finais, como na rodada anterior. Nenhum push, merge, deploy ou PR foi executado.

## Rodada integrada (HEAD 68e83479)

| Item | Valor |
|---|---|
| HEAD de código | 68e83479 |
| commits novos | a5ff467f, fb7c2f8e, e25e6ee7, 32417120, 68e83479 |
| vantagem | 89 commits à frente de origin/v2, 0 atrás |
| bundle | _resgate-estudo-organizado/f7-ux-integrated-68e83479.bundle, verify PASS, SHA-256 DF0077EC2D1DDC8BB0FCF5290A4FA14B33DE0AD2A9F8631AA9957135B091AE3C |
| segunda cópia | C:/Projetos/outputs/f7-ux-aderencia-20261110/f7-ux-integrated-68e83479.bundle |

main/origin/main e origin/v2 permanecem intactos; nenhum push ou PR foi executado.

### Fechamento final

HEAD de código validado: 0c31e6ef. 92 commits à frente de origin/v2, 0 atrás. Commits da rodada: a5ff467f, fb7c2f8e, e25e6ee7, 32417120, 68e83479, da329670, 0c31e6ef (+ commit documental final). Árvore limpa após restaurar os quatro PNGs F4 regravados. O HEAD documental exato está em HEAD.txt do pacote.

Estado vigente: o HEAD documental final, o HEAD de código validado (0c31e6ef), a contagem exata de commits e o SHA do bundle estão em HEAD.txt do pacote de revisão humana. A consolidação documental está no topo da v2 e não alterou código/teste/config.