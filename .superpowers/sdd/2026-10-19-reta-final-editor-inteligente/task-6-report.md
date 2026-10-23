# Task 6 — Rascunhos recuperáveis em IndexedDB

Data: 2026-10-20
Branch: `codex/reta-final-editor-fase-a`
Base desta continuação: `36e38494617fb4c97d23d83eb69dc5096006cf72`
Commit solicitado: `feat(reta-final): persist isolated drafts`
Push: não realizado, conforme instrução.
Status GitHub: alterações comprometidas localmente nesta branch; sem push.

## Resultado

O banco `EstudoOrganizadoDB` sobe de `DB_VERSION=6` para `DB_VERSION=7` em seu `onupgradeneeded` existente. O upgrade cria, quando ausentes, `reta_final_drafts` com `keyPath: 'draftId'` e `reta_final_journal` com `keyPath: 'id'`. O facade `store.js` expõe as constantes e as operações de carregar, salvar e descartar rascunhos. O service worker inclui os dois novos módulos no precache.

Os rascunhos mantêm snapshot, operações e estado `editing` isolados de `state.planejamento`, `app_state`, eventos e sincronização remota. Salvar, carregar e descartar usam a instância IndexedDB fornecida e só resolvem depois de `tx.oncomplete`; erros de transação, abortos e quota rejeitam. O descarte atua somente sobre o rascunho. A store de journal foi criada, sem wiring de journal nesta tarefa.

## RED → GREEN

RED inicial da integração:

- `npx vitest run tests/unit/reta-final-draft-store.test.js tests/unit/store-indexeddb-imports.test.js --reporter=dot` — 2 arquivos; 19 testes; 17 passaram e 2 falharam. Falha esperada: versão observada 6 em vez de 7 e ausência dos dois object stores e constantes públicas.

RED expandido, incluindo exposição do facade e contrato observado no boot:

- `npx vitest run tests/unit/reta-final-drafts.test.js tests/unit/reta-final-draft-store.test.js tests/unit/store-indexeddb-imports.test.js tests/unit/store-migrations.test.js --reporter=dot` — 4 arquivos; 55 testes; 49 passaram e 6 falharam pelas lacunas esperadas de versão, stores, exports e expectativa de migração.

GREEN focado, depois da implementação e da padronização de aspas:

- `npx vitest run tests/unit/reta-final-drafts.test.js tests/unit/reta-final-draft-store.test.js tests/unit/store-indexeddb-imports.test.js tests/unit/store-migrations.test.js tests/unit/store-boot-failure.test.js --reporter=dot` — 5 arquivos; 57/57 testes passaram.
- `npx vitest run tests/unit/reta-final-events.test.js tests/unit/reta-final-sync-eventos.test.js tests/unit/reta-final-quick-mark.test.js tests/unit/reta-final-associar.test.js tests/unit/reta-final-schema-v2.test.js tests/unit/reta-final-schedule.test.js tests/unit/reta-final-catalog.test.js tests/unit/reta-final-commands.test.js tests/unit/reta-final-core.test.js tests/unit/reta-final-rollover.test.js tests/unit/logic-cycle-imports.test.js tests/unit/store-indexeddb-imports.test.js tests/unit/store-migrations.test.js tests/unit/store-boot-failure.test.js --reporter=dot` — 14 arquivos; 299/299 testes passaram.
- `npm test -- --maxWorkers=2 --reporter=dot` — 153 arquivos; 2,538/2,538 testes passaram, exit 0. Repetido após a última alteração de estilo, com os mesmos resultados.
- `npx eslint src/js/logic/reta-final-drafts.js src/js/store/reta-final-draft-store.js src/js/store/indexeddb.js src/js/store.js` — exit 0, sem avisos.
- `git diff --check` — sem erros.

Os testes do draft store simulam gravação visível apenas após completar a transação, quota (`QuotaExceededError`), abort/interrupção (`AbortError`), ausência de banco, reload por nova conexão, descarte isolado e persistência de operação. Os testes puros cobrem revisão/digest obsoletos, conflito de identidade e `operationId` duplicado idempotente ou conflitante. Esses cenários exercitam as funções reais do domínio e do draft store com callbacks transacionais controlados pelo helper de teste.

Uma tentativa de lintar também os arquivos de teste terminou em erro por globais ausentes na configuração ESLint do projeto (`global`, `process`, `DOMException` e `queueMicrotask`); o auto-fix aplicado foi apenas de aspas. O lint de produção acima passou depois disso, e os testes foram reexecutados.

## Arquivos

- `src/js/logic/reta-final-drafts.js` — criação pura, comandos isolados, diff, digest e validação/stale.
- `src/js/store/reta-final-draft-store.js` — transações de carregar/salvar/descartar.
- `src/js/store/indexeddb.js` — versão 7, constantes e criação condicional das stores.
- `src/js/store.js` — exposição das constantes e funções do facade.
- `src/sw.js` — precache dos módulos de draft.
- `tests/unit/reta-final-drafts.test.js` — contratos puros e idempotência.
- `tests/unit/reta-final-draft-store.test.js` — persistência e falhas transacionais.
- `tests/unit/reta-final-draft-idb-helper.js` — helper transacional para commit, reopen, quota e abort.
- `tests/unit/store-indexeddb-imports.test.js` — upgrade v7 e exports.
- `tests/unit/store-migrations.test.js` — expectativa de versão v7 no boot, sem alterar migração de estado.
- `.superpowers/sdd/2026-10-19-reta-final-editor-inteligente/task-6-report.md` — este relatório.

SHA-256 dos módulos novos:

| Arquivo | SHA-256 |
|---|---|
| `src/js/logic/reta-final-drafts.js` | `8fa695f315ceed404da07ef1176e50f603a23386041c4be89c0aee9fa498e04e` |
| `src/js/store/reta-final-draft-store.js` | `3bc06ebbffcd4e82f0b52fb97df51729014cb19b56edf07b5ac90addab72c47b` |

## Limites e retomada

Não foi executado E2E nem teste manual em navegador com IndexedDB nativo. O gate desta tarefa verifica o upgrade por callback de `initDB` e as transações através do helper controlado; persistência em browser real permanece para a cobertura de integração posterior. Não houve alteração em sync remoto, semântica de `state.planejamento`, boot migrations ou contratos públicos da Phase A.

Para retomar, confira `git status` e leia este relatório. O commit fica local na branch indicada; não houve push. Os próximos trabalhos devem reutilizar as duas stores existentes e não incrementar novamente `DB_VERSION`.

## Fix round 1 — upgrade real e shape checks

Revisão: veredito Needs fixes. O teste de upgrade chamava `onupgradeneeded` diretamente em um stub e encerrava com `onerror`, sem modelar uma abertura v6 nem a conclusão bem-sucedida do v7. A validação de forma também permitia que snapshots aninhados inválidos e operações nulas escapassem até `.find` ou `diffPlans`, causando exceções em vez de diagnósticos.

RED:

- `npx vitest run tests/unit/reta-final-drafts.test.js tests/unit/store-indexeddb-imports.test.js --reporter=dot` — 2 arquivos; 29 testes; 25 passaram e 4 falharam, exit 1.
- O draft sem `retaFinal.blocos` lançou `TypeError` em `diffPlans`; a operação nula lançou `TypeError` no `.find`; a validação retornou `DRAFT_SNAPSHOT_MISMATCH` em vez de `DRAFT_INVALID`; o helper ainda não expunha versão/open factory.

GREEN:

- O helper transacional agora aceita `version` e `keyPaths`, expõe `indexedDB.open`, registra as versões solicitadas e as stores criadas. O teste semeia as seis stores de v6, chama o `initDB` real, aguarda sucesso, confirma a solicitação v7, a transição 6→7, as duas únicas criações e seus key paths `draftId`/`id`.
- `npx vitest run tests/unit/reta-final-drafts.test.js tests/unit/store-indexeddb-imports.test.js --reporter=dot` — 2 arquivos; 29/29 testes passaram.
- `npx vitest run tests/unit/reta-final-drafts.test.js tests/unit/reta-final-draft-store.test.js tests/unit/store-indexeddb-imports.test.js tests/unit/store-migrations.test.js tests/unit/store-boot-failure.test.js --reporter=dot` — 5 arquivos; 61/61 testes passaram.
- `npx vitest run tests/unit/reta-final-events.test.js tests/unit/reta-final-sync-eventos.test.js tests/unit/reta-final-quick-mark.test.js tests/unit/reta-final-associar.test.js tests/unit/reta-final-schema-v2.test.js tests/unit/reta-final-schedule.test.js tests/unit/reta-final-catalog.test.js tests/unit/reta-final-commands.test.js tests/unit/reta-final-core.test.js tests/unit/reta-final-rollover.test.js tests/unit/logic-cycle-imports.test.js tests/unit/store-indexeddb-imports.test.js tests/unit/store-migrations.test.js tests/unit/store-boot-failure.test.js --reporter=dot` — 14 arquivos; 299/299 testes passaram.
- `npm test -- --maxWorkers=2 --reporter=dot` — 153 arquivos; 2,542/2,542 testes passaram, exit 0.
- `npx eslint src/js/logic/reta-final-drafts.js` — exit 0; `git diff --check` sem erros.

Os novos shape checks validam os snapshots-base e editado com `validateRetaFinalV2`, confirmam `retaFinal.blocos` e ids de blocos e validam entradas do journal de operações antes de `.find`, replay ou diff. Entradas malformadas retornam `DRAFT_INVALID` ou `DRAFT_OPERATION_INVALID` com índice, sem mutar o rascunho e sem aplicar nada.

Commit do fix: `4b90025bd4ea969035cdac8d5874d4c08900dbb8` (`fix(reta-final): harden draft store upgrade and shape checks`).

Arquivos do fix:

- `src/js/logic/reta-final-drafts.js` — shape checks aninhados e entradas de operação.
- `tests/unit/reta-final-draft-idb-helper.js` — factory `open` versionada, transição de schema e registros de stores criadas.
- `tests/unit/reta-final-drafts.test.js` — regressões de snapshot sem blocos, operação nula e entrada de comando nula.
- `tests/unit/store-indexeddb-imports.test.js` — abertura v6→v7 real via `initDB`, sucesso, key paths e exports.

Não houve push, alteração da versão do banco, mudança de API pública ou nova alteração de boot/migração de estado.

## Fix round 2 — sparse arrays

Revisão: veredito Needs fixes. A checagem de forma percorria operações com `forEach` e blocos com `some`; ambos pulam índices ausentes em arrays esparsos. Um buraco podia escapar até o `find`/`Map`, causando exceções em vez de diagnóstico.

RED:

- `npx vitest run tests/unit/reta-final-drafts.test.js --reporter=dot` — 1 arquivo; 21 testes; 18 passaram e 3 falharam, exit 1.
- `append` lançou ao ler uma operação esparsa; blocos esparsos lançaram durante a construção do `Map`; a validação com blocos esparsos retornou `DRAFT_SNAPSHOT_MISMATCH` em vez de `DRAFT_INVALID`. O cenário de validação de operações esparsas já retornava bloqueado e foi mantido como regressão.

GREEN:

- `snapshotShapeError` e `operationShapeErrors` agora percorrem cada índice explicitamente e usam `Object.prototype.hasOwnProperty.call` antes de acessar o valor. Buracos retornam `DRAFT_INVALID` ou `DRAFT_OPERATION_INVALID` com o índice, antes de `.find`, replay, `Map` ou `diffPlans`.
- `npx vitest run tests/unit/reta-final-drafts.test.js --reporter=dot` — 1 arquivo; 21/21 testes passaram.
- `npx vitest run tests/unit/reta-final-drafts.test.js tests/unit/reta-final-draft-store.test.js tests/unit/store-indexeddb-imports.test.js tests/unit/store-migrations.test.js tests/unit/store-boot-failure.test.js --reporter=dot` — 5 arquivos; 65/65 testes passaram.
- `npx vitest run tests/unit/reta-final-events.test.js tests/unit/reta-final-sync-eventos.test.js tests/unit/reta-final-quick-mark.test.js tests/unit/reta-final-associar.test.js tests/unit/reta-final-schema-v2.test.js tests/unit/reta-final-schedule.test.js tests/unit/reta-final-catalog.test.js tests/unit/reta-final-commands.test.js tests/unit/reta-final-core.test.js tests/unit/reta-final-rollover.test.js tests/unit/logic-cycle-imports.test.js tests/unit/store-indexeddb-imports.test.js tests/unit/store-migrations.test.js tests/unit/store-boot-failure.test.js --reporter=dot` — 14 arquivos; 299/299 testes passaram.
- `npm test -- --maxWorkers=2 --reporter=dot` — 153 arquivos; 2,546/2,546 testes passaram, exit 0.
- `npx eslint src/js/logic/reta-final-drafts.js` — exit 0; `git diff --check` sem erros.

Commit do fix: `79bc09d79ace155f6f2a4679a0c1f32c41d3752d` (`fix(reta-final): reject sparse draft arrays`).

Arquivos do fix:

- `src/js/logic/reta-final-drafts.js` — loops e checagens de índice próprio para operações e blocos.
- `tests/unit/reta-final-drafts.test.js` — regressões de operações e blocos esparsos em append/validate.

Sem push, alteração de API pública, versão de banco ou comportamento de migração.
