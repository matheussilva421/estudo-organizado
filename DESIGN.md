---
name: Estudo Organizado
description: Painel de estudos local-first para concursos — escuro, preciso, denso.
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
  xxs: "2px"
  compact: "3px"
  xs: "4px"
  tight: "6px"
  sm: "8px"
  control: "10px"
  card-sm: "12px"
  md: "14px"
  modal: "16px"
  lg: "18px"
  loose: "20px"
  xl: "24px"
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
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.danger-text}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "20px"
  card-header:
    backgroundColor: "{colors.card-header}"
    textColor: "{colors.text-primary}"
    padding: "16px 20px"
  stat-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "18px 20px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  nav-item-active:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.accent}"
  badge:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: Estudo Organizado

## 1. Overview

**Creative North Star: "A Sala de Instrumentos"**

Estudo Organizado é um painel escuro de mostradores precisos. O concurseiro passa meses olhando para esta tela; ela é o instrumento de medição da própria preparação. A beleza não vem de decoração — vem do rigor: cada número (tempo, % de acertos, streak, progresso no edital) tem peso tipográfico, posição fixa e alinhamento exato, e lê-se de relance. A confiança nasce da precisão e da consistência, não do brilho.

A densidade é um recurso declarado, não um defeito a esconder. Quem prepara concurso quer ver o quadro inteiro de uma vez — então a tela mostra muito, com alta razão sinal/ruído: cada elemento é útil, ordenado por importância, separado por alinhamento e respiro proporcional. Denso é o oposto de poluído. Muito sinal, pouco ruído, hierarquia inequívoca. A atmosfera é técnica e premium: fundo quase preto, superfícies que flutuam com sombra difusa e um filete de luz no topo, accent azul-aço raro e funcional. Números em DM Mono; texto em Plus Jakarta Sans — medida e prosa nunca se confundem.

O sistema rejeita o **SaaS genérico** (cards em gradiente, template hero-metric, dashboard de qualquer startup) e o **corporativo/estéril** (Material Design padrão, cinza empresarial, sensação de planilha de RH sem alma). A identidade vem da paleta escura comprometida e do par tipográfico texto+mono — não de adornos emprestados.

**Key Characteristics:**
- Painel escuro com profundidade real (sombra difusa + luz de borda interna), nunca preto chapado.
- Densidade como virtude: muita informação útil, ordenada por hierarquia e alinhamento — nunca amontoada.
- Accent raro e funcional: ação, seleção e estado — nunca decoração.
- Números em DM Mono; texto em Plus Jakarta Sans. Medida e prosa têm fontes distintas.
- Escala tipográfica fixa em px (não fluida), do desktop ao celular.
- Oito atmosferas (temas) sobre a mesma estrutura; todas mantêm contraste AA.

## 2. Colors

Paleta escura de instrumento: superfícies quase-pretas estratificadas por tom, um único accent azul-aço e uma família semântica enxuta para estado.

### Primary
- **Azul-Aço** (`#8aa4bf`): o accent. Ação primária, item de navegação ativo, foco, seleção e indicadores de estado neutro/agendado. É a única cor saturada que aparece em repouso — e aparece pouco, de propósito.
- **Azul-Aço Claro** (`#a7bdd3`): hover do accent (botões, bordas ativas).
- **Halo do Accent** (`#8aa4bf29`, ~16% alpha): fundo tingido de item ativo, seleção e badge neutro. Nunca como fundo de superfície grande.

### Tertiary (estado semântico)
- **Verde Menta** (`#7dd3a8`): sucesso, status "Estudei", confirmação de salvamento/sync.
- **Âmbar** (`#d8a657`): aviso, previsão da semana em risco moderado.
- **Coral** (`#ef7777`): perigo, status "Atrasado", ações destrutivas.
- **Violeta** (`#a7a4d6`): questões e modo Pomodoro — a categoria "estudo dirigido".

### Neutral
- **Quase-Preto** (`#08090d`): fundo da aplicação (sobre o gradiente `--app-bg`).
- **Superfície** (`#0d1117`): segunda camada — sidebar, painéis, fundos de input em foco.
- **Painel** (`#121821`): fundo de card padrão, o palco dos dados.
- **Cabeçalho de Painel** (`#151d27`) / **Hover de Painel** (`#17202b`): topo de card e resposta de hover.
- **Tinta Clara** (`#f3f6fb`): texto primário e valores-herói.
- **Tinta Média** (`#b8c0cc`): texto secundário, labels, descrições.
- **Tinta Apagada** (`#7f8a99`): texto terciário, metadados, sub-valores. Ajustada por tema para manter ≥ 4.5:1 sobre o card.
- **Borda** (`#94a3b824`, ~14% alpha): divisores e contornos de input; quase imperceptível, a separação vem mais do tom da superfície que da linha.

### Named Rules
**A Regra do Accent Raro.** O accent carrega ≤ 10% de qualquer tela: ação primária, item ativo, foco, seleção. Em estado inativo, nada usa cor saturada. A raridade é o que dá poder ao azul-aço.

**A Regra das Oito Atmosferas.** Existem 8 temas (Grafite, Ardósia, Platina, Terminal, Neon, Arrakis, Codex, Plasma). O que muda é o accent e a temperatura da superfície — nunca a estrutura. Toda cor deve manter contraste AA nos oito, não só no Grafite (padrão).

**A Regra dos Tokens Canônicos.** O vocabulário semântico é `--success`, `--warning`, `--danger`, `--info`, `--question` e seus fundos. Aliases históricos (`--green`, `--orange`, `--yellow`, `--red`, `--blue`, `--purple`) existem apenas para compatibilidade e devem apontar para os tokens canônicos do tema.

**A Regra da Cor de Stat.** Stat cards usam cor por categoria de dado, não por decoração: tempo/vídeo -> `--info`, questões/súmulas -> `--question`, simulados/risco moderado -> `--warning`, aulas concluídas -> `--success`, páginas/pendentes/restantes -> neutro (`--text-secondary`). `--danger` fica reservado para erro, atraso ou ação destrutiva.

## 3. Typography

**Display / Body / Label Font:** Plus Jakarta Sans (com fallback `sans-serif`)
**Measurement Font:** DM Mono (com fallback `monospace`)

**Character:** uma família sans humanista-geométrica única carrega toda a interface — títulos, labels, botões e prosa — e uma monoespaçada técnica é reservada exclusivamente para números. O contraste sans↔mono é o que faz o dado "saltar" da prosa sem precisar de cor.

### Hierarchy
- **Display** (800, 28px, line-height 1): valor-herói dos stat-cards (tempo do dia, % de acertos). O número que o olho procura primeiro.
- **Headline** (700, 18px, line-height 1.2): título da topbar, cabeçalhos de tela.
- **Title** (700, 14px, line-height 1.3): cabeçalhos de card (`.card-header h3`).
- **Section Title** (700, 12px, letter-spacing 0.5px, MAIÚSCULAS): cabeçalhos de seção interna de card (`.ciclo-sequence-title`, `.ciclo-predict-title`, `.rf-section-title`), com ícone opcional em accent.
- **Body** (400, 13.5px, line-height 1.5): texto corrido, descrições, conteúdo de formulário. Prosa limitada a 65–75ch; tabelas e UI compacta podem correr mais densas.
- **Label** (600, 11.5px, letter-spacing 0.5px, MAIÚSCULAS): rótulos de stat-card e de KPI. Caixa-alta com tracking é reservada a Label e Section Title — deliberada, não enfeite por seção.
- **Mono** (DM Mono, 500, 13–32px conforme contexto): tempo, %, contagem, horário, cronômetro.

### Named Rules
**A Regra do Mono-para-Medida.** DM Mono é exclusiva de valores quantitativos — tempo, %, contagem, horário. Nunca em prosa, label ou botão. É a fonte que tabula: dígitos alinham em colunas e leem-se de relance.

**A Regra da Escala Fixa.** Tamanhos são fixos em px, não `clamp()` fluido. A mesma UI roda em desktop e celular sob DPI consistente; um h1 que encolhe numa sidebar fica pior, não melhor.

## 4. Elevation

O sistema usa **sombra difusa + luz de borda interna** para criar profundidade real sobre o fundo escuro — não tonal-layering chapado nem glass. Cada painel parece flutuar alguns milímetros acima do fundo e captar uma réstia de luz no topo. A elevação é estrutural em repouso (o card já nasce elevado) e responde a estado no hover (sobe mais).

### Shadow Vocabulary
- **sm** (`box-shadow: 0 1px 2px rgba(0,0,0,0.34)`): elevação mínima, elementos rasos (topbar).
- **panel** (`box-shadow: 0 18px 44px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.025)`): padrão de cards e painéis em repouso. O `inset` é o rim-light de assinatura.
- **md** (`box-shadow: 0 18px 42px rgba(0,0,0,0.34)`): hover de cards e eventos — resposta a estado.
- **lg** (`box-shadow: 0 28px 68px rgba(0,0,0,0.44)`): modais e overlays no topo da pilha.

### Named Rules
**A Regra da Luz de Borda.** Todo painel elevado carrega o filete `inset 0 1px 0 rgba(255,255,255,0.025)` no topo. Sem ele, a superfície escura achata e parece um app de 2014. Se o card parece colado no fundo, falta o rim-light.

## 5. Components

### Buttons
- **Shape:** cantos suaves (10px).
- **Primary:** fundo accent (`#8aa4bf`), texto `accent-text` (`#071018`), padding 9px 16px, sombra de projeção. O único botão com fundo saturado.
- **Hover / Focus:** primary sobe para `accent-hover` e `translateY(-1px)`; foco visível com `outline: 2px solid var(--accent)` e offset 2px em todas as variantes.
- **Ghost:** transparente, texto secundário, borda fina (`1px var(--border)`); preenche com `--surface` no hover. Ação secundária.
- **Danger:** fundo coral, texto escuro. Ações destrutivas, sempre deliberadas.
- **Disabled:** opacidade 0.5, `pointer-events: none`.

### Chips / Badges
- **Style:** pílula (`border-radius: 999px`), fundo semântico tingido + texto da mesma cor (ex.: `success-bg` + `success`). Padding compacto (2px 10px), peso 700, ~11px.
- **State:** uma cor por estado (agendado/estudei/atrasado/não). A cor É a informação.

### Cards / Containers
- **Corner Style:** 14px (`--radius-md`).
- **Background:** `--card` (`#121821`) no corpo; `--card-header` (`#151d27`) no topo.
- **Shadow Strategy:** `panel` em repouso (ver Elevation), `md` no hover de cards interativos.
- **Border:** transparente por padrão; a separação vem da sombra e do tom, não da linha. Divisor interno usa `--panel-divider`.
- **Internal Padding:** 20px no corpo, 16px 20px no cabeçalho.
- **Stat-card:** variante de métrica com faixa de 3px no topo (cor = categoria), valor em Display 800/28px. **Não** é o template hero-metric: o número serve à leitura, sem gradiente nem stats decorativos de apoio.

### Radius Scale
- **xxs** (`--radius-xxs: 2px`): preenchimentos minúsculos de gráfico/progresso.
- **compact** (`--radius-compact: 3px`): trilhas e detalhes retangulares muito baixos.
- **xs** (`--radius-xs: 4px`): foco especial, stripes e detalhes internos pequenos.
- **tight** (`--radius-tight: 6px`): controles densos, handles e blocos internos compactos.
- **sm** (`--radius-sm: 8px`): inputs e superfícies compactas.
- **control** (`--radius-control: 10px`): botões, botões outline e cards interativos de evento/popover.
- **card-sm** (`--radius-card-sm: 12px`): cards secundários e skeletons.
- **md** (`--radius-md: 14px`): cards e painéis padrão.
- **modal** (`--radius-modal: 16px`): modais e superfícies de foco.
- **lg** (`--radius-lg: 18px`): superfícies maiores.
- **loose** (`--radius-loose: 20px`): pills largas e painéis com composição mais aberta.
- **xl** (`--radius-xl: 24px`): overlays/contêineres grandes já existentes; não usar em cards comuns.
- **pill** (`--radius-pill: 999px`): chips, badges e indicadores circulares/pílula.

### Inputs / Fields
- **Style:** fundo `--card`, borda fina `--border`, raio 8px, texto primário; placeholder em `--text-muted` com `opacity: 1` (contraste AA, não cinza-fantasma).
- **Focus:** `outline: 2px solid var(--accent)` + halo de 3px (`box-shadow: 0 0 0 3px var(--accent-light)`) + borda accent.

### Navigation
- **Sidebar** escura (gradiente próprio), itens em 13.5px/600.
- **Default:** texto `--sidebar-text`. **Hover:** fundo `--sidebar-hover` tingido + texto primário. **Active:** fundo `--accent-light` + texto/ícone accent.
- **Foco:** outline accent 2px. **Mobile:** colapsa (comportamento estrutural, não tipografia fluida).

### Event Card (componente assinatura)
Cartão de sessão de estudo: faixa de status de **4px na frente** (cor = estado), ícone da disciplina, info (título + sub) e ações (44px, alvo de toque). Faixa lateral de 3-4px só é permitida quando codifica **status ou categoria**: estado da sessão, previsão de risco ou cor da disciplina/calendário. Fora desses casos, faixa lateral decorativa é proibida porque o accent não é ornamento.

### Timer (Mono)
Cronômetro em DM Mono, 32px/500, letter-spacing 1px — a Regra do Mono-para-Medida em sua forma mais pura.

## 6. Do's and Don'ts

### Do:
- **Do** usar o accent em ≤ 10% da tela: ação primária, item ativo, foco, seleção. Inativo é neutro.
- **Do** tratar densidade como recurso: muita informação útil, **ordenada por hierarquia e alinhamento**. Denso, nunca poluído.
- **Do** carregar todo painel elevado com o rim-light `inset 0 1px 0 rgba(255,255,255,0.025)`.
- **Do** usar DM Mono apenas para valores quantitativos; Plus Jakarta para todo o resto.
- **Do** verificar contraste AA nos oito temas, não só no Grafite. Corpo ≥ 4.5:1; texto grande ≥ 3:1; placeholder ≥ 4.5:1.
- **Do** manter foco visível (outline 2px accent, offset 2px) em todo elemento interativo e alvos de toque ≥ 44px.
- **Do** respeitar `prefers-reduced-motion` com crossfade/transição instantânea; transições de 150–250ms para estado.
- **Do** manter escala px fixa e vocabulário de componentes idêntico nas 13 telas.

### Don't:
- **Don't** usar cards com gradiente nem o template **hero-metric** (número gigante + label minúsculo + stats de apoio + accent em degradê). É o SaaS genérico que esta identidade rejeita.
- **Don't** cair no **corporativo/estéril**: Material Design padrão, cinza empresarial, planilha de RH.
- **Don't** confundir densidade com poluição: informação sem hierarquia, alinhamento ou respiro é tão ruim quanto um SaaS vazio.
- **Don't** usar gradiente em texto (`background-clip: text`). Ênfase vem de peso e tamanho.
- **Don't** usar glassmorphism decorativo como padrão. Profundidade é sombra + rim-light, não desfoque.
- **Don't** usar `border-left`/`right` > 1px como faixa lateral decorativa. A exceção de 3-4px existe apenas quando a faixa codifica status ou categoria.
- **Don't** pôr cor saturada em estado inativo, nem fonte de display em label, botão ou dado.
