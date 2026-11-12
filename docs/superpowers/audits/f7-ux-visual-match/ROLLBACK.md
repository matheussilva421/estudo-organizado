# Rollback

## Código

Base anterior à convergência v13: 96e0651c70b817c7bcb398e821cd1727da864850.
Código final: a4b56e5e84c10d7aa2bc9bd59eedc6108d8f2f66.

1. Validar o bundle:

       git bundle verify C:/Projetos/estudo-organizado-preservacao-20261104/f7-ux-premium-comparacao/f7-visual-match-a4b56e5e.bundle

2. Para inspecionar o estado anterior sem reescrever a v2:

       git switch -c rollback/f7-visual-96e0651c 96e0651c70b817c7bcb398e821cd1727da864850

3. Em uma branch de rollback, reverter os commits na ordem inversa, se o objetivo for manter o histórico:

       a4b56e5e
       97e72bdf
       32574dd5
       commit documental v15
       9ff90176
       08700060
       160e4b0a

4. Não usar reset --hard, clean -fd, force push ou remoção de worktree/ref.
5. Reexecutar typecheck, lint, build, unitários e E2E.

## Dados

Git não restaura IndexedDB, backups locais, perfis ou dados acadêmicos. Rollback de dados reais segue os gates F7 e não faz parte deste pacote.
