## Objetivo e fonte canônica

Acompanhar **uma única iniciativa Estudo Organizado V2** no repositório atual, com branch central `v2`, reconstrução por fatias verticais e **V1 preservada em produção na `main`**.

**Roadmap detalhado e vivo:** [docs/superpowers/v2/ROADMAP.md](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/v2/ROADMAP.md). O roadmap contém subtarefas, dependências, gates, riscos, cenários de teste e critérios de aceite por F0–F8; esta issue é o **painel executivo**, não uma segunda cópia da especificação.

**Estado verificado em 2026-10-28:** `main`/`origin/main` preservadas em `9046cfa`; **F0 e F1 implementadas/aceitas com ressalvas**; aceite F1 vinculado a `85ce1e3`; `v2` recebeu revisão documental F2 posterior. **F2_SPEC_APPROVED / F2_PLAN_APPROVED_FOR_EXECUTION**; D-F2-01..06 e E-F2-01..08 aprovadas pelo proprietário em conversa, writing-plans publicado com 16 tarefas e 40 cenários; **código F2 ainda não executado**. Quatro HIGH `UNVERIFIED` e 107 FAIL E2E V1 permanecem.

## Documentação consolidada (branch `v2`)

- [x] [Especificação arquitetural mestra — D01–D27 + A-01 Impeccable + A-02 Sync](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-19-estudo-organizado-v2-design.md) — **G1 aprovado**
- [x] [Emenda A-02 e pré-contratos para sync F1](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-v2-multidevice-sync-f1-contracts.md) — **A-02 APROVADA; contrato detalhado ainda PROPOSTO**, sem implementação autorizada
- [x] [Especificação formal F1 — fundação técnica](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f1-foundation-design.md) — **APROVADA em 2026-10-28**, não autoriza código
- [x] [ADRs F1-01 a F1-05 — decisões técnicas](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-v2-f1-architecture-decisions.md) — **RATIFICADAS** com a spec F1; sem implementação
- [x] [Writing-plans F1 — 14 tarefas, 75 passos](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/plans/2026-10-28-estudo-organizado-v2-f1-foundation.md) — **G2/F1 APROVADO em 2026-10-28; executado na F1; aceito com ressalvas**
- [x] [GOAL F1 único para o Codex](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/goals/2026-10-28-estudo-organizado-v2-f1-codex.md) — **executado na F1; aceite com ressalvas**
- [x] [Plano de auditoria F0 — seis tarefas com TDD](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/plans/2026-10-19-estudo-organizado-v2-f0-audit.md) — **G2 aprovado**
- [x] [GOAL Codex F0](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/goals/2026-10-19-estudo-organizado-v2-f0-codex.md) — executado no escopo F0; **relatório auditável**: [aceitação F0](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/audits/2026-10-19-f0-acceptance.md). **Gate recalculado `APPROVED` com ressalvas humanas**
- [x] [Roadmap detalhado e índice único V2](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/v2/ROADMAP.md)
- [x] [Roteiro de decomposição original F0–F8](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/plans/2026-10-19-estudo-organizado-v2-roadmap.md) — preservado como histórico, não manter em paralelo

## Checklist das entregas

- [x] **F0 — Auditoria V1 ACEITA COM RESSALVAS:** executada e integrada à `v2`; 35 `PRESERVE` + 10 `REFORMULATE` aprovados; laboratório visual `UNDECIDED` com **adiamento aprovado e fora da F1**. Quatro HIGH ainda `UNVERIFIED`, 107 E2E FAIL mantidos. Aceite: [comentário #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470404279). Nenhuma alteração funcional na V1.
- [x] **F1 — Fundação mínima:** implementação, testes e correções concluídos; **aceite humano com ressalvas em 2026-10-28 no commit `85ce1e3`**. 84 testes unitários e 20 E2E locais; 4 HIGH permanecem `UNVERIFIED`; Firebase/multi-dispositivo não homologados. [Relatório](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/audits/2026-10-28-v2-f1-acceptance.md) e [aceite](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6475527680).
- [ ] **F2 — Editais e conteúdo:** [spec revisada pelo ChatGPT + Superpowers](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f2-content-design.md), D-F2-01..06 + E-F2-01..08 **APROVADAS**; 40 cenários TDD previstos; plano/GOAL publicados, código/emulador ainda não executados.
- [ ] **F3 — Planejamento:** ciclos, calendário, reta final, datas civis/fuso, replanejamento rastreável e regras de recorrência.
- [ ] **F4 — Execução/sessões:** FSM durável do cronômetro, checkpoints, multiaba, questões/histórico e recuperação após suspensão.
- [ ] **F5 — Revisões/inteligência:** revisões espaçadas, pontos fracos, priorização e métricas conciliadas.
- [ ] **F6 — UX/indicadores:** dashboard, jornadas, oito temas, responsividade, acessibilidade e gate Impeccable.
- [ ] **F7 — Homologação integrada:** Google Sign-In/Firebase Auth, Firestore Spark, convergência real multi-dispositivo, outbox/conflitos/tombstones, migração, restore, PWA, UID/Rules, quotas/custo zero e piloto isolado; requer emulador/ambiente separado e provas para os quatro HIGH.
- [ ] **F8 — Cutover:** backup V1 verificado, freeze, migração final, contingência validada e **G5 autorizado expressamente**; não antecipar.

### Gates inegociáveis

- [x] **G0/G1:** decisões e spec-mestra aprovadas em 2026-10-19.
- [x] **G2/F0:** plano F0 aprovado; método Subagent-driven.
- [x] **Gate F0 da auditoria:** aceite humano com ressalvas; `evaluateF0Gate` recalculado `APPROVED` sem razões bloqueantes; laboratório `UNDECIDED` significa **adiamento aprovado, não destino final**. Quatro HIGH continuam abertos e E2E V1 falha.
- [x] **G1/F1:** spec F1 e cinco ADRs aprovadas ([aceite](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470639550)).
- [x] **G2/F1:** [plano aprovado](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/plans/2026-10-28-estudo-organizado-v2-f1-foundation.md) em [aceite](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6470870847), método Subagent-driven adotado para handoff.
- [x] **G3/F1 — execução:** realizada e testada; **F1 aceita com ressalvas**, sem deploy e sem homologação Firebase real.
- [ ] **Gates F1–F7:** spec + writing-plans próprios, TDD, testes locais, revisão independente; QA Impeccable onde houver UI.
- [ ] **G5:** cutover V1→V2 apenas mediante nova autorização humana específica.

## Restrições permanentes

**Main-first para produção V1; `v2` como branch única da iniciativa.** Não fazer PR novo por cada ajuste, não instalar GitHub Actions/CI ou pipelines novos sem solicitação, não apagar histórico/branches sem inventário e aprovação. Não usar dados reais em auditoria sem autorização separada. Não habilitar faturamento: custo recorrente obrigatório **R$ 0**. Não equiparar “implementado”, “testado”, “integrado à `v2`/`main`” e “publicado”.

**A-02 APROVADA:** uso local sem login; após entrar com Google e ativar a sincronização, o sistema passa a sincronizar automaticamente enquanto ativo, com opção de pausa. Firebase Authentication + Firestore Spark no plano grátis; sem snapshot remoto gigante ou segunda fila concorrente; commit local, commit remoto e convergência são estados distintos. [Pré-contratos e testes de aceite F1](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-v2-multidevice-sync-f1-contracts.md).

**Riscos HIGH (4/4, `UNVERIFIED`, não mitigados pela aprovação de A-02):** `R-V1-LEGACY-REMOTE-PLAN` (#107), `R-V1-FIRESTORE-DOCUMENT-1MIB`, `R-V1-MULTITAB-OUTBOX-RACE`, `R-V1-BACKUP-TOMBSTONE-LOSS`. Contratos propostos na F1 e testes com emulador/ambiente isolado antes de homologar.

**Impeccable obrigatório no fluxo de UX**, preservando identidade V1 (`PRODUCT.md`, `DESIGN.md`, oito temas). Exigir evidências de critique/audit/adapt/harden/polish conforme fase; sem instalar hooks sem autorização.

**Risco V1 relacionado:** [issue #107 — Firestore/reta final](https://github.com/matheussilva421/estudo-organizado/issues/107). A F0 deve registrar suas evidências e criar teste de regressão proposto para a V2, sem absorver a correção V1 nesta iniciativa.

## Design proposto até o encerramento — 2026-10-28

As **sete especificações de F2 a F8** foram publicadas na branch `v2` exclusivamente para revisão futura; **F2 recebeu aprovação específica da spec e do writing-plans em 2026-10-28; F3–F8 continuam não aprovadas, sem writing-plans/implementação**:

- [ ] [F2 — Editais e conteúdo](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f2-content-design.md) — **F2_SPEC_APPROVED; F2_PLAN_APPROVED_FOR_EXECUTION; GOAL publicado; código F2 pendente**
- [ ] [F3 — Planejamento, calendário e Reta Final](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f3-planning-design.md) — design para revisão no gate da fase, após evidência da fase anterior
- [ ] [F4 — Cronômetro, sessões e hábitos](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f4-execution-design.md) — design para revisão no gate da fase, após evidência da fase anterior
- [ ] [F5 — Revisões e inteligência](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f5-reviews-design.md) — design para revisão no gate da fase, após evidência da fase anterior
- [ ] [F6 — UX final e Impeccable](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f6-experience-design.md) — design para revisão no gate da fase, após evidência da fase anterior
- [ ] [F7 — Sincronização real, backup, migração e homologação](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f7-integration-design.md) — design para revisão no gate da fase, após evidência da fase anterior
- [ ] [F8 — Cutover, contingência e encerramento](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f8-cutover-design.md) — design para revisão no gate da fase, após evidência da fase anterior

**Rastreabilidade reconciliada:** [roadmap com matriz F0→F8](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/v2/ROADMAP.md), 46/46 funcionalidades distribuídas em fase principal única: 4 F1, 6 F2, 11 F3, 4 F4, 3 F5, 10 F6, 7 F7 e laboratório visual UNDECIDED/adiado. 35 PRESERVE e 10 REFORMULATE são diretrizes de produto, **não entrega de código**.

**Ponto de atenção A-02:** o ensaio `F2_EMULATOR_REHEARSAL` é **proposto** e exige autorização separada para instalar/executar. Pode constar do desenho futuro sem bloqueio da redação do writing-plans. Quatro HIGH continuam `UNVERIFIED` e 107 FAIL E2E V1 são baseline. F1 já foi aceita; **G5/F8** permanece bloqueado até F7 homologada e autorização expressa de cutover.

## Responsabilidades Superpowers — revisão 2026-10-28

**ChatGPT planeja** (brainstorming → spec → writing-plans → GOAL, após cada gate humano); **Codex executa** tarefas do GOAL aprovado, testa, faz revisão independente e reporta; **ChatGPT revisa** código/testes/evidências e prescreve correções; **Codex corrige**; **proprietário aprova** cada fase. O Codex não deve redigir specs nem writing-plans por delegação. Atualizações de planejamento não autorizam implementação.

## Próximo passo

**Próxima ação:** executar o [GOAL F2 aprovado](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/goals/2026-10-28-estudo-organizado-v2-f2-codex.md) com o [writing-plans F2 aprovado](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/plans/2026-10-28-estudo-organizado-v2-f2-editais-conteudo.md) na `v2`. O ChatGPT elaborou ambos com Superpowers; Codex executa, testa, revisa e entrega evidências para auditoria do ChatGPT. A spec F2 D-F2-01..06/E-F2-01..08 e o plano foram aprovados pelo proprietário em conversa. **Atualizado em 2026-10-29:** F2 implementada, testada e publicada na branch v2 (53e15fb), com relatório de aceite e logs completos; gate F2_READY_FOR_HUMAN_REVIEW, dependente de aceite humano; Firebase Emulator exige autorização separada. `main` V1 intacta e quatro HIGH `UNVERIFIED`.

Não criar issues individuais ou PRs adicionais por padrão. Abrir subtarefas somente quando um bloqueio autônomo e verificável justificar rastreamento separado.


## F2 — aprovação e publicação documental (2026-10-28)

O proprietário **aprovou em conversa** a spec F2 (D-F2-01..06 e E-F2-01..08), aprovou o writing-plans Superpowers e solicitou sua publicação no GitHub. **Não se afirma que o proprietário publicou diretamente este registro.**

- [x] [Spec F2 aprovada](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/specs/2026-10-28-estudo-organizado-v2-f2-content-design.md)
- [x] [Writing-plans F2 aprovado, 16 tarefas e matriz T01..T40](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/plans/2026-10-28-estudo-organizado-v2-f2-editais-conteudo.md)
- [x] [GOAL único F2 publicado para Codex](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/goals/2026-10-28-estudo-organizado-v2-f2-codex.md)
- [ ] Execução, testes, revisão independente e integração de código F2 a `v2`
- [ ] Gate humano de aceite F2 após auditoria do ChatGPT

**Limites:** somente `v2`; sem `main`, Firebase Emulator, Firebase real, deploy, Actions, purge, custos, dados de usuário ou F3. Quatro riscos HIGH continuam `UNVERIFIED`.


