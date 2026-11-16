# Revisões independentes

Duas revisões somente leitura, sem P0. Uma apontou P1 material no plano legado, corrigido nesta rodada.

## Visual/UX/evidências (agente Arendt)

- Status proposto honesto; quatro HIGH com mitigação local.
- P2 corrigidos: mensagem de sucesso da sugestão não aparece quando o write falha; contagens de `f7-restore`/`restore-preview` corrigidas; contagem E2E e comando de reprodução esclarecidos; ordem de rollback invertida para mais novo primeiro.
- E2E do revisor não iniciou por falha de preview; números de suíte são registros do autor.

## Integridade/domínio (agente Aquinas)

- Confirmou tamanho/quota, outbox multiaba e tombstone/restore.
- **P1:** `recognizeLegacyFormat`/`convertLegacyV1InIsolation` não tinham caller no runtime; os testes provavam helpers, não o fluxo do produto.
- **Correção:** `validateRemoteEnvelope` passou a rejeitar `schemaVersion` futuro/desconhecido; ele é usado por `change-feed` e `rebaseline`. Novo teste `f7_rejects_future_remote_schema_version_without_apply`.
- P2 corrigidos: contagens, mensagem de sugestão, rollback e documentação. Widgets personalizados também passaram a sinalizar falha de `persist`.
- Análise estática; não reexecutou a suíte.

## Limites

Emulador, NVDA/Narrator, toque, hardware e zoom nativo manual não foram executados. Revisores não reexecutaram a regressão completa.
