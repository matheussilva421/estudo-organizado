# Handoff — Dois novos temas: Codex e Plasma

**Data:** 2026-06-26
**Branch:** `feat/temas-codex-plasma`
**Status:** Concluído (testes verdes, contraste AA verificado, prova visual capturada).

## Resumo do que foi feito

Adicionados **2 temas** à biblioteca dark do app, levando o total de **6 → 8**:

- **Codex** (`value: codex`) — baseado em *CodexTerminal 2031*. Void azul-aço, accent azul `#56a7ff`, sinal verde-menta `#39ffb6` (success), info ciano `#7ce6ff`, violeta `#b08cff` para questões/Pomodoro.
- **Plasma** (`value: plasma`) — baseado em *Terminal 2031*. Quase-preto, accent teal `#00d4b1`, violeta `#9b6dff` para questões/Pomodoro, âmbar `#fbbf24` (warning), coral `#f9586e` (danger).

Ambos:
- Herdam o **contrato de tokens** existente (mesmas variáveis `--bg/--card/--accent*/--surface-*/--status-*/--shadow*/--panel-*` etc.).
- Participam de **todos** os seletores `:is(...)` compartilhados de `themes.css`.
- Trocam **apenas cores/superfícies/sombras** — as fontes globais (Plus Jakarta Sans + DM Mono) são preservadas. As fontes das referências (Chakra Petch, JetBrains Mono, Inter) **não** foram adotadas.

## Decisões técnicas

- Nomes confirmados pelo usuário via pergunta direta (Codex, Plasma).
- O `value` do tema é **só letras minúsculas** porque o regex dos auditores de contraste é `\[data-theme='([a-z]+)'\]`.
- Paletas-fonte são multi-accent; mapeadas para o contrato single-accent do app (cor-assinatura → `--accent`, resto → tokens semânticos).
- `--text-muted`/`--text-secondary` foram afinados para passar AA (≥ 4.5:1 sobre `--card`), não copiados crus das fontes (os valores originais reprovavam).

## Arquivos alterados

- `src/js/app/themes.js` — +2 entradas em `THEME_OPTIONS`.
- `src/css/base/themes.css` — +2 blocos `[data-theme='codex'|'plasma']`; `codex`/`plasma` adicionados a **31** ocorrências dos seletores `:is(...)`.
- `src/lab/visual-layout-lab.html` — +2 `<option>` no seletor de tema.
- `src/index.html`, `src/sw.js` — cache-busting **8.96 → 8.97**.
- `tests/unit/app.test.js`, `tests/unit/app-submodules.test.js`, `tests/unit/views.test.js` — contagem/arrays de temas (6→8) + casos `normalizeTheme`/`getThemeLabel`.
- `tests/unit/css-architecture.test.js` — loop de contraste temático inclui `codex`/`plasma`; versão de cache `8.97`.
- `docs/guides/paleta-temas.md`, `DESIGN.md`, `PRODUCT.md`, `README.md`, `CHANGELOG.md` — contagem e listas atualizadas (6→8).

> O picker em `Configurações` (`config-view.js`) e o botão de ciclo de tema (`applyTheme`) consomem `THEME_OPTIONS` dinamicamente — **sem alteração**.

## Testes executados

```
Comando: npx vitest run
Resultado: 1909 testes / 1909 passaram / 0 falharam
Status: verde

Comando: node scripts/check-theme-contrast.mjs
codex   muted/card: 5.52   sec/card: 8.49   (AA OK)
plasma  muted/card: 4.70   sec/card: 6.68   (AA OK)

Comando: npm run lint
0 errors, 44 warnings (todos pré-existentes, fora dos arquivos alterados)
```

## Validação manual

- Mock server do worktree em `MOCK_PORT=18790`; lab em `/lab/visual-layout-lab.html`.
- Codex e Plasma aplicados via seletor de tema; tokens computados conferidos (`--accent`, `--bg`, `--card`, `--question`, etc.).
- Screenshots da Página Inicial (cards-herói, progress bars, heatmap de constância) em ambos os temas — hierarquia e contraste OK; accent posicionado só em ação/seleção/dados. Console limpo (apenas 404 de `favicon.ico`).

## Pendências / próximos passos

- Nenhuma pendência funcional. Sugestão opcional: validar os dois temas também no app real (não só no lab) percorrendo dashboard, calendário, revisões, configurações e modais — o contrato de tokens torna isso de baixo risco.
- Commit + push da branch; abrir PR para `main` se desejado.
