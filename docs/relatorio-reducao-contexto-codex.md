# Relatorio de reducao de contexto do Codex

Data do baseline: 2026-05-05.

## Objetivo

Reduzir consumo de tokens em tarefas pequenas no `estudo-organizado` separando o que e codigo-fonte relevante do que e dependencia, artefato local, relatorio gerado, historico ou arquivo de baixo valor decisorio para agentes.

## Baseline do checkout

| Item                 |   Tamanho | Arquivos | Observacao                                                    |
| -------------------- | --------: | -------: | ------------------------------------------------------------- |
| `node_modules/`      | 231,13 MB |   18.510 | Deve ficar fora de buscas e contexto.                         |
| `.git/`              |  31,28 MB |    6.070 | Metadados Git; nunca deve ser lido como codigo.               |
| `.claude/`           |   6,08 MB |      464 | Contem configuracoes e worktrees locais.                      |
| `coverage/`          |   5,90 MB |      135 | Artefato regeneravel de cobertura.                            |
| `_local_archive/`    |   4,00 MB |       42 | Historico local arquivado; preservar fora do contexto padrao. |
| `src/`               |   1,99 MB |      107 | Aplicacao entregue ao usuario.                                |
| `tests/`             |   0,83 MB |      107 | Testes automatizados.                                         |
| `playwright-report/` |   0,50 MB |        1 | Relatorio HTML regeneravel.                                   |
| `.playwright-mcp/`   |   0,48 MB |       43 | Capturas/snapshots locais de ferramenta.                      |
| `.sisyphus/`         |   0,38 MB |       17 | Planos/evidencias locais de agente.                           |
| `output/`            |   0,14 MB |        2 | Saidas locais.                                                |

Arquivos rastreados no Git: 240.

Arquivos locais fora de `.git`: 19.462.

## Maiores arquivos rastreados

| Arquivo                                                                         |  Tamanho | Risco para contexto                                  |
| ------------------------------------------------------------------------------- | -------: | ---------------------------------------------------- |
| `src/vendor/firebase-client.bundle.js`                                          | 494,4 KB | Bundle gerado, baixo valor para IA.                  |
| `package-lock.json`                                                             | 284,2 KB | Lockfile necessario ao npm, ruim para microcontexto. |
| `src/vendor/chart.umd.min.js`                                                   | 197,6 KB | Minificado em linha longa.                           |
| `src/css/styles.css`                                                            |  92,5 KB | CSS global grande.                                   |
| `src/js/views.js`                                                               |  79,1 KB | Fachada/renderizacao ainda ampla.                    |
| `src/docs/superpowers/plans/2026-04-21-react-vite-typescript-migration-plan.md` |  66,7 KB | Plano historico longo.                               |
| `src/css/views.css`                                                             |  61,4 KB | CSS de views grande.                                 |
| `src/js/views/config-view.js`                                                   |  52,4 KB | Tela de configuracao concentrada.                    |

## Decisoes aplicadas

- Manter a estrategia allowlist do `.gitignore`.
- Versionar `AGENTS.md`, `README_DEV.md` e ignores de IA para que a politica acompanhe o repositorio.
- Tratar `src/vendor/`, `package-lock.json`, relatorios, caches e planos historicos como proibidos no contexto padrao de microalteracoes.
- Separar fluxo de microalteracao do fluxo de fechamento/publicacao.

## Execucao realizada nesta branch

- Criada a branch `codex-reduce-ai-context` porque `codex/reduce-ai-context` foi bloqueada pela forma atual das refs locais.
- Criados `.aiexclude`, `.codexignore` e `.cursorignore`.
- Atualizado `AGENTS.md` com modo de microalteracao e modo de fechamento.
- Criado `README_DEV.md` com mapa rapido, matriz de escopo e comandos de teste economicos.
- Movidos para `C:\Users\slvma\Downloads\Github\estudo-organizado-local-archive`:
  - `_local_archive/`
  - `output/`
  - `.claude/worktrees/`
- Removidos por serem regeneraveis:
  - `coverage/`
  - `playwright-report/`
  - `test-results/`
- Adicionados scripts de teste direcionados em `package.json`.
- Movido `tests/e2e/debug.spec.js` para `tests/e2e/manual/debug.spec.js` e excluido do Playwright padrao.
- Criado `src/vendor/README.md`.
- Criado `src/docs/superpowers/plans/README.md`.
- Criado `src/js/debug.js` e convertidos logs informativos de sync/credentials/bootstrap para `debugLog`.
- Adicionado `MOCK_VERBOSE=true` para logs por request no mock server.
- Extraidos:
  - `src/css/views/dashboard.css`
  - `src/js/views/skeleton-view.js`
  - `src/js/views/config/backup-settings.js`

## Estado apos limpeza local

| Item                 | Tamanho atual | Arquivos atuais | Resultado                                                                      |
| -------------------- | ------------: | --------------: | ------------------------------------------------------------------------------ |
| `node_modules/`      |     231,13 MB |          18.510 | Mantido localmente, mas ignorado por politica de busca/contexto.               |
| `.claude/`           |          0 MB |               3 | Mantidas apenas configuracoes locais; `worktrees/` foi arquivado fora do repo. |
| `coverage/`          |          0 MB |               0 | Removido.                                                                      |
| `playwright-report/` |          0 MB |               0 | Removido apos validacao.                                                       |
| `test-results/`      |          0 MB |               0 | Removido apos validacao.                                                       |
| `_local_archive/`    |          0 MB |               0 | Movido para arquivo local externo.                                             |
| `output/`            |          0 MB |               0 | Movido para arquivo local externo.                                             |
| `.playwright-mcp/`   |       0,48 MB |              43 | Mantido localmente, ignorado por politica.                                     |
| `.sisyphus/`         |       0,38 MB |              17 | Mantido localmente, ignorado por politica.                                     |

## Validacao executada

- `git check-ignore -v AGENTS.md README_DEV.md .aiexclude .codexignore .cursorignore docs/relatorio-reducao-contexto-codex.md src/vendor/README.md src/docs/superpowers/plans/README.md`: confirmou que os novos arquivos de politica/documentacao deixaram de ser ignorados pela allowlist.
- `node --check` nos novos/alterados arquivos JS principais: passou.
- `npm run test:config`: 2 arquivos, 60 testes passando.
- `npm run test:sync`: 21 arquivos, 317 testes passando.
- `npm run test:views`: 12 arquivos, 207 testes passando.
- `npm run test:css`: 1 arquivo, 26 testes passando.
- `npm run test:e2e:quick -- --list`: listou 304 testes com o reporter economico.
- `npm run lint`: passou sem erros; restaram 8 warnings ja existentes ou fora do escopo funcional desta fase.
- `npx prettier --check` nos arquivos tocados de `src/`: passou.
- `npm test`: 77 arquivos, 1291 testes passando.
- `npm run test:e2e:mock -- tests/e2e/mock-environment.spec.js`: 10 testes passando.
- `npm run test:e2e:chromium -- tests/e2e/app.spec.js --grep "SW precache"`: 1 teste passando.
- `npm run test:e2e`: executou a suite completa; 214 testes passaram e 90 falharam. As falhas ficaram concentradas no conjunto E2E amplo, especialmente projeto `mock` em paralelo e contratos de UI/sync ja sensiveis, enquanto os E2E focados de mock e service worker passaram quando isolados. Esta fase nao tentou corrigir a saude global da suite E2E para evitar misturar reducao de contexto com refatoracao de produto/testes.

## Artefatos locais a preservar ou limpar

Preservar ou mover para arquivo externo:

- `_local_archive/`
- `output/`
- `.claude/worktrees/`

Regeneraveis, podendo ser removidos quando nao houver investigacao ativa:

- `coverage/`
- `playwright-report/`
- `test-results/`

## Proximos hotspots estruturais

- `src/css/styles.css`
- `src/css/views.css`
- `src/js/views.js`
- `src/js/views/config-view.js`
- suite E2E completa, que ainda produz muita saida e apresenta falhas em execucao ampla/paralela.

Plano detalhado de continuidade para outra IA: `docs/handoff-reducao-contexto-codex.md`.
