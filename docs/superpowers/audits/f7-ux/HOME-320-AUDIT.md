# Auditoria da Home em 320 px — F7-UX G3

Fixture: harness sintético (resetF7Ux + seedAcademicData), nenhum dado pessoal. Teste: apps/v2/tests/e2e/f7-ux-home-320.spec.ts.
Viewports: 320×720, 390×844, 834×1112, 1280×900; zoom de texto 200% em 320 px; teclado; temas grafite (escuro) e terminal (alto contraste).

## Defeito material encontrado

1. Com texto a 200% em 320 px a página media 446 px de largura (overflow horizontal). Causa: .widget-value sem quebra e rótulos de .count-card com palavra longa em caixa alta.
2. Em 320 px a Home colocava os controles de personalização (482 px de altura) antes dos widgets: a grade acadêmica começava em y=982 e a próxima ação só aparecia na terceira dobra.

## Correção aplicada

- styles.css: .widget-value com max-width 100% e overflow-wrap: anywhere; .count-card/.count-label com min-width 0 e quebra.
- Ordem do DOM corrigida: a grade de widgets e a contagem vêm antes dos controles em todos os viewports. A primeira tentativa usou apenas CSS order, mas a revisão independente mostrou que isso quebrava a ordem de foco; o CSS order foi removido e os blocos foram movidos no JSX. Alertas continuam antes da grade.
- Nenhum alerta, estado de recuperação ou controle foi ocultado; os controles apenas passaram para depois dos widgets.

## Medições antes/depois (320 px)

| Métrica | Antes | Depois |
|---|---|---|
| Largura de rolagem a 100% | 320 | 320 |
| Largura de rolagem a 200% | 446 | 320 |
| Topo da grade de widgets | 982 px | 183 px |
| Topo da próxima ação | 982 px | 183 px |
| Topo dos controles | 183 px | 1863 px |

Em 390 px a grade começa em 160 px; em tablet 99 px e desktop 98 px. A ordem DOM medida é view-header → dashboard-grid → home-counts → home-controls, igual à ordem visual em todos os viewports.

## Teclado, temas e alvos

- Tab a partir do topo: foco visível com outline de 2 px (medido).
- Capturas em tema escuro (grafite) e alto contraste (terminal) em 320 px.
- P2: quatro links de texto medem menos de 24 px de altura (badge de integridade 21 px, dois links Abrir 19×30, link Central de Atenção 21 px). São links inline; ficam documentados, sem alteração de layout nesta rodada.

## Evidências externas

- Antes: C:\Projetos\outputs\f7-ux-aderencia-20261110\evidence\home-before\ (capturas, métricas e JSON).
- Depois: C:\Projetos\outputs\f7-ux-aderencia-20261110\evidence\home-after-dom\ (capturas, métricas, temas e teclado). A pasta home-after contém a tentativa intermediária com CSS order e não deve ser usada como prova final.
- O teste final passa em 320/390/tablet/desktop, no zoom de 200% e no foco por teclado.

Parecer: **DEFEITO MATERIAL CORRIGIDO E VERIFICADO EM 320 px**; restam apenas os quatro links pequenos como P2.

