# Matriz de aceite — remediação UX-H

**Código:** `92745e0a`. **Baseline reprovado:** `a4b56e5e` / `48548168`. **Aceite:** `UX_H_RE_REVIEW_PENDING`.

## D01–D71

| Decisões | Escopo | Estado | Prova |
|---|---|---|---|
| D01–D29 | Home, Bento, widgets, fórmulas, filtros | PASS_LOCAL | f7-ux-home, f7-ux-premium-home, f7-ux-premium-layout |
| D30 | gráficos e séries | PASS_LOCAL | editor Insights, tabela equivalente |
| D31–D54 | Shell, Busca, Atenção, Conteúdo, Planejamento, Sessões | PASS_LOCAL | F2/F3/F4, contraste, capacidade, foco |
| D55–D64 | Revisões e Análises | PASS_LOCAL | F5, evidências F4/F5, duas colunas |
| D65–D68 | Settings, perfil, sync, backup, manutenção | PASS_LOCAL em fake/local; externo NOT_RUN | F6/F7 |
| D69–D71 | continuidade, recuperação, design system | PASS_LOCAL | 12 temas, reduced motion, foco, offline |

## DV-01–DV-18

| ID | Estado | Evidência/limite |
|---|---|---|
| DV-01–DV-03 | PASS | catálogo, galeria, glow/densidade |
| DV-04 | PARTIAL_JUSTIFIED | cenário desempenho depende de fixture dirigida |
| DV-05 | PARTIAL_JUSTIFIED | sugestão com consentimento; layout fixado com teste limitado |
| DV-06 | PARTIAL_JUSTIFIED | Studios recompostos; não há mock 1:1 para eles |
| DV-07 | PASS | onboarding e estados vazios reais |
| DV-08 | PARTIAL_JUSTIFIED | hierarquia corrigida; sistema universal de três camadas não existe |
| DV-09–DV-11 | PASS | superfícies, Foco, calendário |
| DV-12 | PASS_LOCAL | fila/execução/histórico em duas colunas |
| DV-13 | PARTIAL_JUSTIFIED | drill-down F4 com contexto; F5 não navegável |
| DV-14 | PASS_LOCAL | biblioteca em faixa, árvore e grid |
| DV-15–DV-16 | PASS | Command Center, Busca, Settings |
| DV-17 | PARTIAL_JUSTIFIED | sheet da fila existe; sistema geral de sheets não |
| DV-18 | PARTIAL_JUSTIFIED | feedback contextual; avisos persistentes |

## VA-01–VA-20

| VA | Estado | Prova |
|---|---|---|
| VA-01–VA-05 | PASS | temas, persistência, onboarding |
| VA-06 | PARTIAL_JUSTIFIED | performance sem fixture dirigida |
| VA-07 | PARTIAL_JUSTIFIED | layout fixado com teste limitado |
| VA-08 | PASS_LOCAL | Studios com hierarquia própria |
| VA-09 | PASS_LOCAL | ações em camadas e duas colunas |
| VA-10–VA-11 | PASS | sessão/Foco, Planning |
| VA-12 | PASS_LOCAL | fila antes da política |
| VA-13 | PARTIAL_JUSTIFIED | evidência F4 contextual; F5 só auditoria |
| VA-14 | PASS_LOCAL | Knowledge |
| VA-15–VA-16 | PASS | rotas/IDs, Settings seguro |
| VA-17 | PARTIAL_JUSTIFIED | sheets parciais |
| VA-18–VA-19 | PASS_LOCAL | feedback, conflito em Foco |
| VA-20 | PASS_AUTOMATED / MANUAL_NOT_RUN | 12 temas; NVDA/hardware pendentes |

## AC-01–AC-24

Fórmulas, dados, commits, outbox, relógio e restore não foram alterados. AC-01–AC-21 e AC-23–AC-24 seguem PASS_LOCAL; AC-22 é PASS_AUTOMATED / MANUAL_NOT_RUN.

## UX-01–UX-31

| Item | Estado | Prova |
|---|---|---|
| UX-01–UX-15 | PASS_LOCAL | matriz histórica em `docs/superpowers/audits/f7-ux/UX-ACCEPTANCE-MATRIX.md` |
| UX-16 / P-01 | PASS_VERIFIED | `states/planning-capacity-overload.png`; teste 400% / excesso 90 min |
| UX-17 / P-05 | PASS_VERIFIED | `states/final-stretch-close-preview.png`; foco e confirmação |
| UX-17 / P-06 | PASS_VERIFIED | `states/planning-history.png`; alvo -1/-1 e confirmação |
| UX-19 / E-07 | PASS_VERIFIED (limite) | `states/session-habit-context.png`; vínculo antigo = não demonstrado |
| UX-21 / R-04 | PARTIAL_JUSTIFIED | amostra por medição e link F4; F5 sem tela própria |
| UX-22–UX-29 | PASS_LOCAL | Insights, Settings, jornadas, offline |
| UX-30 | PASS_LOCAL / A11Y_MANUAL_NOT_RUN | typecheck, lint, build, 880 unitários, 241 E2E |
| UX-31 | PASS_LOCAL | bundle, hashes, revisões e ZIP |

## F0 — 46 capacidades

| Grupo | IDs | Estado |
|---|---|---|
| F1 | persistência, save, boot, PWA | PASS_LOCAL |
| F2 | editais, principal, arquivados, verticalização, importação, aulas | PASS_LOCAL |
| F3 | organizador, calendário, ciclo, wizard, Reta Final, importação, editor, histórico, conflitos, portabilidade, redistribuição | PASS_LOCAL |
| F4 | timer/pomodoro, registro, histórico, hábitos | PASS_LOCAL |
| F5 | revisões, pontos fracos, banca | PASS_LOCAL |
| F6 | shell, fachadas, Home, Análises, busca, notificações, preferências, temas, acessibilidade, skeleton | PASS_LOCAL |
| F7 | sync Firestore/Cloudflare/Drive, centro, diagnóstico, backup, dados | PASS_LOCAL em contratos/fakes; externo NOT_RUN |
| Adiado | F-V1-VISUAL-LAYOUT-LAB | fora do escopo |

