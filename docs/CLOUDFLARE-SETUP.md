# ⚡ Sincronização via Cloudflare Workers + KV

Para termos uma sincronização instantânea, gratuita e de baixíssima latência entre os seus dispositivos (celular, tablet e PC), vamos configurar o ecossistema do Cloudflare. O Google Drive passará a atuar como uma camada de backup (segurança adicional).

O processo é totalmente gratuito no plano Free da Cloudflare e leva cerca de 5 minutos.

## Passo 1: Criar Conta e Namespace no Cloudflare

1. Acesse o [Cloudflare Dashboard](https://dash.cloudflare.com/) e crie uma conta gratuita (caso não tenha).
2. No menu lateral esquerdo, vá em **Workers & Pages** -> **KV**.
3. Clique no botão azul **Create a namespace** (Criar um namespace).
4. Dê o nome de `ESTUDO_ORGANIZADO_KV` e clique em **Add**.
5. O namespace será criado e vai aparecer na lista.

---

## Passo 2: Criar o Worker (Servidor da API)

1. No menu lateral esquerdo, vá em **Workers & Pages** -> **Overview**.
2. Clique no botão azul **Create Application**.
3. Na aba *Workers*, clique em **Create Worker**.
4. Dê um nome sugestivo, como `estudo-sync-api`, deixe o modelo padrão de *Hello World* selecionado e clique em **Deploy**.
5. Na tela de sucesso, clique em **Edit code** para abrir o editor de código no navegador.

---

## Passo 3: Colar o Código do Servidor

1. Apague todo o código que estiver no editor do Cloudflare.
2. Abra o arquivo `scripts/cloudflare-worker.js` que está na pasta do nosso projeto. Copie todo o conteúdo dele e cole no editor do Cloudflare.
3. Clique em **Deploy** no canto superior direito para salvar. Não se preocupe se der um erro roxo na visualização ("Error: binding not found"), é normal pois ainda não conectamos o banco de dados.
4. Volte para a página inicial do seu Worker recém-criado (clicando no nome dele lá em cima, ou voltando na seta).

---

## Passo 4: Conectar o Banco de Dados (KV) e Criar a Senha

Agora precisamos dar permissão para o código ler o banco de dados e proteger sua API com uma senha.

1. Na página do seu Worker (`estudo-sync-api`), vá na aba **Settings** (Configurações).
2. No menu lateral (dentro de Settings), vá em **Variables and Secrets** (Variaveis e Segredos).

### Vinculando o Banco de dados (KV)
3. Role para baixo até achar a seção **KV Namespace Bindings** e clique em **Add binding**.
4. No campo **Variable name**, digite exatamente: `ESTUDO_KV` (todo em maiúsculo).
5. No campo **KV namespace**, selecione o banco que criamos no Passo 1 (`ESTUDO_ORGANIZADO_KV`).
6. Clique em **Deploy** (ou Save) para engatar a ligação.

### Criando a Senha (Environment Variable)
7. Ainda em *Variables and Secrets*, suba um pouco até a opção **Environment Variables** e clique em **Add variable**.
8. Em **Variable name**, digite exatamente: `AUTH_TOKEN`.
9. Em **Value**, invente uma senha forte e segura (pode ser uma mistura de letras e números, como `mEU_ToKeN_S3cr3to_123`).
   * **Importante:** Clique no cadeado (botão Encrypt) ao lado do valor para criptografá-la.
10. Clique em **Deploy** (ou Save).

---

## Passo 5: Coletar as Chaves na Interface

Muito bem, o servidor backend agora existe! Nós só precisamos de duas informações dele para ligarmos na tela de **Configurações** do seu aplicativo Estudo Organizado:

1. A sua **URL do Worker** (algo como `https://estudo-sync-api.<seu-username>.workers.dev`). Você encontra ela na aba principal (Triggers ou Overview) do Worker. Copie.
2. A sua **Auth Token** (a senha que você inventou no Passo 4.9).

Assim que você terminar de configurar a Cloudflare e tiver essas informações em mãos, me avise para eu escrever e programar a tela de front-end do nosso aplicativo para se comunicar com ela!
