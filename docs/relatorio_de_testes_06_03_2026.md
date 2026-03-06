# Relatório de Testes de Funcionalidades
**Data:** 06 de Março de 2026
**Objetivo:** Teste detalhado de todas as funcionalidades principais do aplicativo web "Estudo Organizado" e validação da interface do usuário.

## 1. O Que Funciona Bem (Status OK)

- **Página Inicial (Dashboard Principal):** A interface renderiza corretamente. Os cards de "Tempo de Estudo", "Desempenho" e "Progresso no Edital" carregam bem e visualmente fluídos.
- **Hábitos (Registro de Sessões Extra):** A funcionalidade de registrar hábitos (como quantidade de questões resolvidas e acertos) funciona perfeitamente. O modal modalístico responde rapidamente e atualiza os dados na tela em tempo real sem a necessidade de recarregar a página.
- **Configurações e Tema:** A troca de temas (Ex: Claro para Escuro) é aplicada instantaneamente por toda a aplicação. A estrutura visual premium é mantida em cada estado.
- **Inteligência de Banca:** A Aba dedicada de análise funciona bem ao inserir rankings. Existe uma validação correta que impede o processamento caso o usuário não tenha selecionado a disciplina no dropdown.
- **Ciclo de Estudos:** O "Mago de Planejamento" guia o usuário corretamente nos 4 passos (Estratégia, Disciplina, Relevância e Horários), e a geração final do planejamento é feita com sucesso.
- **Cronômetro:** Iniciar e pausar o cronômetro funciona exatamente como esperado.

---

## 2. O Que Não Funciona (Bugs e Falhas de Fluxo)

Durante os testes automatizados simulando fluxos de usuário reais, uma cadeia de erros críticos (Severity: High) foi identificada, paralisando o uso prático da plataforma:

### 2.1 Editais - Impossibilidade de Adicionar Assuntos/Tópicos
- **Problema:** Após criar um Edital e adicionar uma "Disciplina", **não há nenhuma interface visível ou botão funcional para adicionar "Tópicos" ou "Assuntos"** manualmente.
- **Impacto:** O edital fica preso exibindo "0/0 Tópicos". O botão que exibe um "cérebro" leva para a Inteligência de Banca, mas não resolve o cadastro simples de assuntos da trilha.

### 2.2 Cronômetro - Bloqueio Reverso ao Salvar Sessão
- **Problema:** Quando o cronômetro é pausado e o usuário deseja salvar a sua sessão de estudos, o App abre um Modal exigindo que um "Assunto/Tópico" seja selecionado.
- **Impacto (Cascata):** Como o usuário nunca consegue cadastrar Tópicos na tela de Editais (Bug 2.1), essa lista sempre aparecerá vazia. Por ser um campo *obrigatório*, **o usuário fica bloqueado de salvar a sessão** e registrar seu tempo de estudo, quebrando a funcionalidade principal do App.

---

## 3. Sugestões de Melhoria e UX

Para elevar a aplicação ao próximo nível, além da correção dos bugs críticos acima, sugiro as seguintes melhorias:

1. **Dashboard - Riqueza Visual:** Atualmente existem apenas números e métricas textuais no quadro geral. Inserir **gráficos de pizza para "Desempenho" e gráficos de barras** para "Tempo de Estudo Semanal" traria o "WOW factor" que aplicativos premium possuem.
2. **Botão Explícito para Adição de Tópicos:** No card de disciplina da tela de Editais, insira um botão "+" claramente visível focado inteiramente na inserção rápida de arrays de tópicos (texto livre subdividido por quebras de linha ou vírgulas).
3. **Dropdowns Pesquisáveis na Inteligência de Banca:** Ao invés de um select HTML básico, implementar um campo `input` com busca fuzzy para as disciplinas, pois quando houverem dezenas de matérias, será lento selecionar manualmente.
4. **Campo de Tópico Opcional no Cronômetro:** Para não bloquear o estudo, caso o usuário não queira vincular a sessão a um tópico específico naquele momento, adicione uma opção "Sessão Genérica" ou torne o dropdown de assunto não-obrigatório.
5. **Feedback Visual de Sucesso (Toasts):** Quando um hábito for salvo com sucesso, exibir um pequeno balão temporário (Toast verde no canto da tela) melhora enormemente o feedback da interface para o usuário.

---
**Conclusão:** 
O design do *Estudo Organizado* cumpre o objetivo de estética moderna (vibes *glassmorphism* muito elogiáveis). Contudo, é urgente ajustar o `index.html` ou módulo `views` na tela de Editais para permitir o cadastro manual de Tópicos, de forma a desbloquear o funil de uso do Timer Pomodoro.
