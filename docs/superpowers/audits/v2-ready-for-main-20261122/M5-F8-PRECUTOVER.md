# M5 — F8 pré-cutover, sem executar produção

**Status:** `F8_PRECUTOVER_ENGINEERING_READY` (ensaios sintéticos), sem G5 e sem cutover.

## Ferramenta read-only

Foi adicionado `auditLegacyV1DryRun` em `apps/v2/src/platform/legacy/v1-dry-run.ts`. A ferramenta:

- reconhece o schema V1 e as versões de IDB suportadas;
- conta editais, eventos, questões e blocos;
- valida IDs estáveis, duplicatas, referências órfãs, `planoRemoto` ausente e chaves não mapeadas;
- calcula SHA-256 canônico da entrada;
- nunca escreve e nunca acessa a rede.

O teste `tests/unit/f8-v1-dry-run.test.ts` cobre fixture sintética completa com **5 registros e 0 perdas estruturais**, IDs duplicados, referência órfã, plano remoto ausente, IDB não suportado e ausência de rede. Resultado: 5/5 PASS.

`ZERO_LOSS_CANDIDATE` é uma classificação estrutural, não uma autorização de migração. A equivalência semântica e o acervo real continuam dependentes de G5.

## Ensaios de freeze/interrupção já cobertos

- Duas abas/outbox/CAS e lost ACK: suíte local F7 eunit.
- Tombstone/rebaseline e restore: suíte local F7.
- Duas identidades A/B reais: Rules e isolamento cross-UID.
- Worker/KV real: upload imutável, AES-GCM, read-back, restore, wrong key e última cópia.
- Falhas de quota/rede locais: testes F2/F3/F7; não são falhas reais de produção.

## Limites e contingência

- Nenhum export real da V1 foi lido, nenhum dado acadêmico real foi migrado e nenhum freeze produtivo foi executado.
- Rollback de código não é rollback de dados. Depois de um corte real, novos dados V2 exigiriam reconciliação antes de retornar à V1.
- Não há escrita dual V1↔V2 nem ponte bidirecional.
- A issue #108 permanece aberta; este pacote registra apenas o estado pré-merge.

## Checklist operacional para a fase posterior (G5)

1. Autorização humana explícita, janela e comunicação.
2. Backup V1 real restaurável, com manifesto, hash e teste read-only.
3. Freeze V1 verificável em todas as origens e dispositivos.
4. Migração dry-run no snapshot real, com contagens, referências, órfãos e quarentena.
5. Ativação single-writer V2, autenticação Google real e read-back.
6. Monitoramento de quota/erros, contingência e critério de retorno.
7. Aceite G5 e encerramento da issue somente com prova produtiva.

Nada acima foi executado neste GOAL.

