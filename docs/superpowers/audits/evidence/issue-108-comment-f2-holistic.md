## F2 — correções da revisão holística aplicadas (atualização do pacote)

O HEAD da `v2` avançou de `cca624b` para `a08d9a5` depois de uma revisão holística independente que encontrou **5 P1** adicionais. Todos foram corrigidos com teste focal novo:

| Achado | Correção |
| --- | --- |
| `targetSignature` dependia da ordem dos arrays → a **segunda** importação em perfil populado era recusada como `IMPORT_STALE_PREVIEW` | assinatura passa a ordenar cada coleção por `id`; teste com duas importações sequenciais |
| Importação reutilizava disciplina por nome, contrariando E-F2-05 | sempre cria um subject próprio; o candidato homônimo fica apenas como ambiguidade visível |
| Irmãos homônimos (“Revisão”, “Aula 1”) colapsavam no mesmo ID determinístico e perdiam entidades | caminho determinístico inclui o índice de ocorrência; recibo e banco passam a coincidir |
| Edital arquivado não era consultável após reload | título arquivado selecionável, com aviso de somente leitura; E2E cobre reload + consulta da árvore |
| Prova de consentimento não estava amarrada ao `uid` do argumento | `assertDeliveryConsent` exige `proof.uid` e `proof.remoteLibraryId` iguais aos do chamador |

Também corrigidos nesta rodada: commit agora **recusa** prévia com qualquer conflito (revisão divergente, alvo arquivado, lote acima do teto); o teto conta os `creates` efetivos e não só o que foi lido; `hasUnsafeKey` virou iterativo (JSON hostil profundo não derruba a prévia); `recordCount` do backup F2 é conferido; token CSS `--muted` inexistente corrigido para `--text-muted`.

### Gates finais agora

| Gate | Resultado |
| --- | --- |
| typecheck | PASS |
| lint | PASS |
| unit | PASS **168/168** (29 arquivos) |
| E2E | PASS **45/45** (20 F1 + 25 F2) |
| build | PASS (292,30 kB / 87,22 kB gzip) |

### O que continua aberto (registrado no relatório)

Reconciliação de revisão divergente, replay por recibo após deleções, importação fora do protocolo de tombstones/quarentena, ausência de `baseRevision` nas mutações da UI, falta de evento local entre abas, bloqueio de upgrade só no formulário de disciplina, duplo clique sem estado de envio, nomes acessíveis repetidos em títulos homônimos, contraste da borda dos controles (~1,2–1,4:1) com detector AA `NOT_RUN`, outbox sem `sequence` causal, `flushPending` sem gate próprio, `ACCEPT_REMOTE` fora do repositório de conteúdo e backup F2 sem recibos/outbox.

**`F2-T22` segue `NOT_RUN`; os quatro riscos HIGH seguem `UNVERIFIED`; F2 não está aprovada nem homologada.** O pacote atualizado está em [`docs/superpowers/audits/2026-10-28-v2-f2-acceptance.md`](https://github.com/matheussilva421/estudo-organizado/blob/v2/docs/superpowers/audits/2026-10-28-v2-f2-acceptance.md).

