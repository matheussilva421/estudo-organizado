# Estudo Organizado V2 — F4: Execução, cronômetro, sessões, histórico e hábitos

> **Status:** `F4_SPEC_APPROVED` — especificação formal aprovada pelo proprietário em 2026-10-30; autoriza a execução do GOAL F4, mantendo push, deploy e integração remota condicionados a autorização específica.  
> **Data:** 2026-10-30 · **Origem:** Superpowers Brainstorming concluído e arquitetura consolidada D-F4-01–D-F4-21 aprovada pelo proprietário.  
> **Repositório de referência (somente leitura):** [`matheussilva421/estudo-organizado`](https://github.com/matheussilva421/estudo-organizado), branch `v2`, HEAD observado `68db01542a9d5934c7e45e622001334f91eaaf4f`.  
> **Documento incorporado ao repositório em 2026-10-30:** `docs/superpowers/specs/2026-10-30-estudo-organizado-v2-f4-execution-design.md`, com SHA-256 `5be103a6a48a29d91e26a0ca9b0da22c96fcb1536f789f173846b561a6e5d527` verificado antes da incorporação.

## 1. Intenção, resultado e situação de partida

### 1.1 Intenção

Entregar o domínio **Execução/Sessões** da V2 para registrar e recuperar, de modo confiável e offline, o estudo efetivamente realizado: duração observada, duração declarada, Pomodoro, sessões manuais e multiassunto, questões/acertos, referências de materiais, hábitos e histórico auditável. O usuário deve conseguir iniciar um estudo pelo planejamento da F3 ou livremente, navegar ou trabalhar em aplicativos externos, registrar o resultado e compreender se o dado foi salvo localmente, está pendente ou exige revisão.

O produto não deve registrar automaticamente horas fictícias depois de suspensão, criar sessões duplicadas, concluir planos por inferência, afirmar persistência sem commit, apagar versões conflitantes ou transformar progresso relatado em comprovação de atividade observada.

### 1.2 Fonte da verdade e estado preexistente

- **F1 e F2:** aceitas com ressalvas; não constituem homologação de Firebase produtivo, sincronização multi-dispositivo real nem restauração operacional.
- **F3:** `F3_ACCEPTED_WITH_RESERVATIONS` em 2026-10-30, integrada à `v2`, ainda não implantada; F3 utiliza cenário e bloco planejado, revisões locais, persistência IndexedDB, operação idempotente e CAS.
- **Contrato existente:** `apps/v2/src/domain/planning-execution-contract.ts` define uma *fixture* de vínculo e a regra de contabilização única de sessão, inclusive quando ela atende a múltiplos editais. Não é a implementação F4 e não deve ser tratada como modelo físico final.
- **Infraestrutura existente:** `apps/v2/src/platform/indexeddb.ts` (transações, operações, outbox, controle de upgrade), `local-planning-repository.ts` (revisão e operação atômica), `local-events.ts` (BroadcastChannel como comunicação), `planning-time.ts` (CivilDate/fuso IANA), `sw-update.ts` (atualização básica de SW). Reutilizar essas fundações com as validações específicas da F4.
- **Quatro riscos HIGH da F0:** continuam `UNVERIFIED`; os gates reais de sync/migração/backup e cutover continuam em F7/F8.

### 1.3 Objetivos verificáveis

1. **Registro fiel:** contabilizar o tempo estudado uma vez, diferenciando foco observado, informação manual e lacunas incertas.
2. **Continuidade:** recuperar sessões após fechamento/crash ou incompatibilidade, mostrando o último estado durável sem reconstrução fictícia.
3. **Operações seguras:** rejeitar transições inválidas; deduplicar comandos; garantir autoridade local, exclusividade de cronômetro e escrita atômica.
4. **Flexibilidade:** permitir estudo livre, manual ou por Pomodoro, uma ou várias disciplinas, com ou sem edital e bloco.
5. **Proveniência:** corrigir e excluir logicamente com histórico, sem alterar fatos ou projeções de modo silencioso.
6. **Portabilidade:** pesquisar/exportar histórico CSV/JSON sem apresentar exportação de histórico como backup restaurável.
7. **Fronteiras:** integrar F2/F3, fornecer fatos estáveis para F5/F6 e preparar contratos locais de A-02 sem antecipar homologação remota F7.

### 1.4 Fora do escopo e antiobjetivos

Não implementar: banco individual de questões ou respostas; armazenamento/visualizador de PDFs e vídeos; integração efetiva com Biblioteca Inteligente; motor de revisão espaçada e inteligência de banca (F5); dashboards analíticos finais e redesign geral (F6); OAuth/Firestore real, emulador/produto multi-dispositivo homologado, recuperação integral de backup e migração V1→V2 (F7); publicação, alteração da `main`, cutover ou escrita em dados V1 (F8). Não criar serviço externo, API paga, GitHub Actions, nova fila de sync, serviço de background garantido ou novo banco paralelo.

## 2. Abordagens examinadas e escolha aprovada

O brainstorming analisou, por decisão, uma opção simplificadora, uma intermediária de integridade/uso e uma de maior rigidez/automação. **Todas as 21 decisões foram aprovadas na opção B**, mas a semântica exata de cada B prevalece sobre rótulos genéricos.

A escolha convergente é **local-first, versionamento com auditoria seletiva, recuperação assistida, conciliação explícita e modelos leves por domínio**. Foi descartado exigir cronômetro para todo estudo, inferir tempo por wall clock ou inatividade, usar last-write-wins, impedir correções históricas e antecipar gerenciador de arquivos/analytics/sync real. A arquitetura mantém idempotência, revisão causal, registros canônicos e projeções regeneráveis, em vez de event sourcing integral ou duplicação de estado.

## 3. Rastreabilidade funcional F0 e decisões D-F4

### 3.1 Matriz de funcionalidades

| Requisito F0 | Resultado F4 verificável | Decisões |
| --- | --- | --- |
| `F-V1-TIMER-POMODORO` | Início/pausa/retomada/conclusão, sessões por evento/bloco, foco e descanso, checkpoints, recovery, segundo plano, exclusividade | 01–03, 10, 13, 16–19, 21 |
| `F-V1-SESSION-REGISTRATION` | Sessões livres/manuais/multiassunto, alocações, métricas, materiais, vínculos e revisões | 04–08, 10–12, 16, 20 |
| `F-V1-SESSION-HISTORY` | Filtros, edição/exclusão auditáveis, CSV/JSON, proveniência e recuperação de gravação falha | 08, 12, 14–16 |
| `F-V1-HABITS` | Hábitos independentes, recorrência, confirmação e progresso derivado das sessões válidas | 09, 11, 16 |

### 3.2 Registro normativo de decisões aprovadas

| ID | Opção aprovada (todas B) | Cláusula de execução obrigatória |
| --- | --- | --- |
| D-F4-01 | Recuperação assistida | Expor checkpoint durável, tempo validado, lacunas e ações retomar/concluir/corrigir sem fingir continuidade |
| D-F4-02 | Autoridade exclusiva e transferência assistida entre abas | Uma aba controladora; token/revisão/fencing verificados no banco, transferência explícita e revogação de autoridade obsoleta |
| D-F4-03 | Foco e descanso separados | Registrar ambos; somente foco válido integra tempo estudado |
| D-F4-04 | Manual livre e auditável | Registrar estudos retroativos sem timer; fonte `MANUAL` e rastreabilidade |
| D-F4-05 | Distribuição explícita flexível | Alocação parcial por conteúdos, resto não atribuído; soma não excede sessão; multi-edital sem duplicidade |
| D-F4-06 | Integração assistida com progresso parcial F3 | Vincular por ID, não concluir bloco automaticamente e preservar sessão se conciliação falhar |
| D-F4-07 | Sessões independentes | Edital e bloco opcionais, vinculação posterior e total global único |
| D-F4-08 | Versão canônica + histórico auditável | Editar fatos com revisão; exclusão lógica/tombstone; não reclassificar tempo manual como medido |
| D-F4-09 | Hábitos próprios com evidências | `StudyHabit` e `HabitOccurrence` independentes; evidências de sessão sugerem confirmação, não substituem decisão do usuário |
| D-F4-10 | Limites configuráveis com revisão | Durações anômalas pedem confirmação/correção; rejeitar estrutura inválida; sem teto arbitrário silencioso |
| D-F4-11 | Medições por conteúdo, classificação opcional | Questões/acertos e materiais com parcela não atribuída, soma única, correção auditável |
| D-F4-12 | Conflitos multi-dispositivo preservados | Base/revisões divergentes, causalidade e reconciliação assistida; testes fake F4, homologação real F7 |
| D-F4-13 | Transições híbridas Pomodoro | Em continuidade verificável, foco→descanso automático; descanso→foco exige confirmação |
| D-F4-14 | Histórico + CSV/JSON | Consultar, filtrar e exportar com auditabilidade; exportação não é backup restaurável |
| D-F4-15 | Falha de gravação: retry/exportação emergencial | Sem sucesso falso; preservar memória quando disponível; exportar dados emergenciais e reimportar de forma validada e idempotente |
| D-F4-16 | Divisão por dia civil | Distribuir duração temporalmente atribuível por `CivilDate`/fuso IANA, sem somar sessão novamente |
| D-F4-17 | Um cronômetro ativo por perfil/ambiente | Várias pausadas permitidas; troca assistida e transação única; sem lock global offline fictício |
| D-F4-18 | Segundo plano com verificação | Minimizar/alternar apps não pausa; inatividade/anomalia exige revisão; ausência de interação não comprova ausência de estudo |
| D-F4-19 | Checkpoints híbridos e adaptativos | Persistir transições e checkpoints periódicos; não depender de callbacks pontuais em background |
| D-F4-20 | Materiais referenciados | Tipo/título/URL opcional/ID quando disponível/páginas/trechos/notas; não armazenar arquivos |
| D-F4-21 | PWA com atualização coordenada | Não forçar recarregamento em sessão crítica; bloquear escrita incompatível; recuperação segura e F7 para homologação global |

## 4. Domínio canônico e invariantes

### 4.1 Responsabilidades lógicas, não prescrição de stores

- **`StudySession`**: `id`, `profileId`, `origin` (`TIMER`, `POMODORO`, `MANUAL`, ou composição de proveniências), estado, `revision`, `schemaVersion`, identificação temporal/zona quando conhecida, vínculos opcionais e origem de comandos; nota: campos físicos serão definidos no plano, e as correções mistas não podem perder origem por intervalo/fato.
- **`SessionInterval`**: identidade e referência de sessão, tipo (`FOCUS`/`BREAK`), observações temporais de início/fim quando válidas, duração monotônica verificável, última gravação confirmada, proveniência, flags de anomalia/recuperação; uma lacuna é objeto identificável, não foco presumido.
- **`SessionAllocation`** (conceito): referência opcional a `EditalDiscipline`, assunto/aula, bloco da F3, quantidade de milissegundos atribuídos (ou duração aprovada equivalente) e porção não atribuída; vínculos múltiplos não duplicam tempo.
- **`StudyMeasurement`**: contagens de questões, acertos, páginas/trechos e metadados ligados a conteúdo, quando classificados; subconjunto não atribuído e revisão com proveniência.
- **`StudyMaterialRef`**: metadados estruturados, jamais arquivo obrigatório; referências locais podem não resolver em outro aparelho.
- **`StudyHabit`/`HabitOccurrence`**: regra, recorrência/`CivilDate`/fuso, alvo e ocorrência confirmada, com referência opcional a evidências.
- **Auditoria seletiva, conflito, tombstone e identidade de operação**: registros duráveis suficientes para replay seguro, reconciliação e diagnósticos; reutilizar envelopes e serviços existentes quando possível.

Todos os relacionamentos entre F2/F3/F4 usam **IDs opacos estáveis e escopo `profileId` validado**. Título igual não é identidade. Entidade arquivada/ausente/incompatível vai para diagnóstico; não associar automaticamente por nome.

### 4.2 Invariantes normativos

**INV-01 — Tempo único:** uma sessão contabiliza tempo válido no total global uma única vez por identidade; associações com dois editais não somam a sessão duas vezes. Uso do mesmo fato como evidência de cobertura não cria outro fato temporal.

**INV-02 — Separação de fontes:** `MEASURED`, `MANUAL` e `CORRECTED`/ajuste (ou nomenclatura equivalente) são rastreáveis no nível da duração/fato. Um ajuste manual nunca reescreve silenciosamente a medição original.

**INV-03 — Foco versus descanso:** intervalo `BREAK` pode compor histórico Pomodoro, não o tempo de estudo. Uma sessão pausada não soma duração ativa.

**INV-04 — Lacuna explícita:** tempo não observado após suspensão/crash, divergência de relógios ou ausência de evidência suficiente permanece `UNCERTAIN`/`RECOVERY_REQUIRED` até decisão auditável. Declaração manual posterior é informação manual, não prova de continuidade monotônica.

**INV-05 — Distribuição consistente:** `sum(allocatedValidFocusMs) + unallocatedValidFocusMs = totalValidFocusMs` para a parte efetivamente alocável, sem valores negativos e sem atribuir a mesma parcela duas vezes no total global. Por dia civil, soma das parcelas temporais atribuíveis deve coincidir com a porção que possui localização temporal confiável; porção sem localização permanece não atribuída a dias precisos.

**INV-06 — Medições coerentes:** `questions` e `correctAnswers` são inteiros não negativos; `correctAnswers <= questions`; medições por conteúdo não duplicam totais da sessão. Nenhum valor `NaN`, infinito, negativo ou fracionário passa pelo commit quando o contrato exige inteiro.

**INV-07 — Idempotência e versão:** `operationId` único + mesmo payload/revisão retorna resultado idempotente; mesmo `operationId` com payload divergente falha. CAS transacional bloqueia comando obsoleto; timestamp não arbitra conflito.

**INV-08 — Exclusividade local:** por perfil em um mesmo armazenamento local, no máximo uma sessão possui cronômetro ativo (foco ou descanso); transferência/alternância exige validação e persistência em operação coerente. Várias sessões pausadas são admitidas.

**INV-09 — Commit verdadeiro:** dado persistente e intenção de outbox pertinentes formam transação atômica; notificação e sucesso local apenas após conclusão. Falha não cria confirmação fictícia.

**INV-10 — Histórico conservado:** alterações e tombstones mantêm proveniência, relação causal e revisões necessárias; restauração/importação de snapshot antigo não pode ressuscitar exclusão silenciosamente.

**INV-11 — Hábitos independentes:** confirmação de ocorrência é fato distinto; evidências de sessão podem sugerir cumprimento, mas não produzem confirmação implícita. Revisar evidência exige reavaliar estado da meta, sem apagar confirmação silenciosamente.

**INV-12 — F3 não é execução:** registrar uma sessão não altera automaticamente conclusão de bloco da F3, e replanejar F3 não reescreve a execução. A conciliação é operação explícita.

### 4.3 Estados e transições

Máquina durável **proposta e compatível com a spec-mestra D23**: `DRAFT -> RUNNING <-> PAUSED -> COMPLETED`, mais `CANCELLED` e `RECOVERY_REQUIRED`. O diagrama é abreviado: `DRAFT` pode ser iniciado, cancelado ou concluído como registro manual; `RUNNING` pode ser pausado, concluído, cancelado ou enviado a recuperação; `PAUSED` pode ser retomado, concluído, cancelado ou enviado a recuperação. `COMPLETED` e `CANCELLED` são terminais para controle do timer, embora fatos históricos admitam edição versionada. Saída de `RECOVERY_REQUIRED` exige decisão explícita e comando persistente de resolução para `PAUSED`, `RUNNING`, `COMPLETED` ou `CANCELLED`, conforme pré-condições; a spec não permite transição por simples recarregamento ou expiração de timer.

| Comando | Pré-condição essencial | Pós-condição ou recusa |
| --- | --- | --- |
| `startSession` | Perfil/escopo válido, inexistência de cronômetro ativo concorrente, revisão compatível | Criar/iniciar sessão e intervalo com autoridade durável ou conflito explícito |
| `pauseSession` | Sessão RUNNING com autoridade | Fechar intervalo válido, persistir PAUSED e revisão |
| `resumeSession` | PAUSED, revisão válida e cronômetro único | Criar novo intervalo e passar a RUNNING; não reabrir intervalo antigo |
| `completeSession` | Estado concluível, fatos válidos, revisões e lacunas tratadas ou mantidas explicitamente pendentes conforme política | Finalizar sem duplicar intervalo; repetir operação é idempotente |
| `cancelSession` | Estado cancelável e confirmação para perda de atividade em curso | Estado de cancelamento auditável, sem apagar fatos confirmados de histórico |
| `recoverSession` | Checkpoint/conflito acessível, decisão e revisão atuais | Resolver lacuna com proveniência ou manter pendência; nunca auto-somar relógio de parede |
| `registerManualSession` | Datas, duração, fatos, escopo e justificativas quando exigidas válidos | Registro manual durável sem criar timer falso |
| `editSessionFacts` | Sessão existente, revisão-base válida e mudança auditável | Nova revisão canônica e invalidar projeções |
| `linkSessionToPlan` / `reconcilePlanProgress` | IDs F2/F3 válidos e prévia/consentimento explícitos | Conciliação eventual sem alterar fato real; falha preserva sessão |
| `listSessionHistory` / `exportHistory` | Consulta autorizada para perfil | Consulta e exportação consistentes, sem efeito mutante |

Os nomes das operações são **portas lógicas**; não exigem interface/classes duplicadas da infraestrutura existente. Comandos de hábitos, takeover entre abas e recuperação emergencial terão contratos equivalentes na especificação de API da futura implementação.

## 5. Contratos temporais e Pomodoro

### 5.1 Medição, checkpoints e suspensão

- Usar relógio monotônico enquanto existir observação válida no mesmo contexto, com ancoragens verificadas e checkpoints duráveis. Não concatenar `performance.now()` de processos/sessões de execução diferentes; sua origem não atravessa reinicialização de contexto.
- Checkpoints em transições obrigatórias e cadência periódica/adaptativa; a cadência, pressão de escrita e limite de inatividade serão **parâmetros a calibrar por testes**, não valores numéricos inventados.
- `setInterval`/callbacks são gatilhos de atualização e tentativa de checkpoint, não fontes canônicas da duração. A continuidade em segundo plano só é considerada verificada segundo critérios definidos/testados para a plataforma.
- Ao retornar de suspensão/fechamento, exibir último checkpoint, tempo medido e possível lacuna. Não inferir que a ausência de interação com o app = ausência de estudo. Também não atribuir lacuna inteira como estudo por confirmação genérica.
- Duração tecnicamente inválida é rejeitada; duração longa porém possível exige confirmação/correção/justificativa, respeitando D-F4-10. Nenhum truncamento silencioso.
- Se sessão atravessar `CivilDate`, distribuir apenas a parte temporalmente atribuível nos dias do **fuso IANA registrado**. Horário de verão, horário inexistente/ambíguo e relógio alterado requerem resolução consistente com `planning-time.ts`; não tratar 24h como invariável de todos os dias civis. Sessão manual sem dados temporais suficientes tem data informada ou porção não distribuída, mas não recebe divisão fictícia.

### 5.2 Pomodoro

- Persistir estados de **foco** e **descanso** separadamente; somente intervalos válidos de foco entram no tempo estudado.
- Em app ativo com autoridade válida e continuidade verificável, foco terminado pode iniciar descanso automaticamente; terminar descanso **não** inicia foco sem confirmação.
- Pausar/resumir, trocar de sessão ou perder autoridade interrompe transições automáticas conflitantes. Suspensão do OS/PWA fechada não garante alarme nem avanço de ciclo; usar recuperação assistida.
- Duração de ciclo, aviso e preferências são configuráveis; valores padrão e limites só serão fixados após validação de UX e testes, sem alterar a decisão sobre transições.
- Alarme/notificação é *best effort* e não confirma persistência ou atividade.

## 6. Distribuição de estudo, medidas e materiais

### 6.1 Sessões por conteúdo e edital

- Uma sessão pode não possuir vínculos; o tempo global é válido sem edital. Vínculo posterior por ID auditável.
- Múltiplas disciplinas/assuntos/aulas podem receber parcelas explícitas de tempo, com resto `UNALLOCATED`. Em conteúdo compartilhado por mais de um edital, utilizar o mesmo fato para cobertura e relatórios contextuais sem dobrar a duração global.
- Um bloco F3 pode receber múltiplas sessões parciais; uma sessão pode relacionar-se a vários blocos conforme validação de escopo e sem automatizar conclusão. Conciliação requer confirmação de `CONCLUDED`, `PARTIAL` ou `NOT_APPLIED` (sem impor esses nomes como esquema final).
- O algoritmo de resumo F3 existente é **fixture de contrato**, e a F4 deverá estendê-lo ou substituí-lo conservando os seus invariantes; não duplicar `ExecutionLinkFixture` como modelo autoritativo.

### 6.2 Questões, acertos, páginas e notas

- Registrar medições por conteúdo (quando conhecido) ou sem classificação; resultados globais derivam dos fatos únicos. Questões e acertos são contagens inteiras e coerentes; ausência de classificação não produz disciplina fictícia.
- Páginas estudadas são intervalos ou quantidade validada; não presumir que contagem de páginas equivale a tempo nem somar páginas de arquivos distintos como progresso de um mesmo material sem identificação.
- Anotações e URLs são sanitizadas; conteúdo importado é não confiável. Alterações em fatos e vínculos criam revisão auditável.

### 6.3 Referências de materiais

Material referenciado: tipo (PDF/vídeo/livro/site/outro), título, identificador estável opcional, URI/URL opcional validada, origem, páginas ou trecho de vídeo, notas. Referências locais não presumem portabilidade de um caminho `C:\\...` para tablet. A F4 **não copia o arquivo** para IndexedDB nem tenta abrir bibliotecas externas automaticamente. Integração futura com Biblioteca Inteligente exigirá decisão/contrato e autorização próprios.

## 7. Hábitos, recorrência e dependências de evidências

`StudyHabit` define meta e recorrência no calendário civil/fuso de referência; `HabitOccurrence` representa uma confirmação do usuário para o período, com identidade e revisão. Uma meta mensurável pode derivar progresso de tempo ou questões das sessões canônicas e **sugerir** confirmação. Hábitos subjetivos continuam manuais.

A repetição do comando de confirmar a mesma ocorrência é idempotente. Edição/exclusão de sessão que sustentava a sugestão recalcula a evidência, identifica confirmação potencialmente desatualizada e solicita tratamento sem apagar o fato de confirmação. Correção retroativa não fabrica ocorrência; indicadores futuros leem a fonte canônica e distinguem confirmação de meta atualmente satisfeita.

## 8. Histórico, revisões, exportação e privacidade

- Histórico pesquisável com filtros combináveis por data civil, perfil, edital/assunto, origem, estado e vínculos; desempenho adequado a muitos registros por consulta indexada/paginação conforme testes.
- Mostrar proveniência `MANUAL`/cronometrada/corrigida, alteração auditável, tombstone e estado de conflito. Não esconder sessão válida por vínculo arquivado.
- **CSV:** formato tabular com cabeçalhos estáveis, codificação/escape seguros e granularidade documentada (por sessão e/ou por medição), deixando claro quando uma linha repetida é contexto e não tempo extra. Evitar formula injection ao abrir em planilha.
- **JSON:** envelope exportável versionado para análise/histórico, com IDs/revisões/vínculos e proveniência, sem credenciais, tokens ou dados de perfis diferentes. Importação não é automaticamente permitida pela existência de exportação.
- **Exportação emergencial D-F4-15:** pacote distinto de exportação de histórico, contendo intenção/estado ainda não persistidos. Deverá identificar natureza não durável, origem, comando/payload validável e marcador de reimportação idempotente; não declarar que é backup completo, nem informar sucesso se a gravação do arquivo falhar.
- **Reimportação de emergência:** aceitar somente formato compatível validado, apresentar prévia, checar IDs/operação/revisões e conflitos, aplicar de forma atômica; não sobrescrever registro posterior nem reconstituir intervalo monotônico inexistente.
- Dados de estudo e hábitos são pessoais: exportação consciente; logs saneados e limitados, sem credenciais, corpo integral de notas ou dumps indiscriminados.

## 9. Persistência local, multiaba, conflitos e atualização

### 9.1 IndexedDB e coordenação local

Todos os comandos persistentes passam por domínio/aplicação e usam a **infraestrutura IndexedDB V2**, mantendo atomia entre entidades, operações, trilha essencial e outbox quando aplicável. Não solicitar rede para salvar estudo. Não emitir `notify...` antes de `transactionDone`.

A autoridade deve combinar exclusão do controlador e verificação *fencing*/CAS no armazenamento. `BroadcastChannel` apenas avisa. Onde Web Locks não existir ou não fornecer continuidade, fallback deve impedir escrita concorrente (lease transacional com geração e verificação; caso não haja prova, bloquear takeover inseguro). Troca entre sessões pausa uma e inicia outra em transação coerente, ou não confirma a troca.

Após crash, lease vencido não significa que tempo até agora foi estudado. Uma aba obsoleta não recupera sua autoridade apenas porque voltou ao foco. Interrupção na transação de start/pause/complete não deixa meia alteração confirmada.

### 9.2 Outbox e dispositivos offline

A-02 permanece vigente: somente uma outbox durável, um envelope de operação idempotente por mutação e distinção `LOCAL_COMMITTED`/`REMOTE_COMMITTED`/`CONVERGED`. A F4 define efeitos de domínio e testes com fakes para alterações simultâneas, exclusão contra edição, replay e divergência de revisões. Checkpoints frequentes do cronômetro são durabilidade local, não licença para criar uma escrita remota por segundo ou uma operação de outbox por callback; emissão remota de fatos semanticamente relevantes deve ser limitada, agregada quando seguro e compatível com o orçamento Spark, preservando estados e revisão causal. Não habilitar Firebase real nem afirmar convergência multi-dispositivo; homologação com Google Sign-In/Firestore, cursor, regras e read-back real pertence à F7.

Se dois dispositivos offline editam a mesma sessão, manter as variantes e bloquear a contabilização duplicada. Mescla automática apenas se causalidade, campos independentes e todas as invariantes resultantes estiverem demonstrados; alterações incompatíveis exigem decisão auditável. Não usar timestamps como árbitro. Tombstones duráveis seguem retenção/epoch da A-02; não limpar por TTL arbitrário.

### 9.3 Atualização PWA D-F4-21

Detectar atualização disponível, permitir preparação de assets quando seguro e impedir **recarregamento automático** enquanto houver sessão ativa, formulário não salvo, transação crítica ou recuperação pendente. Antes de aplicar versão que exija reload, garantir estado persistido, negociar abas e verificar compatibilidade de esquema; se versão antiga ficar incompatível, bloquear escrita e oferecer recuperação. Nunca presumir que Service Worker consegue impedir fechamento forçado, suspensão ou descarte pelo sistema operacional.

A infraestrutura `sw-update.ts` existente é ponto de partida, não prova de conformidade. Homologação integrada de atualização/rollback de PWA, esquemas migrados e clientes antigos permanece F7.

## 10. Jornadas de interface e requisitos de experiência

| Jornada | Critério observável |
| --- | --- |
| Iniciar pelo bloco F3 | Sessão recebe referência canônica; começa sem alterar automaticamente o status do plano |
| Trocar de matéria | Exibe confirmação; pausa cronômetro anterior e inicia o próximo com commit seguro |
| Estudar em outro app | Aba minimizada não pausa por si só; retorno pode solicitar validação de inatividade |
| Fechar/suspender/retomar | Reabre com tempo confirmado, lacuna e opções de recuperação; nunca horas inventadas |
| Pomodoro | Foco e descanso separados, transição híbrida, alarme não autoritativo |
| Registro manual retroativo | Campo de data/duração/proveniência e validação de sobreposição |
| Sessão multiassunto/multi-edital | Parcelas explícitas, resto não atribuído, uma contagem global |
| Concluir e vincular plano | Confirmar parcial/concluído/não aplicar, sem perder sessão por conflito do plano |
| Rever histórico | Filtrar, abrir revisões, editar notas/questões, exportar CSV/JSON |
| Erro de escrita | Indicador não salvo, retry, exportação emergencial e alerta de risco ao sair |
| Hábito | Ver meta/evidências e confirmar ocorrência independentemente da sessão |
| Atualização disponível | Notificar sem recarregar sessão, retomar com compatibilidade verificada |

Estados de interface devem distinguir `salvo localmente`, `não salvo`, `sincronização pendente`, `conflito` e `recuperação necessária`, conforme o caso; não exibir `sincronizado` sem prova remota. Acessibilidade para teclado/toque, leitores de tela, contraste e reduzido movimento nos oito temas, com amostras desktop/tablet/mobile. Impeccable A-01 será pré-requisito de QA da UI quando a implementação vier a ser autorizada, incluindo checagem de versão, segurança/licença e permissões dos hooks — não instalação nesta rodada.

## 11. Matriz de testes F4-T01..F4-T42 (proposta; ainda não executada)

**Legenda:** cada cenário terá fixture, passos, resultado verificável, ambiente, comando e estado real `PASS|FAIL|BLOCKED|INCONCLUSIVE|NOT_RUN`. Os IDs são critérios propostos, não tarefas do writing-plans.

| ID | Cenário adversarial ou funcional | Evidência exigida |
| --- | --- | --- |
| F4-T01 | Estados e transições válidas | Sequência legal persistida, proibição das ilegais |
| F4-T02 | Duplo start/pause/complete | Uma operação lógica, um intervalo/fechamento |
| F4-T03 | `operationId` replay idêntico | Resposta idempotente sem novo efeito |
| F4-T04 | Mesmo `operationId` com payload diverso | Conflito/recusa, sem overwrite |
| F4-T05 | Cronômetro livre de evento/F3 | Início e referência por ID, sem conclusão de plano |
| F4-T06 | Pause/resume múltiplos | Soma somente intervalos de foco válidos |
| F4-T07 | Pomodoro foco/descanso | Descanso não soma estudo |
| F4-T08 | Pomodoro transição híbrida | Foco→descanso seguro, novo foco só após confirmação |
| F4-T09 | Suspensão em Pomodoro | Sem alarme/etapa fictícia, recuperação assistida |
| F4-T10 | Crash após último checkpoint | Tempo durável intacto, lacuna separada |
| F4-T11 | Fechamento/reabertura em outra aba | Recuperação assistida, sem assumir lease obsoleto |
| F4-T12 | Alterar relógio civil | Não inflar duração por `Date.now()` |
| F4-T13 | Suspensão do OS por horas | Verificação real ou `INCONCLUSIVE` declarado |
| F4-T14 | Aba minimizada + estudo em PDF | Sem pausa apenas por `visibilitychange` |
| F4-T15 | Inatividade prolongada legítima/ilegítima | Solicitar revisão com proveniência, sem dedução automática |
| F4-T16 | Duração longa e configurável | Revisão, sem truncamento silencioso |
| F4-T17 | Duração NaN/negativa/infinita | Rejeição segura sem commit |
| F4-T18 | Uma sessão duas abas | Só controlador válido consegue alterar |
| F4-T19 | Duas sessões iniciadas em abas simultâneas | Um cronômetro ativo por perfil local |
| F4-T20 | Transferência assistida + aba antiga ressuscitada | Fencing impede escrita do controlador obsoleto |
| F4-T21 | Troca assistida de matérias | Pausa e novo start atomicamente, sem tempo sobreposto |
| F4-T22 | Sessão manual retroativa sem timer | Origem manual e data validadas, sem intervalo fictício |
| F4-T23 | Manual sobreposto a medido | Aviso, sem exclusão automática de fato legítimo |
| F4-T24 | Sessão multiassunto, parcela não atribuída | Soma de parcelas = total validamente alocável |
| F4-T25 | Sessão vinculada a dois editais | Cobertura contextual, tempo global contado uma vez |
| F4-T26 | Sessão livre vinculada posteriormente | ID preservado, revisão auditável |
| F4-T27 | F3 bloco com várias sessões parciais | Sem conclusão automática; conciliação explícita |
| F4-T28 | F3 conflito ao concluir sessão | Sessão preservada, plano pendente sem falso sucesso |
| F4-T29 | Questões/acertos incoerentes | Correção recusada; não há acertos > questões |
| F4-T30 | Medição sem classificação | Total não atribuído, sem disciplina inventada |
| F4-T31 | Edição histórica e tombstone | Nova revisão + proveniência; sem ressurreição |
| F4-T32 | Dois dispositivos fake com mesmo registro | Revisões divergentes preservadas e não somadas |
| F4-T33 | Exclusão versus edição offline fake | Tombstone + variante e conflito explícito |
| F4-T34 | Duração cruzando meia-noite/fuso | Soma diária consistente, uma sessão global |
| F4-T35 | DST e hora ambígua/inexistente | Resolução ou recusa sem atribuição fictícia |
| F4-T36 | Hábito com meta atingida | Sugerir cumprimento, confirmação é fato próprio |
| F4-T37 | Evidência de hábito corrigida | Reavaliar meta sem apagar confirmação silenciosamente |
| F4-T38 | Histórico filtrado, revisão e referências de materiais | IDs estáveis, consulta escalável, páginas/trechos validados, sem armazenamento de PDFs |
| F4-T39 | CSV/JSON e proteção contra fórmula/segredo | Conteúdo coerente, sem credenciais, tempo sem duplicação |
| F4-T40 | Quota/abort na conclusão | Sem `LOCAL_COMMITTED`, sessão/intent recuperáveis quando possível |
| F4-T41 | Exportação/reimportação emergencial idempotente | Prévia, checksum/identidade quando aplicável, sem duplicar ou sobrescrever posterior |
| F4-T42 | Atualização SW durante sessão e UX de dispositivos/temas | Sem reload inseguro, teste E2E/Impeccable em oito temas; riscos não executados declarados |

**Camadas exigidas:** unitários de domínio e relógio simulado; integração IndexedDB real ou fake com transações e abortos; fixtures de contratos F2/F3/A-02; Playwright offline e cenários de múltiplas abas; teste real de plataforma quando disponível; regressão F1–F3; acessibilidade e revisão independente. O writing-plans futuro pode subdividir a matriz sem retirar cenários.

## 12. Riscos, pressupostos e gates

| Risco | Consequência | Contenção exigida |
| --- | --- | --- |
| Duração fictícia após suspensão/relógio alterado | Estatísticas falsas | Monotonicidade verificável, checkpoints, lacunas e origem manual separada |
| Corrida interabas/duas sessões ativas | Duplicidade temporal | Fencing, CAS e transação por perfil |
| Quota/erro IndexedDB | Perda de dados recentes | Sem confirmação falsa; retry e exportação emergencial |
| Confusão entre tempo planejado/executado | Conclusão indevida de calendário | Conciliação explícita e fatos F3/F4 segregados |
| Duplo registro multi-edital ou de conflito | Tempo e questões inflados | Deduplicação de sessão/medição, uma versão canônica |
| PWA/versão DB incompatível | Bloqueio ou escrita insegura | Update coordenado, detecção e recuperação; homologação F7 |
| Exportação de conteúdo não confiável | Planilha injetada, dados expostos | Escape/formula injection, privacidade, validação em import |
| Complexidade excessiva | Regressão e manutenção cara | Reuso F1/F3, sem event sourcing total/infra duplicada |

**HIGH da F0 mantidos `UNVERIFIED`:** `R-V1-LEGACY-REMOTE-PLAN`, `R-V1-FIRESTORE-DOCUMENT-1MIB`, `R-V1-MULTITAB-OUTBOX-RACE`, `R-V1-BACKUP-TOMBSTONE-LOSS`. Cobertura local com fake não altera esse status. Ressalvas F2/F3 (incluindo hardware modesto `NOT_RUN`, prova vencida e F2-T22 `NOT_RUN`) não são resolvidas implicitamente pela F4.

### 12.1 Fronteiras e fases

| Fase | Responsabilidade | Relação com F4 |
| --- | --- | --- |
| F2 | Identidade do edital/conteúdo | F4 somente referencia entidades válidas da F2 |
| F3 | Cenário, calendário, Ciclo e Reta Final | F4 vincula e oferece progresso parcial com confirmação |
| **F4** | **Sessões, timer, Pomodoro, medidas, materiais, hábitos, histórico** | **Fonte canônica de execução local** |
| F5 | Revisões, pontos fracos e inteligência de banca | Consome fatos; não reescreve tempo medido |
| F6 | Indicadores/UX final | Projeções derivadas e dashboards |
| F7 | Sync real Google/Firebase, migração, backup/restauração, PWA e piloto | Homologa contratos simulados e integrações reais |
| F8 | Cutover V1→V2 | Somente após G5 humano específico |

### 12.2 Definition of Done futura (não autorização)

Para propor aceite humano de F4, exigir, cumulativamente: cobertura dos quatro requisitos F0; mapeamento D-F4-01–21 a código/testes; 42 cenários F4-T01–42 com resultados honestos, inclusive estados `NOT_RUN`/`INCONCLUSIVE`; typecheck/lint/build/testes locais e regressões reais; logs sanitizados; independência da V1; QA Impeccable validado na fatia UI; revisão independente com falhas materiais corrigidas; demonstração de cronômetro, manual, Pomodoro, histórico, hábitos, crash/concorrência/backup emergencial; integração **na `v2` apenas quando autorizada**; inventário e saneamento Git/GitHub sem destruir trabalho; aceite humano específico.

**Gate resumido do roadmap F4:** nenhuma duplicidade, tempo ambíguo explícito, commit local confirmado e histórico reconciliável. A conclusão de testes isolados não prova integração, publicação ou aceite humano.

### 12.3 Pontos de detalhamento técnico delegáveis ao futuro plano, sem nova escolha de produto

Frequência exata de checkpoint; limites padrão de revisão de duração; algoritmo específico de lease/fencing/fallback quando seguro; nomes físicos de stores e índices; política de paginação e limites por lote; UI dos conflitos; formato concreto/versionamento de CSV, JSON e arquivo emergencial; nível de precisão e arredondamento temporal; critério verificável de continuidade em navegador/OS; ordenação das subtarefas; política de logs e retenção não destrutiva. Esses detalhes devem ser fundamentados em evidência e testes, sem desviar das decisões. Se surgir nova escolha arquitetural material, parar e solicitar gate humano.

## 13. Revisão crítica do desenho e condições de submissão

### 13.1 Checagem de consistência (revisão de mesa, não testes)

- **Sem contradição D-F4-03 × D-F4-13:** gravar descanso é diferente de contá-lo como estudo; foco seguinte exige confirmação.
- **Sem contradição D-F4-04 × D-F4-18:** registro manual é válido, mas nunca se transforma em medição monotônica por confirmação.
- **Sem contradição D-F4-05 × D-F4-12:** múltiplos editais são vínculos contextuais; versões concorrentes da mesma sessão não podem ser somadas.
- **Sem contradição D-F4-06 × D-F4-08:** correção auditável da sessão não aplica automaticamente remarcações ou conclusões na F3.
- **Sem contradição D-F4-09 × D-F4-11:** evidência estatística de hábito não é confirmação da ocorrência.
- **Sem contradição D-F4-15 × persistência:** dados em memória são provisórios; exportação emergencial é alternativa condicionada ao arquivo efetivamente gravado, não garantia frente a crash.
- **Sem contradição D-F4-16 × monotonicidade:** duração e localização civil são informações distintas; se falta prova de repartição, não inventar hora.
- **Sem contradição D-F4-17 × D-F4-02:** controlador único de sessão e timer único do perfil são regras complementares, não uma trava global para dispositivos offline.
- **Sem contradição D-F4-21 × F7:** a F4 protege a sessão no âmbito dos seus contratos; testes globais de PWA/schema/migração continuam em F7.

### 13.2 Estado de entrega deste artefato

Esta é a **especificação formal aprovada** pelo proprietário em 2026-10-30. A checagem acima é documental, sem executar a aplicação nem chamar agentes independentes. A implementação é autorizada pelo GOAL F4 e segue o writing-plans aprovado; push, integração remota, deploy e aceite humano permanecem gates separados.

## 14. Referências de origem e trilha de aprovação

- [Roadmap V2](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/v2/ROADMAP.md)
- [Spec-mestra V2 de 2026-10-19](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-19-estudo-organizado-v2-design.md)
- [Spec F4 preliminar de 2026-10-28 — proposta, não aprovada](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f4-execution-design.md)
- [Spec F3 aprovada](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f3-planning-design.md)
- [Pré-contratos A-02](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-v2-multidevice-sync-f1-contracts.md)
- [Contrato F3/F4 no código](https://github.com/matheussilva421/estudo-organizado/blob/v2/apps/v2/src/domain/planning-execution-contract.ts)
- Decisões D-F4-01–21 e aprovação da arquitetura consolidada: aprovadas pelo usuário em 2026-10-30 e registradas neste documento formal; a aprovação do GOAL de execução também foi registrada na conversa.

---

**Gate de aprovação:** a **especificação formal F4** foi aprovada expressamente pelo proprietário em 2026-10-30. O passo autorizado é a execução do GOAL F4 conforme o writing-plans aprovado; a aprovação não autoriza push, atualização do GitHub, integração remota, deploy ou aceite humano automático.
