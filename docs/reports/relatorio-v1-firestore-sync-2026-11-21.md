# Relatório — sincronização Firebase/Firestore V1 (issue #107)

- Data: 21/11/2026 (America/Fortaleza)
- Escopo: aplicativo V1, branch `main`
- Resultado objetivo: **V1_SYNC_BLOCKED_WITH_EVIDENCE**

## 1. Resumo executivo

O código corretivo da issue #107 (9.71 → 9.78) está na `main` local e remota e é o bundle efetivamente servido em produção. A suíte unitária completa e a suíte E2E focada passaram nesta sessão. Entretanto, a sessão real do incidente **não está presente neste ambiente**: o perfil aberto está autenticado na conta proprietária, mas com 0 eventos/0 editais locais, sem outbox, sem conflito e sem operação pendente; o documento remoto dessa mesma conta também está vazio (`payloadUpdatedAt` de 04/11/2026). Não existe, portanto, snapshot/outbox do incidente de 26/10 para reconciliar ou comprovar convergência real.

Não foi feita nenhuma escrita em produção, nenhuma restauração de backup e nenhuma alteração em `firestore.rules`. A V2 não foi tocada por esta sessão.

## 2. Publicação e versão efetiva

- `main` local = `origin/main` = `9046cfa2` (confirmado também pela API do GitHub).
- Última alteração de `src/sw.js`: `24b3d9aa` (27/10/2026), `APP_VERSION = 9.78`.
- Entre `24b3d9aa` e `9046cfa2` há apenas documentação (1 arquivo).
- Diagnóstico do app em produção: `appVersion 9.78`, `DIAGNOSTIC_BUILD_VERSION 9.78`, cache `estudo-organizado-v9.78`, Service Worker `activated`, `cacheVersionMatch: true`.
- `firestore.rules` não mudou desde `1c2257d8` (9.69); nenhuma regra foi publicada nesta sessão.
- O deploy é feito pelo Cloudflare Workers Builds a partir de `main`; não foi executado `wrangler deploy` em duplicidade.

## 3. Causas e correções já presentes em `main`

| Versão | Causa | Correção |
|---|---|---|
| 9.72 | plano remoto legado tratado como inexistente | `reta-final-legacy.js` reconhece a forma legada, migra com a mesma função do cliente e compara intenção; divergência vira `legacy-plan-mismatch` |
| 9.73/9.74 | envelope acima de 1 MiB por histórico operacional | histórico/diagnósticos fora do payload Firestore; resumos bounded; recomposição atômica da envelope pendente; digest acadêmico ignora metadados operacionais |
| 9.75 | outbox de adoção com revisão/base antigas | rebase idempotente para a próxima `snapshotRevision`, plano/linhagem/digest preservados; validador de replay não foi afrouxado |
| 9.76/9.78 | conflito persistido e `outbox-rebase-unsafe` | recuperação pelo caminho normal (poll/auto-pull/sync-now), comparação por intenção, CAS na outbox, releitura do remoto antes da escrita e subcausas estáveis |

As invariantes de CAS, `baseRemoteUpdatedAt`, `planId`/linhagem, `revision`/`snapshotRevision` e rejeição de replay com payload diferente foram mantidas.

## 4. Testes executados nesta sessão

| Verificação | Resultado | Evidência |
|---|---|---|
| Suíte unitária completa (`npm test`) | **PASS** | 179 arquivos, 2982 testes |
| Foco Firestore/Reta Final | **PASS** | 10 arquivos, 218 testes |
| E2E Chromium (`sync-devices` + `sync-e2e`) | **PASS** | 9/9, 1.6 min |
| `npm run lint` | **PASS** | 0 erros; 3075 warnings preexistentes |
| `npm run bump:check` | **PASS** | nenhum asset de `src/` alterado vs HEAD |
| Emulador Firestore + `firestore.rules` | **NOT_RUN** | ambiente sem JVM e sem Firebase CLI; `scripts/verify-reta-final-rules.mjs` exige emulador já ativo |
| T24 dois clientes reais | **NOT_RUN** | sem conta/namespace de teste autorizado e sem emulador |

## 5. Matriz T01–T24

| ID | Cenário | Resultado | Evidência principal |
|---|---|---|---|
| T01 | legado remoto × v2 local equivalente | PASS | testes de adoção de 180 blocos e caso real `missing-remote-plan` |
| T02 | legado divergente | PASS | `legacy-plan-mismatch`; nenhuma sobrescrita |
| T03 | conflito 9.71 persistido após atualização | PASS | poll, auto-pull e sync-now limpam somente após equivalência |
| T04 | outbox stale do 9.75 | PASS | rebase para `snapshotRevision+1`; replay estrito mantido |
| T05 | replay idêntico | PASS | reconhecimento idempotente sem nova escrita |
| T06 | mesma revisão com payload diferente | PASS | `replay-payload-mismatch` / `plan-payload-mismatch` |
| T07 | plano idêntico, dados acadêmicos diferentes | PASS | digest acadêmico separado do digest do plano |
| T08 | edição local após enfileiramento | PASS | reparo preserva alterações posteriores |
| T09 | remoto alterado durante rebase | PASS | CAS/releitura; conflito legítimo |
| T10 | outbox alterada por outra aba | PASS | CAS por `queuedAt/sentAt`; item alheio preservado |
| T11 | offline → edição → online | PASS (unitário) | planner/retry; sem E2E offline dedicado |
| T12 | duas abas / dois clientes | PASS (unitário) | concorrência de outbox; T24 real não executado |
| T13 | reload/reinício do PWA | PASS | outbox persistida recuperada; E2E de reload |
| T14 | upgrade do Service Worker com sessão antiga | PARCIAL | contratos de precache/versão; sem upgrade real de SW em E2E |
| T15 | tamanho Firestore e histórico | PASS (unitário) | histórico local; guard de 1 MiB; teste de envelope > limite |
| T16 | campo operacional ausente no remoto | PASS | sem reenvio/mescla por metadados locais |
| T17 | notas, eventos, questões, revisões, tempo, editais | PASS | suíte completa + E2E de persistência |
| T18 | tombstones e merge | PASS | compactação, floor, união e LWW |
| T19 | retry, timeout, erro de rede | PASS | ACK falho mantém pendente; backoff |
| T20 | UID/autenticação/regras | PARCIAL | testes unitários; regras no emulador NOT_RUN |
| T21 | snapshot ausente/inválido/corrompido | PASS | fail-closed com causas distintas |
| T22 | Cloudflare independente | PASS (unitário) | canais separados; sem falso sucesso Firebase |
| T23 | sincronizações repetidas sem edição | PASS | no-op por digest; sem escrita repetitiva |
| T24 | ida-e-volta entre dois clientes reais | NOT_RUN | depende de ambiente de teste autorizado |

## 6. Sessão real aberta — o que foi observado

- Conta proprietária autenticada (UID mascarado `waWI…G5Qi2`), confirmada pela lista de usuários do Firebase Authentication.
- Estado local: 0 eventos, 0 editais, 0 arquivos, 0 revisões; `lastBackupAt` 04/11/2026.
- Firestore: `conflict: null`, `hasPendingWrites: false`, `pendingSnapshot: null`, `lastPushAt: null`, `lastPullAt` 21/11/2026 23:56 UTC, `remoteUpdatedAt` 04/11/2026 19:52:57 UTC.
- Documento `users/<proprietário>/snapshots/main`: `version 1`, `schemaVersion 12`, `payloadUpdatedAt` 04/11/2026 19:52:57.692Z, `sentAt` .829Z, `baseRemoteUpdatedAt: null`, payload acadêmico vazio e sem descritor Reta Final.
- Existe outro UID com dados acadêmicos no projeto, mas pertence a outra pessoa; não foi usado e está fora do escopo.
- PITR e backups programados do Firestore não estão disponíveis no plano Spark; não há ponto de restauração no projeto.

Conclusão: o snapshot remoto e a outbox do incidente de 26/10 não existem nesta sessão. Não há operação pendente a reconciliar e não é possível declarar recuperação real com read-back.

## 7. Backups

- Cópia privada analisada: `backup-2026-10-30.json` (fora do repositório), 2.923.597 bytes.
- SHA-256: `36316E766D28F61C9FB406AC62AD7AF1B25E60A706E23E6A295458069D1678C6`.
- Busca somente leitura no Drive da conta proprietária e nas pastas locais
  conhecidas: **não há backup integral posterior a 30/10 nem cópia na lixeira**.
  Existem apenas dois JSONs de planejamento Reta Final (02/11 e 10/11), que não
  contêm eventos, notas, questões ou tempo estudado.
- Conteúdo: schema 12, 381 eventos, 4 editais, planejamento `reta_final` com 170 blocos; exportado sem sessão autenticada (`uid` nulo, Firestore desabilitado).
- Dry-run com o validador real do app (`validateBackupPayload`): **válido, 0 erros**.
- Prévia de impacto sobre estado vazio: 598 inclusões, 0 remoções, `destructive: false` (381 eventos, 4 editais e itens de hábitos).
- Ensaio isolado no app real (Chromium headless em `localhost`, rede externa
  bloqueada): a importação pela UI abriu a “Prévia de restauração” com
  **598 adicionados, 0 alterados, 0 removidos, 0 preservados** — 4 editais,
  381 eventos, 84 questões, 1 revisão, 51 leituras, 26 videoaulas e 51 páginas.
  Nenhum toast de erro; a prévia foi cancelada sem aplicar. As duas tentativas
  externas (Firebase) foram bloqueadas, então nada saiu do navegador local.
- A restauração não foi aplicada. O GOAL não autoriza restaurar backup sobre dados existentes sem aprovação específica.
- Envelope real gerada pelo app para esse backup (incluindo o descritor
  `retaFinalSync`): **1.040.262 bytes JSON UTF-8**, ou 99,21% do limite JSON,
  com folga de 8.314 bytes. O guard atual mede JSON.
- Codificação Firestore estimada pela estrutura do documento (mapas, arrays,
  strings, números e booleanos): **902.275 bytes**, ou **86,05%** do limite,
  com folga de **146.301 bytes**. O guard em JSON é, portanto, conservador
  frente à codificação real; o backup cabe no Firestore.
- Composição do payload: `editais` 552.474 bytes, `eventos` 342.177,
  `planejamento` 92.970, `habitos` 37.739. Os editais sozinhos ocupam 53% do
  documento.

## 8. Isolamento da V2

- Worktree V2: `_v2-candidate`, branch `v2`.
- No início da sessão: HEAD `012f79c1`. Durante a sessão, outro processo commitou `7e43d06c` (`fix(v2-f7): unblock Google login with same-origin auth proxy`) às 21:27; o reflog confirma autoria externa a esta sessão.
- Esta sessão executou apenas leitura em `_v2-candidate`; nenhum checkout, commit, reset, clean, stash ou escrita.
- Os três PNGs F4 continuam modificados (`desktop-neon`, `mobile-plasma`, `tablet-ardosia`) e há scripts de diagnóstico não rastreados, preservados.

## 9. Risco residual e rollback

- O risco material não é o código: é a ausência do estado real do incidente. O documento remoto da conta proprietária está vazio desde 04/11.
- Rollback de código: reverter para `24b3d9aa` ou para o deployment anterior; isso não restaura dados por si só.
- Rollback de dados exigiria um ponto de restauração inexistente no Firestore Spark ou a aplicação explícita do backup de 30/10.
- A medição no SDK/emulador não pôde ser repetida nesta sessão (sem JVM); a
  estimativa acima segue as regras de tamanho do Firestore e a evidência
  histórica de 889.117 bytes JSON aceitos no emulador permanece a referência.
- O backup de 30/10 cabe no Firestore com ~146 KB de folga codificada
  (aproximadamente algumas centenas de eventos). O guard em JSON continua
  conservador, mas o crescimento acadêmico normal ainda exige
  segmentação/versionamento transacional como evolução; não é pré-condição para
  restaurar esse backup agora.

## 10. Próximo passo necessário

Para concluir a issue #107 é preciso um destes caminhos, com decisão explícita do proprietário:

1. Abrir o perfil/dispositivo original que ainda contenha IndexedDB/outbox do incidente e deixar a sessão intacta; ou
2. Autorizar a restauração do backup de 30/10 como nova linha de base, ciente do intervalo de aproximadamente três semanas, executada primeiro em perfil isolado, com prévia, exportação do estado atual, uma sincronização normal, read-back, reload e segunda sincronização idempotente. O tamanho é viável: a envelope real cabe no limite com ~146 KB de folga codificada.

Sem esse estado, o máximo verificável é: código publicado, testes locais aprovados e sessão atual vazia e sem pendências.
