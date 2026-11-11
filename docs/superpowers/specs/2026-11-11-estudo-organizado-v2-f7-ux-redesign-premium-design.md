# Estudo Organizado V2 — F7-UX
## Especificação complementar de design visual — Redesign Premium

**Versão:** 1.0 — proposta para aceite humano  
**Data:** 11/11/2026  
**Estado:** `VISUAL_DESIGN_SPEC_DRAFT_AWAITING_APPROVAL`  
**Repositório:** `matheussilva421/estudo-organizado`  
**Origem da autorização:** encerramento do brainstorming visual, aprovação expressa de DV-01–DV-18 e autorização posterior para consolidar uma especificação; não inclui autorização para implementar, planejar execução, publicar ou alterar o GitHub.  
**Relação com a documentação existente:** **aditivo** à especificação F7-UX de 05/11/2026; não a substitui.  
**Decisões vinculantes:** `F7-UX-D01–D71` + `DV-01–DV-18`, sem renumeração e sem reabertura.

> **Distinção de estados.** Decisão aprovada ≠ especificação aprovada ≠ recurso implementado ≠ teste aprovado ≠ integrado à `main` ≠ publicado/homologado. As 18 decisões visuais foram aprovadas no brainstorming; **este documento ainda é uma proposta de consolidação**. Nenhum código foi escrito por esta etapa.

---

## 1. Fontes, verificações e limites

### 1.1 Fontes utilizadas

1. **Especificação F7-UX v0.1 (05/11/2026):** [`docs/superpowers/specs/2026-11-05-estudo-organizado-v2-f7-ux-design.md`](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-11-05-estudo-organizado-v2-f7-ux-design.md). Consultada na branch remota `v2` em 11/11/2026. Possui contratos T-01–T-04, requisitos H/S/C/P/E/R/A/G, AC-01–AC-24 e matriz canônica D01–D71.
2. **Histórico de aprovações DV-01–DV-18:** decisões da conversa de redesign visual que culminaram no encerramento do brainstorming em 11/11/2026. A redação desta especificação distingue decisão efetivamente aprovada de detalhamento derivado para futura validação.
3. **Pacote de revisão humana F7-UX, 10/11/2026:** `ESTUDO-ORGANIZADO-V2-F7-UX-HUMAN-REVIEW-READY-29d35c2c.zip` disponibilizado nesta conversa/projeto. Consultados `reference/SPEC-F7-UX.md`, `DECISIONS-TRACEABILITY.md`, `GIT-STATE.md`, `INDEPENDENT-REVIEW.md`, `VISUAL-REVIEW.md`, `UX-H-CHECKLIST.md` e imagens de módulos/temas.
4. **Matriz de reutilização:** `F7-UX-REVIEW-2026-11-10.zip` → `reference/F7-UX-REUSE-MATRIX.md`. Fornece mapeamento histórico de componentes existentes; não constitui prova de estado atual.
5. **Referências visuais do brainstorming:** quatro mockups aprovados como direções cromáticas de Neon Teal, Esmeralda e Dourado, Azul e Âmbar e Azul Glacial/Prata. São **conceitos visuais**, não screenshots do produto concluído.

### 1.2 Limites da verificação

- O conector GitHub permitiu ler a especificação **remota** da branch `v2`, mas ela não necessariamente contém os commits locais mais recentes. O relatório do pacote indica um HEAD documental local `29d35c2c`, HEAD de código validado `0c31e6ef`, **94 commits locais à frente de `origin/v2@7a7df0f`**, `main@9046cfa`, sem push/merge/PR. Isso é **estado reportado no pacote**, não uma inspeção ao vivo do computador.
- A matriz histórica registra testes locais e correções; **não foram executados testes, build, diff real do workspace, inspeção de banco ou validação de navegador nesta elaboração**.
- Divergências antigas da spec-base (DR-01–DR-10) não devem ser classificadas como bugs atuais sem confronto com o HEAD local recente.
- As composições de interface e parâmetros visuais abaixo são requisitos e critérios projetados, não evidência de funcionalidade existente.

## 2. Objetivo e resultado de experiência

Substituir a percepção de um painel técnico denso por uma experiência de estudos **premium, responsiva, memorável, clara e orientada à próxima ação**, mantendo integralmente a potência funcional da F7-UX. A apresentação deve fazer o usuário perceber de imediato: **onde está, o que pode fazer agora, o que já foi comprovado e o que exige atenção**.

**Resultados esperados:**

- Conteúdo acadêmico, agenda e próxima atividade com precedência visual sobre diagnósticos técnicos não urgentes.
- Identidade consistente, com 12 temas e efeitos configuráveis, sem transformar cada tela numa repetição de cards.
- Superfícies centrais especializadas por tarefa; ferramentas avançadas disponíveis progressivamente.
- Experiência digna de uso cotidiano em desktop, tablet e celular, inclusive com dados escassos.
- Comportamento previsível, sem layout shifts durante sessão ativa e sem feedback que sugira operações não confirmadas.

**Fora de escopo desta especificação:** mudança em modelos de domínio, banco, sincronização, política de backup, autenticação, algoritmo de estudo, mecanismos de pesquisa, publicação, migração, F8, implantação, alterações em Git/GitHub, plano de implementação, GOAL ou novos serviços externos.

## 3. Hierarquia normativa e regras de compatibilidade

A ordem de autoridade para interpretação de requisitos é:

1. Texto e opções expressamente aprovadas de `D01–D71` e `DV-01–DV-18`;
2. Contratos explícitos da spec F7-UX vigente (especialmente T-01–T-04, AC-01–AC-24);
3. Decisões de F2–F7 e regras de integridade já adotadas;
4. Este detalhamento **somente quando compatível** com os itens acima;
5. Código preexistente como implementação a ser auditada, nunca como revogação automática de decisão.

**Conflitos aparentes já resolvidos:**

- **D71 × DV-01–DV-03:** conservar tokens, Shell, tipografia e oito temas existentes; **adicionar** quatro temas e controles visuais sem criar um design system concorrente.
- **D05–D06 × DV-04–DV-05:** adaptar a Home sem permitir rearranjo importante silencioso. Mudanças estruturais relevantes dependem de sugestão e aprovação; layout fixado tem precedência.
- **D24–D25/D69–D70 × DV-07/DV-08/DV-15/DV-18:** remover ruído técnico da superfície principal **não significa ocultar riscos ou provas de integridade**. Alertas críticos continuam detectáveis, persistentes e acionáveis.
- **D46 × DV-11:** Semana, Mês e Lista são visualizações principais do novo estúdio; **a vista Dia previamente prevista continua acessível**, não foi revogada.
- **D30/D60–D64 × DV-13:** a nova composição não redefine fórmulas, séries, amostras ou denominadores.
- **D33 × DV-15/DV-17:** a barra inferior mobile permanece exatamente **Início · Plano · Estudar · Revisões · Mais**; a central de comandos e os layers não a substituem.
- **D50–D54 × DV-10:** Modo Foco é **apresentação da sessão existente**, sem novo cronômetro, nova entidade, duplicação de medição ou mudança automática de rota.
- **D55–D59 × DV-12:** prioridades, políticas, início/conclusão e evidências continuam vinculados aos estados reais dos compromissos.

Em caso de incompatibilidade não resolvível, o trabalho de implementação futuro deverá registrar a evidência e submeter **apenas a nova decisão material** ao usuário, sem reinterpretar decisões silenciosamente.

## 4. Registro canônico das decisões visuais aprovadas

| DV | Opção aprovada | Requisito visual vinculante | Interseção principal com F7-UX |
|---|---|---|---|
| **DV-01** | Quatro novos temas premium | Adicionar Neon Teal, Esmeralda e Dourado, Azul e Âmbar, Azul Glacial/Prata aos oito temas anteriores; total **12**; nenhuma cor roxa obrigatória nos quatro novos | D26–D29, D71, G-01 |
| **DV-02** | Galeria de temas | Galeria em Configurações → Aparência; miniaturas representativas; aplicação imediata; persistência e indicação da seleção; reversão | D26–D29, D65, D71 |
| **DV-03** | B — Personalização avançada | Ajustes por tema de brilho/glow, movimento, densidade e aparência dos cards, com reset e acessibilidade | D27–D29, D65, D71 |
| **DV-04** | C — Dashboard contextual inteligente | Home adaptada a onboarding, estudo diário, reta final e análise de desempenho; permitir configurar, fixar ou desligar adaptação | D01–D25 |
| **DV-05** | C — Transições híbridas | Ajuste contextual de saliência/prioridades; reorganizações estruturais sugeridas e aprovadas; layout fixo e sessão ativa protegidos | D05–D06, D20–D23, D69 |
| **DV-06** | C — Hybrid Workspace Premium | Home estilo Bento com hero contextual; workspaces de Planejamento, Sessões, Revisões e Análises especializados; coerência transversal | D31–D71 |
| **DV-07** | C — Onboarding Premium Progressivo | Boas-vindas, uma ação principal e primeiros passos; substituir progressivamente instruções por dados reais sem zeros fictícios | D01, D24, D69–D70 |
| **DV-08** | C — Progressive Workspace | Hierarquia de três camadas: principal, contextual, avançada; avançados visíveis sob demanda; críticos nunca ocultos | D19–D23, D31–D36 |
| **DV-09** | C — Layered Premium | Superfícies sólidas; vidro, gradientes, sombras e glow apenas onde agregam significado; intensidade configurável | D26–D29, D71 |
| **DV-10** | C — Adaptive Focus Premium | Workspace completo + Modo Foco opcional e imersivo, usando **a mesma sessão** e os mesmos materiais/controles | D50–D54, D69 |
| **DV-11** | C — Adaptive Planning Studio | Semana, Mês e Lista integrados, preferência persistente e detalhes contextuais; Dia anterior preservado | D44–D49 |
| **DV-12** | C — Adaptive Review Studio | Fila contextual, execução focada e histórico visual auditável | D55–D59 |
| **DV-13** | C — Insights Studio Premium | Visão geral expressiva + exploração analítica profunda, gráficos e tabelas equivalentes | D30, D60–D64 |
| **DV-14** | C — Knowledge Studio Premium | Cards de visão geral, árvore navegável e painel de detalhes; suporte a editais grandes | D37–D43 |
| **DV-15** | C — Contextual Command Center | Cabeçalho discreto, busca/comandos rápidos e Central de Atenção independente, contextual e deduplicada | D31–D36, D69–D70 |
| **DV-16** | C — Settings Studio Premium | Configurações por categorias, 12 temas com galeria em destaque, áreas técnicas claramente separadas | D65–D68 |
| **DV-17** | C — Adaptive Mobile Layers | Bottom sheets para operações rápidas; telas dedicadas para operações complexas; painel lateral no desktop quando adequado | D20, D31–D34, D69–D71 |
| **DV-18** | C — Contextual Motion & Feedback | Microinterações proporcionais, feedback inline, progresso honesto, erros recuperáveis e críticos persistentes | D24–D25, D69–D71 |

**Importante:** a aprovação de uma opção não implica aprovação de valores numéricos ou decisões de baixo nível que não tenham sido deliberados. Medidas e tokens específicos serão concretizados e testados em futura etapa técnica.

## 5. Sistema visual transversal

### 5.1 Linguagem Layered Premium

- **Camada base:** superfícies opacas e estáveis, tipografia de alta legibilidade, contornos semânticos discretos e espaçamento confortável.
- **Camada expressiva:** um *hero* contextual, destaques selecionados, indicadores realmente úteis e visualização de dados com cor de acento temática.
- **Camada de interação:** estados hover/foco/seleção, transições pequenas e feedback de resultado. Animação nunca é o único meio de transmitir estado.
- **Camada de riscos:** mensagens críticas com hierarquia semântica própria, visíveis no ponto de decisão mesmo no modo de concentração ou quando a densidade estiver compacta.
- **Glassmorphism:** opcional e pontual, jamais aplicação universal. Evitar texto sobre transparências de contraste instável.

### 5.2 Hierarquia de informação

1. Título, contexto de concurso/atividade e **próxima ação primária**;
2. Conteúdo de trabalho (calendário, cronômetro, fila, árvore, gráfico);
3. Resumo de progresso real, disponibilidade, tendências e avisos não críticos;
4. Ferramentas de análise, filtros específicos, edição avançada e diagnósticos;
5. Informações técnicas detalhadas e ações protegidas, especialmente em Configurações/inspeção contextual.

Um módulo não precisa exibir indicadores quando isso compete com sua atividade. Métrica sem dados suficientes não deve virar um card «0%» ou «indisponível» repetido.

### 5.3 Progressive Workspace — três níveis

| Nível | Conteúdo típico | Comportamento |
|---|---|---|
| Principal | Ação primária, entidade de trabalho, contexto essencial | Visível sem exigir expansão; ordem de foco coerente |
| Contextual | Detalhes da seleção, filtros simples, histórico curto, materiais | Painel lateral, aba contextual, expansão ou sheet; preserva o ponto de retorno |
| Avançado | Configurações profundas, criação/edição complexa, auditoria, análise por método | Superfície apropriada à complexidade, com ações explícitas e proteção de rascunho |

O nível visual não muda a autoridade das entidades nem a validade das ações. Alertas críticos são exceção obrigatória à ocultação progressiva.

### 5.4 Tipografia e iconografia

Preservar a base F7-UX: **Plus Jakarta Sans** para texto de interface e **DM Mono** para medições/códigos quando semanticamente adequados. Usar escalas coerentes entre módulos, números tabulares para tempo e comparação e rótulos legíveis. Ícones complementam textos, sem substituí-los em ações críticas. Paleta de concurso/disciplina não deve se confundir com sucesso, advertência, conflito ou falha.

### 5.5 Temas, controles e persistência

**Oito temas originais preservados:** Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex e Plasma.

**Quatro novos temas adicionais:**

| Tema | Intenção cromática | Direção de uso |
|---|---|---|
| Neon Teal | Grafite profundo com ciano/verde-azulado | Tecnologia, luminosidade contida e foco nos indicadores |
| Esmeralda e Dourado | Verde-esmeralda profundo com dourado discreto | Sofisticação, contraste sem brilho excessivo |
| Azul e Âmbar | Azul/navy com âmbar quente | Equilíbrio entre produtividade e acolhimento |
| Azul Glacial/Prata | Azul frio e prata | Clareza, serenidade e refinamento |

**Sem tema-padrão novo imposto.** A seleção do usuário permanece soberana; preferências existentes não devem ser alteradas silenciosamente. A galeria deve ilustrar componentes representativos (superfície, texto, botão, gráfico), mostrar o tema ativo e permitir mudar e voltar com facilidade. O reset de aparência não apaga fatos acadêmicos.

Personalização por tema (DV-03): intensidade de glow (`desligado`, `sutil`, `moderado`, `alto`), animações (`desligadas`, `sutis`, `completas`), densidade (`compacta`, `confortável`, `espaçosa`) e aparência dos cards dentro do que os controles reais disponibilizarem. **Preferências explícitas e redução de movimento do sistema têm precedência** sobre efeitos expressivos; a11y não pode ser desativada por tema.

O escopo de persistência (dispositivo/perfil/sync) precisa obedecer D65–D68 e aos contratos reais; não prometer sincronização remota de preferências sem suporte comprovado.

## 6. Shell, busca e Central de Atenção — DV-15

**Composição:**

- Desktop: sidebar funcional existente, cabeçalho compacto com nome/contexto, acesso à busca/comandos e estado de atenção discreto.
- Tablet: trilho adaptativo e acesso aos mesmos destinos.
- Mobile: barra inferior **Início · Plano · Estudar · Revisões · Mais**; Conteúdo, Análises, Busca, Atenção e Configurações acessíveis pelo menu Mais, rotas e atalhos pertinentes.
- Central de comandos: abertura por controle visível ou atalho de teclado compatível, busca de resultados existentes e ações de navegação. **Não introduzir comandos mutáveis implícitos**.
- Busca global em dois níveis (D35): entrada rápida e tela aprofundada, com rótulos, filtros, identidade do item, estados de arquivamento e perfil validados.
- Atenção: lista de ocorrências causalmente deduplicadas, com gravidade e ação admissível. Não duplicar inbox na Home e em Configurações.

**Critério chave:** ausência de alertas não equivale a integridade comprovada; badge ou estado neutro não deve afirmar saúde que não foi medida. Conflitos e recuperação exigidos precisam permanecer acessíveis e perceptíveis.

## 7. Home — DV-04, DV-05, DV-06 e DV-07

### 7.1 Composição de entrada

Home Bento com **hero contextual** que prioriza a próxima ação. A área principal não exibe uma parede permanente de cards com indicadores zerados; widgets secundários seguem conforme a relevância acadêmica e a configuração escolhida. O editor de widgets, fórmulas e filtros aprovado em D02–D29 permanece acessível.

### 7.2 Quatro contextos visuais (não algoritmos novos)

| Contexto derivado de dados existentes | Conteúdo em destaque | Limite |
|---|---|---|
| Primeiro uso/sem dados | Boas-vindas, cadastrar concurso/edital, primeiros passos | Sem porcentagens inventadas ou checklist coercitivo |
| Rotina diária | Próxima sessão/atividade, agenda, revisões e meta disponível | Não criar sessão ou cumprimento automaticamente |
| Proximidade de prova / Reta Final | Prova e prazo reais, ações prioritárias e visão do planejamento vigente | Sem replanejar silenciosamente ou criar urgência artificial |
| Acompanhamento de desempenho | Gráficos e métricas rastreáveis, detalhes acessíveis | Sem tendências sobre amostra insuficiente |

O usuário pode manter modo manual, fixar widgets/layout e desligar a adaptação. **DV-05:** variações leves de prioridade podem ser automáticas; rearranjos importantes exigem sugestão e aceite. Durante sessões ativas, impedir reorganização visual inesperada.

### 7.3 Onboarding progressivo

Uma ação principal coerente com o estado da biblioteca e um roteiro pequeno e dispensável de primeiros passos. Conforme houver dados, substituir o espaço instrutivo por componentes funcionais; manter auxílio sob demanda. Não condicionar o uso dos outros módulos à conclusão do roteiro.

### 7.4 Exceções obrigatórias

Estado offline, parcial, erro de carregamento, `INSUFFICIENT_DATA`, conflito e recuperação não podem ser simulados como sucesso ou ausência de trabalho. Ocorrências críticas têm prevalência sobre a estética minimalista.

## 8. Conteúdo — DV-14 / Knowledge Studio Premium

- **Biblioteca geral:** entrada visual por concursos/editais/disciplinas, sem prometer capas ou progresso onde não existem dados.
- **Explorador:** árvore hierárquica com expansão/recolhimento e pesquisa, adequada a centenas de itens; preservar seleção e caminho atual.
- **Inspetor contextual:** hierarquia, metadados, vínculo a aulas, ações de edição/movimento/associação e estados da entidade.
- **Desktop:** biblioteca/árvore + detalhes em composição lado a lado quando houver espaço. **Mobile:** navegação por níveis e detalhe em tela dedicada para formulários complexos.
- **Semântica:** manter identidade canônica, hierarquia, IDs e vínculos; mover itens não deve criar ciclos; drag-and-drop possui alternativa por teclado; prévias de alterações relevantes e conflitos de revisão continuam necessárias.

Cards são projeções da mesma estrutura F2 — não uma biblioteca paralela.

## 9. Planejamento — DV-11 / Adaptive Planning Studio

**Visões principais:** `Semana`, `Mês` e `Lista`, com seletor claro e preferência persistente no escopo compatível. **Dia** permanece disponível por força de D46. Manter blocos sem horário, cenários, capacidade compartilhada e distinção entre Ciclo de Estudos e Reta Final.

- **Semana:** eixo cronológico quando houver horários; grupos com tratamento apropriado para blocos sem horário; foco em execução.
- **Mês:** panorama, provas, conflitos, carga e navegação entre dias, sem reduzir dados importantes a cores isoladas.
- **Lista:** fila ordenável e filtrável por contexto válido; alternativa útil para leitor de tela e espaços pequenos.
- **Painel contextual:** metas, capacidade, disciplina, sobreposição, cenários e detalhes da seleção. Não expor ações destrutivas como botões de destaque rotineiro.
- **Criação/replanejamento:** assistente e prévia de impacto; conflito/versão de base checados no commit; não aplicar sugestão sem confirmação.

**Preservar os fatos distintos:** plano criado, bloco vinculado a sessão, tempo efetivamente executado, conciliação e cumprimento verificado.

## 10. Sessões — DV-10 / Adaptive Focus Premium

### 10.1 Workspace completo

Cronômetro, contexto do estudo, disciplina, materiais e controles apropriados em um único espaço, sem competir com diagnósticos técnicos. Histórico, registro manual, pausas, recuperação e hábitos permanecem disponíveis conforme F4/F7 e D50–D54.

### 10.2 Modo Foco imersivo

- Ativação/desativação **explícita e opcional**, sem modificação automática de contexto.
- O cronômetro é a **mesma instância lógica e o mesmo registro** do Workspace completo; alternar a apresentação não faz start/stop, não cria medição duplicada e não altera modo de tempo por conta própria.
- Preservar estado de pausa, origem do tempo, interrupções, lacunas/incertezas, recuperação após reinício, vínculo com blocos e rascunhos.
- Materiais, anotações e controles essenciais permanecem disponíveis em superfície contextual.
- Alertas críticos podem interromper a apresentação visual, mas não podem ignorar proteção/autoridade da sessão.
- O modo segue tema e motion settings; não depende de efeitos luminosos ou som para funcionar.

**Aceite decisivo:** iniciar uma sessão, entrar/sair do Modo Foco, pausar e continuar sem criar segunda sessão, perder contexto ou alterar o tempo verificado por mudança de visualização.

## 11. Revisões — DV-12 / Adaptive Review Studio

Três experiências complementares:

1. **Fila:** compromissos reais, prioridade explicável, atraso, agenda e evidências de contexto. A prioridade é apresentada, não arbitrariamente reclassificada pelo layout.
2. **Execução focada:** conteúdo, materiais, anotações, avaliação e ações compatíveis com o estado atual, sem exigir navegar por cards secundários.
3. **Histórico:** linha do tempo/calendário/inspeção de revisões efetuadas, versão da política aplicada, evidência e distinção entre agendamento, início e conclusão.

Preservar os identificadores, as políticas versionadas, as regras de mudança/adiamento, os estados de início/conclusão e as proteções de importação/recuperação aprovadas em D55–D59. A UI não deve concluir compromisso ao fechar um painel ou mudar de aba.

## 12. Análises — DV-13 / Insights Studio Premium

**Visão geral:** conjunto enxuto de indicadores e gráficos relevantes com área central expressiva, período/escopo e acesso evidente à metodologia.

**Exploração:** escolher métricas, comparar disciplina/concurso/período, ampliar gráfico, trocar apresentação compatível e consultar tabela equivalente. O editor avançado de D30 não perde funcionalidade com a nova composição.

**Invariantes estatísticas:**

- Respeitar numerador, denominador, unidades, amostra mínima, versão de metodologia, proveniência e recorte.
- Não somar integralmente uma sessão compartilhada em múltiplos concursos se não houve alocação real.
- Ausência de dado não é zero; `STALE` não é atual; gráfico ilustrativo não é resultado acadêmico.
- Tabela, exportação e gráfico de mesmo escopo precisam exibir valores reconciliáveis.
- Relatórios históricos e snapshots não se confundem com backup restaurável.

Gráficos têm alternativa textual/tabular e navegação utilizável por teclado, sem depender de hover ou animação.

## 13. Configurações — DV-16 / Settings Studio Premium

**Arquitetura visual:** categorias navegáveis com painéis de trabalho apropriados. Aparência em destaque — galeria visual de 12 temas, personalização do tema selecionado, prévia e reset. Outras categorias: perfil/identidade, preferências de estudo, sincronização e conflitos, backup/restauração, armazenamento, privacidade e manutenção.

- Operações de sync/backup exibem resultados **baseados em evidência** e limitações de escopo; não misturar aprovação de preview com conclusão de restore.
- Operações destrutivas ou troca de identidade usam fluxo protegido (inventário, prévia quando pertinente, confirmação explícita, read-back onde exigido).
- Diagnósticos detalhados são acessíveis aqui ou via Atenção contextual, mas não ocupam permanentemente o cabeçalho de todos os módulos.
- Tema/densidade/glow não alteram conteúdos acadêmicos, outbox ou bancos; a proteção de dados independe de alterações cosméticas.

## 14. Mobile e transições — DV-17

| Necessidade | Composição preferencial | Exigência |
|---|---|---|
| Filtro ou detalhe breve | Bottom sheet | Abrir/fechar com foco gerenciado e contexto preservado |
| Consulta intermediária | Sheet expansível ou view contextual apropriada | Não impedir leitura nem interação principal |
| Criar/editar cenário, bloco ou conteúdo extenso | Tela dedicada | Validação inline, retorno protegido, sem formulário espremido |
| Recuperar/alterar dados sensíveis | Tela dedicada com prévia | Confirmação e integridade sem atalhos arriscados |
| Inspeção contextual em desktop | Painel lateral | Não desviar o usuário de sua entidade principal |

O uso de sheets/telas deve funcionar nos viewports da F7-UX, incluindo **320 px e 390 px**, zoom e navegação por teclado. A barra inferior D33 permanece acessível sem ocultar a única via para recuperação crítica. Mudança de viewport ou rotação não apaga seleções, rascunhos ou sessões.

## 15. Feedback e estados semânticos — DV-18

### 15.1 Feedback por gravidade

| Ocorrência | Tratamento visual | Condição de verdade |
|---|---|---|
| Selecionar, expandir, navegar | Destaque e microinteração sutil | Indicar somente o novo foco/seleção |
| Persistência local comprovada | Confirmação inline e/ou discreta | Informar explicitamente **local**, não «sincronizado» |
| Operação assíncrona | Spinner/progresso ou indeterminado | Não simular porcentagem sem medição |
| Validação simples | Mensagem próxima ao campo com correção | Preservar input válido e estado do formulário |
| Falha recuperável | Contexto + ação admissível, sem bombardeio de toasts | Não classificar automaticamente como corrupção |
| Conflito, risco de perda, restauração bloqueada | Alerta persistente, acessível e contextual | Sem dismiss que equivalha a resolver o evento |
| ACK remoto específico | Indicar operação confirmada e escopo | Não alegar convergência do conjunto |
| Backup parcialmente validado | Informar limites de cobertura | Não chamar de «restaurável» sem prova |

### 15.2 Semântica obrigatória de integração

`LOCAL_COMMITTED`, `PENDING`, `ACK` válido, `CONFLICT`, `PARTIAL`, `STALE`, `INSUFFICIENT_DATA`, `REBASELINE_REQUIRED`, `BLOCKED_UPGRADE`, `QUOTA`, `ABORT` e `UNAVAILABLE` seguem exatamente a semântica definida na spec-base T-03. Nem ícone verde nem animação de sucesso substituem a evidência técnica necessária.

As mensagens devem ser assistivas, com `aria-live` apropriado para notificações não críticas e foco controlado para diálogos/alertas críticos; reduzir movimento conforme preferência e sistema. Não usar cor isoladamente.

## 16. Acessibilidade, desempenho e respeito ao dispositivo

- **Referencial técnico de aceitação proposto:** WCAG 2.2 nível AA, sem revogar critérios existentes. Verificar contraste, foco visível, nomes acessíveis, semântica de controles, sequência de leitura, teclado e leitor de tela. Trata-se de critério verificável de detalhamento, não afirmação de conformidade atual.
- **Mobile:** garantir alvos operáveis, zoom até 200% ou mais quando pertinente, 320 px sem truncar ações essenciais, e evitar que painel/sheet encubra conteúdo crítico. Os links que o relatório prévio marcou com área de toque insuficiente permanecem pontos de atenção.
- **Movimento:** `prefers-reduced-motion`, opção de desligar animações da DV-03, sem efeitos contínuos obrigatórios no cronômetro; evitar rearranjos inesperados da Home.
- **Cores:** tokens semânticos de ação/estado separados dos acentos de concurso e tema; gráficos não dependerão apenas da cor e terão alternativa tabular.
- **Desempenho:** transições cosméticas não podem degradar responsividade de cronômetro, edição, navegação ou uso offline; reduzir transparências/blur em dispositivos limitados. Não há orçamento numérico de FPS/latência aprovado nesta etapa; medir antes de estabelecer limites.
- **Persistência:** troca de tema e preferência de visualização não devem tocar dados acadêmicos nem provocar migração de esquema.
- **Segurança:** preservação de guardas de rascunho, confirmação e recuperação, incluindo trocas de tela e Modo Foco.

## 17. Critérios de aceite visual — extensões à AC-01–AC-24

Os IDs `VA-xx` abaixo são **nova matriz de rastreabilidade visual proposta** para testes futuros. Não renumeram nem substituem `AC-01–AC-24`, UX-01–UX-31 ou D01–D71. **Nenhum teste VA foi executado nesta especificação.**

| ID | Critério demonstrável | Fonte DV | Evidência futura sugerida |
|---|---|---|---|
| VA-01 | Oito temas originais mantêm funcionalidade e identidade | 01, 02 | Comparativo antes/depois em viewports representativos |
| VA-02 | Quatro temas adicionais existem, são selecionáveis e visualmente distintos | 01, 02 | Galeria e screenshots dos 12 temas |
| VA-03 | Troca de tema não recarrega nem perde sessão/rascunho; preferência restaurada | 02, 03 | E2E persistência + estado de sessão |
| VA-04 | Glow, movimento, densidade e aparência configuráveis/respeitados | 03, 09 | Matriz de configurações e motion reduzido |
| VA-05 | Home sem dados apresenta ação primária e primeiros passos, sem métricas falsas | 04, 07 | Fixture vazia desktop/mobile |
| VA-06 | Contextos diário/reta final/desempenho exibem projeções corretas | 04 | Fixtures sintéticas com dados cruzados |
| VA-07 | Mudança importante de layout solicita aceite; layout fixado e sessão ativa não mudam sozinhos | 05 | Teste de transição de contexto |
| VA-08 | Home e módulos diferem funcionalmente em composição sem perder linguagem visual | 06, 08, 09 | Capturas e checklist por área |
| VA-09 | Funções avançadas são acessíveis sem sobrecarregar a superfície principal | 08 | Fluxos por teclado e toque |
| VA-10 | Modo Foco usa sessão única; pausas/retorno não duplicam tempo | 10 | E2E com relógio controlado e read-back |
| VA-11 | Planejamento alterna Semana/Mês/Lista e mantém Dia acessível e preferência | 11 | E2E com blocos com/sem horário |
| VA-12 | Revisões exibem fila, execução e histórico sem transições indevidas de estado | 12 | E2E de compromisso e política |
| VA-13 | Analytics tem visão geral + drill-down, tabela e amostra/metodologia consistentes | 13 | Mesmo dataset: gráfico vs tabela |
| VA-14 | Conteúdo tem biblioteca, árvore e inspetor, utilizáveis com edital grande | 14 | Fixture hierárquica volumosa e teste a11y |
| VA-15 | Busca/Command Center navegam para ID correto e devolvem contexto; Atenção deduplica | 15 | E2E de deep link, perfil e estados críticos |
| VA-16 | Configurações isolam Aparência de operações protegidas e exibem 12 temas | 16 | Fluxos de navegação sem disparar mutação |
| VA-17 | Bottom sheets e telas completas funcionam em 320/390 px, zoom e teclado | 17 | Captura, foco, Escape/voltar, rascunho |
| VA-18 | Feedback local/ACK/convergência/backup respeita níveis de comprovação | 18 | Fixtures de estados T-03 |
| VA-19 | Alertas críticos são percebidos mesmo em Foco, densidade compacta ou tela pequena | 08, 10, 17, 18 | Teste de conflito/recuperação |
| VA-20 | Contraste/foco/motion reduzido e navegação D33 preservados nos 12 temas | 01–03, 17–18 | Testes automatizados + avaliação manual assistiva |

### Matriz de viewports e estados

A futura homologação deve cobrir, no mínimo, **desktop, tablet, mobile 390 px e mobile 320 px**, nos estados pertinentes: vazio, carregando, dados reais, insuficiente, offline, parcial, erro, conflito, recuperação e sessão ativa. A abrangência por tema não exige repetir cegamente todos os cenários em todos os temas: usar cobertura semântica apropriada e registrar exclusões, garantindo pelo menos a galeria e regressões críticas nos 12.

## 18. Confronto com a F7-UX já desenvolvida

| Capacidade no material de referência | Natureza da mudança visual aprovada | Classificação nesta especificação |
|---|---|---|
| 8 temas existentes, tokens e fontes | +4 temas, galeria, ajustes e profundidade seletiva | **Extensão de apresentação**; conservar infraestrutura |
| Home/widgets/filtros e estados | Hero contextual, onboarding premium e organização dinâmica controlada | **Recomposição visual**, mesmos fatos e contratos |
| Shell e Busca/Atenção | Command Center + cabeçalho limpo; manter navegação D33 | **Recomposição e interação** sem criar roteador/índice novos |
| Conteúdo e árvore | Biblioteca visual + explorador + inspetor | **Recomposição** com reuso de CRUD e hierarquia |
| Planejamento e calendários | Semana/Mês/Lista em estúdio, Dia mantido, preferência | **Apresentação/navegação**; nenhum novo motor |
| Sessões, Pomodoro, histórico, emergência | Modo Foco imersivo opcional sobre a sessão existente | **Nova apresentação**, sem novo domínio/clock |
| Revisões e política versionada | Fila/execução/histórico em estúdio visual | **Recomposição**; estados preservados |
| Analytics e projeções | Visão geral mais explorador, legibilidade de gráficos | **Recomposição**; metodologia inalterada |
| Configurações, sync e backup | Settings Studio com Aparência em destaque | **Reorganização**; segurança mantida |
| Feedback de saúde/integridade | Feedback visual proporcional e contextual | **Semântica idêntica**, apresentação aprimorada |

### 18.1 Observações do baseline visual revisado

Os screenshots do pacote de revisão humana mostram superfícies predominantemente técnicas, repetição de containers retangulares, estados de persistência no topo de várias telas e muitos controles no primeiro nível. Essa observação é **visual e contextual**, não conclusão de falha funcional. O redesenho aprovado deve reduzir esse peso visual sem esconder evidência crítica ou remover operações.

O relatório anterior também documenta pendências P2 (entre outras: áreas de toque pequenas em quatro links da Home, mensagens de conflito entre abas, alguns detalhes de prévias/foco, cobertura manual de leitores de tela/hardware). A mudança premium **não autoriza ignorá-las**, tampouco permite declarar que foram resolvidas sem prova nova.

### 18.2 Itens que não se devem duplicar

Não criar um segundo Shell, roteador, repositório local, sincronizador, outbox, mecanismo de recuperação, motor de planejamento, parser arbitrário de fórmulas, relógio de sessão ou design system universal. Reutilizar os componentes e serviços existentes onde o estado real do código permitir; projetar interfaces no nível de apresentação. Preservar o trabalho local ainda não publicado.

## 19. Riscos, gates e não objetivos

**Riscos materiais a controlar posteriormente:**

- `R-V01`: adaptação automática causar mudança inesperada de layout ou perda de foco;
- `R-V02`: visual premium mascarar o estado real de persistência/sync/backup;
- `R-V03`: efeitos de vidro/iluminação comprometerem contraste, desempenho ou movimento reduzido;
- `R-V04`: Modo Foco duplicar medição/entidade por implementação equivocada;
- `R-V05`: 12 temas multiplicarem inconsistências de tokens, acessibilidade e manutenção;
- `R-V06`: composição mobile esconder ações críticas ou rascunhos;
- `R-V07`: reescrever componentes já testados e gerar regressão funcional;
- `R-V08`: tratar o HEAD remoto como equivalente ao HEAD local e perder trabalho não publicado.

**Gates existentes permanecem:** aceite humano da especificação, diagnóstico Git completo antes de código, testes locais reais, revisão independente, validação visual humana, gates externos G-EXT/G-STAGING e integração autorizada. Sync real, deploy e cutover F8 **não** são liberados por este documento. Proibidos resets destrutivos, force push, PRs/branches/Actions sem necessidade e autorização, conforme as regras de gestão do projeto.

## 20. Aprovação e próximo marco

**Conclusão da consolidação:** as decisões DV-01–DV-18 são coerentes entre si e compatíveis com D01–D71 **sob as interpretações explícitas do §3**. Não foi identificada lacuna material que imponha DV-19. Os detalhamentos restantes — valores de token, medidas, limites de animação, comportamento pontual de componentes e custos de renderização — podem ser tratados na fase técnica mediante testes, sem nova decisão arquitetural automática.

**Estado de entrega do documento:** `PROPOSTA_PARA_ACEITE_HUMANO`. O usuário autorizou **redigir esta especificação**, mas ainda não aprovou o texto final. Após aceite expresso, o passo natural seria derivar um plano de implementação ancorado no HEAD real, com inventário Git e revisão das pendências; **isso não foi feito agora**.

**Alterações nesta etapa:** nenhum código, repositório, commit, branch, PR, Action, plano, GOAL, teste, deploy ou banco de dados foi modificado.

---

## Apêndice A — Referências visuais incluídas no pacote complementar

Os quatro arquivos abaixo são *mockups conceituais* preservados como material de referência; **não** definem por si só o layout pixel-perfect, dados, estados ou funcionalidades finais:

- [`referencias-visuais/neon-teal.png`](referencias-visuais/neon-teal.png)
- [`referencias-visuais/esmeralda-dourado.png`](referencias-visuais/esmeralda-dourado.png)
- [`referencias-visuais/azul-ambar.png`](referencias-visuais/azul-ambar.png)
- [`referencias-visuais/azul-glacial-prata.png`](referencias-visuais/azul-glacial-prata.png)

Como referência de **baseline anterior** (não exemplo do estilo aprovado), o pacote inclui `referencias-visuais/f7-ux-baseline-comparativo.jpg`, montagem das capturas revisadas. Links relativos deste apêndice funcionam dentro do ZIP da entrega; o `.md` isolado é a versão textual autossuficiente.
