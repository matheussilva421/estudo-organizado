# Estudo Organizado V2 — fechamento local F0/F7 e Firebase Emulator

Código `6c0353bb7da20338518b36427416343ba23f1835`, branch `v2`.
Status: `FIREBASE_EMULATOR_LOCAL_VERIFIED` / `F0_HIGH_LOCAL_EVIDENCED` / `F7_SECURITY_P1_CLOSED` / `F7_EXTERNAL_PENDING` / `UX_HUMAN_PENDING` / `REMOTE_PUSH_NOT_AUTHORIZED` / `MAIN_UNCHANGED`.

## Índice

1. `PREFLIGHT.md` — Git, HEADs, divergência e backup.
2. `HIGH-RISKS-MATRIX.md` — quatro riscos HIGH, provas e resíduos.
3. `EMULATOR-ENVIRONMENT.md` — JDK 21 portátil, CLI e comando executado.
4. `EMULATOR-TEST-RESULTS.md` — 17/17 testes no Firestore/Auth Emulator.
5. `COMMANDS-AND-EXIT-CODES.md` — comandos e códigos de saída.
6. `TEST-RESULTS.md` — 881 unitários, 248/253 E2E e 17/17 no emulador.
7. `REGRESSION-RESULTS.md` — regressão final e escopo do delta.
8. `INDEPENDENT-REVIEWS.md` — duas rodadas de revisão e correções.
9. `F0-F7-GATES-AND-RISKS.md` e `ACCEPTANCE-TRACEABILITY.md`.
10. `MODULES-ACCEPTANCE-MATRIX.md`, `FULL-DV-VA-MATRIX.md` e `VISUAL-EVIDENCE.md`.
11. `F3-F4-LOCAL-GAPS.md`, `GIT-STATE-AND-ROLLBACK.md`, `ROLLBACK.md`, `REPRODUCE.md`, `NEXT-GATES.md`.
12. `MANIFEST.json` e `SHA256SUMS.txt`.

`BUNDLE.txt`, `MANIFEST.json` e `SHA256SUMS.txt` são artefatos do ZIP, gerados no empacotamento; não existem na pasta de auditoria do repositório.

O emulador prova Rules e transações locais, não backend real, quotas, billing, multi-dispositivo ou staging. A migração V1 permanece fail-closed e não integrada ao produto. Não há aprovação de UX-H, F7 real, staging, produção ou F8.
