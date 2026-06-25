# Plano de Implementacao: Zero-Friction Data & Sync Hardening

## Contexto

O Estudo Organizado tem um sistema de sync complexo com 4 canais (IndexedDB local, Firebase Firestore, Cloudflare KV, Google Drive). Apesar da base sólida, existem lacunas que impedem sync "zero friccao": race conditions no salvamento local, conflito manual excessivo, entity-primary marcado como experimental, e gaps de teste. Este plano endurece o salvamento local, estabiliza entity-primary, unifica resolucao de conflito e adiciona backup automatizado.

---

## Fase 1: Salvamento Local Seguro (P0 - Bug Fixes)

### 1.1 `stateSaved` so dispara apos IndexedDB commit

**Arquivo:** `src/js/store.js` (lines 650-673)

**Problema:** O evento `stateSaved` é despachado nos callbacks `onsuccess` individuais (`currentWrite.onsuccess` e `legacyWrite.onsuccess`), ANTES do `transaction.oncomplete`. O sync coordinator ouve `stateSaved` e pode iniciar push remoto antes que a transacao IndexedDB tenha commitado. Se a transacao abortar entre os writes, o sync envia dados que nao foram salvos localmente.

**Fix:**
- Mover o dispatch de `stateSaved` para `transaction.oncomplete`
- Guardar referencias aos writes e so despachar apos `completed === 2` (atual) + `transaction.oncomplete`
- Se `transaction.abort` ou `transaction.error`, nao despachar `stateSaved`

```js
// Line ~651: replace the finish() pattern
let completed = 0;
const onWritesDone = () => {
  completed++;
  if (completed < 2) return;
};
currentWrite.onsuccess = onWritesDone;
legacyWrite.onsuccess = onWritesDone;

transaction.oncomplete = () => {
  document.dispatchEvent(new CustomEvent('stateSaved', { detail: {...} }));
  if (emitUserSaveStatus) emitSaveStatus('saved');
  resolve();
};
```

### 1.2 Save coalescing — evita transacoes concorrentes

**Arquivo:** `src/js/store.js` (lines 549-584, 594-693)

**Problema:** `scheduleSave()` usa debounce de 2s mas nao ha flag `saveInProgress`. Se o usuario fazer mutacoes rapidas enquanto uma transacao esta em andamento, pode haver multiplos `saveStateToDB()` competindo.

**Fix:**
- Adicionar flag `isSaving = false` em module scope
- Em `saveStateToDB()`: se `isSaving === true`, retornar `Promise.resolve()` (o estado ja foi atualizado no objeto `state` mutavel, o save em progresso pega a versao mais recente)
- Em `transaction.oncomplete` e `transaction.onerror`, setar `isSaving = false`
- Reduzir debounce de 2000ms para 1000ms (com coalescing, saves duplicados nao ocorrem)

### 1.3 `navigator.storage.persist()` no boot

**Arquivo:** `src/js/store.js` (line 286, `initDB()`)

**Fix:** Adicionar chamada a `navigator.storage.persist()` apos sucesso do `db open`. Reduz risco de evicccao do navegador (especialmente Chrome que pode limpar IndexedDB apos inatividade).

---

## Fase 2: Entity-Primary Stabilization (P1)

### 2.1 Auto shadow verification apos entity flush

**Arquivos:**
- `src/js/sync/firestore-sync-engine.js` (lines 479-498, `flushFirestoreEntityOutbox`)
- `src/js/sync/sync-center.js` (line 228)

**Problema:** Entity-primary e tratado como experimental. Nao ha verificacao automatica apos o flush de entidades — o usuario precisa clicar "Verificar entidades" manualmente.

**Fix:**
- Em `flushFirestoreEntityOutbox()`, apos sucesso (`markFirestoreEntityBatchSynced`), executar `compareSnapshotManifestToEntityDocs()` automaticamente
- Se manifest match: setar `entitySync.shadowVerifiedAt = Date.now()` e atualizar label do sync-center para "Entidades primarias ativas. Snapshot mantido como seguranca."
- Se divergente: trigger snapshot push como fallback, setar `entitySync.lastShadowDiff` com detalhes do diff
- Expor `shadowVerifiedAt` no sync center UI com timestamp legivel

### 2.2 Auto-resolucao de conflitos seguros

**Arquivos:**
- `src/js/sync/entity-state-builder.js` (collision detection)
- `src/js/sync/firestore-sync-engine.js` (lines 1202-1291, `resolveEntityConflict`)

**Problema:** Toda colisao (`both-changed`, `same-revision-different-checksum`, `remote-delete`, etc.) trava o sync e exige resolucao manual usuario por usuario. Muitos casos sao seguros para auto-resolver.

**Fix:**
- Criar funcao `autoResolveSafeConflicts(collisions)` em um novo modulo `src/js/sync/entity-conflict-model.js`:
  - `remote-delete` + remote revision > local revision → auto-resolve "remote" (delecao intencional de outro device)
  - `local-delete` + local revision > remote revision → auto-resolve "local" (delecao local mais recente)
  - `remote-newer` + local tem `hasPendingWrites === false` → auto-resolve "remote" (remote e claramente mais recente)
- Apenas `same-revision-different-checksum` e `both-changed` com revisoes iguais exigem revisao manual
- Atualizar `resolveEntityConflict()` para aceitar array de decisoes em batch

### 2.3 Sync incremental por entidade

**Arquivo:** `src/js/sync/firestore-entity-outbox.js`

**Problema:** Todo sync de entidade envia TODAS as entidades, nao apenas as alteradas. Para datasets grandes (>1000 entidades), isso gera muitos reads/writes desnecessarios no Firestore (limitacao do Spark plan).

**Fix:**
- Usar `entity_meta` store (ja existe em `store.js` line 18) para rastrear quais entidades mudaram desde o ultimo sync
- Criar `queueFirestoreEntityDiff()` que:
  - Compara `entity_meta.checksum` com checksum dos documentos remotos (do ultimo sync)
  - So fila entidades com checksum diferente + novos tombstones
- Manter `queueFirestoreEntityBatchFromState()` como fallback full-push (usado em force sync)

---

## Fase 3: Sync Effectiveness (P2)

### 3.1 Service Worker Background Sync API

**Arquivos:**
- `src/js/sw.js` (adicionar event listener)
- `src/js/sync/sync-coordinator.js` (adicionar registracao)

**Problema:** Sync apos reconexao so funciona se o app estiver em um tab foreground. Se usuario vai offline, faz alteracoes, fecha o tab, reconecta — sync so ocorre quando reabre o app.

**Fix:**
- Adicionar em `sw.js`:
  ```js
  self.addEventListener('sync', (event) => {
    if (event.tag === 'estudo-primary-sync') {
      event.waitUntil(flushOutboxFromSW());
    }
  });
  ```
- Em `sync-coordinator.js`, no `initSyncCoordinator()`, registrar:
  ```js
  if ('sync' in navigator.serviceWorker) {
    navigator.serviceWorker.ready.then(reg => {
      reg.sync.register('estudo-primary-sync');
    });
  }
  ```
- Progressive enhancement: se Background Sync nao disponivel, fallback para `online`/`visibilitychange` (comportamento atual)

### 3.2 Indicador de progresso granular

**Arquivos:**
- `src/js/sync/sync-health.js` (adicionar campo `progress`)
- `src/js/app.js` (lines 116-167, topbar status)

**Problema:** Topbar mostra "Sincronizando" sem detalhes. Sem progresso por entidade, sem distincao entre "na fila" vs "transferindo".

**Fix:**
- Em `flushFirestoreOutbox()`, emitir evento `sync:entityProgress` por batch com `{ current, total, percentage }`
- Em `sync-health.js`, adicionar `progress` ao health state
- Topbar mostra "Syncing 23/45 entidades" ao inves de so "Sincronizando"

### 3.3 Unificacao de modelo de conflito Cloudflare/Drive

**Arquivos:**
- `src/js/cloud-sync.js` (lines 291-310, 409 handling)
- `src/js/drive-sync.js` (lines 253-291, timestamp conflict)

**Problema:** Cada canal tem modelo diferente de conflito: Cloudflare = 409 + generic toast, Drive = timestamp + modal confirm, Firestore = entity-level per-entity resolution.

**Fix:**
- Usar `autoResolveSafeConflicts()` (Fase 2.2) para todos os canais
- Cloudflare 409: ao inves de generic toast, calcular entity diff e mostrar o mesmo modal de conflito do Firestore
- Drive timestamp: usar `mergeStudyStates()` (Fase 2.2) como caminho de merge, nao so modal de confirmacao

---

## Fase 4: Backup & Recovery (P2)

### 4.1 Backup local automatizado com rotacao

**Arquivo:** `src/js/store.js`

**Problema:** So ha double-buffer (current/previous). Nao ha historico versionado para point-in-time recovery.

**Fix:**
- Novo IndexedDB store `state_backups` (keyPath: `id` = ISO timestamp)
- A cada `saveStateToDB()` com `touchLocalBackup: true`, criar entrada em `state_backups`
- Rotacao: 7 diarios + 4 semanais + 12 mensais = max 23 snapshots
- Cada snapshot: ~50-200KB JSON. Max uso: ~4.6MB. Dentro da quota do navegador.
- Expor backups no Backup Center UI com datas, contagens por colecao, e botao "Restaurar este ponto"

### 4.2 Health monitoring de canais cloud

**Arquivo:** `src/js/sync/sync-center.js`

**Problema:** Token expirado, permissao revogada, ou erro de autenticacao so sao descobertos quando usuario tenta sync manual.

**Fix:**
- Health check periodico (a cada 30 min, so se app aberto):
  - Firestore: `getDoc` leve no snapshot metadata. Se auth falha → "Token expirado"
  - Cloudflare: `GET` no endpoint KV. Se 401 → "Token invalido"
  - Drive: `files.get` com campos minimais. Se 401 → "Reautorizar necessario"
- Resultado em `state.config.backupHealth` com timestamp e status
- Indicador sutil no Backup Center quando canal saudavel ≠ ok

### 4.3 Point-in-time recovery timeline

**Arquivo:** `src/js/sync/sync-center.js` + UI em `src/js/views/config-view.js`

**Problema:** Usuario so pode restaurar do snapshot cloud mais recente ou JSON exportado manualmente. Nao ha forma facil de voltar para "estado de ontem".

**Fix:**
- Combinar backups locais (4.1) com timestamps cloud em uma timeline visual no Backup Center
- "Hoje 14:32 | Ontem 09:15 | 3 dias atras | Semana passada"
- Cada ponto: contagem de entidades + botao "Preview das alteracoes"
- Backups cloud (Firestore/Cloudflare/Drive) aparecem como pontos adicionais na timeline

---

## Fase 5: Testes Criticos (P3)

### 5.1 Testes de concorrencia IndexedDB

**Novo arquivo:** `tests/unit/store-concurrency.test.js`
- Dois `saveStateToDB()` rapidos nao corrompem double-buffer
- `saveStateToDB` durante save in-flight coalesces corretamente
- Transaction abort nao deixa `current` e `previous` invalidos
- Recovery: current corrompido → fallback para previous
- Recovery: ambos invalidos → fallback para legacy/emergency

### 5.2 Testes de race condition `stateSaved`

**Novo arquivo:** `tests/unit/save-event-race.test.js`
- `stateSaved` so dispara apos `transaction.oncomplete` (nao apos write individual)
- Multiplas mutacoes rapidas: so um `stateSaved` por ciclo de save
- Handler `stateSaved` que dispara cloud sync nao causa save re-entrante

### 5.3 Testes de shadow verification

**Novo arquivo:** `tests/unit/entity-shadow-verification.test.js`
- `compareSnapshotManifestToEntityDocs` retorna `ok: true` quando match
- Detecta entidades ausentes, extras, revisoes diferentes
- Auto-verification: apos flush, `shadowVerifiedAt` atualizado
- Divergencia: trigger snapshot fallback

### 5.4 Testes de tombstone lifecycle

**Novo arquivo:** `tests/unit/tombstone-lifecycle.test.js`
- `pruneTombstones` remove > 180 dias
- `pruneTombstones` cap em 500
- Tombstones incluidos no entity outbox
- Tombstone replay: remote tombstone remove entidade local

### 5.5 Testes de `mergeStudyStates`

**Novo arquivo:** `tests/unit/merge-study-states.test.js`
- Merge sem overlapping = union
- Merge com IDs identicos (mesmo checksum) = single copy
- Merge com IDs diferentes = collision
- Merge de habitos preserva todos os tipos
- Collision limit: max 20 items

---

## Arquivos Criticos a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `src/js/store.js` | 1.1, 1.2, 1.3, 4.1 |
| `src/js/sync/firestore-sync-engine.js` | 2.1, 2.2 |
| `src/js/sync/entity-state-builder.js` | 2.2 |
| `src/js/sync/entity-conflict-model.js` | 2.2 (novo) |
| `src/js/sync/firestore-entity-outbox.js` | 2.3 |
| `src/js/sync/sync-coordinator.js` | 3.1 |
| `src/js/sync/sync-health.js` | 3.2 |
| `src/js/sync/sync-center.js` | 4.2, 4.3 |
| `src/js/cloud-sync.js` | 3.3 |
| `src/js/drive-sync.js` | 3.3 |
| `src/js/sw.js` | 3.1 |
| `src/js/views/config-view.js` | 4.3 |
| `src/js/backup-restore.js` | 4.3 (preview de backups locais) |

## Arquivos de Teste Novos

| Arquivo | Fase |
|---------|------|
| `tests/unit/store-concurrency.test.js` | 5.1 |
| `tests/unit/save-event-race.test.js` | 5.2 |
| `tests/unit/entity-shadow-verification.test.js` | 5.3 |
| `tests/unit/tombstone-lifecycle.test.js` | 5.4 |
| `tests/unit/merge-study-states.test.js` | 5.5 |

## Ordem de Implementacao

1. **Fase 1** (1.1, 1.2, 1.3) — Bug fixes locais, sem dependencia externa
2. **Fase 2** (2.1, 2.2, 2.3) — Estabiliza entity-primary
3. **Fase 3** (3.1, 3.2, 3.3) — Sync effectiveness
4. **Fase 4** (4.1, 4.2, 4.3) — Backup & recovery
5. **Fase 5** (5.1-5.5) — Testes para todas as fases

## Verificacao

- `npm test` — todos os testes unitarios passam
- `npm run test:e2e` — E2E tests passam (persistence, sync simulation, chaos)
- Teste manual: abrir 2 abas, fazer alteracoes em ambas, verificar sync sem conflito manual
- Teste manual: ir offline, fazer 20 edits, reconectar, verificar sync completo
- Teste manual: forcar crash (fechar tab mid-save), reabrir, verificar recovery de double-buffer
- Verificar Firebase Spark plan usage: reads/writes por sync incremental reduzidos vs full-push
