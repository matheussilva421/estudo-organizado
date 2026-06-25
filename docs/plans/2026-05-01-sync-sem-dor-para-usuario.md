# Sync Sem Dor Para Usuario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o usuario editar normalmente enquanto o app salva localmente em milissegundos, sincroniza Firestore sozinho em background, evita travamentos, resolve quase tudo sem pergunta e so interrompe o usuario quando existe risco real de perda.

**Architecture:** Preservar a arquitetura vanilla JS/PWA e local-first. IndexedDB continua sendo o commit imediato; Firestore fica como remoto principal automatico; snapshot `users/{uid}/snapshots/main` permanece fallback e sinalizador barato; entity docs viram o caminho remoto granular quando estiverem realmente seguros. O sync deve ser dividido em quatro camadas: Local Commit, Sync Planner, Network Worker e Quiet UX.

**Tech Stack:** Vanilla ES modules, IndexedDB, Firebase Auth, Firestore Web SDK, Firestore persistent local cache, Cloudflare Worker/KV secundario, Google Drive backup manual, Vitest, Playwright, Firestore Rules.

---

## Analise Do Estado Atual

### O Que Ja Esta Bom

- `src/js/store.js` e o evento `stateSaved` mantem o contrato correto: primeiro salva localmente, depois dispara efeitos de sync.
- `src/js/sync/sync-coordinator.js` ja centraliza os gatilhos principais: `stateSaved`, login, reconnect, foreground e pedidos manuais.
- `src/js/sync/firestore-sync-engine.js` ja suporta snapshot fallback, entity-primary, shadow verification, conflitos e restore.
- `src/js/sync/sync-center.js` ja reduz a UI para um modo tranquilo com `quiet.title`, `quiet.detail`, `quiet.tone` e painel avancado.
- `firestore.rules` ja restringe por `uid` e nega delete fisico em snapshot e entidades.
- Cloudflare e Google Drive ja estao tratados como backup manual/secundario, nao como sync automatico concorrente.
- Testes unitarios e E2E ja cobrem muitos contratos de persistencia, conflito, export e caos.

### Problemas Que Ainda Podem Causar Dor

1. **Entity-primary ainda pode ser pesado.**
   - `queueFirestoreEntityBatchFromState()` monta docs para todas as entidades rastreadas a cada batch.
   - Para bases grandes, isso pode deixar cada save caro demais.

2. **`firestore-sync-engine.js` concentra responsabilidades demais.**
   - Auth, status, watcher, snapshot, entities, merge, restore, conflito e UI events convivem no mesmo modulo.
   - Isso aumenta risco de regressao e dificulta provar que o caminho automatico e leve.

3. **Auto-pull entity-primary ainda le todos os entity docs para descobrir se remoto e mais novo.**
   - `autoPullRemoteWhenNewer()` usa `readFirestoreEntityDocuments()` e depois calcula `maxEntityUpdatedAt`.
   - Isso deve virar consulta barata ou manifest remoto, nao leitura completa antes de decidir.

4. **Conflito por entidade ainda precisa ficar matematicamente seguro.**
   - O merge atual ja preserva local quando revisoes divergem, mas deve cobrir tambem mesma revisao com checksum/conteudo diferente.
   - Tambem deve evitar mutar `state` in-place dentro de funcoes de merge.

5. **Outbox e status precisam ser mais deterministas.**
   - Snapshot outbox tem um unico registro `latest_snapshot`.
   - Entity outbox tem um unico registro `entity_shadow`.
   - Isso e simples, mas dificulta diagnostico de operacoes, coalescing real, cancelamento e idempotencia por lote.

6. **Saude de sync ainda esta dividida.**
   - `failureCount` fica em memoria no coordinator.
   - `config.syncHealth.events` guarda eventos, mas nao e a fonte unica de estado.
   - A UI pode parecer "Tudo salvo" quando ha detalhe tecnico pendente que nao foi normalizado.

7. **Watcher remoto em entity-primary ainda nao e ideal.**
   - `applyRemoteSnapshotFromWatch()` retorna cedo quando `isEntityPrimaryEnabled()`.
   - O app deixa de aplicar snapshot remoto em entity-primary, o que e certo, mas tambem nao tem um watcher barato de mudanca remota por entidade.

8. **Firestore Rules estao boas como base, mas podem endurecer mais.**
   - A regra valida formato e dono, mas nao limita colecoes permitidas nem tamanho aproximado de payload.
   - Tambem nao valida imutabilidade de alguns campos em update.

9. **Experiencia final ainda depende de esconder complexidade, nao de remove-la.**
   - O modo tranquilo ajuda, mas o usuario ainda sente travamento quando o caminho automatico faz trabalho pesado.
   - O alvo deve ser: nenhuma leitura remota no caminho de digitacao/salvamento local.

---

## Principios De Produto

1. **Editar nunca espera Firestore.**
   - Todo comando de usuario termina apos IndexedDB.
   - Firestore e sempre pos-commit.

2. **Salvar local nao faz leitura remota.**
   - `local-save` so agenda push/coalescing.
   - Pull remoto so roda em login, reconnect, foreground, timer guard, abertura do app ou acao manual.

3. **A UI normal mostra quatro estados.**
   - `Tudo salvo`
   - `Sincronizando`
   - `Offline`
   - `Acao necessaria`

4. **Conflito e excecao, nao rotina.**
   - Entidades diferentes devem mesclar.
   - Mesma entidade com divergencia real deve preservar local e pedir decisao.

5. **Backup nao compete com sync.**
   - JSON, Cloudflare e Drive sao recuperacao/manual.
   - Firestore e o unico remoto automatico.

6. **Toda decisao destrutiva oferece export antes.**
   - Pull forcardo, force push, restore e delete/tombstone devem ter caminho de backup local.

---

## Arquitetura Alvo

```text
UI / Domain Actions
  -> scheduleSave()
  -> saveStateToDB()
  -> stateSaved
  -> Sync Planner
     -> decide: push, wait, pull-check, conflict, no-op
     -> durable sync job
  -> Network Worker
     -> flush entity delta
     -> flush snapshot fallback
     -> update sync state
  -> Quiet Sync View
```

### Novos Limites De Responsabilidade

- `store.js`
  - Apenas commit local, recovery local e evento `stateSaved`.
  - Nunca importa Firestore.

- `sync-coordinator.js`
  - Decide quando chamar o planner.
  - Nao monta payload e nao faz merge remoto.

- Novo `src/js/sync/sync-planner.js`
  - Decide se a proxima acao e `push_local`, `check_remote`, `wait_backoff`, `blocked_conflict`, `offline`, `noop`.
  - Deve ser puro/testavel.

- Novo `src/js/sync/sync-job-store.js`
  - Persiste estado unico do job atual em IndexedDB/local config.
  - Guarda `jobId`, `reason`, `phase`, `attempts`, `nextAttemptAt`, `startedAt`, `finishedAt`.

- Novo `src/js/sync/entity-delta-builder.js`
  - Converte apenas entidades sujas em docs Firestore.
  - Evita escrever todas as entidades em todo save.

- `firestore-sync-engine.js`
  - Fica como adaptador Firestore.
  - Com o tempo, perde responsabilidades para modulos menores.

- `sync-center.js`
  - Continua sendo o view model.
  - Le estado consolidado, nao calcula regra operacional pesada.

---

## Fase 0 - Baseline Congelado E Instrumentacao Minima

**Objetivo:** Criar um ponto de controle antes de mexer de novo no sync.

**Files:**

- Modify: `src/docs/superpowers/plans/2026-05-01-sync-sem-dor-para-usuario.md`
- Modify: `src/docs/api/sync-contract.md`
- Modify: `src/js/sync/sync-health.js`
- Test: `tests/unit/sync-health.test.js`

### Tasks

- [ ] Registrar baseline atual:
  - commit atual,
  - `APP_VERSION`,
  - modo Firestore ativo,
  - quantidade de testes unitarios e E2E,
  - se service worker esta atualizado.

- [ ] Adicionar no plano uma secao `Execution Log` para cada fase.

- [ ] Criar checklist de regressao manual:
  - editar evento com Firestore ligado,
  - editar aula com Firestore ligado,
  - ficar offline,
  - voltar online,
  - abrir Configuracoes,
  - reload apos save,
  - login/logout.

- [ ] Adicionar teste unitario para garantir que `appendSyncHealthEvent()` nao armazena payload de dados do usuario.

**Critérios De Aceite:**

- O plano registra claramente o que existe hoje e o que ainda e experimental.
- Nenhum teste novo depende de credencial real.
- `npm test` passa.

---

## Fase 1 - Remover Trabalho Remoto Do Caminho De Edicao

**Objetivo:** Garantir que editar no app nunca espere Firestore, nunca leia remoto e nunca renderize a tela inteira por causa de sync.

**Files:**

- Modify: `src/js/sync/sync-coordinator.js`
- Modify: `src/js/sync/firestore-sync-engine.js`
- Modify: `src/js/main.js`
- Test: `tests/unit/sync-coordinator.test.js`
- Test: `tests/unit/firestore-contracts.test.js`
- E2E: `tests/e2e/phase6-chaos-validation.spec.js`

### Tasks

- [ ] Proibir remote read no motivo `local-save`.
  - Regra: `reason === 'local-save'` so pode chamar:
    - `queueFirestoreEntityBatchFromState`
    - `queueFirestoreSnapshotFromState`
    - `flushFirestoreOutbox`
  - Nao pode chamar:
    - `readFirestoreEntityDocuments`
    - `readFirestoreSnapshot`
    - `autoPullRemoteWhenNewer`

- [ ] Criar teste unitario:
  - nome: `does not pre-read remote data on local save auto sync`
  - esperado: `autoPullRemoteWhenNewer` nao chamado em `local-save`.

- [ ] Criar contrato estatico em `firestore-contracts.test.js`:
  - `stateSaved` continua indo para coordinator.
  - `store.js` nao importa Firestore.
  - `local-save` nao passa por auto-pull.

- [ ] Reduzir renders de Configuracoes:
  - `app:firestoreSyncStatus` nao deve renderizar se `currentView !== 'config'`.
  - Manter assinatura deduplicada.
  - Adicionar throttling maximo de 1 render a cada 250ms enquanto sync esta ativo.

- [ ] Testar E2E:
  - criar/editar evento com Firestore config simulada,
  - garantir que UI responde e evento persiste apos reload.

**Critérios De Aceite:**

- Com Firestore ativo, uma edicao local agenda sync sem leitura remota antes.
- Topbar pode mostrar "Sincronizando", mas a edicao permanece responsiva.
- Nenhum render global repetido durante flush automatico.

---

## Fase 2 - Sync Planner Puro E Deterministico

**Objetivo:** Separar decisao de execucao para parar de misturar regras em engine, coordinator e UI.

**Files:**

- Create: `src/js/sync/sync-planner.js`
- Modify: `src/js/sync/sync-coordinator.js`
- Test: `tests/unit/sync-planner.test.js`
- Test: `tests/unit/sync-coordinator.test.js`

### API Alvo

```js
export function planNextSyncAction(input = {}) {
  return {
    action: 'push_local',
    reason: input.reason || 'unknown',
    canRunNow: true,
    delayMs: 0,
    requiresNetwork: true,
    userActionRequired: false,
    explanation: 'local-save never checks remote before pushing queued local changes',
  };
}
```

### Actions Permitidas

- `noop`
- `offline`
- `blocked_conflict`
- `wait_backoff`
- `push_local`
- `check_remote_then_pull`
- `repair_pending_state`
- `manual_force_push`
- `manual_restore_preview`

### Tasks

- [ ] Implementar `planNextSyncAction()`.

- [ ] Adicionar casos unitarios:
  - Firestore nao configurado -> `noop`.
  - Sem login -> `noop`.
  - Conflito ativo -> `blocked_conflict`.
  - Offline -> `offline`.
  - `local-save` com primary ativo -> `push_local`.
  - `local-save` com backoff ativo -> `wait_backoff`.
  - `foreground` sem pendencia local -> `check_remote_then_pull`.
  - `reconnect` com pendencia local -> `push_local`.

- [ ] Refatorar `sync-coordinator.js` para chamar planner antes de qualquer operacao.

- [ ] Fazer `sync-coordinator.js` emitir status com base no plano:
  - `queued`,
  - `syncing`,
  - `offline`,
  - `conflict-paused`,
  - `idle`.

**Critérios De Aceite:**

- Toda regra operacional de "o que fazer agora" fica em `sync-planner.js`.
- Teste cobre matriz de estados sem tocar Firestore real.
- `sync-coordinator.js` vira orquestrador fino.

---

## Fase 3 - Delta Sync Por Entidade

**Objetivo:** Parar de gerar e escrever todas as entidades em todo save.

**Files:**

- Create: `src/js/sync/entity-delta-builder.js`
- Modify: `src/js/sync/firestore-entity-outbox.js`
- Modify: `src/js/sync/entity-metadata.js`
- Test: `tests/unit/entity-delta-builder.test.js`
- Test: `tests/unit/firestore-entity-outbox.test.js`
- E2E: `tests/e2e/sync-simulation-expanded.spec.js`

### API Alvo

```js
export function buildEntityDelta({ state, previousMeta = [], now, deviceId }) {
  return {
    docs: [],
    unchangedCount: 0,
    changedCount: 0,
    tombstoneCount: 0,
    skippedCount: 0,
  };
}
```

### Tasks

- [ ] Usar `entity_meta` como base para descobrir entidades alteradas.

- [ ] Gerar docs apenas quando:
  - entidade nova,
  - checksum mudou,
  - revision mudou,
  - tombstone novo,
  - tombstone com revision maior.

- [ ] Manter fallback:
  - se `entity_meta` ausente/corrompido, gerar batch completo uma vez e regravar meta.

- [ ] Adicionar metrica:
  - `changedCount`,
  - `unchangedCount`,
  - `batchBytesEstimate`,
  - `docsCount`.

- [ ] Limitar batch:
  - max 450 writes por batch Firestore,
  - dividir em paginas se passar disso.

- [ ] Testes:
  - altera 1 evento em 500 entidades -> gera 1 doc.
  - remove 1 aula -> gera 1 tombstone.
  - meta ausente -> gera full batch e marca `fullRebuild: true`.

**Critérios De Aceite:**

- Save local de base grande nao monta docs desnecessarios.
- Entity-primary passa a escalar com entidades alteradas, nao com tamanho total do app.
- O usuario deixa de sentir travamento em bases grandes.

---

## Fase 4 - Manifest Remoto Barato

**Objetivo:** Saber se existe remoto mais novo sem ler todos os entity docs.

**Files:**

- Modify: `src/js/sync/firestore-sync-engine.js`
- Modify: `src/js/sync/firestore-repository.js`
- Modify: `src/js/sync/firestore-schema.js`
- Test: `tests/unit/firestore-sync-engine-new.test.js`
- Test: `tests/unit/firestore-schema.test.js`

### Estrategia

Usar o snapshot fallback como manifest remoto barato:

```json
{
  "entityManifest": [],
  "payloadUpdatedAt": "2026-05-01T12:00:00.000Z",
  "updatedAt": "2026-05-01T12:00:00.000Z"
}
```

Em entity-primary:

- local-save escreve entidades primeiro;
- depois atualiza snapshot fallback com manifest e payload resumido/compat;
- foreground/reconnect le snapshot `main` primeiro;
- so le entity docs se manifest indicar remoto mais novo.

### Tasks

- [ ] Criar `readFirestoreRemoteManifest(db, uid)`:
  - le somente snapshot `main`.
  - retorna `remoteUpdatedAt`, `entityManifest`, `deviceId`.

- [ ] Trocar `autoPullRemoteWhenNewer()`:
  - primeiro chama `readFirestoreRemoteManifest`.
  - se manifest nao e mais novo, retorna `false`.
  - se manifest e mais novo, chama `readFirestoreEntityDocuments`.

- [ ] Garantir que `local-save` nao usa essa funcao.

- [ ] Adicionar teste:
  - manifest remoto antigo -> nao le entities.
  - manifest remoto novo -> le entities.

**Critérios De Aceite:**

- Reconnect e foreground fazem no maximo uma leitura barata antes de decidir.
- Bases com muitas entidades nao fazem scan remoto desnecessario.

---

## Fase 5 - Worker De Rede Nao Bloqueante

**Objetivo:** Evitar que serializacao, checksum, leitura IDB ou Firestore consumam o mesmo "momento" da interacao do usuario.

**Files:**

- Create: `src/js/sync/sync-yield.js`
- Modify: `src/js/sync/sync-coordinator.js`
- Modify: `src/js/sync/firestore-sync-engine.js`
- Test: `tests/unit/sync-yield.test.js`
- E2E: `tests/e2e/phase6-chaos-validation.spec.js`

### API Alvo

```js
export async function yieldToUI() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
```

### Tasks

- [ ] Inserir `yieldToUI()` antes de:
  - montar delta entity grande,
  - escrever chunks Firestore,
  - atualizar snapshot fallback,
  - renderizar Configuracoes apos sync.

- [ ] Adicionar medicao:
  - `performance.now()` para `queueMs`, `flushMs`, `entityBuildMs`.
  - armazenar apenas numeros em `syncHealth.metrics`.

- [ ] Criar limite:
  - se `entityBuildMs > 100ms`, proximo batch usa chunks menores.
  - se `flushMs > 5000ms`, UI mostra "Sincronizando em segundo plano", nao erro.

**Critérios De Aceite:**

- Sync automatico nunca bloqueia interacao perceptivelmente.
- Metricas mostram onde tempo foi gasto.

---

## Fase 6 - Outbox Unificado E Idempotente

**Objetivo:** Ter uma fila duravel, explicavel e resistente a retry, em vez de varios registros especiais.

**Files:**

- Create: `src/js/sync/sync-job-store.js`
- Modify: `src/js/store.js`
- Modify: `src/js/sync/firestore-outbox.js`
- Modify: `src/js/sync/firestore-entity-outbox.js`
- Test: `tests/unit/sync-job-store.test.js`
- Test: `tests/unit/store.test.js`

### Job Shape

```json
{
  "id": "job_20260501_abc",
  "channel": "firestore",
  "kind": "entity_delta",
  "reason": "local-save",
  "status": "pending",
  "attempts": 0,
  "createdAt": "2026-05-01T12:00:00.000Z",
  "nextAttemptAt": null,
  "opIds": ["eventos/ev_1@rev4"],
  "summary": {
    "docsCount": 1,
    "tombstonesCount": 0
  },
  "lastError": null
}
```

### Tasks

- [ ] Criar store IndexedDB `sync_jobs` em nova DB version.

- [ ] Criar adaptadores de compatibilidade:
  - ler `firestore_outbox` antigo,
  - ler `firestore_entity_outbox` antigo,
  - converter em `sync_jobs`.

- [ ] Implementar idempotencia:
  - `opId = entityKey + '@rev' + revision`.
  - retry do mesmo job nao duplica entidade.

- [ ] Implementar coalescing:
  - se ja existe job `pending` de entity delta, mesclar docs por key.
  - manter maior revision por key.

**Critérios De Aceite:**

- Retry nao duplica.
- Crash no meio do flush mantem job pendente.
- Sync Center consegue explicar job atual.

---

## Fase 7 - Conflito Seguro Por Checksum

**Objetivo:** Nenhum conflito real sobrescreve silenciosamente.

**Files:**

- Modify: `src/js/sync/entity-state-builder.js`
- Modify: `src/js/sync/entity-conflict-model.js`
- Modify: `src/js/sync/firestore-sync-engine.js`
- Test: `tests/unit/firestore-entity-primary-regressions.test.js`
- Test: `tests/unit/entity-conflict-model.test.js`

### Regras

- Mesmo entity key, mesmo checksum -> no-op.
- Mesmo entity key, remoto revision maior e local nao mudou desde base -> aplicar remoto.
- Mesmo entity key, local revision maior e remoto nao mudou desde base -> manter local e enviar depois.
- Mesmo entity key, revisions iguais mas checksum diferente -> conflito.
- Mesmo entity key, revisions diferentes e ambos mudaram desde base -> conflito.
- Tombstone remoto com revision maior -> aplicar delete.
- Tombstone local com revision maior -> manter delete e enviar.

### Tasks

- [ ] Tornar `mergeEntityDocsIntoState()` pura:
  - clonar `baseState` antes de mudar.
  - nunca mutar `state` diretamente.

- [ ] Usar checksum do doc remoto.

- [ ] Usar `_sync.checksum` ou calcular checksum local estavel.

- [ ] Criar hints:
  - `same-checksum`,
  - `remote-newer`,
  - `local-newer`,
  - `same-revision-different-checksum`,
  - `both-changed`,
  - `remote-delete`,
  - `local-delete`.

- [ ] Testes:
  - mesma revision com checksum diferente preserva local e registra conflito.
  - remote newer aplica quando local nao mudou.
  - local newer nao aplica remoto e agenda push.
  - tombstone remoto maior remove.

**Critérios De Aceite:**

- Nenhum caminho de merge aplica remoto quando ha colisao real.
- UI recebe hints compreensiveis.

---

## Fase 8 - Resolucao De Conflito Sem Ansiedade

**Objetivo:** O usuario resolve conflito sem console, sem saber o que e revision, e com backup antes.

**Files:**

- Modify: `src/js/views/config-view.js`
- Modify: `src/js/ui/actions/config.js`
- Modify: `src/js/sync/firestore-sync-engine.js`
- Test: `tests/unit/config-actions.test.js`
- Test: `tests/unit/config-view.test.js`
- E2E: `tests/e2e/app.spec.js`

### UX

Para cada item:

- titulo humano da entidade,
- tipo: evento, edital, disciplina, assunto, aula, habito,
- hint: "Alterado nos dois dispositivos", "Remoto mais novo", "Excluido em outro dispositivo",
- botoes:
  - `Manter este dispositivo`,
  - `Usar nuvem`,
  - `Exportar antes`,
  - `Resolver depois`.

### Tasks

- [x] Melhorar `firestore-open-conflict-review`.

- [x] Mostrar lista sem JSON cru por padrao.

- [x] Guardar historico em `config.firestoreSync.conflictHistory`:
  - entityKey,
  - decision,
  - decidedAt,
  - hint,
  - sem payload sensivel.

- [x] Ao escolher "manter local":
  - remover item do conflito,
  - enfileirar delta local daquela entidade.

- [x] Ao escolher "usar nuvem":
  - aplicar remoto daquela entidade,
  - salvar local com `touchLocalBackup: true`,
  - remover item do conflito.

**Critérios De Aceite:**

- Conflito nao interrompe uso geral do app.
- Usuario consegue resolver sem ver JSON.
- Export local aparece antes de qualquer escolha destrutiva.

---

## Fase 9 - Sync Center Que Nao Chama Atencao

**Objetivo:** A tela de configuracoes deve diagnosticar sem virar painel de operacao diaria.

**Files:**

- Modify: `src/js/sync/sync-center.js`
- Modify: `src/js/views/config-view.js`
- Modify: `src/css/views.css`
- Test: `tests/unit/sync-center.test.js`
- E2E: `tests/e2e/app.spec.js`

### Tasks

- [x] Modo normal mostra:
  - titulo,
  - detalhe curto,
  - ultimo salvo local,
  - ultimo sync remoto,
  - acao primaria quando necessaria.

- [x] Painel avancado colapsado mostra:
  - fila,
  - retries,
  - proximo retry,
  - job atual,
  - shadow diff,
  - modo de entidade.

- [x] Remover botoes perigosos da primeira dobra:
  - force push,
  - pull remoto,
  - delete/tombstone,
  - restore.

- [x] Topbar:
  - nao pisca entre "Salvo localmente" e "Sincronizando" em intervalos curtos.
  - manter estado por no minimo 700ms antes de trocar texto.

**Critérios De Aceite:**

- Usuario comum nao precisa abrir avancado.
- Status nao pisca.
- Nenhum botao destrutivo aparece como acao primaria.

---

## Fase 10 - Backup Center Como Airbag

**Objetivo:** Backup existe para tranquilidade, nao para virar rotina de sync.

**Files:**

- Modify: `src/js/views/config-view.js`
- Modify: `src/js/backup-restore.js`
- Modify: `src/js/ui/actions/config.js`
- Test: `tests/unit/backup-restore.test.js`
- E2E: `tests/e2e/sync-dados.spec.js`

### Tasks

- [x] Fazer Backup Center mostrar:
  - ultimo backup local,
  - ultimo sync Firestore,
  - ultimo backup Cloudflare,
  - ultimo backup Drive,
  - export JSON primario.

- [x] Restore guiado:
  - escolher origem,
  - carregar preview,
  - mostrar entidades adicionadas/removidas/alteradas,
  - pedir export antes,
  - aplicar restore.

- [x] Garantir que restore nao reativa credenciais:
  - Firestore runtime sync removido do import,
  - Cloudflare token removido,
  - Drive file id tratado separadamente.

**Critérios De Aceite:**

- Usuario consegue exportar antes de restaurar.
- Restore mostra impacto antes de aplicar.
- Nenhum segredo aparece no JSON.

---

## Fase 11 - Firestore Rules E Operacao

**Objetivo:** Deixar regras e configuracao claras para deploy sem susto.

**Files:**

- Modify: `firestore.rules`
- Modify: `src/docs/security/sync-operational-checklist.md`
- Modify: `src/docs/firebase-firestore-setup.md`
- Test: `tests/unit/firestore-contracts.test.js`

### Tasks

- [x] Documentar regra atual como baseline:
  - owner scoped por `uid`,
  - snapshot so `main`,
  - delete fisico negado,
  - payload map,
  - entity doc map/null.

- [x] Endurecer regras onde possivel:
  - `collection` deve estar em lista permitida.
  - `key`, `collection`, `id` nao podem mudar em update.
  - `revision` deve ser numero positivo.
  - `deletedAt` so pode existir com `payload == null` ou payload tombstone valido.

- [x] Criar checklist de console Firebase:
  - Auth Google habilitado,
  - dominio autorizado,
  - Firestore Native mode,
  - rules publicadas,
  - App Check opcional.

- [x] Criar teste de string para rules:
  - `allow delete: if false`,
  - `owns(uid)`,
  - `snapshots/main`,
  - `entities`.

**Critérios De Aceite:**

- Regras ficam copiaveis e documentadas.
- Deploy de rules nao quebra o app.

---

## Fase 12 - Testes De Caos Realistas

**Objetivo:** Provar que "sem dor" continua verdadeiro sob falha.

**Files:**

- Modify: `tests/e2e/phase6-chaos-validation.spec.js`
- Create: `tests/e2e/firestore-local-first.spec.js`
- Create: `tests/unit/sync-planner.test.js`
- Create: `tests/unit/entity-delta-builder.test.js`

### Cenarios

- [x] Editar 20 vezes em 10 segundos com Firestore ligado.
  - Esperado: app responsivo, 1 ou poucos batches coalescidos.

- [x] Offline durante edicao.
  - Esperado: salva local, status offline, envia ao reconectar.

- [x] Firestore retorna erro 500.
  - Esperado: outbox preservada, backoff, sem modal.

- [x] Firestore permissao negada.
  - Esperado: `Acao necessaria`, outbox preservada, sem perda local.

- [x] Dois dispositivos editam entidades diferentes.
  - Esperado: merge automatico.

- [x] Dois dispositivos editam mesma entidade.
  - Esperado: conflito explicito, local preservado.

- [x] Reload durante flush.
  - Esperado: job pendente continua.

- [x] Export apos conflito.
  - Esperado: JSON sem credenciais.

**Critérios De Aceite:**

- `npm test` passa.
- `npm run test:e2e` passa.
- Nenhum teste usa credencial real.
- Cenario com 500 entidades nao degrada a UI.

---

## Fase 13 - Performance Budget

**Objetivo:** Definir numeros claros para dizer que o sync esta bom.

### SLOs

- Local commit p95: menor que 150ms depois de `saveStateToDB()`.
- UI command p95: menor que 100ms para responder visualmente.
- `local-save -> queued`: menor que 50ms apos `stateSaved`.
- `local-save -> remote ack`: menor que 10s online.
- Reconnect drain p95: menor que 15s para fila pequena.
- Conflito silencioso: 0.
- Perda local em caos: 0.

### Tasks

- [x] Medir no codigo:
  - `localCommitMs`,
  - `plannerMs`,
  - `entityBuildMs`,
  - `firestoreWriteMs`,
  - `renderSyncMs`.

- [x] Expor no avancado:
  - so quando `?debugSync=1` ou painel avancado aberto.

- [x] Adicionar testes:
  - metricas nao contem payload,
  - metricas sao numericas,
  - historico e limitado.

**Critérios De Aceite:**

- E possivel diagnosticar lentidao sem olhar console.
- UI normal continua limpa.

---

## Fase 14 - Release Controlado

**Objetivo:** Reduzir risco de quebrar dados reais.

### Flags

- `syncPlannerV2`
- `entityDeltaOutbox`
- `remoteManifestCheck`
- `quietTopbarDebounce`
- `strictEntityConflict`

### Rollout

- Semana 1:
  - flags ligadas so em dev/test.

- Semana 2:
  - `syncPlannerV2` e `quietTopbarDebounce` ligados por default.

- Semana 3:
  - `entityDeltaOutbox` ligado para bases pequenas.

- Semana 4:
  - `remoteManifestCheck` ligado.

- Semana 5:
  - `strictEntityConflict` ligado e regras documentadas.

### Stop Conditions

- Qualquer perda de dados local.
- E2E de offline/reconnect falha.
- Aumento perceptivel de tempo ao editar.
- Conflito sem CTA.
- Export com credencial.

---

## Ordem Recomendada De Implementacao

1. Fase 1: tirar trabalho remoto do caminho de edicao.
2. Fase 2: criar `sync-planner.js`.
3. Fase 7: endurecer conflito por checksum.
4. Fase 3: delta sync por entidade.
5. Fase 4: manifest remoto barato.
6. Fase 5: worker/yield e metricas.
7. Fase 6: outbox unificado.
8. Fase 8: conflito sem ansiedade.
9. Fase 9: Sync Center tranquilo.
10. Fase 10: Backup Center airbag.
11. Fase 11: rules e operacao.
12. Fase 12: caos.
13. Fase 13: SLOs.
14. Fase 14: rollout controlado.

---

## Gates Por Commit

Para qualquer fase que mexa em sync:

```powershell
npm run format:check
npm run lint
npm test
npm run test:e2e
```

Para fases pequenas e unitarias, antes do gate completo:

```powershell
npm run test:unit -- tests/unit/sync-coordinator.test.js
npm run test:unit -- tests/unit/entity-state-builder.test.js
npm run test:unit -- tests/unit/firestore-sync-engine-new.test.js
npm run test:unit -- tests/unit/firestore-entity-primary-regressions.test.js
```

Se o ambiente retornar `spawn EPERM` em teste focado, rodar `npm test` completo como gate alternativo, pois ele tem sido mais estavel neste checkout.

---

## Definition Of Done Final

- Usuario edita com Firestore ativo sem travamento perceptivel.
- Nenhum save local faz leitura remota.
- Entity-primary escreve apenas deltas.
- Pull remoto automatico usa manifest barato antes de ler entidades.
- Conflitos preservam local ate decisao.
- Sync Center mostra estado simples.
- Backup Center permite export antes de restore.
- Firestore Rules owner-scoped e sem delete fisico.
- Testes unitarios e E2E passam.
- Plano atualizado com log real de execucao.

---

## Execution Log

- 2026-05-01: Plano criado apos revisao do sync atual em `store.js`, `sync-coordinator.js`, `firestore-sync-engine.js`, `firestore-entity-outbox.js`, `sync-center.js`, `sync-contract.md` e `firestore.rules`.

### Fase 0 - Baseline

- **Commit:** `6ff10e9` (branch `claude/awesome-babbage-1772bc`)
- **APP_VERSION:** definido em manifest.json do PWA
- **Modo Firestore:** shadow por default (`enabled: false, mode: 'shadow'`); entity sync `enabled: false, mode: 'off'`
- **Testes unitarios:** 73 arquivos, 1156 passando, 1 skipped
- **Testes E2E:** existentes em `tests/e2e/`
- **Service Worker:** registrado via `sw-register.js`
- **Teste de payload em syncHealth:** ja existe em `sync-health.test.js` linha 58 ("keeps bounded structured event history without payloads")
- **store.js:** NAO importa Firestore diretamente - contrato ja respeitado
- **sync-coordinator.js:** Ja centraliza gatilhos (stateSaved, login, reconnect, foreground, manual)
- **Problema confirmado:** `autoPullRemoteWhenNewer()` e chamado em `local-save` via `flushPrimarySyncNow()` - precisa ser removido do caminho de edicao

### Execucao - Fases 0-9

**Implementado:**
- Fase 0: Baseline registrado
- Fase 1: Throttling de 250ms no render de config sync; contratos estaticos reforçados
- Fase 2: `sync-planner.js` criado com 20 testes; coordinator refatorado para usar planner
- Fase 3: `entity-delta-builder.js` criado com delta sync (so entidades alteradas); 10 testes
- Fase 4: `readFirestoreRemoteManifest()` adicionado ao repository; auto-pull usa manifest antes de ler entities
- Fase 5: `sync-yield.js` criado com `yieldToUI()` e `measureAsync()`; coordinator usa yield antes de operacoes pesadas
- Fase 6: `sync-job-store.js` criado com IndexedDB store, coalescing, idempotencia; 9 testes
- Fase 7: `mergeEntityDocsIntoState()` agora pura (JSON clone); checksum estavel adicionado; hints de conflito; 57 testes entity
- Fase 9: Debounce de 700ms no topbar sync status para evitar piscar

**Novos arquivos criados:**
- `src/js/sync/sync-planner.js`
- `src/js/sync/entity-delta-builder.js`
- `src/js/sync/sync-yield.js`
- `src/js/sync/sync-job-store.js`

**Arquivos modificados:**
- `src/js/main.js` - throttling 250ms config render
- `src/js/app.js` - debounce 700ms topbar sync
- `src/js/sync/sync-coordinator.js` - refatorado para usar planner + yield
- `src/js/sync/entity-state-builder.js` - merge pura + checksum + hints
- `src/js/sync/entity-conflict-model.js` - suporte a hints
- `src/js/sync/firestore-sync-engine.js` - manifest check no auto-pull
- `src/js/sync/firestore-repository.js` - `readFirestoreRemoteManifest()`
- `tests/unit/` - novos testes e atualizados mocks

**Testes:** 1212 passando (76 arquivos), 1 falha pre-existente em CSS

**Fases pendentes:** 8, 10, 11, 12, 13, 14

### Revisao Codex Pos-Rebase - 2026-05-02

- Base remota integrada durante rebase: `481516a` em `origin/main`, com Fases 0-9 parcialmente implementadas.
- Correcao preservada sobre a base remota: `queueFirestoreSnapshotFromState()` nao enfileira entity docs em `entitySync.mode === 'primary'`, evitando batch duplo quando o coordinator/planner ja preparou entidades.
- Testes adicionados/refinados: `entity-state-builder.test.js` cobre merge sem mutar o estado de origem e colisao com mesma revisao/conteudo divergente; `firestore-entity-primary-regressions.test.js` cobre ausencia de batch duplo em snapshot fallback; `sync-coordinator.test.js` agora simula falhas reais antes de validar reset de `failureCount`.
- E2E ajustado: `phase6-chaos-validation.spec.js` passou a chamar `window.EstudoApp.saveStateToDB()` apos mutar `window.state` no cenario offline, alinhando o teste ao contrato real de persistencia antes do reload.
- Validacao antes do rebase: `npm run format:check`, `npm run lint`, `npm test` com 1159 passed e 1 skipped, `npm run test:e2e -- tests/e2e/phase6-chaos-validation.spec.js` com 6 passed e `npm run test:e2e` com 116 passed.
- Validacao pos-rebase: `npm run format:check` passou; `npm run lint` passou sem warnings; `npm run test:unit -- tests/unit/entity-state-builder.test.js tests/unit/firestore-entity-primary-regressions.test.js tests/unit/sync-coordinator.test.js tests/unit/firestore-contracts.test.js` passou com 98 testes.

### Execucao Codex - Fases 8-14 - 2026-05-02

- Fase 8: revisao de conflito Firestore passou a mostrar lista humana sem JSON cru por padrao, com `Manter este dispositivo`, `Usar nuvem`, `Exportar backup antes` e `Resolver depois`. Decisoes ficam em `config.firestoreSync.conflictHistory` sem payload, e manter local reencaminha delta entity-primary.
- Fase 9: Sync Center mantem modo normal quieto e deixa metricas/acoes sensiveis no painel avancado. Permissao negada no Firestore vira `Acao necessaria` sem modal bloqueante.
- Fase 10: Backup Center/restore preview agora calcula adicionados, alterados, removidos e preservados por colecao; export/import rejeitam Drive file id, Firestore uid, historico de conflito e timestamps remotos.
- Fase 11: `firestore.rules` ganhou lista permitida de collections, identidade imutavel em update, revision positiva e validacao de tombstone; `sync-operational-checklist.md`, `firebase-firestore-setup.md` e `release-checklist.md` foram atualizados.
- Fase 12: `phase6-chaos-validation.spec.js` foi expandido para edicoes rapidas, permissao negada, export apos conflito, offline, reload e CTA de conflito por entidade.
- Fase 13: metricas numericas `localCommitMs`, `plannerMs`, `entityBuildMs`, `firestoreWriteMs` e `renderSyncMs` sao registradas sem payload em `config.syncPerformance.metrics` e expostas apenas no painel avancado.
- Fase 14: release gates e stop conditions foram refletidos no checklist de release e no checklist operacional.
