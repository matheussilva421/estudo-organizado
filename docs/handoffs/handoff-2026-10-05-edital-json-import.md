# Handoff — Issue #100: Importação de Edital via JSON

**Data:** 2026-10-05
**Branch:** `codex/issue-100-edital-json-import`
**Base sincronizada:** `e2b90ef96786ca908b563c0ad9e7b87cd034dfd1`
**Issue:** [#100](https://github.com/matheussilva421/estudo-organizado/issues/100) — aberta

## Objetivo e fontes

Implementar o importador especializado de edital JSON conforme a spec aprovada em `9b3d5ca6e758eb18a230296e38917187e7bce2f7` e o plano em `e2b90ef96786ca908b563c0ad9e7b87cd034dfd1`. Ambos foram lidos integralmente após fast-forward da `main`. A spec é a autoridade de comportamento; o plano organiza sete tarefas.

## Trabalho concluído

- Sincronizei a `main` de `f44dc85` para `e2b90ef` por fast-forward e criei a branch dedicada.
- Task 1: implementei o core puro com validação do schema `tipo: "edital"`, versão 1, normalização de nomes, canonicalização de duplicatas dentro do JSON, identidade/fingerprint de proveniência e candidatos separados por estado ativo/arquivado.
- Task 2: implementei matching 0/1/2+ no destino explícito, import plan com conflitos/summary e assinatura seletiva para stale preview.
- Task 3: implementei apply aditivo, construção imutável, stale guard, preservação de progresso, principal único, metadados e idempotência no merge.
- Task 4: implementei seleção local de JSON, validação e preview, escolha explícita de destino, confirmação atômica de `state.editais`, avisos de preservação, CSS responsivo e precache offline.
- Task 5: registrei a action `open-edital-import`, expus Importar Edital no topbar e nos empty states, mantendo Criar/Novo Edital.
- Correção adicional da Task 4: o preview agora apresenta revisões anterior/atual para proveniência compatível e descarta o draft ao cancelar/fechar.
- Task 6: nove cenários E2E Playwright cobrem preview/choice, create arquivado e como principal, fallback sem principal, merge com preservação de progresso, conflito de disciplina, schema inválido, idempotência, create repetido e importação offline com persistência.

## Arquivos alterados nesta fase

- Criados: `src/js/logic/edital-import-core.js`, `tests/unit/edital-import-core.test.js`.
- Criado para continuidade: este handoff.
- Tasks 2–3 também modificaram core e testes unitários.
- Task 4 criou `src/js/views/edital-import.js`, `src/css/views/edital-import.css`, `tests/unit/edital-import-view.test.js` e modificou `src/css/views.css` e `src/sw.js`.
- Task 5 modificou `src/js/ui/actions/editais.js`, `src/js/components.js`, `src/js/views/editais-view.js`, `tests/unit/editais-actions.test.js`, `tests/unit/editais-view-render.test.js` e `tests/unit/components.test.js`.
- A correção adicional da Task 4 alterou `src/js/views/edital-import.js`, `src/css/views/edital-import.css` e `tests/unit/edital-import-view.test.js`.
- Task 6 criou `tests/e2e/edital-import.spec.js`; a correção offline modificou `src/sw.js` e `tests/unit/sw-fetch-routing.test.js`.
- O hook atualizou `src/sw.js`, `src/index.html`, `src/js/sync/sync-diagnostic.js` e `tests/unit/css-architecture.test.js` para os bumps `9.23 → 9.24 → 9.25 → 9.26 → 9.27 → 9.28 → 9.29 → 9.30`.

## Decisões técnicas

- A identidade usa `centralId` > `sourceRef` > nome normalizado; `sourceRevision` não compõe o fingerprint.
- Candidatos são devolvidos todos, em ordem de estado, sem seleção automática; arquivados ficam numa lista separada.
- Canonicalização mantém a primeira grafia e ordem, une filhos e preserva propriedades de proveniência/campos extras.
- `applyEditalImport` resolve o estado atual pelo plano e devolve uma nova lista; entidades reutilizadas preservam todas as propriedades e progresso. Somente `importMetadata` do edital destino é atualizado no merge.
- IDs e objetos novos são construídos antes do retorno; stale ou erro de `uid()` não modifica a entrada. Create como principal arquiva todos os editais então ativos; sem principal ativo, o importado é forçado como principal.
- O plano de preview é profundamente congelado; matching de merge é idempotente e create repetido continua deliberadamente permitido.
- O seletor de merge lista todos os editais ativos; nomes/proveniência apenas marcam sugestões e editais arquivados são exibidos informativamente, sem opção de destino.
- A UI deixa confirmação desabilitada até uma escolha explícita. A confirmação chama o apply sobre o estado atual, e somente depois substitui `state.editais`, invalida caches, agenda salvamento, fecha e renderiza.
- Ao fechar/cancelar o preview sem confirmar, o draft é descartado e o botão de abrir importador é restaurado. Se um candidato ativo compartilha proveniência, o preview mostra as revisões anterior e atual.
- O teste offline reproduziu que o service worker precacheava `edital-import.js` com query da versão PWA, enquanto o import ES mantém `?v=8.37`; o módulo não carregava offline. O SWR agora tenta primeiro o request exato e depois `cache.match(request, { ignoreSearch: true })`, mantendo a revalidação de rede e servindo o asset precacheado quando a conexão cai.
- A action é um import dinâmico awaitable com o import specifier exigido `../../views/edital-import.js?v=8.37`; o topbar só mostra Importar Edital fora do dashboard de disciplina.
- `core.hooksPath` é `.githooks`; o pre-commit incrementa cache automaticamente para assets staged de `src/`. `APP_VERSION` na base é `9.23`; o mecanismo troca apenas essa versão e não os imports congelados `?v=8.37`.
- O helper SDD distribuído é Bash-only e falhou ao iniciar no sandbox Windows (`Win32 error 5` ao criar signal pipe); o workspace/brief/ledger foram preparados equivalentemente em PowerShell e cruzados com o plano.

## Testes e validações

- RED inicial: `npx vitest run tests/unit/edital-import-core.test.js` falhou pela ausência esperada de `edital-import-core.js`.
- Canonicalização e proveniência: REDs nas funções ainda ausentes, seguidos de GREEN.
- Atual: `npx vitest run tests/unit/edital-import-core.test.js` — 1 arquivo, 20 testes aprovados.
- Lint focado `npx eslint src/js/logic/edital-import-core.js` — aprovado.
- Task 2: RED inicial de matching (11 falhas por funções ausentes); um GREEN intermediário detectou contagem de tópicos na chave errada, reproduzida isoladamente e corrigida; stale RED (8 falhas) confirmou assinatura inicial insuficiente.
- Pós-Task 2: `npx vitest run tests/unit/edital-import-core.test.js` — 1 arquivo, 42 testes aprovados; ESLint focado aprovado; `npm run bump:check` aprovado.
- Task 3: RED inicial — 42 testes existentes passaram e 4 testes de apply/freeze falharam pela ausência de `applyEditalImport` e congelamento do plano; após implementação, `npx vitest run tests/unit/edital-import-core.test.js` — 1 arquivo, 54 testes aprovados.
- Task 3: `npx eslint src/js/logic/edital-import-core.js tests/unit/edital-import-core.test.js` e `git diff --check` — aprovados. O caso adversarial confirmou que progresso atualizado depois do preview segue intacto, que stale não pede IDs, e que erro intermediário de `uid()` mantém o JSON de entrada byte-for-byte igual.
- Task 4 RED inicial: `npx vitest run tests/unit/edital-import-view.test.js` falhou por ausência esperada do módulo de preview; após implementação, `npx vitest run tests/unit/edital-import-view.test.js tests/unit/edital-import-core.test.js` — 2 arquivos, 68 testes aprovados.
- Task 4: `npm run test:css` — 1 arquivo, 45 testes aprovados; ESLint focado e `git diff --check` — aprovados.
- Task 5 RED: action ausente e botões ausentes; após correção do setup de navegação no teste do topbar, o RED isolado confirmou a falta do botão no estado correto. GREEN: `npx vitest run tests/unit/editais-actions.test.js tests/unit/editais-view-render.test.js tests/unit/components.test.js` — 3 arquivos, 75 testes aprovados.
- Task 5: lint focado nos módulos/action/render e nos testes de action/render — aprovado. `tests/unit/components.test.js` retorna 19 erros pré-existentes `global is not defined`; `git show HEAD:tests/unit/components.test.js | npx eslint --stdin --stdin-filename tests/unit/components.test.js` confirmou os mesmos 19 erros na base, sem erro novo.
- Correção Task 4 RED: dois testes falharam pelos comportamentos ausentes (revisões anterior/atual e descarte ao cancelar); GREEN: core+view `npx vitest run tests/unit/edital-import-view.test.js tests/unit/edital-import-core.test.js --reporter=dot` — 2 arquivos, 70 testes aprovados. `npm run test:css` — 45/45; ESLint focado — aprovado.
- Correção Task 4: `npm run bump:check` antes do commit apontou corretamente os assets novos; o pre-commit fez `9.28 → 9.29`. Pós-commit, `npm run bump:check` passou sem assets pendentes.
- Teste unitário de service worker: RED confirmou que um import `?v=8.37` recebia `undefined` quando só a versão atual estava no precache; após fallback `ignoreSearch`, `npx vitest run tests/unit/sw-fetch-routing.test.js --reporter=dot` — 1 arquivo, 6 testes aprovados, sem erro não tratado.
- Task 6: `npx playwright test tests/e2e/edital-import.spec.js --project=chromium --reporter=line --workers=1` — 9/9 passaram após o commit que elevou APP_VERSION a 9.30. Inclui browser offline com módulo dinâmico carregado do precache, FileReader local, save IndexedDB e reload com dados persistidos.
- E2E de merge comprovou que tópico concluído e aula estudada mantêm todos os campos/progresso após merge e reload; também comparou os demais domínios de estado protegidos, removendo apenas metadados técnicos do autosave (`localBackupAt` e `syncPerformance`).
- ESLint focado em `src/sw.js`, `tests/unit/sw-fetch-routing.test.js` e `tests/e2e/edital-import.spec.js` — aprovado; `git diff --check` — aprovado; `npm run bump:check` pós-commit — aprovado em 9.30.
- Gates finais: `npm run lint` — exit 0, 0 erros e 44 avisos preexistentes em outros módulos; `npm run test:design` — exit 0, 45/45 testes CSS e contraste AA em todos os temas; `npm run bump:check` — exit 0, nenhum asset pendente; `npm test` — exit 0, 145 arquivos e 2.332 testes aprovados; `npm run test:e2e:release` — exit 0, 158/158 testes aprovados.
- Comparação histórica: baseline em `e2b90ef` tinha 143 arquivos/2.258 testes e um erro não tratado no mock de Cache API de `sw-fetch-routing.test.js`. A cobertura desta feature completou o mock com `match`/`put`; no estado final, a suíte integral não tem erros não tratados.
- Execuções Vitest precisam de permissão para spawn do esbuild; sem isso o sandbox retorna `EPERM` antes de iniciar a suíte.
- Validação da UI feita pelos nove cenários Playwright e pelo release E2E; não foi feita uma sessão manual interativa separada.

## Revisão adversarial e critérios da spec

- Schema `tipo: "edital"`, `versao: 1`, parse e validação antes do preview: core unit tests e E2E de schema inválido.
- Preview não muta; confirmação exige escolha explícita entre merge e create: view unit tests e E2E.
- Matching normalizado 0/1/2+ restrito ao destino, com conflito criando novo item: core tests para edital/disciplina/tópico/aula e E2E para disciplina ambígua.
- Edital arquivado nunca é alvo; proveniência sugere/informa sem decidir; revisões anterior/atual aparecem; cancelar descarta o draft.
- Reutilização não recebe propriedades importadas: somente `importMetadata` do edital é atualizado no merge; objetos de tópico/aula reutilizados são preservados; unit e E2E com conclusão, revisões, anotações, estudo e progresso preservados.
- Atomicidade e stale guard: plano imutável; IDs/objetos são preparados antes do retorno; falhas/stale não substituem `state.editais`; testes confirmam zero escrita parcial.
- Eventos, histórico, hábitos, revisões, planejamento, Reta Final e preferências permanecem intactos. A única atribuição do orquestrador é `state.editais = applied.editais`; o save comum atualiza apenas seus metadados operacionais.
- Create é arquivado por padrão; promoção arquiva os ativos numa operação; sem ativo o novo é principal; merge repetido é idempotente; create repetido permanece permitido.
- Nenhum `setState(..., { merge: true })`, restore de backup, fuzzy matching, `Object.assign` ou spread do payload sobre entidades reutilizadas. `git diff` não removeu imports ES congelados `?v=8.37`.
- Offline validado com service worker controlando a página: o módulo dinâmico vem do precache mesmo com query congelada; FileReader e persistência local funcionam sem rede.

## GitHub e commits

- Issue #100 permanece aberta.
- Commit da Task 1: `36191534c0ad86be33a879b6bbfd30fc4d89445e` (`feat(edital-import): add pure validation and source identity`).
- Commit do handoff da Task 1: `c4fdbec` (`docs(handoff): record edital import task 1`).
- Commit da Task 2: `24fbc53400be755a277bda95e8c00e192bda3384` (`feat(edital-import): build safe import plans`).
- Commit da Task 3: `ecf95de` (`feat(edital-import): apply plans atomically`).
- Branch `codex/issue-100-edital-json-import` publicada em `origin` até `ecf95de`.
- Commit da Task 4: `b7646ff` (`feat(edital-import): add preview and atomic confirmation`).
- Branch `codex/issue-100-edital-json-import` publicada em `origin` até `b7646ff`.
- Commit da Task 5: `11e3299` (`feat(editais): expose JSON edital import`).
- Commit handoff Task 5: `f63a90a` (`docs(handoff): record edital import task 5`).
- Correção Task 4: `0362cbc` (`fix(edital-import): clear canceled previews and show revisions`), publicada em `origin`.
- Correção offline: `b3640cf` (`fix(pwa): serve frozen imports from versioned precache`), publicada em `origin`.
- E2E Task 6: `a84b317` (`test(edital-import): cover end-to-end import flows`), publicada em `origin`.
- Branch `codex/issue-100-edital-json-import` publicada em `origin`; o HEAD do fechamento está registrado no resumo final da sessão.

## Pendências e retomada

Implementação e validação concluídas. A branch está publicada. A issue #100 permanece aberta aguardando revisão/integração; nenhum PR foi criado e a issue não foi fechada nesta tarefa. Próximo passo: abrir/revisar PR e integrar a branch.

O ledger detalhado e os logs de teste ficam em `.superpowers/sdd/2026-10-05-edital-json-import/` (ignorado pelo Git). O `pending.json` do hook SessionStart não existe para o `CODEX_SESSION_ID` desta sessão; não reutilizei o arquivo de outra sessão.

## Revisão focada dos achados pós-implementação

**Data:** 2026-10-05
**Base desta revisão:** `6fa372fecbe659fac8f1cbee96395c19146f838c`
**Branch:** `codex/issue-100-edital-json-import`

- Proveniência em merge: `buildImportMetadata()` atualiza cada campo apenas com uma string válida; `null`, ausência e valores inválidos preservam o valor anterior, usando `null` somente quando ainda não havia valor. `lastImportedAt` sempre recebe o horário atual. No merge sem `centralId`/`sourceRef`, o fingerprint de fallback por nome não substitui um fingerprint persistido estável; um identificador estável novo continua atualizando o fingerprint calculado.
- Fechamento do preview: `closeModal()` emite `modal:beforeclose` quando o alvo suporta eventos DOM. O importador registra o cleanup nesse ciclo para `#modal-prompt`; com draft ativo limpa `draft` e restaura texto, classe, disabled e onclick. A confirmação usa o mesmo caminho. O handler global de Escape não foi alterado e continua fechando pelo `closeModal()` central.
- Isolamento dos outros consumidores: depois que não há draft de importação, fechar `#modal-prompt` deixa intactos texto, classe, disabled e onclick que outro consumidor configurou. O evento não interfere em objetos de modal usados como mocks sem `dispatchEvent`.
- TDD: RED inicial dos dois achados — 4 casos de proveniência e 1 de fechamento falharam; após a primeira correção, um RED com payload real sem proveniência revelou que o fingerprint derivado por nome ainda substituiria o anterior; a correção adicional fez esse caso passar. A primeira suíte completa também detectou 16 mocks de modal incompatíveis com uma chamada incondicional de `dispatchEvent`; a chamada agora é opcional e a suíte completa passou.
- Gates no HEAD `92c861d` / `APP_VERSION 9.32`: focused unit 77/77; lint 0 erros e 44 avisos preexistentes; design 45/45 e contraste AA em todos os temas; bump check sem assets pendentes; `npm test` 145 arquivos / 2.339 testes; `npm run test:e2e:release` 158/158. Todos concluídos após o bump do hook.
- Revisão adversarial: as mudanças de merge limitam-se a `importMetadata`; entidades reutilizadas, seus campos de progresso, matching, editais arquivados, stale guard e atomicidade não foram alterados. Nenhuma linha de import congelado `?v=8.37` foi alterada.
- Commits desta revisão: `ee6db69 fix(edital-import): preserve provenance on merge`; `92c861d fix(edital-import): clear draft on modal close`. A branch foi publicada no GitHub após os gates finais; nenhum PR foi criado e não houve merge para `main`.

## Revisão do PR #101 — idempotência em conflitos

**Data:** 2026-10-05
**PR:** [#101](https://github.com/matheussilva421/estudo-organizado/pull/101), aberto contra `main`; HEAD original `92f429058224621f6853beeb47aa6f378f60dedd`.

- A revisão adversarial identificou que uma importação com 2+ homônimos criava `CREATE_CONFLICT`, mas o merge repetido criava outro homônimo de novo. Isso quebrava a idempotência no mesmo destino.
- A correção conserva a classificação `create_conflict` e o aviso no preview. Itens criados recebem uma chave local de origem; ao reimportar e escolher explicitamente o mesmo destino, o plano reconhece o conflito já aplicado, preserva o item/progresso e não gera duplicata. O preview informa “Conflito já importado”.
- TDD: três regressões de core falharam antes da implementação (disciplina, tópico e aula conflitantes); o teste de view também falhou sem o rótulo de reimportação. Após a correção: core+view — 81/81.
- O apontamento de import do core sem query foi classificado como não funcional: o service worker precacheia o módulo e usa `ignoreSearch` para o fallback, e o código existente já tem imports internos sem query. Nenhuma query `?v=8.37` existente foi alterada.
- `core.hooksPath` confirmado como `.githooks`; o pre-commit atualiza automaticamente `APP_VERSION`/cache quando assets `src/` entram no commit.
- Estado neste checkpoint: PR #101 aberto, merge ainda não executado. O GitHub retornou `mergeable: true`, sem status checks e sem workflow runs para o HEAD consultado. Gates completos pós-correção, push do commit de correção, nova leitura dos checks, merge, verificação de `origin/main` e fechamento/comentário da issue #100 ainda pendentes.

## Revisão adversarial do fallback de identidade — 2026-10-05

- A revisão final detectou que `_editalImportSourceKey` usava o fingerprint derivado apenas do nome quando o JSON não informava `centralId` nem `sourceRef`. Dois payloads diferentes com o mesmo nome podiam ser confundidos como reimportação idempotente dentro de um conflito 2+.
- TDD RED: `npx vitest run tests/unit/edital-import-core.test.js -t "não reconhece payload diferente apenas pelo nome"` falhou porque o payload diferente recebeu `alreadyImportedId` da importação anterior.
- Correção focada: para reconhecer reimportações sem identidade estável, a chave usa uma representação canônica do conteúdo importável (nomes normalizados, listas ordenadas, sem revisão/proveniência variável). A identidade pública do edital e os metadados existentes permanecem inalterados. Marcadores privados são gravados somente em itens realmente criados como conflito; itens novos sem ambiguidade continuam idempotentes pelo matching 0/1 normal.
- GREEN focado: `npx vitest run tests/unit/edital-import-core.test.js tests/unit/edital-import-view.test.js` — 2 arquivos, 82/82.
- O pre-commit atualiza `APP_VERSION` e cache para os assets staged de `src/`; o commit desta correção e todos os gates finais precisam ocorrer depois desse bump.
- O release E2E de 158/158 e os demais gates já haviam passado no commit `aaf1663`; devem ser repetidos depois desta nova alteração. Não houve merge. PR #101 segue aberto e a issue #100 permanece aberta.

## Gates finais após correção de identidade — checkpoint de fechamento

- HEAD local validado: `d603d3c42db0ad5103895c8b486026a84552a369` (`fix(edital-import): distinguish name-only conflict sources`), com `APP_VERSION 9.34`.
- `npx vitest run tests/unit/edital-import-core.test.js tests/unit/edital-import-view.test.js`: 2 arquivos / 82 testes aprovados.
- `npm run lint`: 0 erros; 44 avisos já existentes em arquivos fora da feature.
- `npm run test:design`: 45/45 testes CSS; auditoria WCAG AA aprovada nos temas.
- `npm run bump:check`: sem assets pendentes.
- `npm test`: 145 arquivos / 2.344 testes aprovados.
- `npx playwright test tests/e2e/edital-import.spec.js --project=chromium --reporter=line --workers=1`: 9/9 aprovados.
- `npm run test:e2e:release`: 158/158 aprovados (4,3 min).
- `npx eslint src/js/logic/edital-import-core.js tests/unit/edital-import-core.test.js` e `git diff --check`: aprovados antes do commit.
- Re-review adversarial: o fallback por conteúdo distingue payloads name-only diferentes e é estável com revisão/proveniência ausente; somente itens com matching 2+ persistem marcador interno; o usuário ainda escolhe explicitamente o edital de destino. Merge não sobrescreve entidades `REUSE`, nem altera domínios alheios; import congelado `?v=8.37` continua intacto.
- A primeira execução isolada da suíte E2E do importador, antes de `d603d3c`, teve uma falha intermitente de reload (estado vazio); o cenário isolado, a suíte repetida e os nove casos dentro do release E2E passaram. Não houve alteração de código para mascarar essa ocorrência.
- Próximos passos: atualizar `origin/codex/issue-100-edital-json-import`, consultar PR #101 e checks do novo HEAD, mesclar por merge commit se mergeável/sem falhas, atualizar local `main` por fast-forward, verificar SHA remoto, fechar/comentar issue #100 e registrar o HEAD final.

## Integração do PR #101 — 2026-10-05

- O PR [#101](https://github.com/matheussilva421/estudo-organizado/pull/101) foi integrado com merge commit `bce953445897e8a11b0ddf83faf9d379f07e5af4`, usando `merge` e `expected_head_sha=477ecfbb5d1d2d6b57938c80cee5c54a0cd5c090`.
- GitHub confirmou `merged: true`; refs atualizadas: `origin/main` passou de `e2b90ef` para o merge commit. A `main` local limpa avançou por `git pull --ff-only origin main`.
- Checks/workflows GitHub: nenhum status check ou workflow run associado ao HEAD do PR ou ao merge commit. Gates locais completos passaram no código final.
- Pós-merge em `main` no commit `bce953445897e8a11b0ddf83faf9d379f07e5af4`: core+view 82/82; `npm run bump:check` sem assets pendentes; `git diff --check` limpo. Full suite no HEAD do PR: `npm test` 145/145 arquivos, 2.344 testes; release E2E 158/158.
- A issue #100 foi fechada automaticamente pelo `Closes #100` do PR; GitHub retorna `state=closed`, `state_reason=completed`.
- A atualização documental deste fechamento será adicionada como commit docs-only na `main`; o comentário final da issue registrará o SHA de `main` após esse checkpoint.
