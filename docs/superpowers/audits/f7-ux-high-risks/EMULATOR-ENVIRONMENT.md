# Ambiente de emuladores

| Ferramenta | Estado |
|---|---|
| Node/npm | disponíveis |
| Firebase CLI | ausente |
| Java | ausente (nem `java`, nem JDK/JRE instalado) |
| Chromium Playwright | disponível (1248) |

**Decisão:** `NOT_RUN_ENVIRONMENT`. O Firestore Emulator exige Java e Firebase CLI; não havia runtime local. Instalar um JDK portátil e `firebase-tools` exigiria download externo e não era necessário para as provas determinísticas dos quatro riscos.

## Procedimento humano

1. Instalar Temurin 21 portátil (zip oficial) em pasta local e definir `JAVA_HOME` apenas na sessão.
2. Usar `npx firebase-tools emulators:start --only auth,firestore --project demo-estudo-organizado --config firebase.json`.
3. Confirmar `projectId` começando com `demo-`, hosts `127.0.0.1` e variáveis sem backend real.
4. Rodar `npx vitest run --config vitest.firebase.config.ts` e registrar `PASS_EMULATOR`.
5. Encerrar o processo e remover apenas dados descartáveis.

Emulador não comprova quotas, billing, limites reais ou concorrência distribuída.
