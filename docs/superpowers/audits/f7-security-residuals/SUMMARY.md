# Resumo do delta

| Resíduo | Antes | Depois |
|---|---|---|
| R1 — mutação isolada | entidade create/update/tombstone isolada era aceita | negada; transação completa continua aceita; change órfão sem entity write também é negado; leitura após a negativa não mostra mudança |
| R2 — concorrência same-ID | `Promise.all` podia retornar `PERMISSION_DENIED` ao perdedor | um `APPLIED` e um `ALREADY_APPLIED`; receipt/entity/digest precisam coincidir; retry limitado a 2 tentativas |
| R3 — entityType | qualquer string de 1–80 era aceita na criação | allowlist de 17 tipos nas Rules e no validador; tipo desconhecido negado; update continua imutável |
| R4 — documento pai | `allow read, write` no pai | `read` autorizado ao owner; `write` negado; subcoleções continuam funcionando |
| R5 — entidade legada sem head | update podia reabrir a cadeia na sequência 1; head 0 contornava o check | update exige head causal com sequência pelo menos 1; head inicial exige a sequência 1 e seu change; rebaseline explícito é obrigatório |

## Evidência

- Firebase Emulator: **37/37** em 17/11/2026, 15 Rules + 6 transação + 16 resíduos. Os cinco ciclos de 34/34 anteriores seguem preservados; R5, head vazio e os 17 tipos foram adicionados depois.
- Unitários: **883/883** em 129 arquivos.
- E2E Chromium: **256 testes, 251 PASS, 5 SKIP, 0 FAIL**.
- typecheck, lint e build PASS.
- RED: 4 falhas de R1/R4 e 1 falha de R2 no código anterior; R3 reproduzido contra as Rules de `066a9070`.

## Estado externo

`F7_LOCAL_CLOSED_WITH_EVIDENCE` / `F7_EXTERNAL_PENDING` / `UX_HUMAN_PENDING` / `REMOTE_PUSH_NOT_AUTHORIZED` / `MAIN_UNCHANGED`. Nenhum push, deploy, staging, Firebase real ou F8. A evidência de fechamento está em `docs/superpowers/audits/f7-local-closeout-20261117/`.
