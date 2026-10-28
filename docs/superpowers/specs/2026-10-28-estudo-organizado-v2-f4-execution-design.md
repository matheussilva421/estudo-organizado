# Estudo Organizado V2 — F4: Execução, cronômetro, sessões e hábitos

**Status:** ESPECIFICAÇÃO PROPOSTA, **NÃO APROVADA**. Documento de desenho, não writing-plans e não autorização de implementação.  
**Pré-requisitos:** F1–F3 com entregas homologadas e integrações autorizadas na `v2`; sistema de referências de edital/assunto e planejamento estáveis; fronteira D23 (máquina de estados durável) obrigatória.  
**Referências:** spec-mestra D04/D05/D08/D18/D23/D27, A-01, A-02, matriz F0 e [roadmap](../v2/ROADMAP.md).

## 1. Escopo funcional e destinos da F0 (4)

| ID | Requisito |
| --- | --- |
| `F-V1-TIMER-POMODORO` | Cronômetro livre, por evento e Pomodoro, com retomada segura |
| `F-V1-SESSION-REGISTRATION` | Registro completo multi-tópico: tipos de estudo, materiais, questões, acertos, páginas, notas |
| `F-V1-SESSION-HISTORY` | Histórico auditável, filtros e exportação de sessões |
| `F-V1-HABITS` | Hábitos de estudo, estados de realização e associação com sessões/rotinas |

O resultado do usuário: iniciar estudo offline, pausar, trocar de tela, perder internet, fechar/reabrir o navegador e continuar sem criar sessão fictícia ou perder fatos confirmados. A UI pode registrar atividade manual sem timer e também sessões com timer.

## 2. Entidades e contratos temporais

**Entidades:** `StudySession` (id, profileId, editalId?, planActivityId?, subjectLinks[], origin, state, revision, operationId), `SessionInterval` (startObservation, endObservation?, elapsedMonotonicMs, recoveryFlag), `StudyMeasurement` (subjectId, questions, correctAnswers, pages, notes, materials), `StudyHabit` e `HabitOccurrence`. Não derivar duração de diferença bruta entre timestamps em paredes de relógio divergentes. Eventos de progresso são fatos, não projeções de dashboard.

**Estados propostos:** `DRAFT → RUNNING ⇄ PAUSED → COMPLETED`, `CANCELLED` e `RECOVERY_REQUIRED`. Transições inválidas, repetição da mesma operação e concorrência de abas não criam resultados duplos. O relógio monotônico mede intervalos apenas durante execução ativa; checkpoints duráveis preservam o último intervalo confirmado e a revisão. Após suspensão/crash, intervalo não observado vira lacuna a revisar, **não** horas de estudo automaticamente acumuladas.

**Pomodoro:** ciclos de foco/pausa por intervalos verificáveis; alarme/notification best effort, sem alegar execução contínua com PWA fechada. Mesmo em modo Pomodoro, duração registrada deriva de tempo válido, não de callbacks periódicos.

**Sessão manual:** permite registrar tempo/questões quando não houve timer, com distinção explícita de fonte `MANUAL`, validação de datas/duração e edições com trilha; evita inventar monotonicidade histórica inexistente.

## 3. Comandos, atomicidade e multiaba

**Porta proposta `StudySessionService`** expõe `startSession`, `pauseSession`, `resumeSession`, `completeSession`, `cancelSession`, `recoverSession`, `registerManualSession`, `editSessionFacts`, `listSessionHistory` e `exportHistory`. Todos os comandos persistentes aceitam identidade de operação e revisão-base; a última transição reconhecida prevalece apenas quando demonstrada por controle de revisão, nunca por timestamp.

- Idempotência por `operationId`, inclusive dois cliques e retry após crash.
- Regra de autoridade por sessão entre abas: lock/lease válido + rechecagem de revisão persistente; outra aba lê status e pode pedir controle sem executar mudança concorrente silenciosa.
- Entre aparelhos offline, sessões independentes podem coexistir; ao reconectar, reconhecer sobreposições e conflitos quando mesma sessão/plano foram alterados. Não apagar sessão válida automaticamente por overlap.
- Transação IndexedDB grava sessão/intervalo/medidas/operação/outbox relevantes de forma atômica; falha de quota retorna erro e mantém status visível, sem confirmação falsa.
- Corrigir fato histórico **não** edita automaticamente cronograma consumido; gera nova revisão com proveniência. Registros excluídos seguem contratos de tombstone e backup A-02.

## 4. Jornadas de interface

1. Abrir bloco previsto F3, iniciar timer, pausar, retomar e concluir; associação entre sessão e bloco se dá por ID, não por título.
2. Começar Pomodoro, navegar para outra tela, bloquear dispositivo ou suspender app; ao recuperar, mostrar duração comprovada e eventual lacuna.
3. Registro manual multi-tópico com validação de soma por disciplina, questões ≤ campos coerentes, materiais e notas sanitizadas; uma sessão pode distribuir duração entre assuntos, preservando a soma geral.
4. Ver histórico por edital/assunto/data e exportar sem credenciais; editar nota ou questões com registro auditável; hábito concluído por fato próprio sem duplicar sessões.
5. Indicadores locais claros: `salvo neste aparelho`, `pendente de sync`, `conflito remoto` quando aplicáveis; não afirmar que outro dispositivo está atualizado.

## 5. TDD e verificações adversariais

| Cenário | Comprovação exigida |
| --- | --- |
| Duplo start/pause/complete mesmo ID | Estado único e intervalos não duplicados |
| Browser tab fechado na metade do intervalo | Recuperação com checkpoint e lacuna explícita |
| Relógio do sistema adiantado/atrasado | Duração validada pela monotonicidade/checkpoints; sem horas fictícias |
| Duas abas tentando controlar sessão | Uma autoridade válida; outra observa ou recebe conflito |
| Dois aparelhos offline completando a mesma sessão | Versões preservadas, reconciliação conservadora, nenhuma perda |
| Duração negativa, NaN, absurda, questões incoerentes | Rejeição segura com mensagem, sem commit inválido |
| Vários assuntos numa sessão | Soma/proporção definida, IDs estáveis, sem dupla contabilização |
| Corrigir sessão histórica depois de revisão F5 | Projeções invalidadas/recalculadas sem apagar fatos do passado |
| Importação/exportação e tombstone de sessão | Repetição idempotente, histórico preservado e backups suficientes |
| Quota/erro de escrita após completar | Nenhum "concluído" falso; intenção do usuário recuperável |
| Timer, tema e dispositivos | Impeccable e E2E: acessibilidade, toque, foco, tela bloqueada/reabertura |

**Cálculo do tempo:** testes usam relógio simulado e browser real com `performance.now()` onde adequado, sem depender do avanço de `setInterval` ou de tempo ocioso. O comportamento em suspensão do OS/browser será marcado `INCONCLUSIVE` se não puder ser reproduzido na execução; não inventar PASS.

## 6. Entregas e critérios de aprovação

- A máquina de estados D23 está implementada/testada, com checkpoints persistentes e mecanismo de autoridade interabas; histórico de sessões e métricas não duplicados.
- Registro multi-tópico, material, questões/acertos e hábitos associados produz fatos coerentes para F5/F6.
- Persistência e outbox funcionam com local-only e opt-in A-02; conflitos e regras de sync não escondem dados.
- Fluxos de timer/manual/Pomodoro e histórico funcionam offline e em desktop/tablet/mobile; QA Impeccable com oito temas e acessibilidade na amostra.
- Bateria de testes Vitest/integração/Playwright, cenários negativos, revisão independente e evidências reais com status; nenhum acesso a dados reais da V1.
- Código validado integrado à `v2` quando autorizado, não à `main`; relatório de aceite e decisão humana para avançar.

## 7. Questões de decisão para o gate F4

Definir duração máxima plausível/configurável, sem presumir limite mágico; quando manual deve ser permitido sem timer; estratégia de tomada de autoridade entre abas; se Pomodoro registra apenas períodos de foco ou também pausas (recomendo só foco como estudo); tratamento de sessão sem vínculo a edital; exibição de intervalos recuperados. Estas decisões constarão da spec revisada antes do writing-plans.

**Fora do escopo:** revisões espaçadas e ranking (F5), dashboard final (F6), OAuth/Firestore real/homologação multi-dispositivo (F7), cutover (F8).  
**Gate:** `F4_SPEC_PROPOSED` → aprovação → writing-plans F4 → aprovação do plano/GOAL → execução/TDD/QA/integração `v2` → aceite humano F4. A publicação do desenho não concede essas aprovações.
