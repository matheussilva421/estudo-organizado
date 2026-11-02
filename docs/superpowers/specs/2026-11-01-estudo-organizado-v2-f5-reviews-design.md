# Estudo Organizado V2 — F5: Revisões, pontos fracos e inteligência de banca

**Natureza:** Especificação formal Superpowers — versão revisada após auditoria crítica de consistência.  
**Estado:** `F5_SPEC_REVIEWED_PENDING_HUMAN_APPROVAL`. **Revisão crítica realizada; a especificação ainda não foi aprovada pelo proprietário.**  
**Origem:** brainstorming encerrado e arquitetura D-F5-01–D-F5-28 integralmente aprovada em 01/11/2026 (horário de Brasília).  
**Repositório de referência, somente leitura:** `matheussilva421/estudo-organizado`, branch `v2`.  
**Implementação, writing-plans, push, merge e deploy:** não autorizados por esta especificação.  
**Revisão:** 2026-11-01 (America/Recife). Segunda passagem crítica de contratos e cenários; não constitui revisão por um auditor externo nem execução de testes.  
**Status da fonte:** os contratos documentais foram consultados na `v2`; interfaces e stores efetivamente implementados deverão ser confrontados com o código no preflight técnico futuro, sem presumir conformidade não inspecionada.

## 1. Objetivo e escopo

A F5 transforma conteúdo da F2, planejamento da F3 e evidências de execução da F4 em recomendações locais, explicáveis e auditáveis sobre **o que revisar, quando revisar e por quê**. Deve preservar as três capacidades do inventário F0: `F-V1-REVISIONS`, `F-V1-WEAK-POINTS` e `F-V1-BANCA-ANALYZER`, reformulando sua experiência sem inventar dados, prometer eficácia pedagógica não demonstrada ou depender de IA, API paga ou conexão remota.

**Resultados verificáveis:**

1. Gerar, confirmar, executar, reagendar, cancelar e recuperar revisões, inclusive parciais, sem perda histórica ou alteração silenciosa de blocos F3.
2. Identificar pontos fracos e tendências por assunto, com suficiência, fontes, janela temporal e divergências explícitas.
3. Importar evidências de relevância de banca, propor vínculos à hierarquia da F2, confirmar decisões e calcular prioridades por edital com reversão auditável.
4. Funcionar offline em desktop, tablet e celular, com persistência canônica, degradação honesta e contratos de sincronização simulados.
5. Expor explicações que permitam reproduzir resultados dados os mesmos fatos, versões e parâmetros.

**Fora do escopo:** dashboard integrado e UX global (F6); Firebase real, Google Sign-In, Rules, convergência multi-dispositivo e recuperação integral (F7); migração de dados reais V1, substituição produtiva/cutover (F8); geração automática de questões, ML personalizado opaco, serviços pagos, segundo backend de sincronização ou outro sistema de backup. Não modificar a V1/`main` nem assumir que a `v2` está em produção.

## 2. Bases normativas, contratos documentados e precedência

Referências da branch `v2`, consultadas em modo somente leitura:

- [Arquitetura mestra D01–D27, A-01 e A-02](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-19-estudo-organizado-v2-design.md).
- [Roadmap V2](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/v2/ROADMAP.md) e [issue #108](https://github.com/matheussilva421/estudo-organizado/issues/108): gates e responsabilidades.
- [Especificação F2](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f2-content-design.md): identidades e associações de conteúdo.
- [Especificação F3](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f3-planning-design.md): calendário, `CivilDate`, cenários e transações de planejamento.
- [Especificação F4](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-30-estudo-organizado-v2-f4-execution-design.md) e [aceite com ressalvas](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/audits/2026-10-30-v2-f4-acceptance.md): sessões, intervalos, alocações, medições e causalidade.
- [Proposta histórica da F5](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f5-reviews-design.md): referência não aprovada; não substitui as 28 decisões.

**Precedência:** decisões D-F5-01–28 aprovadas + arquitetura mestra e contratos efetivamente entregues de F1–F4 prevalecem sobre nomes sugeridos em propostas históricas. Se houver divergência entre código real e documentação, registrar impacto e exigir correção/conciliação, não inventar que o contrato já existe.

### 2.1 Identidade F2 e limite de compartilhamento

Na F2, `StudySubject` identifica **disciplina canônica do perfil**, não equivale automaticamente a um assunto de revisão; `EditalDiscipline` associa disciplina e edital, com alias contextual possível. `Assunto`/`Aula` e `LessonTopicLink` pertencem à hierarquia acadêmica. Nenhum nome homônimo cria identidade compartilhada entre editais. O conceito `canonicalReviewTopicKey` desta F5 representa **assunto de revisão validado e seus vínculos explícitos**. Se a F2 não fornecer relação canônica entre assuntos de editais diferentes, manter trajetórias separadas até existir associação confirmada; eventual vínculo F5 deverá ser mínimo, versionado, auditável e não reidentificará registros F2. Nunca usar `StudySubject.id` como se fosse `Assunto.id`.

### 2.2 Capacidade e fatos F3/F4

- **F3:** um cenário `ACTIVE` por edital; cenários de editais diferentes podem coexistir; cenários `INACTIVE` não consomem capacidade oficial. `PlanBlock`, `PriorityProfile`, alterações e capacidade obedecem ao editor, à prévia, à revisão-base e ao commit transacional F3. `CivilDate` é data acadêmica sem horário presumido.
- **F4:** `StudySession`, `SessionAllocation` e `StudyMeasurement` são fatos de execução. Alocações de tempo e contagens de questões podem ser parciais/não atribuídas. As contagens não garantem identidade de cada questão nem independência estatística. Tempo global é contado uma vez; vínculo a múltiplos editais não duplica fato.
- **Ressalvas:** F4 aceita com ressalvas, `INCOMING` parcial e F4-T13 `NOT_RUN`. A F5 deverá degradar de forma segura diante de evidência F4 pendente; testes fake não representam homologação Firebase real da F7.

### 2.3 Infraestrutura e permissões

Reutilizar `apps/v2/`, IndexedDB canônico `estudo-organizado-v2`, comandos de domínio, `operationId`, revisão/CAS, outbox única, conflitos, tombstones, backup e atualização PWA já existentes. Não criar DB, sync peer, event sourcing integral, fila paralela, origem web ou serviço pago. F5 não pode ler outro perfil nem acessar dados reais V1 sem autorização.

## 3. Modelo lógico, causalidade e ciclo de vida (D-F5-01, 03, 12–14, 23, 28)

Os nomes são responsabilidades **lógicas**; não exigem stores/classes novas quando os contratos existentes forem suficientes.

| Conceito | Natureza | Conteúdo e invariantes |
|---|---|---|
| `ReviewTopicLink` (se necessário) | Decisão de vinculação | `profileId`, identificadores F2 tipados e íntegros, grupo canônico de revisão, versão, proveniência e decisão explícita; sem inferência por nome. |
| `ReviewSuggestion` | **Projeção** regenerável | Chave semântica de geração (perfil/tópico/cobertura/base/política), data `CivilDate`, duração estimada, dependências/fingerprint, versão e justificativa; nunca é conclusão ou compromisso. |
| `ReviewCommitment` | **Fato/decisão durável** | ID próprio, perfil, tópico/escopo confirmado, `CivilDate` original e vigente, versão/revisão-base, origem da confirmação (`MANUAL` ou opt-in), eventual referência F3, estado e histórico auditável. |
| `ReviewExecution` | **Fato durável** | ID próprio, perfil, compromisso opcional, execução civil/instante quando conhecido, escopo efetivo, avaliação `FORGOT`/`PARTIAL`/`GOOD`/`UNRATED`, referência F4 opcional e proveniência; revisão/retificação explícita. |
| `ReviewPolicy` | Configuração durável versionada | Perfil, parâmetros e limites, fallback, overrides por assunto; mudanças não reescrevem fatos. |
| `WeakPointProjection` | Projeção | Assunto, janelas, contagens válidas, retenções separadas, suficiência, tendência, conflitos, proveniência e versão. |
| `BoardEvidence` | Evidência versionada | Fonte, tipo qualitativo/quantitativo/preferência, período, abrangência, tamanho de amostra quando conhecido e proveniência. |
| `TopicMatchDecision` | Decisão durável | Candidato, assunto F2 tipado, escopo edital, aceitação/rejeição/pendência, ator, versão e histórico. |
| `ContextPriorityProjection` | Projeção | Edital/cenário, fatores de evidência, política/versão, ordenação, justificativa; overrides humanos não são cache. |

Todas as operações persistentes pertencem a um `profileId`, possuem ID opaco estável, `operationId` e proveniência; mutações conflitáveis também possuem base/revisão causal. Timestamps auxiliam auditoria, mas **não resolvem concorrência**.

### 3.1 Estados e transições válidas

- **Sugestão:** `PROPOSED`, `STALE` ou `DISMISSED` como estados conceituais regeneráveis. Descartar uma proposta não cancela um compromisso já confirmado. O mesmo snapshot de entrada/política não multiplica sugestões equivalentes.
- **Autoaprovação:** somente após preferência persistente **desligada por padrão** e opt-in informado, escopado por perfil/tipo de sugestão, com revogação. A geração é uma consulta pura; a aprovação automática é **comando de aplicação separado**, limitado por horizonte/capacidade e idempotente. Não é disparada em renderização, leitura da agenda ou mero recálculo. Autoaprovação não modifica blocos F3.
- **Compromisso:** `PENDING` (inclusive vencido por comparação de `CivilDate`), `PARTIALLY_FULFILLED`, `FULFILLED` ou `CANCELLED` (estados semânticos; vencido é condição temporal, não conclusão). `RESCHEDULE` conserva data original e eventos de mudança; não apaga o compromisso. Arquivamento/vínculo órfão introduz pendência de reconciliação, não exclusão automática.
- **Execução:** registro avulso ou associado, com escopo efetivamente executado, avaliação e data; **uma execução parcial também é fato concluído do trecho executado**, mas não cumpre automaticamente o compromisso inteiro. Avaliação pode ser acrescentada/corrigida mediante operação auditável sem criar segunda execução.
- **Saldo de cobertura:** quando tópicos/subtópicos identificáveis permitem subtração de escopos, derivar o saldo sem duplicar partes sobrepostas; quando cobertura é `UNKNOWN` ou a relação de subconjuntos não é confiável, não calcular saldo numérico fictício: solicitar revisão humana. Propostas de continuidade referenciam a origem, sem criar conclusão artificial.
- **Conclusão concorrente:** múltiplas operações distintas que pretendem cumprir o mesmo saldo devem validar revisão/base e escopo num commit transacional. Replay idêntico é idempotente; operações realmente independentes e compatíveis podem coexistir. Duas conclusões incompatíveis do mesmo saldo ficam em conflito, sem contagem dupla nem perda de variante.

**Invariantes:** sugestão != compromisso != execução; `FULFILLED` só após cobertura confirmada suficiente; `CANCELLED` e aviso dispensado não significam estudado; nenhuma projeção reconstrói ou apaga fatos; revisão compartilhada não multiplica tempo, questões nem execuções; decisões ainda conflitantes não alimentam rankings como consolidadas.

### 3.2 Fronteira F4 — identidade da execução e tempo

Revisar dentro de uma sessão F4 requer referência validada ao fato F4 e à parcela de escopo disponível; não cria segunda sessão, segundo intervalo ou nova contagem de questões. Uma revisão registrada diretamente na F5 pode comprovar execução/retenção, mas **não cria tempo estudado F4 nem questões respondidas**. Uma sessão de estudo contendo questões não confirma revisão automaticamente. Reclassificar/corrigir sessão F4 invalida projeções relacionadas, nunca a avaliação humana histórica; se a própria evidência de vínculo se tornar inválida, marcar `EVIDENCE_CONFLICT`/vínculo pendente, sem ocultar fatos.

## 4. Revisões espaçadas, temporalidade e integração F3

### 4.1 Unidade e cobertura (D01, D13, D14)

A trajetória é por **assunto de revisão canonicamente vinculado**; sessões F4 podem fornecer múltiplas evidências e um mesmo assunto pode ser relevante para mais de um edital com **vínculos explícitos verificados** (§2.1). A duração, a cobertura e a retenção são dimensões independentes. Escopo mínimo identificável: assunto, ou subtópicos/aulas F2 quando aplicáveis; `FULL`, `PARTIAL`, `UNKNOWN` descrevem cobertura, não nota ou confiança. Não inferir cobertura integral de questões que só abrangem uma parte.

### 4.2 Cálculo das sugestões (D02, D11, D16–D17, D26)

Motor determinístico e offline: entradas são fatos F4/F5 reconciliados, assunto/escopo, retenção explícita, fase anterior da progressão, `CivilDate`, perfil/versão e parâmetros validados; saídas são sugestão, intervalo, duração estimada, explicação e chave de dependências. **Gerar ou consultar nunca grava compromisso.** O opt-in de autoaprovação invoca comando próprio, conforme §3.1.

`FORGOT` implica recuperação/recuo gradual; `PARTIAL` progressão conservadora; `GOOD` progressão ampliada, condicionadas a estágio e parâmetros. `UNRATED` não presume bom desempenho e depende de fallback conservador, com explicação. Desempenho em questões é complementar, nunca equivale a retenção explicitamente declarada; conflito relevante gera indicação e decisão humana se alterar materialmente um compromisso. A ausência de questões não anula uma avaliação de retenção válida.

Revisão tardia ancora a **nova sugestão** na data civil real da execução, preservando a data de vencimento original do compromisso e sem preencher artificialmente etapas intermediárias. Revisão retroativa/manual usa data informada e proveniência verificada; instantes UTC não transformam arbitrariamente o dia acadêmico. Alteração da zona IANA do dispositivo não desloca `CivilDate` de compromisso existente. Horário local com DST inexistente/ambíguo segue validação F3, não ajuste silencioso.

Perfis padrão e overrides são versionados. Mudar regra recalcula propostas, não sobrescreve compromissos, execução nem avaliações. Fallback e limites devem ser transparentes. **Não há valores numéricos aprovados nesta revisão:** o complemento de parâmetros deve documentar justificativas, fixtures de progressão, limites, comportamentos extremos e retrocompatibilidade antes da aprovação do writing-plans. Teste de software não comprova eficácia pedagógica universal.

### 4.3 Planejamento, duração e atrasos (D03–D05, D15)

A agenda distingue propostas, compromissos futuros, do dia, vencidos, parcialmente executados, concluídos e cancelados. Vencimento original é preservado. Backlog sugere recuperação priorizada por urgência, capacidade e dificuldade; déficit explicitamente `UNALLOCATED`, sem criar blocos confirmados fictícios. Preferência de autoaprovação de compromisso **não** equivale a consentimento para autoaplicar encaixes na F3.

Para F3, apresentar `PreviewReviewPlacement` com data/tempo propostos, `PlanBlock` afetado, perfil/edital, cenário `ACTIVE`, capacidade **global** considerando outros editais, bloqueios fixos e revisão-base. Aplicar exige comando de domínio F3 com revalidação de capacidade, cenário, revisão e CAS dentro da fronteira transacional disponível; se ocorrer commit parcial entre contratos não atômicos, não confirmar sucesso global, registrar necessidade de reconciliação e preservar as duas decisões. Cenários `INACTIVE` não reservam capacidade. Blocos históricos, fixos e decisões humanas não são modificados silenciosamente; uma revisão pode ficar sem bloco F3 até confirmação.

Estimativa de duração aprende apenas de **durações válidas atribuíveis a revisões identificadas**, sem confundir total F4 com tempo de revisão de um subtópico e sem deduzir duração da mera avaliação. Sem histórico suficiente, usar fallback configurável identificado como estimativa; nunca gerar `StudySession` ou duração real a partir do número.

## 5. Pontos fracos, evidências e evolução temporal (D06, D17–D18, D26)

Calcular separadamente (a) tentativas/acertos F4 atribuídos de maneira válida, (b) avaliações explícitas de retenção F5, (c) recorrência e trajetória de dificuldades, (d) cobertura efetiva, (e) janela temporal e contexto edital. `StudyMeasurement` pode conter **contagens agregadas**, sem IDs por questão; nunca alegar independência de tentativas nem deduplicar questões individuais sem identidade real. Vínculos de múltiplos editais não replicam medição. Alocações não atribuídas não são convertidas arbitrariamente em desempenho por assunto; tempo de estudo não é percentual de domínio.

**Estados independentes:** `INSUFFICIENT_DATA` para uma inferência quantitativa sem sustentação; `DESCRIPTIVE_ONLY` quando há porcentagem descritiva, mas não tendência fundamentada; `TREND_SUPPORTED` quando comparação contextual atende ao critério. Uma avaliação explícita de esquecimento pode justificar **alerta qualitativo de retenção** mesmo quando não há questões, sem se transformar em nota estatística, frequência ou certeza de ponto fraco. Dados conflitantes ou tombstoned entram no diagnóstico e não na pontuação autoritativa.

Usar janelas configuráveis/versionadas de histórico e período recente. Só identificar melhora/piora após verificar elegibilidade, quantidade, comparabilidade de escopo/tipo/dificuldade quando conhecida e distribuição temporal. Uma queda de percentual isolada é sinal, não comprovação causal. Expor contagem amostral real, períodos, vínculos, fatores e explicação com versão de política. Limiares, pesos e critérios de estabilidade terão fixtures positivas, negativas e adversariais fundamentadas antes do plano; não apresentar intervalo de confiança, probabilidade de domínio ou calibração científica sem método validado.

A correção ou exclusão de medição F4 invalida apenas projeções dependentes, incluindo agregados e prioridades afetados. Se uma medição sofrer `INCOMING` parcial ou conflito, a interface deve identificar incerteza e não tratar evidência como conciliada.

## 6. Inteligência de banca e priorização contextual (D07–D10, D13, D26)

### 6.1 Importação, classificação e correspondência

Entrada local assistida de textos, listas e dados estruturados. Validar formato, limites e origem; tratar todo conteúdo importado como não confiável. Classificar em **estatística quantitativa verificável**, **ranking/relato qualitativo** ou **preferência do estudante**. Preservar fonte/autoria quando fornecida, URI validada, data da coleta ou edição, período que a evidência efetivamente cobre, banca, prova/edital, unidade amostral e denominador **apenas quando conhecido**, versão, proveniência e limitações. Não inventar probabilidades de incidência, percentuais ou números de questões a partir de expressões como «cai muito».

Matching local e explicável por texto, hierarquia F2 e contexto de edital gera candidatos com evidências de correspondência, não vínculos persistidos. Match inequívoco pode ser **proposto** para aprovação em lote; casos homônimos, parciais, sem edital ou com semântica ambígua exigem confirmação individual. Não atribuir a disciplina `StudySubject` como se fosse um `Assunto`; não compartilhar entre editais por similaridade de texto (§2.1). Rejeições e confirmações são decisões auditáveis com IDs e versões.

### 6.2 Atualização e relevância

«Detectar nova versão» significa comparar **nova entrada fornecida/importada** a uma fonte já registrada, ou outro mecanismo de atualização expressamente autorizado; **não pressupõe crawler, monitoramento web ou atualização remota em background**. Apresentar diferenças de escopo, período, amostra, ranking e associações. Fonte recente não substitui automaticamente a antiga; evidências com amostras sobrepostas não podem ser somadas como independentes e fontes incompatíveis não se tornam convergentes por média simples.

A relevância permanece contextual por edital/banca. A prioridade combina sinais separados: deficiência demonstrável (F4/F5), relevância qualitativa/quantitativa com proveniência, urgência apenas se data de prova confirmada, disponibilidade F3 e preferências/overrides humanos. Nenhum componente é denominado «probabilidade de cobrança» sem dados que o sustentem. Usar o perfil versionado F3 como entrada, sem mutá-lo. Duas provas com o mesmo assunto podem ter rankings distintos sem multiplicar revisões reais.

### 6.3 Reversão conservadora

Reverter importação, correspondência ou ranking exige prévia identificando decisões e projeções atingidas; usar operações compensatórias causais, sem executar snapshot rollback que apague **decisões tomadas depois**, sessões F4 ou outros editais. Quando uma reversão conflitar com alteração posterior na mesma referência, solicitar resolução humana. Exibir o estado anterior e o efeito proposto, inclusive `UNALLOCATED` ou necessidade de reencaixe, sem reescrever blocos F3 já confirmados.

## 7. Portas conceituais, comandos, consultas e erros

Os nomes são sugestões de contratos semânticos, não assinaturas físicas; o writing-plans deverá reaproveitar portas e tipos existentes. Todas as **mutações** exigem escopo de perfil, identidade estável, `operationId`, proveniência e revisão-base quando conflitáveis. `operationId` idêntico/payload idêntico é replay idempotente; mesmo ID/payload diferente é erro ou conflito. O commit persistente é confirmado **após transação concluída**, jamais por atualização otimista da UI.

| Domínio | Comandos | Consultas puras |
|---|---|---|
| Revisões | `ApplyReviewSuggestion` (manual/opt-in), `RecordReviewExecution`, `RecordRetentionAssessment`, `RescheduleReview`, `CancelReviewCommitment`, `ReconcileReviewCoverage` | `GenerateReviewSuggestions`, `ListReviewAgenda`, `GetReviewHistory`, `GetReviewExplanation` |
| Políticas | `ApplyReviewPolicyChange` | `PreviewReviewPolicyChange`, `GetReviewPolicyVersions` |
| Desempenho | Invalidar/reconstruir projeções por tarefa controlada, sem mutação por renderização | `CalculateWeakPointProjections`, `ListWeakPoints`, `GetWeakPointEvidence`, `GetSubjectTrend` |
| Banca | `ConfirmTopicMatches`, `ApplyBoardRelevance`, `ApplyRankingReversal` | `PreviewBoardImport`, `ListBoardEvidence`, `PreviewRankingReversal`, `GetPriorityExplanation` |
| F3 | `ApplyReviewPlacement` **via contrato F3** | `PreviewReviewPlacement` incluindo capacidade global e versão-base |
| Intercâmbio | `ApplyF5Import` após preview e decisão explícita | `ExportF5AcademicData`, `PreviewF5Import`, `GetF5ImportDiagnostics` |
| Conflitos | `ResolveF5Conflict` reutilizando política A-02 | `ListF5Conflicts`, `GetF5ProjectionValidity` |

**Comandos de recálculo interno** são tarefas idempotentes acionadas após commit/evento de invalidação, não consultas com gravação escondida. Os retornos distinguem, no mínimo, `LOCAL_COMMITTED`, `INVALID`, `CONFLICT`, `BLOCKED`, `FAILED`; confirmação remota `REMOTE_COMMITTED` e `CONVERGED` só com prova na F7. Resultados inconclusivos permanecem explicitamente inconclusivos. Nenhuma consulta exibe dados de outro perfil.

## 8. Persistência, projeções, concorrência e migração (D12, D22–D23)

**Única fonte local durável:** IndexedDB V2. Usar transações tipadas, `operationId`, revisão/CAS, proteção multiaba/fencing, outbox única e tombstones já existentes. `BroadcastChannel` sinaliza alterações, mas não garante exclusão mútua. Não criar outra fila de sync, banco, snapshot remoto gigante ou event sourcing integral. A F5 pode ter esquema de domínio próprio e migração IndexedDB **única, explícita e não destrutiva** quando exigida pelo código real; migração incompleta ou cliente antigo incompatível bloqueia escrita insegura e preserva recuperação conforme F4/F7.

### 8.1 Projeções e validade

Uma projeção materializada contém versão de algoritmo, perfil/política, escopo, dependências identificáveis (ou fingerprint verificável de snapshot), revisão de entradas, geração e estado de validade. Corrigir F4, alterar vínculo F2, mudar parâmetros, resolver conflito, arquivar/tombstonar ou atualizar fonte invalida todas as dependências reais, inclusive rankings agregados. **Uma geração antiga jamais publica por cima de snapshot mais recente**: conferir revisão/fingerprint/CAS antes de promover resultado. Interrupção entre lotes não produz projeção definitiva parcial. Resultado obsoleto só pode ser exibido como tal e não fundamenta silenciosamente comando definitivo. Fatos humanos e tombstones não são descartáveis para liberar quota; caches regeneráveis são.

### 8.2 Concorrência local e futura

Duas abas tentando autoaprovar a mesma sugestão, concluir o mesmo saldo ou importar o mesmo pacote não podem gerar duplicidade. Uma conclusão válida traz ID próprio, referência-base e escopo; **chave de operação isolada não substitui validação de unicidade semântica/estado**. Duas execuções genuinamente diferentes podem coexistir, desde que não sejam confundidas com reaplicação da mesma conclusão. Sob conflito causal, preservar variantes, não contar duas vezes uma medição incerta e exigir resolução humana. Exclusão vs edição conserva tombstone e versão conflitante, nunca `last-write-wins` por timestamp. Testar com fakes e abas reais; Firestore/Auth/Rules e convergência real são exclusivos da F7.

### 8.3 Falhas e capacidade

Consultas indexadas/paginadas por perfil, assunto, vencimento, estado, edição e período conforme necessidade comprovada. Processamento em lotes com retomada segura e sem monopolizar a UI; Worker somente se benchmarks justificarem. Quota, falha de transação, erro de exportação, cancelamento ou atualização SW não permitem anunciar sucesso falso. Preferências, decisões, avaliações e operações de sync devem ter prioridade de preservação sobre projeções. Cada alteração de esquema exige caminho de migração, fixtures e regressão em banco sintético com dados anteriores; não acessar V1 real.

## 9. Intercâmbio, notificações, interface e segurança

### 9.1 Portabilidade acadêmica (D21)

Exportação **seletiva** em JSON estruturado, versionado, com manifesto de escopo, IDs, relações, versões e proveniência; CSV seguro apenas para análise, nunca restauração. Pacote não inclui credenciais, tokens, UID de terceiros nem cache como fato autoritativo. Informar ao estudante que arquivo exportado pode conter dados pessoais de estudo. Prévia valida formato/versão, perfil de destino, tamanho, IDs, tombstones, vínculos F2, conflitos e estimativa de impacto. Correspondências entre perfis nunca se fazem pelo mesmo ID textual ou por nome semelhante; exigir remapeamento consentido. Reimportar deve ser idempotente. Aplicação atômica do lote quando o contrato exigir; se um volume não couber em uma transação, projetar importação em estágio isolado com commit/rollback verificáveis, **sem resultado parcial publicado como integral**. Não duplicar backup/restauração global da F7. Neutralizar fórmula maliciosa em CSV e XSS em textos/URLs não confiáveis.

### 9.2 Central de lembretes (D20)

Avisos locais de revisões futuras, do dia e atrasadas, agrupados, com opt-in por categorias externas, silêncio, dispensa e adiamento. A dispensa do **aviso** não cancela compromisso nem registra execução; adiar compromisso exige comando auditável próprio. Deduplicar entre abas; não enviar conteúdo detalhado para tela bloqueada por padrão. Notificações do sistema dependem de permissão, contexto e suporte. **Nenhuma garantia de notificação pontual com a PWA fechada**, nem push remoto obrigatório ou serviço pago. Se o navegador não suportar API ou permissão for negada, a central local continua funcional.

### 9.3 Interface F5 e fronteira F6 (D19, A-01)

Três camadas: (1) assunto, prioridade contextual, tendência e suficiência; (2) acertos/tentativas, retenção, cobertura, janelas e divergências; (3) evidências, filtros, versões, vínculos, inclusões/exclusões e conflitos. Nunca confundir percentual descritivo, dificuldade, prioridade e qualidade da evidência. Integrar navegação com F2/F3/F4; estados vazios, pendentes, desatualizados, erro, conflito e offline; mostrar qual parte de uma revisão foi executada e qual falta. Exigir teclado, contraste AA nos oito temas, leitor de tela, touch adequado, responsividade e `prefers-reduced-motion`; QA Impeccable apenas da fatia F5. Dashboards integrados pertencem à F6.

### 9.4 Segurança e privacidade

Inputs, fontes de banca, JSON/CSV e URIs importadas são não confiáveis. Rejeitar tipos inválidos, entradas excessivas, XML/HTML executável, fórmulas perigosas em planilhas, `javascript:`/URLs não permitidas, referências entre perfis e sobrescrita silenciosa. Logs e diagnósticos devem ser sanitizados, sem notas completas, conteúdo sensível ou credenciais por padrão. Falha de exportação, armazenamento ou importação terá feedback honesto. Não adicionar IA externa nem telemetria remota sem nova autorização.

## 10. Matriz de aceite verificável F5-T01–F5-T48 (D-F5-24)

Estes são **48 cenários de aceite**, não tarefas de writing-plans ou testes já executados. Cada cenário exige fixture de entrada, ambiente, operação, saída esperada, evidência, ligação com decisão F5 e estado `PASS | FAIL | NOT_RUN | INCONCLUSIVE | BLOCKED`. Um caso amplo exige subcasos negativos no futuro plano, sem transformar seu rótulo em prova genérica de cobertura.

| ID | Cenário | Resultado observável exigido |
|---|---|---|
| F5-T01 | Gerar sugestões com entradas idênticas | Mesmo snapshot/política produz proposta semanticamente equivalente; consulta não grava compromisso/outbox |
| F5-T02 | Confirmação manual e autoaprovação | Opt-in desligado por padrão; comando explícito e idempotente; revogar preferência impede próximas confirmações automáticas; nenhum efeito em renderização |
| F5-T03 | Corrigir/excluir evidência de origem F4 | Invalida projeção dependente, conserva compromisso confirmado e histórico; explica vínculo pendente |
| F5-T04 | Revisão avulsa sem F3/F4 | Execução auditável sem sessão, duração, questões ou bloco fictícios |
| F5-T05 | Retry de execução/avaliação | Mesmo `operationId`+payload gera um efeito lógico, inclusive após reload |
| F5-T06 | `operationId` reutilizado com conteúdo diferente | Rejeita conflito e não altera fatos |
| F5-T07 | Conclusão concorrente e duas execuções legítimas | Duas conclusões incompatíveis do mesmo saldo não duplicam cobertura; execuções independentes válidas sobrevivem |
| F5-T08 | Múltiplas execuções parciais | Saldo derivado de cobertura identificável, sem superposição contada duas vezes; só `FULFILLED` quando comprovado |
| F5-T09 | Cobertura desconhecida | `UNKNOWN` não é `FULL`; sem subtração fictícia ou promoção automática |
| F5-T10 | Assuntos homônimos em editais diferentes | Só grupo canônico com vínculo explícito compartilha revisão; fato compartilhado contado uma vez |
| F5-T11 | Esquecimento e recuo graduado | Progressão explicável com estágio e política; sem execução intermediária inventada |
| F5-T12 | Retenção parcial/boa com política versionada | Resultado determinístico e diferenciável; versões antigas não são reescritas |
| F5-T13 | Execução tardia e `CivilDate` real | Nova sugestão ancorada na execução; vencimento original preservado |
| F5-T14 | Execução sem avaliação | `UNRATED`, fallback conservador, sem afirmar boa retenção |
| F5-T15 | Acertos altos e esquecimento declarado | Divergência acessível e nenhuma alteração material silenciosa da avaliação |
| F5-T16 | Alterar perfil e override | Prévia de impacto, nova versão, fatos e compromissos existentes preservados |
| F5-T17 | Estimar duração sem/ com histórico F4 válido | Fallback sem evidências; apenas duração atribuível à revisão influencia estimativa; não vira tempo medido |
| F5-T18 | Dois editais F3 ativos e capacidade global insuficiente | Considera todos os compromissos oficiais; `UNALLOCATED` explícito; cenário inativo não consome capacidade |
| F5-T19 | Encaixe F3 concorrente | Prévia, revisão/CAS, commit/feedback coerentes; não reescreve bloco fixo ou histórico |
| F5-T20 | Assunto F2 arquivado/tombstoned | Relação pendente, sem associação automática por nome nem exclusão do histórico |
| F5-T21 | Contagens e tempo F4 multiassunto/multiedital | Reconcilia totais F4 uma vez; alocações parciais e parcela não atribuída preservadas |
| F5-T22 | Medição F4 sem assunto/sem IDs de questão | Não inventa classificação ou independência estatística |
| F5-T23 | Zero/poucas questões, mas retenção existente | Inferência quantitativa `INSUFFICIENT_DATA`; relato qualitativo de dificuldade continua visível sem nota fictícia |
| F5-T24 | Histórico vs janela recente de amostra diferente | Tendência fundamentada apenas se amostras comparáveis e suficientes, senão `DESCRIPTIVE_ONLY`/inconclusiva |
| F5-T25 | Troca de parâmetros/janelas | Versão, justificativa, fingerprint, preview e regressão sem mutar fatos |
| F5-T26 | F4 em conflito/`INCOMING` parcial | Evidência incerta não integra score como conciliada; diagnóstico explícito |
| F5-T27 | Fonte qualitativa de banca | Não cria porcentagem/frequência/denominador fictício |
| F5-T28 | Fonte quantitativa com amostra e período | Origem, unidade amostral, recorte, denominador e limitações preservados |
| F5-T29 | Candidato inequívoco e lote de matching | Prévia antes da confirmação; nenhuma aplicação pelo simples cálculo |
| F5-T30 | Homônimo ou edital divergente | Confirmação específica, sem associar automaticamente ou misturar disciplina com assunto |
| F5-T31 | Fontes com amostras sobrepostas/divergentes | Não soma denominadores incompatíveis, mostra conflitos e respectivas fontes |
| F5-T32 | Nova importação de fonte atualizada | Diferenças e versões preservadas; nenhuma busca remota implícita ou newest-wins |
| F5-T33 | Prioridade por dois editais com mesmo assunto | Contextos e overrides distintos; justificativa reproduzível; sem mutar perfil F3 |
| F5-T34 | Reversão após decisões posteriores | Compensação com prévia; preserva decisões mais novas ou pede conflito, nunca rollback destrutivo |
| F5-T35 | Importação repetida e tombstone existente | IDs/operações idempotentes; sem ressuscitar exclusões nem duplicar eventos |
| F5-T36 | Importação com perfil diferente/IDs coincidentes | Remapeamento consentido ou quarentena; nenhum vazamento cruzado |
| F5-T37 | JSON/texto malicioso, grande ou versão incompatível | Validação e rejeição sem truncamento, XSS ou escrita parcial |
| F5-T38 | Falha/quota/crash em importação | Aplicação atômica ou staging verificável; sem conclusão falsa nem estado parcialmente publicado |
| F5-T39 | CSV e URLs não confiáveis | Sem formula injection, HTML/script executável, URL de esquema perigoso ou credencial em arquivo |
| F5-T40 | Projeção obsoleta/corrompida | Invalida e recompõe a partir de fatos; nunca é base autoritativa silenciosa |
| F5-T41 | Recálculo em lotes interrompido/concorrente | Geração antiga/resultado parcial não sobrepõe snapshot novo; retomada segura |
| F5-T42 | Duas abas: autoaprovação, conclusão e edição | CAS/fencing e unicidade semântica impedem duplicação mesmo com `operationId` diferentes |
| F5-T43 | Dois dispositivos offline simulados | Avaliação vs reagendamento incompatíveis preservados; sem LWW ou convergência remota presumida |
| F5-T44 | Tombstone vs edição/replay remoto fake | Não ressuscita fato; mantém variantes e resolução pendente |
| F5-T45 | Fuso alterado, DST, meia-noite, revisão retroativa | `CivilDate` acadêmica estável, horário ambíguo validado e auditoria temporal correta |
| F5-T46 | Alertas em duas abas/sem permissão/dispensados | Agrupamento, silêncio, dedup; dispensa não conclui/cancela; sem prometer disparo fechado |
| F5-T47 | Jornada F5 offline + acessibilidade | Desktop/tablet/mobile, oito temas, teclado, contraste, leitor de tela, estados inválidos, Impeccable e evidência reproduzível |
| F5-T48 | Regressões F1–F4 e higiene de entrega | Typecheck/lint/build/testes locais, regressões relevantes, relatório e inventário Git; sem Actions/PRs extras; sem confundir teste, aceite e integração |

### 10.1 Evidências transversais obrigatórias

Além da matriz, os gates devem informar: teste de interrupção real da F5 em navegador e queda de quota sintética; benchmark reprodutível em amostras progressivas (p.ex. 1 mil/10 mil/50 mil **apenas como cenários, não metas nem garantias**); validação da migração IndexedDB em cópia sintética com versão anterior; balanço de cobertura de escopos parciais; inspeção de dependências causais; regressões F2/F3/F4 afetadas; screenshots/testes de acessibilidade quando houver UI. Valores máximos de latência/tamanho e critérios de suficiência não serão inventados: deverão ser justificados e aprovados junto ao complemento técnico antes do writing-plans.

**Critério epistemológico:** `PASS` comprova requisito computacional delimitado, não que uma heurística melhora comprovadamente a memorização de pessoas reais. Testes com fakes não homologam Firestore, Auth, Rules nem backup produtivo.

## 11. Riscos, critérios de aceite e gates de execução futura

**Riscos F5 prioritários:** sugestão confundir-se com compromisso, dois comandos distintos concluírem o mesmo saldo, cobertura parcial virar total, associações erradas entre assuntos homônimos F2, dados agregados F4 tratados como questões independentes, aceitação automática durante consulta, F3 consumida duas vezes entre editais, amostra escassa gerar pontuação artificial, fonte de banca desatualizada substituída silenciosamente, reversão destrutiva, cache obsoleto tomado como fato, tombstone ressuscitado, importação com sucesso falso e notificação com app fechado prometida.

**Riscos herdados:** quatro HIGH F0 permanecem `UNVERIFIED` no último roadmap consultado: `R-V1-LEGACY-REMOTE-PLAN`, `R-V1-FIRESTORE-DOCUMENT-1MIB`, `R-V1-MULTITAB-OUTBOX-RACE`, `R-V1-BACKUP-TOMBSTONE-LOSS`. F4-T13 permanece `NOT_RUN`; `INCOMING` parcial em intervalos, vínculos e tombstones. Esses estados só mudam mediante teste/evidência reais e aceite cabível. A F5 deve recusar uso inseguro de dados afetados; a F7 homologa Firebase real e recuperação global. Não converter risco legado em bloqueio fictício de todo cálculo local seguro.

### 11.1 Gates distinguíveis

1. `F5_BRAINSTORMING_APPROVED_CLOSED`: **realizado**, D-F5-01–28 aprovadas.
2. `F5_SPEC_REVIEWED_PENDING_HUMAN_APPROVAL`: **situação atual**, especificação revisada ainda sem aprovação do usuário.
3. `F5_SPEC_APPROVED`: somente aceite explícito; complementar valores quantitativos fundamentados e contratos de implementação efetivos **antes de aprovar o writing-plans**. Isso não autoriza código.
4. Writing-plans único F5: organizar TDD incremental e fixtures para os 48 cenários, preflight, riscos, testes locais, custos R$ 0 e registro em arquivo canônico — aprovação humana específica.
5. GOAL único autorizado: execução, revisão independente real/proporcional, correções e QA; preservar `main` V1. Commits locais não significam push.
6. `F5_READY_FOR_HUMAN_REVIEW`: candidato funcional testado, relatório com `PASS/FAIL/NOT_RUN/INCONCLUSIVE/BLOCKED` e lacunas explícitas, **sem exigir push prévio não autorizado**.
7. Aceite humano da F5 (eventualmente com ressalvas) e **autorização de integração separada ou expressa**; fast-forward `v2` quando seguro, leitura de confirmação de `origin/v2`, Git hygiene com inventário e limpeza apenas do que estiver comprovadamente integrado e autorizado. Só então afirmar fase integrada; nenhuma entrada na `main`, deploy ou F6 automática.

### 11.2 Critérios de aceite do candidato

Rastrear as três funcionalidades F0 e 28 decisões até fluxos e testes; executar a matriz F5-T01–48 e subcasos críticos com estados honestos, `typecheck/lint/build`, regressões F1–F4 relevantes, testes de quota/conflito/recuperação, acessibilidade e Impeccable; verificar integridade de histórico, perfis, privacidade, duração F4 e capacidade F3; permitir uma revisão crítica independente de fato (agente ou revisor distinto, quando disponível) com correções materiais. Falha essencial de integridade, escopo ou segurança impede recomendação de aceite; `NOT_RUN` não equivale a PASS. Registrar riscos residuais, evidências, versão testada e limites de homologação.

**Fronteiras:** dashboards globais F6; Firebase/Google, sincronização e backup/restore real, piloto integrado e migração F7; cutover e `main` F8 com novo gate G5. Nenhum Actions/CI, PR, branch ou worktree novo por padrão. Não é permitido usar dados reais sem aprovação separada.

## 12. Registro de rastreabilidade D-F5-01–28

| ID | Diretriz consolidada | Seção principal |
|---|---|---|
| 01 | Revisão por assunto canônico | §4.1 |
| 02 | Intervalos adaptativos explicáveis | §4.2 |
| 03 | Sugestão com confirmação ou opt-in | §3 e §4.2 |
| 04 | Encaixe assistido na F3 | §4.3 |
| 05 | Backlog vencido e recuperação | §4.3 |
| 06 | Pontos fracos multifatoriais | §5 |
| 07 | Prioridade contextual por edital | §6.2 |
| 08 | Matching local assistido | §6.1 |
| 09 | Proveniência e qualidade de fontes | §6.1 |
| 10 | Atualização versionada de fontes | §6.2 |
| 11 | Recuo por esquecimento | §4.2 |
| 12 | Projeções separadas de fatos | §3 e §8 |
| 13 | Assunto compartilhado entre editais | §4.1 e §6.2 |
| 14 | Cobertura parcial/total/desconhecida | §3 e §4.1 |
| 15 | Duração estimada adaptativa | §4.3 |
| 16 | Perfis de revisão versionados | §4.2 |
| 17 | Retenção explícita prioritária | §4.2 e §5 |
| 18 | Evidências multijanela | §5 |
| 19 | Explicabilidade progressiva na UI | §9.3 |
| 20 | Lembretes não intrusivos | §9.2 |
| 21 | Portabilidade seletiva e assistida | §9.1 |
| 22 | Projeções incrementais IndexedDB | §8 |
| 23 | Reconciliação causal | §8 |
| 24 | Validação multicamadas | §10 |
| 25 | Plano/GOAL único, integração `v2` | §11 |
| 26 | Parâmetros fundamentados e versionados | §4.2, §5 e §6.2 |
| 27 | Auditoria antes do encerramento | Cabeçalho e §11 |
| 28 | Separar sugestão, compromisso e execução | §3 |

---

**Veredito documental:** proposta integral de especificação formal pronta para revisão humana. A redação deste arquivo não equivale à sua aprovação, à criação de writing-plans ou à autorização de implementar. Não foram realizadas modificações no repositório GitHub.

## 13. Registro da revisão crítica (não normativo)

Esta versão substitui **apenas o arquivo de proposta disponibilizado para revisão**, mantendo intocado o rascunho histórico da branch `v2`. Principais correções materiais: (R01) assunto F2 vs `StudySubject`/`EditalDiscipline` e vínculos canônicos; (R02) escopo parcial, saldos, conclusão concorrente e retificação da retenção; (R03) autoaprovação como comando explícito, não efeito de consulta; (R04) integração F3 com capacidade global dos editais e CAS; (R05) F4 com contagens agregadas e sem inferência estatística indevida; (R06) separação entre evidência qualitativa e inferência quantitativa mesmo sem questões; (R07) fontes de banca atualizadas por entradas reais, sem crawler presumido; (R08) invalidação/versionamento de projeções e concorrência de geração; (R09) importação transacional por lote ou staging verificável; (R10) matriz F5-T01–48 reforçada para esses riscos; (R11) gates de aceite separados de integração `origin/v2`; (R12) transparência de que auditoria documental não é teste de código nem revisão por terceiro.

**Limites desta revisão:** nenhuma alteração no GitHub, nenhuma inspeção completa do código executável, nenhuma calibração numérica final, nenhum writing-plans nem implementação; a aprovação humana continua pendente.
