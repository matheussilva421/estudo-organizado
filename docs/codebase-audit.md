# Codebase Audit — Estudo Organizado

**Data:** 2026-03-04
**Escopo:** Full-stack audit of `src/` (14 JS modules, 1 HTML, 1 CSS — ~6800 LOC JS, 442 LOC HTML, 3170 LOC CSS)

---

## 1. Resumo Executivo

O projeto é uma PWA de estudos para concursos, bem modularizada com ES Modules e padrão de eventos desacoplados (`dispatchEvent`/`addEventListener`). A arquitetura geral é sólida, com boa separação entre estado (`store.js`), lógica (`logic.js`), componentes (`components.js`), e views (`views.js`). Os achados abaixo são melhorias incrementais — não há falhas de segurança críticas.

### Contagem por Severidade

| Severidade | Qtd |
|------------|-----|
| Crítica    | 0   |
| Alta       | 2   |
| Média      | 4   |
| Baixa      | 5   |

---

## 2. Achados — Alta Severidade

### 2.1 Race condition em `syncWithDrive()` (drive-sync.js:174-182)

**Arquivo:** `src/js/drive-sync.js:180-181`

```js
_isSyncing = false;
return syncWithDrive(); // tenta novamente, agora criando arquivo novo
```

**Problema:** Quando o arquivo no Drive retorna 404, o código seta `_isSyncing = false`, faz uma chamada recursiva via `return syncWithDrive()` (sem `await`), e então o bloco `finally` do primeiro call executa imediatamente (antes do recursive call terminar), setando `_isSyncing = false` novamente. Isso cria uma janela onde um terceiro call concorrente pode passar pelo guard `if (_isSyncing) return`.

**Correção sugerida:**
```js
_isSyncing = false;
return await syncWithDrive(); // await garante que finally roda só após recursive completar
```

---

### 2.2 `_isSyncing` liberado prematuramente no fluxo de merge (drive-sync.js:160)

**Arquivo:** `src/js/drive-sync.js:160`

```js
_isSyncing = false; // release lock early
showConfirm('Encontrada versão mais recente no Drive...', () => { ... });
return;
```

**Problema:** O lock é liberado antes da decisão do usuário no `showConfirm`. Se o timer de 5 min (`_driveSyncInterval` em app.js:174) disparar outro `syncWithDrive()` enquanto o modal de confirmação está aberto, duas sincronizações podem correr em paralelo, potencialmente corrompendo dados.

**Correção sugerida:** Manter `_isSyncing = true` e liberá-lo dentro do callback do `showConfirm` e no `cancelConfirm` handler. Ou adicionar uma flag `_awaitingUserDecision` que bloqueia novos syncs.

---

## 3. Achados — Média Severidade

### 3.1 `openModal`/`closeModal` sem null check (app.js:35-42)

```js
export function openModal(id) {
  document.getElementById(id).classList.add('open'); // crashes se id inválido
}
```

**Impacto:** Se qualquer caller passar um ID inexistente (typo, modal removido), a app inteira trava com `TypeError: Cannot read properties of null`. Como essas funções são chamadas de dezenas de lugares, incluindo event handlers dinâmicos, a superfície de risco é ampla.

**Correção:** Adicionar null check: `const el = document.getElementById(id); if (el) el.classList.add('open');`

---

### 3.2 `showToast` sem null check no container (app.js:78)

```js
const container = document.getElementById('toast-container');
const last = container.lastElementChild; // crash se container null
```

**Impacto:** Se o DOM ainda não carregou ou o container foi removido, qualquer chamada a `showToast` (usada em toda a app) causa crash.

**Correção:** `if (!container) return;` no início da função.

---

### 3.3 `showConfirm` sem null checks (app.js:49-53)

```js
document.getElementById('confirm-title').textContent = title;
document.getElementById('confirm-msg').textContent = msg;
const okBtn = document.getElementById('confirm-ok-btn');
```

**Impacto:** Similar ao 3.1 — crash se os elementos não existem.

**Correção:** Adicionar guards ou combinar com o padrão já usado em `setupConfirmHandlers` (linhas 61-67), que faz `if (okBtn)`.

---

### 3.4 `getSyllabusProgress` assume `disciplinas` sempre existe (logic.js:342-343)

```js
state.editais.forEach(ed => {
  ed.disciplinas.forEach(d => { ... });
});
```

**Impacto:** Se um edital importado de versão antiga ou via Drive não tiver o campo `disciplinas`, o `forEach` crasheia. O `setState` normaliza `editais: []` mas não garante que cada item interno tenha `disciplinas`.

**Correção:** `(ed.disciplinas || []).forEach(...)` — ou validar no `runMigrations`.

---

## 4. Achados — Baixa Severidade

### 4.1 Dead code: listener `app:removeDOMCard` nunca disparado (main.js:75-76)

```js
document.addEventListener('app:removeDOMCard', (e) => {
  if (typeof window.removeDOMCard === 'function') window.removeDOMCard(e.detail.eventId);
});
```

**Fato:** Nenhum lugar no código dispara `document.dispatchEvent(new CustomEvent('app:removeDOMCard', ...))`. A funcionalidade equivalente é coberta pelo listener `app:eventoDeleted` (main.js:78-84).

**Ação:** Pode ser removido sem efeito colateral.

---

### 4.2 `prompt()` nativo em `addNovoTopico` (registro-sessao.js:442)

```js
const nome = prompt('Nome do novo tópico:');
```

**Problema:** Todo o resto da app usa `showConfirm` e modais customizados. O `prompt()` nativo quebra a consistência visual e não funciona bem em PWA mode em alguns dispositivos.

**Correção:** Substituir por `openGenericPrompt()` que já existe em `app.js`.

---

### 4.3 `closeModal` inline em HTML não é uma função global (index.html:420)

```html
<button class="btn btn-primary" onclick="closeModal('modal-ciclo-history')">Fechar</button>
```

**Problema:** `closeModal` é exportada de `app.js` e atribuída a `window` via `main.js`, mas o padrão do resto do HTML usa `data-action="close-modal" data-modal="..."` com event delegation. Este é o único `onclick="closeModal(...)"` inline fora de JS dinâmico.

**Ação:** Trocar por `data-action="close-modal" data-modal="modal-ciclo-history"` para consistência.

---

### 4.4 `cancelRegistro` via onclick inline (index.html:340, 347)

```html
<button class="modal-close" onclick="cancelRegistro()" ...>×</button>
<button class="btn btn-ghost" onclick="cancelRegistro()">Cancelar</button>
```

**Problema:** O modal de registro de sessão usa `onclick` inline chamando funções globais, enquanto todos os outros modais usam `data-action` com event delegation. Inconsistência de padrão.

---

### 4.5 Propriedade `status` dos eventos pode ficar desatualizada (app.js:164-168)

```js
state.eventos.forEach(ev => {
  if (ev.status === 'agendado' && ev.data && ev.data < todayStr()) {
    ev.status = 'atrasado';
  }
});
```

**Observação:** O status é recalculado no boot (app.js:164) e via `getEventStatus()` (utils.js:46-52), mas a atualização persistida no boot é redundante com a função utilitária que calcula em tempo real. Se a app ficar aberta overnight sem reload, eventos não mudam de status até a próxima recarga.

**Ação:** Considerar usar apenas `getEventStatus()` como source-of-truth e remover a mutação no boot, ou adicionar um timer de meia-noite para invalidar.

---

## 5. Aspectos Positivos

### 5.1 Segurança (XSS)
A função `esc()` (utils.js:9-17) é usada consistentemente em 68 ocorrências por todo o código. Os templates HTML dinâmicos escapam dados do usuário corretamente. A superfície de XSS é bem controlada.

### 5.2 Arquitetura de Eventos
O padrão `dispatchEvent`/`addEventListener` com custom events (`app:renderCurrentView`, `app:showToast`, etc.) desacopla bem os módulos. O `main.js` serve como hub central de routing de eventos.

### 5.3 Persistência
O sistema IndexedDB com fallback para localStorage (store.js:126-138) e migração incremental por schema version (store.js:239-367) é robusto. O `SyncQueue` (store.js:151-179) serializa operações de sync corretamente.

### 5.4 Modularização
Os 14 módulos JS têm responsabilidades claras e imports/exports bem definidos. Não há dependências circulares.

### 5.5 Timer state recovery
O tratamento de `_timerStart` no boot (store.js:96-107) usando `sessionStorage` previne corretamente a inflação de tempo acumulado quando o usuário fecha a aba.

---

## 6. Recomendações Estruturais (Não são bugs)

1. **Deduplicar código de upload no Drive:** `syncWithDrive()` tem dois blocos quase idênticos para `PATCH` (linhas 186-210) e `POST` (linhas 217-248). Extrair para uma função `uploadToDrive(method, fileId)`.

2. **Consolidar padrão de interação em modais:** Migrar os últimos `onclick` inline (registro-sessao modal, ciclo-history) para `data-action` com event delegation, mantendo um único padrão.

3. **Service Worker:** O `sw.js` é registrado mas seu conteúdo não foi auditado neste escopo. Recomenda-se verificar a estratégia de cache e atualização.

---

## 7. Arquivos Auditados

| Arquivo | LOC | Status |
|---------|-----|--------|
| `src/js/store.js` | ~390 | Auditado |
| `src/js/logic.js` | ~830 | Auditado |
| `src/js/app.js` | ~400 | Auditado |
| `src/js/views.js` | ~2500 | Auditado |
| `src/js/components.js` | ~320 | Auditado |
| `src/js/main.js` | ~160 | Auditado |
| `src/js/drive-sync.js` | ~270 | Auditado |
| `src/js/cloud-sync.js` | ~160 | Auditado |
| `src/js/utils.js` | ~74 | Auditado |
| `src/js/notifications.js` | ~137 | Auditado |
| `src/js/relevance.js` | ~328 | Auditado |
| `src/js/lesson-mapper.js` | ~95 | Auditado |
| `src/js/registro-sessao.js` | ~770 | Auditado |
| `src/js/planejamento-wizard.js` | ~420 | Auditado |
| `src/index.html` | 442 | Auditado |
| `src/css/styles.css` | 3170 | Visão parcial |
