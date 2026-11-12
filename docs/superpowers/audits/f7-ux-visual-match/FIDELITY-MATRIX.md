# Matriz de fidelidade visual — Home e Studios

**Base:** v15, primeiro uso e fixture acadêmica sintética. **Referência:** quatro PNGs originais de 1586x992 do kit 2026-11-12. **Código:** a4b56e5e na branch local v2. **Captura:** Chromium 1586x992, zoom 100%, scroll no topo, fontes locais.

## Método

Os boxes de referência foram medidos por inspeção de pixels. Os boxes da aplicação foram medidos por DOM no Playwright e são verificados por f7-ux-premium-layout.spec.ts. A comparação usa lado a lado, sobreposição 50/50, diferença regional e linhas-guia. Conteúdo ilustrativo dos mockups não é tratado como requisito de dados.

O revisor visual independente apontou inicialmente um hero em y=152 na referência. O instrumento hero-ruler-mock.png/hero-ruler-v15.png mostra que y=152 é a linha do subtítulo; a borda superior do hero está em y=190/191 nos dois arquivos. A matriz adota a borda do componente, não a baseline do texto.

## Geometria em 1586x992

| Região | Referência (x,y,w,h) | App v15 (x,y,w,h) | Desvio |
|---|---|---|---|
| Rail | 0,0,294,992 | 0,0,294,992 | 0 |
| Busca | 955,16,443,40 | 955,16,443,40 | 0 |
| Título | 335,94,447,35 | 335,93.7,447,34.5 | ≤0,3 px |
| Subtítulo | 335,149,447,21 | 335,149.2,447,20.9 | ≤0,2 px |
| Hero | 335,191,1235,232 | 335,191.1,1235,232 | ≤0,1 px |
| Faixa de passos | 335,445,1235,30 | 335,445.1,1235,30 | ≤0,1 px |
| Bento | 335,505,1235,182 | 335,505.1,1235,182 | ≤0,1 px |
| Recursos | 335,727,1235,127 | 335,727.1,1235,127.6 | ≤0,1 px no topo |
| Cartão de recurso | ~100 px | 100 px mínimos | equivalente |

O hero também foi amostrado em RGB: referência (9,64,76) e v15 (16,60,69) em x=370,y=205. A diferença de luminosidade decorativa é pequena e não muda texto, contraste ou hierarquia.

## Dois estados desktop

| Estado | Tema | Evidência | Status |
|---|---|---|---|
| Primeiro uso | 4 temas | visual-match-v15/TEMA-desktop.png | PASS_EVIDENCED |
| Fixture acadêmica | 4 temas | visual-match-v15/data/TEMA-data-desktop.png | PASS_EVIDENCED |
| Comparação vazia | 4 temas | instrumentos/TEMA-empty-comparison.png | PASS_EVIDENCED |
| Comparação com dados | 4 temas | instrumentos/TEMA-data-comparison.png | PASS_EVIDENCED |
| Sobreposição e diff | 4 temas x 2 estados | instrumentos/TEMA-empty-overlay-50.png, -diff.png e equivalentes data | PASS_EVIDENCED |

Dados vazios reais (—, 0, “Sem série no período”) permanecem verdadeiros. Nenhum percentual, contagem ou série fictícia foi introduzido para copiar o mock.

## Oito critérios

| Critério | Status | Evidência |
|---|---|---|
| 1. Estrutura e distribuição | PASS_EVIDENCED | Rail, busca, título, hero, passos, Bento e recursos dentro de 0,3 px; hero confirmado em y=191 pelo instrumento com linhas-guia. |
| 2. Hierarquia e proporção do hero | PASS_EVIDENCED | Hero 1235x232, arte dominante de 40–55%, título editorial, corpo 0,95 rem, dois CTAs reais e fundo luminoso próximo da amostra do mock. |
| 3. Composição dos cartões | PASS_EVIDENCED | Bento 1/1,08/1,25 com 182 px; anel 112 px com valor central real; calendário preenchido; gráfico vazio com semanas; ações de 36 px. |
| 4. Tipografia e espaçamento | PASS_EVIDENCED | Títulos de recursos brancos, hierarquia e quebras próximas; 1024 e 1440 cobertos; passos em uma linha apenas em 1586 px. |
| 5. Profundidade e iluminação | PASS_EVIDENCED | Gradientes, brilho, bordas e sombras no hero, cartões, recursos e rail; quatro fundos temáticos distintos. |
| 6. Ilustrações | PASS_EVIDENCED | Recortes reais dos quatro mockups no hero, calendário vetorial com volume, gráfico e ícones temáticos sem texto de UI embutido. |
| 7. Navegação e controles | PASS_EVIDENCED | Logo de livros, marca/subtítulo, grupos primário e utilitário, divisor, citação, busca, tema, Comandos, Atenção, Configurações e avatar. |
| 8. Adaptação mobile | PASS_EVIDENCED | 390x844 e 320x568/720; header compacto, CTA principal inteiro na primeira dobra, arte e controles abaixo; D33 com cinco destinos; 200% sem overflow. |

Não resta PARTIAL visual conhecido no escopo aprovado da Home. Os critérios foram verificados por capturas reais, DOM e testes; o aceite UX-H continua exclusivamente do proprietário.

## Quatro temas Premium

| Tema | Atmosfera e rail | Cena do hero | Status |
|---|---|---|---|
| Neon Teal | azul-marinho, ciano e rail teal | própria | PASS_EVIDENCED |
| Esmeralda e Dourado | verde profundo, dourado e rail verde | própria | PASS_EVIDENCED |
| Azul e Âmbar | azul profundo, âmbar e rail azul | própria | PASS_EVIDENCED |
| Azul Glacial/Prata | grafite azulado, prata e rail glacial | própria | PASS_EVIDENCED |

Os quatro rails têm backgroundImage distinto e são verificados por teste. Os oito temas antigos permanecem disponíveis e não foram removidos.

## Studios e responsividade

| Módulo | Composição final | Status |
|---|---|---|
| Knowledge | Biblioteca com quatro contagens, lista de editais, subnavegação, árvore e campos; 4 colunas desktop | PASS_EVIDENCED; sem mock 1:1 |
| Planning | Título editorial, subnavegação, contagens, calendário, editor e reta final em camadas | PASS_EVIDENCED; sem mock 1:1 |
| Sessions/Focus | Cronômetro protagonista, controles, histórico e Foco na mesma sessão/clock | PASS_EVIDENCED |
| Review | Visão, fila, execução, histórico, política e evidência em subnavegação | PASS_EVIDENCED; sem mock 1:1 |
| Insights | KPIs, escopo compacto, gráfico/tabela, recortes, comparação e snapshots | PASS_EVIDENCED; recorte sem fixture densa |
| Settings | Galeria dos 12 temas, categorias e diagnóstico separado | PASS_EVIDENCED |
| Shell/Atenção | Command Center, badges deduplicados e alertas persistentes | PASS_EVIDENCED |

Tablet em 900x1100 usa Bento em duas colunas, evolução em largura total, recursos em duas colunas e rótulo compacto “Atenção”. As capturas de módulos cobrem desktop/tablet/390/320.

## Evidência e limites

- Capturas v15: quatro temas em desktop, tablet, 390, 320x568 e 320x720; dados desktop/390; módulos nos quatro viewports; 12 temas.
- Comparações: 4 vazias + 4 com dados, overlays 50/50 e diffs.
- Medições: f7-ux-premium-layout.spec.ts, incluindo 1586, 1440, tablet, 320x568, rail temático e 200% no teste móvel existente.
- Não executado: NVDA/Narrator, hardware modesto e toque físico. Não há mock 1:1 para os Studios; a equivalência é de gramática visual, não pixel a pixel.
