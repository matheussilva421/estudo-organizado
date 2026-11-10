# Gates, riscos e rollback

## Gates

| Gate | Estado | Motivo |
|---|---|---|
| G-EXT | NOT_RUN | Firebase/Auth/Firestore/Cloudflare/KV reais não foram acessados |
| G-STAGING | NOT_RUN | Nenhuma URL ou deploy de avaliação foi publicado |
| G-F7 / UX-H | PENDING_HUMAN | revisão e aceite do proprietário ainda necessários |
| G-VALIDATION | PASS_LOCAL | suíte local documentada em `TEST-RESULTS.md` |
| G-MAIN / F8 | BLOCKED_BY_SCOPE | `main`/V1, cutover e F8 intocados |

## Riscos residuais

1. Serviços externos, concorrência multi-dispositivo, quotas físicas e crash de energia continuam sem homologação real.
2. O recovery backup e o novo bundle são cópias locais no mesmo volume; não são offsite.
3. Preferências de dashboard e snapshots de relatório usam armazenamento do navegador, não as stores canônicas do backup F7. A UI os identifica como locais e não promete sincronização; devem ser exportados separadamente.
4. A chave de recuperação permanece vinculada à sessão do runtime F7; fechar a aba exige configuração posterior para novo backup automático.
5. Testes com NVDA/Narrator, zoom real do navegador e hardware modesto permanecem `NOT_RUN`.
6. O token GitHub anterior estava inválido; PRs e rulesets foram consultados somente pela API pública (0 PRs, 0 rulesets). Proteções privadas não foram inferidas.
7. O perfil desta entrega permanece `local-default`; a UI organiza preferências por perfil, mas troca/migração de múltiplos perfis reais não foi exercitada.
8. A classificação F1/F2 usa a época real e impede falsa alegação de `SAFE`, mas importar/migrar formatos legados permanece fora do contrato F7-UX e exige fluxo próprio.

## Proteção antes da implementação

Bundle independente criado e verificado:

`C:\Projetos\estudo-organizado\_resgate-estudo-organizado\nf7-ux-preflight-20261110.bundle`

O bundle contém `v2`, `main`, `recovery/f7-preformat-20261104`, `recovery/v2-f7ux-20261109`, a branch F5 preservada, refs remotas e 14 commits soltos. O SHA-256 está em `SHA256SUMS.txt`.

## Rollback

1. Não executar `git reset --hard`, `clean`, `worktree prune`, `gc --prune=now` ou exclusão de branches.
2. Para inspecionar/restaurar o baseline, usar o bundle e uma pasta vazia: `git clone <bundle> <pasta>` e conferir o SHA-256.
3. Para rollback apenas dos commits F7-UX, identificar os commits do relatório `GIT-STATE.md` e usar `git revert` em ordem inversa; preservar o bundle e o HEAD anterior.
4. Não reutilizar a restauração de dados ou rebaseline como rollback de código. Restore de backup e rollback Git são operações distintas.
5. Antes de qualquer remoção, verificar que o commit/branch está integrado e que não há refs exclusivas.
