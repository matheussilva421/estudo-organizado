# Estudo Organizado V2 — F5: Writing-plans Superpowers (proposta revisada após auditoria crítica)

**Projeto:** `matheussilva421/estudo-organizado`  
**Branch canônica da V2:** `v2`; `main` permanece V1/produção, intocada.  
**Natureza:** PLANO DE EXECUÇÃO FUTURA — **não é GOAL, não autoriza implementação, commits, push ou merge**.  
**Estado:** `F5_PLAN_REVIEWED_PENDING_HUMAN_APPROVAL` (revisão documental; nenhum código executado).  
**Fonte normativa:** Especificação F5 revisada, **aprovada expressamente pelo usuário nesta conversa**, SHA-256 `0f45de81a0161a54651205ee6b9d1b27989ec4c2cf8151ff682c7e558180dee3` (arquivo local verificado neste ciclo). Decisões D-F5-01–28, todas B. **A versão revisada ainda não está comprovadamente publicada na `v2`; o texto interno da spec que diz "aprovação pendente" é metadado anterior ao aceite humano e deverá ser corrigido apenas em publicação documental autorizada, sem enfraquecer os gates.**  
**Referência documental:** `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f5-reviews-design.md` é uma proposta **histórica não aprovada**, NÃO deve prevalecer sobre a especificação revisada aprovada.  
**Levantamento remoto somente leitura:** a branch `v2` tem `apps/v2/` com React, TypeScript, Vitest, Playwright, IndexedDB `estudo-organizado-v2`, `LOCAL_DB_VERSION = 4`, fontes F2–F4 e uma outbox existente. Estes fatos são retrato da consulta, **não** equivalem a preflight Git local nem comprovam testes atualmente verdes.  
**Método de execução futuro:** um GOAL, incrementos TDD pequenos, testes locais, revisão por agente/revisor distinto se disponível, um aceite humano final, integração remota somente quando expressamente autorizada. Zero novas Actions/CI e sem branches/PRs novos por padrão. **Este writing-plans revisado não está aprovado nem autoriza o Codex.**

## 0. Objetivo, resultado e condições que não podem ser relativizadas

Entregar as três capacidades F0 — `F-V1-REVISIONS`, `F-V1-WEAK-POINTS`, `F-V1-BANCA-ANALYZER` — em experiência F5 única, offline, explicável, auditável, sem IA paga nem backend novo. Reutilizar identidades F2, capacidade F3 e fatos F4; jamais tratar projeção como decisão humana, duplicar tempo/questões, inferir retenção da mera atividade, sobrescrever compromisso F3, resolver conflito por relógio ou afirmar sincronização remota homologada.

**Não objetivos:** F6 dashboards globais; F7 Firebase real, Auth/Rules, sync entre aparelhos/backup integral/migração real; F8 cutover; V1 `main`; integração com Biblioteca Inteligente; geração automática de questões; crawler de banca; serviço pago, segredo externo, telemetria não aprovada. Sempre indicar `NOT_RUN`/`INCONCLUSIVE` para verificações não realizadas.

**Definição de pronto para aceite no GOAL futuro:** implementação + testes F5/integração/regressões + revisão independente e correções + candidato preparado para aceite. Aceite humano, autorização de push, confirmação remota e limpeza são eventos separados. Não confundir `READY_FOR_HUMAN_REVIEW` com `ACCEPTED`, `INTEGRATED_V2`, `DEPLOYED`.

## 1. Preflight obrigatório e mapa de arquivos reais

**Antes de qualquer modificação** (executor futuro, não realizado por esta redação):

```bash
# Na raiz do repositório correto, sem ação destrutiva:
git rev-parse --show-toplevel
git status --short --branch
git rev-parse HEAD
git branch -avv
git worktree list --porcelain
git stash list
git remote -v
git log -5 --oneline --decorate
git fetch origin --prune=false
git rev-parse origin/v2
git rev-parse origin/main
# Inspecionar PRs abertos via gh pr list, se gh autenticado;
# na falta, registrar indisponibilidade, sem supor que sejam zero.
```

**Gate de segurança:** não fazer `reset --hard`, `clean`, `force push`, exclusão de branch/worktree, descarte de stash nem fechamento de PR. Se `v2` estiver suja, com commits remotos novos ou trabalho único em outra árvore, inventariar e preservar; não trabalhar sobre alterações alheias sem identificar ownership e destino. Utilizar isolamento temporário apenas se indispensável e coberto pela autorização futura; nenhum PR automático. Antes de escrever, garantir **acesso real ao arquivo da spec aprovada e ao plano aprovado**, conferindo SHA/diff; o arquivo baixável do ChatGPT não aparece automaticamente no filesystem do Codex. Atualizar leitura de HEAD e documentação antes da execução. Se a branch corrente diferir da `v2`, não alterar a V1 por engano.

**Arquivos existentes confirmados na consulta read-only** (inspecionar conteúdo, assinatura, importações e testes no preflight antes de editar):

| Responsabilidade | Caminho existente |
|---|---|
| Scripts | `apps/v2/package.json`: `typecheck`, `lint`, `build`, `test:unit`, `test:e2e` |
| Versionamento IndexedDB | `apps/v2/src/domain/versions.ts` (`LOCAL_DB_VERSION=4` na consulta) |
| Conexão, stores, CAS auxiliares | `apps/v2/src/platform/indexeddb.ts` |
| Definição de stores/migração | `apps/v2/src/platform/content-migration.ts`, `upgradeV2Schema()` |
| Identidade F2 | `apps/v2/src/domain/edital.ts`, `content.ts`, `subject.ts` |
| Tempo civil | `apps/v2/src/domain/planning-time.ts` |
| Capacidade F3 | `apps/v2/src/domain/planning-capacity.ts` (`evaluateDailyCapacity`, `selectOfficialReservations`) |
| API/consultas F3 | `apps/v2/src/application/planning-service.ts`, `planning-queries.ts` |
| Repositório F3 | `apps/v2/src/platform/local-planning-repository.ts` |
| Sessões, contagem, alocações F4 | `apps/v2/src/domain/session.ts`, `session-accounting.ts`, `session-measurements.ts` |
| API F4 | `apps/v2/src/application/session-service.ts`, `session-queries.ts` |
| Repositório F4 | `apps/v2/src/platform/local-session-repository.ts` |
| Sync/outbox única | `apps/v2/src/application/sync-types.ts`, `apps/v2/src/platform/indexeddb.ts`, `apps/v2/src/platform/sync/delivery-policy.ts` |
| Alteração entre abas | `apps/v2/src/platform/local-events.ts` |
| UI | `apps/v2/src/presentation/App.tsx`, `PlanningWorkspace.tsx`, `SessionWorkspace.tsx`, `styles.css` |
| Referência de testes | `apps/v2/tests/unit/f2-*.test.ts`, `f3-*.test.ts`, `f4-*.test.ts`; `apps/v2/tests/e2e/f3-*.spec.ts`, `f4-*.spec.ts` |

**Pontos de atenção concretos:** (1) F2 `StudySubject` = **disciplina**, não `Assunto`; `Assunto` possui `editalDisciplineId`; (2) F4 `StudyMeasurement` contém contagens agregadas vinculadas opcionalmente a `allocationId`, sem identidade de questão individual; (3) F3 tem capacidade GLOBAL do perfil, inclusive editais simultâneos; (4) `OutboxEntityType`/`OutboxPayload` é união fechada, `deliveryMode?: BLOCKED` já existe, e `canDeliver()` bloqueia tipos de planejamento; a F5 precisa **bloqueio explícito também no roteamento/seleção de entrega**, não apenas ampliar TypeScript; (5) upgrade v4→versão seguinte é **proposição condicional**, não incrementar versão se o estado atual já tiver evoluído ou se existir alternativa segura sem nova store; (6) os comandos F3 de preview/commit são versionados e a capacidade precisa ser reavaliada **na fronteira de confirmação efetiva**, não apenas em cálculo prévio; (7) os tipos `SyncState` descrevem saúde do perfil, `OutboxStatus` descreve linhas da fila: não introduzir um terceiro conjunto fictício de estados de envio.

**Preflight de regressão — executar antes do primeiro RED, registrar baseline (sem alterar configuração):**

```bash
cd apps/v2
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:e2e
```

Não afirmar PASS antecipadamente. Se a instalação ou o baseline falhar por causa externa ou problema preexistente, documentar causa, impacto e relação com F5; distinguir falha de infraestrutura de defeito funcional, sem reclassificar `FAIL` como `PASS`. Não iniciar correção ampla fora do escopo sem evidência e autorização. Testes Playwright exigem browsers locais instalados; documentar o ambiente. Não usar dados reais nem conexões Firebase para o baseline.

## 2. Método Superpowers/TDD e orçamentos de trabalho

Para cada tarefa T01–T20 abaixo:

1. **RED (quando introduz comportamento F5):** criar teste que falhe pela ausência do comportamento ou pela violação reproduzível, executar teste filtrado e registrar falha esperada. **Testes de caracterização de F2–F4 devem PASSAR antes da modificação; não forçar RED neles.** Não mudar o código F5 antes do RED aplicável, salvo scaffold estritamente necessário à compilação.
2. **GREEN:** implementar o menor contrato compatível com domínio → aplicação → persistência → UI; preservar APIs e regressões preexistentes.
3. **REFACTOR:** reduzir duplicação e consolidar invariantes; executar novamente testes específicos e afetados, typecheck/lint quando aplicável.
4. **Evidence:** registrar comando, resultado, ambiente e associação a F5-Txx; nenhum teste `skipped`/mock serve como comprovação de hardware, Firebase ou eficácia pedagógica.
5. **Commit local coeso:** somente se o GOAL futuro autorizar commits, sem `push` pressuposto. Não criar um PR por incremento.

**Critérios técnicos transversais:** erros tipados `INVALID|CONFLICT|BLOCKED|FAILED|LOCAL_COMMITTED`, `operationId` idempotente e payload divergente rejeitado, commit IndexedDB/outbox atômico, IDs opacos, `profileId` obrigatório, prevenção de tombstone resurrection, `CivilDate` e zona IANA, snapshots revisionados, eventos F4 contabilizados uma vez, cálculos puros sem side-effect no render. Não usar “silenciar erro” ou aumentar timeout de teste como correção de causa raiz.

**Políticas numéricas (D26):** antes de implementar T06/T10/T13, produzir **uma única seção de parâmetros no registro técnico vigente da F5** (sem reescrever silenciosamente a spec aprovada), com candidato de defaults, limites, motivos, fallback, exemplos adversariais, resultados comparativos e versão. Os valores **não foram aprovados numericamente**; não apresentar qualquer número como decisão do usuário ou validação científica. Parâmetros técnicos conservadores e reversíveis dentro das políticas já aprovadas podem ser propostos no GOAL futuro; se houver escolha de produto material ainda não coberta, interromper **somente essa escolha**, preservando e testando as partes independentes, e solicitar aprovação. **Na ausência de fundamento suficiente, degradar explicitamente para `INSUFFICIENT_DATA`/`DESCRIPTIVE_ONLY`/sugestão manual**, sem classificar ou autoaprovar por um limiar inventado. Os testes de fixtures verificam computação e invariantes, não eficácia pedagógica. Números-padrão candidatos e justificativas devem ser auditáveis no aceite do plano ou no gate técnico posterior expressamente autorizado.

**Recursos e escala:** cenário sintético pequeno, médio e estresse (1 mil, 10 mil, 50 mil registros, apenas ensaios, não mínimos de produto). Definir metas de latência e consumo somente após medir baseline local; não introduzir Worker/índice/cache sem evidência de necessidade. Executar em dispositivo limitado quando disponível; ausência é `NOT_RUN`, não impedimento de testes de correção.

## 2.1. Auditoria crítica desta revisão e salvaguardas adicionais

Revisão de segunda passagem **pelo assistente, não por auditor externo**, confrontando o Markdown original, a spec aprovada e arquivos verificados da `v2`. Não houve execução local do projeto. Achados materiais resolvidos no texto:

| ID | Gravidade | Falha da proposta original | Ação incorporada neste plano |
|---|---|---|---|
| RP-01 | Alta | T01 pretendia obter RED em contratos F2–F4 já implementados | Caracterização de contratos existentes deve produzir PASS; RED apenas para funcionalidade F5 nova |
| RP-02 | Alta | T04 vinha antes da definição da política de revisão T06 | Dependência explícita T06→T04, preservando IDs T01–T20 |
| RP-03 | Crítica | T03 não comprovava o bloqueio de roteamento remoto de novos tipos F5 | Extensão segura de `OutboxEntityType`/`OutboxPayload`, `deliveryMode: BLOCKED`, `canDeliver`/handlers e teste de não entrega |
| RP-04 | Crítica | F3 podia confirmar encaixe baseado em prévia obsoleta e declarar sucesso parcial | Capacidade global e CAS revalidados no commit; sem atomicidade, `PENDING_RECONCILIATION`/`UNALLOCATED` e nenhum sucesso conjunto fictício |
| RP-05 | Alta | Evidência F4 não distinguia `StudyMeasurement.allocationId` de `assuntoId` | Resolver associação em `StudySession.allocations`, manter sem classificação e conflitos explícitos |
| RP-06 | Alta | Fronteira de importação em estágios poderia publicar estado incompleto | Recibos, isolamento e promoção única/verificável; pacote não pode ser anunciado integralmente aplicado após erro parcial |
| RP-07 | Alta | Política quantitativa deixava espaço para thresholds ad hoc apresentados como aprovados | Registro de política candidata, justificativas, versão, fixtures e fallback conservador; nenhuma alegação científica |
| RP-08 | Média | Migração era dita «reversível» sem distinguir backup de downgrade | Cópia/fixture e recuperação controlada, nunca downgrade automático do IndexedDB |
| RP-09 | Alta | Projeções e relevância de banca poderiam consumir evidências conflitantes ou versões obsoletas | Validação de geração/fonte, bloqueio de uso autoritativo e explicação de estados |
| RP-10 | Alta | Autoaprovação/alertas poderiam duplicar gravações em abas | Comando consentido, dedup semântica com CAS, sem escrita em render, notificações degradam com segurança |
| RP-11 | Média | Metadados de aprovação da spec e entrega do arquivo ao Codex estavam ambíguos | SHA da versão aprovada, origem conversacional e disponibilização efetiva exigidos no preflight |
| RP-12 | Alta | Relatório de cobertura 48/48 poderia mascarar `NOT_RUN` em requisito crítico | Gate distingue classificação de cobertura e prova `PASS`; testes críticos sem evidência impedem readiness |

**Regra de segurança adicional:** não é permitido resolver conflito de integração com F3, versão de banco ou outbox simplesmente atualizando um estado em memória. Testes precisam exercer a transação real do IndexedDB e, quando couber, duas abas do navegador. Fakes servem a contratos determinísticos, não homologam Firebase nem OS.

## 2.2. Dependências técnicas e gates internos de progressão

**Ordem recomendada de execução dos IDs existentes:** `T01 → T02 → T03 → T06 → T04 → T05 → T07 → T08 → T09 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → T18 → T19 → T20`. A posição de T14 poderá ser antecipada até o mínimo indispensável, desde que suas invariantes de invalidar fatos já estejam cobertas em T03. Não renumerar tarefas/casos para encaixar a ordem.

| Dependência | Gate técnico antes de consumir |
|---|---|
| F2 → T02 | Vínculo explícito de `Assunto` por ID/escopo validado; homônimos rejeitados |
| T02 + T03 + T06 → T04 | Identidade, persistência causal e sugestão determinística prontas |
| T03 + T04 → T05 | Um compromisso confirmado por saldo; execuções próprias auditáveis |
| F3 + T05 + T07 → T08 | Prévia com capacidade oficial e commit/reconciliação seguros |
| F4 + T05 → T09–T10 | Questões/tempo conciliados por alocação; retenção separada |
| T09–T12 + F3 → T13 | Prioridade contextual usa evidências elegíveis e fontes versionadas |
| T03–T13 → T14 | Invalidação e cache não alteram fatos; recálculo pode ser refeito |
| T02–T14 → T15–T18 | Portabilidade e interface consomem domínio estabilizado |
| T01–T18 → T19–T20 | Adversarial/regressões/QA/relatório representam funcionalidade integrada |

**Critério para avançar entre tarefas:** RED→GREEN→REFACTOR do novo contrato, testes de caracterização/regressão afetados, nenhuma falha crítica nova não tratada e mudança documentada no registro único. A passagem interna **não** precisa de nova aprovação humana, pois não é novo gate de produto. Em caso de impedimento externo, executar o trabalho independente permitido e registrar bloqueio exato; nunca fingir que toda a F5 foi encerrada.

## 2.3. Comandos de teste e organização das evidências (somente para execução futura)

No diretório `apps/v2` os filtros são os do Vitest/Playwright já existentes; ajustar nomes somente após confirmar os arquivos gerados:

```bash
npm run test:unit -- tests/unit/f5-review-topic.test.ts
npm run test:unit -- tests/unit/f5-scheduler.test.ts
npm run test:unit -- tests/unit/f5-f3-placement.test.ts
npm run test:e2e -- tests/e2e/f5-review-journey.spec.ts
# Gate integrado: executar toda a suíte, não só filtros.
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:e2e
```

Cada cenário F5-T01–T48 deverá indicar teste real e **assertiva observável**, fixture (incluindo versões/baseRev), resultado esperado/observado, comando completo, ambiente, classificação e evidência. Para casos com várias assertivas independentes, **todas** são exigidas antes de `PASS`. Os aliases `f5-...` são candidatos; se os caminhos concretos diferirem, atualizar a matriz no registro existente, nunca declarar um caminho inexistente como teste executado.

**Baseline do trabalho:** hash do commit testado, Node/npm, browser Playwright, versões de schema, perfil sintético, ambiente offline/fakes, read-back de operações e print de métricas; evidências só podem ser atribuídas ao mesmo código/commit testado. Depois de correção material, repetir testes afetados e regressões relevantes.

## 3. Writing-plans — sequência de tarefas executáveis

### T01 — Levantamento técnico, mapa de contratos e fixtures de referência

**Depende de:** preflight §1 e disponibilidade local da spec/plano aprovados. **Registro de trabalho:** usar o registro de estado F5 já existente, com matriz de evidências no mesmo relatório canônico; não criar relatórios paralelos. **Não alterar a spec aprovada para fazê-la concordar artificialmente com implementação divergente.**

- **Caracterização (PASS inicial):** executar testes F2–F4 existentes para homônimos F2, multiassunto F4, capacidade concorrente F3, tombstone e data civil; criar fixtures sintéticas de interoperabilidade com resultado esperado verificável. **RED:** somente para novos invariantes F5 ainda ausentes, após identificar ponto de integração real. Não alterar F2–F4 para fabricar falha.
- **GREEN:** definir um conjunto mínimo de *builders* e fixtures sintéticas por `profileId`, `editalId`, `editalDisciplineId`, `assuntoId`, `allocationId`, `sessionId` e `operationId`. Construir tabela de proveniência e matriz F5-T01–48 com estados iniciais `NOT_RUN`.
- **REFACTOR:** reutilizar helpers existentes, sem framework próprio de testes.
- **Aceite:** contrato `Assunto`≠`StudySubject` registrado; capacidade global e alocação F4 reproduzíveis; candidatos de política e fallback comparáveis e explicitamente não validados pedagogicamente; baseline real documentado. **Fronteira:** fixar lista das operações de F2–F4 que serão lidas ou chamadas; se faltar porta pública, estender a existente no menor escopo seguro em T08/T09.
- **Cobertura principal:** T10, T18, T21, T22, T45, T48.

### T02 — Identidade canônica dos assuntos de revisão e vínculo explícito entre editais

**Locais candidatos:** `src/domain/review-topic.ts`, `src/application/review-topic-service.ts`, testes `tests/unit/f5-review-topic.test.ts`; examinar `src/domain/content.ts`, `edital.ts`.

- **RED:** assuntos homônimos em editais diferentes não se unem; mesmo assunto explicitamente vinculado aparece em dois contextos; edição, arquivamento ou tombstone de origem não reidentificam histórico; remapeamento por nome sozinho é recusado.
- **GREEN:** representar `canonicalReviewTopicKey` **como identidade lógica própria F5 e vínculos explícitos** para IDs F2 (`Assunto`, opcional `Aula`/subassunto), com `profileId`, proveniência e histórico; não reinterpretar `StudySubject` como assunto nem alterar IDs F2. Verificar que operações de associação não criam ciclos/vínculos entre perfis. Sem equivalência aprovada, manter trajetórias separadas.
- **REFACTOR:** não criar nova disciplina ou cópia editável da árvore F2.
- **Aceite:** nenhuma associação silenciosa por texto; vínculo compartilhado não duplica execuções nem fatos de F4; dados órfãos diagnosticáveis. **Atenção:** assuntos em dois editais podem compartilhar trajetória de revisão só após vínculo humano verificado; relevância por edital continua separada.
- **Cenários:** T03, T10, T20, T30.

### T03 — Persistência F5, migração aditiva e envelopes de operação

**Locais existentes:** `src/domain/versions.ts`, `src/platform/indexeddb.ts`, `src/platform/content-migration.ts`, `src/application/sync-types.ts`, `src/platform/sync/delivery-policy.ts`. **Candidatos:** `src/platform/local-review-repository.ts`, `tests/unit/f5-schema.test.ts`, `f5-commit.test.ts`.

- **RED:** upgrade de base sintética nas versões efetivamente suportadas, incluindo v4→versão seguinte se aplicável, preserva TODOS os stores/índices/dados F1–F4, operations/outbox/tombstones; abrir DB com cliente antigo incompatível não grava; replay idêntico não duplica; ID igual com payload diferente falha; quota/abort reverte toda transação. **Testar banco limpo e base anterior com registros/drafts/conflitos reais sintéticos.**
- **GREEN:** adicionar somente stores/índices comprovadamente necessários (compromissos, execuções, políticas, fontes de banca, vínculos/projeções podem compartilhar stores se seguro), reutilizando `openV2Database`, `transactionDone`, a tabela `operations` e **a mesma outbox**. Ao estender `OutboxEntityType`/`OutboxPayload`, atribuir `deliveryMode: BLOCKED` ao novo tipo quando o destino remoto não estiver homologado e atualizar **explicitamente `canDeliver`, seletores e handlers/roteadores** de envio; nunca enviar novo payload a handler legado por fallback, nem ACK remoto sem prova. Verificar como o status de pendente bloqueado é apresentado (não prometer convergência).
- **REFACTOR:** não criar banco paralelo, protocolo remoto falso, outbox secundária nem evento por renderização. Confirmar efeito somente após `transactionDone`.
- **Aceite:** migração **não destrutiva e testada em cópia sintética verificável**; preservar snapshot anterior para rollback de laboratório (não alegar downgrade IndexedDB automático), dados intactos, falha segura e operação causal íntegra. **Testar zero entregas remotas F5 e nenhuma perda na fila F1–F4.**
- **Cenários:** T05, T06, T35, T40, T42, T44.

### T04 — Sugestões puras, confirmação manual e autoaprovação com opt-in

**Candidatos:** `src/domain/review-suggestion.ts`, `src/application/review-service.ts`, `tests/unit/f5-suggestion.test.ts`, `f5-auto-approval.test.ts`.

- **RED:** mesma evidência/política gera mesma chave de sugestão; consultar 100 vezes não grava; autoaprovação default OFF; opt-in persistente autoriza apenas comando explícito limitado por horizonte; revogação interrompe novos commits; duas abas com operações distintas não criam compromisso duplicado.
- **GREEN:** gerar `ReviewSuggestion` por assunto/escopo/política de maneira pura **usando contrato de cálculo T06**, sem duplicar motor temporal; implementar `ApplyReviewSuggestion` manual e aplicação automática separada, com CAS, fingerprint, horizonte limitado e validação de duplicidade semântica. O acionamento automático é orquestração de comando explicitamente autorizado, **não efeito colateral de query, React render ou useEffect de montagem**.
- **REFACTOR:** não disparar mutação por `useEffect`, leitura do calendário ou renderização React; sem preencher agenda F3 sem confirmação específica.
- **Aceite:** distinção sugestão vs compromisso observável em DB e interface; nenhuma gravação por consulta.
- **Cenários:** T01, T02, T05, T42.

### T05 — Execução, cobertura parcial, avaliação de retenção e causalidade

**Candidatos:** `src/domain/review-execution.ts`, `src/application/review-service.ts`, `tests/unit/f5-execution.test.ts`, `f5-coverage.test.ts`.

- **RED:** duas operações diferentes não quitam mesmo saldo simultaneamente; duas revisões reais e distintas não se apagam por dedup superficial; `UNKNOWN` não vira `FULL`; execução parcial preserva saldo identificável; `UNRATED` não vira `GOOD`; edição da avaliação é compensação auditada, não segunda execução.
- **GREEN:** comandos `RecordReviewExecution`, `RecordRetentionAssessment`, `ReconcileReviewCoverage`, `RescheduleReview`, `CancelReviewCommitment`, execução avulsa; usar revisão-base, comparador de cobertura e operação persistente; separar status de vencimento de `FULFILLED`. Uma segunda execução do mesmo assunto com identidade e ocasião próprias pode existir, mas **não quitar novamente o mesmo saldo confirmado**. Correção da retenção é retificação com proveniência, não nova execução.
- **REFACTOR:** compartilhar validador de domínio, não duplicar `StudySession` F4 nem deduzir duração/questões da execução F5.
- **Aceite:** preservar data original de vencimento, históricos humanos, escopo e proveniência; conflitos são visíveis e não somados duas vezes. **Testar execução `UNRATED`, `UNKNOWN` e `PARTIAL` sem fabricar `GOOD`/`FULL` nem sessão/tempo F4.**
- **Cenários:** T04–T09, T13–T14.

### T06 — Motor determinístico de repetição e perfis de algoritmo versionados

**Candidatos:** `src/domain/review-policy.ts`, `review-scheduler.ts`, `tests/unit/f5-scheduler.test.ts`, `f5-policy.test.ts`.

- **RED:** fixtures para `FORGOT/PARTIAL/GOOD/UNRATED`, progresso/recuo graduado, atraso baseado em data real, DST/data inválida, alteração de política sem mutar histórico, sugestão semanticamente igual com inputs iguais; divergência questão vs retenção exige explicação.
- **GREEN:** intervalos calculados sobre `CivilDate` (`planning-time.ts`), versão/política explícita, override validado, preview de upgrade de regra, limites/fallback decorrentes da política proposta T01/D26. Separar **parâmetros, regra pura e avaliação de retenção**; extensões de evidência F4 só quando houver amostra e compatibilidade comprovadas. Não afirmar FSRS/eficácia universal.
- **REFACTOR:** cálculo totalmente puro; injeção de relógio/IDs em interfaces, não `Date.now()` oculto. Resultados reproduzíveis com a mesma versão.
- **Aceite:** algoritmo auditável por snapshot/fixture, histórico imutável, nenhuma conclusão fabricada.
- **Cenários:** T11–T16, T25, T45.

### T07 — Recuperação de atrasos e duração estimada por evidência real

**Candidatos:** `src/domain/review-backlog.ts`, `review-duration.ts`, `tests/unit/f5-backlog.test.ts`, `f5-duration.test.ts`.

- **RED:** compromisso vencido persiste; atraso não conta como execução; prioridade de recuperação não inventa capacidade; duração de sessão multitema não vira duração íntegra da revisão; sem amostra, fallback explicitamente estimado.
- **GREEN:** consulta priorizada de backlog, propostas de remarcação com vencimento original, estimador com medidas de tempo atribuíveis e elegíveis, fallback versionado, cálculo explícito de déficit (`UNALLOCATED`).
- **REFACTOR:** reutilizar F4 accounting e F3 `CivilDate`; nenhuma escrita em F3 nesta tarefa.
- **Aceite:** atraso, estimativa e execução têm semânticas distintas; resultados exibem motivos.
- **Cenários:** T13, T17, T18.

### T08 — Integração assistida com capacidade GLOBAL e commits F3

**Locais existentes:** `src/domain/planning-capacity.ts`, `src/application/planning-service.ts`, `planning-queries.ts`, `src/platform/local-planning-repository.ts`. **Candidatos:** `src/application/review-placement.ts`, `tests/unit/f5-f3-placement.test.ts`, `tests/e2e/f5-planning.spec.ts`.

- **RED:** dois editais ativos competem pela capacidade global; cenário inativo não consome; bloco fixo/histórico não pode mudar; preview invalidada por concorrência deve falhar sem confirmação global; sem capacidade => `UNALLOCATED`.
- **GREEN:** `PreviewReviewPlacement` recupera cenário `ACTIVE`, disponibilidade e todas as reservas oficiais do perfil por `selectOfficialReservations`/`evaluateDailyCapacity`; proposta reaproveita F3. No `Apply`, **revalidar dentro da fronteira do commit** a revisão do cenário, os blocos fixos, o escopo, a capacidade global e o token da prévia. Preferir **uma transação IndexedDB abrangendo alterações F3/F5 + operações/outbox** quando os contratos permitirem sem acoplamento indevido; se não houver atomicidade entre comandos, **não declarar sucesso conjunto**, preservar compromisso F5 e registrar vínculo `PENDING_RECONCILIATION` explícito e recuperável, sem tentar rollback de decisão humana com sobrescrita. Só registrar ligação `APPLIED` após read-back F3. **Se essa fronteira não puder ser fechada com integridade, bloquear apenas o encaixe automático e deixar a revisão `UNALLOCATED`, mantendo a F5 funcional.**
- **REFACTOR:** não inventar “segunda agenda” que reserva minutos à margem de F3; não duplicar o motor de capacidade.
- **Aceite:** revisão confirmada pode permanecer sem bloco F3; commit F3 não é inferido de confirmação F5. Exigir testes de race após preview, queda entre commits, concorrência de dois editais e read-back sem falso `APPLIED`.
- **Cenários:** T18, T19, T20.

### T09 — Leitura confiável das evidências F4 e medição de pontos fracos

**Locais existentes:** `src/domain/session.ts`, `session-measurements.ts`, `session-accounting.ts`, `src/application/session-queries.ts`. **Candidatos:** `src/domain/weak-point-evidence.ts`, `weak-point-scoring.ts`, `tests/unit/f5-evidence.test.ts`.

- **RED:** contagem global = uma vez; contagem por `allocationId` não replica total; sem assunto válido => não atribuir; acertos ≤ questões; 2 acertos/3 tentativas não prova domínio; sem questões + esquecimento explícito preserva alerta qualitativo; conflito F4 `INCOMING` parcial excluído de score autoritativo.
- **GREEN:** adaptar consultas F4 sem escrever/retificar fatos de origem; filtrar escopo/perfil, proveniência e conflito; **não assumir que cada `StudyMeasurement` traz `assuntoId`**: resolver `allocationId` contra `StudySession.allocations` e referências válidas, mantendo não atribuídas. Excluir `BREAK`, duração incerta, tombstone e versões conflitantes da evidência quantitativa autoritativa; derivar porcentagem descritiva independente de suficiência e retenção; produzir justificativas e flags verificáveis.
- **REFACTOR:** evitar SQL ou amostras individuais fictícias; usar agregação tipada e termos acadêmicos corretos.
- **Aceite:** reconciliar somatórios com F4 em fixtures multiassunto/multiedital e fonte `UNALLOCATED` intacta.
- **Cenários:** T15, T21–T23, T26.

### T10 — Tendências multijanela e critérios de suficiência

**Candidatos:** `src/domain/weak-point-trends.ts`, `tests/unit/f5-trends.test.ts`, `f5-parameters.test.ts`.

- **RED:** histórico elevado + janela recente diminuta não produz tendência sustentada; janelas com tipos/escopos incomparáveis geram inconclusivo; mudança de parâmetros muda apenas projeções e preserva fatos; mesmo snapshot/política reproduz resultado.
- **GREEN:** `INSUFFICIENT_DATA`, `DESCRIPTIVE_ONLY`, `TREND_SUPPORTED` com motivos, janelas e amostras verificáveis; limiares versionados conforme T01/D26, separados por tipo de inferência; priorização aceita indicadores apenas conforme elegibilidade. **Quando F4 só permitir agrupamento por sessão/data, não inventar distribuição temporal de questões por instante ou independência entre tentativas.**
- **REFACTOR:** separar pontuação descritiva, qualidade da evidência e recomendação contextual; não criar intervalo de confiança ou probabilidade sem método.
- **Aceite:** dashboard F5 exibe grau de sustentação, não só cor/percentual.
- **Cenários:** T23–T25.

### T11 — Importação de fontes de banca e classificação de evidências

**Candidatos:** `src/domain/board-evidence.ts`, `src/application/board-import.ts`, `tests/unit/f5-board-import.test.ts`.

- **RED:** texto “cai muito” não gera percentual; fonte sem período não recebe período inventado; estatística com amostra precisa unidade/denominador; texto hostil e entrada gigante falham sem mutação; fontes sobrepostas não somam percentuais.
- **GREEN:** parser local com orçamento de entrada, tipos quantitativo com fonte/amostra informada e validável/qualitativo/preferência, proveniência, URI validada e recortes; preview pura; fonte versionada só nasce via comando persistente. **Não alegar "estatística verificada" apenas porque a origem forneceu um número: diferenciar consistência estrutural, autenticidade externa não verificada e evidência documental.**
- **REFACTOR:** reutilizar validadores/limites de import F2; sem scraping nem crawler automático.
- **Aceite:** proveniência e limitações exibíveis; sanitização comprovada.
- **Cenários:** T27, T28, T31, T37, T39.

### T12 — Matching hierárquico e decisões de correspondência

**Candidatos:** `src/domain/board-matching.ts`, `src/application/board-match-service.ts`, `tests/unit/f5-board-matching.test.ts`.

- **RED:** nome homônimo em edital distinto não é match automático; nome de disciplina não é assunto; candidato inequívoco somente **proposto** em lote; casos ambíguos exigem confirmação individual; rejeição persistida não reaparece como aprovação silenciosa.
- **GREEN:** normalização e fuzzy assistido de forma local, com critérios explicáveis e contexto F2 (`EditalDiscipline`, `Assunto`, `Aula`); `ConfirmTopicMatches` com CAS/opId e trilha de decisão.
- **REFACTOR:** não criar IDs canônicos por distância textual nem reidentificar F2.
- **Aceite:** usuário pode revisar/rejeitar/revogar associações sem apagar histórico externo.
- **Cenários:** T10, T29, T30.

### T13 — Relevância de banca, prioridades por edital e reversão compensatória

**Locais existentes:** `src/domain/planning-priority.ts`, `src/application/planning-service.ts`. **Candidatos:** `src/domain/board-priority.ts`, `src/application/board-ranking-service.ts`, `tests/unit/f5-board-priority.test.ts`.

- **RED:** duas provas com mesmo assunto apresentam prioridades contextuais diferentes, mas fatos F4/F5 são únicos; preferência qualitativa não vira estatística; importação atualizada apresenta diff sem substituir anterior; reversão antiga não remove edição posterior.
- **GREEN:** ranking explicável, fontes comparáveis, relevância contextual `editalId`, data confirmada, deficiência F4/F5 elegível e `PriorityProfile` F3 lido sem mutá-lo; versão/preview/compensação para atualização e reversão. Quando a prioridade da banca não tiver evidência quantitativa suficiente, mantê-la qualitativa e rotulada; **não sobrescrever pesos/versionamento do cenário F3**.
- **REFACTOR:** não criar probabilidade de cobrança fictícia nem modificar blocos F3 confirmados.
- **Aceite:** mesmas entradas/versões produzem ranking semanticamente equivalente; reversão causal segura.
- **Cenários:** T31–T34.

### T14 — Invalidação seletiva, cache de projeções e reconstrução segura

**Candidatos:** `src/domain/f5-projection-deps.ts`, `src/application/f5-projections.ts`, `src/platform/local-f5-projections.ts`, `tests/unit/f5-projections.test.ts`.

- **RED:** alterar sessão F4 invalida apenas dependências reais (incluindo agregados e ranking afetados), sem invalidar fatos; geração interrompida não publica metade; duas execuções de recalculo em concorrência não permitem geração velha sobrepor nova; conflito reclassificado exige recálculo.
- **GREEN:** usar fingerprint/revisão de fonte, versão de política, estado de validade e controle de geração CAS; **dependências cruzadas F2/F3/F4/F5 devem invalidar agregados e ranking contextual afetados**. Materializar somente projeções cujo custo/latência justifique persistência; caso contrário, calcular sob demanda e documentar decisão. `STALE` é diagnóstico e nunca prova de validade para commits; geração em lotes não publica parcial.
- **REFACTOR:** não criar motor de background permanente nem event sourcing integral; evitar bloqueio da UI em lotes grandes.
- **Aceite:** descartar cache não perde execução; resultados obsoletos rotulados, nunca base autoritativa silenciosa.
- **Cenários:** T03, T25, T26, T40, T41.

### T15 — Portabilidade seletiva, prévia de importação e reversão segura

**Locais a reutilizar:** `src/application/session-portability.ts`, `planning-portability.ts`, validadores F2. **Candidatos:** `src/application/f5-portability.ts`, `src/platform/f5-import-commit.ts`, `tests/unit/f5-portability.test.ts`.

- **RED:** importar mesmo pacote duas vezes não duplica; tombstone impede ressurreição; perfil alheio/ID colidente exige remapeamento ou quarentena; erro no item N não retorna sucesso parcial; CSV protege fórmula; JSON não carrega token nem gera script.
- **GREEN:** export JSON acadêmico versionado de fatos/configurações F5 (e CSV de consulta); preview com novos/duplicados/conflitos/órfãos, consentimento e escopo; **cada lote aplicado tem uma fronteira atômica claramente declarada**, ou staging verificável com promoção transacional única. Não prometer atomicidade do pacote inteiro se o navegador exigir vários commits: definir protocolo de recibos e estado `PARTIAL_NOT_COMMITTED` recuperável sem atribuir êxito; **não liberar dados parcialmente aplicados a consultas autoritativas**. Projeções exportadas nunca importadas como autoridade.
- **REFACTOR:** não refazer backup geral V2/F7, não copiar dados F4 inteiros como se pertencessem à F5.
- **Aceite:** read-back após import e falha/quota; nenhuma escrita entre perfis; exportação eficaz e segura.
- **Cenários:** T35–T39.

### T16 — Central de lembretes e notificações progressivas

**Candidatos:** `src/application/review-reminders.ts`, `src/presentation/components/ReviewReminders.tsx`, `tests/unit/f5-reminders.test.ts`, `tests/e2e/f5-reminders.spec.ts`.

- **RED:** 5 atrasadas geram resumo, não 5 interrupções; duas abas não duplicam evento; hora de silêncio desativa aviso externo mas preserva central; permissão negada/ausente degrada; dispensar aviso não cumpre ou cancela compromisso; app fechado não gera promessa de gatilho pontual.
- **GREEN:** preferências locais por perfil, agrupamento/dedup, central sempre funcional e integração opcional com Notification API apenas quando suportada, após gesto/consentimento apropriado. **Dedup em múltiplas abas não depende de `BroadcastChannel` como lock**; validar identidade da notificação/lease e situação de compromisso, ou evitar notificação externa se não houver coordenação segura.
- **REFACTOR:** não adicionar servidor push, AlarmManager, Notification Triggers ou scheduler em background supostamente garantido.
- **Aceite:** experiência útil offline e avisos honrando a preferência explícita.
- **Cenários:** T02, T46.

### T17 — Interface de revisões: agenda, histórico, execução e integração F3

**Locais existentes:** `src/presentation/App.tsx`, `PlanningWorkspace.tsx`, `SessionWorkspace.tsx`, `styles.css`. **Candidato:** `src/presentation/ReviewWorkspace.tsx` e componentes pequenos somente se necessários; `tests/e2e/f5-review-journey.spec.ts`.

- **RED:** jornada inteira em Playwright: estudo F4→sugestão F5→confirmação→encaixe F3 assistido→execução parcial→reagendamento→conclusão→histórico; sem atividade fictícia ao atualizar/refrescar/offline; erro/quota/conflito mostram estado real.
- **GREEN:** área F5 integrada à navegação existente com agenda, sugestão, compromisso, duração estimada, retenção, cobertura, atraso, histórico, cancelamento, preview de mudança e conflitos visíveis. **O usuário pode concluir uma revisão avulsa ou parcialmente sem plano F3; sua conclusão não gera StudySession F4 sintética.**
- **REFACTOR:** UI não muta IDB diretamente; reutilizar componentes/estilos, manter oito temas, teclado e touch; não refazer dashboards globais F6.
- **Aceite:** todos os comandos possuem confirmação apropriada e feedback pós-commit; funciona sem rede.
- **Cenários:** T01–T04, T08, T13, T18–T20, T47.

### T18 — Interface de pontos fracos e inteligência de banca explicável

**Candidato:** `src/presentation/ReviewInsights.tsx`, `BoardIntelligence.tsx` (ou componentes equivalentes no mesmo workspace); `tests/e2e/f5-insights.spec.ts`, `f5-board-ui.spec.ts`.

- **RED:** exibição separada de acertos, retenção, tendência e suficiência; importar fonte, revisar candidatos, confirmar, comparar versão, aplicar/reverter ranking; nenhum percentual inventado; dois editais mostram contextos diferentes; painel não altera planejamento F3 por render.
- **GREEN:** três níveis progressivos de informação: síntese, explicação, auditoria de evidências/políticas; estados carregando/sem dados/stale/conflito/órfão; filtros por edital/assunto/período e navegação contextual F2–F4. **Não converter `INSUFFICIENT_DATA` em uma prioridade quantitativa e não confundir relevância por banca com fraqueza comprovada.**
- **REFACTOR:** manter visual da V2/Impeccable e evitar dashboard transversal F6; nenhum HTML de fonte importada é executado.
- **Aceite:** estudante compreende por que assunto recebeu prioridade; no caso inconclusivo, UI não colore como domínio comprovado.
- **Cenários:** T15, T23–T24, T27–T34, T47.

### T19 — Falhas adversariais, concorrência e desempenho em carga

**Locais existentes:** repositórios F2–F4, `src/platform/indexeddb.ts`, `local-events.ts`, sync fakes; **candidatos de testes:** `tests/unit/f5-races.test.ts`, `f5-recovery.test.ts`, `f5-load.test.ts`, `tests/e2e/f5-two-tabs.spec.ts`, `f5-offline-recovery.spec.ts`.

- **RED:** entrelaçamento de duas abas (opIds diferentes) para mesma sugestão/saldo; replay após crash; conflito fake entre dispositivos; exclusão vs edição com tombstone; mudança de DB version enquanto formulário/edição aberta; `QuotaExceededError`; recálculo com fonte alterada; import abort no meio do lote; **F5 outbox bloqueada sem ACK remoto fictício; read-back de vínculo F3 após falha entre commits; zero exclusão de fato/cobertura por retriable conflict**.
- **GREEN:** corrigir somente falhas materiais diagnosticadas, reutilizando CAS/fencing, outbox e SW update existentes; testes de carga medem e reportam sem fingir metas validadas. Sem uso de Firestore real, sem force merge/sem `last-write-wins`.
- **REFACTOR:** remover apenas artefatos temporários comprovadamente seguros; proteger sessões F4 e drafts F3.
- **Aceite:** invariantes F5 continuam verdadeiros sob falhas; local commit verificado por `transactionDone`/read-back, `REMOTE_COMMITTED`/`CONVERGED` exigem prova real no gate F7. Não afirmar que locks/fakes locais resolvem corrida Firebase.
- **Cenários:** T03, T05–T07, T35–T38, T40–T45.

### T20 — Regressões, QA Impeccable, revisão independente e pacote de aceite

**Locais existentes:** scripts `apps/v2/package.json`; `docs/superpowers/v2/ROADMAP.md`, issue #108 (atualizar **somente no estágio autorizado**, sem substituir histórico). **Artefato de resultado único:** usar registro de estado/aceite F5 canônico, não criar relatórios redundantes.

- **Caracterização/avaliação:** registrar todos os cenários F5-T01–T48 inicialmente como `NOT_RUN`; executar testes e registrar `PASS/FAIL/INCONCLUSIVE/BLOCKED/NOT_RUN` de fato. **Não forçar um RED artificial em testes de regressão já existentes.** Os REDs obrigatórios dos novos comportamentos são demonstrados nas T01–T19. Conferir regressões F1–F4 e fronteiras F6/F7.
- **GREEN:** corrigir bugs encontrados, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:e2e`; rodar QA com screenshots desktop/tablet/mobile, 8 temas, contraste AA, teclado, leitor de tela quando disponível, `prefers-reduced-motion` e touch adequados; coletar evidência Impeccable conforme ferramenta disponível, sem instalar hooks não autorizados.
- **REFACTOR / revisão:** solicitar revisão de agente/revisor independente quando disponível, confrontar 28 decisões e 48 testes, analisar efeitos causais, regressões e segurança; corrigir falhas materiais e repetir testes afetados. Evitar loops de review sem causa nova.
- **Aceite futuro do candidato:** 3/3 funcionalidades entregues; 28/28 decisões rastreadas; 48/48 cenários classificados honestamente **e casos críticos efetivamente PASS**; nenhuma falha crítica de integridade/segurança sem tratamento; ambiente e comandos registrados; benchmark e limites de recursos reportados; riscos F0/F4 preservados sem declaração fictícia de resolução.
- **Git hygiene:** inventariar `main/v2`, HEAD local/remoto, dirty files, stashes, branches, PRs, worktrees, commits exclusivos e Actions novas (esperadas zero); não eliminar trabalho exclusivo. `origin/v2` por fast-forward somente após autorização explícita, guardas e read-back. `main`/deploy não tocar.
- **Cobertura:** T01–T48 + regressão F1–F4 + gates humanos.

## 4. Matriz obrigatória F5-T01–F5-T48 → tarefas e evidências

Cada `F5-Txx` é **cenário de aceitação**, não tarefa. A planilha/matriz abaixo é completa; cada executor deve juntar ID de teste concreto (unit/integration/E2E), input sintético, comando, resultado esperado/real, evidência e estado. Teste `PASS` exige verificação real; não converter cenários amplos em “passaram” sem seus subcasos.

| Cenário | Teste essencial | Tarefa(s) |
|---|---|---|
| **F5-T01** | Sugestão reproduzível; query sem escrita | T04, T17 |
| **F5-T02** | Opt-in, revogação, autoaprovação idempotente | T04, T16 |
| **F5-T03** | Edição/exclusão F4 invalida projeção, não fato | T02, T14, T19 |
| **F5-T04** | Revisão avulsa não cria F3/F4 fictícias | T05, T17 |
| **F5-T05** | Replay idempotente da conclusão/avaliação | T03, T05, T19 |
| **F5-T06** | Mesmo operationId com payload incompatível | T03, T05 |
| **F5-T07** | Duas conclusões concorrentes e duas execuções legítimas | T05, T19 |
| **F5-T08** | Cobertura parcial sem sobreposição | T05, T17 |
| **F5-T09** | `UNKNOWN` não quita saldo | T05 |
| **F5-T10** | Homônimos e compartilhamento explícito F2 | T02, T12 |
| **F5-T11** | Recuo graduado por esquecimento | T06 |
| **F5-T12** | Retenção/política versionada determinística | T06 |
| **F5-T13** | Atraso ancorado na execução, vencimento original | T05–T07 |
| **F5-T14** | Sem avaliação → `UNRATED` | T05, T06 |
| **F5-T15** | Evidências contraditórias | T06, T09, T18 |
| **F5-T16** | Alteração de perfil com preview/versionamento | T06 |
| **F5-T17** | Estimativa por duração válida; fallback | T07 |
| **F5-T18** | Capacidade global concorrente F3 | T07, T08 |
| **F5-T19** | Commit F3/CAS e bloco fixo | T08, T17 |
| **F5-T20** | Arquivamento e vínculo F2 órfão | T02, T08 |
| **F5-T21** | Soma única de F4 multiassunto | T09 |
| **F5-T22** | Medição sem assunto/questão individual | T09 |
| **F5-T23** | Amostra insuficiente com retenção explícita | T09, T10 |
| **F5-T24** | Janelas e tendência comparável ou inconclusiva | T10, T18 |
| **F5-T25** | Troca de parâmetros não altera fatos | T06, T10, T14 |
| **F5-T26** | `INCOMING` parcial não vira dado reconciliado | T09, T14 |
| **F5-T27** | Banca qualitativa sem estatística fictícia | T11, T18 |
| **F5-T28** | Quantitativo com fonte e amostra reais | T11 |
| **F5-T29** | Matching inequívoco é proposta, não grava | T12 |
| **F5-T30** | Homônimo/contexto de edital e assunto | T02, T12 |
| **F5-T31** | Fontes sobrepostas/divergentes | T11, T13 |
| **F5-T32** | Fonte nova: versionamento e diff, sem crawler | T11, T13 |
| **F5-T33** | Prioridade por edital com fatos únicos | T13, T18 |
| **F5-T34** | Reversão compensatória sem apagar decisões novas | T13 |
| **F5-T35** | Reimportação e tombstones idempotentes | T03, T15 |
| **F5-T36** | Importação entre perfis com colisão de IDs | T15 |
| **F5-T37** | Entradas maliciosas/volume/versionamento | T11, T15 |
| **F5-T38** | Falha/crash no commit de import | T15, T19 |
| **F5-T39** | Formula injection/URL/segredos | T11, T15 |
| **F5-T40** | Cache inválido não vira fonte autoritativa | T03, T14 |
| **F5-T41** | Geração concorrente/interrupta sem publish parcial | T14, T19 |
| **F5-T42** | Multiaba e duplicidade semântica de opIds distintos | T03–T05, T19 |
| **F5-T43** | Multi-dispositivo fake/conflito causal | T05, T19 |
| **F5-T44** | Tombstone vs edição/replay | T03, T19 |
| **F5-T45** | Datas civis, mudança de fuso, DST | T01, T06, T19 |
| **F5-T46** | Avisos, dedup, silêncio e permissão | T16 |
| **F5-T47** | UI offline acessível, oito temas, Impeccable | T17, T18, T20 |
| **F5-T48** | Regressões, revisão, higiene e relatório | T01, T20 |

**Cobertura:** 48 IDs consecutivos, todos com tarefa responsável; qualquer caso não executado deve permanecer `NOT_RUN`, inclusive leituras de tela, suspensão física ou teste em hardware indisponível. F4-T13 é ressalva herdada, não F5-T13.

### 4.1 Rastreabilidade das 28 decisões arquiteturais e das três capacidades F0

| Decisão | Implementação/validação principal | Decisão | Implementação/validação principal |
|---|---|---|---|
| D-F5-01 | T02, T04 | D-F5-15 | T07, T09 |
| D-F5-02 | T06 | D-F5-16 | T06 |
| D-F5-03 | T04, T16 | D-F5-17 | T06, T09 |
| D-F5-04 | T08 | D-F5-18 | T10 |
| D-F5-05 | T07 | D-F5-19 | T17, T18 |
| D-F5-06 | T09, T10 | D-F5-20 | T16 |
| D-F5-07 | T13 | D-F5-21 | T15 |
| D-F5-08 | T12 | D-F5-22 | T03, T14 |
| D-F5-09 | T11 | D-F5-23 | T03, T05, T19 |
| D-F5-10 | T11, T13 | D-F5-24 | T01, T19, T20 |
| D-F5-11 | T06 | D-F5-25 | T01–T20, §5–§7 |
| D-F5-12 | T03, T14 | D-F5-26 | T01, T06, T10, T13 |
| D-F5-13 | T02, T13 | D-F5-27 | Preflight, §6 e gate humano |
| D-F5-14 | T05 | D-F5-28 | T04, T05, T17 |

| Capacidade F0 | Tarefas verificáveis | Critério central |
|---|---|---|
| `F-V1-REVISIONS` | T02–T08, T14, T16–T17, T19–T20 | Sugestão, compromisso, execução e recuperação auditáveis |
| `F-V1-WEAK-POINTS` | T09–T10, T14, T18–T20 | Evidência real, tendência/suficiência e explicação |
| `F-V1-BANCA-ANALYZER` | T11–T15, T18–T20 | Fontes, matching, prioridades e reversão sem perda histórica |

**Observação:** a associação acima define responsabilidade principal; não dispensa os testes cruzados nem autoriza marcar uma decisão como atendida por mera existência do arquivo correspondente.

## 5. Sequência de integração e milestones técnicos — sem gates humanos extras rotineiros

| Marco interno | Tarefas | Resultado verificável |
|---|---|---|
| M0 — Fundamentos | T01–T03, T06 (cálculo puro) | Identidades, schemas, contratos versionados e política de revisão; testes de migração/operação |
| M1 — Revisões | T04–T05, T07–T08 | Sugestão→compromisso→execução, atraso e planejamento F3 com CAS |
| M2 — Evidências | T09–T10, T14 básico | Pontos fracos e tendências reproduzíveis; projeções consistentes |
| M3 — Banca | T11–T13 | Fonte/versionamento, match, ranking e reversão |
| M4 — Portabilidade e avisos | T15–T16 | Import/export seguro e central local |
| M5 — Experiência | T17–T18 | Jornadas end-to-end e explicabilidade |
| M6 — Hardening | T19–T20 | Testes adversariais, regressão, revisão e pacote de aceite |

A execução deverá implementar **os mecanismos mínimos de invalidação e causalidade em T03**, exercitá-los em T04–T13 e completar/otimizar as projeções em T14. T06 (motor puro) **precede T04** (sugestões que o consomem); T09–T10 antecedem a integração da deficiência ao ranking em T13. O número da tarefa é identificador estável de rastreabilidade, **não prescrição de ordem cega**. Poderá antecipar T14 se o código real exigir; **não** abrir subprojetos separados, não repetir especificação, não criar PR por marco. Se um defeito em módulo anterior exigir correção, tratar no mesmo fluxo de trabalho, com testes. O GOAL futuro autorizará alterações rotineiras cobertas pela spec, mas **não** operações destrutivas, mudanças arquiteturais materiais, acesso a dados reais ou publicação remota não autorizada.

## 6. Definition of Done, matriz de evidências e relatório de aceite

**Checklist cumulativo para recomendar `F5_READY_FOR_HUMAN_REVIEW` (não declarar antecipadamente):**

1. Mapa F0 (3 funcionalidades), D-F5-01–28 e F5-T01–48 sem lacunas; cada cenário com resultado real, fixture, teste, assertiva e arquivo vinculado. **48 classificados não significa 48 aprovados**: casos críticos de integridade/segurança requerem `PASS` observável; `NOT_RUN`/`INCONCLUSIVE`/`BLOCKED` não podem ser usados como aceite desses casos.
2. `npm run typecheck`, `lint`, `build`, `test:unit`, `test:e2e`: resultados efetivos anexados com contagens, falhas e skips; não substituir por relatos do Codex sem verificação quando possível.
3. Migrações IndexedDB aditivas testadas contra base anterior sintética; nenhuma perda de dados F1–F4, operações, conflito, tombstone, journal/draft.
4. Sem perda silenciosa de execução F5; consultas sem mutações; dois opIds distintos não quitam indevidamente o mesmo compromisso; offline/retry/duas abas sem duplicidade; **nenhum tipo F5 sai pela outbox remota ainda não homologada e nenhum ACK é inventado**.
5. F3 capacidade GLOBAL preservada **no commit**, com vínculo de resultado `APPLIED` somente após read-back; F4 contagens, intervalos e tempo global únicos; F2 hierarquia por IDs, nunca nome; resultados inconclusivos explícitos.
6. Cálculos versionados/determinísticos; políticas e critérios de suficiência acompanhados de fixtures e explicações, limites e fallback, sem métricas psicométricas inventadas.
7. Portabilidade com preview, segurança, isolamento de perfil, quota/abort e idempotência; avisos locais sem falsas garantias de background.
8. QA Impeccable, screenshots nos oito temas e viewports relevantes, teclado, touch/contraste, leitor de tela onde disponível; relatório de acessibilidade sem afirmar teste físico não feito.
9. Revisão independente (agente distinto quando acessível), problemas materiais corrigidos e testes repetidos; não fazer ciclos redundantes sem novo achado.
10. Lista de riscos residuais e estados `PASS|FAIL|NOT_RUN|INCONCLUSIVE|BLOCKED`; quatro HIGH F0 e F4-T13 mantidos com status real; F7 explicitamente não homologada. **Nenhuma ressalva herdada vira automaticamente `PASS`, mas nenhuma pendência externa é usada para ocultar falha material local da F5.**
11. Candidato Git preservado: árvore e commits inventariados; `main` não modificada; nenhuma Action, branch ou PR novo sem necessidade; nenhuma limpeza destrutiva não autorizada.
12. Relatório único de handoff: `HEAD`, commits, arquivos, testes, falhas, estado da `v2` local e remota, PR/branches/worktrees/stashes, pendências e solicitação de aceite humano. `push/merge` apenas após gate explícito com read-back.

### Gate de casos críticos (não basta "48/48 classificados")

**Impedem `F5_READY_FOR_HUMAN_REVIEW` sem `PASS` ou correção/reavaliação humana explícita:** F5-T03, T05–T10, T18–T23, T26, T34–T45, além de qualquer subcaso de quota, isolamento entre perfis, ausência de sucesso falso, integridade da outbox e referências F2/F3/F4. Esses são casos de integridade, dados, concorrência e segurança — não podem ser aceitos por equivalência documental. F5-T47 exige evidências de interface/A11y viáveis no ambiente e falhas graves corrigidas. F5-T48 exige regressões verificadas. As ausências tecnicamente externas à F5 (Firebase real, hardware de suspensão F4-T13) são **ressalvas herdadas**, e não PASS de cenário da F5.

**Se ambiente impedir teste crítico:** registrar exatamente o cenário, o que é impossível medir, o risco e uma alternativa segura; manter o candidato como `BLOCKED`/`NOT_READY` nesse aspecto até validação apropriada. O gate humano poderá aceitar explicitamente com ressalvas, mas o relatório não antecipará aceitação.

### Formato mínimo de evidência por cenário

| Campo | Conteúdo exigido |
|---|---|
| `caseId` | F5-T01…F5-T48 |
| `testId/path` | Nome real do teste executado, sem placeholders quando fechado |
| `fixture` | IDs e dados sintéticos reproduzíveis |
| `command` | Comando/ambiente/versão executados |
| `expected`/`observed` | Resultado esperado versus observado, incluindo casos negativos |
| `status` | `PASS`, `FAIL`, `NOT_RUN`, `INCONCLUSIVE`, `BLOCKED` |
| `evidence` | Log, screenshot, checksum, saída ou referência verificável |
| `limitation` | Restrições de mock, browser, hardware, ambiente e riscos |

## 7. Conciliação documental e próximo gate

**A especificação revisada foi aprovada nesta conversa, mas seu conteúdo normativo ainda não foi confirmado como publicado no GitHub. O rascunho histórico na branch `v2` não substitui o arquivo aprovado.** No futuro GOAL autorizado, antes de editar o código, o Codex deverá localizar/cotejar o arquivo revisado pelo SHA-256 declarado neste plano, comparar com a proposta histórica existente em `v2`, **não sobrescrever decisões aprovadas sem análise de diff**, e publicar/citar a especificação e o plano **somente se essa publicação estiver autorizada**. A própria elaboração deste writing-plans não realiza commit nem push.

**Próximo gate humano:** revisar e aprovar este writing-plans revisado; a política e critérios de seleção de parâmetros estão especificados, mas **valores numéricos concretos não foram homologados** e exigem justificativa/fixtures antes do código correspondente, com autorização adicional apenas para escolhas materiais fora da política. Depois, poderá ser elaborado **um GOAL único** com preflight atualizado, execução autônoma, testes locais, revisão, aceite e integração sob autorização específica. O GOAL não é gerado nem executado neste documento.

---

**Estado de conclusão deste artefato:** `F5_PLAN_REVIEWED_PENDING_HUMAN_APPROVAL`. **Revisão documental não é aprovação do writing-plans, execução do Codex ou homologação das 48 evidências.** Documento apenas de planejamento; 0 funcionalidades implementadas por esta entrega; 0 testes de F5 executados por esta entrega; nenhum commit, push, PR, GitHub Action ou deploy realizado.
