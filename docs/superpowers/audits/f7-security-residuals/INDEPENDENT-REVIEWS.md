# Revisões independentes

Duas revisões somente leitura foram feitas sobre o commit `a4e74f19` e revalidadas no delta `c436a6ee`; o commit `48de3ac0` é apenas o reforço de asserção do teste de mismatch. Nenhum P0/P1 ficou aberto.

## Revisor A — Tesla (Security Rules/Firestore/F7)

Veredito inicial: **APPROVE_WITH_NOTES**. Revalidação do change órfão: **APPROVE**.

- R1: a cadeia causal de entidade foi considerada fechada para create, update e tombstone; o change órfão sem entity write foi reproduzido e fechado no commit `c436a6ee`.
- R2: a reconciliação só vira sucesso com receipt de mesmo operationId, entityId e digest; não há ACK falso. A revalidação confirmou que o delta do change órfão não afeta a recuperação.
- R3: os 17 tipos batem entre `KNOWN_REMOTE_ENTITY_TYPES`, `STORE_BY_ENTITY_TYPE` e Rules; desconhecidos falham fechado.
- R4: pai somente leitura; subcoleções independentes.
- Orçamento: a contagem estática conservadora é de **19 acessos documentais** no pior caminho, contra 20 do limite de transação; o emulador passou sem erro de limite. A margem é de uma chamada.

### P2 residuais do revisor A

1. Entidade legada criada antes das Rules e sem head pode iniciar a cadeia nova na revisão 2; a atualização é auditada, mas a origem da revisão 1 não é reconstruída.
2. O `payloadDigest` é validado sintaticamente nas Rules; o hash do conteúdo não é calculado pelo Firestore Rules.
3. O receipt não vincula `kind`/`entityType`; a reutilização local de operationId é protegida pelo repositório.
4. Tipos remotos legados desconhecidos falham fechado e podem exigir migração/quarentena se existirem dados reais.
5. O teste de payload divergente foi reforçado no commit `48de3ac0` para afirmar `RemoteOperationError` e ausência de change extra.
6. O E2E regrava PNGs rastreados de evidência F4; os bytes foram preservados fora da árvore e não entraram em commits.

## Revisor B — Boyle (app/domínio/Git)

Veredito inicial: **APPROVE_WITH_NOTES**. Revalidação do delta: **APPROVE**.

- A reconciliação de R2 não inventa ACK, não duplica aplicação e não perde outbox; sem receipt correspondente, a falha permanece pendente.
- R1 não quebra rebaseline/restauração; o único produtor remoto de change escreve a entidade na mesma transação.
- R3 não deixou tipo atual de fora; exige implantar Rules e cliente juntos.
- R4 não tem uso de produto para o documento pai.
- O commit não contém PNGs nem documentos; os três PNGs atuais coincidem com `preserved-f4-final/MANIFEST.json`.

### P2 residuais do revisor B

1. A estimativa de leitura do coordenador (`operations.length * 3`) não inclui o caminho de retry/reconciliação; é estimativa local, não correctness.
2. O E2E não é hermético e regrava PNGs rastreados; resolvido por preservação externa e exclusão dos commits.
3. O log unitário bruto foi anexado após a revisão (`unit-final.log`, 883/883).

## Limites

Os revisores não executaram emulador, servidor, testes ou rede; a avaliação foi estática sobre o diff e os logs fornecidos. G-EXT continua necessário para Rules publicadas, Auth/billing/quotas, concorrência distribuída, dados legados reais e restauração produtiva.
