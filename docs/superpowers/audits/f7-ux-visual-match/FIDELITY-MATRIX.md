# Matriz de fidelidade visual — Home 1586x992

**Base:** v11, dados sintéticos de primeiro uso. **Referência:** quatro mockups originais do kit 2026-11-12. **Captura:** Chromium 1586x992, zoom 100%, sem scroll, fontes locais.

## Método

Boxes de referência foram estimados por inspeção de pixels dos PNGs originais; boxes do app foram medidos por DOM em Playwright. A comparação usa sobreposição 50/50 e mapa de diferença, não SSIM global. Conteúdo real, estado vazio e controles extras contratuais são avaliados separadamente.

## Geometria por região

| Região | Referência (x,y,w,h) | App v9 (x,y,w,h) | Desvio principal |
|---|---|---|---|
| Rail/sidebar | 0,0,294,992 | 16,0,295,992 | +16 px à direita, largura +1 |
| Topbar | 294,0,1292,65 | 351,0,1219,56 | +57 x, -9 altura |
| Título/saudação | 335,80,700,80 | 351,88,900,80 | +16 x, +8 y |
| Hero | 335,160,1235,270 | 351,160,1219,270 | +16 x, altura equivalente |
| Faixa de passos | 335,441,1235,50 | 351,448,1219,36 | +16 x, +7 y |
| Bento (3 cartões) | 335,500,1235,150 | 351,500,1219,~190 | topo equivalente, altura +40 |
| Recursos | 335,660,1235,95 | 351,~700,1219,~100 | +16 x, +40 y |
| Rodapé/contadores | 335,916,1235,40 | 351,873,1219,29 | contadores reais substituem legenda |

Rail, topbar, título, hero e passos alinham dentro de 2% da largura/altura. Recursos ficam ~40 px abaixo por altura real do Bento; cartões Bento ainda são mais altos que a referência.

## Oito critérios

| Critério | Status | Evidência e limite |
|---|---|---|
| 1. Estrutura e distribuição | PASS_EVIDENCED | Rail, topbar, hero, passos, bento e recursos nas faixas medidas; overlay v9. |
| 2. Hierarquia e proporção do hero | PASS_EVIDENCED | Hero 260 px contra ~270 do mock; arte ocupa ~46% e usa recorte real; CTA e segundo CTA reais. |
| 3. Composição dos cartões | PARTIAL | Proporções 1/1,08/1,25, anel 110 px e moldura de gráfico; altura ~40 px maior e conteúdo vazio real difere do mock. |
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
| Sessions | Visão de estado, histórico recente, concluídas hoje, recuperação, timer e Foco | Modo Foco mantém mesma sessão/clock |
| Settings | Galeria dos 12 temas em destaque antes do diagnóstico, categorias e integridade separada | refinamento fino de detalhes |

## Instrumentos

- visual-match-v9/instrumentos/TEMA-overlay-50.png
- visual-match-v9/instrumentos/TEMA-diff.png
- visual-match-v9/TEMA-desktop.png
