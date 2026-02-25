# Análise Completa e Auditoria do Sistema "Estudo Organizado"

Abaixo apresento a análise detalhada do código atual da aplicação, focada no checklist solicitado (Eventos, Timer/Pomodoro, IndexedDB, Google Drive, UX, Arquitetura). O sistema evoluiu e agora possui ES Modules e uma arquitetura baseada em eventos de UI, mas a análise profunda sob o capô revela inconsistências lógicas cruciais, riscos de perda de dados e vazamentos de memória.

Foram classificados os achados por Severidade: **Crítica**, **Alta**, **Média** e **Baixa/Arquitetura**.

---

## 🚨 1. Severidade CRÍTICA (Risco de Perda de Dados e Travamentos)

### 1.1 Conflito de Sintaxe na Sincronização do Google Drive (`drive-sync.js`)
*   **Problema:** A forma como a API do Google Drive está sendo chamada via `fetch` mistura parâmetros da API REST v3 pura com `gapi.client`. O payload Multipart está sendo construído manualmente com `FormData` ao mesmo tempo que injeta o token do GAPI no cabeçalho.
*   **Risco:** Embora pareça funcionar na primeira vez (criação via `POST`), a atualização do arquivo (via `PATCH`) é inconsistente. O corpo do multipart não segue estritamente a RFC do Google Drive (separadores de boundary em requisições Fetch manuais com FormData podem corromper uploads JSON).
*   **Solução (Bug Fix H):** Refatorar a chamada de upload (POST e PATCH) usando padronizadamente a própria biblioteca `gapi.client.request` que gerencia os boundaries do multipart automaticamente, ou reescrever a chamada Fetch com headers de Content-Type absolutos lidando com o Boundary.

### 1.2 Race Condition Extrema no `scheduleSave()` (`store.js`)
*   **Problema:** A função `scheduleSave()` implementa um *debounce* de 2 segundos. Porém, durante navegações muito rápidas (ex: concluir um assunto, mudar de aba e editar um hábito imediatamente), múltiplos callbacks de UI dependem do estado persistido *antes* dele ser gravado no IndexedDB.
*   **Risco:** Se o usuário fechar a aba ou ocorrer um recarregamento (Sync do Drive via polling) dentro da janela de 2 segundos, os dados mais recentes na memória RAM serão descartados, voltando ao estado anterior.
*   **Solução (Bug Fix I - Adicional):** Adicionar um bloqueio automático antes que o fechamento da página seja permitido (capturar o evento `beforeunload` se houver save pendente), e injetar um botão "forçar save" nas entranhas das trocas de view principais (por ex. `navigate`). Implementar uma Promise de "Save Completo".

### 1.3 Condição de Corrida (Race Condition) no Drive Sync Inicial
*   **Problema:** Em `init()`, a aplicação tenta fazer `navigate('home')` enquanto em paralelo dispara a leitura e UI do Drive. O Event Listener `stateSaved` que dispara aos 10s pode engatilhar um Sync com um ID vazio caso haja latência de rede na inicialização, causando duplicação do arquivo na raiz do Drive.
*   **Risco:** Perda da rastreabilidade do arquivo principal. O aplicativo acaba ignorando um arquivo e criando outro cópia por cima, divergindo o banco de dados de múltiplos dispositivos.
*   **Solução:** Garantir que o sync automático originado por `stateSaved` só processe se `gapiInited && gisInited && state.driveFileId` e introduzir debounce reforçado atrelado a IDs únicos.

---

## 🛑 2. Severidade ALTA (Bugs Lógicos e Travas de UI)

### 2.1 Timer "Zumbi" Causando Memory Leaks (`logic.js` e `components.js`)
*   **Problema:** O cronômetro do Event Card na Dashboard (`window._cronoInterval`) é limpo pela função genérica de `navigate`. Contudo, se um evento é editado (modal aberto) e excluído diretamente (sem `navigate`), a renderização do Card desaparece do DOM, mas o `setInterval` global continua rodando invisivelmente na RAM e manipulando propriedades do `state`.
*   **Risco:** Ao ligar/desligar múltiplos timers sem recarregar a página, a perfomance cai drasticamente (vazamento de handles do setInterval).
*   **Solução (Bug Fix G):** O gerenciamento de timers precisa ser pareado em `logic.js`. Exigir limpeza via `clearInterval` sempre que ocorrer deleção de evento, pausa forçada, ou recálculo de status.

### 2.2 Falta de Validação Robusta nos Formulários de Hábitos (`views.js`)
*   **Problema:** Apesar do conserto parcial feito para validação de mínimos, o formulário de Simulados (`openHabitModal`) permite inputs vazios no "total" que caem no `isNaN` e geram um total = 0, originando divs por zero ocultas (ex: tentativa de `$ {Math.round(acertos / tot * 100)}` resulta em `Infinity` visual ou quebra o IndexedDB no parse JSON.
*   **Risco:** Ao carregar a página de Hábitos Históricos (`habitHistPage`), o cálculo falha, travando totalmente a renderização da aba.
*   **Solução (Bug Fix J):** Padronizar regras matemáticas severas na conversão de inputs (`parseInt(..., 10) || 0`), adicionar proteções de divisão por zero na exibição do Histórico, e encapsular isso no Schema Defaults do `store.js`.

### 2.3 Problemas de Filtro Linear "Visão Linear" do Ciclo (`views.js`)
*   **Problema:** O método `getFilteredVertItems()` varre todo o array de editais toda vez que você digita uma tecla (com um debounce muito curto de 200ms). Durante grandes editais (ex: 300 assuntos), isso congela a Main Thread.
*   **Risco:** Micro-stuttering grave durante a digitação no input do Edital Vertical.
*   **Solução:** Ajustar debounce para 400ms. Armazenar um "índice flat" da árvore recursiva (Cache Memoizado) limitando buscas desnecessárias.

---

## ⚠️ 3. Severidade MÉDIA (Inconsistências Funcionais Menores)

### 3.1 Tratamento de Dias Adiados nas Revisões
*   **Problema:** Ao usar `adiarRevisao(assId)`, a lógica empurra a `dataConclusao` original do Assunto 1 dia para a frente. Matematicamente isso funciona, mas **falsifica a data histórica** real em que o usuário terminou a disciplina.
*   **Risco:** Fere a semântica analítica (o usuário terminou dia 10, mas em relatórios aparecerá como encerrado dia 15 se ele tiver adiado revisões 5 vezes).
*   **Solução:** Não modificar `dataConclusao`. Em vez disso, usar no `state` um dicionário de compensação de offset (ex: `ass.adiamentos: { data_alvo: data_nova }`) ou somar os offset do campo numérico puramente em tempo de renderização.

### 3.2 Escapamento XSS Centralizado
*   **Problema:** O método de escape (`esc()`) natuaral usado na aplicação não protege arrays que são serializados indiretamente (via `.map().join('')` onde dados aninhados sem escape caem no HTML final). Há vários em `views.js` (como a visualização "Árvore de Editais" no card de progresso, ex: `${disc.nome}` ao invés de `${esc(disc.nome)}` em alguns tooltips obscuros.
*   **Risco:** Injeção XSS local.
*   **Solução:** Mapeamento minucioso do arquivo `views.js` nos métodos `${...}` visando fechar todas as brechas (principalmente inputs com `data-tooltip`).

### 3.3 Problemas de Acessibilidade (Modal Trap e Teclados)
*   **Problema:** O bloqueio da tecla `Escape` em modais múltiplos lida genericamente com sobreposições no DOM através da classe `.modal-overlay.open`. Porém, modais com `z-index` complexo falham quando confirm/alert nativos do Javascript misturam a pilha. Enter pode clicar em botões não desejados de fundo longo do DOM.
*   **Risco:** Fechamentos acidentais durante edições críticas (sem prompt de "Salvar Antes de Sair?").
*   **Solução:** Sistema de Focus Trap focado dentro da caixa de diálogo via listeners de teclado e restrição global de Tab.

---

## 🛠️ 4. Baixa Severidade / Melhorias de Arquitetura

### 4.1 "Fat Views" e Separação de Responsabilidades (MVC)
*   Atualmente `views.js` lidera mais de 2500 linhas de código aglutinando: formatação de dados, montagem JSX-like imperativa e amarração de listeners inline (ex: `onclick="saveSomething()"`).
*   **Ideal:** Extrair cálculos lógicos (como "percentual da barra do Ciclo PDCA") para `logic.js`, mantendo views apenas focadas na interpolação das variáveis finais.

### 4.2 Arquivamento Massivo sem Paginação
*   Ao executar "Arquivar Eventos Antigos (>90 dias)", o JS varre os arrays inteiros. Com 2 anos de uso, o IndexedDB começará a ficar custoso na extração. A exportação/importação carrega 100% dos relatórios (Históricos de Simulados).
*   **Ideal:** Abstrair grandes logs para ObjectStores separados no IndexedDB. O store atual `estudo_data` guarda o estado inteiro em um chaveão. Arquitetura futura pode dividir Histórico/Logs do Estado Ativo.

---

## 🎯 Proposta de Plano de Execução (Próximos Passos)

Propõe-se que a correção seja dividida nos seguintes blocos (Tasks), aplicados imediatamente:

1.  **Block 1 (Crítico):** Refatorar o mecanismo Multipart da API Google Drive do `drive-sync.js` (usar chamadas padronizadas, evitar corrupção HTTP 400/Fetch Boundaries) e blindar o `store.js` + `app.js` contra conflitos iniciais. Adicionar proteção de `beforeunload`.
2.  **Block 2 (Alto):** Caçar Timeouts e Intervalls Zumbis: centralizar a "morte" dos scripts de intervalo no `logic.js` atrelando-os id's em memória. Proteger todos inputs matemáticos do Sistema de Hábitos e Simulados.
3.  **Block 3 (Médio/Baixo):** Ajustar algoritmo de Cálculo das Revisões e garantir sanidade no UX de adiamentos. Aplicar blindagens XSS profundas soltas nos templates HTML.

> Nota: A aplicação atingiu um alto nívell visual e velocidade. Removendo essas farpas arquiteturais crônicas, será uma aplicação totalmente *"production-ready"* offline first.
