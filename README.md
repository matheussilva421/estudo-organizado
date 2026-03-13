# 📚 Estudo Organizado

Aplicação web premium para **planejamento e organização de estudos** voltada para concursos públicos. Baseada no **Ciclo PDCA**: planeje no Calendário, execute no Study Organizer, meça no Dashboard e corrija com as Revisões.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

---

## ✨ Funcionalidades Detalhadas

### 🏠 Página Inicial
- **Tempo de estudo acumulado** no dia atual
- **Desempenho em questões** (acertos/erros/percentual)
- **Progresso no edital** (aulas concluídas/pendentes)
- **Páginas lidas** (total acumulado)
- **Constância** — streak de dias consecutivos estudados com recorde pessoal e heatmap visual (30 dias)
- **Painel de disciplinas** — tabela com tempo, acertos, erros e % por matéria
- **Previsão da semana** — projeção inteligente baseada no ritmo de estudo vs meta (verde/amarelo/vermelho)
- **Data da prova** — contagem regressiva configurável

### 📖 Study Organizer
- **Criar eventos de estudo** com disciplina, assunto, data, duração e notas
- **Timer integrado** com play/pause por evento (suporte a múltiplos timers simultâneos)
- **Modo Pomodoro** — ciclos foco/pausa configuráveis com alarme sonoro
- **Modo Contínuo** — cronometragem sem limites
- **Cards de evento** classificados por status: Agendado, Estudei, Atrasado
- **Ações por evento**: iniciar timer, pausar, descartar tempo, marcar como estudado, excluir
- **Adicionar minutos** manualmente à meta (+5, +15, +30 min)
- **Fontes e legislação** — campos para registrar materiais consultados
- **Refresh cirúrgico** — atualização do DOM sem re-render completo

### ⏱ Cronômetro Livre
- Timer sem evento — para sessões de estudo avulsas
- **Meta configurável** em minutos
- **Seleção de disciplina e assunto** para vincular ao registro
- **Registro de sessão** automático ao concluir (abre modal de registro)

### 📅 Calendário
- **Visualização mensal** — grade completa com 6 linhas (todos os dias visíveis)
- **Visualização semanal** — detalhamento por dia
- Navegação por mês (anterior/próximo/hoje)
- **Indicadores visuais** — eventos alinhados com status por cores
- Clique em data para criar evento diretamente

### ♻️ Ciclo de Estudos
- **Wizard de 4 etapas** para configuração:
  1. Tipo: Ciclo contínuo ou Grade semanal fixa
  2. Seleção de disciplinas (com botões "Todas"/"Nenhuma")
  3. Relevância e domínio (sliders 1-5 com preview em tempo real)
  4. Horários: sessão min/max, dias ativos, horas por dia/ciclo
- **Distribuição de tempo inteligente** — Peso = Importância × (6 − Conhecimento)
- **Geração automática de sequência** com slots proporcionais ao peso
- **Editor de sequência** — reordenar, duplicar, remover, editar slots
- **Iniciar etapa** do ciclo diretamente (cria evento com timer)
- **Previsões** — modelo preditivo de quando o ciclo será completado
- **Reiniciar ciclo** com contagem de ciclos completos
- **Relatório:** tempo total, sessões, último ciclo, ciclos completos

### 📊 Dashboard
- **Filtro por período**: 7, 15, 30, 90, 365 dias
- **Gráfico de tempo diário** — barras com cores por disciplina (Chart.js)
- **Gráfico de distribuição** — pizza/doughnut por disciplina
- **Estatísticas de desempenho**: questões, acertos, erros, percentual
- **Progresso do edital** — barras de progresso por disciplina
- **Resumo de hábitos** — contagem por tipo no período selecionado
- **Dashboard por disciplina** — visão detalhada ao clicar em matéria:
  - Abas: Performance, Tópicos, Aulas, Banca
  - Gráfico de tempo acumulado por dia
  - Histórico de sessões

### 🔄 Revisões Espaçadas
- **Intervalos configuráveis**: 1, 7, 30, 90 dias (editável em Configurações)
- **3 abas**: Pendentes (hoje), Próximas (futuras), Concluídas (histórico)
- **Marcar revisão** — avança para o próximo intervalo
- **Adiar revisão** — reagenda para amanhã sem contar como feita
- **Contagem de revisões feitas** e datas de cada uma
- **Badges na sidebar** indicando quantidade de revisões pendentes

### ⚡ Hábitos
- **6 categorias**: Videoaula, Leitura, Questões, Simulado, Revisão, Flash Cards
- **Registro detalhado** por tipo:
  - Questões: acertos/erros, banca, fonte, modo (treino/simulado)
  - Videoaula: aulas assistidas, tempo total
  - Leitura: páginas lidas
  - Simulado: nota, acertos/erros, percentual calculado automaticamente
- **Histórico paginado** (20 itens por página) com exclusão individual
- **Filtro por tipo** de hábito
- **Vinculação a disciplina/assunto** opcional

### 📋 Editais
- **CRUD completo** de editais, disciplinas e assuntos
- **18 cores** e **30 ícones** disponíveis para personalização
- **Gerenciador de assuntos** com abas:
  - Lista com drag-to-reorder, edição inline e exclusão
  - Adição em lote (colar lista de tópicos de uma vez)
  - Importação de aulas em lote
- **Dashboard por disciplina** embutido
- **Expandir/colapsar** árvore de editais
- **Toggle de assuntos** concluídos/pendentes com feedback visual
- **Aulas lidas** vs Total — controle de progresso

### 📑 Ed. Verticalizado
- **Visão verticalizada** de todo o edital com progresso por tópico
- **Filtros**: por edital, por status (todos/pendente/concluído)
- **Busca em tempo real** por nome de assunto
- **Criar evento** diretamente de um assunto (um clique)
- **Informações de relevância** (P1/P2/P3) quando disponíveis

### 🧠 Inteligência de Banca
- **Análise preditiva** baseada em dados de incidência da banca
- **Motor NLP** com:
  - Tokenização sem stopwords
  - Distância de Levenshtein
  - Fuzzy Similarity (>80% threshold)
  - Match exato, parcial e por inclusão
- **Priorização automática**: P1 (top 20%), P2 (20-60%), P3 (60-100%)
- **Revisão assistida** — correção manual de matches incorretos
- **Análises salvas** em chips — re-visualizar, editar ou excluir
- **Reversão** — voltar à ordem alfabética ao excluir análise
- **Auto-link aulas ↔ assuntos** com threshold de 70%

### ⚙️ Configurações
- **Temas visuais**: Furtivo (escuro), Modo Claro, Rubi, Matrix
- **Meta semanal** de horas de estudo
- **Frequência de revisão** personalizável (4 intervalos)
- **Pomodoro**: tempo de foco e pausa configuráveis
- **Horário silencioso** para notificações (padrão 22h–08h)
- **Cloudflare Sync** — URL e token para sincronização multi-dispositivo
- **Google Drive** — OAuth 2.0 com backup automático
- **Exportar dados** — JSON completo com formatação
- **Importar dados** — com validação de estrutura anti-corrupção
- **Arquivar eventos antigos** — move concluídos >90 dias para arquivo
- **Apagar todos os dados** — dupla confirmação de segurança

### 📝 Registro de Sessão
- **Modal completo** após marcar evento como estudado:
  - Tempo cronometrado automaticamente preenchido
  - Data e intervalo de horário
  - Disciplina e assunto (dropdowns inteligentes)
  - **5 tipos de estudo**: Questões, Revisão, Leitura seca, Informativos, Discursiva
  - Campos específicos por tipo (acertos/erros, páginas, tempo de vídeo)
  - Notas da sessão (campo livre)
- **Salvar e iniciar nova** — registro rápido com novo timer
- **Sessão livre** — cria evento retroativo se vindo do cronômetro livre

### 🔔 Notificações Inteligentes
- **Revisões pendentes** — alerta quando há assuntos vencidos
- **Meta semanal em risco** — aviso baseado no ritmo vs projeção
- **Horário silencioso** — sem alarmes entre 22h e 8h
- **Dedup diário** — mesma notificação não repete no mesmo dia
- **Fallback** — toast no app quando permissão de notificação negada
- **Engine** em background a cada 4 horas

### 🔍 Busca Global
- **Busca em tempo real** com debounce (300ms)
- **4 categorias**: Eventos, Disciplinas, Assuntos, Hábitos
- **Highlight** de termos encontrados
- **Navegação direta** ao clicar no resultado

---

## 🚀 Como Usar

### Opção 1: Windows Launcher (Recomendado)
Basta dar dois cliques em `Abrir_Estudo_Organizado.bat`. Ele iniciará o servidor local e abrirá o app automaticamente.

### Opção 2: Servidor Manual
```bash
# Com Node.js
npx http-server src -p 8080

# Com Python
python -m http.server 8080 --directory src
```
Acesse: `http://localhost:8080`

---

## ☁️ Sincronização e Backup

### Cloudflare Multi-Device Sync
Espelhe seus dados entre celular e PC em tempo real:
1. Configure seu Worker seguindo `docs/CLOUDFLARE-SETUP.md`
2. Insira a URL e o Token em **Configurações**
3. Ative o Sync para pareamento automático

### Google Drive
Conecte via OAuth 2.0 para backup automático na nuvem do Google.

### Backup Local
Exportação e importação manual via **JSON** com validação de integridade.

---

## 🛡️ Integridade de Dados

O app foi projetado para **nunca perder dados**:

- **IndexedDB** como banco primário com debounce de 800ms
- **Emergency save** via `localStorage` síncrono no `beforeunload`
- **Recovery automático** de saves emergenciais na inicialização
- **Validação de importação** — rejeita JSON sem estrutura válida
- **Dupla confirmação** em ações destrutivas (apagar dados, deletar edital)
- **Migrações automáticas** — schema evolui sem perder dados (v1→v7)
- **Arquivo de eventos** — concluídos antigos vão para arquivo, não são deletados

---

## 🏗️ Estrutura do Projeto

```
src/
├── index.html                 # SPA principal com 12 modais
├── manifest.json              # PWA manifest
├── sw.js                      # Service Worker (cache-first)
├── css/
│   └── styles.css             # Design system (~3000 linhas)
└── js/
    ├── main.js                # Entry point — expõe 14 módulos ao window
    ├── store.js               # Estado global + IndexedDB + migrações (v1→v7)
    ├── app.js                 # Navegação, modais, toasts, temas
    ├── logic.js               # Timer engine, dashboard stats, revisões, ciclo
    ├── views.js               # Renderização de 11 views (~4600 linhas, 155 funções)
    ├── components.js          # Event cards, cronômetro, badges
    ├── utils.js               # Formatação, escape, cache, HABIT_TYPES
    ├── registro-sessao.js     # Modal de registro pós-estudo
    ├── planejamento-wizard.js # Wizard 4 etapas (Ciclo/Semanal)
    ├── relevance.js           # NLP engine (tokenize, Levenshtein, fuzzy match)
    ├── lesson-mapper.js       # Auto-link aulas ↔ assuntos (threshold 0.70)
    ├── notifications.js       # Engine de notificações (4h interval, silent hours)
    ├── cloud-sync.js          # Cloudflare KV sync (pull/push com timestamps)
    └── drive-sync.js          # Google Drive API (OAuth, multipart upload)
```

### Stack Técnica
- **Zero frameworks** — Vanilla JS ES Modules (~8500 linhas)
- **IndexedDB** — Persistência local com fallback `localStorage`
- **Chart.js 4.4** — Gráficos interativos do Dashboard
- **Font Awesome 6.4** — Iconografia
- **Plus Jakarta Sans** — Tipografia
- **PWA** — Service Worker + Manifest para instalação nativa e modo offline

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---
<p align="center">Desenvolvido com ❤️ para estudantes de concursos públicos.</p>
