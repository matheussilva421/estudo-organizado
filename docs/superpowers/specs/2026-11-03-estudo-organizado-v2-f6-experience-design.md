# Estudo Organizado V2 — F6: Experiência Integrada
## Especificação formal de arquitetura e aceitação — Superpowers

**Data de elaboração:** 2026-11-03  
**Estado deste artefato:** `F6_SPEC_APPROVED` — aprovada expressamente pelo proprietário em 2026-11-03 (decisões D-F6-01 a D-F6-22, todas B).  
**Autoridade de origem:** decisões arquiteturais **D-F6-01 a D-F6-22**, todas aprovadas na **opção B**, e consolidação arquitetural aprovada pelo proprietário em 2026-11-03.  
**Repositório de referência:** [`matheussilva421/estudo-organizado`](https://github.com/matheussilva421/estudo-organizado), branch `v2`, HEAD remoto consultado `339eae5eca5460b4c6a7ff8d5705429b82ec8cc3`.  
**Produto V1:** branch `main`, preservada; último HEAD indicado no roadmap/aceite F5: `9046cfa` (não foi objeto de novo diagnóstico Git completo).  
**F5:** `F5_ACCEPTED_WITH_RESERVATIONS`, código candidato `c358928749951b5848217040762af2785fffae8b`.  
**Escopo de autorização:** especificação aprovada e publicação documental autorizada na `v2`. A implementação ocorrerá exclusivamente após a invocação do GOAL no Codex; `main`, deploy, migração produtiva e F7/F8 permanecem vedados.

> **Nota de precedência:** o documento histórico [`2026-10-28-estudo-organizado-v2-f6-experience-design.md`](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f6-experience-design.md) permanece como **proposta não aprovada** no repositório. Esta minuta formaliza as decisões posteriores D-F6-01–22, sem afirmar que substituição, commit ou aprovação desta nova spec já ocorreram. Se houver conflito com o documento histórico em matéria de escopo, prevalecem as decisões humanas aprovadas e as fronteiras estabelecidas na spec-mestra/roadmap. A validação desta minuta é um gate distinto.

---

## 1. Finalidade, resultados e escopo

### 1.1 Objetivo

Consolidar os domínios acadêmicos F2 (editais/conteúdo), F3 (planejamento), F4 (execução/sessões) e F5 (revisões/inteligência) em **uma experiência web/PWA V2 coesa, rápida, acessível, explicável e local-first**, em React + TypeScript + Vite, sem duplicar fontes de verdade, serviços ou módulos funcionais. Preservar a identidade visual V1, com evolução controlada por Impeccable A-01.

**Resultados observáveis esperados:** (i) saber o próximo estudo ou a sessão a continuar; (ii) localizar qualquer registro permitido; (iii) navegar e editar sem perder trabalho; (iv) entender o que foi salvo localmente, o que está indisponível remotamente e o que não possui backup verificado; (v) consultar indicadores conciliados; (vi) usar desktop, tablet e celular com operações essenciais equivalentes; (vii) manter oito temas acessíveis; e (viii) regressões F2–F5 controladas por evidência.

### 1.2 Dez capacidades obrigatórias, sem subsistemas paralelos

| ID F0 original | Capacidade F6 | Escopo de resultado |
|---|---|---|
| `F-V1-APP-SHELL` | Shell integrado | Navegação modular, rotas tipadas, menus, diálogos e feedback consistentes |
| `F-V1-LEGACY-FACADES` | Compatibilidade de interfaces F2–F5 | Adaptação mínima; V2 não depender de `window.EstudoApp` nem importar a implementação V1 |
| `F-V1-HOME-DASHBOARD` | Home operacional | Próxima ação, sessão ativa, compromissos, revisões, atenção e indicadores contextuais |
| `F-V1-ANALYTICS-DASHBOARD` | Analytics | Projeções conciliadas, séries e comparações explicáveis, acessíveis e sem dupla contagem |
| `F-V1-GLOBAL-SEARCH` | Busca global | Busca local, Unicode, perfil/escopo, classificação e abertura da entidade |
| `F-V1-NOTIFICATIONS` | Centro local de atenção | Pendências acadêmicas, feedback operacional e integridade; permissões externas opt-in |
| `F-V1-CONFIG-PREFERENCES` | Configurações | Preferências por responsabilidade; integridade/estados remotos honestos; restauração de padrões |
| `F-V1-THEMES` | Oito temas | Identidade PRODUCT/DESIGN preservada; tokens unificados, mudança confiável |
| `F-V1-ACCESSIBILITY` | Acessibilidade | WCAG AA aplicável, teclado, foco, leitores de tela, touch, zoom e movimento reduzido |
| `F-V1-SKELETON-LOADING` | Estados de interface | Loading/vazio/erro/stale/salvamento/conflito corretos e sem falsas confirmações |

### 1.3 Fronteiras e exclusões

- **F6 inclui:** apresentação integrada; interfaces para ler estados e usar comandos já suportados; pequenas adaptações necessárias de contratos, rotas e persistência de preferências/rascunhos seguros, quando fundamentadas na jornada e nos serviços existentes; testes da experiência e regressões.
- **F7 reserva:** Google Sign-In, Firebase Auth/Firestore Spark real, Rules, vínculo de UID, sync automática após opt-in, `REMOTE_COMMITTED` e `CONVERGED` comprovados, divergências entre dispositivos, ensaios de migração V1, backup/restore real, PWA integrada, segurança e piloto.
- **F8 reserva:** gate G5, migração/cutover produtivo, alteração da `main` ou do deploy, rollback/contingência de produção e estabilização. O roadmap vigente governa as atribuições finais.
- **Fora F6:** construtor livre de dashboards/layouts; `F-V1-VISUAL-LAYOUT-LAB` ainda `UNDECIDED`; motor novo de analytics/IA/predição de aprovação; serviços pagos, segundo banco canônico, novo peer de sync, app nativo, backend próprio, reescrita de F2–F5, migração/limpeza de acervo V1, mecanismos novos de push com PWA fechado, sistema universal de workflows e instalação de CI/CD/Actions.
- **Regra de contenção:** contratos transversais D-F6-09–21 qualificam as dez capacidades; não autorizam automaticamente novos produtos, novos serviços ou novas bibliotecas. Ante risco ou mudança arquitetural material, submeter decisão humana específica.

## 2. Bases normativas e estado conhecido

1. [Spec-mestra V2](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-19-estudo-organizado-v2-design.md) — invariantes, stack, A-01 e A-02, fronteiras de domínio e gates.
2. [Roadmap V2](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/v2/ROADMAP.md) — capacidades, F6–F8, pendências e estados históricos.
3. [Proposta F6 de 2026-10-28](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f6-experience-design.md) — inventário de dez funcionalidades e requisitos anteriores; **status histórico não aprovado**.
4. [Aceite F5](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/audits/2026-11-02-v2-f5-acceptance.md) e [spec F5](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-11-01-estudo-organizado-v2-f5-reviews-design.md) — contratos de revisão, projeções, concorrência, dados parciais e ressalvas.
5. [`PRODUCT.md`](https://github.com/matheussilva421/estudo-organizado/blob/v2/PRODUCT.md), [`DESIGN.md`](https://github.com/matheussilva421/estudo-organizado/blob/v2/DESIGN.md) e `.impeccable/` existentes — fontes **read-only** da identidade V1 durante este gate.
6. Decisões de conversa D-F6-01–22, todas B, aprovadas expressamente; esta especificação não inventa novas decisões aprovadas.

**Baseline reportado pela F5, não reexecutado nesta redação:** typecheck/lint/build PASS; 520 testes unitários PASS; 115 E2E (114 PASS + 1 skip); bundle 540,10 kB, 150,21 kB gzip e aviso de chunk >500 kB; carga sintética de 300 assuntos/3.000 execuções em ~20,5 ms e +6,3 MiB heap. Sem validação real de hardware modesto. Não extrapolar esses números para a F6.

**Ressalvas herdadas:** quatro HIGH da F0 `UNVERIFIED` (`R-V1-LEGACY-REMOTE-PLAN`, `R-V1-FIRESTORE-DOCUMENT-1MIB`, `R-V1-MULTITAB-OUTBOX-RACE`, `R-V1-BACKUP-TOMBSTONE-LOSS`); F4-T13 `NOT_RUN`; F4 `INCOMING` parcial; F5 com ressalvas de evidenciação e desempenho; três PNGs F4 anteriormente regeneradas sem recuperação dos bytes locais originais, com conjunto posterior de preservação verificado; trabalhos Git/refs/worktrees exclusivos preservados. Nenhum desses estados será alterado por inferência na F6.

## 3. Arquitetura e responsabilidades

### 3.1 Fronteiras de dependência

`Presentation (React/PWA, F6) → Application commands/queries → Domain contracts F2–F5 → Repository/Clock/ID ports → IndexedDB adapters`. Serviços remotos apenas por portas existentes, sem ativação real F7. O domínio não importa React; a apresentação não abre transações acadêmicas nem escreve diretamente na base canônica.

O shell F6 e os componentes de apresentação podem compartilhar contratos de *view model* tipados para dados, navegação, feedback, preferências e consultas, desde que não se convertam em um repositório paralelo de entidades editáveis. A UI observa **resultados dos serviços**, não calcula fatos acadêmicos autoritativos.

### 3.2 Responsabilidade dos módulos

- **F2 Conteúdo:** autoriza identidade, hierarquia, vínculos e estados de edital/disciplina/assunto/aula. F6 apresenta, navega e busca.
- **F3 Planejamento:** autoriza compromissos, calendário, período, prioridade persistida, capacidade e replanejamento. F6 consulta intervalos e apresenta prazos.
- **F4 Execução:** autoriza sessão, cronômetro, intervalos, alocações e medições. F6 não cria relógio paralelo nem fatos de questões.
- **F5 Revisões:** autoriza sugestões, compromissos, execução, políticas, projeções, tendências, banca e lembretes. F6 não refaz motor temporal nem rankeamento.
- **F6 Experiência:** layout, rotas, contexto, componentes compartilhados, visualizações derivadas, feedback, busca, orientações e preferências semânticas.

### 3.3 Estados e invariantes transversais

**I-F6-01:** Uma fonte canônica de cada fato; caches, índices e gráficos são descartáveis/reconstruíveis.  
**I-F6-02:** Nenhum comando de escrita ocorre por simples renderização, montagem, filtro, navegação, leitura, busca, geração de sugestão ou mudança visual.  
**I-F6-03:** Uma operação só é anunciada como salva localmente após confirmação transacional; sucesso remoto e convergência exigem provas distintas.  
**I-F6-04:** Toda consulta, cache, rascunho, rota e notificação respeita o perfil e contexto ativos; resposta antiga não é publicada em novo contexto.  
**I-F6-05:** A mesma entrada canônica/política/escopo/versão gera a mesma projeção e ordenação; em caso de insuficiência, sinalizar em vez de inventar.  
**I-F6-06:** Trocar tela, tema, zoom, viewport ou abrir painel não altera sessão F4 nem elimina edição não confirmada.  
**I-F6-07:** `ReviewSuggestion != ReviewCommitment != ReviewExecution`; revisão não cria automaticamente tempo F4 nem questões; mesmo fato compartilhado não duplica total global.  
**I-F6-08:** Acessibilidade, privacidade, preservação de dados e estados verdadeiros têm precedência sobre refinamento visual.  
**I-F6-09:** V1 e produção intocadas; F7/F8 não são antecipadas.  
**I-F6-10:** Erros, `STALE`, `INCOMING`, `INSUFFICIENT_DATA`, ausência e zero são categorias distintas, não máscaras de uma mesma informação.

## 4. Contrato de navegação, shell e contexto — D-F6-01/04/09/17/20

**RF-F6-01:** Shell modular único; desktop com navegação lateral, tablet com composição compacta e celular com navegação inferior das ações frequentes, mantendo destinos restantes acessíveis. Não pressupor seis menus fixos para a jornada `Organizar → Planejar → Estudar → Revisar → Analisar → Configurar`.

**RF-F6-02:** Rotas tipadas e estáveis para módulos/entidades permitidas. Estrutura física e escolha de router são detalhes técnicos subordinados à validação de deploy/PWA. Navegação por link direto, favorito, reload e Voltar/Avançar preserva destino e contexto válido; nenhum link executa comando acadêmico automaticamente.

**RF-F6-03:** A URL carrega só identidade/navegação e parâmetros autorizados. Não inclui rascunhos, tokens, credenciais, payloads sensíveis ou estado total do app. Rota não é autorização: validar perfil, identidade, existência, tombstone e permissão antes de renderizar. Registro inexistente/arquivado/inacessível recebe estado seguro; sem substituição silenciosa por outro.

**RF-F6-04:** Contexto compartilhado: perfil e edital em foco; filtros por área pertencem às próprias áreas. Troca de foco visual não altera edital principal nem cria operações acadêmicas. Alertas de pendências relevantes fora do filtro continuam acessíveis, sem vazamento entre perfis.

**RF-F6-05:** Navegação interna e browser history respeitam proteção de edição: preservar rascunho de forma comprovada, continuar editando ou descartar por intenção explícita; evitar loops de bloqueio. Ao abrir resultado de busca, expandir contexto hierárquico por IDs estáveis, não por índices visuais.

**RF-F6-06:** Reorganização responsiva considera largura do contêiner e características de entrada; não depender de user-agent. Mesmas operações essenciais disponíveis no desktop, tablet e celular. Zoom, orientação e teclado virtual não encobrem comandos; tabelas largas podem ter rolagem contida/acessível, sem rolagem horizontal generalizada.

**RF-F6-07:** Integração dos módulos F2–F5 mediante adaptadores mínimos; a V2 não depende de `window.EstudoApp`. Compatibilidade com eventuais rotas anteriores requer mapeamento comprovado e sem exposição de dados V1. Não manter duas implementações completas de módulo.

## 5. Home, onboarding, prioridades e personalização — D-F6-02/16/19/21

**RF-F6-08:** Home coloca sessão ativa/próxima ação válida em região protegida e exibe compromissos F3, revisões F5 e indicadores derivados F2–F5. A distinção `PLANEJADO / EXECUTADO / SUGERIDO` será perceptível. A Home não grava nada por leitura.

**RF-F6-09:** Uma prioridade tem categoria e motivo rastreável. Separar sessão ativa, alerta de integridade, compromisso confirmado, atraso real, revisão pendente, atividade futura e sugestão facultativa. Critérios temporais F3/F5 e desempates estáveis; falta de dado relevante implica ordenação neutra/explicação de insuficiência, não score inventado.

**RF-F6-10:** Compromissos fora do edital em foco não podem ser ocultados silenciosamente quando relevantes à jornada. Itens compartilhados permanecem canônicos; não somar subtotais filtrados como total global se houver sobreposição.

**RF-F6-11:** Modos contextuais predefinidos — `Rotina diária`, `Reta final` e `Acompanhamento de desempenho` — alteram somente a apresentação, nunca cronograma, política de revisão, prioridades persistidas ou fatos. Transição de modo por decisão explícita; sugestão contextual não é automatismo.

**RF-F6-12:** Indicadores secundários selecionáveis/ordenáveis em catálogo limitado, por comandos acessíveis, com restauração do padrão. Sessão ativa, avisos de falha e acesso às prioridades permanecem protegidos. Sem editor drag-and-drop universal.

**RF-F6-13:** Onboarding contextual não obrigatório. Estados: perfil/escopo sem edital, edital sem planejamento, planejamento sem sessões, sem questões, sem revisões pendentes, filtros sem resultados, dados existentes e erro técnico. Quem já possui dados acessa jornada sem reconfiguração. Estado de erro não pode ser interpretado como cadastro vazio; orientação descartada não remove alerta real.

## 6. Projeções, analytics e gráficos — D-F6-03/11/15/18

**RF-F6-14:** Indicadores e séries só consomem projeções de serviços/casos de uso. Fatos F4 (`StudySession`, `SessionAllocation`, `StudyMeasurement`), planos F3, revisões F5 e relações F2 são conciliados. Não contar uma sessão compartilhada duas vezes; revisões não inventam tempo/questões; atividades planejadas não equivalem a estudo realizado.

**RF-F6-15:** Todo indicador tem definição, unidade, período/granularidade, escopo/perfil/edital/disciplina, origem/fingerprint ou revisão, denominador/amostra quando aplicável e estado de validade. Diferenciar zero, ausência, não aplicável, insuficiência, resultado incompleto e `STALE`. Projeções afetadas por `INCOMING` parcial F4 ficam diagnósticas, sem afirmar conciliação integral.

**RF-F6-16:** Comparações entre períodos, disciplinas e editais utilizam bases compatíveis; percentuais com denominador visível; amostra pequena com ressalva; nenhuma previsão causal/de aprovação. Subtotais por edital com vínculos comuns podem não ser aditivos, e a interface o informa.

**RF-F6-17:** Catálogo reduzido de visualizações semânticas (série temporal, barras comparativas, progresso por disciplina, distribuição por estado, tabela detalhada, resumo), escolhidas conforme o dado. Valores acessíveis também em tabela/texto; nenhuma informação indispensável apenas por cor ou hover. Não introduzir mecanismo independente de métricas.

**RF-F6-18:** Cache de projeções e gráficos é não autoritativo, por perfil/escopo/versão e invalidado por dependências reais em edit/delete/restore, conflito, revisão e alteração de política. Descartar respostas obsoletas; `STALE` não é dado atualizado; geração parcial não recebe status READY. Reutilizar o cache F5 `review_projections` quando aplicável, sem segunda fonte de prioridade.

## 7. Busca global e consultas incrementais — D-F6-05/11/17/18

**RF-F6-19:** Busca local offline nas entidades F2–F5 autorizadas pelo perfil (editais, disciplinas, assuntos/aulas, planos, sessões e revisões quando suportados); índice regenerável e leve, sem serviço remoto. Normalizar Unicode/acentos de maneira previsível sem alterar identidade; apresentar tipo, origem, contexto, resultado limitado/paginado e relevância explicável.

**RF-F6-20:** Indexação e renderização não executam markup importado. Texto HTML-like não confiável é escapado/renderizado como texto; não incluir segredos ou dados cruzados. Trocar perfil invalida resultados e respostas pendentes.

**RF-F6-21:** A busca encontra registro não expandido/não renderizado. Ao selecionar, recuperar hierarquia e navegar mediante IDs, validando perfil e tombstone. Busca não se limita ao DOM visível.

**RF-F6-22:** Árvores de edital por expansão progressiva; calendário por intervalo visível incluindo atividades sobrepostas; listas de sessões/revisões com filtros, paginação e desempate estável. Consultas indexadas/limitadas quando houver suporte; virtualização apenas se medição justificar, preservando foco, teclado e semântica. Não criar índices persistentes redundantes por padrão.

## 8. Central de atenção, integridade e estados — D-F6-06/10/14

**RF-F6-23:** Centro local de atenção unifica pendências F3/F5, avisos de integridade e feedback de operação. Distinguir aviso transitório, pendência acadêmica, conflito/risco de dados e notificação externa. Deduplicar sem alterar compromissos; dispensa de aviso não conclui tarefa/revisão.

**RF-F6-24:** Reutilizar preferências, silêncio e lease multiaba de notificações F5 quando compatíveis; Notification API só opt-in e com permissões verificadas. Não prometer push, alarmes com a PWA fechada ou serviço remoto antes de F7. Falha de permissão deve degradar para a central local.

**RF-F6-25:** Contrato semântico comum para `LOADING`, `EMPTY`, `PENDING`, `LOCAL_COMMITTED`, `FAILED`, `CONFLICT`, `STALE`, `UNAVAILABLE` e estados específicos de cada domínio; traduções acessíveis, feedback no contexto e toasts não bloqueantes. A categoria não substitui códigos reais dos serviços.

**RF-F6-26:** Integridade em três dimensões: **(a)** armazenamento/commit local, **(b)** status remoto somente com prova do adaptador F7, **(c)** backup/recuperação somente com prova técnica. Sem mensagem genérica “tudo sincronizado”; outbox não prova ACK remoto; rede online não prova convergência; armazenamento local não prova backup. Na F6 remotos indisponíveis/não verificados, se assim estiverem.

**RF-F6-27:** Falha de quota/aborto/bloqueio IDB não é sucesso e não descarta edição recuperável. Conflito multiaba impede overwrite silencioso. Central de integridade oferece leitura/diagnóstico e ações **já suportadas**, nunca limpeza/reconstrução/restore destrutivo automático.

## 9. Configurações, temas e acessibilidade — D-F6-07/08/09/10/16

**RF-F6-28:** Separar preferências por dispositivo (tema, densidade e apresentação), por perfil acadêmico (quando contratadas) e estado transitório. Persistência confiável, validação de valores, versionamento compatível, controle de concorrência e restauração de padrão sem excluir fatos. Sync de preferências entre dispositivos somente F7 se contratado.

**RF-F6-29:** Preservar os oito temas nomeados: **Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex e Plasma**. Preservar alto sinal/densidade hierárquica, steel-blue (`#8aa4bf` como referência da identidade, não imposição para todos os tokens), Plus Jakarta Sans em prosa e DM Mono em números/medidas. Evitar template SaaS genérico e sistema de design duplicado. `PRODUCT.md`, `DESIGN.md` e `.impeccable/` são fontes protegidas.

**RF-F6-30:** Contraste WCAG AA aplicável em todos os temas e estados; foco visível, skip links, landmarks, nomes/erros semânticos, leitores de tela, teclado, touch >=44 px em coarse, `prefers-reduced-motion`, orientação, zoom e teclado virtual. Gráficos e cores nunca únicos meios de informação. Verificação automatizada não substitui ensaio manual.

**RF-F6-31:** Componentes compartilhados para layout, card, modal, confirmação, campos, tabelas, gráficos, combobox, alertas, skeleton e estados; reuso prioritário da F1–F5. A ferramenta Impeccable A-01 serve a desenho/QA, não é dependência runtime. Disponibilidade, versão, hooks e telemetria precisam ser examinados antes de comandos que alterem arquivos; não presumir instalação ou capacidade.

## 10. Continuidade, rascunhos, compatibilidade e PWA — D-F6-13/17/20

**RF-F6-32:** Três camadas distintas: estado editável em tela; **rascunho recuperável não autoritativo** quando houver risco justificado; e comando acadêmico confirmado via F2–F5. Rascunho possui pelo menos vínculo de perfil/entidade, versão de origem e status de persistência. Formulários de maior risco devem oferecer retomada, sem prometer recuperação de edições jamais persistidas.

**RF-F6-33:** Navegar, recarregar, trocar tema, viewport ou módulo não elimina alterações sem alerta/proteção apropriada. Guardas internos respeitam histórico; `beforeunload` é suplementar e insuficiente sozinho. Gravação de rascunho precisa de confirmação real; se falhar, a navegação não diz “preservado”. Descarte exige escolha explícita quando há trabalho relevante.

**RF-F6-34:** Conflitos entre abas e alterações posteriores preservam edição e dados canônicos, usam versionamento/CAS existente e não fazem merge arbitrário. Troca de perfil invalida apresentação/rascunhos incompatíveis; nunca exibe dados do perfil anterior. Cronômetro F4 não depende do ciclo de vida de React nem de montagem de uma rota.

**RF-F6-35:** Atualizações PWA e mudanças de shell não podem forçar perda silenciosa de sessão/edição. F6 respeita mecanismos existentes; homologação integrada de Service Worker, clientes de versões divergentes e recuperação efetiva é F7-D.

**RF-F6-36:** Compatibilidade V1→V2 em F6 é **de interface**, não importação produtiva. Não tocar esquema V1 nem acessar dados reais sem autorização; bancos IndexedDB são delimitados por origem, não por branch Git, e isso precisa ser verificado antes de ensaios. Preferências desconhecidas recebem fallback não destrutivo; schema incompatível impede escrita insegura; rotas legadas só redirecionam com mapeamento confiável.

## 11. Desempenho e segurança transversal — D-F6-03/05/09/11/18

**RNF-F6-01 Desempenho:** priorizar shell e jornada atual; lazy loading de áreas secundárias, projeções compartilhadas, consultas limitadas e invalidação determinística. Medir inicialização, navegação, consulta, renderização, memória, bundle e offline. Definir metas numéricas após baseline real; não converter benchmark sintético F5 em garantia. Web Workers/virtualização/bibliotecas novas exigem demonstração de benefício.

**RNF-F6-02 Disponibilidade local:** ações locais seguras continuam offline; mudanças remotas futuras não bloqueiam commit local. Não usar listener global Firestore para dashboard nem criar assinaturas remotas pagas. Custo recorrente obrigatório R$ 0.

**RNF-F6-03 Segurança:** dados importados ou links são não confiáveis: escaping, ausência de `dangerouslySetInnerHTML` para conteúdo externo sem sanitização comprovada, isolamento por perfil e URL sem segredos. Logs e relatórios saneados. CSV/exportações, quando reutilizadas, continuam protegidos contra formula injection; F6 não reinventa exportador.

**RNF-F6-04 Robustez:** falhas de quota, transação, renderização, acesso IDB, cache, atualização, concorrência e dados parciais geram degradação explícita. Preservar fatos, tombstones, histórico de decisões e rascunhos; caches podem ser reconstruídos; nunca “limpar para resolver” sem análise/autorização.

**RNF-F6-05 Compatibilidade:** navegadores suportados pela PWA V2 deverão ser caracterizados na especificação de execução; não supor Notification API, Service Worker ou APIs avançadas disponíveis em todos. Dispositivos e viewports reais/simulados devem incluir hardware modesto, tablet e touch mobile, sem prometer resultado não ensaiado.

## 12. Matriz de aceitação verificável F6-AC01–AC42

Cada cenário deve produzir evidência em teste local e/ou inspeção manual, com resultado `PASS`, `FAIL`, `BLOCKED`, `INCONCLUSIVE`, `NOT_RUN` ou `PASS_WITH_RESERVATIONS`, conforme natureza da prova. Um teste de UI não substitui a comprovação de integridade dos fatos.

| ID | Cenário | Resultado necessário | Referências |
|---|---|---|---|
| **F6-AC01** | Shell: todas as jornadas F2–F5 | Destinos e operações relevantes acessíveis sem duplicação | 01,20 |
| **F6-AC02** | Desktop/tablet/mobile e tela dividida | Composição adaptativa; ações equivalentes; sem ocultação essencial | 01,09 |
| **F6-AC03** | Rota profunda/favorito/reload | Destino correto com identidade estável e contexto válido | 04,17 |
| **F6-AC04** | Voltar/Avançar durante edição | Guardas sem loops; rascunho preservado/decisão explícita | 13,17 |
| **F6-AC05** | Registro excluído/de outro perfil | Sem revelar dados; fallback neutro, sem redirecionamento enganoso | 04,17 |
| **F6-AC06** | Sessão F4 ativa + navegação/tema/viewport | Cronômetro e autoridade de sessão intactos | 09,13 |
| **F6-AC07** | Home com sessão, tarefa e revisão | Próxima ação coerente e justificável | 02,16,19 |
| **F6-AC08** | Compromisso x sugestão x execução | Estados distinguíveis; nenhuma criação implícita | 02,19 |
| **F6-AC09** | Itens empatados/sem prazo | Ordem estável; sem atraso fictício | 18,19 |
| **F6-AC10** | Dois editais com compromisso compartilhado | Escopo explícito; sem ocultação/dupla contagem global | 03,04,19 |
| **F6-AC11** | Home vazia/parcial/com dados | Orientação contextual; usuários existentes continuam direto | 02,21 |
| **F6-AC12** | Falha de IDB na abertura | Erro real, não estado de usuário novo | 10,14,21 |
| **F6-AC13** | Modos da Home + indicadores | Preferências visuais sem alteração acadêmica; prioridades protegidas | 07,16 |
| **F6-AC14** | Gráfico planejado x realizado | Valores reconciliados, com unidade/período definidos | 03,15 |
| **F6-AC15** | F4 compartilhada por dois editais | Um único fato no total global; subtotais contextualizados | 03,15 |
| **F6-AC16** | Questões sem denominador/pequena amostra | `INSUFFICIENT_DATA` ou explicação; sem percentual fabricado | 03,15 |
| **F6-AC17** | Revisão F5 sem sessão F4 | Sem gerar tempo/questões na análise | 03,15 |
| **F6-AC18** | F4 `INCOMING` parcial | Projeção diagnóstica, não conciliada artificialmente | 03,14,15 |
| **F6-AC19** | Edit/delete/restore F2–F5 | Projeções invalidadas; geração antiga não sobrescreve nova | 03,11,15 |
| **F6-AC20** | Duas abas alteram dados | Consultas atualizam sem publicar resposta obsoleta | 03,11,18 |
| **F6-AC21** | Busca Unicode, acentos e homônimos | Resultados determinísticos com contexto/tipo e limite | 05 |
| **F6-AC22** | Busca em item não renderizado | Entidade encontrada, caminho revelado e rota segura | 05,17,18 |
| **F6-AC23** | Texto HTML-like ou markup hostil | Nenhum script/HTML importado executado | 05,20 |
| **F6-AC24** | Troca de perfil durante busca pendente | Nenhuma resposta anterior é publicada no novo perfil | 04,05 |
| **F6-AC25** | Edital com milhares de assuntos | Expansão/ordem estáveis, foco e desempenho medidos | 11,18 |
| **F6-AC26** | Calendário com intervalo e sobreposição | Nenhum compromisso pertinente omitido | 18 |
| **F6-AC27** | Lista grande pós-edição/exclusão | Paginação sem itens trocados ou duplicidade indevida | 11,18 |
| **F6-AC28** | Notificação negada/indisponível | Degradação para central local; sem promessa com app fechado | 06 |
| **F6-AC29** | Duas abas com lembrete F5 | Deduplicação/quiet hours/dispensa preservadas | 06,14 |
| **F6-AC30** | Commit local offline | Indica salvo local, não convergência remota | 10,14 |
| **F6-AC31** | Outbox pendente/erro remoto hipotético | Sem `REMOTE_COMMITTED`/`CONVERGED` sem prova F7 | 10,14 |
| **F6-AC32** | Quota/aborto/IDB bloqueado | Sem falso sucesso; edição e diagnóstico preservados | 10,13,14 |
| **F6-AC33** | Rascunho persistido + reload | Recuperável após read-back; nunca tratado como fato acadêmico | 13 |
| **F6-AC34** | Rascunho com base ultrapassada | Conflito claro; nenhum overwrite silencioso | 13 |
| **F6-AC35** | Atualização/reload durante formulário | Preservação proporcional; limites informados; sem refresh forçado indevido | 13,20 |
| **F6-AC36** | Preferência de tema/densidade e restauração | Persistência/validação; não modifica planos/sessões | 07,08,16 |
| **F6-AC37** | Oito temas × 3 classes de viewport | Contraste/estados/componentes críticos verificados e capturas próprias F6 | 08,09,12 |
| **F6-AC38** | Teclado, foco, modal, tabela e leitor de tela | Percurso crítico acessível, foco lógico e retorno; teste manual quando disponível | 09,10,12 |
| **F6-AC39** | Touch, zoom, orientação, reduced motion | Alvos e conteúdo essenciais utilizáveis sem perda de foco | 08,09,10 |
| **F6-AC40** | Baseline vs bundle/latência/memória F6 | Medições reproduzíveis, regressões documentadas; sem metas inventadas | 11,12,18 |
| **F6-AC41** | Compatibilidade F2–F5 e snapshots protegidos | Regressões preservadas; evidências F4 não sobrescritas | 12,20 |
| **F6-AC42** | Revisão final e estado Git | Achados materiais tratados, ressalvas explícitas, integração só com autorização | 12,22 |

### 12.1 Critérios de severidade

- **P0:** perda/corrupção de dados, vazamento entre perfis, execução acadêmica destrutiva indevida ou regressão de autoridade de sessão; **bloqueia aceite**.
- **P1:** fluxo essencial indisponível, estatística materialmente falsa, barreira grave de acessibilidade, falha de proteção de edição; **bloqueia** até correção ou reavaliação humana expressa e fundamentada.
- **P2:** defeito moderado visual/usabilidade/desempenho sem inviabilização; corrigir ou submeter ressalva fundamentada.
- **P3:** refinamento cosmético sem dano funcional; pode permanecer registrado sem reabrir ciclos infinitos.

Não classificar teste `NOT_RUN` como `PASS`. Uma aprovação com ressalvas não converte resultado desconhecido em verificado.

## 13. Homologação F6: gates conceituais, não writing-plans

**G-F6-A — Preservação e baseline:** verificar `main`, `v2`, HEAD, trabalho local, branches/PRs/worktrees/commits exclusivos; inventariar F2–F5, proteger dados e capturas F4; baseline técnico/visual.  
**G-F6-B — Qualidade funcional:** typecheck/lint/build, testes unitários, contratos, E2E, offline, concorrência, contexto, integridade, regressões F1–F5 e matriz de requisitos relevantes.  
**G-F6-C — Visual e acessibilidade:** Impeccable A-01 com brief/critique/audit/adapt/harden/polish-distill quando necessário e autorizado; oito temas, três classes de viewport, estados críticos, contraste, teclado, toque, leitores de tela e capturas exclusivas F6. Automação não é certificação.  
**G-F6-D — Desempenho e revisão independente:** resultados medidos, análise de mudanças e vulnerabilidades materiais, correções proporcionais e revalidação direcionada; nenhum ciclo indefinido.  
**G-F6-E — Aceite humano e integração controlada:** relatório objetivo com resultados e limites, ZIP de evidências e arquivos-chave, inventário Git, aceite explícito e integração **somente autorizada** à `v2`, com read-back e saneamento não destrutivo. Publicação e `main` continuam fora do gate.

Os gates descrevem **condições de aceite**, não a ordem de tarefas, duração, ferramentas adicionais ou um writing-plans executável. Esses detalhes somente poderão ser definidos após aprovação separada desta especificação.

### 13.1 Definição de pronto da fase

A F6 estará apta a aceite quando as dez capacidades estiverem demonstradas ou suas exceções aprovadas, as jornadas A–E (continuar, localizar, planejar, revisar, recuperar falha) passarem nos cenários relevantes, não houver P0/P1 material não tratado, riscos herdados permanecerem rastreados com status verdadeiro, a identidade visual/Impeccable e acessibilidade tiverem evidência, a revisão independente estiver documentada, o pacote ZIP for disponibilizado, e o estado Git/integração `v2` tiverem sido verificados conforme autorização.

Separar os marcos `IMPLEMENTED`, `TESTED`, `REVIEWED`, `INTEGRATED_V2`, `ACCEPTED_WITH_RESERVATIONS` (se cabível) e `DEPLOYED` (não autorizado F6). Nenhum deles implica os demais. Ausência de publicação produtiva não impede aceite da fase de desenvolvimento na `v2`, desde que declarada com precisão.

## 14. Matriz de rastreabilidade D-F6-01–22

| Decisão aprovada | Contrato formal principal | Evidência crítica |
|---|---|---|
| D-F6-01 B — Shell modular | §4 RF01/07 | AC01–02 |
| D-F6-02 B — Home operacional | §5 RF08–09 | AC07–08 |
| D-F6-03 B — Projeções compartilhadas | §6 RF14–18 | AC14–20 |
| D-F6-04 B — Contexto compartilhado | §4 RF04 | AC05/10/24 |
| D-F6-05 B — Busca local | §7 RF19–21 | AC21–24 |
| D-F6-06 B — Centro de atenção | §8 RF23–24 | AC28–29 |
| D-F6-07 B — Preferências modulares | §9 RF28 | AC13/36 |
| D-F6-08 B — Impeccable/design | §9 RF29/31 | AC37/39 |
| D-F6-09 B — Responsividade | §4 RF01/06 | AC02/39 |
| D-F6-10 B — Estados acessíveis | §8 RF25 | AC30/32/38 |
| D-F6-11 B — Progressivo/cache | §6 RF18, §11 RNF01 | AC19/25/40 |
| D-F6-12 B — Homologação por riscos | §12–13 | AC37–42 |
| D-F6-13 B — Rascunhos e continuidade | §10 RF32–35 | AC04/06/32–35 |
| D-F6-14 B — Integridade em camadas | §8 RF26–27 | AC30–32 |
| D-F6-15 B — Visualizações semânticas | §6 RF15–17 | AC14–18 |
| D-F6-16 B — Personalização guiada | §5 RF11–12 | AC13/36 |
| D-F6-17 B — Rotas recuperáveis | §4 RF02–05 | AC03–05/22 |
| D-F6-18 B — Consultas incrementais | §7 RF22 | AC25–27 |
| D-F6-19 B — Prioridade explicável | §5 RF09–10 | AC07–10 |
| D-F6-20 B — Compatibilidade progressiva | §4 RF07, §10 RF36 | AC01/35/41 |
| D-F6-21 B — Onboarding contextual | §5 RF13 | AC11–12 |
| D-F6-22 B — Limites/encerramento | §1, §13 | AC41–42 |

## 15. Riscos, limites de evidência e decisões técnicas reservadas

### 15.1 Riscos que não podem ser encerrados pela F6

| Item | Estado conhecido | Limite de inferência |
|---|---|---|
| Quatro HIGH F0 | `UNVERIFIED` | Apenas evidência específica e gate competente podem mudar o status |
| F4-T13 | `NOT_RUN` | Benchmark/prova F6 não é automaticamente o teste histórico F4-T13 |
| F4 `INCOMING` parcial | Preservado | Não somar evidência parcial como concluída |
| F5 desempenho real | Não homologado em hardware modesto | Benchmark sintético não substitui ensaio real |
| Capturas F4 | Versões antigas locais pré-regeneração irrecuperáveis; preservação posterior existente | Não sobrescrever as capturas restantes, nem declarar restauração dos bytes perdidos |
| Git/worktrees históricos | Branch de preservação, worktrees e refs exclusivos mantidos | Não executar limpeza destrutiva sem inventário e autorização |
| `main`/Cloudflare | Risco de deploy por integração antecipada | Sem merge `v2→main`, push produtivo ou alteração de workflow |
| Firebase real/F7 | Não homologado | Estados remotos da F6 não são prova de sync |

### 15.2 Escolhas de implementação ainda abertas, sem necessidade de novo brainstorming

- Biblioteca/estrutura de roteamento, compatibilidade HTTPS/PWA e fallback de rotas.
- Formulários específicos a proteger com rascunhos duráveis, armazenamento viável, política de expiração e recuperação, sempre com validação por perfil/versão.
- Catálogo físico de métricas e séries, intervalos padrão, modalidades de tabela e tratamentos de dados parciais respeitando F2–F5.
- Critérios exatos de desempate das prioridades após inventário dos campos realmente existentes.
- Estratégia concreta de notificações locais e consultas incrementais usando os serviços já disponíveis.
- Composição final e breakpoints orientados pelo conteúdo, não por convenção de marketing de aparelhos.
- Limiares objetivos de latência, memória e bundle após medição reproduzível.
- Matriz final de navegadores/dispositivos e disponibilidade real de leitor de tela/Impeccable.

São escolhas técnicas ordinárias a serem especificadas/planejadas **sem contrariar os contratos desta spec**. Se houver incompatibilidade material com a spec-mestra, nova dependência onerosa, risco de alteração produtiva, necessidade de reescrever dados canônicos ou exceção grave de integridade, o trabalho deverá retornar ao gate humano apropriado.

## 16. Governança documental e próximo gate

1. **Estado atual:** arquitetura D-F6-01–22 aprovada; **esta especificação é minuta formal em revisão**, ainda não aprovada.
2. **Somente após aceite humano desta especificação** poderá ser autorizado o writing-plans F6 Superpowers, com tarefas, arquivos, TDD, testes, revisões, critérios, riscos e dependências.
3. **Somente após aceite do writing-plans e autorização de execução** poderá existir GOAL Codex/implementação.
4. Nenhuma autorização desta fase inclui `main`, deploy, Actions, CI/CD, PR automático, migração real, Firebase real ou limpeza destrutiva.
5. Ao promover formalmente esta minuta, reconciliar sem sobrescrever indevidamente a proposta F6 histórica, manter uma fonte normativa F6 clara, atualizar o roadmap/issue central somente mediante autorização de escrita e verificar por read-back.

**Deliberação:** `F6_SPEC_APPROVED` em 2026-11-03; writing-plans T00–T20 aprovado e GOAL preparado em etapas posteriores. A publicação documental não comprova implementação nem homologação da F6.
