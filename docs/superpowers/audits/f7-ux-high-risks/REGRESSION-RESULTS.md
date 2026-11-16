# Regressão no HEAD final

HEAD de código `6c0353bb`, após endurecimento das Rules e do envelope remoto.

| Suíte | Resultado |
|---|---|
| typecheck | PASS |
| lint | PASS |
| unitários | 881/881 em 129 arquivos |
| E2E Chromium | 253 testes: 248 PASS, 5 SKIP, 0 FAIL |
| Firebase Emulator | 17/17 PASS |
| Capturas premium | 3/3 PASS |
| Capturas de módulos | 1/1 PASS |

Skips: F3-T40 evidence, F6 evidence, F7-UX evidence e duas capturas premium condicionais.

O delta `6c0353bb` altera Rules, envelope remoto e testes; não altera domínio, IndexedDB, outbox, backup ou UI. O delta desde `e2164e3f` inclui, além disso, os avisos de falha de persistência na Home e de prova vencida na Reta Final.
