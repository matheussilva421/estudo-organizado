# Relatório de Teste de Botões — Estudo Organizado (2026-03-10)

## Objetivo
Validar os botões do app para identificar:
1. comportamentos quebrados;
2. bugs funcionais;
3. funções desconexas (código com handler sem gatilho real no UI).

## Escopo coberto
- Arquivos de UI auditados:
  - `src/index.html`
  - `src/js/views.js`
  - `src/js/main.js`
- Total de botões encontrados no app (markup): **117**
  - `src/index.html`: **38**
  - `src/js/views.js`: **79**

## Estratégia de teste aplicada
### 1) Tentativa de execução E2E (clique real)
Foi tentada automação de browser com Playwright (MCP/browser tools) navegando para `http://localhost:8000/src/index.html` e varrendo os botões por view.

**Resultado:** o ambiente de browser retornou página `Not Found` para as rotas testadas (`/`, `/src/`, `/src/index.html`), impedindo validação de clique real ponta-a-ponta nesta sessão.

### 2) Auditoria estrutural completa dos botões
Dado o bloqueio de E2E, foi executada auditoria estática para os 117 botões e ações, com os cruzamentos abaixo:
- `data-action` declarado no HTML/Views **vs** `case` existente no delegador central (`main.js`);
- `onclick="..."` declarado **vs** existência de função correspondente no JS do projeto;
- detecção de handlers órfãos (casos no `switch` sem gatilho no UI).

## Evidências coletadas
- Ações `data-action` mapeadas:
  - `close-modal`, `close-sidebar`, `drive-action`, `navigate`, `open-drive-modal`, `prompt-metas`, `prompt-prova`, `remover-planejamento`, `save-disc`, `save-habit`, `toggle-ciclo-fin`, `toggle-sidebar`, `toggle-theme`, `toggle-timer-mode`.
- Ações `data-action` **sem handler** no `switch`: **nenhuma**.
- Referências `onclick` encontradas: **121** chamadas.
- Funções distintas citadas em `onclick`: **96**.
- Funções citadas em `onclick` e não encontradas no código JS: **nenhuma**.

## Bugs / funções desconexas encontradas

### 1) Handler desconexo no delegador central
- **Bug tipo:** função desconexa / código sem gatilho de UI.
- **Detalhe:** existe `case 'remover-ciclo'` no `switch` de ações em `src/js/main.js`.
- **Problema:** não existe `data-action="remover-ciclo"` em `src/index.html` nem em `src/js/views.js`.
- **Impacto:** rota de ação não acionável pelo usuário (código morto ou feature incompleta).
- **Severidade:** média (manutenibilidade/consistência funcional).
- **Recomendação:**
  - remover o case se a feature foi descontinuada; **ou**
  - reintroduzir botão/controle que dispare `data-action="remover-ciclo"`.

## Conclusão executiva
- Cobertura estrutural dos botões e ações: **completa** (117 botões auditados por código).
- Bug confirmado: **1 função desconexa** (`remover-ciclo`).
- Limitação: execução E2E de clique real ficou bloqueada por ambiente de browser retornando `Not Found` nas rotas locais durante a sessão.
