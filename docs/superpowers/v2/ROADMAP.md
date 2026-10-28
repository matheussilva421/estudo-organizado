# Estudo Organizado V2 — Roadmap mestre, índice documental e gates

**Atualizado em:** 2026-10-28
**Branch canônica de desenvolvimento da V2:** `v2` — derivada da `main` em `83010dce2c5fd64700759a642bb9e414221ea84d`.
**Situação:** **F0 ACEITA COM RESSALVAS (APPROVED_WITH_RESERVATIONS)** em 2026-10-28; gate automático recalculado `APPROVED`. **F1 spec/ADRs propostas para revisão; writing-plans/implementação F1 não autorizados.**
**Tipo:** roteiro por fases, dependências, critérios de aceite e acompanhamento. **NÃO É AUTORIZAÇÃO DE IMPLEMENTAÇÃO.**
**Issue mãe:** [#108 — Reconstrução V2 F0–F8](https://github.com/matheussilva421/estudo-organizado/issues/108), único acompanhamento central, sem criar uma issue por ajuste.
**Produto V1:** permanece na `main` para manutenção/publicação; **a branch `v2` não é ambiente de produção**.

## 0. Centro de referência (fonte única por responsabilidade)

Este roadmap é o **índice e acompanhamento canônico** da V2. Os documentos existentes permanecem em seus caminhos históricos para preservar links, aprovações e rastreabilidade; **não duplicar** conteúdo nem movimentá-los apenas por estética.

| Artefato | Fonte canônica nesta branch | Aprovação e papel |
| --- | --- | --- |
| Especificação arquitetural mestra | [Spec V2](../specs/2026-10-19-estudo-organizado-v2-design.md) | **G1 APROVADO** — D01–D27 + A-01 + A-02 |
| [Pré-contratos F1 — sync multi-dispositivo A-02](../specs/2026-10-28-v2-multidevice-sync-f1-contracts.md) | **PROPOSTA PARA F1** — sem código ou execução autorizada |
| [ADRs propostas F1-01..05](../specs/2026-10-28-v2-f1-architecture-decisions.md) | **EM REVISÃO** — escolhas técnicas não ratificadas |
| [Especificação formal proposta F1](../specs/2026-10-28-estudo-organizado-v2-f1-foundation-design.md) | **EM REVISÃO** — ainda não aprovada; não autoriza writing-plans |
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

| Fase | Situação verificada em 2026-10-28 | Objetivo | Dependência principal |
| --- | --- | --- | --- |
| **G0/G1** | APROVADOS | Arquitetura e spec-mestra + emendas | D01–D27 + A-01 + A-02 |
| **G2/F0** | APROVADO (plano e método) | Escrita do plano F0 | G1 |
| **F0 — Auditoria V1** | **ACEITA COM RESSALVAS — recálculo `APPROVED`** | Entregue, integrada à `v2`; 45 destinos funcionais definidos + 1 adiamento aprovado | [Aceite humano #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279) e [relatório F0](../audits/2026-10-19-f0-acceptance.md) |
| **F1 — Fundação técnica** | **SPEC + ADRs PROPOSTAS PARA REVISÃO**; sem código | Fundação isolada e primeira fatia vertical; contratos A-02 | Ratificar [spec F1](../specs/2026-10-28-estudo-organizado-v2-f1-foundation-design.md) e [ADRs](../specs/2026-10-28-v2-f1-architecture-decisions.md); depois writing-plans e gate de execução próprios |
| **F2 — Editais e conteúdo** | NÃO INICIADA | Base canônica de organização | F1 homologada |
| **F3 — Planejamento** | NÃO INICIADA | Planejamento executável | F2 e regras temporais |
| **F4 — Execução/sessões** | NÃO INICIADA | Tempo/histórico confiáveis | Persistência e domínio |
| **F5 — Revisões/inteligência** | NÃO INICIADA | Revisar e priorizar | F2–F4 |
| **F6 — Indicadores/UX** | NÃO INICIADA | Métricas e experiência integradas | Dados canônicos por domínio |
| **F7 — Homologação integrada** | NÃO INICIADA | Migração, sync, segurança, restore, piloto | F1–F6 |
| **F8 — Cutover** | **BLOQUEADO** | Adoção da V2 como app principal | G5 humano e contingência |

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

**Gate da auditoria F0:** `APPROVED` após o [aceite humano com ressalvas](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279); isso **não** homologa os E2E, migração, sync remoto ou UX. O laboratório de layout mantém destino `UNDECIDED` com adiamento aprovado; 4 HIGH continuam `UNVERIFIED`. Para escrever writing-plans F1 falta aprovação da spec F1 e ADRs.

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

## 5. F2 — Domínio de editais e conteúdo

**Objetivo:** estabelecer fonte canônica de editais, disciplinas, assuntos, tópicos, aulas e relações, preservando os dados históricos existentes.

**Entregas planejadas, revisáveis após F0:** entidades/IDs estáveis e índices; um principal ou outros invariantes apenas depois de confirmado destino funcional; CRUD e arquivamento seguro; importação JSON com preview, matching conservador, proveniência e idempotência; transformação de amostras sintéticas V1→V2; validações de referências órfãs; comandos/consultas tipados e UX responsiva.

**Testes críticos:** importação repetida; edições concorrentes; disciplina/tópico homônimo; edital arquivado; exclusão e relações em cascata; JSON inválido; conteúdo hostil/XSS; alteração de edição não altera progresso relacionado.

**Gate F2:** inventário de funcionalidades de conteúdo atendido, integridade referencial, nenhuma importação destrutiva silenciosa e UX aprovada com Impeccable.

## 6. F3 — Planejamento, calendário, ciclo e reta final

**Objetivo:** gerar e editar planos consistentes, compreensíveis e auditáveis para concursos com diferentes calendários.

**Entregas:** regras canônicas de calendário/data civil, hora local/fuso/recorrências; programação de ciclos, metas, janelas e restrições; agenda/calendário; blocos de reta final e importação compatível com destino aprovado; replanejamento explícito de atividades vencidas sem reescrever histórico; associação com assuntos e futuros registros de sessão; projeções locais.

**Testes críticos:** fuso alterado, horário de verão, data inválida, prova/prazo sem horário, blocos atrasados, retomada e replanejamento, geração idempotente, sobreposições e relações órfãs.

**Gate F3:** geração determinística e rastreável, calendário consistente no desktop/mobile e replanejamento que não apaga previsões passadas.

## 7. F4 — Execução, timer, sessões e histórico

**Objetivo:** tornar o tempo e o desempenho registrados uma fonte confiável, mesmo com suspensão do navegador.

**Entregas:** máquina de estados durável iniciar/pausar/retomar/concluir/recuperar; medição monotônica durante execução e checkpoints persistentes; controle de autoridade entre abas; registro de questões, acertos, atividades, tópicos e hábitos associados; edição auditável; projeções e histórico; UX de continuidade offline.

**Testes críticos:** dois cliques de concluir; refresh/falha de energia; suspensão de notebook; clock incorreto; duplicação por dois tabs; sessões offline concorrentes em dois dispositivos; soma dos intervalos válidos versus dashboard.

**Gate F4:** nenhuma duplicidade, tempo ambíguo tratado explicitamente, commit local confirmado e histórico reconciliável.

## 8. F5 — Revisões, pontos fracos e inteligência de banca

**Objetivo:** priorizar estudos com base em evidência histórica e regras auditáveis.

**Entregas:** revisão espaçada com dados canônicos, geração/reagendamento explícito, ranking de pontos fracos, análise de questões e banca, consultas e filtros, projeções interpretáveis; auditoria de lacunas V1 e preservação de decisões funcionais de F0.

**Testes críticos:** editar/apagar sessão e recalcular revisões; assunto arquivado, datas civis, reincidência e séries de desempenho, vazios, índices de priorização explicáveis, sync sem dupla contagem.

**Gate F5:** regras determinísticas, estatísticas reconciliadas com fatos de execução e usuários compreendem a justificativa da priorização.

## 9. F6 — Dashboards, navegação e refinamento Impeccable

**Objetivo:** consolidar a experiência redesehada sem criar uma UI genérica ou replicar estado do banco.

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

- **Baseline confirmado:** `main` permanece em `9046cfa2283cd293b38df9d52fabfcd5de9ac67c` (2026-10-28), intocada pela F0. `v2` foi atualizada com `main` no merge `689a9f4` e recebeu os commits de auditoria.
- **Branches antigas:** `docs/superpowers-estudo-organizado-v2-design` e `docs/superpowers-estudo-organizado-v2-f0-plan` são branches históricas de PRs #104/#105 já mesclados por squash. **Não excluir** sem inventário dos commits exclusivos e nova autorização; não utilizá-las para desenvolvimento novo.
- **PRs abertos no preflight:** nenhum. Não criar PR novo apenas para acrescentar roadmap/issue à branch `v2`.
- **Arquivos de auditoria F0 encontrados?** Sim: inventário, cobertura de fontes, matriz de schemas, matriz de riscos, baseline de QA, relatório Impeccable e relatório de aceitação em `docs/superpowers/audits/`.
- **Decisão A-02:** aprovada pelo usuário em 2026-10-28; spec-mestra atualizada e [pré-contratos de sync F1](../specs/2026-10-28-v2-multidevice-sync-f1-contracts.md) preparados **sem execução**. Não equivale a aprovação de arquitetura física de sync, solução dos riscos ou gate F0.
- **Aceite F0:** [aprovado com ressalvas em #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279); gate recalc `APPROVED`, não representa homologação V1. O laboratório visual mantém destino `UNDECIDED`/fora F1; 4 HIGH `UNVERIFIED` e 107 E2E FAIL continuam.
- **Fase operacional seguinte:** revisão e aprovação da [spec F1](../specs/2026-10-28-estudo-organizado-v2-f1-foundation-design.md) e das [ADRs propostas](../specs/2026-10-28-v2-f1-architecture-decisions.md). **Não preparar writing-plans nem executar F1 antes da autorização específica.**
- **Testes executados:** 66 testes dos validadores F0 PASS; 189 arquivos/3048 testes unitários PASS; lint 0 erros. `test:e2e:mock` e `test:e2e:mock:all` têm FAIL registrados; runtime Firestore/Drive/Cloudflare, migração real e emulador de rules permanecem NOT_RUN/INCONCLUSIVE.

## 15. Definição de conclusão de fase

Uma fase só estará **CONCLUÍDA** após verificar: escopo aceito, evidências de teste, revisão independente, gate humano correspondente, integração no destino correto (`v2` para desenvolvimento e `main` apenas no gate apropriado), ausência de mudanças órfãs, identificação de branches/PRs/worktrees obsoletos e pendências explícitas. Uma fase que passou testes, mas não foi integrada ou homologada, **não** é encerrada. A V1 seguirá em produção enquanto o cutover G5 não for expressamente autorizado.

---

**Proposta de atualização:** cada gate aprovado altera somente a linha da fase relevante, os bloqueios e o próximo passo deste arquivo e a checklist da issue. Specs e planos técnicos detalhados ficam nos caminhos existentes de `docs/superpowers/specs/` e `docs/superpowers/plans/`; não copiar o texto integral para este roadmap ou para a issue.
