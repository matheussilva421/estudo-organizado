# PLANO DE IMPLEMENTAÇÃO - Refatoração Técnica
## Estudo Organizado v8.3 → v9.0

**Autor:** Engenheiro de Software Sênior (IA)  
**Data:** 20 de abril de 2026  
**Duração Estimada:** 3-4 sprints (6-8 semanas)  
**Risco:** Médio (refatoração incremental com fallback)

---

## STATUS ATUAL - 2026-04-20 14:30

### Sprint 1 - Quick Wins: ✅ 100% COMPLETA
- [x] Cleanup de intervals em notifications.js
- [x] Sorts in-place corrigidos (relevance.js, logic.js)
- [x] Array mutations corrigidas (components.js)
- [x] Sistema de cleanup de listeners (utils.js)
- [x] Error handling em drive-sync (try/catch)

### Sprint 2 - Segurança: ✅ 100% COMPLETA
- [x] Deep clone em setState (store.js)
- [x] Credenciais em IndexedDB (credentials.js)
- [x] postMessage validado (sw.js)
- [x] innerHTML auditado - 100% seguro com esc()

### Sprint 3 - Window Bridge: ✅ 100% COMPLETA
- [x] Namespace EstudoApp criado (main.js)
- [x] JSDoc em módulos core (utils, store, logic, components, app)
- [x] Proxy transitório para fallback legado
- [x] Eventos de domínio roteados via EstudoApp

### Sprint 4 - Quebra de Monolitos: ⏳ EM PROGRESSO (50%)
- [x] Views já modularizadas (banca, calendar, ciclo, editais, habitos, home, dashboard)
- [x] **TAREFA 4.6: ui/actions.js dividido por domínio** ✅ COMPLETO
- [ ] views.js refatoração pendente (4600 linhas)

---

### Sprint 4.6 - Módulo de Ações por Domínio (COMPLETO - 2026-04-20)

**Módulos criados:**
- `src/js/ui/actions/eventos.js` - Timer, CRUD de eventos (18 funções)
- `src/js/ui/actions/editais.js` - Edital, disciplinas, assuntos, aulas (24 funções)
- `src/js/ui/actions/revisoes.js` - Revisões (4 funções)
- `src/js/ui/actions/habitos.js` - Hábitos (7 funções)
- `src/js/ui/actions/config.js` - Configurações, sync, backup (32 funções)
- `src/js/ui/actions/navegacao.js` - Navegação, sidebar, tema (12 funções)
- `src/js/ui/actions/modais.js` - Modais (9 funções)
- `src/js/ui/actions/dispatcher.js` - Registry e setup de event delegation
- `src/js/ui/actions/index.js` - Consolida todos exports

**Arquivo `actions.js`** mantém registro de ações via `registerAction()` para compatibilidade com data-action contracts.

**Validação:**
- 79 testes unitários passando
- Teste `action-contracts.test.js` atualizado para suportar formato `registerAction()`

---

**VISÃO GERAL


Este plano aborda os 8 bugs críticos e dívidas técnicas identificadas na auditoria, organizados em 4 sprints de 2 semanas cada.

## STATUS DE ESTABILIZAÇÃO - 2026-04-20

Revisão feita após a implementação parcial por outra IA. A auditoria encontrou regressões de UI e contratos quebrados principalmente na migração para `window.EstudoApp`, nos módulos extraídos e no precache do service worker.

Correções aplicadas nesta estabilização:
- Restaurado import de `HABIT_TYPES` em `src/js/views.js`, evitando quebra ao renderizar Hábitos.
- Exportado `debouncedOnSearch` e funções do wizard para o namespace `EstudoApp`, mantendo aliases legados em `window` enquanto a migração termina.
- Adicionado fallback transitório com `Proxy` em `src/js/main.js` para handlers legados ainda anexados em `window`.
- Roteados eventos de domínio de `src/js/main.js` por `window.EstudoApp`, reduzindo acoplamento direto ao global.
- Corrigido `src/js/registro-sessao.js` para importar `saveStateToDB` antes de salvar sessões detalhadas.
- Corrigido `marcarRevisao` em `src/js/views.js` com import de `invalidatePendingRevCache`.
- Definido `type="button"` nos botões de revisão para impedir submit/reload acidental da página.
- Atualizado `src/sw.js` para precache dos módulos runtime extraídos: `credentials.js`, `views/habitos-view.js` e `views/ciclo-view.js`.
- Expandido `tests/unit/action-contracts.test.js` para cobrir contratos de namespace, persistência, invalidadores, botões não-submit e precache.

Validação executada:
- `npm run test:unit -- tests/unit/action-contracts.test.js` -> 12/12 testes passando.
- `npm run test:e2e -- tests/e2e/sessoes.spec.js` -> 2/2 testes passando.
- `npm run test:e2e -- tests/e2e/revisoes-habitos.spec.js` -> 2/2 testes passando.
- `npm run test:e2e -- tests/e2e/editais.spec.js` -> 1/1 teste passando.
- `npm run test:e2e` -> 28/28 testes passando.
- `npm test` -> 79/79 testes passando.

Observações:
- Tentativa de criar branch `codex/stabilize-refatoracao-v9` falhou por permissão em `.git/refs`; a estabilização foi feita no worktree atual.
- O `npm test` ainda emite stderr conhecido em `tests/unit/sync-conflict.test.js` sobre `indexedDB.open mock not configured for this test`, mas o teste passa e não bloqueia a suíte.
- O fallback `Proxy` é propositalmente temporário. A próxima fase deve remover gradualmente handlers legados de `window` e substituir por imports explícitos ou registro formal de ações.

## CONTINUAÇÃO DA REFATORAÇÃO - 2026-04-20

Branch de trabalho: `codex-refatoracao-v9-stability`.

Fatia executada:
- Removido o calendário legado de `views.js` como API exportada. O runtime do calendário passa a ter um único dono: `src/js/views/calendar-view.js`.
- Mantido `src/js/components.js` usando o módulo extraído do calendário, evitando colisões de namespace no bootstrap.
- Exportados handlers do gerenciador de disciplina que antes dependiam do fallback `Proxy`: `switchManagerTab`, `editLessonInline`, `toggleAulaEstudada`, `addBulkAulas`, `addAssunto`, `deleteAula` e `runLessonMapperUI`.
- Exportados handlers de edição do ciclo/sequência: `toggleEditSeq`, `saveEditSeq`, `cancelEditSeq`, `updateSeqItem`, `dupSeqItem`, `remSeqItem`, `moveSeqItem`, `addSeqItem` e `openCicloHistory`.
- Mantidos aliases legados em `window.*` para compatibilidade enquanto o restante da bridge é removido gradualmente.
- Expandido `tests/unit/action-contracts.test.js` para travar esses contratos.

Validação executada nesta fatia:
- `npm run test:unit -- tests/unit/action-contracts.test.js` -> 14/14 testes passando.
- `npm run test:e2e -- tests/e2e/app.spec.js -g "calendar"` -> 1/1 teste passando.
- `npm run test:e2e -- tests/e2e/calendar.spec.js` -> 1/1 teste passando.
- `npm run test:e2e -- tests/e2e/editais.spec.js` -> 1/1 teste passando.
- `npm run test:e2e -- tests/e2e/planejamento.spec.js` -> 1/1 teste passando.
- `npm test` -> 81/81 testes passando.
- `npm run test:e2e -- tests/e2e/offline-import.spec.js` -> 2/2 testes passando.
- `npm run test:e2e` -> 28/28 testes passando após rerun completo. A primeira execução completa teve uma falha intermitente em `offline-import.spec.js` durante `page.reload`, mas o spec isolado passou e a suíte completa seguinte passou.

Fatia executada na sequência:
- Corrigida a intermitência do `offline-import.spec.js` no `page.reload`: `src/js/sw-register.js` agora só recarrega em `controllerchange` quando a página já tinha um `navigator.serviceWorker.controller`, evitando reload automático no primeiro claim do service worker.
- Removido o fallback transitório com `Proxy` em `src/js/main.js`; `window.EstudoApp` volta a ser um namespace explícito composto apenas por exports dos módulos carregados.
- Migrados handlers restantes que ainda nasciam como `window.* = function` para exports formais: cronômetro livre e ciclo em `src/js/logic.js`, exclusão de sessão em `src/js/registro-sessao.js`, e ações de ciclo/previsão em `src/js/views/ciclo-view.js`.
- Reexportados `recomecarCiclo`, `zerarCiclosCounter` e `calculateCyclePredictions` por `src/js/views.js`, garantindo que o dispatcher central encontre esses alvos por `window.EstudoApp` sem depender de fallback global.
- Mantidos apenas aliases legados explícitos do tipo `window.nome = nome` onde ainda há compatibilidade histórica, sem criar novos handlers diretamente como expressões em `window`.
- Expandido `tests/unit/action-contracts.test.js` para travar a ausência de `Proxy`, impedir `window.* = function`/arrow em módulos runtime e exigir exports dos handlers migrados.

Validação executada nesta sequência:
- `npm run test:unit -- tests/unit/action-contracts.test.js` -> 18/18 testes passando.
- `npm run test:e2e -- tests/e2e/planejamento.spec.js` -> 1/1 teste passando.
- `npm run test:e2e -- tests/e2e/editais.spec.js` -> 1/1 teste passando.
- `npm run test:e2e -- tests/e2e/offline-import.spec.js` -> 2/2 testes passando.
- `npm test` -> 85/85 testes passando. Permanece stderr conhecido de `tests/unit/sync-conflict.test.js` sobre `indexedDB.open mock not configured for this test`, sem falha da suíte.
- `npm run test:e2e` -> 28/28 testes passando.

Próximas fatias recomendadas:
- Extrair o bloco MED e o bloco Revisões para módulos próprios.
- Dividir `ui/actions.js` por domínio depois que os alvos estiverem exportados explicitamente.
- Reduzir gradualmente os aliases legados `window.nome = nome` depois que os pontos de chamada antigos forem removidos.

### Princípios de Execução

1. **Incremental:** Cada PR deve manter o app funcional
2. **Test-first:** Testes antes de refatorar
3. **Rollback-safe:** Cada mudança deve ser reversível
4. **Zero regressão:** Testes E2E devem passar em cada PR

---

## SPRINT 1 - Quick Wins (Baixo Risco, Alto Impacto)
**Duração:** 2 semanas  
**Foco:** Memory leaks e array mutations

---

### TAREFA 1.1: Cleanup de setInterval em notifications.js
**Arquivo:** `src/js/notifications.js`  
**Linhas:** 125-128  
**Esforço:** 1 hora  
**Risco:** Baixo

**Problema:**
```javascript
// Linha 125-128
if (notificationEngineInterval) clearInterval(notificationEngineInterval);
notificationEngineInterval = setInterval(() => {
  checkTriggers();
}, 14400000);  // Nunca limpo no unload
```

**Solução:**
```javascript
// Adicionar função de cleanup exportada
export function cleanupNotificationEngine() {
  if (notificationEngineInterval) {
    clearInterval(notificationEngineInterval);
    notificationEngineInterval = null;
  }
}

// Listener no beforeunload
window.addEventListener('beforeunload', () => {
  cleanupNotificationEngine();
});

// Exportar cleanup no módulo
export function cleanup() {
  cleanupNotificationEngine();
}
```

**Arquivos para modificar:**
- `src/js/notifications.js` - Adicionar cleanup

**Testes necessários:**
- Teste unitário: `tests/unit/notifications.test.js`
- Verificar: setInterval é limpo após 5 minutos de inatividade

**Critério de Aceitação:**
- [ ] `cleanupNotificationEngine` exportada
- [ ] Listener `beforeunload` registrado
- [ ] Teste unitário passa
- [ ] Sem erros no console após reload

---

### TAREFA 1.2: Fix de sort in-place em relevance.js
**Arquivo:** `src/js/relevance.js`  
**Linhas:** 321  
**Esforço:** 30 minutos  
**Risco:** Baixo

**Problema:**
```javascript
// Linha 321 - Mutação in-place
disc.assuntos.sort((a, b) => a.nome.localeCompare(b.nome));
```

**Solução:**
```javascript
// Criar cópia antes de sort
disc.assuntos = [...disc.assuntos].sort((a, b) => a.nome.localeCompare(b.nome));
```

**Arquivos para modificar:**
- `src/js/relevance.js` - Linha 321

**Testes necessários:**
- Teste unitário existente deve passar
- Verificar: array original não é mutado

**Critério de Aceitação:**
- [ ] Spread operator antes de sort
- [ ] Testes de relevância passam
- [ ] Sem efeitos colaterais em state

---

### TAREFA 1.3: Fix de múltiplos sorts in-place em logic.js
**Arquivo:** `src/js/logic.js`  
**Linhas:** 507, 548, 611  
**Esforço:** 1 hora  
**Risco:** Baixo

**Problema:**
```javascript
// Linha 507, 548, 611 - Sort in-place
const sorted = array.sort(comparator);  // ❌ Mutação
```

**Solução:**
```javascript
// Sempre usar spread
const sorted = [...array].sort(comparator);  // ✅ Cópia
```

**Arquivos para modificar:**
- `src/js/logic.js` - Linhas 507, 548, 611

**Busca para identificação:**
```bash
grep -n "\.sort(" src/js/logic.js
```

**Testes necessários:**
- `tests/unit/logic.test.js` - Todos os 8 testes devem passar
- Adicionar teste: "não muta arrays originais"

**Critério de Aceitação:**
- [ ] Todos os `.sort()` usam spread
- [ ] Testes unitários passam
- [ ] Teste de não-mutação adicionado

---

### TAREFA 1.4: Fix de array mutation em components.js
**Arquivo:** `src/js/components.js`  
**Linhas:** 30-31  
**Esforço:** 30 minutos  
**Risco:** Baixo

**Problema:**
```javascript
// Linha 30-31 - unshift muta array compartilhado
allTimerEvents.unshift(cronoLivreMock);
```

**Solução:**
```javascript
// Criar novo array
const allTimerEvents = [cronoLivreMock, ...getTimerEvents()];
```

**Arquivos para modificar:**
- `src/js/components.js` - Linha 30-31

**Testes necessários:**
- Verificar: `getTimerEvents()` não é mutado
- Teste de renderização de timer

**Critério de Aceitação:**
- [ ] Spread ao invés de unshift
- [ ] Timer renderiza corretamente
- [ ] Sem efeitos colaterais

---

### TAREFA 1.5: Adicionar cleanup de listeners globais
**Arquivo:** `src/js/main.js`, `src/js/views.js`, `src/js/ui/actions.js`  
**Esforço:** 3 horas  
**Risco:** Médio

**Problema:** Múltiplos event listeners sem remoção

**Solução - Criar sistema de cleanup:**
```javascript
// src/js/utils.js - Adicionar helpers
const cleanupRegistry = new Set();

export function addCleanupListener(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  cleanupRegistry.add({ target, event, handler, options });
}

export function cleanupAllListeners() {
  cleanupRegistry.forEach(({ target, event, handler, options }) => {
    target.removeEventListener(event, handler, options);
  });
  cleanupRegistry.clear();
}

// Exportar para window unload
window.addEventListener('beforeunload', () => {
  cleanupAllListeners();
});
```

**Arquivos para modificar:**
1. `src/js/utils.js` - Adicionar helpers de cleanup
2. `src/js/main.js` - Usar `addCleanupListener` ao invés de `addEventListener`
3. `src/js/views.js` - Mesma mudança
4. `src/js/ui/actions.js` - Mesma mudança

**Migração incremental:**
```javascript
// Antes
document.addEventListener('app:renderCurrentView', handler);

// Depois
addCleanupListener(document, 'app:renderCurrentView', handler);
```

**Testes necessários:**
- Teste unitário: `tests/unit/utils.test.js` - cleanup helpers
- Teste E2E: navegar entre views e verificar sem memory leaks

**Critério de Aceitação:**
- [ ] `addCleanupListener` e `cleanupAllListeners` exportados
- [ ] Todos listeners em `main.js` migrados
- [ ] Teste de cleanup passa
- [ ] DevTools Memory mostra sem leaks

---

### TAREFA 1.6: Adicionar .catch() em Promises no drive-sync.js
**Arquivo:** `src/js/drive-sync.js`  
**Linhas:** 263, 295  
**Esforço:** 1 hora  
**Risco:** Baixo

**Problema:**
```javascript
// Linha 263, 295 - Promise sem catch visível
fetch(url, options).then(res => {...});
```

**Solução:**
```javascript
fetch(url, options)
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(data => { /* sucesso */ })
  .catch(err => {
    console.error('Drive API error:', err);
    showToast('Erro de sincronização', 'error');
    throw err; // Re-thrown para caller
  });
```

**Arquivos para modificar:**
- `src/js/drive-sync.js` - Linhas 263, 295 e outras occurrences

**Busca para identificação:**
```bash
grep -n "\.then(" src/js/drive-sync.js | grep -v "\.catch("
```

**Testes necessários:**
- `tests/unit/drive-sync.test.js` - Adicionar teste de erro
- Teste E2E: sync com falha de rede

**Critério de Aceitação:**
- [ ] Todas Promises têm `.catch()`
- [ ] Erros são logados e notificados
- [ ] Teste de erro de rede passa

---

### DELIVERABLES SPRINT 1

| Entregável | Status |
|------------|--------|
| Memory leaks de intervals fixos | ⬜ |
| Sorts in-place corrigidos | ⬜ |
| Array mutations corrigidas | ⬜ |
| Sistema de cleanup de listeners | ⬜ |
| Error handling em drive-sync | ⬜ |
| Todos testes unitários passando | ⬜ |
| Todos testes E2E passando | ⬜ |

---

## SPRINT 2 - Segurança e Estado
**Duração:** 2 semanas  
**Foco:** innerHTML e state mutations

---

### TAREFA 2.1: Fix de mutação direta do state em store.js
**Arquivo:** `src/js/store.js`  
**Linhas:** 33-34  
**Esforço:** 2 horas  
**Risco:** Médio-Alto

**Problema:**
```javascript
// Linha 33-34 - Mutação direta
Object.keys(state).forEach(k => delete state[k]);
Object.assign(state, normalized);
```

**Solução:**
```javascript
// Opção 1: Deep clone (recomendado)
export function setState(newState) {
  const normalized = normalize(newState);
  // Clonar propriedades individualmente
  for (const key of Object.keys(state)) {
    delete state[key];
  }
  for (const key of Object.keys(normalized)) {
    state[key] = structuredClone ? structuredClone(normalized[key]) : 
                 JSON.parse(JSON.stringify(normalized[key]));
  }
  // Disparar evento de state alterado
  document.dispatchEvent(new CustomEvent('app:stateChanged', { 
    detail: { timestamp: Date.now() } 
  }));
}

// Opção 2: Usar biblioteca de immutable (futuro)
// import { produce } from 'immer';
// state = produce(state, draft => { ... });
```

**Arquivos para modificar:**
- `src/js/store.js` - Função `setState`

**Testes necessários:**
- `tests/unit/store.test.js` - Adicionar teste de imutabilidade
- Teste: modificar retorno de setState não afeta original

**Critério de Aceitação:**
- [ ] `setState` usa deep clone
- [ ] Teste de imutabilidade passa
- [ ] Sem efeitos colaterais em mutations
- [ ] Performance não degradada (>95% do original)

---

### TAREFA 2.2: Criar helper seguro para innerHTML
**Arquivo:** `src/js/utils.js` (novo módulo)  
**Esforço:** 2 horas  
**Risco:** Baixo

**Solução - Criar `src/js/dom.js`:**
```javascript
// src/js/dom.js - Novo arquivo
import { esc } from './utils.js';

/**
 * Set innerHTML com validação de segurança
 * @param {string} id - Element ID
 * @param {string} html - HTML string (já sanitizada)
 * @returns {boolean} - Sucesso
 */
export function safeSetHTML(id, html) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[DOM] Element #${id} not found`);
    return false;
  }
  el.innerHTML = html;
  return true;
}

/**
 * Criar elemento DOM seguro sem innerHTML
 * @param {string} tag - Tag name
 * @param {object} attrs - Attributes
 * @param {string|Node} content - Text content or Node
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, content = null) {
  const el = document.createElement(tag);
  
  // Warn sobre inline handlers
  const inlineHandlers = ['onclick', 'onchange', 'onsubmit', 'onkeyup', 'onkeydown'];
  for (const handler of inlineHandlers) {
    if (handler in attrs) {
      console.warn(`[DOM] Inline handler ${handler} discouraged. Use data-action instead.`);
    }
  }
  
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'textContent') {
      el.textContent = value;
    } else if (key.startsWith('data-') || key === 'aria-') {
      el.setAttribute(key, value);
    } else if (!inlineHandlers.includes(key)) {
      el.setAttribute(key, value);
    }
  }
  
  if (content) {
    if (typeof content === 'string') {
      el.textContent = content;
    } else if (content instanceof Node) {
      el.appendChild(content);
    }
  }
  
  return el;
}

/**
 * Highlight text com marcação segura
 * @param {string} str - String original
 * @param {RegExp} regex - Pattern para highlight
 * @returns {string} - HTML seguro com <mark>
 */
export function highlightText(str, regex) {
  const escaped = esc(str);
  return escaped.replace(regex, '<mark>$1</mark>');
}
```

**Arquivos para modificar:**
- `src/js/dom.js` - NOVO ARQUIVO
- `src/js/utils.js` - Exportar `esc`
- `src/js/views.js` - Importar `safeSetHTML`, `highlightText`

**Testes necessários:**
- `tests/unit/dom.test.js` - Testar helpers
- Teste: XSS via innerHTML é prevenido

**Critério de Aceitação:**
- [ ] `dom.js` criado com helpers
- [ ] `safeSetHTML` usado em todos innerHTML de views.js
- [ ] `highlightText` substitui pattern de highlight inline
- [ ] Teste de XSS prevention passa

---

### TAREFA 2.3: Migrar innerHTML para safeSetHTML em views.js
**Arquivo:** `src/js/views.js`  
**Ocorrências:** 39 de 87 total  
**Esforço:** 8 horas  
**Risco:** Médio

**Abordagem incremental:**

**Fase 1: Busca e substituição manual (4 horas)**
```bash
# Identificar todos innerHTML
grep -n "innerHTML" src/js/views.js
```

**Fase 2: Migração por seção (4 horas)**

Exemplo de migração:
```javascript
// Antes
el.innerHTML = `<span class="${colorClass}">${pct}%</span>`;

// Depois (usando template com esc)
el.innerHTML = `<span class="${esc(colorClass)}">${esc(pct)}%</span>`;

// Ou melhor (usando createElement)
const span = createElement('span', { className: colorClass }, `${pct}%`);
el.appendChild(span);
```

**Arquivos para modificar:**
- `src/js/views.js` - 39 ocorrências
- `src/js/components.js` - 9 ocorrências
- `src/js/app.js` - 3 ocorrências
- `src/js/logic.js` - 3 ocorrências
- `src/js/views/*.js` - 13 ocorrências

**Prioridade de migração:**
1. innerHTML com dados do usuário (alto risco)
2. innerHTML com dados do state (médio risco)
3. innerHTML com HTML estático (baixo risco)

**Testes necessários:**
- Testes E2E: todas as views renderizam corretamente
- Teste visual: screenshots comparativos

**Critério de Aceitação:**
- [ ] 100% innerHTML usam `esc()` ou `safeSetHTML`
- [ ] Nenhum dado de usuário é inserido sem escape
- [ ] Testes visuais passam
- [ ] CSP pode remover `unsafe-inline` (futuro)

---

### TAREFA 2.4: Mover credenciais de localStorage para IndexedDB
**Arquivo:** `src/js/cloud-sync.js`, `src/js/drive-sync.js`, `src/js/store.js`  
**Esforço:** 4 horas  
**Risco:** Médio

**Problema:**
```javascript
// cloud-sync.js:32
localStorage.setItem(SYNC_CREDS_KEY, JSON.stringify({ url, token, enabled }));
```

**Solução:**
```javascript
// src/js/credentials.js - NOVO MÓDULO
const CREDS_DB_NAME = 'EstudoCredenciaisDB';
const CREDS_DB_VERSION = 1;
const CREDS_STORE_NAME = 'creds';

let credsDb = null;

export async function initCredentialsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CREDS_DB_NAME, CREDS_DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CREDS_STORE_NAME)) {
        db.createObjectStore(CREDS_STORE_NAME);
      }
    };
    
    request.onsuccess = (e) => {
      credsDb = e.target.result;
      resolve(credsDb);
    };
    
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function setCredential(key, value) {
  if (!credsDb) await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readwrite');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCredential(key) {
  if (!credsDb) await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readonly');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCredential(key) {
  if (!credsDb) await initCredentialsDB();
  return new Promise((resolve, reject) => {
    const tx = credsDb.transaction([CREDS_STORE_NAME], 'readwrite');
    const store = tx.objectStore(CREDS_STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// NÃO exportar função de getAll - manter separado do estado exportável
```

**Migração:**
```javascript
// cloud-sync.js - Antes
import { SYNC_CREDS_KEY } from './constants';
localStorage.setItem(SYNC_CREDS_KEY, JSON.stringify(creds));

// cloud-sync.js - Depois
import { setCredential, getCredential } from './credentials.js';
await setCredential('cloudflare', creds);
```

**Arquivos para modificar:**
- `src/js/credentials.js` - NOVO
- `src/js/cloud-sync.js` - Migrar para credentials.js
- `src/js/drive-sync.js` - Migrar para credentials.js
- `src/js/views.js` - Atualizar UI de sync

**Testes necessários:**
- `tests/unit/credentials.test.js` - Testar CRUD
- Teste E2E: sync funciona após migração

**Critério de Aceitação:**
- [ ] Credenciais em IndexedDB separado
- [ ] localStorage não contém tokens
- [ ] Exportação de estado não inclui credenciais
- [ ] Sync funciona após migração

---

### TAREFA 2.5: Adicionar validação de origem em postMessage
**Arquivo:** `src/js/sw-register.js`, `src/js/sw.js`  
**Esforço:** 1 hora  
**Risco:** Baixo

**Solução:**
```javascript
// src/js/sw-register.js
if (reg.waiting) {
  // Validar origem antes de enviar
  reg.waiting.postMessage({ type: 'SKIP_WAITING' }, window.location.origin);
}

// src/js/sw.js - Adicionar validação no listener
self.addEventListener('message', (event) => {
  // Validar origem
  if (event.origin !== self.origin) {
    console.warn('[SW] Rejected message from untrusted origin:', event.origin);
    return;
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

**Arquivos para modificar:**
- `src/js/sw-register.js`
- `src/js/sw.js`

**Testes necessários:**
- Teste unitário: mensagem de origem inválida é rejeitada

**Critério de Aceitação:**
- [ ] Origem validada em postMessage
- [ ] Mensagens de origem inválida são logadas e rejeitadas
- [ ] Service worker ativa corretamente

---

### DELIVERABLES SPRINT 2

| Entregável | Status |
|------------|--------|
| State mutations corrigidas | ⬜ |
| Helpers DOM seguros criados | ⬜ |
| innerHTML migrado para safeSetHTML | ⬜ |
| Credenciais em IndexedDB | ⬜ |
| postMessage validado | ⬜ |
| Todos testes passando | ⬜ |

---

## SPRINT 3 - Window Bridge e Namespace
**Duração:** 2 semanas  
**Foco:** Eliminar window bridge global

---

### TAREFA 3.1: Criar namespace EstudoApp
**Arquivo:** `src/js/main.js`  
**Esforço:** 2 horas  
**Risco:** Médio

**Solução:**
```javascript
// src/js/main.js - Modificar linhas 30-36

// Antes
for (const mod of modules) {
  for (const [key, value] of Object.entries(mod)) {
    window[key] = value;  // ❌ Poluição global
  }
}

// Depois
window.EstudoApp = {};
const exposedModules = {};

for (const mod of modules) {
  for (const [key, value] of Object.entries(mod)) {
    // Evitar duplicatas
    if (key in exposedModules) {
      console.warn(`[EstudoApp] Duplicate export: ${key}`);
    }
    exposedModules[key] = value;
    window.EstudoApp[key] = value;
  }
}

// Log para debug
console.log('[EstudoApp] Módulos carregados:', Object.keys(exposedModules).length);
```

**Arquivos para modificar:**
- `src/js/main.js` - Linhas 30-36

**Testes necessários:**
- Teste: window não é poluído
- Teste: EstudoApp contém todos exports

**Critério de Aceitação:**
- [ ] window não tem exports diretos
- [ ] window.EstudoApp contém todos exports
- [ ] Console log mostra módulos carregados
- [ ] App funciona normalmente

---

### TAREFA 3.2: Migrar handlers inline para data-action
**Arquivo:** `src/js/ui/actions.js`, `src/index.html`  
**Esforço:** 8 horas  
**Risco:** Alto

**Abordagem:**

**Fase 1: Auditoria de handlers inline**
```bash
# Buscar onclick, onchange, etc no HTML
grep -n "onclick\|onchange\|onsubmit" src/index.html

# Buscar window.* em JS
grep -rn "window\." src/js/ --include="*.js" | grep -v "window.EstudoApp"
```

**Fase 2: Criar actions faltantes**
```javascript
// src/js/ui/actions.js - Adicionar actions faltantes
export const actions = {
  // ... existing actions
  
  // Adicionar novas
  toggleDarkMode: () => {
    window.EstudoApp.toggleTheme();
  },
  
  openModal: (target, event) => {
    const modalId = target.dataset.modal;
    window.EstudoApp.openModal(modalId);
  },
  
  // ... mais actions
};
```

**Fase 3: Migrar HTML**
```html
<!-- Antes -->
<button onclick="toggleDarkMode()">Modo escuro</button>

<!-- Depois -->
<button data-action="toggleDarkMode">Modo escuro</button>
```

**Arquivos para modificar:**
- `src/js/ui/actions.js` - Adicionar actions faltantes
- `src/index.html` - Migrar handlers inline
- `src/js/views.js` - Migrar innerHTML com handlers

**Testes necessários:**
- `tests/unit/inline-handlers.test.js` - Verificar zero inline handlers
- Testes E2E: todas as ações funcionam

**Critério de Aceitação:**
- [ ] Zero `onclick=`, `onchange=`, `onsubmit=` no HTML
- [ ] Zero `window.` direto em JS (exceto EstudoApp)
- [ ] Todas actions via data-action
- [ ] Testes E2E passam

---

### TAREFA 3.3: Remover window bridge gradualmente
**Arquivo:** Múltiplos  
**Esforço:** 16 horas  
**Risco:** Alto

**Abordagem incremental por módulo:**

**Semana 1: Módulos core**
1. `store.js` - Usar imports diretos
2. `logic.js` - Usar imports diretos
3. `utils.js` - Usar imports diretos
4. `components.js` - Usar imports diretos

**Semana 2: Módulos UI**
5. `views.js` - Usar imports diretos
6. `app.js` - Usar imports diretos
7. `ui/actions.js` - Usar imports diretos
8. `ui/dialog.js` - Usar imports diretos

**Exemplo de migração:**
```javascript
// Antes (via window bridge)
function handler() {
  window.openModal('modal-id');  // window bridge
  window.showToast('Mensagem');   // window bridge
}

// Depois (imports diretos)
import { openModal, showToast } from './app.js';

function handler() {
  openModal('modal-id');  // Import direto
  showToast('Mensagem');
}
```

**Arquivos para modificar:**
- Todos arquivos JS que usam `window.*`

**Testes necessários:**
- Testes unitários de cada módulo
- Testes E2E de todos os fluxos

**Critério de Aceitação:**
- [ ] 80% de window bridge removido
- [ ] Imports diretos em módulos core
- [ ] Zero regressão em testes E2E

---

### TAREFA 3.4: Adicionar type hints com JSDoc
**Arquivo:** Todos módulos  
**Esforço:** 8 horas  
**Risco:** Baixo

**Solução:**
```javascript
/**
 * Set innerHTML com validação de segurança
 * @param {string} id - Element ID
 * @param {string} html - HTML string (já sanitizada)
 * @returns {boolean} - Sucesso
 */
export function safeSetHTML(id, html) {
  // ...
}

/**
 * @typedef {Object} EventData
 * @property {string} id
 * @property {string} data
 * @property {string} status
 * @property {string=} discId
 * @property {string=} assId
 */

/**
 * @param {EventData} evento
 * @returns {string} 'estudei'|'agendado'|'atrasado'
 */
export function getEventStatus(evento) {
  // ...
}
```

**Benefício:** TypeScript-like checking sem build step

**Arquivos para modificar:**
- `src/js/utils.js` - JSDoc em todas funções exportadas
- `src/js/store.js` - JSDoc em types de state
- `src/js/logic.js` - JSDoc em funções de domínio
- `src/js/dom.js` - JSDoc completo

**Testes necessários:**
- Validar JSDoc com ferramenta externa (opcional)

**Critério de Aceitação:**
- [ ] 100% funções exportadas têm JSDoc
- [ ] Types definidos para structs de dados
- [ ] VS Code IntelliSense funciona

---

### DELIVERABLES SPRINT 3

| Entregável | Status |
|------------|--------|
| Namespace EstudoApp criado | ⬜ |
| Handlers inline migrados | ⬜ |
| Window bridge 80% removido | ⬜ |
| JSDoc em módulos core | ⬜ |
| Testes passando | ⬜ |

---

## SPRINT 4 - Quebra de Monolitos
**Duração:** 2 semanas  
**Foco:** Extrair views.js e actions.js

---

### TAREFA 4.1: Extrair views/med-view.js
**Arquivo:** `src/js/views.js` → `src/js/views/med-view.js`  
**Esforço:** 4 horas  
**Risco:** Médio

**Plano de extração:**

**Passo 1: Identificar função renderMED**
```bash
grep -n "export function renderMED" src/js/views.js
```

**Passo 2: Criar novo módulo**
```javascript
// src/js/views/med-view.js
import { esc, formatTime, todayStr } from '../utils.js';
import { state } from '../store.js';
import { getPerformanceStats, getPagesReadStats } from '../logic.js';

/**
 * Renderiza Study Organizer (lista de eventos do dia)
 * @param {HTMLElement} el - Container
 */
export function renderMED(el) {
  // ... código extraído de views.js
}

/**
 * Renderiza estatísticas rápidas do MED
 * @param {HTMLElement} el
 */
export function renderMEDStats(el) {
  // ...
}
```

**Passo 3: Re-exportar em views.js**
```javascript
// src/js/views.js - Substituir renderMED por re-export
export { renderMED, renderMEDStats } from './views/med-view.js';
```

**Passo 4: Atualizar imports em main.js se necessário**
```javascript
// main.js - Se renderMED era acessado via window
// Agora: window.EstudoApp.renderMED ainda funciona via re-export
```

**Arquivos para modificar:**
- `src/js/views/med-view.js` - NOVO
- `src/js/views.js` - Re-export

**Testes necessários:**
- Teste E2E: MED view renderiza
- Teste visual: screenshot comparativo

**Critério de Aceitação:**
- [ ] `renderMED` extraída para módulo dedicado
- [ ] Re-export em views.js funciona
- [ ] MED view idêntica visualmente
- [ ] Zero erros no console

---

### TAREFA 4.2: Extrair views/revisoes-view.js
**Arquivo:** `src/js/views.js` → `src/js/views/revisoes-view.js`  
**Esforço:** 4 horas  
**Risco:** Médio

**Mesmo padrão da Tarefa 4.1**

**Arquivos para modificar:**
- `src/js/views/revisoes-view.js` - NOVO
- `src/js/views.js` - Re-export

**Critério de Aceitação:**
- [ ] `renderRevisoes` extraída
- [ ] Revisões view funciona
- [ ] Zero regressão

---

### TAREFA 4.3: Extrair views/habitos-view.js
**Arquivo:** `src/js/views.js` → `src/js/views/habitos-view.js`  
**Esforço:** 4 horas  
**Risco:** Médio

**Mesmo padrão da Tarefa 4.1**

**Arquivos para modificar:**
- `src/js/views/habitos-view.js` - NOVO
- `src/js/views.js` - Re-export

**Critério de Aceitação:**
- [ ] `renderHabitos` extraída
- [ ] Hábitos view funciona

---

### TAREFA 4.4: Extrair views/config-view.js
**Arquivo:** `src/js/views.js` → `src/js/views/config-view.js`  
**Esforço:** 4 horas  
**Risco:** Médio

**Mesmo padrão da Tarefa 4.1**

**Arquivos para modificar:**
- `src/js/views/config-view.js` - NOVO
- `src/js/views.js` - Re-export

**Critério de Aceitação:**
- [ ] `renderConfig` extraída
- [ ] Config view funciona

---

### TAREFA 4.5: Extrair views/ciclo-view.js
**Arquivo:** `src/js/views.js` → `src/js/views/ciclo-view.js`  
**Esforço:** 4 horas  
**Risco:** Médio

**Mesmo padrão da Tarefa 4.1**

**Arquivos para modificar:**
- `src/js/views/ciclo-view.js` - NOVO
- `src/js/views.js` - Re-export

**Critério de Aceitação:**
- [ ] `renderCiclo` extraída
- [ ] Ciclo view funciona

---

### TAREFA 4.6: Quebrar ui/actions.js por domínio
**Arquivo:** `src/js/ui/actions.js` → `src/js/ui/actions/*.js`  
**Esforço:** 12 horas  
**Risco:** Alto

**Plano de extração:**

**Passo 1: Identificar domínios**
```javascript
// Domínios identificados em actions.js:
// - eventos (criar, editar, excluir, timer)
// - editais (criar, editar, disciplinas, assuntos)
// - revisoes (marcar, adiar)
// - habitos (registrar, toggle)
// - config (backup, sync, tema)
// - navegacao (menu, sidebar)
// - modais (open, close)
```

**Passo 2: Criar módulos por domínio**
```javascript
// src/js/ui/actions/eventos.js
export const eventosActions = {
  criarEvento: (target, event) => { ... },
  editarEvento: (target, event) => { ... },
  excluirEvento: (target, event) => { ... },
  toggleTimer: (target, event) => { ... },
  // ...
};

// src/js/ui/actions/editais.js
export const editaisActions = {
  criarEdital: (target, event) => { ... },
  criarDisciplina: (target, event) => { ... },
  // ...
};

// ... mais 5 módulos
```

**Passo 3: Criar index que consolida**
```javascript
// src/js/ui/actions/index.js
import { eventosActions } from './eventos.js';
import { editaisActions } from './editais.js';
import { revisoesActions } from './revisoes.js';
import { habitosActions } from './habitos.js';
import { configActions } from './config.js';
import { navegacaoActions } from './navegacao.js';
import { modaisActions } from './modais.js';

export const actions = {
  ...eventosActions,
  ...editaisActions,
  ...revisoesActions,
  ...habitosActions,
  ...configActions,
  ...navegacaoActions,
  ...modaisActions,
};
```

**Passo 4: Atualizar imports em main.js**
```javascript
// main.js - Antes
import { actions, setupActionDispatcher } from './ui/actions.js';

// main.js - Depois
import { actions, setupActionDispatcher } from './ui/actions/index.js';
// (mesmo path, actions.js vira index.js)
```

**Arquivos para criar:**
- `src/js/ui/actions/eventos.js` - NOVO
- `src/js/ui/actions/editais.js` - NOVO
- `src/js/ui/actions/revisoes.js` - NOVO
- `src/js/ui/actions/habitos.js` - NOVO
- `src/js/ui/actions/config.js` - NOVO
- `src/js/ui/actions/navegacao.js` - NOVO
- `src/js/ui/actions/modais.js` - NOVO
- `src/js/ui/actions/index.js` - NOVO (consolida)

**Arquivos para modificar:**
- `src/js/ui/actions.js` - Renomear para `index.js` ou deletar após migração
- `src/js/main.js` - Atualizar import se necessário

**Testes necessários:**
- `tests/unit/actions/*.test.js` - Teste por domínio
- Todos testes E2E devem passar

**Critério de Aceitação:**
- [ ] 7 módulos de ação criados
- [ ] `actions.js` original removido
- [ ] Todos data-actions funcionam
- [ ] Testes E2E passam

---

### TAREFA 4.7: Adicionar testes unitários para views extraídas
**Arquivo:** `tests/unit/views/*.test.js`  
**Esforço:** 8 horas  
**Risco:** Baixo

**Template de teste:**
```javascript
// tests/unit/views/med-view.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { state, setState } from '../../../src/js/store.js';
import { renderMED } from '../../../src/js/views/med-view.js';

describe('renderMED', () => {
  let container;
  
  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><div id="med-container"></div>');
    container = dom.window.document.getElementById('med-container');
    setState({ eventos: [], habitos: {} });
  });
  
  it('renderiza lista vazia quando sem eventos', () => {
    renderMED(container);
    expect(container.innerHTML).toContain('Nenhum evento');
  });
  
  it('renderiza eventos do dia', () => {
    setState({
      eventos: [{ id: '1', data: '2024-01-01', status: 'estudei' }]
    });
    renderMED(container);
    expect(container.querySelectorAll('.event-card')).toHaveLength(1);
  });
  
  // ... mais testes
});
```

**Arquivos para criar:**
- `tests/unit/views/med-view.test.js`
- `tests/unit/views/revisoes-view.test.js`
- `tests/unit/views/habitos-view.test.js`
- `tests/unit/views/config-view.test.js`
- `tests/unit/views/ciclo-view.test.js`

**Critério de Aceitação:**
- [ ] 5 arquivos de teste criados
- [ ] 10+ testes por arquivo
- [ ] 80%+ cobertura de linhas
- [ ] Todos testes passam

---

### DELIVERABLES SPRINT 4

| Entregável | Status |
|------------|--------|
| views/med-view.js extraída | ⬜ |
| views/revisoes-view.js extraída | ⬜ |
| views/habitos-view.js extraída | ⬜ |
| views/config-view.js extraída | ⬜ |
| views/ciclo-view.js extraída | ⬜ |
| ui/actions/ dividido por domínio | ⬜ |
| Testes unitários de views | ⬜ |
| views.js < 1000 linhas | ⬜ |

---

## RESUMO DE ENTREGAS POR SPRINT

### Sprint 1 - Quick Wins
- [ ] Cleanup de intervals/listeners
- [ ] Sorts in-place corrigidos
- [ ] Array mutations corrigidas
- [ ] Error handling em drive-sync

### Sprint 2 - Segurança e Estado
- [ ] State mutations corrigidas (deep clone)
- [ ] Helpers DOM seguros (dom.js)
- [ ] innerHTML migrado para safeSetHTML
- [ ] Credenciais em IndexedDB
- [ ] postMessage validado

### Sprint 3 - Window Bridge
- [ ] Namespace EstudoApp criado
- [ ] Handlers inline migrados para data-action
- [ ] Window bridge 80% removido
- [ ] JSDoc em módulos core

### Sprint 4 - Monolitos
- [ ] 5 views extraídas de views.js
- [ ] ui/actions.js dividido em 7 módulos
- [ ] Testes unitários de views
- [ ] views.js < 1000 linhas

---

## MÉTRICAS DE SUCESSO

| Métrica | Antes | Depois (Meta) |
|---------|-------|---------------|
| **views.js linhas** | 4.318 | < 1.000 |
| **ui/actions.js linhas** | 1.350 | < 200 (por módulo) |
| **innerHTML occurrences** | 87 | 0 (ou 100% com esc) |
| **window.* direto** | 50+ | 0 |
| **setInterval sem cleanup** | 3 | 0 |
| **sort in-place** | 10+ | 0 |
| **Cobertura de testes** | 72 testes | 150+ testes |
| **Memory leaks** | Presentes | Zero |
| **Vulnerabilidades XSS** | Potenciais | Mitigadas |

---

## RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Regressão em views | Médio | Alto | Testes visuais, screenshots |
| Memory leaks não resolvidos | Baixo | Médio | DevTools Memory profiling |
| Quebra de sync | Baixo | Alto | Testes E2E de sync |
| Performance degradada | Baixo | Médio | Lighthouse antes/depois |
| Conflitos de merge | Médio | Baixo | PRs pequenos e frequentes |

---

## CHECKLIST DE PRONTO (DoD)

Cada tarefa deve ter:
- [ ] Código implementado
- [ ] Testes unitários (se aplicável)
- [ ] Testes E2E passando
- [ ] Zero novos warnings no console
- [ ] Code review aprovado
- [ ] Lighthouse score ≥ 95

---

## PRÓXIMOS PASSOS IMEDIATOS

1. **Hoje:** Criar branch `refactor/sprint1-quick-wins`
2. **Dia 1-2:** Implementar Tarefa 1.1-1.4 (cleanup e sorts)
3. **Dia 3-5:** Implementar Tarefa 1.5-1.6 (listeners e promises)
4. **Dia 5:** PR #1 - Sprint 1 completo
5. **Revisão:** Validar métricas antes de Sprint 2

---

**Aprovação do Plano:** ⬜ Pendente  
**Data de Início:** _____/_____/_____  
**Data de Término Prevista:** _____/_____/_____ (6 semanas)
