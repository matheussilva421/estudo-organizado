# Resumo do delta

| Resíduo | Antes | Depois |
|---|---|---|
| R1 — mutação isolada | entidade create/update/tombstone isolada era aceita | negada; transação completa continua aceita; change órfão sem entity write também é negado; leitura após a negativa não mostra mudança |
| R2 — concorrência same-ID | `Promise.all` podia retornar `PERMISSION_DENIED` ao perdedor | um `APPLIED` e um `ALREADY_APPLIED`; receipt/entity/digest precisam coincidir; retry limitado a 2 tentativas |
| R3 — entityType | qualquer string de 1–80 era aceita na criação | allowlist de 17 tipos nas Rules e no validador; tipo desconhecido negado; update continua imutável |
| R4 — documento pai | `allow read, write` no pai | `read` autorizado ao owner; `write` negado; subcoleções continuam funcionando |

## Evidência

- Firebase Emulator: **34/34** em cinco ciclos finais, 15 Rules + 6 transação + 13 resíduos.
- Unitários: **883/883** em 129 arquivos.
- E2E Chromium: **253 testes, 248 PASS, 5 SKIP, 0 FAIL**.
- typecheck, lint e build PASS.
- RED: 4 falhas de R1/R4 e 1 falha de R2 no código anterior; R3 reproduzido contra as Rules de `066a9070`.

## Estado externo

`F7_EXTERNAL_PENDING` / `UX_HUMAN_PENDING` / `REMOTE_PUSH_NOT_AUTHORIZED` / `MAIN_UNCHANGED`. Nenhum push, deploy, staging, Firebase real ou F8.
