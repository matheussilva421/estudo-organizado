# Relatório de Teste de Botões — 2026-03-10

## Escopo
Validação dos botões/ações acionáveis do app **Estudo Organizado** com foco em:
- mapeamento de ações (`data-action`) e handlers no delegador central;
- verificação de referências `onclick` para funções existentes;
- identificação de bugs e funções desconexas.

## Método aplicado
1. Tentativa de teste E2E com Playwright (MCP/browser tools).
2. Auditoria estática do front-end (`index.html`, `views.js`, `main.js`) para cruzar:
   - quantidade de botões;
   - ações declaradas vs. ações tratadas;
   - funções chamadas em `onclick` vs. funções existentes no código.

## Evidências objetivas
- Total de botões mapeados por markup:
  - `src/index.html`: **38**
  - `src/js/views.js`: **79**
  - Total geral: **117**

- Ações `data-action` encontradas:
  - `close-modal`, `close-sidebar`, `drive-action`, `navigate`, `open-drive-modal`, `prompt-metas`, `prompt-prova`, `remover-planejamento`, `save-disc`, `save-habit`, `toggle-ciclo-fin`, `toggle-sidebar`, `toggle-theme`, `toggle-timer-mode`.

- Cobertura no switch de `main.js`:
  - Todas as ações encontradas em `data-action` estão tratadas.

- Divergência encontrada:
  - `main.js` possui `case 'remover-ciclo'`, porém **não há nenhum botão/elemento com `data-action="remover-ciclo"`** nos arquivos auditados (`index.html`, `views.js`).

- Verificação de `onclick`:
  - 96 funções referenciadas em `onclick` foram encontradas no código JS (não foram detectadas referências órfãs por nome).

## Bugs e funções desconexas

### 1) Função desconexa confirmada
- **Tipo:** função/rota de ação sem gatilho no UI atual.
- **Item:** `remover-ciclo` no delegador central.
- **Impacto:** código morto ou feature incompleta; aumenta custo de manutenção e confusão em debugging.
- **Recomendação:**
  - Remover o `case 'remover-ciclo'` se a feature foi descontinuada; ou
  - Reintroduzir botão/controle com `data-action="remover-ciclo"` se a feature ainda é válida.

## Limitação de teste E2E
Durante tentativa de automação de clique ponta-a-ponta via browser tools, houve limitação de ambiente (falhas de navegação/instância do browser), impossibilitando validar comportamento visual de **todos** os botões em execução real nesta sessão.

## Conclusão
- **Não foram encontradas ações `data-action` sem handler.**
- **Foi encontrada 1 função desconexa (`remover-ciclo`).**
- A cobertura total de comportamento em tempo de execução ficou parcialmente limitada pelo ambiente de browser desta sessão.
