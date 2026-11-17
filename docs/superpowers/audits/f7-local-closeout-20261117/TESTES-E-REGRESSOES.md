# Testes e regressões

## Ambiente

- Node `v26.13.0`; npm `12.2.2`.
- Vite `8.3.5`; Playwright `1.64.1`; Vitest `5.0.5`.
- Firebase Tools `15.34.2`; Temurin JDK `21.0.13+9`.
- Emulator: projeto demo `demo-estudo-v2`; Firestore/Auth em loopback; nenhum projeto real.

## Checks do app

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; aviso não bloqueante de chunk maior que 500 kB |
| `npm run test:unit` | **883 PASS / 883 em 129 arquivos** |
| `npx playwright test --project=chromium --reporter=line --workers=1` | **256 testes: 251 PASS, 5 SKIP, 0 FAIL** |

Tempo da suíte E2E final: 4,4 minutos. O E2E precisou ser executado fora do sandbox porque o preview e o Chrome usam loopback local.

## Testes novos e focados

| Arquivo | Resultado | Cobertura |
|---|---|---|
| `tests/e2e/f7-backup.spec.ts` | PASS | backup F7 local com manifesto, payload acadêmico e ausência de campos sensíveis |
| `tests/e2e/f7-restore.spec.ts` | PASS | prévia sem escrita, confirmação explícita, cópia de segurança e read-back |
| `f7-ux-attention-analytics.spec.ts` — drill | PASS | recorte por edital e disciplina com 30 min e 100% da dimensão |
| execução focada dos três arquivos | **7/7 PASS** | testes novos e regressões vizinhas |

## Firebase Emulator

Comando utilizado em `apps/v2`, com JDK 21 no PATH:

`npx --no-install firebase emulators:exec --only firestore,auth --project demo-estudo-v2 --config firebase/firebase.json "npm run test:firebase"`

Resultado: **37/37 PASS em 3 arquivos**. O incremento de 34 para 37 vem de:

- entidade legada sem `meta/head` não pode continuar a cadeia;
- head vazio de sequência 0 não pode semear um bypass;
- todos os 17 `entityType` conhecidos são aceitos em sequência válida.

## SKIPs

Os cinco SKIPs são capturas/evidências condicionais já conhecidas: F3-T40, F6 e F7-UX, além de duas comparações premium. Nenhum oculta falha de segurança, sincronização ou restauração.

## Não executado

- Auth/Firebase/Firestore/Rules reais e quotas reais: `BLOCKED_G_EXT`.
- URL externa/HTTP read-back e mobile real: `BLOCKED_G_STAGING`.
- NVDA, Narrator, toque físico, zoom nativo e hardware modesto: `NOT_RUN_ENVIRONMENT`.
- F4-T13 de suspensão física prolongada: `NOT_RUN_ENVIRONMENT`.
- Dados V1 reais: fora do escopo e bloqueados.
