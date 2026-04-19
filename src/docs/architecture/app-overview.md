# Visão Geral da Arquitetura do App

## Objetivo

Este documento descreve a arquitetura atual do Estudo Organizado para apoiar refactors, correções seguras e futuras divisões de módulos. Ele registra o desenho real do app hoje, sem presumir a arquitetura alvo.

## Resumo arquitetural

O Estudo Organizado é uma SPA local-first construída com HTML, CSS e JavaScript vanilla em ES Modules. O app roda inteiramente no cliente e usa IndexedDB como armazenamento principal, com `localStorage` como fallback emergencial de persistência síncrona. Sincronização externa é opcional e atualmente pode ocorrer via Cloudflare Worker/KV e Google Drive.

## Runtime map

- `src/index.html`
  App shell, sidebar, topbar, containers de modais, registro do service worker e carregamento dos módulos principais.

- `src/js/main.js`
  Entry point. Importa os módulos, expõe exports no `window` como ponte de compatibilidade e conecta eventos globais do documento.

- `src/js/app.js`
  Inicialização do app, navegação, modais, toasts, tema, bootstrap de sync e timers globais de integração.

- `src/js/store.js`
  Fonte de verdade do estado persistido. Faz normalização, migrações, leitura/escrita no IndexedDB, fallback para `localStorage` e cascata opcional de sync.

- `src/js/logic.js`
  Regras de domínio e cálculos: timers, revisões, estatísticas, previsões, ciclo de estudos e mutações ligadas ao fluxo de estudo.

- `src/js/views.js`
  Renderização das telas principais. Re-exporta módulos extraídos e contém fluxos visuais ainda não modularizados.

- `src/js/components.js`
  Renderers compartilhados e coordenação de renderização entre telas, incluindo cards de evento, skeletons, badges e cronômetro.

- `src/js/ui/actions.js`
  Dispatcher centralizado de ações `data-action`. Substituiu o switch legado de `main.js`.

- `src/js/ui/dialog.js`
  Controlador de modais com atributos ARIA e acessibilidade.

- `src/js/ui/dom.js`
  Helpers DOM compartilhados (esc, qs, qsa).

- `src/js/views/home-view.js`
  View extraída: página inicial e dashboard.

- `src/js/views/calendar-view.js`
  View extraída: calendário (mês/semana). Módulo canônico de calendário no runtime.

- `src/js/views/editais-view.js`
  View extraída: gerenciamento de editais, disciplinas e assuntos.

- `src/js/views/dashboard-view.js`
  View extraída: dashboard de disciplina com tabs semânticos.

- `src/js/views/banca-view.js`
  View extraída: inteligência de banca, parsing de ranking e P1/P2/P3.

- `src/js/cloud-sync.js`
  Cliente de sincronização via Cloudflare Worker com contrato de conflito (baseRemoteUpdatedAt, 409).

- `src/js/drive-sync.js`
  Cliente de integração com Google Drive, incluindo OAuth, criação/atualização do arquivo remoto e restauração.

- `src/sw.js`
  Service worker do app shell com cache e fallback offline.

## Camadas atuais

### 1. UI shell

O shell fica em `index.html`, que já contém estrutura estática importante:

- sidebar
- topbar
- campo de busca
- overlays
- containers de modais

Essa abordagem reduz custo de montagem inicial, mas hoje também faz o HTML base carregar muitos pontos de integração e acessibilidade de uma vez.

### 2. Renderização

A renderização hoje é híbrida:

- há delegação centralizada em `main.js`
- há construção de HTML por template strings
- há pontos ainda fortemente acoplados a `window`
- há bastante uso de `innerHTML`

Essa combinação foi suficiente para acelerar a evolução do produto, mas tornou a UI mais difícil de testar, refatorar e endurecer em CSP.

### 3. Estado e persistência

O objeto `state` em `store.js` é mutado em memória e salvo com debounce. O app depende de:

- normalização em `setState`
- migrações em `runMigrations`
- `scheduleSave()` para persistência assíncrona
- `pagehide` e `beforeunload` para backup emergencial em `localStorage`

### 4. Sync opcional

Hoje o app é local-first e o sync é uma extensão da persistência, não o centro do modelo. Isso é bom para confiabilidade offline, mas o contrato de sincronização ainda é simples e orientado a snapshot.

## Pontos fortes atuais

- arquitetura sem framework, simples de servir e distribuir
- modelo local-first adequado ao caso de uso
- boa profundidade funcional
- service worker já presente
- migrações de dados existentes
- documentação de plano e specs já começou a se estruturar dentro de `src/docs/`

## Fragilidades atuais

- `views.js` ainda concentra parte da complexidade de UI (embora views por domínio já tenham começado a ser extraídas)
- muitas ações ainda dependem de `window` via ponte de compatibilidade
- CSP ainda exige concessões fortes (inline styles, eval)
- ~300 `style=` inline em JS ainda pendentes de migração para CSS classes
- contratos de sync agora são mais explícitos (conflito 409, baseRemoteUpdatedAt), mas ainda são snapshot-based

## Direção recomendada

Sem trocar de stack, a direção desejada é:

- manter SPA local-first
- continuar quebrando views por domínio
- reduzir APIs globais (`window` bridge)
- migrar inline styles para CSS classes
- endurecer CSP removendo `unsafe-inline`
- evoluir sync de snapshot para versioned entity

