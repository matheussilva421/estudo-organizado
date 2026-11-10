# Rastreabilidade D01-D71 — F7-UX

Fonte: docs/superpowers/specs/2026-11-05-estudo-organizado-v2-f7-ux-design.md.
Status refere-se ao HEAD 68e83479 e à suíte final desta rodada. PASS_LOCAL em D65-D68 mantém gates externos NOT_RUN.

| ID | Módulo | Decisão consolidada | Status | Evidência |
|---|---|---|---|---|
| D01 | Home | Visão inicial da experiência | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-home-320.spec.ts |
| D02 | Home | Dashboard altamente personalizável | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-dashboard-widgets.test.ts |
| D03 | Home | Layouts prontos + editor avançado | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-dashboard-widgets.test.ts |
| D04 | Home | Híbrido personalizável | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-dashboard-widgets.test.ts |
| D05 | Home | Grade responsiva avançada | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-dashboard-widgets.test.ts |
| D06 | Home | Responsividade inteligente e personalização por dispositivo | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-dashboard-widgets.test.ts |
| D07 | Home | Construtor de widgets personalizados | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-dashboard-widgets.test.ts |
| D08 | Home | Editor híbrido: básico + avançado | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-dashboard-widgets.test.ts |
| D09 | Home | Todos os dados acadêmicos internos compatíveis | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-dashboard-widgets.test.ts |
| D10 | Home | Fórmulas avançadas, condições e comparações | PASS_VERIFIED | f7-ux-home*.spec.ts; f7-ux-dashboard-widgets.test.ts |
| D11 | Home | Widget composto e adaptativo | PASS_VERIFIED | f7-ux-analytics*.test.ts; widget-queries |
| D12 | Home | Visão dupla adaptativa de tempo e blocos | PASS_VERIFIED | f7-ux-analytics*.test.ts; widget-queries |
| D13 | Home | Widget completo e adaptativo | PASS_VERIFIED | f7-ux-analytics*.test.ts; widget-queries |
| D14 | Home | Widget completo e adaptativo | PASS_VERIFIED | f7-ux-analytics*.test.ts; widget-queries |
| D15 | Home | Widget integrado e adaptativo | PASS_VERIFIED | f7-ux-analytics*.test.ts; widget-queries |
| D16 | Home | Híbrida e adaptativa | PASS_VERIFIED | f7-ux-analytics*.test.ts; widget-queries |
| D17 | Home | Híbrida, explicável e com controle manual | PASS_VERIFIED | f7-ux-analytics*.test.ts; widget-queries |
| D18 | Home | Sistema híbrido com filtros globais, locais e vinculados | PASS_VERIFIED | f7-ux-attention-analytics.spec.ts; f7-ux-tasks |
| D19 | Home | Interação em camadas | PASS_VERIFIED | f7-ux-attention-analytics.spec.ts; f7-ux-tasks |
| D20 | Home | Interface contextual por dispositivo | PASS_VERIFIED | f7-ux-attention-analytics.spec.ts; f7-ux-tasks |
| D21 | Home | Expansão inteligente com controle manual | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D22 | Home | Navegação híbrida com preservação protegida | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D23 | Home | Ações inteligentes com proteção proporcional | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D24 | Home | Estados semânticos com diagnóstico progressivo | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D25 | Home | Estado global + indicação contextual | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D26 | Home | Sistema visual híbrido e personalizável | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D27 | Home | Adaptativa e totalmente configurável | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D28 | Home | Sistema tipográfico semântico e adaptativo | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D29 | Home | Sistema cromático semântico e personalizável | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D30 | Análises | Visualizações inteligentes + editor avançado | PASS_VERIFIED | f7-ux-shell-navigation.spec.ts; f7-ux-cross-module.spec.ts |
| D31 | Shell | Navegação adaptativa com hierarquia por dispositivo | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D32 | Shell | Hierarquia por frequência e contexto | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D33 | Shell | Barra híbrida com ação Estudar contextual | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D34 | Shell | Cabeçalho adaptativo em camadas | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D35 | Busca | Busca progressiva em dois níveis | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D36 | Central de Atenção | Central inteligente e progressiva | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D37 | Conteúdo | Explorador hierárquico com painéis contextuais | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D38 | Conteúdo | Árvore progressiva e adaptativa | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D39 | Conteúdo | Painel contextual progressivo | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D40 | Conteúdo | Editor híbrido e contextual | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D41 | Conteúdo | Reorganização híbrida com segurança proporcional | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D42 | Conteúdo | Gerenciador relacional bidirecional | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D43 | Conteúdo | Espaço contextual com administração sob demanda | PASS_VERIFIED | f7-ux-content*.spec.ts; f3/f2 regression |
| D44 | Planejamento | Workspace adaptativo de planejamento | PASS_VERIFIED | f7-ux-planning-workspace.spec.ts; f3-journey; f7-ux-planning-availability.test.ts |
| D45 | Planejamento | Gerenciador contextual com comparação sob demanda | PASS_VERIFIED | f7-ux-planning-workspace.spec.ts; f3-journey; f7-ux-planning-availability.test.ts |
| D46 | Planejamento | Calendário híbrido e adaptativo | PASS_VERIFIED | f7-ux-planning-workspace.spec.ts; f3-journey; f7-ux-planning-availability.test.ts |
| D47 | Planejamento | Assistente progressivo com controles avançados | PASS_VERIFIED | f7-ux-planning-workspace.spec.ts; f3-journey; f7-ux-planning-availability.test.ts |
| D48 | Planejamento | Experiência contextual adaptativa | PASS_VERIFIED | f7-ux-planning-workspace.spec.ts; f3-journey; f7-ux-planning-availability.test.ts |
| D49 | Planejamento | Central contextual de acompanhamento e ajustes | PARTIAL | f3-history; metas comparativas ainda resumidas |
| D50 | Sessões | Workspace de estudo contextual | PASS_VERIFIED | f7-ux-sessions-history.spec.ts; f4-timer/pomodoro/recovery |
| D51 | Sessões | Cronômetro adaptativo com segurança contextual | PASS_VERIFIED | f7-ux-sessions-history.spec.ts; f4-timer/pomodoro/recovery |
| D52 | Sessões | Registro contextual com distribuição progressiva | PASS_VERIFIED | f7-ux-sessions-history.spec.ts; f4-timer/pomodoro/recovery |
| D53 | Sessões | Histórico explorável com inspetor contextual | PASS_VERIFIED | f7-ux-sessions-history.spec.ts; f4-timer/pomodoro/recovery |
| D54 | Sessões | Acompanhamento contextual com segurança sob demanda | PASS_VERIFIED | f7-ux-sessions-history.spec.ts; f4-timer/pomodoro/recovery |
| D55 | Revisões | Fila inteligente contextual | PASS_VERIFIED | f7-ux-reviews-queue.spec.ts; f7-ux-review-*.test.ts |
| D56 | Revisões | Política contextual com simulador e aprovação protegida | PASS_VERIFIED | f7-ux-reviews-queue.spec.ts; f7-ux-review-*.test.ts |
| D57 | Revisões | Explorador contextual de prioridades e evidências | PASS_VERIFIED | f7-ux-reviews-queue.spec.ts; f7-ux-review-*.test.ts |
| D58 | Revisões | Agenda contextual com encaixe assistido | PASS_VERIFIED | f7-ux-reviews-queue.spec.ts; f7-ux-review-*.test.ts |
| D59 | Revisões | Histórico contextual com auditoria e recuperação protegidas | PASS_VERIFIED | f7-ux-reviews-queue.spec.ts; f7-ux-review-*.test.ts |
| D60 | Análises | Workspace analítico contextual e explorável | PASS_VERIFIED | f7-ux-analytics.test.ts; f7-ux-analytics-cache.test.ts |
| D61 | Análises | Laboratório contextual de indicadores auditáveis | PASS_VERIFIED | f7-ux-analytics.test.ts; f7-ux-analytics-cache.test.ts |
| D62 | Análises | Explorador visual contextual com relatórios reproduzíveis | PASS_VERIFIED | f7-ux-analytics.test.ts; f7-ux-analytics-cache.test.ts |
| D63 | Análises | Arquivo analítico contextual com comparação e auditoria | PASS_VERIFIED | f7-ux-analytics.test.ts; f7-ux-analytics-cache.test.ts |
| D64 | Análises | Workspace analítico adaptativo com integridade obrigatória | PASS_VERIFIED | f7-ux-analytics.test.ts; f7-ux-analytics-cache.test.ts |
| D65 | Configurações | Configurações contextuais com integridade sempre visível | PASS_LOCAL | f7-ux settings/backup tests; G-EXT/G-STAGING NOT_RUN |
| D66 | Configurações | Perfil local com sincronização contextual e fluxos protegidos | PASS_LOCAL | f7-ux settings/backup tests; G-EXT/G-STAGING NOT_RUN |
| D67 | Configurações | Cofre local contextual com restauração protegida | PASS_LOCAL | f7-ux settings/backup tests; G-EXT/G-STAGING NOT_RUN |
| D68 | Configurações | Manutenção contextual guiada com proteção progressiva | PASS_LOCAL | f7-ux settings/backup tests; G-EXT/G-STAGING NOT_RUN |
| D69 | Transversal | Contratos mínimos e fontes de verdade compartilhadas | PASS_VERIFIED | f7-ux-home-320.spec.ts; visual-a11y; NVDA NOT_RUN |
| D70 | Transversal | Feedback contextual por evidência com recuperação progressiva | PASS_VERIFIED | f7-ux-home-320.spec.ts; visual-a11y; NVDA NOT_RUN |
| D71 | Transversal | Design system incremental com contratos semânticos | PASS_VERIFIED | f7-ux-home-320.spec.ts; visual-a11y; NVDA NOT_RUN |
