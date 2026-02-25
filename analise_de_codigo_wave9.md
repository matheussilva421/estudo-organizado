# Auditoria de Código e Conectividade (Wave 9)

Este documento detalha as verificações e correções realizadas durante a análise sistêmica global do projeto **Estudo Organizado**, com foco em resolver *Edge Cases*, vazamentos de referências e completar a integração lógica entre os novos módulos de planejamento e os blocos de execução.

## 1. Integração Direta: Planejamento ↔ Cronômetro

**Descoberta:**
O módulo de `Planejamento` ("Grade Semanal" e "Ciclo") criado na *Wave 7* estava efetivamente gerando sequências de estudo válidas na Dashboard, mas de forma passiva. As sequências não podiam ser "iniciadas" ou "concluídas" de forma interativa pelo usuário a não ser criando um evento manualmente.

**Correção Implementada:**
- Foi criado o botão **"Estudar Agora"** ao lado de cada card do Planejamento na Dashboard.
- O clique no botão invoca a nova injeção de evento encapsulada em `iniciarEtapaPlanejamento(seqId)` (`logic.js`).
- O app injeta o evento alvo e redireciona automaticamente para o Cronômetro, com os limites e metas de minutos daquele bloco já configurados.
- Ao finalizar a sessão (`saveRegistroSessao` em `registro-sessao.js`), o código agora identifica se a sessão originou de uma sequência (`ev.seqId`), e se sim, marca retroativamente o bloco do planejamento como **Concluído**, encerrando o ciclo PDCA.

---

## 2. Abismo Cíclico: Cascata de Exclusões Segura

**Descoberta:**
Quando o usuário excluía um Objeto Mestre (ex: excluir um Edital ou uma Disciplina), as funções de destruição apagavam o elemento do `state.editais`, porém **Órfãos Persistentes** permaneciam vivos em arrays estáticos, gerando erros silenciosos na UI na Dashboard e Histórico.
- Exemplo 1: `state.eventos` mantinha ligações `discId`. Ao renderizar a tela "MED", o sistema falhava ao invocar `getDisc(ev.discId)` pois o ID não existia mais.
- Exemplo 2: O modal de confirmação de exclusão em "Assuntos" prometia *"Eventos vinculados serão desvinculados"*, porém a função efetiva em `views.js` ignorava a promessa.

**Correção Implementada:**
- Lógicas recursivas de Scrub inseridas em `deleteDisc`, `deleteEdital` e `deleteAssunto` (`views.js`).
- Quando acionadas, as funções interceptam dinamicamente a `state.eventos` e `state.planejamento`, desvinculando de forma segura (`delete e.discId; delete e.assId;`) todas as amarrações do domínio alvo de exclusão sem apagar a métrica brula validada.

---

## 3. O Paradoxo da Alvorada: Midnight Rollover Bug

**Descoberta:**
O sistema utilitário encapsula a data presente usando cacheamento em `_todayCache` para otimizar *renders*. Entretanto, não havia um observador passivo para o caso de usuários que mantêm a aba do navegador perpetuamente aberta no computador virando de um dia para o outro (após à meia-noite). O relógio base travava na data inicial do boot.

**Correção Implementada:**
- Um ouvinte ativo foi acoplado em `visibilitychange` dentro de `main.js`. 
- Caso uma aba durma, assim que o usuário transitar a visibilidade ou a aba voltar a focar (como numa nova manhã), o motor de estado engatilha um `invalidateTodayCache()` forçando a requisição de novos carimbos de data do OS da máquina local.

---

## 4. Auditoria de Formulários e Escalas Numéricas

**Descoberta:**
Formulários de `Registro Sessão Estudo` (especialmente para "Simulados", "Questões" e "Leitura") expunham flexibilidades perigosas se manipulados bruscamente antes do guardrail.

**Validações Mapeadas & Asseguradas:**
- `acertos` jamais excederá o `total` absoluto em questões e simulados (UI e back-end syncado no objeto IndexedDB).
- `paginas` mínimas blindadas em `> 0`.
- Campos numéricos preenchidos passivamente com string nula ("") recaem de forma segura para o parse de `NaN` condicional usando fallback zero sem disparar interrupção de parsing, ou ignoram campos vazios de forma inócua no salvamento de formulários complexos multicamadas (ex: `gabaritoPorDisc` em simulados).

---

## Próximos Passos & Manutenção Contínua
Com a fundação arquitetural das *Waves* de Conexões de Ciclos completamente resolvidas, a base de código encontra-se no pico de maturidade estrutural de Vanilla ECMAScript orientado a objetos funcionais.
Qualquer avanço funcional neste nível deverá passar obrigatoriamente por migrations da "schema version" do `store.js` se intervir brutalmente na modelagem de domínios.
