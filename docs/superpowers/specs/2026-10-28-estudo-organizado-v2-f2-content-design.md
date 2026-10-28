# Estudo Organizado V2 — F2: Editais e conteúdo canônico

**Estado:** `F2_SPEC_REVISED — PENDING_HUMAN_APPROVAL` (revisão de 2026-10-28; **NÃO APROVADA**).  
**Fase:** F2 / edição e organização de conteúdo; **não autoriza writing-plans, código, instalação, backend ou merge**.  
**F1 de referência:** aceite humano com ressalvas em 2026-10-28, no commit `85ce1e3`; os quatro riscos HIGH continuam `UNVERIFIED`, e Firebase/sync multi-dispositivo real **não** foram homologados.  
**Base obrigatória:** [spec mestra D01–D27 + A-01/A-02](2026-10-19-estudo-organizado-v2-design.md), [spec F1](2026-10-28-estudo-organizado-v2-f1-foundation-design.md), [relatório de aceite F1](../audits/2026-10-28-v2-f1-acceptance.md), [inventário F0](../audits/2026-10-19-v1-feature-inventory.json), [ADRs F1](2026-10-28-v2-f1-architecture-decisions.md) e [roadmap](../v2/ROADMAP.md).  
**Pré-condição:** F1 aceita com ressalvas; F2 só poderá iniciar após aprovação humana desta spec revisada, writing-plans F2 próprio e GOAL F2.  
**Status dos riscos:** 4 HIGH F0 `UNVERIFIED` até testes efetivos; 107 E2E FAIL legados não mudam por esta redação.

## 1. Resultado de produto e escopo

Construir o acervo canônico de **editais → disciplinas → assuntos → aulas**, com contexto de edital principal, arquivamento, verticalização, importação JSON conservadora e mapeamento de aulas. O usuário deve conseguir começar com dados locais, organizar vários concursos e reutilizar conteúdo sem perder histórico. Esta fase ainda não implementa ciclo/cronograma/sessões; entrega os dados e contratos que F3–F5 exigem.

**Features principais do inventário F0 (6):**
- `F-V1-EDITALS-CRUD` — criar/editar/arquivar objetos, organização por árvore, edição inline, reordenação, lotes pequenos de aulas, metadados de cor/ícone sem impor regra no domínio;
- `F-V1-PRINCIPAL-EDITAL` — selecionar explicitamente principal ativo; alterá-lo não deleta nem reescopa registros históricos;
- `F-V1-ARCHIVED-EDITALS` — preservar editais anteriores para consulta, reativação consentida e rastreabilidade;
- `F-V1-VERTICAL-EDITAL` — hierarquia verticalizada e progresso calculado, não cache como fonte primária;
- `F-V1-EDITAL-IMPORT` — importar JSON versionado com preview, matching conservador, plano de importação e confirmação;
- `F-V1-LESSON-MAPPER` — mapear aulas para um ou mais assuntos, com exclusões/alterações sem apagar fatos dependentes.

## 2. Domínio, identidade, relações e temporalidade

**Entidades lógicas propostas (condicionais a D-F2-01):** `Edital`, `StudySubject` (F1 canônico), `EditalDiscipline` (associação se B for aprovada), `Assunto`, `Aula` e `LessonTopicLink`. `EditalDiscipline` não duplica o título canônico: usa o título do `StudySubject`; um alias de exibição, se necessário, será campo opcional e explicitamente não canônico. As opções A/C de D-F2-01 substituem essa associação e exigem revisão de §4/T01-T03 antes de qualquer implementação.

**Invariantes obrigatórios:** IDs opacos e estáveis, não título; escopo de proprietário/perfil; relações bidirecionais coerentes e validáveis; sem exclusão em cascata destrutiva do histórico; referências órfãs em quarentena; mudanças de nome/ordem não reescrevem estatísticas; arquivamento preserva as ligações; seleção de principal é uma preferência explícita por perfil com comportamento determinístico ao trocar de edital.

**Dados de apresentação:** cores, ícones, ordem e expansão de árvore não contaminam regras de estudo. Mudanças sensíveis são operações idempotentes gravadas atomicamente com outbox local quando sync estiver ativado; toda entidade remota precisa de envelope/campo de revisão e escopo UID segundo A-02, embora F2 não possa presumir Firestore real homologado.

**Versionamento:** `domainSchemaVersion` próprio; importação tem `sourceFormatVersion`/proveniência sem reusar às cegas os números 12/11/9/7 da V1. Múltiplos editais podem conter disciplinas homônimas: matching por nome isolado é insuficiente.

### 2.1 Contratos efetivamente entregues pela F1

Esta revisão usa como fonte o código e os testes de `apps/v2/` no aceite `85ce1e3`, não apenas a intenção da spec F1.

| Contrato F1 | Forma entregue | Regra para F2 |
| --- | --- | --- |
| Isolamento | `apps/v2/`, origem `127.0.0.1:18431`, IndexedDB `estudo-organizado-v2`, SW próprio | Reutilizar; não criar segunda origem, DB ou SW |
| Versões | `DOMAIN_SCHEMA_VERSION=1`, `LOCAL_DB_VERSION=1`, `BACKUP_FORMAT_VERSION=1`, `SYNC_PROTOCOL_VERSION=1` | Incrementar somente com migração explícita; não reutilizar 12/11/9/7 da V1 |
| Entidade | `StudySubject {id, profileId, title, localRevision}` com ID opaco | Resolver a relação com `Disciplina` de edital antes de duplicar o conceito |
| Comandos | create/rename com `operationId`; título normalizado; replay exato idempotente; payload divergente rejeitado | Estender o envelope sem reutilizar ID com conteúdo diferente |
| IndexedDB | stores `subjects` (chave `[profileId,id]`), `outbox`/`operations` (`operationId`), `conflicts` (`conflictId`), `profiles` (`profileId`), `meta` (`key`) | Adicionar entidades/índices por migração; não criar outra fila |
| Atomicidade | disciplina + operação + intenção de outbox na mesma transação; abort/quota sem commit parcial | Toda mutação F2 segue o mesmo padrão |
| Outbox | status `PENDING`/`CONFIRMED`/`CONFLICT`; `baseRevision`; ACK exige operação persistida e revisão comprovada | F2 adiciona `entityType`/`kind` e validação, sem nova outbox |
| Sync A-02 | CAS/idempotência via fake; read-back após timeout; `conflictRevisions`; Web Locks com `BLOCKED` sem lock | Contratos fake continuam; emulador é ensaio separado, não homologação |
| Consentimento | `ProfileBinding`, estados de sync, prévia com perfil/UID/contagem/emissão/expiração | F2 preserva a prévia; não vincular acervo sem consentimento |
| Convergência | exige commit local, remoto e cursor verificado **e** zero pendências | Nunca inferir convergência por timestamp ou UI |
| Orçamento | margem conservadora de 900.000 bytes por payload; fake rejeita excesso | F2 mede agregados/documentos antes de fixar schema remoto |
| Backup | manifesto/checksum, tokens removidos, `deletionHistoryComplete`, `SAFE`/`INVALID`/`REBASELINE_REQUIRED` | F2 não adiciona restauração destrutiva sem preview |
| Legado | reconhece schemas 7/9/11/12 e `retaFinal`; comparação de 180 blocos sem overwrite | Importação F2 mantém quarentena e proveniência |
| UI/PWA | 8 temas, tokens, foco, 44 px coarse, toasts não bloqueantes, SW isolado | F2 reutiliza componentes/tokens; não redesenha a fundação |
| Testes | 84 unitários e 20 E2E; harness somente no build `e2e`; duas abas/IDB/retry cobertos | F2 adiciona testes próprios; não reaproveitar PASS de fake como homologação real |

**Lacunas explícitas deixadas para F2:** `StudySubject` não possui `editalId` nem relação canônica com disciplina; o store `profiles` existe, mas persistência/UI de vínculo não foi entregue; o outbox só cobre `subject`; não há UI de backup/importação; `delete` é um tipo previsto, sem fluxo F2; e o Firebase real não foi executado. Essas lacunas precisam de decisão na aprovação F2, não de suposição no código.

### 2.2 Regras de extensão para F2

As regras abaixo assumem D-F2-01 = B; são condicionais até a aprovação humana. Se A/C forem aprovadas, §4 e T01-T03 devem ser reescritos.

- Estender os contratos F1 por migração versionada e testes de compatibilidade; não duplicar `Disciplina` como uma segunda entidade com o mesmo significado.
- Definir o mapa `StudySubject ↔ Disciplina(edital)` com proveniência e uma política explícita para dados F1 existentes.
- Toda operação F2 usa a única outbox/serviço de commit; nenhuma fila paralela ou escrita direta da UI no IndexedDB.
- Importação e backup F2 continuam read-only na origem V1 e usam apenas fixtures sintéticas.
- Qualquer documento remoto F2 precisa de orçamento, revisão e escopo de UID compatíveis com A-02.

### 2.3 Lacunas da F1 que a F2 precisa fechar

Estas lacunas são requisitos de extensão F2, não funcionalidades já entregues:

- O registro de conflito F1 guarda apenas o payload local e a revisão remota; F2 precisa de `remotePayload`, `entityType`, `deleted` e `ResolveConflict` para preservar os dois lados.
- A outbox F1 não carrega `uid`, `sequence`/`createdAt` nem `attempts`; F2 precisa impedir flush com UID divergente, ordenar/coalescer por entidade e limitar retries.
- Não existe store durável de tombstones/`currentEpoch`; F2 precisa criá-lo, persistir a epoch e tratar delete de entidade nunca sincronizada.
- O commit F1 converte erros de domínio em `UNAVAILABLE`; F2 precisa de `CommitService` com `INVALID` explícito e testes de repositório.
- Os stores `profiles` e `meta` existem sem leitura/escrita; F2 precisa persistir binding, principal e epoch.
- O backup F1 é v1 e exige versões exatas; F2 precisa de leitor v1 e formato v2 com entidades adicionais.
- O limite de título F1 é 120; a importação F2 separa título de exibição (120) de chave de matching (até 200), sem confundir os dois.

### 2.4 Persistência e invariantes operacionais F2

- Stores F2 propostos, além dos F1: `editais`, `edital_disciplines`, `assuntos`, `aulas`, `lesson_topic_links`, `tombstones`, `quarantine` e `import_jobs`, todos com chave `[profileId,id]` e índices por pai/ordem; `profiles` guarda binding e `primaryEditalId`; `meta` guarda `currentEpoch` e versões. Não criar segundo banco nem outra outbox.
- `orderKey` é uma chave lexicográfica estável por pai (ex.: fractional index base62), com desempate por ID; não usar posição de array nem timestamp como autoridade.
- `primaryEditalId` é único por perfil, armazenado em `profiles`/`meta`; `Edital.primaryChoice` não é fonte concorrente. Arquivar o principal exige escolha explícita ou estado “sem principal”.
- `upgrade(db, oldVersion, newVersion)` deve criar stores/índices em passos idempotentes, adicionar índices a stores existentes e tratar `versionchange`/`onblocked` entre abas; nenhuma migração destrutiva.
- `quarantine` guarda registros não reconciliáveis/ambíguos com proveniência e motivo; não é lixeira e não é apagada automaticamente.
- Backup F2 tem formato próprio e leitor v1 explícito; um backup F1 não vira `SAFE` por acidente e subject+tombstone do mesmo ID é rejeitado na prévia.
- `ALREADY_APPLIED` compara hash/canonicalização do payload; erros determinísticos (`RemoteScopeError`, `RemoteDocumentError`, validação) não entram em retry infinito.
- `ConflictRecord {conflictId, profileId, entityType, entityId, localPayload, remotePayload|null, baseRevision, remoteRevision, deleted:boolean, createdAt, status}`; `deleted` significa que o lado remoto é tombstone e exige `RestoreEntity`/resolução explícita.

## 3. Jornadas UX mínimas e estados

1. Estado vazio → criar edital local → adicionar disciplinas/assuntos/aulas → editar e reordenar → reload confirma dados.
2. Escolher edital principal e arquivar outro → ver apenas seu contexto ativo nos fluxos apropriados, mas manter acesso explícito ao histórico arquivado.
3. Importar JSON: selecionar arquivo → validar tipo/tamanho/versão/segurança → comparar com acervo → prévia de criação/reuso/conflito → confirmação por operação → read-back e relatório de importação. Em caso de erro, nenhuma confirmação parcial disfarçada de sucesso.
4. Mapear aulas a assuntos: sugerir vínculos quando possível, permitir revisão humana em matches ambíguos; desfazer um vínculo não remove aulas/sessões existentes.
5. Responsividade desktop/tablet/mobile e temas A-01; foco, teclado e tela de erro/sem rede; não mostrar "sincronizado" apenas porque IndexedDB foi gravado.
6. Migração F1: abrir a fila “disciplinas não vinculadas” → escolher edital existente ou criar edital + vínculo explicitamente → prévia das associações → confirmar → read-back; nenhum subject é vinculado automaticamente e a fila permanece consultável.

## 4. Operações públicas e contratos de dados

**Comandos propostos:** `CreateEdital`, `EditEditalMetadata`, `SetPrimaryEdital`, `ArchiveEdital`, `ArchiveEditalDiscipline`, `SoftDeleteEntity`, `RestoreEntity`, `MigrateF1Subjects`, `RenameSubject`, `CreateSubjectInEdital`, `CreateEditalAndLinkSubject`, `LinkExistingSubject`, `UnlinkEditalSubject`, `UpsertAssunto`, `UpsertAula`, `LinkLessonTopic`, `UnlinkLessonTopic`, `ResolveConflict`, `PreviewEditalImport` e `ApplyEditalImport`; todos com `operationId`, `profileId`, `baseRevision` quando pertinente, validação de relacionamento e retorno discriminado `LOCAL_COMMITTED|CONFLICT|INVALID|FAILED`. O commit F1 atual não produz `INVALID`; a F2 deve extrair um `CommitService` que preserve erros de domínio como `INVALID`.

**Consultas:** `GetEditalTree`, `ListActiveEditais`, `ListArchivedEditais`, `GetPrimaryEdital`, `ListLessonTopicLinks`, `ListUnassignedSubjects`, `GetConflict`, `PreviewLink` e `GetImportPreview`; paginação e consultas indexadas nas listas grandes, sem load completo desnecessário. Projeções são descartáveis/recalculáveis.

**Importação:** parser com limites de tamanho/profundidade/quantidade definidos após testes; aceitar somente estruturas reconhecidas, sanitizar texto e nunca executar HTML/script. Importação repetida por `importId` e identidade de fonte deve ser idempotente, não duplicar a árvore. Caso de relação externa ausente ou conflitante: quarentena/revisão; nunca silenciosamente reutilizar outra disciplina.

**Migração V1:** primeira conversão testada apenas com fixtures sintéticas da matriz F0; IDs/proveniência explícitos, contagens por entidade, vínculos preservados, relatório de divergência. Não tocar perfis V1 reais ou origem produtiva.

## 5. Integração e sincronização A-02

F2 usa o **IndexedDB V2** e a única outbox da F1, sem introduzir fila paralela. Operações independentes em editais distintos podem convergir; concorrência na mesma entidade ou em exclusões/vínculos exige revisão-base/CAS e resolução conservadora.

**Ensaio antecipado:** a spec propõe, como gate separado e não automático, um ensaio local com Firebase Emulator (§5.1). Ele não homologa produção, não autoriza projeto Firebase real e não inicia código F2. Se não for aprovado, a homologação real permanece no F7 e o risco de integração tardia fica registrado.

### 5.1 Proposta de ensaio antecipado com Firebase Emulator (não executado)

**Objetivo:** reduzir o risco de descobrir problemas estruturais de sync apenas no F7, exercitando os contratos F1/F2 contra Auth e Firestore emulados, com dados sintéticos e custo zero.

**Autorização separada:** este ensaio só ocorre após aprovação explícita de `F2_EMULATOR_REHEARSAL`. A aprovação da spec F2 não o autoriza automaticamente; a execução exige plano curto, entradas/saídas e confirmação de que nenhum projeto real será tocado.

**Ambiente e pré-condições:**

- Firebase CLI e Java compatíveis verificados antes da instalação; nenhuma dependência paga.
- Projeto de emulador com prefixo `demo-` (por exemplo `demo-estudo-organizado-v2`), Auth Emulator e Firestore Emulator em portas locais documentadas.
- Rules V2 em arquivo próprio sob `apps/v2/firebase/` (criado somente no ensaio autorizado); `firestore.rules` da V1 permanece intocado.
- UIDs sintéticos, fixtures sintéticas e nenhuma credencial/produção; o Auth Emulator simula identidade, não o Google Sign-In real.
- Nenhum billing, Cloud Function, deploy ou tráfego para Firebase real.

**Protocolo reproduzível — 10 etapas:**

1. **Pré-requisitos e isolamento:** versões de Node, Firebase CLI e Java registradas; portas locais reservadas; nenhuma credencial ou projeto real no ambiente.
2. **Projeto `demo-*`:** usar `demo-estudo-organizado-v2` (ou equivalente explicitamente local) como project ID de emulador; nenhuma chamada à nuvem.
3. **Auth e Firestore emulados:** iniciar apenas os emuladores necessários; documentar que Auth Emulator simula identidade e não Google Sign-In real.
4. **Rules V2:** manter rules próprias em `apps/v2/firebase/` (somente após autorização); validar dono, UID estranho e política de delete sem tocar `firestore.rules` da V1.
5. **Fixtures de duas identidades:** UIDs A/B sintéticos, editais/disciplinas/assuntos/aulas e outbox determinísticos; nenhum dado pessoal.
6. **CAS, ACK, replay e read-back:** provar uma única operação lógica, timeout após commit com lookup, ACK somente com revisão comprovada e replay idempotente.
7. **Concorrência e conflito:** dois clientes editam a mesma entidade; conflito preserva versões; edições independentes convergem; nenhum last-write-wins por timestamp.
8. **Quota e tamanho:** documento abaixo da margem de 900 KB; caso acima rejeitado sem truncamento; estimativa de leituras/escritas/índices para 1–3 clientes; Spark tratado como premissa, não como medição real.
9. **Critérios PASS/FAIL:** Rules, CAS, replay, read-back, conflito e limite fechado precisam passar; falha material é FAIL/BLOCKED, com logs e limitações; nenhuma conversão de NOT_RUN em PASS.
10. **Homologação posterior:** somente após o ensaio, planejar ambiente isolado real (Auth Google, Rules publicadas, quota, dispositivos) em F7; emulador aprovado não é homologação de produção.

**Entregáveis:** configuração de emulador, rules V2, fixtures, testes automatizados locais, log/JSON de evidência, relatório com PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN e riscos residuais. Nada é promovido a produção.

**Critérios de saída:** as 10 etapas têm evidência real; testes de Rules e CAS passam no emulador; uma única operação lógica por replay; UID errado negado; conflito preservado; limite de documento rejeitado de forma fechada; o ensaio é reproduzível localmente. Falha material bloqueia a etapa e é registrada, não mascarada.

**Limites:** emulador não prova quotas Spark reais, latência, App Check, OAuth Google real, listeners em produção, Rules publicadas ou convergência entre dispositivos físicos. Os quatro riscos HIGH continuam `UNVERIFIED` até a homologação F7 pertinente. O ensaio pode reduzir incerteza, mas não autoriza declarar Firebase homologado.

**Gate:** `F2_SPEC_REVISED` (aprovação da spec) → autorização específica do ensaio → execução local → evidências. O ensaio não substitui writing-plans nem GOAL F2.

### 5.2 Decisões D-F2-01..06 — propostas para aprovação

**Todas as decisões abaixo têm status `PROPOSED` e dependem de aceite humano.** Elas não alteram a F1 nesta fase.

#### D-F2-01 — Relação entre `StudySubject` e disciplina por edital

| Alternativa | Identidade e reuso | Migração/consultas | Avaliação |
| --- | --- | --- | --- |
| A. `editalId` em `StudySubject` | Disciplina deixa de ser canônica; mesmo conteúdo em editais distintos vira cópias | Simples de consultar; migração força um edital ou um escopo “sem edital” | Não recomendada |
| B. `StudySubject` canônico + `EditalDiscipline` | Preserva ID e reuso; vínculo tem `editalId`, `subjectId`, ordem e revisão | Exige índice/join e duas revisões; migração pode deixar sem vínculo | **Recomendada** |
| C. Disciplinas independentes por edital + reconciliação | Isolamento imediato, mas duplicação e merge por heurística | Reconciliação cara e perigosa; histórico difícil | Não recomendada |

**Recomendação B.** Manter `StudySubject` como conteúdo canônico e criar `EditalDiscipline {id, profileId, editalId, subjectId, displayOrder, localRevision}`, com unicidade `(profileId, editalId, subjectId)` e índices por edital/subject. Um subject pode aparecer em vários editais; a associação é a unidade de ordem/apresentação. Impacto F1: nenhuma alteração agora; extensão de schema/IDB e comandos F2. Testes: dois editais com o mesmo subject, homônimos sem merge, rename canônico refletido nas associações, remoção de associação sem apagar subject. Riscos: consultas em duas etapas e migração de subjects sem edital. **Decisão humana:** aprovar B ou optar por A/C.

#### D-F2-02 — Assuntos, aulas, cardinalidades e proveniência

**Proposta:** Edital 1‑N `EditalDiscipline`; `EditalDiscipline` 1‑N `Assunto` (árvore por `parentId`); `EditalDiscipline` 1‑N `Aula`; `Aula` N‑N `Assunto` via `LessonTopicLink`. Aulas são escopadas ao edital nesta fase; reutilização entre editais exige cópia/importação explícita com proveniência, não compartilhamento implícito. Nomes homônimos não são identidade; ordem usa `orderKey` estável por pai e operações com `baseRevision`. Aulas podem ter zero ou vários assuntos, mas cada link é único e do mesmo edital/disciplina.

**Contratos:** `Assunto {id, editalDisciplineId, title, parentId|null, orderKey, provenance}`, `Aula {id, editalDisciplineId, title, orderKey, provenance}`, `LessonTopicLink {id, aulaId, assuntoId, profileId, localRevision}` com unicidade `(aulaId, assuntoId)`, mesmo edital/disciplina e `parentId` na mesma árvore. O payload remoto usa envelope `{profileId, entityType, entity}`; o fake/adapters F2 não presumem `profileId` no objeto interno. Impacto F1: novos `entityType` na outbox; nenhuma alteração na entidade Subject. Testes: homônimos, aula com múltiplos assuntos, aula sem assunto, link cruzando editais rejeitado, reordenação concorrente, proveniência. Riscos: árvores profundas e exclusão de assunto com aulas/sessões. **Decisão humana:** confirmar aulas escopadas ao edital e N‑N de assuntos.

#### D-F2-03 — Migração das disciplinas F1

**Proposta:** migração versionada que preserva IDs, títulos, revisões e histórico de `StudySubject`. Nenhum subject é vinculado automaticamente a um edital. O resultado inicial é uma fila “não vinculadas”; o usuário escolhe edital/associação em operação explícita e idempotente. `EditalDiscipline` é criada por `LINK_EXISTING` (edital existente) ou `CREATE_EDITAL_AND_LINK` (edital novo + vínculo na mesma transação); `LEAVE_UNASSIGNED` mantém o subject disponível. O outbox existente continua válido; a migração não reescreve operações históricas.

**Contrato proposto:** `MigrateF1Subjects {operationId, profileId, decisions: [{subjectId, decision:'LINK_EXISTING'|'CREATE_EDITAL_AND_LINK'|'LEAVE_UNASSIGNED', editalId?, newEdital?}]}` com relatório de contagens, IDs preservados e rollback em falha. `LINK_EXISTING` exige edital ativo; `CREATE_EDITAL_AND_LINK` cria edital + `EditalDiscipline` na mesma transação; `LEAVE_UNASSIGNED` mantém o subject. Testes: IDs/revisões inalterados, nenhum auto-link, leitura da fila, replay idempotente, decisão parcial, rollback transacional. Riscos: subjects órfãos e expectativa de vínculo automático. **Decisão humana:** aprovar a política de não auto-vincular.

#### D-F2-04 — Arquivamento, exclusão lógica e remoção física

**Comparação:** arquivamento preserva o registro e apenas o remove dos fluxos ativos; exclusão lógica cria tombstones causais e permite restauração; remoção física elimina dados e dificulta reconciliação. **Recomendação:** arquivamento e exclusão lógica no F2; nenhuma remoção física de conteúdo histórico sem backup, preview e autorização específica. Exclusão de assunto com aulas/sessões gera quarentena/bloqueio ou vínculo explícito, nunca cascata destrutiva. Tombstones ficam em store próprio com `profileId`, `entityType`, `entityId`, `operationId`, `baseRevision`, `epoch` e `deleted:true`; `currentEpoch` é persistido em `meta`. Dispositivo desatualizado converge por epoch/rebaseline, não por TTL arbitrário.

**Contrato:** `ArchiveEdital`, `ArchiveEditalDiscipline`, `SoftDeleteEntity` e `RestoreEntity` com `operationId`, `baseRevision` e epoch. Delete de entidade nunca sincronizada grava tombstone em revisão 1; upsert sobre tombstone retorna `CONFLICT/DELETED` e exige `RestoreEntity`; não apagar tombstone silenciosamente. Testes: arquivar não apaga, exclusão com dependências, delete de inédito, upsert sobre tombstone, edição concorrente com exclusão, dispositivo antigo, restauração. Riscos: ressurreição e perda de histórico. **Decisão humana:** confirmar que purge físico fica fora do F2.

#### D-F2-05 — Importação de editais

**Achados V1:** `validateEditalImportPayload` aceita `versao:1`/`tipo:'edital'`; `canonicalize` deduplica por nome normalizado; `buildEditalSourceIdentity` usa `centralId`/`sourceRef`/nome; `buildEditalImportPlan` compara nomes e proveniência e cria `targetSignature`; `applyEditalImport` aplica no array em memória. O matching por nome isolado é insuficiente e não há staging transacional de importação grande.

**Proposta:** parser validado com limites provisórios (2 MiB, profundidade 20, 5.000 entidades por importação, título de exibição ≤120, chave de matching ≤200, sem HTML executável), canonicalização que nunca deduplica por nome sem proveniência, identidade com precedência `centralId > sourceRef > nameKey` (compatível com V1), `nameKey = normalização lowercase/NFD sem acentos/espaços extras` usada apenas como sinal, `fingerprint = SHA-256 do JSON canônico de conteúdo+proveniência` e `sourceRevision` para divergência, prévia com contagens e conflitos, `targetSignature`/revisão de destino, confirmação explícita, `importId` idempotente e staging/quarentena. Importações até o limite local usam uma transação IDB; acima disso exigem job com checkpoint, máquina de estados e publicação atômica, sem estado parcial visível.

**Comparações:** idêntico = no-op auditado; semelhante = prévia de merge/conflito, sem auto-merge; divergente = conflito/quarentena; interrompido = retomada ou rollback sem confirmação falsa. Testes: mesmos bytes, nome igual com proveniência diferente, revisão divergente, interrupção, replay, HTML hostil, limites. Riscos: duplicação de árvore e importação parcial. **Decisão humana:** aprovar limites e política de staging.

#### D-F2-06 — Perfis, outbox e operações F2

**Proposta:** estender a única `OutboxOperation` com `entityType: 'subject'|'edital'|'edital-discipline'|'assunto'|'aula'|'lesson-topic-link'`, payload discriminado, `profileId`, `uid`, `baseRevision`, `sequence`/`createdAt` e `attempts`/`lastAttemptAt`; manter um coordenador, um índice por `profileId/status` e os stores `operations`/`outbox`/`conflicts`. Usar o store `profiles` para binding/consentimento local, sem UID em dados exportáveis. `LOGOUT` suspende/quarentena operações do UID anterior e flush exige `operation.uid == binding.uid`; `LinkPreview` mostra contagens local e remota. Nenhuma fila paralela, escrita direta da UI ou operação sem `profileId`.

**Contrato:** operação inclui `operationId`, `profileId`, `uid`, `entityType`, `entityId`, `kind`, `baseRevision`, `schemaVersion`, payload validado, `sequence`, `attempts` e status; `ResolveConflict` e `CommitService` (`INVALID` explícito) fazem parte do contrato. Replay exato é idempotente; divergência/hash diferente falha; `ALREADY_APPLIED` compara o hash. Backoff exponencial provisório: base 1 s, teto 5 min, jitter 0–20%, máximo 5 tentativas antes de `PAUSED_*`/terminal; timeout/watchdog e erros determinísticos não entram em retry infinito. Testes: perfil errado, rebind/logout, repetição, conflito/resolução, quota, ACK/read-back, duas abas, backoff e erro terminal. Riscos: crescimento do outbox e migração de operações antigas. **Decisão humana:** aprovar a extensão do contrato e o uso do store `profiles`.

## 6. TDD, casos adversariais e evidências

| Caso | Evidência exigida |
| --- | --- |
| Criar/renomear hierarquia e reiniciar app | Mesmo ID e relações restauradas do IndexedDB |
| Duas disciplinas com mesmo nome em editais diferentes | Nenhum merge baseado apenas no título |
| Importar o mesmo JSON duas vezes | Sem duplicação; relatório consistente e idempotência |
| JSON inválido, enorme, profundo ou com HTML hostil | Validação segura, sem XSS, sem travamento ou commit parcial |
| Arquivar/trocar edital principal | Histórico de sessões/revisões intacto; nenhuma exclusão automática |
| Deletar assunto com aulas/sessões relacionadas | Referências preservadas, bloqueio ou quarentena explícita |
| Offline, reload, quota e dois tabs | Salvamento local atômico, status sincero, retries idempotentes |
| Alterações paralelas em conteúdo vinculado | Conflito registrado; não sobrescrever silenciosamente |
| Importação legado (fixtures V1) | Contagens e mapa de IDs reconciliados; desconhecidos não descartados |
| Testes visuais Impeccable | Oito temas, mobile/tablet/desktop, foco e contraste com evidência |

**Critério de aceite F2:** todas as seis funcionalidades principais entregues ou exceções formalmente aprovadas; integridade de hierarquia e importação; UI acessível com Impeccable 3.9.1/A-01 e evidência dos oito temas; testes RED→GREEN/integração/E2E locais com resultados reais; **modelo de custo/limites do Firestore aprovado** (auditoria §6.2; ou exceção explícita para F7); dados sintéticos; nenhuma alteração V1; código integrado à `v2`, revisão independente, relatório na issue #108 e **aceite humano específico**.

### 6.1 Matriz de testes F2 proposta

| ID | Camada | Condição inicial → ação | Esperado | Falha |
| --- | --- | --- | --- | --- |
| F2-T01 | unit/integration | Criar, renomear e reabrir edital/disciplina/assunto/aula | IDs e relações preservados; revisão incrementada uma vez | Perda de campo, ID trocado ou duplicação |
| F2-T02 | unit/integration | Mesmo `StudySubject` associado a dois editais | Duas `EditalDiscipline`, um subject canônico | Cópia silenciosa ou merge por título |
| F2-T03 | unit/integration | Disciplinas homônimas em editais diferentes | IDs distintos, nenhuma fusão automática | Matching por nome |
| F2-T04 | integration | Assunto com parentId inválido/ciclo | Rejeição determinística `INVALID_PARENT` | Árvore corrompida |
| F2-T05 | integration | Aula vinculada a vários assuntos | Links únicos e preservados | Link duplicado/perdido |
| F2-T06 | unit/integration | Reordenar dois irmãos com baseRevision concorrente | Ordem final determinística por `orderKey`; conflito se base mudou | Ordem silenciosamente perdida |
| F2-T07 | integration/E2E | Trocar/arquivar edital principal | Escopo ativo muda; histórico intacto | Exclusão ou reescrita de histórico |
| F2-T08 | integration/E2E | Arquivar e reativar edital | Estado reversível, sem perda | Reativação sem consentimento |
| F2-T09 | integration | Excluir assunto com aulas/sessões | `CONFLICT/DEPENDENCY` + quarentena; vínculo explícito | Cascata destrutiva/ressurreição |
| F2-T10 | unit/E2E | Importar JSON idêntico duas vezes | Mesmo resultado, sem nova árvore | Duplicação |
| F2-T11 | unit/E2E | Importar nome igual com proveniência diferente | Prévia e conflito, sem auto-merge | Merge por nome |
| F2-T12 | integration | Importar mesma proveniência com revisão divergente | Conflito/quarentena, dados preservados | Overwrite |
| F2-T13 | integration/E2E | Interromper importação no meio | Nenhum estado parcial visível; resume/rollback | Commit parcial |
| F2-T14 | unit/integration | Reutilizar `operationId` com payload igual/divergente | Igual idempotente; divergente falha | Segundo efeito |
| F2-T15 | browser E2E | Duas abas editam a mesma entidade | Um commit/conflito explícito | Lost update |
| F2-T16 | integration/emulator | Dois dispositivos simulados editam entidade independente | Convergência por IDs/revisões | Sobrescrita ou bloqueio global |
| F2-T17 | integration/E2E | Quota/abort no meio de conteúdo | Sem commit parcial; UI sincera | Falso “salvo” |
| F2-T18 | unit/integration | Backup sintético com tombstones e restore antigo | Preview/`REBASELINE`; sem ressurreição | Restore destrutivo |
| F2-T19 | unit/integration | Perfil/UID errado tenta ler/escrever | Negado sem mistura de dados | Vazamento entre perfis |
| F2-T20 | E2E visual | Oito temas, mobile/tablet/desktop, teclado, contraste e medição de alvo coarse | AA/foco na amostra; toque medido; sem toast bloqueante | Regressão A-01 |
| F2-T21 | unit/E2E | Regressões F1 (subject, outbox, backup, PWA, IDB) | baseline 84/20 adaptado e verde | Regressão da fundação |
| F2-T22 | emulator futuro | CAS/ACK/replay/read-back e Rules por UID | Um efeito lógico; UID errado negado; conflito preservado | Falso PASS de sync real |
| F2-T23 | integration/E2E | `MigrateF1Subjects` com LINK_EXISTING, CREATE_EDITAL_AND_LINK e LEAVE_UNASSIGNED | IDs/revisões preservados; nenhum auto-link; replay idempotente | ID perdido ou vínculo automático |
| F2-T24 | integration | Fixtures V1 editais → F2 | Contagens/relacionamentos reconciliados; desconhecidos em quarentena | Perda de árvore ou merge por nome |
| F2-T25 | integration/E2E | Conflito remoto → `ResolveConflict` | Nova operação explícita; ambos os lados preservados; converge | Conflito terminal ou overwrite |
| F2-T26 | integration | Delete de inédito → tombstone rev1; upsert posterior | `CONFLICT/DELETED`, `RestoreEntity` exigido | Delete sem ACK/ressurreição |
| F2-T27 | unit/E2E | LOGOUT com outbox do UID anterior e rebind uid-b | Outbox suspensa/quarentenada; flush bloqueado | Acervo antigo enviado à conta nova |
| F2-T28 | unit/integration | CommitService com título inválido/121 chars e create duplicado | `INVALID` explícito, sem `UNAVAILABLE` falso | Erro de domínio mascarado |
| F2-T29 | integration | Upgrade IDB F1→F2 com stores/índices existentes e duas abas | Migração idempotente; bloqueio/retomada segura | Índice ausente ou DB bloqueado |
| F2-T30 | integration | Trocar principal/arquivar principal em duas abas | Um `primaryEditalId` ou estado sem principal explícito | Dois principais |
| F2-T31 | integration | Backup F1 lido por código F2; subject+tombstone do mesmo ID | `REBASELINE_REQUIRED`/invalidação fechada; nada ressuscita | Backup antigo tratado como SAFE |

Os testes de emulador são **futuros** e dependem de autorização separada; não substituem F7 nem homologam Google Sign-In, quota física ou multi-dispositivo real.

## 7. Fora do escopo e decisões em aberto

F3 assume planejamento e Reta Final; F4 assume sessões; F5 inteligência; F6 dashboard; F7 homologa sync/backup/migração completa; F8 cutover. Não construir essas features inteiras em F2.

**Decisões a confirmar na aprovação F2:** relação exata entre `StudySubject` F1 e disciplina por edital; migração/mapeamento dos dados F1; se aulas podem pertencer a mais de um edital; política de arquivamento/exclusão e tombstones; matches de importação; limites concretos do parser; uso do store `profiles`; e autorização do ensaio com emulador. A spec revisada não substitui aprovação humana dessas escolhas.

**Gate:** `F2_SPEC_REVISED` (esta revisão) → aprovação humana específica → autorização separada do ensaio com emulador → writing-plans F2 → aprovação do plano/método → GOAL F2 → TDD/revisão/evidências → aceite humano F2. **Nenhuma dessas transições ocorre pela publicação deste documento.**

## 8. Registro desta revisão

- **2026-10-28:** F1 aceita pelo proprietário com ressalvas no commit `85ce1e3`; quatro HIGH continuam `UNVERIFIED` e Firebase/multi-dispositivo não foram homologados.
- Contratos efetivamente entregues pela F1 foram incorporados em §2.1–2.2; lacunas de `StudySubject`/`Disciplina`, perfil e outbox ficam explícitas.
- A proposta de ensaio antecipado com Firebase Emulator foi consolidada em §5.1, sem execução e sujeita a autorização separada.
- Nenhum código F2, writing-plans, instalação de emulador, Firebase real ou deploy foi iniciado por esta revisão.
