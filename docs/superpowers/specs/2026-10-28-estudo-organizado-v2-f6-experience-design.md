# Estudo Organizado V2 — F6: Experiência integrada, dashboards, navegação e acessibilidade

**Status:** SPEC PROPOSTA PARA REVISÃO HUMANA — **NÃO APROVADA**, sem writing-plans, código ou publicação.  
**Pré-requisitos:** F1–F5 com dados canônicos, jornadas e métricas comprovadas; identidade visual aprovada da V1; A-01 Impeccable e A-02 sync.  
**Objetivo:** transformar as fatias funcionais em produto coerente e utilizável em computador, tablet e celular, sem transformar a UI em segunda fonte de dados.

## 1. Inventário F0 (10 funcionalidades)

| ID | Escopo V2 |
| --- | --- |
| `F-V1-APP-SHELL` | **Reformular** shell, navegação, despacho de ações, modais e feedback |
| `F-V1-LEGACY-FACADES` | **Reformular** removendo necessidade de bridge global `window.EstudoApp`; preservar integrações por contratos públicos |
| `F-V1-HOME-DASHBOARD` | Preservar home e próximos estudos com estado real |
| `F-V1-ANALYTICS-DASHBOARD` | Preservar painéis gerais e por disciplina com métricas conciliadas |
| `F-V1-GLOBAL-SEARCH` | Preservar busca global contextual e indexada |
| `F-V1-NOTIFICATIONS` | Preservar notificações locais de estudo, respeitando permissões e limitações PWA |
| `F-V1-CONFIG-PREFERENCES` | Preservar preferências, configurações e estados de sync seguros |
| `F-V1-THEMES` | Preservar oito temas, tokens, acessibilidade e troca durável |
| `F-V1-ACCESSIBILITY` | Preservar/evoluir foco, teclado, touch, semântica, contraste e movimento reduzido |
| `F-V1-SKELETON-LOADING` | Preservar estados de carregamento/skeletons sem flashes/falso conteúdo |

A F1 já entrega UI mínima e tokens; F6 **integra e homologa a experiência final**, sem reimplementar versões paralelas de componentes.

## 2. Arquitetura de informação e contratos de apresentação

**Jornada de alto nível aprovada na spec-mestra:** `Organizar → Planejar → Estudar → Revisar → Analisar → Configurar`. É organização de responsabilidades, **não obrigação de seis itens fixos de menu**. Padrões desktop/tablet/mobile precisam ser testados com usuários/fixtures; dashboard deve oferecer próximo passo claro e navegação contextual de edital principal.

**Shell:** rotas tipadas, modais e menus acessíveis, feedback local-first honesto, busca com contexto, operações sem dependência de nomes globais. Nenhum `window.EstudoApp` ou facade legada necessária para interoperar; portas de application services e adapters podem coexistir com V1 no mesmo repo sem importá-la no app V2.

**Projeções:** dashboards e contadores derivam de ``StudySession`, `PlannedActivity`, `ReviewEvent`, questões, hábitos e dados de edital; filtros por dia/semana/edital/disciplina; progresso por planejamento não é tempo estudado; metas não são contabilizadas duas vezes. Cache pode acelerar, mas deve invalidar de maneira determinística em edit, delete, restore e sync; nunca ser fonte primária.

**Busca global:** indexação local em entidades/assuntos/aulas/planos/sessões permitidos pelo perfil; resultados com escopo e tipo, paginação/ranking explicável; conteúdo importado HTML-like tratado como texto. Busca funciona offline; não criar serviço de busca remoto pago ou compartilhar acervos entre UIDs.

**Notificações:** permissões explícitas e opt-in, observância de browsers mobile; indisponibilidade com PWA fechada não é erro de dados. Não prometer push remoto nem scheduled notification garantida sem tecnologia autorizada.

## 3. Design system e Impeccable A-01

**Identidade obrigatória:** `PRODUCT.md`/`DESIGN.md` read-only da V1; temas Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex e Plasma; steel-blue, Plus Jakarta Sans + DM Mono; interface escura de densidade útil, sem aparência genérica de dashboard SaaS.

**Componentes candidatos (reusar da F1):** app shell, navegação/side rail, paginação e filtros, cards de estudo, tabela responsiva, agenda, diálogo/confirm, badge de saúde, toast sem sobreposição, combobox de busca, listas virtuais somente quando medição justificar, estados vazios/carregamento/erro/offline. Não adicionar um segundo design system.

**Processo A-01:** brief/shape de fluxos com base em dados sintéticos; critique/audit; adaptar viewports; harden para falhas/acessibilidade; polish/distill conforme necessidade. Usar CLI/skill realmente disponível e versionada, checando hooks/telemetria e sem sobrescrever os arquivos V1. Capturas pelo menos nas configurações desktop/tablet/mobile e oito temas, cobrindo dashboard, busca, calendário, editor, timer, conflitos e settings.

**Acessibilidade:** WCAG AA (incluindo texto, ícones, gráficos e estados), teclado e foco/skip link, alvos touch 44px em coarse, reduced-motion, feedback SR/live region, zoom de texto e orientação; contrastes também em temas alternativos, não só modo Grafite. Não confundir detector de problemas com certificação integral.

**Sincronização A-02 na UI:** distinguir `LOCAL_COMMITTED`, `REMOTE_COMMITTED` e `CONVERGED`; apresentar pendências, conflito real, quota/credenciais, última verificação e ações sem alarmismo. Se outro dispositivo estiver offline, não exibir "tudo sincronizado em todos os dispositivos" sem prova.

## 4. UX de configuração, dados e recuperação

Preferências de estudo ficam localmente no perfil e sincronizadas apenas se contratadas; trocar conta Google mostra perfil vinculado antes de mesclar. Central de sync efetiva será homologada na F7, mas o shell inclui seus estados e entrada contextual; botão de backup sempre distinto do estado de sync. Operações de limpar/arquivar dados exigem preview e confirmação: **não** antecipar componentes completos de gestão/migração (F7).

Responsividade não pode esconder fluxos essenciais, especialmente Reta Final e calendário. Modal de conflito nunca escolhe vencedor automaticamente por abandono do diálogo. Skeletons não devem mostrar dados de perfil anterior durante login/logout.

## 5. Testes, desempenho e revisão

| Cenário | Gate de aceite |
| --- | --- |
| Criar sessão e olhar dashboard/agenda | Agregados conciliados com registros F4 e plano F3 |
| Editar/excluir sessão e revisões em outra aba | Projeção atualizada, sem dupla contagem |
| Trocar edital principal ou perfil/UID | Resultados de busca/cards isolados, nenhuma informação cruzada |
| Busca com milhares de tópicos e Unicode | Resposta estável com paginação/limite; orçamento definido por medição |
| Dispositivo touch 390px com tabela larga | Sem perda de ação, foco alcançável e conteúdo legível |
| Navegação por teclado/voz e zoom | Labels semânticos, focus order e skip link úteis |
| Oito temas, gráficos e toasts | Contraste AA amostrado + auditoria independente e Impeccable |
| Notificação negada/indisponível | Degradação graciosa, sem promessa de alerta garantido |
| Reconnect, conflito, quota, logout | Estados de sync verdadeiros, sem falso sucesso |
| Atualização SW com formulário aberto | Nunca descartar estado não confirmado |
| Loading, empty/error, operação lenta | Skeleton e feedback não confundem ausência com carregamento |
| Dados importados com markup hostil | Text nodes/escaping, nenhum script executado |

**Desempenho:** orçamento de inicialização/render/sync/consulta a ser definido com baseline F1–F5, não valores inventados; testar dispositivos modestos e rede simulada lenta. Proibir listener global de todo Firestore no dashboard para evitar leituras em excesso. QA E2E com screenshots e matrizes de viewport/tema, inclusive offline.

## 6. Aceite final, não objetivos e gates

**DoD F6:** as 10 funcionalidades entregues ou exceções aprovadas; fluxos principais integrados, indicadores fidedignos, UI que preserva a personalidade da V1, contrastes/teclado/responsividade demonstrados, ausência de falhas visuais críticas não resolvidas, Impeccable com evidência, testes E2E e revisão independente. Integrar somente em `v2` quando autorizado; V1 intacta.

**Fora F6:** nova plataforma de analytics paga, modelo de IA terceirizado, app nativo, laboratório de layout `F-V1-VISUAL-LAYOUT-LAB` (ainda `UNDECIDED`), Cloudflare/Drive como segundo peer de sincronização, migração real e cutover.

**Decisões pendentes para revisão:** desenho concreto de navegação responsive, filtros principais, disparos de notificações com app fechado, tokens de componentes de gráficos, objetivos de performance com baseline. Geração de protótipos e revisão visual material seguem gate A-01.

**Gate:** `F6_SPEC_PROPOSED` → aceite da spec → writing-plans F6 → gate do plano/GOAL → implementação TDD+Impeccable → homologação UX e revisão humana. Não declarar "UX completa" apenas por testes automáticos ou detector estático.
