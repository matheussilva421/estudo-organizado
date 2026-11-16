# Revisões independentes

Houve duas rodadas. A primeira revisou `e4339dd0`; a segunda revisou o estado de `6c0353bb` e encontrou P1 materiais, todos corrigidos antes deste fechamento. Nenhum P0 foi apontado.

## Rodada 1 — Arendt (visual/UX/evidências) e Aquinas (integridade/domínio)

- Arendt confirmou o status honesto e os quatro HIGH com mitigação local; corrigiu contagens e ordem de rollback. O E2E do revisor não iniciou por falha de preview; os números eram registros do autor.
- Aquinas apontou que `recognizeLegacyFormat`/`convertLegacyV1InIsolation` não tinham caller de produto. A correção foi falha fechada em `validateRemoteEnvelope`, não integração do adapter. O risco ficou rotulado como fail-closed/migração não integrada.
- A revisão foi estática; não reexecutou a suíte completa.

## Rodada 2 — Poincare (segurança/Firebase)

Veredito inicial: **REQUEST_CHANGES**, sem P0.

- **P1 corrigido:** update de entidade não comparava a revisão anterior; um cliente podia regredir revisão 5 para 1. As Rules agora exigem create com revisão 1 e update com `revision == resource.revision + 1`, epoch e entityType imutáveis.
- **P1 corrigido:** receipt, change, head e entidade não formavam uma transação íntegra. O change passou a carregar `operationId`; as Rules exigem que change e head coincidam com a entidade em entityId, revisão, tombstone, epoch e sequência, e que o receipt exista com o mesmo operationId, entidade, revisão e sequência. Testes cobrem entidade ausente, receipt ausente e epoch divergente.
- **P2 corrigido:** o teste de digest inválido deixou de ser falso positivo estrutural; agora envia a transação completa com digest inválido.
- **P2 residual:** `entityType` não é correlacionado ao receipt; tipos desconhecidos ainda falham no cliente. Fica documentado, sem nova tabela de tipos nas Rules.
- **P2 residual:** uma atualização isolada de entidade ainda pode ocorrer sem change/head na mesma transação; o impacto fica dentro do mesmo UID, mas o feed deixa de ser obrigatório para auditoria.
- **P3:** o documento pai da biblioteca usa allow read, write sem schema; não apaga subcoleções nem cruza UIDs.

## Rodada 2 — James (arquitetura/regressão/documentação)

Veredito inicial: **REQUEST_CHANGES**, sem P0.

- **P1 corrigido:** o rollback não distinguia `e2164e3f` de `e4339dd0`/`ccf03457`. Agora há dois alvos explícitos, com os oito commits anteriores ao documental e o aviso de que reverter reintroduz Rules permissivas.
- **P1 corrigido:** “60 testes em 9 arquivos” era falso; a contagem é **78 em 10**. O comando de reprodução agora inclui `f7-remote-schema` e `f7-v1-migration`.
- **P2 corrigidos:** base de “193” rotulada como `origin/v2`; “476” como `main`; “8 commits desde e2164e3f” separado; escopo do delta de UX esclarecido; teste de idempotência renomeado (é sequencial, não corrida real); garantia de outbox sob quota deixada como não provada; `PASS_VERIFIED` trocado por `PASS_LOCAL_VERIFIED`; R-09 aponta o arquivo E2E; logs têm caminho; o bundle anterior tem hash verificado; o bundle final foi verificado em clone e seu hash fica em BUNDLE.txt.

## Verificação do autor

No HEAD `6c0353bb`: typecheck, lint, 881/881 unitários, 253 E2E (248 PASS, 5 SKIP, 0 FAIL), 17/17 no emulador e capturas 3/3 + 1/1. As revisões foram estáticas; não reexecutaram a suíte completa.
