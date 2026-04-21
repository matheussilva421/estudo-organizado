# Paleta e Temas - Estudo Organizado

Este guia define a direcao visual oficial do app: produtivo, limpo e consistente. A prioridade e manter `light` e `dark` como temas principais, usando os demais temas como extras sem quebrar componentes base.

## 1) Fonte da verdade

- Tokens claros ficam em `src/css/tokens.css`, no bloco `:root`.
- Tokens escuros ficam em `src/css/styles.css`, no bloco `[data-theme="dark"]`.
- Componentes devem consumir tokens, nao cores fixas.
- O tema ativo continua sendo aplicado via `data-theme` no elemento `<html>`.

## 2) Temas oficiais

| Token | Claro | Escuro |
|---|---|---|
| `--bg` | `#f6f8fb` | `#0b1220` |
| `--card` | `#ffffff` | `#111827` |
| `--surface` | `#eef3f8` | `#172033` |
| `--border` | `#d8e0ea` | `#253247` |
| `--text-primary` | `#111827` | `#e5edf7` |
| `--text-secondary` | `#475569` | `#a8b3c7` |
| `--text-muted` | `#64748b` | `#7d8aa3` |
| `--accent` | `#0f766e` | `#2dd4bf` |
| `--accent-hover` | `#115e59` | `#5eead4` |
| `--accent-light` | `#ccfbf1` | `#134e4a` |
| `--accent-text` | `#ffffff` | `#042f2e` |

## 3) Tokens semanticos

- `--success` / `--success-bg`: conclusao, progresso positivo e estudos feitos.
- `--warning` / `--warning-bg`: alertas e estados que exigem atencao.
- `--danger` / `--danger-bg`: atraso, erro e acoes destrutivas.
- `--info` / `--info-bg`: agendamentos, informacao neutra e estados auxiliares.
- `--status-agendado`, `--status-estudei`, `--status-atrasado`, `--status-nao`: estados especificos de calendario e revisao.

## 4) Temas extras

Os temas `furtivo`, `abismo`, `grafite`, `matrix`, `rubi` e `cyberpunk2077` continuam disponiveis por compatibilidade e preferencia pessoal. Eles devem alterar tokens, mas nao criar regras espalhadas com cores fixas ou `!important` sem necessidade.

## 5) Regras de manutencao

- Para alterar o visual geral, edite tokens antes de editar componentes.
- Para componentes comuns, use `--accent`, `--accent-hover`, `--accent-text`, `--surface`, `--border` e os tokens semanticos.
- Evite gradientes em areas funcionais rotineiras como modais, cards e headers internos.
- Mantenha contraste minimo de 4.5:1 para texto pequeno.
- Depois de mudar tema ou cor, rode `npm test` e confira visualmente home, dashboard, calendario, revisoes, configuracoes e modais.
