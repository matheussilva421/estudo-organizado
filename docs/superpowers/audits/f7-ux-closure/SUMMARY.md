# Fechamento das pendências pós-remediação — F7-UX

**Código:** `819c3c6635bde603687443fd4edcfe0c809188e3` (branch `v2`).
**Baseline anterior:** `454f27e5` (código) / `f175eb75` (documentação), status `UX_H_RE_REVIEW_PENDING`.
**Status deste pacote:** `LOCAL_F7UX_CLOSURE_PARTIAL` / `UX_HUMAN_PENDING` / `REMOTE_PUSH_NOT_AUTHORIZED`.

## Escopo

Este ciclo fecha lacunas já cobertas pelas specs aprovadas, sem novo brainstorming e sem reconstruir F0–F7. Foram trabalhadas Knowledge, Reviews, Insights, Home, camadas/mobile, jornadas P-09/R-09 e acessibilidade.

## O que mudou

| Frente | Mudança | Evidência |
|---|---|---|
| Knowledge | inspetor contextual de assunto/aula com identidade, disciplina, pai, estrutura, estado e ação de destaque; seleção marcada | `states/content-inspector-desktop.png`, `states/content-inspector-320.png` |
| Knowledge | fixture sintética de 120 assuntos + 12 subassuntos; paginação de 50/50; navegação medida | `f2-inspector.spec.ts` |
| Reviews | detalhe de leitura da execução F5 com tópico, avaliação, cobertura, duração, compromisso e identidade, usando `listExecutions` existente | `states/review-execution-detail.png` |
| Insights | estado vazio "Série por dia" compacto e explícito; tabela de distribuição mantém altura própria | `f7-uxh-remediation.spec.ts` |
| Home | contexto `PERFORMANCE` com fixture de cenário ativo + sessão concluída; diagnóstico de outbox deixa de sequestrar o herói | `f7-ux-premium-home.spec.ts` |
| Home | consentimento de ordem sugerida verificado em PERFORMANCE: nenhuma reordenação até "Aplicar" | `f7-ux-premium-home.spec.ts` |
| P-09/R-09 | jornada integrada ampliada: capacidade compartilhada e preservação de fatos entre plano, sessão, revisão, Home e Análises | `f7-ux-integrated-journey.spec.ts` |
| Cobertura P2 | árvore grande até 120 nós; vínculo do compromisso focado; captura do herói PERFORMANCE; sugestão fora do fluxo do herói | `f2-inspector.spec.ts`, `f5-review-journey.spec.ts`, `states/home-performance.png` |

## Reaproveitamento

Nenhum contrato de domínio, IndexedDB, sync, backup, recovery, clock ou senha foi alterado. O detalhe F5 usa `LocalReviewRepository.listExecutions`; o inspetor usa os snapshots de conteúdo já carregados. Nenhuma dependência nova.
