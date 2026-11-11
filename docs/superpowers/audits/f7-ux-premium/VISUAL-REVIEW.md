# Revisão visual — comparação com os quatro mockups

Referências recebidas em 11/11/2026 (1586 x 992), preservadas em comparacoes/referencias. Capturas reais do Chromium em comparacoes/capturas-v2 e comparacoes/comparacoes (lado a lado). Nenhuma imagem gerada foi usada como captura.

## Matriz dos oito critérios do adendo

| Critério | Estado | Justificativa e evidência |
|---|---|---|
| 1. Estrutura e distribuição | RESOLVED | Rail emoldurado, cabeçalho compacto, hero amplo, faixa de passos, bento e recursos. Capturas vazio/dados desktop, tablet, 390 e 320. |
| 2. Hierarquia e proporção do hero | PARTIAL | Hero é a superfície dominante com título, descrição e CTA; segundo CTA existe apenas no primeiro uso. Referência tem dois CTAs sempre e texto mais curto. |
| 3. Composição dos cartões | PARTIAL | Larguras variadas, ícones, resumo com contagens reais, minigráfico de foco e visão de fila de Revisões e visão de biblioteca do Knowledge. Referência tem anel de meta e gráfico maior; não inventamos dados. |
| 4. Tipografia, densidade e espaçamento | RESOLVED | Revisão final reduziu rail para 214 px, hero, paddings (14–24 px), títulos e lacunas; primeira dobra mostra hero e cartões como a referência. |
| 5. Profundidade e iluminação | PARTIAL | Gradientes radiais, bordas translúcidas e sombras seletivas; sem a fotocomposição luminosa dos mockups. |
| 6. Elementos ilustrativos | PARTIAL | Cena de estudo vetorial temática (luminária, livros, notebook), adaptável aos 12 temas; não é cópia da imagem-fonte. |
| 7. Navegação e controles | RESOLVED | Rail com ícones, busca arredondada, ações de Atenção/Configurações, Command Center premium e 44 px no toque. |
| 8. Adaptação mobile | RESOLVED | Cabeçalho em grade própria, busca em linha, tema/ações compactos, ilustração abaixo do texto, barra inferior preservada; sem overflow em 320/390. |

## Arquivos lado a lado

- neon-teal-vazio-lado-a-lado.png e neon-teal-dados-lado-a-lado.png
- esmeralda-dourado-vazio-lado-a-lado.png e esmeralda-dourado-dados-lado-a-lado.png
- azul-ambar-vazio-lado-a-lado.png e azul-ambar-dados-lado-a-lado.png
- azul-glacial-vazio-lado-a-lado.png e azul-glacial-dados-lado-a-lado.png

## Adaptações intencionais

Dados fictícios dos mockups (75%, revisões inventadas, gráfico ilustrativo, Ctrl K) foram substituídos por estados reais: ausência vira "Sem dado no período"; Atalho permanece Ctrl+Shift+K; zeros reais não são escondidos. A ilustração é vetorial e segue o acento do tema. O rail mantém nove destinos funcionais em vez dos seis do conceito.

## Prova por DOM

Os testes verificam ordem dos widgets, rótulos acessíveis, foco, contagens, contraste de 12 temas, alvos de 24/44 px, ausência de overflow e comportamento funcional. Capturas sozinhas não foram tratadas como prova.
