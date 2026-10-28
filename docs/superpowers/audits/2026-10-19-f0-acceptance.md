# Relatório de aceitação F0 — Estudo Organizado V2

**Data da execução:** 2026-10-28 (America/Fortaleza)
**Branch:** `v2` (worktree isolado `C:\\Users\\slvma\\.codex\\worktrees\\v2-f0-audit\\estudo-organizado`)
**Base:** `origin/v2` em `2ffcc63` + merge de `origin/main` em `689a9f4`
**Gate calculado:** `READY_FOR_HUMAN_REVIEW` (não aprovado)
**Escopo:** F0 somente. Nenhuma implementação V2, nenhuma alteração funcional na V1, nenhum deploy, nenhum dado real.

## 1. Resumo executivo

A F0 foi executada com métodos Subagent-driven, TDD dos validadores e revisão independente por tarefa. Foram produzidos inventário funcional, matriz de fontes, matriz de schemas, matriz de riscos, baseline de QA e auditoria visual Impeccable. A V1 permaneceu intocada: todos os commits alteram apenas `scripts/v2-audit/`, `tests/unit/v2-audit-*.test.js` e `docs/superpowers/audits/`.

A auditoria encontrou 46 funcionalidades em 24 domínios, 37 registros de schema, 13 riscos (4 HIGH, 7 MEDIUM, 2 LOW) e 11 verificações de baseline. O Impeccable 3.9.1 foi executado nos oito temas e em três viewports, com 162 achados estáticos e evidências visuais sintéticas.

O resultado não é “F0 aprovada”. O gate máximo é **READY_FOR_HUMAN_REVIEW** porque não existe aceite humano específico nem aprovação dos 46 destinos propostos. F1–F8 permanecem não autorizadas.

## 2. Entregáveis e validação

| Artefato | Conteúdo | Validação |
| --- | --- | --- |
| `2026-10-19-v1-feature-inventory.json` | 46 funcionalidades, 24 domínios, 159 fontes e 178 testes citados | `validateInventory` OK; 0 fontes/testes ausentes |
| `2026-10-19-v1-source-coverage.json` | 86 superfícies descobertas, 84 mapeadas, 2 exclusões justificadas | `unmapped=[]`, `invalid_exclusions=[]` |
| `2026-10-19-v1-schema-matrix.json` | 37 entidades/contratos, 4 conflitos documentados | `validateSchemaMatrix` OK; todos os caminhos existem |
| `2026-10-19-v1-risk-matrix.json` | 13 riscos, 4 HIGH, 1 MITIGATED, 12 UNVERIFIED | `validateRiskMatrix` OK; 38 caminhos existem |
| `2026-10-19-v1-qa-baseline.json` | 11 verificações: 4 PASS, 2 FAIL, 2 INCONCLUSIVE, 3 NOT_RUN | `validateBaseline` OK; gate visual PASS |
| `2026-10-19-v1-design-baseline.md` | Impeccable, 8 temas, 3 viewports, achados P1–P3 | 24 capturas; 4 preservadas com SHA-256 |
| `evidence/` | Logs reais de unit/lint/design/E2E, detector, métricas e capturas | 8 arquivos textuais + 4 PNG |
| `scripts/v2-audit/*.mjs` | 6 validadores puros de auditoria | 60 testes F0 PASS |
| `tests/unit/v2-audit-*.test.js` | Contratos, casos negativos e artefatos reais | 10 arquivos, 66 testes |

## 3. Cobertura funcional e lacunas

O inventário cobre as 15 views de navegação reais e capacidades adicionais: shell, persistência, boot recovery, Home, Study Organizer, calendário, timer/Pomodoro, sessões, histórico, revisões, hábitos, ciclo, wizard, editais, edital principal, arquivados, verticalizado, importação, mapeamento de aulas, dashboards, pontos fracos, banca, busca, notificações, configurações, temas, backup, gestão de dados, Firestore, Cloudflare, Drive, central de sync, diagnóstico, PWA, acessibilidade, skeletons, oito fluxos da Reta Final e o laboratório visual.

**Limite declarado:** `unmapped=[]` prova cobertura do conjunto descoberto pelo plano (views, logic, ui/actions e cinco facades), não de todos os 148 arquivos JavaScript da V1. Arquivos de `sync/`, `store/`, `app/` e `registro-sessao/` aparecem no inventário quando funcionalmente relevantes, mas não estão no descobridor automático.

Quatro linhas permanecem sem prova de runtime: notificações nativas, Cloudflare, Google Drive e diagnóstico de sync. Firestore foi reclassificado para `UNCERTAIN` após revisão independente, porque OAuth/emulador/persistência remota não foram executados.

## 4. Status reais da F0

| Status | Itens | Evidência |
| --- | --- | --- |
| **PASS** | Validadores e testes F0 (66/66); suíte unitária (189 arquivos/3048 testes, incluindo 10 arquivos/66 testes da F0); lint (0 erros); design/contraste (45 testes); Impeccable executado; contraste AA nos 8 temas | `evidence/2026-10-28-*.txt`, suíte `v2-audit` |
| **FAIL** | `npm run test:e2e:mock` não encontra testes; `npm run test:e2e:mock:all` tem 107 falhas em 166 | `evidence/2026-10-28-e2e-mock-*.txt/.md` |
| **BLOCKED** | Nenhum item da F0 ficou bloqueado por ferramenta ausente | Impeccable e Playwright disponíveis |
| **INCONCLUSIVE** | Acessibilidade completa (leitor de tela, zoom 200%, todos os fluxos); performance real fora do mock; Firestore real; Drive/Cloudflare reais | Baseline + matriz de riscos |
| **NOT_RUN** | Migração real de IndexedDB; emulador Firestore/rules; aderência das rules publicadas; restore real; teste multi-dispositivo | `B-V1-*` NOT_RUN e riscos UNVERIFIED |

Os 107 FAIL de E2E não foram corrigidos, por proibição explícita de alterar a V1. A causa dominante aparente é divergência entre seed mock e expectativas fixas, além de timeouts de Service Worker; não há conclusão de causa raiz individual para todos os casos.

## 5. Baseline e Impeccable

- **Suíte unitária:** 189 arquivos e 3048 testes PASS em 88,37 s; antes dos testes da própria F0, a V1 tinha 179 arquivos/2982 testes PASS.
- **Lint:** 0 erros e 3075 warnings preexistentes.
- **Contraste:** AA de corpo nos oito temas; pior `text-muted` 4,56:1 (Neon).
- **Responsivo:** sem overflow horizontal em 1440, 834 e 390; 634 nós; DCL 398–544 ms e load 612–652 ms no mock local.
- **Impeccable:** 162 achados (9 warning, 153 advisory), majoritariamente drift de tokens; nenhuma evidência de gradiente em texto, glassmorphism ou template SaaS.
- **P1 visual:** toasts empilhados cobrem “Iniciar sessão” e cards no desktop/tablet.
- **P2 visual:** labels de 9–10 px, 41 cores de tema fora da paleta base, 3 side-tabs, animação de `width`, avisos duplicados e métrica “61:02:00 / Sem registros” no mock.

## 6. Riscos prioritários

| ID | Severidade | Risco | Fase sugerida |
| --- | --- | --- | --- |
| `R-V1-LEGACY-REMOTE-PLAN` | HIGH | Issue #107: snapshot legado tratado como ausência de plano; correção local não publicada | F1 contrato / F7-A |
| `R-V1-FIRESTORE-DOCUMENT-1MIB` | HIGH | Envelope real de 1.210.602 bytes contra limite de 1.048.576 | F1 orçamento / F7-A |
| `R-V1-MULTITAB-OUTBOX-RACE` | HIGH | Lock de sync em memória; duas abas podem flushar a outbox | F1 contrato / F7-A |
| `R-V1-BACKUP-TOMBSTONE-LOSS` | HIGH | `createExportableState` reseta `firestoreSync` e perde tombstones no backup/restore | F1 contrato / F7-C |
| `R-V1-CLEARDATA-DRAFT-RESIDUE` | MEDIUM | `clearData()` não limpa drafts/journal da Reta Final | F1 |
| `R-V1-INNERHTML-ESCAPE-SURFACE` | MEDIUM | 43 arquivos usam `innerHTML`; XSS não comprovado, mas superfície ampla | F2/F6 |
| `R-V1-QUOTA-SAVE-LOSS` | MEDIUM | Falha de quota precisa impedir confirmação falsa | F1 |
| `R-V1-TIMER-REFRESH-LOSS` | MEDIUM | Timer depende de `setInterval` e `_timerStart`; suspensão/refresh não testados | F4 |
| `R-V1-SW-STALE-SHELL` | MEDIUM | Cache/versionamento do SW pode mascarar código antigo | F1 PWA / F7-D |
| `R-V1-RULES-DEPLOY-DRIFT` | MEDIUM | Rules publicadas não foram comparadas em emulador | F7-E |
| `R-V1-IMPORT-UNBOUNDED-JSON` | MEDIUM | Importação JSON sem limites de tamanho/profundidade comprovados | F2 |
| `R-V1-ENTITY-TOMBSTONE-CONTRACT-DRIFT` | LOW | Docs de contrato usam `config.entityTombstones`; código usa `state.syncTombstones` | F1 |
| `R-V1-BACKUP-CREDENTIAL-LEAK` | LOW | Export remove credenciais; 25 testes PASS | F2 |

Nenhum risco é declarado explorável sem evidência. Os 12 UNVERIFIED exigem teste reproduzível na fase indicada.

## 7. Issue #107 como insumo de regressão

O caso real está documentado em `docs/handoffs/handoff-2026-10-26-issue-107-missing-remote-plan.md` e na issue #107. A F0 registra o cenário: remoto legado sem `schemaVersionRetaFinal`/`planId`/`revision`, local v2 com 180 blocos equivalentes, adoção recusada como `missing-remote-plan`. A correção existe localmente na `main`, sem push/deploy; por isso o risco permanece UNVERIFIED.

**Teste de regressão proposto para a V2 (não executado):** legado remoto × plano v2 equivalente deve adotar com CAS; divergência material deve gerar conflito explícito; `null` por formato legado nunca pode ser tratado como ausência; payload acadêmico e tombstones devem ser preservados; repetição deve ser idempotente. A V1 não foi corrigida nesta iniciativa.

## 8. Conflitos de schema documentados

| Conflito | Código | Documentação | Ação proposta |
| --- | --- | --- | --- |
| Schema local | `DEFAULT_SCHEMA_VERSION=12` | README “v1→v11”; sync-contract exemplos 9 e 7 | ADR + matriz de migração F1 |
| IndexedDB | `DB_VERSION=7` | `app-overview.md` diz versão 6 | Corrigir doc ou registrar migração |
| Backup | Export grava 12; `validateBackupPayload` aceita qualquer número truthy | Fixture usa 9 | Validador de backup versionado na V2 |
| Firestore | `version=1` e schemaVersion 12 | Exemplo schemaVersion 9 | Contrato F1 + teste de envelope |
| Tombstones | `state.syncTombstones` | Contrato/arquitetura usa `config.entityTombstones` | ADR de contrato de sync |
| `state.revisoes` | Sem produtor ativo | Aparece em docs/estado legado | Marcar legado/quarentena na migração |

## 9. Rastreabilidade D01–D27 + A-01

| Decisão | Evidência F0 | Situação |
| --- | --- | --- |
| D01 V2 independente | Inventário APP-SHELL/LEGACY-FACADES; nenhum código V2 criado | Respeitada |
| D02 auditoria + redesign seletivo | 46 destinos PROPOSTOS; nenhum aprovado | Pendente de aceite |
| D03 Web/PWA | F-V1-PWA-OFFLINE; R-V1-SW-STALE-SHELL | Auditada |
| D04 local-first/sync único | F-V1-PERSISTENCE-INDEXEDDB, F-V1-FIRESTORE-SYNC | Auditada |
| D05 modelo canônico | 37 registros de schema e relações | Parcial: docs divergem |
| D06 sync manual/opcional | F-V1-SYNC-CENTER; `globalSyncPaused`; locks | Auditada |
| D07 Firebase por adaptadores | F-V1-FIRESTORE-SYNC UNCERTAIN; rules por UID | Não verificada em runtime |
| D08 merge conservador | Tombstones, R-V1-LEGACY-REMOTE-PLAN, R-V1-BACKUP-TOMBSTONE-LOSS | Risco aberto |
| D09 migração progressiva | B-V1-MIGRATION NOT_RUN; conflitos de schema | Pendente |
| D10 UX com identidade | Design baseline 15/20; 8 temas AA | Auditada |
| D11 React/TS/Vite | Nenhum scaffold criado | Respeitada |
| D12 estado modular | Facades legadas e namespace global inventariados | Insuficiente para V2 |
| D13 monólito modular | 24 domínios inventariados; sem fronteiras V2 | Proposta F1 |
| D14 QA por risco | 11 linhas de baseline; 66 testes F0 | Executada |
| D15 fundação + fatias | Proposta F1 abaixo | Não autorizada |
| D16 controle de escopo | Diff restrito a auditoria | Verificado |
| D17 local sem login/nuvem autenticada | F-V1-FIRESTORE-SYNC, rules `uid` | Parcial |
| D18 recuperação em camadas | Backup, clearData, tombstones | Riscos abertos |
| D19 PWA versionada | SW e cache inventariados | Não homologada |
| D20 observabilidade local | F-V1-SYNC-DIAGNOSTICS CODE_ONLY, sem teste | Lacuna |
| D21 homologação progressiva | Gate READY_FOR_HUMAN_REVIEW | Respeitada |
| D22 custo zero/isolamento | Mock local; nenhum billing/rede paga | Verificado |
| D23 sessões duráveis/FSM | F-V1-TIMER-POMODORO; R-V1-TIMER-REFRESH-LOSS | Não testada em runtime |
| D24 contratos/adaptadores | Schemas e canais mapeados | Parcial |
| D25 architecture as code/ADR | Validadores e gate; conflitos documentados | ADRs propostas |
| D26 armazenamento por criticidade | IndexedDB, quota, clearData | Risco médio |
| D27 modelo temporal | Calendário, ciclo, Reta Final inventariados; sem teste de fuso/DST | Lacuna |
| A-01 Impeccable | Executado; 162 achados; P1 de toasts | Executado, não aprovado |

## 10. Proposta para F1 (não autorizada)

1. Aprovar os 46 destinos ou marcar explicitamente os que ficam em `UNDECIDED`.
2. Fechar ADRs dos conflitos schema 12/11/9/7, DB 7/6, backup e tombstones.
3. Especificar a árvore V2 isolada e a fronteira de publicação, sem tocar na V1.
4. Definir contratos de IndexedDB, outbox, sync e backup com testes de falha.
5. Orçar payload Firestore abaixo de 1 MiB e testar conflito/legado com fixtures sintéticas.
6. Definir critérios de Impeccable para F1: corrigir toasts, ramp tipográfico e tokens; 8 temas AA.
7. Só iniciar React/TS/Vite após spec e plano F1 aprovados e aceite humano da F0.

## 11. Git, isolamento e pendências

- `main` permaneceu em `9046cfa`; nenhum commit, merge ou push foi feito nela.
- `v2` recebeu o merge de referência `689a9f4` e os commits de auditoria; `origin/v2` foi atualizado com esses commits (HEAD final registrado no comentário da issue #108).
- Worktree isolado: `C:\\Users\\slvma\\.codex\\worktrees\\v2-f0-audit\\estudo-organizado`.
- PRs abertos: nenhum. Nenhum PR novo foi criado.
- Comentário de evidências publicado na [issue #108](https://github.com/matheussilva421/estudo-organizado/issues/108#issuecomment-6469616597).
- Branches documentais antigas continuam existindo e não foram removidas.
- Nenhum GitHub Action, pipeline, deploy, Firebase, Cloudflare, Drive ou dado real foi acessado.
- Pendências: E2E mock (107 falhas), verificação real de Firestore/Drive/Cloudflare, migração real, emulador de rules, testes de fuso, leitor de tela e zoom 200%.

## 12. Decisão do gate

O gate F0 está **READY_FOR_HUMAN_REVIEW**. As condições automáticas de inventário, cobertura, schemas, riscos e baseline estão satisfeitas; faltam:

1. aceite humano específico do relatório F0;
2. decisão sobre os 46 destinos propostos;
3. decisão sobre os quatro riscos HIGH e as ADRs de schema.

**Não declare F0 aprovada e não inicie F1 sem esse aceite.**
