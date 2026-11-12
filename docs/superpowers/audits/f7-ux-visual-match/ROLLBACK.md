# Rollback da fase visual

1. Inventariar HEAD, status, refs e bundles; confirmar b670926f como ancestral.
2. Reverter apenas commits visuais em ordem inversa com git revert: b670926f, af71703e, 50d18db6, 4b13b205, 23c08fd0, a5f348db, 804a41fc, 134da0b0, 53eecba9, 80c1d1df.
3. Se a regressão for só de tema/aparência, restaurar apps/v2/src/presentation e public/premium seletivamente.
4. Não usar reset --hard, clean -fd, force push ou reescrever histórico; preservar refs e bundles.
5. Reexecutar typecheck, lint, unit e E2E; dados/IndexedDB não são restaurados por Git.
6. Rollback de dados reais não faz parte deste pacote e segue os gates F7.
