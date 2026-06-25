# Context Budget Playbook

PolÃ­ticas de economia de contexto para o projeto estudo-organizado.

---

## Modo EconÃ´mico de Contexto

Para microalteraÃ§Ãµes e tarefas localizadas, siga estas regras:

### Limites de Leitura
- **MÃ¡ximo 3 arquivos** para micro-mudanÃ§as (texto, CSS, lÃ³gica isolada)
- Leia apenas arquivos diretamente relacionados + imports diretos
- NÃ£o varra o repositÃ³rio inteiro para mudanÃ§as localizadas

### Subagent Policy
- **NÃ£o use subagents por padrÃ£o**
- Subagent apenas quando:
  - UsuÃ¡rio solicitar explicitamente
  - Tarefas independentes existirem (2+ tarefas sem dependÃªncias compartilhadas)
- Cada subagent recebe uma pergunta pequena e fechada
- Explorer nunca edita arquivos
- Worker apenas edita arquivos atribuÃ­dos
- Worker **nunca** faz commit/push

### Formato de Resultado de Subagent
```
- Arquivos analisados: [lista]
- Descobertas: [resumo]
- RecomendaÃ§Ã£o: [aÃ§Ã£o]
- Riscos: [mÃ¡ximo 3]
```

### Exemplos de Prompt

**Bom:**
```
"Leia src/js/views/config-view.js e src/js/store.js.
Quais funÃ§Ãµes lidam com exportaÃ§Ã£o de dados?
Liste nomes e linhas."
```

**Ruim:**
```
"Explore o cÃ³digo e me diga tudo sobre como funciona
a exportaÃ§Ã£o de dados e quais sÃ£o as melhores prÃ¡ticas
e se hÃ¡ algum problema de seguranÃ§a."
```

### Testes e Logs
- **NÃ£o rode `npm test` no inÃ­cio** de micro-mudanÃ§as
- **NÃ£o rode E2E antes de testes focados**
- Rode primeiro o teste unitÃ¡rio especÃ­fico da Ã¡rea afetada
- Use logs resumidos no chat (nÃ£o cole outputs inteiros)
- Para debug, use flags controladas:
  ```js
  localStorage.setItem('debug:sync', 'true');
  ```

---

## PolÃ­tica de Subagents

### Quando Usar
| CenÃ¡rio | AÃ§Ã£o |
|---------|------|
| Micro-mudanÃ§a (1-3 arquivos) | **Sem subagent** |
| Bug em fluxo Ãºnico | **Sem subagent** |
| RefatoraÃ§Ã£o em mÃ³dulo isolado | **Sem subagent** |
| Feature nova com 3+ arquivos independentes | Subagent por arquivo |
| InvestigaÃ§Ã£o de bug em mÃºltiplas camadas | 1 subagent por camada |
| UsuÃ¡rio pede "explore X" | 1 subagent com pergunta fechada |

### Regras de ExecuÃ§Ã£o

**Explorer (leitura/investigaÃ§Ã£o):**
- Nunca edita arquivos
- Retorna: arquivos lidos, descobertas, recomendaÃ§Ã£o
- MÃ¡ximo 5 arquivos por exploraÃ§Ã£o
- Timeout: 60s por tarefa

**Worker (ediÃ§Ã£o/execuÃ§Ã£o):**
- Edita apenas arquivos atribuÃ­dos
- NÃ£o commita, nÃ£o faz push
- NÃ£o roda E2E completo
- Reporta: arquivos modificados, diff resumido, riscos

### Template de Tarefa para Subagent
```
Tarefa: [descriÃ§Ã£o em 1 frase]
Arquivos alvo: [lista mÃ¡xima de 5]
EntregÃ¡vel: [lista de 1-3 itens]
RestriÃ§Ãµes: [o que NÃƒO fazer]
```

### Anti-PadrÃµes
- âŒ Subagent para ler 1 arquivo
- âŒ Subagent para editar sem revisÃ£o humana
- âŒ Subagent para commit/push
- âŒ Subagent com pergunta aberta ("me explique o cÃ³digo")
- âŒ MÃºltiplos subagents com dependÃªncias sequenciais

---

## Matriz de Testes

Use testes proporcionais ao risco da mudanÃ§a.

| Tipo de MudanÃ§a | Escopo | Testes ObrigatÃ³rios | E2E |
|-----------------|--------|---------------------|-----|
| **Texto pequeno** | 1 arquivo | RevisÃ£o manual ou teste unitÃ¡rio relacionado | âŒ |
| **CSS visual** | 1-2 arquivos CSS | `npm run test:css` ou revisÃ£o manual | âŒ |
| **Tela isolada** | View especÃ­fica | Teste unitÃ¡rio da view | E2E apenas da tela afetada |
| **Fluxo cross-view** | 2+ views | Testes unitÃ¡rios focados + E2E do fluxo | E2E especÃ­fico do fluxo |
| **Sync/salvamento/PWA** | store.js, sync/, cloud-sync.js | `npm test` + testes de sync | E2E de sync (sucesso + falha) |
| **LÃ³gica de domÃ­nio** | logic.js, relevance.js | `npm test` (testes unitÃ¡rios) | âŒ (a menos que afete UI) |
| **ConfiguraÃ§Ãµes** | config-view.js, actions/config.js | `npm run test:config` | âŒ |
| **Fechamento/Release** | MÃºltiplos arquivos | `npm test` + E2E relevante | E2E completo com justificativa |

### Comandos de Teste

```powershell
# UnitÃ¡rios especÃ­ficos
npm run test:config
npm run test:sync
npm run test:views
npm run test:css

# E2E focado
npm run test:e2e:quick -- tests/e2e/<arquivo>.spec.ts
npm run test:e2e:release  # gate principal

# E2E completo (apenas no fechamento)
npm run test:e2e
npm run test:all  # unitÃ¡rios + E2E
```

### CritÃ©rios para E2E Completo

Rode `npm run test:e2e` completo **apenas** quando:

1. âœ… MudanÃ§a afeta **3+ views** diferentes
2. âœ… AlteraÃ§Ã£o em **PWA/offline** (Service Worker, manifest)
3. âœ… MudanÃ§a em **sync** (Firestore, Cloudflare, Drive)
4. âœ… RefatoraÃ§Ã£o de **arquivo core** (store.js, main.js, app.js)
5. âœ… **Release** ou pedido explÃ­cito do usuÃ¡rio

### Fechamento (Closure Mode)

Quando usuÃ¡rio pede para finalizar, publicar ou validar:

1. `git diff --stat` â€” revise escopo
2. Testes especÃ­ficos da Ã¡rea afetada
3. `npm test` â€” suÃ­te unitÃ¡ria completa
4. E2E se: UI flow, sync, PWA, ou layout visÃ­vel
5. Commit convencional escopado
6. Push apenas se solicitado

---

## ReferÃªncias

- `AGENTS.md` â€” regras essenciais do repositÃ³rio
- `README_DEV.md` â€” mapa de arquivos e matriz de escopo
- `src/docs/` â€” documentaÃ§Ã£o tÃ©cnica e arquitetura
