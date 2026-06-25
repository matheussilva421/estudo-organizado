# RC Producao e Pos-Refatoracao Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** estabilizar o app apos as refatoracoes de reducao de contexto, validar que ele esta pronto para producao com dados reais, publicar com seguranca e deixar a modularizacao de `logic.js`/`app.js` como fase pos-producao opcional.

**Architecture:** este plano separa o trabalho em dois trilhos. O trilho obrigatorio e RC/Release: nao refatorar mais, apenas provar comportamento real, cache, sync e preservacao de dados. O trilho opcional e pos-producao: modularizar `logic.js` e `app.js` somente depois de uma versao estavel estar publicada.

**Tech Stack:** vanilla HTML/CSS/JS ES modules, PWA/service worker, IndexedDB/local-first storage, Cloudflare/Firestore/Drive sync surfaces, Vitest, Playwright.

---

## Estado inicial esperado

Baseline conhecido em 2026-05-06:

- Branch: `main`
- Commit publicado: `1ae152e fix(ui): corrige codificacao do shell html`
- `src/sw.js`: `APP_VERSION = '8.54'`
- `src/css/styles.css`: ~2127 linhas
- `src/js/views.js`: ~503 linhas
- `src/js/logic.js`: ~1019 linhas
- `src/js/app.js`: ~533 linhas
- Ultimos gates conhecidos:
  - `npm run test:css`: 29/29 passando
  - `npm test`: 1295/1295 passando
  - `npm run test:e2e`: 142/142 passando
  - Validacao visual local: shell sem mojibake (`hasBadEncoding: false`)

Antes de executar qualquer passo, confirme se o repo ainda esta nesse estado ou registre divergencias:

```powershell
git status --short --branch
git rev-parse --short HEAD
rg -n "APP_VERSION = '" src\sw.js
(Get-Content src\css\styles.css | Measure-Object -Line).Lines
(Get-Content src\js\views.js | Measure-Object -Line).Lines
(Get-Content src\js\logic.js | Measure-Object -Line).Lines
(Get-Content src\js\app.js | Measure-Object -Line).Lines
```

---

## Regra de ouro para a proxima IA

**Nao modularizar mais nada antes da producao.**

Durante a RC, a IA so pode alterar:

- bugs bloqueantes encontrados nos fluxos reais;
- textos/codificacao quebrada;
- cache busting/service worker quando necessario;
- testes de regressao para bugs encontrados;
- documentacao de release/handoff.

Durante a RC, a IA nao deve:

- extrair mais CSS de `styles.css`;
- extrair funcoes de `logic.js`, `app.js`, `views.js` ou `components.js`;
- redesenhar UI;
- trocar arquitetura de sync;
- limpar dados reais;
- fazer reset, restore destrutivo ou migracao de IndexedDB sem backup e permissao explicita.

---

## Arquivos que podem mudar na RC

- `src/index.html`: somente se houver texto corrompido, cache busting ou shell quebrado.
- `src/sw.js`: somente para `APP_VERSION`/precache se uma correcao exigir cache novo.
- `src/js/**`: somente bugfix pequeno e localizado descoberto no fluxo real.
- `src/css/**`: somente bugfix visual bloqueante e localizado.
- `tests/unit/**`: adicionar regressao para bug encontrado.
- `tests/e2e/**`: adicionar ou ajustar teste se a falha real nao estiver coberta.
- `docs/**` e `src/docs/**`: atualizar resultados, riscos, rollback e handoff.

---

## Definition of Done da RC

- [ ] App abre localmente em perfil limpo sem texto corrompido.
- [ ] App abre com dados reais/antigos sem perda visivel.
- [ ] Salvar, recarregar, fechar e abrir preserva dados.
- [ ] Calendario, Editais, Sessoes, Habitos, Revisoes, Ciclo, Config e Busca funcionam no fluxo principal.
- [ ] Sync desligado/manual nao bloqueia uso local.
- [ ] Sync ligado, quando configurado, nao congela a UI e mostra status compreensivel.
- [ ] Service worker/cache usa `8.54` ou versao superior se houver bugfix.
- [ ] Desktop e mobile nao exibem mojibake, overflow horizontal ou controles inacessiveis no fluxo principal.
- [ ] `npm run test:css` passa.
- [ ] `npm test` passa.
- [ ] `npm run test:e2e` passa.
- [ ] Documentacao de RC atualizada.
- [ ] Commit e push realizados no GitHub.

---

## Task 0: Preparar ambiente e proteger dados

**Files:**
- Modify: nenhum arquivo obrigatorio.
- Optional docs: `docs/rc-producao-2026-05-06.md`

- [ ] **Step 0.1: Confirmar estado limpo**

Run:

```powershell
git status --short --branch
git log -3 --oneline
```

Expected:

- `main...origin/main`
- sem arquivos modificados antes da IA iniciar.

Se houver arquivos modificados, nao sobrescrever. Registrar no handoff e trabalhar apenas em cima do escopo aprovado.

- [ ] **Step 0.2: Confirmar baseline de versao/cache**

Run:

```powershell
rg -n "APP_VERSION = '8\.54'|v=8\.54" src\sw.js src\index.html tests\unit
```

Expected:

- `src/sw.js` contem `APP_VERSION = '8.54'`.
- `src/index.html` contem assets com `?v=8.54`.
- testes de contrato esperam `8.54`.

- [ ] **Step 0.3: Criar backup manual antes de testar dados reais**

No navegador do usuario, antes de qualquer teste com dados reais:

1. Abrir app atual.
2. Ir em Configuracoes/Backup.
3. Exportar JSON.
4. Confirmar que o arquivo foi baixado.
5. Registrar no handoff: nome do arquivo, data/hora e ambiente usado.

Nao importar, apagar, resetar ou limpar dados reais nesta task.

---

## Task 1: RC em perfil limpo

**Files:**
- Modify: somente se a validacao encontrar bug real.
- Test: `tests/e2e/smoke-critical.spec.js`, `tests/e2e/app.spec.js`

- [ ] **Step 1.1: Servir app local**

Run:

```powershell
npx http-server src -p 8090 -c-1
```

Expected:

- `http://127.0.0.1:8090` responde 200.

Se a porta estiver ocupada, usar `8091` e registrar a porta usada.

- [ ] **Step 1.2: Validar shell em perfil limpo**

Usar Playwright ou navegador real em perfil limpo/anomino.

Checklist visual:

- Sidebar mostra `Estudo Organizado`.
- Menu mostra `Pagina Inicial`, `Cronometro`, `Calendario`, `Revisoes`, `Historico`, `Habitos`, `Editais`, `Configuracoes`.
- Busca mostra placeholder legivel.
- Topbar mostra `Pagina Inicial`.
- Nenhum texto `Ã`, `Â`, `ðŸ`, `â€` aparece na primeira tela.

Comando Playwright sugerido:

```powershell
node -e "(async()=>{const { chromium }=await import('playwright'); const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1440,height:900}}); await page.goto('http://127.0.0.1:8090', {waitUntil:'load'}); const text=await page.locator('body').innerText(); const bad=/\u00c3[\u0080-\u00bf]|\u00c3\u0192|\u00c3\u201a|\u00f0\u0178|\u00e2[\u0080-\u009f]/.test(text); console.log(JSON.stringify({title:await page.title(), hasBadEncoding:bad, hasHome:text.includes('Página Inicial'), hasConfig:text.includes('Configurações')}, null, 2)); await browser.close();})()"
```

Expected JSON:

```json
{
  "title": "Estudo Organizado",
  "hasBadEncoding": false,
  "hasHome": true,
  "hasConfig": true
}
```

- [ ] **Step 1.3: Rodar smoke automatizado**

Run:

```powershell
npm run test:e2e -- tests/e2e/smoke-critical.spec.js
```

Expected:

- todos os testes do arquivo passam.

---

## Task 2: RC com dados reais/antigos

**Files:**
- Modify: somente se houver bug real com dados antigos.
- Docs: atualizar `docs/rc-producao-2026-05-06.md` ou `docs/handoff-reducao-contexto-codex.md`.

- [ ] **Step 2.1: Abrir app no perfil real do usuario**

Antes de qualquer acao:

- confirmar que o backup da Task 0 existe;
- nao clicar em limpar dados;
- nao importar backup por cima dos dados reais;
- nao desconectar contas/sync sem necessidade.

- [ ] **Step 2.2: Verificar preservacao de dados**

Checklist:

- Cards iniciais mostram dados esperados.
- Lista de disciplinas aparece.
- Editais e disciplinas antigos aparecem.
- Historico de sessoes aparece.
- Habitos aparecem.
- Configuracoes principais permanecem.

Registrar no handoff apenas evidencias nao sensiveis:

- contagens aproximadas;
- telas validadas;
- se houve ou nao perda visual de dados.

Nao copiar conteudo privado dos estudos para docs.

- [ ] **Step 2.3: Testar salvar, recarregar, fechar e abrir**

Fluxo:

1. Criar um evento de estudo pequeno de teste.
2. Confirmar toast/status de salvamento.
3. Recarregar a pagina.
4. Confirmar que o evento permanece.
5. Fechar aba.
6. Abrir novamente.
7. Confirmar que o evento permanece.
8. Remover o evento de teste, se o usuario autorizar.

Se o evento nao persistir:

- parar a RC;
- investigar `src/js/store.js`, `src/js/sync/*`, console do navegador e IndexedDB;
- adicionar teste de regressao antes do fix.

---

## Task 3: Validar fluxos principais como usuario real

**Files:**
- Modify: somente bugfix localizado.
- Test candidates:
  - `tests/e2e/app.spec.js`
  - `tests/e2e/crud-operations.spec.js`
  - `tests/e2e/full-study-flow.spec.js`
  - `tests/e2e/sessoes.spec.js`
  - `tests/e2e/revisoes-habitos.spec.js`
  - `tests/e2e/ciclo-grade.spec.js`
  - `tests/e2e/sync-dados.spec.js`

- [ ] **Step 3.1: Calendario**

Checklist manual:

- abrir Calendario;
- navegar mes anterior/proximo;
- criar evento por data;
- editar evento;
- excluir evento de teste;
- recarregar e confirmar persistencia antes da exclusao.

Automacao:

```powershell
npm run test:e2e -- tests/e2e/calendar.spec.js
```

- [ ] **Step 3.2: Editais**

Checklist manual:

- abrir Editais;
- expandir edital existente;
- criar edital de teste;
- criar disciplina de teste;
- criar assunto/aula de teste;
- editar um item;
- excluir itens de teste.

Automacao:

```powershell
npm run test:e2e -- tests/e2e/crud-operations.spec.js tests/e2e/editais.spec.js
```

- [ ] **Step 3.3: Sessoes e historico**

Checklist manual:

- iniciar estudo;
- registrar sessao manual ou via cronometro;
- confirmar historico;
- recarregar e confirmar historico.

Automacao:

```powershell
npm run test:e2e -- tests/e2e/sessoes.spec.js tests/e2e/timer-flow.spec.js
```

- [ ] **Step 3.4: Habitos e revisoes**

Checklist manual:

- abrir Habitos;
- criar/editar/remover habito de teste;
- abrir Revisoes;
- concluir uma revisao de teste ou validar estado vazio.

Automacao:

```powershell
npm run test:e2e -- tests/e2e/revisoes-habitos.spec.js tests/e2e/revision-flow.spec.js
```

- [ ] **Step 3.5: Ciclo e planejamento**

Checklist manual:

- abrir Ciclo;
- validar grade/ciclo existente;
- iniciar fluxo de planejamento sem concluir em dados reais, a menos que o usuario autorize;
- em perfil limpo, concluir wizard completo.

Automacao:

```powershell
npm run test:e2e -- tests/e2e/ciclo-grade.spec.js tests/e2e/ciclo-step-flow.spec.js tests/e2e/planejamento.spec.js
```

- [ ] **Step 3.6: Configuracoes e busca**

Checklist manual:

- abrir Configuracoes;
- validar tema;
- validar painel de backup/sync;
- usar busca global por disciplina e assunto;
- confirmar que resultados sao legiveis.

Automacao:

```powershell
npm run test:e2e -- tests/e2e/app.spec.js
```

---

## Task 4: Validar sync basico sem dor de cabeca

**Files:**
- Modify only if bug real:
  - `src/js/sync/*`
  - `src/js/cloud-sync.js`
  - `src/js/drive-sync.js`
  - `src/js/views/config/sync-center.js`
  - `src/js/views/config-view.js`

- [ ] **Step 4.1: Validar modo sync desligado/manual**

Checklist:

- App salva localmente sem exigir login.
- Status de sync nao bloqueia clique nem navegacao.
- Botao/indicador no topo nao fica em loop eterno que impeça uso.
- Recarregar preserva estado local.

Automacao:

```powershell
npm run test:e2e -- tests/e2e/manual-sync-ui.spec.js tests/e2e/sync-e2e.spec.js
```

- [ ] **Step 4.2: Validar sync configurado, se o usuario tiver ambiente pronto**

Somente executar com consentimento do usuario se envolver conta real.

Checklist:

- Ligar sync.
- Fazer uma edicao pequena.
- Confirmar status de salvamento local.
- Confirmar que sync nao congela a UI.
- Confirmar que erro remoto mostra acao clara, sem modal bloqueante.

Automacao simulada:

```powershell
npm run test:e2e -- tests/e2e/sync-simulation-expanded.spec.js tests/e2e/phase6-chaos-validation.spec.js
```

Se app congelar:

1. Nao refatorar.
2. Capturar console.
3. Verificar loops entre `stateSaved`, `app:firestoreSyncStatus`, render de config e auto-flush.
4. Criar teste minimo antes do fix.

---

## Task 5: Validar PWA, service worker e cache

**Files:**
- Modify:
  - `src/sw.js`
  - `src/index.html`
  - tests de contrato correspondentes

- [ ] **Step 5.1: Confirmar versao do shell**

Run:

```powershell
rg -n "APP_VERSION = '8\.54'|v=8\.54" src\sw.js src\index.html tests\unit
```

Expected:

- sem referencias antigas `8.53` ou `8.43` em `src/index.html`, `src/sw.js` e testes de contrato.

- [ ] **Step 5.2: Validar offline/cache automatizado**

Run:

```powershell
npm run test:e2e -- tests/e2e/offline-import.spec.js
```

Expected:

- offline reload funciona;
- alteracoes locais offline persistem;
- import invalido e rejeitado sem quebrar app.

- [ ] **Step 5.3: Validar producao depois do deploy**

Depois do deploy:

1. Abrir producao em aba anonima/perfil limpo.
2. Confirmar que `src/sw.js` da producao contem `APP_VERSION = '8.54'` ou superior.
3. Abrir app.
4. Confirmar que sidebar nao tem mojibake.
5. Recarregar.
6. Confirmar que a versao velha nao reaparece.

Se producao ainda servir versao velha:

- limpar cache do navegador;
- atualizar service worker;
- confirmar deploy;
- se necessario, bump para `8.55` com commit pequeno apenas de cache.

---

## Task 6: Gates finais antes de release

**Files:**
- Modify: docs de resultado.

- [ ] **Step 6.1: Rodar unitarios completos**

Run:

```powershell
npm test
```

Expected:

- 77 arquivos passando.
- 1295 testes ou mais passando.
- 0 failures.

- [ ] **Step 6.2: Rodar E2E release completo**

Run:

```powershell
npm run test:e2e
```

Expected:

- 142 testes ou mais passando.
- 0 failures.

- [ ] **Step 6.3: Atualizar handoff**

Atualizar ou criar um dos arquivos:

- `docs/handoff-reducao-contexto-codex.md`
- `docs/rc-producao-2026-05-06.md`

Registrar:

- commit base;
- versao `APP_VERSION`;
- comandos executados;
- resultados numericos;
- bugs encontrados e corrigidos;
- riscos restantes;
- se o app esta liberado para producao ou nao.

---

## Task 7: Release/Deploy

**Files:**
- Modify: somente docs se necessario.

- [ ] **Step 7.1: Escolher caminho de deploy**

Se o deploy for automatico por GitHub/main:

```powershell
git status --short --branch
git push origin main
```

Se o deploy for Cloudflare/Wrangler manual:

```powershell
npx wrangler deploy
```

Nao executar `wrangler deploy` se o usuario nao confirmou que este e o caminho de producao atual.

- [ ] **Step 7.2: Validar producao**

Checklist:

- URL de producao abre.
- `APP_VERSION` em producao e `8.54` ou superior.
- Sidebar/textos legiveis.
- Fluxo principal: abrir app, navegar, criar item pequeno, salvar, recarregar.
- Dados locais do usuario nao sumiram.
- Sync nao bloqueia uso local.

- [ ] **Step 7.3: Registrar rollback**

No handoff, registrar:

- commit de release;
- commit anterior estavel;
- comando para rollback via GitHub ou Cloudflare, conforme o ambiente;
- observacao de que backup JSON foi criado antes dos testes reais.

Rollback Git basico:

```powershell
git log --oneline -5
git revert <commit-problematico>
git push origin main
```

Nao usar `git reset --hard` para rollback de producao sem permissao explicita do usuario.

---

## Task 8: Pos-producao opcional - modularizar `logic.js`

**So iniciar depois da producao validada.**

**Goal:** reduzir `src/js/logic.js` sem mudar comportamento publico.

**Guardrails:**

- Manter `src/js/logic.js` como fachada publica durante toda a migracao.
- Cada extracao deve preservar exports existentes.
- Uma extracao por commit.
- Bump `APP_VERSION` apenas quando o modulo extraido for usado no browser runtime e afetar cache.
- Nao misturar com mudancas de produto.

**Candidatos de extracao, em ordem sugerida:**

1. Timer engine/utilitarios.
2. Regras de revisoes.
3. Ciclo/grade semanal.
4. Estatisticas/progresso.
5. Helpers puros de datas/tempo, se ainda estiverem em `logic.js`.

**Primeiro passo obrigatorio:**

```powershell
npm run test:unit -- tests/unit/logic.test.js tests/unit/logic-helpers.test.js tests/unit/logic-edge-cases.test.js
```

Expected:

- todos passam antes de tocar no arquivo.

**Template de extracao:**

1. Criar teste/import contract se faltar.
2. Mover um grupo coeso para `src/js/logic/<nome>.js`.
3. Re-exportar de `src/js/logic.js`.
4. Rodar testes de logic.
5. Rodar `npm test`.
6. Commit.

Nao fazer esta task na mesma sessao da RC.

---

## Task 9: Pos-producao opcional - modularizar `app.js`

**So iniciar depois da producao validada.**

**Goal:** reduzir `src/js/app.js` preservando bootstrap e contratos globais.

**Guardrails:**

- Nao mudar API publica de `window.EstudoApp` ou contratos usados por testes.
- Nao trocar dispatcher de acoes.
- Nao mudar semantica de tema/sync/status.
- Extrair primeiro codigo puro/isolado, nunca bootstrap critico.

**Candidatos de extracao, em ordem sugerida:**

1. Theme options/normalizacao de temas.
2. Registro de listeners globais.
3. Bootstrap de UI/status.
4. Helpers pequenos de navegacao, se isolados.

**Primeiro passo obrigatorio:**

```powershell
npm run test:unit -- tests/unit/app.test.js tests/unit/action-contracts.test.js tests/unit/navegacao-actions.test.js
```

Expected:

- todos passam antes de tocar no arquivo.

**Template de extracao:**

1. Criar/ajustar teste de contrato.
2. Criar `src/js/app/<nome>.js`.
3. Importar em `src/js/app.js`.
4. Preservar exports/side effects existentes.
5. Rodar testes focados.
6. Rodar `npm test`.
7. Rodar E2E de navegacao/smoke.
8. Commit.

Nao fazer esta task na mesma sessao da RC.

---

## Checklist para a proxima IA responder ao final

A resposta final da outra IA deve conter:

- Commit inicial e commit final.
- Se houve alteracao de codigo ou apenas validacao.
- Lista de arquivos alterados.
- Resultado de:
  - `npm run test:css`
  - `npm test`
  - `npm run test:e2e`
- Resultado da validacao visual:
  - perfil limpo;
  - dados reais/antigos;
  - mobile/desktop;
  - sync ligado/desligado;
  - service worker/cache.
- Declaracao clara:
  - `Liberado para producao` ou `Nao liberado para producao`.
- Riscos restantes.
- O que eu devo revisar quando voltar para o Codex.

---

## Prompt recomendado para a outra IA

```text
Leia e siga o plano em src/docs/superpowers/plans/2026-05-06-rc-producao-e-pos-refatoracao.md.

Objetivo: executar somente a Fase RC/Release obrigatoria. Nao modularize logic.js, app.js, views.js ou styles.css antes da producao. Corrija apenas regresses bloqueantes encontradas na validacao real.

Obrigatorio:
- proteger dados reais com backup antes de testar;
- validar perfil limpo e perfil com dados antigos;
- confirmar que nao ha mojibake;
- confirmar APP_VERSION/cache atual;
- validar sync basico;
- rodar npm run test:css, npm test e npm run test:e2e;
- atualizar documentacao;
- commit e push no GitHub.

Ao final, diga claramente se esta liberado para producao ou nao e documente riscos restantes.
```
