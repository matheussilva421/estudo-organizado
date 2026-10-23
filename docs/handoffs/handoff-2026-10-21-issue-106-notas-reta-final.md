# Handoff — Issue #106: notas da Reta Final

Data: 2026-10-23  
Issue: [#106](https://github.com/matheussilva421/estudo-organizado/issues/106)

## Estado

- Branch de isolamento: codex/issue-106-notas
- Base remota reconciliada: origin/main 3b03e52
- Merge de main na branch: 65699e2
- Implementação inicial preservada: bddbdfb
- Notas em JSON v1/v2: c742814
- Documentação final: commit imediatamente posterior a este arquivo

## Implementado

Fluxo completo:
JSON -> bloco da Reta Final -> evento -> Anotações -> IndexedDB.

- JSON v1 aceita notas string opcional, sem quebrar legado; limite 10.000
  caracteres, com erro explícito para tipo/excesso.
- Ativação persiste notas no bloco e em eventos automáticos.
- Quick-complete propaga notas com ou sem evento prévio.
- Hidratação de auto legado é idempotente e carimba updatedAt uma vez.
- Nota manual e texto intencionalmente apagado nunca são sobrescritos.
- Eventos com notas sobrevivem a mudança de data/duração; duplicatas
  anotadas são preservadas em vez de perder texto.
- Reimportação associa por data original, disciplina e tópicos, preserva
  rfBlocoId, status, sessões, tempo, revisões e timer, e aborta diante de
  identidade ambígua.
- JSON v2 portátil exporta/valida notas; compare gera PATCH de notas quando o
  bloco atual não tem nota e conflito humano quando há nota divergente.
- Comandos CREATE/PATCH aceitam notas; preview v1 mostra contagem de blocos
  com anotações.
- Conteúdo permanece texto inerte; nenhum HTML é interpretado.

## Arquivos

- src/js/logic/reta-final-core.js
- src/js/logic/reta-final.js
- src/js/logic/reta-final-events.js
- src/js/logic/reta-final-commands.js
- src/js/logic/reta-final-portable.js
- src/js/logic/reta-final-import-compare.js
- src/js/store/reta-final-commit.js
- src/js/views/reta-final-import.js
- tests/unit/reta-final-core.test.js
- tests/unit/reta-final-activation.test.js
- tests/unit/reta-final-sync-eventos.test.js
- tests/unit/reta-final-quick-mark.test.js
- tests/unit/reta-final-events.test.js
- tests/unit/reta-final-portable.test.js
- tests/unit/reta-final-commands.test.js
- tests/e2e/reta-final.spec.js
- bump de cache em src/index.html, src/sw.js, src/js/sync/sync-diagnostic.js e tests/unit/css-architecture.test.js

## Testes

- npm test: 176 arquivos / 2.910 testes PASS (após as correções da revisão).
- npm run test:e2e:release: 175/175 PASS.
- E2E focado reta-final: 7/7 PASS, incluindo mobile e IndexedDB/reload.
- Foco notas: 121/121 e 133/133 nas rodadas específicas.
- test:design: PASS (45 testes + contraste AA 8 temas).
- lint: 0 erros.
- bump:check: 9.67.
- format:check: dívida preexistente; todos os arquivos alterados já falhavam
  em origin/main, nenhum novo débito introduzido.
- Fixture autocontida 93 dias / 186 blocos / 186 notas: PASS.
- Arquivo real de 186 notas: NOT_RUN; não acessado.

## Preservação

Backup integral do checkout antigo:
C:/Users/slvma/.codex/worktrees/reta-final-fase-d/backups/2026-10-23-issue-106

As alterações antigas de store-reta-final-sync.test.js e sync-center.test.js
eram fora do escopo e foram substituídas pela implementação atual da main
(backup preservado). O reta-final-merge.test.js antigo também está no backup;
a main já possui a versão integrada.

## Git/GitHub

- origin/main: 3b03e52 (sem push desta Issue).
- main local: d2aca63 (fast-forward concluído; 4 commits à frente de origin/main)
- PRs #102/#103: resolvidos (MERGED/CLOSED) na integração anterior.
- Branches docs/superpowers-reta-final-editor-* removidas após 0 commits exclusivos e ancestralidade comprovada.
- Worktree reta-final-fase-d/estudo-organizado removido (limpo e integrado); branch e backups preservados.
- Nenhum Firebase alterado; sync v2 permanece fail-closed.
- Push da Issue #106 não executado: main tem Workers Builds de produção e este
  GOAL não autorizou publicação.

## Próxima ação

Após autorização específica de publicação: revisar o diff final, atualizar a
main remota e executar npm test/test:e2e/test:design/lint/bump no resultado.
Sem essa autorização, o código permanece validado na main local.

## Checklist pós-autorização (push)

1. Confirmar que origin/main continua em 3b03e52 e que o push será
   fast-forward (3b03e52 -> d3a9c69 ou HEAD posterior).
2. Executar `git push origin main`; não usar force push.
3. Conferir o SHA remoto com `git ls-remote origin refs/heads/main`.
4. Acompanhar o workflow "Auto cache bump" e o build de produção do Cloudflare.
   Se o workflow criar um commit de bump, atualizar o checkout local e repetir
   `npm run bump:check`.
5. Se o build alterar arquivos, reexecutar `npm test`, `npm run test:e2e`,
   `npm run test:design` e `npm run lint` no SHA remoto.
6. Comentar na Issue #106 com commits, SHA remoto e resultados dos gates;
   fechar apenas após a confirmação de integração.
7. Só então avaliar a limpeza das branches locais/remotas já contidas na main.

## Revisão visual (2026-10-23)

- Capturas dos 8 temas regeneradas pelo E2E visual em 1366, 820, 390 e 320 px.
- Inspeção das telas de capacidade em todos os 8 temas, conferindo folgas,
  exceções por data, contraste, alinhamento e overflow.
- Rodapé fixo medido no mobile: na rolagem máxima o botão "Adicionar exceção"
  termina em 661 px, acima do rodapé em 696 px; não há oclusão permanente.
- Aprovação estética humana segue pendente (AC20 PARTIAL).

## Formatação

- Prettier continua falhando nos 11 arquivos de src tocados, como já falhava
  em origin/main.
- Reformata-los adicionaria cerca de 2.200 linhas de ruído (826 adicionadas,
  1.393 removidas), por exemplo 250/519 em reta-final-commands.js e 212/389 em
  reta-final-commit.js; a decisão é preservar o estilo atual e registrar a
  dívida preexistente.

## Revisão independente (2026-10-23)

O revisor independente emitiu NÃO PRONTO para a reimportação. Os achados
materiais foram confirmados no código e corrigidos:

- P0: arquivo v2 sem `notas` gerava PATCH com `notas: undefined` e o comando
  era rejeitado com NOTAS_INVALIDAS. O compare agora ignora a ausência do campo
  opcional e a reimportação idempotente volta a ser UNCHANGED.
- P1: o compare v1 descartava `legacy.notas`; o campo agora é transportado
  para o CREATE/PATCH e divergência continua exigindo decisão humana.
- P2: `notas` entrou em FIELDS do merge de planos v2; valores divergentes
  viram conflito explícito em vez de escolha silenciosa.
- P2: nota manual escrita no evento automático é devolvida ao bloco por
  `carryRemovedAutoNotesToBlocks` antes da remoção por arquivamento/bloco fora
  da agenda, no sync e no commit do rascunho. Nota manual já existente no bloco
  não é sobrescrita.
- P3 conhecido: desfazer um PATCH que apenas adiciona notas continua
  UNDO_UNSUPPORTED (fail-closed), e checkpoints não restauram `notas`.

Segunda revisão independente confirmou as quatro correções e apontou dois
complementos, também aplicados:

- a ausência de `notas` passou a ser neutra também no arquivamento e na
  restauração, não só no PATCH;
- quando o sync devolve a nota ao bloco, a revisão do plano é incrementada,
  para o descritor de sincronização não rejeitar digest divergente.

Testes adicionados: compare v2 sem notas, compare v1 com notas, conflito de
notas no merge, devolução de nota ao bloco arquivado, arquivamento sem notas e
incremento de revisão no sync.
