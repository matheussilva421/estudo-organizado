# Task 13 — Resolução de conflitos e estados de sincronização

Base: `1bff8ed` (`codex/reta-final-editor-fase-a`). Sem push, merge ou deploy.

## Contexto de execução

O implementador DeepSeek foi interrompido pela sessão antes de fechar o relatório/commit. O worktree foi preservado integralmente; o coordenador revisou o código, corrigiu três integrações e concluiu o commit. Nenhum trabalho do implementador foi revertido.

## Resultado

- `src/js/views/reta-final-conflicts.js`: normalização determinística das duas fontes de conflito (Firestore e merge de três versões), comparação base/local/remoto por campo, HTML escapado, escolhas local/remoto/manual, cancelamento primeiro no fluxo e alvos de 44px.
- `src/js/ui/actions/reta-final-conflicts.js`: ações delegadas, confirmação explícita, Escape cancela, JSON manual validado e resolução por transação única.
- `src/js/store/reta-final-commit.js`: `resolveRetaFinalConflictAtomically` grava estado, checkpoint, operação auditável e sync intent na mesma transação IndexedDB; CAS contra a revisão local; revisão resultante = revisão remota + 1; preserva eventos, editais, revisões, hábitos, arquivo e `rfBlocoId`.
- `src/js/views/config/sync-center.js`: painel de revisão renderizado no card Firestore; conflitos Reta Final não usam mais o painel genérico.
- `src/js/sync/sync-status-ui.js`: `deriveSyncDisplayState` com ACK real; `synced` só com `lastPushAt`, sem pendência/conflito; `blocked-guard`, offline, pendente e erro mapeados.
- `src/js/ui/actions/index.js`: registro único das ações.
- `src/sw.js`: precache dos módulos novos e bump de cache.
- `docs/api/sync-contract.md`: contrato de conflitos e estados.

## RED

1. RED de contrato: remover temporariamente `src/js/views/reta-final-conflicts.js` fez a suíte falhar na resolução do import (0 testes coletados); o módulo foi restaurado (`RESTORED=True`).
2. RED comportamental capturado na revisão: desativar temporariamente a confirmação obrigatória em `resolveRetaFinalConflict` produziu exatamente `1 failed | 28 passed`, com a mensagem "refuses to write without explicit confirmation" e `applied: true` inesperado. A guarda foi restaurada e o teste voltou a passar.

## GREEN

- Novo UI/transação: 30/30.
- Estado de sincronização: 8/8.
- Foco Task 13 após as correções (UI, status, sync-center, action-contracts, portable): 137/137.
- Suíte completa: 166 arquivos / **2.774/2.774** testes, exit 0 (77,78s). Após as rodadas de correções: 166 arquivos / **2.784/2.784** testes, exit 0 (87,41s).

## Correções do coordenador

1. O painel não estava conectado ao Sync Center; a integração e o teste de renderização foram adicionados.
2. O store gravava `baseDigest` com `retaFinalDigest` (fnv1a64) enquanto o engine compara com `computeRetaFinalPlanDigest`; isso bloquearia o push seguinte. Corrigido e coberto por asserção.
3. A asserção de contrato de aspas em `action-contracts.test.js` foi ajustada para aceitar o formatador do projeto; o teste de calendário teve um timeout transitório e passou na reexecução.

## Correções da revisão independente

- Conflito real `merge-collision` (pai sem `type`) agora é normalizado no painel e é limpo quando o último item é resolvido; o painel genérico não expõe mais "Forçar envio" nesse caso.
- Resolução manual exige plano remoto compatível; sem remoto ou com linhagem diferente, só "manter local" fica disponível.
- Plano remoto atrasado em relação à base conhecida é recusado (`stale-remote`); não é adotado.
- CAS de conteúdo para conflitos de campo: o valor atual é comparado com o `local` observado dentro da transação; divergência vira `RETA_FINAL_STALE`.
- Caminhos `__proto__`/`prototype`/`constructor` são rejeitados no path e em patches manuais; teste verifica que `Object.prototype` não é poluído.
- `deriveSyncDisplayState` considera `syncMergeConflicts`; não promove a sincronizado com conflito de merge pendente.
- A comparação mostra `minutosPadrao`, quantidade de disciplinas e valores completos em `<details>`.
- O RED comportamental acima substitui o RED apenas de import.
- Segunda verificação: o formato parent-only (`firestoreSync.conflict.items` sem `syncMergeConflicts`) agora também é removido do pai; teste resolve o item e confirma `conflict: null`. Linhagem remota incompatível (`planId` diferente) desabilita remoto/manual e é recusada no store.
- Terceira verificação: quando `syncMergeConflicts` existe com `items: []`, a coleta recorre aos `items` do pai; o teste resolve o item e confirma a limpeza do pai e do objeto vazio.
- A inversão de camadas store→view permanece como residual Minor, sem ciclo funcional; refatoração para `logic/` fica registrada.

## Correções da revisão integrada da Fase D

- Pulls v2 não tratam mais plano de digest igual como no-op global: comparam o
  estado não-plano e aplicam/mergeiam eventos, tempo, questões e revisões
  remotos. O indicador só promove `synced` quando `lastPushAt` cobre o último
  `localBackupAt`.
- O engine enfileira escritas acadêmicas com `revision` do plano inalterada e
  `snapshotRevision` avançando; a revisão de plano e a revisão do snapshot são
  dimensões separadas.
- `resolveRetaFinalConflict` enfileira o estado resolvido no fluxo normal de
  sync após a transação local; a UI continua mostrando `pending` até o ACK.
- Antes de aplicar um pull, o engine confere plano/revisão/digest e
  `localBackupAt` capturados no início; uma edição concorrente durante o yield
  gera `local-changed-during-pull` e preserva a versão local.
- `verifiedRetaFinalBase` e o merge genérico exigem `baseDigest`; base sem
  digest verificável não é usada.

## Limitações

- E2E nativo com IndexedDB real, múltiplas abas e mobile continua **NOT_RUN**.
- O store importa a normalização da view; é uma inversão de camadas residual, sem ciclo funcional (a view só usa helpers puros). Refatoração para `logic/` fica registrada.
- Alvos de 44px usam estilo inline; não há CSS novo nesta tarefa.
- As regras Firestore continuam não publicadas; a UI mostra pendência e nunca promete sincronização remota sem ACK.

