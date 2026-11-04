# Estudo Organizado V2 — F7: relatório único de execução local

**Data:** 04/11/2026  
**Status:** `F7_LOCAL_CODE_COMPLETE` / `F7_BLOCKED_G-EXT_G-STAGING`  
**Não é:** `F7_READY_FOR_HUMAN_REVIEW` nem `F7_ACCEPTED`.  
**Repositório/worktree:** `C:\Users\slvma\.codex\worktrees\v2-f4\estudo-organizado`, branch `v2`  
**Baseline remoto:** `origin/v2@6c70fef` (spec/plano/GOAL publicados); `origin/main@9046cfa`  
**HEAD de código desta execução:** `ac01335` (o commit documental deste relatório é posterior)  
**main/V1:** intocada; nenhum merge, deploy, billing, dado real ou escrita em produção.

## 1. Resultado executivo

A F7 foi implementada localmente até o limite seguro permitido pelo GOAL. As tarefas T01–T25 têm código, testes focais e regressões; T26/T27 têm somente preparação local, porque **G-EXT** (Firebase Spark/Cloudflare reais) e **G-STAGING** (URL de avaliação) não foram autorizados. A V2 não foi declarada pronta para avaliação humana: falta o ambiente isolado acessível e a prova real de Auth/Firestore/KV.

Evidência local mais recente, no HEAD de código:

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | **716 PASS / 110 arquivos / 0 FAIL** |
| `npm run build` | PASS (Vite 8.3.5; bundle principal 392,39 kB, React vendor 218,77 kB) |
| `npm run test:e2e` | **159 PASS + 2 skips conhecidos / 161** |
| Firebase Emulator Suite | **7 PASS** (5 Rules + 2 transações), projeto `demo-estudo-v2` |
| E2E focal F7 settings | PASS |
| E2E focal F7 duas abas | PASS (um único efeito remoto) |
| E2E F4 update + PWA offline | PASS |

O emulador usou JRE 21 portátil fora do repositório (`C:\Users\slvma\.codex\tools\temurin21-jre`). Nenhum projeto Firebase real, Worker, KV, Pages ou domínio foi acessado.

## 2. O que foi entregue

- **T01:** configuração V2 explícita, local-only por padrão, allowlist vazia para projetos reais e rejeição do projeto/hosts V1.
- **T02/T03:** porta de Auth Google testável, modo local sem carregar Firebase, cancelamento seguro, preview/consentimento de vínculo, geração de sessão e descarte de resposta tardia de UID anterior.
- **T04:** `firebase/firestore.rules`, índices e Emulator Suite isolados; testes negativos de UID, origem, schema e escopo.
- **T05/T06:** envelopes remotos limitados, receipts, feed ordenável, CAS, deduplicação por `operationId` e tombstone.
- **T07/T08:** ACK local somente após prova remota; coordenador de flush com Web Locks, retomada por lookup e proteção contra ACK de sessão antiga.
- **T09–T13:** pull incremental com cursor/epoch, conflitos conservadores, rebaseline não destrutivo, scheduler adaptativo e orçamento Spark local.
- **T14–T21:** snapshot completo F2–F6, AES-256-GCM/PBKDF2/AES-KW, Worker JWT RS256, cliente KV com read-back, retenção de 7 versões, restore com preview, migração V1 sintética e testes de 26 MiB/corrupção.
- **T22–T25:** UI discreta de conta/sync/backup, estados separados, PWA/update seguro, saúde de armazenamento, hardening de importação e acessibilidade.
- **T26/T27:** apenas preparação local; sem serviço real ou URL.

## 3. Matriz T01–T27

Estados: `PASS_LOCAL`, `PASS_EMULATOR`, `PASS_E2E`, `NOT_RUN`, `BLOCKED_G-EXT`, `BLOCKED_G-STAGING`.

| Tarefa | Estado | Prova principal |
|---|---|---|
| T01 | PASS_LOCAL | `f7-environment.test.ts` (5) |
| T02 | PASS_LOCAL | `f7-auth.test.ts` (4); Google real NOT_RUN |
| T03 | PASS_LOCAL | `f7-google-link.test.ts` (5) + `f2-delivery-identity` |
| T04 | PASS_EMULATOR | `f7-firestore-rules.test.ts` (5) |
| T05 | PASS_LOCAL | `f7-remote-schema.test.ts` (5) |
| T06 | PASS_LOCAL + PASS_EMULATOR | `f7-firebase-remote.test.ts` (6) + `f7-remote-transaction.test.ts` (2) |
| T07 | PASS_LOCAL | `f7-sync-ack.test.ts` (5) + regressões F2 |
| T08 | PASS_LOCAL + PASS_E2E | `f7-sync-coordinator.test.ts` (5) + `f7-two-tabs.spec.ts` |
| T09 | PASS_LOCAL | `f7-change-feed.test.ts` (5); Firestore real NOT_RUN |
| T10 | PASS_LOCAL | `f7-sync-conflicts.test.ts` (5) + regressões F4/F6 |
| T11 | PASS_LOCAL | `f7-rebaseline.test.ts` (6) |
| T12 | PASS_LOCAL | `f7-sync-scheduler.test.ts` (6) |
| T13 | PASS_LOCAL | `f7-sync-budget.test.ts` (5) |
| T14 | PASS_LOCAL | `f7-backup-coverage.test.ts` (5) |
| T15 | PASS_LOCAL | `f7-backup-crypto.test.ts` (7) |
| T16 | PASS_LOCAL | `f7-kv-auth.test.ts` (6); Worker real NOT_RUN |
| T17 | PASS_LOCAL | `f7-kv-storage.test.ts` (8); KV real NOT_RUN |
| T18 | PASS_LOCAL | `f7-backup-schedule.test.ts` (7) |
| T19 | PASS_LOCAL | `f7-restore.test.ts` (7) |
| T20 | PASS_LOCAL | `f7-v1-migration.test.ts` (7), fixtures sintéticas |
| T21 | PASS_LOCAL | `f7-backup-boundaries.test.ts` (6) |
| T22 | PASS_LOCAL + PASS_E2E | `f7-sync-view.test.ts` (7) + `f7-settings-flow.spec.ts` |
| T23 | PASS_LOCAL + regressões E2E | `f7-sw-update.test.ts` (5); `f4-update`/`pwa-offline` PASS |
| T24 | PASS_LOCAL | `f7-storage-health.test.ts` (5) |
| T25 | PASS_LOCAL + regressões | `f7-security-inputs.test.ts` (6) + suíte completa |
| T26 | BLOCKED_G-EXT | Sem Firebase/Cloudflare/dispositivos reais autorizados |
| T27 | BLOCKED_G-STAGING | `f7-staging-readiness.test.ts` (6); nenhuma URL real |

## 4. Matriz S01–S25

| Cenário | Estado | Prova/limite |
|---|---|---|
| S01 PC→celular→tablet | NOT_RUN | Só fake/emulador local; dispositivos reais não autorizados |
| S02 edições offline independentes | PASS_LOCAL | merge de campos independentes |
| S03 mesmo campo em dois dispositivos | PASS_LOCAL | conflito conservador com duas versões |
| S04 cliente antigo após exclusão | PASS_LOCAL | rebaseline/tombstone |
| S05 timeout após commit | PASS_LOCAL | lookup/read-back antes do ACK |
| S06 duas abas disputam outbox | PASS_LOCAL + PASS_E2E | Web Locks; um efeito lógico |
| S07 troca de conta/UID | PASS_LOCAL | geração de sessão e descarte tardio |
| S08 payload >1 MiB | PASS_LOCAL | rejeição sem truncamento |
| S09 reconexões em 2/3 aparelhos | NOT_RUN | Medição real de quota não executada |
| S10 quota/Auth/offline | PASS_LOCAL | outbox preservada; estados honestos |
| S11 restore antigo e exclusão | PASS_LOCAL | tombstone preservado; preview |
| S12 schemas V1/#107 | PASS_LOCAL | fixtures sintéticas 7/9/11/12 e IDB 6/7 |
| S13 SW com sessão/formulário | PASS_LOCAL + regressões E2E | `f4-update`/`pwa-offline` PASS |
| S14 limpeza de dados V2 | PASS_LOCAL | isolamento de perfil; nenhuma limpeza V1 |
| S15 Rules hostis/UID inválido | PASS_EMULATOR | 5 testes negativos |
| S16 backup/export/restore | PASS_LOCAL | roundtrip cripto e manifesto |
| S17 cobertura V1/V2 | PASS_LOCAL | matriz sintética; sem PASS real fictício |
| S18 IndexedDB removido | PASS_LOCAL | saúde de storage sem auto-overwrite |
| S19 KV Free com Worker/Auth | NOT_RUN | Worker/KV reais exigem G-EXT |
| S20 backup diário/retenção | PASS_LOCAL | 1/24h, 7 versões |
| S21 senha/chave/adulteração | PASS_LOCAL | AES-GCM falha fechada |
| S22 URL V2 isolada | BLOCKED_G-STAGING | Nenhuma URL publicada |
| S23 pacote >25 MiB | PASS_LOCAL | exportação local íntegra; KV QUOTA |
| S24 tipos acadêmicos F2–F6 | PASS_LOCAL | cobertura de stores e restore staging |
| S25 experiência em aparelhos | NOT_RUN | Apenas Chromium desktop local |

## 5. Decisões D-F7-01–17

| Decisão | Implementação local | Estado |
|---|---|---|
| D-F7-01 | Emulator Suite antes de real; allowlist real vazia | PASS_LOCAL; real BLOCKED_G-EXT |
| D-F7-02 | vínculo profileId/UID/library com preview/consentimento | PASS_LOCAL |
| D-F7-03 | documentos pequenos, IDs estáveis, receipts/feed | PASS_LOCAL |
| D-F7-04 | merge independente e conflito persistido | PASS_LOCAL |
| D-F7-05 | Web Locks + outbox + CAS/idempotência | PASS_LOCAL/PASS_E2E |
| D-F7-06 | cursor/epoch/tombstone/rebaseline | PASS_LOCAL |
| D-F7-07 | gatilhos adaptativos e orçamento | PASS_LOCAL |
| D-F7-08 | manual + automático + KV Free; R2 desabilitada | PASS_LOCAL |
| D-F7-09 | migração/restore isolados com preview | PASS_LOCAL |
| D-F7-10 | AES-GCM e chave de recuperação | PASS_LOCAL |
| D-F7-11 | 1/24h, 7 versões, exportação manual | PASS_LOCAL |
| D-F7-12 | estados discretos de sync/backup | PASS_LOCAL |
| D-F7-13 | update SW adiado quando inseguro | PASS_LOCAL + E2E |
| D-F7-14 | persistência/quota/recuperação local | PASS_LOCAL |
| D-F7-15 | testes locais/emulador; piloto real pendente | PASS_LOCAL; real BLOCKED_G-EXT |
| D-F7-16 | aceite por risco/evidência | Pendente de G-F7 humano |
| D-F7-17/C | ponte bidirecional não implementada na F7 | Fora de escopo; F8/G5 |

## 6. Quatro riscos HIGH

| Risco | Estado local | Limite |
|---|---|---|
| R-V1-LEGACY-REMOTE-PLAN | MITIGADO_LOCAL | 180 blocos sintéticos, comparação semântica, documento ausente ≠ não reconhecido; V1 real não acessada |
| R-V1-FIRESTORE-DOCUMENT-1MIB | MITIGADO_LOCAL | rejeição >900 kB e teste de 26 MiB local; Firestore real NOT_RUN |
| R-V1-MULTITAB-OUTBOX-RACE | MITIGADO_LOCAL | Web Locks unit + E2E duas abas; Firestore real NOT_RUN |
| R-V1-BACKUP-TOMBSTONE-LOSS | MITIGADO_LOCAL | rebaseline/tombstone/restore tests; restauração real NOT_RUN |

Nenhum risco foi convertido em PASS real. A mitigação V2 local não corrige a V1.

## 7. Gates e limitações

- **G-EXT:** não autorizado. Não houve Google Auth real, projeto Spark, Worker, KV, e-mail/conta de teste, Android ou dispositivo físico. T26 permanece `BLOCKED_G-EXT`.
- **G-STAGING:** não autorizado. Não houve Pages/URL/DNS, HTTP read-back real ou navegação externa. T27 permanece `BLOCKED_G-STAGING`.
- **G-F7:** não solicitado; a V2 não foi experimentada pelo proprietário.
- **Limitações materiais:** T09/T10/T19 usam aplicação local conservadora/staging, não merge completo em todos os stores de domínio; o piloto real pode revelar incompatibilidades de schema/quotas. T23 tem unidade e regressões E2E, mas não um E2E dedicado de SW waiting com duas abas. T25 não executou leitor de tela (NVDA/Narrator) nem hardware modesto. T26/T27 não podem ser marcados PASS.

## 8. Custos e quotas

- Nenhum billing, Blaze, R2, Cloud Functions paga, TTL/PITR/backup gerenciado ou serviço de excedente foi habilitado.
- Firebase Emulator Suite e JRE 21 portátil são locais e gratuitos. O projeto usado foi `demo-estudo-v2`.
- Referências Free (Spark/KV) foram tratadas como premissas, não como medição real. A medição de reads/writes/deletes/bytes reais fica para T26 sob G-EXT.
- R2 está desabilitada por código (`R2_ENABLED=false`; construtor lança erro).

## 9. Backup, preservação e rollback

- Pasta de preservação: `C:\Users\slvma\Downloads\Github\estudo-organizado-preservacao-20261104`.
- `SHA256SUMS.txt` contém os três PNGs F4 modificados e quatro versões `before-*`; hashes preservados.
- Branch `codex/f5-local-preserved-20261102` permanece com 4 commits exclusivos; não foi apagada nem misturada.
- `main@9046cfa` permaneceu intocada. Nenhum `reset --hard`, `clean -fd`, force push, rebase destrutivo ou exclusão de refs.
- Rollback de código: reverter commits F7 identificados na `v2`, com os hashes deste relatório; não reverter dados de teste sem preservar novas operações.
- Rollback de IndexedDB: usar fixtures/backups de teste; não executar downgrade sobre dados reais.
- Rollback de Firebase/KV: não se aplica nesta execução, pois nenhum serviço real foi tocado.
- Rollback de staging: não se aplica; nenhuma URL foi publicada.

## 10. Git

- `origin/v2` inicial: `6c70fef` (spec/plano/GOAL).
- `v2` local: 27 commits de código/testes até `ac01335`, mais o commit documental deste relatório.
- `origin/main`/`main`: `9046cfa`, sem alteração.
- Branch de preservação F5: `6cad56c` (4 commits exclusivos), preservada.
- Worktrees: principal (main) e `C:/Users/slvma/.codex/worktrees/v2-f4/estudo-organizado` (v2).
- Stashes: nenhum stash novo; a consulta inicial não encontrou stash a listar.
- PRs abertos: nenhum (consulta `gh pr list` retornou `[]`).
- Push: não realizado nesta execução; a autorização de push fast-forward para `origin/v2` só deve ser usada após revisão e nova checagem de divergência.

## 11. Staging

`BLOCKED_G-STAGING`. Nenhuma URL foi inventada. `verifyStagingReadiness` só retorna `READY_FOR_HUMAN_REVIEW` com URL não-V1, origem/Firebase isolados, V1 intocada, testes críticos, read-back real, dados sintéticos, ausência de serviço pago e módulos F2–F6. O teste local prova a configuração, não a navegação externa.

## 12. Revisão independente

Revisão independente read-only solicitada a um subagente sobre o diff `origin/v2..ac01335`, com foco em perda de dados, isolamento UID, CAS/ACK, tombstones/restore, cripto/KV, PWA e quotas. O resultado e eventuais correções devem ser anexados antes de qualquer pedido de G-F7. A revisão interna holística encontrou e corrigiu: guard arquitetural que ainda proibia Firebase, restauração indevida do PNG `desktop-grafite` gerado por E2E, e ausência de E2E de duas abas.

## 13. Próxima ação única

Solicitar ao proprietário, em um único pedido consolidado: **(a) G-EXT** para um projeto Firebase Spark isolado + Worker/KV Free de homologação e contas/dispositivos de teste; e **(b) G-STAGING** para publicar a V2 candidata em URL gratuita separada. Sem esses gates, a F7 permanece `F7_BLOCKED_G-EXT_G-STAGING`; não iniciar F8/G5, não tocar na V1 e não declarar `F7_READY_FOR_HUMAN_REVIEW`.
