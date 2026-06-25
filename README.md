# 📚 Estudo Organizado

Aplicação web/PWA **local-first** para planejamento e organização de estudos voltada para concursos públicos. Baseada no **Ciclo PDCA**: planeje no Calendário e no Ciclo de Estudos, execute no Study Organizer/Cronômetro, meça no Dashboard e no Histórico, e corrija com Revisões e a Inteligência de Banca.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

---

## Sumário

- [Funcionalidades](#-funcionalidades)
- [Como usar](#-como-usar)
- [Testes e qualidade](#-testes-e-qualidade)
- [Sincronização e backup](#️-sincronização-e-backup)
- [Integridade de dados](#️-integridade-de-dados)
- [Arquitetura](#️-arquitetura)
- [Documentação técnica](#-documentação-técnica)
- [Licença](#-licença)

---

## ✨ Funcionalidades

O app tem 13 telas acessíveis pela sidebar: Página Inicial, Study Organizer, Cronômetro, Calendário, Ciclo de Estudos, Dashboard, Revisões, Histórico de Sessões, Hábitos, Editais, Ed. Verticalizado, Inteligência de Banca e Configurações.

### 🏠 Página Inicial
- **Tempo de estudo acumulado** no dia atual
- **Desempenho em questões** (acertos/erros/percentual)
- **Progresso no edital** (aulas concluídas/pendentes)
- **Páginas lidas** (total acumulado)
- **Constância** — streak de dias consecutivos estudados com recorde pessoal e heatmap visual (30 dias)
- **Painel de disciplinas** — tabela com tempo, acertos, erros e % por matéria
- **Previsão da semana** — projeção baseada no ritmo de estudo vs meta (verde/amarelo/vermelho)
- **Data da prova** — contagem regressiva configurável

### 📖 Study Organizer
- **Criar eventos de estudo** com disciplina, assunto, data, duração e notas
- **Timer integrado** com play/pause por evento (múltiplos timers simultâneos)
- **Modo Pomodoro** — ciclos foco/pausa configuráveis com alarme sonoro
- **Modo Contínuo** — cronometragem sem limites
- **Cards de evento** classificados por status: Agendado, Estudei, Atrasado
- **Ações por evento**: iniciar timer, pausar, descartar tempo, marcar como estudado, excluir
- **Excluir sessão do ciclo = pular a etapa** — a matéria sai de toda a janela de agendamento e a etapa fica reabrível na tela Ciclo ("Reabrir etapa")
- **Adicionar minutos** manualmente à meta (+5, +15, +30 min)
- **Fontes e legislação** — campos para registrar materiais consultados

### ⏱ Cronômetro Livre
- Timer sem evento — para sessões de estudo avulsas
- **Meta configurável** em minutos
- **Seleção de disciplina e assunto** para vincular ao registro
- **Registro de sessão** automático ao concluir (abre modal de registro)

### 📅 Calendário
- **Visualização mensal** — grade completa com todos os dias visíveis
- **Visualização semanal** — detalhamento por dia
- Navegação por mês (anterior/próximo/hoje)
- **Indicadores visuais** — eventos com status por cores
- Clique em data para criar evento diretamente

### ♻️ Ciclo de Estudos
- **Wizard de 4 etapas**: tipo (ciclo contínuo ou grade semanal fixa), seleção de disciplinas, relevância e domínio (sliders 1-5 com preview), horários (sessão min/max, dias ativos, horas por dia/ciclo)
- **Distribuição de tempo inteligente** — Peso = Importância × (6 − Conhecimento)
- **Geração automática de sequência** com slots proporcionais ao peso
- **Editor de sequência** — reordenar, duplicar, remover, editar slots
- **Etapas puláveis** — excluir a sessão agendada pula a etapa (badge "⏩ Etapa pulada" + botão "Reabrir etapa"); etapas puladas são restauradas ao recomeçar o ciclo
- **Iniciar etapa** do ciclo diretamente (cria evento com timer)
- **Previsões** — modelo preditivo de quando o ciclo será completado
- **Reiniciar ciclo** com contagem de ciclos completos
- **Relatório**: tempo total, sessões, último ciclo, ciclos completos

### 📊 Dashboard
- **Filtro por período**: 7, 15, 30, 90, 365 dias
- **Gráfico de tempo diário** — barras com cores por disciplina (Chart.js)
- **Gráfico de distribuição** — doughnut por disciplina
- **Estatísticas de desempenho**: questões, acertos, erros, percentual
- **Progresso do edital** — barras de progresso por disciplina
- **Resumo de hábitos** — contagem por tipo no período selecionado
- **Dashboard por disciplina** — abas Performance, Tópicos, Aulas e Banca, com gráfico de tempo acumulado e histórico de sessões

### 📜 Histórico de Sessões
- **Lista completa** de sessões concluídas, agrupadas por data
- **Toolbar de filtros** — disciplina, período e busca
- **Editar e excluir** sessões passadas (exclusões propagam entre dispositivos via tombstones)

### 🔄 Revisões Espaçadas
- **Intervalos configuráveis**: 1, 7, 30, 90 dias (editáveis em Configurações)
- **3 abas**: Pendentes (hoje), Próximas (futuras), Concluídas (histórico)
- **Marcar revisão** — avança para o próximo intervalo
- **Adiar revisão** — reagenda para amanhã sem contar como feita
- **Badges na sidebar** indicando quantidade de revisões pendentes

### ⚡ Hábitos
- **9 categorias**: Questões, Revisão, Discursiva, Simulado, Leitura Seca, Informativos, Súmulas, Videoaula, Páginas Lidas
- **Registro detalhado** por tipo (acertos/erros, banca, fonte, modo treino/simulado, aulas assistidas, páginas, nota com percentual automático)
- **Histórico paginado** (20 itens por página) com exclusão individual
- **Filtro por tipo** de hábito
- **Vinculação a disciplina/assunto** opcional

### 📋 Editais
- **CRUD completo** de editais, disciplinas e assuntos
- **18 cores** e **30 ícones** para personalização
- **Gerenciador de assuntos** — drag-to-reorder, edição inline, adição em lote, importação de aulas em lote
- **Dashboard por disciplina** embutido
- **Toggle de assuntos** concluídos/pendentes e controle de aulas lidas vs total

### 📑 Ed. Verticalizado
- **Visão verticalizada** de todo o edital com progresso por tópico
- **Filtros** por edital e status (todos/pendente/concluído)
- **Busca em tempo real** por nome de assunto
- **Criar evento** diretamente de um assunto (um clique)
- **Informações de relevância** (P1/P2/P3) quando disponíveis

### 🧠 Inteligência de Banca
- **Análise preditiva** baseada em dados de incidência da banca
- **Motor NLP**: tokenização sem stopwords, distância de Levenshtein, fuzzy similarity (>80%), match exato/parcial/por inclusão
- **Priorização automática**: P1 (top 20%), P2 (20-60%), P3 (60-100%)
- **Revisão assistida** — correção manual de matches incorretos
- **Análises salvas** em chips — revisualizar, editar ou excluir (com reversão à ordem alfabética)
- **Auto-link aulas ↔ assuntos** com threshold de 70%

### ⚙️ Configurações
- **6 temas visuais**: Grafite, Ardósia, Platina, Terminal, Neon, Arrakis
- **Meta semanal** de horas de estudo
- **Frequência de revisão** personalizável (4 intervalos)
- **Pomodoro**: tempos de foco e pausa configuráveis
- **Horário silencioso** para notificações (padrão 22h–08h)
- **Central de Sync** — Firestore (login Google), Cloudflare (URL + token) e Google Drive (OAuth 2.0)
- **Exportar/Importar dados** — JSON completo com validação anti-corrupção
- **Arquivar eventos antigos** — move concluídos >90 dias para arquivo
- **Apagar todos os dados** — dupla confirmação de segurança

### 📝 Registro de Sessão
- **Modal completo** após marcar evento como estudado: tempo cronometrado preenchido, data e intervalo de horário, disciplina/assunto, tipo de estudo e campos específicos, notas livres
- **Salvar e iniciar nova** — registro rápido com novo timer
- **Sessão livre** — cria evento retroativo se vindo do cronômetro livre

### 🔔 Notificações Inteligentes
- **Revisões pendentes** — alerta quando há assuntos vencidos
- **Meta semanal em risco** — aviso baseado no ritmo vs projeção
- **Horário silencioso** e **dedup diário** (mesma notificação não repete no dia)
- **Fallback** — toast no app quando a permissão de notificação é negada
- **Engine** em background a cada 4 horas

### 🔍 Busca Global
- **Busca em tempo real** com debounce (300ms)
- **4 categorias**: Eventos, Disciplinas, Assuntos, Hábitos
- **Highlight** de termos e navegação direta ao clicar

---

## 🚀 Como usar

### Opção 1: Windows Launcher (recomendado)
Dê dois cliques em `Abrir_Estudo_Organizado.bat`. Ele inicia o servidor local e abre o app automaticamente.

### Opção 2: Servidor manual
```bash
# Com Node.js
npx http-server src -p 8080

# Com Python
python -m http.server 8080 --directory src
```
Acesse: `http://localhost:8080`

### Ambiente mock para testes manuais

Ambiente de teste local isolado com dados mock realistas, sem risco aos dados de produção.

**Via BAT (Windows):** dê dois cliques em `Abrir_Estudo_Organizado_Mock.bat` e escolha no menu:

| Opção | Comportamento |
|-------|---------------|
| `[1] Preservar` | Abre mantendo dados existentes |
| `[2] Resetar` | Limpa e recria o dataset mock completo |
| `[3] Limpar` | Abre o app sem dados (tela limpa) |

**Via npm:**
```bash
npm run mock           # modo reset (dados mock completos)
npm run mock:preserve  # modo preservar (mantém dados existentes)
npm run mock:clean     # modo limpar (app vazio)
```

O ambiente roda em `http://127.0.0.1:18765` — origem separada do launcher principal e da produção. Inclui 3 editais, 15+ disciplinas, 40-80 eventos, hábitos em todas as categorias e revisões variadas; Service Worker e sync (Firebase/Cloudflare/Drive) ficam desativados.

---

## 🧪 Testes e qualidade

Suíte com **Vitest** (106 arquivos de teste unitário, ~1.760 testes) e **Playwright** (24 specs E2E, incluindo simulação de sync entre 2 dispositivos).

```bash
npm install
npm test               # unitários (Vitest)
npm run test:e2e       # E2E release (chromium, 1 worker)
```

Comandos principais:

- `npm test` / `npm run test:unit` — testes unitários
- `npm run test:watch` — modo watch
- `npm run test:coverage` — cobertura
- `npm run test:e2e` — E2E release (chromium, sequencial)
- `npm run test:e2e:quick` — E2E paralelo rápido
- `npm run test:e2e:ui` — runner visual do Playwright
- `npm run test:e2e:mock` — E2E do ambiente mock
- `npm run test:sync` / `test:views` / `test:css` / `test:config` — recortes por área
- `npm run test:all` — unitários + E2E em sequência

Qualidade de código:

- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` / `npm run format:check` — Prettier
- `npm run ci` — pipeline completo (lint + format + test)

CI: `.github/workflows/ci.yml` executa `npm ci`, lint, format check e testes em push/PR para `main`.

---

## ☁️ Sincronização e backup

### Firestore local-first
Caminho remoto principal quando configurado:

1. Defina `window.ESTUDO_FIREBASE_CONFIG` antes de carregar `js/main.js`
2. Gere o bundle local com `npm run build:firebase`
3. Entre com Google em **Configurações > Firestore**
4. Ative em modo shadow antes de usar como fonte de restauração

- IndexedDB continua sendo a gravação local e camada de recuperação
- Firestore usa snapshot versionado em `users/{uid}/snapshots/main`
- Conflitos exigem export local, pull remoto ou force push explícito
- Guia completo: `docs/guides/firebase-firestore-setup.md`

### Cloudflare Multi-Device Sync
Espelhe seus dados entre celular e PC:

1. Configure seu Worker e segredos de ambiente antes de ativar
2. Insira a URL e o Token em **Configurações**
3. Ative o Sync para pareamento automático

- O sync é orientado a snapshot com merge por entidade no cliente
- Trate URL e token como credenciais operacionais
- Revise `docs/security/sync-threat-model.md` antes de publicar uma instância

### Merge entre dispositivos
- **Tombstones de exclusão** — excluir um evento, sessão concluída ou hábito em um dispositivo propaga a exclusão para os demais sem ressuscitar o item no merge (retenção de 180 dias, cap de 2000)
- **Planejamento com LWW** — mudanças no plano do ciclo (etapas puladas, sequência editada) propagam entre dispositivos pelo `updatedAt` mais recente

### Google Drive
Conexão via OAuth 2.0 para backup automático na nuvem do Google.

### Backup local
Exportação e importação manual via **JSON** com validação de integridade.

---

## 🛡️ Integridade de dados

O app foi projetado para **nunca perder dados**:

- **IndexedDB** como banco primário com debounce de 800ms
- **Emergency save** via `localStorage` síncrono no `beforeunload`
- **Recovery automático** de saves emergenciais na inicialização
- **Validação de importação** — rejeita JSON sem estrutura válida
- **Dupla confirmação** em ações destrutivas (apagar dados, deletar edital)
- **Migrações automáticas** — schema evolui sem perder dados (v1→v10)
- **Arquivo de eventos** — concluídos antigos vão para arquivo, não são deletados

---

## 🏗️ Arquitetura

```
src/
├── index.html                  # SPA principal
├── manifest.json               # PWA manifest
├── sw.js                       # Service Worker (network-first p/ shell, SWR p/ assets)
├── css/
│   ├── tokens.css              # Design tokens (temas via data-theme)
│   ├── base/                   # Layout, temas, mobile, forms, animações, a11y
│   ├── components/             # Botões, cards, sidebar, modais, timer, tabs...
│   ├── views/                  # CSS por tela (dashboard, calendar, ciclo, sessions...)
│   └── styles.css              # Regras legadas em migração para os módulos
└── js/
    ├── main.js                 # Entry point — inicializa módulos e expõe EstudoApp
    ├── store.js                # Estado global + persistência
    ├── store/                  # IndexedDB, migrações (v1→v10), export/normalize
    ├── app.js + app/           # Navegação, modais, toasts, temas, save-status
    ├── logic.js + logic/       # Timer, ciclo, disciplinas, revisões, progresso
    ├── views/                  # Uma view por tela + submódulos (calendar/, editais/, config/)
    ├── ui/                     # Busca global, modais de evento, dialog, actions/ (dispatcher)
    ├── sync/                   # sync-center (merge + tombstones), coordinator,
    │                           # firestore engine/outbox/repository, manual-sync, health
    ├── registro-sessao.js      # Modal de registro pós-estudo + session-save
    ├── planejamento-wizard.js  # Wizard de 4 etapas (Ciclo/Grade semanal)
    ├── relevance.js            # NLP engine (tokenize, Levenshtein, fuzzy match)
    ├── lesson-mapper.js        # Auto-link aulas ↔ assuntos (threshold 0.70)
    ├── notifications.js        # Engine de notificações
    ├── cloud-sync.js           # Cloudflare KV sync
    └── drive-sync.js           # Google Drive API (OAuth, multipart upload)
```

### Stack técnica
- **Zero frameworks** — Vanilla JS ES Modules com arquitetura modular
- **IndexedDB** — persistência local com fallback `localStorage`
- **Chart.js** — gráficos do Dashboard (vendorizado)
- **Font Awesome** — iconografia
- **PWA** — Service Worker com cache versionado (`APP_VERSION`) + manifest para instalação e modo offline
- **ESLint + Prettier** — linting e formatação
- **Vitest + Playwright** — testes unitários e E2E
- **GitHub Actions** — CI em push/PR

---

## 📖 Documentação técnica

Toda a documentação fica em `docs/` (a raiz `src/` contém apenas o código da app). Veja o índice em [`docs/README.md`](docs/README.md).

- `docs/architecture/` — visão geral da arquitetura e fluxo de dados
- `docs/security/sync-threat-model.md` — riscos e mitigação de persistência/sync
- `docs/api/sync-contract.md` — contrato do sync
- `docs/guides/firebase-firestore-setup.md` — configuração Firebase/Auth/Firestore/App Check
- `docs/qa/manual-regression-checklist.md` — checklist de regressão manual
- `docs/releases/release-checklist.md` — checklist de release
- `docs/handoffs/` — handoffs de sessões de desenvolvimento
- `docs/plans/` · `docs/reports/` · `docs/guides/` — planos, relatórios e guias

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---
<p align="center">Desenvolvido com ❤️ para estudantes de concursos públicos.</p>
