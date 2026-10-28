## F2 — GOAL corretivo C1–C7 aplicado

O pacote corretivo descrito pelo ChatGPT foi executado na `v2`. HEAD: `14e54df` + o commit de documentação desta atualização. `main` segue em `9046cfa`.

### C1–C7, com prova

| Item | Correção | Prova |
| --- | --- | --- |
| C1 | UI envia `baseRevision` (renomear/arquivar/principal) e `StudySubject` ganhou CAS opcional; a base é capturada ao abrir o editor | E2E com **controles reais de duas abas**: aba obsoleta recebe `CONFLICT`, mantém o texto digitado e não sobrescreve |
| C2 | Draft só é limpo em `LOCAL_COMMITTED`; estado `busy`; escrita travada em `BLOCKED_UPGRADE` e edital arquivado | E2E de quota preservando o texto, retry após remover a falha e arquivado somente leitura |
| C3 | Replay divergente → `IMPORT_ALREADY_APPLIED_BUT_DIVERGED`; importação consulta tombstones; quarentena persistida; recibo guarda `entityIds`; namespace escolhido na UI | 9 testes de importação + E2E de import/UI |
| C4 | `UNLINK_LESSON_TOPIC` exige `baseRevision` e grava tombstone/epoch; deleção remota (`ACCEPT_REMOTE`) delega ao `SOFT_DELETE` | 7 testes de delete/restore |
| C5 | Backup F2 seguro por padrão: completude declarada, epoch sem tombstone = `REBASELINE`, `currentEpoch` validado, colisão por `profileId+entityType+entityId`, payload F1 com cabeçalho F2 recusado, tokens removidos | 12 testes de backup |
| C6 | `sequence` monotônica por perfil e entrega ordenada; `flushPending.canSend` recusa operação fora do gate; notificação entre abas após commit durável | testes de retry/ordem + E2E |
| C7 | `--control-border` por tema com **≥3:1 medido** nos oito temas, foco devolvido ao gatilho, `aria-label` com título+índice, alvo 44 px | `f2-a11y` (8 temas medidos) e `f2-import-max` |

### Carga máxima de importação

1.000 disciplinas (≈4.001 criações) no Chromium: commit único em **414 ms**, recibo único. Acima do teto é recusado antes de qualquer escrita. É desktop, não aparelho modesto.

### Gates (logs completos em `docs/superpowers/audits/evidence/2026-10-28-v2-f2-c-goal-*.txt`)

typecheck PASS · lint PASS · unit **181/181** · E2E **50/50** · build PASS.

### O que continua aberto, por fase

Reconciliação de revisão importada e recibo dentro do backup (F7); `ACCEPT_REMOTE` de payload não deletado fora do repositório e unificação dos três motores de commit (revisão arquitetural/F3); staging de importação (não autorizado); Firebase/Rules/quota reais, multi-dispositivo físico e Impeccable (**NOT_RUN**, F7); quatro riscos HIGH (**UNVERIFIED**). `F2-T22` segue `NOT_RUN`.

**F2 não está aprovada nem homologada.** O gate `F2_READY_FOR_HUMAN_REVIEW` é uma recomendação técnica; a decisão é humana e a F3 não foi iniciada.

