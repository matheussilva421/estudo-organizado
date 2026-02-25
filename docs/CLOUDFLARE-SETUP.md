# ⚡ Sincronização e Hospedagem na Cloudflare

Para transformar o Estudo Organizado num aplicativo em nuvem de ponta a ponta ("Fullstack Serverless"), usaremos **Cloudflare Pages** para hospedar o código do aplicativo (o Front-end) de graça na beira da rede global, e **Cloudflare Workers + KV** como banco de dados em tempo real para sincronizar tudo (Back-end) entre celular, tablet e PC.

Você fará três coisas neste guia:
A. Hospedar o App.
B. Criar o Banco Local KV.
C. Criar a API de Sincronização.

Siga exatamente o passo a passo abaixo (leva cerca de 5-10 minutos).

---

## PARTE A: Hospedar o App no Cloudflare Pages

Isso vai conectar o seu GitHub à Cloudflare para que seu aplicativo tenha uma URL bonita e fique online na internet para você acessar do celular.

1. Acesse o [Cloudflare Dashboard](https://dash.cloudflare.com/) e crie/acesse sua conta.
2. No menu esquerdo, vá em **Workers & Pages**.
3. Clique no botão azul **Create Application** e vá para a aba **Pages**.
4. Clique em **Connect to Git** e faça o link com sua conta do Github.
5. Selecione o seu repositório `estudo-organizado`.
6. Clique em **Begin setup** (Iniciar configuração).
7. Na tela *Set up builds and deployments*:
   - Em *Project name*, deixe o padrão ou coloque `estudo-organizado`.
   - Em *Framework preset*, deixe como **None** (Pois nosso app é Vanilla HTML/JS puro).
   - Em *Build command*, **deixe em branco**.
   - Em *Build output directory*, digite: `src` (Isso é **muito importante**! O Cloudflare precisa saber que nossa pasta raiz é a "src").
8. Clique em **Save and Deploy**.
9. Aguarde 1 minutinho. Quando terminar, você receberá a sua URL pública do site (ex: `https://estudo-organizado.pages.dev`). *Use esse link no seu celular!*

---

## PARTE B: Criar o Banco de Dados Rápido (KV)

Agora criaremos o espaço para salvar seu histórico de forma ultra veloz.

1. No menu lateral esquerdo da Cloudflare, vá em **Workers & Pages** -> **KV**.
2. Clique no botão azul **Create a namespace** (Criar um namespace).
3. Dê o nome de `ESTUDO_ORGANIZADO_KV` e clique em **Add**.
4. O espaço do banco foi criado.

---

## PARTE C: Criar o Cloudflare Worker (A API Backend)

Este pedaço escutará o seu aplicativo e salvará os dados em trânsito no Banco KV.

1. No menu lateral da Cloudflare, volte em **Workers & Pages** -> **Overview**.
2. Clique de novo em **Create Application**.
3. Na página **Ship something new**, clique na opção verde escrita **Comece com Hello World!**.
4. Dê um nome, como `estudo-sync-api`, e clique em **Deploy**.
5. Na tela amarela de sucesso, não clique no link; clique diretamente em **Edit code** para abrir o editor de código.
6. Na aba à sua esquerda onde está escrito `worker.js`, apague todo o código "Hello World" existente lá de dentro.
7. Vá na pasta do seu Estudo Organizado no computador, abra o arquivo `scripts/cloudflare-worker.js`. Copie tudo o que estiver lá e **cole no editor do Cloudflare**.
8. Clique em **Deploy** (canto superior direito) para salvar. Ignore testes temporários gerando erro roxo. Volte para a página inicial do Worker (clicando no nome dele lá no topo).

---

## PARTE D: Conectar a API e Criar uma Senha

No painel do seu Worker (`estudo-sync-api`), vá na aba **Configurações** (Settings) e depois no menu lateral em **Variáveis e segredos** (Variables and Secrets).

### Criando a Senha de Segurança (Variável de Ambiente)
1. Na primeira caixinha de "Variáveis e segredos", clique no botão azul **+ Adicionar**.
2. No campo **Tipo**, clique e altere de *Texto* para **Segredo** (para que a senha fique invisível e protegida).
3. No **Nome da variável**, escreva exatamente em maiúsculo: `AUTH_TOKEN`
4. No campo **Valor**, invente a sua senha segura (ex: `SenhaMuitoForte123`).
5. Role um pouco para baixo na janelinha e clique no botão azul **Adicionar variável** (ou Salvar/Implantar).

### Conectando a API ao Banco de Dados (KV Binding)
6. Desça a tela principal inteira de Configurações até achar a seção **Ligações do Namespace KV** (ou *KV Namespace Bindings*).
7. Clique no botão **+ Adicionar ligação** (Add binding).
8. No **Nome da variável** (Variable name), escreva exatamente: `ESTUDO_KV`
9. No **Namespace do KV** (KV namespace), selecione na lista o banco que criamos na Parte B (`ESTUDO_ORGANIZADO_KV`).
10. Clique em Salvar/Deploy (botão azul inferior).

---

## Finalização

Feito! O Cloudflare está configurado. O que eu preciso que você copie e mande de volta é apenas:

1. A URL Base da API (Worker URL): Algo como `https://estudo-sync-api.xxxx.workers.dev` (pegue no *Overview* do Worker criado).
2. A Senha (AUTH_TOKEN) que você inventou no Passo D.9.

**Me avise aqui: "Fiz tudo, pode programar o App agora".** Assim, abrirei o código principal, programarei as áreas de Configurações pra incluir nossa Auth e embraçarei a Sincronização.
