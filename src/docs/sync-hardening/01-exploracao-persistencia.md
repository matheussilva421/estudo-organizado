# Exploracao: Persistencia de Dados Local

**Analise do sistema de persistencia local (store.js) — Maio 2026**

---

## Arquitetura de Persistencia

### Estado Global

O app usa um unico objeto `state` mutavel em module scope, com `schemaVersion: 9`. Collections principais:
- `editais` (concursos → disciplinas → assuntos/aulas)
- `eventos` (eventos de estudo com timers)
- `arquivo` (eventos arquivados > 90 dias)
- `habitos` (9 tipos: questoes, revisao, discursiva, simulado, leitura, informativo, sumula, videoaula, paginas)
- `revisoes` (agenda de revisoes espaçadas)
- `config` (theme, metas, freqRevisao, pomodoro, sync creds, entity tombstones)
- `planejamento` (ciclo/grade semanal)
- `bancaRelevance` (cache NLP)

### IndexedDB Structure

- **DB:** `EstudoOrganizadoDB` (version 6)
- **Stores:**
  - `app_state` — double-buffer envelope (current/previous/legacy)
  - `firestore_outbox` — pending Firestore snapshot writes
  - `firestore_meta` — sync metadata (remoteUpdatedAt, lastPullAt)
  - `firestore_conflicts` — entity conflict records
  - `entity_meta` — local entity index (checksum, revision per entity)
  - `firestore_entity_outbox` — pending entity batch writes

### Double-Buffer Envelope

```js
{
  version: 1,
  slot: 'current' | 'previous',
  schemaVersion: 9,
  savedAt: 'ISO timestamp',
  checksum: 'FNV-1a hash',
  payload: { /* full state */ }
}
```

- `current` — ultima versao salva com sucesso
- `previous` — snapshot antes do ultimo save (crash recovery)
- `legacy` — formato sem envelope (compatibilidade com usuarios antigos)

Fallback chain: `current → previous → legacy → emergency (localStorage)`

### Salvamento (scheduleSave → saveStateToDB)

1. `scheduleSave()`: debounce de 2000ms, dispara cache invalidation apos 100ms
2. `saveStateToDB()`:
   - Atualiza `state.config.localBackupAt`
   - Opcionalmente prepara `prepareEntityMetadataForSave()`
   - Abre transacao `readwrite` no `app_state`
   - Le `current`, valida envelope, copia para `previous` se valido
   - Escreve novo envelope em `current` + estado bruto em `legacy`
   - Dispara `stateSaved` event apos writes completarem
   - Emite `app:saveStatus` com `saving` / `saved` / `error`

### Emergency Fallback

- `pagehide` listener: salva estado inteiro em `localStorage.estudo_state_emergency`
- `beforeunload` listener: mesmo comportamento + confirm dialog
- Apenas ativo se `saveTimeout !== null` (ha save pendente)

### Migracoes (runMigrations)

Schema v1 → v9. Principais:
- v1→v2: flatten grupos em disciplinas, adiciona IDs
- v3→v4: adiciona ciclo
- v4→v5: adiciona planejamento
- v6→v7: separa assuntos de aulas (regex `aula\s*\d+` ou `modulo\s*\d+`)
- v7→v8: adiciona arquivada flag nas disciplinas
- v8→v9: adiciona `_sync` metadata baseline para entity sync

### Credenciais Isolation

- Banco separado: `EstudoCredenciaisDB` (IndexedDB)
- Store `credentials` — isolado do `EstudoOrganizadoDB`
- `createExportableState()` remove cfUrl, cfToken, cfConflict, driveFileId, lastSync
- `validateBackupPayload()` rejeita imports com tokens, file IDs, ou sync config ativo
