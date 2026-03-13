- [/] **Fase 1: Estrutura de Dados e Integração (BD)**
  - [/] Adicionar entidade `ciclo` no [store.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/store.js) (com status, ciclos completos, disciplinas na sequência e regras).
  - [/] Atualizar sistema de migração ([runMigrations](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/store.js#138-188)) e deleção ([clearData](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/store.js#206-226)).
  - [/] Alterar o salvamento de sessões de estudo ([registro-sessao.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/registro-sessao.js)) para incrementar os minutos no ciclo ativo (se houver).

- [ ] **Fase 2: Interface Base (Menu e CSS)**
  - [ ] Incluir acesso ao "Ciclo de Estudos" no menu lateral em [index.html](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/index.html) e no map de títulos do [app.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/app.js).
  - [ ] Implementar as classes CSS (conic-gradients para Donut charts, steppers do wizard, listagens em drag/drop opcional e progress bars com cores das disciplinas).

- [ ] **Fase 3: Renderização do Dashboard do Ciclo (Views)**
  - [ ] Criar a função `renderCiclo(el)` no [views.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/views.js).
  - [ ] Montar o Header (Botões: Recomeçar, Replanejar, Remover).
  - [ ] Montar Resumo Numerado (Ciclos Completos, Progresso Total, Gráfico Donut).
  - [ ] Montar Lista Principal (Sequência de Estudos com progresso da disciplina e checkbox para esconder finalizados).

- [ ] **Fase 4: Modal de Criação / Edição do Ciclo (Wizard)**
  - [ ] Criar modal de passos (Stepper) no [index.html](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/index.html).
  - [ ] Lógica em [app.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/app.js)/[logic.js](file:///d:/Google/Backup%20Gdrive/Projects%20AI/estudo-organizado/src/js/logic.js) para navegar entre os passos:
    - [ ] Etapa 1: Organização (Rotativo x Semanal).
    - [ ] Etapa 2: Disciplinas (Lista editável de disciplinas com seleção e inputs de minutos).
    - [ ] Validações (Minutos válidos, checagem vazia).
  - [ ] Integrar salvamento (Replanejar vs Recomeçar) e regra de Negócio de zerar/manter progresso.

- [ ] **Fase 5: Testes Finais e Refinamentos**
  - [ ] Validar incremento de minutos do registro de estudo no modelo do ciclo.
  - [ ] Validar estado "concluído" da disciplina no ciclo.
  - [ ] Garantir persistência correta (debounce).
