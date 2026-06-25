# Design: Sync Effectiveness & Zero Friction

**Design document — como tornar sync verdadeiramente zero friccao — Maio 2026**

---

## Problema Central

O app salva dados localmente com seguranca, mas o sync remoto ainda exige intervencao do usuario em varios cenarios que poderiam ser auto-resolvidos. Os 4 canais de sync tem modelos de conflito inconsistentes e entity-primary e tratado como experimental quando na verdade ja e funcional.

---

## Design Principles

1. **Local-first sempre** — app funciona perfeitamente sem cloud
2. **Zero data loss** — cada decisao de design reduz risco de perda
3. **Zero friccao** — sync deve funcionar sem intervencao do usuario
4. **Incremental** — mudancas devem ser shipaveis isoladamente
5. **Nao quebrar** — funcionalidade existente continua funcionando

---

## Design: Entidades Primarias Estaveis

### Auto Shadow Verification

Hoje: usuario precisa clicar "Verificar entidades" manualmente.

Depois: apos cada `flushFirestoreEntityOutbox()` bem-sucedido, o sistema executa `compareSnapshotManifestToEntityDocs()` automaticamente:
- Match → `entitySync.shadowVerifiedAt = Date.now()` → UI mostra "Entidades primarias ativas"
- Divergente → snapshot push como fallback → UI mostra detalhes do diff

### Auto-Resolve de Conflitos Seguros

Hoje: toda colisao trava sync e exige resolucao manual.

Depois: sistema auto-resolve casos seguros:
- `remote-delete` + remote revision > local → auto-resolve "remote"
- `local-delete` + local revision > remote → auto-resolve "local"
- `remote-newer` + local sem mudancas pendentes → auto-resolve "remote"

Apenas `same-revision-different-checksum` e `both-changed` com revisoes iguais exigem revisao manual.

### Sync Incremental

Hoje: todo sync envia TODAS as entidades.

Depois: so entidades alteradas sao enviadas:
- `entity_meta` store tem checksum de cada entidade
- `queueFirestoreEntityDiff()` compara com ultimo sync, so fila mudancas
- Full-push so em force sync ou primeiro sync

**Impacto:** Para dataset tipico (~200 entidades, ~5 alterados por sessao):
- Antes: 200 writes + 200 reads por sync
- Depois: 5 writes + 5 reads por sync
- Economia: ~97% menos operacoes Firestore

---

## Design: Background Sync API

Hoje: sync apos reconexao so funciona se app estiver em tab foreground.

Depois: Service Worker faz sync em background:
- `self.addEventListener('sync', ...)` no SW
- `navigator.serviceWorker.ready.then(reg => reg.sync.register('estudo-primary-sync'))` no app
- Progressive enhancement: se nao disponivel, fallback para `online`/`visibilitychange`

**Cenario:** Usuario vai offline, faz edits, fecha browser, reconecta mais tarde. SW detecta background sync event e flusha outbox mesmo sem tab aberto.

---

## Design: Unificacao de Modelo de Conflito

Hoje: cada canal tem modelo diferente.

Depois: todos usam o mesmo pipeline:
1. Tentar auto-resolve (`autoResolveSafeConflicts`)
2. Se restarem conflitos, mostrar modal unificado com:
   - Preview de cada item conflitante
   - Revisions side-by-side
   - Hint: "remote newer" / "local newer" / "tie"
   - Botao "keep local" / "use cloud" por item
   - Botao "apply to all" para decisao em batch

Cloudflare 409 e Drive timestamp conflict passam pelo mesmo fluxo.

---

## Design: Backup Automatizado

Hoje: so double-buffer (current/previous).

Depois: historico versionado com rotacao:
- Novo IndexedDB store `state_backups`
- A cada save local, criar entrada (max 1 por hora para evitar explosion)
- Rotacao: 7 diarios + 4 semanais + 12 mensais = 23 snapshots max
- Max storage: ~4.6MB (23 × ~200KB)
- UI: timeline com datas, contagens, preview, botao restore

**Point-in-time recovery:**
- Usuario abre Backup Center → ve timeline
- Clica em ponto especifico → ve preview de impacto
- Clica "Restaurar" → exporta local atual (auto) → aplica backup → re-sincroniza

---

## Design: Health Monitoring

Hoje: token expirado so descoberto em sync manual.

Depois: health check periodico (30 min):
- Firestore: `getDoc` leve em metadata. Auth fail → "Token expirado"
- Cloudflare: `GET` KV endpoint. 401 → "Token invalido"
- Drive: `files.get` minimal. 401 → "Reautorizar necessario"
- UI: badge sutil no Backup Center com acao direta para corrigir

---

## Design: Progresso Granular

Hoje: topbar mostra "Sincronizando" sem detalhes.

Depois:
- Evento `sync:entityProgress` por batch com `{ current, total, percentage }`
- Topbar: "Syncing 23/45 entidades"
- Sync Center: progresso visual por canal
