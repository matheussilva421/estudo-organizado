# Task 9 — status e distinção sincronizado/local

## Resultado

Implementação concluída e confirmada pelo controlador. O modo V1 passa a distinguir
`sincronizado`, `sincronizando`, `salvo-neste-dispositivo` e
`atencao-necessaria` no painel de Configurações já existente.

- ACK remoto é obrigatório para `sincronizado`; listener ativo sem recibo não é ACK.
- Writes pendentes aparecem como `sincronizando` sem afirmar envio concluído.
- Offline e Auth ausente preservam a indicação local.
- Erro persistente vira atenção acessível em vez de sincronização indefinida.
- Um conflito de entidade produz atenção localizada e informa que os demais itens seguem
  normalmente.
- O modo V1 não exige botão manual de sincronização e mantém exportação, recuperação
  JSON, backup e controles avançados.
- Há um único `data-testid="sync-center"` e um único indicador V1.
- O gate first-use T5 permanece antes da edição e do status.

## Arquivos

- `src/js/sync/v1-next/status.js` (novo): derivação pura, bridge de eventos e leitura do
  outbox/conflitos locais para o indicador.
- `src/js/sync/sync-center.js`: integra o estado V1 ao modelo de painel existente.
- `src/js/views/config/sync-center.js`: renderiza o indicador acessível no painel único e
  suprime o CTA manual no modo V1.
- `src/js/store/indexeddb.js`: alerta nativo de saída limitado a save local ou outbox V1
  ainda pendente; textos customizados seguem sujeitos ao navegador.
- `tests/unit/v1-next-status.test.js` (novo).
- `tests/unit/sync-center.test.js`: integração do estado V1 ao modelo existente.
- `tests/e2e/v1-next-sync-status.spec.js` (novo).

## Verificação

- Status unitário: **PASS 8/8** (confirmação do controlador).
- E2E `v1-next-sync-status.spec.js`: **PASS 5/5** (confirmação do controlador), cobrindo
  T5, local sem ACK, pending até ACK real, offline, conflito isolado, erro persistente,
  `aria-live` e ausência de painel/botão manual duplicado.
- Regressão focada: **PASS 142/142** em `v1-next-status`, `sync-center`, `config-view`,
  `save-status`, `store-indexeddb-imports` e `v1-next-worker`.
- ESLint focado: **PASS**, sem erros em `status.js` e nos arquivos modificados.
- `npm test` global: **INTERROMPIDO** a pedido do controlador para fechamento; não há
  resultado final e não é apresentado como PASS.
- Playwright exigiu escalação para loopback local nas portas usadas pelo runner.

## Limites e isolamento

- Não foram alterados worker/sync para esconder falhas.
- T7/T10 em andamento foram preservados e não entram neste commit.
- Sem dados reais, V2, push, deploy, backup ou subagentes.
- O navegador pode substituir o texto customizado de `beforeunload`; o gate só solicita
  confirmação quando ainda há pendência local ou de sincronização.

## Commit

Commit local T9 criado imediatamente após este relatório, incluindo somente os arquivos
acima e este relatório.
