# Revisões independentes — fechamento

Duas revisões somente leitura, sobre código, diff, specs e capturas. Nenhuma aprovou UX-H em nome do proprietário; ambas recomendaram `LOCAL_F7UX_CLOSURE_PARTIAL`.

## Visual/UX/a11y (agente Arendt)

Veredito: **PARTIAL**, sem P0/P1.

| Item | Parecer | Resolução |
|---|---|---|
| Knowledge / DV-14 / VA-14 | PARTIAL: escala só até 100 e ciclo de foco mobile incompleto | teste passou a abrir 50→100→120 e inspecionar o último nó; seleção e retorno de foco para assunto e aula |
| Reviews / UX-21 / DV-13 / VA-13 | PARTIAL: link do compromisso genérico; link F4 não clicado | vínculo agora aponta para o item específico e o teste clica F5, compromisso e F4 |
| Insights | RESOLVED: vazio compacto e honesto | — |
| Home | PARTIAL: PERFORMANCE sem captura | `states/home-performance.png` adicionada; consentimento verificado |
| Visual/a11y | PARTIAL: contraste cobre o guia, não toda a UI; manual pendente | registrado em `GATES-AND-RISKS.md` |

## Integridade funcional/arquitetural (agente Aquinas)

Veredito: **PARTIAL**, sem P0/P1. Confirmou que `application/`, `domain/`, `platform/`, IndexedDB, outbox, sync, backup, recovery, senha e clock não foram alterados em `454f27e5..7f37428f`.

| Achado P2 | Resolução |
|---|---|
| UX-21/R-04 marcado PASS sem prova da lista de prioridades | revertido para `PARTIAL_JUSTIFIED`; a lacuna está explícita |
| Atalho F5 pode não achar compromisso e duração 0 aparece como ausente | botão avisa quando o alvo não está entre os 12; `0 min` é exibido como 0 |
| VA-14: aula sem seleção visual e seletor CSS montado com ID | `data-selected` também na aula; destaque por comparação de `data-entity-id`, sem interpolar CSS |
| Resumo exagerava a cadeia plano→sessão→revisão | texto corrigido para “preservação de fatos entre” |
| Referências de HEAD dispersas e arquivos não rastreados | commits `1d77a93a`, `610a9673`, `819c3c66`; matriz antiga marcada como histórica; ZIP com manifesto único |

## Limites das revisões

Nenhum revisor executou NVDA/Narrator, toque físico, hardware modesto ou staging. O revisor de integridade reexecutou typecheck, lint e 880 unitários; o E2E completo foi executado pelo autor e está em `TEST-RESULTS.md`.
