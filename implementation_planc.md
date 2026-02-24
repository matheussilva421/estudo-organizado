# Implementação da Tela de Planejamento de Ciclo de Estudos

Esta documentação descreve as modificações propostas para criar o recurso de **Ciclo de Estudos Rotativo** no aplicativo "Estudo Organizado".

## Propósito do Recurso
Proporcionar uma interface onde o usuário define uma sequência de disciplinas e o tempo (em minutos) que planeja dedicar a cada uma antes de passar para a próxima. O sistema atualizará o progresso do ciclo e de cada disciplina automaticamente ao fim de uma sessão de estudos registrada, reiniciando o bloco sempre que concluído.

## Alterações Propostas

### 🗄️ Estrutura e Estado ([store.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/store.js) e DB)
- **Modificações em Estado:** Uma nova chave `state.ciclo` será introduzida na versão 5 do Schema, suportando a estrutura do ciclo ativo (status, configuração, disciplinas, tempos parciais) bem como os históricos (ciclos finalizados).
- **Lógica de Migração:** Adaptações na rotina [runMigrations](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/store.js#138-188) para instanciar as tabelas virtuais sem perda de dados existentes do usuário.

### 🧠 Integração ao Registro de Sessões ([registro-sessao.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/registro-sessao.js))
- **Atualização Contínua:** No momento que o botão "Salvar Evento" (Pós-Sessão) ou "Salvar" de Estudo Diário for clicado, verificaremos se o ciclo atual existe e, se sim, adicionaremos os minutos decorridos à respectiva disciplina no ciclo.
- **Detecção de Conclusão:** Caso todas as disciplinas atinjam ou passem o `planejadoMin`, a tag "ciclos Completos" será incrementada em +1.

### 🎨 Visual e Experiência do Usuário ([styles.css](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/css/styles.css) e [index.html](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/index.html))
- **Layout de Dashboard:** Cards modernos de contadores, gráfico de Rosquinha (Donut Chart puro via CSS `conic-gradient`) e um quadro com Listagem de Disciplinas e barras de Progresso individualizadas.
- **Sidebar Menu:** Inclusão de um novo botão persistente no menu lateral com acesso à `Página do Ciclo`.
- **Wizard Stepper:** Em vez do prompt genérico tradicional de janela, usaremos um modal de múltiplos passos estilizado no mesmo design das "Abas do Edital". Ele terá etapas de: "Organização", "Disciplinas/Ordem" e "Recomeçar".
- **Comportamentos Especiais:** Tooltips hoveráveis com métricas granulares e transições suaves de preenchimento.

### 🕹️ Lógica de Tela e Componentes ([views.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/views.js), [main.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/main.js), [app.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/app.js))
- **View Principal:** Em [views.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/views.js), a rotina `renderCiclo(el)` iterará dinamicamente os cartões para gerar os painéis em flexbox.
- **Lógica do Wizard:** Criar script no [app.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/app.js) encapsulando as aberturas do modal de Ciclos para edição guiada que injetará controles para adicionar disciplinas personalizadas.
- **Botões Acessórios:** Delegação segura de eventos em [main.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/main.js) para rodar funções de "Duplicar Elemento", "Deletar Disciplina" e "Zerar Tickers".

## Plano de Validação

### Teste Automatizado Visual (Browser Subagent)
1. Inserir manualmente via código variáveis no ciclo teste de 3h com 2 disciplinas.
2. Tirar Screenshot para atestar se o preenchimento Donut coincide com as porcentagens.
3. Testar a interface dos steps (Passo 1 ao Passo 3) provando o DOM handling.

### Teste Manual de Usuário
O usuário final será orientado a cadastrar seu próprio ciclo de 3 matérias e fazer uma sessão rápida de 1 minuto em uma delas. O sistema deve automaticamente atualizar a barra amarela ou verde em 1/N%.

---
## User Review Required
> [!NOTE]
> Esta funcionalidade exige alterações fundamentais em estruturas do banco de dados (novo nó `state.ciclo`) e modificação direta da cadeia de finalização de um "Registro de Sessão". Assegure-se de verificar o layout mockado que construirei em breve para garantir que tudo cumpre suas expectativas visuais! Aprova o roteiro técnico descrito acima?
