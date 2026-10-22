# Handoff — Reta Final, Fases E e F

## Estado

- Branch: codex/reta-final-editor-fase-a
- Código base: 258fa5c
- Rolagem: 5cffee4
- Checkpoints/importação: 66e9adc
- Capacidade semanal: d3b744e
- Histórico/undo: 0ce40ed
- Offline/reload: 330fe86
- Consolidação final: commit imediatamente anterior a este documento
- Base da Fase D: 69278ee
- main local: eb8cc6c
- Integração local: 099d0ba (merge origin/main); push AUTORIZADO em 2026-10-22
- origin/main verificado: 5428513
- Relação: origin/main agora é ancestral da branch; fast-forward pronto
- Worktree: C:/Users/slvma/.codex/worktrees/reta-final-fase-d/estudo-organizado
- Árvore de trabalho: limpa após o commit de consolidação

## Concluído

- Tasks 14–17: detalhe integral, editor em draft, planejamento visual,
  prévia/aplicação, checkpoints, importação seletiva e undo/redo.
- Capacidade: minutos por dia, máximo diário, folgas e exceções por data,
  persistidos via SET_CAPACITY no rascunho e usados pela redistribuição.
- Visual: 8 temas x desktop/tablet/mobile/320px, painel de capacidade, overflow
  interno, alvos de 44px e paletas computadas distintas.
- Offline: aplicação local, syncPending e reload real com persistência.
- Revisão independente final: achados P1/P2/P3 tratados; ACs rebaixados quando a
  evidência é indireta.
- Boot: reconciliação única após falha de migração e teste de aulaId duplicado.

## Testes finais

- npm test: 176 arquivos, 2875 testes, PASS.
- npm run test:e2e:release: 174/174, PASS.
- E2E editor: 7/7.
- E2E visual: 9/9.
- test:design: 45 testes + contraste AA nos 8 temas.
- lint: 0 erros.
- bump:check: APP_VERSION 9.66.
- format:check: 185 falhas preexistentes; todos os arquivos novos/relacionados passam.
- Regras Firestore no emulador: 38/38 novas; 5/5 antigas reproduzem a falha.

## Firebase

- Projeto de teste: eorg-rf-homolog-1022 (Spark, isolado).
- Firestore API: não habilitada; nenhum banco criado; nenhuma regra publicada.
- Produção app-de-estudos-14564: intacta.
- Gate remoto: BLOCKED por decisão explícita do usuário em 2026-10-22.
- Não repetir tentativas no Firebase sem nova autorização.

## GitHub e integração
- Integração local: 099d0ba; push fast-forward AUTORIZADO em 2026-10-22.
- Deploy de produção do Workers Builds autorizado pelo usuário.
- A main remota passa a apontar para o SHA deste commit; a verificação
  pós-push e os PRs são registrados no relatório final.
- origin/main anterior: 5428513; a branch contém a main e está pronta.
- PRs #102/#103 serão resolvidos após confirmar o conteúdo na main.
- Histórico: tentativa com [skip ci] recusada; autorização posterior.

## Pendências e riscos

1. Firestore real: BLOCKED por decisão; fail-closed preservado.
2. Aparelho físico/multi-instalação: NOT_RUN.
3. AC04: falha real de quota/transação no navegador não injetada.
4. AC11/AC12: merge unitário; evidência física pendente.
5. AC16: UI e testes; E2E de restauração pela UI pendente.
6. AC20: aprovação visual humana e prefers-reduced-motion manual pendentes.
7. format:check global permanece vermelho por baseline.

## Retomada

    git -C 'C:/Users/slvma/.codex/worktrees/reta-final-fase-d/estudo-organizado' status --short --branch
    git -C 'C:/Users/slvma/.codex/worktrees/reta-final-fase-d/estudo-organizado' log -3 --oneline

Ler docs/qa/reta-final-editor-acceptance-2026-10-19.md e este arquivo antes de
continuar. Não iniciar merge/push sem autorização final.
