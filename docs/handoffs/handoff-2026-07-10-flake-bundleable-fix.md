# Handoff — Caça e correção do flake da suíte unit (2026-07-10)

Branch: `fix/flake-suite-unit`

## Contexto

A suíte unit completa (~2209 testes) falhava intermitentemente com exatamente
1 teste vermelho (~1 a cada 3-4 rodadas), sempre passando em re-runs. A hipótese
anterior apontava para a área de sync (logs "Attempt N failed, retrying" do
`sync-simulation-contracts.test.js` eram o único ruído visível nas rodadas com
falha). Estava registrado como pendência no
`handoff-2026-07-10-pontos-fracos-v2.md`.

## Diagnóstico (protocolo: reproduzir antes de hipotetizar)

- Dois loops de reprodução em paralelo: suíte completa em loop + trio de
  arquivos sync 30x (o segundo também servia para gerar carga de máquina).
- **Rodada 4 da suíte completa falhou** e capturou o nome:
  `tests/unit/action-contracts.test.js > data-action contracts > keeps the
  browser module graph bundleable without missing exports` — **timeout de
  5000ms** (o teste levou 5899ms).
- Causa raiz: o teste fazia bundle do app inteiro via `execFileSync` de
  `npx esbuild` (no Windows, via `cmd.exe /c npx ...`) com o timeout padrão do
  Vitest (5s). Sob carga (137 arquivos de teste em paralelo), o overhead do
  spawn + npx estoura os 5s por milissegundos.
- **A hipótese "sync" estava errada**: os logs 503/409 eram ruído esperado dos
  testes de retry (aparecem também em rodadas verdes). O trio sync passou 30/30
  no loop de estresse.

## Correção

- **Novo arquivo `tests/unit/bundle-graph.test.js`**: o contrato do bundle
  migrou para lá, usando a **API programática `buildSync` do esbuild** (sem
  npx/cmd), com `// @vitest-environment node` e timeout explícito de 30s.
  Tempo do teste: **~6s → ~130ms**.
  - Por que arquivo separado: a API do esbuild não carrega em jsdom
    ("Invariant violation: TextEncoder ... instanceof Uint8Array"), e o
    `action-contracts.test.js` precisa de jsdom em outro teste (importa
    módulos que tocam `window` no top-level, ex.: `store/indexeddb.js`).
- **`tests/unit/action-contracts.test.js`**: teste do bundle removido (com
  comentário apontando o novo arquivo); imports `execFileSync`/`tmpdir`
  removidos.
- **`handoff-2026-07-10-pontos-fracos-v2.md`**: pendência do flake marcada
  como resolvida.

## Validação (TDD adaptado a fix de infra de teste)

- **Red (poder de detecção preservado)**: script comprovou que `buildSync`
  lança erro em grafo com export faltante ("No matching export ...").
- **Green**: `action-contracts.test.js` + `bundle-graph.test.js` → 27/27.
- **Estabilidade**: suíte completa rodada 5x consecutivas após o fix —
  **5/5 verdes, 2209/2209 em cada rodada** (antes do fix, a falha reproduziu
  na 4ª rodada do loop de reprodução).

## Estado / próximos passos

- **Concluído (2026-07-10)**: diff revisado, suíte completa rodada na branch
  (138 arquivos, 2209/2209 verdes; `bundle-graph.test.js` em ~1,9s sob carga),
  merge fast-forward na `main` (commit `2640775`) e push feito. Branch local
  `fix/flake-suite-unit` removida; a remota `origin/fix/flake-suite-unit`
  ainda existe (exclusão não autorizada nesta sessão — remover manualmente com
  `git push origin --delete fix/flake-suite-unit` se desejado).
- Se o flake reincidir (não deveria): o protocolo que funcionou foi rodar a
  suíte em loop com saída capturada em arquivo por rodada + monitor no resumo
  `Tests .* failed` (cuidado: grep por "failed" solto dá falso positivo com os
  logs de retry do sync).
