---
name: Estudo Organizado
description: Painel de estudos local-first para concursos — escuro, sereno, preciso.
colors:
  accent: "#8aa4bf"
  accent-hover: "#a7bdd3"
  accent-light: "#8aa4bf29"
  accent-text: "#071018"
  bg: "#08090d"
  surface: "#0d1117"
  card: "#121821"
  card-header: "#151d27"
  card-hover: "#17202b"
  border: "#94a3b824"
  text-primary: "#f3f6fb"
  text-secondary: "#b8c0cc"
  text-muted: "#7f8a99"
  success: "#7dd3a8"
  warning: "#d8a657"
  danger: "#ef7777"
  danger-text: "#071018"
  info: "#8aa4bf"
  question: "#a7a4d6"
  status-agendado: "#8aa4bf"
  status-estudei: "#7dd3a8"
  status-atrasado: "#ef7777"
  status-nao: "#6f7a89"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    letterSpacing: "0.5px"
  mono:
    fontFamily: "DM Mono, monospace"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "normal"
rounded:
  sm: "8px"
  control: "10px"
  md: "14px"
  lg: "18px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-text}"
  button-ghost:
    backgroundColor: "#00000000"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.danger-text}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "20px"
  stat-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "18px 20px"
  event-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
---

# Design System: Estudo Organizado

## 1. Overview

**Creative North Star: "A Sala de Instrumentos"**

Estudo Organizado é um painel escuro de mostradores precisos. O estudante de concurso passa meses olhando para esta tela; ela tem que ser o lugar mais calmo da preparação, não mais um competidor por atenção. A metáfora é a sala de instrumentos: cada número — tempo acumulado, percentual de acertos, streak de constância, progresso no edital — tem seu lugar fixo, lê-se de relance, e **nada pisca sem motivo**. A confiança vem da precisão e da consistência, jamais do brilho.

A atmosfera é **serena e premium**. O fundo é quase preto (`#08090d`); as superfícies flutuam um degrau acima com sombra difusa e um filete de luz no topo, o que faz o escuro parecer trabalhado, não chapado. O accent — um azul-aço discreto (`#8aa4bf`) por padrão — entra só onde a ação ou a seleção acontece. Os valores quantitativos usam DM Mono, como dígitos de um mostrador; o texto usa Plus Jakarta Sans. A densidade é controlada: muita informação quando o usuário precisa (tabelas, dashboards), com respiro e hierarquia que impedem a poluição.

Este sistema **rejeita** explicitamente duas direções. Primeiro, o **SaaS genérico**: nada de cards com gradiente, nada do template de hero-metric (número gigante + label minúsculo + stats de apoio + accent em degradê), nada de identidade emprestada de qualquer startup. Segundo, o **corporativo/estéril**: nada de Material Design padrão, nada de cinza empresarial, nada de "planilha de RH". A identidade é própria e escura, carregada pela paleta e pela tipografia — não por adornos.

**Key Characteristics:**
- Painel escuro com profundidade real (sombra difusa + luz de borda interna), nunca preto chapado.
- Accent raro e funcional: ação, seleção e estado — nunca decoração.
- Números em DM Mono; texto em Plus Jakarta Sans. Medida e prosa nunca se confundem.
- Escala tipográfica fixa em px (não fluida): a UI é vista em DPI consistente, do desktop ao celular.
- Seis "atmosferas" (temas) sobre a mesma estrutura; todas precisam manter contraste AA.

## 2. Colors

A paleta é um escuro frio e sóbrio com um único accent quente-neutro de aço; a cor semântica só aparece para comunicar estado, nunca para enfeitar.

### Primary
- **Azul-Aço** (`#8aa4bf`): o accent padrão (tema Grafite). Usado em botões primários, item de navegação ativo, foco, seleção atual e indicadores de estado "agendado/info". Hover sobe para `#a7bdd3`. Texto sobre o accent é quase-preto (`#071018`) para contraste AA.

### Neutral
- **Quase-Preto** (`#08090d`): o fundo do app. A "sala" escura onde tudo acontece. O gradiente real desce de `#050608` a `#0d1117`.
- **Painel** (`#121821` card / `#0d1117` surface): superfícies que flutuam um degrau acima do fundo. `#151d27` para cabeçalhos de card, `#17202b` para hover.
- **Tinta Clara** (`#f3f6fb` primary / `#b8c0cc` secondary / `#7f8a99` muted): a rampa de texto. Primary para títulos e valores, secondary para corpo e labels, muted para dicas e timestamps — sempre verificado ≥ 4.5:1 sobre `--card`.
- **Borda** (`#94a3b824`, ~14% de um azul-cinza): divisórias e contornos sutis. Por padrão os painéis têm borda transparente; a profundidade vem da sombra, não do traço.

### Secondary (semânticas de estado)
- **Verde Menta** (`#7dd3a8`): sucesso, sessão "estudei", métrica positiva.
- **Âmbar** (`#d8a657`): aviso, estado pendente, meta em risco.
- **Coral** (`#ef7777`): erro, sessão "atrasada", ação destrutiva.
- **Lavanda** (`#a7a4d6`): questões e modo Pomodoro (categoria, não estado).

### Named Rules
**A Regra do Accent Raro.** O accent carrega ≤ 10% de qualquer tela. Ele significa "aja aqui" ou "você está aqui" — ação primária, item ativo, foco, seleção. Em estado inativo, nada usa cor saturada. A raridade é o que dá poder ao azul-aço.

**A Regra das Seis Atmosferas.** Existem 6 temas (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis). O que muda entre eles é o **accent e a temperatura da superfície**, nunca a estrutura. Cada tema é uma atmosfera completa e escura. Toda cor — incluindo as semânticas — deve manter contraste AA em **todos os seis**, não só no Grafite. Um tema não é "decoração"; é a mesma sala de instrumentos sob outra luz.

## 3. Typography

**Display / Body Font:** Plus Jakarta Sans (com `sans-serif` de fallback)
**Figuras / Mono Font:** DM Mono (com `monospace` de fallback)

**Character:** uma sans humanista, limpa e levemente arredondada para todo o texto e os títulos, contrastada com uma monoespaçada técnica reservada aos números. O par não compete: a Plus Jakarta fala, a DM Mono mede.

### Hierarchy
- **Display** (800, 28px, line-height 1): valores-herói dos cards de estatística (tempo do dia, % de acertos). Curto, denso, lido de relance.
- **Headline** (700, 18px): título da topbar e títulos de página.
- **Title** (700, 14–17px): cabeçalho de card (14px), header de seção (16px), título de modal (17px).
- **Body** (400, 13.5px, line-height ~1.5): texto corrido e descrições. Prosa longa limitada a 65–75ch.
- **Label** (600, 11.5px, uppercase, tracking 0.5px): rótulos de estatística e eyebrows funcionais. Rótulo de formulário usa a variante 12.5px/600 sem caixa-alta.
- **Mono** (DM Mono, 500, 13px): cronômetro, percentuais, contagens, horários e qualquer valor tabular.

### Named Rules
**A Regra do Mono-para-Medida.** DM Mono é exclusiva de valores quantitativos — tempo, porcentagem, contagem, horário. Nunca em prosa, label ou botão. Quando um número é a informação, ele é mono; quando é palavra, é Plus Jakarta. Essa fronteira é o que faz o painel parecer um instrumento.

**A Regra da Escala Fixa.** Tamanhos são fixos em px, não `clamp()` fluido. A mesma UI roda em desktop e celular sob DPI consistente; um título que encolhe numa sidebar fica pior, não melhor.

## 4. Elevation

O sistema é **elevado com luz de borda**, não plano. Painéis e cards flutuam um degrau acima do fundo por meio de sombra difusa e — o detalhe que define a marca — um filete interno de luz no topo (`inset 0 1px 0 rgba(255,255,255,0.025)`). Sobre um fundo quase preto, é esse rim-light que transforma a superfície de "preto chapado" em "material trabalhado". A profundidade é estrutural (hierarquia de superfície), não decorativa.

### Shadow Vocabulary
- **sm** (`box-shadow: 0 1px 2px rgba(0,0,0,0.34)`): elevação mínima, elementos rasos.
- **panel** (`box-shadow: 0 18px 44px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.025)`): o padrão de cards e painéis em repouso. Sempre com o rim-light interno.
- **md** (`box-shadow: 0 18px 42px rgba(0,0,0,0.34)`): hover de cards/eventos; resposta a estado.
- **lg** (`box-shadow: 0 28px 68px rgba(0,0,0,0.44)`): modais e overlays no topo da pilha.

### Named Rules
**A Regra da Luz de Borda.** Todo painel elevado carrega o filete `inset 0 1px 0 rgba(255,255,255,0.025)` no topo. Sem ele, a superfície escura achata e parece um app de 2014. Com ele, parece vidro/grafite polido. Nos temas Terminal e Neon o rim-light ganha um halo de 1px na cor do accent — assinatura daqueles ambientes.

## 5. Components

A linguagem é **refinada e contida**: cantos suaves (10–14px), transições curtas (0.2s), lift sutil no hover. O componente serve à tarefa e desaparece; não há floreio.

### Buttons
- **Shape:** cantos de 10px (`{rounded.control}`), `inline-flex` com gap de 6px, padding 9px 16px, peso 600/13px.
- **Primary:** fundo `--accent`, texto `--accent-text` (quase-preto), sombra de apoio `0 10px 24px rgba(0,0,0,0.28)`. **Hover:** fundo `--accent-hover` + `translateY(-1px)` + sombra mais alta. O único botão com cor de fundo saturada.
- **Ghost:** transparente, texto secundário, borda 1px `--border`; hover preenche com `--surface`.
- **Outline:** igual ao ghost, borda que clareia para `--text-muted` no hover.
- **Danger:** fundo `--danger`, texto `--danger-text`.
- **Small:** padding 5px 10px / 12px.
- **Focus:** `outline: 2px solid var(--accent); outline-offset: 2px` (focus-visible). **Disabled:** opacidade 0.5, `pointer-events: none`.

### Cards / Containers
- **Corner Style:** 14px (`{rounded.md}`).
- **Background:** `--card` (`#121821`); cabeçalho em `--card-header`; hover em `--card-hover`.
- **Shadow Strategy:** `panel` (ver Elevation) — difusa + rim-light. Borda padrão **transparente**; o contorno é a sombra.
- **Internal Padding:** corpo 20px; cabeçalho 16px 20px com divisória inferior `--panel-divider` e `h3` 14px/700.

### Stat Cards
- Faixa de **3px no topo** (`::before`) colorida por categoria (accent / `--blue` / `--orange` / `--red`) — a única "etiqueta" de cor do card.
- Rótulo 11.5px/600 uppercase; valor 28px/800 line-height 1; sub 12px muted. **Nunca** o template hero-metric com gradiente.

### Event Cards (componente assinatura)
- Linha horizontal: **faixa de status de 4px na frente** (`.event-stripe`, elemento, não borda), ícone da disciplina 36×36 (raio 8px), info flexível, ações à direita.
- A faixa codifica status por cor: agendado (`--status-agendado`), estudei (`--status-estudei`), atrasado (`--status-atrasado`), não (`--status-nao`). **A cor é a informação** — é o que justifica a faixa.
- Card 14px 16px, raio 10px, borda 1px `--border`; hover sobe para sombra `md`. Tag/etiqueta em pílula tingida (bg semântico + texto da mesma família).

### Inputs / Fields
- **Style:** padding 9px 12px, borda 1px `--border`, raio 8px, fundo `--card`, fonte 13.5px herdada.
- **Focus:** `outline: 2px solid var(--accent)` + `outline-offset: 2px` + borda accent + halo `box-shadow: 0 0 0 3px var(--accent-light)`. Placeholder em `--text-muted` (opacidade 1, ≥ 4.5:1).
- **Label:** 12.5px/600 secundário, 6px acima do controle. **Erro:** usar `--danger` na borda + `--danger-bg`; **disabled:** opacidade reduzida.

### Navigation
- Sidebar de 260px que **colapsa para 70px** (ícones). Item ativo: cor `--accent`, fundo `--accent-light`, borda-guia `--accent-hover`. Hover: `--sidebar-hover`. Badges numéricos (ex.: revisões pendentes) acompanham o item.
- Alvos de toque ≥ 44px em `pointer: coarse`; `icon-btn` é 44×44.

### Badges & Chips
- Pílula (raio 20px), fundo semântico tingido (`--success-bg`, `--info-bg`, `--danger-bg`) + texto da cor correspondente; `badge-gray` usa `--surface` + texto secundário.

## 6. Do's and Don'ts

### Do:
- **Do** usar o accent em ≤ 10% da tela: ação primária, item ativo, foco, seleção. Inativo é neutro.
- **Do** carregar todo painel elevado com o rim-light `inset 0 1px 0 rgba(255,255,255,0.025)` — é a assinatura da "sala de instrumentos".
- **Do** usar DM Mono **apenas** para valores quantitativos (tempo, %, contagem, horário); Plus Jakarta para todo o resto.
- **Do** verificar contraste **AA nos seis temas**, não só no Grafite. Texto de corpo ≥ 4.5:1; texto grande ≥ 3:1.
- **Do** manter foco visível (`outline: 2px solid var(--accent); outline-offset: 2px`) em todo elemento interativo.
- **Do** respeitar `prefers-reduced-motion: reduce` com crossfade/transição instantânea em toda animação.
- **Do** manter a escala fixa em px e o vocabulário de componentes idêntico nas 13 telas.

### Don't:
- **Don't** usar cards com gradiente nem o template de **hero-metric** (número gigante + label minúsculo + stats de apoio + accent em degradê). É o SaaS genérico que o produto rejeita.
- **Don't** cair no **corporativo/estéril**: Material Design padrão, cinza empresarial, "planilha de RH". A identidade é escura e própria.
- **Don't** usar **gradiente em texto** (`background-clip: text`). Ênfase vem de peso e tamanho, em cor sólida.
- **Don't** usar **glassmorphism decorativo** (blur/vidro) como padrão. Profundidade é sombra + rim-light, não desfoque.
- **Don't** usar `border-left`/`border-right` > 1px como **faixa colorida decorativa** em cards/callouts. A faixa de 4px do event-card é a única exceção sancionada **porque codifica status** (cor = agendado/estudei/atrasado); nunca adicione faixa que não carregue significado.
- **Don't** repetir grades de **cards idênticos** (mesmo tamanho, ícone + título + texto) sem hierarquia. Varie peso e ritmo.
- **Don't** colocar a mesma cor saturada em estado inativo, nem usar fonte de display em label, botão ou dado.
