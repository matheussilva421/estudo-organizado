# Estudo Organizado V2 — F7-UX
## Especificação formal de experiência e arquitetura visual — v0.1

**Data:** 05/11/2026  
**Estado:** **PROPOSTA PARA ACEITE HUMANO**; não aprovada como especificação executável.  
**Repositório:** `matheussilva421/estudo-organizado`.  
**Referências remotas verificadas anteriormente:** `v2@6c70fef3eae20dd212dba9686eb1eaceb10a6292`; `main@9046cfa2283cd293b38df9d52fabfcd5de9ac67c`.  
**Fase:** F7-UX (redesign da experiência), distinta da F7 funcional (Auth, sincronização, backup e homologação).  
**Fonte documental primária:** transcrição `ChatGPT_Concluir-Estudo-Organizado-V2_20261105-1100.md` (14.408 linhas), [conversa histórica](https://chatgpt.com/g/g-p-6aba7b97d9c48191b0afdb302fa77a6a-github-ativos/c/6aeb797d-543c-83e9-a0aa-2d11b6bc64b0).  
**Decisões vinculantes:** F7-UX-D01–D71, na ordem original, sem renumeração.

> **Limites de verificação.** O texto da transcrição foi consultado por recuperação indexada; sua cópia bruta não pôde ser materializada localmente. Esta especificação preserva escolhas e requisitos verificáveis, mas não substitui a transcrição literal. O estado Git local, commits não publicados, ambiente de staging e gates externos não foram revalidados nesta sessão. Nenhuma implementação ou teste foi executado.

---

## 1. Escopo e princípios

**Objetivo:** oferecer uma interface integrada de estudos, offline-first, acessível e adaptável para desktop, tablet e celular, sem comprometer identidade, dados, histórico causal, precisão dos indicadores ou a V1. Preferir soluções gratuitas, locais e componentes já existentes.

**Inclui:** Home e widgets; Shell, Busca e Central de Atenção; Conteúdo; Planejamento; Sessões; Revisões; Análises; Configurações; design system, navegação contextual, estados, privacidade, segurança de UX e responsividade.

**Não autoriza:** escrever código, publicar, substituir V1, modificar `main`, fazer merge/push, habilitar serviços externos, apagar dados, realizar cutover F8 ou criar GitHub Actions, PRs e branches. A futura implementação depende de plano e aprovação próprios.

**Princípios inegociáveis:**

1. Uma decisão aprovada é intenção arquitetural, não funcionalidade implementada ou homologada.
2. Apenas o domínio de origem altera fatos; Home, Análises e Atenção projetam e apresentam dados sem editar implicitamente suas fontes.
3. Exibir somente estados apoiados por evidências reais: salvar localmente ≠ enviar ≠ receber ACK ≠ convergir ≠ ter backup restaurável.
4. Diferenciar planejamento, vinculação, execução, cumprimento, revisão, análise e recuperação; sem inferir execução integral por simples vínculo.
5. Proteger rascunhos, sessões, identidade do perfil, outbox, exclusões e backups contra ações irreversíveis automáticas.
6. Reutilizar oito temas, tokens, Shell e padrões existentes; evitar biblioteca universal nova, CSS duplicado, dependências pagas ou orquestrador global desnecessário.
7. Responsividade, teclado, leitores de tela, foco e contrastes devem ser requisitos da experiência inteira, e não opcionais.

## 2. Reconciliação histórica e hierarquia de autoridade

- **D01:** aprovada como visão livre: dashboard com próximas sessões, métricas, dias até provas, desempenho e evolução. **Não existe uma opção A–D de D01**.
- **D02–D29:** decisões da Home, layout, catálogo, fórmula, métricas, filtros, interação e identidade visual; aprovações recuperadas.
- **D30:** gráficos e séries formulados após D29, **adiados deliberadamente** ao ampliar o redesign e aprovados expressamente na opção D após D64. A numeração permanece D30.
- **D31–D54:** navegação/Busca/Atenção, Conteúdo, Planejamento e Sessões; aprovadas individualmente.
- **D55–D64:** Revisões e Análises; aprovadas individualmente; D30 integra Análises sem substituir D60–D64.
- **D65–D68:** Configurações, perfil, sincronização, backup, manutenção; aprovadas e consolidadas provisoriamente.
- **D69–D71:** continuidade, estados/recuperação e design system; aprovadas e consolidadas.

**Hierarquia:** redação expressamente aprovada pelo usuário → alternativa original escolhida → consolidações compatíveis posteriores → contratos do produto existentes. O código não revoga decisões, e consolidações não inventam conteúdo não registrado.

**Separação essencial:** a série `F7-UX-Dxx` não se confunde com decisões `D-F7-xx` da F7 funcional nem com decisões de F0–F6.

## 3. Resolução de tensões e interpretações vinculantes

| Relação | Resolução adotada sem reabrir decisões |
|---|---|
| D02–D10 × D71 | Dashboard personalizável e editor de fórmulas seguros, **sem** exigir nova biblioteca universal ou interpretação de código arbitrário. |
| D07–D10 × D09-B | Widgets personalizados operam sobre **dados acadêmicos internos compatíveis**; conectores e fontes externas não foram aprovados por essas decisões. |
| D18 × D69 | Filtros globais, locais e vinculados coexistem; não fixar artificialmente concurso em sessões compartilhadas. |
| D25 × D70 | Indicador global discreto de integridade é compatível com feedback contextual; proíbe-se painel permanente técnico obrigatório. |
| D30 × D60–D64 | Editor de gráficos e séries só oferece combinações semânticas válidas; não oculta metodologia, denominadores, amostra e advertências obrigatórias. |
| D31–D33 × Shell atual | O design aprovado para mobile é **Início · Plano · Estudar · Revisões · Mais**. Nove destinos do menu atual não são motivo para desconsiderar D33. |
| D52 × D61/D69–D70 | Sessão concluída, bloco vinculado e cumprimento conciliado são fatos distintos. |
| D63 × D67 | Snapshot/relatório histórico não é backup operacional; importar relatório não restaura sessões ou outros fatos. |
| D65–D68 × D36 | Configurações fornece operações e diagnósticos; Central de Atenção concentra a pendência deduplicada. |

---

## 4. Requisitos transversais

### T-01 — Fonte de verdade e autorização

Conteúdo é autoridade de identidades e estrutura acadêmica; Planejamento, de cenários e blocos; Sessões, de fatos e medições; Revisões, de compromissos, políticas e execuções. Mecanismos de persistência/sync/backup são autoridade dos resultados técnicos que efetivamente confirmaram. Projeções de Home, Busca, Atenção e Análises não alteram esses fatos na renderização. Identificadores e perfis devem ser validados ao usar referências cruzadas; não corresponder por nome quando houver ID inválido.

### T-02 — Navegação e continuidade (D31–D36, D69)

- Usar rotas tipadas, com somente identificadores e filtros pertinentes, sem tokens, rascunhos ou payloads acadêmicos na URL.
- Home, Busca e Atenção abrem o módulo e, quando possível, a entidade específica; o destino valida perfil/estado e mantém o retorno à origem.
- Entidades excluídas, arquivadas ou de outro perfil não são substituídas silenciosamente por resultado de mesmo nome.
- Seleções próprias dos módulos permanecem independentes quando o contexto global não é apropriado.
- Rascunhos e sessões ativas devem ser preservados antes de transições com risco de perda; não salvar ou descartar implicitamente.
- Manter a rota histórica `overview` até que exista alternativa verificada e compatível.

### T-03 — Estados e evidências (D24–D25, D69–D70)

| Condição | O que a UX pode afirmar | O que não pode presumir |
|---|---|---|
| `LOCAL_COMMITTED` | Alteração específica persistida localmente | Entrega ou convergência |
| Outbox `PENDING` | Operação causal pendente | Envio autorizado/ACK |
| Envio relatado | Tentativa/envio registrado, conforme evidência | Confirmação remota |
| ACK válido | Operação/revisão específica confirmada | Convergência de toda biblioteca |
| Cursor e escopo verificados | Convergência **no escopo efetivamente provado** | Convergência de recursos bloqueados ou não verificados |
| `CONFLICT` | Versões/identidades divergentes | Resolução ou sobrescrita segura |
| `PARTIAL` / `STALE` | Leitura parcial / fotografia anterior, com ressalva | Ausência de dados ou atualização atual |
| `INSUFFICIENT_DATA` | Amostra insuficiente para o indicador | Resultado zero ou taxa confiável |
| Prévia de restauração `SAFE` | Formato/época aceitáveis no escopo inspecionado | Backup integral ou restauração efetuada |
| `REBASELINE_REQUIRED` | Recuperação direta insegura | Autorização para importar/apagar tombstones |
| `BLOCKED_UPGRADE` / `QUOTA` / `ABORT` / `UNAVAILABLE` | Falha operacional específica | Banco corrompido ou gravação realizada |

Níveis de feedback: **imediato** após operação; **pendência persistente deduplicada** se acionável; **recuperação guiada protegida** em riscos ou ações irreversíveis. Dispensar alerta não confirma fatos de estudo.

### T-04 — Design system, acessibilidade, responsividade (D26–D29, D71)

- Preservar os **oito temas**: Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex, Plasma; não supor que Platina seja tema claro.
- Preservar fontes Plus Jakarta Sans e DM Mono e densidades confortável/compacta, sem reduzir legibilidade, foco ou alvos acessíveis.
- Reutilizar tokens semânticos, cores de estado separadas de paletas acadêmicas, componentes compartilhados **quando houver semântica equivalente** e componentes especializados onde necessários.
- Foco visível, ordem de teclado, skip link, landmarks, nomes/estados acessíveis, descrição de gráficos, gerenciamento de foco em modais e movimento reduzido.
- Desktop: sidebar e inspeção lado a lado; tablet: trilho/painéis adaptativos; celular: barra inferior e etapas progressivas. Breakpoints observados da V2: sidebar >= 1.024 px; trilho 721–1.023 px; inferior <= 720 px; não são autorização para mudar D31–D33 sem justificativa.
- Estados de carregamento/vazio/erro/parcial/desatualizado devem ser legíveis sem depender apenas de cor. Tabelas preservam unidades, cabeçalhos e dados.

---

## 5. Home e construtor de widgets — H-01 a H-10 (D01–D29)

**H-01 — Entrada:** a Home deverá mostrar um painel de comando de estudos com próxima atividade acionável, agenda, dias até provas, métricas de estudo, questões, progresso de metas, revisão e evolução, conforme os dados disponíveis. A ausência de dados não vira valor zero inventado.

**H-02 — Layouts:** permitir modelos iniciais (*Foco Diário*, *Desempenho*, *Reta Final*) e layout personalizado. D03-C aprova modelos prontos **mais** edição avançada; D05-C prevê grade responsiva avançada; D06-C prevê adaptação inteligente por dispositivo. Um mesmo layout não deve ficar inutilizável em 320 px.

**H-03 — Catálogo e construtor:** oferecer widgets predefinidos, variantes e widgets criados pelo usuário (D07-D). Editor D08-C possui fluxo básico e avançado, com prévia, validação e possibilidade de reverter escolhas. Persistir configurações do painel no escopo correto, sem confundir preferências locais com dados acadêmicos sincronizados.

**H-04 — Fontes internas e fórmulas:** D09-B restringe o alcance a **dados acadêmicos internos compatíveis**. D10-C permite fórmulas avançadas com condições/comparações, sob validação de tipo, unidade, denominador, divisões por zero, amostra, períodos e custos de computação. Não permitir script arbitrário, `eval`, credenciais, escrita nas entidades ou acesso irrestrito ao IndexedDB. As fórmulas não podem criar dados de origem.

**H-05 — Widgets previstos:**

| Decisão | Widget e comportamento mínimo |
|---|---|
| D11 | Tempo estudado: tempo líquido, metas, sessões, tendências e origem manual/cronômetro separadas. |
| D12 | Planejado × executado: tempo e blocos em dimensões distintas; não inferir percentual de cumprimento pelo vínculo da sessão. |
| D13 | Questões/desempenho: volume, acertos, incorretas, taxa com denominador e recortes, respeitando amostra mínima. |
| D14 | Revisões: atrasadas, do dia, futuras, execução e diagnósticos qualitativos. |
| D15 | Concursos: dias para cada prova, cobertura disponível, prioridades e datas verificadas. |
| D16 | Agenda: próxima sessão em destaque e demais estudos em lista/calendário adaptável. |
| D17 | Priorização: fatores explicáveis, possibilidade de controle manual e efeitos visíveis. |

**H-06 — Filtros e interação:** filtros globais, locais e vinculados (D18-D); drill-down em camadas (D19-D); painéis adaptativos (D20-D); expansão inteligente com controle do usuário (D21-D); histórico de navegação, retorno e proteção de edições (D22-D); ações rápidas com consentimento proporcional (D23-D). Abrir widget não deve alterar o plano, salvar tempo ou executar revisão sem comando explícito.

**H-07 — Estados dos widgets:** diferenciar `LOADING`, vazio genuíno, insuficiência, erro, parcialidade, desatualização, offline e conflito (D24-D). Comunicação global discreta da saúde com detalhe contextual (D25-D).

**H-08 — Identidade visual:** cards, bordas, espaçamentos e densidade adaptativa (D26–D27), tipografia e valores comparáveis (D28), paletas semânticas/acessíveis por concurso e disciplina (D29). Cores acadêmicas não significam automaticamente sucesso/erro.

**H-09 — Persistência visual:** ajustes do painel não alteram fatos acadêmicos; salvar uma disposição de widgets não prova backup remoto; restaurar padrão não exclui dados. Não prometer sincronização de preferências sem contrato de D66.

**H-10 — Aceite verificável:** conseguir selecionar modelo pronto, reorganizar/adaptar e recuperar um layout; configurar fontes e fórmulas seguras; ver unidades, denominadores, ressalvas de dados; transitar entre tamanhos de tela sem perder acesso; retornar à origem após drill-down; impedir alteração acidental por ações rápidas.

## 6. Shell, Busca e Central de Atenção — S-01 a S-07 (D31–D36, D69–D71)

**S-01 — Navegação:** sidebar desktop, trilho lateral tablet e barra inferior mobile. No celular, a composição D33-D é **Início · Plano · Estudar · Revisões · Mais**. Os demais destinos (Conteúdo, Análises, Busca, Atenção, Configurações) devem continuar alcançáveis pelo menu contextual e rotas diretas.

**S-02 — Cabeçalho:** adaptar concurso de referência, Busca, indicador discreto de saúde/entrega, identidade local e ações ao espaço. Não deslocar o registro de estudo em andamento nem criar um menu escondido inacessível por teclado.

**S-03 — Busca:** entrada rápida + pesquisa aprofundada em área própria. Agrupar e filtrar resultados com contexto e IDs estáveis. Respeitar arquivamento, permissões/identidade e inexistência da entidade. A seleção retorna à origem ou ao destino validado.

**S-04 — Central de Atenção:** alimentar fila de ocorrências deduplicadas por identidade causal; identificar título, origem, data/escopo, evidência, criticidade e ação admissível. Badge deve contar o universo prometido e evitar inflar alertas por repetição de renderização.

**S-05 — Links profundos:** usar `routeForTarget` apenas como adaptador; o destino precisa da entidade exata, se aplicável. Uma referência de outro perfil é recusada; registro arquivado pode ser consultado se contrato permitir; exclusão não busca substituto semelhante.

**S-06 — Transições:** mudança de aba ou viewport mantém contexto e foco; confirma saída se rascunho não salvo ou sessão potencialmente afetada; não criar salvamento implícito.

**S-07 — Aceite:** navegação de Home/Atenção/Busca → entidade → retorno; menu mobile de cinco destinos e Mais; leitura a 320 px; foco e teclado; zero perda de rascunho; `overview` histórico tratado; contagem de ocorrências consistente.

## 7. Conteúdo — C-01 a C-08 (D37–D43)

**C-01 — Workspace hierárquico:** exibir editais, disciplinas, assuntos/subassuntos, aulas e respectivos relacionamentos, com explorador progressivo (D37–D38). Árvore extensa deve admitir expansão/recolhimento, pesquisa/seleção e contexto visível no celular.

**C-02 — Painel do assunto:** metadados, hierarquia, aulas associadas, edital e ações pertinentes no painel contextual; no desktop pode ser lateral, e no celular ocupa superfície progressiva, com foco e retorno preservados (D39).

**C-03 — Edição:** criação e edição de assunto/subassunto com editor híbrido e contextual (D40), validação, rascunhos preservados e rejeição explícita de conflito de revisão.

**C-04 — Reorganização:** drag-and-drop **e** alternativas por comandos acessíveis para mover/reordenar (D41). Mostrar origem, destino, impacto na árvore, checagem de ciclos e relações; confirmar operações relevantes antes de gravar. Não prometer undo durável sem contrato correspondente.

**C-05 — Aulas ↔ assuntos:** relação bidirecional navegável e auditável (D42), com associação/desassociação explícitas e respeito aos IDs. A operação de desvincular não necessariamente exclui aula ou assunto.

**C-06 — Editais e disciplinas:** administração contextual sob demanda (D43); distinguir disciplina canônica de vínculo a edital, edital principal, importações e arquivamento. Alterar vínculo não deve reescrever a identidade do assunto.

**C-07 — Estados:** sucesso local, registro ausente/arquivado, conflito, dado parcial e falha de persistência são distintos. Histórico de exclusões e época causal não são apagados pela apresentação.

**C-08 — Aceite:** criar, localizar, mover, associar, arquivar e navegar em desktop/tablet/celular sem perder identidade, referências, rascunhos ou foco; operações com conflito não sobrescrevem registro existente.

## 8. Planejamento — P-01 a P-09 (D44–D49)

**P-01 — Workspace contextual:** reunir cenários, tipos de ciclo, calendário, blocos, metas, diagnósticos e ferramentas avançadas sob demanda (D44). Não reduzir planejamento a calendário isolado.

**P-02 — Cenários:** criar/selecionar cenários ativos, inativos e rascunhos; comparar com critérios explícitos; ativação/substituição com prévia de impacto, preservando versões e checkpoints (D45).

**P-03 — Calendário:** vistas dia/semana/mês e lista, blocos com ou sem horário e capacidade compartilhada entre concursos (D46). Capacidade não pode ser contada duas vezes em cenários concorrentes ou editais compartilhados.

**P-04 — Assistente:** disponibilidade semanal, exceções, metas, distribuição por disciplina/conteúdo, prioridades, geração determinística, prévia de capacidade e confirmação antes da aplicação (D47). As sugestões não alteram automaticamente dados existentes.

**P-05 — Ciclo de Estudos × Reta Final:** diferenças semânticas de rodadas, adiamentos, proximidade da prova, data alterada, redistribuição e transição devem estar claras e preservar histórico (D48).

**P-06 — Metas e replanejamento:** progresso, comparação de revisões, adiantamentos/atrasos, simulação, rascunhos, checkpoints, conflitos e recuperação acessíveis contextualmente (D49).

**P-07 — Cumprimento verificável:** não declarar bloco cumprido porque `planBlockIds` aparece numa sessão `COMPLETED`. Vínculo, execução parcial, aplicação e conciliação são estados diferentes (D52, D61, D69).

**P-08 — Segurança:** manter ID e revisão de base; impedir alterações de concorrência silenciosas; histórico e rollback quando o contrato existente permitir, sem reconstruir cenários destrutivamente.

**P-09 — Aceite:** não exceder capacidade por contagem dupla; distinguir previsto e realizado; prévia e confirmação antes de substituir cenário; preservar checkpoints e mudanças; status compartilhado coerente com Sessões e Home.

## 9. Sessões — E-01 a E-09 (D50–D54)

**E-01 — Workspace:** início por bloco do Planejamento ou conteúdo escolhido, cronômetro, Pomodoro, registro manual, alocações, questões, histórico e hábitos em experiência contextual (D50).

**E-02 — Tempo:** foco e pausas separados; tempo cronometrado verificado não se confunde com tempo manual. Concorrência entre abas deve respeitar autoridade de execução; não iniciar simultaneamente sessões equivalentes sem proteção (D51).

**E-03 — Recuperação:** checkpoints, interrupção inesperada, intervalos duráveis e incertos; nunca inventar tempo para preencher lacuna. Permitir recuperar intenções manuais quando prova de persistência não existir (D51, D54).

**E-04 — Registro progressivo:** campos principais simples, detalhes avançados sob demanda; distribuir tempo por disciplina, assunto e aula preservando soma e referências, sem alocação dupla (D52).

**E-05 — Blocos:** sessão vinculada pode estar parcial ou não conciliada; conclusão de sessão não implica cumprimento integral de bloco (D52). Aplicação de conciliação é comando próprio e deve produzir evidência.

**E-06 — Histórico:** navegação por períodos/filtros, inspeção de sessões, questões/acertos, páginas e materiais, edição com revisão/identidade, trilha de auditoria, conflitos, excluídos e recuperação (D53).

**E-07 — Hábitos:** informar metas e consistência sem igualar dias sem estudo a falha de persistência. Alertas discretos, compromissos de continuidade e recuperação emergencial sob demanda (D54).

**E-08 — Estados:** salvamento local, falha, sessão ativa, rascunho, importação parcial, conflito e sincronização devem ser exibidos de acordo com o contrato, sem anunciar êxito remoto.

**E-09 — Aceite:** recuperar sessão interrompida sem tempo inventado; manter rascunhos ao navegar; separar tempos; conciliar bloco explicitamente; impedir dupla atribuição; histórico preserva auditoria.

## 10. Revisões — R-01 a R-09 (D55–D59)

**R-01 — Fila:** compromissos atrasados, de hoje e futuros em fila inteligente contextual, filtrável por concurso, disciplina e prioridade, com ação de execução específica (D55).

**R-02 — Semântica:** compromisso agendado ≠ execução iniciada ≠ execução concluída ≠ avaliação de retenção. Não marcar revisão concluída por simplesmente abrir registro ou sessão.

**R-03 — Política espaçada:** parâmetros e versões por escopo, avaliação qualitativa, intervalos e multiplicadores, simulação com comparação antes/depois e aprovação protegida (D56).

**R-04 — Inteligência e evidências:** indicar fatores e amostra por detrás de pontos fracos/fortes. Distinção entre diagnóstico e prognóstico: não fabricar chance de aprovação ou estimativa estatística de retenção sem evidência (D57).

**R-05 — Agenda:** lembretes/horários de silêncio locais e encaixe assistido no Planejamento (D58), respeitando capacidade compartilhada, conflitos de horário, prévia e consentimento antes de modificar blocos.

**R-06 — Histórico:** revisões, execuções e avaliações exploráveis com trilha de auditoria e identidade de política. Importação e portabilidade seguras; arquivos não substituem dados atuais automaticamente (D59).

**R-07 — Integração:** Conteúdo fornece IDs de assuntos; Sessões podem fornecer medições; Planejamento fornece capacidade/blocos; nenhum módulo apropria histórico do outro.

**R-08 — Estados:** ausência de compromissos, execução parcial, importação com conflito, amostra insuficiente e entrega bloqueada por política são comunicados separadamente.

**R-09 — Aceite:** fila coerente com os compromissos; mudança de política não reescreve histórico; diagnóstico com fatores rastreáveis; planejamento não alterado sem confirmação; importação compatível com causalidade e perfil.

## 11. Análises e visualizações — A-01 a A-11 (D30, D60–D64)

**A-01 — Workspace:** KPIs, tendências, filtros, comparações, métodos, relatórios e arquivo histórico em um espaço contextual e explorável (D60).

**A-02 — Gráficos D30:** sugestões e modelos inteligentes com editor avançado, escolha de tipo compatível (linha, barras, séries múltiplas e demais apresentações validadas), eixos, agrupamentos, legenda, períodos, drill-down e alternativa tabular. Não criar combinações inválidas de unidade, dimensão, denominador ou comparação temporal.

**A-03 — Indicadores auditáveis:** métricas definidas com fonte, perfil, período, numerador, denominador, exclusões, limites de amostra, metodologia e versionamento. Planejado, executado, sessão vinculada e bloco conciliado nunca se tornam a mesma variável (D61).

**A-04 — Tendências:** comparar 7/30/90 dias, granularidades diárias/semanais/mensais quando disponíveis, concurso/disciplinas, medições e avaliações sem alegar causalidade a partir de correlação descritiva (D62).

**A-05 — Concursos compartilhados:** horas de sessão com mais de um edital não são adicionadas integralmente em cada subtotal; distribuição exige alocação real. Ausência de dias na consulta não pode ser convertida silenciosamente em medição zero.

**A-06 — Histórico:** snapshots de relatório, versões metodológicas, escopo, período, proveniência, revisões de origem, ressalvas e comparabilidade; novo cálculo não sobrescreve snapshot histórico (D63).

**A-07 — Reprodutibilidade:** não prometer recomputação idêntica sem dados e algoritmo históricos recuperáveis. Fingerprint de cache não é assinatura de integridade e deve cobrir todas as dependências relevantes.

**A-08 — Exportações:** CSV/JSON/impressão-PDF com escopo e metadados explícitos; prevenção de injeção de fórmula em CSV; minimização de dados. Importação de relatório não equivale à restauração do estado de estudo.

**A-09 — Estados:** `READY`, `INSUFFICIENT_DATA`, `PARTIAL`, `STALE`, `LOADING`, `ERROR` com explicação e ação apropriada (D64). Não mostrar números antigos como atuais nem percentuais sem denominador.

**A-10 — Personalização controlada:** ordem/seleção de indicadores, visualizações e filtros podem mudar; origem, amostra, limitações críticas e avisos metodológicos devem continuar visíveis e não podem ser eliminados pela personalização.

**A-11 — Aceite:** gráfico e tabela devem representar os mesmos valores com unidades; amostra insuficiente gera ressalva; séries entre concursos preservam não dupla contagem; snapshots históricos preservam método; exportação não injeta fórmula e não expõe dados desnecessários.

## 12. Configurações, integridade, backup — G-01 a G-12 (D65–D68)

**G-01 — Estrutura:** visão geral e categorias contextuais de aparência, perfil, sincronização, armazenamento, backup, privacidade e ações protegidas (D65). Sem segunda Central de Atenção.

**G-02 — Autoridade das preferências:** tema/densidade/acessibilidade do dispositivo separados de preferências acadêmicas do perfil e de consentimento/vínculo remoto. A presença de `local-default` na implementação atual não prova gestão integral de múltiplos perfis.

**G-03 — Vínculo:** conexão remota opcional e consentida, com prévia de identidade, biblioteca e operações elegíveis. Expiração ou troca de identidade invalida prévia. Não transferir operações de uma conta para outra automaticamente (D66).

**G-04 — Outbox:** estados pendente/confirmado/conflito com elegibilidade explícita. Planejamento e Revisões apresentam limitações da política de entrega consultada; a UX não oferece botão para contorná-las. ACK, cursor e convergência são provas diferentes.

**G-05 — Pausas:** falha de autenticação, cota, offline, conflito e recuperação têm orientações distintas; preservar operações locais e evitar tentativas ilimitadas. Desvinculação não significa exclusão acadêmica (D66).

**G-06 — Backup integral:** identificar cobertura de Conteúdo, Planejamento, Sessões, Revisões, preferências aplicáveis, identidades, operações pendentes, épocas/tombstones e metadados causais. Não copiar tokens e segredos. Caches regeneráveis podem ser dispensados com prova de reconstrução (D67).

**G-07 — Níveis de proteção:** distinguir arquivo existente, checksum, manifesto, cobertura, read-back e restauração comprovada em ambiente isolado; SHA-256 não autentica a origem e não prova recuperabilidade integral.

**G-08 — Restauração:** inspecionar origem/destino, identidade, época e tombstones, proteger base atual, conferir concorrência, exigir confirmação, aplicar somente conforme contrato e verificar read-back. `REBASELINE_REQUIRED` impede restauração direta.

**G-09 — Armazenamento:** IndexedDB, `BLOCKED_UPGRADE`, `QUOTA`, `ABORT`, `UNAVAILABLE` e migrações apresentados com causas/ações corretas; nunca apagar banco para resolver migração bloqueada (D68).

**G-10 — Limpeza seletiva:** redefinir tema é reversível; reconstruir projeções depende de fontes íntegras; nunca chamar sessões, rascunhos, outbox, tombstones, checkpoints ou auditorias de cache regenerável.

**G-11 — Privacidade/segurança:** diagnósticos mínimos sem envio externo automático, credenciais excluídas, prévia do escopo exportado; exclusões irreversíveis e troca de conta têm inventário e proteção proporcionais ao risco.

**G-12 — Aceite:** sem conta remota, estudo continua offline; nenhuma operação pendente muda identidade; backup F2 parcial não é chamado integral; prévia `SAFE` não é execução; migração bloqueada não apaga base; confirmação de preferência não apaga fatos.

---

## 13. Jornada responsiva por módulo

| Área | Desktop | Tablet | Celular |
|---|---|---|---|
| Home | Grade editável, prioridades e inspetor sem perder contexto | Colunas adaptativas e detalhes progressivos | Widget prioritário, agenda, edições em etapas |
| Shell | Sidebar, cabeçalho e busca rápida | Rail e cabeçalho compacto | Barra de cinco destinos, ação Estudar e menu Mais |
| Conteúdo | Árvore e painel de detalhes | Árvore compacta e detalhe adaptativo | Navegação hierárquica progressiva, comandos de mover acessíveis |
| Planejamento | Cenários, calendário e capacidade lado a lado | Calendário/lista por contexto | Agenda, blocos e assistente de criação em etapas |
| Sessões | Cronômetro, vínculos e medições sem competição visual | Cronômetro central e controles adaptativos | Tempo em destaque, registro simples, recuperação protegida |
| Revisões | Fila e inspetor de evidências | Fila com detalhes expansíveis | Revisão atual, sequência e avaliação acessíveis |
| Análises | Exploração, filtros, gráficos e tabelas simultâneos quando úteis | Painéis adaptativos | KPIs essenciais, alternância gráfico/tabela, metodologia acessível |
| Configurações | Categorias e inspetores lado a lado | Categorias compactas | Resumo de saúde e fluxos protegidos progressivos |
| Atenção | Lista, agrupamentos e detalhe da ocorrência | Lista com detalhe contextual | Ocorrências essenciais e ação correspondente |

A opção de densidade compacta nunca pode remover o indicador de integridade obrigatório, impedir uso por teclado ou esconder a única rota de recuperação.

## 14. Aceite funcional de UX, evidências e regressões

Os critérios abaixo são **exigências para a futura implementação**; não são testes executados agora.

| ID | Cenário de aceite | Evidência a produzir futuramente |
|---|---|---|
| AC-01 | Home com widgets prontos, personalizados e com fórmulas válidas/inválidas | Teste de editor, reordenação, persistência e rejeição de fórmula insegura |
| AC-02 | Troca de tema e densidade nos oito temas | Contraste, foco, ausência de regressão e rótulos acessíveis |
| AC-03 | Layout no desktop/tablet e mobile 320/390 px | Playwright em viewports reais; sem ações críticas truncadas |
| AC-04 | Home → entidade de revisão, bloco ou sessão → retorno | ID e perfil verificados, foco e contexto preservados |
| AC-05 | Rascunho em andamento ao mudar de aba | Sem descarte silencioso; resultado de persistência confirmado |
| AC-06 | Conteúdo: árvore, reorganização e vínculos bidirecionais | Integridade referencial, validação e navegação por teclado |
| AC-07 | Planejamento: cenários/capacidade compartilhada | Sem contagem dupla ou substituição sem confirmação |
| AC-08 | Sessão vinculada mas bloco não conciliado | Home e Planejamento não declaram cumprimento integral |
| AC-09 | Sessão interrompida e registro manual | Tempo verificado e incerto separados; recuperação sem inventar dados |
| AC-10 | Revisões atrasadas, parciais e concluídas | Estado da fila consistente com compromisso e execução reais |
| AC-11 | Política de revisão editada | Simulação e aprovação; histórico anterior preservado |
| AC-12 | Gráfico personalizado e tabela equivalente | Séries, unidades, denominadores, intervalos e ressalvas idênticos |
| AC-13 | KPI com amostra insuficiente ou leitura stale | Informações corretas sem zeros ou sucesso fabricados |
| AC-14 | Snapshot histórico reaberto após mudança de origem | Método/versão/escopo preservados, sem substituir registro anterior |
| AC-15 | Commit local com outbox pendente | Feedback local correto sem alegação de entrega |
| AC-16 | ACK individual sem cursor convergido | Estado remoto parcial, sem alegação de sincronização integral |
| AC-17 | Backup parcial e prévia `SAFE` | Sem alegação de recuperabilidade integral; operação ainda protegida |
| AC-18 | Arquivo F1/F2 causalmente incompatível | Restauração direta bloqueada; preservação de exclusões |
| AC-19 | Migração IndexedDB bloqueada | Orientação contextual, nenhuma exclusão automática |
| AC-20 | Ação de desvincular ou excluir | Proteção de perfil, pendências, backup e confirmação conforme risco |
| AC-21 | Ocorrência comum em Home, Atenção e Configurações | Uma identidade causal e badges coerentes |
| AC-22 | Acessibilidade teclado/tecnologia assistiva | Testes automatizados e manuais: foco, rótulos, modal e leitor de tela |
| AC-23 | Offline e erro de quota/autenticação | Dados locais e rascunhos preservados; falhas corretamente nomeadas |
| AC-24 | Navegação legacy `overview` e links diretos | Sem 404 silencioso; tratamento compatível e verificado |

A validação deverá usar dados sintéticos, ambientes isolados e testes locais com relatório verificável. Não executar ações destrutivas com dados do usuário para provar funcionamento. Não inventar métricas de desempenho ou limites de tempo que não foram escolhidos no brainstorming.

## 15. Divergências técnicas identificadas na implementação consultada

**Estas constatações são para a futura especificação detalhada e execução autorizada.** Ausência de implementação F7-UX não é por si só um bug, e inspeção estática não comprova um defeito em execução.

| ID | Arquivo/área | Evidência observada | Tratamento posterior |
|---|---|---|---|
| DR-01 | `application/experience-queries.ts` | `buildHomeSummary()` usa `planBlockIds` de sessões `COMPLETED` para omitir blocos atrasados, sem exigir evidência específica de conciliação | Alinhar a semântica de cumprimento do bloco a D52/D61; testar regressões |
| DR-02 | `presentation/App.tsx` | `health.localCommitted` depende de editais/disciplinas, não representa todos os domínios | Fonte de evidência de persistência mais abrangente, sem inferências |
| DR-03 | `presentation/App.tsx` | `remoteCommitted: false`, `verifiedCursor: null` na saúde consultada | Não habilitar anúncio de convergência antes de provas reais |
| DR-04 | `presentation/views/priority-display.ts` | `routeForTarget()` encaminha à aba com `entityId: null` | Transportar ID, validar e preservar retorno conforme D69 |
| DR-05 | `application/experience-cache.ts` | Fingerprint não enumera explicitamente todas as medições e alocações usadas em análises | Verificar invalidação de cache em todos os caminhos de mutação; não afirmar bug em runtime sem reproduzir |
| DR-06 | `presentation/styles.css` e `tokens.css` | Referências a `var(--text-primary)` sem declaração encontrada nos estilos consultados | Corrigir inconsistência CSS após verificação no navegador |
| DR-07 | `presentation/views/SettingsView.tsx` | UI atual não representa todos os fluxos D65–D68 | Implementação de redesign futura, sem expor operações não homologadas |
| DR-08 | `platform/backup/restore.ts` | Prévia F2 é somente leitura e pode devolver `SAFE` / `REBASELINE_REQUIRED` | Nunca tratar prévia como restauração integral; manter proteções de exclusão |
| DR-09 | `presentation/AppNav.tsx` | Shell atual contém nove destinos; D33 escolheu barra mobile de cinco destinos, com Mais | Adaptar navegação sem perder rotas e acessibilidade |
| DR-10 | `presentation` / `styles.css` | Estilos compartilhados e específicos sobrepostos | Consolidar apenas regras materialmente duplicadas ou conflitantes |

**Não foram executados testes** nesta especificação. As divergências se referem ao código remoto consultado e podem já ter sido tratadas no trabalho local ainda não integrado. A reconciliação de estado Git é obrigatória antes de qualquer execução.

## 16. Gates de execução e proteção do projeto

1. **G-UX-APPROVAL — Aceite do documento:** esta v0.1 só se torna especificação vigente após aprovação expressa do usuário; nenhuma decisão é implicitamente reaberta.
2. **G-GIT-PREFLIGHT:** antes da implementação, inventariar `main`, `v2`, HEAD, working tree, commits locais/remotos, branches, PRs, worktrees, arquivos não rastreados, specs/planos anteriores e sua integração. Não misturar F7 funcional com F7-UX. Verificar se houve atualização desde `v2@6c70fef`.
3. **G-SCOPE:** implementação de UX não desbloqueia autenticação real, Firebase, Worker/KV ou demais capacidades externas. Interfaces dependentes de serviços não verificados devem ser conservadoras.
4. **G-EXT / G-STAGING:** dependências externas e homologação da F7 permanecem separadas da aprovação desta especificação. Não afirmar `ACCEPTED` sem evidência dos gates pertinentes.
5. **G-DATA:** antes de migrações/rotinas que possam tocar dados, preservar estado e verificar backup recuperável, concorrência e identidade. Nenhuma ação destrutiva sem autorização expressa.
6. **G-VALIDATION:** testes unitários, integração, Playwright, acessibilidade e regressão local; separar implementado, testado, integrado, publicado, homologado.
7. **G-MAIN:** `main` e V1 protegidas; usar `main-first` quando seguro e autorizado, sem merge não autorizado; sem novas Actions/CI, branches ou PRs por padrão.
8. **G-CLOSURE:** fase só poderá ser chamada de encerrada após testes pertinentes, integração autorizada e saneamento Git/GitHub, ou com bloqueios precisos formalmente declarados.

## 17. Conclusão da especificação

Não foi identificada decisão arquitetural adicional indispensável (D72). As escolhas D01–D71 formam um conjunto coerente quando interpretadas segundo as regras de autoridade e os limites documentados acima.

**Estado formal:** `F7_UX_SPEC_DRAFT_V0_1_AWAITING_APPROVAL`.

**Próxima etapa somente após aceite:** derivar plano de implementação do Superpowers a partir da v0.1 aprovada, reconciliando primeiro o estado real local e remoto da F7 funcional. Nenhum plano, GOAL, código ou operação Git foi criado por este documento.

---

## Apêndice A — Matriz canônica de decisões F7-UX-D01–D71

Os rótulos resumem as opções efetivamente aprovadas. Para o contexto completo, hipóteses, ressalvas e quatro alternativas apresentadas em cada decisão, consultar a transcrição primária. A coluna *linha* indica a **linha aproximada de início da apresentação da decisão** na transcrição indexada, para facilitar localização. Essa matriz não substitui as condições detalhadas das respostas originais.

| ID | Escolha | Área | Objeto | Arquitetura aprovada | Linha-fonte aprox. |
|---|---|---|---|---|---:|
| D01 | Visão livre | Home | Visão inicial da experiência | Dashboard com métricas, próximas sessões, dias até provas, desempenho e progresso | 556 |
| D02 | D | Home | Hierarquia da dashboard | Dashboard altamente personalizável | 593 |
| D03 | C | Home | Personalização do painel | Layouts prontos + editor avançado | 635 |
| D04 | D | Home | Dashboard inicial | Híbrido personalizável | 721 |
| D05 | C | Home | Organização visual dos widgets | Grade responsiva avançada | 775 |
| D06 | C | Home | Responsividade dos widgets | Responsividade inteligente e personalização por dispositivo | 847 |
| D07 | D | Home | Biblioteca de widgets | Construtor de widgets personalizados | 943 |
| D08 | C | Home | Editor dos widgets | Editor híbrido: básico + avançado | 1049 |
| D09 | B | Home | Fontes de dados dos widgets | Todos os dados acadêmicos internos compatíveis | 1141 |
| D10 | C | Home | Fórmulas personalizadas | Fórmulas avançadas, condições e comparações | 1215 |
| D11 | D | Home | Tempo estudado | Widget composto e adaptativo | 1313 |
| D12 | C | Home | Planejado versus executado | Visão dupla adaptativa de tempo e blocos | 1382 |
| D13 | D | Home | Questões e desempenho | Widget completo e adaptativo | 1459 |
| D14 | D | Home | Revisões | Widget completo e adaptativo | 1543 |
| D15 | D | Home | Concursos e prova | Widget integrado e adaptativo | 1634 |
| D16 | D | Home | Agenda de estudos | Híbrida e adaptativa | 1705 |
| D17 | D | Home | Priorização de sessões | Híbrida, explicável e com controle manual | 1783 |
| D18 | D | Home | Filtros da dashboard | Sistema híbrido com filtros globais, locais e vinculados | 1900 |
| D19 | D | Home | Interações dos widgets | Interação em camadas | 2033 |
| D20 | D | Home | Detalhes contextuais | Interface contextual por dispositivo | 2145 |
| D21 | D | Home | Expansão de painéis | Expansão inteligente com controle manual | 2245 |
| D22 | D | Home | Histórico e navegação contextual | Navegação híbrida com preservação protegida | 2362 |
| D23 | D | Home | Ações rápidas de widgets | Ações inteligentes com proteção proporcional | 2464 |
| D24 | D | Home | Estados visuais dos widgets | Estados semânticos com diagnóstico progressivo | 2568 |
| D25 | D | Home | Indicadores de sincronização | Estado global + indicação contextual | 2694 |
| D26 | D | Home | Estilo visual dos widgets | Sistema visual híbrido e personalizável | 2836 |
| D27 | D | Home | Densidade visual | Adaptativa e totalmente configurável | 2981 |
| D28 | D | Home | Tipografia de widgets | Sistema tipográfico semântico e adaptativo | 3121 |
| D29 | D | Home | Cores e gráficos | Sistema cromático semântico e personalizável | 3285 |
| D30 | D | Análises | Tipos de gráficos e séries | Visualizações inteligentes + editor avançado | 3427 |
| D31 | D | Shell | Arquitetura geral de navegação | Navegação adaptativa com hierarquia por dispositivo | 3654 |
| D32 | D | Shell | Organização e hierarquia das abas | Hierarquia por frequência e contexto | 3785 |
| D33 | D | Shell | Barra inferior do celular | Barra híbrida com ação Estudar contextual | 3936 |
| D34 | D | Shell | Cabeçalho global | Cabeçalho adaptativo em camadas | 4068 |
| D35 | D | Busca | Busca global | Busca progressiva em dois níveis | 4225 |
| D36 | D | Central de Atenção | Prioridades e notificações | Central inteligente e progressiva | 4386 |
| D37 | D | Conteúdo | Explorador acadêmico | Explorador hierárquico com painéis contextuais | 4484 |
| D38 | D | Conteúdo | Árvore de assuntos | Árvore progressiva e adaptativa | 4655 |
| D39 | D | Conteúdo | Detalhes de assuntos | Painel contextual progressivo | 4795 |
| D40 | D | Conteúdo | Criação e edição hierárquica | Editor híbrido e contextual | 4937 |
| D41 | D | Conteúdo | Reorganização hierárquica | Reorganização híbrida com segurança proporcional | 5104 |
| D42 | D | Conteúdo | Aulas e relações com assuntos | Gerenciador relacional bidirecional | 5315 |
| D43 | D | Conteúdo | Editais e disciplinas | Espaço contextual com administração sob demanda | 5493 |
| D44 | D | Planejamento | Workspace de planejamento | Workspace adaptativo de planejamento | 5721 |
| D45 | D | Planejamento | Gestão de cenários | Gerenciador contextual com comparação sob demanda | 5923 |
| D46 | D | Planejamento | Calendário, blocos e capacidade | Calendário híbrido e adaptativo | 6148 |
| D47 | D | Planejamento | Criação de planos | Assistente progressivo com controles avançados | 6351 |
| D48 | D | Planejamento | Ciclo e Reta Final | Experiência contextual adaptativa | 6542 |
| D49 | D | Planejamento | Metas e replanejamento | Central contextual de acompanhamento e ajustes | 6766 |
| D50 | D | Sessões | Workspace de estudo | Workspace de estudo contextual | 6985 |
| D51 | D | Sessões | Cronômetro e Pomodoro | Cronômetro adaptativo com segurança contextual | 7191 |
| D52 | D | Sessões | Registro manual e alocações | Registro contextual com distribuição progressiva | 7417 |
| D53 | D | Sessões | Histórico e medições | Histórico explorável com inspetor contextual | 7677 |
| D54 | D | Sessões | Hábitos e recuperação | Acompanhamento contextual com segurança sob demanda | 7935 |
| D55 | D | Revisões | Fila e execução | Fila inteligente contextual | 8184 |
| D56 | D | Revisões | Política de revisão espaçada | Política contextual com simulador e aprovação protegida | 8446 |
| D57 | D | Revisões | Pontos fracos e evidências | Explorador contextual de prioridades e evidências | 8696 |
| D58 | D | Revisões | Agenda e lembretes | Agenda contextual com encaixe assistido | 8993 |
| D59 | D | Revisões | Histórico, importação e auditoria | Histórico contextual com auditoria e recuperação protegidas | 9257 |
| D60 | D | Análises | Workspace de análises | Workspace analítico contextual e explorável | 9564 |
| D61 | D | Análises | Indicadores auditáveis | Laboratório contextual de indicadores auditáveis | 9867 |
| D62 | D | Análises | Tendências e comparações | Explorador visual contextual com relatórios reproduzíveis | 10189 |
| D63 | D | Análises | Arquivo de relatórios históricos | Arquivo analítico contextual com comparação e auditoria | 10518 |
| D64 | D | Análises | Estados e personalização | Workspace analítico adaptativo com integridade obrigatória | 10874 |
| D65 | D | Configurações | Estrutura da aba | Configurações contextuais com integridade sempre visível | 11681 |
| D66 | D | Configurações | Perfil, identidade e sincronização | Perfil local com sincronização contextual e fluxos protegidos | 11941 |
| D67 | D | Configurações | Backup e restauração | Cofre local contextual com restauração protegida | 12225 |
| D68 | D | Configurações | Armazenamento e manutenção | Manutenção contextual guiada com proteção progressiva | 12568 |
| D69 | D | Transversal | Continuidade de contexto | Contratos mínimos e fontes de verdade compartilhadas | 13164 |
| D70 | D | Transversal | Estados e feedback | Feedback contextual por evidência com recuperação progressiva | 13462 |
| D71 | D | Transversal | Design system e acessibilidade | Design system incremental com contratos semânticos | 13702 |

## Apêndice B — Controle de integridade documental

| Verificação | Resultado |
|---|---|
| Sequência F7-UX-D01–D71 | 71 identificadores distintos, sem lacuna numérica |
| D01 | Visão livre, sem atribuição artificial de alternativa A/B/C/D |
| Decisões de alternativa | 70 escolhas A–D recuperadas |
| D30 | Posição histórica original preservada; aprovação expressa posterior à D64 |
| Decisões de F7 funcional | Série distinta, não usada para reconstruir F7-UX |
| Propostas não aprovadas | Não convertidas em requisitos por inferência |
| Conteúdo textual da transcrição | Consultado por recuperação indexada, não materializado integralmente |
| Integridade do código local | Não auditada; não se presume que `v2` remota contenha trabalho não publicado |
| Compatibilidade da futura spec com a transcrição | Deve ser conferida antes do aceite humano final |

**Nota:** denominações normatizadas como `H-01`, `S-01`, `P-01` etc. são apenas códigos de requisito desta proposta de especificação, **não** novas decisões de arquitetura e **não** substituem D01–D71. Se uma redação resumida deste documento colidir com uma condição explícita da decisão original, prevalece a fonte primária e a divergência deve ser apresentada ao usuário antes do aceite.

