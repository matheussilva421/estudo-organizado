# Débitos locais F3/F4

## localStorage na Home

- `persist` passou a retornar sucesso/falha; `commitDashboard` e `undoLayout` exibem aviso quando o write falha.
- A ordem permanece apenas em memória e volta à última persistida após reload; nenhum fato acadêmico é alterado.
- Teste: `f7-ux-premium-home.spec.ts` injeta `QuotaExceededError` para a chave do dashboard, move um widget, vê o aviso e confirma a reversão.
- Status: PASS_LOCAL.

## F3 — prova vencida

- A Reta Final ativa com `examDate` anterior a hoje exibe aviso: data não comprova realização e o desfecho deve ser confirmado.
- Não encerra, não altera cenário e não cria notificação duplicada.
- Teste: `f3-final-stretch-ui.spec.ts` com prova em 2026-01-01; status permanece ACTIVE.
- Status: PASS_LOCAL.

## F4-T13

- Definição original: suspensão física do sistema operacional por horas.
- Não houve suspensão da máquina. Simulações de clock, interrupção e retomada seguem nos testes de F4.
- Protocolo manual: backup, sessão sintética ativa, anotar horário, suspender o aparelho por período controlado, retomar, comparar tempo verificado/incerto, registrar resultado e recuperar.
- Status: NOT_RUN_ENVIRONMENT; simulação PASS_SIMULATED.

## Outras ressalvas

- F4 INCOMING parcial permanece documentado.
- NVDA/Narrator, toque, hardware e zoom nativo manual: NOT_RUN_ENVIRONMENT.
