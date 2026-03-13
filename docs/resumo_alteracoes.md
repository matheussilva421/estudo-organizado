# Resumo das Alterações Recentes

Conforme as regras globais do projeto, este documento sumariza as implementações recentes:

## Evolução da "Inteligência de Banca"
- **Wave 34 (Aba Própria):** Desacoplamento do motor preditivo de relevância (Bancas) do modal flutuante em que se encontrava, criando uma página `Dual-Pane` totalmente integrada ao roteamento da Sidebar do aplicativo. Agora, o usuário tem a visão limpa da área de "Planejamento" (Esquerda) e "Resultado da Simulação" (Direita) cobrindo 100% da tela.
- **Wave 35 (Gerenciamento e Edição):** Criação da UI de "Análises Salvas" em chips dinâmicos. Cada análise preditiva salva num edital ganha um botão. O usuário pode clicar neles para reconstruir o Input (`textarea`), permitindo que a importação antiga seja re-editada de forma transparente para rodar novamente o *match*.
- **Wave 36 (Limpeza Dinâmica):** A exclusão (botão Lixeira) de um chip de análise salva deleta não somente o histórico de palavras-chave (`hotTopics`) mas invoca a função `revertEditalOrdering()`, que faz o Edital associado (agora órfão de relevância) voltar da ordem de 'P1/P2/P3' para a ordem Alfabética Default.
  
## Prints e Documentação
- **Wave 37:** Captura end-to-end de 11 interfaces principais do aplicativo atualizado, disponibilizados na pasta `/screenshots` dentro da raiz do app.
