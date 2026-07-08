# Handoff — Filtros do cronograma dia a dia (Reta Final)

**Data:** 2026-07-08
**Status:** ✅ Concluído (testes verdes, suíte completa passando)

## Revisão pós-feedback (mesmo dia)

A primeira versão usava três toggles independentes de esconder categoria; o
usuário pediu um **seletor exclusivo** (uma visão por vez) na ordem
**Todos · Atrasados · Próximos dias · Concluídos**. Refeito com TDD:

- View: estado agora é `let filtroCronograma = 'todos'` + export
  `setRetaFinalFiltro(nome)` (nomes desconhecidos ignorados). "Todos" mostra
  tudo; os demais mostram SÓ a categoria (`atrasados`→'atrasado',
  `proximos`→'futuro', `concluidos`→'concluido'). Blocos de hoje só aparecem
  em "Todos".
- Ação renomeada: `rf-set-filtro` (a antiga `rf-toggle-filtro` /
  `toggleRetaFinalFiltro` não existem mais).
- Testes reescritos em `tests/unit/reta-final-filtros.test.js` (10 testes).

O texto abaixo descreve a primeira iteração — vale como histórico; a API
final é a desta revisão.

## O que foi pedido

O usuário quis botões abaixo do título "Cronograma dia a dia — até DD/MM/AAAA"
para mostrar/esconder: o que foi feito (concluídos), o que está atrasado
(rolados/data passada) e os próximos dias do cronograma.

## O que foi feito (TDD: red → green)

1. **Testes primeiro** — `tests/unit/reta-final-filtros.test.js` (9 testes):
   categorização pura, botões renderizados com `aria-pressed`, cada filtro
   escondendo sua categoria, religar filtro, mensagem de vazio filtrado e a
   ação `rf-toggle-filtro` re-renderizando a view.
2. **Core** — `src/js/logic/reta-final-core.js`: nova função pura
   `getRetaFinalBlocoFiltroCategoria(bloco, hoje)` →
   `'concluido' | 'nao_coberto' | 'futuro' | 'atrasado' | 'hoje'`.
   Atrasado = pendente com `data < hoje` OU rolado (`data !== dataOriginal`).
3. **View** — `src/js/views/reta-final-view.js`:
   - Estado de sessão `filtrosCronograma = { concluidos, atrasados, proximos }`
     (module-level, todos `true` por padrão; **não persiste** no state/sync).
   - Export `toggleRetaFinalFiltro(nome)`.
   - Barra `renderFiltrosHtml()` com 3 botões-pílula
     (`data-action="rf-toggle-filtro"` + `data-filtro`), inserida logo abaixo
     do header do cronograma.
   - `renderDiasHtml` filtra blocos por categoria; grupos de dia vazios somem;
     tudo filtrado mostra "Nenhum bloco visível com os filtros atuais.".
   - Cards ganharam `data-bloco-id` (usado nos testes).
   - Blocos de HOJE sem rolagem são sempre visíveis (não há filtro para eles).
4. **Ação** — `src/js/ui/actions/reta-final.js`: `rf-toggle-filtro` (toggle +
   `renderCurrentView()`); handler retorna a Promise do import dinâmico para
   ser awaitable nos testes.
5. **CSS** — `src/css/views/reta-final.css`: `.rf-filtros`, `.rf-filtro-btn`,
   `.rf-filtro-btn--ativo` (pílulas com accent quando ativas).

## Estado atual

- `npx vitest run`: 132 arquivos / 2123 testes ✅ (inclusive o guarda
  `action-contracts` que exige registro de todo `data-action`).
- Filtros aplicam-se apenas à lista do cronograma — o card "Não cobertos" e o
  resumo lateral não são afetados.

## O que falta / próximos passos possíveis

- Nada pendente. Ideias futuras: persistir a preferência dos filtros em
  `localStorage` (hoje reseta ao recarregar) e contadores nos rótulos
  (ex.: "Concluídos (5)").
