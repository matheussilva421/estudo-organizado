# Segurança, Rules e migração

## R1–R4 e correção desta rodada

| ID | Correção | Evidência | Estado |
|---|---|---|---|
| R1 | entidade create/update/tombstone exige operation, change e head causais no mesmo batch; stale head e change órfão são negados | `f7-security-residuals.test.ts` | PASS_EMULATOR |
| R2 | concorrência do mesmo `operationId` reconcilia por receipt; máximo de duas tentativas e read-back antes de ACK | testes de transação, lost ACK E2E | PASS_EMULATOR / PASS_LOCAL |
| R3 | allowlist fechada e imutável de 17 `entityType`; prova sequencial dos 17 | `r3_all_known_entity_types_are_accepted_in_sequence` | PASS_EMULATOR |
| R4 | documento pai da biblioteca é somente leitura; subcoleções continuam isoladas | testes R4 | PASS_EMULATOR |
| R5 | entidade legada sem head não pode atualizar para revisão 2 iniciando uma nova sequência 1; head 0 não pode ser criado para contornar | RED reproduzido; GREEN após `requireExistingHead`, `sequence >= 2` em update e head inicial causal | PASS_EMULATOR |

O teste R5 falhou antes da correção com “Expected request to fail, but it succeeded”; depois das Rules retornou 16/16 no arquivo e 37/37 na suíte completa do emulador. A revisão independente detectou o caminho com head 0, que foi fechado antes do fechamento.

## Resíduos P2 mantidos

1. **Digest sintático:** as Rules validam 64 caracteres hexadecimais, mas não calculam SHA-256 do payload. O vínculo criptográfico é local; um cliente hostil com a mesma conta ainda pode fabricar um receipt. O limite é intrínseco ao Rules.
2. **Receipt sem `kind`/`entityType`:** o caminho `entities/{entityId}` é único por biblioteca e o tipo é imutável em update; a proteção contra reutilização divergente de `operationId` é feita no cliente e pelo receipt. O shape mínimo é aceito como contrato.
3. **Orçamento de Rules:** contagem estática conservadora de 19 acessos documentais contra limite de 20 no pior caminho; o emulador não expõe contador interno. A correção R5 não adicionou leitura.
4. **Retries:** o adaptador tenta no máximo duas vezes e usa lookup por receipt antes de declarar sucesso; backoff local permanece limitado e não deve ser confundido com garantia de quota real.
5. **Entidade remota legada sem head:** o fluxo permanece fail-closed e pode precisar de rebaseline explícito; o cliente não inventa autoridade nem aplica dado inseguro.

## Legado e migração

- Fixtures sintéticas cobrem schemas V1 12/11/9/7, IndexedDB 7/6 e Reta Final/issue #107.
- Formatos desconhecidos são preservados ou rejeitados sem perda silenciosa.
- Nenhum dado V1 real foi lido, migrado ou apagado.
- `F4-T13` permanece `NOT_RUN_ENVIRONMENT`; suspensão física não foi simulada como homologação.

## Riscos HIGH F0

| Risco | Estado local | Limite |
|---|---|---|
| R-V1-LEGACY-REMOTE-PLAN | MITIGADO_LOCAL / BLOCKED_MAPPING | fixtures e quarentena; acervo real não autorizado |
| R-V1-FIRESTORE-DOCUMENT-1MIB | MITIGADO_LOCAL | limite de documento testado; Firestore real `NOT_RUN` |
| R-V1-MULTITAB-OUTBOX-RACE | MITIGADO_LOCAL | duas abas reais com Web Locks/outbox; serviço real `NOT_RUN` |
| R-V1-BACKUP-TOMBSTONE-LOSS | MITIGADO_LOCAL | restore/tombstone/checksum; KV/restore real `NOT_RUN` |

Nenhuma mitigação local corrige automaticamente a V1; nenhum risco foi promovido a `PASS_REAL_ISOLATED`.
