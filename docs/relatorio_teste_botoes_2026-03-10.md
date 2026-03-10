# Relatório de Teste de Botões — 2026-03-10

## Escopo
Teste funcional dos botões/ações clicáveis do app **Estudo Organizado**, com foco em:
- navegação por abas do menu lateral;
- botões/ações visíveis por tela;
- bugs de comportamento;
- funções desconexas (ações sem gatilho no UI).

## Metodologia aplicada
1. Execução local do app (`http://127.0.0.1:4173/src/index.html`).
2. Verificação automatizada com Playwright para:
   - navegar nas 12 views principais;
   - inspecionar estado de modal prompt (`open` + `aria-hidden`);
   - validar navegação após fechamento de modal.
3. Auditoria estática para cruzar ações `data-action` com handlers do `switch(action)` em `src/js/main.js`.

## Cobertura obtida
Views navegadas:
- `home`, `med`, `cronometro`, `calendar`, `ciclo`, `dashboard`, `revisoes`, `habitos`, `editais`, `vertical`, `banca-analyzer`, `config`.

Contagem de elementos clicáveis visíveis por view (snapshot):
- `home`: 3
- `med`: 1
- `cronometro`: 5
- `calendar`: 47
- `ciclo`: 1
- `dashboard`: 4
- `revisoes`: 2
- `habitos`: 8
- `editais`: 1
- `vertical`: 3
- `banca-analyzer`: 0
- `config`: 9

## Correções aplicadas nesta rodada

### FIX-01 — Sincronização de estado semântico/visual dos modais
- `openModal(id)` agora define `aria-hidden="false"` ao abrir.
- `closeModal(id)` agora define `aria-hidden="true"` ao fechar.
- `closeModal(id)` também mantém `body.style.overflow='hidden'` enquanto ainda existir qualquer modal aberto.

### FIX-02 — Remoção de ação desconexa `remover-ciclo`
- Removido `case 'remover-ciclo'` do delegador central em `main.js`.
- Removida função legada `removerCiclo()` de `app.js` (sem acionador real no UI).

## Resultado final
- Não há mais inconsistência do modal prompt entre classe visual (`.open`) e `aria-hidden`.
- Não há mais rota de ação órfã `remover-ciclo` no delegador central.
- A navegação entre views segue funcional após fechamento de modal.
