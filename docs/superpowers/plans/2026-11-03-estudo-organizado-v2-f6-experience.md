# Estudo Organizado V2 — F6: Writing-plans Superpowers
## Plano executável aprovado — Experiência Integrada

**Data:** 2026-11-03  
**Estado:** `F6_PLAN_APPROVED` — T00–T20 aprovado expressamente em 2026-11-03; execução condicionada à invocação do GOAL no Codex e aos gates de segurança.  
**Autorização registrada:** escrever e aprovar o plano; GOAL único preparado posteriormente. Nenhum teste nem código da F6 foi executado durante a elaboração documental.  
**Repositório:** `matheussilva421/estudo-organizado` — branch de desenvolvimento `v2`; V1 permanece na `main`.  
**HEAD remoto consultado (somente leitura):** `v2@339eae5eca5460b4c6a7ff8d5705429b82ec8cc3`; `main@9046cfa2283cd293b38df9d52fabfcd5de9ac67c`; nenhum PR aberto na consulta. Não confundir isso com inventário de worktrees/branches locais.  
**Base de autoridade:** especificação formal F6 de 2026-11-03, **aprovada expressamente em conversa**, SHA-256 do arquivo entregue: `aad69677511ca53e202db8cec72bebffb8424b9a27bd40b0464b3344d1ca158d`; decisões **D-F6-01 a D-F6-22, todas B**; spec-mestra V2 e roadmap vigentes.  
**Referência canônica da especificação aprovada:** `docs/superpowers/specs/2026-11-03-estudo-organizado-v2-f6-experience-design.md` (a ser publicada na `v2`). O SHA-256 do anexo original abaixo é registro de proveniência, não hash do documento com status atualizado.  
**Proposta F6 histórica:** `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f6-experience-design.md`, ainda marcada `SPEC PROPOSTA`; preservá-la como histórico, sem confundi-la com a nova spec aprovada.  
**Destino autorizado deste plano:** `docs/superpowers/plans/2026-11-03-estudo-organizado-v2-f6-experience.md` (branch `v2`).  
**Destino autorizado da especificação:** `docs/superpowers/specs/2026-11-03-estudo-organizado-v2-f6-experience-design.md` (branch `v2`).

> **Contrato de autorização:** a aprovação da spec permite redigir este plano; não autoriza implementação. Uma eventual aprovação deste plano também não implica automaticamente execução, GOAL, integração, push, merge, deploy, migração ou alteração de `main`. Esses atos exigem autorização própria e gates adequados.

---

## 1. Objetivo, resultado verificável e regra de simplicidade

Entregar, **quando houver autorização futura de execução**, uma experiência React/TypeScript/PWA V2 coesa que reúna F2 Conteúdo, F3 Planejamento, F4 Sessões e F5 Revisões, conservando seus contratos de domínio e a autoridade do IndexedDB. Incluir as dez capacidades F6: shell, facades de compatibilidade, Home, analytics, busca, atenção local, configurações, oito temas, acessibilidade e estados confiáveis de interface.

**Regra de desenho:** compor o que já existe, criando uma abstração **somente** quando for utilizada por duas ou mais áreas ou quando um contrato de segurança a exigir. Não substituir os repositórios, não criar um segundo motor de revisão/planejamento, nem consolidar dados em estado global editável. Preferir pequenas mudanças revisáveis no monólito modular existente. O número de tarefas deste plano é uma organização para aceitação, **não** uma ordem de criar um commit/branch/PR para cada tarefa.

### 1.1 Resultado mínimo que a F6 precisa demonstrar

1. Estudante consegue **Organizar → Planejar → Estudar → Revisar → Analisar → Configurar** na mesma aplicação, por teclado, mouse e toque, com navegação e histórico coerentes.
2. Home apresenta **sessão ativa/ação verificável** e prioridades com justificativa, sem executar comandos ocultos ou ocultar avisos críticos.
3. Analytics apresenta números derivados de F2–F5, com unidade, escopo, período, denominador e dados parciais identificados, **sem dupla contagem**.
4. Busca local e offline navega até uma entidade válida, mesmo fora do conjunto atualmente renderizado, sem expor dados de outro perfil.
5. Notificações locais, configurações, erros, rascunhos e estados de sync são **verdadeiros**, com preservação de edição e sem prometer backend F7.
6. Oito temas e composição desktop/tablet/mobile são utilizáveis, preservando PRODUCT.md/DESIGN.md e apresentando evidências Impeccable.
7. Testes locais e revisão independente demonstram ausência de regressões materiais F2–F5 e **protegem as evidências históricas F4**.

### 1.2 Fora de escopo vinculante

**F7:** Firebase Auth/Firestore/Google Sign-In reais, UID, convergência multi-dispositivo, migração de teste V1, backup/restore real, piloto integrado, homologação PWA de clientes divergentes e segurança remota.  
**F8:** G5, cutover, alteração de `main` produtiva, deploy, migração final e contingência de produção.  
**Não fazer na F6:** editor livre de widgets, `F-V1-VISUAL-LAYOUT-LAB`, motor de recomendações por IA, novas regras de revisão F5, novo banco canônico, segunda outbox, push com PWA fechado, novos peers de sincronização, bibliotecas pesadas sem benchmark, login obrigatório, CI/CD/Actions, novos PRs por rotina, reescrita da V1 ou limpeza destrutiva.

---

## 2. Diagnóstico técnico conhecido e fontes a conferir no preflight

### 2.1 Caminhos reais conferidos na branch remota `v2`

| Área | Caminhos existentes conferidos | Uso no plano |
|---|---|---|
| Inicialização | `apps/v2/src/main.tsx` | Montagem e registro de SW; preservar harness E2E |
| Shell atual | `apps/v2/src/presentation/App.tsx` | Hoje concentra conteúdo F2 e monta módulos; refatorar por composição, não reescrever tudo |
| Módulos visuais | `presentation/PlanningWorkspace.tsx`, `SessionWorkspace.tsx`, `ReviewWorkspace.tsx` | Adaptar por props/rotas mínimas, sem duplicar operações |
| Componentes F2/F3 | `presentation/components/ContentTree.tsx`, `EditalManager.tsx`, `PlanningCalendar.tsx`, `PlanningDashboard.tsx`, `SyncStatus.tsx`, outros | Reutilizar e enriquecer sem substituir indiscriminadamente |
| UI/temas | `presentation/ui-state.ts`, `tokens.css`, `styles.css` | Oito temas já listados; revisar tokens e estados existentes |
| Consultas | `application/planning-queries.ts`, `session-queries.ts`, `review-service.ts` | Consultas de calendário, histórico paginado e revisões já existem |
| Perfil/concorrência | `application/profile-service.ts`, `platform/local-profile-repository.ts`, `platform/local-events.ts` | Perfil local, revisão/CAS e eventos entre abas |
| Banco | `platform/indexeddb.ts`, `platform/local-review-repository.ts` | Stores existentes, incluindo `review_projections` e `review_settings`; evitar banco novo |
| Atualização PWA | `platform/sw-update.ts` | `canApplyV2Update`, política de atualização sem reload automático |
| Testes | `apps/v2/tests/unit/`, `apps/v2/tests/e2e/`, `playwright.config.ts` | Vitest + Playwright local; diretórios de evidência preservados |
| Ferramentas | `apps/v2/package.json` | React 19, Vite, TypeScript, Vitest, Playwright; **router e biblioteca de gráficos não constam das dependencies** |

**Observação de integração:** no trecho consultado, `App.tsx` usa `PROFILE_ID = 'local-default'`, mantém tema somente em estado React e monta os workspaces. O plano deve preservar o comportamento offline atual e não confundir `primaryEditalId` persistido com `selectedEditalId` de apresentação. Qualquer suporte a mais de um perfil deve seguir os contratos existentes, sem simular login F7 ou inventar uma troca de contas já funcional.

**Observação sobre indexação/escala:** `session-queries.ts` já usa cursor com desempate por ID; `planning-queries.ts` já dispõe de consultas por intervalo e contempla sobreposição temporal. **Reusar antes de criar novas consultas.** `review_projections` já possui fingerprint/CAS; não criar um segundo ranking materializado.

**Observação sobre SW:** `sw-update.ts` já oferece guardas de atualização e operações separadas de reload. F6 apenas integra esses estados à experiência, sem fazer homologação final F7-D.

### 2.2 Fontes normativas e precedência

1. **Spec F6 aprovada no chat**, identificada acima por SHA-256 — fonte vinculante específica.
2. Spec-mestra `docs/superpowers/specs/2026-10-19-estudo-organizado-v2-design.md` — stack, fronteiras, A-01/A-02 e gates.
3. `docs/superpowers/v2/ROADMAP.md` — F6/F7/F8, risco Cloudflare, histórico e status.
4. Contratos e specs aceitos de F2–F5, com destaque para `docs/superpowers/audits/2026-11-02-v2-f5-acceptance.md` e a spec F5.
5. `PRODUCT.md`, `DESIGN.md`, `.impeccable/` — referências **protegidas/read-only** de identidade.
6. Proposta F6 de 28/10 — documento histórico, não prevalece sobre a spec aprovada mais recente.

Se o código atual contrariar uma premissa do plano, registrar a diferença e adaptar a implementação **sem violar a spec**. Se for uma incompatibilidade arquitetural material, **STOP → gate humano**, e não reparo improvisado.

---

## 3. Preflight obrigatório antes de qualquer alteração (futura T00)

### 3.1 Inventário Git/GitHub e preservação

No ambiente real do Codex, **antes de executar teste que possa alterar snapshots**, coletar:

- `git status --short`, branch atual, `git rev-parse HEAD`, `git branch -vv`, `git worktree list --porcelain`, `git stash list`, `git remote -v`, refs remotas e divergência de `main`/`v2`.
- Commits exclusivos, branches locais/remotas, PRs abertos, alterações staged/unstaged/untracked e proprietários de worktrees. Identificar histórico de preservação F5, inclusive `codex/f5-local-preserved-20261102@6cad56c`, dois worktrees, snapshots e refs exclusivos documentados.
- Verificar o estado **real** de `main`, `origin/main`, `v2`, `origin/v2` por fetch **não destrutivo**, tratando os SHAs informados como fotografia da consulta, não garantia futura.
- Identificar `F4` PNGs e qualquer arquivo gerado/modificado por Playwright; fazer inventário com SHA-256 e **backup verificável antes dos testes**. Preservar o conjunto posterior conhecido de 43/43 artefatos e não afirmar recuperação dos bytes locais antigos perdidos.
- Diagnosticar tarefas concorrentes Codex e arquivos em uso. Preferir a worktree `v2` existente se segura; criar isolamento temporário **somente** por necessidade demonstrada e sem multiplicar branches/PRs.
- Conferir README/AGENTS.md e instruções aplicáveis à pasta `apps/v2`, branch protection, scripts npm, origem do SW e se o servidor local usa dados sintéticos isolados.

**Vedações:** `reset --hard`, `git clean`, force push, sobrescrita de alterações alheias, exclusão de branch/PR/worktree com trabalho exclusivo, limpeza de IndexedDB de usuário, remoção de captura histórica, alteração de `main`, release/deploy e GitHub Actions. Não usar `stash` como substituto de inventário/backup; qualquer movimentação de trabalho existente deve ser autorizada quando arriscada.

### 3.2 Baseline reproduzível

A partir de `apps/v2/` executar somente após proteção das evidências e com ambiente isolado:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Registrar comando, ambiente, duração, resultados PASS/FAIL/SKIP, diff produzido, tamanho de bundle e medições mínimas de inicialização, navegação, consulta, renderização e memória; não converter os **520 unitários e 114 E2E PASS + 1 skip reportados na F5** em evidência atual da F6.

**Ponto crítico:** `npm run test:e2e` pode produzir artefatos. Nunca rodar a suíte sem inventário prévio das capturas F4 e caminho de saída exclusivo F6; abortar se não for possível preservar os bytes locais existentes. Não executar teste destrutivo sobre banco/sessões reais.

### 3.3 Gate de entrada G-F6-A

- Inventário assinado com hashes, baseline e estado de todas as worktrees.
- Spec formal recebida, SHA-256 confirmado e estado de aprovação humana explicitado; documentação canônica só poderá ser atualizada no momento de execução autorizado.
- Lista precisa das superfícies já implementadas e das lacunas que exigem adaptação.
- Nenhum conflito de trabalho não resolvido, nenhum risco de perda de evidência.
- Se o baseline falhar, **classificar** regressão preexistente vs causa nova; não iniciar refatoração disfarçada de conserto sem prova e escopo.

---

## 4. Estratégia de implementação futura: TDD, dependências e marcos

### 4.1 Ciclo padronizado por tarefa

Para cada tarefa T01–T18, quando autorizada:

1. **RED:** criar/selecionar primeiro teste automatizado que reproduza comportamento desejado e caso negativo; registrar falha inicial legítima.
2. **GREEN:** implementar a menor mudança necessária utilizando componentes/serviços existentes; manter camadas e dados canônicos intactos.
3. **REFACTOR:** melhorar legibilidade e remover duplicidade local sem alterar contratos aprovados.
4. **EVIDÊNCIA:** executar testes focados, tipagem/lint aplicáveis, inspeção do diff e, quando UI, E2E/captura própria F6; documentar resultado real.
5. **STOP:** inconsistência de dados, migração produtiva, nova arquitetura/dependência onerosa, risco destrutivo, falha persistente material ou necessidade de alterar a `main` exigem decisão humana.

**Convensões:** criar testes F6 adjacentes à suíte existente em `apps/v2/tests/unit/f6-*.test.ts` e `apps/v2/tests/e2e/f6-*.spec.ts`. Nomes indicados são **propostos**. Criar poucos arquivos novos por responsabilidade, não um arquivo por cenário nem um framework de teste próprio. Não criar novo pipeline CI nem exigir PRs intermediários.

**Comandos de teste direcionado (apenas referência para execução futura):**

```bash
cd apps/v2
npm run test:unit -- tests/unit/f6-navigation.test.ts
npm run test:e2e -- tests/e2e/f6-navigation.spec.ts
npm run typecheck && npm run lint
```

Ajustar arquivos/comandos ao código real; **nada acima foi executado nesta redação**.

### 4.2 Sequência e paralelismo

**Ordem preferencial:** T00–T04 (fundação visual/roteamento) → T05–T07 (contexto/continuidade/projeções) → T08–T14 (capacidades de negócio) → T15–T17 (harden, desempenho, E2E) → T18–T20 (Impeccable, revisão e entrega). A sequência não exige commits por tarefa. Trabalhos independentes podem ser analisados paralelamente, mas alterações no mesmo arquivo/IndexedDB devem ser serializadas.

**Evitar conflito:** `App.tsx` é ponto de integração comum; manter um único responsável pela refatoração do shell. Testes de screenshot não devem rodar enquanto outros agentes editam tokens ou páginas. Revisor independente lê diff e evidências, sem editar a mesma worktree simultaneamente.

---

## 5. Tarefas executáveis (propostas; nenhuma iniciada)

### T00 — Preflight, preservação, baseline e fonte canônica

**Dependências:** autorização futura do plano/GOAL; nenhuma mudança sem ela.  
**Alvo:** inventário Git, artefatos F4/F5, documentação F6 aprovada, instalação, scripts e métricas.  
**Arquivos-alvo:** leitura de `docs/superpowers/...`, `apps/v2/package.json`, config de Playwright, componentes e testes; eventuais registros documentais **apenas após autorização**.  
**Ações:** executar §3; preservar trabalho não integrado; disponibilizar spec aprovada com SHA validado; registrar incompatibilidades e ausência de evidências. Não criar branch/PR sem justificativa.  
**Aceite:** baseline reproduzível ou bloqueio objetivo; hashes/alterações locais inventariados; nenhum dado ou screenshot alterado sem proteção.  
**Saída:** `G-F6-A` + checklist de arquivos existentes/novos, não implementação F6.  
**Risco:** alto, por histórico de snapshots F4.

### T01 — Inventariar contratos de integração e fixtures canônicas

**Dependências:** T00. **RF:** 07, 14, 18, 20, 22, 36.  
**Arquivos existentes:** `presentation/App.tsx`, três Workspaces, `application/{planning-queries,session-queries,review-service,profile-service}.ts`, repositórios locais; `tests/fixtures/`.  
**Arquivos novos, se necessários:** `tests/fixtures/f6-*` sintéticos; `tests/unit/f6-contracts.test.ts`; um tipo de view-model em `application/experience-queries.ts` **somente se demonstrada reutilização**.  
**RED:** fixtures com dois editais compartilhando sessão, F4 `INCOMING`, F5 sugestão/compromisso/execução, perfil distinto, tombstone, ausência de dados e falha de leitura; reproduzir inconsistência sem gravar fatos.  
**GREEN:** definir portas de consulta/adaptação **sem modificar contratos dos domínios**; mapear campos disponíveis e lacunas, mantendo estados incertos explícitos.  
**Aceite:** nenhuma gravação por leitura; nenhum join por nome; nenhum campo presumido; fixtures comportam os cinco fluxos de ponta a ponta; testes de limite por perfil.  
**STOP:** campos necessários ausentes e impossível apresentar sem inventar fatos; propor compromisso visual neutro ou gate humano, nunca motor paralelo.  
**Teste:** `f6-contracts.test.ts` + `architecture-boundary.test.ts` e regressões focadas F2–F5.

### T02 — Base de componentes acessíveis e estados semânticos

**Dependências:** T01. **RF:** 25, 29–31.  
**Arquivos existentes:** `presentation/ui-state.ts`, `components/SyncStatus.tsx`, `tokens.css`, `styles.css`.  
**Novos candidatos:** `presentation/components/FeedbackState.tsx`, `ConfirmationDialog.tsx` ou pequenas estruturas equivalentes **apenas se não houver reutilização possível**; `tests/unit/f6-ui-states.test.ts`, `tests/e2e/f6-ui-states.spec.ts`.  
**RED:** estado `LOADING` não é vazio, falha não é sucesso, `STALE` não é READY; confirmação não bloqueia foco; diálogos respeitam escape/cancelamento/retorno.  
**GREEN:** componentes compartilhados de loading/empty/error/status/conflito/salvando e anúncios `aria-live` persistentes; sem nova máquina global de estados.  
**Aceite:** sem confirmação de commit antes do read-back; sem dados de perfil anterior em skeleton; foco funcional por teclado; textos compreensíveis e sem jargão de infraestrutura.  
**Teste:** focused UI + regressões F2/F5 de a11y, estados e falha transacional.

### T03 — Rotas tipadas, histórico e deep links seguros

**Dependências:** T01–T02. **RF:** 02, 03, 05.  
**Arquivos existentes:** `presentation/App.tsx`, `main.tsx`, `vite.config.ts`, `playwright.config.ts`, `platform/sw-update.ts`.  
**Novos candidatos:** `presentation/navigation.ts` e um componente/host de rotas mínimo; testes `f6-navigation.test.ts` / `f6-navigation.spec.ts`.  
**RED:** rota de assunto de outro perfil, tombstone, ID inexistente, reload deep link, Voltar/Avançar, URL com payload inválido, rota com nome alterado mas ID estável.  
**GREEN:** mecanismo de roteamento mais simples compatível com Vite/PWA, histórico e fallback de hospedagem **após verificar a topologia real**; autorização de acesso sempre por consulta do domínio. Não adicionar biblioteca de router sem ganho justificado.  
**Aceite:** rota não executa comando acadêmico; navegação reproduzível; histórico não desfaz commits; nenhuma URL contém rascunho, segredo ou dado sensível.  
**Teste:** foco `f6-navigation.*` + E2E reload/offline de PWA.  
**STOP:** necessidade de mudar configuração Cloudflare/produção para suportar rota; avaliar alternativa local compatível sem publicar nada.

### T04 — Shell modular e adaptação mínima dos Workspaces F2–F5

**Dependências:** T02–T03. **RF:** 01, 04, 06, 07.  
**Arquivos existentes:** `presentation/App.tsx`, `PlanningWorkspace.tsx`, `SessionWorkspace.tsx`, `ReviewWorkspace.tsx`, `components/{EditalManager,ContentTree}.tsx`, `styles.css`.  
**Novos candidatos:** `presentation/AppShell.tsx`, pequenos componentes de navegação, sem árvore de módulos duplicada; `tests/e2e/f6-shell.spec.ts`.  
**RED:** navegar F2→F3→F4→F5 mantendo operações, tema e dados; sessão ativa não reinicia ao desmontar área; menu teclado acessível; rota após reload.  
**GREEN:** extrair navegação e composição de `App.tsx` em seções pequenas; workspaces atuais seguem chamando suas APIs próprias; *adaptadores mínimos* para contexto/filtros, sem mexer em cálculo ou transação.  
**Aceite:** seis responsabilidades funcionais acessíveis; identidade e estados do domínio preservados; nenhuma dependência de `window.EstudoApp`; sem duplicação de editores/timers/revisões.  
**Teste:** `f6-shell.spec.ts` + `f4-timer-journey.spec.ts`, `f3-journey.spec.ts`, `f5-review-journey.spec.ts`.

### T05 — Contexto compartilhado e preferências modulares

**Dependências:** T01, T03–T04. **RF:** 04, 11–12, 28.  
**Existentes:** `App.tsx`, `ui-state.ts`, `application/profile-service.ts`, `platform/local-profile-repository.ts`, `platform/local-events.ts`, `review_settings` quando aplicável.  
**Novos candidatos:** um adaptador de preferências de apresentação de dispositivo, usando mecanismo local já disponível; `tests/unit/f6-preferences.test.ts`; `tests/e2e/f6-context.spec.ts`.  
**RED:** troca do edital em foco não grava `primaryEditalId`; tema/densidade persiste na escala contratada; valor inválido usa fallback sem exclusão; duas abas não apagam preferências acadêmicas; troca de perfil não mostra cache antigo.  
**GREEN:** separar seleção visual, preferência por dispositivo, preferência acadêmica e estado transitório; restaurar padrão sem apagar fatos; reutilizar controle de revisão/CAS quando necessário.  
**Aceite:** sem novo perfil/UID/login inventado; sem mudança silenciosa de edital principal; preferências desconhecidas preservadas; contrato de perfil utilizado em toda consulta.  
**Teste:** `f6-preferences.test.ts`, `f6-context.spec.ts` e testes F2 de primary/two-tabs.  
**STOP:** alteração de esquema IDB necessária por mera conveniência; procurar opção menos invasiva; migração aditiva requer testes e aprovação de risco compatível.

### T06 — Continuidade de formulários, rascunhos e navegação protegida

**Dependências:** T03–T05. **RF:** 05, 32–35.  
**Existentes:** formulários de `App.tsx`, `ContentTree.tsx`, `PlanningEditor.tsx`, `PlanningWorkspace.tsx`, `ReviewWorkspace.tsx`; `platform/sw-update.ts` e mecanismos de drafts F3.  
**Novos candidatos:** `presentation/useNavigationGuard.ts`, `application/draft-*` **somente se os serviços existentes não atenderem**; `f6-drafts.test.ts` / `f6-drafts.spec.ts`.  
**RED:** edição suja→rota/Voltar/Avançar; falha de quota no rascunho; reload após read-back; base de rascunho obsoleta; dois tabs; mudança de tema e viewport; SW update; alternância de perfil.  
**GREEN:** usar drafts já existentes no F3 onde compatíveis; para formulários longos críticos, persistir rascunho **não canônico** identificado por perfil/entidade/revisão de base e confirmação de durabilidade; ações `Continuar`, `Preservar` e `Descartar` corretas.  
**Aceite:** nenhum formulário perde dados silenciosamente; recuperação somente se confirmada; rascunho não entra em indicadores, outbox de fato acadêmico ou sync real; F4 continua autoridade do cronômetro.  
**Teste:** `f6-drafts.*`, `f2-form-integrity.spec.ts`, `f3-drafts.test.ts`, `f4-update.spec.ts`, `f4-background.spec.ts`.  
**STOP:** necessidade de converter esquema acadêmico ou alterar autoridade de sessão.

### T07 — Projeções consolidadas e estados de evidência

**Dependências:** T01, T05. **RF:** 14–16, 18.  
**Existentes:** `application/planning-queries.ts`, `session-queries.ts`, `review-service.ts`, `domain/session-accounting.ts`, `domain/review.ts`, `platform/local-review-repository.ts`.  
**Novo candidato:** `application/experience-queries.ts` (composição de consultas puras), `tests/unit/f6-analytics-projections.test.ts`.  
**RED:** sessão ligada a dois editais; total global único; revisão sem tempo F4; F4 `INCOMING`; questões sem denominador; amostra insuficiente; zero vs ausente; projeção F5 stale; consultas concorrentes com snapshot ultrapassado.  
**GREEN:** views derivadas com `profileId`, escopo, período, unidade, amostra, proveniência/fingerprint e estado; composição por serviços existentes, sem mexer em algoritmos F3–F5. Reutilizar cache `review_projections`/CAS em vez de novo ranker.  
**Aceite:** mesma evidência produz mesmo indicador; nenhuma consulta provoca escrita acadêmica; `STALE`, `INSUFFICIENT_DATA`, conflito e parcial são visíveis; total global reconciliado.  
**Teste:** `f6-analytics-projections.test.ts` + `f4-accounting.test.ts`, `f5-projections.test.ts`, `f5-review-domain.test.ts`.

### T08 — Priorização contextual explicável e próxima ação

**Dependências:** T05, T07. **RF:** 08–10.  
**Existentes:** políticas F3 em `domain/planning-priority.ts`, regras F5 em `review-service.ts` e `domain/review.ts`, serviços F4.  
**Novo candidato:** pequena função pura de apresentação de prioridades em `application/experience-queries.ts` ou arquivo vizinho; `f6-priorities.test.ts`.  
**RED:** sessão ativa, compromisso hoje, atraso com/sem prazo, revisão vencida, sugestão não confirmada, dois editais, empates, dados insuficientes, item finalizado.  
**GREEN:** classificação/ordenação estável **sem novo score**; associar motivo e fonte; alertas de integridade fora do ranking; mostrar pendência relevante fora do filtro sem vazar outro perfil.  
**Aceite:** mesmos dados/escopo → mesma ordem; nenhum compromisso criado por leitura; sugestão nunca vira obrigação; ausência de prazo não significa atraso.  
**Teste:** `f6-priorities.test.ts` e regressões `f3-priority.test.ts`/`f5-review-service.test.ts`.

### T09 — Home operacional, modos e orientação contextual

**Dependências:** T04–T05, T07–T08. **RF:** 08–13.  
**Novos candidatos:** `presentation/HomePage.tsx` ou equivalente, componentes reutilizados de cards; `f6-home.spec.ts` / `f6-onboarding.spec.ts`.  
**RED:** perfil vazio/edital parcial/plano sem sessão/sem questões/filtro sem resultado/erro IDB, sessão ativa, prioridades protegidas, mudança de modo sem alterar fatos, ordenação por teclado.  
**GREEN:** regiões (1) operacional obrigatória, (2) compromissos/revisões, (3) indicadores secundários personalizáveis; presets `Rotina diária`, `Reta final`, `Acompanhamento`; onboarding progressivo sem wizard obrigatório.  
**Aceite:** número zero só quando houver dado que o sustente; nenhuma tela inicial bloqueia usuário com histórico; avisos críticos não ocultáveis; ação explica sua prioridade; nenhum dado acadêmico modificado ao customizar.  
**Teste:** `f6-home.spec.ts`, `f6-onboarding.spec.ts`, `f6-preferences.test.ts`.

### T10 — Consultas incrementais e componentes de listas/calendários/árvores

**Dependências:** T04, T07. **RF:** 06, 18, 22.  
**Existentes:** `ContentTree.tsx`, `PlanningCalendar.tsx`, `application/planning-queries.ts`, `session-queries.ts`, `platform/local-content-repository.ts`.  
**Novos candidatos:** utilitários de consulta por escopo/ID ou paginação se faltantes; `f6-incremental.test.ts`, `f6-large-views.spec.ts`.  
**RED:** milhares de nós, nível recolhido, foco e seleção, calendário cruzando meia-noite/período, paginação pós-edição/exclusão, empate de datas/IDs e mudança de dados em segunda aba.  
**GREEN:** expansão hierárquica sob demanda, agenda por intervalo e paginação com desempate estável; reutilizar query/cursor já presente. Virtualização **apenas** se baseline evidenciar necessidade e sem perda de acessibilidade.  
**Aceite:** item não carregado pode ser localizado por ID; ação no item nunca depende de índice visual; calendário não perde sobreposições; atualização não duplica registros.  
**Teste:** `f6-incremental.test.ts`, `f6-large-views.spec.ts`, regressões `f3-calendar.test.ts`, `f3-load.spec.ts` e `f2-hierarchy.test.ts`.

### T11 — Busca global contextual, local e segura

**Dependências:** T03, T05, T10. **RF:** 19–21.  
**Existentes:** serviços F2–F5, `ContentTree`, rotas T03; repositórios IDB de leitura.  
**Novos candidatos:** `application/search-service.ts`, índice em memória **regenerável** (ou índice persistido apenas se medido); `presentation/GlobalSearch.tsx`; `f6-search.test.ts` / `f6-search.spec.ts`.  
**RED:** Unicode/acentos, homônimos, HTML-like hostil, perfil diferente, busca pendente durante troca de contexto, registro arquivado, entidade não renderizada, resultados limitados e ranking estável.  
**GREEN:** normalização, classificação por tipo/escopo, snippets escapados, consulta/índice local; resultado abre rota tipada que revalida entidade e expande ancestrais.  
**Aceite:** funciona offline, sem serviço remoto, sem exibição de outro perfil ou execução de HTML, sem restringir busca aos nós montados; indexação sem persistir cópia canônica.  
**Teste:** `f6-search.*` + `f2-links.spec.ts` e testes de isolamento.

### T12 — Dashboard analítico e visualizações acessíveis

**Dependências:** T07, T10. **RF:** 14–18.  
**Existentes:** `PlanningDashboard.tsx`, consultas F3/F4/F5, temas.  
**Novos candidatos:** `presentation/AnalyticsPage.tsx`, componentes pequenos de série/barras/tabela; `f6-analytics.spec.ts`.  
**RED:** planejado ≠ executado; denominador insuficiente; mesmo fato em dois editais; data sem valor ≠ zero; F5 sem sessão F4; `STALE`; tabela acessível em 390px e gráfico sem hover.  
**GREEN:** catálogo restrito de gráficos/tabelas, unidade, legenda, amostra, escopo, alternativa tabular e filtros específicos; lazy load de gráficos conforme T16. Evitar dependência de gráficos sem necessidade medida.  
**Aceite:** dados compatíveis com T07; informação não depende apenas de cor; comparações proporcionais; sem previsão de aprovação/IA.  
**Teste:** `f6-analytics.spec.ts` + `f6-analytics-projections.test.ts` e testes de contraste.

### T13 — Centro de atenção local e notificações honestas

**Dependências:** T02, T05, T08. **RF:** 23–24.  
**Existentes:** F5 `ReviewService`, `review_settings`, lembretes e lease local; `platform/local-events.ts`, `SyncStatus.tsx`.  
**Novos candidatos:** `presentation/AttentionCenter.tsx` e adaptador fino de leitura; `f6-attention.test.ts` / `f6-attention.spec.ts`.  
**RED:** lembrete vencido, quiet hours, dispensa, duas abas, Notification API negada/ausente, janela offline, falha de commit, aviso transitório e alerta crítico.  
**GREEN:** categorizar atenção acadêmica vs confirmação transitória vs integridade; reaproveitar lease/dedup F5; Notification API só após opt-in com suporte real.  
**Aceite:** não prometer disparo com PWA fechado; dispensa não cumpre revisão; falha de gravação não some num toast; nenhum novo serviço push.  
**Teste:** `f6-attention.*`, `f5-reminders.test.ts`, `f5-two-tabs.spec.ts`.

### T14 — Configurações, integridade e diagnóstico de estado

**Dependências:** T02, T05, T06, T13. **RF:** 25–29.  
**Existentes:** `SyncStatus.tsx`, `ui-state.ts`, `application/sync-policy.ts`, `application/sync-types.ts`, `platform/indexeddb.ts`, `sw-update.ts`, perfis e settings.  
**Novos candidatos:** `presentation/SettingsPage.tsx`, `presentation/IntegrityStatus.tsx`, testes `f6-integrity.test.ts`/`f6-settings.spec.ts`.  
**RED:** `LOCAL_PENDING`, commit confirmado, quota/abort/bloqueio, outbox pendente, conectividade sem sync, `REMOTE_COMMITTED` não verificado, backup inexistente, troca de perfil, estado desconhecido.  
**GREEN:** 3 dimensões independentes **local/sync/backup**, resumo compacto no shell + detalhes nas configurações; preferências de tema/densidade/atenção e restauração segura. Implementar apenas ações efetivamente suportadas.  
**Aceite:** nunca mostrar `CONVERGED` nem “backup verificado” sem prova; nenhuma ação destrutiva na abertura; erro não vira “conta vazia”; sync real pertence à F7.  
**Teste:** `f6-integrity.test.ts`, `f6-settings.spec.ts`, `transaction-failure.spec.ts`, `f5-settings-ui.spec.ts`.

### T15 — Responsividade, identidade visual e acessibilidade transversal

**Dependências:** T04, T09–T14. **RF:** 01, 06, 29–31.  
**Existentes:** `tokens.css`, `styles.css`, `ui-state.ts`, componentes e páginas F6; referências read-only `PRODUCT.md`/`DESIGN.md`.  
**Novos candidatos:** estilos locais mínimos e `f6-accessibility.spec.ts` (sem outro design system).  
**RED:** viewport desktop/tablet/mobile, split-screen, teclado virtual, zoom, orientação, todos os temas, contraste de texto e não-texto, keyboard-only, skip links, modal e tabela, reduced motion.  
**GREEN:** composições adaptativas por contêiner/capacidade, 8 temas, identidade densa e legível, Plus Jakarta Sans + DM Mono, steel-blue funcional; navegação inferior mobile e sidebar/rail apropriados.  
**Aceite:** ações essenciais disponíveis em cada composição; sem scroll horizontal de toda página; targets coarse ≥44px; foco visível/retorno; sem suprimir dados para “caber”.  
**Teste:** `f6-accessibility.spec.ts`, `f5-accessibility.spec.ts`, `f4-a11y.spec.ts`, `visual-a11y.spec.ts`.

### T16 — Carregamento progressivo e orçamento medido de desempenho

**Dependências:** T07–T15. **RF:** 18, 22; **RNF:** 01, 04–05.  
**Existentes:** `App.tsx`, `main.tsx`, `vite.config.ts`, consultas e caches F5; `f5-load.test.ts`.  
**Novos candidatos:** pontos de `React.lazy` e `Suspense` apenas em telas secundárias, medidores locais em testes, `f6-performance.spec.ts`.  
**RED/baseline:** capturar primeiro tamanho de chunks, início utilizável, navegação, consulta/Unicode, renderização de lista grande, memória após uso prolongado e comportamento offline. Construir fixture sintética progressiva, sem dados produtivos.  
**GREEN:** evitar renderizar workspaces não visitados, carregar análises secundárias sob demanda, consultas limitadas e descarte de respostas obsoletas; não trocar cache canônico nem adicionar Worker/virtualizador sem prova.  
**Aceite:** orçamento numérico acordado após medições reais, sem regressão material injustificada vs baseline; cronômetro e rascunhos continuam; resultados transparentes se aparelho modesto estiver indisponível (`NOT_RUN`).  
**Teste:** `f6-performance.spec.ts`, `f5-load.test.ts`, `f3-load.spec.ts`, build size report.  
**STOP:** lentidão estrutural exige mudança de arquitetura/IndexedDB grande; decisão humana com benchmark e proposta mínima.

### T17 — Jornadas E2E, regressões de domínio e segurança

**Dependências:** T02–T16. **RF:** 01–36; **AC:** 01–36.  
**Novos candidatos:** `f6-integration.spec.ts`, `f6-security.spec.ts`, casos específicos somente para lacunas; reutilizar specs antigas para cobertura existente.  
**RED:** reproduzir caso adversarial antes de correção, não somente caminho feliz. Cinco jornadas: (A) continuar, (B) localizar, (C) planejar/acompanhar, (D) revisar, (E) falha/recuperação.  
**GREEN:** corrigir regressões materiais com mudança mínima no módulo responsável, sem “recriar serviço F3/F5 na F6”.  
**Aceite:** sem P0/P1 novo; sem vazamento de perfil; sem XSS de dados importados; sem false sync; scripts não criam escrita durante renderização; F2–F5 preservados.  
**Teste:** suíte `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run build` e verificações focadas das cinco jornadas.  
**Regra:** um teste skip, BLOCKED ou NOT_RUN precisa de razão explícita; não pode ser convertido em PASS.

### T18 — QA Impeccable e homologação visual/acessível

**Dependências:** T15–T17. **AC:** 02, 25, 37–39, 41.  
**Arquivos protegidos:** `PRODUCT.md`, `DESIGN.md`, `.impeccable/` e capturas F4 históricas (não sobrescrever).  
**Destino de evidência proposto:** `apps/v2/tests/e2e/f6-evidence/` ou diretório exclusivo equivalente **fora dos nomes/caminhos das capturas F4**.  
**Pré-requisito:** verificar disponibilidade e versão do Impeccable, comandos, hooks, telemetria e licenças no harness real. Se indisponível e exigindo instalação/hook sem autorização, registrar `BLOCKED` e escalar; não fingir execução.  
**Trabalho:** brief/shape sobre identidade aprovada; critique/audit/adapt/harden; polish/distill **somente** para achados materiais. Testar 8 temas × 3 classes de viewport para componentes globais e estados críticos; ampliar seletivamente para timer, editor, calendário, Home, busca, análise, conflitos e settings.  
**Aceite:** contrastes AA aplicáveis, foco/leitor de tela quando disponível, teclado, touch, zoom, reduced-motion; screenshots preservados com hash; relatório de achados classificados P0–P3; sem loop cosmético.  
**STOP:** demanda de redesign incompatível com D-F6-08 ou novo estilo não aprovado exige revisão humana, não alteração livre.

### T19 — Medições finais, revisão independente e correções materiais

**Dependências:** T17–T18. **AC:** 19–20, 25–27, 37–42.  
**Trabalho:** duas revisões proporcionais de natureza distinta, quando possível: (1) integridade/concorrência/limites F6–F7–F8, (2) UX/acessibilidade/qualidade/segurança visual. Revisores preferencialmente **somente leitura**; confrontar diff, testes e spec, não confiar apenas no relatório de quem escreveu código.  
**Avaliar:** regressão F2–F5, projeções, rascunhos, sync falsa, IDs, guardas de rota, compatibilidade schema, foco, memória e bundle. Capturar resultados comparáveis em ambiente disponível.  
**Correção:** P0/P1 bloqueiam avanço; P2 corrige ou leva a ressalva humana; P3 registra sem arrastar para loop. Reteste focado e suíte completa quando mudanças impactarem contratos transversais.  
**Aceite:** achados materiais tratados; nenhuma divergência séria ocultada; benchmarks identificam ambiente e condições; ausência de hardware real marcada `NOT_RUN`, não “equivalente via emulação”.  
**Riscos herdados:** HIGH F0, F4-T13, `INCOMING`, capturas F4 e dados reais não mudam de status automaticamente.

### T20 — Handoff, evidências, integração condicionada e Git Hygiene

**Dependências:** T00–T19 concluídas ou bloqueadas com justificativa. **AC:** 41–42.  
**Saída obrigatória de futura execução:** relatório consolidado e **ZIP único** com spec aprovada, plano aprovado, matriz RF/AC, testes e resultados reais, diffs/lista de commits, resumo Impeccable, capturas F6 permitidas, hashes, benchmarks, inventário Git, riscos/ressalvas e próximos gates. **Não incluir dados reais, credenciais ou backups sensíveis** no pacote.

**Estado Git:** conferir `v2`, `origin/v2`, `main`, `origin/main`, staged/unstaged/untracked, commits exclusivos, branches/PRs/worktrees e referências de preservação. Não criar PR apenas por formalidade; não usar Actions/CI. Se existir trabalho exclusivo, preservar e registrar. Consolidar documentos em registros existentes, evitando vários relatórios duplicados.

**Integração:** preparar changeset para `v2`; efetivar fast-forward/merge e push **somente se houver autorização explícita e proteções atendidas**. Conferir read-back `origin/v2` após push. `main`/Cloudflare/deploy/G5 permanecem fora. Limpeza apenas de itens comprovadamente integrados **e autorizados**; se não for segura, especificar exatamente o que ficou e o motivo.

**Marco de encerramento:** distinguir `IMPLEMENTED`, `TESTED`, `REVIEWED`, `INTEGRATED_V2`, `ACCEPTED`/`ACCEPTED_WITH_RESERVATIONS` e `DEPLOYED` (não autorizado). F6 não é “concluída” apenas por testes verdes ou por um relatório. Sem aceite humano, estado máximo é candidato revisado/entregue para revisão.

---

## 6. Rastreabilidade objetiva: 36 RF / 42 AC / 22 decisões

### 6.1 Requisitos funcionais → tarefas primárias

| Requisitos da spec | Tarefas responsáveis |
|---|---|
| RF01–RF07 — shell, rotas, contexto, compatibilidade | T01, T03–T06, T15, T17 |
| RF08–RF13 — Home, prioridades, presets, onboarding | T05, T08–T09, T17 |
| RF14–RF18 — projeções, analytics, cache | T01, T07, T12, T16–T17 |
| RF19–RF22 — busca e consultas incrementais | T10–T11, T16–T17 |
| RF23–RF27 — notificações, integridade, feedback | T02, T13–T14, T17 |
| RF28–RF31 — preferências, temas e acessibilidade | T02, T05, T14–T15, T18 |
| RF32–RF36 — rascunhos, navegação, SW, compatibilidade | T03, T06, T14, T17 |

### 6.2 Critérios de aceitação → prova primária

| AC da spec | Tarefa principal | Evidência típica |
|---|---|---|
| **F6-AC01** | T04/T17 | Quatro workspaces em E2E |
| **F6-AC02** | T15/T18 | Três viewports e toque |
| **F6-AC03** | T03/T17 | Deep link/reload/histórico |
| **F6-AC04** | T06/T17 | Guarda de edição, voltar/avançar |
| **F6-AC05** | T03/T17 | Tombstone e perfil incompatível |
| **F6-AC06** | T04/T06 | Sessão F4 durante navegação |
| **F6-AC07** | T08/T09 | Ação e motivo coerentes |
| **F6-AC08** | T08/T09 | Compromisso/sugestão/execução distintos |
| **F6-AC09** | T08 | Empates e ausência de prazo |
| **F6-AC10** | T08/T09 | Dois editais e prioridades |
| **F6-AC11** | T09 | Home nova, parcial e existente |
| **F6-AC12** | T09/T14 | Erro IDB ≠ vazio |
| **F6-AC13** | T05/T09 | Preset sem mutação acadêmica |
| **F6-AC14** | T07/T12 | Planejado × realizado conciliados |
| **F6-AC15** | T07/T12 | Sessão compartilhada não duplicada |
| **F6-AC16** | T07/T12 | Amostra/denominador insuficiente |
| **F6-AC17** | T07/T12 | Revisão F5 sem tempo F4 |
| **F6-AC18** | T07/T12 | INCOMING parcial rotulado |
| **F6-AC19** | T07/T17 | Invalidação após edit/delete/restore |
| **F6-AC20** | T07/T17 | Concorrência multiaba e descarte stale |
| **F6-AC21** | T11 | Unicode, homônimos e limites |
| **F6-AC22** | T10/T11 | Busca de item não montado |
| **F6-AC23** | T11/T17 | Markup hostil não executado |
| **F6-AC24** | T11/T17 | Resposta do perfil anterior descartada |
| **F6-AC25** | T10/T16 | Edital extenso + foco + benchmark |
| **F6-AC26** | T10 | Calendário e sobreposição temporal |
| **F6-AC27** | T10/T16 | Paginação após mutação |
| **F6-AC28** | T13 | Notification API negada/ausente |
| **F6-AC29** | T13 | Lease multiaba e quiet hours |
| **F6-AC30** | T02/T14 | Offline e LOCAL_COMMITTED honesto |
| **F6-AC31** | T14 | Outbox ≠ REMOTE_COMMITTED/CONVERGED |
| **F6-AC32** | T02/T06/T14 | Quota, abort e bloqueio IDB |
| **F6-AC33** | T06 | Rascunho durável e reload |
| **F6-AC34** | T06 | Base de rascunho obsoleta |
| **F6-AC35** | T06 | Upgrade/reload sem perda |
| **F6-AC36** | T05/T14 | Preferência, tema e restauração |
| **F6-AC37** | T15/T18 | Oito temas × três viewports |
| **F6-AC38** | T15/T18 | Teclado, foco e leitor de tela |
| **F6-AC39** | T15/T18 | Touch, zoom e movimento reduzido |
| **F6-AC40** | T16/T19 | Baseline e medição comparável |
| **F6-AC41** | T17/T18/T20 | Regressões, proteção F4 |
| **F6-AC42** | T19/T20 | Revisão, Git, aceite humano |

### 6.3 Decisões arquiteturais → tarefas

| Decisão aprovada | Tarefas principais |
|---|---|
| **D-F6-01 (B)** | T03–T04, T15 |
| **D-F6-02 (B)** | T08–T09 |
| **D-F6-03 (B)** | T07, T12 |
| **D-F6-04 (B)** | T03, T05, T08 |
| **D-F6-05 (B)** | T10–T11 |
| **D-F6-06 (B)** | T13 |
| **D-F6-07 (B)** | T05, T14 |
| **D-F6-08 (B)** | T02, T15, T18 |
| **D-F6-09 (B)** | T04, T15 |
| **D-F6-10 (B)** | T02, T14–T15 |
| **D-F6-11 (B)** | T07, T10, T16 |
| **D-F6-12 (B)** | T00, T17–T20 |
| **D-F6-13 (B)** | T06 |
| **D-F6-14 (B)** | T14 |
| **D-F6-15 (B)** | T07, T12 |
| **D-F6-16 (B)** | T05, T09 |
| **D-F6-17 (B)** | T03, T06 |
| **D-F6-18 (B)** | T10 |
| **D-F6-19 (B)** | T08 |
| **D-F6-20 (B)** | T00–T04, T06, T20 |
| **D-F6-21 (B)** | T09 |
| **D-F6-22 (B)** | T00, T17–T20 |

**Regra de auditoria:** cada AC deve aparecer ao final como `PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN/PASS_WITH_RESERVATIONS` com link/caminho de evidência verificável; nenhuma linha pode ser preenchida pela simples conclusão narrativa da tarefa.

---

## 7. Gates de qualidade, risco e decisão humana

| Gate | Tarefas | Saída verificável | Se falhar |
|---|---|---|---|
| **G-F6-A** Preservação/baseline | T00–T01 | HEADs, snapshots, baseline, fontes normativas e fixtures | STOP se risco de perda/desvio de fonte |
| **G-F6-B** Funcionalidade | T02–T14 + T17 | RF01–36, AC01–36 testados conforme matriz | Corrigir P0/P1, respeitando limites de escopo |
| **G-F6-C** Impeccable/acessibilidade | T15, T18 | Oito temas × classes de viewport, testes e QA com evidências | STOP para bloqueio real de ferramenta/gate ou falha material |
| **G-F6-D** Desempenho/revisão | T16, T19 | Baseline comparável, revisões independentes, retestes | P0/P1 bloqueiam; P2 ressalva fundamentada |
| **G-F6-E** Handoff/aceite | T20 | ZIP, matriz RF/AC, estado Git, read-back quando autorizado e decisão humana | Não alegar integração ou aceite inexistente |

### 7.1 Severidade e remediação sem loops

- **P0:** perda de dados, corrupção, vazamento entre perfis, mutação acadêmica indevida ou cronômetro sob dupla autoridade — bloqueia.
- **P1:** jornada essencial falha, indicador materialmente errado, acessibilidade impeditiva, edição perdida — bloqueia até correção ou decisão humana específica e fundamentada.
- **P2:** defeito moderado sem violação da integridade — corrigir proporcionalmente ou registrar ressalva.
- **P3:** cosmético — registrar; não iniciar ciclos indefinidos.

Toda correção terá hipótese de causa raiz, teste que falhava e revalidação. Não repetir revisões integrais sem mudança material ou evidência nova. A quantidade concreta de iterações corretivas e critérios de STOP deve ser calibrada no GOAL futuro **sem substituir as aprovações humanas obrigatórias**.

### 7.2 Riscos herdados, sem reclassificação automática

- `R-V1-LEGACY-REMOTE-PLAN`, `R-V1-FIRESTORE-DOCUMENT-1MIB`, `R-V1-MULTITAB-OUTBOX-RACE`, `R-V1-BACKUP-TOMBSTONE-LOSS`: quatro HIGH F0 `UNVERIFIED`.
- F4-T13 `NOT_RUN`; F4 `INCOMING` parcial e evidências condicionais.
- Hardware modesto real ainda não homologado; bundle F5 >500 kB e benchmark F5 apenas sintético.
- Bytes locais de três PNGs F4 anteriores à regeneração **não recuperados**; preservação posterior não reconstitui os bytes perdidos.
- Commits/worktrees/refs históricos exclusivos preservados, com inventário e limpeza dependentes de autorização.
- `main` permanece V1; há risco de deploy Cloudflare com push/merge em `main`; não alterá-la.
- Firebase/Firestore/Auth/Rules e convergência multi-dispositivo reais continuam F7; migração/backup/restore integrados F7 e cutover F8.

**Importante:** falha observada em F6 pode revelar problema histórico; classificá-la corretamente, indicar impacto atual e separar correção necessária à F6 de escopo reservado à F7/F8.

---

## 8. Evidências técnicas e pacote final exigido no GOAL futuro

O ZIP final de futura execução deverá conter **somente arquivos não sensíveis** e possuir manifesto de caminhos/tamanhos/SHA-256. Estrutura sugerida, consolidada (não gerar vinte relatórios por tarefa):

```text
F6-REVIEW-PACKAGE.zip
├── README.md                         # Status real e como reproduzir
├── SPEC-F6-APPROVED.md              # Cópia exata, com fonte e hash
├── WRITING-PLANS-F6-APPROVED.md     # Plano aprovado
├── F6-REPORT.md                     # Único relatório consolidado
├── F6-RF-AC-MATRIX.csv              # RF01–36 e AC01–42 com estado/evidência
├── F6-TEST-RESULTS.md               # Comandos, ambiente, resultados/limitações
├── F6-PERFORMANCE.md                # Comparação com baseline e hardware
├── F6-IMPECCABLE.md                 # Versão, auditoria, achados, QA
├── F6-GIT-INVENTORY.md              # HEADs, diffs, exclusividades e pendências
├── MANIFEST-SHA256.txt              # Checagem independente
└── screenshots/f6/                 # Evidências F6 autorizadas, sem capturas F4 substituídas
```

Se não houver dados suficientes, o campo será marcado `NOT_RUN`, `INCONCLUSIVE` ou `BLOCKED`. Não preencher relatórios com resultados históricos como se fossem ensaios novos. O pacote pode ser elaborado localmente sem upload a serviço externo; verificação offline do ZIP e dos checksums é necessária.

**Relatório único:** funcionalidades, riscos, testes, revisão crítica, recomendações de correção, commits, divergência da `v2`, estado da `main`, branches/PRs/worktrees, alterações preservadas, autorização de integração (se houver), resultado de read-back e próxima ação. Preferir atualizar o registro existente de fase/issue #108 apenas depois de autorização para escrita.

---

## 9. Critérios de aceite do próprio writing-plans

Este plano é adequado para aprovação **como planejamento** se:

1. Contém cada uma das dez capacidades F6, todas as 22 decisões B e mapeia **RF01–RF36** e **AC01–AC42**.
2. Cada tarefa implementável possui pré-requisitos, área/arquivos candidatos, RED/GREEN, testes, critério de aceite e STOP ou limite de escopo.
3. Reaproveita infraestrutura existente e não pressupõe bibliotecas ausentes como já instaladas.
4. Evita criação rotineira de branches, PRs, Actions, migrations ou serviços paralelos.
5. Garante preservação F4/F5 e inventário de trabalho Git antes de testes/escritas.
6. Separa homologação de F6 de Firebase real, restauração/migração F7 e cutover F8.
7. Entrega prevista inclui revisão independente, aceitação humana, evidências reproduzíveis e ZIP com documentos-chave.
8. Nenhum GOAL, implementação, publicação ou integração pode começar pela simples existência/aprovação deste arquivo.

### Próximo gate — decisão humana pendente

**Estado:** `F6_PLAN_APPROVED`. GOAL de execução preparado e publicação documental autorizada pelo proprietário. Este plano é normativo, mas não executa comandos por si só; observar gates do GOAL e integrar código somente com autorização separada.

---

### Declaração de trabalho realizado nesta etapa de planejamento

Foram consultados **em leitura** o repositório e caminhos principais da `v2` via GitHub, a spec F6 aprovada e as fontes normativas anteriores. Este arquivo é um **artefato Markdown local para revisão**. Não foram executados `npm`, testes, builds, commits, `git checkout`, merge, push, deploy, alterações de código, PRs, Actions, operações de IndexedDB ou modificações em qualquer arquivo do repositório.
