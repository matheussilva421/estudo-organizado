# Relatório de Testes de Funcionalidades
**Data:** 05 de Março de 2026
**Objetivo:** Verificação exaustiva de todas as funções do aplicativo "Estudo Organizado".

## 1. O que não funcionou como o esperado (Bugs e Falhas)

Durante os testes, as seguintes falhas foram identificadas:

### 1.1 Ciclo de Estudos - Falha ao Salvar Planejamento
- **Problema:** Ao seguir os 4 passos do "Mago de Planejamento" (Organização, Disciplinas, Relevância e Horários), o botão **"Concluir Planejamento"** não funciona.
- **Comportamento Atual:** O botão não fecha o modal e não salva as configurações do ciclo de estudos na tela principal. Não há feedback visual de erro.
- **Como Reproduzir:** Navegue até "Ciclo de Estudos" > Clique em "Criar Meu Planejamento" > Complete todos os passos > Clique em "Concluir Planejamento".

### 1.2 Editais - Dificuldade/Impossibilidade em Adicionar Assuntos (Tópicos)
- **Problema:** Após criar um Edital e uma Disciplina, não é possível adicionar os Tópicos/Assuntos específicos dessa disciplina.
- **Comportamento Atual:** Na visualização da Disciplina (aba "Tópicos do Edital"), o botão de "+" ou a interface para adicionar novos assuntos está ausente ou invisível.
- **Como Reproduzir:** Navegue até "Editais" > Em um edital, adicione uma Disciplina > Clique em "Visualizar" na disciplina recém-criada > Note a ausência de opção para inserir os Tópicos.

### 1.3 Cronômetro - Bloqueio no Salvamento da Sessão
- **Problema:** Relacionado à falha 1.2, ao tentar finalizar e salvar uma sessão de estudo no Cronômetro, o modal de encerramento bloqueia o usuário.
- **Comportamento Atual:** O campo "Assunto/Tópico" é obrigatório no momento do salvamento da sessão, mas como não é possível adicionar tópicos no Edital (ver 1.2), a lista fica vazia. O usuário não consegue prosseguir para salvar a sessão estudada.
- **Como Reproduzir:** Inicie o cronômetro > Pause/Encerre o cronômetro > Tente preencher o modal de "Finalizar e Salvar" sem ter tópicos pré-cadastrados.

### 1.4 Inteligência de Banca - Captura de Seleção de Matéria
- **Problema:** O fluxo preditivo da Inteligência de Banca pode travar na seleção inicial.
- **Comportamento Atual:** Às vezes, ao selecionar a matéria no dropdown principal, o sistema não captura a seleção, mantendo travado o processamento (o botão "Processar Matéria" não responde ou requer múltiplas interações).
- **Como Reproduzir:** Navegue até "Inteligência de Banca" > Tente selecionar uma matéria no dropdown > Clique em "Processar Matéria".

---

## 2. Erros de Console e Anomalias Visuais
- **Erros Javascript:** O painel principal (Console) não registrou erros não tratados ou "crashes" severos do código ao tentar concluir as atividades. Isso indica que as falhas identificadas acima são devidas a problemas de lógica não vinculados (Event Listeners mal ligados ou validações incompletas de formulário) ou de UX/UI (botão oculto).
- **Layout:** O sistema, de forma geral, apresenta layout responsivo impecável. O **Modo Escuro** performa conforme esperado, sem textos invisíveis.

## 3. Principais Funcionalidades Validadas (OK)
- **Página Inicial:** Dashboards diários e botões principais de ação imediata (Iniciar Estudo, Tema).
- **Calendário:** Criação e exibição de eventos funcionando em perfeito estado.
- **Study Organizer:** Criação base de registro manual rápida e cards listados corretamente.
- **Painel Geral (Dashboard):** Renderização limpa de relatórios vazios caso não haja dados.

---
**Conclusão do Teste:** A interface é estável na renderização e na fluidez visual. No entanto, o "core business" do aplicativo (planejar no Ciclo -> executar no Cronômetro vinculando Tópicos -> revisar no Edital) encontra-se com bloqueadores (Severity: High) nestas 3 conexões (salvar ciclo, criar tópicos, salvar cronômetro associado).
