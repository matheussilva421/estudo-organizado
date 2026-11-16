# Ambiente do Firebase Emulator — executado

| Ferramenta | Versão/origem |
|---|---|
| Java | Temurin 21.0.13+9 LTS, portátil em `C:\Projetos\_tools\jdk-21\jdk-21.0.13+9` |
| Download JDK | `api.adoptium.net` (oficial), 205.421.281 bytes, SHA-256 `A4DBAA05FCA4BD89D84584E58C459BD732EFEBB1722AF80AB13C6516832004F9` |
| Node / npm | 26.13.0 / 12.2.2 |
| firebase-tools | 15.34.2, instalação local em `node_modules` |
| Firestore Emulator JAR | `cloud-firestore-emulator-v1.22.0.jar` |
| Projeto | `demo-estudo-v2` |
| Hosts/portas | Firestore 127.0.0.1:8180; Auth 127.0.0.1:9199; Hub 127.0.0.1:4400; reservados 4500 e 9150 |

Config usada: `apps/v2/firebase/firebase.json`, com `host: 127.0.0.1` explícito para Auth e Firestore. Rules: `apps/v2/firebase/firestore.rules`.

## Comando executado

```powershell
$env:JAVA_HOME='C:\Projetos\_tools\jdk-21\jdk-21.0.13+9'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
$env:CI='1'
cd C:\Projetos\estudo-organizado\_v2-candidate\apps\v2
npx --no-install firebase emulators:exec --only firestore,auth --project demo-estudo-v2 --config firebase/firebase.json "npm run test:firebase"
```

## Resultado

- Emuladores iniciaram, projetor demo detectado, Rules carregadas, script executou 17/17 testes em 5,57 s, exit 0 e shutdown limpo.
- A inspeção durante a execução registrou conexões loopback em 8180, 9199 e 4400 e o processo Java: `java ... cloud-firestore-emulator-v1.22.0.jar --host 127.0.0.1 --port 8180 ... --project_id demo-estudo-v2 --rules ...firestore.rules --single_project_mode true`.
- Logs: `fbt-emulator-final6.log`, `fbt-emulator-final3.log`, `emulator-listeners.txt`, `firestore-debug-final.log`.

## Limites

Auth Emulator subiu, mas os testes `authenticatedContext` do rules-unit-testing não equivalem a login real fim a fim. Emulador não comprova quotas, billing, limites produtivos nem concorrência distribuída. Nenhum projeto real, credencial ou `firebase login/use/deploy` foi usado.
