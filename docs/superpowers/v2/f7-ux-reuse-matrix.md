# F7-UX — matriz de dependências e reutilização

**Data:** 09/11/2026  
**Estado:** `F7_UX_GOAL_PREPARED_NOT_EXECUTED`  
**Natureza:** preparação para GOAL futuro; nenhum redesign foi implementado neste documento.

## 1. Fontes aprovadas

- `docs/superpowers/specs/2026-11-05-estudo-organizado-v2-f7-ux-design.md` — blob `4BABE27132CE2B5096EE09CA07F05C83E491DDEAA4E1CFC168E24945B04D2C7A`.
- `docs/superpowers/plans/2026-11-05-estudo-organizado-v2-f7-ux-writing-plans.md` — UX-01–UX-31.
- `docs/superpowers/goals/2026-11-05-estudo-organizado-v2-f7-ux-codex-desktop.md` — GOAL preparado.
- `docs/superpowers/v2/transcripts/2026-11-05-f7-ux-conversa-completa.md` — histórico literal, ressalvas D54–D71.

## 2. Princípios de reutilização

1. A F7-UX é aditiva: não duplicar Auth, sync, backup, persistência ou contratos de domínio da F7 funcional.
2. Componentes existentes de F6/F7 são a base; novas telas devem compor estes blocos, não criar um segundo shell.
3. Estados de dados continuam vindo de `SyncHealth`, `BackupHealth`, stores e serviços existentes; nenhum widget calcula sucesso remoto por conta própria.
4. Nenhuma migração de dados, cutover, URL ou serviço real é autorizada pela F7-UX.
5. D01–D71 e T01–T27 não podem ser renumerados nem reinterpretados como implementação.

## 3. Matriz por área

| Área UX | Código existente para reutilizar | O que falta / cuidado |
|---|---|---|
| Shell, navegação e temas | `presentation/App.tsx`, `AppNav.tsx`, `routing.ts`, `tokens.css`, `styles.css`, oito temas | D31–D33 e D37–D43 pedem hierarquia/contexto; não criar segundo roteador nem CSS paralelo |
| Home e widgets | `views/HomeView.tsx`, `application/experience-queries.ts`, `ExperienceProjectionCache` | Widgets devem projetar fatos existentes; não gravar por render |
| Conteúdo | `views/EditalManager`, `ContentTree`, `SubjectList`, `SubjectForm`, `LocalContentRepository`, `content-migration` | Reutilizar árvore paginada, rascunhos e estados de conflito; não reimplementar CRUD |
| Planejamento | `PlanningWorkspace`, `PlanningWizard`, `PlanningCalendar`, `PlanningEditor`, `PlanningHistory`, `LocalPlanningRepository`, `planning-merge` | Reutilizar preview/commit, capacidade, conflitos e checkpoints; evitar novo motor de planejamento |
| Sessões | `SessionWorkspace`, `session-clock`, `session-conflicts`, `session-emergency`, `LocalSessionRepository` | Preservar timer, recuperação, hábitos e autoridade entre abas; não duplicar lógica de tempo |
| Revisões | `ReviewWorkspace`, `review-service`, `LocalReviewRepository`, `review` domain | Reutilizar tópicos, compromissos, banca, pontos fracos e projeções; opt-in continua explícito |
| Análise | `AnalyticsView`, `experience-queries`, `ExperienceProjectionCache` | D30 (gráficos) é adiado; toda métrica deve ter fonte e estado de staleness |
| Busca | `SearchView`, `experience-queries`, `routing` | D35 é progressiva e subordinada; não criar índice remoto |
| Atenção/integridade | `AttentionView`, `SyncStatus`, `ui-state`, `storage-health` | Estados `CONFLICT`, `RECOVERY_REQUIRED`, `PAUSED_QUOTA`, `PAUSED_AUTH`, `PENDING_OFFLINE`, `SYNCING` são independentes |
| Configurações | `SettingsView`, `GoogleLink`, `BackupControls`, `LocalBackupPanel` | Auth, sync e backup separados; nenhuma ação remota por render |
| Backup/restore | `backup/collect`, `crypto`, `f7-format`, `restore-commit`, `scheduler`, `kv-client`, `LocalBackupPanel` | Reutilizar preview/consentimento/read-back; não criar segundo formato |
| PWA/update | `public/sw.js`, `sw-update.ts`, `vite.config.ts` precache | Manter adiamento seguro, precache e isolamento V1; não criar SW paralelo |
| Acessibilidade | tokens, foco, skip link, oito temas, E2E de contraste/teclado | Reutilizar testes existentes e ampliar por tela; NVDA/Narrator continua NOT_RUN |

## 4. Dependências de GOAL

| Dependência | Necessária antes de UX? | Observação |
|---|---|---|
| Revisão independente F7 | sim | concluída nesta estabilização; itens abertos listados na auditoria |
| Sync real/Firebase | não para protótipo local; sim para homologação | G-EXT separado |
| Backup criptografado/restore | sim para telas de recuperação | código local já corrigido; serviço real G-EXT |
| URL de avaliação | sim para aceite visual externo | G-STAGING separado |
| Dados sintéticos | sim | nunca usar acervo real no redesign |

## 5. O que não reimplementar

- Não criar um segundo `SyncCoordinator`, outbox, scheduler, store de conflitos ou formato de backup.
- Não duplicar oito temas, tokens, roteador, shell, árvore de conteúdo ou lógica de sessão.
- Não mover a lógica de domínio para componentes de apresentação.
- Não transformar projeções de Home/Análise em fonte de verdade.
- Não usar `localStorage` como substituto de IndexedDB/outbox.
- Não prometer sync com app fechado, backup indestrutível ou convergência sem prova.

## 6. Próximo GOAL de F7-UX

1. Ler D01–D71 e UX-01–UX-31 integralmente.
2. Executar preflight e confirmar que o código F7 estabilizado está no HEAD.
3. Implementar por clusters UX-01–UX-31, reutilizando os módulos acima e mantendo os gates G-EXT/G-STAGING independentes.
4. Revisar acessibilidade, estados honestos, mobile/tablet e regressões F2–F7.
5. Não iniciar F8, não publicar produção e não substituir a V1.
