# GOAL ÚNICO — PUBLICAR DOCUMENTAÇÃO APROVADA F6 NA `v2` E EXECUTAR F6 LOCALMENTE

**Autorização expressa do usuário em 03/11/2026:** publicar na branch remota `v2` exclusivamente os artefatos documentais aprovados da F6 (especificação, writing-plans e este GOAL), bem como atualizar pontualmente o roadmap. A implementação F6, T00–T20, TDD, testes, revisão e ZIP final estão autorizados para **execução local pelo Codex Desktop**. **Não está autorizado fazer push de código, merge com `main`, deploy, PRs, Actions ou limpeza destrutiva** sem autorização adicional.

## Etapa P — Publicação documental autorizada (antes da implementação)

1. Abrir o repositório `matheussilva421/estudo-organizado` e fazer o inventário obrigatório do Git: `git status`, `git branch -vv`, `git worktree list`, `git stash list`, refs remotas, commits exclusivos, PRs e scripts/hook ativos. Verificar a branch `v2` e o risco produtivo da `main`, que não será tocada. Preservar alterações locais, três PNGs F4, referências F5 e snapshots antes de qualquer operação potencialmente mutável. Se houver risco de perda, **STOP** e informar o bloqueio.
2. Utilizar os **três arquivos aprovados fornecidos neste pacote** nos seguintes destinos, sem modificar conteúdo normativo nem sobrescrever arquivos existentes inesperados:
   - `docs/superpowers/specs/2026-11-03-estudo-organizado-v2-f6-experience-design.md`
   - `docs/superpowers/plans/2026-11-03-estudo-organizado-v2-f6-experience.md`
   - `docs/superpowers/goals/2026-11-03-estudo-organizado-v2-f6-codex.md` (este documento)
3. Atualizar **somente os trechos de estado** pertinentes do `docs/superpowers/v2/ROADMAP.md`: F6 tem 22 decisões arquiteturais B aprovadas; `F6_SPEC_APPROVED`, `F6_PLAN_APPROVED`, GOAL disponível e execução ainda não iniciada. Adicionar links relativos aos três novos documentos. Não substituir a proposta histórica de 28/10, nem modificar os estados F7/F8. Evitar editar a issue #108 sem autorização específica.
4. Confirmar que a publicação contém **apenas documentação F6 aprovada**, sem dados pessoais, segredos, ZIP binário redundante ou arquivos F4/F5. Usar preferencialmente a `v2` com commit documental coeso e push **fast-forward**. Se a `v2` local estiver divergente, com trabalho único ou sujeita a alterações concorrentes, não rebase/reset/delete automaticamente; preparar publicação isolada segura ou interromper com relatório. Sem force push e sem nova PR/branch por conveniência.
5. Fazer read-back da `origin/v2`: HEAD, quatro caminhos publicados e equivalência do conteúdo. Registrar SHA do commit, hashes SHA-256 dos textos versionados, `main` preservada e status de worktrees/PRs. **Não declarar publicação sem confirmar.**
6. Depois do commit documental confirmado, **continuar o GOAL integral F6 abaixo**, realizando o preflight T00 novamente à luz do HEAD atualizado. Os artefatos no GitHub se tornam as fontes canônicas. Não exigir anexos externos; não repetir o versionamento documental na T20. O push permitido nesta etapa **não** amplia a autorização de push para commits futuros de código.

### Interrupções obrigatórias da Etapa P

Bloquear publicação se houver conteúdo sensível, divergência documental material, arquivo já existente com conteúdo distinto sem estratégia conservadora, risco de sobrescrita de trabalho não integrado, HEAD remoto inesperado ou falta de permissão para push. Nunca contornar proteções GitHub; apresentar diagnóstico e instrução segura para retomar. Em caso de bloqueio, não afirmar que documentos foram publicados.

---

## Etapa F6 — Execução integral após publicação documental

# GOAL ÚNICO — CODEX DESKTOP | ESTUDO ORGANIZADO V2 | F6 — EXPERIÊNCIA INTEGRADA

**Objetivo:** executar integralmente, na medida permitida pelos gates de segurança, a especificação formal F6 e o writing-plans Superpowers T00–T20 já aprovados, com TDD, testes locais, Impeccable, revisão independente, preservação rigorosa de dados/trabalho Git, relatório único e ZIP final para revisão humana.

**Repositório:** `https://github.com/matheussilva421/estudo-organizado` (`matheussilva421/estudo-organizado`).  
**Branch de trabalho canônica da V2:** `v2`. **`main` contém V1 e NÃO pode ser modificada.**  
**Autorização concedida por este GOAL quando colado no Codex Desktop:** publicar exclusivamente os quatro arquivos documentais da Etapa P; depois, diagnóstico, implementação local da F6, testes, revisão, documentação local, commits locais de código e ZIP final. **O push documental da Etapa P é exceção expressamente autorizada; pushes de código, merge, PR, release, deploy/cutover, Actions, exclusão destrutiva e operações produtivas NÃO estão autorizados.** Preparar integração posterior à `v2` sem publicá-la até autorização distinta.

## 0. Autoridade documental, precedência e precondições

Fontes normativas deste pacote, a publicar na Etapa P — **depois da publicação use os caminhos canônicos da `v2`; não substitua por rascunhos históricos**:

1. `docs/superpowers/specs/2026-11-03-estudo-organizado-v2-f6-experience-design.md` — **aprovada expressamente em 03/11/2026**, SHA-256 original `aad69677511ca53e202db8cec72bebffb8424b9a27bd40b0464b3344d1ca158d`.
2. `docs/superpowers/plans/2026-11-03-estudo-organizado-v2-f6-experience.md` — **T00–T20 aprovado expressamente em 03/11/2026**, SHA-256 original `6e1426a03c9d507c2dcd0fb5029cd58dd1370d978932c5f4c1a56d38ca94ebf0`.
3. Todas as decisões Superpowers **D-F6-01 a D-F6-22, opção B**, e sua arquitetura consolidada, aprovadas na conversa.
4. No repositório, `docs/superpowers/specs/2026-10-19-estudo-organizado-v2-design.md`, `docs/superpowers/v2/ROADMAP.md`, contratos/specs F2–F5, aceite F5, `PRODUCT.md`, `DESIGN.md` e `.impeccable/`.
5. `docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f6-experience-design.md` é **proposta histórica não aprovada**; não deve prevalecer sobre a spec F6 de 03/11.

**Nota documental:** este pacote traz a especificação e o writing-plans com cabeçalhos de aceite atualizados (`F6_SPEC_APPROVED` e `F6_PLAN_APPROVED`). Os hashes de anexos originais citados acima são históricos e **não coincidem** com os arquivos após a promoção documental de status. Após a Etapa P, utilizar os caminhos canônicos publicados na `v2`; se faltar documento ou houver divergência material, **STOP** antes de implementar.

**Referência remota, NÃO estado garantido de execução:** `origin/v2@339eae5eca5460b4c6a7ff8d5705429b82ec8cc3`, `origin/main@9046cfa2283cd293b38df9d52fabfcd5de9ac67c`, nenhum PR aberto no último read-back disponível. O candidato de código F5 aceito é `c358928749951b5848217040762af2785fffae8b`; `F5_ACCEPTED_WITH_RESERVATIONS`. Verifique tudo novamente no preflight.

**Modo operacional:** atuar autonomamente nas escolhas técnicas rotineiras; **não** pedir aprovação para cada ajuste, teste, componente ou commit local. Não saltar gates por conveniência. Parar e apresentar decisão objetiva quando houver: incompatibilidade arquitetural material, risco de perda, modificação produtiva, dependência nova de risco/licença/hooks sem autorização, alteração remota não autorizada ou falha P0/P1 persistente sem solução segura.

## 1. Invariantes inegociáveis e fronteiras

- **Local-first:** IndexedDB V2 é fonte canônica; UI observa comandos e consultas, não faz writes acadêmicos durante renderização. Estado `LOCAL_COMMITTED` ≠ `REMOTE_COMMITTED` ≠ `CONVERGED` ≠ backup verificado.
- **Preservar domínio:** não reimplementar F2 Conteúdo, F3 Planejamento, F4 Sessões/cronômetro, F5 Revisões/inteligência. Não criar ranking, mecanismo de revisão, relógio, estado global editável, banco ou outbox paralelos.
- **Sem perda silenciosa:** proteger rascunhos, operações em curso, concorrência entre abas, tombstones, revisão/CAS, deduplicação, `INCOMING` parcial, quota/abort e atualização do SW. Nenhuma falha é apresentada como sucesso.
- **Perfil/privacidade:** rotas, filtros, caches, índices, projeções, rascunhos e atenção isolados por perfil; sem vazar dados no histórico, URL, console, capturas, ZIP ou logs.
- **Design:** preservar `PRODUCT.md`, `DESIGN.md`, identidade steel-blue, Plus Jakarta Sans + DM Mono, alta densidade com hierarquia e oito temas (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex, Plasma). A-01 Impeccable é gate; não sobrescrever arquivos canônicos da V1.
- **Acessibilidade:** WCAG AA aplicável em todos os temas, teclado, foco, skip links, toque ≥44 px com pointer coarse, zoom, leitor de tela quando disponível e reduced motion.
- **F7/F8 fora:** sem Google Sign-In/Firebase Auth/Firestore reais, sync multi-dispositivo, Rules, confirmação de convergência, migração/restore produtivos, piloto integrado, Cloudflare, cutover, `main`, deploy ou G5. Sem serviços pagos/CI/Actions, novas branches e PRs por rotina.
- **Higiene sem destruição:** não fazer `reset --hard`, `git clean`, force push, apagar refs/commits exclusivos, sobrescrever screenshots/alterações locais, descartar stashes ou worktrees com trabalho. Não reduzir segurança para obter teste verde.

## 2. T00 — PREFLIGHT E PRESERVAÇÃO OBRIGATÓRIOS (G-F6-A)

**Antes de qualquer `npm ci`, teste E2E ou escrita:**

1. Confirmar diretório/repositório, instruções `AGENTS.md` aplicáveis e estado real:
   - `git rev-parse --show-toplevel`, `git status --porcelain=v1 -uall`, `git branch --show-current`, `git rev-parse HEAD`, `git branch -vv`, `git branch -a`, `git worktree list --porcelain`, `git stash list`, `git remote -v`, `git log --all --oneline --decorate -n 30`;
   - executar `git fetch` **não destrutivo** quando seguro e comparar `main`, `origin/main`, `v2`, `origin/v2`, commits exclusivos/divergentes e PRs abertos; registrar HEADs exatos e árvore suja/limpa.
   - localizar worktrees Codex ativas, processos que usam arquivos, branch `codex/f5-local-preserved-20261102@6cad56c`, snapshots e refs históricos com commits exclusivos. Não presumir que os nomes anteriores ainda correspondem ao estado atual.
2. **Prioridade de preservação F4/F5:** inventariar com tamanho e SHA-256 as três capturas F4 historicamente modificadas, seus equivalentes HEAD, variantes históricas, pacote conhecido de 43/43 artefatos e quaisquer snapshots/alterações não commitadas. Conferir cópias existentes e gerar proteção adicional verificável se necessário, fora de caminhos que Playwright ou builds alteram. Bytes locais anteriores à regeneração histórica **não foram recuperados**; não afirmar o contrário.
3. Confirmar ausência de dados produtivos nos perfis de teste, IDs/origens, IndexedDB e PWA. Criar fixtures sintéticas e ambiente isolado. **Nunca limpar cache/site data/IndexedDB do usuário** para passar testes.
4. Garantir que Playwright escreva **somente** em caminhos novos da F6, sem `update-snapshots` em capturas F4 nem regravar evidências anteriores. O teste de baseline E2E só ocorre **após** essa garantia; se não for possível, STOP.
5. Verificar hashes de spec e plano, inventário de RF01–RF36, AC01–AC42 e decisões B; comparar a proposta histórica, sem reabrir o que já foi aprovado.
6. Registrar baseline local inicial em `apps/v2/`, quando seguro: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run build`; anotar ambiente, comandos, contagens PASS/FAIL/SKIP, tamanho inicial, duração, evidências, diff após testes e limitações. **Não** tratar os 520 unitários e 114 E2E PASS + 1 skip da F5 como testes F6 executados.
7. Medir com fixtures progressivas inicialização, navegação, consultas, renderização, memória, offline e fluxos grandes; documentar medição faltante como `NOT_RUN`, inclusive hardware modesto real não disponível.
8. Confirmar condições de isolamento, rotas/SW, permissões locais, dependências existentes e risco de Cloudflare em `main`. Nenhuma integração em produção.

**STOP G-F6-A:** trabalho local sem proteção, branches com commits exclusivos ameaçados, dados reais expostos, screenshots em risco, fonte normativa ausente/hash divergente, conflito entre sessões ou baseline irremediavelmente inseguro. Entregar diagnóstico objetivo sem forçar continuidade.

## 3. T01–T20 — EXECUÇÃO TDD, NA ORDEM DE DEPENDÊNCIAS DO PLANO

**Para cada tarefa implementável:** RED (teste que reproduz comportamento e caso adversarial) → GREEN (menor mudança) → REFACTOR (sem alterar contratos) → testes focados + regressões relevantes → evidências reais → inspeção de diff. Reaproveitar arquivos existentes; nomes abaixo são candidatos, não obrigação de criá-los. Não gerar 21 branches/PRs/relatórios. Commits locais coesos, se seguros, sem incluir alterações prévias alheias.

### T01 — Inventário e fixtures de contrato

Mapear APIs/contratos reais entre `presentation/App.tsx`, `PlanningWorkspace.tsx`, `SessionWorkspace.tsx`, `ReviewWorkspace.tsx`, `application/{planning-queries,session-queries,review-service,profile-service}.ts` e repositórios. Fixtures sintéticas para dois editais compartilhando sessão, perfil divergente, tombstone, F4 `INCOMING`, revisão F5 sem tempo F4, conflito, ausência de dados e erro IDB. Teste candidato `tests/unit/f6-contracts.test.ts` + `architecture-boundary.test.ts`. Nenhuma inferência por nome, escrita por leitura ou dado acadêmico fabricado.

### T02 — Estados semânticos e componentes acessíveis

Reutilizar `presentation/ui-state.ts`, `components/SyncStatus.tsx`, tokens e estilos. Normalizar UI `LOADING/EMPTY/ERROR/PENDING/LOCAL_COMMITTED/CONFLICT/STALE/UNVERIFIED`, sem máquina global. Diálogos acessíveis com foco/retorno/escape; `aria-live` sem duplicidade; skeleton sem conteúdo de perfil anterior. Testes candidatos `f6-ui-states.test.ts` e `f6-ui-states.spec.ts`. Confirmar somente depois do commit; erro nunca vira vazio ou salvo.

### T03 — Rotas tipadas, histórico e deep links

Rotas estáveis de módulo/entidade e resolução por ID/perfil, histórico Voltar/Avançar, reload e fallback PWA/host seguro. Inspecionar `App.tsx`, `main.tsx`, Vite/Playwright e `sw-update.ts`; preferir router mínimo se suficiente. Casos negativos: ID inexistente, tombstone, entidade de outro perfil, URL hostil, edição pendente. Nenhuma navegação executa escrita acadêmica ou exige mudança na hospedagem produtiva. Testes `f6-navigation.test.ts`/`.spec.ts`.

### T04 — Shell integrado e Workspaces F2–F5

Extrair composição de `App.tsx` para shell/navegação reutilizáveis, preservando F2 Editais/ContentTree, F3 PlanningWorkspace, F4 SessionWorkspace e F5 ReviewWorkspace. Evitar V1 `window.EstudoApp`, módulos duplicados e reescrever domínio. Testar rota F2→F3→F4→F5, mudança de viewport/tema e cronômetro sem reinício. Regressões `f3-journey`, `f4-timer-journey`, `f5-review-journey`; teste `f6-shell.spec.ts`.

### T05 — Contexto e preferências

Separar `primaryEditalId` canônico de `selectedEditalId` visual, filtros por área, tema/densidade do dispositivo, configurações acadêmicas por perfil e estados efêmeros. Reutilizar `profile-service`, `local-profile-repository`, `local-events` e settings F5 com CAS. Preferências inválidas: fallback sem apagar; duas abas: sem sobrescrita; troca de perfil: sem cache antigo. Não inventar login F7, perfil remoto funcional ou mudança de esquema por conveniência. Testes `f6-preferences.test.ts`, `f6-context.spec.ts`.

### T06 — Rascunhos e navegação protegida

Preservar edições ao sair/Voltar/Avançar/trocar tema/viewport/reload; usar drafts F3 quando compatíveis. Rascunho local durável para formulários longos de risco, separado de fatos e outbox, ligado a perfil, entidade e revisão-base. Permitido continuar, preservar comprovadamente ou descartar por ato explícito; verificar falha/quota, stale de base, conflito multiaba e atualização SW. Cronômetro F4 não depende da montagem do componente. Testes `f6-drafts.*`, `f2-form-integrity`, `f3-drafts`, `f4-update`, `f4-background`.

### T07 — Projeções compartilhadas e integridade analítica

Compor consultas F3/F4/F5 em view models derivados (candidato `application/experience-queries.ts`); aproveitar `review_projections` fingerprint/CAS. Cada métrica traz perfil, escopo, unidade, período, amostra/denominador, origem e validade; distinguir zero de ausência, `STALE`, `INCOMING`, `INSUFFICIENT_DATA`. Testar dupla vinculação a editais sem duplicar total global; revisão F5 não cria tempo/questões F4; correção/exclusão/restore invalida dependências; resultado assíncrono obsoleto não publica. Testes `f6-analytics-projections.test.ts`, `f4-accounting`, `f5-projections`.

### T08 — Priorização determinística

Compor e apresentar prioridades F3/F5 e sessão F4 sem criar score novo. Sessão ativa e alertas críticos em região protegida; compromissos confirmados, atrasos, revisões e sugestões separados. Ordenação determinística e desempates estáveis, com motivo e fonte; sem tratar item sem prazo como atrasado nem sugestão como compromisso. Múltiplos editais sem ocultação silenciosa de urgências. Testes `f6-priorities.test.ts`, `f3-priority`, `f5-review-service`.

### T09 — Home e onboarding contextual

Regiões de status/ação obrigatória, compromissos, indicadores secundários selecionáveis e ordenáveis; presets `Rotina diária`, `Reta final`, `Acompanhamento` sem criar ou alterar planejamento. Novato/usuário parcial/usuário com histórico/erro IDB são estados diferentes; sem wizard obrigatório ou zeros inventados. Alertas críticos não ocultáveis; próxima ação explicável. Testes `f6-home.spec.ts`, `f6-onboarding.spec.ts` e preferências.

### T10 — Consultas incrementais

Árvores F2 por expansão hierárquica; calendário F3 por período com sobreposição real; sessões/revisões por filtros e paginação estável. Reutilizar `planning-queries.ts`, `session-queries.ts` (cursor com ID) e repositórios existentes. ID ≠ índice visual. Busca posterior deverá localizar itens não montados; scroll/foco acessíveis; virtualização somente com medição. Testes `f6-incremental.test.ts`, `f6-large-views.spec.ts`, `f2-hierarchy`, `f3-calendar`, `f3-load`.

### T11 — Busca global local e segura

Índice regenerável por perfil e escopo ou consultas locais limitadas, suporte offline, Unicode/acentos, homônimos, ranking estável, snippets escapados. Usar F2–F5 e rotas tipadas; revalidar ID/perfil/arquivamento/tombstone ao abrir resultado, expandir ancestrais mesmo não renderizados. Respostas antigas não cruzam perfil; nenhum HTML hostil é executado. Não adicionar busca remota paga. Testes `f6-search.test.ts`, `f6-search.spec.ts`, isolamento e `f2-links`.

### T12 — Analytics acessível

Reutilizar `PlanningDashboard.tsx`, consultas e projeções T07. Gráficos e tabelas limitados, com unidade, período, amostra, fonte, escopo, estados, alternativa textual/tabular, sem interação exclusivamente por cor/hover. Planejado ≠ executado; nenhum percentual sem denominador; mesmo fato em dois editais não duplica total global. Se nenhuma biblioteca existente atender, preferir elementos simples/HTML/SVG acessíveis antes de dependência pesada. Testes `f6-analytics.spec.ts` e projeções T07.

### T13 — Atenção local e notificações

Centro unificado de pendências, avisos e integridade, usando lembretes/settings/leases F5 já existentes. Quiet hours, dispensa sem cumprir revisão, duas abas sem duplicidade, permissão Notification API explícita e opt-in; indisponibilidade/negação degrada corretamente. Não prometer disparo com PWA fechado, push ou sync real. Testes `f6-attention.test.ts`, `f6-attention.spec.ts`, `f5-reminders`, `f5-two-tabs`.

### T14 — Configurações e status de integridade

Preferências em seções modulares; indicador compacto no shell e detalhes seguros nas configurações. **Separar três dimensões**: commit local/erro, remota indisponível/pendente e backup/recuperação não verificados. Examinar `SyncStatus`, `sync-policy`, `sync-types`, `indexeddb`, `sw-update`. Outbox pendente ≠ remoto confirmado; internet conectada ≠ convergência; não alegar backup verificado sem prova. Ações destrutivas nunca automáticas. Testes `f6-integrity.test.ts`, `f6-settings.spec.ts`, falha transacional e F5 settings.

### T15 — Responsividade, oito temas, acessibilidade

Design system da V1 preservado, com composição adaptativa (sidebar desktop, rail tablet, bottom nav mobile), alvos touch coarse ≥44px, sem perda de ações no zoom/split screen/teclado virtual. Contraste WCAG AA nos oito temas, foco, landmarks, skip links, reader quando disponível, reduced motion, tabelas acessíveis, não poluir nem virar SaaS genérico. Usar `tokens.css`/`styles.css`; não editar `PRODUCT.md`/`DESIGN.md`. Testes `f6-accessibility.spec.ts`, F4/F5/visual-a11y.

### T16 — Carregamento progressivo e performance

Estabelecer baseline antes de otimizar. Usar lazy loading das áreas secundárias, consultas limitadas, cache regenerável e invalidação por dependências; não reconstruir workspaces à toa nem desmontar autoridade do timer. Medir bundle, tempo até Home utilizável, transições, busca Unicode, grandes listas, memória, offline e falhas. Sem Workers, virtualizador ou lib grande sem gargalo medido; hardware modesto real não disponível = `NOT_RUN`. Teste `f6-performance.spec.ts`, `f5-load`, `f3-load`, build.

### T17 — E2E completo, regressões e segurança (G-F6-B)

Cinco jornadas em fixtures sintéticas: **A)** continuar sessão, **B)** localizar assunto, **C)** planejar/acompanhar, **D)** revisar, **E)** falha/recuperação. Testar offline, troca de perfil/edital, duas abas, quota, abort, conflito, tombstone, dado hostil/XSS, update SW, ausência e dado incompleto. Conferir 36 RF/42 AC sem “PASS narrativo”. Executar suites reais após preservar F4: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run build`. Testes F2–F5 seguem válidos e não podem ser silenciosamente alterados para mascarar erro.

### T18 — Impeccable, evidências visuais e acessibilidade (G-F6-C)

Inspecionar ferramentas/skill Impeccable realmente disponíveis, versão, scripts, hooks, telemetria, licenças e origem. **Não instalar hooks ou habilitar telemetria/serviço externo sem autorização**; se indisponível sem instalação autorizada, marcar `BLOCKED` e escalar. Executar shape/critique/audit/adapt/harden; polish/distill apenas para achados materiais. Testar componentes globais em **8 temas × 3 classes de viewport** e jornadas de risco em amostra ampliada. Registrar contraste, leitor de tela quando disponível, foco, teclado, toque, zoom e reduced motion; screenshots só F6, com hashes; não usar detector como certificação WCAG.

### T19 — Benchmark final, revisão independente, correções (G-F6-D)

Duas revisões independentes por perspectivas diferentes, preferencialmente read-only: (1) dados, concorrência, integridade, segurança, fronteiras F6/F7/F8; (2) UX, acessibilidade, Impeccable, estabilidade e testes. Revisar diff completo e provas atuais, não só relatório do executor. P0/P1: bloquear e corrigir com teste RED→GREEN quando seguro; P2: corrigir ou documentar ressalva para aceitação humana; P3: registrar. Limitar a **duas rodadas de revisão global** e retestes focados; não começar terceira rodada completa sem nova evidência material/decisão humana. Não deixar P0/P1 oculto. Repetir suíte completa se a correção tocar contratos transversais. Confrontar métricas com baseline; sem aparelho modesto real = `NOT_RUN`.

### T20 — Handoff, inventário Git, integração CONDICIONADA, ZIP final (G-F6-E)

Os artefatos F6 devem ter sido publicados na Etapa P e verificados por read-back; **não** recriar versões ou novos arquivos redundantes. Atualizar localmente o `ROADMAP.md` somente quanto ao estado real da implementação. **Publicação/edição remota da issue #108 depende de autorização própria; caso contrário, registrar pendência.**

Inspecionar `v2`, `origin/v2`, `main`, `origin/main`, staged/unstaged/untracked, branches/PRs/worktrees, commits exclusivos e refs de preservação; manter intactos os não integrados. **Pode criar commits locais coesos**, caso a worktree seja segura e diferenciados de trabalho alheio; **não fazer push/merge/rebase destrutivo**. Preparar changeset validado para integração futura em `v2`; marcar `READY_FOR_HUMAN_REVIEW` ou `BLOCKED`. Se houver autorização adicional inequívoca para integração à `v2`, integrar por fast-forward quando possível e com read-back, sem tocar `main` ou Cloudflare. Limpeza só de artefatos comprovadamente integrados e autorizados. Não afirmar `F6_ACCEPTED` antes do aceite humano.

## 4. Gates verificáveis, riscos e critérios de parada

- **G-F6-A (T00–T01):** inventário completo + fontes aprovadas/hashes + preservação F4 + baseline/fixtures; se não seguro, STOP.
- **G-F6-B (T02–T14 e T17):** 36 RF e AC funcionais com evidência unit/integration/E2E, sem P0/P1 encoberto.
- **G-F6-C (T15/T18):** Impeccable válido, oito temas, viewports, acessibilidade e capturas F6; indisponibilidade da ferramenta não vira PASS.
- **G-F6-D (T16/T19):** benchmark comparável, revisão independente e reteste; P0/P1 bloqueiam; P2 exige ressalva fundamentada.
- **G-F6-E (T20):** matriz 36 RF + 42 AC + 22 decisões, docs, hashes, Git real, ZIP íntegro e gate humano ainda pendente.

**Pendências históricas que NÃO se fecham por inferência:** `R-V1-LEGACY-REMOTE-PLAN`, `R-V1-FIRESTORE-DOCUMENT-1MIB`, `R-V1-MULTITAB-OUTBOX-RACE`, `R-V1-BACKUP-TOMBSTONE-LOSS` (4 HIGH F0 `UNVERIFIED`); F4-T13 `NOT_RUN`; F4 `INCOMING` parcial; capturas F4 com bytes antigos irrecuperáveis; worktrees/refs históricos exclusivos; bundle F5 >500 kB e benchmark modesto real pendente; F7 Auth/Firestore/Rules/convergência remota; F8 cutover. Reportar impacto concreto em F6 e não converter limitações antigas em PASS.

**Sem loops:** usar causa raiz → teste específico → menor correção → reteste. Duas rodadas globais de revisão no máximo; achado material novo pode justificar nova revisão somente com autorização. STOP diante de risco destrutivo, solução que invade F7/F8, mudança arquitetural material, falha P0/P1 persistente, dependência que exige hook/instalação não autorizados, ou imposição de push/deploy/limpeza não autorizada.

## 5. Evidências, ZIP obrigatório e verificação independente

Ao término (mesmo que parcialmente bloqueado), gerar **`F6-REVIEW-PACKAGE.zip`**, sem segredos, dados reais, dumps, tokens ou backups sensíveis. Conteúdo mínimo:

```text
F6-REVIEW-PACKAGE.zip
├── README.md                         # status, decisões/gates e reprodução
├── SPEC-F6-APPROVED.md              # cópia original aprovada; hash conferido
├── WRITING-PLANS-F6-APPROVED.md     # cópia original aprovada; hash conferido
├── F6-REPORT.md                     # relatório consolidado e honesto
├── F6-RF-AC-MATRIX.csv              # RF01–36, AC01–42 e evidências por linha
├── F6-TEST-RESULTS.md               # comandos, ambiente, logs resumidos
├── F6-PERFORMANCE.md                # baseline vs final, limitações
├── F6-IMPECCABLE.md                 # versão, disponibilidade, achados e QA
├── F6-GIT-INVENTORY.md              # HEAD, diffs, worktrees, refs, divergências
├── MANIFEST-SHA256.txt              # tamanhos/hashes verificáveis
└── screenshots/f6/                 # imagens somente F6, quando seguras
```

Verificar **extração, lista de entradas, SHA-256 e correspondência** com o manifesto por processo independente; registrar hash do ZIP. Arquivos ZIP e relatórios são **artefatos locais a entregar ao usuário**, não upload automático para serviço externo. Se a inspeção/empacotamento revelar dado sensível, excluir do ZIP e anotar omissão e motivo. A existência de ZIP não comprova, por si, a execução dos testes.

### Relatório final ao usuário (formato exigido)

1. `RESULTADO`: `READY_FOR_HUMAN_REVIEW`, `BLOCKED` ou `PARTIAL`; jamais `F6_ACCEPTED` sem aceite humano.
2. `ESCOPO`: capacidades implementadas, o que foi deixado de fora e quaisquer desvios autorizados.
3. `TESTES`: comandos executados e contagens PASS/FAIL/SKIP/NOT_RUN, resultados de baseline e pós-implementação, divergências.
4. `MATRIZ`: RF01–RF36, AC01–AC42 e D-F6-01–22 com caminho de evidência.
5. `REVISÃO`: achados P0–P3, correções, retestes e limitações reais.
6. `INTEGRIDADE`: IndexedDB, duas abas, rascunhos, F4, sync F7 não implementada e riscos herdados.
7. `GIT`: HEAD inicial/final, commits locais, branch, status, `main` intacta, `origin/v2` não atualizado sem autorização, PRs, worktrees, branches com commits exclusivos, limpeza feita/não feita e por quê.
8. `PACOTE`: caminho absoluto acessível do ZIP, tamanho, SHA-256 e verificação independente do manifesto.
9. `PENDÊNCIAS`: bloqueios e única próxima ação humana objetivamente necessária.

**Instrução final:** trabalhe de forma autônoma e profunda dentro do escopo já aprovado, sem loops e sem pedir confirmações para escolhas rotineiras. Preserve tudo antes de testar, implemente T00–T20, faça testes e revisão reais, entregue evidências e ZIP verificável. **Não publique, não altere `main`, não faça cutover ou limpeza destrutiva.** Se o gate bloquear, pare com estado claro e entregue tudo que foi realizado, sem alegar conclusão fictícia.
