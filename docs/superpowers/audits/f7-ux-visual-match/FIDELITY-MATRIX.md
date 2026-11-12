# Matriz de fidelidade visual — Home 1586x992

**Base:** v9, dados sintéticos de primeiro uso. **Referência:** quatro mockups originais do kit 2026-11-12. **Captura:** Chromium 1586x992, zoom 100%, sem scroll, fontes locais.

## Método

Boxes de referência foram estimados por inspeção de pixels dos PNGs originais; boxes do app foram medidos por DOM em Playwright. A comparação usa sobreposição 50/50 e mapa de diferença, não SSIM global. Conteúdo real, estado vazio e controles extras contratuais são avaliados separadamente.

## Geometria por região

| Região | Referência (x,y,w,h) | App v9 (x,y,w,h) | Desvio principal |
|---|---|---|---|
| Rail/sidebar | 0,0,195,992 | 16,22,200,960 | +16 px à direita, largura +5, altura -32 |
| Topbar | 195,0,1391,65 | 228,12,1342,56 | início +33, altura -9 |
| Título/saudação | 220,80,700,80 | 228,99,447,35+subtítulo | +8 x, +19 y |
| Hero | 205,160,1360,270 | 228,176,1342,260 | +23 x, +16 y, -10 altura |
| Faixa de passos | 205,441,1360,50 | 228,448,1342,34 | +23 x, +7 y, mais compacta |
| Bento (3 cartões) | 205,500,1360,145 | 228,498,1342,164 | topo -2, altura +19 |
| Recursos | 205,660,1360,100 | 228,676,1342,133 | +23 x, +16 y, +33 altura |
| Rodapé/contadores | 205,916,1360,40 | 228,873,1342,29 | contadores reais substituem legenda |

Maior desvio de topo: 19 px (1,9% da altura) no título. Hero e Bento alinham dentro de 2%. Recursos ficam 16 px abaixo e mais altos por conteúdo real.

## Oito critérios

| Critério | Status | Evidência e limite |
|---|---|---|
| 1. Estrutura e distribuição | PASS_EVIDENCED | Rail, topbar, hero, passos, bento e recursos nas faixas medidas; overlay v9. |
| 2. Hierarquia e proporção do hero | PASS_EVIDENCED | Hero 260 px contra ~270 do mock; arte ocupa ~46% e usa recorte real; CTA e segundo CTA reais. |
| 3. Composição dos cartões | PARTIAL | Proporções 0,9/1,05/2,0 e alturas próximas; estados vazios reais não reproduzem anel 75% e séries fictícias. |
| 4. Tipografia e espaçamento | PASS_EVIDENCED | Títulos, pesos, linha e densidade revisados; desvios de topo ≤19 px. |
| 5. Profundidade e iluminação | PARTIAL | Gradientes, bordas e arco ambiente implementados; brilho fotográfico do mock é aproximado. |
| 6. Ilustrações | PASS_EVIDENCED | Recortes decorativos reais dos quatro PNGs, sem UI/texto, WebP 16–19 KB; fallback vetorial nos oito temas. |
| 7. Navegação e controles | PASS_EVIDENCED | Rail completo, agrupamentos, busca à direita, ações discretas, Command Center; tema extra contratual documentado. |
| 8. Adaptação mobile | PASS_EVIDENCED | 390/320 sem overflow, hero compacto, CTA na primeira dobra, D33 preservada; 200% coberto na suíte. |

Critérios 3 e 5 permanecem PARTIAL; portanto o marco não é aceite visual integral.

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
| Review | Subnavegação e histórico visual; fila/execução/política preservadas | ainda longo, não em abas exclusivas |
| Knowledge | Biblioteca, árvore, contagens e subnavegação | inspetor em painel existente |
| Planning | Visão, calendário, ciclo/reta, editor e contagens reais | composição ainda sequencial |
| Insights | Visão, explorar, recortes e comparação; drill-down real | recorte preenchido sem fixture dedicada |
| Sessions | Timer/Foco já especializados | subnavegação de estúdio pendente |
| Settings | Galeria dos 12 temas e categorias | reorganização fina pendente |

## Instrumentos

- visual-match-v9/instrumentos/TEMA-overlay-50.png
- visual-match-v9/instrumentos/TEMA-diff.png
- visual-match-v9/TEMA-desktop.png
