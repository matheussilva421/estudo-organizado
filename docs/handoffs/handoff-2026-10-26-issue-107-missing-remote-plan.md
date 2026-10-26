# Handoff — Issue #107 (`reta-final-conflict: missing-remote-plan`)

## Metadados

- Data: 2026-10-26 (America/Fortaleza)
- Branch: `main` (sem branch/PR novo)
- HEAD no início: `34f40431b0d7d1169eb64680703a810d1a55f16d` (igual a `origin/main`)
- Estado: hotfix commitado localmente na `main`, **sem push ou deploy**
- Versão de cache: `9.72` (bump aplicado; `bump:check` ok)
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
- Gates finais pós-bump: `bump:check` ok (9.72); testes de SW/versão **105/105**.

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

## Risco residual

- Cada dispositivo que migrou localmente gerou seu próprio `planId`. A adoção em um dispositivo cria a linhagem remota; outro dispositivo com `planId` diferente verá conflito de `lineage` e exigirá reconciliação explícita. O hotfix não une linhagens automaticamente.
- Um plano local já editado (intenção diferente do legado) não é adotado; o conflito permanece até reconciliação humana.
- A equivalência é do planejamento; os dados acadêmicos são mesclados pela união por id com tombstones e LWW já existentes.

## Procedimento não destrutivo para o caso real (após release autorizada)

1. Manter os backups de 26/10 (JSON local e Cloudflare) e os diagnósticos fora do repositório. Não limpar cache/IndexedDB.
2. Antes de sincronizar, exportar um novo backup local pela interface e guardá-lo fora do repositório.
3. Confirmar que a versão publicada contém o hotfix (recarregar a página uma vez, sem limpar dados) e entrar com a conta do proprietário.
4. Abrir a Central de Sincronização. O `missing-remote-plan` não deve reaparecer. Com planos equivalentes, o app registra a base legada sem publicar o plano; o descritor v2 é enviado na primeira sincronização manual/automática.
5. Conferir no diagnóstico (sem publicar conteúdo pessoal) `baseRevision = 0`, `snapshotRevision` avançando de 0 para 1, `baseRemoteUpdatedAt` igual ao `payloadUpdatedAt` legado e `conflict = null`.
6. Validar a leitura de volta: 180 blocos, eventos, notas, tempo, questões, revisões e editais preservados; recarregar e confirmar persistência.
7. Se aparecer `legacy-plan-mismatch`: parar. Exportar o diagnóstico, comparar os caminhos em `differences` e reconciliar pelo editor/checkpoints. Não usar `Forçar sincronização`, `Baixar` ou `Enviar local` como contorno.
8. Se houver segundo dispositivo: ele pode apresentar `lineage` (planId próprio). Não force; trate como reconciliação separada.
9. Push e deploy com autorização específica (o commit local do hotfix já está feito).

## Pendências

- Autorização para push/deploy e para a adoção real no Firestore.
- Confirmar em runtime o snapshot remoto atual, `payloadUpdatedAt`, guard e o
  payload acadêmico antes da primeira escrita; a equivalência publicada cobre o
  planejamento, não o estado acadêmico nem o snapshot do instante da migração.
- Se houver segundo dispositivo com `planId` próprio, tratar o conflito de
  `lineage` como reconciliação separada; não forçar.
- O deploy deve publicar o cache `9.72`; a primeira carga pode ainda executar o
  SW antigo até a ativação. Confirmar `DIAGNOSTIC_BUILD_VERSION = 9.72` antes de
  sincronizar.
