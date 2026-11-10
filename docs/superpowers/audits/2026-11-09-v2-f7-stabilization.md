# F7 — estabilização pós-recuperação e validação local final

**Data:** 09/11/2026, atualizada em 10/11/2026
**Branch:** v2
**Base recuperada:** d069bf4f8624cee9b9617131401a5e525eb8d2cf + merge 75079e4e48025a33778ea26895de06b451890eb6
**HEAD de código validado:** eb74f4fb
**Estado:** F7_LOCAL_VALIDATED_FOR_UX / BLOCKED_G-EXT_G-STAGING
**Não é:** F7_ACCEPTED, F7_READY_FOR_HUMAN_REVIEW ou autorização de F8/G5.

## 1. Escopo

Validação local da F7 funcional após a recuperação pós-formatação: auditoria dos nove commits recuperados, correção de falhas materiais reproduzidas, testes no mesmo HEAD, revisão independente pós-correção e preparação da F7-UX. Nenhum serviço real foi acessado; nenhum push, deploy, PR, Action ou branch nova foi criado.

## 2. Revisores e corretores independentes

| Fase | Agente | Foco | Veredito |
|---|---|---|---|
| 75079e4e | Herschel | Auth, vínculo, UID, Rules, ACK | not ready |
| 75079e4e | Locke | Sync, feed, conflitos, rebaseline, restore | not ready |
| 75079e4e | Aristotle | Backup, cripto, KV, restore, migração | not ready |
| 75079e4e | Ampere | PWA, isolamento, custos, UX de estados | not ready |
| 714d7fe9 | Aquinas | Auth/PWA pós-correção | not ready |
| 714d7fe9 | Ptolemy | Sync/concorrência pós-correção | not ready |
| 2be6257d | Lorentz | delta 6317ee6f..2be6257d | not ready; 2 Critical e 6 High locais |
| 5183a285 | Lorentz | segundo delta corretivo, revisão focada | sync/restore FIXED_VERIFIED; resta recovery sem ação de saída |
| aabbfdfd + delta recovery | Hume | recovery/rebaseline em duas rodadas | FIXED; sem bloqueador material no segundo delta |

Rawls e Maxwell executaram correções delimitadas (migração V1 e contrato KV), com testes focados; não substituem o parecer independente.

## 3. Achados materiais e destino

### Corrigidos e cobertos por teste

| Área | Correção | Evidência |
|---|---|---|
| Conflito de pull | Todas as operações PENDING da mesma entidade são marcadas CONFLICT; getEligibleOutbox também filtra entidade com conflito OPEN | f7-sync-conflicts 10 PASS; teste de duas operações |
| Recuperação | Marcador RECOVERY_REQUIRED persistido em IndexedDB, consultado antes de qualquer flush; pull executado antes da primeira escrita; nova instância do coordenador continua bloqueada | f7-sync-coordinator 17 PASS |
| Rebaseline | Commit não grava entidade viva quando tombstone local tem epoch maior/igual; cursor/epoch completos continuam PARTIAL e o flush permanece bloqueado | f7-rebaseline 7 PASS |
| Conflito visível | SyncHealth expõe conflictCount/mode CONFLICT; Settings lista conflitos; resolveRemoteConflict ligado à UI; resolução LOCAL preserva intenção de delete | f7-sync-view, App/Settings, f7-sync-conflicts |
| V1 | Qualquer conteúdo não vazio fora dos marcadores de versão vira AMBIGUOUS e snapshot null; habitos, retaFinal e campo string desconhecido cobertos | f7-v1-migration 13 PASS |
| Restore | FK efetiva calculada por fechamento transitivo; pai tombstoned/inválido propaga para filhos; outbox antiga vira BLOCKED, cursor é removido e recovery-required é gravado | f7-restore 13 PASS |
| Identidade/backup | Sessão Google B com perfil A pausa remote/sync/backup, bloqueia createBackup e preview divergente; token e UID são revalidados antes e depois do upload | f7-runtime 7 PASS; f7-kv-storage 9 PASS |
| Preview tardio | Token de geração no runtime descarta prévia antiga; confirmação continua exigindo UID atual | f7-runtime |
| KV | list usa {prefix, cursor}, keys[].name e paginação list_complete; GET e DELETE percorrem todas as páginas; lista incompleta falha fechada | f7-kv-auth 11 PASS |
| Rules | Recibo exige entity/change/head e igualdade de revisão, deleted e epoch; head não salta sem change e não regride | 12 testes Firebase PASS |
| Automação | init pede OPEN; commit local pede sync COMMIT e backup CHANGE; eventos de conteúdo/planejamento/sessão/revisão acionam o runtime; backup OPEN/CHANGE usa política de 24 h | App/local-events/f7-runtime |
| Backup na nuvem | Versões remotas são hidratadas na saúde; listar, baixar, descriptografar e abrir prévia de restore está ligado; nenhum download ocorre sem clique | f7-runtime 7 PASS; painel CloudBackupPanel |
| PWA | Presença só conta outra aba quando o lock da própria aba está comprovadamente adquirido | f7-tab-presence 4 PASS |

### Pendentes, parciais ou deliberadamente bloqueados

| Item | Estado | Motivo e contenção |
|---|---|---|
| Rebaseline cursor/epoch | PARTIAL / fail-closed | historyFloor e reposicionamento completo exigem contrato adicional; RECOVERY_REQUIRED bloqueia flush |
| Rules fora do protocolo de recibo | PARTIAL / BLOCKED_G-EXT | entidade/change/head ainda podem ser criados isoladamente; impedir exige operationId determinístico por entidade/revisão ou mudança de contrato. Remote não está habilitado |
| Contagem remota no consentimento | PARTIAL | UID e biblioteca são exibidos; contagem é 0 e rotulada como não verificada. Contagem real depende de leitura Firestore/G-EXT |
| Migração V1 real | BLOCKED_MAPPING | falta exportação/fixtures autorizadas e mapeamento semântico; fail-closed permanece |
| Retenção multi-dispositivo | PARTIAL | hidratação remote.list e retenção local; consistência eventual do KV real só em G-EXT |
| Concorrência real | NOT_RUN | duas abas reais locais PASS com Web Locks/outbox; Firestore multi-cliente real não executado |
| Firebase/Cloudflare/Auth/URL/dispositivos | NOT_RUN | G-EXT/G-STAGING separados |
| Quatro HIGH F0 | MITIGADO_LOCAL/PARTIAL | nenhuma prova real |

### Delta corretivo do parecer Lorentz

| Achado | Correção | Estado |
|---|---|---|
| Resolução REMOTE podia apagar edição local posterior | O ramo REMOTE rejeita STALE quando a revisão local mudou desde o conflito | FIXED_VERIFIED; teste dedicado |
| Conflito de flush com várias operações perdia a edição mais recente | markConflict escolhe a operação mais recente por baseRevision/sequence e guarda localKind | FIXED_VERIFIED; teste dedicado |
| Delete local de push virava upsert | localKind delete grava payload null e o resolvedor recria delete | FIXED_VERIFIED; teste dedicado |
| Restore não interrompia flush em voo | flushPending aceita shouldAbort; coordinator checa stop antes/depois do pull, antes do flush e antes do ACK; commitRestore para o coordinator antes da transação | FIXED_VERIFIED; teste dedicado com apply pendente |
| Bloqueio RESTORE era removido no relink | outbox recebe blockedReason RESTORE e adoptLocalOperations nunca o adota | FIXED_VERIFIED; teste restore + relink |
| Recovery persistido não aparecia no health | refresh lê o marcador e publica RECOVERY_REQUIRED/lastError | FIXED_VERIFIED; teste dedicado |
| V1 aninhado escapava com blocos top-level vazios | blockArrays detecta qualquer outra coleção de blocos não vazia | FIXED_VERIFIED; teste dedicado |
| get/list/delete KV e restore remoto sem rechecagem de UID | todas as requisições passam expectedUid; prepareCloudRestore recheca antes/depois do fetch/decrypt | FIXED_VERIFIED; testes KV |
| Rules permitiam change avulsa e head saltando | change exige head após a escrita e head só avança +1 | FIXED_VERIFIED; teste Firebase |
| Flush automático não atualizava a UI | scheduler chama onHealth; runtime agenda refresh | FIXED_VERIFIED; teste scheduler |
| Entidade excluída depois do conflito podia ser ressuscitada | localExisted rejeita LOCAL e REMOTE quando o row desapareceu | FIXED_VERIFIED; teste dedicado |
| Vários conflitos abertos para a mesma entidade | apply-remote atualiza o conflito aberto existente com a revisão/payload remoto mais recente | FIXED_VERIFIED; teste com duas changes |
| Conflito de push gravava tombstone epoch 0 | firebase-remote devolve epoch no resultado CONFLICT; markConflict persiste remoteEpoch | FIXED_VERIFIED; teste coordinator |
| Restore e flush concorrente entre abas | coordinator.drain aguarda o voo, para antes do ACK e o restore adquire o Web Lock de flush | FIXED_VERIFIED no drain; lock cross-tab estático, E2E de restore concorrente NOT_RUN |
| RECOVERY_REQUIRED sem sinal na UI | AttentionView mostra aviso persistente; rebaseline completo continua bloqueado por contrato | PARTIAL / fail-closed declarado |

Permanecem como bloqueios declarados: rebaseline completo de cursor/epoch e fluxo de UI de rebaseline; entity/change/head ainda podem ser escritos diretamente fora do recibo (exige contrato de operationId determinístico); contagem remota real no consentimento; serviços reais e multi-cliente. Nenhum desses caminhos é apresentado como sincronizado ou validado em produção.

O parecer Lorentz do HEAD 5183a285 fechou os bloqueadores técnicos de conflito/restore. O delta posterior implementou recovery acionável com snapshot estável, backup pré-recovery, checkpoint, clearRecovery com prova e UI operacional; Hume revisou o delta em duas rodadas e não encontrou bloqueador material no segundo parecer. O estado final local é F7_LOCAL_VALIDATED_FOR_UX, ainda BLOCKED_G-EXT_G-STAGING.

### Recovery acionável (2026-11-10)

O bloqueador de saída foi tratado sem botão de limpeza direta:

- FirebaseRemotePort.captureRecoverySnapshot lê o head antes e depois da coleção de entidades; qualquer mudança concorrente produz STALE. O snapshot só é aceito com identidade, epoch, head e envelopes válidos.
- prepareRecovery exige RECOVERY_REQUIRED ativo, perfil vinculado e sessão Google da mesma UID; grava um backup local íntegro (F2-F6, outbox, conflitos e tombstones) antes de criar a prévia com checkpoint/hash.
- commitRecovery revalida identidade e snapshot, adquire o mesmo Web Lock de flush, aplica a transação, grava cursor/epoch e só remove o marcador após read-back de cursor e recibo. Falha, quota, crash ou mudança de head mantêm RECOVERY_REQUIRED.
- clearRecovery deixou de ser uma limpeza direta: exige previewId e checksum de snapshot conferidos contra o recibo de rebaseline verificado.
- A UI em Configurações oferece Verificar, Exportar cópia e Aplicar rebaseline verificado; não existe botão de "desbloquear". Oito testes unitários de recovery e quatro E2E cobrem preview, identidade, snapshot stale, backup, pendência offline e duas abas.

O estado de aceite só muda após o parecer independente do delta e os gates finais no HEAD congelado.

## 4. Testes no HEAD final

| Comando | Resultado |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run test:unit | 818 PASS / 115 arquivos |
| npm run build | PASS (Vite 8.3.5; chunks Firebase lazy) |
| npm run test:e2e | 168 PASS + 2 skips / 170 |
| Firebase Emulator demo-estudo-v2 | 12 PASS / 2 arquivos |

O JDK 21 portátil foi usado apenas para o emulador local. A porta 18431 estava ocupada por preview órfão da própria rodada; listeners foram identificados e encerrados, e o E2E canônico passou na porta original. As imagens F4 regravadas foram revertidas para os blobs do HEAD; o estado atual difere do snapshot de 2026-11-04 porque os blobs foram atualizados por commits posteriores (d3c15448, d4e273b4, 670df66c).

## 5. Quatro riscos HIGH da F0

| Risco | Estado atual | Limite |
|---|---|---|
| R-V1-LEGACY-REMOTE-PLAN | MITIGADO_LOCAL / BLOCKED_MAPPING | V1 não mapeada falha fechada; falta exportação/fixtures |
| R-V1-FIRESTORE-DOCUMENT-1MIB | MITIGADO_LOCAL | limites locais testados; Firestore real NOT_RUN |
| R-V1-MULTITAB-OUTBOX-RACE | MITIGADO_LOCAL | duas abas reais com outbox IndexedDB/Web Locks; serviço real NOT_RUN |
| R-V1-BACKUP-TOMBSTONE-LOSS | MITIGADO_LOCAL | restore/rebaseline/checksum/retenção locais; KV real NOT_RUN |

## 6. Preparação T26/T27

O checklist operacional em docs/operations/f7-g-ext-staging-prep.md cobre projeto Spark isolado, Worker/KV Free, JWKS, variáveis públicas, autenticação/sync/backup, cotas, URL independente, matriz S01–S25, rollback e critérios de parada. G-EXT e G-STAGING continuam bloqueados. A restauração remota no app agora tem caminho local testado com endpoint fake; o ensaio real continua NOT_RUN.

## 7. F7-UX

A matriz docs/superpowers/v2/f7-ux-reuse-matrix.md confronta D01–D71/UX-01–UX-31 com o código e registra REUSE/PARTIAL/MISSING. O painel de conflitos e a restauração de backup na nuvem são contratos reutilizáveis adicionados à matriz. Nenhum redesign foi iniciado.

## 8. Git e integração

- main permanece em 9046cfa2283cd293b38df9d52fabfcd5de9ac67c, intacta.
- origin/v2 permanece em 7a7df0f2f9911a0d5956cb9b94ffa03659d24905; a v2 local avança 66 commits, 0 atrás, sem push (o commit documental final acrescenta um).
- Refs recovery/f7-preformat-20261104, recovery/v2-f7ux-20261109, F5 e bundles preservados.
- Nenhum stash, nenhum PR/Action/workflow.

## 9. Próximo passo

Com autorização separada, executar T26/T27 via f7-g-ext-staging-prep.md e só então iniciar a F7-UX em GOAL próprio. F8/G5 não estão autorizados.
