# Matriz de fidelidade visual — Home 1586x992

**Base:** v13, primeiro uso com dados sintéticos. **Referência:** quatro PNGs originais do kit 2026-11-12. **Captura:** Chromium 1586x992, zoom 100%, scroll no topo, fontes locais. **Código medido:** 08700060 na branch local v2.

## Método

Os boxes de referência foram estimados por inspeção de pixels dos PNGs originais. Os boxes do app foram medidos por DOM com Playwright e transformados em regressão automatizada em apps/v2/tests/e2e/f7-ux-premium-layout.spec.ts. A comparação usa lado a lado, sobreposição 50/50 e mapa de diferença; não usa SSIM global. Conteúdo fictício dos mockups e controles extras exigidos pelos contratos são avaliados separadamente.

## Geometria após a revisão de espaçamento

| Região | Referência (x,y,w,h) | App v13 (x,y,w,h) | Desvio |
|---|---|---|---|
| Rail/sidebar | 0,0,294,992 | 0,0,294,992 | 0 |
| Busca da topbar | 955,16,443,40 | 955,16,443,40 | 0 |
| Título | 335,94,447,35 | 335,93.7,447,34.5 | ≤0,3 px |
| Subtítulo | 335,149,447,21 | 335,149.2,447,20.9 | ≤0,2 px |
| Hero | 335,191,1235,232 | 335,191.1,1235,232 | ≤0,1 px |
| Faixa de passos | 335,445,1235,30 | 335,445.1,1235,30 | ≤0,1 px |
| Bento (3 cartões) | 335,505,1235,182 | 335,505.1,1235,182 | ≤0,1 px |
| Recursos | 335,727,1235,~127 | 335,727.1,1235,127.6 | ≤0,1 px no topo |
| Cartões de recursos | ~95 px de altura | 95 px mínimos | equivalente |

O rail começa na borda esquerda; o conteúdo começa em x=335, com 41 px de coluna entre rail e conteúdo. A topbar reserva 16 px acima dos controles. A faixa de onboarding fica em uma única linha a partir de 1586 px, largura em que a linha medida cabe, e quebra sem overflow entre 1024 e 1585 px. Em 320/390 e tablet, as regras anteriores de empilhamento permanecem.

## Correções desta rodada

- Removido o recuo horizontal externo de 16 px no desktop; rail, conteúdo e largura útil agora coincidem com a referência.
- Rail refeito com 294 px, padding interno de 16 px, marca em x=24 e linhas de 41 px.
- Topbar com 16 px de respiro superior, busca de 443 px e controles compactos; Comandos permanece visível dentro do campo, agora com ícone de teclado.
- Hero reduzido de 270 para 232 px e posicionado em y=191; título, respiro interno e CTAs foram compactados para caber sem overflow.
- Introdução e quatro passos foram reunidos em home-onboarding-row; no mock de 1586 px ocupam uma única linha de 30 px.
- Bento posicionado em y=505 com 182 px de altura, mantendo proporções 1 / 1,08 / 1,25.
- Recursos posicionados em y=727 e cartões com 95 px mínimos; a regra específica preserva o layout móvel e elimina o overflow a 200% de texto.

## Oito critérios

| Critério | Status | Evidência e limite |
|---|---|---|
| 1. Estrutura e distribuição | PASS_EVIDENCED | Rail, busca, título, hero, passos, Bento e recursos medidos dentro de 0,3 px da referência em 1586x992. |
| 2. Hierarquia e proporção do hero | PASS_EVIDENCED | Hero 1235x232 em y=191; arte ocupa a metade direita e os dois CTAs reais cabem na altura. |
| 3. Composição dos cartões | PARTIAL | Proporções e altura do Bento coincidem; o estado vazio real substitui percentuais, gráfico e revisões fictícias do mock. |
| 4. Tipografia e espaçamento | PASS_EVIDENCED | Topo, linha, margens e faixa de passos cobertos pelo teste de geometria; 1440 px também testado sem overflow. |
| 5. Profundidade e iluminação | PARTIAL | Gradientes, bordas, brilho e arco ambiente são CSS; a profundidade fotográfica do mock é aproximada. |
| 6. Ilustrações | PASS_EVIDENCED | Recortes decorativos dos quatro PNGs, sem UI/texto, WebP de 16–19 KB; fallback vetorial nos oito temas antigos. |
| 7. Navegação e controles | PASS_EVIDENCED | Rail completo, busca à direita, tema, Comandos, Atenção, Configurações e avatar; foco e navegação cobertos pela suíte. |
| 8. Adaptação mobile | PASS_EVIDENCED | 320/390/tablet sem overflow; 320 px com texto a 200% também passou após a correção dos cards. |

Os critérios 3 e 5 continuam PARTIAL por diferenças de conteúdo real e profundidade fotográfica. O marco não é aceite visual integral nem UX-H.

## Quatro temas

| Tema | Cena própria | Contraste | Status |
|---|---|---|---|
| Neon Teal | sim | amostral AA | PASS_EVIDENCED |
| Esmeralda e Dourado | sim | amostral AA | PASS_EVIDENCED |
| Azul e Âmbar | sim | amostral AA | PASS_EVIDENCED |
| Azul Glacial/Prata | sim | amostral AA | PASS_EVIDENCED |

## Módulos

| Módulo | Estado visual | Limite |
|---|---|---|
| Review | Faixa contextual compacta, subnavegação e histórico visual | ainda longo, não em abas exclusivas |
| Knowledge | Faixa compacta, biblioteca, árvore, contagens e subnavegação | inspetor em painel existente |
| Planning | Visão, calendário, ciclo/reta, editor e contagens reais | composição ainda sequencial |
| Insights | Faixa compacta, visão, explorar, recortes e comparação | recorte preenchido sem fixture dedicada |
| Sessions | Estado, histórico recente, recuperação, timer e Foco | Modo Foco mantém a mesma sessão/clock |
| Settings | Galeria dos 12 temas antes do diagnóstico, categorias e integridade separada | refinamento fino de detalhes |

## Instrumentos

- visual-match-v13/TEMA-desktop.png
- visual-match-v13/TEMA-tablet.png
- visual-match-v13/TEMA-mobile-390.png
- visual-match-v13/TEMA-mobile-320.png
- visual-match-v13/instrumentos/TEMA-comparison.png
- visual-match-v13/instrumentos/TEMA-overlay-50.png
- visual-match-v13/instrumentos/TEMA-diff.png
- visual-match-v13/instrumentos/render_comparisons.py

## Testes ligados a esta matriz

- f7-ux-premium-layout.spec.ts: mede os boxes de desktop, exige desvio máximo de 1,5–3 px e valida a quebra segura em 1440 px.
- f7-ux-home-320.spec.ts: valida 320/390/tablet/desktop, texto a 200% e ausência de overflow.
- f6-navigation-layout.spec.ts: valida rail, tablets, 320 px e viewport curto com rolagem.
