# Preservação funcional — F0 a F7 e UX/AC

**Código de referência:** a4b56e5e, branch local v2. **Natureza:** rastreio de preservação e evidência local; não é homologação externa nem aceite humano.

## F0 — 46 capacidades

A matriz canônica permanece em docs/superpowers/v2/ROADMAP.md §17. Os 46 IDs foram conferidos por contagem automática; nenhum foi removido ou renumerado nesta fase visual.

| Fase | IDs F0 | Quantidade | Preservação |
|---|---|---:|---|
| F1 | F-V1-PERSISTENCE-INDEXEDDB; F-V1-SAVE-STATUS; F-V1-BOOT-RECOVERY; F-V1-PWA-OFFLINE | 4 | PASS_LOCAL — IndexedDB, commit, outbox, offline e boot cobertos por unit/E2E |
| F2 | F-V1-EDITALS-CRUD; F-V1-PRINCIPAL-EDITAL; F-V1-ARCHIVED-EDITALS; F-V1-VERTICAL-EDITAL; F-V1-EDITAL-IMPORT; F-V1-LESSON-MAPPER | 6 | PASS_LOCAL — IDs estáveis, árvore, importação protegida, arquivo e vínculos |
| F3 | F-V1-STUDY-ORGANIZER; F-V1-CALENDAR; F-V1-CYCLE; F-V1-PLANNING-WIZARD; F-V1-RF-OVERVIEW; F-V1-RF-IMPORT; F-V1-RF-EDITOR-PLANNER; F-V1-RF-HISTORY; F-V1-RF-CONFLICTS; F-V1-RF-PORTABILITY; F-V1-RF-REDISTRIBUTION | 11 | PASS_LOCAL — calendário, capacidade, reta final, prévia, CAS e portabilidade |
| F4 | F-V1-TIMER-POMODORO; F-V1-SESSION-REGISTRATION; F-V1-SESSION-HISTORY; F-V1-HABITS | 4 | PASS_LOCAL — sessão única, clock único, pausa/retomada, Foco, histórico e hábitos |
| F5 | F-V1-REVISIONS; F-V1-WEAK-POINTS; F-V1-BANCA-ANALYZER | 3 | PASS_LOCAL — fila, STARTED/COMPLETED, política, histórico, prioridade e banca |
| F6 | F-V1-APP-SHELL; F-V1-LEGACY-FACADES; F-V1-HOME-DASHBOARD; F-V1-ANALYTICS-DASHBOARD; F-V1-GLOBAL-SEARCH; F-V1-NOTIFICATIONS; F-V1-CONFIG-PREFERENCES; F-V1-THEMES; F-V1-ACCESSIBILITY; F-V1-SKELETON-LOADING | 10 | PASS_LOCAL — rotas, Home, busca, atenção, temas, configurações e acessibilidade automatizada |
| F7 | F-V1-FIRESTORE-SYNC; F-V1-CLOUDFLARE-SYNC; F-V1-DRIVE-SYNC; F-V1-SYNC-CENTER; F-V1-SYNC-DIAGNOSTICS; F-V1-BACKUP-EXPORT-IMPORT; F-V1-DATA-MANAGEMENT | 7 | PASS_LOCAL em contratos/fakes; serviços reais NOT_RUN |
| Adiado | F-V1-VISUAL-LAYOUT-LAB | 1 | NÃO IMPLEMENTADO POR DECISÃO — não foi promovido a escopo |
| **Total** | — | **46** | — |

A decisão adiada permanece fora do escopo. Nenhuma capacidade foi substituída por mockup estático.

## F1 a F7

| Fase | Contrato preservado | Evidência local |
|---|---|---|
| F1 | Transações, commit atômico, outbox, Web Locks, PWA/offline | f2-atomic-commit, pwa-offline, transaction-failure, isolated IDB |
| F2 | Identidade canônica, hierarquia, importação, arquivamento, associações | f2-* e f7-ux-knowledge-library, incluindo 1000 assuntos |
| F3 | Datas civis, capacidade, cenários, calendário, reta final, CAS | f3-* e f7-ux-planning-workspace |
| F4 | Sessão/clock únicos, pausa/retomada, Foco, duas abas, histórico | f4-* e f7-ux-premium-focus |
| F5 | Fila, começou/concluiu, histórico, política versada, evidência | f5-* e f7-ux-reviews-queue |
| F6 | Shell, busca, Home, widgets, Atenção, Insights, Settings | f6-*; f7-ux-home, analytics e settings |
| F7 | Sync/outbox/ACK/conflito, backup, restore, rebaseline, PWA | f7-recovery, f7-real-outbox, staging e storage recovery com fakes |

Os commits v14/v15 alteraram somente apresentação e testes de apresentação. Nenhum arquivo de domínio, IndexedDB, outbox, sync, clock, backup ou recovery foi modificado.

## UX-01 a UX-31

**PASS_LOCAL:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09, UX-10, UX-11, UX-12, UX-13, UX-14, UX-15, UX-18, UX-20, UX-22, UX-23, UX-24, UX-25, UX-26, UX-27, UX-28, UX-29, UX-30, UX-31.

| ID pendente | Limitação atual | Evidência/necessidade |
|---|---|---|
| UX-16 | Diagnóstico comparativo de capacidade resumido (P-01) | Preview/ativação/calendário existem; diagnóstico detalhado permanece PARTIAL_LOCAL |
| UX-17 | P-05 encerramento direto e P-06 comparação de revisões resumida | Checkpoint/restauração existem; comparação lado a lado ainda parcial |
| UX-19 | E-07 consistência contextual de hábitos parcial | Recuperação, conflito e histórico estão provados; aprofundamento de hábitos não |
| UX-21 | R-04 navegação por amostra/evidência parcial | Encaixe, histórico, importação e STALE provados; drill-down de evidência parcial |

UX-30 mantém PASS_LOCAL/A11Y_MANUAL_NOT_RUN. UX-31 cobre higiene Git, revisão, bundle, hashes e pacote; não implica push.

## DV-01 a DV-18

**PASS:** DV-01, DV-02, DV-03, DV-07, DV-09, DV-10, DV-11, DV-15, DV-16.

**PARTIAL:** DV-04, DV-05, DV-06, DV-08, DV-12, DV-13, DV-14, DV-17, DV-18.

Os PARTIAL são funcionais/profundidade de módulo, não falhas P0:

- DV-04/05: contexto de desempenho e teste dedicado de layout fixado.
- DV-06/08: Studios usam gramática premium, mas não há mockup 1:1 nem separação universal em três camadas.
- DV-12/14: Review e Knowledge mantêm conteúdo longo; há subnavegação, biblioteca e contagens.
- DV-13: drill-down por entidade existe, mas cobertura densa de fixture é parcial.
- DV-17: sheets cobrem filtros; sistema geral de sheets não é universal.
- DV-18: feedback contextual existe; avisos persistentes ainda convivem com faixa/Atenção.

## VA-01 a VA-20

**PASS/PASS_LOCAL:** VA-01, VA-02, VA-03, VA-04, VA-05, VA-10, VA-11, VA-15, VA-16, VA-18, VA-19.

**PARTIAL:** VA-06, VA-07, VA-08, VA-09, VA-12, VA-13, VA-14, VA-17.

VA-20 é PASS_AUTOMATED com acessibilidade manual e hardware NOT_RUN. Os estados locais preservam dados reais; nenhuma fonte foi substituída por números fictícios.

## AC-01 a AC-24

Todos os ACs de comportamento local permanecem PASS_LOCAL, incluindo conteúdo, planejamento, sessão, revisão, métricas, backup preview, recovery e routing. AC-22 é PASS_AUTOMATED/MANUAL_NOT_RUN para NVDA/Narrator. AC-15–AC-19 mantêm distinção entre local, ACK, convergência, backup e restauração.

As matrizes completas de UX/DV/VA/AC estão preservadas em:

- docs/superpowers/audits/f7-ux/UX-ACCEPTANCE-MATRIX.md
- docs/superpowers/audits/f7-ux-premium/ACCEPTANCE-MATRIX.md

## Gates

- G-EXT/G-STAGING/F8/push: NOT_RUN/NOT_AUTHORIZED.
- UX-H: PENDING_HUMAN.
- A11y manual, leitor de tela, hardware modesto e toque físico: NOT_RUN_ENVIRONMENT.
- Firebase/Cloudflare/Google Drive reais: não ativados.
- main e origin/main: intocadas.
