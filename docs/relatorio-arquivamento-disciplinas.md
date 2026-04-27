# Relatório de Implementação: Arquivamento de Disciplinas

## Visão Geral

Implementação de um sistema de arquivamento lógico de disciplinas na página de Editais, permitindo ocultar disciplinas sem excluir seus dados, com possibilidade de restauração posterior.

**Commits:** `79e6dff`, `c0e3c08`, `76c7084`, `d2e87c4`

---

## 1. Migração de Schema (store.js)

### Mudanças
- **Schema version:** `7` → `8`
- **Nova migração v7→v8:** Adiciona campos `arquivada` (boolean) e `arquivadaEm` (string|null) em todas as disciplinas existentes

```javascript
// v7 → v8: Add archive flag to disciplines
if (state.schemaVersion < 8) {
  (state.editais || []).forEach(ed => {
    (ed.disciplinas || []).forEach(d => {
      if (d.arquivada === undefined) d.arquivada = false;
      if (d.arquivadaEm === undefined) d.arquivadaEm = null;
    });
  });
  state.schemaVersion = 8;
  changed = true;
}
```

### Proteção contra edge cases
- `(state.editais || [])` protege contra `null/undefined`
- `(ed.disciplinas || [])` protege contra disciplinas ausentes

---

## 2. Novas Funções em logic.js

### `archiveDiscipline(editalId, disciplineId)`
Define `disc.arquivada = true` e `disc.arquivadaEm = new Date().toISOString()`. Invalida caches de disciplinas e dashboard.

### `unarchiveDiscipline(editalId, disciplineId)`
Define `disc.arquivada = false` e `disc.arquivadaEm = null`. Invalida caches.

### `getActiveDisciplinas()`
Retorna apenas disciplinas com `arquivada !== true`. Usada em seletores de estudo ativo (registro de sessão, cronômetro, planejamento, etc.).

### `getPendingRevisoes()` — atualização
Adicionado filtro `if (disc.arquivada) continue;` para excluir disciplinas arquivadas das revisões pendentes.

---

## 3. UI — Página de Editais (editais-view.js)

### Novo estado local
```javascript
let discFilterStatus = 'ativas'; // 'ativas' | 'arquivadas' | 'todas'
```

### Filtro de disciplinas
Três chips no topo de cada edital:
- **Ativas** — mostra apenas `!d.arquivada`
- **Arquivadas** — mostra apenas `d.arquivada`
- **Todas** — mostra todas

### Contagem ajustada
- Sem arquivadas: `"12 disc."`
- Com arquivadas: `"10 ativas · 2 arq."`

### Visual de cards arquivados
- Classe CSS `disc-card-archived` (opacidade 0.6 + grayscale 40%)
- Badge "Arquivada" no canto superior direito
- Hover desabilitado (sem elevação)

### Overlay de ações
- **Disciplina ativa:** Visualizar | Editar | Arquivar | Remover
- **Disciplina arquivada:** Visualizar | Editar | Desarquivar

### Mensagens de estado vazio
- Filtro "Ativas" sem disciplinas: "Nenhuma disciplina ativa"
- Filtro "Arquivadas" sem disciplinas: "Nenhuma disciplina arquivada"
- Filtro "Todas" sem disciplinas: "Nenhuma disciplina"

### Vertical View
`getFilteredVertItems()` agora filtra `if (disc.arquivada) continue;` — disciplinas arquivadas não aparecem na visualização verticalizada.

---

## 4. Action Handlers (editais.js)

### `archiveDisc(el, event)`
Exibe confirmação: *"Arquivar esta disciplina? Ela será ocultada da lista principal, mas seus dados e progresso serão mantidos."*
- Botão: "Arquivar disciplina"
- Ao confirmar: chama `archiveDiscipline()`, salva, re-renderiza, toast "Disciplina arquivada."

### `unarchiveDisc(el, event)`
Sem confirmação (ação reversível simples).
- Chama `unarchiveDiscipline()`, salva, re-renderiza, toast "Disciplina desarquivada."

### `setDiscFilter(el)`
Atualiza `discFilterStatus` via `window.EstudoApp.setDiscFilterStatus()` e re-renderiza a view.

---

## 5. Estilos CSS (styles.css)

### `.disc-card-archived`
```css
.disc-card-archived {
  opacity: 0.6;
  filter: grayscale(40%);
}
.disc-card-archived:hover {
  transform: none;
}
```

### `.disc-archived-badge`
```css
.disc-archived-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: var(--text-muted);
  color: var(--surface);
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  z-index: 2;
}
```

---

## 6. Impacto em Outras Páginas

Todas as referências a `getAllDisciplinas()` foram revisadas e substituídas por `getActiveDisciplinas()` onde apropriado:

| Arquivo | Uso | Motivo |
|---------|-----|--------|
| `views.js` — `renderDiscProgress()` | `getActiveDisciplinas()` | Progresso na home |
| `views.js` — `openAddEventModal()` | `getActiveDisciplinas()` | Dropdown de disciplina no modal de evento |
| `views.js` — stats de revisões | `getActiveDisciplinas()` | Contagem de assuntos concluídos |
| `registro-sessao.js` | `getActiveDisciplinas()` | Dropdown de disciplina no registro de sessão |
| `components.js` — cronômetro | `getActiveDisciplinas()` | Seletor de disciplina no cronômetro livre |
| `planejamento-wizard.js` | `getActiveDisciplinas()` | Grid de seleção, step 2, step 3 |
| `habitos-view.js` | `getActiveDisciplinas()` | Dropdowns de hábitos, gabarito por disciplina |

### Mantido com `getAllDisciplinas()` (inclui arquivadas)
| Arquivo | Uso | Motivo |
|---------|-----|--------|
| `views.js` — busca global | `getAllDisciplinas()` | Busca deve encontrar disciplinas arquivadas |
| `views.js` — histórico de sessões | `getDisc(id)` | Histórico deve mostrar dados passados de arquivadas |
| `logic.js` — `getAggregatedStats()` | Itera `state.editais` diretamente | Estatísticas históricas devem incluir arquivadas |
| `logic.js` — `getSubjectStats()` | Usa `getAggregatedStats()` | Stats do dashboard incluem arquivadas |
| `views.js` — dashboard de disciplina | `getDisc(id)` | Dashboard funciona mesmo com disciplina arquivada |

---

## 7. Bugs Corrigidos Durante Implementação

### Bug 1: Import duplicado de editais-view.js
**Problema:** `editais-view.js` era importado diretamente no `main.js` E via re-export do `views.js`, criando duas instâncias do módulo com variáveis `discFilterStatus` separadas. O filtro atualizava uma instância mas o render lia da outra.

**Sintoma:** Botões Ativas/Arquivadas/Todas não respondiam ao clique.

**Correção:** Removido import direto do `main.js`. Adicionados `getDiscFilterStatus` e `setDiscFilterStatus` aos re-exports do `views.js`.

### Bug 2: Migração v7→v8 sem proteção contra null
**Problema:** `state.editais.forEach()` falharia se `state.editais` fosse `null`.

**Correção:** `(state.editais || []).forEach()`

### Bug 3: Badge "Arquivada" coberto pelo overlay
**Problema:** `z-index: 1` no badge era menor que o overlay no hover.

**Correção:** `z-index: 2`

---

## 8. Testes

### Testes unitários
- **264 testes** — todos passando
- Teste de migração atualizado para schema v8 com verificação de `arquivada` e `arquivadaEm`

### Testes e2e
- **78 testes** — todos passando
- Inclui testes de CRUD de disciplinas, navegação, persistência

---

## 9. Arquivos Modificados

| Arquivo | +/− | Descrição |
|---------|-----|-----------|
| `src/js/store.js` | +14/−1 | Schema v8, migração v7→v8 |
| `src/js/logic.js` | +35/0 | `archiveDiscipline`, `unarchiveDiscipline`, `getActiveDisciplinas`, filtro em `getPendingRevisoes` |
| `src/js/views/editais-view.js` | +50/−6 | Filtro, badge, contagem, overlay, vertical view |
| `src/js/ui/actions/editais.js` | +41/0 | `archiveDisc`, `unarchiveDisc`, `setDiscFilter` |
| `src/css/styles.css` | +24/0 | `.disc-card-archived`, `.disc-archived-badge` |
| `src/js/views.js` | +8/−4 | Import e uso de `getActiveDisciplinas` |
| `src/js/registro-sessao.js` | +4/−2 | `getActiveDisciplinas` |
| `src/js/components.js` | +4/−2 | `getActiveDisciplinas` no cronômetro |
| `src/js/planejamento-wizard.js` | +10/−10 | `getActiveDisciplinas` em 4 locais |
| `src/js/views/habitos-view.js` | +10/−10 | `getActiveDisciplinas` em 4 locais |
| `src/js/main.js` | +2/−1 | Re-exports de `getDiscFilterStatus`/`setDiscFilterStatus` via `views.js` |
| `tests/unit/store.test.js` | +4/−1 | Teste de migração atualizado para v8 |

**Total:** 12 arquivos, +206/−37 linhas

---

## 10. Critérios de Aceite

| Critério | Status |
|----------|--------|
| Arquivar disciplina pela página Editais com confirmação | ✅ |
| Disciplina arquivada some da lista principal (filtro "Ativas") | ✅ |
| Dados não são excluídos (flag `arquivada`, sem `splice`/`delete`) | ✅ |
| Tópicos, aulas, questões, progresso mantidos | ✅ |
| Filtro [Ativas] [Arquivadas] [Todas] funcional | ✅ |
| Cards arquivados com visual diferenciado (opacidade + selo) | ✅ |
| Botão "Desarquivar" aparece no lugar de "Arquivar" | ✅ |
| Desarquivar restaura com todos os dados intactos | ✅ |
| Contagem mostra "X ativas · Y arq." | ✅ |
| Botão "Remover" (excluir) separado de "Arquivar" | ✅ |
| Disciplinas arquivadas ocultas em seletores, ciclo, revisões, cronômetro | ✅ |
| Histórico e estatísticas mantêm dados de arquivadas | ✅ |
| Migração segura para dados antigos (v7→v8) | ✅ |
| Nenhuma página quebra | ✅ |
| 264 testes unitários passando | ✅ |
| 78 testes e2e passando | ✅ |
