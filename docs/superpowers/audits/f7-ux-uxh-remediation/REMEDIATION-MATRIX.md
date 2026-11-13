# Matriz de remediação

| Achado | Origem | Correção | Teste | Captura | Commit |
|---|---|---|---|---|---|
| Contraste 1,46:1 nos atalhos | GOAL T2 | pílulas temáticas | 36 amostras ≥ 4,5:1 | `contrast/*.png` | 862db594 |
| Overflow em 320/200% | auditoria | quebra de palavras e largura | teste de overflow | `contrast/content-guide-*` | 862db594 |
| Studios em coluna única | revisão visual | grids (862db594) e depois duas colunas (92745e0a) | ordem e largura | `modules-full/*` | 92745e0a |
| Fila de Revisões enterrada | revisão visual | fila antes da política | ordem do DOM | `reviews-desktop-full.png` | 2ae4d012 |
| Análises com 8 cartões | revisão visual | escopo em linha + KPI dominante | larguras | `analytics-desktop-full.png` | 2ae4d012 |
| `.table-grid` em 1/12 | revisão funcional | 12 colunas | largura ≥ 90% | `analytics-desktop-full.png` | 92745e0a |
| Capacidade com `max(0)` | ambas | excesso explícito | 400% / 90 min | `states/planning-capacity-overload.png` | 2ae4d012 |
| Comparação dos 2 mais recentes | ambas | alvo × revisão atual | -1/-1 | `states/planning-history.png` | 2ae4d012 |
| Foco da prévia de encerramento | revisão visual | grupo + heading focável | foco/retorno | `states/final-stretch-close-preview.png` | 2ae4d012 |
| Hábito anacrônico | ambas | vínculo não demonstrado | CURRENT/UNDEMONSTRATED | `states/session-habit-context.png` | 2ae4d012 |
| UUID cru em F4/F5 | revisão visual | carregar sessão e rotular F5 | data/estado/medições | `states/review-evidence-drilldown.png` | 2ae4d012 |
| Códigos internos | revisão visual | rótulos pt-BR | testes de texto | estados | 2ae4d012 |
| CTA fora do herói | usuário/revisão | `nowrap` + geometria | f7-ux-premium-layout | `premium/home-*` | 92745e0a |
| Tema só com glifo | revisão visual | nome do tema | f6 shell | `comparacoes/*-320*` | 862db594 |

