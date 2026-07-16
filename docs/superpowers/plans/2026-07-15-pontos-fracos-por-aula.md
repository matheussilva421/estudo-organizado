# Pontos Fracos por Aula — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A aba Pontos Fracos passa a ranquear aulas (em vez de tópicos/assuntos do edital), com fallback conservador tópico→aula quando o vínculo é único.

**Architecture:** Trocar o universo de buckets no núcleo puro `computeWeakPoints` (assuntos → aulas), mantendo o formato dos buckets para que view, memoização, filtros e média bayesiana continuem intactos. A view troca rótulos e passa o prefixo `aul_` já suportado pelo modal de estudo.

**Tech Stack:** Vanilla JS (ES modules), Vitest (jsdom), mock server local para validação manual.

**Spec:** `docs/superpowers/specs/2026-07-15-pontos-fracos-por-aula-design.md`

## Global Constraints

- `src/js/logic/weak-points.js` é módulo PURO: proibido qualquer `import` (teste-guarda existente).
- TDD rigoroso: teste primeiro, red confirmado, implementação mínima, green.
- Nunca editar fontes via PowerShell (corrompe UTF-8) — usar Edit/Write.
- Comentários em pt-BR no estilo dos vizinhos.
- Não carimbar `updatedAt` em derivações (anti ping-pong LWW) — este plano não toca em persistência.
- Campo de identidade do bucket: `aulaId`; campo do array na disciplina: `disc.aulas` (renomeado de `assuntos`).
- Novo contador no retorno: `naoMapeadas` = `{ total }` (questões com tópico existente mas sem aula mapeável); `orfaos` continua = referências mortas.

---

### Task 1: Núcleo `computeWeakPoints` por aula

**Files:**
- Modify: `src/js/logic/weak-points.js` (universo ~linhas 95-151, `registra` ~153-181, partição ~229-263)
- Test: `tests/unit/weak-points-core.test.js` (reescrever fixtures + casos)

**Interfaces:**
- Produces: `computeWeakPoints({...})` → `{ disciplinas, ranking, semQuestoes, orfaos, naoMapeadas }`.
  - Bucket de aula: `{ aulaId, nome, concluido (=aula.estudada), total, acertos, erros, taxa, taxaAjustada, faixa, confiavel, serie?, discId, discNome, editalId, editalNome, icone, cor }`.
  - Bucket de disciplina: campo `aulas: [bucket]` (antes `assuntos`), demais campos iguais; `naoAtribuidas` soma questões não mapeadas + órfãs.
  - `semQuestoes`: `[{ aulaId, nome, concluido, discId, discNome, editalId, editalNome }]`.

- [ ] **Step 1: Reescrever fixtures do teste core para aulas**

Em `tests/unit/weak-points-core.test.js`, `buildEditais()` passa a dar aulas a cada disciplina, com assuntos vinculados 1:1 (para os casos de fallback) e um assunto multi-aula (para o caso não-mapeável):

```js
function buildEditais() {
  return [
    createEdital({
      id: 'ed_1',
      nome: 'Edital 1',
      disciplinas: [
        createDisciplina({
          id: 'disc_1',
          nome: 'Direito Administrativo',
          aulas: [
            { id: 'aula_1', nome: 'Aula 01 — Licitações', estudada: false },
            { id: 'aula_2', nome: 'Aula 02 — Atos Administrativos', estudada: false },
          ],
          assuntos: [
            createAssunto({ id: 'ass_1', nome: 'Licitações', linkedAulaIds: ['aula_1'] }),
            createAssunto({ id: 'ass_2', nome: 'Atos Administrativos', linkedAulaIds: ['aula_2'] }),
            createAssunto({ id: 'ass_multi', nome: 'Misto', linkedAulaIds: ['aula_1', 'aula_2'] }),
          ],
        }),
        createDisciplina({
          id: 'disc_2',
          nome: 'Português',
          aulas: [{ id: 'aula_3', nome: 'Aula 03 — Crase', estudada: false }],
          assuntos: [createAssunto({ id: 'ass_3', nome: 'Crase', linkedAulaIds: ['aula_3'] })],
        }),
      ],
    }),
    createEdital({
      id: 'ed_2',
      nome: 'Edital 2',
      disciplinas: [
        createDisciplina({
          id: 'disc_3',
          nome: 'Informática',
          aulas: [{ id: 'aula_4', nome: 'Aula 04 — Redes', estudada: false }],
          assuntos: [createAssunto({ id: 'ass_4', nome: 'Redes', linkedAulaIds: ['aula_4'] })],
        }),
      ],
    }),
  ];
}

function findAula(result, aulaId) {
  return result.ranking.find((a) => a.aulaId === aulaId) || null;
}
```

Verificar se `createDisciplina`/`createAssunto` (tests/helpers/state-builders.js) aceitam `aulas`/`linkedAulaIds` via overrides (aceitam — spread). Adaptar TODOS os casos existentes mecanicamente: eventos continuam usando `assId`/`aulaId` como antes; expectativas passam de `findAssunto(result,'ass_X')` para `findAula(result,'aula_X')` (mapeamento 1:1 acima preserva os cenários). Casos que citam `semQuestoes` esperam `aulaId`s. O caso "topico com apenas aulaId resolve via linkedAulaIds" vira "aulaId direto resolve o bucket da aula" (sem depender de linkedAulaIds).

Casos NOVOS neste arquivo:

```js
describe('computeWeakPoints — universo por aula', () => {
  it('questão com aulaId conta direto na aula', () => {
    const ev = eventoEstudado({
      discId: 'disc_1',
      aulaId: 'aula_1',
      sessao: { questoes: { total: 10, acertos: 4, erros: 6 } },
    });
    const result = compute({ eventos: [ev] });
    expect(findAula(result, 'aula_1')).toMatchObject({ total: 10, taxa: 40 });
  });

  it('questão só com assId mapeia para a aula quando o vínculo é único', () => {
    const ev = eventoEstudado({
      discId: 'disc_1',
      assId: 'ass_1', // linkedAulaIds: ['aula_1']
      sessao: { questoes: { total: 10, acertos: 7, erros: 3 } },
    });
    const result = compute({ eventos: [ev] });
    expect(findAula(result, 'aula_1')).toMatchObject({ total: 10, taxa: 70 });
    expect(result.naoMapeadas.total).toBe(0);
  });

  it('assunto com 2+ aulas vinculadas NÃO mapeia: conta no total da matéria e em naoMapeadas', () => {
    const ev = eventoEstudado({
      discId: 'disc_1',
      assId: 'ass_multi',
      sessao: { questoes: { total: 8, acertos: 2, erros: 6 } },
    });
    const result = compute({ eventos: [ev] });
    const disc = result.disciplinas.find((d) => d.discId === 'disc_1');
    expect(disc.naoAtribuidas).toBe(8);
    expect(disc.total).toBe(8);
    expect(result.naoMapeadas.total).toBe(8);
    expect(result.orfaos.total).toBe(0); // assunto existe — não é órfão
    expect(result.ranking).toHaveLength(0);
  });

  it('assId morto continua sendo órfão (não conta em naoMapeadas)', () => {
    const ev = eventoEstudado({
      discId: 'disc_1',
      assId: 'ass_deletado',
      sessao: { questoes: { total: 10, acertos: 7, erros: 3 } },
    });
    const result = compute({ eventos: [ev] });
    expect(result.orfaos).toMatchObject({ total: 10 });
    expect(result.naoMapeadas.total).toBe(0);
  });

  it('badge concluido vem de aula.estudada', () => {
    const editais = buildEditais();
    editais[0].disciplinas[0].aulas[0].estudada = true;
    const ev = eventoEstudado({
      discId: 'disc_1',
      aulaId: 'aula_1',
      sessao: { questoes: { total: 10, acertos: 5, erros: 5 } },
    });
    const result = compute({ eventos: [ev], editais });
    expect(findAula(result, 'aula_1').concluido).toBe(true);
  });

  it('disciplina sem aulas não quebra e não gera buckets', () => {
    const editais = buildEditais();
    editais[0].disciplinas[0].aulas = [];
    const result = compute({ eventos: [], editais });
    const disc = result.disciplinas.find((d) => d.discId === 'disc_1');
    expect(disc.aulas).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar red**

Run: `npx vitest run tests/unit/weak-points-core.test.js --reporter=dot`
Expected: FAIL em massa (buckets ainda por assunto; `naoMapeadas` undefined).

- [ ] **Step 3: Implementar o universo por aula no núcleo**

Em `src/js/logic/weak-points.js`:

(a) Substituir o bloco que cria buckets de assunto (dentro do forEach de disciplinas) por:

```js
      const discBucket = {
        editalId: ed.id,
        editalNome: ed.nome,
        discId: disc.id,
        discNome: disc.nome,
        icone: disc.icone || '',
        cor: disc.cor || '',
        total: 0,
        acertos: 0,
        erros: 0,
        taxa: null,
        faixa: null,
        naoAtribuidas: 0,
        aulas: [],
      };
      discIndex.set(disc.id, discBucket);
      disciplinas.push(discBucket);
      (disc.aulas || []).forEach((aula) => {
        if (!aula || !aula.id) return;
        const bucket = {
          aulaId: aula.id,
          nome: aula.nome,
          concluido: !!aula.estudada,
          total: 0,
          acertos: 0,
          erros: 0,
          taxa: null,
          taxaAjustada: null,
          faixa: null,
          confiavel: false,
          discId: disc.id,
          discNome: disc.nome,
          editalId: ed.id,
          editalNome: ed.nome,
          icone: disc.icone || '',
          cor: disc.cor || '',
        };
        discBucket.aulas.push(bucket);
        aulaIndex.set(aula.id, bucket);
      });
      // Fallback tópico→aula: só quando o assunto tem exatamente 1 aula viva.
      (disc.assuntos || []).forEach((ass) => {
        if (!ass || !ass.id) return;
        knownAssIds.add(ass.id);
        const links = (ass.linkedAulaIds || []).filter((id) => id && aulaIndex.has(id));
        if (links.length === 1) assIndex.set(ass.id, aulaIndex.get(links[0]));
      });
```

Declarar antes do loop (substituindo os índices atuais):

```js
  const aulaIndex = new Map(); // aulaId -> bucket de aula
  const assIndex = new Map(); // assId -> bucket de aula (vínculo único)
  const knownAssIds = new Set(); // assuntos vivos do universo (p/ distinguir órfão)
  const discIndex = new Map();
  const disciplinas = [];
```

(b) `registra`: inverter a ordem de resolução (aula primeiro) e separar órfão de não-mapeada:

```js
  const orfaos = { total: 0, acertos: 0, erros: 0 };
  const naoMapeadas = { total: 0 };

  function registra(assId, aulaId, qs, evDiscId, studyDate) {
    if (!qs) return;
    let bucket = aulaId ? aulaIndex.get(aulaId) : null;
    if (!bucket && assId) bucket = assIndex.get(assId) || null;
    if (bucket) {
      // ... (bloco existente addTo + série semanal, inalterado)
      return;
    }
    // Sem aula identificável: só conta se a disciplina do evento está no universo
    const disc = evDiscId ? discIndex.get(evDiscId) : null;
    if (!disc) return;
    if (assId && knownAssIds.has(assId)) {
      naoMapeadas.total += qs.total; // tópico existe, mas sem aula vinculada única
    } else if (assId || aulaId) {
      addTo(orfaos, qs); // referência a assunto/aula que não existe mais
    }
    addTo(disc, qs);
    disc.naoAtribuidas += qs.total;
  }
```

(c) Partição/derivação: trocar `disc.assuntos.forEach` por `disc.aulas.forEach`; em `semQuestoes.push` trocar `assId: bucket.assId` por `aulaId: bucket.aulaId`; retorno final:

```js
  return { disciplinas, ranking, semQuestoes, orfaos, naoMapeadas };
```

(d) Atualizar o comentário de cabeçalho do arquivo e o JSDoc (`@returns`) para refletir agregação por AULA (fallback tópico→aula quando vínculo único).

- [ ] **Step 4: Rodar e confirmar green**

Run: `npx vitest run tests/unit/weak-points-core.test.js --reporter=dot`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/js/logic/weak-points.js tests/unit/weak-points-core.test.js
git commit -m "feat(pontos-fracos): nucleo agrega por aula (fallback topico->aula unico)"
```

---

### Task 2: Seeds da memoização

**Files:**
- Modify: `tests/unit/weak-points-memo.test.js` (fixture `buildArgs`)

**Interfaces:**
- Consumes: `computeWeakPoints` por aula (Task 1). O contrato da memoização não muda.

- [ ] **Step 1: Adaptar a fixture**

Em `buildArgs`, dar aula à disciplina e vincular o assunto (o evento usa `assId: 'ass_1'`):

```js
    editais: [
      createEdital({
        id: 'ed_1',
        disciplinas: [
          createDisciplina({
            id: 'disc_1',
            aulas: [{ id: 'aula_1', nome: 'Aula 01', estudada: false }],
            assuntos: [createAssunto({ id: 'ass_1', nome: 'Licitações', linkedAulaIds: ['aula_1'] })],
          }),
        ],
      }),
    ],
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run tests/unit/weak-points-memo.test.js --reporter=dot`
Expected: PASS (o caso "mesma chave" depende de `ranking` com 1 item — o vínculo único garante).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/weak-points-memo.test.js
git commit -m "test(pontos-fracos): memo seed com aula vinculada"
```

---

### Task 3: View por aula

**Files:**
- Modify: `src/js/views/pontos-fracos-view.js`
- Test: `tests/unit/views-modules.test.js` (describe `pontos-fracos view`)

**Interfaces:**
- Consumes: buckets por aula (Task 1): `disc.aulas`, `a.aulaId`, `result.naoMapeadas`.
- Produces: botão de estudo com `data-assunto-id="aul_<aulaId>"` (convenção já aceita por `addEventoParaAssunto` — ver uso em `src/js/views/dashboard-view.js:270`).

- [ ] **Step 1: Atualizar os testes da view (red)**

No describe `pontos-fracos view` de `tests/unit/views-modules.test.js`, atualizar `seedPontosFracos()`: disciplina ganha `aulas` (`aula_fraco/aula_forte/aula_pouco/aula_nunca`, nomes 'Aula — Licitações' etc.) e cada assunto ganha `linkedAulaIds` 1:1; eventos permanecem com `assId`. Ajustar asserções: nomes esperados passam a ser os das aulas; o teste de data-actions espera `data-assunto-id="aul_aula_fraco"`; adicionar asserção de que o HTML contém "aula(s)". Rodar:

Run: `npx vitest run tests/unit/views-modules.test.js --reporter=dot -t "pontos-fracos"`
Expected: FAIL (view ainda lê `disc.assuntos` e emite `assId`).

- [ ] **Step 2: Implementar a view**

Em `src/js/views/pontos-fracos-view.js`:

(a) `acaoBtn`:

```js
function acaoBtn(a) {
  return `<button type="button" class="btn btn-ghost btn-sm" data-action="add-evento-para-assunto"
    data-edital-id="${a.editalId}" data-disc-id="${a.discId}" data-assunto-id="aul_${a.aulaId}"
    title="Abrir o modal de estudo com esta aula pré-selecionada">
    <i class="fa fa-play"></i> Estudar / Agendar
  </button>`;
}
```

(b) `renderPontosFracos`: `grupos` mapeia `disc.aulas` (antes `disc.assuntos`):

```js
      assuntos: disc.aulas
        .filter((a) => a.total > 0)
```

(renomear a propriedade local para `aulas` e propagar em `discCard(g.disc, g.aulas, ...)`).

(c) `discCard`: subtítulo `"${assuntos.length} aula(s)"`; cabeçalho da aba: trocar o texto "Seus pontos fracos por taxa de acerto" por "Seus pontos fracos por aula — taxa de acerto".

(d) Rodapé: manter a nota de órfãos e adicionar, quando `result.naoMapeadas.total > 0`:

```js
  const naoMapeadasHtml =
    result.naoMapeadas.total > 0
      ? `<div class="text-sm text-muted mb-4">
          ℹ️ ${result.naoMapeadas.total} questões registradas por tópico do edital sem aula
          vinculada única foram contabilizadas apenas no total da matéria.
        </div>`
      : '';
```

(incluir `${naoMapeadasHtml}` no template final, após `${orfaosHtml}`).

(e) Comentário de cabeçalho do arquivo: "Ranking de AULAS por taxa de acerto…".

- [ ] **Step 3: Rodar e confirmar green**

Run: `npx vitest run tests/unit/views-modules.test.js --reporter=dot`
Expected: PASS (65+).

- [ ] **Step 4: Commit**

```bash
git add src/js/views/pontos-fracos-view.js tests/unit/views-modules.test.js
git commit -m "feat(pontos-fracos): view ranqueia aulas e agenda via aul_<id>"
```

---

### Task 4: Verificação integrada e publicação

**Files:**
- Modify: `docs/handoffs/handoff-2026-07-15-rf-timer-pontos-fracos-grid.md` (nova seção) ou novo handoff
- Modify: `.ai/runtime/sessions/<fingerprint>/pending.json`

- [ ] **Step 1: Suíte completa + lint**

Run: `npm test` e `npm run lint`
Expected: 0 falhas; 0 erros de lint. NÃO rodar `format:check` (falha ambiental CRLF no Windows).

- [ ] **Step 2: Validação manual no mock server**

Via preview (launch config `mock`): navegar a Pontos Fracos; injetar eventos com `aulaId` e com `assId` (vínculo único e múltiplo) via console; conferir: linhas são aulas; top 3 e expansão ok; botão "Estudar / Agendar" abre o modal com a aula pré-selecionada; nota de não-mapeadas aparece; filtros (edital/arquivados/período) seguem funcionando. Screenshot como prova.

- [ ] **Step 3: Handoff + commit + push**

Atualizar o handoff (o que mudou, decisões, testes, validação) e:

```bash
git add -A
git commit -m "docs(handoff): pontos fracos por aula"
git push
```
