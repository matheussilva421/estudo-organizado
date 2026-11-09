# F7 — estabilização pós-recuperação e revisão independente

**Data:** 09/11/2026  
**Branch:** `v2`  
**Base recuperada:** `d069bf4f8624cee9b9617131401a5e525eb8d2cf` + merge `75079e4e48025a33778ea26895de06b451890eb6`  
**Estado:** `F7_STABILIZED_LOCAL` / `BLOCKED_G-EXT_G-STAGING`  
**Não é:** `F7_ACCEPTED`, `F7_READY_FOR_HUMAN_REVIEW` ou autorização de F8/G5.

## 1. Escopo

Revisão independente da F7 funcional, correção de falhas materiais comprovadas, verificação do merge recuperado, persistência local de backup/orçamento e preparação de T26/T27 e da F7-UX. Nenhum serviço real foi acessado; nenhum push, deploy, PR ou Action foi feito.

## 2. Revisores independentes

Quatro revisores separados, somente leitura, com contexto próprio, revisaram o HEAD recuperado:

| Foco | Revisor | Veredito inicial |
|---|---|---|
| Auth, vínculo, UID, Rules, ACK | Herschel | not ready |
| Sync, feed, conflitos, rebaseline, restore | Locke | not ready |
| Backup, cripto, KV, restore, migração | Aristotle | not ready |
| PWA, isolamento, custos, UX de estados | Ampere | not ready |

Os pareceres completos estão no pacote de evidências. Todos observaram que o código F7 existia como biblioteca, mas não estava ligado ao produto; dois revisores também apontaram que o restore de HEAD apenas gravava o snapshot em `meta`.

## 3. Achados materiais e destino

### Corrigidos e cobertos por teste

| Área | Correção | Evidência |
|---|---|---|
| Restore | `commitF7Restore` aplica stores acadêmicos em transação, valida consentimento/checksum, remapeia `profileId`, preserva tombstones e não reaplica outbox | `f7-restore.test.ts` 9 PASS, incluindo leitura do store e quota |
| Pull | `applyRemoteChange` aplica entidade/tombstone/conflito e grava cursor na mesma transação | `f7-change-feed.test.ts` 13 PASS |
| Cursor | CAS monotônico, rejeição de regressão/troca de binding e gaps de sequência | testes de feed e cursor |
| Conflito | payload remoto preservado; `REMOTE` aplica o valor; `LOCAL` rejeita revisão local mais nova; `MANUAL` removido | `f7-sync-conflicts.test.ts` 8 PASS |
| Flush | para a entidade após conflito/falha determinística; falha de ACK conta como pendente | `f7-sync-coordinator.test.ts` 12 PASS |
| ACK | digest remoto conferido no `lookup`; biblioteca do perfil exigida | `f7-firebase-remote`, `f7-sync-ack` |
| Firebase | `listAfter`/`readEntity` reais, `uid` removido do envelope local, app V2 nomeado por projeto | `f7-firebase-remote` 10 PASS |
| Rebaseline | aplica entidades vivas, tombstones e preserva outbox pendente; cursor ainda não é reposicionado (ver pendências) | `f7-rebaseline.test.ts` 7 PASS |
| Checksum | canonicalização JSON-safe para `undefined`/`Date`/não finitos; manifesto autenticado no checksum | `f7-backup-crypto` 9 PASS, `f7-backup-coverage` 6 PASS |
| Scheduler | estado de 24 h/7 versões/pausa persistido em `meta` | `f7-backup-schedule` 8 PASS |
| Worker | POST imutável por ID e DELETE recusa a última cópia; JWKS padrão e entrypoint `fetch` | `f7-kv-auth` 8 PASS |
| V1 | migração não mapeada falha fechada (`AMBIGUOUS`, sem snapshot) em vez de cópia rasa SAFE | `f7-v1-migration.test.ts` 7 PASS |
| Rules | tombstone sem payload, `changeId` ligado a `sequence` e `getAfter` de entidade/change/head no recibo | 10 testes Firebase PASS |
| Runtime | composition root liga Auth, Firestore, pull, coordinator, backup, restore e painel local; modo local não importa Firebase | `f7-runtime.test.ts` 3 PASS |
| Estados | `CONFLICT`, `RECOVERY_REQUIRED`, `PAUSED_QUOTA`, `PAUSED_AUTH`, `PENDING_OFFLINE`, `SYNCING` têm rótulos próprios; saúde local reflete conteúdo real | `f7-sync-view.test.ts` 9 PASS |
| PWA | precache de assets com `ignoreVary`; `CACHE_NAME` versionado por build; primeira visita offline; update só APPLIED após `controllerchange`; presença positiva de abas por Web Lock; staging exige HTTPS/host não-loopback e o SW recusa origem V1 | `pwa-offline` 4 PASS, `f7-sw-update` 7 PASS, `f4-update` 4 PASS, `f7-tab-presence` 3 PASS, staging 6 PASS |
| Duas abas/outbox real | duas páginas Chromium, outbox IndexedDB, `SyncCoordinator`, Web Locks e remote fake compartilhado; ACK perdido recuperado por lookup | `f7-real-outbox` 2 PASS |
| Recovery fail-closed | `RECOVERY_REQUIRED` bloqueia novos flushes até `clearRecovery`; testado | `f7-sync-coordinator` 14 PASS |
| Delivery F3/F5/F4 | writers deixam de marcar `deliveryMode:'BLOCKED'`; gate aceita todos os tipos; consentimento limpa o bloqueio legado; coordinator entrega planejamento | `f7-delivery-types` 4 PASS, `f7-sync-coordinator` 13 PASS |

### Pendentes, parciais ou deliberadamente bloqueados

| Item | Estado | Motivo |
|---|---|---|
| Rebaseline cursor/epoch | `PARTIAL` | entidades e tombstones aplicados; cursor/epoch completos dependem de contrato de `historyFloor` no T09. |
| Previews em memória | `PARTIAL` | preview de restore/rebaseline expira com reload; UI refaz a prévia. |
| Retenção multi-dispositivo | `PARTIAL` | estado do scheduler persiste neste dispositivo; `remote.list()` ainda não hidrata versões de outro dispositivo. |
| Migração V1 real | `BLOCKED_MAPPING` | dados não vazios falham fechados; falta mapeamento semântico por schema e fixtures não vazias. |
| Concorrência real de Rules/CAS | `PARTIAL` | duas abas reais passam localmente com Web Locks/outbox; serviço Firestore multi-cliente real NOT_RUN. |
| Budget em serviço real | `PARTIAL` | orçamento aplicado antes do flush com uso persistido; números reais de quota só em T26. |
| Quatro HIGH F0 | `MITIGADO_LOCAL` | ver seção 5; nenhuma prova real. |

## 4. Testes executados em 09/11/2026

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | **768 PASS / 113 arquivos** |
| `npm run build` | PASS (Vite 8.3.5; chunks Firebase lazy) |
| `npm run test:e2e` | **164 PASS + 2 skips / 166** |
| Firebase Emulator (`demo-estudo-v2`) | **10 PASS** (Rules + transação) |

Os 2 skips são os históricos. As imagens F4 regravadas pelo E2E foram revertidas para os blobs versionados; as cópias externas em `estudo-organizado-preservacao-20261104` permanecem intactas.

## 5. Quatro riscos HIGH da F0

| Risco | Estado atual | Limite |
|---|---|---|
| `R-V1-LEGACY-REMOTE-PLAN` | `MITIGADO_LOCAL` | migração V1 sem dados reais e fail-closed; falta mapeamento real |
| `R-V1-FIRESTORE-DOCUMENT-1MIB` | `MITIGADO_LOCAL` | limite de 900 kB/26 MiB testado localmente; Firestore real NOT_RUN |
| `R-V1-MULTITAB-OUTBOX-RACE` | `PARTIAL` | Web Locks/coordinator unitários; E2E de duas abas ainda usa harness sintético, não a outbox real |
| `R-V1-BACKUP-TOMBSTONE-LOSS` | `MITIGADO_LOCAL` | restore/rebaseline/checksum/tombstones corrigidos; KV/Firestore reais NOT_RUN |

Nenhum risco foi convertido em PASS real.

## 6. Preparação T26/T27

O checklist operacional está em `docs/operations/f7-g-ext-staging-prep.md`. Ele cobre projeto Spark isolado, Worker/KV Free, JWKS, variáveis públicas, critérios de autenticação/sync/backup, cotas gratuitas, URL independente, matriz S01–S25, backup/rollback e critérios de parada. **G-EXT e G-STAGING continuam bloqueados.**

## 7. F7-UX

A matriz de reutilização está em `docs/superpowers/v2/f7-ux-reuse-matrix.md`. Ela confronta D01–D71/UX-01–UX-31 com o código F6/F7 e identifica o que reutilizar, o que está pronto e o que não deve ser duplicado. Nenhum redesign foi iniciado.

## 8. Git e integração

- `main` permanece em `9046cfa2283cd293b38df9d52fabfcd5de9ac67c`.
- `origin/v2` permanece em `7a7df0f2f9911a0d5956cb9b94ffa03659d24905`; a `v2` local avança por commits locais, sem push.
- Refs `recovery/f7-preformat-20261104`, `recovery/v2-f7ux-20261109`, F5 e bundles preservados.
- Nenhum PR/Action/workflow criado.

## 9. Próximo passo

Revisar o diff e os commits locais, repetir os gates afetados e, com autorização separada, executar T26/T27 via `f7-g-ext-staging-prep.md`. A F7-UX só começa em GOAL próprio, depois da estabilização do código F7. F8/G5 não estão autorizados.
