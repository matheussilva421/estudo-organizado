# Matriz UX — DV/VA e roteiro UX-H

**Estado:** `UX_HUMAN_PENDING`. Nenhum item desta matriz é `PASS_HUMAN_UX`.

As capturas atuais usam apenas fixtures sintéticas e estão em `F7-UX-CAPTURES/`. A captura principal de Análises inclui drill por edital; o sheet de Revisões está capturado em mobile.

## DV/VA reconciliados

| ID | Estado local | Evidência | Limite |
|---|---|---|---|
| DV-05 | PARTIAL | ordem manual, undo, reload e falha de escrita em `f7-ux-premium-home.spec.ts` | controle explícito de fixar/desligar adaptação sem prova dedicada |
| VA-07 | PASS_LOCAL | consentimento de ordem em PERFORMANCE/FINAL_STRETCH | julgamento visual humano |
| DV-06 | PARTIAL | Home Bento e grids de Knowledge/Reviews/Insights | diferenciação dos studios exige UX-H |
| DV-08 | PARTIAL | painéis contextuais e conflito persistente em Foco | hierarquia exige julgamento humano |
| DV-13 | PASS_LOCAL | drill por edital/disciplina em `f7-ux-attention-analytics.spec.ts` e captura `analytics-drill-edital-desktop.png` | histórico humano real |
| VA-13 | PASS_LOCAL | KPI, gráfico, tabela, período, metodologia e drill usam a mesma fonte | aceite visual humano |
| DV-17 | PASS_LOCAL no escopo implementado | sheet de filtros em 320/390, foco, Escape e 200% | não exige um sistema universal de sheets |
| VA-17 | PASS_LOCAL no escopo implementado | sheet da fila e telas completas para operações complexas | avaliar outras operações rápidas |
| DV-18 | PASS_LOCAL amostrado | alertas inline, conflito persistente e conflito resolvido | movimento/proeminência exige inspeção humana |
| VA-06 | PASS_LOCAL | cinco contextos da Home com fixtures em `f7-ux-premium-home.spec.ts` | hardware e benchmark são VA-20, não VA-06 |
| VA-20 / AC-22 | PASS_AUTOMATED / MANUAL_NOT_RUN | contraste, foco, redução de movimento e WCAG automatizados | NVDA/Narrator, toque, zoom nativo e hardware |

## Divergências corrigidas

- A FULL descrevia DV-13/VA-13 no domínio F4/F5; agora aponta para Insights e Analytics.
- A DELTA usava “idem” para DV-13/VA-13; a evidência correta é o drill de Analytics.
- VA-06 não é reprovada por benchmark de hardware; as fixtures de contexto estão provadas.
- DV-17/VA-17 não exigem framework universal de sheets.
- O typo `+## F0` da matriz de remediação foi corrigido.
- O checklist UX-H foi substituído por um roteiro que destaca os itens realmente abertos.

## Pendências humanas reais

| Item | Severidade | Ação humana |
|---|---|---|
| A-01 — quatro links inline abaixo de 24 px | P2 | aceitar exceção de links inline ou pedir ajuste visual |
| C-01 — mensagem genérica ao iniciar revisão em duas abas | P2 | reproduzir e decidir se a mensagem precisa melhorar |
| C-02 — CAS conflitante de transição não retoma o rascunho automaticamente | P2 | reproduzir em dois cenários e validar o rascunho preservado |
| F4-T13 | material | ensaio físico de suspensão/retomada |
| Acessibilidade manual | material | NVDA/Narrator, toque, zoom nativo e hardware modesto |

## Roteiro UX-H curto

1. **Home:** Onboarding, Daily, Active, Final Stretch e Performance; mover widget, desfazer, recarregar e simular falha de persistência.
2. **Conteúdo:** edital, disciplina, assunto e aula; abrir inspetor, arquivar e repetir em 320 px.
3. **Planejamento:** dois cenários, prévia/cancelamento, capacidade 90 min, Semana/Mês/Lista/Dia, Reta Final e histórico.
4. **Sessões:** iniciar/pausar/retomar, Pomodoro, manual, histórico e conflito em Foco compacto.
5. **Revisões:** abrir, iniciar, concluir e avaliar; política com prévia; evidência F5/F4; sheet em 320/390.
6. **Análises:** KPI, gráfico e tabela, período, metodologia, amostra baixa, vazio e Explorar recorte por edital/disciplina.
7. **Configurações/sync/backup:** 12 temas, backup SAFE, quota, update bloqueado por outra aba e consentimento.
8. **Shell/acessibilidade:** teclado, Command Center, sheet, foco, Escape, 200% em 320 e links A-01.

Se NVDA/Narrator, toque ou hardware não existirem, registrar `NOT_RUN_ENVIRONMENT`. O ZIP não substitui o aceite do proprietário.
