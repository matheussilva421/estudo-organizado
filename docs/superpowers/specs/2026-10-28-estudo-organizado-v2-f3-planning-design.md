# Estudo Organizado V2 — F3: Planejamento, calendário, ciclo e Reta Final

**Status:** **SPEC PROPOSTA / NÃO APROVADA** — arquitetura derivada da spec-mestra D01–D27 + A-01/A-02, F0 e F1 **aceitas com ressalvas**; F2 está com design revisado, porém não aprovado. **Nenhum writing-plans, código ou serviço autorizado.**  
**Pré-requisito:** F1 e F2 com entregas verificadas e gates humanos; modelos canônicos de edital/assunto/aula, operações versionadas, clock, IndexedDB local e status de sync disponíveis.  
**Objetivo:** transformar conteúdo em plano de estudos executável, com calendários confiáveis, cronograma de Reta Final completo, editor, prioridades e histórico não destrutivo.

## 1. Rastreabilidade funcional — 11 itens do inventário F0

| ID | Funcionalidade e destino |
| --- | --- |
| `F-V1-STUDY-ORGANIZER` | Preservar organização de estudos, atividades e agenda, integrada ao calendário |
| `F-V1-CALENDAR` | Preservar mês/semana/dia e eventos planejados; fontes canônicas, não snapshots de view |
| `F-V1-CYCLE` | Preservar ciclo, distribuição de minutos, progresso, conclusão/reabertura e reordenação |
| `F-V1-PLANNING-WIZARD` | **Reformular** wizard em etapas validadas, com prévia e confirmação |
| `F-V1-RF-OVERVIEW` | Preservar visão por dia, disciplina, KPIs e associações |
| `F-V1-RF-IMPORT` | Preservar importação e adoção conservadora de planos |
| `F-V1-RF-EDITOR-PLANNER` | **Reformular** editor de blocos, ações em lote, rascunhos e aplicação segura |
| `F-V1-RF-HISTORY` | Preservar checkpoints, operações, desfazer/refazer sem reescrever fatos consumados |
| `F-V1-RF-CONFLICTS` | **Reformular** resolução granular local/remoto e divergências de versão |
| `F-V1-RF-PORTABILITY` | Preservar JSON portátil, schema, vínculo/proveniência e rejeição de dados privados |
| `F-V1-RF-REDISTRIBUTION` | Preservar proposta de redistribuição por capacidade/prioridades/exceções |

F3 é a fase mais densa funcionalmente. Internamente dividir **somente para testes/aceite** em F3-A (calendário/ciclo), F3-B (Reta Final/import), F3-C (editor/histórico/conflitos), F3-D (redistribuição/UX); continuar uma única fase e branch `v2`. O writing-plans futuro pode separar tarefas por slice sem criar PR por ajuste.

## 2. Contratos de tempo D27 e calendário

- `CivilDate` = dia `YYYY-MM-DD` sem inferir timezone/hora; provas e vencimentos sem horário permanecem como dias.
- `ZonedLocalDateTime` = data/hora locais + ID de zona IANA + política explícita para ambiguidades (DST); `Instant` UTC para auditoria; `Duration` monotônica/validada para estudo (F4); `RecurrenceRule` ancorada em zona de referência.
- Um evento `PlannedActivity` possui `id`, `editalId`, `subjectId?`, `kind`, `civilDate` ou instante + zona quando aplicável, `plannedMinutes`, status, prioridade, `sourcePlanId`, versão e proveniência. Não misturar "prova em 24/01" com prazo "24/01 às 23h59" sem fonte.
- Replanejar atividade **gera nova operação auditável** mantendo história/ligação do registro original; atividades passadas, consumidas ou concluídas não mudam silenciosamente com mudanças no cronograma. Excluir/arquivar não reescreve F4.
- Fuso do dispositivo mudou, dia com DST, civil date sem hora, janela atravessando meia-noite, sábado/feriado não devem corromper eventos ou sessões.
- O app não pode inferir horas da data do edital sem campo explícito de fonte.

## 3. Ciclo e planejamento

**Casos de uso:** criar ciclo por edital; selecionar disciplinas/assuntos e pesos, disponibilidade por dia, limites por janela e eventual data de prova; gerar prévia; aplicar plano com IDs únicos; reordenar, marcar bloco, reagendar, reiniciar ciclo com checkpoint e justificativa. Wizard em passos com estado salvo localmente e validação do fluxo; mudança de objetivo reavalia impacto antes de gravar.

**Invariantes:** soma de minutos alocados não ultrapassa capacidade sem aviso/consentimento; prioridade e disponibilidade têm proveniência; execução e previsão não são a mesma coisa; geração repetida com mesmo `operationId` não duplica blocos; plano de estudo pertence ao edital/UID/perfil correto; não usar efeitos de renderização para gravar agenda. Se houver déficit de capacidade, listar blocos `UNALLOCATED` e oferecer soluções, não sumir com itens.

**Consultas:** visão mensal/semanal/diária, plano por disciplina, capacidade prevista vs usada, blocos atrasados, eventos de origem manual/automática e filtro por edital, sem paginação explosiva no browser.

## 4. Reta Final: importação, ativação, edição e portabilidade

**Plan schema lógico:** `FinalStretchPlan` com id, editalId, origem/proveniência, revisão, período, timezone de referência, blocos e configurações; `FinalStretchBlock` com id, civilDate, assunto/disciplina, duração/capacidade, estado, prioridade, vínculos e revisão. Não reutilizar schema portátil V1 como esquema persistido canônico sem adaptador e validação.

**Importação:** arquivo JSON portátil V1/V2 reconhecido por adaptadores read-only; parse limitado; preview de correspondências (casado/novo/ambíguo), duplicatas, campos incompatíveis e blocos não alocados; ativação só após confirmação explícita e checkpoint. Caso #107: ausência de `schemaVersionRetaFinal`, `planId` ou `revision` não significa ausência de plano acadêmico; normalizar cópia, comparar semântica e preservar ambos se divergir.

**Editor:** edição por bloco e lote, mover/duplicar/arquivar, capacidade diária, filtro e seleção em calendário; cada mutação preserva `operationId`, `baseRevision` e contexto de plano. `Draft` local separado de `CommittedPlan`; fechar/reabrir recupera rascunho, aplicar faz verificação de revisão e commit atômico de alterações + journal; limpar dados realmente limpa rascunhos/journals do **perfil V2** após consentimento e backup, sem atingir V1.

**Histórico:** checkpoint versionado, manifesto e integridade, log de comandos, undo/redo condicionado; nunca reescrever automaticamente sessões posteriores ou criar "tempo estudado" fictício. Preview antes de restaurar checkpoint; conflito mantém versões e proveniências.

**Portabilidade:** JSON acadêmico inclui somente plano, blocos, mapeamento e versão; não carrega credenciais, histórico de sync, sessões privadas, logs ou outros editais inadvertidamente. Import/export iguais produzem equivalência semântica, não necessariamente bytes idênticos após canonicalização.

## 5. Redistribuição, priorização e conflitos

A priorização só usa insumos observáveis disponíveis: capacidade, urgência e evidências acadêmicas aprovadas; a inteligência avançada por desempenho da F5 permanece opcional até implementada. Exibir **por que** determinado bloco foi movido ou ficou não alocado. Uma distribuição é **proposta**, não aplicação automática. Respeitar datas fixas, indisponibilidade e compromissos; alteração de fuso não troca civilDate de prova.

Conflitos remotos da Reta Final são por campo/bloco/linhagem; operação independente pode mesclar com CAS, mas editar e excluir o mesmo bloco, mover para duas datas ou reconciliar planos com origem desconhecida **não** escolhe silenciosamente o último timestamp. Salvar alternativas, impactos na capacidade e revisão manual.

**Status A-02:** commit local confirmado ≠ commit remoto ≠ outro dispositivo atualizado. Não assumir que Google/Firestore real estão disponíveis nesta fase; usar contrato fake até homologação isolada e aprovada.

## 6. Testes TDD e critérios de aceite

| Cenário crítico | Resultado exigido |
| --- | --- |
| Cronograma de reta final extenso e integrado a edital | 180 blocos sintéticos mapeados e contagem preservada; preview consistente |
| Importação repetida / JSON parcial / versão desconhecida | Idempotência ou rejeição/quarentena explícita, nenhum overwrite silencioso |
| Evento sem hora, timezone mudou, DST | Data civil preservada, ambiguidade resolvida por contrato, nenhum horário inventado |
| Disponibilidade menor que plano | Déficit explícito e lista de blocos não alocados; sem perdas |
| Marcar atividade e alterar planejamento depois | Fatos de execução mantidos; história do planejamento rastreável |
| Editor em duas abas / mesmo bloco com revisão diferente | CAS local/remoto simulado e conflito persistido |
| Fechar app com draft e reabrir | Draft durável, preview e aplicação idempotente; nenhum commit fantasma |
| Undo/redo após execução F4 futura | Nunca reescrever sessões/histórico; testar fixtures de sessão dependente |
| Plano legado #107 e variante divergente | Equivalência reconhecida quando demonstrável; divergente/quebrado em quarentena |
| Portabilidade entre perfis/UIDs | Não mesclar acervos/campos privados sem confirmação e isolamento |
| Impeccable desktop/tablet/mobile e oito temas | View calendário e planner legíveis/touch/teclado, sem toasts invasivos |
| Falha IDB/outbox/quota | Rollback completo ou estado reparável, sem sucesso falso |

**DoD F3:** 11 funcionalidades mapeadas como cobertas ou exceções aprovadas, lógica temporal determinística com testes adversariais, import/export/drafts/checkpoints, plano↔execução sem corrupção, UI e QA A-01, integridade local/cross-tab A-02, evidências locais de testes e revisão independente. Se houver sync remoto real isolado, comprovar Rules/custos/readback; caso contrário `NOT_RUN` remoto permanece.

## 7. Bloqueios, premissas e gates

A implementação precisa de schema F2 definitivo, contratos F4 para ligações de execução, estratégia de versão/migração e confirmação sobre priorização automatizada sem dados históricos suficientes. F3 **não implementa sessões reais** (F4), revisões (F5) ou dashboards finais (F6).

**Decisões pendentes para aprovação antes do plano:** políticas de recorrência em DST e sobreposições, regra de principal vs cronogramas simultâneos, semântica de undo depois de fatos consumados, modo de priorização e conexão entre `Draft`/`Journal`/`Plan`. São propostas, não escolhas já ratificadas.

**Gate:** `F3_SPEC_PROPOSED` → revisão humana → writing-plans F3 → gate de plano → GOAL → TDD por slice → teste/revisão → integração à `v2` autorizada → aceite humano. Preservar `main`/V1, sem deploy ou dados reais. Nenhuma aprovação desta spec é implícita.
