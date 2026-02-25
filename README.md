# 📚 Estudo Organizado

Aplicação web para **planejamento e organização de estudos** voltada para concursos públicos. Baseada no **Ciclo PDCA**: planeje no Calendário, execute no Study Organizer, meça no Dashboard e corrija com as Revisões.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

---

## 🆕 Últimas Atualizações (Wave 9 - Conectividade & QA)
- **Integração Planejamento ↔ Cronômetro:** Agora os blocos de estudo gerados no módulo Planejamento ("Grade Semanal" e "Ciclo") possuem o botão **Estudar Agora**, enviando a disciplina alvo direto para o Cronômetro e registrando o progresso automaticamente no fim da sessão.
- **Cascata de Exclusões Segura:** A exclusão de Editais, Disciplinas e Assuntos agora limpa varre e desvincula corretamente o histórico de eventos e planejamentos órfãos, prevenindo quebras de renderização na Dashboard.
- **Correção "Midnight Rollover":** Resolvido o bug onde as datas do sistema congelavam se a aba permanecesse aberta virando a noite. O sistema agora revalida a data ativamente em `visibilitychange` da aba e ciclos de evento de gravação.
- **Auditoria Rigorosa:** Verificações profundas nos validadores numéricos e lógicos do registro de hábitos (Simulados, Discursivas, Leitura Seca).
- Documentação integral das correções disponíveis e audições de código em `analise_de_codigo_wave9.md` e `walkthrough.md`.

## ✨ Funcionalidades

| Módulo | Descrição |
|---|---|
| 🏠 **Página Inicial** | Visão geral do dia: eventos agendados, estudados, atrasados e revisões pendentes |
| 📖 **Study Organizer** | Registro de sessões de estudo com timer Pomodoro integrado |
| 📅 **Calendário** | Visualização mensal e semanal dos eventos de estudo |
| 📊 **Dashboard** | Métricas de desempenho: tempo estudado, sessões, questões e simulados |
| 🔄 **Revisões** | Sistema de revisão espaçada com intervalos configuráveis (1, 7, 30, 90 dias) |
| ⚡ **Hábitos** | Acompanhamento de hábitos de estudo por categoria |
| 📋 **Editais** | Gestão de editais, disciplinas e assuntos por concurso |
| 📐 **Ed. Verticalizado** | Estudo vertical por edital com acompanhamento de progresso |
| ⚙️ **Configurações** | Tema, calendário, Google Drive sync, notificações e backup |

## 🚀 Como Usar

### Opção 1: Abrir com o script BAT (Windows)
Dê dois cliques em `Abrir_Estudo_Organizado.bat` — ele inicia um servidor local e abre o app no navegador.

### Opção 2: Servidor local manual
```bash
cd src
python -m http.server 8000
# Abra http://localhost:8000 no navegador
```

### Opção 3: Node.js
```bash
cd src
npx http-server -p 8000
# Abra http://localhost:8000 no navegador
```

> **Nota:** O app funciona 100% no navegador (client-side). Não é necessário backend — os dados são salvos localmente via **IndexedDB**.

## 🏗️ Estrutura do Projeto

```
estudo-organizado/
├── src/
│   ├── index.html          # Página principal (HTML skeleton)
│   ├── css/
│   │   └── styles.css      # Estilos (dark/light mode, responsivo)
│   └── js/
│       ├── main.js          # Entrypoint: orquestração e eventos de domínio
│       ├── app.js           # Navegação e modais genéricos
│       ├── store.js         # Estado: IndexedDB, migrations, save/load
│       ├── logic.js         # Regras de negócio: cronômetro, revisões, analytics
│       ├── utils.js         # Utilitários puros e constantes estáticas
│       ├── components.js    # Componentes de UI reutilizáveis
│       ├── views.js         # Renderização de todas as views baseadas no estado
│       ├── registro-sessao.js # Lógica específica do modal de registro de sessão
│       └── drive-sync.js    # Sincronização com Google Drive
├── Abrir_Estudo_Organizado.bat  # Launcher para Windows
├── .gitignore
├── LICENSE
└── README.md
```

## 🔧 Tecnologias

- **HTML5 / CSS3 / JavaScript** — Sem frameworks, tudo vanilla
- **IndexedDB** — Persistência de dados local
- **Chart.js** — Gráficos no Dashboard (via CDN)
- **Font Awesome** — Ícones (via CDN)
- **Google Drive API** — Sincronização opcional de dados entre dispositivos

## ☁️ Google Drive Sync

Para habilitar a sincronização com Google Drive:

1. Acesse **Configurações** → **Google Drive**
2. Insira seu **Client ID** do Google Cloud Console
3. Clique em **Conectar ao Google Drive**
4. Os dados serão sincronizados automaticamente a cada 5 minutos

## 📦 Backup & Restauração

- **Exportar JSON** — Gera um arquivo `.json` com todos os seus dados
- **Importar JSON** — Restaura dados a partir de um backup
- Disponível em **Configurações** → **Dados**

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

Desenvolvido com ❤️ para estudantes de concursos públicos.
