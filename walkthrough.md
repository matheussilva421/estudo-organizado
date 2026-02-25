# Walkthrough — Correção de Bugs do Estudo Organizado

Foram corrigidos **43 bugs** em **3 ondas** de correção, across **8 arquivos** do projeto.

---

## Arquivos Modificados

| Arquivo | Bugs corrigidos |
|---|---|
| [store.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/store.js) | 9 |
| [views.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/views.js) | 16 |
| [components.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/components.js) | 7 |
| [registro-sessao.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/registro-sessao.js) | 8 |
| [app.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/app.js) | 5 |
| [drive-sync.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/drive-sync.js) | 2 |
| [styles.css](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/css/styles.css) | 1 |
| [index.html](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/index.html) | 3 |

---

## Wave 1 — Bugs Iniciais (15 bugs)

### 🔴 P0 Críticos

#### Variável `grupo` inexistente em `getFilteredVertItems`
O Edital Verticalizado crashava com `ReferenceError` porque `grupo` não existia no escopo.

```diff
- items.push({ edital, grupo, disc, ass });
+ items.push({ edital, disc, ass });
```

#### Padronização `concluído` → `concluido`
~40 ocorrências de `concluído` (com acento) foram padronizadas para `concluido` em todo o projeto via PowerShell, evitando inconsistências em property access do JS.

#### `saveLocal()` → `scheduleSave()`
`saveLocal()` não existia — chamada em `driveDisconnect()` e `importData()`.

```diff
- saveLocal();
+ scheduleSave();
```

#### Seletor CSS quebrado em `removeDOMCard`
Cards de evento não eram removidos do DOM por causa de espaços extras no seletor.

```diff
- const el = document.querySelector(`[data - event - id= "${eventId}"]`);
+ const el = document.querySelector(`[data-event-id="${eventId}"]`);
```

### 🟠 P1

#### Ciclo não creditava progresso
Lookup por ID incompatível (`cdisc_*` vs `disc_*`) — alterado para match por nome.

#### Timer leak no cronômetro
`_cronoInterval` limpado em `renderCurrentView()` ao trocar de view.

#### `requestNotifPermission()` inexistente
Substituído por `Notification.requestPermission()` inline.

#### `disciplinaId` → `discId` no cronômetro
Propriedade renomeada para consistência com o modelo de dados real.

### 🟡 P2

- `init()` duplicada removida de `app.js`
- `_pomodoroMode` importado do módulo em vez de `window`
- CSS vars `--green` e `--text` adicionadas ao `:root`
- `archiveOldEvents` removido do boot

---

## Wave 2 — Bugs Estruturais (12 bugs)

### 🔴 P0 Críticos

#### `state` reassignado diretamente — quebrava ES module bindings
**O bug mais crítico do app.** Três locais em `store.js` faziam `state = {...}`, quebrando todos os live bindings dos módulos ES.

```diff
  // loadStateFromDB
- state = request.result;
+ setState(request.result);

  // loadLegacyState
- state = JSON.parse(saved);
+ setState(JSON.parse(saved));

  // clearData
- state = { schemaVersion: ... };
+ setState({ schemaVersion: ... });
```

#### `syncToDrive` / `loadFromDrive` inexistentes
Botões no painel de Drive chamavam funções que não existiam.

```diff
- onclick="syncToDrive();showToast('Sincronizando...','info')"
+ onclick="syncWithDrive().then(()=>showToast('Sincronizado!','success'))"
```

#### `scheduleNotifications` inexistente
Botão "Testar" notificações → inline `new Notification(...)`.

#### `clearAllData()` não limpava IndexedDB
Removia chave errada do localStorage e fazia `reload()`. Agora delega para `clearData()` do store.

```diff
- localStorage.removeItem('estudo-organizado');
- location.reload();
+ window.clearData();
```

#### `_pendingRevCache` nunca invalidada
Revisões pendentes ficavam desatualizadas após marcar/adiar.

```diff
  invalidateDiscCache();
  invalidateRevCache();
+ invalidatePendingRevCache();
```

### 🟠 P1

#### Timer destruído ao cancelar modal
Adicionado backup/rollback do timer com `cancelRegistro()`.

#### `revisoesFeitas` vs `revisoesFetas`
Padronizado para `revisoesFetas` em `store.js` (migration) e `registro-sessao.js`.

### 🟡 P2

- `modal-disc` duplicado removido do HTML
- `updateTopbar()` morta removida de `app.js` (29 linhas)
- Import `init` removido de `drive-sync.js`
- Import/comentários `archiveOldEvents` limpos de `store.js`
- 6 exports duplicados removidos de `app.js` (`calDate`, `calViewMode`, `editingEventId`, etc.)

---

## Wave 3 — Bugs de Integração (16 bugs)

### 🔴 Críticos

#### `cancelRegistro` nunca era chamada
Botões × e Cancelar do modal de registro usavam `data-action="close-modal"` genérico.

```diff
- <button class="modal-close" data-action="close-modal" data-modal="modal-registro-sessao">
+ <button class="modal-close" onclick="cancelRegistro()">

- <button class="btn btn-ghost" data-action="close-modal" data-modal="modal-registro-sessao">
+ <button class="btn btn-ghost" onclick="cancelRegistro()">
```

#### `gapi` ReferenceError em todo salvamento
O `stateSaved` listener acessava `gapi.client` sem verificar se existia.

```diff
- if (gapi.client?.getToken() !== null && state.driveFileId) {
+ if (typeof gapi !== 'undefined' && gapi.client?.getToken() !== null && state.driveFileId) {
```

#### `sumulas` vs `sumula` — hábito nunca salvo
`TIPOS_ESTUDO` usava `id: 'sumulas'` mas `state.habitos` tinha chave `sumula`.

```diff
- { id: 'sumulas', label: 'Súmulas', icon: '⚖️' },
+ { id: 'sumula', label: 'Súmulas', icon: '⚖️' },
```

#### Hábitos sem `id` — impossível deletar

```diff
  state.habitos[tipo].push({
+   id: 'hab_' + Date.now() + Math.random(),
    data: todayStr(),
```

### 🟠 Funcionais

#### `ciclo` ausente no topbar

```diff
- editais: 'Editais', vertical: 'Edital Verticalizado', config: 'Configurações', cronometro: 'Cronômetro'
+ ..., cronometro: 'Cronômetro', ciclo: 'Ciclo de Estudos'
```

#### `openDiscModal` + `saveDisc` — edição não funcionava
Adicionado segundo parâmetro `discId`, com pre-fill de nome/ícone/cor e lógica de update no `saveDisc`.

#### Dois `id="timer-mode-btn"` conflitantes
Renomeado para `crono-mode-btn` dentro do `renderCronometro`.

#### `driveDisconnect` não revogava OAuth
Agora delega para `disconnectDrive()` do `drive-sync.js`.

#### Cronômetro pegava disciplina errada
`getDisc()` retorna `{disc, edital}`, mas o render usava `.nome` diretamente.

```diff
- const disc = getDisc(focusEvent.discId);
- const discName = disc ? disc.nome : 'Sem disciplina';
+ const discEntry = getDisc(focusEvent.discId);
+ const discName = discEntry ? discEntry.disc.nome : 'Sem disciplina';
```

### 🟡 Desconexões

#### `state.config.driveConnected` nunca setada
Todo o app usava `cfg.driveConnected`, mas o fluxo real de conexão nunca setava essa flag. Substituído por `state.driveFileId` + `localStorage('estudo_drive_client_id')`.

#### `videoaula` sem mapeamento em `state.habitos`
Adicionado `videoaula: []` ao default e migration.

#### `saveAndStartNew` não resetava estado
Adicionado reset de `_currentEventId`, `_selectedTipos`, `_selectedMateriais`.

#### Migration para `sumulas` → `sumula`
Dados de usuários antigos com `state.habitos.sumulas` agora são normalizados automaticamente.

---

## Commits

| Commit | Descrição |
|---|---|
| `0c0c1e2` | Wave 1: 14 bugs (concluido, saveLocal, selector, ciclo, interval) |
| `c66c112` | Wave 1: archiveOldEvents removido do boot |
| `4419f29` | Wave 2: 12 bugs (state binding, syncToDrive, clearAllData, cache, timer, revisoesFetas) |
| `29ab577` | Wave 2: 6 exports duplicados removidos |
| `6892d00` | Wave 3: 16 bugs (gapi, sumula, habit id, openDiscModal, driveFileId, cancelRegistro) |
| `[new]` | Wave 4: 6 bugs (runMigrations, XSS, duracao, sumula remnants, saveAndStartNew, a11y toggles) |

---

## Wave 4 — Problemas Críticos e UX (6 bugs)

### 🔴 Críticos

#### Importação sem `runMigrations()`
O fluxo de `importData()` (`views.js`) substituía o estado sem rodar as migrações, podendo quebrar usuários que importassem backups muito antigos (ex: chaves desatualizadas como `sumulas` em `habitos`, ou ausência de campos). Foi adicionada a chamada a `runMigrations()` após `setState()`.

#### Possível XSS em Tooltips/Cards
`showToast` e `renderEventCard` injetavam strings diretamente via template literal em `innerHTML` sem escape, permitindo a injeção de tags HTML ou JS se o usuário as digitasse no título. Substituto `innerHTML` por `textContent` no Toast e aplicada a função `esc()` no `renderEventCard`.

### 🟠 Altos

#### Inconsistência `duracao` vs `duracaoMinutos`
O cronômetro lia apenas `duracaoMinutos` em `plannedSecs`, enquanto os eventos salvos podiam conter a propriedade antiga `duracao`. Foi adicionado fallback para `(focusEvent.duracaoMinutos || focusEvent.duracao)`.

#### Resquícios de `sumulas` em Registro de Sessão
Havia verificações condicionais para revelar a seção de "Páginas Lidas" em `registro-sessao.js` que ainda usavam `sumulas` no array, impedindo a exibição ao selecionar "Súmulas". Alterado para `sumula` em conformidade.

### 🟡 Médios

#### Guard Clause em `saveAndStartNew`
A função `saveRegistroSessao` rodava as validações em early returns falsy, mas não retornava o status. A chamada `saveAndStartNew` prosseguia resetando e fechando o modal mesmo se a validação falhasse. Foi adicionado o retorno booleano.

#### Toggles de Configuração Inacessíveis (Débito Técnico)
Os botões de "Modo escuro", "Número da semana" e "Agrupar eventos" via `<div>` onclick eram inutilizáveis sem mouse e sem software de leitor de tela. Substituídos por `<button type="button">` com atributos `aria-pressed` e `aria-label`.

---

## Refatoração Arquitetural — Problema 7 (Dependências Circulares)

O aplicativo sofria com **Avisos de Inicialização do Vite** e instabilidades de estado devido a importações cíclicas entre o "Cérebro" (`logic.js`/`store.js`) e a "Interface" (`app.js`, `views.js`, `components.js`). 

A refatoração ocorreu em 5 etapas para estabelecer um fluxo de **Inversão de Controle (IoC)**, onde a UI reage à lógica, e a lógica dita as regras através de **Eventos de Domínio**:

### 1. Quebra do Ciclo no `store.js`
- `store.js` foi isolado para ser a fonte da verdade dos dados, não importando mais *nenhum* arquivo exceto utilitários puros.
- As chamadas cirúrgicas obrigando a interface a re-renderizar após salvar o estado (ex: `updateBadges()`, `renderCurrentView()`) foram substituídas por dispatches: `document.dispatchEvent(new Event('app:renderCurrentView'))`.

### 2. Extração de Utilitários (`utils.js`)
- Funções puras (`uid`, `esc`, `formatDate`, `todayStr`) e constantes estáticas (`getHabitType`, `HABIT_TYPES`) que ficavam emaranhadas no `app.js` e `components.js` foram extraídas para um arquivo isolado (Camada 1).

### 3. Inversão de Controle no `logic.js`
- O motor de negócios que lida com o cronômetro, análise de dados e deleção de eventos dependia do DOM e visuais.
- As chamadas a `refreshEventCard`, `removeDOMCard` e modais foram substituídas por dispatches globais como `app:eventoDeleted` e `app:refreshEventCard`, centralizando a orquestração do frontend na "recepção" dos eventos dentro de `main.js`.
- A variável compartilhada `timerIntervals` desceu do `app.js` para o `logic.js` para evitar a necessidade do arquivo lógico importar estado da UI.

### 4. Orquestrador Final (`main.js`)
- `main.js` agora age como o maestro ouvindo os eventos lançados pela Store e Logic, ativando as `views.js` corretas, matando os últimos rastros dos ciclos originais.

### Imagens Comprobatórias (UX Restaurada)
![Cronômetro funcionando normalmente pós-refatoração](C:\Users\slvma\.gemini\antigravity\brain\b6ad9f24-0890-4312-8874-043d805a1bc4\cronometro_redesigned_active_1771954686237.png)
![Fluxo de exclusão de evento no calendário](C:\Users\slvma\.gemini\antigravity\brain\b6ad9f24-0890-4312-8874-043d805a1bc4\calendar_bug_fixed_1771962927544.webp)

---

## Wave 5: Bug Fixes and Stability Improvements 

The fifth wave of development involved addressing a comprehensive list of bugs and edge cases to ensure the stability of the application. The following 8 problems were successfully resolved:

1. **Imports in app.js**: Restored missing imports (`todayStr`, `esc`) that caused crashes during init and the wizard cycle flow.
2. **Navigation Fixes**: Replaced inline `onclick="app.navigate('med')"` with standard event delegation (`data-action="navigate"`) to respect the scoped routing architecture in both `index.html` and `components.js`.
3. **Google Drive Sync Concurrency**: Implemented the `_isSyncing` lock inside `drive-sync.js` to prevent the periodic save interval from overlapping with the `stateSaved` hooks, ensuring single-threaded API uploads.
4. **Resilience to Drive 404s**: Improved the error-handling behavior in `syncWithDrive()`. 404 responses now gracefully clear the broken `state.driveFileId` and retry the process to create a fresh cloud snapshot.
5. **State Normalization**: Hardened `setState()` inside `store.js`. We inject structural defaults for complex objects (`ciclo`, `habitos`, `config`, etc.). This guards against partial or corrupt data payloads entering via IndexedDB or Google Drive imports.
6. **Debounce Logic Clean-up**: Addressed a race condition where `saveStateToDB()` was doubling up with `scheduleSave()` by executing `clearTimeout` on the pending debounce timer before an immediate execution. 
7. **DOM Delegation**: Switched the `toggle-ciclo-fin` read to evaluate the input directly via `e.target.closest('input')` rather than the potentially mis-targeted click bounds of labels.
8. **XSS Prevention**: Safely escaped user input using the utils `esc()` method before interpolating topics into `<option>` tags within `registro-sessao.js`.

### Validating Through Automation

The system successfully automated UI flows A, B, C, and D. Data creation, session recording with timer start/pause logic, and saving mechanisms preserved correct state over fast navigation iterations via IndexedDB without succumbing to debounce or sync races.

![Recording Session](file:///C:/Users/slvma/.gemini/antigravity/brain/b6ad9f24-0890-4312-8874-043d805a1bc4/.system_generated/click_feedback/click_feedback_1772024333733.png)

---

## Wave 6: Architecture & Vulnerability Fixes

Following a comprehensive code audit across the entire application stack, several critical underlying flaws were discovered regarding memory, data synchronicity, and DOM logic. They have been tackled within Wave 6:

### 1. Drive Sync API Data Format
**Issue:** `fetch` requests updating JSON files occasionally constructed mixed `FormData` boundaries and raw Headers, potentially causing Google Drive to reject file blobs and cause sync mismatches.
**Resolution:** Rebuilt the `PATCH` and `POST` calls in `drive-sync.js` to strictly follow Google API v3 specs using pre-calculated strings formatted correctly via `multipart/related`.

### 2. Orphaned Timers (Memory Leaks)
**Issue:** Removing event cards (`deleteEvento`) while timers were rolling failed to destroy the associated intervals natively.
**Resolution:** Added active garbage collection tracking in `logic.js` logic where `clearInterval(timerIntervals[eventId])` and standard cache sweeps happen during pause calls as well.

### 3. Missing `beforeunload` Protection
**Issue:** A race condition existed where unsaved states sitting in the 2-second debounce (`store.js`) could vanish if the user swiftly closed the tab right after performing an operation. 
**Resolution:** Handled strictly via a `beforeunload` overlay restricting native tab closing before saving operations clear.

### 4. Mathematical Data Corruption (Habits)
**Issue:** The habit lists allowed strings or 0s to trigger `Infinity` mathematically when rendering old formats inside the historical viewer, completely breaking UI updates.
**Resolution:** Introduced strict numeric typing with zero and NaN checks across mathematical operations within UI generators.

### 5. Non-Destructive Adiar Revisões
**Issue:** Previously, hitting *Adiar Revisões (+1 dia)* modified the historical truth field (`dataConclusao`).
**Resolution:** Re-engineered logic across `logic.js` and `views.js` to natively apply a new variable `adiamentos` that cleanly pushes the scheduled items without polluting the original timestamp.

### 6. XSS Prevention
**Issue:** Detected vulnerable parameters escaping generic helper coverage inside custom `.map().join('')` iterations in search and habit features.
**Resolution:** Wrapped instances of payload text dynamically created directly inside `esc()` rendering pipelines.
