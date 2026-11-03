# Estudo Organizado V2 — Roadmap mestre, índice documental e gates

**Atualizado em:** 2026-11-03
**Branch canônica de desenvolvimento da V2:** `v2` — derivada da `main` em `83010dce2c5fd64700759a642bb9e414221ea84d`.
**Situação:** **F0, F1 e F2 ACEITAS COM RESSALVAS**; F1 aceita em `85ce1e3`; **F2 aceita pelo proprietário em 2026-10-29 sob `F2_ACCEPTED_WITH_RESERVATIONS`**, com implementação em `8e4dc71` (188 unit e 50 E2E PASS) e [relatório de aceite](../audits/2026-10-28-v2-f2-acceptance.md). O aceite cobre implementação local/simulada; não homologa Firebase, sincronização real, recuperação produtiva de backups ou publicação. **F3_SPEC_APPROVED** e **F3_PLAN_APPROVED_FOR_GOAL** em 2026-10-29 (D-F3-01–26; 20 tarefas; F3-T01–T42); GOAL executado; F3 implementada, testada (297 unit, 77 E2E + 1 skip) e revisada em quatro rodadas — **F3_ACCEPTED_WITH_RESERVATIONS em 2026-10-30**, por autorização humana expressa, após integração do candidato `3f6d4be` e documentação remota `5c03763`. Escopo local-first aceito; hardware modesto real `NOT_RUN`, aviso automático de prova vencida ausente e F2/F7/F8 fora do aceite. **F4_ACCEPTED_WITH_RESERVATIONS em 2026-11-01**, com código aceito em `b51a9d5`, aceite documental em `1e0f918` e integração fast-forward à `origin/v2` (56 commits, `68db015..1e0f918`); 443 testes unitários e 102 E2E (101 PASS + 1 skip), lint/build PASS; F4-T13 `NOT_RUN`, quatro HIGH F0 `UNVERIFIED`, F7 reserva Firebase/multi-dispositivo. **F5_ACCEPTED_WITH_RESERVATIONS em 2026-11-03**, por aceite humano expresso do candidato `origin/v2@c358928` (código/testes em `9817fb8`), após 520 testes unitários PASS e 115 E2E (114 PASS + 1 skip) reportados, duas revisões críticas por subagentes e correções; ressalvas de capturas F4, trabalho exclusivo Git preservado, quatro HIGH F0 `UNVERIFIED`, F4-T13 `NOT_RUN`, benchmark real pendente e F7 reservada. `main@9046cfa` protegida contra integração antecipada por risco de deploy Cloudflare; sem cutover. **F6_SPEC_APPROVED** e **F6_PLAN_APPROVED** em 2026-11-03 (22 decisões D-F6-01–22 na opção B; plano T00–T20); o GOAL único foi executado localmente até um estado **PARTIAL** em 2026-11-03, sem aceite e sem push de código. F7–F8 permanecem propostas.
**Tipo:** roteiro por fases, dependências, critérios de aceite e acompanhamento. **NÃO É AUTORIZAÇÃO DE IMPLEMENTAÇÃO.**
**Issue mãe:** [#108 — Reconstrução V2 F0–F8](https://github.com/matheussilva421/estudo-organizado/issues/108), único acompanhamento central, sem criar uma issue por ajuste.
**Produto V1:** permanece na `main` para manutenção/publicação; **a branch `v2` não é ambiente de produção**.

## 0. Centro de referência (fonte única por responsabilidade)

Este roadmap é o **índice e acompanhamento canônico** da V2. Os documentos existentes permanecem em seus caminhos históricos para preservar links, aprovações e rastreabilidade; **não duplicar** conteúdo nem movimentá-los apenas por estética.

| Artefato | Fonte canônica nesta branch | Aprovação e papel |
| --- | --- | --- |
| Especificação arquitetural mestra | [Spec V2](../specs/2026-10-19-estudo-organizado-v2-design.md) | **G1 APROVADO** — D01–D27 + A-01 + A-02 |
| [Pré-contratos F1 — sync multi-dispositivo A-02](../specs/2026-10-28-v2-multidevice-sync-f1-contracts.md) | **PROPOSTA PARA F1** — sem código ou execução autorizada |
| [ADRs F1-01..05](../specs/2026-10-28-v2-f1-architecture-decisions.md) | **RATIFICADAS** em 2026-10-28; validação de implementação futura ainda pendente |
| [Especificação formal F1](../specs/2026-10-28-estudo-organizado-v2-f1-foundation-design.md) | **APROVADA** em 2026-10-28 ([aceite](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470639550)) |
| [Especificação formal F3](../specs/2026-10-28-estudo-organizado-v2-f3-planning-design.md) | **APROVADA em 2026-10-29**, D-F3-01–26; plano aprovado, GOAL/código pendentes |
| [Writing-plans Superpowers F3](../plans/2026-10-29-estudo-organizado-v2-f3-planning.md) | **APROVADO em 2026-10-29** — 20 tarefas, F3-T01–T42; GOAL ainda pendente e execução não autorizada |
| [Plano writing-plans F1](../plans/2026-10-28-estudo-organizado-v2-f1-foundation.md) | **APROVADO G2/F1** — 14 tarefas, 75 etapas TDD; execução não iniciada |
| [GOAL único F1 para Codex](../goals/2026-10-28-estudo-organizado-v2-f1-codex.md) | **PREPARADO** — somente envio explícito ao Codex autoriza G3/F1 |
| Plano executável F0 (6 tarefas, TDD) | [Plano F0](../plans/2026-10-19-estudo-organizado-v2-f0-audit.md) | **G2/F0 APROVADO** — método Subagent-driven |
| Roteiro de decomposição original | [Roteiro histórico F0–F8](../plans/2026-10-19-estudo-organizado-v2-roadmap.md) | Histórico aprovado; este documento é o roadmap vivo detalhado |
| GOAL de execução F0 | [GOAL Codex F0](../goals/2026-10-19-estudo-organizado-v2-f0-codex.md) | **Executado**, com evidências verificadas no [relatório F0](../audits/2026-10-19-f0-acceptance.md) |
| Identidade visual V1 | [PRODUCT.md](../../../PRODUCT.md) e [DESIGN.md](../../../DESIGN.md) | Baseline obrigatório a preservar e auditar |
| Ferramentas visuais | `.impeccable/` da V1 + [Impeccable](https://impeccable.style/) | Emenda A-01; confirmar instalação/hook/versionamento antes do uso |
| Referência V1 | [Arquitetura atual](../../architecture/app-overview.md) e documentação em `docs/api/` / `docs/security/` | Referência de auditoria, **não** contrato V2 |
| Padrões do repositório | [AGENTS.md](../../../AGENTS.md) e [docs/README.md](../../README.md) | Respeitar proteções e não aplicar regras Vanilla V1 ao futuro React V2 sem uma instrução específica |
| Issue de produção relacionada | [#107 — sync Reta Final](https://github.com/matheussilva421/estudo-organizado/issues/107) | Problema V1 independente; risco/insumo de F0, não entrega V2 automática |

Os PRs documentais históricos [#104](https://github.com/matheussilva421/estudo-organizado/pull/104) e [#105](https://github.com/matheussilva421/estudo-organizado/pull/105) já foram integrados à `main`. A branch `v2` começa com os mesmos documentos e passa a ser o ponto único para evolução do desenho V2.

### Legenda de estados

- **APROVADO:** decisão/artefato autorizado explicitamente, não necessariamente executado.
- **PENDENTE:** nenhuma evidência de execução/aceite encontrada ou fase ainda não autorizada.
- **EM EXECUÇÃO:** somente após commit, evidência verificável e relatório do agente.
- **BLOQUEADO:** gate obrigatório, falha material ou decisão de arquitetura ainda pendente.
- **INTEGRADO:** commits verificados na branch destino adequada. Integrar em `v2` não equivale a publicar nem migrar para a `main`.
- **PUBLICADO:** implantação real, confirmada separadamente após autorização; não se aplica a F0–F7.

## 1. Meta e fronteiras inegociáveis

Recriar a experiência Estudo Organizado em V2 **web/PWA local-first, React + TypeScript + Vite, IndexedDB canônico, login Google via Firebase Authentication e Cloud Firestore Spark como único sync remoto opcional, automático por padrão após ativação, custo recorrente obrigatório R$ 0**, monólito modular por domínios, UX redesenhada e identidade V1 preservada.

Manter as 27 decisões arquiteturais, A-01 (Impeccable) e **A-02 (sincronização multi-dispositivo confiável, aprovada em 2026-10-28)**. D06 continua híbrida, mas o padrão manual após ativação foi substituído pela A-02. Cada funcionalidade V1 precisa de destino rastreável (PRESERVAR/REFORMULAR/UNIFICAR/ADICIONAR/DESCONTINUAR), submetido à aprovação. Não existe autorização automática de migrar dados reais, mudar serviços em produção, criar Actions, conceder billing, integrar com Plataforma Unificada ou substituir a V1.

**Regra de integridade:** zero perda silenciosa de dados. Falha local, sync, migração, importação, conflito, exclusão e restauração são estados diagnosticáveis, não situações que permitem presumir sucesso.

**Regra de Git:** `main` é a linha de produção V1. `v2` é a única linha de desenvolvimento V2 autorizada para este roadmap; branches temporárias/worktrees são excepcionais, curtas e saneadas após integração autorizada. Sem novos PRs/Actions por padrão. A entrada do código V2 na `main` está bloqueada até gate humano específico de integração/release.

## 2. Mapa de fases e resultados

| Fase | Situação verificada em 2026-11-01 | Objetivo | Dependência principal |
| --- | --- | --- | --- |
| **G0/G1** | APROVADOS | Arquitetura e spec-mestra + emendas | D01–D27 + A-01 + A-02 |
| **G2/F0** | APROVADO (plano e método) | Escrita do plano F0 | G1 |
| **F0 — Auditoria V1** | **ACEITA COM RESSALVAS — recálculo `APPROVED`** | Entregue, integrada à `v2`; 45 destinos funcionais definidos + 1 adiamento aprovado | [Aceite humano #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279) e [relatório F0](../audits/2026-10-19-f0-acceptance.md) |
| **F1 — Fundação técnica** | **ACEITA COM RESSALVAS — 2026-10-28, commit `85ce1e3`** | Fundação isolada, disciplina local, persistência confiável e contratos A-01/A-02 | [Aceite humano #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6475527680) e [relatório F1](../audits/2026-10-28-v2-f1-acceptance.md) |
| **F2 — Editais e conteúdo** | **ACEITA COM RESSALVAS — `F2_ACCEPTED_WITH_RESERVATIONS`** (2026-10-29) | Base canônica de organização | [Relatório de aceite](../audits/2026-10-28-v2-f2-acceptance.md); `8e4dc71`, 188 unit e 50 E2E PASS; três lacunas obrigatórias antes do sync real na F7; quatro HIGH `UNVERIFIED`; F2-T22 `NOT_RUN`; Firebase/emulador sem autorização |
| **F3 — Planejamento** | **F3_ACCEPTED_WITH_RESERVATIONS em 2026-10-30 — integrado à `v2`; não implantado** | 20 tarefas; 297 unit e 77 E2E PASS (+1 skip); quatro rodadas de revisão; aceite no [relatório F3](../audits/2026-10-29-v2-f3-acceptance.md) | Ressalvas: hardware modesto `NOT_RUN`, aviso de prova vencida ausente, F2/F7/F8 não homologados |
| **F4 — Execução/sessões** | **F4_ACCEPTED_WITH_RESERVATIONS em 2026-11-01 — código `b51a9d5`, aceite `1e0f918`, integrada à `origin/v2`; 443 unit e 102 E2E (101 PASS + 1 skip); F4-T13 NOT_RUN; quatro HIGH F0 UNVERIFIED; não implantada** | Tempo/histórico confiáveis | Persistência e domínio |
| **F5 — Revisões/inteligência** | **`F5_ACCEPTED_WITH_RESERVATIONS` em 2026-11-03 — candidato `c358928`, 520 unitários PASS, 114 E2E PASS + 1 skip; integrada à `v2`, sem deploy; F4/capturas e Git preservados; `main` bloqueada; F7 e riscos pendentes** | Revisar e priorizar | F2–F4 |
| **F6 — Experiência integrada** | **F6_SPEC_APPROVED + F6_PLAN_APPROVED em 2026-11-03 — execução local não iniciada** | Shell/Home/analytics/busca/atenção/configurações com F2–F5 | Dados canônicos por domínio |
| **F7 — Homologação integrada** | **SPEC PROPOSTA; não iniciada** | Migração, sync, segurança, restore, piloto | F1–F6 |
| **F8 — Cutover** | **SPEC PROPOSTA; G5 bloqueado** | Adoção da V2 como app principal | G5 humano e contingência |

**Importante:** sincronização, backup, segurança, migração e Impeccable **não** começam apenas em F7; cada fatia vertical deve exercitar seus contratos desde F1.

## 3. F0 — Auditoria funcional e técnica da V1

**Objetivo:** criar um baseline verificável antes de escrever specs de implementação que dependam do código e dos dados reais da V1. **Nenhum código funcional V1 é modificado.**

**Tarefas vinculadas ao [plano F0 aprovado](../plans/2026-10-19-estudo-organizado-v2-f0-audit.md):**
1. Contrato de inventário com validador puro e TDD RED→GREEN.
2. Varredura de superfícies V1, telas, funcionalidades, testes, dependências e lacunas de cobertura.
3. Mapa de schemas/versionamento/import-export, IDs, relacionamentos e proveniência; versões divergentes ficam sinalizadas.
4. Matriz de riscos: IndexedDB, Firestore/outbox, tombstones, concorrência, Auth/Rules, XSS, backups, quota e SW; considerar #107 sem executar correções V1.
5. Baseline com testes locais reais e ambiente mock sintético; identidade visual, oito temas, dispositivos e **Impeccable** com relatórios e autorização para hooks quando necessária.
6. Consolidação, revisão independente e relatório de aceitação F0, com status PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN.

**Entrega esperada:** inventário canônico com 100% das superfícies descobertas mapeadas ou exclusões justificadas, matriz V1→V2 com propostas e evidência por funcionalidade, tabela de schemas e migração, riscos priorizados, testes documentados, baseline visual, proposta de ordem de F1–F8 e aceite humano pendente. A ausência de evidência **não** é cobertura.

**Gate da auditoria F0:** `APPROVED` após [aceite com ressalvas](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279). **F1 já foi implementada/testada e aceita com ressalvas**; G3/F1 não está pendente. Isso não homologa Firebase real, E2E V1, migração ou UX final. Laboratório visual `UNDECIDED`; quatro HIGH `UNVERIFIED`.

**Operação:** GOAL F0 já executado pelo Codex no método Subagent-driven. Histórico e evidências permanecem no [relatório F0](../audits/2026-10-19-f0-acceptance.md). Não repetir a auditoria sem novo motivo.

### Resultado da execução F0 (2026-10-28)

- **Relatório:** [2026-10-19-f0-acceptance.md](../audits/2026-10-19-f0-acceptance.md).
- **Inventário:** 46 funcionalidades em 24 domínios; 86 superfícies descobertas, 84 mapeadas e 2 exclusões justificadas.
- **Dados:** 37 registros de schema, com conflitos explícitos entre schema 12/11/9/7, IndexedDB 7/6 e backup sem versão própria.
- **Riscos:** 13 (4 HIGH, 7 MEDIUM, 2 LOW); issue #107 registrada como risco UNVERIFIED; nenhum CRITICAL.
- **Baseline:** 11 verificações — 4 PASS, 2 FAIL, 2 INCONCLUSIVE, 3 NOT_RUN.
- **PASS:** 66 testes dos validadores; 189 arquivos/3048 testes unitários; lint 0 erros; design/contraste 45 testes; Impeccable 3.9.1 executado.
- **FAIL:** `test:e2e:mock` não encontra testes; `test:e2e:mock:all` tem 59 PASS e 107 FAIL, registrados sem correção da V1.
- **Gate original da execução:** `READY_FOR_HUMAN_REVIEW`. **Após aceite humano:** gate `APPROVED`, com ressalvas ([registro](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279)). Inventário atualizado: 35 `PRESERVE`, 10 `REFORMULATE`, 1 `UNDECIDED` com adiamento expressamente aprovado; F1 continua bloqueada até aprovações próprias.

## 4. F1 — Fundação mínima e vertical técnica comprovável

**Objetivo:** demonstrar uma jornada mínima end-to-end local, sem construir infraestrutura genérica para todos os módulos.

**Pacotes de trabalho candidatos, sujeitos à spec específica pós-F0:**
- Definir árvore física V2 isolada da V1 na mesma branch/repositório, critérios de build e isolamento de publicação, sem alterar o pipeline V1.
- Configurar React/TypeScript/Vite, navegação mínima, PWA e assets offline com versionamento seguro.
- Implementar contratos públicos por domínio e boundaries automatizados (imports proibidos/ciclos), sem dependência do React no domínio.
- IndexedDB mínimo e exclusivo V2, transações locais, versionamento próprio, migrações de teste em sandbox; outbox atômica acoplada ao commit local. **Fronteira explícita entre LOCAL_COMMITTED, REMOTE_COMMITTED e CONVERGED**, sem dupla fila de writes offline para a mesma mutação.
- Portas/adaptadores de relógio, IDs, armazenamento, backup e sync; sem ativação de Firebase de produção. **Definir pré-contratos A-02**: Google Auth e vínculo explícito, automático após opt-in, idempotência/ACK, coordenação de abas, CAS, deltas remotos, cursor/rebaseline, tombstones, recuperação segura e orçamento Spark.
- Especificar alternativas de documentos por entidade/agregado **delimitado** e medir estimativas de leituras/escritas e limites do Firestore; proibir snapshot monolítico como arquitetura central. **Quatro riscos HIGH continuam abertos até testes.**
- Documentar ADRs sobre estado/esquema V2 independente de V1 12/11/9/7, IndexedDB 7/6, backup versionado e tombstones, sem presumir implementação de migração real.
- Testes RED→GREEN de entidade→caso de uso→commit local→consulta reativa; vitest/integração/e2e offline.
- Tokens do design system derivados de DESIGN.md, primeiros componentes e análise Impeccable com evidência.
- Orçamento inicial de performance/capacidade a partir das medições F0; risco de quota e erro de gravação tratado.

**Gate F1:** uma operação real de negócio sintética sobrevive a refresh/offline; gravação duplicada/fracassada não cria confirmação falsa; fronteiras de domínio comprovadas; PWA não interfere na V1; revisão Impeccable e aceite humano.

### Resultado da execução F1 (2026-10-28)

- **Relatório:** [2026-10-28-v2-f1-acceptance.md](../audits/2026-10-28-v2-f1-acceptance.md).
- **Aplicação isolada:** `apps/v2/` em `127.0.0.1:18431`, IndexedDB `estudo-organizado-v2`, SW próprio.
- **Jornada:** criar/listar/renomear/recuperar disciplina com commit atômico e outbox durável.
- **PASS local:** typecheck, lint, 84 testes unitários, 20 E2E, build; Impeccable 0 achados após ajuste do ramp; 8 temas AA na amostra. Inclui duas abas reais, rollback IDB, quota de formulário e retry confirmado.
- **Contratos A-02:** CAS/idempotência/read-back/conflito/Web Locks/fake UID e backup com tombstones demonstrados por fake e fixtures sintéticas.
- **UNVERIFIED:** os quatro riscos HIGH da F0 continuam abertos; Firebase, emulador, quota física, multi-dispositivo real e leitor de tela não foram executados.
- **Gate:** `F1_ACCEPTED_WITH_RESERVATIONS` em 2026-10-28, commit `85ce1e3` ([registro](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6475527680)); 4 HIGH permanecem `UNVERIFIED`; F2 sem implementação.

## 5. F2 — Domínio de editais e conteúdo

**Objetivo:** estabelecer fonte canônica de editais, disciplinas, assuntos, tópicos, aulas e relações, preservando os dados históricos existentes.

**Entregas planejadas, revisáveis após F0:** entidades/IDs estáveis e índices; um principal ou outros invariantes apenas depois de confirmado destino funcional; CRUD e arquivamento seguro; importação JSON com preview, matching conservador, proveniência e idempotência; transformação de amostras sintéticas V1→V2; validações de referências órfãs; comandos/consultas tipados e UX responsiva.

**Testes críticos:** importação repetida; edições concorrentes; disciplina/tópico homônimo; edital arquivado; exclusão e relações em cascata; JSON inválido; conteúdo hostil/XSS; alteração de edição não altera progresso relacionado.

**Gate F2:** inventário de funcionalidades de conteúdo atendido, integridade referencial, nenhuma importação destrutiva silenciosa e UX aprovada com Impeccable.

## 6. F3 — Planejamento, calendário, ciclo e reta final

**Gate vigente (2026-10-30):** `F3_ACCEPTED_WITH_RESERVATIONS` por aprovação humana expressa — [spec F3](../specs/2026-10-28-estudo-organizado-v2-f3-planning-design.md) D-F3-01–26 e [writing-plans F3](../plans/2026-10-29-estudo-organizado-v2-f3-planning.md) de **20 tarefas**; F3-T01–T42 com evidências reportadas (297 unit, 77 E2E PASS + 1 skip), quatro rodadas de revisão. Candidato `3f6d4be` + commit documental `5c03763` integrados à `origin/v2`; commit do aceite é documental posterior. **Ressalvas:** hardware modesto `NOT_RUN`, UI sem aviso automático de prova vencida, F2 ainda com ressalvas e F7/F8 não homologadas. V1/`main` preservadas; F4 autorizada e em execução local.

**Objetivo:** gerar e editar planos consistentes, compreensíveis e auditáveis para concursos com diferentes calendários.

**Entregas:** regras canônicas de calendário/data civil, hora local/fuso/recorrências; programação de ciclos, metas, janelas e restrições; agenda/calendário; blocos de reta final e importação compatível com destino aprovado; replanejamento explícito de atividades vencidas sem reescrever histórico; associação com assuntos e futuros registros de sessão; projeções locais.

**Testes críticos:** fuso alterado, horário de verão, data inválida, prova/prazo sem horário, blocos atrasados, retomada e replanejamento, geração idempotente, sobreposições e relações órfãs.

**Gate F3:** geração determinística e rastreável, calendário consistente no desktop/mobile e replanejamento que não apaga previsões passadas.

## 7. F4 — Execução, timer, sessões e histórico

**Objetivo:** tornar o tempo e o desempenho registrados uma fonte confiável, mesmo com suspensão do navegador.

**Entregas:** máquina de estados durável iniciar/pausar/retomar/concluir/recuperar; medição monotônica durante execução e checkpoints persistentes; controle de autoridade entre abas; registro de questões, acertos, atividades, tópicos e hábitos associados; edição auditável; projeções e histórico; UX de continuidade offline.

**Testes críticos:** dois cliques de concluir; refresh/falha de energia; suspensão de notebook; clock incorreto; duplicação por dois tabs; sessões offline concorrentes em dois dispositivos; soma dos intervalos válidos versus dashboard.

**Gate F4:** nenhuma duplicidade, tempo ambíguo tratado explicitamente, commit local confirmado e histórico reconciliável.

**Resultado (2026-11-01):** `F4_ACCEPTED_WITH_RESERVATIONS`; código `b51a9d5`, aceite documental `1e0f918`; 443 unit e 102 E2E (101 PASS + 1 skip); integração fast-forward à `origin/v2`; F4-T13 `NOT_RUN`; quatro HIGH F0 `UNVERIFIED`; `INCOMING` parcial e conflitos preservados; sem deploy produtivo e sem integração à `main`.

## 8. F5 — Revisões, pontos fracos e inteligência de banca

**Objetivo:** priorizar estudos com base em evidência histórica e regras auditáveis.

**Situação (2026-11-03):** **`F5_ACCEPTED_WITH_RESERVATIONS` por aprovação humana expressa**, para o candidato `origin/v2@c358928749951b5848217040762af2785fffae8b`, após implementação e revisões da F5 (520 unitários PASS, 115 E2E: 114 PASS + 1 skip, resultados reportados pelo Codex). A `main` permanece como V1 e sua integração está bloqueada pelo risco de deploy Cloudflare. **Ressalvas formais e limites do aceite:** [relatório F5](../audits/2026-11-02-v2-f5-acceptance.md); não houve homologação F7, cutover nem autorização para iniciar F6.

**Pendências após aceite F5:** três PNGs F4 atuais preservadas, mas seus bytes anteriores à regeneração Playwright **não recuperados**; versões HEAD e 24 variantes históricas resguardadas; backup de 43/43 artefatos com redundância local em dois discos C:/D: verificada por relatório (sem offsite); branch de preservação `6cad56c`, dois worktrees, snapshots e refs exclusivos sem exclusão destrutiva; quatro riscos HIGH F0 `UNVERIFIED`; F4-T13 `NOT_RUN`; bundle >500 kB, hardware modesto não ensaiado; convergência real/Firestore/Auth/Rules apenas F7. **A fase F5 foi aceita com ressalvas no destino `v2`; não se confunde com integração à `main` ou publicação V2.**

**Fontes normativas F5 (aprovadas pelo proprietário):** [especificação formal revisada](../specs/2026-11-01-estudo-organizado-v2-f5-reviews-design.md) — D-F5-01–28 e F5-T01–F5-T48; [writing-plans revisado](../plans/2026-11-01-estudo-organizado-v2-f5-reviews.md) — T01–T20, RP-01–RP-12, TDD, revisão e integrações F2–F4. A [proposta de 2026-10-28](../specs/2026-10-28-estudo-organizado-v2-f5-reviews-design.md) é histórica e não prevalece.

**Metadados dos arquivos aprovados:** os arquivos acima preservam integralmente os bytes da revisão aprovada (SHA-256 spec `0f45de81a0161a54651205ee6b9d1b27989ec4c2cf8151ff682c7e558180dee3`; plano `f24c6caf949bacbb18beba9a02de607e483e080e0cd5ebc6101fc5dceef85c72`). Avisos internos anteriores de “aprovação pendente” registram a situação na data da redação; **o aceite posterior de ambos os documentos nesta conversa prevalece**, sem autorizar implementação, merge na `main` ou deploy. O GOAL tem os anexos integrais e pode validar seus hashes.


**Entregas:** revisão espaçada com dados canônicos, geração/reagendamento explícito, ranking de pontos fracos, análise de questões e banca, consultas e filtros, projeções interpretáveis; auditoria de lacunas V1 e preservação de decisões funcionais de F0.

**Testes críticos:** editar/apagar sessão e recalcular revisões; assunto arquivado, datas civis, reincidência e séries de desempenho, vazios, índices de priorização explicáveis, sync sem dupla contagem.

**Gate F5:** regras determinísticas, estatísticas reconciliadas com fatos de execução e usuários compreendem a justificativa da priorização.

## 9. F6 — Dashboards, navegação e refinamento Impeccable

**Objetivo:** consolidar a experiência redesehada sem criar uma UI genérica ou replicar estado do banco.

**Situação (2026-11-03):** **F6_SPEC_APPROVED** e **F6_PLAN_APPROVED** por aprovação expressa do proprietário — 22 decisões arquiteturais **D-F6-01–22, todas na opção B**, e writing-plans T00–T20. Fontes canônicas: [especificação formal F6](../specs/2026-11-03-estudo-organizado-v2-f6-experience-design.md), [writing-plans F6](../plans/2026-11-03-estudo-organizado-v2-f6-experience.md) e [GOAL único F6](../goals/2026-11-03-estudo-organizado-v2-f6-codex.md). A proposta histórica de 2026-10-28 permanece como histórico não aprovado.

**Implementação local (2026-11-03):** estado **PARTIAL / READY_FOR_HUMAN_REVIEW**, sem aceite. Entregues localmente o shell modular por rota (a visão integrada na rota raiz preserva a compatibilidade F2–F5), rotas tipadas com histórico/âncoras seguras, Home com modos de apresentação e catálogo de indicadores, busca local F2–F5, guarda de edição em links e histórico, central de atenção com conflitos F4 e erro de leitura explícito, configurações de tema/densidade e analytics com amostra pequena sinalizada. Preservação F4 e ausência de push de código. Evidência: 553 unitários PASS; 131 E2E previstos (129 PASS + 2 skips justificados); typecheck/lint/build PASS; bundle 590,59 kB (164,31 kB gzip); matriz 8 temas × 3 viewports com contraste mínimo 6,78:1 e 31 capturas F6. Duas revisões independentes read-only: nenhum P0; P1 corrigidos; P2 documentados. Pendências materiais: rascunhos recuperáveis dos demais formulários F2–F5, cache de projeções (RF18), foco de bloco fora da janela do calendário, roving tabindex documentado, fontes não empacotadas e ensaio manual de leitor de tela. O código permanece **local na worktree v2, sem commit remoto/push**.

**Entregas:** painel inicial com próximo passo, metas, consistência de métricas e progresso, jornadas Organizar→Planejar→Estudar→Revisar→Analisar, filtros/contextos, versão mobile/tablet/desktop com densidade legível; temas e componentes reutilizáveis; estados vazios/erro/sync; diagnósticos acessíveis.

**Pipeline Impeccable obrigatório:** inspecionar PRODUCT.md/DESIGN.md; shape/critique; implementar somente design autorizado; audit/adapt/harden; polish/distill com evidência de screenshots e testes de contraste WCAG AA nos oito temas, teclado, touch ≥44px em coarse e prefers-reduced-motion. Sem instalar hooks por inferência nem sobrescrever documentos V1.

**Testes críticos:** indicadores divergem de sessões, tabelas largas no mobile, modal por teclado, contrastes nos oito temas, regressões visuais por viewport, loading e respostas longas.

**Gate F6:** UX assinada por revisão independente e gate humano, sem achados visuais graves sem solução.

## 10. F7 — Integração e homologação global

**Objetivo:** qualificar em conjunto os mecanismos já desenvolvidos nas fases anteriores.

**Pacotes de homologação:**
- **F7-A Sync:** Google Sign-In + Firebase Authentication, Firestore Spark, Rules/UID, login e vínculo seguro em múltiplos dispositivos, outbox idempotente, CAS, tombstones, merge conservador, cursor/rebaseline, limites e orçamento Spark; emulador e ambiente isolado com fixtures sintéticas. Verificar PC→celular→tablet, duas abas e dois dispositivos offline, timeout/retry e convergência verificada, conforme [A-02](../specs/2026-10-28-v2-multidevice-sync-f1-contracts.md).
- **F7-B Migração:** snapshots V1 sintéticos e conjuntos controlados autorizados; versões observadas, reconciliação de contagens, relacionamentos e estatísticas, quarentena de incompatíveis.
- **F7-C Backup/restore:** exportação externa versionada, manifesto/checksum, preview, restauração isolada, falhas, recuperação e reimportação idempotente.
- **F7-D PWA:** Service Worker atualizado com sessão ativa, compatibilidade entre versões e client antigo, armazenamento baixo, offline prolongado e reinicialização.
- **F7-E Segurança/privacidade:** Firestore Rules, proteção de entradas, Auth, conteúdo importado, logs sanitizados e emuladores; custos e cotas gratuitas verificados.
- **F7-F Piloto:** protótipo operacional em ambiente isolado; comparação funcional V1/V2; homologação desktop/tablet/celular e Impeccable; nenhuma escrita simultânea no mesmo acervo produtivo.

**Gate F7:** relatórios de execução real, métricas, divergências resolvidas/aprovadas, nenhum FAIL crítico oculto, backups restauráveis e procedimento de corte ensaiado. **F7 aprovada não autoriza cutover.**

## 11. F8 — Cutover e estabilização

**Objetivo:** somente após G5 humano, substituir oficialmente a V1 mantendo recuperação e histórico.

**Checklist vinculante:** inventário de funcionalidades aprovado; backup externo V1 íntegro, recuperável e validado; freeze de gravações V1; migração final com reconciliação; V2 como única autoridade de novas gravações; rollout controlado em dispositivos; observabilidade e rollback/contingência avaliados sem presumir downgrade automático do IndexedDB; preservar dados novos criados na V2 antes de qualquer retorno.

**Gate G5 exclusivo humano:** autorização específica após F7. Sem isso, não alterar produção, domínio, cache, SW, segredos nem dados reais.

**Encerramento:** registrar o que está implementado, testado, integrado à branch correta e publicado (quatro conceitos diferentes). Saneamento Git e encerramento do projeto só após comprovação de trabalho integrado e aceite.

## 12. Qualidade, dependências e critérios transversais

### Ciclo obrigatório de qualquer fatia implementável

1. Preflight real: `main`, `v2`, HEAD, worktree, mudanças não commitadas, PRs, dependências e fonte canônica da spec.
2. Spec de domínio aprovada com invariantes, portas, dados, UI, ameaças e critérios de aceite.
3. Plano writing-plans executável com arquivos precisos, assinaturas, testes negativos (RED) e positivos (GREEN) e autorização.
4. Implementação TDD e testes locais específicos; sem Actions/workflows novos por padrão.
5. Revisão independente proporcional ao risco (dados/sync/migração/segurança críticos).
6. QA Impeccable nas fatias com UI, screenshots e resultados reproduzíveis; não é substituto de testes E2E.
7. Evidências PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_RUN, orçamento limitado de remediação, diagnóstico de causa raiz se falha material persistir.
8. Integração autorizada em `v2` (e futuramente `main` somente quando houver gate), limpeza segura de branch/worktree temporária e atualização deste roadmap/issue.

### Matriz transversal de testes

| Dimensão | Cenário representativo | Início esperado |
| --- | --- | --- |
| Dados | Commit local, falha atômica, quota, migração IndexedDB | F1 |
| Conteúdo | IDs, relações, import JSON e idempotência | F2 |
| Planejamento | datas civis, fusos, recorrências, vencidos, reta final | F3 |
| Cronômetro | multiaba, suspensão, idempotência e recuperação | F4 |
| Revisões | histórico alterado, priorização e consistência | F5 |
| Métricas/UX | dashboards, oito temas, teclado, touch, Impeccable | F1–F6 |
| Sync | outbox, concorrência, conflitos, exclusões, Auth/Rules | Contrato F1; gate integrado F7 |
| Migração/backup | V1 snapshot, restore, relação órfã, readback | Contrato F1; gate integrado F7 |
| PWA | reload, versão incompatível, SW, offline prolongado | F1–F7 |
| Privacidade | logs, credenciais, dados importados, ambiente isolado | Todas as fases |

**Sem thresholds inventados:** orçamentos numéricos de performance, tamanho, cota, taxa de erro e janela de recuperação serão propostos após medições F0/F1 e aprovados nas specs de domínio.

## 13. Riscos e dependências de decisão

| Risco | Mitigação / gate |
| --- | --- |
| Histórico V1 perdido ou inconsistência de versões | F0 descobre esquemas reais; F7 valida transformação isolada; G5 controla produção |
| Drift da `v2` frente à V1 em produção | Registrar base e selecionar correções essenciais da main somente após revisão; sem merge automático e sem contaminar V2 com mudanças não desejadas |
| Quatro riscos HIGH da F0: plano legado #107, documento >1 MiB, corrida da outbox, tombstones perdidos | **HIGH/UNVERIFIED** até prova de contrato na F1 e testes adversariais com emulador em F7; não alterar a V1. Matriz: [riscos F0](../audits/2026-10-19-v1-risk-matrix.json) e [A-02](../specs/2026-10-28-v2-multidevice-sync-f1-contracts.md). |
| Acesso a dados de usuário nos ensaios | Somente fixtures sintéticas até autorização específica de teste controlado |
| Quota Spark ou mudança de requisitos de billing | Limitar operações, backoff, manter offline local e rever disponibilidade antes de publicação |
| Acoplamento de domínios e crescimento de arquivos | Contratos públicos tipados, verificação de dependências e revisão independente |
| Impeccable indisponível ou com hooks mutantes | Confirmar configuração e autorizações; bloquear gate de UI se necessário |
| Escopo V2 expandido oportunisticamente | Mudança de spec/ADR e aprovação; backlog separado |
| Plano remoto antigo obsoleto | Fonte única neste roadmap + docs históricos referenciados sem duplicação |

## 14. Handoff, higiene Git e status atual

**Fonte da verdade para progresso:** este roadmap, atualizado a cada gate material. A issue mãe é o quadro executivo, não um segundo relatório gigante; seções/checklists da issue referenciam este documento.

- **Baseline confirmado:** `main` permanece em `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` (2026-10-28), intocada por F0/F1. `v2` recebeu o merge `689a9f4`, os commits F0 e os commits F1 em `apps/v2/`.
- **Branches antigas:** `docs/superpowers-estudo-organizado-v2-design` e `docs/superpowers-estudo-organizado-v2-f0-plan` são branches históricas de PRs #104/#105 já mesclados por squash. **Não excluir** sem inventário dos commits exclusivos e nova autorização; não utilizá-las para desenvolvimento novo.
- **PRs abertos no preflight:** nenhum. Não criar PR novo apenas para acrescentar roadmap/issue à branch `v2`.
- **Arquivos de auditoria F0 encontrados?** Sim: inventário, cobertura de fontes, matriz de schemas, matriz de riscos, baseline de QA, relatório Impeccable e relatório de aceitação em `docs/superpowers/audits/`.
- **Decisão A-02:** aprovada pelo usuário em 2026-10-28; spec-mestra atualizada e [pré-contratos de sync F1](../specs/2026-10-28-v2-multidevice-sync-f1-contracts.md) preparados **sem execução**. Não equivale a aprovação de arquitetura física de sync, solução dos riscos ou gate F0.
- **Aceite F0:** [aprovado com ressalvas em #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279); gate recalc `APPROVED`, não representa homologação V1. O laboratório visual mantém destino `UNDECIDED`/fora F1; 4 HIGH `UNVERIFIED` e 107 E2E FAIL continuam.
- **Gate G1/F1:** [spec F1](../specs/2026-10-28-estudo-organizado-v2-f1-foundation-design.md) e [ADRs F1-01..05](../specs/2026-10-28-v2-f1-architecture-decisions.md) ratificadas em [#108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470639550).
- **Gate G2/F1:** [plano aprovado](../plans/2026-10-28-estudo-organizado-v2-f1-foundation.md), Subagent-driven adotado para o handoff, [aceite humano](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470870847).
- **Fase operacional seguinte (2026-11-03):** **F5_ACCEPTED_WITH_RESERVATIONS**, candidato `c358928`, já publicado na `v2` e com aceite humano formal no relatório. Não iniciar F6/F7 sem novos gates. Preservar os dois worktrees, a branch de segurança, snapshots e três PNG F4; `main` permanece bloqueada pelo deploy Cloudflare.
- **Estado F1:** implementada em `apps/v2/`, testada localmente (84 unit/20 E2E), publicada em `origin/v2` e aceita com ressalvas em `85ce1e3`; quatro HIGH `UNVERIFIED` e Firebase/multi-dispositivo não homologados.
- **F2:** `F2_ACCEPTED_WITH_RESERVATIONS`, integrada à `v2`; [relatório único](../audits/2026-10-28-v2-f2-acceptance.md). Firebase/emulador, backup produtivo e multi-dispositivo permanecem fora do aceite e reservados à F7.
- **F4:** `F4_ACCEPTED_WITH_RESERVATIONS` em 2026-11-01; código `b51a9d5`, aceite `1e0f918`; 443 unit e 102 E2E (101 PASS + 1 skip); integração fast-forward à `origin/v2`; F4-T13 `NOT_RUN`; quatro HIGH F0 `UNVERIFIED`; `INCOMING` parcial preservado; sem deploy produtivo e sem `main`.
- **Testes executados:** F0 — 66 validadores PASS, 189/3048 unitários PASS, lint 0 erros; F1 — typecheck/lint/build PASS, 84 testes unitários e 20 E2E PASS; F4 — 443 unitários e 102 E2E (101 PASS + 1 skip), lint/build PASS no código `b51a9d5`. `test:e2e:mock` e `test:e2e:mock:all` da V1 mantêm FAIL; runtime Firebase/Cloudflare/Drive, migração real, emulador e multi-dispositivo permanecem NOT_RUN/UNVERIFIED.

## 15. Definição de conclusão de fase

Uma fase só estará **CONCLUÍDA** após verificar: escopo aceito, evidências de teste, revisão independente, gate humano correspondente, integração no destino correto (`v2` para desenvolvimento e `main` apenas no gate apropriado), ausência de mudanças órfãs, identificação de branches/PRs/worktrees obsoletos e pendências explícitas. Uma fase que passou testes, mas não foi integrada ou homologada, **não** é encerrada. A V1 seguirá em produção enquanto o cutover G5 não for expressamente autorizado.

---

**Proposta de atualização:** cada gate aprovado altera somente a linha da fase relevante, os bloqueios e o próximo passo deste arquivo e a checklist da issue. Specs e planos técnicos detalhados ficam nos caminhos existentes de `docs/superpowers/specs/` e `docs/superpowers/plans/`; não copiar o texto integral para este roadmap ou para a issue.

## 16. Especificações propostas para o restante do projeto (2026-10-28)

**Estado (nota histórica):** o desenho de 2026-10-28 é histórico, não a fonte vigente. F2–F4 foram aceitas com ressalvas; **F5 foi implementada e aceita com ressalvas em 2026-11-03**, com artefatos aprovados e relatório canônico publicados na `v2`. F6–F8 continuam propostas e sem autorização de início.

| Fase | Spec formal proposta | Condição de entrada / gate |
| --- | --- | --- |
| **F2** | [Editais, disciplinas, aulas e importação](../specs/2026-10-28-estudo-organizado-v2-f2-content-design.md) | Fase anterior aceite + revisão humana desta spec → writing-plans → GOAL |
| **F3** | [Calendário, ciclo, planejamento e Reta Final](../specs/2026-10-28-estudo-organizado-v2-f3-planning-design.md) | Fase anterior aceite + revisão humana desta spec → writing-plans → GOAL |
| **F4** | [Sessões, timer, histórico e hábitos](../specs/2026-10-30-estudo-organizado-v2-f4-execution-design.md) | `F4_ACCEPTED_WITH_RESERVATIONS` em 2026-11-01; código `b51a9d5`; aceite `1e0f918`; integração fast-forward à `origin/v2`; F4-T13 `NOT_RUN`; quatro HIGH F0 `UNVERIFIED`; sem deploy/`main` |
| **F5** | [Spec formal aprovada](../specs/2026-11-01-estudo-organizado-v2-f5-reviews-design.md) · [Writing-plans aprovado](../plans/2026-11-01-estudo-organizado-v2-f5-reviews.md) · [Aceite e ressalvas](../audits/2026-11-02-v2-f5-acceptance.md) · [Proposta antiga (histórica)](../specs/2026-10-28-estudo-organizado-v2-f5-reviews-design.md) | **`F5_ACCEPTED_WITH_RESERVATIONS` em 2026-11-03**; candidato `origin/v2@c358928`; testes/revisões reportados; main não integrada por risco Cloudflare; ressalvas F4/Git/desempenho/F0/F7 mantidas |
| **F6** | [Navegação, dashboards, busca e Impeccable](../specs/2026-10-28-estudo-organizado-v2-f6-experience-design.md) | Fase anterior aceite + revisão humana desta spec → writing-plans → GOAL |
| **F7** | [Auth/Firestore Spark, sync real, migração, backup e QA](../specs/2026-10-28-estudo-organizado-v2-f7-integration-design.md) | Fase anterior aceite + revisão humana desta spec → writing-plans → GOAL |
| **F8** | [Cutover, migração final, contingência e encerramento](../specs/2026-10-28-estudo-organizado-v2-f8-cutover-design.md) | Fase anterior aceite + revisão humana desta spec → writing-plans → GOAL |

**Ressalva sobre F2/A-02:** o [desenho F2](../specs/2026-10-28-estudo-organizado-v2-f2-content-design.md) propõe **antecipar um ensaio mínimo de Google Auth/Firestore em ambiente isolado** para detectar incompatibilidades antes de F7; é uma **proposta de ajuste de sequenciamento**, não mudança aprovada da A-02, nem autorização para criar projeto Firebase ou acessar serviços reais. Sem essa aprovação específica, F7 retém a homologação de sync real, com risco de integração tardia explicitamente rastreado.

**Ressalva sobre F8/G5:** não há autorização para freeze V1, dados reais, publicar V2, migrar banco, alterar GitHub Actions/Cloudflare ou integrar `v2` à `main`. G5 depende da F7 homologada e checklist de cutover aprovado.

## 17. Matriz de rastreabilidade das 46 funcionalidades F0 → responsáveis

**Regra de contagem:** esta matriz indica a fase de **aceite principal** de cada capacidade. Os contratos técnicos transversais podem começar antes e ser homologados depois. Um mesmo módulo pode ser testado em várias fases sem contabilizar a funcionalidade duas vezes. `PRESERVE` significa preservar a capacidade e seus dados, não copiar o código da V1; `REFORMULATE` permite reestruturação com equivalência funcional aprovada.

| Fase principal | ID F0 | Capacidade | Destino aprovado / situação |
| --- | --- | --- | --- |
| F1 | `F-V1-PERSISTENCE-INDEXEDDB` | Persistência local em IndexedDB | `PRESERVE` — diretriz aprovada, implementação pendente |
| F1 | `F-V1-SAVE-STATUS` | Indicador de salvamento local | `PRESERVE` — diretriz aprovada, implementação pendente |
| F1 | `F-V1-BOOT-RECOVERY` | Recuperação e reconciliação no boot | `PRESERVE` — diretriz aprovada, implementação pendente |
| F1 | `F-V1-PWA-OFFLINE` | PWA, service worker e uso offline | `PRESERVE` — diretriz aprovada, implementação pendente |
| F2 | `F-V1-EDITALS-CRUD` | Editais, disciplinas, assuntos e aulas | `PRESERVE` — diretriz aprovada, implementação pendente |
| F2 | `F-V1-PRINCIPAL-EDITAL` | Edital principal e escopo de dados | `PRESERVE` — diretriz aprovada, implementação pendente |
| F2 | `F-V1-ARCHIVED-EDITALS` | Editais anteriores | `PRESERVE` — diretriz aprovada, implementação pendente |
| F2 | `F-V1-VERTICAL-EDITAL` | Edital verticalizado | `PRESERVE` — diretriz aprovada, implementação pendente |
| F2 | `F-V1-EDITAL-IMPORT` | Importação de edital | `PRESERVE` — diretriz aprovada, implementação pendente |
| F2 | `F-V1-LESSON-MAPPER` | Mapeamento de aulas para assuntos | `PRESERVE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-STUDY-ORGANIZER` | Study Organizer e agenda de eventos | `PRESERVE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-CALENDAR` | Calendário mensal, semanal e painel do dia | `PRESERVE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-CYCLE` | Ciclo de estudos e progresso | `PRESERVE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-PLANNING-WIZARD` | Wizard de planejamento | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-RF-OVERVIEW` | Reta Final — visão do cronograma | `PRESERVE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-RF-IMPORT` | Reta Final — importação e ativação | `PRESERVE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-RF-EDITOR-PLANNER` | Reta Final — editor, planejamento e rascunho | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-RF-HISTORY` | Reta Final — checkpoints, histórico e undo/redo | `PRESERVE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-RF-CONFLICTS` | Reta Final — conflitos e merge | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-RF-PORTABILITY` | Reta Final — portabilidade e schema v2 | `PRESERVE` — diretriz aprovada, implementação pendente |
| F3 | `F-V1-RF-REDISTRIBUTION` | Reta Final — prioridade e redistribuição de capacidade | `PRESERVE` — diretriz aprovada, implementação pendente |
| F4 | `F-V1-TIMER-POMODORO` | Cronômetro livre, timers por evento e Pomodoro | `PRESERVE` — diretriz aprovada, implementação pendente |
| F4 | `F-V1-SESSION-REGISTRATION` | Registro de sessão multi-tópico | `PRESERVE` — diretriz aprovada, implementação pendente |
| F4 | `F-V1-SESSION-HISTORY` | Histórico de sessões e exportação | `PRESERVE` — diretriz aprovada, implementação pendente |
| F4 | `F-V1-HABITS` | Hábitos de estudo | `PRESERVE` — diretriz aprovada, implementação pendente |
| F5 | `F-V1-REVISIONS` | Revisões espaçadas | `PRESERVE` — diretriz aprovada, implementação pendente |
| F5 | `F-V1-WEAK-POINTS` | Pontos fracos por desempenho | `PRESERVE` — diretriz aprovada, implementação pendente |
| F5 | `F-V1-BANCA-ANALYZER` | Inteligência de banca e ranking de tópicos | `PRESERVE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-APP-SHELL` | Shell, navegação e despacho de ações | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-LEGACY-FACADES` | Facades legadas e namespace global | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-HOME-DASHBOARD` | Home e visão geral de desempenho | `PRESERVE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-ANALYTICS-DASHBOARD` | Dashboards analíticos e por disciplina | `PRESERVE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-GLOBAL-SEARCH` | Busca global | `PRESERVE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-NOTIFICATIONS` | Notificações nativas de estudo | `PRESERVE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-CONFIG-PREFERENCES` | Configurações de estudo e preferências | `PRESERVE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-THEMES` | Oito temas visuais e contraste | `PRESERVE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-ACCESSIBILITY` | Acessibilidade, foco e teclado | `PRESERVE` — diretriz aprovada, implementação pendente |
| F6 | `F-V1-SKELETON-LOADING` | Skeletons de carregamento | `PRESERVE` — diretriz aprovada, implementação pendente |
| F7 | `F-V1-FIRESTORE-SYNC` | Sincronização Firestore | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F7 | `F-V1-CLOUDFLARE-SYNC` | Sincronização Cloudflare | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F7 | `F-V1-DRIVE-SYNC` | Sincronização Google Drive | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F7 | `F-V1-SYNC-CENTER` | Central de sync, saúde e conflitos | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F7 | `F-V1-SYNC-DIAGNOSTICS` | Diagnóstico de sync e log | `REFORMULATE` — diretriz aprovada, implementação pendente |
| F7 | `F-V1-BACKUP-EXPORT-IMPORT` | Backup local, exportação e importação | `PRESERVE` — diretriz aprovada, implementação pendente |
| F7 | `F-V1-DATA-MANAGEMENT` | Gestão de dados e arquivamento | `PRESERVE` — diretriz aprovada, implementação pendente |
| Adiado | `F-V1-VISUAL-LAYOUT-LAB` | Laboratório visual de layout | Decisão do adiamento aprovada; destino **UNDECIDED**, fora F1–F8 inicial |

**Reconciliação:** 46/46 funcionalidades identificadas e mapeadas uma única vez: **4 F1 + 6 F2 + 11 F3 + 4 F4 + 3 F5 + 10 F6 + 7 F7 + 1 adiada = 46**. Das 45 com destino definido, **35 PRESERVE + 10 REFORMULATE**. F8 é fase de migração/cutover, não adiciona uma nova funcionalidade da V1. A matriz não é alegação de código implementado.

## 18. Caminho crítico, riscos e encerramento real

1. **Agora (2026-11-03):** F4 continua `F4_ACCEPTED_WITH_RESERVATIONS` na `v2` e F5 passou ao estado **`F5_ACCEPTED_WITH_RESERVATIONS`** por aceite humano expresso do candidato `c358928`. Persistem três capturas F4 não commitadas, bytes originais não recuperados, branch/worktrees/refs preservados, F4-T13 `NOT_RUN`, quatro HIGH F0 `UNVERIFIED`, benchmark em hardware modesto não realizado e homologação F7 pendente. **`main`/V1 não integrar** enquanto persistir risco de deploy Cloudflare; F6 não autorizada.
2. **F2–F6:** ratificar specs já propostas na ordem, ajustar apenas decisões afetadas pela fase anterior, redigir writing-plans por fase e executar TDD/local/Impeccable. Evitar PR por tarefa e não criar Actions.
3. **Sync antecipado (opcional pendente):** decidir após F1 se autoriza um ensaio emulado/Spark isolado pequeno em F2 ou se posterga todo uso remoto real a F7. Exigir orçamento e isolamento; nada de dados reais.
4. **F7:** provar Auth Google + Firestore Spark multi-dispositivo, Rules, backup/restore, quotas, conflitos e migração isolada; quatro HIGH só mudam status mediante evidências.
5. **F8:** aprovar explicitamente G5 depois de F7, congelar V1 com garantia de ausência de duplo escritor, backup restaurável, migração e reconciliação real, liberar V2, acompanhar e preservar contingência. **Não** presumir rollback simples de dados.
6. **Conclusão:** somente após verificação de funcionalidades, dados, QA, custo zero, versão publicada, `main` integrada e saneamento Git sem perda de commits; encerramento humano da issue #108.

**Fonte de custos:** verificar documentação oficial do [Firestore](https://firebase.google.com/docs/firestore/quotas) e [Firebase Spark](https://firebase.google.com/pricing) novamente antes do piloto: cotas gratuitas, **um banco gratuito por projeto**, limites de documento e funções de backup gerenciado pagas. Não projetar com pagamentos implícitos. A-02 requer sync automático **após opt-in e enquanto o app está ativo**; não prometer trabalho com PWA fechada.


## 19. Responsabilidades de planejamento (Superpowers) — revisão 2026-10-28

**Fluxo canônico e obrigatório para F2–F8:** **ChatGPT + Superpowers brainstorming** → alternativas e decisões apresentadas ao proprietário → **spec escrita e revisada pelo ChatGPT** → aprovação humana da spec → **ChatGPT + Superpowers writing-plans** (arquivos, interfaces, TDD, passos verificáveis, revisão independente e QA) → aprovação humana do plano/método → **GOAL de execução escrito pelo ChatGPT** → **Codex implementa e testa localmente** na branch `v2` → **ChatGPT revisa evidências/código e define correções** → Codex corrige → proprietário decide aceite da fase. Não delegar ao Codex a criação da spec ou do writing-plans.

**Estado documental (2026-11-03):** F0/F1/F2 aceitas com ressalvas; F2 implementada/testada localmente (188 unit/50 E2E), sem homologação remota; **F3_SPEC_APPROVED + F3_PLAN_APPROVED_FOR_GOAL** (20 tarefas, F3-T01–T42), **GOAL executado**, F3 em **`F3_ACCEPTED_WITH_RESERVATIONS`** por aceite humano em 2026-10-30 (297 unit, 77 E2E PASS + 1 skip), código integrado em `3f6d4be` e documentação de integração em `5c03763`; **F4_ACCEPTED_WITH_RESERVATIONS** em 2026-11-01, código `b51a9d5`, aceite `1e0f918`, 443 unit/102 E2E (101 PASS + 1 skip), integração fast-forward à `origin/v2`, F4-T13 `NOT_RUN`, quatro HIGH F0 `UNVERIFIED`, F7 para Firebase/multi-dispositivo, `INCOMING` parcial preservado; **F5_ACCEPTED_WITH_RESERVATIONS em 2026-11-03, candidato aceito `origin/v2@c358928` (código `9817fb8`), 520 unit/115 E2E reportados, capturas F4 e Git preservados com ressalvas; `main` bloqueada por risco Cloudflare e F7 não homologada**; **nenhum deploy ou publicação da V2 em produção**; F6–F8 propostas. Emulador/Firebase exigem autorização separada; planos não autorizam código, integração ou deploy.

**Princípios de encerramento:** V1 continua intocada em `main`; F1–F7 somente `v2`; nenhum Action novo, PR desnecessário, billing, dados reais ou deploy. Quatro HIGH permanecem `UNVERIFIED`, 107 FAIL E2E V1 são baseline. Uma fase só fecha após teste comprovado, código integrado, higiene Git e aceite humano; F8/G5 exige autorização própria de cutover e backup restaurável.
