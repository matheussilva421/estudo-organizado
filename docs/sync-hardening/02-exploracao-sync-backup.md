# Exploracao: Sync e Backup Systems

**Analise dos sistemas de sincronizacao e backup — Maio 2026**

---

## Arquitetura Geral (4 Canais)

| Canal | Role | Mode | Auto-Sync |
|-------|------|------|-----------|
| Firebase Firestore | Primario | Entity-primary (com snapshot fallback) | Automatico |
| Cloudflare KV | Secundario | Manual snapshot | Manual |
| Google Drive | Backup | Manual snapshot file | Polling 5min |
| Local IndexedDB | Commit point | Always-on | Automatico |

---

## Modelo de Sync: Hibrido Snapshot + Entity-Versioned

### Snapshot-based (Cloudflare + Drive)

- Cloudflare: envelope versionado com `version`, `deviceId`, `baseRemoteUpdatedAt`, `payloadUpdatedAt`, `sentAt`. Payload = JSON completo do estado.
- Drive: mesmo formato, escreve `estudo-organizado-data.json` via multipart upload.

### Entity-versioned (Firestore — primario)

- Entidades individuais com `_sync` metadata: `createdAt`, `updatedAt`, `deletedAt`, `revision`, `updatedBy`.
- Checksums computados ignorando campos `_sync`. Revisoes incrementam quando conteudo muda.
- Entidades rastreadas: editais, disciplinas, assuntos, aulas, eventos, arquivo, revisoes, habitos.*, planejamento.sequencia.

### Snapshot Fallback Mirror (Firestore)

- Mesmo em modo entity-primary, snapshots sao escritos como fallback.
- `entityManifest` no snapshot envelope mapeia checksums e revisoes de todas as entidades.

---

## Resolucao de Conflito

### Firestore (mais sofisticado)

- **Optimistic concurrency:** ao fazer flush do outbox, le snapshot remoto. Se `baseRemoteUpdatedAt` nao bate, registra conflito.
- **Deteccao por entidade:** classifica colisoes como `remote-delete`, `remote-newer`, `local-newer`, `same-checksum`, `same-revision-different-checksum`, `both-changed`.
- **Resolucao por entidade:** usuario escolhe `local` ou `remote` para cada conflito individualmente. Decisoes registradas em `conflictHistory` (max 50).

### Cloudflare (LWW com 409)

- HTTP 409 quando `baseRemoteUpdatedAt` nao bate → armazena `cfConflict`.
- Sem merge automatico — usuario escolhe entre pull-remote ou force-push-local.
- Rate limit: 30s entre pushes. Mutex `isSyncing` previne operacoes concorrentes.

### Google Drive (timestamp com prompt)

- Se versao Drive e mais recente, mostra modal perguntando se quer fazer merge.
- File deleted remotamente (404) → limpa driveFileId e retry (max 2 recursao).

---

## Comportamento Offline

- **Local-first:** IndexedDB e o commit point. Tudo vai para IndexedDB primeiro.
- `scheduleSave()` debounce 2s → IndexedDB save → eventos `stateSaved` → sync coordinator agenda flush.
- Offline writes acumulam no outbox (IndexedDB) com retry exponential backoff (max 5 min).
- Reconexao: `window.addEventListener('online')` → `flushPrimarySyncWhenAllowed('reconnect')`
- Foreground: `visibilitychange` → flush imediato sem backoff.

---

## Credenciais

- Banco IndexedDB separado (`EstudoCredenciaisDB`) com store `credentials`.
- Cloudflare: `getCredential('cloudflare')` com backward-compat para `state.config.cfUrl`/`cfToken`.
- Drive: `getCredential('drive_client_id')` + OAuth2 com scope `drive.file` (token em memoria).
- Backups rejeitam payloads com tokens, file IDs, conflict history, ou sync config ativo.

---

## Error Handling

- **Exponential backoff:** `delayMs = Math.min(300000, 1000 * 2 ** Math.min(attempts, 8))`
- **Circuit breaker:** 3 falhas consecutivas → status `degraded`. Sucesso reseta para 0.
- **Sync jobs:** transicionam para `status: 'failed'` apos 5 tentativas.
- **UI feedback:**
  - Firestore falha: "Sync aguardando recuperacao" (quiet sync view)
  - Cloudflare 409: painel de conflito com 3 acoes
  - Drive: toast "Erro ao sincronizar com Drive"
  - IndexedDB: toast "ERRO GRAVE: Falha ao salvar"

---

## Backup / Restore

### JSON Export/Import
- UI: botoes "Exportar JSON" e "Importar JSON" em Config.
- `validateBackupPayload()` rejeita tokens, file IDs, conflict history, sync config ativo.
- `previewRestoreImpact()` mostra contagens antes/depois por colecao (added, removed, kept, changed).

### Firestore Restore
- `pullFromFirestore(forceOverwrite)` — force restore ou so se remoto mais recente.

### Cloudflare Restore
- `pullFromCloudflare(forceOverwrite)` — force replace ou smart merge por timestamps.
- `previewCloudflareRestore()` — busca remoto sem aplicar.

### Drive Restore
- `pullFromDrive()` — baixa e substitui.
- `mergeFromDrive()` — mescla remoto com local.
- `previewDriveRestore()` — busca para inspecao.

---

## User Experience

### Bootstrap Sequence
1. IndexedDB carrega (`initDB`)
2. Sync coordinator registra listeners
3. Firebase auth observada
4. UI renderiza imediatamente — usuario pode interagir enquanto sync roda em background
5. Cloudflare pull com timeout 5s em background
6. Drive APIs lazy-loaded se client ID existe. Polling 5min.

### Indicadores de Status
- Topbar: labels mapeadas de Firestore health states ("Tudo salvo", "Sincronizando", "Offline", "Acao necessaria"), debounce 700ms.
- Drive: dot indicator, label, sublabel com ultimo sync, botao acao.
- Sync Center: 4 sources com health status, timestamps, conflict state.
- Quiet Sync View: mensagens amigaveis com tonalidade (ok/pending/warning/danger/idle).

---

## Limitacoes Conhecidas (sync-contract.md)

1. Entity-primary tratado como experimental
2. Snapshots nao podem ser deletados (fallback obrigatorio)
3. `ALLOWED_ORIGINS` permissivo quando omitido
4. Google Drive tem modelo de conflito separado/inconsistente
5. Entity shadow mode exige verificacao manual
