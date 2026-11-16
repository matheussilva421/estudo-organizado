# Matriz de módulos, F0–F7 e critérios — estado final local

**Código:** `6c0353bb7da20338518b36427416343ba23f1835` (branch `v2`). **Baseline visual:** `bdebbcd0`; a UI atual difere apenas no aviso de prova vencida e no aviso de falha ao persistir layout. **Aceite:** `UX_HUMAN_PENDING`; externo `F7_EXTERNAL_PENDING`.

Legenda: PASS_LOCAL, PASS_EMULATOR_LOCAL, PARTIAL_JUSTIFIED, BLOCKED_EXTERNAL, BLOCKED_NEW_APPROVAL, NOT_RUN_ENVIRONMENT, HUMAN_PENDING.

## Oito abas + Shell

| Área | Funcionalidades verificadas | Estado | Prova |
|---|---|---|---|
| Home | contextos ONBOARDING/DAILY/FINAL_STRETCH/PERFORMANCE/ACTIVE; sugestão com consentimento; layout manual, undo e persistência; widgets e filtros | PASS_LOCAL | `f7-ux-premium-home`, `f7-ux-premium-layout`, `f7-ux-home` |
| Conteúdo | editais, disciplinas, assuntos, aulas, árvore paginada, inspetor, importação, arquivamento | PASS_LOCAL | `f2-*`, `f2-inspector`, `f7-ux-knowledge-library` |
| Planejamento | cenários, prévia/cancelamento, capacidade compartilhada, calendário, Reta Final, portabilidade | PASS_LOCAL | `f3-*`, `f7-ux-planning-workspace`, P-09 |
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
| F3 | organizador, calendário, ciclo, wizard, Reta Final, importação, editor, histórico, conflitos, portabilidade, redistribuição | PASS_LOCAL; aviso de prova vencida coberto |
| F4 | timer/Pomodoro, registro, histórico, hábitos | PASS_LOCAL; F4-T13 NOT_RUN_ENVIRONMENT |
| F5 | revisões, pontos fracos, banca | PASS_LOCAL |
| F6 | shell, fachadas, Home, Análises, busca, notificações, preferências, temas, acessibilidade, skeleton | PASS_LOCAL; a11y manual NOT_RUN |
| F7 | sync, centro, diagnóstico, backup, dados | PASS_LOCAL em fakes + PASS_EMULATOR_LOCAL em Rules/transações; backend real BLOCKED_EXTERNAL |
| Adiado | F-V1-VISUAL-LAYOUT-LAB | BLOCKED_NEW_APPROVAL |

Total: 46 (45 ativos + 1 bloqueado). Nenhuma capacidade foi reimplementada nesta rodada.

## F1–F7

| Fase | Estado local | Ressalva |
|---|---|---|
| F1 | PASS_LOCAL | quatro HIGH F0 com mitigação local e prova no emulador para Rules; serviço real UNVERIFIED |
| F2 | PASS_LOCAL | importação/associação cobertas; histórico preservado |
| F3 | PASS_LOCAL | aviso de prova vencida implementado; hardware modesto NOT_RUN |
| F4 | PASS_LOCAL | F4-T13 NOT_RUN_ENVIRONMENT; INCOMING parcial documentado |
| F5 | PASS_LOCAL | política/importação/conflito cobertos |
| F6 | PASS_LOCAL | a11y manual NOT_RUN |
| F7 | PASS_LOCAL + PASS_EMULATOR_LOCAL | G-EXT/G-STAGING pendentes; quotas e multi-dispositivo não provados |

## Critérios F7-UX e Premium

- **D01–D71 / UX-01–UX-31 / AC-01–AC-24:** matriz em `UX-ACCEPTANCE-MATRIX.md` e `FULL-DV-VA-MATRIX.md`; P-09, R-09 e UX-21 PASS no escopo local.
- **DV-01–DV-18:** DV-05, DV-06, DV-08, DV-17 e DV-18 PARTIAL_JUSTIFIED.
- **VA-01–VA-20:** VA-06 PARTIAL (benchmark); VA-20 PASS_AUTOMATED / MANUAL_NOT_RUN.
- **RP-00–RP-15:** executados nas rodadas Premium anteriores; sem novo mock 1:1.
- **Visual Layout Lab:** não implementado; gate separado.

## Evidência visual desta rodada

Capturas geradas no HEAD `6c0353bb`: 8 módulos em 4 viewports, 12 temas, 4 conceitos premium em desktop/tablet/mobile (390, 320 e 320×568), Foco, galeria de temas e páginas completas. Ver `VISUAL-EVIDENCE.md` no ZIP.
