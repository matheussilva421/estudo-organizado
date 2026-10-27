# Handoff — Issue #107 (`reta-final-conflict: missing-remote-plan`)

## Metadados

- Data: 2026-10-26 (America/Fortaleza)
- Branch: `main` (sem branch/PR novo)
- HEAD no início: `34f40431b0d7d1169eb64680703a810d1a55f16d` (igual a `origin/main`)
- Estado: hotfix commitado localmente na `main`, **sem push ou deploy**
- Versão de cache: `9.76` (bumps 9.71→...→9.76; `bump:check` ok)
- Issue: `matheussilva421/estudo-organizado#107`

## Objetivo

Eliminar o conflito `missing-remote-plan` quando o Firestore contém um planejamento Reta Final pré-v2 (sem `planId`, `revision` ou `schemaVersionRetaFinal`) e o estado local já foi migrado para v2, sem perder dados e sem afrouxar as regras.

## Causa raiz confirmada

`getRetaFinalPayloadPlan()` só reconhece `schemaVersionRetaFinal === 2`. Um `payload.planejamento` legado retornava `null` e `applyRetaFinalPull()` o tratava como ausência de plano (`missing-remote-plan`), mesmo com o documento remoto existente e com os mesmos blocos do lado local.

Havia um segundo risco no caminho de escrita: o ramo de adoção das regras v2 aceita um descritor `baseRevision: 0` / `snapshotRevision: 1` sobre um documento legado quando `baseRemoteUpdatedAt == resource.data.payloadUpdatedAt`. As regras não conseguem comparar a semântica dos planos, então um push poderia substituir um planejamento legado materialmente diferente.

## Correção

- `src/js/sync/reta-final-legacy.js` (novo, puro): reconhece a forma legada exata, rejeita metadados v2 parciais, migra o plano remoto com a mesma função do carregamento local (`migrateRetaFinalV2`) usando o `planId` local e compara a intenção ignorando somente metadados de migração e campos derivados (`data`, `status`, `rolagens`, `categoriaTemporal`, etc.). Qualquer diferença real vira conflito com lista de caminhos divergentes.
- `src/js/sync/firestore-sync-engine.js`: `applyRetaFinalPull()` adota o legado equivalente como base (`baseRevision 0`, `baseRemoteUpdatedAt = payloadUpdatedAt`) e mescla apenas dados acadêmicos; a adoção já registrada é idempotente; `flushFirestoreOutboxUnlocked()` verifica a equivalência antes de qualquer escrita de adoção (inclusive `forceOverwrite`); o pull forçado preserva a base adotada. Conflitos usam `legacy-plan-mismatch` com mensagem e `differences`.
- `scripts/verify-reta-final-rules.mjs`: casos de emulador para adoção sobre plano pré-v2 real, avanço pós-adoção, segunda linhagem e escrita legada concorrente.
- Um `planejamento` com `tipo: reta_final` mas forma inválida agora retorna `invalid-remote-plan`, em vez de ser confundido com ausência de plano.
- Um conflito `missing-remote-plan` persistido pelo cliente 9.71 não bloqueia mais os caminhos normais (`poll`, auto-pull e sync-now) quando a outbox está vazia: o remoto é relido, a equivalência estrita decide, e o conflito só é removido no sucesso; divergência vira `legacy-plan-mismatch`.
- `src/sw.js` + `tests/unit/firestore-contracts.test.js`: o novo módulo entra no precache offline e há asserção de contrato para não regredir.

Nenhuma regra Firestore foi alterada. A regra publicada em 9.71 já contém o ramo de adoção e foi validada no emulador.

## Testes executados

- `npm test`: **177 arquivos, 2937 testes, 2937 passaram**.
- Foco novo: `tests/unit/reta-final-legacy-adoption.test.js` (fixture sintética de 180 blocos) e `tests/unit/reta-final-sync-engine.test.js` (adoção, conflito, idempotência, outbox, adoção forçada, CAS após leitura).
- Emulador Firestore + `firestore.rules`: **PASS 71/71** (inclui payload acadêmico e readback).
- Emulador Firestore + ruleset publicado 9.71: **PASS 71/71**.
- E2E Playwright (`reta-final`, `sync-e2e`, `persistence-regression`): **16/16**.
- E2E Playwright (`sync-dados`, `sync-devices`, `sync-simulation-expanded`): **18/18**.
- `npm run lint`: 0 erros (warnings pré-existentes).
- `npm run format:check`: falha pré-existente em 166 arquivos, inclusive o engine antes desta mudança; os dois arquivos novos estão formatados.
- Gates finais pós-bump: `bump:check` ok (9.76); testes de SW/versão **105/105**; focados do replay/digest **123/123**; emulador com rebase **75/75**; fixture sanitizado de **889.117 bytes** com readback intacto.

## Revisão independente

Achados materiais corrigidos no mesmo fluxo:

- plano v2 remoto sem `retaFinalSync`: a adoção agora é recusada com
  `invalid-remote-plan` (revisão/linhagem desconhecidas);
- push sem descritor sobre qualquer Reta Final legada: bloqueado como
  `legacy-write` (antes só o plano v2 era detectado);
- plano local aposentado: não registra base de adoção (as regras exigem
  `state: active`), mantendo o comportamento anterior sem loop de
  `permission-denied`;
- `Baixar dados` forçado: preserva a semântica de substituição do payload
  acadêmico, mantendo o plano v2 local comprovadamente equivalente.

Um achado foi recusado com justificativa: `rolagens` continua ignorado na
equivalência porque é uma projeção derivada e recalculada por dispositivo
(anti ping-pong), não intenção humana; compará-lo criaria conflitos falsos.

## Equivalência real confirmada (issue #107)

A comparação dos dois diagnósticos privados com o backup foi publicada de forma
sanitizada em `matheussilva421/estudo-organizado#107` (comentário 6426042100):

- os dois diagnósticos contêm um `syncStatus.conflict.remotePlan` legado ativo de
  180 blocos, sem `planId`, `revision` ou `schemaVersionRetaFinal`, ambos com
  `missing-remote-plan`;
- o `conflict.localPlan` é idêntico ao plano do backup, com 180 blocos/180 IDs e
  `revision = 0`;
- IDs e ordem coincidem; há 363 diferenças apenas de presença de campos (3 no
  topo e `ordem` + `dataPlanejada` em cada bloco) e zero diferenças de valores;
- `ordem` = índice da lista e `dataPlanejada` = `data` em 180/180 blocos;
- removidos somente esses campos, o JSON normalizado é integralmente idêntico ao
  `remotePlan` dos dois diagnósticos;
- SHA-256 do plano normalizado:
  `968773a7e153ce60317edeaa75f7dd29b5fa67ceecdf9f58f4d5dc4e598cefe8`.

Isso confirma a equivalência **do planejamento** no incidente real. Não confirma
o payload acadêmico remoto nem que o snapshot de produção permaneça igual no
instante de uma futura migração; o guard/CAS e a comparação do hotfix continuam
obrigatórios antes de qualquer escrita. Nenhum dado pessoal foi copiado.

Metadados locais do backup, sem conteúdo: plano v2 válido e ativo, `revision=0`,
180 blocos/180 IDs, `dataFinal=2027-02-28`, 389 eventos, 4 editais, 82 questões,
51 leituras, 26 videoaulas, 51 páginas e 1 revisão.

## Hotfix de tamanho Firestore (pós-9.73)

A tentativa real de adoção falhou com **1.210.602 bytes** contra o limite de
**1.048.576**; `payload.config.manualSyncHistory` ocupava **508.364 bytes**
(20 registros, 6 conflitos completos repetidos).

- `src/js/sync/sync-history.js`: resumos operacionais bounded; planos completos
  deixam de entrar em `manualSyncHistory`/`lastManualSyncResults`.
- `src/js/sync/firestore-schema.js`: o payload Firestore remove apenas
  `manualSyncHistory` e `lastManualSyncResults`; os logs continuam no estado
  local/backup. `getFirestoreEnvelopeSizeBytes` mede o JSON UTF-8.
- `src/js/sync/firestore-outbox.js`: troca atômica da envelope pendente,
  exigindo o mesmo `queuedAt`/`sentAt`; preserva `attempts`, `nextAttemptAt`,
  status e a identidade da outbox.
- `src/js/sync/firestore-sync-engine.js`: em boot/reconciliação e antes do flush,
  uma envelope legada com histórico ou acima do limite é reconstruída a partir do
  estado atual (inclui alterações acadêmicas posteriores), preservando
  `baseRevision=0`, `snapshotRevision=1`, plano/digest e `baseRemoteUpdatedAt`.
  Guard de 1 MiB falha de modo fechado; nunca corta `editais`, `eventos` ou
  `planejamento`. O pull forçado preserva o histórico local.
- `nonPlanStateDigest` agora espelha `createExportableState`: ignora
  `manualSyncHistory`, `lastManualSyncResults`, credenciais/config Cloudflare,
  `driveFileId` e `lastSync`. Histórico local diferente não gera mescla nem
  envio repetitivo quando o conteúdo acadêmico é idêntico.

Validação: **115 testes focados**; emulador **73/73** com fixture sanitizado de
**889.117 bytes JSON**, abaixo do limite, e readback intacto de 180 blocos, 389
eventos, 4 editais e 82 questões; `bump:check` ok em 9.75; testes de SW/versão
**105/105**.

## Hotfix replay stale de adoção (27/10)

O 9.75 recuperou `missing-remote-plan`, mas deixou uma outbox de adoção com
`snapshotRevision=1/baseSnapshotRevision=0/baseRemoteUpdatedAt` legado enquanto
o remoto já estava em `snapshotRevision=1` com `payloadUpdatedAt` novo. O
`validateRetaFinalEnvelopeWrite` rejeitava corretamente como
`replay-payload-mismatch`; o conflito persistido ainda bloqueava o sync normal.

- A recuperação só atua no replay stale de adoção (snapshot 1/base 0), mesma
  linhagem/digest e plano local exatamente igual ao remoto. O validador de
  replay permanece estrito.
- Se o payload atual + pendente já é igual ao remoto, a outbox é reconhecida como
  já aplicada: `markFirestoreSnapshotSynced` com a identidade observada, sem
  escrita remota e sem atualizar `lastPushAt`.
- Se há alterações acadêmicas legítimas, a outbox é rebaseada para
  `snapshotRevision=2/baseSnapshotRevision=1`, `baseRemoteUpdatedAt` remoto,
  plano `revision=0/digest` inalterado, com união de dados locais/pendentes/remotos
  e tombstones exatos do remoto. `queuedAt/attempts` são preservados.
- A comparação de divergência é three-way (pendente como base, local e remoto):
  mudanças só locais ou só remotas são preservadas; mudanças conflitantes viram
  `outbox-rebase-unsafe` e exigem reconciliação humana.
- O `syncFirestoreNow` reconhece o conflito persistido de replay e executa o
  flush normal; não exige botão de força.

Validação: **123 testes focados**; engine **67/67**; emulador **75/75** (rebase
1→2 aceito; replay com payload diferente continua negado); `bump:check` 9.76;
SW/versão **105/105**; lint 0 erros.

## Risco residual
- `src/js/sync/sync-history.js` ainda não está no `ASSET_PATHS` do Service
  Worker; é servido/cacheado em runtime, mas não no precache de instalação.
  Requer follow-up próprio.

- Cada dispositivo que migrou localmente gerou seu próprio `planId`. A adoção em um dispositivo cria a linhagem remota; outro dispositivo com `planId` diferente verá conflito de `lineage` e exigirá reconciliação explícita. O hotfix não une linhagens automaticamente.
- Um plano local já editado (intenção diferente do legado) não é adotado; o conflito permanece até reconciliação humana.
- A equivalência é do planejamento; os dados acadêmicos são mesclados pela união por id com tombstones e LWW já existentes.

## Procedimento não destrutivo para o caso real (após release autorizada)

1. Manter os backups de 26/10 (JSON local e Cloudflare) e os diagnósticos fora do repositório. Não limpar cache/IndexedDB.
2. Antes de sincronizar, exportar um novo backup local pela interface e guardá-lo fora do repositório.
3. Confirmar que a versão publicada contém o hotfix (recarregar a página uma vez, sem limpar dados) e entrar com a conta do proprietário.
4. Abrir a Central de Sincronização. O `missing-remote-plan` não deve reaparecer. Com planos equivalentes, o app registra a base legada sem publicar o plano; o descritor v2 é enviado na primeira sincronização manual/automática.
   No boot/reconciliação, a envelope pendente de ~1,4 MB é reconstruída automaticamente: histórico operacional removido, plano/dados atuais preservados, `queuedAt`/`attempts` mantidos. Não limpar a outbox.
   Se houver `replay-payload-mismatch` persistido, a sincronização normal reconhece a adoção stale e rebaseia para `snapshotRevision=2/baseSnapshotRevision=1`; se a operação já estiver no remoto, apenas reconhece a outbox sem escrita. `outbox-rebase-unsafe` exige reconciliação humana.
5. Conferir no diagnóstico (sem publicar conteúdo pessoal) `baseRevision = 0`, `snapshotRevision` avançando de 0 para 1, `baseRemoteUpdatedAt` igual ao `payloadUpdatedAt` legado e `conflict = null`.
6. Validar a leitura de volta: 180 blocos, eventos, notas, tempo, questões, revisões e editais preservados; recarregar e confirmar persistência.
7. Se aparecer `legacy-plan-mismatch`: parar. Exportar o diagnóstico, comparar os caminhos em `differences` e reconciliar pelo editor/checkpoints. Não usar `Forçar sincronização`, `Baixar` ou `Enviar local` como contorno.
8. Se houver segundo dispositivo: ele pode apresentar `lineage` (planId próprio). Não force; trate como reconciliação separada.
9. Push e deploy com autorização específica (os commits locais dos hotfixes já estão feitos).

## Pendências

- Autorização para push/deploy e para a adoção real no Firestore.
- Confirmar em runtime o snapshot remoto atual, `payloadUpdatedAt`, guard e o
  payload acadêmico antes da primeira escrita; a equivalência publicada cobre o
  planejamento, não o estado acadêmico nem o snapshot do instante da migração.
- Se houver segundo dispositivo com `planId` próprio, tratar o conflito de
  `lineage` como reconciliação separada; não forçar.
- O deploy deve publicar o cache `9.76`; a primeira carga pode ainda executar o
  SW antigo até a ativação. Confirmar `DIAGNOSTIC_BUILD_VERSION = 9.76` antes de
  sincronizar.
- Se o envelope reconstruído ainda exceder 1 MiB, o motor falha fechado e
  preserva `editais`, `eventos` e `planejamento`; exportar o diagnóstico e
  segmentar conforme a arquitetura, sem corte silencioso.

## Hotfix 9.78 — `outbox-rebase-unsafe` (27/10)

### Causa raiz

O 9.76 recuperava o replay de adoção comparando o plano local com o remoto por
JSON bruto (`sameJson`). `syncRetaFinalToEventos` materializa a projeção do
cronograma em `data`, `status`, `rolagens` e `dataEfetiva` dentro do plano, sem
incrementar `revision`. Dois dispositivos podem ter a mesma intenção com
representações diferentes; a recuperação classificava isso como
`local-plan-not-exact` e registrava `outbox-rebase-unsafe` com
`differences: null`, bloqueando poll/auto-pull/sync-now.

Defeitos estruturais confirmados no mesmo caminho:

- o descritor era calculado a partir do plano local, mas o payload acadêmico
  enviava o plano remoto verificado (`planOverride`); qualquer deriva de
  projeção em campo coberto pelo digest fazia `descriptorPayloadMismatch`
  bloquear o envio com mensagem genérica;
- `enqueueFirestoreSnapshot` fazia `put` cego: um `Sincronizar agora` podia
  substituir a outbox pendente (e `queuedAt`/`attempts`) por outra operação;
- `retaFinalQueueOptions` ignorava o `baseRemoteUpdatedAt` observado pelo
  sync-now, mantendo a base antiga no descritor;
- conflitos `outbox-rebase-unsafe` não eram reavaliados pelo caminho normal.

### Correção

- `reta-final-protocol.js`: identidade por intenção
  (`compareRetaFinalPlanIntent`), ignorando projeção, metadados por dispositivo
  (`updatedAt`, journal) e ordem dos blocos; divergência real devolve caminhos
  estáveis (`retaFinal.blocos.<id>.<campo>`). `wireDigest` permite carregar o
  digest remoto quando o plano não muda (as regras comparam digest e mapa
  literalmente).
- `firestore-sync-engine.js`: rebase seguro por intenção; `ALREADY_APPLIED`
  compara o estado acadêmico sem plano; `UNSAFE` ganha `subcause`,
  `differences` e `details` (contagens/ids, sem plano completo); as causas
  `outbox-rebase-unsafe`, `replay-payload-mismatch` e
  `remote-changed-during-recovery` são reavaliadas pelo caminho normal; CAS
  local no enfileiramento; re-leitura do remoto e revalidação antes da escrita;
  `_timerStart` preservado no merge; `Forçar sincronização`/`Enviar local`
  passam a drenar a outbox existente em vez de substituí-la.
- `firestore-outbox.js`: `enqueueFirestoreSnapshot(envelope, { expected })` é
  compare-and-set e preserva `queuedAt`/`attempts`/`nextAttemptAt`.
- UI: subcausa e caminhos divergentes no card de conflito e no status.
- `sync-history.js` entrou no precache do Service Worker (pendência da 9.76).
- Versão de cache 9.78 (9.77 no commit da correção; o hook de pre-commit
  incrementou ao commitar os testes).

### Testes

- `npx vitest run`: 179 arquivos, 2982 testes PASS.
- E2E chromium: `sync-e2e` + `sync-dados` 21/21 PASS; `sync-devices` +
  `sync-simulation-expanded` 5/5 PASS.
- Casos novos de replay/rebase, subcausa, CAS de outbox, reload persistido,
  remoto alterado durante a recuperação, cronômetro e divergência real.
- Emulador Firestore: **PASS 78/78** com `firestore.rules` (JRE 21 local em
  `C:\Users\slvma\AppData\Local\JDownloader 2\jre`, emulador na porta 8085).
  As regras do repositório são as mesmas da versão publicada: o último commit
  que tocou `firestore.rules` foi `1c2257d` (v9.69) e não houve diff até a 9.78.
  Inclui os casos novos: rebase com digest remoto aceito; digest diferente e
  mapa de plano diferente negados.
- Novo teste de integração `tests/unit/firestore-sync-outbox-integration.test.js`:
  usa a outbox real sobre um IndexedDB em memória, persiste uma operação
  conflitante, simula reload (novo registro de módulos), rebaseia uma vez e
  prova que a segunda sincronização não grava de novo.

### Revisão independente (achados materiais corrigidos)

- O rebase gravava o estado mesclado no envelope, mas não o aplicava ao estado
  local; o próximo push academic-only poderia apagar do remoto justamente os
  itens mesclados. Agora o estado local é atualizado após o ACK (preservando a
  projeção e o objeto de config vivos), com fallback LWW se o usuário editar
  durante a escrita.
- O validador de replay usava `canonical(payload)`, que removia `data` e outros
  campos em qualquer profundidade, enquanto as regras comparam o payload
  inteiro. O replay agora compara o mapa completo; o ramo de plano inalterado
  compara também `payload.planejamento` (novo `plan-payload-mismatch`, que entra
  na recuperação).
- O descritor academic-only recalculava tombstones/floor; as regras exigem
  presença, valor e ordem exatos. Agora copia os campos do descritor remoto, e
  `retentionFloor` omite o campo quando não há floor e nunca produz valor
  negativo.
- A identidade de pull e o status de no-op passaram a usar o digest de
  intenção; o par `_timerStart`/`tempoAcumulado` é preservado junto.
- A resolução de conflito grava `baseRemoteDigest`, tombstones e floor da base
  remota para não bloquear o próximo push academic-only.
- Limitações aceitas nesta rodada: `plan-digest-mismatch` continua fail-closed
  (é violação do contrato de revisão, não deriva de projeção); `adoption-base`
  em documento legado cujo `payloadUpdatedAt` mudou continua fail-closed — a
  recuperação automática chegou a ser proposta, mas a revisão automática de
  aprovação a rejeitou por risco de republicar sobre um documento legado
  alterado; o conflito agora traz um procedimento explícito (reler, confirmar
  equivalência e só então publicar a adoção); `enqueue/replace/markSynced`
  continuam resolvendo no onsuccess do IndexedDB (o replay idempotente cobre a
  janela de aborto).

### Pendências (gates)

- Push e deploy: aguardando autorização explícita.
- Recuperação real da conta: aguardando autorização de escrita remota; nenhum
  IndexedDB/outbox foi limpo e nenhum documento real foi escrito.
- Confirmar em runtime o snapshot remoto e executar readback/segunda
  sincronização idempotente após o deploy.

### Pré-publicação (pronto para o gate)

- `origin/main` é ancestral de `HEAD`; push fast-forward de 2 commits
  (`e9489c5..24b3d9a`). Árvore limpa, versão 9.78, `bump:check` ok.
- O push existente é `git push origin main` (sem force). O workflow
  `.github/workflows/auto-cache-bump.yml` compara `src/sw.js` antes/depois:
  9.76 → 9.78 já bumpado, então ele não cria commit extra.
- `wrangler.jsonc` publica `src/` como assets e `worker/index.js` pelo build
  do Cloudflare (integração Git). Não executar `npx wrangler deploy` se o build
  automático publicar o commit.

### Pós-deploy — ordem exata da recuperação real

1. Abrir a URL de produção no perfil original; não limpar IndexedDB, cache ou
   outbox. Confirmar `DIAGNOSTIC_BUILD_VERSION = 9.78` e o cache
   `estudo-organizado-v9.78` ativo.
2. Exportar um backup local novo pela interface, fora do repositório, e guardar
   os backups/diagnósticos anteriores.
3. Antes de qualquer escrita, ler o snapshot remoto e conferir
   `payloadUpdatedAt`, `retaFinalSync.snapshotRevision`, `revision` e que o
   planejamento tem 180 blocos. Comparar a intenção local/remota e registrar a
   contagem de eventos, editais, questões e revisões.
4. Abrir a Central de Sincronização e executar a sincronização normal (sem
   Forçar/Enviar local). Esperado: rebase para `snapshotRevision 2`,
   `baseSnapshotRevision 1`, digest remoto preservado, uma única escrita.
5. Reler o documento remoto: `conflict = null`, `hasPendingWrites = false`,
   outbox vazia ou reconhecida, 180 blocos e os mesmos totais acadêmicos.
6. Recarregar sem limpar dados e confirmar a persistência; executar uma segunda
   sincronização normal e provar que não há nova escrita.
7. Se aparecer `plan-intent-divergence` ou `academic-divergence`, parar a
   operação insegura, preservar a outbox e comparar os caminhos em
   `differences`; não usar força.

### Inventário GitHub (27/10, somente leitura)

- `main` remota em `e9489c5`; `main` local em `baff1a0`, 3 commits à frente,
  fast-forward confirmado. Nenhuma PR aberta.
- `v2`: 5 commits exclusivos (docs V2/F0 e link para a issue #108), divergida
  (1 atrás). Preservar.
- `docs/superpowers-estudo-organizado-v2-design`: 2 commits exclusivos
  (`c3e33e5`, `2a2736c`). Preservar.
- `docs/superpowers-estudo-organizado-v2-f0-plan`: 8 commits exclusivos
  (plano F0 aprovado). Preservar.
- Issue #107 aberta, ainda com o título original de `missing-remote-plan`.
  O comentário de status não foi publicado: a revisão automática de aprovação
  rejeitou o payload por detalhes internos em repositório externo sem
  autorização específica.
