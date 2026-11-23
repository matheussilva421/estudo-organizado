# Task 8 — Reta Final com revisão indivisível

## Resultado

Implementação concluída. A Reta Final passa a publicar alterações de múltiplos blocos
como uma revisão lógica completa. Cada lote é preparado e validado antes de o ponteiro
`meta/retaFinalRevision` mudar, e leitores permanecem na revisão anterior enquanto o
conjunto novo estiver incompleto.

- Os blocos são divididos em lotes determinísticos de até 48 itens, seguidos por um lote
  de metadados. Cada lote possui contrato, digest de conteúdo e recibo próprio.
- O ponteiro só é gravado numa transação remota quando todos os lotes esperados existem,
  validam contra o manifesto e resolvem a revisão completa.
- Falha entre staging e publicação não altera o ponteiro. O retry reutiliza os mesmos
  lotes por conteúdo e o mesmo `opId` não duplica a publicação.
- Reutilizar um `opId` com conteúdo diferente é rejeitado.
- A resolução verifica contagem, digests, índices, ordem, IDs duplicados, notas,
  metadados, histórico, operações e tombstones.
- Um bloco excluído não pode coexistir com um bloco atual do mesmo ID.
- Eventos automáticos e referências históricas arquivadas permanecem como metadados e
  nunca são convertidos em blocos atuais.
- No modo V1 ativo, estado, rascunho, journal, estado local V1, outbox, metadados de
  entidade, conflitos e sync meta são gravados na mesma transação IndexedDB. Uma falha
  no outbox reverte o conjunto e o replay não recria eventos nem duplica operações.
- O cronograma não foi alterado.

## Arquivos

- `src/js/sync/v1-next/reta-final.js` (novo).
- `src/js/store/reta-final-commit.js` (integração transacional pontual).
- `src/js/sync/v1-next/contracts.js` (registros de lotes no namespace `meta`).
- `src/js/sync/v1-next/remote.js` (transação remota vinculada à geração ativa).
- `tests/unit/v1-next-reta-final.test.js` (novo).
- `tests/emulator/v1-next-reta-final.test.js` (novo).
- `.superpowers/sdd/2026-11-23-estudo-organizado-v1-sync-definitivo/task-8-report.md`.

## RED e GREEN

- RED inicial reproduziu ausência do publicador/resolvedor e a fixture sem `habitos`
  falhava em `/habitos`, impedindo exercitar o rollback do outbox.
- A fixture foi corrigida com estado V1 completo e árvore `habitos` válida. O teste
  temporário `tests/unit/t8-debug.test.js` foi removido.
- Unit T8 e commit: **PASS 23/23** (confirmação do controlador), incluindo 140 blocos,
  replanejamento, remoção, notas, tombstones, histórico arquivado, falha de outbox e
  replay sem duplicação.
- Regressões `reta-final-schema`, `reta-final-commit`, `reta-final-events` e testes
  unitários V1 relacionados: **PASS 64/64**.
- Emulator T8: **PASS 1/1** (confirmação do controlador), cobrindo staging interrompido,
  dois leitores na revisão anterior, retry idempotente e conflito de `opId`.
- Regressão completa do Emulator: **PASS 35/35**.
- ESLint focado nos seis arquivos: **PASS**, 0 erros. Foram reportados 196 warnings de
  aspas duplas preexistentes em `reta-final-commit.js`.
- `git diff --check`: **PASS**.
- `npm test`: **NÃO PASS**. Resultado registrado durante a execução: 184/192 arquivos e
  3172/3194 testes aprovados. As 22 falhas estão em áreas legadas/preexistentes fora do
  T8, incluindo IndexedDB indisponível em testes de ambiente, contratos legados e uma
  expectativa CSS de `16px`.

## Isolamento e limites

- O HEAD mudou externamente de `03fb5d22` para `8d2049c3` durante a execução. A
  implementação foi validada sobre o estado atual, sem reverter ou sobrescrever o commit
  externo `fix(v1-sync): stabilize T9 sync status`.
- O stage inicial continha somente os seis arquivos T8 e este relatório. O hook de
  pre-commit detectou mudanças em `src/` e executou o bump obrigatório de cache de
  `9.94` para `9.95`, incluindo `src/sw.js`, `src/index.html`,
  `src/js/sync/sync-diagnostic.js` e a expectativa de cache em
  `tests/unit/css-architecture.test.js`.
- Sem alteração de V2, cronograma, push, deploy, backup, dados reais ou subagentes.
- Lotes antigos permanecem imutáveis no staging remoto. A coleta de lotes não referenciados
  não faz parte do T8 e fica para a política de retenção do fluxo V1.

## Commit

Commit local criado com a mensagem `feat(sync): publish indivisible reta final revisions`.
O commit contém os seis arquivos T8, este relatório e as quatro atualizações automáticas
de cache produzidas pelo hook do repositório. Sem push.
