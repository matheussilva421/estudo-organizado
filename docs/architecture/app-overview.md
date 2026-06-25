# Estudo Organizado - descricao completa para novo desenvolvedor

## Proposito deste documento

Este documento e uma visao de onboarding do app Estudo Organizado. Ele foi
escrito para uma pessoa desenvolvedora que esta chegando ao projeto e precisa
entender o produto, o dominio, a arquitetura real, os fluxos criticos, os dados,
os pontos de risco e o jeito seguro de trabalhar no codigo.

Ele descreve o app como ele existe hoje. Quando houver diferenca entre uma
arquitetura ideal e a arquitetura atual, este documento privilegia a arquitetura
atual, porque o objetivo e orientar manutencao e evolucao sem quebrar dados de
estudo reais.

## Resumo executivo

O Estudo Organizado e uma aplicacao web local-first para planejamento e controle
de estudos, especialmente voltada para concursos publicos. O app ajuda o usuario
a transformar editais em uma rotina executavel: cadastrar disciplinas e
assuntos, planejar ciclos, criar eventos de estudo, estudar com timer, registrar
sessoes, acompanhar progresso, revisar conteudo por repeticao espacada e
analisar desempenho.

Tecnicamente, o projeto e uma SPA/PWA sem framework, escrita em HTML, CSS e
JavaScript vanilla com ES modules. O armazenamento primario e IndexedDB. O app
funciona offline e trata sincronizacao remota como uma camada opcional acima do
commit local. Firestore e o caminho remoto principal quando configurado; Cloudflare
KV e Google Drive permanecem como canais secundarios de backup/restauracao.

O usuario deve conseguir estudar mesmo sem login, sem internet e sem servidor
remoto disponivel. Essa premissa guia quase todas as decisoes importantes do
codigo.

## Produto em uma frase

O Estudo Organizado e um cockpit de estudos local-first: ele combina edital,
agenda, ciclo de estudos, timer, sessoes, revisoes, habitos, dashboards e sync
em uma experiencia unica para que o usuario planeje, execute, meca e ajuste sua
preparacao.

## Publico-alvo e problema resolvido

O usuario principal e alguem estudando para concurso ou processo seletivo de
alta carga. Esse usuario normalmente tem:

- muitos assuntos para cobrir;
- varias disciplinas com pesos e niveis de dominio diferentes;
- necessidade de registrar tempo real estudado;
- revisoes em datas futuras;
- simulados, questoes, leitura, videoaulas e outros habitos de estudo;
- medo de perder dados;
- necessidade de funcionar no proprio computador, mesmo offline;
- vontade de sincronizar ou fazer backup, mas sem depender disso para estudar.

O app tenta reduzir a friccao entre plano e execucao. O usuario monta o edital,
gera uma sequencia de ciclo, cria ou inicia eventos, cronometra o estudo, registra
o resultado e recebe indicadores para corrigir a rota.

## Principios de produto

1. Local-first: o dado salvo no navegador e o commit principal.
2. Sync sem bloqueio: falhas remotas nao devem impedir o estudo local.
3. Recuperabilidade: exportacao, backup e snapshots devem reduzir risco de perda.
4. Progresso visivel: o usuario precisa enxergar se algo foi salvo, sincronizado
   ou ficou pendente.
5. Fluxo de estudo rapido: timers, registro de sessao e conclusao de assuntos
   devem ser acessiveis sem navegacao excessiva.
6. Dados do edital como centro: disciplinas e assuntos conectam agenda,
   revisoes, dashboards, banca e planejamento.
7. Evolucao incremental: o codigo esta sendo modularizado aos poucos, sem trocar
   a stack de uma vez.

## Stack e runtime

### Stack principal

- HTML estatico em `src/index.html`.
- CSS modularizado em `src/css/`, com `src/css/styles.css` como agregador legado.
- JavaScript vanilla em ES modules dentro de `src/js/`.
- IndexedDB para persistencia primaria.
- localStorage apenas para preferencias pequenas, fallback legado e emergencia.
- Service Worker em `src/sw.js` para comportamento PWA/offline.
- Firebase/Firestore como sync remoto principal, quando configurado.
- Cloudflare Worker/KV como canal secundario/legado de snapshot.
- Google Drive como canal de backup/restauracao via arquivo JSON.
- Vitest para testes unitarios.
- Playwright para testes E2E.

### Como rodar

O caminho recomendado no Windows e:

```powershell
.\Abrir_Estudo_Organizado.bat
```

Alternativas manuais:

```powershell
python -m http.server 8000 --directory src
npx http-server src -p 8080
```

O ambiente mock isolado roda com:

```powershell
npm run mock
npm run mock:preserve
npm run mock:clean
```

Esse ambiente usa origem separada, dados realistas e sync remoto desativado, o
que e util para QA manual sem tocar dados reais do navegador principal.

## Estrutura de diretorios

### Raiz do repositorio

- `README.md`: descricao funcional e comandos principais.
- `README_DEV.md`: guia de baixo contexto, mapa de arquivos e matriz de testes.
- `AGENTS.md`: regras para agentes, TDD, remoto, GitHub e handoff.
- `HANDOFF_CONTEXT.md`: handoff atual para proxima IA/desenvolvedor.
- `package.json`: scripts de teste, lint, format, mock e build Firebase.
- `playwright.config.js`: configuracao E2E.
- `vitest.config.js`: configuracao unit tests.
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`: suporte Firebase.
- `wrangler.jsonc`: suporte Cloudflare.

### `src/`

- `src/index.html`: app shell.
- `src/manifest.json`: manifest PWA.
- `src/sw.js`: service worker.
- `src/css/`: sistema visual.
- `src/js/`: runtime da aplicacao.
- `src/vendor/`: bundles de terceiros; nao editar manualmente.
- `docs/` (raiz): toda a documentacao tecnica, arquitetura, seguranca, sync e releases (ver `docs/README.md`).

### `tests/`

- `tests/unit/`: testes Vitest.
- `tests/e2e/`: testes Playwright.
- `tests/helpers/`: builders e utilitarios para estado e E2E.

## Mapa dos modulos principais

### Entrada e bootstrap

`src/js/main.js` e o entry point. Ele importa os modulos principais, monta o
namespace `window.EstudoApp`, registra pontes legadas no `window`, inicializa
dispatchers, modais, indicador de salvamento, app, sync status UI e listeners
globais de eventos.

Esse arquivo tambem mostra uma caracteristica importante do projeto: existe uma
ponte entre a arquitetura antiga baseada em globais e a arquitetura nova baseada
em imports explicitos. Ao mexer nele, assuma que ainda ha compatibilidade legada
dependendo de nomes em `window`.

### Orquestracao do app

`src/js/app.js` centraliza inicializacao, tema, navegacao, modais, toasts e
bootstrap de integracoes. O fluxo de `init()` e:

```text
initDB()
  -> app:stateLoaded
  -> applyTheme()
  -> initNotifications()
  -> initSyncCoordinator()
  -> initFirestoreSync()
  -> restaurar sidebar
  -> navigate('home')
  -> preparar Google Drive se houver client id salvo
```

Ponto importante: a UI renderiza antes de qualquer sync manual. O usuario pode
usar o app mesmo quando integracoes remotas nao estao prontas.

### Estado e persistencia

`src/js/store.js` e a fachada publica do estado. Ele reexporta a camada de
IndexedDB, normalizacao, exportacao e `setState()`.

`src/js/store/indexeddb.js` contem a persistencia real. O banco se chama
`EstudoOrganizadoDB`, atualmente na versao 6. Stores relevantes:

- `app_state`: estado local atual, anterior e legado.
- `firestore_outbox`: snapshots pendentes para Firestore.
- `firestore_meta`: metadados de sync.
- `firestore_conflicts`: conflitos detectados.
- `entity_meta`: indice local de entidades e checksums.
- `firestore_entity_outbox`: lotes de entidades pendentes.

O estado principal e salvo em envelope local com chaves como:

- `main_state_current`
- `main_state_previous`
- `main_state`

O app tenta recuperar estado usando current, previous, legado e emergencia em
localStorage. Isso e deliberado: estudo real nao pode ser perdido facilmente por
queda de aba, IndexedDB instavel ou migracao antiga.

### Regras de dominio

`src/js/logic.js` e uma fachada de dominio. Ele reexporta submodulos extraidos:

- `src/js/logic/timer.js`: timers, modo Pomodoro, cronometro livre, tempo
  acumulado e reattach de timers.
- `src/js/logic/revisions.js`: revisoes espacadas, datas e pendencias.
- `src/js/logic/cycle.js`: ciclo de estudos, planejamento, sequencia,
  distribuicao de tempo e eventos automaticos.
- `src/js/logic/disc.js`: acesso a disciplinas e caches.
- `src/js/logic/progress.js`: metricas, dashboards, streak, previsoes e progresso.

`logic.js` ainda contem algumas mutacoes diretas importantes, como marcar evento
como estudado, remover evento e arquivar/desarquivar disciplinas.

### Renderizacao e componentes

`src/js/components.js` coordena renderizacao de views, cards, badges,
cronometro e componentes compartilhados.

`src/js/views.js` ainda e uma fachada grande. Ele reexporta varias views extraidas
e mantem alguns fluxos visuais ainda nao migrados.

Views extraidas importantes:

- `src/js/views/home-view.js`: home/dashboard inicial.
- `src/js/views/calendar-view.js`: calendario mensal/semanal.
- `src/js/views/ciclo-view.js`: ciclo e grade.
- `src/js/views/dashboard-view.js`: dashboard principal e por disciplina.
- `src/js/views/editais-view.js`: tela de editais.
- `src/js/views/editais-crud.js`: operacoes CRUD de editais/disciplinas/assuntos.
- `src/js/views/habitos-view.js`: habitos.
- `src/js/views/revisao-view.js`: revisoes.
- `src/js/views/historico-view.js`: historico de sessoes.
- `src/js/views/banca-view.js`: inteligencia de banca.
- `src/js/views/config-view.js`: configuracoes.
- `src/js/views/config/*`: backup, sync center, tema e data management.

### Acoes de UI

O projeto esta migrando para eventos delegados via `data-action`.

`src/js/ui/actions/index.js` importa os modulos de acoes e registra handlers no
dispatcher:

- `eventos.js`
- `editais.js`
- `revisoes.js`
- `habitos.js`
- `config.js`
- `navegacao.js`
- `modais.js`
- `planejamento.js`

Ao criar uma interacao nova, prefira registrar uma action em vez de adicionar
handler inline. Isso ajuda testes, acessibilidade e futura CSP mais estrita.

### Dialogos e DOM

- `src/js/ui/dialog.js`: modais, ARIA, foco e anuncios.
- `src/js/ui/dom.js`: helpers DOM.
- `src/js/ui/event-modals.js`: modais de criacao/edicao de eventos e carga do dia.

### Debug controlado

`src/js/debug.js` centraliza logs condicionais. Use flags como:

```js
localStorage.setItem('debug:sync', 'true');
localStorage.setItem('debug:credentials', 'true');
```

Evite `console.log` solto em fluxo normal.

## Modelo de dominio

O estado do app e um objeto unico normalizado. Os campos mais importantes sao:

- `schemaVersion`: versao do schema local.
- `editais`: colecao de editais, disciplinas, assuntos e aulas.
- `eventos`: eventos ativos/agendados/concluidos.
- `arquivo`: eventos arquivados.
- `habitos`: registros de questoes, revisao, discursiva, simulado, leitura,
  informativo, sumula, videoaula e paginas.
- `revisoes`: revisoes espacadas.
- `config`: preferencias, metas, sync, tema, revisao, Pomodoro e flags.
- `cronoLivre`: estado do cronometro sem evento.
- `planejamento`: ciclo/grade semanal e sequencia planejada.
- `bancaRelevance`: dados de analise de banca, hot topics e mappings.
- `driveFileId` e `lastSync`: metadados legados/backup.

## Entidades centrais

### Edital

Um edital agrupa disciplinas. E a raiz de organizacao academica do usuario.
Normalmente contem nome, disciplinas e configuracoes visuais/organizacionais.

### Disciplina

Disciplina e a unidade principal de progresso, estatistica e dashboard. Ela pode
ter icone, cor, lista de assuntos, aulas e status arquivado.

### Assunto

Assunto representa conteudo estudavel. Ele pode estar pendente ou concluido,
ser vinculado a eventos, revisoes, aulas e rankings de banca.

### Evento

Evento e o item de agenda/estudo. Pode ser agendado, atrasado, em andamento ou
marcado como estudado. Eventos guardam disciplina, assunto, data, duracao,
notas, tempo acumulado e campos auxiliares de timer.

### Sessao/Habito

O registro de sessao transforma o estudo feito em historico analisavel. Ele
alimenta dashboards, estatisticas de questoes, paginas lidas, revisoes e habitos.

### Revisao

Revisao e gerada a partir de assunto estudado/concluido. A frequencia padrao e
1, 7, 30 e 90 dias, mas e configuravel.

### Planejamento/Ciclo

O planejamento usa relevancia e dominio para distribuir tempo entre disciplinas.
O app suporta ciclo continuo e grade semanal fixa.

## Fluxo de dados principal

O fluxo esperado de qualquer mudanca do usuario e:

```text
Usuario interage com UI
  -> action dispatcher ou view chama funcao de dominio
  -> funcao altera `state`
  -> scheduleSave()
  -> IndexedDB grava envelope local
  -> evento app:saveStatus atualiza indicador de salvamento
  -> eventos do documento invalidam caches ou rerenderizam view
  -> sync opcional enfileira Firestore/snapshot/entity quando permitido
```

Regra mental importante: renderizacao e sync nao sao a fonte da verdade. A fonte
da verdade local e o `state` persistido no IndexedDB.

## Persistencia local em detalhes

### IndexedDB como commit point

Todo fluxo critico deve salvar localmente antes de tentar sync remoto. Isso
protege o usuario contra:

- internet instavel;
- auth expirada;
- Firestore indisponivel;
- Cloudflare/Drive mal configurado;
- fechamento de aba;
- conflito remoto.

### Debounce de save

`scheduleSave()` evita gravacoes excessivas. Ao mexer em fluxos de timer,
drag/drop, edicao inline ou sync, tenha cuidado para nao criar loop:

```text
save -> sync -> setState -> save -> sync -> ...
```

Use flags de skip quando o save e resultado de metadado remoto ou reparo interno.

### Indicador de salvamento

O app emite `app:saveStatus` com estados como:

- `saving`
- `saved`
- `error`

A UI mostra feedback no topo e em configuracoes. Isso e parte do contrato de
confianca do usuario.

### localStorage

localStorage nao deve virar banco primario. Usos aceitaveis:

- preferencias pequenas de UI;
- fallback legado;
- emergencia em fechamento de aba;
- client id auxiliar do Drive.

Nao coloque segredos novos ou dados de negocio grandes em localStorage sem
revisao explicita.

## Sincronizacao e backup

## Arquitetura geral de sync

O app tem quatro camadas de dados:

1. IndexedDB local: fonte primaria.
2. Firestore: remoto principal quando ativo.
3. Cloudflare KV: snapshot secundario/legado.
4. Google Drive: backup/restauracao via arquivo JSON.

O app nao deve tratar Cloudflare ou Drive como equivalentes ao Firestore dentro
do fluxo automatico central.

## Firestore

Firestore e inicializado por `src/js/sync/firestore-sync-engine.js` e coordenado
por `src/js/sync/sync-coordinator.js`.

Conceitos importantes:

- requer Firebase Auth/Google;
- respeita `config.firestoreSync`;
- pode operar em modo `shadow` ou `primary`;
- usa outbox local para tentativas pendentes;
- cria snapshot versionado;
- usa entidade primaria quando `entitySync.mode === 'primary'`;
- mantem snapshot como fallback/espelho operacional;
- pausa em conflito em vez de sobrescrever silenciosamente.

Fluxo simplificado:

```text
stateSaved
  -> sync-coordinator planeja acao
  -> queueFirestoreSnapshotFromState()
  -> firestore_outbox recebe snapshot
  -> se entity sync ativo, firestore_entity_outbox recebe entidades
  -> flush com lock, backoff e yield para UI
  -> status vai para sync-status-ui/config
```

Firestore usa eventos como:

- `app:firestoreSyncStatus`
- `app:primarySyncStatus`
- `app:primarySyncQueued`
- `app:primarySyncRequested`

Ao alterar sync, leia tambem:

- `docs/api/sync-contract.md`
- `docs/architecture/data-flow.md`
- `docs/security/sync-threat-model.md`
- `docs/security/sync-operational-checklist.md`

## Sync coordinator

`sync-coordinator.js` decide se pode sincronizar automaticamente. Ele considera:

- sync global pausado;
- usuario logado;
- Firestore configurado;
- modo `primary`;
- conflito bloqueante;
- timer/debounce;
- circuit breaker por falhas repetidas;
- lock para evitar concorrencia.

Ele tambem deriva health state e emite eventos para UI.

## Cloudflare

`src/js/cloud-sync.js` e canal secundario/legado. Ele trabalha com snapshot
completo e endpoint configuravel. Nao deve ser acionado como parte do fluxo
automatico principal do Firestore.

Use Cloudflare como backup/restauracao explicita. Ao mexer nele, cuidado com:

- tokens;
- URL remota;
- CORS;
- conflito 409;
- exportacao sem credenciais.

## Google Drive

`src/js/drive-sync.js` funciona como backup/restauracao. Ele autentica via OAuth,
localiza/cria arquivo JSON, compara metadados e permite enviar ou restaurar dados.

Drive nao deve bloquear estudo local e nao deve disparar o coordenador Firestore.

## Exportacao e importacao

Exportacao deve remover credenciais e metadados operacionais sensiveis. Importacao
deve ser tratada como conteudo nao confiavel: validar estrutura, evitar corromper
estado e preservar recuperabilidade.

## PWA e offline

`src/sw.js` registra cache do app shell e permite uso offline. Mudancas em
arquivos versionados/imports podem exigir cuidado com cache antigo durante testes
manuais. Se o navegador parecer rodar codigo antigo, suspeite de service worker
ou cache antes de concluir que a alteracao nao funcionou.

`src/js/sw-register.js` cuida do registro e atualizacao do service worker.

## Telas e funcionalidades

### Home

A home resume o dia e a semana:

- tempo estudado hoje;
- desempenho em questoes;
- progresso de edital;
- paginas lidas;
- constancia/streak;
- painel por disciplina;
- previsao semanal;
- data da prova.

Ela usa dados agregados de `logic/progress.js` e estado de editais, eventos e
habitos.

### Study Organizer / MED

E a tela operacional de eventos de estudo. O usuario cria eventos, inicia timer,
pausa, descarta tempo, marca como estudado e abre registro de sessao. Cards de
evento mudam conforme status.

Pontos sensiveis:

- timers precisam sobreviver a renderizacoes;
- marcar como estudado abre fluxo de registro;
- assunto pode ser marcado concluido;
- revisoes podem ser invalidadas/atualizadas;
- refresh cirurgico evita rerender completo.

### Cronometro livre

Permite estudar sem evento previo. O usuario pode escolher disciplina/assunto,
definir meta e registrar sessao ao concluir. O app cria ou associa o registro
posteriormente.

### Calendario

Mostra eventos por mes/semana, permite navegar datas e criar evento a partir de
um dia. Existe logica de filtro por edital; bugs historicos aqui costumam envolver
eventos ocultos por filtro, carga do dia e status visual.

### Ciclo de estudos

O ciclo distribui estudo por relevancia e dominio. O wizard coleta tipo,
disciplinas, pesos e horarios. O app gera sequencia, permite editar slots e cria
eventos a partir das etapas.

Pontos sensiveis:

- sincronizar ciclo com eventos;
- remover evento automatico sem quebrar sequencia;
- previsoes dependem de tempo estudado real;
- grade semanal tem regras diferentes de ciclo continuo.

### Dashboard

Mostra periodo, graficos, estatisticas, habitos, progresso de edital e drilldown
por disciplina. Usa Chart.js e caches de agregacao. Ao alterar dados de estudo,
invalide caches quando necessario.

### Revisoes

Organiza pendentes, proximas e concluidas. Frequencias ficam em configuracao.
Marcar revisao avanca intervalo; adiar reagenda sem contar como feita.

### Habitos

Registra tipos de estudo como questoes, revisao, leitura, simulado, videoaula,
informativo, sumula, discursiva e paginas. Esses dados alimentam dashboards e
historico.

### Editais

CRUD de editais, disciplinas, assuntos e aulas. Inclui arvore, gerenciador de
assuntos, adicao em lote, importacao de aulas, cores, icones, concluir/pendente
e dashboard embutido.

### Edital verticalizado

Lista assuntos do edital com filtros, busca, status e criacao rapida de evento.

### Inteligencia de banca

Analisa ranking/incidencia, cruza topicos por similaridade e prioriza P1/P2/P3.
Usa NLP simples, normalizacao, fuzzy matching e revisao manual de matches.

### Configuracoes

Concentra temas, metas, revisoes, Pomodoro, horario silencioso, sync Firestore,
Cloudflare, Drive, export/import, arquivamento e limpeza total de dados.

Esta tela toca areas sensiveis; use testes especificos (`npm run test:config`)
quando mexer nela.

### Registro de sessao

Fluxo central depois de estudar. Preenche tempo, data, horario, disciplina,
assunto, tipo de estudo e campos especificos. Salvar sessao atualiza historico,
habitos, progresso e pode iniciar nova sessao.

### Notificacoes

Alertam revisoes pendentes, meta semanal em risco e usam horario silencioso.
Quando notificacao nativa nao esta disponivel, o app deve degradar para toast.

### Busca global

Busca eventos, disciplinas, assuntos e habitos com debounce e navegacao direta.
Ha historico de duplicacao nessa area; antes de mudar, procure a implementacao
ativa e os contratos de `data-action`.

## Sistema visual

O CSS foi parcialmente modularizado:

- `src/css/base/`: layout, temas, forms, acessibilidade, mobile e utilitarios.
- `src/css/components/`: botoes, cards, sidebar, tabs, modais, busca, feedback.
- `src/css/views/`: CSS por tela.
- `src/css/tokens.css`: tokens e variaveis.
- `src/css/styles.css`: agregador/legado.

Temas importantes incluem grafite/obsidiana/contraste e aliases legados. Ao
alterar UI, prefira classes e tokens existentes. Evite aumentar inline styles em
templates JS.

## Acessibilidade

O app tem melhorias progressivas:

- modais com ARIA via `ui/dialog.js`;
- skip links e base de acessibilidade no CSS;
- eventos delegados;
- toasts e feedback visual.

Ainda existem riscos:

- muitas strings de HTML via `innerHTML`;
- alguns controles legados dependem de handlers globais;
- foco e teclado devem ser testados quando mexer em modal, sidebar, busca,
  calendario ou wizard.

## Seguranca

Principais riscos:

- XSS por HTML dinamico;
- segredos perto de estado exportavel;
- endpoint Cloudflare permissivo se token vazar;
- regras Firestore mal configuradas;
- overwrite remoto indevido;
- importacao JSON maliciosa ou corrompida.

Regras praticas:

- nao inclua tokens em exportacao;
- nao salve credenciais novas no estado principal sem revisar contrato;
- prefira DOM seguro e escape rigoroso;
- confirme comportamento de conflito em qualquer mudanca de sync;
- restore e acoes destrutivas precisam de confirmacao clara;
- Firestore deve usar regras por `request.auth.uid == uid`.

## Testes e validacao

O repo usa validacao proporcional ao risco.

Comandos principais:

```powershell
npm test
npm run test:e2e
npm run test:config
npm run test:sync
npm run test:views
npm run test:css
```

Para mudancas pequenas de texto/docs, nao rode suite ampla sem necessidade. Para
sync, salvamento, PWA/offline e fluxos criticos, rode testes focados e depois
um gate mais amplo.

Exemplos:

- CSS: `npm run test:css`
- Configuracoes: `npm run test:config`
- Views: `npm run test:views`
- Sync: `npm run test:sync`
- Calendario: unit de calendario + E2E `calendar.spec.js`
- Ciclo: unit do planejamento + E2E ciclo/planejamento
- Registro/timer: unit de sessao + E2E sessoes/timer

Ao usar browser, Playwright ou automacao de UI, priorize headed/visivel quando
possivel para acompanhamento manual.

## Fluxo seguro para desenvolver

1. Antes de editar, rode `git fetch --prune` e confira `git status -sb`.
2. Leia `README_DEV.md` para escolher escopo.
3. Leia apenas arquivos diretamente relacionados, salvo se a tarefa exigir mapa
   amplo.
4. Se for funcionalidade ou bugfix, escreva/atualize teste primeiro.
5. Rode o teste e confirme falha quando aplicavel.
6. Implemente o minimo necessario.
7. Rode teste focado.
8. Refatore sem mudar comportamento.
9. Rode validacao proporcional ao risco.
10. Revise `git diff --stat`.
11. Crie handoff se o trabalho for entregue a outra IA.
12. Commit/push quando a tarefa pedir fechamento ou quando instrucoes do repo
    exigirem publicacao.

## Padroes de codigo

- JavaScript ES modules.
- 2 espacos.
- Ponto e virgula.
- Strings com aspas simples.
- `camelCase` para variaveis/funcoes.
- `UPPER_SNAKE_CASE` para constantes.
- `kebab-case` para arquivos.
- Evitar framework novo.
- Preferir modulos existentes a abstracoes novas.
- Preferir `data-action` a handler inline.
- Preferir helpers DOM e renderizacao segura a template gigante.
- Comentarios so quando reduzem custo cognitivo real.

## Pontos de atencao para novo dev

### 1. Nao quebre local-first

Qualquer mudanca que faca o usuario depender de sync para estudar e regressao.

### 2. Cuidado com loops de save/sync

Se um sync remoto chama `setState()` e depois `saveStateToDB()`, confira flags:

- `skipCloudSync`
- `skipFirestoreSync`
- `skipDriveSync`
- `skipSyncEvent`
- `touchLocalBackup`

### 3. Timers sao frageis

Timers misturam estado persistido, tempo real, intervalos JS e UI. Sempre teste
pausar, retomar, recarregar e registrar.

### 4. Service Worker pode mascarar mudancas

Se UI nao atualiza, limpe cache/origem ou confira versoes antes de diagnosticar.

### 5. `window.EstudoApp` ainda importa

Mesmo que a direcao seja reduzir globais, nao remova bridges sem busca e teste.

### 6. Exportacao nao pode vazar credenciais

Backup deve conter dados do usuario, nao segredos operacionais.

### 7. Firestore real nao e coberto por todos os testes

Muitos testes usam mocks. Antes de assumir seguranca de producao, valide regras,
Auth, App Check e comportamento manual.

### 8. `views.js` e `components.js` ainda sao centrais

Mesmo com modulos extraidos, muitas telas passam por essas fachadas.

## Documentos que um novo desenvolvedor deve ler

Leitura minima:

1. `README.md`
2. `README_DEV.md`
3. `docs/architecture/app-overview.md`
4. `docs/architecture/data-flow.md`
5. `docs/api/sync-contract.md`
6. `docs/security/sync-threat-model.md`

Para sync:

1. `docs/security/sync-operational-checklist.md`
2. `docs/guides/firebase-firestore-setup.md`
3. `docs/sync-hardening/README.md`

Para qualidade:

1. `tests/helpers/`
2. `package.json`
3. specs unitarias da area alterada
4. specs E2E da tela/fluxo alterado

## Como escolher onde mexer

### Mudanca em salvamento local

Comece por:

- `src/js/store.js`
- `src/js/store/indexeddb.js`
- `src/js/store/normalize-state.js`
- testes de persistencia/sync relacionados.

### Mudanca em sync Firestore

Comece por:

- `src/js/sync/sync-coordinator.js`
- `src/js/sync/firestore-sync-engine.js`
- `src/js/sync/firestore-schema.js`
- `src/js/sync/firestore-outbox.js`
- `src/docs/api/sync-contract.md`

### Mudanca em configuracoes

Comece por:

- `src/js/views/config-view.js`
- `src/js/views/config/`
- `src/js/ui/actions/config.js`
- `tests/unit/config-view.test.js`
- `tests/unit/config-actions.test.js`

### Mudanca em calendario

Comece por:

- `src/js/views/calendar-view.js`
- `src/js/ui/event-modals.js`
- `src/js/edital-filter.js`
- `tests/unit/calendar-view.test.js`
- `tests/e2e/calendar.spec.js`

### Mudanca em timer/sessao

Comece por:

- `src/js/logic/timer.js`
- `src/js/registro-sessao.js`
- `src/js/registro-sessao/`
- `src/js/components.js`
- specs de sessoes/timer.

### Mudanca em visual

Comece por:

- CSS da view especifica em `src/css/views/`
- componente em `src/css/components/`
- tokens em `src/css/tokens.css`
- `npm run test:css`

## Estado atual da arquitetura

O app esta em uma fase intermediaria madura:

- ja tem cobertura de testes relevante;
- ja tem documentos de arquitetura/sync/seguranca;
- ja tem modularizacao em andamento;
- ja tem sync local-first sofisticado;
- ainda carrega legado de `window`, `innerHTML` e arquivos grandes;
- ainda precisa de cuidado especial em sync, PWA, timers e export/import.

O caminho recomendado nao e reescrever tudo. E continuar extraindo por dominio,
com testes focados, mantendo compatibilidade e preservando dados do usuario.

## Glossario rapido

- Local-first: salvar e operar localmente antes de depender de nuvem.
- Snapshot: copia completa versionada do estado.
- Entity sync: sincronizacao por entidade, mais granular que snapshot.
- Outbox: fila local de escritas remotas pendentes.
- Conflict: estado em que local e remoto divergem e o app nao deve sobrescrever
  automaticamente.
- Shadow mode: modo em que entidade/sync roda em paralelo para validacao.
- Primary mode: modo em que Firestore e o caminho remoto principal.
- MED/Study Organizer: area operacional de eventos de estudo.
- Ciclo: sequencia de estudo gerada por pesos/relevancia/dominio.
- Repeticao espacada: revisoes futuras a partir de intervalos configurados.

## Checklist mental antes de abrir PR

- A mudanca preserva estudo offline?
- A mudanca preserva dados existentes e migracoes?
- O usuario ve erro real quando algo falha?
- Exportacao continua sem credenciais?
- Sync nao cria loop de save?
- Timer continua correto apos refresh?
- Teste proporcional foi executado?
- Handoff foi atualizado quando necessario?
- GitHub foi atualizado ou o bloqueio foi documentado com comandos manuais?
