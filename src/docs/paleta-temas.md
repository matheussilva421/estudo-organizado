# Paleta de Cores e Temas - Estudo Organizado

Este guia descreve as cores base do app e como cada tema funciona para facilitar futuras alteracoes sem quebrar contraste, legibilidade ou consistencia.

## 1) Como o sistema de temas funciona

- O tema ativo e aplicado via atributo `data-theme` no `<html>`.
- As cores sao centralizadas em variaveis CSS no arquivo `src/css/styles.css`.
- Tema claro usa `:root`.
- Temas escuros disponiveis:
  - `dark` (Original Dark)
  - `furtivo`
  - `abismo`
  - `grafite`
  - `matrix`
  - `rubi`

## 2) Tokens principais (variaveis globais)

- `--bg`: fundo principal da aplicacao.
- `--card` / `--card-bg`: fundo de cards e containers.
- `--surface`: superficies auxiliares.
- `--border`: bordas e divisoes.
- `--text-primary`: texto principal.
- `--text-secondary`: texto secundario.
- `--text-muted`: texto de apoio e legendas.
- `--accent`: cor de acao principal (botoes ativos, destaque).
- `--accent-light`: variacao suave da cor de destaque.
- `--accent-dark`: variacao forte da cor de destaque.
- `--accent-text`: cor do texto quando o fundo e `--accent`.

## 3) Paleta por tema

| Tema | BG | Card | Border | Text Primary | Text Secondary | Text Muted | Accent | Accent Text |
|---|---|---|---|---|---|---|---|---|
| `light` | `#F1F5F9` | `#FFFFFF` | `#E2E8F0` | `#1E293B` | `#475569` | `#5B6B80` | `#10B981` | `#052E16` |
| `dark` | `#0F172A` | `#1E293B` | `#334155` | `#F1F5F9` | `#94A3B8` | `#8094AD` | `#10B981` | `#052E16` |
| `furtivo` | `#000000` | `#0A0A0A` | `#262626` | `#FFFFFF` | `#A3A3A3` | `#7A7A7A` | `#FFFFFF` | `#000000` |
| `abismo` | `#020617` | `#0F172A` | `#334155` | `#F8FAFC` | `#94A3B8` | `#7F93AB` | `#06B6D4` | `#082F49` |
| `grafite` | `#09090B` | `#18181B` | `#3F3F46` | `#FAFAFA` | `#A1A1AA` | `#8B8B96` | `#3B82F6` | `#111827` |
| `matrix` | `#000000` | `#111111` | `#333333` | `#E5E5E5` | `#A3A3A3` | `#8A8A8A` | `#22C55E` | `#052E16` |
| `rubi` | `#000000` | `#0A0A0A` | `#262626` | `#FFFFFF` | `#A3A3A3` | `#7A7A7A` | `#DC2626` | `#FFFFFF` |

## 4) Regras para trocar cor com seguranca

- Sempre prefira alterar os tokens (`--...`) em vez de cor fixa em componente.
- Para texto pequeno (12px-16px), mantenha contraste minimo de **4.5:1**.
- Para texto grande (>= 18px ou 14px bold), contraste minimo de **3:1**.
- Se alterar `--accent`, valide tambem `--accent-text`.
- Em temas escuros, evite cinzas muito proximos do fundo para `--text-muted`.

## 5) Cores semanticas (status)

- `--status-agendado`: azul.
- `--status-estudei`: verde.
- `--status-atrasado`: vermelho.
- `--status-nao`: cinza neutro.

Use essas variaveis para estados de agenda/revisao para manter consistencia entre telas.

## 6) Onde editar no codigo

- Definicao dos temas: `src/css/styles.css` (blocos `:root` e `[data-theme=\"...\"]`).
- Troca de tema em runtime: `src/js/app.js` (`applyTheme`).
- Seletor de tema na UI: `src/js/views.js` (configuracoes).

## 7) Checklist rapido apos mudar paleta

- Verificar botoes primarios (`btn-primary`) em todos os temas.
- Verificar labels e textos secundarios em cards.
- Verificar graficos (linhas, barras, legenda e grid).
- Verificar estados concluido e pendente em topicos e aulas.
- Verificar contraste no modo claro e em todos os temas escuros.

