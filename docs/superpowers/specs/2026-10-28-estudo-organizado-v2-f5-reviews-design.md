# Estudo Organizado V2 — F5: Revisões, pontos fracos e inteligência de banca

**Estado:** PROPOSTA DE ESPECIFICAÇÃO — **NÃO APROVADA**, sem writing-plans ou implementação autorizada.  
**Pré-condição:** F1–F4 verificadas e homologadas, com domínio de editais e sessões/questões confiável.  
**Base:** D05/D08/D16/D22/D27, A-01 Impeccable, A-02 sync conservador; [inventário F0](../audits/2026-10-19-v1-feature-inventory.json).

## 1. Objetivo e funcionalidades da F0 (3)

O usuário deve saber **o que revisar, quando revisar e por quê**, usando fatos reais de estudos e questões, sem algoritmos opacos nem dependência de API paga.

- `F-V1-REVISIONS` — preservar revisões espaçadas com agendamento, execução, reagendamento e histórico.
- `F-V1-WEAK-POINTS` — preservar classificação de tópicos com dificuldade/erros, transparência do cálculo e filtros.
- `F-V1-BANCA-ANALYZER` — preservar importação de textos/listas de assuntos relevantes, matching com edital e possibilidade de revisar/rankear/reordenar, com reversão.

A F5 não pode depender de um índice remoto ou de IA generativa para funcionar. Recomendo heurísticas locais, explícitas e versionadas; recursos avançados de aprendizagem automática só com spec separada e autorização, não são requisito da V2 inicial.

## 2. Modelos canônicos e explicabilidade

**Projeções/entidades:** `ReviewSchedule` (id, subjectId, baseSessionId?, ruleVersion, civilDate, status, provenance), `ReviewEvent` (id, scheduleId, performedAt, performance, linkedSessionId?), `WeakPointScore` (subjectId, window, evidenceCount, score, rationale, calculationVersion), `ExamBoardRelevance` (editalId, board?, topicId, score, source, confirmedByUser), `TopicMatchCandidate` (sourceText, subjectId?, confidence, decision).

O `StudySession` e `StudyMeasurement` de F4 são **fonte dos fatos**. Agendas de revisão e rankings são derivados/recalculáveis, exceto decisões humanas de priorização, execução e notas que permanecem fatos próprios. Alteração de sessão deve invalidar projeções relacionadas; não fabricar revisão concluída porque uma previsão mudou.

**Política temporal D27:** a revisão possui `CivilDate` do calendário acadêmico, sem converter horas dos dispositivos em mudança arbitrária de dia. Idempotência pelo ID da conclusão e pela regra versionada de geração. Reagendar gera operação explícita, preservando o histórico; revisão vencida não desaparece nem é contada como feita.

**Score fraco:** exigir janela de dados, questões tentadas/acertadas, amostra, peso e motivo exibível; ausência de questões resulta em `INSUFFICIENT_DATA`, não nota zero ou ranking difamatório. Estatística não soma sessão inteira quando tem vários tópicos com alocações diferentes. Política de priorização e pesos serão propostos e aprovados antes do writing-plans.

## 3. Jornadas e comandos

1. Revisões sugeridas por regra local versionada a partir de tópicos/sessões; calendário mostra vencidas, futuras, concluídas, adiadas e com vínculo rompido.
2. Concluir/adiar uma revisão confirma operação no IndexedDB/outbox; reabrir/editar sessão original recalcula agenda sem apagar decisões históricas.
3. Ver painel de pontos fracos com explicação `acertos/tentativas/janela`, filtro por edital e assunto, indicadores sem dados suficientes, clique para abrir o tópico.
4. Importar texto de hot topics da banca → parser com limites → sugestões de correspondência fuzzy → revisão de todas as ambiguidades → aprovação → ranking e ordenação explicável → opção de reverter configuração sem desfazer estudo anterior.
5. Usar toda a F5 offline, respeitando status de sync A-02 e pendências entre dispositivos, sem exibir revisão duplicada ou mesclar pontuações por horário.

**Comandos sugeridos:** `GenerateReviewSuggestions`, `ConfirmReviewCompletion`, `RescheduleReview`, `InvalidateReviewProjection`, `CalculateWeakPointScores`, `PreviewBancaMatches`, `ApplyBancaRanking`, `RevertBancaRanking`; aceitam contexto de perfil/edital, IDs estáveis, revisão-base, proveniência, idempotência e estados de erro. **Consultas:** agenda de revisões, séries por assunto, explicação de score e ranking por banca.

## 4. Testes e critérios de qualidade

| Caso | Comportamento esperado |
| --- | --- |
| Concluir mesma revisão duas vezes / retry offline | Um `ReviewEvent` lógico, nada duplicado |
| Sessão corrigida ou excluída | Projeção atualizada/invalidada; histórico humano preservado |
| Um estudo multi-tópico com questões alocadas | Sem dupla contagem; métricas conciliadas com F4 |
| Poucas/zero questões | `INSUFFICIENT_DATA`, nunca score arbitrário |
| Fuso muda ou revisão cruza meia-noite | `CivilDate` coerente, nenhuma revisão movida silenciosamente |
| Matching fuzzy com nomes homônimos | Sugestões com evidência e revisão, sem atribuição automática insegura |
| Texto hostil, JSON grande ou edição concorrente | Entrada validada, sem HTML executável, conflito registrado |
| Ranking revertido após sessões novas | Ordem explicitamente restaurada sem apagar fatos posteriores |
| Dois dispositivos criando revisão offline | Idempotência/chaves causais, conflito preservado |
| UI A-01 | Acessibilidade e oito temas, desktop/tablet/mobile, transparência do cálculo |

**Aceite F5:** 3 funcionalidades preservadas, histórico de revisão/score/ranking determinísticos com testes negativos, recalculo auditável após edição do histórico, quotas e sync offline respeitados, QA Impeccable com screenshots/revisão independente. Novas regras de scoring devem ser comparadas em fixtures e aprovadas como política de domínio; não assumir que replicam numericamente V1 quando as regras divergirem.

## 5. Riscos, não objetivos e gates

**Riscos:** score sem evidência, baixa amostragem, alteração retroativa de fontes, ressurreição de revisão excluída, duplicação interdispositivo e fuzzymatching arbitrário. Mitigar com versão de algoritmo, índice de proveniência, tombstones e dedup A-02.

**Fora F5:** dashboards agregados completos (F6), IA paga, geração automática de questões, backend de ranking, migração de dados reais e sync Firestore real não autorizado. Para uma mudança algorítmica significativa, aprovação humana antes de incorporar no plano.

**Gate:** `F5_SPEC_PROPOSED` → aprovação específica → writing-plans F5 → aprovação e GOAL → TDD/QA integração à `v2` → aceite humano F5. Nenhuma etapa é implicitamente autorizada pela publicação desta spec.
