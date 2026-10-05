# Importação de Edital JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a issue #100: importar edital estruturado em JSON com preview, escolha explícita de destino, matching seguro, merge aditivo, preservação de progresso, atomicidade e idempotência no mesmo destino.

**Architecture:** Um núcleo puro em `src/js/logic/edital-import-core.js` valida/canonicaliza o payload, resolve proveniência/candidatos, constrói um `importPlan`, detecta stale preview e aplica o plano sem mutar a entrada. A UI em `src/js/views/edital-import.js` mantém apenas um draft efêmero do modal, recalcula o plano quando o destino muda e somente commita `state.editais` depois que o apply puro termina com sucesso.

**Tech Stack:** JavaScript ES modules, IndexedDB/store existente, Vitest, Playwright, CSS modular existente, PWA/service worker.

**Spec:** `docs/superpowers/specs/2026-10-05-edital-json-import-design.md`

## Global Constraints

- `versao === 1` e `tipo === "edital"`.
- Editais arquivados nunca são alvo de merge.
- Matching interno é restrito ao edital destino.
- Regra determinística em disciplina/tópico/aula: 0 → `CREATE`, 1 → `REUSE`, 2+ → `CREATE_CONFLICT`.
- `REUSE` nunca sobrescreve progresso ou conteúdo da entidade existente.
- Importação não altera eventos, histórico, hábitos, revisões, planejamento, Reta Final ou configurações.
- Create mode inicia com “Tornar principal” desmarcado quando já existe principal; sem principal existente, o novo edital deve obrigatoriamente virar principal.
- Reimportação com merge no mesmo destino é idempotente; escolher create novamente permite duplicação deliberada.
- Nenhuma dependência nova.
- Não usar o restore/backup genérico nem `setState(..., { merge: true })`.
- Não importar `reta-final-core.js` só para compartilhar normalização.
- Manter os specifiers congelados `?v=8.37`; cache bump do app segue o mecanismo automático existente.
- Antes do primeiro commit que toque `src/`, verificar `git config core.hooksPath`; se não for `.githooks`, executar `npm run prepare`.

## Review Focus

1. **Duplicatas dentro do próprio JSON:** duas disciplinas/tópicos/aulas com o mesmo nome normalizado devem ser canonicalizadas em uma única entrada importável, preservando a primeira grafia e unindo filhos sem duplicar — coberto na Task 1.
2. **Sem edital principal existente:** create mode não pode criar apenas um arquivado e deixar zero principais; deve forçar o novo como principal — coberto nas Tasks 2, 3 e 4.
3. **Mais de um candidato ativo transitório:** nunca escolher silenciosamente; UI deve exigir alvo explícito ou manter create como opção segura — coberto nas Tasks 1, 2 e 4.
4. **Stale preview seletivo:** mudança na árvore do edital alvo invalida; mudança em eventos/hábitos ou em edital não relacionado não invalida — coberto na Task 2.
5. **Proveniência apontando para arquivado:** pode aparecer como informação, mas jamais torna o arquivado selecionável para merge — coberto nas Tasks 1 e 4.

---

## File Structure

### Criar

- `src/js/logic/edital-import-core.js` — núcleo puro: validação, canonicalização, identidade, candidatos, import plan, stale guard e apply imutável.
- `src/js/views/edital-import.js` — file picker, draft efêmero, preview, seleção de destino e commit no store.
- `src/css/views/edital-import.css` — layout do preview, badges, conflitos e estados responsivos.
- `tests/unit/edital-import-core.test.js` — contratos do núcleo puro.
- `tests/unit/edital-import-view.test.js` — comportamento do modal/orquestração.
- `tests/e2e/edital-import.spec.js` — critérios de aceite de ponta a ponta.

### Modificar

- `src/js/ui/actions/editais.js` — action `open-edital-import`.
- `src/js/components.js` — botão no topbar de Editais.
- `src/js/views/editais-view.js` — botão no empty state.
- `src/css/views.css` — importar `edital-import.css`.
- `src/sw.js` — precache do novo JS/CSS, sem alterar specifiers `?v=8.37`.
- `tests/unit/editais-actions.test.js` — registro/dispatch da nova action.
- `tests/unit/editais-view-render.test.js` — affordance no empty state.
- testes arquiteturais/cache apenas se exigidos pelo comportamento atual do repositório.

---

### Task 1: Contratos puros — validação, canonicalização e proveniência

**Files:**
- Create: `src/js/logic/edital-import-core.js`
- Create: `tests/unit/edital-import-core.test.js`

**Interfaces:**
- Produces:
  - `normalizeEditalImportName(name) -> string`
  - `validateEditalImportPayload(payload) -> { valid: boolean, errors: string[] }`
  - `canonicalizeEditalImportPayload(payload) -> CanonicalPayload`
  - `buildEditalSourceIdentity(payload) -> SourceIdentity`
  - `findEditalImportCandidates(payload, editais) -> { active: Candidate[], archived: Candidate[] }`

- [ ] **Step 1: Write failing validation tests**

Adicionar testes com nomes explícitos para:
- payload válido;
- payload não objeto;
- `versao !== 1`;
- `tipo !== "edital"`;
- nome vazio;
- disciplinas vazias;
- disciplina sem nome;
- `topicos`/ `aulas` presentes mas não-array;
- tópico/aula sem `nome`;
- campos extras tolerados;
- payload original não mutado.

Run: `npx vitest run tests/unit/edital-import-core.test.js`  
Expected: FAIL porque o módulo/funções ainda não existem.

- [ ] **Step 2: Implement validation + name normalization**

Implementar as assinaturas acima em `edital-import-core.js`, sem imports de store/DOM.

Normalização deve equivaler a lowercase + NFD + remoção de diacríticos + colapso de espaços + trim.

Run: `npx vitest run tests/unit/edital-import-core.test.js`  
Expected: validação/normalização PASS.

- [ ] **Step 3: Write failing canonicalization tests**

Cobrir:
- duas disciplinas do payload com a mesma chave normalizada viram uma disciplina canônica;
- tópicos/aulas duplicados dentro da disciplina viram um só;
- filhos de entradas duplicadas são unidos;
- primeira grafia não vazia é preservada;
- ordem da primeira ocorrência é preservada;
- payload original permanece intacto.

- [ ] **Step 4: Implement `canonicalizeEditalImportPayload(payload)`**

Canonicalizar somente após payload validado. `topicos` e `aulas` omitidos viram arrays vazios no canônico.

Run: `npx vitest run tests/unit/edital-import-core.test.js`  
Expected: PASS.

- [ ] **Step 5: Write failing source identity/candidate tests**

Fixar:
- prioridade `centralId` > `sourceRef` > nome normalizado;
- `sourceRevision` não participa da identidade;
- fingerprint determinístico no formato `edital:v1|<identity-kind>:<canonical-value>`;
- mesmo conteúdo lógico com whitespace/ordem de propriedades diferente produz a mesma identidade;
- candidato ativo por nome/proveniência aparece em `active`;
- correspondente arquivado aparece somente em `archived`;
- 2 candidatos ativos são devolvidos como 2 candidatos, sem “winner” automático.

- [ ] **Step 6: Implement identidade e candidatos**

`Candidate` deve conter ao menos:
`{ editalId, nome, archived, reasons: string[], previousRevision: string|null }`.

A função não deve mutar `editais`.

Run: `npx vitest run tests/unit/edital-import-core.test.js`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/js/logic/edital-import-core.js tests/unit/edital-import-core.test.js
git commit -m "feat(edital-import): add pure validation and source identity"
```

---

### Task 2: Matching, import plan e stale signature

**Files:**
- Modify: `src/js/logic/edital-import-core.js`
- Modify: `tests/unit/edital-import-core.test.js`

**Interfaces:**
- Consumes: funções da Task 1.
- Produces:
  - `buildEditalImportPlan({ payload, editais, destination }) -> ImportPlan`
  - `buildEditalImportTargetSignature(editais, destination) -> string|null`
  - `isEditalImportPlanCurrent(plan, editais) -> boolean`

`destination`:
```js
{
  mode: 'merge' | 'create',
  editalId: string | null,
  makePrincipal: boolean
}
```

- [ ] **Step 1: Write failing matching tests**

Cobrir separadamente:
- disciplina 0/1/2+;
- tópico 0/1/2+ dentro de disciplina `REUSE`;
- aula 0/1/2+ dentro de disciplina `REUSE`;
- disciplina `CREATE` ou `CREATE_CONFLICT` faz todos os filhos serem `CREATE`;
- homônimo em outro edital nunca é reutilizado;
- edital arquivado não pode ser `destination.mode='merge'`;
- target id inexistente falha de forma explícita;
- create mode gera todos os itens como create.

- [ ] **Step 2: Implement `buildEditalImportPlan`**

O plano deve conter:
- `source`;
- `destination`;
- `targetSignature`;
- `disciplinas[]` com `action`, `existingId`, `topicos[]`, `aulas[]`;
- `conflicts[]`;
- `summary`.

Se não houver nenhum edital ativo e `mode==='create'`, normalizar `destination.makePrincipal` para `true` e registrar `principalForced: true` no plano.

Run: `npx vitest run tests/unit/edital-import-core.test.js`  
Expected: matching PASS.

- [ ] **Step 3: Write failing stale-signature tests**

Cobrir:
- renomear/adicionar/remover disciplina no target → stale;
- mudar tópicos/aulas do target → stale;
- arquivar o target → stale;
- remover target → stale;
- alterar `eventos`, hábitos ou outro edital fora do target não altera a assinatura;
- create + `makePrincipal=true`: mudança no conjunto de editais ativos invalida;
- create + `makePrincipal=false` com principal existente: alteração estrutural em outro edital não precisa invalidar;
- ausência de principal força principal e passa a observar o conjunto ativo.

- [ ] **Step 4: Implement assinatura mínima relevante**

A assinatura de merge deve serializar deterministicamente somente:
- target id/arquivado/nome normalizado;
- ids + nomes normalizados das disciplinas;
- ids + nomes normalizados de assuntos/aulas.

Para create que mudará principal, incluir os ids/flags dos editais atualmente ativos.

Run: `npx vitest run tests/unit/edital-import-core.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/js/logic/edital-import-core.js tests/unit/edital-import-core.test.js
git commit -m "feat(edital-import): build safe import plans"
```

---

### Task 3: Apply imutável, preservação, principal único e idempotência

**Files:**
- Modify: `src/js/logic/edital-import-core.js`
- Modify: `tests/unit/edital-import-core.test.js`

**Interfaces:**
- Consumes: `ImportPlan` da Task 2.
- Produces:
  - `applyEditalImport(editais, plan, { uid, now }) -> { editais: object[], result: ApplyResult }`

`uid` é função injetada sem argumentos; `now` é ISO string injetada.

- [ ] **Step 1: Write failing apply/preservation tests**

Fixar que:
- função não muta `editais` de entrada;
- `REUSE` mantém disciplina/assunto/aula existentes com todos os campos de progresso intactos;
- assunto novo usa `id: 'ass_' + uid()`, `concluido:false`, `dataConclusao:null`, `revisoesFetas:[]`, `adiamentos:0`, `linkedAulaIds:[]`;
- aula nova usa `id: 'aula_' + uid()`, `descricao:''`, `estudada:false`, `dataEstudo:null`, `progress:0`, `linkedAssuntoIds:[]`;
- disciplina nova usa `id: uid()`, `icone:'📚'`, `cor` do edital destino quando merge, com fallback `'#0f766e'`, `assuntos:[]`, `aulas:[]`;
- edital novo usa `id: uid()`, nome do payload, `cor:'#0f766e'`, `disciplinas:[]`, `arquivado` conforme destino e metadados de importação.

- [ ] **Step 2: Implement criação e merge aditivo**

Nunca usar spread do payload sobre entidade `REUSE`.

Em merge, atualizar somente `edital.importMetadata` com proveniência e `lastImportedAt: now`.

Run: `npx vitest run tests/unit/edital-import-core.test.js`  
Expected: PASS.

- [ ] **Step 3: Write failing principal/atomicity tests**

Cobrir:
- create + `makePrincipal=false` com principal existente → novo arquivado, principal antigo intacto;
- create + `makePrincipal=true` → novo ativo, todos os anteriores ativos arquivados, dados preservados;
- create sem principal existente → novo ativo mesmo se caller passou false;
- plan stale → lança erro antes de qualquer resultado mutável;
- erro de geração de ID no meio do apply → entrada original continua byte-for-byte igual.

- [ ] **Step 4: Implement stale guard e principal único**

Validar `isEditalImportPlanCurrent` antes de criar qualquer entidade no clone retornável.

Run: `npx vitest run tests/unit/edital-import-core.test.js`  
Expected: PASS.

- [ ] **Step 5: Write failing idempotency tests**

Cenário:
1. build plan merge;
2. apply;
3. build novo plan contra resultado;
4. apply de novo.

Assert:
- mesmos totais de editais/disciplinas/assuntos/aulas;
- segundo plano reporta 0 criações para conteúdo já importado;
- progresso do seed permanece igual;
- `lastImportedAt` pode mudar.

Teste separado: create novamente gera novo edital deliberadamente.

- [ ] **Step 6: Make idempotency tests green**

Ajustar apenas o necessário no core.

Run: `npx vitest run tests/unit/edital-import-core.test.js`  
Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
git add src/js/logic/edital-import-core.js tests/unit/edital-import-core.test.js
git commit -m "feat(edital-import): apply plans atomically"
```

---

### Task 4: Modal de preview e orquestração do store

**Files:**
- Create: `src/js/views/edital-import.js`
- Create: `src/css/views/edital-import.css`
- Create: `tests/unit/edital-import-view.test.js`
- Modify: `src/css/views.css`
- Modify: `src/sw.js`

**Interfaces:**
- Consumes:
  - `validateEditalImportPayload`
  - `findEditalImportCandidates`
  - `buildEditalImportPlan`
  - `applyEditalImport`
  - `state`, `scheduleSave`, `uid`, `invalidateDiscCache`, `invalidateDashCaches`, modal/toast/render existentes.
- Produces:
  - `openEditalImport() -> void`
  - `openEditalImportPreview(payload) -> boolean`
  - `setEditalImportDestination({ mode, editalId?, makePrincipal? }) -> boolean`
  - `confirmEditalImport() -> boolean`
  - `getEditalImportDraft() -> object|null` somente para testes/inspeção.

- [ ] **Step 1: Write failing view tests for file/validation**

Mockar DOM mínimo do `#modal-prompt` e store.

Cobrir:
- file picker aceita `.json`;
- JSON malformado mostra toast e não abre preview;
- schema inválido mostra primeiro erro e não muta state;
- payload válido cria draft e abre preview;
- archived provenance aparece como informativa, não como target selecionável.

- [ ] **Step 2: Implement open/parse/preview skeleton**

Usar `FileReader`/picker local e `addEventListener`; nenhum backend.

Renderizar no preview:
- nome/revisão;
- candidatos ativos;
- merge/create;
- summary;
- badges `reuse/create/conflict`;
- aviso de preservação.

Run: `npx vitest run tests/unit/edital-import-view.test.js`  
Expected: primeiros testes PASS.

- [ ] **Step 3: Write failing destination-interaction tests**

Cobrir:
- exatamente 1 candidato ativo: merge pode ser a escolha inicial, mas create permanece disponível;
- 2+ candidatos ativos: nenhum target é escolhido silenciosamente; usuário precisa selecionar o alvo para merge;
- alternar merge → create recalcula summary para 0 reutilizados;
- create com principal existente mostra checkbox desmarcado;
- create sem principal mostra `makePrincipal=true` forçado e controle desabilitado/informativo;
- marcar principal atualiza warning de arquivamento.

- [ ] **Step 4: Implement draft/re-render determinístico**

Toda mudança de destino deve chamar novamente `buildEditalImportPlan` sem alterar `state`.

O draft deve sempre guardar o `importPlan` correspondente ao preview atualmente visível.

Run: `npx vitest run tests/unit/edital-import-view.test.js`  
Expected: PASS.

- [ ] **Step 5: Write failing confirm/orchestration tests**

Cobrir:
- confirmação aplica o plano exibido, substitui somente `state.editais`, invalida caches, agenda save, fecha modal e renderiza;
- `state.eventos`, `habitos`, `revisoes`, `config` e `planejamento` permanecem deep-equal;
- stale plan mostra mensagem e não commita;
- erro de apply mostra erro e não commita;
- toast final diferencia merge de create.

- [ ] **Step 6: Implement confirmação**

Chamar:
```js
const { editais: nextEditais } = applyEditalImport(state.editais, draft.importPlan, {
  uid,
  now: new Date().toISOString(),
});
state.editais = nextEditais;
```

Só depois do retorno bem-sucedido:
`invalidateDiscCache()`, `invalidateDashCaches()`, `scheduleSave()`, fechar modal, renderizar e toast.

Run: `npx vitest run tests/unit/edital-import-view.test.js tests/unit/edital-import-core.test.js`  
Expected: PASS.

- [ ] **Step 7: Add focused CSS and precache**

Adicionar `edital-import.css` a `views.css` e os novos assets ao precache do `sw.js`.

CSS deve cobrir:
- summary;
- radios/targets;
- árvore de disciplinas;
- badges;
- warning;
- scroll;
- mobile sem overflow horizontal.

Não reutilizar classes `rf-*` da Reta Final.

Run: `npm run test:css`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/js/views/edital-import.js src/css/views/edital-import.css src/css/views.css src/sw.js tests/unit/edital-import-view.test.js
git commit -m "feat(edital-import): add preview and atomic confirmation"
```

---

### Task 5: Entrada na UI e action de Editais

**Files:**
- Modify: `src/js/ui/actions/editais.js`
- Modify: `src/js/components.js`
- Modify: `src/js/views/editais-view.js`
- Modify: `tests/unit/editais-actions.test.js`
- Modify: `tests/unit/editais-view-render.test.js`

**Interfaces:**
- Consumes: `openEditalImport()` da Task 4.
- Produces: action pública `open-edital-import`.

- [ ] **Step 1: Write failing action test**

Em `editais-actions.test.js`:
- esperar registro de `open-edital-import`;
- invocar handler;
- mockar import/módulo de forma consistente com o padrão do arquivo e verificar `openEditalImport()`.

Run: `npx vitest run tests/unit/editais-actions.test.js`  
Expected: FAIL.

- [ ] **Step 2: Register action**

Em `ui/actions/editais.js`, usar import dinâmico de `../../views/edital-import.js?v=8.37` e retornar a Promise para manter o handler awaitable em testes.

Run: `npx vitest run tests/unit/editais-actions.test.js`  
Expected: PASS.

- [ ] **Step 3: Write failing UI affordance tests**

Cobrir:
- empty state contém `data-action="open-edital-import"`;
- topbar de Editais sem dashboard de disciplina contém botão “Importar Edital” junto de “Novo Edital”.

Se `components.js` já tiver teste de topbar apropriado, estender esse teste; caso contrário criar caso mínimo no arquivo unitário mais próximo sem criar suíte redundante.

- [ ] **Step 4: Add buttons**

No topbar:
```text
[Importar Edital] [Novo Edital]
```

No empty state:
```text
[Criar Edital] [Importar Edital (JSON)]
```

Manter `open-edital-modal` intacto.

Run: `npx vitest run tests/unit/editais-actions.test.js tests/unit/editais-view-render.test.js` + teste de components selecionado.  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/js/ui/actions/editais.js src/js/components.js src/js/views/editais-view.js tests/unit/editais-actions.test.js tests/unit/editais-view-render.test.js
git commit -m "feat(editais): expose JSON edital import"
```

---

### Task 6: E2E dos critérios de aceite

**Files:**
- Create: `tests/e2e/edital-import.spec.js`

**Interfaces:**
- Consumes: feature completa das Tasks 1–5.
- Produces: cobertura Playwright da issue #100.

- [ ] **Step 1: Add E2E fixture helpers in the spec**

Criar helpers locais:
- `editalPayload(overrides={})`;
- função que abre Editais, aciona `open-edital-import` e usa `setInputFiles`;
- snapshot de contagens/progresso.

Não alterar helpers globais se não for necessário.

- [ ] **Step 2: Add failing happy-path/create tests**

Cenários:
1. novo edital com principal existente + checkbox desmarcado → novo arquivado, principal intacto;
2. novo edital + checkbox marcado → novo principal, anterior arquivado;
3. sem principal existente → novo vira principal obrigatoriamente.

Run: `npx playwright test tests/e2e/edital-import.spec.js --project=chromium --reporter=line --workers=1`  
Expected antes dos ajustes finais: pelo menos um FAIL que prove o caminho ainda não fechado.

- [ ] **Step 3: Make create E2E green**

Ajustar apenas feature/importador.

Run mesma command.  
Expected: cenários create PASS.

- [ ] **Step 4: Add merge/preservation/conflict E2E**

Cobrir:
- merge parcial com itens reuse + create no preview;
- assunto concluído e aula estudada continuam intactos;
- duas disciplinas homônimas → preview `conflito`, nova disciplina criada, antigas intactas;
- schema inválido → sem preview/sem mutação.

- [ ] **Step 5: Add reimportation E2E**

Cobrir:
- importar + merge de novo → zero duplicatas;
- reimportar e escolher create → novo edital permitido;
- revisão/proveniência anterior e atual aparece no preview quando disponível.

Run: `npx playwright test tests/e2e/edital-import.spec.js --project=chromium --reporter=line --workers=1`  
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/edital-import.spec.js
git commit -m "test(edital-import): cover JSON import end to end"
```

---

### Task 7: Regressão, qualidade e fechamento

**Files:**
- Modify only if verification finds a feature-local defect.
- Do not make unrelated refactors.

**Interfaces:**
- Consumes: implementation complete.
- Produces: verified branch ready for review/merge.

- [ ] **Step 1: Run focused unit suite**

```bash
npx vitest run   tests/unit/edital-import-core.test.js   tests/unit/edital-import-view.test.js   tests/unit/editais-actions.test.js   tests/unit/editais-view-render.test.js
```

Expected: PASS.

- [ ] **Step 2: Run focused E2E**

```bash
npx playwright test tests/e2e/edital-import.spec.js --project=chromium --reporter=line --workers=1
```

Expected: PASS.

- [ ] **Step 3: Run static/design gates**

```bash
npm run lint
npm run test:design
npm run bump:check
```

Expected: PASS. Não “corrigir” CRLF com `prettier --write` em massa.

- [ ] **Step 4: Run full unit suite**

```bash
npm test
```

Expected: PASS, ou documentar separadamente qualquer falha comprovadamente pré-existente antes de prosseguir.

- [ ] **Step 5: Run release E2E**

```bash
npm run test:e2e:release
```

Expected: PASS, ou isolar com evidência qualquer falha pré-existente.

- [ ] **Step 6: Verify source invariants**

Checar explicitamente:
- nenhum `?v=8.37` de import ES foi alterado;
- novo JS/CSS está no precache;
- importação não escreve fora de `state.editais`;
- nenhum `Object.assign(existing, imported)` / spread do payload em `REUSE`;
- `git diff` não contém refatoração alheia à #100.

- [ ] **Step 7: Final commit only if verification required fixes**

```bash
git add <feature-local-files>
git commit -m "fix(edital-import): address verification findings"
```

Se não houve correção, não criar commit vazio.

- [ ] **Step 8: Record final evidence**

Antes de declarar conclusão, aplicar `superpowers:verification-before-completion` e registrar:
- HEAD;
- comandos executados;
- totais de testes;
- eventuais skips conhecidos;
- status da issue #100;
- qualquer follow-up conscientemente deixado fora de escopo.
