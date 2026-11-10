# Backup e rollback — F7-UX integrada

## Bundles

| Bundle | SHA-256 | Verificação |
|---|---|---|
| _resgate-estudo-organizado/f7-ux-preflight-20261110.bundle | 7A6AFFCDA97418A32DBF36E7C4982AC7F49998C0C769350CA5472545C2B626FF | git bundle verify PASS |
| _resgate-estudo-organizado/f7-ux-integrated-68e83479.bundle | DF0077EC2D1DDC8BB0FCF5290A4FA14B33DE0AD2A9F8631AA9957135B091AE3C | git bundle verify PASS |

Segunda cópia: C:\Projetos\outputs\f7-ux-aderencia-20261110\f7-ux-integrated-68e83479.bundle (mesmo SHA-256).

## Rollback de código

Reverter apenas esta rodada, em ordem inversa:

    git revert --no-edit 68e83479 32417120 e25e6ee7 fb7c2f8e a5ff467f

Não usar reset --hard, clean, force push, gc/prune ou remoção de refs. Preservar recovery/f7-preformat-20261104, recovery/v2-f7ux-20261109, codex/f5-local-preserved-20261102 e os bundles.

## Restauração

Para inspecionar o estado anterior, clonar o bundle em pasta vazia e conferir o SHA-256. Restore de backup F7 e rollback Git são operações distintas; nenhuma restauração de dados reais foi executada.

O SHA-256 do ZIP final está no arquivo .sha256 ao lado do pacote.

