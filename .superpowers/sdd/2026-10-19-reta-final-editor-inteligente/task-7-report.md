# Task 7 — commit local durável, revisão e concorrência

- Data: 2026-10-20
- Worktree: `C:\Users\slvma\.codex\worktrees\reta-final-fase-a\estudo-organizado`
- Branch: `codex/reta-final-editor-fase-a`
- Base confirmada: `5b581fa` (Task 6 aceita)
- Commit solicitado: `feat(reta-final): commit editor changes atomically`
- Push: não realizado, conforme instrução.

Status: **DONE**

## Resultado

`commitRetaFinalDraft` valida a identidade e a revisão do plano, o snapshot/digest-base e o rascunho persistido dentro de uma transação `readwrite` que abrange `app_state`, `reta_final_drafts` e `reta_final_journal`. A gravação do envelope atual/anterior/legado, do marcador `applied`, do checkpoint e da intenção local de sync acontece na mesma transação. O resultado e as notificações de estado só são publicados depois de `tx.oncomplete`; falhas e abortos rejeitam sem publicar sucesso.

O commit incrementa a revisão uma vez, grava um `updatedAt` UTC e retorna `localCommitted: true` e `syncPending: true`. A intenção fica local no journal; esta tarefa não executa sync remoto nem altera o motor de sync. Repetir um draft aplicado é idempotente. Duas conexões tentando gravar drafts da mesma base produzem um único vencedor e um `RETA_FINAL_STALE`.

A reconstrução de eventos preserva todo o histórico estudado e parcial, incluindo `tempoAcumulado`, questões, revisões, páginas e vínculos. Só cria auto-evento para bloco separado sem ocupação; títulos são resolvidos com o catálogo do snapshot. O teste dedicado confirma que os eventos de `rf-1` e `rf-partial` permanecem intactos e que só `rf-unoccupied` recebe novo auto-evento.

O schema do banco permaneceu em `DB_VERSION=7`, com as stores criadas na Task 6. Não houve alteração destrutiva ou substituição da API de drafts da Task 6.

## RED → GREEN

O RED inicial foi reproduzido com:

```text
npx vitest run tests/unit/reta-final-commit.test.js --reporter=default
13 testes: 3 passaram, 10 falharam; exit 1.
Falha principal: ReferenceError: eventos is not defined em buildCommittedSnapshot.
Os demais casos de commit, rollback e concorrência também eram interrompidos antes da persistência.
```

Depois de corrigir o nome da variável no snapshot, o foco revelou os problemas seguintes:

```text
13 testes: 7 passaram, 6 falharam; exit 1.
O envelope current perdia validade de checksum porque o objeto do plano continha eventos: undefined, removido pela serialização do harness. A recuperação então lia a revisão previous, permitindo duas vitórias concorrentes. A injeção de quota também consultava/excluía a chave de store errada.
```

As correções removeram a chave inválida do plano e fizeram o helper transacional localizar e limpar falhas pela store associada à operação. A fila `readwrite` do helper mantém a ordem entre conexões e só publica os writes staged ao concluir a transação.

Verificação final do foco e das regressões:

```text
npx vitest run tests/unit/reta-final-commit.test.js tests/unit/duplicate-exports.test.js tests/unit/store-indexeddb-imports.test.js tests/unit/store-migrations.test.js tests/unit/store-boot-failure.test.js tests/unit/store-reta-final-sync.test.js tests/unit/reta-final-events.test.js tests/unit/reta-final-rollover.test.js tests/unit/reta-final-quick-mark.test.js tests/unit/reta-final-associar.test.js --reporter=default
10 arquivos passaram; 98/98 testes passaram; exit 0.
```

Essa matriz cobre os 13 casos do commit, incluindo idempotência, CAS concorrente, quota/abort nas três stores, reopen, intenção opcional de catálogo e preservação do histórico; além de imports/upgrade, migrações, boot, sync e regressões de eventos, rollover, marcação rápida e associação.

A primeira execução da suíte completa após a implementação teve 2.558/2.559 testes aprovados. O único caso falhou porque o contrato de módulos exige documentar wrappers intencionais; foi incluída uma entrada específica na allowlist de exports duplicados para a implementação transacional, a facade do store e a facade lógica que injeta contexto. A suíte completa foi repetida depois dessa correção:

```text
npm test -- --reporter=dot
154 arquivos passaram; 2.559/2.559 testes passaram; exit 0.
```

Lint final dos módulos de produção:

```text
npx eslint src/js/logic/reta-final.js src/js/store.js src/js/store/indexeddb.js src/js/store/reta-final-commit.js
Exit 0, sem erros ou avisos.
```

`git diff --check` terminou sem erros. O Git avisou apenas que o arquivo do helper está em LF e pode ser convertido para CRLF pelo Git no próximo checkout.

## Arquivos

- `src/js/store/reta-final-commit.js` — transação atômica, validação/CAS, snapshot, reconstrução de eventos, checkpoint e intenção local.
- `src/js/store.js` — facade pública que vincula o DB e publica o estado após o commit durável.
- `src/js/store/indexeddb.js` — notificação pós-commit; `DB_VERSION` continua 7.
- `src/js/logic/reta-final.js` — wrapper lógico que fornece data, timestamp e gerador de IDs.
- `tests/unit/reta-final-commit.test.js` — contratos de sucesso, stale, concorrência, rollback, reopen, eventos e catálogo.
- `tests/unit/reta-final-draft-idb-helper.js` — fila readwrite, commit gate e falhas de quota por store no harness transacional.
- `tests/unit/duplicate-exports.test.js` — documentação da delegação intencional entre as três camadas.
- `.superpowers/sdd/2026-10-19-reta-final-editor-inteligente/task-7-report.md` — este handoff.

## GitHub, validação manual e retomada

O trabalho está na branch local `codex/reta-final-editor-fase-a`, com base em `5b581fa`. O fechamento foi registrado em commit local com a mensagem indicada no topo. O GitHub remoto não foi alterado; não houve push. O hook pre-commit faria bump automático do cache ao detectar mudanças em `src/`; `SKIP_CACHE_BUMP=1` evita adicionar os arquivos gerados fora do escopo desta tarefa.

Não foi feito teste manual de navegador nem smoke com IndexedDB nativo; a validação desta tarefa usa o código real com o harness de transação controlada e a suíte unitária/regressiva descrita acima. Os logs stderr de `503`/`409`, notificações indisponíveis e budget de UI da suíte completa vêm de cenários simulados; o comando terminou com exit 0.

Task 7 concluída; Task 8 não iniciada. Para retomar depois, confira branch/HEAD e leia `task-8-brief-extra.md` antes de qualquer novo escopo. O checkout não contém `.ai/CURRENT.md`, `.ai/RECOVERY.md` nem um caminho `pending.json` informado pelo hook SessionStart; a branch e o HEAD observados nesta retomada coincidiram com a autoridade fornecida pelo usuário.
