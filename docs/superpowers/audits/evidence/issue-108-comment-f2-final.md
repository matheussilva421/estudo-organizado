## F2 — fechamento do GOAL final (P1/P2)

HEAD da `v2`: `5c2b27d`. `main` segue em `9046cfa`. Nenhum PR aberto.

### Correções desta rodada

| Item | Correção | Prova |
| --- | --- | --- |
| **P1 conflitos** | Decisão sobre conflito obsoleto é recusada (`RESOLUTION_STALE`) comparando a revisão local atual com a do `localPayload`; `KEEP_LOCAL` grava conteúdo + `RESOLVED` na **mesma** transação; `ACCEPT_REMOTE` de tombstone delega ao `SOFT_DELETE` (sem upsert outbound) e o de payload valida tombstones, escopo, pais e vínculos antes do `put`, também atômico com a marcação; replay da mesma decisão é idempotente e decisão divergente falha | 11 testes: stale, replay, divergente, exclusão remota, falha no meio mantendo `OPEN`, referência órfã |
| **P1 gate de envio** | `FlushOptions.canSend` obrigatório; `flushPending` falha fechado — sem autorização explícita nada alcança `remote.apply` | chamada sem gate + 50 E2E verdes com autorização real no harness |
| **P2 recibos** | Recibo guarda `entityRevisions`; replay só é no-op se nada foi apagado **ou editado** depois; divergência devolve `IMPORT_ALREADY_APPLIED_BUT_DIVERGED` com `missing`/`changed` e preserva a edição | 10 testes de importação |
| **Desempenho** | 1.249 disciplinas (**4.997 criações**) no Chromium: **529 ms**, recibo único; acima do teto recusado antes de escrever | `f2-import-max.spec.ts` |

### Gates (logs completos em `docs/superpowers/audits/evidence/2026-10-29-v2-f2-final-goal-*.txt`)

typecheck PASS · lint PASS · unit **188/188** · E2E **50/50** · build PASS.

### Documentação

Relatório com §12 desta rodada; seção de riscos separa **(histórico)** F0/V1 das pendências atuais; o corpo da issue #108 deixou de afirmar que a execução F2 não foi comprovada.

### Pendências por fase

Reconciliação de revisão importada e recibo dentro do backup (F7); unificação dos motores de commit (F3/F7); staging de importação (não autorizado); Firebase/Rules/quota, multi-dispositivo físico e Impeccable (**NOT_RUN**, F7); quatro riscos HIGH (**UNVERIFIED**); `F2-T22` **NOT_RUN**. Revisão independente desta rodada não executada por limite de threads — registrado no relatório.

**Parecer: `F2_READY_FOR_HUMAN_REVIEW`.** Sem aceite humano e sem F3.

