# Matriz de aceite — remediação UX-H

**Código:** `6c0353bb7da20338518b36427416343ba23f1835` (rodada de emulador de 16/11/2026; IDs preservados da remediação de 13/11). **Baseline reprovado:** `a4b56e5e` / `48548168`. **Aceite:** `UX_HUMAN_PENDING`.

## D01–D71

| Decisões | Escopo | Estado | Prova |
|---|---|---|---|
| D01–D29 | Home, Bento, widgets, fórmulas, filtros | PASS_LOCAL | f7-ux-home, f7-ux-premium-home, f7-ux-premium-layout |
| D30 | gráficos e séries | PASS_LOCAL | editor Insights, tabela equivalente |
| D31–D54 | Shell, Busca, Atenção, Conteúdo, Planejamento, Sessões | PASS_LOCAL | F2/F3/F4, contraste, capacidade, foco |
| D55–D64 | Revisões e Análises | PASS_LOCAL | F5, evidências F4/F5, duas colunas |
| D65–D68 | Settings, perfil, sync, backup, manutenção | PASS_LOCAL em fake/local + Emulator em Rules; externo NOT_RUN | F6/F7 |
| D69–D71 | continuidade, recuperação, design system | PASS_LOCAL | 12 temas, reduced motion, foco, offline |

## DV-01–DV-18

| ID | Estado | Evidência/limite |
|---|---|---|
| DV-01–DV-03 | PASS | catálogo, galeria, glow/densidade |
| DV-04 | PASS_LOCAL_VERIFIED (fixture) | cenário PERFORMANCE com cenário ativo + sessão concluída; f7-ux-premium-home |
| DV-05 | PARTIAL_JUSTIFIED | sugestão com consentimento; layout fixado com teste dedicado |
| DV-06 | PARTIAL_JUSTIFIED | Studios recompostos; não há mock 1:1 para eles |
| DV-07 | PASS | onboarding e estados vazios reais |
| DV-08 | PARTIAL_JUSTIFIED | hierarquia corrigida; sistema universal de três camadas não existe |
| DV-09–DV-11 | PASS | superfícies, Foco, calendário |
| DV-12 | PASS_LOCAL | fila/execução/histórico em duas colunas |
| DV-13 | PASS_LOCAL_VERIFIED (leitura) | F4 abre a sessão; F5 mostra execução com tópico, avaliação, cobertura, duração e compromisso |
| DV-14 | PASS_LOCAL_VERIFIED (escopo local) | biblioteca, árvore e inspetor; fixture de 120 assuntos e 320 px testados |
| DV-15–DV-16 | PASS | Command Center, Busca, Settings |
| DV-17 | PARTIAL_JUSTIFIED | sheet da fila existe; sistema geral de sheets não |
| DV-18 | PARTIAL_JUSTIFIED | feedback contextual; avisos persistentes |

## VA-01–VA-20

| VA | Estado | Prova |
|---|---|---|
| VA-01–VA-05 | PASS | temas, persistência, onboarding |
| VA-06 | PARTIAL_JUSTIFIED | fixture acadêmica coberta; benchmark formal de renderização/hardware não executado |
| VA-07 | PASS_LOCAL_VERIFIED | consentimento de ordem em PERFORMANCE e FINAL_STRETCH; nada muda antes de aplicar |
| VA-08 | PASS_LOCAL | Studios com hierarquia própria |
| VA-09 | PASS_LOCAL | ações em camadas e duas colunas |
| VA-10–VA-11 | PASS | sessão/Foco, Planning |
| VA-12 | PASS_LOCAL | fila antes da política |
| VA-13 | PASS_LOCAL_VERIFIED (leitura) | F4 contextual e detalhe F5 sob demanda, sem nova tela de edição |
| VA-14 | PASS_LOCAL_VERIFIED (escopo local) | Knowledge com inspetor contextual, seleção e retorno de foco |
| VA-15–VA-16 | PASS | rotas/IDs, Settings seguro |
| VA-17 | PARTIAL_JUSTIFIED | sheets parciais |
| VA-18–VA-19 | PASS_LOCAL | feedback, conflito em Foco |
| VA-20 | PASS_AUTOMATED / MANUAL_NOT_RUN | 12 temas; NVDA/hardware pendentes |

## AC-01–AC-24

Fórmulas, dados, commits, outbox, relógio e restore não foram alterados. AC-01–AC-21 e AC-23–AC-24 seguem PASS_LOCAL; AC-22 é PASS_AUTOMATED / MANUAL_NOT_RUN.

## UX-01–UX-31

| Item | Estado | Prova |
|---|---|---|
| UX-01–UX-15 | PASS_LOCAL | matriz detalhada em `UX-ACCEPTANCE-MATRIX.md` |
| UX-16 / P-01 | PASS_LOCAL_VERIFIED | `states/planning-capacity-overload.png`; teste 400% / excesso 90 min |
| UX-17 / P-05 | PASS_LOCAL_VERIFIED | `states/final-stretch-close-preview.png`; foco e confirmação |
| UX-17 / P-06 | PASS_LOCAL_VERIFIED | `states/planning-history.png`; alvo -1/-1 e confirmação |
| UX-19 / E-07 | PASS_LOCAL_VERIFIED (limite) | `states/session-habit-context.png`; vínculo antigo = não demonstrado |
| UX-21 / R-04 | PASS_LOCAL_VERIFIED | prioridade abre o ponto fraco e o detalhe F5; F4 abre a sessão; aviso sem amostra |
| UX-22–UX-29 | PASS_LOCAL | Insights, Settings, jornadas, offline |
| UX-30 | PASS_LOCAL / A11Y_MANUAL_NOT_RUN | typecheck, lint, build, 881 unitários, 248/253 E2E, 17/17 emulador |
| UX-31 | PENDING_BUNDLE | bundle, hashes, revisões e ZIP final; será verificado no fechamento |

## F0 — 46 capacidades (detalhe)

| ID | Estado | Prova |
|---|---|---|
| F-V1-PERSISTENCE-INDEXEDDB | PASS_LOCAL | tests/unit/storage*, f1-* |
| F-V1-SAVE-STATUS | PASS_LOCAL | tests/unit/save-*, f1-* |
| F-V1-BOOT-RECOVERY | PASS_LOCAL | tests/unit/boot-*, recovery |
| F-V1-PWA-OFFLINE | PASS_LOCAL | tests/e2e/pwa-offline.spec.ts |
| F-V1-EDITALS-CRUD | PASS_LOCAL | tests/e2e/f2-*, editais |
| F-V1-PRINCIPAL-EDITAL | PASS_LOCAL | tests/unit/editais-* |
| F-V1-ARCHIVED-EDITALS | PASS_LOCAL | tests/e2e/f2-archived* |
| F-V1-VERTICAL-EDITAL | PASS_LOCAL | tests/e2e/f2-vertical* |
| F-V1-EDITAL-IMPORT | PASS_LOCAL | tests/unit/import*, f2-import |
| F-V1-LESSON-MAPPER | PASS_LOCAL | tests/unit/lesson* |
| F-V1-STUDY-ORGANIZER | PASS_LOCAL | tests/e2e/f3-journey |
| F-V1-CALENDAR | PASS_LOCAL | tests/unit/f3-calendar.test.ts |
| F-V1-CYCLE | PASS_LOCAL | tests/unit/f3-scenarios.test.ts |
| F-V1-PLANNING-WIZARD | PASS_LOCAL | tests/unit/f3-wizard* |
| F-V1-RF-OVERVIEW | PASS_LOCAL | tests/e2e/f3-final-stretch-ui.spec.ts |
| F-V1-RF-IMPORT | PASS_LOCAL | tests/e2e/f3-final-stretch-ui.spec.ts |
| F-V1-RF-EDITOR-PLANNER | PASS_LOCAL | tests/e2e/f7-ux-planning-workspace.spec.ts |
| F-V1-RF-HISTORY | PASS_LOCAL | tests/e2e/f7-ux-planning-workspace.spec.ts |
| F-V1-RF-CONFLICTS | PASS_LOCAL | tests/unit/f3-conflicts* |
| F-V1-RF-PORTABILITY | PASS_LOCAL | tests/unit/f3-portability* |
| F-V1-RF-REDISTRIBUTION | PASS_LOCAL | tests/unit/f3-redistribution* |
| F-V1-TIMER-POMODORO | PASS_LOCAL | tests/e2e/f4-pomodoro.spec.ts |
| F-V1-SESSION-REGISTRATION | PASS_LOCAL | tests/e2e/f4-manual-details.spec.ts |
| F-V1-SESSION-HISTORY | PASS_LOCAL | tests/e2e/f7-ux-sessions-history.spec.ts |
| F-V1-HABITS | PASS_LOCAL | tests/e2e/f4-habits.spec.ts |
| F-V1-REVISIONS | PASS_LOCAL | tests/e2e/f5-review-journey.spec.ts |
| F-V1-WEAK-POINTS | PASS_LOCAL | tests/e2e/f5-review-journey.spec.ts |
| F-V1-BANCA-ANALYZER | PASS_LOCAL | tests/unit/f5-banca* |
| F-V1-APP-SHELL | PASS_LOCAL | tests/e2e/f7-ux-shell-navigation.spec.ts |
| F-V1-LEGACY-FACADES | PASS_LOCAL | tests/unit/f6-legacy* |
| F-V1-HOME-DASHBOARD | PASS_LOCAL | tests/e2e/f7-ux-home.spec.ts |
| F-V1-ANALYTICS-DASHBOARD | PASS_LOCAL | tests/e2e/f7-uxh-remediation.spec.ts |
| F-V1-GLOBAL-SEARCH | PASS_LOCAL | tests/e2e/f6-search* |
| F-V1-NOTIFICATIONS | PASS_LOCAL | tests/e2e/f5-settings-ui.spec.ts |
| F-V1-CONFIG-PREFERENCES | PASS_LOCAL | tests/e2e/f7-ux-settings-safety.spec.ts |
| F-V1-THEMES | PASS_LOCAL | tests/e2e/f7-ux-premium-theme.spec.ts |
| F-V1-ACCESSIBILITY | PASS_LOCAL / MANUAL_NOT_RUN | tests/e2e/visual-a11y.spec.ts, f3-a11y-states |
| F-V1-SKELETON-LOADING | PASS_LOCAL | tests/unit/skeleton* |
| F-V1-FIRESTORE-SYNC | PASS_LOCAL em fakes + EMULATOR_LOCAL | tests/unit/sync*, tests/firebase/* |
| F-V1-CLOUDFLARE-SYNC | PASS_LOCAL em fakes / NOT_RUN externo | tests/unit/cloud-sync* |
| F-V1-DRIVE-SYNC | PASS_LOCAL em fakes / NOT_RUN externo | tests/unit/drive-sync* |
| F-V1-SYNC-CENTER | PASS_LOCAL | tests/unit/sync-center* |
| F-V1-SYNC-DIAGNOSTICS | PASS_LOCAL | tests/unit/sync-health* |
| F-V1-BACKUP-EXPORT-IMPORT | PASS_LOCAL | tests/unit/backup* |
| F-V1-DATA-MANAGEMENT | PASS_LOCAL | tests/e2e/f7-settings* |
| F-V1-VISUAL-LAYOUT-LAB | BLOCKED_NEW_APPROVAL | adiado por decisão; não implementado |

Total: 46 (45 ativos + 1 adiado).
