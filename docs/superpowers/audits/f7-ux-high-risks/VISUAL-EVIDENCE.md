# Evidências visuais — HEAD final

Capturas geradas com o código `6c0353bb7da20338518b36427416343ba23f1835` (a UI é idêntica à de `ccf03457`; o último commit altera Rules, envelope remoto e testes), com fixtures sintéticas e sem dados acadêmicos reais. Dois comandos Playwright passaram: `f7-ux-premium-evidence.spec.ts` (3 testes) e `f7-ux-evidence.spec.ts` (1 teste).

## Home e conceitos premium

| Pasta | Viewports | Conteúdo |
|---|---|---|
| `screenshots/premium/` | desktop 1280×900; mobile 390×844; mobile 320×720 | Home vazia, Home com dados, galeria de 12 temas, Foco desktop/mobile |
| `screenshots/compare/` | desktop 1586×992; tablet 900×1100; mobile 390×844; mobile 320×720; mobile 320×568 | Quatro conceitos premium (neon-teal, esmeralda-dourado, azul-âmbar, azul-glacial), com e sem dados |
| `screenshots/themes/` | desktop 1280×900; tablet 834×1112; mobile 390×844 | Os 12 temas, incluindo contraste e hierarquia do dashboard |

## Módulos

`screenshots/modules/` contém as oito abas (Home, Conteúdo, Planejamento, Sessões, Revisões, Atenção, Análises, Configurações) em desktop 1280, tablet 834, mobile 390 e mobile 320, além do dashboard da Home e do Command Center desktop/mobile. `screenshots/modules-full/` guarda as oito páginas completas em 1440.

## Referências, estados e contraste

- `references/` — quatro PNGs originais 1586×992 usados como referência visual.
- `screenshots/states/` — capacidade e sobrecarga, histórico, prévia da Reta Final, importação/política de revisão, prioridade→evidência, layout manual, PERFORMANCE e contexto de hábito.
- `screenshots/contrast/` — 12 temas e `content-guide-contrast.json`.
- Os estados foram capturados em `bdebbcd0`; os componentes de UI correspondentes não mudaram desde então, exceto os avisos de Home e Reta Final, recapturados no HEAD atual.

## Verificação

- Overflow horizontal verificado em 320, 390 e 900 px pelo próprio teste de captura.
- Contraste automatizado: 36/36 combinações ≥ 4,5:1; mínimo 7,02:1.
- Limites: NVDA/Narrator, toque físico, zoom nativo manual e hardware modesto continuam NOT_RUN_ENVIRONMENT.
