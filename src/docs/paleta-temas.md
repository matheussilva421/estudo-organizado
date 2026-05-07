# Paleta e Temas - Estudo Organizado

Este guia define a direcao visual oficial do app: dark premium, discreta e consistente. A interface agora expoe poucos temas bons em vez de manter uma biblioteca fantasia com neon, vermelho dominante ou contraste monocromatico extremo.

## 1) Fonte da verdade

- Os tokens base ficam em `src/css/tokens.css`, no bloco `:root`.
- As variacoes visiveis ficam em `src/css/base/themes.css`: `[data-theme="grafite"]`, `[data-theme="ardosia"]` e `[data-theme="platina"]`.
- Componentes devem consumir tokens, nao cores fixas.
- O tema ativo continua sendo aplicado via `data-theme` no elemento `<html>`.

## 2) Temas visiveis

| Tema | Uso | Base visual |
|---|---|---|
| Grafite | Padrao | Dark premium frio e equilibrado |
| Ardosia | Leitura | Cinza neutro com elevacao mais clara entre superficies |
| Platina | Foco limpo | Dark cinza puro, claro o bastante para leitura e hierarquia |

Valores antigos como `light`, `dark`, `obsidiana`, `contraste`, `furtivo`, `abismo`, `matrix`, `rubi`, `pergaminho` e `cyberpunk2077` continuam aceitos internamente, mas sao normalizados para um dos tres temas acima.

## 3) Paleta base

| Token | Valor |
|---|---|
| `--bg` | `#08090d` |
| `--surface` | `#0d1117` |
| `--card` | `#121821` |
| `--card-hover` | `#17202b` |
| `--border` | `rgba(148, 163, 184, 0.14)` |
| `--text-primary` | `#f3f6fb` |
| `--text-secondary` | `#b8c0cc` |
| `--text-muted` | `#7f8a99` |
| `--accent` | `#8aa4bf` |
| `--accent-hover` | `#a7bdd3` |
| `--accent-light` | `rgba(138, 164, 191, 0.16)` |
| `--accent-soft` | `rgba(138, 164, 191, 0.10)` |
| `--accent-text` | `#071018` |

## 4) Tokens semanticos

- `--success`: verde frio discreto para progresso positivo.
- `--warning`: ambar queimado para atencao sem parecer erro.
- `--danger`: vermelho suave para erros, atrasos e acoes destrutivas.
- `--info`: azul aco, alinhado ao acento principal.
- `--panel-border`, `--panel-divider` e `--panel-shadow`: reduzem a aparencia de caixas desenhadas e separam cards por elevacao.
- `--surface-muted`, `--surface-soft` e `--surface-strong`: camadas neutras para notas, hover, selecao passiva e controles discretos.
- `--question` e `--question-bg`: progresso de questoes, mantendo o roxo como dado funcional em vez de cor solta.
- `--pomodoro` e `--pomodoro-bg`: estado do modo Pomodoro sem depender de valores fixos no JavaScript.

## 5) Regras de manutencao

- Use acento apenas para acao primaria, foco, navegacao ativa e pequenas metricas relevantes.
- Evite ciano/neon, amarelo forte e vermelho dominante como identidade base.
- Evite `!important` para temas; se um componente precisar mudar, exponha um token.
- Evite `style=""` para cores e superficies recorrentes; prefira classes como `surface-note`, `selection-card`, `priority-badge`, `soft-action` e modificadores semanticos.
- Mantenha contraste minimo de 4.5:1 para texto pequeno.
- Depois de mudar tema ou cor, rode `npm test` e confira visualmente home, dashboard, calendario, revisoes, configuracoes e modais.
