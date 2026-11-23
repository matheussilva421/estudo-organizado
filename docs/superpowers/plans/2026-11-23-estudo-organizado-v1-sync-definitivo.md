# Estudo Organizado V1 — Sincronização Definitiva Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (preferencial) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. O acompanhamento das tarefas usa caixas de seleção (`- [ ]`). **Este documento é planejamento aprovado apenas após aceite expresso do usuário; sua criação não autoriza execução.**

**Goal:** Substituir o sincronizador cotidiano da V1 por um motor incremental, offline-first e confiável, inicializado exclusivamente pelo backup canônico de 23/11/2026, sem comprometer os dados acadêmicos, a V2 ou o legado preservado.

**Architecture:** O cliente mantém estado por UID/geração no IndexedDB e grava cada alteração de negócio com uma operação em outbox persistente. Um único worker envia mudanças idempotentes ao Firestore, com revisões por entidade e listeners `onSnapshot`, enquanto a Reta Final usa revisão lógica atômica. O namespace remoto novo é isolado, preparado em staging, auditado integralmente e somente ativado sob gate humano separado.

**Tech Stack:** JavaScript ES modules existente (sem troca de framework), IndexedDB nativo, Firebase JS SDK 12.x já presente, Firestore/Auth Emulators, Vitest 3.x, Playwright, Node.js e scripts existentes do repositório.

**Spec:** `docs/superpowers/specs/2026-11-23-estudo-organizado-v1-sync-definitivo.md` — cópia controlada da SPEC v1.0 aprovada fornecida no handoff; SHA da fonte a ser registrado no preflight. **A SPEC está atualmente fora do repositório; nunca presumir que o caminho já existe.**

**Plan target:** `docs/superpowers/plans/2026-11-23-estudo-organizado-v1-sync-definitivo.md` (cópia deste arquivo somente depois de aprovado o plano e autorizado o trabalho no repositório).

**Repository:** `matheussilva421/estudo-organizado`, branch padrão `main`. V2 fora do escopo. O código remoto foi consultado em 23/11/2026, mas **HEAD exato, árvore local, worktrees e todos os PRs devem ser novamente verificados pelo executor**; o ambiente atual não é o checkout local do Codex.

## Global Constraints

- Decisões imutáveis salvo evidência técnica superveniente e novo aceite: **S01-A; S02; S03-B; S04-A; S05-B; S06-A**. Abre imediatamente apenas com cache válido da geração corrente, importa só o backup enviado, namespace remoto separado, primeiro acesso antigo exige recuperação online, alerta preventivo apenas quando houver pendência.
- Backup original privado `estudo-organizado-backup-2026-11-23......json`: **1.653.120 bytes**, SHA-256 **`f4f9af2923d3b0da9599de32e1c897ae4ef4690339b63ba1a5a9ba0059844127`**, `schemaVersion=12`. Usar caminho fornecido localmente por variável `ESTUDO_V1_BACKUP_PATH`; **não** registrar payload, credenciais nem exportar cópia para Git.
- Baseline acadêmico: **4 editais, 49 disciplinas, 792 aulas, 1.825 assuntos, 360 eventos, 222 hábitos, 140 blocos ativos, 5 tombstones (3 raiz + 2 em config após normalização), um plano arquivado**. Preservar todos os campos de negócio e identificadores existentes. **57** `aulaId` e **86** `rfBlocoId` de eventos sem correspondência ativa devem permanecer recuperáveis, não virar dados fabricados.
- Conservar calendário e semântica de Reta Final v2: 140 blocos pendentes, ordens 0–139, plano com `planId`, horizonte dos blocos 23/11/2026–26/02/2027 e configuração final em 28/02/2027. Nenhuma tarefa modifica o cronograma de estudos.
- Novo Firestore híbrido: um documento por evento, hábito, bloco, edital metadados; um por disciplina com aulas/assuntos; plano e configurações acadêmicas separados; tombstones por entidade. Testar limites, custos e crescimento; subdivisão de disciplinas só mediante limite real comprovado.
- Preservar legado e backups, **não** reimportar dados antigos de celulares/desktops, **não** executar `clearData`, reset destrutivo, overwrite da base atual, migração produtiva ou publicação de regras sem autorização específica. Registros existentes no backup não podem ser excluídos silenciosamente.
- `Cloudflare`, Drive e JSON ficam como **backup/recuperação**, não como canais automáticos concorrentes. Nenhuma configuração secreta (`cfTokenDraft`, tokens, URLs, Auth, UID de sessão legado, dados pessoais em logs) no novo namespace, fixtures versionadas, issues ou ZIP público.
- Um caminho de sincronização efetivo quando o novo motor estiver ativo; nenhuma execução paralela com polling/snapshot/force-overwrite legados. Sem dependência de relógio do cliente para decidir conflito, sem `last-write-wins` silencioso.
- Local-first: operação acadêmica e respectiva outbox devem ser persistidas atomicamente; ACK requer confirmação remota verificável, nunca ausência de erro. Repetições de `opId` não podem duplicar efeitos.
- `main` primeiro quando seguro e autorizado; preferir alterações incrementais na estrutura existente; sem novas GitHub Actions/CI, sem PRs desnecessários, sem alterar V2, sem apagar branches/worktrees/commits exclusivos. `main`/merge/push/deploy só conforme autorizações e proteções.
- Todo trabalho implementado terá TDD RED → GREEN → regressão, execução local de Vitest, Playwright e Firestore Emulator, revisão independente quando disponível, evidências verificáveis e ZIP final sem dados sensíveis. **Testado ≠ integrado ≠ publicado.**

## Review Focus — riscos funcionais que exigem testes específicos

1. **Backup contendo `cfTokenDraft`/campos desconhecidos:** dados acadêmicos desconhecidos são preservados no round-trip, mas telemetria/segredos legados não entram em Firestore nem em logs. Teste: T1/T2.
2. **Duas abas ou duas instâncias do mesmo usuário:** um único `opId` provoca um único efeito, e uma aba não limpa a outbox da outra. Teste: T4/T6/T11.
3. **Queda entre commit remoto e ACK local:** o retry detecta recibo já persistido e confirma sem repetir criação/remoção. Teste: T5/T11.
4. **Novo cliente aberto offline pela primeira vez com cache legado:** não permite editar nem exibir o legado como se fosse a geração canônica. Teste: T7/T11.
5. **Replanejamento que altera vários blocos + exclusão de evento:** observadores veem plano anterior ou revisão completa, nunca revisão parcial; tombstone impede ressurgimento. Teste: T8/T11.

---

## Mapa de arquivos e contratos

**Arquivos já verificados no repositório** (inspecionar novamente no preflight):

| Arquivo existente | Responsabilidade e ponto de integração |
|---|---|
| `src/js/store/indexeddb.js` (`DB_VERSION=7` na leitura) | Upgrade IndexedDB; gravação local; preservar stores e dados anteriores |
| `src/js/store.js`; `src/js/store/export-state.js` | Contrato central de estado/exportação; flags operacionais legados |
| `src/js/store/reta-final-commit.js` | Commit atômico do planejamento; exigirá incluir outbox da nova geração |
| `src/js/sync/sync-coordinator.js` | Entrada dos eventos `stateSaved`; roteamento entre legado e novo motor |
| `src/js/sync/firestore-sync-engine.js` | Motor legado, mantido sem uso na geração nova até gate de remoção |
| `src/js/sync/firestore-schema.js`; `src/js/backup-restore.js` | Envelope/validador legados; manter compatibilidade de export JSON |
| `src/js/sync/sync-center.js`; `src/js/views/config/sync-center.js` | Apresentação dos estados de sincronização e backups |
| `firestore.rules`; `firestore.indexes.json`; `firebase.json` | Regras e emuladores; portas atuais Auth `9099`, Firestore `8085`, UI `4000` |
| `src/sw.js`; `scripts/bump-cache.mjs` | Cache/versionamento do PWA, sem alterações precoces em service worker |

**Arquivos novos previstos**, módulo pequeno por responsabilidade, **sem duplicar motores legados**:

| Arquivo proposto | Interface pública estável definida neste plano |
|---|---|
| `src/js/sync/v1-next/backup-codec.js` | `convertBackupV12(raw)`, `reconstituteBackupV12(records)`, `auditBusinessEquivalence(raw, reconstructed)` |
| `src/js/sync/v1-next/contracts.js` | `recordKey(type,id)`, `validateRecord(record)`, `validateManifest(manifest)`, `compareRevisions(base,remote)` |
| `src/js/sync/v1-next/local.js` | `readLocalGeneration(uid,generationId)`, `commitLocalChange(change)`, `getPendingOperations(uid,generationId)`, `ackLocalOperation(opId,receipt)` |
| `src/js/sync/v1-next/remote.js` | `getCurrentGeneration(uid)`, `subscribeGeneration(uid,generationId,handlers)`, `applyRemoteOperation(operation)` |
| `src/js/sync/v1-next/worker.js` | `startV1Sync({uid,generationId})`, `stopV1Sync()`, `drainPendingOperations()` |
| `src/js/sync/v1-next/bootstrap.js` | `bootstrapV1Generation({uid,online})`, `reconcileRemoteDelta(delta)` |
| `src/js/sync/v1-next/reta-final.js` | `publishPlanRevision(operation)`, `resolveVisiblePlanRevision(manifest,records)` |
| `src/js/sync/v1-next/status.js` | `deriveV1SyncStatus({outbox,network,auth,conflicts,remoteAck})` |
| `scripts/v1-sync-migration.mjs` | `audit`, `prepare`, `verify` e `activate` (último sempre bloqueado sem autorização explícita); nunca exibir segredos |

Se a árvore atual já tiver módulo com o mesmo propósito, **reutilizá-lo** em vez de criar duplicata. Interfaces acima são contratos planejados; os nomes/propostas não significam arquivos já existentes. Todos os tipos são objetos JS com JSDoc, sem TypeScript novo. Nomes e imports versionados devem respeitar a prática atual do app e atualização do cache PWA.

## T0 — Preflight e baseline verificável (gate técnico antes de escrever código)

**Files:** Ler `package.json`, `firebase.json`, módulos acima e testes existentes; ao iniciar execução autorizada, copiar SPEC/plano aprovados para os caminhos `docs/superpowers/...`. Atualizar **um único registro de estado existente** quando pertinente.

**Interfaces:** Produz `preflight.json` local (não versionado com dados privados) e diagnóstico de dependências. Não altera dados do usuário.

- [ ] **Step 1 — Inventariar Git/GitHub:** `git status --short`, `git branch -avv`, `git worktree list --porcelain`, `git log -1 --format='%H %s'`, `git rev-parse main`, `git remote -v`; pesquisar PRs abertos e diferenças dos ramos. Não confundir branches V2 já existentes no repositório com autorização para alterá-las.
- [ ] **Step 2 — Conferir caminhos e execução local:** `npm ci` quando seguro, `npm run test:sync`, `npm run test:unit`, `npm run bump:check` (pode inicialmente falhar por estado preexistente; registrar). Verificar Java e Firebase CLI antes de prometer Emulator; inspecionar arquivos de configuração, sem login/despliegue.
- [ ] **Step 3 — Classificar pontos de escrita:** localizar `saveStateToDB`, commits de Reta Final, `stateSaved`, mutações `setState`, `firestore_outbox` e canais Cloudflare/Drive; listar callsites que precisarão roteamento sem criar serviço paralelo.
- [ ] **Step 4 — Verificar backup:** calcular SHA-256 e tamanho do caminho privado; falha se diferentes dos valores da SPEC. Conferir acesso ao arquivo real **sem copiá-lo para o Git**.
- [ ] **Step 5 — Gate:** preflight deve dizer se `main` está limpa, se há trabalhos exclusivos, qual commit foi observado, baseline de testes, problemas preexistentes e plano de não perda. Se descoberta material invalidar arquitetura, **parar para registrar evidência e pedir nova decisão**, sem improvisar outra solução.

## T1 — Segurança e conversão determinística do backup

**Files:** Create `src/js/sync/v1-next/backup-codec.js`; Test `tests/unit/v1-next-backup-codec.test.js`; Extend `tests/unit/backup-restore.test.js` se necessário. Fonte real somente em testes privados locais, com variável `ESTUDO_V1_BACKUP_PATH`.

**Interfaces:**
- `convertBackupV12(raw: object): { records: Record<string,object[]>, manifestDraft: object, exclusions: string[], exceptions: object[] }`
- `reconstituteBackupV12(records: Record<string,object[]>): object`
- `auditBusinessEquivalence(raw:object, restored:object): {ok:boolean, differences:object[]}`

- [ ] **Step 1 — RED:** testes com fixture sintética em `schemaVersion:12`: preserva IDs, notas, `planejamento` + `planejamentoArquivado`, ordem de aulas/assuntos, hábitos e tombstones; testa `cfTokenDraft` e `config.firestoreSync` preenchidos **sem valor real**; campos de negócio desconhecidos permanecem. `npm test -- tests/unit/v1-next-backup-codec.test.js` deve falhar inicialmente.
- [ ] **Step 2 — Implementar mínimo:** separar `eventos`, `habitos`, `disciplinas`, metadados do edital, `retaFinalBlocos`, plano e tombstones; normalizar chave estável (`tipo:id`) sem trocar ID; sanitizar campos por classificação positiva/negativa, com relatório de exclusões sem valores sensíveis.
- [ ] **Step 3 — GREEN:** mesma suíte passa; adicionar verificação privada opcional com SHA real, 4/49/792/1825/360/222/140/5 e 1 plano arquivado; confirmar 57/86 vínculos históricos **preservados**, não reparados automaticamente.
- [ ] **Step 4 — Round-trip e segurança:** `auditBusinessEquivalence()` deve comparar árvore semântica canônica de negócios e demonstrar que nenhum token, `cfTokenDraft` ou diagnóstico operacional saiu para os registros; relatório somente com contagens/digests/caminhos de campos.
- [ ] **Step 5 — Revisar e commitar** apenas código e testes sintéticos após aprovação de execução; **nunca** commit do backup ou de extratos pessoais.

## T2 — Contratos remotos e regras de segurança no Emulator

**Files:** Create `src/js/sync/v1-next/contracts.js`; Modify `firestore.rules`, `firestore.indexes.json` só se exigido por consulta real; Test `tests/unit/v1-next-contracts.test.js` e `tests/emulator/v1-next-firestore-rules.test.js` (ou diretório de emulator já existente, observado no preflight).

**Interfaces:** `recordKey(type,id)`, `validateRecord(record)`, `validateManifest(manifest)`, `compareRevisions(base,remote)`; contratos `users/{uid}/v1SyncNamespaces/{generationId}/...`, `users/{uid}/v1SyncControl/current`; recibo de idempotência no namespace `/operations/{opId}`.

- [ ] **Step 1 — RED:** escrever casos de regra: UID A não lê/escreve UID B; sem Auth negado; documento com geração falsa ou campo proibido negado; cliente regular **não** altera `v1SyncControl/current` nem promova manifest `staging → active`; clientes velhos continuam restritos às regras legadas, sem ampliação involuntária.
- [ ] **Step 2 — Contratos:** validar `schemaVersion`, `generationId`, `entityType`, `entityId`, `revision` inteiro não negativo, bytes/shape da disciplina e do plano; no limite do Firestore recusar operação com erro explícito, sem truncar conteúdo.
- [ ] **Step 3 — Rules mínimas:** proteger todas as subcoleções por UID + ponteiro da geração ativa e revisão; operações de migração/ativação são **exclusivas de contexto confiável**, nunca determinadas por flag do cliente. Garantir que cliente de geração antiga não escreva após troca de ponteiro. Não publicar regras.
- [ ] **Step 4 — GREEN:** executar testes de regras no Emulator Auth/Firestore (`firebase emulators:exec --only auth,firestore '<comando de testes localizado no preflight>'`); repetir testes de regras legadas. A forma exata do runner deve ser fixada após verificar o setup existente, não inventar script npm.
- [ ] **Step 5 — Revisar/commitar** os contratos e regras **somente localmente**; sem deploy.

## T3 — IndexedDB isolado por UID e geração

**Files:** Modify `src/js/store/indexeddb.js`, `src/js/store.js`; Create `src/js/sync/v1-next/local.js`; Test `tests/unit/v1-next-local.test.js` e regressões `tests/unit/store-indexeddb-imports.test.js`.

**Interfaces:**
- `readLocalGeneration(uid:string,generationId:string): Promise<{state:object,verified:boolean}|null>`
- `commitLocalChange(change:{uid,generationId,nextState,operations}): Promise<void>`
- `getPendingOperations(uid,generationId): Promise<object[]>`
- `ackLocalOperation(opId:string,receipt:object): Promise<void>`

- [ ] **Step 1 — RED:** upgrade do banco já existente (na leitura remota: `DB_VERSION=7`; confirmar no preflight), sem apagar `app_state`, rascunhos, journals ou outboxes antigas; dois UIDs/gerações não compartilham estado e operações; falha transacional reverte estado+outbox.
- [ ] **Step 2 — Implementar:** usar stores com chaves compostas por UID/geração; preservar a base legada intocada na migração; escrita de mudança acadêmica e outbox na **mesma transação IndexedDB**. Não fazer `await` de rede dentro de transação IDB.
- [ ] **Step 3 — GREEN:** testar reload/crash simulados, fila persistente, ACK de outra geração rejeitado, ordering de mutações e falha de quota sem confirmação falsa.
- [ ] **Step 4 — Integrar entrada local:** instrumentar **ponto central existente** de persistência, sem criar um segundo local save concorrente; verificar também fluxo `reta-final-commit.js` em T8. Nesta etapa manter novo motor sob flag de teste **desligada em produção**.
- [ ] **Step 5 — Revisar/commitar**; executar `npm run test:unit` e anotar regressões.

## T4 — Repositório Firestore incremental e idempotência

**Files:** Create `src/js/sync/v1-next/remote.js`; Test `tests/emulator/v1-next-remote.test.js`, `tests/unit/v1-next-remote-contract.test.js`.

**Interfaces:**
- `getCurrentGeneration(uid:string): Promise<object|null>`
- `subscribeGeneration(uid:string,generationId:string,handlers:{onDelta:Function,onError:Function}): ()=>void`
- `applyRemoteOperation(operation:object): Promise<{opId:string,entityId:string,revision:number,acknowledged:boolean}>`

- [ ] **Step 1 — RED:** write+receipt na mesma operação transacional do Firestore; repetir `opId` não cria outro registro, sequer após timeout entre gravação e resposta; `baseRevision` obsoleta produz conflito preservável, não overwrite. Regras e Auth reais do Emulator, não mocks isolados.
- [ ] **Step 2 — Implementar:** `runTransaction` para CAS por documento, validação da geração ativa, recibos `/operations/{opId}`, tombstone por ID e timestamps de servidor. Sem transação Firestore offline: quando offline, **somente fila IDB**, jamais enviar com falsa confirmação.
- [ ] **Step 3 — GREEN:** reprocessamento exato, reordenação de ACKs, falhas de permissão, entidade apagada, outros UID, perda da rede. Testar também que uma edição de evento não escreve disciplina/edital/plano/snapshot completo.
- [ ] **Step 4 — Implementar listeners:** `onSnapshot` + `docChanges`, por coleções relevantes, com erros observáveis e unsubscribe completo; evitar reads/callbacks duplicados e exigir baseline antes de aplicar delta incremental de uma coleção.
- [ ] **Step 5 — Revisar/commitar**; contar leituras/escritas e documentos por edição no Emulator.

## T5 — Bootstrap seguro do cache e primeiro acesso (S01-A/S05-B)

**Files:** Create `src/js/sync/v1-next/bootstrap.js`; Modify integração de carregamento em `src/js/store/indexeddb.js` e bootstrap da aplicação que o preflight localizar; Test `tests/unit/v1-next-bootstrap.test.js`, `tests/e2e/v1-next-first-access.spec.js`.

**Interfaces:** `bootstrapV1Generation({uid,online}): Promise<{status:'ready'|'requires-network'|'blocked',generationId?:string}>`; `reconcileRemoteDelta(delta:object): Promise<void>`.

- [ ] **Step 1 — RED:** com cache de geração validada, a UI apresenta dados imediatamente e atualiza sem botão; com apenas cache legado e offline, apresenta preparo inicial e **não habilita edição**; com cache de outro UID/geração, recusa import implícito.
- [ ] **Step 2 — Implementar:** resolver Auth/geração sem misturar conta; baixar baseline em área local temporária; validar manifest `verified|active`, contagem/digest/revisão e **só então** vincular cache à geração, de forma idempotente e recuperável após interrupção.
- [ ] **Step 3 — GREEN:** online → download → validação → uso offline futuro; falha de download mantém legado intacto e tela de preparo; login/logout/troca de usuário preservam isolamento; geração remota revogada bloqueia upload pendente até reconciliação segura.
- [ ] **Step 4 — Integrar sem atraso artificial:** abrir com cache já autorizado antes do roundtrip online, com status correto. Não aceitar cache marcado válido apenas pela presença de campos locais.
- [ ] **Step 5 — Revisar/commitar**; regressão de inicialização e Auth.

## T6 — Worker único, realtime e recuperação automática

**Files:** Create `src/js/sync/v1-next/worker.js`; Modify `src/js/sync/sync-coordinator.js` (roteamento mínimo); Test `tests/unit/v1-next-worker.test.js`, `tests/e2e/v1-next-sync.spec.js`.

**Interfaces:** `startV1Sync({uid,generationId}): Promise<void>`, `stopV1Sync():void`, `drainPendingOperations():Promise<{acked:number,pending:number,conflicts:number}>`.

- [ ] **Step 1 — RED:** múltiplos `stateSaved` não disparam flushs duplicados; `onSnapshot` reflete alterações do outro dispositivo; eco da própria operação não cria novo `opId` nem loop; duas abas conservam integridade da fila.
- [ ] **Step 2 — Implementar:** worker único por contexto, exclusão de concorrência via mecanismo mínimo compatível com IDB, retry com backoff limitado, online/visibilitychange/foco, flush em lote limitado, status por recibo; sem polling de 30 s como fonte primária.
- [ ] **Step 3 — GREEN:** offline, reconexão, crash após envio, retry idempotente, Auth expirada, troca de UID, duas abas; conflitos suspendem **somente** entidade afetada; demais operações continuam.
- [ ] **Step 4 — Cortar duplicidade por flag:** quando nova geração ativa, coordenador legado não executa `queueFirestoreSnapshotFromState`, `autoPullRemoteWhenNewer`, modos entity-shadow/primary, force overwrite, Drive/Cloudflare automáticos. Quando flag desligada, comportamento legado permanece até cutover; nunca dois escritores na mesma geração.
- [ ] **Step 5 — Revisar/commitar**; comparar quantitativamente custo de uma edição no novo/antigo caminho sem assumir valores antes dos testes.

## T7 — Regras de concorrência, exclusão e histórico

**Files:** Extend `src/js/sync/v1-next/contracts.js`, `local.js`, `remote.js`, `bootstrap.js`; Test `tests/emulator/v1-next-conflicts.test.js` e `tests/unit/v1-next-tombstones.test.js`.

**Interfaces:** `compareRevisions(base,remote): 'equal'|'advanced'|'conflict'`; conflito `{entityType,entityId,base,local,remote,opId}` persistente e isolado por UID/geração.

- [ ] **Step 1 — RED:** duas alterações independentes convergem; atualização incompatível no mesmo campo cria duas versões recuperáveis, **não** marca ACK e não bloqueia outros registros; eliminação em uma aba não reaparece após outra aba reconectar.
- [ ] **Step 2 — Implementar:** CAS por registro; política de merge automático apenas para campos comprovadamente independentes; conflitos sem merge automático preservam base/local/remota, com identificadores e conteúdo privados no armazenamento local apropriado.
- [ ] **Step 3 — GREEN:** conflito de mesma entidade, edição versus delete, replay de operação antiga, tombstone presente no backup, write antigo de geração anterior, uso com duas contas.
- [ ] **Step 4 — Revisar/commitar**; nenhuma funcionalidade antiga de resolução manual deve gerar overwrite global no namespace novo.

## T8 — Reta Final com revisão de plano indivisível

**Files:** Create `src/js/sync/v1-next/reta-final.js`; Modify `src/js/store/reta-final-commit.js` pontualmente; Test `tests/unit/v1-next-reta-final.test.js`, `tests/emulator/v1-next-reta-final.test.js` e regressões dos testes de Reta Final já existentes.

**Interfaces:** `publishPlanRevision(operation:{planId,baseRevision,blocks,metadata,opId}):Promise<object>`; `resolveVisiblePlanRevision(manifest,records): object`.

- [ ] **Step 1 — RED:** alteração de múltiplos blocos aparece em outra instância como revisão inteira ou anterior; não há ordens duplicadas nem visualização de bloco incompleto; evento automático não é refeito após retry, nunca transforma referência histórica em vínculo ativo.
- [ ] **Step 2 — Implementar:** preparar documentos por revisão lógica antes de mudar ponteiro `meta/retaFinalRevision` via transação online; validação do conjunto antes da publicação; rollback local quando commit IDB de Reta Final não consegue registrar outbox simultaneamente.
- [ ] **Step 3 — GREEN:** testar 140 blocos base, replanejamento, remoção, notas, `operations`, histórico arquivado, tombstones, falha entre staging e publish; replay de `opId` e dois dispositivos, sem reintroduzir snapshots globais.
- [ ] **Step 4 — Revisar/commitar**; executar regressões de planejamento e eventos com calendário original inalterado.

## T9 — UX mínima e distinção de sincronizado/salvo localmente

**Files:** Create `src/js/sync/v1-next/status.js`; Modify `src/js/sync/sync-center.js`, `src/js/views/config/sync-center.js`, ponto de aviso de saída encontrado no preflight; Test `tests/unit/v1-next-status.test.js`, `tests/unit/sync-center.test.js`, `tests/e2e/v1-next-sync-status.spec.js`.

**Interfaces:** `deriveV1SyncStatus({outbox,network,auth,conflicts,remoteAck})` retorna `sincronizado | sincronizando | salvo-neste-dispositivo | atencao-necessaria` e mensagem curta.

- [ ] **Step 1 — RED:** operação em IDB sem recibo deve mostrar `salvo neste dispositivo`, não “Tudo sincronizado”; listener ativo sem writes não é ACK; conflito de uma entidade não impede status correto das demais.
- [ ] **Step 2 — Implementar:** indicador discreto, estados acessíveis por leitor de tela, tela de primeiro preparo, alerta de saída limitado ao que o navegador permite; manter botões de exportação/recuperação JSON, mas não exigir botão de sync.
- [ ] **Step 3 — GREEN:** online, offline, Auth ausente, erro persistente, pendência, saída, recuperação; testes Playwright com textos e aria-live, sem screenshots contendo dados reais.
- [ ] **Step 4 — Revisar/commitar**; evitar múltiplos painéis para a mesma condição.

## T10 — Ferramenta de preparação, validação e cutover **não produtivo**

**Files:** Create `scripts/v1-sync-migration.mjs`; Test `tests/unit/v1-next-migration-cli.test.js`, `tests/emulator/v1-next-migration.test.js`.

**Interfaces CLI:** `node scripts/v1-sync-migration.mjs audit --backup "$ESTUDO_V1_BACKUP_PATH"`; `prepare --target emulator`; `verify --target emulator`; subcomando `activate` deve recusar produção sem **gate separado**, credencial adequada e prova de read-back. Scripts não devem copiar tokens nem backup para o repo.

- [ ] **Step 1 — RED:** audit recusa hash inesperado, schema inválido e perda de conteúdo; staging interrompido nunca vira ativo; reexecução de `prepare` não duplica entidades; verify detecta documento faltante, digest divergente ou tombstone ausente.
- [ ] **Step 2 — Implementar:** manifest `staging → verified` com `migrationId`, SHA, contagens, digest e `generationId`; lotes pequenos retomáveis com journaling técnico; leitura completa de volta e relatório sem conteúdo privado; controle preparado por contexto confiável, não por claims autodeclaradas do cliente.
- [ ] **Step 3 — GREEN no Emulator:** teste com backup real apenas em ambiente privado, sem rede externa produtiva; interromper em vários lotes, retomar, read-back de **todos** os documentos, reconstituir e comparar negócios 1:1.
- [ ] **Step 4 — Testar proteção:** `activate --target production` **sem autorização** retorna erro e não escreve nada; nenhum subcomando dispara deploy automático de regras. Se precisar de ferramenta Admin em produção, documentar obtenção restrita de credencial; nunca incorporá-la ao pacote.
- [ ] **Step 5 — Revisar/commitar** sem manifest contendo dados pessoais; anexar só métricas agregadas ao pacote de evidências.

## T11 — Homologação multidispositivo local, desempenho e regressão

**Files:** Test `tests/e2e/v1-next-multidevice.spec.js`, `tests/e2e/v1-next-offline.spec.js`, `tests/emulator/v1-next-security.test.js`; ajustar testes existentes somente quando se provar mudança intencional de contrato; nenhuma desativação silenciosa.

- [ ] **Step 1 — Cenário principal:** contexto Playwright A edita evento → recebe confirmação remota → fecha → contexto B faz primeiro acesso e encontra alteração sem clique; inversão B→A; persistência após reload.
- [ ] **Step 2 — Falhas reais:** desconectar antes de salvar, após commit IDB, depois de write remoto e antes de ACK; reiniciar aba/browser e confirmar exatamente um efeito por `opId`; dois contextos autenticados; duas abas mesmo UID; Auth alternada; rede flapping.
- [ ] **Step 3 — Migração e concorrência:** usar emulador limpo e dados privados isolados; 57/86 referências intactas; tombstones sem ressurreição; plano atomicamente publicado; cliente legado offline não abre a geração nova; logout e troca de UID sem vazamento.
- [ ] **Step 4 — Testes e medidas locais:** `npm run test:sync`, `npm run test:unit`, `npm run test:e2e:release`, `npm run lint`, `npm run bump:check` após eventual atualização de cache pelo mecanismo existente; executar regras Auth/Firestore no Emulator. Se Playwright depender de browser/Java ausente, fornecer impedimento comprovado e não homologar.
- [ ] **Step 5 — Benchmark:** registrar baseline vs novo (reads/writes/bytes/latência/ACK, duração de bootstrap, disciplina maior, 140 blocos). Critério mínimo: edição isolada **não** varre/reescreve base toda, não atinge limite Firestore, converge com prova de ACK; metas quantitativas finais derivadas de medição real, não fictícias.
- [ ] **Step 6 — Gate:** todas as regressões materiais passam, sem P0/P1 e sem falha de segurança, relatório inclui logs sanitizados e reexecução; caso contrário corrigir na mesma estrutura, sem proliferar branches/PRs.

## T12 — Integração autorizada, retirada segura do legado e entrega

**Files:** `src/js/sync/sync-coordinator.js`, arquivos legados estritamente necessários, `src/sw.js` apenas se exigido pelo cache, SPEC/plano em `docs/superpowers/...` após aceite e um registro de estado já existente; **não** criar Actions ou relatórios redundantes.

- [ ] **Step 1 — Revisão independente:** conferir aderência a S01–S06, N1–N8 da SPEC, diffs de regras, permissões, footprint de dependências, vazamento de dados, flakiness e rollback. Revisar todos os testes reprovados; não os excluir para forçar verde.
- [ ] **Step 2 — Roteamento único:** manter legado como leitura/rollback enquanto útil, mas desabilitar suas escritas automáticas na geração nova; retirar código morto **somente depois** de provar ausência de callsites, necessidade de recuperação e impactos em Drive/Cloudflare. Retenção temporária com TODO de retirada objetiva é aceitável; dois motores ativos, não.
- [ ] **Step 3 — Git hygiene:** inventário de HEAD, working tree, ramas/worktrees, PRs e commits exclusivos; evitar PR e branch novos, consolidar apenas o integrado, **não** remover material não integrado sem autorização; sem GitHub Actions novas.
- [ ] **Step 4 — Integração:** preparar commits curtos e testados para `main`; executar push/merge **somente quando autorizado e permitido**. Distinguir código implementado/testado/integrado/publicado. Nenhum deploy automático.
- [ ] **Step 5 — Entrega Codex:** ZIP com SPEC, plano, resumo de implementação, matriz de critérios de aceite, resultados de testes, hashes, diffs relevantes, inventário Git, versão/HEAD, relatório de segurança e checklist de cutover/rollback **sem backup privado, tokens ou notas pessoais**. Verificar ZIP e checksums.

## GATE PROD — não incluído na autorização de implementação

**Executar somente após aceite explícito e adicional do usuário.** Nada nesta seção implica autorização presente.

1. Confirmar janela de corte e ausência de alterações não contempladas após o backup de 23/11/2026; **S03-B proíbe** importação automática de dados subsequentes de caches ou da nuvem antiga. Alertar claramente sobre possível perda de novidades não contidas na fonte e solicitar novo backup canônico/aceite caso necessário.
2. Confirmar acesso autenticado e isolado ao Firebase real, projeto/UID corretos, permissões mínimas, regras revisadas e possibilidade de restauração. Aplicar regras produtivas só com autorização específica.
3. Preparar geração nova no namespace isolado sem alterar `users/{uid}/snapshots/main` nem o legado; `verify` deve recontar e fazer read-back completo, comparar digests/negócios e emitir `verified`.
4. Publicar ponteiro de geração ativa somente com autorização, operação confiável e evidência de que manifest e conjunto estão íntegros. Atualizar app para apontar ao novo motor de modo consistente; clientes antigos não podem escrever na geração nova.
5. Homologar **dois dispositivos reais**, ida/volta, offline/reconexão, histórico e Reta Final, status de ACK, quotas, segurança e backups. Em caso de bloqueio, manter estado `HOMOLOGACAO_PENDENTE`, não declarar sucesso.
6. Rollback do **código** somente sob gate; rollback dos **dados** depois da ativação exige preservar/exportar operações novas, jamais simplesmente apontar para snapshot antigo com perda silenciosa.

## Matriz de cobertura da SPEC

| Requisito da SPEC | Tarefas com evidência |
|---|---|
| §1 N1–N4: local-first, multi-device, geração, fila durável | T3–T6, T11 |
| §1 N5: não perder divergências | T4, T7, T11 |
| §1 N6, §4, §10: backup único e auditoria integral | T1, T10, GATE PROD |
| §1 N7/N8, §14: V2 e backups separados | T0, T6, T12 |
| §2 S01–S06, §8 UX e inicialização | T5, T6, T9, T11 |
| §5/§6: modelo híbrido, limites, revisões e tombstones | T1, T2, T4, T7, T8 |
| §7: atomicidade IndexedDB/outbox | T3, T6, T8 |
| §9: revisão indivisível da Reta Final | T8, T11 |
| §11: Auth/rules/privacidade | T1, T2, T10, T11 |
| §12: custo, latência e observabilidade | T4, T9, T11 |
| §13: aceite de dados, sync e operação | T10, T11, T12, GATE PROD |

## Pontos de controle e estado final possível

- **G0 — Baseline:** T0 verde; sem dados inseguros no workspace.
- **G1 — Codec/segurança:** T1–T2 verdes; round-trip sem perda.
- **G2 — Motor local/remoto:** T3–T7 verdes; sync idempotente no Emulator.
- **G3 — Domínio/UX:** T8–T9 verdes; plano consistente e status fidedigno.
- **G4 — Staging homologado:** T10–T11 verdes; baseline migrada sem perda e cenários multidispositivo reproduzíveis.
- **G5 — Código pronto:** T12 revisado; integração à `main` **somente quando autorizada**.
- **G6 — Produção:** exclusivamente `GATE PROD` com aceite separado, read-back real e testes físicos. Ausência de G6 significa `PRODUCAO_NAO_ATIVADA`, mesmo se G5 concluído.

**Relatório obrigatório por gate:** evidência executada, comando, saída/contagens, hash/commit, falhas e exceções, estado de `main`/branches/PRs/worktrees, dados preservados, bloqueios e próximo passo. Se uma dependência externa impedir homologação real, registrar precisamente o impedimento; **não mascarar como concluído**.

**Estado deste artefato:** `PLANO_SUPERPOWERS_V1_0 / PENDENTE_APROVACAO / NAO_EXECUTADO / SEM_PUSH / SEM_DEPLOY / SEM_CUTOVER`.
