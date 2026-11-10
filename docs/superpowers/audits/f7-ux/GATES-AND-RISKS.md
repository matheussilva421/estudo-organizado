# Gates, riscos e rollback

## Gates

| Gate | Estado | Motivo |
|---|---|---|
| G-EXT | NOT_RUN | Firebase/Auth/Firestore/Cloudflare/KV reais não foram acessados |
| G-STAGING | NOT_RUN | Nenhuma URL ou deploy de avaliação foi publicado |
| G-F7 / UX-H | PENDING_HUMAN | revisão e aceite do proprietário ainda necessários |
| G-VALIDATION | PASS_LOCAL / FIREBASE_BLOCKED | typecheck, lint, unit, build e E2E passam em `TEST-RESULTS.md`; emulador Firebase não roda porque falta Java no ambiente |
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
9. A cópia pré-restore é emitida como download antes do commit; o navegador pode bloquear ou o usuário pode não salvar o arquivo, e a aplicação não tem como autenticar que a cópia externa foi preservada. O snapshot, a detecção stale e o read-back transacional continuam obrigatórios.
10. P1 de UX-17: a disponibilidade semanal continua fixa em PlanningWorkspace.tsx:53. A store planning_availability existe no schema, mas não tem leitura/escrita nem editor; exceções e metas também não são editáveis.
11. P1 de UX-20: não há estado persistido de “revisão iniciada”. Abrir a fila não executa nem conclui, mas iniciar e avaliar continuam no mesmo comando de execução.
12. P2 de acessibilidade: quatro links de texto na Home em 320 px medem menos de 24 px de altura. São links inline e ficaram documentados em HOME-320-AUDIT.md.
13. A porta 18431 do preview ficou presa durante esta sessão. A configuração do Playwright agora aceita PLAYWRIGHT_PORT; os logs finais indicam a porta efetiva (18432).
14. O Firebase Emulator retornou exit 1 com “Could not spawn java -version”: Java não está instalado/exposto no PATH. Os testes de regras/transação remota ficam NOT_RUN nesta máquina; nenhum projeto real foi usado.

## Proteção antes da implementação

Bundle independente criado e verificado:

`C:\Projetos\estudo-organizado\_resgate-estudo-organizado\f7-ux-preflight-20261110.bundle`

O bundle contém `v2`, `main`, `recovery/f7-preformat-20261104`, `recovery/v2-f7ux-20261109`, a branch F5 preservada, refs remotas e 14 commits soltos. O SHA-256 está em `SHA256SUMS.txt`.

## Rollback

1. Não executar `git reset --hard`, `clean`, `worktree prune`, `gc --prune=now` ou exclusão de branches.
2. Para inspecionar/restaurar o baseline, usar o bundle e uma pasta vazia: `git clone <bundle> <pasta>` e conferir o SHA-256.
3. Para rollback apenas dos commits F7-UX, identificar os commits do relatório `GIT-STATE.md` e usar `git revert` em ordem inversa; preservar o bundle e o HEAD anterior.
4. Não reutilizar a restauração de dados ou rebaseline como rollback de código. Restore de backup e rollback Git são operações distintas.
5. Antes de qualquer remoção, verificar que o commit/branch está integrado e que não há refs exclusivas.

## Rodada integrada (HEAD 68e83479)

P-04 e R-02 resolvidos e testados; E-09, P-03, P-05, R-03, R-06 e R-08 corrigidos. P1 local restante: nenhum conhecido.
P2 mantidos: diagnóstico de capacidade (P-01), encerramento direto da Reta Final (P-05), comparação lado a lado de revisões (P-06), amostra por evidência (R-04), aceite distribuído (P-09/R-09) e quatro links inline abaixo de 24 px.
Firebase Emulator continua NOT_RUN_ENVIRONMENT sem Java; E2E usa PLAYWRIGHT_PORT=18432 porque 18431 está presa no ambiente.
