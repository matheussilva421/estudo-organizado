# Fluxo de Dados do Estudo Organizado

## Objetivo

Este documento registra como dados entram, são transformados, persistidos, sincronizados e refletidos na UI. A meta é reduzir regressões em refactors e tornar explícito o comportamento local-first do app.

## Fluxo principal

```text
Usuário interage com a UI
  -> módulo de view/componente captura ação
  -> função de domínio altera `state`
  -> `scheduleSave()` agenda persistência
  -> `store.js` salva no IndexedDB
  -> eventos do documento invalidam caches e atualizam a UI
  -> sync opcional pode enviar snapshot para Cloudflare
```

## Entrada de dados

As principais entradas vêm de:

- formulários de eventos, hábitos, editais e sessões
- controles do cronômetro
- ações de revisão
- configurações
- busca global
- restauração/importação de backup
- pulls remotos de sync

## Estado em memória

O estado em memória vive em `src/js/store.js` e contém, entre outros:

- `editais`
- `eventos`
- `arquivo`
- `habitos`
- `revisoes`
- `config`
- `cronoLivre`
- `planejamento`
- `bancaRelevance`

`setState()` normaliza a estrutura para impedir que campos esperados fiquem ausentes.

## Persistência local

### IndexedDB

É o armazenamento primário do app. O fluxo esperado é:

```text
Mutação do estado
  -> `scheduleSave()`
  -> debounce
  -> `saveStateToDB()`
  -> gravação em `main_state`
```

### localStorage

`localStorage` não é banco primário. Ele é usado para:

- backup emergencial em `pagehide`
- backup emergencial em `beforeunload`
- preferências pequenas de UI, como colapso da sidebar
- armazenamento auxiliar de identificador do cliente Google Drive

## Invalidação e rerender

O app usa eventos do documento como barramento leve de atualização:

- `app:renderCurrentView`
- `app:updateBadges`
- `app:showToast`
- `app:showConfirm`
- `app:invalidateCaches`
- `app:refreshEventCard`
- `app:refreshMEDSections`

Esse modelo funciona, mas hoje mistura coordenação legítima com bridge de compatibilidade para funções globais.

## Sync Cloudflare

Fluxo atual:

```text
Save local concluído
  -> se sync Cloudflare estiver ativo
  -> `SyncQueue.add(() => pushToCloudflare())`
  -> Worker recebe snapshot completo
  -> remoto passa a refletir a última versão enviada
```

Pull:

```text
Boot ou ação manual
  -> `pullFromCloudflare()`
  -> compara `_lastUpdated`
  -> aplica remoto se estiver mais novo
  -> salva localmente sem novo push em cascata
```

## Sync Google Drive

O Drive funciona mais como backup sincronizado e restauração do que como mecanismo principal de colaboração em tempo real. A lógica atual:

- autentica com OAuth
- localiza ou cria um arquivo JSON
- lê o conteúdo remoto
- compara `lastSync`
- decide sobrescrever local ou remoto

## Riscos atuais do fluxo

- o contrato de sync ainda é orientado a snapshot, não a entidades versionadas
- segredos e configurações de sync ficam próximos demais dos dados de negócio
- parte da UI usa HTML dinâmico demais para um CSP mais estrito
- busca global ainda tem lógica duplicada em mais de um ponto do código

## Estado alvo para próximos ciclos

O fluxo de dados deve evoluir para:

```text
UI sem handlers inline
  -> action dispatcher
  -> função de domínio
  -> persistência local
  -> sync opcional via contrato versionado
  -> UI reativa por eventos explícitos e helpers de renderização mais seguros
```

