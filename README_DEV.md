# README_DEV

Guia curto para trabalhar no `estudo-organizado` com pouco contexto e validacao proporcional ao risco.

Para continuar o plano de reducao de contexto com outra IA, leia tambem `docs/handoff-reducao-contexto-codex.md`.

## Regras de contexto

Para microalteracoes, leia apenas os arquivos diretamente relacionados e imports diretos. Nao varra o projeto inteiro.

Nao leia, liste ou busque por padrao:

- `node_modules/`
- `.git/`
- `.claude/`
- `.sisyphus/`
- `.playwright-mcp/`
- `coverage/`
- `playwright-report/`
- `test-results/`
- `_local_archive/`
- `output/`
- `src/vendor/`
- `src/docs/superpowers/plans/`
- `package-lock.json`

Busca segura:

```powershell
rg "termo" src tests scripts -g '!src/vendor/**' -g '!node_modules/**' -g '!coverage/**' -g '!playwright-report/**' -g '!test-results/**' -g '!package-lock.json'
```

## Mapa rapido

| Area | Comece por | Evite por padrao |
|---|---|---|
| Entrada e boot | `src/index.html`, `src/js/main.js`, `src/js/app.js` | `src/vendor/` |
| Estado local | `src/js/store.js` | planos historicos |
| Regras de dominio | `src/js/logic.js`, `src/js/relevance.js` | CSS global |
| Views gerais | `src/js/views.js`, `src/js/views/` | E2E completo no primeiro passo |
| Configuracoes | `src/js/views/config-view.js`, `src/js/ui/actions/config.js` | `src/vendor/`, `package-lock.json` |
| Sync/Firestore/Drive | `src/js/sync/`, `src/js/cloud-sync.js`, `src/js/drive-sync.js`, `src/js/credentials.js` | CSS e docs antigas |
| Visual | `src/css/tokens.css`, `src/css/base.css`, `src/css/components.css`, `src/css/views.css`, `src/css/views/`, `src/css/styles.css` | JS de sync |
| Vendor | `scripts/build-firebase-bundle.mjs`, `src/vendor/README.md` | editar bundle manualmente |
| Debug controlado | `src/js/debug.js` | `console.log` direto em fluxo normal |

## Matriz de escopo

| Tipo de alteracao | Comece por | Teste sugerido | Nao use primeiro |
|---|---|---|---|
| Texto pequeno | view/componente especifico | teste unitario relacionado ou revisao manual | `npm run test:e2e` |
| CSS visual | CSS relacionado e view afetada | `npm run test:css` | coverage |
| Tela de configuracao | `config-view`, action de config | `npm run test:config` | `npm run test:all` |
| Sync/cloud | `src/js/sync/`, `cloud-sync`, `drive-sync` | `npm run test:sync` | CSS, planos antigos |
| Views/renderizacao | `src/js/views*`, testes de views | `npm run test:views` | Playwright completo |
| Fluxo de usuario | arquivos do fluxo e E2E especifico | `npm run test:e2e:quick -- tests/e2e/<arquivo>` | coverage |
| Fechamento | diff completo | `npm test` e E2E relevante ou `npm run test:e2e:release` | pular git status |

## Fluxos de trabalho

### Microalteracao

1. Identifique ate 3 arquivos provaveis.
2. Leia apenas esses arquivos e imports diretos.
3. Edite o minimo necessario.
4. Rode teste especifico.
5. Resuma arquivos alterados e risco.

Nao fazer commit, push, coverage ou E2E completo sem pedido de fechamento.

### Fechamento/publicacao

1. Revise `git diff --stat`.
2. Rode testes especificos.
3. Rode `npm test`.
4. Rode E2E se houve mudanca visual, fluxo de usuario, PWA ou sync.
5. Faça commit convencional e push quando solicitado.

## Comandos rapidos

```powershell
npm run test:config
npm run test:sync
npm run test:views
npm run test:css
npm run test:e2e:quick -- --list
npm run test:e2e:release -- --list
```

Use `npm run test:coverage` apenas para auditoria de cobertura.

## Playwright sem ruido

- `npm run test:e2e:quick`: reporter `line`, bom para specs focadas e listagem.
- `npm run test:e2e:release`: projeto `chromium`, reporter `line` com `--workers=1`, use como gate sequencial principal.
- `npm run test:e2e:mock`: projeto `mock`, reporter `line`, roda apenas `mock-environment.spec.js`.
- `npm run test:e2e:mock:all`: projeto `mock` completo, use apenas para investigar paridade entre mock e Chromium.
- `npm run test:e2e:debug`: reporter HTML, use apenas para investigar falhas e gerar `playwright-report/`.
- Evite rodar projetos E2E em paralelo manualmente na mesma worktree; eles podem disputar as portas `18345` e `18765`.

## Modulos extraidos para reduzir contexto

- `src/css/views/dashboard.css`: primeira fatia extraida de `src/css/views.css`.
- `src/js/views/skeleton-view.js`: skeleton loaders antes concentrados em `src/js/views.js`.
- `src/js/views/config/backup-settings.js`: formatacao e resumo de backup antes concentrados em `src/js/views/config-view.js`.

## Debug controlado

Logs informativos devem ficar atras de flag:

```js
localStorage.setItem('debug:sync', 'true');
localStorage.setItem('debug:credentials', 'true');
```

Remova as flags com:

```js
localStorage.removeItem('debug:sync');
localStorage.removeItem('debug:credentials');
```
