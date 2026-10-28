# Estudo Organizado V2 — Prontidão de design F2

**Data:** 2026-10-28 (America/Fortaleza)
**Branch:** `v2`
**HEAD inicial desta rodada:** `24cefec`
**F1 de referência:** `85ce1e3`, aceita com ressalvas
**Spec F2:** `F2_SPEC_REVISED — PENDING_HUMAN_APPROVAL`
**Gate proposto:** `F2_SPEC_READY_FOR_HUMAN_REVIEW`
**Escopo executado:** investigação, auditoria, contratos, matriz de testes e documentação. Nenhum código F2, writing-plans, emulador, Firebase real ou deploy.

## 1. Resumo executivo

A F1 entrega uma base reutilizável e testada: domínio `StudySubject`, IndexedDB próprio com transação atômica, outbox única, contratos A-02 simulados, backup/tombstones, reconhecimento legado, PWA e UI acessível. A F2 não precisa de uma segunda arquitetura; precisa estender essa base com associações edital↔disciplina, conteúdo hierárquico, importação conservadora, perfis explícitos e política de exclusão.

As seis decisões D-F2-01..06 foram analisadas e estão registradas como **PROPOSED**, não aprovadas. A recomendação central é preservar `StudySubject` como conteúdo canônico e criar `EditalDiscipline` como associação; manter uma única outbox; não auto-vincular disciplinas F1 a editais; tratar arquivamento/exclusão lógica como operações explícitas; e usar importação com proveniência, prévia, staging e idempotência.

A validação local reexecutou a F1 sem alterações de código: typecheck/lint/build PASS, **84 testes unitários** e **20 E2E** PASS, com os quatro riscos HIGH ainda `UNVERIFIED`.

## 2. Preflight e estado Git

| Item | Estado verificado |
| --- | --- |
| `main` / `origin/main` | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` |
| `v2` / `origin/v2` no início | `24cefec46e6657c5228ded9407bb4c93a7a67944` |
| Árvore | limpa; sem stashes |
| Worktrees | V1 em `Downloads/Github/estudo-organizado`; V2 em `.codex/worktrees/v2-f0-audit/estudo-organizado` |
| PRs abertos | nenhum |
| Código F1 | `apps/v2/` (69 arquivos versionados no início desta rodada) |
| Publicação | workflow de cache só dispara em `main`; V2 não entra no deploy da V1 |
| Isolamento | origem `127.0.0.1:18431`, DB `estudo-organizado-v2`, SW próprio |

Nenhuma alteração em `src/`, root `package.json`/lockfile, `firestore.rules`, `.github/workflows`, Cloudflare ou `main` foi feita nesta rodada.

## 3. Auditoria F1 → F2 por contrato

Classificação: **REUTILIZAR** (sem mudança de contrato), **ESTENDER** (adicionar campos/casos), **MIGRAR** (transformar dados/versão), **SUBSTITUIR** (não recomendado sem ADR) e **NÃO NECESSÁRIO**.

| Contrato F1 | Arquivos/evidência | Classificação | Justificativa/risco |
| --- | --- | --- | --- |
| `StudySubject` e comandos | `apps/v2/src/domain/subject.ts`; `tests/unit/subject.test.ts` | **REUTILIZAR + ESTENDER** | ID/título/revisão são base para conteúdo canônico; F2 adiciona associação, não muda a identidade |
| Versões independentes | `domain/versions.ts` | **ESTENDER** | F2 exige nova versão de domínio/IDB/backup; não reutilizar 12/11/9/7 da V1 |
| IndexedDB/atomicidade | `platform/indexeddb.ts`, `local-subject-repository.ts` | **REUTILIZAR + ESTENDER** | Mesma transação entidade+operação+outbox; F2 adiciona stores/índices por migração |
| Stores `subjects/profiles/operations/outbox/meta/conflicts` | `platform/indexeddb.ts`; testes unitários/E2E | **REUTILIZAR** | `profiles` existe sem uso pleno; F2 deve definir binding persistido, sem criar DB paralelo |
| Idempotência por `operationId` | `local-subject-repository.ts`; `subject-service.test.ts` | **REUTILIZAR** | Comando persistido é comparado integralmente; F2 estende o payload discriminado |
| Outbox única/ACK | `application/sync-types.ts`, `platform/sync/flush.ts`; `outbox-flush.test.ts` | **ESTENDER** | Adicionar `entityType`/payloads F2, mantendo um coordenador e uma fila |
| CAS/read-back/conflito fake | `platform/sync/fake-remote.ts`; `remote-contract.test.ts` | **REUTILIZAR (contrato)** | Não homologa Firestore real; F2 pode reutilizar o contrato e o harness de testes |
| Web Locks/duas abas | `platform/sync/coordination.ts`; E2E `two-tabs` | **REUTILIZAR** | Fallback sem lock continua bloqueante; F2 não deve inventar lock em memória |
| Consentimento/perfil | `sync-policy.ts`; `sync-policy/profile-isolation` | **ESTENDER** | F2 precisa persistir binding no store `profiles` e preview por edital, com UID explícito |
| Backup/tombstones | `backup/format.ts`, `backup/restore.ts`; testes | **ESTENDER** | Formato próprio e `deletionHistoryComplete`; F2 adiciona entidades, não outro formato |
| Reconhecimento legado | `legacy/recognize.ts`; fixtures 180 blocos | **REUTILIZAR** | Importador F2 deve usar a mesma quarentena/proveniência; não presumir plano ausente |
| UI/temas/PWA | `presentation/*`, `public/*`; 20 E2E | **REUTILIZAR** | F2 reaproveita tokens/componentes; não redesenha a fundação |
| Harness E2E | `e2e-harness.ts`, `vite.config.ts`, `playwright.config.ts` | **REUTILIZAR** | Só build `e2e`; não exposto no build de produção |

**Lacunas que F2 deve resolver antes de codar:** relação `StudySubject ↔ EditalDiscipline`; uso dos stores `profiles`/`meta`; extensão da outbox para novos `entityType`, `uid`, `sequence` e `attempts`; conflito com payload remoto/`entityType`/`deleted` e `ResolveConflict`; store durável de tombstones/`currentEpoch` e delete de entidade inédita; `CommitService` com `INVALID` explícito e ordem por entidade; política de importação acima do limite transacional; UI de backup/restauração; e semântica de `delete`/tombstones para conteúdo. Essas lacunas são **requisitos de extensão**, não contratos já entregues.

## 4. Decisões D-F2-01..06 (PROPOSED)

### D-F2-01 — `StudySubject` e disciplina por edital

| Alternativa | Prós | Contras |
| --- | --- | --- |
| A. `editalId` no `StudySubject` | Consulta direta; menos joins | Duplica conteúdo entre editais; quebra identidade canônica; migração exige atribuição forçada |
| B. `StudySubject` + `EditalDiscipline` | Preserva ID/reuso; ordem/apresentação isoladas; migração não destrutiva | Duas entidades e consultas/índices adicionais |
| C. Disciplinas independentes por edital | Isolamento máximo e modelo simples por edital | Duplicação, reconciliação por nome/heurística e histórico fragmentado |

**Recomendação B.** `EditalDiscipline {id, profileId, editalId, subjectId, displayOrder, localRevision}`, com unicidade `(profileId, editalId, subjectId)` e índices por edital/subject. A associação não duplica título canônico; usa o título do `StudySubject`, com alias opcional apenas se aprovado. §2/§4/T01-T03 são condicionais a B; A/C exigem reescrita. Impacto F1: nova entidade/índice/migração, sem alterar `StudySubject` existente. Testes: homônimos, mesmo subject em dois editais, rename canônico refletido, remoção de associação sem apagar subject, replay idempotente. Riscos: joins e migração de subjects sem vínculo. **Aceite humano necessário.**

### D-F2-02 — Assuntos, aulas e relações

**Recomendação:** Edital 1‑N `EditalDiscipline`; `EditalDiscipline` 1‑N `Assunto` (árvore por `parentId`, `orderKey`); `EditalDiscipline` 1‑N `Aula`; `Aula` N‑N `Assunto` via `LessonTopicLink` com unicidade `(aulaId, assuntoId)` e mesmo edital/disciplina. Aula é escopada ao edital nesta fase; reutilização entre editais por cópia/importação com proveniência, não por identidade implícita. Título não é identidade; aulas podem ter zero ou vários assuntos; link duplicado ou cruzando edital é inválido. Impacto F1: novos `entityType` na outbox e stores; nenhum shared global. Testes: homônimos, múltiplos assuntos, assunto sem aula, link cruzado, reordenação concorrente, proveniência. Riscos: árvore profunda e exclusão com dependências. **Aceite humano necessário.**

### D-F2-03 — Migração das disciplinas F1

**Recomendação:** preservar IDs, títulos, revisões e operações existentes; criar zero vínculos automáticos. Subjects F1 aparecem em “não vinculadas” até uma decisão explícita, com `ListUnassignedSubjects` e uma jornada de migração visível. Contrato `MigrateF1Subjects {operationId, profileId, decisions:[{subjectId, decision:'LINK_EXISTING'|'CREATE_EDITAL_AND_LINK'|'LEAVE_UNASSIGNED', editalId?, newEdital?}]}`; `LINK_EXISTING` exige edital ativo; `CREATE_EDITAL_AND_LINK` cria edital + `EditalDiscipline` na mesma transação; `LEAVE_UNASSIGNED` mantém o subject. Relatório de contagens, falha fechada e replay idempotente. Testes: IDs/revisões inalterados, nenhum auto-link, leitura dos não vinculados, parcial e rollback (F2-T23/T24). Riscos: usuário esperar vínculo automático e subjects órfãos. **Aceite humano necessário.**

### D-F2-04 — Arquivamento, exclusão lógica e remoção física

**Recomendação:** arquivamento e exclusão lógica no F2; purge físico fora do F2. Arquivar remove dos fluxos ativos sem apagar dependências; soft delete grava tombstone causal `{profileId,entityType,entityId,operationId,baseRevision,epoch,deleted:true}` em store próprio, com `currentEpoch` persistido em `meta`. Delete de entidade nunca sincronizada grava revisão 1; upsert sobre tombstone retorna `CONFLICT/DELETED` e exige `RestoreEntity`. Assunto com aulas/sessões exige bloqueio/quarentena/vínculo explícito, nunca cascata. Edição concorrente com exclusão preserva ambos os lados. Dispositivo antigo converge por epoch/rebaseline, não TTL arbitrário. Testes: arquivar/reativar, delete com dependências, delete de inédito, upsert sobre tombstone, edição vs delete, dispositivo antigo, restore. Riscos: ressurreição e perda de histórico. **Aceite humano necessário.**

### D-F2-05 — Importação de editais

**Achados V1:** validação de `versao:1`/`tipo:'edital'`; canonicalização por nome; identidade por `centralId`/`sourceRef`/nome; plano com `targetSignature`; aplicação no array em memória. O matching por nome isolado é insuficiente e não há staging transacional para lotes grandes.

**Recomendação:** parser com limite provisório (2 MiB, profundidade 20, 5.000 entidades por importação, título de exibição ≤120, chave de matching ≤200), rejeição de HTML/script, identidade com precedência `centralId > sourceRef > nameKey` e `fingerprint = SHA-256 do JSON canônico de conteúdo+proveniência`, `sourceRevision` para divergência, canonicalização sem deduplicar por nome sem proveniência, prévia de criação/reuso/conflito, confirmação explícita, `importId` idempotente e staging/quarentena. Importação pequena em uma transação IDB; grande em job com checkpoint, máquina de estados e publicação atômica, sem estado parcial visível. Comparações: idêntico → no-op; semelhante → conflito/preview; divergente → quarentena; interrompido → resume/rollback. Testes: bytes idênticos, nome igual/proveniência diferente, revisão divergente, fingerprint V1, 120/121, interrupção, replay, HTML hostil, limites. Riscos: duplicação e importação parcial. **Aceite humano necessário.**

### D-F2-06 — Perfis e extensão da outbox

**Recomendação:** uma única outbox/coordenador; `OutboxOperation.entityType` estendido para `subject|edital|edital-discipline|assunto|aula|lesson-topic-link`; payload discriminado, `profileId`, `uid`, `baseRevision`, `schemaVersion`, `sequence`/`createdAt`, `attempts`/`lastAttemptAt`, status. Store `profiles` persiste binding/consentimento local sem UID em exportações; `LinkPreview` inclui contagens local/remota. `LOGOUT` suspende/quarentena operações do UID anterior; flush exige `operation.uid == binding.uid`. Adicionar `ResolveConflict` e `CommitService` com `INVALID` explícito; ordenar/coalescer por entidade; timeout/watchdog; erros determinísticos não entram em retry infinito. Nenhuma fila paralela ou escrita direta da UI. Replay exato idempotente; payload/hash divergente falha. Testes: perfil errado, rebind/logout, repetição, conflito/resolução, quota, ACK/read-back, duas abas, erro terminal. Riscos: migração de operações antigas e crescimento do outbox. **Aceite humano necessário.**

## 5. Validação reexecutada da F1

| Comando | Resultado |
| --- | --- |
| `npm --prefix apps/v2 run typecheck` | **PASS** |
| `npm --prefix apps/v2 run lint` | **PASS** |
| `npm --prefix apps/v2 run test:unit` | **PASS** — 15 arquivos, 84 testes |
| `npm --prefix apps/v2 run test:e2e` | **PASS** — 20 testes |
| `npm --prefix apps/v2 run build` | **PASS** — 231,55 kB / 72,62 kB gzip |
| Isolamento V1 | **PASS** — origem/DB/SW próprios; harness só no build E2E |

Os 84/20 coincidem com a evidência aceita. Nenhum FAIL/NOT_RUN novo. Firebase, emulador, quota física e multi-dispositivo continuam **NOT_RUN/UNVERIFIED**. Os 107 FAIL E2E da V1 permanecem como baseline histórico.

## 6. Sincronização A-02 e custos

### 6.1 Estruturas comparadas

**A. Entidade por documento + documento-resumo** (recomendada): `users/{uid}/editais/{id}`, `editalDisciplines/{id}`, `assuntos/{id}`, `aulas/{id}`, `lessonTopicLinks/{id}` e um resumo de edital para listagem. Documentos pequenos, CAS por entidade, consultas indexadas e deltas. Custo: mais documentos/índices e consultas; menos rewrite e conflito.

**B. Agregado por edital**: um documento por edital contendo disciplinas/assuntos/aulas. Menos documentos e leitura simples, mas qualquer edição reescreve o agregado inteiro, aumenta conflito, dificulta deltas e pode chegar perto de 900 KB/1 MiB. Não usar como fonte central; opcionalmente como projeção/resumo.

**Recomendação A**, com resumo derivado para listas. Não criar snapshot monolítico. O documento F1 de 900.000 bytes é margem conservadora; 1.048.576 é o teto teórico do Firestore, não meta. O agregado por edital não fica automaticamente perto do limite nos conjuntos abaixo (~225 itens/edital, ~27 KB a 120 B/item); ele só vira risco se um único edital concentrar milhares de itens ricos, o que deve ser medido no ensaio.

### 6.2 Estimativas sintéticas (premissas explícitas)

Premissas: Spark com 20.000 escritas/dia, 50.000 leituras/dia, 20.000 deletes/dia e 1 GiB (premissa a confirmar no console/emulador; não medida nesta fase); 1 escrita por alteração por dispositivo; 2 leituras por alteração; sem listeners contínuos; links contam como documentos; lotes remotos ≤500 escritas; nenhuma cobrança habilitada.

| Conjunto | Editais | Disc. assoc. | Subjects | Assuntos | Aulas | Links | Docs A (entidade+resumo) | Docs B (agregado+resumo) | Seed A/B (1 autor) | Seed 3 importadores A | Leitura árvore A/B por abertura | Alterações/dia | Escritas/dia (3 disp.) | Leituras/dia (2× mudanças) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pequeno | 1 | 5 | 5 | 50 | 100 | 100 | 262 | 2 | 262 / 2 | 786 | 262 / 2 | 20 | 60 | 120 |
| Médio | 5 | 30 | 30 | 300 | 600 | 600 | 1.570 | 10 | 1.570 / 10 | 4.710 | 1.570 / 10 | 100 | 300 | 600 |
| Grande | 20 | 150 | 150 | 1.500 | 3.000 | 3.000 | 7.840 | 40 | 7.840 / 40 | 23.520 | 7.840 / 40 | 300 | 900 | 1.800 |

Fórmula A: editais + associações + subjects + assuntos + aulas + links + um resumo por edital. Fórmula B: um agregado + um resumo por edital. “Seed 3 importadores A” é o cenário em que cada um dos três dispositivos importa o conjunto inteiro; o grande ultrapassa 20.000 escritas/dia. O cenário recomendado é semear uma vez e os outros dispositivos baixarem por leitura. A leitura de árvore A/B é o custo de abrir o conjunto completo uma vez; no grande, ~6 aberturas completas/dia já consomem ~47.000 das 50.000 leituras. Alterações/dia ainda não incluem listeners/reentrega. O modelo B reduz seed e leitura de catálogo, mas reescreve o agregado a cada edição e amplia conflito; não é fonte central. O conjunto grande exige lotes de até 500 escritas (16 lotes), idempotência/backoff e validação de custo; não tratar estimativa como custo faturado.

### 6.3 Protocolo F2_EMULATOR_REHEARSAL

O protocolo completo está na spec F2 §5.1: pré-requisitos, projeto `demo-*`, Auth/Firestore emulados, Rules V2, fixtures de duas identidades, CAS/ACK/replay/read-back, concorrência, quota/tamanho, PASS/FAIL e condições de homologação real. **Não foi executado** e exige autorização separada; emulador não prova Google Sign-In, quota física, Rules publicadas ou dispositivos reais.

## 7. Cobertura do inventário F0

| Feature aprovada | Cobertura F2 proposta | Gap/risco |
| --- | --- | --- |
| `F-V1-EDITALS-CRUD` | edital, associação, assuntos, aulas, reorder e CRUD | exclusão com dependências |
| `F-V1-PRINCIPAL-EDITAL` | preferência explícita por perfil e escopo ativo | troca concorrente |
| `F-V1-ARCHIVED-EDITALS` | arquivamento/reativação e leitura histórica | purge físico fora do F2 |
| `F-V1-VERTICAL-EDITAL` | projeção por árvore/progresso | progresso depende de F4 |
| `F-V1-EDITAL-IMPORT` | parser, proveniência, preview, staging, idempotência | limites ainda não medidos |
| `F-V1-LESSON-MAPPER` | N‑N aula↔assunto com revisão | reuso entre editais explícito |

**Cobertura ainda a detalhar no writing-plans:** busca/filtro por status, cores/ícones, aulas em lote, primeira escolha de edital principal, dashboard arquivado e sugestão de mapeamento de aulas não têm contrato/teste específico nesta revisão. Progresso vertical depende de F4 e dashboard completo de F6; essas partes devem aparecer como exceção/phase-out no plano, não como entregues pela F2.

O laboratório visual continua fora da F2; nenhuma feature F0 é declarada entregue apenas por esta spec.

## 8. Custo, complexidade e overengineering

- Reutilizar `apps/v2` e os serviços F1 evita um segundo IndexedDB, outbox, PWA e harness de testes.
- `EditalDiscipline` acrescenta uma entidade e índices, mas evita duplicação de subjects e reconciliação por nome.
- Um ORM, backend próprio, event sourcing integral, fila paralela, múltiplos PRs ou GitHub Actions não são necessários.
- A importação grande não justifica um servidor; staging local com job/checkpoint e publicação atômica é suficiente para o escopo F2.
- O emulador é um ensaio local, não uma nova infraestrutura de produção; se não autorizado, a homologação permanece F7.

## 9. Revisão independente

**Primeira revisão adversarial:** `REPROVADO` no rascunho (HEAD `24cefec` antes das correções), com oito P1:

1. duas definições concorrentes de disciplina;
2. conflito terminal, sem payload remoto nem `ResolveConflict`;
3. rebind de UID sem quarentena/UID no outbox;
4. ausência de store/epoch de tombstones e delete de inédito sem ACK;
5. migração F1 sem `ListUnassignedSubjects`/teste;
6. identidade de importação e limites 120/200 ambíguos;
7. conta de custo inconsistente e claim indevido de Spark;
8. `CommitService`/`INVALID`, ordem por entidade, attempts e timeout ausentes.

**Correções documentais aplicadas:** modelo B explicitamente condicional e sem título duplicado; conflito com payload remoto/`entityType`/`deleted` e `ResolveConflict`; outbox com UID/sequência/attempts e quarentena no logout; store de tombstones/`currentEpoch`, delete em revisão 1 e `RestoreEntity`; migração com leitura de não vinculados e T23/T24; identidade de importação com precedência/fingerprint e 120/200; tabela de custo com fórmulas, leituras de árvore e cenário 3×7.840 > 20.000; `CommitService`/`INVALID`, ordem/coalescência, backoff e timeout. A matriz foi ampliada para T01..T31.

**Segunda revisão:** `REPROVADO` com dois P1 parciais — faltava a jornada de migração em §3 e a política de backoff normativa. Corrigidos: jornada 6, `MigrateF1Subjects`/`SoftDeleteEntity`/`ArchiveEditalDiscipline`/`RestoreEntity`/`ResolveConflict`/`CreateEditalAndLinkSubject` em §4, `ListUnassignedSubjects` como consulta, contrato `LINK_EXISTING|CREATE_EDITAL_AND_LINK|LEAVE_UNASSIGNED`, backoff exponencial (base 1 s, teto 5 min, jitter 0–20%, máximo 5) e forma do `ConflictRecord`.

**Terceira checagem focada:** apontou dois P1 documentais residuais — literais de enum de migração inconsistentes e este registro ainda sem o veredito da segunda revisão. Ambos foram corrigidos: §5.2, D-F2-03, T23 e este relatório usam os três valores; o registro acima está preenchido. **Veredito consolidado: `APROVADO_PARA_REVISAO_HUMANA`.** O aceite da spec continua humano e pendente.

## 10. Matriz de testes e próximos passos

A matriz completa está na spec F2 §6.1 (F2-T01..T31), cobrindo CRUD, hierarquia, reordenação, principal, arquivamento, importação, matching, rollback, idempotência, duas abas, dois dispositivos, quota, backup, perfil, migração F1, conflito/resolução, tombstone/restore, logout/rebind, `CommitService`, upgrade IDB, principal único, backup v1→v2, acessibilidade, regressões F1 e emulador futuro. Casos críticos têm condição inicial, ação, esperado e falha.

**Gate proposto:** `F2_SPEC_READY_FOR_HUMAN_REVIEW`; a spec permanece `F2_SPEC_REVISED — PENDING_HUMAN_APPROVAL`. A aprovação humana deve decidir D-F2-01..06, limites de importação, política de purge e autorização do ensaio. O modelo de custo precisa de PASS explícito: o cenário grande com três importadores independentes (23.520 escritas) excede a premissa de 20.000/dia do Spark; a estratégia recomendada é semear uma vez e propagar por leitura, ou dividir a importação com aprovação. Se isso não for aceito, o gate deve ir para `F2_SPEC_BLOCKED`/exceção de custo, não para um PASS implícito. Só depois o writing-plans F2 pode ser produzido.

## 11. Git e higiene

- `main`/`origin/main`: `9046cfa`, intocadas.
- `v2`: `24cefec` no início; as mudanças desta rodada são somente a spec F2, este relatório, roadmap, handoff e issue #108.
- Nenhum PR, Action, deploy, Firebase real ou alteração em `apps/v2`, `src/`, rules, Cloudflare ou package raiz.
- Branches documentais antigas preservadas; nenhum worktree novo.

## 12. Próximo gate

1. Revisar D-F2-01..06 e a matriz de testes.
2. Aprovar ou rejeitar a spec revisada.
3. Se aprovada, autorizar writing-plans F2 separadamente.
4. Autorizar `F2_EMULATOR_REHEARSAL` somente em etapa própria, sem confundir com homologação real.

## 13. Revisão arquitetural complementar pelo ChatGPT + Superpowers (2026-10-28)

**Finalidade:** revisar as escolhas, contratos e gates de F2 após a rodada documental do Codex. **Não é mais uma execução de testes e não é aceite humano da spec.** O relatório original acima preserva evidências históricas e seu veredito da rodada anterior; a [spec F2 atualizada](../specs/2026-10-28-estudo-organizado-v2-f2-content-design.md) é a fonte canônica do desenho proposto.

### 13.1 Responsabilidades corrigidas

**ChatGPT + Superpowers:** analisar/revisar alternativas, elaborar decisões e spec, aguardar aceite da spec, produzir e revisar `writing-plans`, aguardar aceite do plano e escrever GOAL completo. **Codex:** executar exclusivamente GOAL/plano aprovado, testar localmente, usar revisão independente e produzir evidências; **ChatGPT:** auditar implementação e escrever GOAL corretivo se necessário; **proprietário:** ratificar gates e exceções. O Codex pode levantar problemas técnicos, mas não substituir aprovação humana ou redesenhar a arquitetura.

### 13.2 Achados materiais da revisão

| Prioridade | Problema detectado na versão documental anterior | Correção proposta na spec |
| --- | --- | --- |
| P1 | `nameKey` figurava na precedência de identidade; podia ser confundido com autorização de merge | E-F2-05: somente sugestão; `centralId`/`sourceRef` precisam de namespace e proveniência confiáveis; fingerprint sem campos voláteis |
| P1 | `profileId` local e UID remoto sem definição cross-device; risco de dois aparelhos com IDs locais distintos | E-F2-06: `remoteLibraryId` sob UID após consentimento, operação imutável, escopo remoto verificado por UID |
| P1 | Retry limitado a cinco podia exigir intervenção manual após falha transitória | E-F2-07: cooldown e retomada automática quando app ativo, preservando outbox até sucesso/erro determinístico |
| P1 | Staging/import_jobs para lote grande era prematuro e sem protocolo de publicação atômica comprovado | E-F2-05: transação única medida, limite rebaixável em mobile, rejeição acima dos limites; staging só com nova decisão |
| P2 | `displayAlias` não tinha semântica explícita de rename | E-F2-01: alias contextual, não altera `StudySubject` canônico |
| P2 | `orderKey` base62 estava quase obrigatório sem comparação | E-F2-02: chaves determinísticas e reindexação simples; sofisticar só com evidência |
| P2 | UI de backup F2 versus fase principal F7 confundia escopo | E-F2-04/08: somente compatibilidade e preview sintético na F2; UX completa na F7 |
| P2 | Matriz T01..T31 não cobria alias, identidade cross-device, limite real e retries | Complemento proposto T32..T40; testes ainda não executados |
| P2 | Texto antigo do roadmap/issue mencionava G3/F1 como pendente apesar do aceite F1 | Corrigir acompanhamento canônico sem alterar o histórico do GOAL F1 |

**Riscos de arquitetura ainda existentes:** não há schema remoto/Rules reais comprovados; F2-T36 é apenas teste de contrato simulado, e o `F2_EMULATOR_REHEARSAL` exige autorização própria. Quatro HIGH F0 permanecem `UNVERIFIED`. A estimativa de 23.520 escritas do cenário de três importadores é alerta conservador, não conta real medida nem autorização para ultrapassar Spark.

### 13.3 Parecer e gates

**Veredito da revisão ChatGPT:** `F2_SPEC_REVISED — READY_FOR_HUMAN_DECISION`; proposta arquitetural suficientemente definida **para o proprietário aprovar ou solicitar correções**, não para implementar. Recomendo D-F2-01=alternativa B e D-F2-02..06 conforme a spec **com E-F2-01..08**. Sem aceite explícito não marcar `APPROVED`, criar writing-plans ou iniciar F2.

**Na próxima etapa autorizada:** ChatGPT invoca Superpowers `writing-plans` e publica plano detalhado, tarefas/arquivos/assinaturas/TDD/revisão/DoD referenciando T01..T40. **O Codex não será solicitado a criar plano.** Depois de aprovado pelo usuário, ChatGPT escreve GOAL único para executar pela própria `v2`. Não tocar `main`/V1, não criar Actions, PRs nem instalar Firebase nesta revisão.

**Limite da evidência:** a revisão confrontou documentos atuais e interfaces F1 no GitHub; os números 84 unitários/20 E2E são **evidência anterior** e não foram reexecutados pelo ChatGPT nesta rodada.
