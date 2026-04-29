# Guia de Configuracao Firebase Firestore

Este guia configura o Firestore como caminho remoto principal do Estudo Organizado sem remover a seguranca local-first: IndexedDB continua sendo o armazenamento local, Firestore recebe snapshots versionados, Cloudflare e Google Drive continuam como backups secundarios.

## 1. Criar projeto Firebase

1. Acesse o Firebase Console.
2. Crie um projeto ou use um projeto dedicado ao app.
3. Adicione um Web App.
4. Copie os campos `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` e `appId`.

O app usa `src/js/firebase/firebase-config-default.js` com valores vazios e aceita configuracao em tempo de execucao por `window.ESTUDO_FIREBASE_CONFIG`:

```js
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

export const FIREBASE_APP_CHECK_SITE_KEY = 'SUA_SITE_KEY_DO_APP_CHECK';
```

`apiKey` nao e segredo. A seguranca vem de Auth, regras Firestore, App Check e restricoes de chave no Google Cloud.

Defina `window.ESTUDO_FIREBASE_CONFIG` antes de carregar os modulos do app. Nao versionar `src/js/firebase/firebase-config.js`; esse arquivo fica reservado para uso local se necessario.

## 2. Habilitar Authentication

1. No Firebase Console, abra Authentication.
2. Ative o provedor Google.
3. Adicione os dominios usados pelo app em Authorized domains.
4. Para desenvolvimento local, inclua `localhost` e o host local usado nos testes manuais.

O app continua funcionando sem login. Firestore so sincroniza depois de login Google.

## 3. Criar Firestore

1. Abra Firestore Database.
2. Crie banco em Native mode.
3. Escolha a regiao mais proxima do uso principal.
4. Comece com regras bloqueadas e publique as regras do reposititorio.

Arquivos versionados:

- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

Publicacao:

```powershell
npx firebase login
npx firebase use seu-projeto
npx firebase deploy --only firestore:rules,firestore:indexes
```

## 4. App Check

1. Abra App Check.
2. Registre o Web App.
3. Use reCAPTCHA Enterprise quando disponivel; use reCAPTCHA v3 em projetos simples.
4. Copie a site key para `FIREBASE_APP_CHECK_SITE_KEY`.
5. Primeiro rode em modo monitoramento; depois ative enforcement para Firestore quando a telemetria estiver limpa.

## 5. Restringir API key

No Google Cloud Console:

1. Abra APIs and Services > Credentials.
2. Selecione a API key do app.
3. Restrinja por HTTP referrers aos dominios reais do app.
4. Restrinja por APIs usadas pelo Firebase Web App.

## 6. Fluxo seguro de ativacao

1. Rode `npm run build:firebase` sempre que atualizar `firebase` ou `scripts/firebase-bundle-entry.js`.
2. Rode `npm test`.
3. Abra o app.
4. Va em Configuracoes > Firestore.
5. Entre com Google.
6. Clique em `Ativar primario`.
7. Use o app normalmente e confirme se o status sai de salvamento local para Firestore sincronizado.
8. Use `Shadow` apenas para diagnostico sem push automatico.
9. Mantenha Cloudflare e Google Drive como backups manuais ate confiar no historico de sincronizacao.

## 7. Recuperacao e conflitos

Quando houver conflito, o app mostra um painel Firestore com tres acoes:

- Exportar backup local: baixa JSON antes de qualquer decisao destrutiva.
- Baixar Firestore: aplica o snapshot remoto sobre o local.
- Forcar envio local: sobrescreve o snapshot remoto com o estado local.

Nunca resolva conflito sem exportar backup local quando houver duvida.

## 8. Emuladores

O reposititorio inclui `firebase.json` para Auth e Firestore Emulator:

```powershell
npx firebase emulators:start --only auth,firestore
```

Use emuladores para validar regras antes de publicar. Os testes automatizados atuais cobrem contrato estatico das regras e o contrato local-first; testes de regras com emulador podem ser adicionados em uma fase posterior.
