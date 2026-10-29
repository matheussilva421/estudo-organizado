# Estudo Organizado V2 — F3: Planejamento, calendário, Ciclo de Estudos e Reta Final

**Especificação formal — APROVADA em 2026-10-29 pelo proprietário.**
**Gate:** `F3_SPEC_APPROVED` — arquitetura D-F3-01 a D-F3-26 e detalhamentos técnicos aprovados; writing-plans, GOAL, implementação, integração e publicação **não autorizados** por este aceite.
**Repositório:** `matheussilva421/estudo-organizado` · **linha de desenvolvimento:** `v2` · **produção V1:** `main` intocada.
**Fontes:** [spec-mestra D01–D27 + A-01/A-02](2026-10-19-estudo-organizado-v2-design.md), [spec F2](2026-10-28-estudo-organizado-v2-f2-content-design.md), [aceite F2](../audits/2026-10-28-v2-f2-acceptance.md), [roadmap](../v2/ROADMAP.md), inventário F0, decisões aprovadas em conversa.

> **Reconciliação:** atualização do arquivo preliminar F3 existente, sem criar outra spec. F0, F1 e F2 foram aceitas **com ressalvas**; F2 `F2_ACCEPTED_WITH_RESERVATIONS` em 2026-10-29 (referência `8e4dc71`, 188 testes unitários e 50 E2E PASS), exclusivamente no escopo local/simulado. Firebase, sincronização multi-dispositivo real, recuperação produtiva, migração real e publicação **não** estão homologados. F3 ainda não implementada.

## 1. Objetivo, resultados e escopo

Transformar conteúdos acadêmicos F2 em planejamento confiável. Usuário deve identificar próximo conteúdo, data ou janela planejada, tempo disponível, prioridade, pendências e conflitos; organizar vários concursos; manter cenários independentes; operar **Ciclo sem data de prova** ou **Reta Final com data de prova**; usar calendário dia/semana/mês; editar planos com rascunhos duráveis, import/export, checkpoints e redistribuição.

**Fora da F3:** sessões, timers e tempo real F4; inteligência baseada em desempenho e revisões F5; dashboards finais F6; Firebase real, backups e migração operacional F7; cutover V1→V2 F8; calendários externos obrigatórios; serviços pagos e automação opaca. **Planejamento não equivale a execução.**

**Stack e invariantes globais:** React/TypeScript/Vite/PWA, domínio desacoplado de UI e infraestrutura; IndexedDB V2 local-first canônico e única outbox F1/F2; schemas/versionamento explícitos; nenhuma duplicação autoritativa; custo recorrente R$ 0; nenhuma alteração V1/`main`, GitHub Actions/CI-CD, novos PRs ou branches permanentes por padrão. Nenhum dado ou trabalho pode ser perdido silenciosamente.

## 2. Abordagens confrontadas

| Abordagem | Trade-off | Veredito |
| --- | --- | --- |
| Manual integral | Controle máximo, montagem cansativa para dezenas/centenas de blocos | Disponível como alternativa |
| **Wizard determinístico e editável** | Regras verificáveis e prévia; demanda validação de conflitos e capacidade | **Aprovado** |
| Automação irrestrita | Conveniência, porém presumiria prioridades e ocultaria decisões | Rejeitado |

Evitar event sourcing completo, CRDT genérico, processamento remoto obrigatório e novos serviços sem necessidade demonstrada. Reutilizar estruturas F1/F2.

## 3. Rastreabilidade funcional F0 — 11 itens

| ID | Cobertura F3 |
| --- | --- |
| `F-V1-STUDY-ORGANIZER` | Agenda e organização de atividades planejadas |
| `F-V1-CALENDAR` | Visões dia/semana/mês derivadas da fonte canônica |
| `F-V1-CYCLE` | Ciclo por disciplina, continuidade por assunto/aula e avanço explícito |
| `F-V1-PLANNING-WIZARD` | Wizard por etapas, persistência local, prévia e confirmação |
| `F-V1-RF-OVERVIEW` | Reta Final por dia/disciplina/assunto, capacidade e blocos |
| `F-V1-RF-IMPORT` | Importação legada V1 e V2 conservadora |
| `F-V1-RF-EDITOR-PLANNER` | Editor por bloco/lote, rascunhos, commit transacional |
| `F-V1-RF-HISTORY` | Checkpoints, histórico, undo/redo compensatório |
| `F-V1-RF-CONFLICTS` | CAS, conflitos granulares, merge de três vias |
| `F-V1-RF-PORTABILITY` | Exportação JSON acadêmica seletiva |
| `F-V1-RF-REDISTRIBUTION` | Redistribuição assistida por capacidade e prioridade |

Nenhuma funcionalidade pode ser declarada coberta sem teste ou exceção humana expressa.

## 4. Decisões ratificadas D-F3-01 a D-F3-26

| ID | Opção | Decisão vinculante |
| --- | --- | --- |
| D-F3-01 | C | Múltiplos cenários independentes por edital |
| D-F3-02 | B | Um único cenário ativo por edital, ativação com prévia/checkpoint/atomicidade |
| D-F3-03 | B | Capacidade global entre editais; excesso `UNALLOCATED` |
| D-F3-04 | B | `CivilDate`, `ZonedLocalDateTime` IANA, `Instant` UTC |
| D-F3-05 | B | Histórico versionado, undo/redo por operações compensatórias |
| D-F3-06 | C | Prioridades configuráveis e explicáveis |
| D-F3-07 | B | Perfis de prioridade versionados, fixados por cenário, overrides locais |
| D-F3-08 | B | Draft local persistente separado de plano confirmado |
| D-F3-09 | B | Import V1/V2/legado com identidade, proveniência e reconciliação supervisionada |
| D-F3-10 | B | Merge granular três-vias, CAS e resolução explícita |
| D-F3-11 | B | Ciclo quando não há data; Reta Final quando há data; transição assistida |
| D-F3-12 | B | Replanejar assistidamente prova adiada/antecipada/suspensa/cancelada |
| D-F3-13 | B | Cursor e avanço explícitos de Ciclo sem simular F4 |
| D-F3-14 | B | Projeção flexível com fixações preservadas |
| D-F3-15 | B | Ciclo por disciplina com continuidade por assunto/aula F2 |
| D-F3-16 | B | Identidades F2 e vínculo contextual preservados, reconciliação assistida |
| D-F3-17 | B | Disponibilidade semanal, exceções, períodos especiais, capacidade zero |
| D-F3-18 | B | Blocos com data/duração e horários opcionais |
| D-F3-19 | B | Contrato F4: múltiplas sessões parciais por bloco e sessões avulsas |
| D-F3-20 | B | Aproveitamento entre editais sem duplicar minutos reais |
| D-F3-21 | B | Encerramento assistido de Reta Final após data da prova |
| D-F3-22 | B | Exportação seletiva, acadêmica e autocontida |
| D-F3-23 | B | Wizard determinístico, editável, granularidade disciplina/assunto/aula |
| D-F3-24 | B | Horizonte adaptativo, limites medidos, sem truncamento silencioso |
| D-F3-25 | B | Retenção seletiva e consolidação somente comprovadamente segura |
| D-F3-26 | B | Aceite por riscos, TDD/testes locais, revisão independente e evidências |

## 5. Modelo lógico, identidades e ciclo de vida

**Fonte F2:** `Edital`, `StudySubject`, `EditalDiscipline`, `Assunto`, `Aula`, `LessonTopicLink`; sem cópia canônica. `StudySubject` é disciplina por perfil, `EditalDiscipline` é vínculo contextual por edital com alias visual opcional. Assuntos/aulas respeitam escopo da associação. Relações por IDs opacos estáveis, não nomes.

**Entidades F3 propostas:** `PlanningScenario`, `PlanBlock`, `CycleCursor`, `PriorityProfile`, `AvailabilityTemplate`, `AvailabilityException`, `PlanningDraft`, `PlanningOperation`, `PlanningCheckpoint`, `PlanningConflict`, `PlanningImportReceipt` e referências acadêmicas. São **responsabilidades lógicas**, não uma obrigação de criar classes/stores separadas. Reutilizar comandos, entidades, operações e IndexedDB existentes.

**Cenário mínimo:** `id`, `profileId`, `editalId`, `kind=CYCLE|FINAL_STRETCH`, nome/configurações, estado, revisão/schema/proveniência, revisão do perfil de prioridade, disponibilidade referenciada, período e blocos. Estados lógicos: `DRAFT`, `ACTIVE`, `INACTIVE`, `SUSPENDED`, `CLOSED`, `ARCHIVED`. Draft de edição não é automaticamente cenário `DRAFT`.

**Bloco mínimo:** `blockId`, `scenarioId`, `profileId`, `editalId`, referência `EditalDiscipline` e assunto/aula opcionais, duração validada, prioridade/origem, estado de alocação, `civilDate`, intervalo horário/zona opcionais, revisão e proveniência.

Máximo **um ACTIVE por edital**; diferentes editais podem ter ACTIVE simultaneamente. Cenário INACTIVE é apenas comparado/simulado e **não consome capacidade oficial**. Troca de cenário exige prévia, checkpoint e commit atômico da desativação/ativação. Arquivo e encerramento preservam histórico.

## 6. Contratos temporais

- `CivilDate`: `YYYY-MM-DD` sem inferência de hora/fuso; data de prova sem hora não cria 00h nem bloqueia dia inteiro.
- `ZonedLocalDateTime`: data/hora locais + zona IANA e desambiguação.
- `Instant`: UTC para auditoria, não prova causal por timestamp.
- `PlannedMinutes`: duração planejada validada, diferente de duração F4.
- `RecurrenceRule`: recorrência ancorada na zona de referência.

Mudança de fuso do dispositivo não desloca a data civil da prova. Remarcação cria operação auditável; intervalos que cruzam meia-noite distribuem capacidade entre dias corretamente.

**Política técnica ratificada para DST:** hora local inexistente é rejeitada; hora ambígua exige escolha explícita de ocorrência/offset. Recorrências afetadas ficam pendentes de resolução, sem deslocamento silencioso. Testar relógio errado, mudança de fuso, DST e datas sem horário.

## 7. Disponibilidade e calendário

Rotina semanal global, janelas opcionais, exceções pontuais/períodos especiais, dias sem estudo e compromissos fixos. **Precedência aprovada:** exceção de data prevalece sobre período especial, que prevalece sobre rotina semanal; colisões de mesma precedência exigem resolução explícita.

Capacidade deve validar **minutos e compatibilidade real de horários**: compromissos fixos reservam intervalos sem desconto duplicado; flexíveis só ocupam janelas livres; soma entre cenários ativos não ultrapassa capacidade sem identificação/consentimento. Cenários alternativos não alteram o calendário oficial. `UNALLOCATED` mostra todos os itens inviáveis, motivos e propostas; nunca elimina blocos silenciosamente.

Estados distintos: projeção flexível; bloco confirmado no dia; bloco com horário fixo; não alocado; futura sessão F4 real. Fixações persistem quando projeção ou janela do Ciclo são recalculadas. Calendário dia/semana/mês usa consultas derivadas, filtros e virtualização quando apropriado, nunca snapshot autoritativo da UI.

## 8. Ciclo de Estudos

Sem prova marcada. Sequência por `EditalDiscipline` com pesos/durações; cursor mantém continuidade de assuntos e aulas F2, pendências e histórico. Avanço apenas por comando **continuar / avançar / adiar / pular com justificativa / reabrir / reiniciar rodada**. Mudança de data ou passagem da projeção não gera estudo real.

Projeções renováveis dentro de janela configurável, sem futuro ilimitado; recalcular somente blocos flexíveis e manter fixações e histórico. Quando data de prova é confirmada, propor Reta Final reaproveitando conteúdos, prioridades e pendências; usuário vê prévia e confirma transição, preservando Ciclo anterior. **Não manter Ciclo e Reta Final ativos ao mesmo tempo no mesmo edital.**

## 9. Reta Final

Exige data de prova confirmada como `CivilDate`. Wizard recebe edital, horizonte até prova, blocos e granularidade, capacidade global, perfil de prioridade e compromissos. Produz proposta para período completo, com `UNALLOCATED` explícito; consulta/renderização eficientes para centenas de blocos.

Prova antecipada, adiada, suspensa ou cancelada ⇒ proposta de replanejamento com prévia de blocos alterados, capacidade, checkpoints; confirmação explícita, sem reescrever histórico. Se data deixa de existir, suspender Reta Final, cessar novas reservas futuras e oferecer retorno assistido ao Ciclo.

Data vencida **não** comprova realização: solicitar confirmação (ocorrida/remarcada/indefinida), cessar projeções futuras até regularização e oferecer encerramento, novo cenário ou Ciclo. Não afetar outros editais nem sessões F4.

## 10. Motor de prioridade e geração

Perfis de prioridade são reutilizáveis e **versionados**; cenário fixa revisão, com overrides locais explícitos. Atualizar perfil gera nova revisão e upgrade supervisionado. Critérios permitidos: pesos definidos, conteúdos, urgência derivada de data confirmada, capacidade, duração e restrições; não presumir desempenho F4/F5.

Mesmas entradas/revisões/políticas geram resultado **semanticamente equivalente**. Explicar toda priorização, movimentação ou déficit. Proposta nunca se aplica sozinha. Wizard em etapas: edital/tipo → conteúdos → granularidade/duração → prioridades → disponibilidade → prévia editável → validação e confirmação. Edição manual e importação continuam opções. Estado do wizard é persistente localmente.

## 11. Editor, draft e commit

Editar individualmente ou em lote: criar, duplicar, mover, reordenar, arquivar/restaurar blocos, duração, data, horário e prioridades. `PlanningDraft` local persiste separado de `CommittedPlan`, guarda `baseRevision` e alterações, recuperável após fechar/reabrir; sem promessa de sync remoto do draft.

**Apply:** validar perfil/edital/conteúdo F2 → revalidar revisão/CAS e conflitos → recalcular capacidade/tempo → prévia → checkpoint → **uma transação IndexedDB** com entidades, journal/metadados e intenção de outbox → somente então feedback `LOCAL_COMMITTED` e atualização da UI. Falha/quota mantém plano e draft íntegros. `operationId` idêntico + payload idêntico é idempotente; mesmo ID com payload distinto é conflito/erro.

## 12. Conflitos, histórico, checkpoints

Merge de três vias com base, atual e draft: mesclar edições independentes **apenas** quando as invariantes globais resultantes forem satisfeitas. Mesma propriedade, delete versus edit, data ou capacidade incompatível, vínculos F2 inválidos e prioridade divergente exigem resolução explícita. Persistir versões/proveniências, nunca `last-write-wins` silencioso. Lock/broadcast entre abas não substitui CAS **dentro da transação**. Remoto fake ≠ sync real F7.

Journal versionado e histórico consultável; undo/redo por operações compensatórias, sem restaurar estado antigo apagando alterações posteriores ou sessões F4. Restaurar checkpoint requer prévia/revalidação. Checkpoint manual só excluído com autorização explícita; automáticos só consolidados quando dependências de drafts, journals, tombstones, conflitos e estados recuperáveis estiverem comprovadamente seguras. Draft não aplicado jamais limpo automaticamente. Quota/abort/upgrade bloqueado ⇒ erro explícito, sem sucesso falso; backup operacional F7.

## 13. Integridade F2 e contrato F4

Renomeações compatíveis atualizam exibição sem mudar ID. Alias de `EditalDiscipline` é contextual; reorganizar não altera plano confirmado automaticamente. Arquivar, excluir logicamente ou invalidar vínculo F2 sinaliza blocos afetados para reconciliação; matching por nome apenas sugere. Histórico preservado, bloco órfão não é tratado como conteúdo válido.

F4 (apenas contratos/fixtures nesta fase): um bloco poderá receber várias sessões parciais; sessão avulsa poderá não ter bloco; sessão tem identidade própria e poderá beneficiar explicitamente conteúdos de vários editais. **Tempo global contado uma vez por sessão**; cobertura de conteúdo não conclui automaticamente blocos de outros planos. Reagendar/arquivar/desfazer planejamento nunca reescreve execução real.

## 14. Importação/portabilidade

Adaptadores read-only V1/V2/legado: validar tipo/tamanho/schema/profundidade/segurança → normalizar cópia → identidade/proveniência → comparação semântica → prévia de novo/equivalente/ambíguo/divergente e `UNALLOCATED` → revalidar baseRevision → commit atômico com recibo idempotente. Ausência de `schemaVersionRetaFinal`, `planId` ou `revision` não significa arquivo vazio. Não auto-merge por nome; conflito/quarentena/rejeição segura para entradas desconhecidas, divergentes ou hostis.

Exportação seletiva de cenários em **JSON acadêmico autocontido e versionado**, com blocos, configurações necessárias, refs F2, identidades de origem e proveniência; exclui credenciais, tokens, UID como identidade confiável, outbox, sessões reais, logs privados e outros editais. Importar em outro perfil exige remapeamento explícito. Equivalência semântica no roundtrip, não bytes idênticos. Não substituir backup F7.

## 15. API e persistência

Comandos conceituais: `CreatePlanningScenario`, `PreviewPlanningGeneration`, `ApplyPlanningGeneration`, `ActivatePlanningScenario`, `UpdateAvailability`, `SetAvailabilityException`, `AdvanceCycle`, `FixPlannedBlock`, `SavePlanningDraft`, `PreviewDraftCommit`, `ApplyPlanningDraft`, `PreviewFinalStretchTransition`, `ApplyFinalStretchTransition`, `PreviewReplanning`, `ApplyReplanning`, `CloseFinalStretch`, `CreatePlanningCheckpoint`, `RestorePlanningCheckpoint`, `UndoPlanningOperation`, `RedoPlanningOperation`, `PreviewPlanningImport`, `ApplyPlanningImport`, `ExportPlanningScenarios`, `ResolvePlanningConflict`. **Propostas de nomes; reutilizar API existente quando equivalente.**

Comandos relevantes recebem `profileId`, escopo, `operationId`, revisão-base e validação; retornos distinguem `LOCAL_COMMITTED`, `CONFLICT`, `INVALID`, `BLOCKED`, `FAILED`. `REMOTE_COMMITTED` e `CONVERGED` dependem de provas remotas, não de IndexedDB.

Consultas indexadas: cenários ativos/inativos, agenda, capacidade, blocos por conteúdo, cursor Ciclo, visão Reta Final, não alocados, draft, histórico, conflitos e prévias. Não gravar por efeito de renderização, nem criar estado React global duplicado. Evolução de schema IndexedDB versionada e única outbox F1/F2.

## 16. Desempenho, limites e UX

Ciclo projeta janela futura renovável; Reta Final consulta todo período até prova. Testar fixture com **180 blocos** e outra com pelo menos o dobro, vários editais, mobile/dispositivo modesto, offline, conflitos e quota. 180 **não é limite**. Limites de volume, processamento, payload e retenção devem resultar de **medição local reproduzível** no writing-plans, sem copiar teto F2 ou inventar números. Acima de limite comprovado: diagnóstico/divisão supervisionada; nada truncado ou parcialmente ativado.

Visões necessárias: painel cenários, wizard, calendário dia/semana/mês, Ciclo, Reta Final, editor, redistribuição, import/export, checkpoint e conflitos. Responsivo desktop/tablet/mobile, oito temas A-01/Impeccable, teclado, foco, rótulos, contraste, touch, status offline, draft/confirmado e local/remoto honestos. Zero toasts de sucesso falso.

## 17. Riscos e fronteiras F7

| Risco | Mitigação |
| --- | --- |
| Capacidade duplicada entre cenários/editais | Cálculo global só ativos; CAS |
| Tempo/datas corruptos | CivilDate/IANA/DST e testes adversariais |
| Draft perdido ou commit parcial | Persistência separada/transação única |
| Ref F2 órfã/homônima | IDs e reconciliação supervisionada |
| JSON legado divergente/hostil | Adaptadores, validação, quarentena |
| Sessão aproveitada em dois editais | Uma contagem real, múltiplos vínculos |
| Retenção excessiva ou exclusão destrutiva | Consolidação com prova de dependências |
| Sync não homologado | Contrato fake explícito; F7 independente |

**Ressalvas F2 antes do sync real:** revalidação transacional e remota de resolução de conflitos, detecção de ciclos completos em payload remoto, e supressão do eco de operações pendentes após adoção remota. `F2-T22 NOT_RUN`, quatro riscos HIGH F0 `UNVERIFIED`. Não habilitar Firebase real por consequência do aceite F3.

## 18. Matriz F3-T01..F3-T42

| ID | Critério testável |
| --- | --- |
| F3-T01 | Múltiplos cenários no mesmo edital |
| F3-T02 | Só um ACTIVE por edital; troca atômica |
| F3-T03 | Múltiplos editais ativos com capacidade global correta |
| F3-T04 | Cenário inativo não altera capacidade oficial |
| F3-T05 | CivilDate preservada ao mudar fuso |
| F3-T06 | DST ambíguo/inexistente tratado explicitamente |
| F3-T07 | Recorrências e intervalos atravessando meia-noite |
| F3-T08 | Prioridades determinísticas e explicadas |
| F3-T09 | Revisão antiga do perfil permanece fixada |
| F3-T10 | Draft sobrevive a reload/reabertura |
| F3-T11 | ApplyDraft atômico e idempotente |
| F3-T12 | Quota falha sem perder plano/draft |
| F3-T13 | Merge 3-way de campos independentes |
| F3-T14 | Delete concorrente com edit mantém conflito |
| F3-T15 | CAS transacional em duas abas |
| F3-T16 | Import V1 sem campos versionados |
| F3-T17 | Import repetido sem duplicação |
| F3-T18 | Mesmo arquivo/origem aparente mas divergente preservado |
| F3-T19 | Conteúdo homônimo não gera auto-merge |
| F3-T20 | Ciclo sem prova marcada |
| F3-T21 | Continuar, adiar, pular com motivo e avançar ciclo |
| F3-T22 | Projeção dentro do horizonte do ciclo |
| F3-T23 | Fixação preservada ao recomputar projeção |
| F3-T24 | Reta Final exige data confirmada |
| F3-T25 | Transição Ciclo→Reta Final preserva histórico |
| F3-T26 | Adiamento, antecipação, suspensão/cancelamento da prova |
| F3-T27 | Prova vencida não é presumida realizada |
| F3-T28 | Exceções e dias de capacidade zero |
| F3-T29 | Sobreposição sem desconto duplicado |
| F3-T30 | `UNALLOCATED` sem perda de conteúdo |
| F3-T31 | F2 arquivada/soft-deleted/vínculo inválido |
| F3-T32 | Undo/restore não altera fixtures F4 |
| F3-T33 | Integridade de checkpoints, journal e dependências |
| F3-T34 | Roundtrip JSON semanticamente equivalente |
| F3-T35 | Sem vazamento de credenciais/dados de outros editais |
| F3-T36 | Contrato sessão parcial e estudo avulso |
| F3-T37 | Sessão multi-edital sem dupla contagem |
| F3-T38 | 180 blocos íntegros sob geração/edição/consulta |
| F3-T39 | Carga maior e limite com falha segura |
| F3-T40 | E2E desktop/tablet/mobile, oito temas, offline e a11y |
| F3-T41 | V1 e main preservadas |
| F3-T42 | Fake local não equivale a sync real |

Camadas: unitário, integração IndexedDB, contrato fake F2/F4/A-02, E2E, performance, acessibilidade, regressão F1/F2 e revisão independente. Exigir fixtures, comandos, resultado esperado e evidências `PASS|FAIL|BLOCKED|NOT_RUN`; revisão não executada permanece NOT_RUN/BLOCKED, sem atestado fictício. Ajustar detalhes técnicos dos testes no writing-plans sem retirar comportamento aprovado.

## 19. Definition of Done e gates

F3 só pode ser **proposta para aceite humano** após: 11 funcionalidades cobertas/exceções aprovadas; D-F3-01..26 rastreadas a código/testes; calendário, fusos/DST, capacidade, Ciclo, Reta Final, wizard, editor, import/export, recuperação/conflitos validados; testes locais, typecheck/lint/build e regressões comprovados; revisão independente/falhas materiais tratadas; contratos F4/F7 honestamente simulados; integração **autorizada** na `v2` confirmada (ou bloqueio declarado); higiene Git (branches, PRs, worktrees e commits exclusivos) inventariada; aceite humano explícito.

**Estados distintos:** `IMPLEMENTED` ≠ `TESTED` ≠ `INTEGRATED_TO_V2` ≠ `ACCEPTED` ≠ `PUBLISHED`. Não encerrar F3 apenas com testes verdes.

Fatias **internas da mesma fase**, sem PRs/branches por ajuste: F3-A calendário/disponibilidade/Ciclo; F3-B Reta Final/wizard/importação/portabilidade; F3-C editor/drafts/histórico/conflitos; F3-D prioridade/redistribuição/UX/regressão. Writing-plans pode reordenar pelo código real.

Preflight do GOAL futuro: HEADs `v2`/`main` local/remoto, árvore, stashes, PRs, branches, worktrees, commits únicos, migrações, testes F1/F2, pendências e possíveis mudanças concorrentes entre PCs. Sem operações destrutivas ou integração não autorizada.

**Sequência de gates:** brainstorming/arquitetura aprovada → **spec F3 aprovada em 2026-10-29** → writing-plans F3 por ChatGPT/Superpowers → aprovação humana do plano → GOAL Codex → implementação/TDD → revisão, testes e correções → integração autorizada `v2` → saneamento → aceite humano. `main` da V1 e deploy preservados.

## 20. Registro documental do aceite

- Arquivo pré-existente reconciliado, sem duplicação documental.
- Atualizado F2 para `F2_ACCEPTED_WITH_RESERVATIONS`.
- Incorporadas 26 decisões Superpowers e os três detalhamentos expressamente aprovados: **política DST**, **precedência de disponibilidade** e **limites/retenção medidos antes de fixar números**.
- Mantidas 11 funcionalidades F0, limites F4–F8, quatro riscos HIGH e três lacunas F2 para F7.
- **Estado atual:** `F3_SPEC_APPROVED`; writing-plans e implementação ainda não autorizados automaticamente; nenhuma Action/PR, Firebase real, deploy ou mudança de `main` prevista.
