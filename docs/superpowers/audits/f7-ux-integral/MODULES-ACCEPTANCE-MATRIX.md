# Matriz de módulos, F0–F7 e critérios

**Código:** `bdebbcd0`. Legenda: PASS_LOCAL, PARTIAL_JUSTIFIED, BLOCKED_EXTERNAL, BLOCKED_NEW_APPROVAL, NOT_RUN_ENVIRONMENT, HUMAN_PENDING.

## Oito abas + Shell

| Área | Funcionalidades verificadas | Estado | Prova |
|---|---|---|---|
| Home | contextos ONBOARDING/DAILY/FINAL_STRETCH/PERFORMANCE/ACTIVE; sugestão com consentimento; layout manual, undo e persistência; widgets e filtros | PASS_LOCAL | `f7-ux-premium-home`, `f7-ux-premium-layout`, `f7-ux-home` |
| Conteúdo | editais, disciplinas, assuntos, aulas, árvore paginada, inspetor, importação, arquivamento | PASS_LOCAL | `f2-*`, `f2-inspector`, `f7-ux-knowledge-library` |
| Planejamento | cenários, prévia/cancelamento, capacidade compartilhada, calendário, Reta Final, portabilidade | PASS_LOCAL, com ressalva F3 | `f3-*`, `f7-ux-planning-workspace`, P-09 |
| Sessões | timer, Pomodoro, manual, pausa/retomada, histórico, hábitos, duas abas, Foco mobile | PASS_LOCAL | `f4-*`, `f7-ux-premium-focus`, `f7-ux-sessions-history` |
| Revisões | fila, política versionada, execução, pontos fracos, evidências, prioridade | PASS_LOCAL | `f5-*`, `f7-ux-review-sheet`, R-09, UX-21 |
| Análises | KPIs, gráfico/tabela, filtros, drill-down, snapshot, exportação | PASS_LOCAL | `f7-ux-attention-analytics`, `f7-ux-analytics` |
| Atenção | identidade causal, alertas, deduplicação, offline/stale | PASS_LOCAL | `f6-notifications`, `f6-conflicts-integrity` |
| Configurações | 12 temas, preferências, backup preview, storage, manutenção | PASS_LOCAL em fake | `f7-ux-settings-safety`, `f7-ux-backup-restore` |
| Shell/Busca | rail/mobile, rotas, Command Center, foco e retorno | PASS_LOCAL | `f7-ux-shell-navigation`, `f7-ux-command-center`, `f6-search` |

## F0 — 46 capacidades

| Grupo | IDs | Estado |
|---|---|---|
| F1 | persistência, save, boot, PWA | PASS_LOCAL |
| F2 | editais, principal, arquivados, verticalização, importação, aulas | PASS_LOCAL |
| F3 | organizador, calendário, ciclo, wizard, Reta Final, importação, editor, histórico, conflitos, portabilidade, redistribuição | PASS_LOCAL |
| F4 | timer/Pomodoro, registro, histórico, hábitos | PASS_LOCAL |
| F5 | revisões, pontos fracos, banca | PASS_LOCAL |
| F6 | shell, fachadas, Home, Análises, busca, notificações, preferências, temas, acessibilidade, skeleton | PASS_LOCAL, a11y manual NOT_RUN |
| F7 | sync, centro, diagnóstico, backup, dados | PASS_LOCAL em fakes; externo BLOCKED_EXTERNAL |
| Adiado | F-V1-VISUAL-LAYOUT-LAB | BLOCKED_NEW_APPROVAL |

Total: 46 (45 ativos + 1 bloqueado).

## F1–F7

| Fase | Estado local | Ressalva |
|---|---|---|
| F1 | PASS_LOCAL | quatro HIGH F0 UNVERIFIED |
| F2 | PASS_LOCAL | F2-T22 tratado por testes de importação/associação; histórico preservado |
| F3 | PARTIAL_JUSTIFIED | hardware modesto NOT_RUN; alerta automático de prova vencida não implementado (data visível, sem alerta) |
| F4 | PASS_LOCAL | F4-T13 NOT_RUN_ENVIRONMENT; INCOMING parcial documentado |
| F5 | PASS_LOCAL | política/importação/conflito cobertos |
| F6 | PASS_LOCAL | a11y manual NOT_RUN |
| F7 | BLOCKED_EXTERNAL | G-EXT/G-STAGING; fakes e previews locais cobertos |

## Critérios F7-UX e Premium

- **D01–D71 / UX-01–UX-31 / AC-01–AC-24:** matriz completa em `docs/superpowers/audits/f7-ux/UX-ACCEPTANCE-MATRIX.md`; P-09, R-09 e UX-21 PASS no escopo local.
- **DV-01–DV-18:** matriz em `docs/superpowers/audits/f7-ux-uxh-remediation/ACCEPTANCE-MATRIX.md`; DV-06/DV-08/DV-17/DV-18 PARTIAL.
- **VA-01–VA-20:** VA-06 PARTIAL (benchmark), VA-20 PASS_AUTOMATED/MANUAL_NOT_RUN.
- **RP-00–RP-15:** executados nas rodadas Premium anteriores; sem novo mock 1:1.
- **Visual Layout Lab:** não implementado.
