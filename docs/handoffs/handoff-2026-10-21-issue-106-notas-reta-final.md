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

- npm test: 176 arquivos / 2.911 testes PASS (após as correções da revisão).
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

- origin/main: b3d9f9d (push fast-forward de 3b03e52 executado em 2026-10-23).
- main local: b3d9f9d (sincronizada com origin/main).
- PRs #102/#103: resolvidos (MERGED/CLOSED) na integração anterior.
- Branches docs/superpowers-reta-final-editor-* removidas após 0 commits exclusivos e ancestralidade comprovada.
- Worktree reta-final-fase-d/estudo-organizado removido (limpo e integrado); branch e backups preservados.
- Nenhum Firebase alterado; sync v2 permanece fail-closed.
- Push da Issue #106 executado com autorização específica e deploy de produção
  verificado (detalhes na seção Publicação).

## Próxima ação

A única pendência material é a comparação das regras Firestore publicadas com
o `firestore.rules` da main. Sem leitura autenticada do Console, o veredito é
INCONCLUSIVO; basta copiar o texto publicado (Firestore → Rules) para concluir.

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

## Publicação (2026-10-23)

- Push `3b03e52..b3d9f9d` na main; SHA remoto confirmado por
  `git ls-remote` e pela API do GitHub.
- Workflow "Auto cache bump" do commit b3d9f9d: concluído com sucesso.
- Produção https://estudo-organizado.matheussilva421.workers.dev/ passou de
  9.66 para 9.68 logo após o push.
- `sw.js`, `index.html`, `reta-final-import-compare.js` e
  `reta-final-events.js` servidos em produção são byte-idênticos aos blobs do
  commit b3d9f9d (SHA-256 conferido).
- Smoke test em produção com dados sintéticos: preview 1 de 3 blocos, 3 blocos,
  3 eventos, nota visível em Editar Estudo, persistência após reload no
  IndexedDB, HTML literal inerte, zero chamadas a Firestore/Identity Toolkit,
  zero erros de console e zero respostas 4xx/5xx.
- Issue #106 comentada com as evidências e encerrada como concluída.
- Branches locais codex/issue-106-notas e codex/reta-final-editor-fase-a
  removidas após 0 commits exclusivos; branches V2 remotas preservadas.
- Sem token Cloudflare no ambiente, o status nominal do Workers Builds não foi
  consultado no painel; a publicação é comprovada pelos artefatos e pela versão
  servidos em produção.

## Auditoria Firestore (somente leitura)

- `firestore.rules` da main: último commit 6501c64 (2026-10-21), 14.629 bytes.
- Análise estática: `payload` é mapa livre nos snapshots e nas entidades, então
  `notas` em eventos é compatível; a coleção `eventos` é aceita em
  `validEntityCollection`; o descritor v2, snapshots, entity-primary e o guard
  `syncMeta/reta-final-guard` estão implementados; escritas com revisão
  desatualizada são rejeitadas depois que o descritor v2 existe; há deny-all
  final.
- Comparação com as regras efetivamente publicadas: INCONCLUSIVO. Não há
  Firebase CLI, gcloud, token ou credencial de leitura nesta máquina.
- Para concluir: copiar do Console (projeto app-de-estudos-14564 → Firestore →
  Rules) o texto publicado e a data/versão exibidos.

## Consolidação das regras Firestore (2026-10-23)

- Baseline real do Console preservado em
  `tests/firestore-rules/legacy-console.rules`.
- Candidato: `firestore.rules` (hash final na seção Revisão final das regras).
- Coleções legadas restauradas: `disciplinas`, `assuntos`, `aulas` e
  `planejamento.sequencia`, todas previstas no contrato de entity sync.
- Entidades aceitam `revision >= 0` (compatibilidade legada) e update com
  revisão monotônica; clientes com revisão menor são rejeitados.
- Campos opcionais de snapshot e de entidade passaram a ser validados por tipo,
  como no baseline do Console, sem afrouxar os validadores v2.
- Tombstones aceitam `payload: null` + `deletedAt` textual e payload com
  `deletedAt` nulo; a forma atual com marcador dentro do payload continua
  válida.
- Proteções v2 preservadas: descritor, capabilities, lineage, CAS de revisão,
  snapshots, guard `syncMeta/reta-final-guard`, deletes negados e deny-all.
- Testes no emulador (consolidação inicial): **55/55 PASS**; versão anterior **45/51**
  (seis lacunas legadas reproduzidas em RED); baseline do Console **20/22**,
  com a sobrescrita v2 reproduzida e as duas diferenças esperadas.
- Resíduo P2 pré-existente: o ramo academic-only confia no digest enviado pelo
  cliente e não revalida o conteúdo de `payload.planejamento`. Não foi alterado
  para não bloquear sync legítimo sem homologação autenticada.
- Entity-primary deve permanecer desabilitado até a homologação autenticada,
  apesar do novo CAS monotônico de entidade.

### Publicação manual das regras

1. Publicar o cliente 9.71 e confirmar a versão em produção antes das regras.
2. Backup: Console → Firestore → Rules → copiar o texto publicado atual.
3. Colar o conteúdo de `firestore.rules` e publicar.
4. Homologar com usuário autenticado e dados sintéticos: guard por escrita e
   leitura, snapshot v2, rejeição de cliente legado e de revisão desatualizada.
5. Rollback: usar o hotfix v2-safe descrito na seção Revisão final; o backup
   legado não deve ser restaurado depois que existir snapshot v2.

## Revisão final das regras — 2026-10-23

- SHA-256 final do blob commitado de `firestore.rules` (LF):
  `ADF70A93052856505BB1E419DEC65A9DF349600B5E4542BFE10F3F61F70BA6C9`.
- Emulador: **64/64 PASS**, incluindo academic-only completo, merge parcial sem
  `planejamento` e tentativa de adulterar o plano negada.
- Entidades: update com a mesma revisão só passa quando payload, schemaVersion,
  checksum, updatedAt, deletedAt e updatedBy são idênticos. Saltos de revisão
  continuam aceitos para lotes offline; revisão menor é rejeitada.
- Snapshot v2: academic-only restaurado com `snapshotRevision + 1` e igualdade
  integral de `payload.planejamento`. O cliente 9.71 envia o plano remoto
  verificado verbatim no envelope academic-only; a escrita é full `setDoc`, sem
  merge, inclusive no plano aposentado. Drift derivado permanece local e é
  re-derivado no pull.
- Suíte do app: **2.911 PASS**.
- Veredito: **BLOCKED para publicação imediata**. A produção ainda serve o
  cliente 9.68, que envia academic-only com o plano completo e campos derivados;
  as regras negariam esse push. Ordem segura: publicar o cliente 9.71,
  confirmar produção em 9.71 e só então publicar as regras. Após o 9.71,
  READY_FOR_MANUAL_PUBLICATION.
- Rollback seguro: hotfix derivado deste arquivo, preservando descritor, guard,
  CAS e deny-all. Não restaurar o baseline legado nem `c54fb9b` sem pausar a
  sincronização v2 e o entity-primary.
- Resíduo conhecido: compactação local de tombstones com a mesma revision pode
  ser negada pelo ramo academic-only; nesse caso, avance a revision com uma
  edição real do plano antes de republicar.

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
