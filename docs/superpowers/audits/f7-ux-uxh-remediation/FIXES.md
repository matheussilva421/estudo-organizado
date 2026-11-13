# Correções e achados

## Revisão visual independente (agente Russell)

| ID | Severidade | Achado | Correção | Prova |
|---|---|---|---|---|
| V1 | P1 | Studios pareciam dashboards genéricos, com buracos | Knowledge em faixa única; Revisões e Análises em duas colunas independentes | `evidencia-geral/modules-full/*.png` |
| V2 | P1 | Fila de Revisões enterrada | fila e sugestões passam a abrir o workspace | `reviews-desktop-full.png`; teste de ordem |
| V3 | P1 | Capacidade escondia sobrecarga | excesso explícito e barra >100% | `states/planning-capacity-overload.png` |
| V4 | P1 | Comparação não correspondia ao checkpoint restaurado | seleção, comparação com a revisão atual e confirmação | `states/planning-history.png` |
| V5 | P1 | Prévia de encerramento sem foco e com semântica errada | grupo rotulado, heading focável, retorno de foco | `states/final-stretch-close-preview.png` |
| V6 | P1 | Hábito atual atribuído a sessão antiga | vínculo histórico declarado como não demonstrado | `states/session-habit-context.png` |

## Revisão funcional independente (agente Euclid)

| ID | Severidade | Achado | Correção | Prova |
|---|---|---|---|---|
| F1 | P1 | `.table-grid` de Análises sem `grid-column`, ocupando 1/12 | bloco passou a ocupar 12 colunas | teste de largura do grid |
| F2 | P2 | Capacidade mascarava déficit | coberto por V3 | teste de sobrecarga |
| F3 | P2 | Comparação não acompanhava o alvo | coberto por V4 | teste de alvo -1/-1 |
| F4 | P2 | Hábito anacrônico | coberto por V6 | teste `UNDEMONSTRATED` |

## P2 corrigidos nesta rodada

- Códigos internos substituídos por rótulos: `CYCLE`, `MANUAL`, `AUTO`, `OCCURRED`, `CLOSED`, `TIMER`, `DAILY`, `TIME`, `situação`.
- Datas de checkpoint e de encerramento formatadas em pt-BR.
- Atalhos do guia passaram de 0,74 rem para 0,80 rem e alvo de 32 px.
- Seletor de tema mobile mostra o nome do tema.
- Home: CTA secundário deixou de sair do cartão; link "Ajustar planejamento" não cobre mais o texto.

## P2 pendentes (registrados, não mascarados)

- Ilustrações do calendário e dos quatro recursos continuam lineares; o herói usa a cena original.
- F5 permanece referência de auditoria sem tela própria; F4 abre a sessão.
- Em 320×568 o CTA secundário do herói exige rolagem para aparecer.

## Segunda rodada independente (delta)

- O painel vazio "Série por dia" foi apontado como P2 visual; o `.table-grid` de Análises passou a usar `align-items: start` e a captura foi regerada.
- DV-14 e VA-14 voltaram a `PARTIAL_JUSTIFIED` porque o inspetor de assunto continua básico, como a própria fidelidade visual registra.
- O manifesto passou a separar `codeHead` (454f27e5) de `documentationHead`, e o checksum deixou de listar o gerador temporário.

