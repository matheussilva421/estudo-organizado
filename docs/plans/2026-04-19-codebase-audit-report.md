# Codebase Audit Report - 2026-04-19

## Contexto

Esta auditoria foi solicitada depois da execução do plano `2026-04-18-app-maturity-implementation-plan.md`, com foco especial em bugs e regressões de UI surgidos após aquele ciclo de mudanças.

O resultado principal é: a suíte automatizada atual passa, mas não cobre os fluxos onde as regressões apareceram. Há problemas reais em UI, arquitetura de eventos, módulos extraídos, busca, sync e documentação de progresso.

> Update 2026-04-19: the first implementation slice fixed AUD-001, AUD-002, and the main runtime part of AUD-003. The added regression suite now covers empty-state layout, single Pomodoro toggle behavior, accessible search results, duplicate `data-action` keys, and double action dispatch. Remaining AUD-003 work is deeper keyboard behavior/ARIA cleanup; sync, Banca, extracted modules, PWA and docs drift remain open.

## Ambiente e comandos executados

- Branch: `main...origin/main`
- Working tree antes da auditoria: limpo
- Node.js: `v24.15.0`
- npm/npx: `11.12.1`

### Verificações automatizadas

```powershell
npm test
```

Resultado:

- 5 arquivos de teste passaram
- 55 testes unitários passaram

```powershell
npm run test:e2e
```

Resultado:

- 2 testes Playwright passaram
- Cobertura E2E atual: boot da home e criação/persistência básica de evento

### Verificações exploratórias com Playwright

Foi aberto Chromium real contra `http://127.0.0.1:4173`.

Artefatos gerados:

- `output/playwright/audit-desktop.png`
- `output/playwright/audit-mobile.png`

Evidências coletadas:

```json
{
  "cronoBefore": "⏱ Modo Contínuo",
  "cronoAfter": "⏱ Modo Contínuo",
  "pomodoroMode": false,
  "searchResultTags": [
    { "tag": "DIV", "action": "navigate-to-event", "role": null },
    { "tag": "DIV", "action": "navigate-to-disciplina", "role": null },
    { "tag": "DIV", "action": "navigate-to-assunto", "role": null }
  ],
  "ariaExpanded": "false"
}
```

Ou seja: o botão do modo do cronômetro não alterna, e a busca global ainda renderiza resultados como `DIV`, sem papel semântico, apesar do plano declarar conversão para botões acessíveis.

## Métricas estáticas

| Métrica | Resultado |
| --- | ---: |
| Arquivos unitários | 5 |
| Testes unitários | 55 |
| Testes E2E | 2 |
| `data-action=` em `src` | 290 |
| Ações distintas usadas em markup | 156 |
| Ações sem handler encontrado | 0 |
| Ações manipuladas tanto por `main.js` quanto por `ui/actions.js` | 4 |
| Chaves duplicadas dentro de `ui/actions.js` | 7 |
| Ocorrências de `style=` em `src/js` e `src/index.html` | 350 |
| Ocorrências de `innerHTML`/`insertAdjacentHTML` em `src/js` | 94 |
| Ocorrências de `window.` em `src/js` | 572 |
| Anti-padrões CSS `transition: all` / `outline: none` | 10 |

Maiores arquivos ainda concentrando risco:

| Arquivo | Tamanho |
| --- | ---: |
| `src/js/views.js` | 197199 bytes |
| `src/css/styles.css` | 83576 bytes |
| `src/css/views.css` | 49074 bytes |
| `src/js/registro-sessao.js` | 37601 bytes |
| `src/js/logic.js` | 35313 bytes |
| `src/js/ui/actions.js` | 35200 bytes |

## Achados críticos

### AUD-001 - Empty states quebrados por colisão de CSS

**Severidade:** P1  
**Área:** UI, design system, regressão visual  
**Evidência:** `src/css/components.css:187`, `src/css/styles.css:1671`, `src/js/views.js:216`, `src/js/views.js:4154`

`components.css` define `.empty-state` como `display: flex`, `align-items: center` e `justify-content: center`, mas não define `flex-direction: column`. Como `styles.css` adiciona apenas texto/padding/cor, os filhos dos empty states ficam em linha.

Impacto visível:

- Ícone, título, texto e CTA aparecem espremidos horizontalmente.
- O estado vazio do Study Organizer e do Ciclo fica parecido com as screenshots enviadas: conteúdo desalinhado no meio da tela e botão distante/estreito.
- Em mobile, o botão `Criar Meu Planejamento` mediu apenas ~53px de largura no teste exploratório, apesar do texto completo.

Correção esperada:

- Criar contrato único para `.empty-state`.
- Definir `flex-direction: column`, `gap`, `max-width`, `text-wrap` e largura responsiva dos CTAs.
- Adicionar teste visual ou E2E que valide o estado vazio de `med` e `ciclo` em desktop e mobile.

### AUD-002 - Dois dispatchers globais disparam a mesma ação

**Severidade:** P1  
**Área:** botões, eventos, arquitetura frontend  
**Evidência:** `src/js/main.js:104`, `src/js/ui/actions.js:1208`, `src/js/main.js:154`, `src/js/ui/actions.js:46`

Existem dois listeners globais em `document` para ações `data-action`:

- `setupActionDispatcher()` em `src/js/ui/actions.js`
- switch legado em `src/js/main.js`

`ui/actions.js` chama `event.stopPropagation()`, mas isso não impede outro listener no mesmo elemento `document` de rodar. Para isso seria necessário `stopImmediatePropagation()` ou, melhor, remover o dispatcher legado.

Ações duplicadas encontradas:

- `close-modal`
- `navigate`
- `open-drive-modal`
- `toggle-timer-mode`

Reprodução confirmada:

- Entrar em `Cronômetro`
- Clicar em `Modo Contínuo`
- Resultado: texto continua `⏱ Modo Contínuo` e `state.config.pomodoroMode` permanece `false`

Hipótese confirmada: o primeiro dispatcher liga Pomodoro e o segundo desliga imediatamente.

### AUD-003 - Busca global usa implementação antiga e ignora a versão acessível

**Severidade:** P1  
**Área:** UI, acessibilidade, arquitetura  
**Evidência:** `src/js/main.js:219`, `src/js/main.js:292`, `src/js/views.js:3904`, `src/index.html:148`

O plano declara que a busca foi convertida para botões com ARIA e anúncio de resultados, mas o runtime usa a implementação de `main.js`, que renderiza:

```html
<div class="search-result-item" data-action="navigate-to-event">
```

O teste exploratório confirmou:

- Resultados são `DIV`, não `BUTTON`
- `role` é `null`
- `aria-expanded` continua `false` após resultados abrirem

Impacto:

- Resultado de busca não é um controle semântico.
- Teclado/leitor de tela ficam inconsistentes.
- Há duas implementações concorrentes de busca (`main.js` e `views.js`), aumentando drift.

### AUD-004 - Inteligência de Banca foi extraída com funções placeholder

**Severidade:** P1  
**Área:** lógica quebrada, função desconexa, fluxo crítico  
**Evidência:** `src/js/views/banca-view.js:21`, `src/js/views/banca-view.js:30`, `src/js/views/banca-view.js:345`

`banca-view.js` contém placeholders:

- `applyRankingToEdital()` retorna `[]`
- `commitEditalOrdering()` retorna `false`
- `revertEditalOrdering()` apenas chama `scheduleSave()`

Como `views.js` reexporta `renderBancaAnalyzerModule` de `banca-view.js`, o fluxo principal passa por esses placeholders. Assim, o botão para gravar P1/P2/P3 tende a cair em erro:

```js
showToast('Falha crítica ao gravar novo Edital na Store', 'error');
```

Impacto:

- O analisador pode simular matches, mas a persistência real do ranking está quebrada.
- O plano marcou a modularização como completa, mas a extração deixou lógica essencial sem implementação.

### AUD-005 - Proteção de sobrescrita do Cloudflare Sync não protege contra cliente obsoleto

**Severidade:** P1  
**Área:** sync, online/local-first, risco de perda de dados  
**Evidência:** `src/js/cloud-sync.js:62`, `src/js/cloud-sync.js:175`, `scripts/cloudflare-worker.js:87`, `scripts/cloudflare-worker.js:97`

O Worker rejeita payload se `parsed.updatedAt` for mais antigo que `META_KEY.updatedAt`. Porém o cliente sempre cria um envelope novo no push:

```js
updatedAt: new Date().toISOString()
```

Isso significa que um dispositivo com dados antigos, mas fazendo push agora, ganha timestamp atual e pode sobrescrever dados remotos mais recentes.

Outros problemas:

- `ALLOWED_ORIGINS` vazio em `scripts/cloudflare-worker.js` permite qualquer origem por compatibilidade.
- A UI ainda edita `cfUrl` e `cfToken` em `state.config`, embora `cloud-sync.js` tente separar credenciais em `localStorage`.
- `src/docs/api/sync-contract.md` ainda descreve limitações antigas como atuais e não reflete completamente a implementação.

Correção esperada:

- Comparar `payload.config._lastUpdated` ou um `baseRemoteUpdatedAt`, não apenas o horário do envelope.
- Exigir confirmação/merge quando remoto for mais novo.
- Tornar whitelist de origem obrigatória no Worker publicado.
- Criar testes unitários do cliente e testes do Worker para conflito 409.

### AUD-006 - Extração de views está incompleta e cria módulos mortos

**Severidade:** P2  
**Área:** arquitetura, funções desconexas, testes falsamente verdes  
**Evidência:** `src/js/views.js:7`, `src/js/views.js:294`, `src/js/views/calendar-view.js:60`, `src/js/components.js:2`

`calendar-view.js` existe, mas o runtime usa `renderCalendar` de `views.js`. O arquivo extraído não é importado por `views.js` nem por `components.js`.

Consequências:

- Melhorias feitas em `calendar-view.js` não afetam o app.
- Testes de inline handlers escaneiam arquivos que não necessariamente rodam.
- A implementação real e a extraída podem divergir silenciosamente.

Exemplo: `calendar-view.js` ainda contém tabs como `div`, enquanto `views.js` contém botões semânticos.

### AUD-007 - Design system está marcado como concluído, mas CSP e inline styles continuam em estado legado

**Severidade:** P2  
**Área:** UI, CSS, CSP, manutenibilidade  
**Evidência:** `src/index.html:16`, métrica estática de 350 `style=`

O plano diz que a fase de design system foi concluída, mas ainda há:

- 350 ocorrências de `style=`
- `style-src 'unsafe-inline'` obrigatório no CSP
- estilos inline em `index.html`, `views.js`, `components.js`, `planejamento-wizard.js`, `home-view.js`, `editais-view.js`, `dashboard-view.js` e `banca-view.js`
- colisão concreta entre `components.css` e `styles.css` em `.empty-state`

Impacto:

- Refatoração visual sem fronteira clara.
- CSS por ordem de carregamento causa regressão.
- CSP ainda não pode ser endurecido para estilos.

### AUD-008 - Nem todas as superfícies clicáveis são semânticas ou acessíveis

**Severidade:** P2  
**Área:** acessibilidade, botões que parecem funcionar mas não têm contrato robusto  
**Evidência:** `src/js/views/dashboard-view.js:97`, `src/js/views/calendar-view.js:79`, `src/js/home-view.js` via `data-action` em `span`/`i`

Apesar de várias melhorias, ainda existem:

- tabs em `div` no dashboard de disciplina extraído
- `data-action` em `span` e `i`
- icon buttons sem `aria-label` em várias superfícies
- uso de `title` como substituto de nome acessível
- busca com resultados em `div`

Impacto:

- Teclado e leitor de tela inconsistentes.
- Fica difícil garantir "botão funciona" porque algumas ações dependem de eventos em elementos não interativos.

### AUD-009 - Documentação de progresso diverge do repositório

**Severidade:** P2  
**Área:** governança, planejamento  
**Evidência:** `src/docs/superpowers/plans/2026-04-18-app-maturity-implementation-plan.md:583`, `src/docs/superpowers/plans/2026-04-18-fase-progress.md:51`

Inconsistências encontradas:

- O plano principal diz `All tasks completed!`
- O arquivo de progresso diz que Fase 5 está em andamento e Fases 6, 7, 9 pendentes
- A lista de ordem recomendada duplica `Task 7`
- O plano cita `workers/sync-worker.js`, mas esse arquivo não existe
- `sync-contract.md` mistura "Current Model" antigo com alvo futuro já parcialmente implementado

Impacto:

- Próximos agentes podem confiar em progresso falso.
- Bugs são mascarados como "fase concluída".

### AUD-010 - Cobertura E2E é insuficiente para os fluxos críticos

**Severidade:** P2  
**Área:** QA, regressão  
**Evidência:** `tests/e2e/app.spec.js`

Os 2 testes E2E atuais não cobrem:

- estados vazios das telas
- navegação mobile
- botão Pomodoro/Contínuo
- busca global por teclado
- Ciclo de Estudos e wizard completo
- Inteligência de Banca
- Configurações
- Cloudflare sync
- Google Drive sync com mocks
- acessibilidade de modais/tabs

Resultado: `npm run test:e2e` passa enquanto regressões visíveis continuam presentes.

### AUD-011 - Ponte `window` expõe valores primitivos stale

**Severidade:** P2  
**Área:** arquitetura, estado global  
**Evidência:** `src/js/main.js:29`

O loop que copia exports para `window` copia valores primitivos uma vez. Funções continuam úteis, mas variáveis como `currentView` não acompanham a live binding do módulo.

No teste mobile exploratório, `#topbar-title` mudava corretamente, mas `window.currentView` permanecia `home`.

Impacto:

- Qualquer código que usa `window.currentView` toma decisão com estado antigo.
- O bridge fica perigoso: parece refletir o estado real, mas não reflete.

### AUD-012 - Precache do Service Worker não inclui todos os módulos novos

**Severidade:** P2  
**Área:** PWA, offline  
**Evidência:** `src/sw.js:5`

`ASSET_PATHS` inclui `views.js`, mas não inclui:

- `js/ui/actions.js`
- `js/ui/dialog.js`
- `js/ui/dom.js`
- `js/views/home-view.js`
- `js/views/calendar-view.js`
- `js/views/editais-view.js`
- `js/views/dashboard-view.js`
- `js/views/banca-view.js`

Alguns desses módulos podem ser cacheados por navegação online, mas não estão garantidos no app shell inicial.

Impacto:

- Offline-first fica dependente de o usuário ter carregado todos os módulos antes.
- O plano marcou PWA como "production-ready", mas o precache não acompanha a modularização.

### AUD-013 - Nomenclatura inconsistente aumenta risco de bugs

**Severidade:** P3  
**Área:** consistência, manutenção  
**Exemplos:**

- `editaId`, `editalId`, `editaId` em actions/views
- `revisoesFetas` provavelmente deveria ser `revisoesFeitas`
- `MED`, `Study Organizer`, `med`, `cronometro`, `cronoLivre`
- `cf*` em `state.config` versus `estudo_sync_creds` em `localStorage`
- `bancaRelevance.hotTopics` versus "Inteligência de Banca" versus "Hot Topics"

Impacto:

- Testes e handlers precisam conhecer várias grafias.
- Refactors ficam arriscados porque nomes parecidos não têm o mesmo contrato.

## Conclusão

O plano de maturidade anterior trouxe melhorias reais, mas foi marcado como concluído cedo demais. A codebase está em um estado intermediário: existem novas camadas (`ui/actions.js`, `ui/dialog.js`, `views/*`, CSS split), mas o runtime ainda mistura caminhos antigos e novos.

Prioridade recomendada:

1. Corrigir regressões P1 de UI/eventos/busca/banca/sync.
2. Transformar as reproduções desta auditoria em testes automatizados.
3. Só então retomar modularização e remoção de inline styles.

## Atualizacoes de implementacao

- 2026-04-19: a fatia de recuperacao 8 tornou `src/js/views/calendar-view.js` o owner runtime do calendario. `components.js` agora importa `renderCalendar` diretamente do modulo extraido, `main.js` expoe os exports de `calendar-view.js`, e os tabs de mes/semana de `calendar-view.js` usam `button type="button"` com semantica de tab.
