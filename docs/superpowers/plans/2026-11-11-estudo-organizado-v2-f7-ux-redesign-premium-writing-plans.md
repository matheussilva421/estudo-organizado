# Estudo Organizado V2 — F7-UX Redesign Premium
## Superpowers — Writing Plans de implementação incremental

**Versão:** 1.0 — **PROPOSTA PARA ACEITE HUMANO**  
**Data:** 11/11/2026  
**Estado:** `F7_UX_PREMIUM_PLAN_PROPOSED_AWAITING_APPROVAL`  
**Repositório:** `matheussilva421/estudo-organizado`  
**Diretório de aplicação pretendido:** `apps/v2/` (a confirmar no checkout real).  
**Destino documental sugerido, se posteriormente autorizado:** `docs/superpowers/plans/2026-11-11-estudo-organizado-v2-f7-ux-redesign-premium-writing-plans.md`.  
**Fontes vinculantes:** especificação complementar premium v1.0 aprovada pelo proprietário em 11/11/2026; especificação F7-UX de 05/11/2026; D01–D71; DV-01–DV-18; F7 funcional e contratos F2–F6.  
**Método previsto:** Superpowers `writing-plans` → aceite humano → GOAL específico → execução com TDD, `subagent-driven-development` ou `executing-plans` quando disponível → revisão independente → validação → integração autorizada → higiene Git.  
**Natureza:** documento de planejamento. **NÃO autoriza modificar código, publicar, fazer push, merge, abrir PR, criar branch ou executar GOAL.**

> **Regra fundamental:** a F7-UX original já foi implementada e testada localmente segundo os pacotes recebidos. Este plano descreve **o delta do Redesign Premium**, não uma segunda implementação da F7-UX nem um recomeço de F2–F7.

---

## 1. Fontes e reconciliação de estado

### 1.1 Especificações e artefatos

1. **Fonte premium aprovada:** `ESTUDO-ORGANIZADO-V2-F7-UX-REDESIGN-PREMIUM-SPEC-2026-11-11.md` (especificação complementar, seções 1–20; VA-01–VA-20). A capa original ainda traz o status histórico «proposta»; o **aceite explícito posterior** do proprietário prevalece, sem alterar retroativamente os bytes daquele arquivo.
2. **Fonte F7-UX original:** `docs/superpowers/specs/2026-11-05-estudo-organizado-v2-f7-ux-design.md` (D01–D71, T-01–T-04, H/S/C/P/E/R/A/G, AC-01–AC-24). A matriz integral das decisões permanece nesse arquivo e na transcrição primária; não reconstituir nem alterar seu conteúdo.
3. **Plano histórico:** `docs/superpowers/plans/2026-11-05-estudo-organizado-v2-f7-ux-writing-plans.md`, UX-01–UX-31; **aprovado e usado na implementação original**. Suas tarefas são referências de rastreabilidade, não uma lista para executar novamente.
4. **Evidência de código anterior:** `ESTUDO-ORGANIZADO-V2-F7-UX-HUMAN-REVIEW-READY-29d35c2c.zip`, incluindo `GIT-STATE.md`, `INDEPENDENT-REVIEW.md`, capturas e logs. O registro reporta: HEAD documental local `29d35c2c`; código validado `0c31e6ef`; 94 commits à frente de `origin/v2@7a7df0f` sem publicá-los; 876 unitários PASS; 201 E2E PASS + 3 SKIP; typecheck/lint/build PASS. **Evidência histórica, não estado local ao vivo.**
5. **Referências visuais:** mockups aprovados de Neon Teal, Esmeralda e Dourado, Azul e Âmbar, Azul Glacial/Prata; usados como direção, não pixel-perfect nem prova de funcionamento. O comparativo antigo é baseline, não visual alvo.
6. **Registro central:** `docs/superpowers/v2/ROADMAP.md` ou o índice vivo efetivamente encontrado, preservando aprovações, gates e links existentes.

### 1.2 Verificação remota em 11/11/2026

| Elemento | Evidência remota consultada | Limitação |
|---|---|---|
| Repositório | `matheussilva421/estudo-organizado`, padrão `main` | Sem acesso automático ao Windows local do Codex |
| `main` | `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` | V1 protegida; nenhuma integração V2 autorizada |
| `v2` remoto | `7a7df0f2f9911a0d5956cb9b94ffa03659d24905` | **Não contém necessariamente os 94 commits locais** |
| Comparação `main...v2` | `v2` 280 commits à frente de `main`, 0 atrás | Isto não é a comparação com a `v2` LOCAL |
| PRs abertos | Nenhum encontrado | Revalidar no preflight da execução |
| Branches remotas visíveis | `main`, `v2`, `docs/superpowers-estudo-organizado-v2-design`, `docs/superpowers-estudo-organizado-v2-f0-plan` | Branches/worktrees/stashes locais exigem inspeção própria |

**Regra de conflito:** o inventário Git do ambiente efetivo no momento da execução prevalece sobre qualquer SHA histórico. **Nunca** resetar para `origin/v2`, fazer checkout por cima de alterações, recriar worktree como substituição ou dar push presumindo que os commits locais já existem no remoto.

### 1.3 P2 e gates não absorvidos pelo redesenho

Os pacotes anteriores registram pendências residuais: pequenos alvos de toque na Home, feedback em conflito entre abas, recuperação de prévia/foco, cenário com concorrência na transição, revisão de campos do wizard, exportação filtrada, acessibilidade manual NVDA/Narrator e hardware modesto. Não tratar todas como bugs reproduzidos neste planejamento. **Inventariar, reproduzir e classificar**; corrigir as que impactam os fluxos premium dentro de escopo e registrar as demais sem apagar histórico. G-EXT, G-STAGING, homologação humana, sync/backup reais, migração V1 e F8 permanecem separados.

---

## 2. Contrato do plano

### Objetivo

Implementar **somente após nova autorização**, por evolução incremental do código existente, os 12 temas, a galeria e personalização, o acabamento `Layered Premium`, a Home contextual com onboarding, as superfícies especializadas de Conteúdo/Planejamento/Sessões/Revisões/Análises/Configurações, o `Contextual Command Center`, o mobile em camadas e o feedback semântico das DV-01–DV-18. Manter todo o comportamento funcional D01–D71 e os testes já existentes.

### Invariantes inegociáveis

- **Fonte da verdade:** Conteúdo, Planejamento, Sessões e Revisões mantêm seus repositórios e comandos. Home, Busca, Atenção e Análises são projeções; renderizar ou trocar visualização não grava fatos acadêmicos.
- **Estados comprováveis:** `LOCAL_COMMITTED` ≠ envio ≠ ACK ≠ convergência ≠ backup restaurável. `INSUFFICIENT_DATA`/`STALE`/`PARTIAL` não se transformam em zero, dado fresco ou sucesso. Alertas críticos não podem ser ocultados pela estética.
- **Planos e sessões:** vínculo ≠ execução ≠ conciliação; Modo Foco é apenas apresentação da **mesma** sessão e relógio, sem duplicar tempo ou persistência.
- **Segurança:** não alterar outbox, tombstones, epochs, CAS, migração, backup, mecanismos de identidade ou restauração para implementar visual. Não manipular dados reais para teste.
- **Continuidade:** IDs e perfil de rotas, retorno, filtros, rascunhos, seleções, estado do foco e de sessões preservados em mudança de modal/tema/viewport.
- **Navegação D33:** mobile **Início · Plano · Estudar · Revisões · Mais**; demais módulos alcançáveis, inclusive recuperação.
- **Temas:** preservar Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex e Plasma; adicionar Neon Teal, Esmeralda e Dourado, Azul e Âmbar, Azul Glacial/Prata. Não inserir roxo nos quatro novos por padrão.
- **A11y:** foco/teclado/leitores de tela, contraste WCAG 2.2 AA como referência de aceite, alvos operáveis, `prefers-reduced-motion`, alternativa tabular a gráficos; verificar especialmente 320/390 px e 200% de zoom.
- **Simplicidade:** sem segunda biblioteca de componentes universal, roteador, IndexedDB, scheduler, engine de sync, design system ou cronômetro; sem framework novo, dependência paga ou automação GitHub.
- **Escopo Git:** `main` continua V1 e **intocável sem gate separado**. A `v2` é a linha existente para V2, conforme roadmap; `main-first` não autoriza misturar V1 com F7-UX. Sem branch/PR/Action nova por padrão; sem exclusões ou force push sem inventário, justificativa e aprovação.

### Exclusões explícitas

Este plano NÃO inclui implementar sincronização Firebase real, corrigir regras Firestore fora do escopo visual, ativar nuvem, assinar/configurar serviços, realizar staging público, migrar acervo real da V1, substituir V1, abrir F8, reescrever cálculos/dados por estética, persistir preferências por conta remota sem contrato ou publicar na `main`.

### Estratégia de execução futura

Etapas pequenas, com **RED → GREEN → REFACTOR → regressões locais → revisão do diff**. Um teste relevante que já passa deve ser registrado como cobertura existente; **não** introduzir falha artificial nem reimplementar requisito resolvido. Reaproveitar testes/snapshots úteis, usando fixtures sintéticas e browsers locais. Commits coesos por cluster validado, nunca um PR por ajuste. Não automatizar deploy ou CI.

---

## 3. Mapa de código a confirmar no preflight

**Referências históricas da implementação V2** (não garantem presença/assinatura no HEAD atual):

| Responsabilidade | Pontos de partida para inspeção (dentro de `apps/v2/`) |
|---|---|
| Shell/rotas/estado | `src/presentation/App.tsx`, `AppNav.tsx`, `routing.ts`, `use-hash-route.ts`, `ui-state.ts`, `draft-guard.ts` |
| Tokens e estilos | `src/presentation/tokens.css`, `styles.css`, componentes reutilizados e fontes locais |
| Home | `src/presentation/views/HomeView.tsx`, `src/application/experience-queries.ts`, `experience-cache.ts`, configuração/layout dos widgets já presentes |
| Conteúdo | `src/presentation/views/` e componentes `ContentTree`, `EditalManager`, `SubjectList`, `SubjectForm`, `LocalContentRepository` |
| Planejamento | `PlanningWorkspace`, `PlanningCalendar`, `PlanningWizard`, `PlanningEditor`, repositórios e serviços de cenários/capacidade |
| Sessões | `SessionWorkspace`, `session-clock`, `session-emergency`, registro/histórico e recuperação |
| Revisões | `ReviewWorkspace`, serviços de revisão, políticas versionadas, filas/histórico |
| Análises | `AnalyticsView`, queries/metrics/caches e tabela/editor de gráficos existentes |
| Busca/Atenção | `SearchView`, `AttentionView`, adaptadores de rota, eventos causais e estados de integridade |
| Configurações | `SettingsView`, SyncStatus, GoogleLink, SyncConflictsPanel, BackupControls, LocalBackupPanel |
| Testes | `apps/v2/tests/unit/`, `apps/v2/tests/e2e/` e scripts do `apps/v2/package.json` |

**Regra de nomes:** caminhos novos e arquivos de teste sugeridos nas tarefas são **candidatos**, não obrigação de criar arquivos. Descobrir e estender equivalentes existentes. Não modificar o `package.json` da V1 na raiz para executar testes da V2.

---

## 4. Sequência técnica e gates

| Etapa | Tarefas | Pré-requisito | Gate de saída |
|---|---|---|---|
| 0 — Resgate e baseline | RP-00, RP-01 | GOAL/autorização futura | Inventário, backup e delta real sem perdas |
| I — Fundação visual | RP-02, RP-03 | Etapa 0 | Tokens/12 temas/estados básicos estáveis |
| II — Shell e Home | RP-04, RP-05 | Etapa I | Navegação, atenção e Home contextual coerentes |
| III — Workspaces acadêmicos | RP-06, RP-07, RP-08, RP-09 | Etapa II | Conteúdo, Plano, Sessões, Revisões sem regressão |
| IV — Exploração e Configurações | RP-10, RP-11 | Etapa III | Analytics e Settings completos |
| V — Responsividade e acabamento | RP-12, RP-13 | Etapas II–IV | Mobile, a11y, feedback e performance validados |
| VI — Validação e encerramento | RP-14, RP-15 | Todas as anteriores | Pacote UX-H, revisão independente, situação Git precisa |

**Paralelização:** somente tarefas em arquivos/disciplina isolados, com revisão integradora ao final. RP-02/RP-03 compartilham tokens e devem ser sequenciadas. RP-06–RP-09 podem ser delegadas com limites de arquivo previamente definidos; ninguém altera o mesmo componente Shell/tokens ao mesmo tempo. G-EXT/G-STAGING não bloqueiam desenvolvimento local com mocks, mas continuam impedindo qualquer alegação de homologação externa.

---

## 5. Tarefas Superpowers — plano implementável, sem execução

### RP-00 — Preflight Git/GitHub e salvaguarda do trabalho local

**Fonte:** governança do projeto, risco R-V08; VA transversal. **Prioridade:** bloqueante antes de qualquer edição.

**Inspecionar:** raiz, `apps/v2`, docs do repo, `HEAD`, `main`, `v2`, `origin/v2`, branches remotas/locais, worktrees, stash, untracked, patches, PRs, workflows preexistentes, lockfile, testes/skills e pacotes de evidência. Conferir `29d35c2c`/`0c31e6ef` como **marcos históricos** e mapear todos os commits únicos com `git log --left-right --cherry-pick` e `merge-base`; registrar eventuais alterações posteriores.

**Verificações read-only iniciais sugeridas:**

```bash
pwd
git status --short --branch
git rev-parse --show-toplevel HEAD
git branch -vv
git branch -a
git worktree list --porcelain
git stash list
git remote -v
git log --oneline --decorate -20
git log --left-right --cherry-pick --oneline origin/v2...v2
git merge-base --is-ancestor origin/v2 v2 && echo 'remote ancestral'
# Se gh estiver disponível e autenticado:
gh pr list --state open --repo matheussilva421/estudo-organizado
```

**Salvaguarda:** se houver trabalho não publicado, gerar cópia verificável (`git bundle` e, se necessário, backup de arquivos não rastreados sem credenciais), `git bundle verify`, SHA-256 e inventário externo à árvore. Não tocar em arquivos/commits exclusivos até confirmar sua preservação. Não usar `reset --hard`, `git clean -fd`, `git gc --prune`, `force push`, `rebase` destrutivo nem excluir branches no preflight.

**Critério de saída:** checkout correto e conteúdo íntegro identificados; nenhum trabalho único sem proteção; discrepancies documentadas; estado remoto/local separado. **Se o workspace estiver em conflito ou incerto:** tratar primeiro o saneamento não destrutivo; não iniciar RP-01 com código sobreposto.

### RP-01 — Delta aprovado × implementação real, fixtures e baseline visual

**Fontes:** D01–D71, DV-01–DV-18, AC-01–AC-24, VA-01–VA-20; pacote de revisão 10/11. **Depende:** RP-00.

**Inspecionar:** componentes e CSS atuais, funcionalidades UX-01–UX-31, capturas integradas antigas, estados vazios/ricos/críticos e pequenos defeitos P2. Verificar o que já existe e classificar cada VA como `REUSE/PARTIAL/MISSING/BLOCKED`, com evidência e custo técnico estimado; não copiar cegamente a matriz histórica que antecede os últimos commits.

**Teste a estabelecer:** nova fixture sintética ou ampliar teste E2E existente de smoke para 8 módulos, contexto vazio, estado crítico, tema e sessão ativa, **sem alterar dados reais**. Registrar baseline desktop (>=1024), tablet (721–1023), 390 e 320 px, zoom 200%; comparação visual atual + referências premium. Capturar DOM e navegação de teclado, não só screenshots.

**Aceite:** matriz VA×componente/arquivo/teste verificada; lista objetiva do que **não será refeito**; P2 reproduzidos ou classificados `NOT_REPRODUCED`; inexistência de segundo motor/domínio e preservação do baseline F7. **Sem mudança de produto** nesta tarefa.

### RP-02 — Temas premium, galeria e preferências visuais

**Fontes:** DV-01–DV-03; VA-01–VA-04, VA-16 e VA-20; D26–D29/D65–D68. **Depende:** RP-01.

**Inspecionar/estender:** tokens/temas existentes, seletor de tema, persistência local/perfil, `SettingsView` ou composição equivalente; inventário de cores semânticas. Preservar oito temas originais, adicionar os quatro aprovados; galeria de 12 com miniatura, tema selecionado, prévia, aplicação sem reload, restauração e fallback. Ajustes por tema: glow desligado/sutil/moderado/alto, animação desligada/sutil/completa, densidade compacta/confortável/espaçosa e apresentação dos cards, **dentro das capacidades reais**, sem prometer sync remoto.

**RED:** teste de catálogo exato de 12 IDs únicos e migração conservadora de preferências antigas; teste de alteração instantânea e persistência após refresh; teste de sessão/rascunho intactos; teste de motion reduzido com precedência; cenário de valor desconhecido/falha de persistência sem zerar preferências acadêmicas.

**GREEN/REFACTOR:** estender tokens semânticos existentes, semantic colors separadas de cores de disciplina/estado, galeria acessível e controles reutilizáveis. Não usar tons roxos como default dos quatro novos temas. Não clonar todo CSS por tema.

**Provas de saída:** VA-01–VA-04, VA-16/20 com logs e capturas; contraste e foco para todos os temas; nenhum PWA reload provocado; estado de seleção e reset coerentes; preferência sobrevive à atualização do app no escopo real.

### RP-03 — Sistema `Layered Premium` e feedback semântico

**Fontes:** DV-06, DV-08, DV-09, DV-18; VA-08, VA-09, VA-18, VA-19. **Depende:** RP-02.

**Inspecionar/estender:** card, surface, hero, inspeção lateral, campo, feedback, status e toast existentes; `ui-state`, SyncStatus e projeções. Construir composição em camadas **apenas** se ela não existir; superfícies sólidas para leitura e gradientes/vidro/brilho **seletivos**, sob tokens de tema.

**RED:** snapshots semânticos dos estados `LOCAL_COMMITTED`, `PENDING`, `ACK`, `PARTIAL`, `STALE`, `CONFLICT`, `REBASELINE_REQUIRED`, `INSUFFICIENT_DATA`; alerta crítico persistente e acessível; indicador indeterminado para duração não mensurável; microinteração desligada sob `prefers-reduced-motion`. Teste que a linguagem visual não converte ACK específico em convergência nem `SAFE` de preview em backup restaurado.

**GREEN:** feedback inline nos pontos de ação; notificações efêmeras somente quando adequadas; alertas críticos com nome acessível; sem novo mecanismo de estado global, sem render gerar ação. Reusar abstrações existentes.

**Provas:** mesma evidência produz mensagem consistente em Home/Atenção/Settings; zero mudança de fatos por troca de aparência; a11y de alertas; sem animações obrigatórias; VA-08/09/18/19.

### RP-04 — Shell, Busca, Central de Atenção e Command Center

**Fontes:** DV-15, D31–D36, D69–D71; VA-15/19/20. **Depende:** RP-03.

**Inspecionar/estender:** `App.tsx`, `AppNav.tsx`, rotas e buscas já existentes, `AttentionView`; manter `overview` histórico e todas as rotas. Cabeçalho discreto, abertura visível e pelo atalho compatível de teclado, acesso rápido a destinos existentes e resultados da busca global. Command Center **não** executa mutações sem comando/consentimento e não cria índice remoto.

**RED:** deep-link com ID exato e perfil correto; item arquivado/excluído/cross-profile; retorno/foco após paleta; `Ctrl+K`/atalho acessível sem interceptar entrada de texto inapropriadamente; deduplicação de atenção; saída com rascunho; menu mobile D33 com cinco destinos.

**GREEN:** recompor Shell existente e encaixar Command Center em busca/roteador atuais; preservar indicações críticas e caminhos de recuperação; evitar poluição permanente por health/status.

**Provas:** VA-15/19/20; regressão de busca/atenção e de navegação F6/F7; foco volta ao gatilho; não altera o contexto de sessão em andamento.

### RP-05 — Home Bento contextual e onboarding progressivo

**Fontes:** DV-04–DV-08, D01–D29; VA-05–VA-09. **Depende:** RP-04.

**Inspecionar/estender:** `HomeView`, queries do dashboard e configurações de widgets/layout já presentes. Usar hero contextual + widgets auxiliares. Contextos a derivar somente de dados existentes: primeiro uso, rotina diária, prova/Reta Final e desempenho. Checklist inicial curto, dispensável, sem obrigar configurar tudo, sem KPI zero inventado.

**RED:** fixtures vazia/completa/reta final/amostra insuficiente; preferência manual/fixada vence adaptação; rearranjo significativo **sugere e espera aceite**; prioridade leve não muda DOM/foco abruptamente durante sessão ativa; widgets e fórmulas antigas persistem; mudança de contexto não registra estudo nem altera conteúdo.

**GREEN:** recompor layout do painel e onboarding sem duplicar projeções; preservar catálogo/editor e filtros globais/locais. Estratégia de transição com aviso claro e controle manual. Não inferir urgência de prazo inexistente.

**Provas:** VA-05/06/07/08/09, AC-01/03/04/13; screenshots vazia/rotina/reta-final/desempenho; regressão de responsividade, zoom e ação primária.

### RP-06 — Knowledge Studio Premium (Conteúdo)

**Fontes:** DV-14, D37–D43; VA-14. **Depende:** RP-04/RP-03; pode ser implementada em paralelo a outras áreas após congelar tokens.

**Inspecionar/estender:** `EditalManager`, `ContentTree`, `SubjectList`, `SubjectForm`, serviço F2. Biblioteca visual de concursos/editais/disciplinas, com cards de entrada **sem fingir progresso**, árvore eficiente e inspetor contextual com identificador/perfil reais.

**RED:** edital grande e tópicos homônimos; expansão/colapso; item ausente/arquivado; mover por teclado e drag-and-drop com validação de ciclos; associação aula↔assunto; rascunho protegido quando fechar detalhe; navegação mobile por níveis preserva seleção.

**GREEN:** recompor superfícies, reaproveitando CRUD e comportamento de conflito. Proibida árvore paralela que escreva em segundo store.

**Provas:** VA-14, AC-06; perfis/IDs íntegros, performance de lista extensa sem medição fabricada; capturas desktop/320/390; a11y de árvore e formulário.

### RP-07 — Adaptive Planning Studio

**Fontes:** DV-11, D44–D49, D52; VA-11. **Depende:** RP-04/RP-03.

**Inspecionar/estender:** `PlanningWorkspace`, `PlanningCalendar`, cenários, disponibilidade, assistente e histórico. Três vistas principais **Semana/Mês/Lista**, mantendo **Dia** por D46. Preferência visual persistente; blocos com e sem horário; detalhes/capacidade/conflitos em contexto.

**RED:** alternância repetida de vistas preserva filtros, cenário, seleção e rascunho; não gera commits em domínios; horas compartilhadas não duplicadas; prévia de replanejamento vencida por CAS falha corretamente; item com sessão vinculada mas sem conciliação continua não cumprido; Dia alcançável no mobile.

**GREEN:** selecionar apresentação a partir de queries e serviços existentes, sem novo motor de calendário/replanejamento. Prévia/consentimento antes de mudanças materiais; não ocultar estados críticos por densidade.

**Provas:** VA-11, AC-07/08/19; agenda e lista semanticamente reconciliadas; screenshots semana/mês/lista nos tamanhos-alvo.

### RP-08 — Adaptive Focus Premium para Sessões

**Fontes:** DV-10, D50–D54; VA-10/19. **Depende:** RP-04/RP-03; **risco máximo de regressão funcional do redesign**.

**Inspecionar/estender:** `SessionWorkspace` e componentes do timer, sessão atual, emergency checkpoint, rascunhos e ações já existentes. Adicionar **somente uma nova apresentação**: Modo Foco imersivo opt-in, jamais outra sessão ou relógio; materiais/anotações acessíveis; retorno sem reset.

**RED:** relógio falso determinístico com iniciar→Foco→pausar→retornar→continuar→concluir; assertiva de **uma sessão**, tempo verificado idêntico e pausa preservada; recuperação offline/crash simulado conforme contratos; duas abas; alertas críticos perceptíveis em foco; alternância não faz writes extra.

**GREEN:** reusar exatamente callbacks e estado do controller atual; foco não cria rota que desmonta o serviço/clock; ocultar distrações sem esconder saída/ação crítica; regras de precisão intactas.

**Provas:** VA-10/19, AC-05/09/15; E2E com read-back; tempo manual/incerto/verificado distinguíveis; inspeção independente desse delta prioritária.

### RP-09 — Adaptive Review Studio

**Fontes:** DV-12, D55–D59; VA-12. **Depende:** RP-04/RP-03.

**Inspecionar/estender:** `ReviewWorkspace`, repositório, políticas e histórico. Fila explicável, execução focada, histórico auditável em calendário/linha do tempo; sem criar estados ou agendamentos por render.

**RED:** compromisso iniciado (`STARTED`) segue aberto após mudar vista; avaliação só conclui com ação válida; edição de política não reescreve história; filtro vazio e contagem acessível; retorno da prévia restaura foco; atraso e prioridade derivam da fonte correta.

**GREEN:** composição por telas/painéis existentes com mesmas queries e comandos, sem segunda política de revisão.

**Provas:** VA-12, AC-10/11/14; execução/histórico reconciliados e testados a 320 px; fixtures de política versionada e casos sem compromissos.

### RP-10 — Insights Studio Premium

**Fontes:** DV-13, D30/D60–D64; VA-13. **Depende:** RP-03/RP-04; queries preexistentes verificadas em RP-01.

**Inspecionar/estender:** `AnalyticsView`, métricas auditáveis, editor semântico, cache e relatórios. Construir visual geral expressivo e modo de exploração com gráfico + tabela, mesma amostra e metodologia; evitar parede de KPI e duplicação do motor de análise.

**RED:** datasets com amostra insuficiente; dados `STALE`/`PARTIAL`; duas provas compartilhando sessão sem somatório dobrado; numeradores/denominadores e unidades idênticos em gráfico/tabela/CSV; snapshot histórico preserva versão; filtros e drill-down não alteram fatos.

**GREEN:** reorganizar painéis e interação reaproveitando o editor/queries; exposição clara de advertências/método; gráfico não depende só de cor/hover, teclado e tabela equivalentes.

**Provas:** VA-13, AC-12/13/14; screenshots em temas contrastantes; amostra real de fixtures sintéticas auditável.

### RP-11 — Settings Studio Premium e operações protegidas

**Fontes:** DV-16, D65–D68; VA-16/18/19. **Depende:** RP-02/RP-03.

**Inspecionar/estender:** `SettingsView` e painéis de Perfil, Aparência, Sync, Backup, IndexedDB e Privacidade. Reorganizar em categorias; incorporar galeria de RP-02 sem recriá-la; informações técnicas sob demanda, mas recuperação sempre acessível.

**RED:** troca de tema não apaga outras preferências; perfil desconectado preserva estudos offline; `LOCAL_COMMITTED`, ACK e preview `SAFE` não criam confirmação enganosa; conflito/cota/migração bloqueada mostram operação correta; botão cosmético nunca aciona delete/restore/sync.

**GREEN:** reorganizar composições existentes; nenhuma nova permissão, API/fluxo remoto ou operação destrutiva. Reutilizar guardas de confirmação e validação de backup.

**Provas:** VA-16/18/19, AC-15–AC-20/23; testes sintéticos de proteção sem tocar banco pessoal; caminhos de backup/recuperação navegáveis com teclado.

### RP-12 — Adaptive Mobile Layers e continuidade entre viewports

**Fontes:** DV-17, D31–D33/D69–D71; VA-17/19/20. **Depende:** RP-04–RP-11.

**Inspecionar/estender:** modais, contexto lateral, sheets, focus-trap e responsividade. **Bottom sheet** para interação breve; **tela dedicada** para formulário ou operação protegida; desktop com inspector. Não criar dois formulários com lógica distinta para mobile e desktop.

**RED:** abertura/fechamento por toque, teclado, Escape/voltar e navegação assistiva; retorno de foco; 320/390 px; 200% zoom; teclado virtual/tela baixa; rotação/resize com rascunho ativo; sessão permanece estável; caminho para alerta crítico não pode ficar encoberto pela bottom nav.

**GREEN:** adaptar composição responsiva com um único estado e handlers, preservando D33; sem interceptação desnecessária de tecla; não usar modal para formulário que exige tela inteira.

**Provas:** VA-17/19/20, AC-03/05/22/24; capturas e DOM/foco; nenhum scroll horizontal ou controle crítico inacessível.

### RP-13 — Auditoria visual, acessibilidade, motion e desempenho

**Fontes:** DV-01–DV-18, VA-01–VA-20; D69–D71. **Depende:** RP-02–RP-12.

**RED de regressão:** ampliar testes de tokens/contraste dos 12 temas e estados; foco visível, semântica de árvore/paleta/gráfico, densidade, dark/light se compatíveis, reduzir movimento, 320/390/720/721/1023/1024 px, zoom e telas pequenas; alertas críticos em Foco/sheet.

**Medições:** capturar custo antes/depois em hardware local disponível, tempo perceptível de navegação, uso de memória/reflow e cronômetro; **sem inventar alvo de FPS**. Reduzir blur/transparência em dispositivo modesto se medido; não eliminar a11y para manter estética.

**Validação manual:** NVDA/Narrator e dispositivo físico se disponíveis e autorizados, anotando `NOT_RUN_ENVIRONMENT` se não; não declarar conformidade WCAG integral apenas com axe/lint. Conferir RTL se o produto já o suportar; não ampliar escopo sem necessidade.

**Provas:** VA-01–VA-04 e VA-17–VA-20; matriz por viewport × tema × estado, com amostragem registrada (não multiplicação combinatória cega); revisão independente de contraste/a11y.

### RP-14 — Regressão final, revisão independente e pacote UX-H

**Fontes:** todos AC-01–AC-24, VA-01–VA-20, UX-01–UX-31 e gates F7. **Depende:** RP-00–RP-13.

**Etapas:** (1) executar unitários de módulos alterados, testes integrados e E2E de jornada; (2) rodar os scripts realmente presentes em `apps/v2/package.json`; (3) verificar typecheck, lint e build; (4) testar offline/refresh/dados sintéticos/sessões/identidade/recuperação; (5) revisão independente focada em invariantes, acessibilidade, CSS duplicado e regressões; (6) corrigir achados materiais; (7) rerun proporcional e comparar contra baseline; (8) elaborar matriz AC/VA com PASS/FAIL/BLOCKED/SKIP/NOT_RUN e evidência por linha.

**Comandos candidatos (confirmar no HEAD real):**

```bash
cd apps/v2
npm ci                     # somente se lockfile/ambiente corretos e sem risco para dados
npm run typecheck
npm run lint
npm run build
npm run test:unit
npm run test:e2e           # suite local; controlar recursos e fixtures
```

**Evidências mínimas:** logs com comando/versão/exit code; screenshots antes/depois de Home + todos os módulos em desktop/tablet/390/320; galeria 12 temas; Modo Foco/alertas; vídeo/trace curto de interações complexas quando útil; testes de rotas, read-back e backup; README de reprodução; SHA-256 dos arquivos de evidência importantes. Evitar artefatos enormes e PII.

**Critério de saída:** nenhuma regressão P0/P1 em integridade, identidade, tempo, revisão, recuperação, persistência, a11y impeditiva ou falsa confirmação remota; P2 explicitados e priorizados; **não declarar aceite humano antes do UX-H**. O próximo passo pode ser avaliação visual pelo proprietário com demo local, sem presumir G-STAGING.

### RP-15 — Integração autorizada, documentação enxuta, higiene Git e ZIP

**Fontes:** governança do projeto; gates G-MAIN/G-CLOSURE; depende RP-14.

**Documentação:** atualizar **preferencialmente o ROADMAP/estado existente**, vinculando spec premium, plano e resultados. Preservar D01–D71/DV-01–DV-18, histórico e timestamps; não produzir relatórios redundantes, não reescrever documentos aprovados para trocar status na capa. Consolidar um relatório final e uma matriz de evidências.

**Git:** antes de qualquer push/merge **exigir autorização específica** e verificar que mudanças foram revisadas, ancestrais corretos, nenhum commit exclusivo de branch/worktree/stash perdido, backup verificado, árvore limpa e nenhum conflito. Preparar integração segura à **`v2`** quando autorizada; **nenhuma integração `v2`→`main`** ou publicação sem gate separado. Sem force push, reset, nova Action/CI ou PR desnecessário.

**Higiene:** procurar branches/PRs/worktrees/stashes órfãos e duplicados; limpar **somente** itens comprovadamente integrados e autorizados. Registrar itens exclusivos ou inseguros sem apagar. Distinguir documentação local, commit local, push `v2`, merge `main` e deploy.

**ZIP futuro do GOAL**, sem node_modules/build/caches e sem segredos: `SUMMARY.md`, `GIT-STATE.md`, `ACCEPTANCE-MATRIX.md` (AC-01–AC-24 + VA-01–VA-20), `TEST-RESULTS.md`, `VISUAL-REVIEW.md`, `P2-AND-GATES.md`, links/versões das specs e planos, screenshots sanitizados e `SHA256SUMS.txt`. Verificar ZIP e hashes por read-back. **O pacote de planejamento atual não equivale a esse ZIP de implementação.**

---

## 6. Matriz de rastreabilidade das decisões visuais

| Decisão | Entrega | Tarefas | Aceite |
|---|---|---|---|
| DV-01 | 4 novos temas, preservar 8 | RP-02, RP-13 | VA-01/02/20 |
| DV-02 | Galeria de 12, tema instantâneo/persistente | RP-02, RP-11 | VA-02/03/16 |
| DV-03 | Glow, motion, densidade, cards | RP-02, RP-13 | VA-04/20 |
| DV-04 | Home contextual por dados reais | RP-05 | VA-05/06 |
| DV-05 | Adaptação leve, rearranjo grande confirmado, layout fixado | RP-05, RP-08 | VA-07 |
| DV-06 | Hybrid Workspace Premium | RP-03, RP-05–RP-11 | VA-08 |
| DV-07 | Onboarding Premium Progressivo | RP-05 | VA-05 |
| DV-08 | Progressive Workspace em três camadas | RP-03–RP-12 | VA-09/19 |
| DV-09 | Layered Premium | RP-02/RP-03/RP-13 | VA-04/08/20 |
| DV-10 | Adaptive Focus Premium | RP-08 | VA-10/19 |
| DV-11 | Adaptive Planning Studio | RP-07 | VA-11 |
| DV-12 | Adaptive Review Studio | RP-09 | VA-12 |
| DV-13 | Insights Studio Premium | RP-10 | VA-13 |
| DV-14 | Knowledge Studio Premium | RP-06 | VA-14 |
| DV-15 | Contextual Command Center | RP-04 | VA-15 |
| DV-16 | Settings Studio Premium | RP-02/RP-11 | VA-16 |
| DV-17 | Adaptive Mobile Layers | RP-12 | VA-17/19/20 |
| DV-18 | Contextual Motion & Feedback | RP-03/RP-11/RP-13 | VA-18/19 |

**Cobertura:** 18/18 DVs mapeadas; 20/20 VAs com tarefa principal ou transversal. A matriz **não atesta PASS** e não modifica a numeração original D01–D71/AC-01–AC-24/UX-01–UX-31.

### Relação com as tarefas UX históricas

- UX-01–UX-08 → RP-00/01/03/04/12/14: preflight, estados, Shell, Atenção, Busca e proteção de contexto; **revalidar em vez de refazer**.
- UX-09–UX-13 → RP-05, RP-02/03: Home, widgets, fórmulas e filtros permanecem; rearranjar apresentação, não criar novos motores.
- UX-14–UX-21 → RP-06/07/08/09: conteúdo, planejamento, sessões e revisões com domínio existente intacto.
- UX-22–UX-27 → RP-10/11: Análises/Configurações, sem redefinir metodologia, exportação ou backup.
- UX-28–UX-31 → RP-02/03/12/13/14/15: design system, responsividade, testes, revisão e integração protegida.

---

## 7. Matriz de testes e estratégias de evidência

| Classe | Cenários essenciais | Prova necessária |
|---|---|---|
| Unitários | Catálogo 12 temas, seleção/preferência, estados de UX, prioridades derivadas, view state, seleção de modo | Vitest PASS + casos de falha e regressão |
| Integração de apresentação | Mesmo domínio nas duas interfaces, preservação de instância de timer, filtros, rotas, perfil e draft guard | Re-render/read-back com fixtures; nenhuma segunda escrita |
| E2E crítico | Home vazia; 12 temas; Foco; planejamento 4 vistas; revisão; busca/atenção; sheet→tela dedicada; backup conflitante | Playwright PASS + trace/capturas saneadas |
| Integridade | Persistência local vs ACK vs convergência, preview SAFE, tombstones/epoch, CAS, sessão compartilhada | Testes de evidência, estado preciso e logs |
| Responsividade | Desktop, tablet, 390/320 px, 200% zoom, teclado e navegação D33 | Screenshots + checagens DOM/overflow/foco |
| A11y | Contraste em 12 temas, leitores de tela, live region, foco, nome de botões, motion reduzido | Automação e testes manuais identificados separadamente |
| Regressão | Rotas legadas, editor de widgets, fórmulas, histórico, V1 independente, offline/PWA | Unit + E2E anteriores sem desativar testes |
| Performance | Reflow/latência, árvore volumosa, gráficos e Foco no dispositivo disponível | Medição antes/depois com condições explícitas, sem número inventado |

**Cobertura eficiente:** galeria, foco e tokens avaliados nos 12 temas; cross-product completo tema×viewport×estado só quando risco justifica. Registrar pares não testados como cobertura parcial, não PASS global. Usar screenshots somente como evidência visual; integridade de dados exige assertions/leitura independente.

---

## 8. Critérios de parada, aceite e gates

### G-P — Aprovação do plano

Este documento permanece **`PLAN_PROPOSED_AWAITING_APPROVAL`** até manifestação expressa do proprietário. Aprovar o plano autoriza **preparar o GOAL**, não executar código automaticamente, publicar no GitHub, alterar serviços ou dados reais.

### G-I — Início da execução

Exige pedido explícito de execução/GOAL, identificação do ambiente/repo e RP-00 comprovado. Se não houver acesso local, o primeiro ato autorizado do Codex será **diagnóstico**, não merge nem limpeza. Poderá prosseguir de forma autônoma nas escolhas técnicas rotineiras cobertas pelo escopo; mudanças arquiteturais materiais, dados reais, custos, remoções destrutivas e alterações de infraestrutura são gates humanos.

### G-Q — Qualidade local

RP-14 com testes e evidências reais, zero P0/P1 abertos no escopo crítico, regressão contra F7 anterior, VA-01–VA-20 classificados. Classificar falhas ambientais como `NOT_RUN_ENVIRONMENT` e registrar impacto; não falsificar PASS nem gerar artefatos de performance sem medição.

### G-H — Aceite visual humano

Demonstração dos quatro temas adicionais, módulos, Home e Modo Foco em viewports-alvo; comparação com mockups conceituais, sem exigir fidelidade pixel-perfect. Aceite do proprietário é específico e separado de G-Q e G-EXT/G-STAGING.

### G-GIT — Integração segura e saneamento

Somente executar push/merge se autorizado, após validação de ancestralidade, preservação de commits exclusivos e verificação de destino. `main` V1 não recebe o redesign sem autorização expressa. Encerramento real da fase exige integração autorizada ou bloqueio precisamente reportado, revisão de branches/PRs/worktrees e inexistência de trabalho perdido.

### G-EXT / G-STAGING / F8 — Fora do escopo

Permanecem com seus gates originais; um redesign bonito e testes locais PASS não comprovam sync multi-dispositivo real, segurança remota, staging ou publicação. Nada neste plano desbloqueia F8.

---

## 9. Riscos principais e mitigação

| Risco | Prioridade | Prevenção / evidência |
|---|---|---|
| Perder os 94 commits locais históricos por base errada | Crítico | RP-00, bundle verificável, comparação remoto/local, sem reset/force |
| Duplicar clock/sessão no Modo Foco | Crítico | RP-08, controller único, E2E relógio falso/read-back |
| Mascarar sync/backup ou conflito com novo visual | Crítico | RP-03/11, estados T-03 e E2E críticos |
| Adaptar Home no meio da sessão / alterar DOM/foco | Alto | RP-05/08, layout fixado e aceite de rearranjo grande |
| 12 temas criarem CSS paralelo e baixo contraste | Alto | RP-02/03/13, tokens semânticos únicos, testes nos 12 |
| Mobile esconder botões e recuperação | Alto | RP-12/13, 320px/zoom/teclado/sheets |
| Reescrever domínio funcional F7 e regredir | Alto | RP-01 mapa REUSE, componentes de apresentação, revisão independente |
| Baixa performance com blur/gradiente | Médio | RP-03/13, efeitos opcionais e medição antes/depois |
| P2 antigo desaparecer sem resolver | Médio | RP-01/14, inventário e status específico |
| Proliferar PR, branches, workflows e docs | Médio | RP-15 e GOAL único/coerente, sem Actions novas |

---

## 10. Checklist de aceite do próprio planejamento

- [x] Fonte premium aprovada identificada, sem substituir a spec F7-UX original.
- [x] D01–D71 e DV-01–DV-18 preservadas; VA-01–VA-20 mapeadas.
- [x] Mapa de evolução da implementação F7-UX anterior; nenhum recomeço de F2–F7.
- [x] Preflight Git local e preservação de commits não publicados como bloqueante.
- [x] Etapas e tarefas com dependências, TDD, critérios de aceite, riscos e evidências.
- [x] Regressão funcional e proteção de identidade, sessão, persistência e backup.
- [x] Plano de testes local, análise de a11y, mobile e 12 temas, sem CI nova.
- [x] Gates de aprovação, integração separada, higiene Git e ZIP futuro.
- [ ] **Aceite humano deste plano.**
- [ ] **Autorização posterior de preparar/usar GOAL.**
- [ ] **Preflight real no computador; implementação; testes; UX-H; integração.**

## 11. Resultado e próximo marco

**Resultado desta etapa documental:** planejamento Superpowers em **16 tarefas RP-00–RP-15**, agrupadas em etapas 0–VI, com rastreabilidade aos 18 DVs e 20 VAs; execução **não iniciada**. A futura preparação de GOAL, mediante aceite humano, deverá converter este plano em prompt completo com preflight real, escopo, TDD, revisão, integração permitida, higiene e ZIP de evidências.

**Estado pretendido após aprovação:** `F7_UX_PREMIUM_PLAN_APPROVED_GOAL_NOT_PREPARED`. Aprovação documental não implica GOAL nem autorização de publicação. O relatório do Codex, quando houver, deverá separar `IMPLEMENTED_LOCAL`, `TESTED_LOCAL`, `INTEGRATED_V2`, `MERGED_MAIN`, `DEPLOYED` e `UX_HUMAN_ACCEPTED` e comprovar cada um.
