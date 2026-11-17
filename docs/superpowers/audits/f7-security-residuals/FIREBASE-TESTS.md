# Firebase Emulator

## Ambiente

- Java Temurin 21.0.13+9, Node 26.13.0, npm 12.2.2, firebase-tools 15.34.2.
- Firestore Emulator JAR 1.22.0; projeto `demo-estudo-v2`.
- Firestore `127.0.0.1:8180`, Auth `127.0.0.1:9199`, Hub `127.0.0.1:4400`.
- Rules `apps/v2/firebase/firestore.rules`; config `apps/v2/firebase/firebase.json`.

## Comando

```powershell
$env:JAVA_HOME='C:\Projetos\_tools\jdk-21\jdk-21.0.13+9'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
$env:CI='1'
cd C:\Projetos\estudo-organizado\_v2-candidate\apps\v2
npx --no-install firebase emulators:exec --only firestore,auth --project demo-estudo-v2 --config firebase/firebase.json "npm run test:firebase"
```

## Resultado

| Arquivo | Testes |
|---|---:|
| `f7-firestore-rules.test.ts` | 15 |
| `f7-remote-transaction.test.ts` | 6 |
| `f7-security-residuals.test.ts` | 16 |
| **Total** | **37 PASS, 0 FAIL, 0 SKIP** |

Cinco ciclos finais: `firebase-final3-stability-1..5.log`, todos 34/34, exit 0. O GREEN anterior está em `firebase-green-6.log`.

## Call budget

A revisão estática conservadora conta 19 acessos documentais no pior caminho (cada get/getAfter/exists como chamada), contra o limite de 20 por transação. O emulador passou os fluxos de sucesso e negação sem erro de excesso de acessos, mas não expõe a contagem interna. A margem é de uma chamada: qualquer nova leitura nesse helper exige teste dedicado de limite.

## Limite

`authenticatedContext` simula identidade; Auth real, quotas, multi-dispositivo e Rules publicadas continuam G-EXT.
