# Reta Final (ciclo de emergência) + Registro de Sessão Multi-Tópico — Plano em Fases

## Contexto

Duas features novas:

1. **Reta Final**: importar um JSON com cronograma dia-a-dia (datas → disciplina → tópicos → minutos) que vira um plano "express" ativo, refletindo no study organizer, calendário, previsão de sessões e sequência de estudos.
2. **Registro multi-tópico**: o modal "Registro da Sessão de Estudo" passa a aceitar múltiplos tópicos/aulas por sessão, cada um com suas questões, páginas e status de progresso.

### Decisões fechadas na entrevista (não reabrir)
- Reta final = novo `plan.tipo = 'reta_final'` que **substitui** o plano ativo; o anterior é arquivado em `state.planejamentoArquivado` e restaurável após a `dataFinal`.
- Import **só JSON**, dia-a-dia explícito; `minutos` opcional por bloco (default `minutosPadrao`, default global 60).
- Matching de disciplinas/tópicos por **nome normalizado** contra `state.editais`; faltantes são **criados**; preview (casados × criados) antes de confirmar.
- Dia perdido: **rolagem automática "empilha no dia seguinte"** (bloco atrasado move para hoje, somando à carga, sem deslocar o resto); pós-`dataFinal` vira `nao_coberto`. Rolagem idempotente, roda no boot/render, **nunca** toca `updatedAt`.
- Sessão multi-tópico: **um evento**, `ev.sessao.topicos[]`; **mesma disciplina** por sessão; item = assunto e/ou aula (aula filtrada por `linkedAulaIds` primeiro).
- **Totais derivados**: soma de questões/páginas dos itens gravada também nos campos atuais `ev.sessao.questoes/paginas` + escalares `ev.assId/aulaId` (= 1º item) → dashboard/histórico/ciclo/sessões antigas funcionam **sem migração**. Sessão antiga editada converte escalares em `topicos[]` de 1 item.
- Promoção de conclusão/revisões (1/7/30/90) **itera** `topicos[]`.
- UI: manter selects nativos; apenas mecânica de "adicionar item à lista" (multi-add). Evento da reta final (`ev.rfBlocoId`) pré-preenche a lista de tópicos no registro.

## Schemas

### JSON de importação
```json
{
  "versao": 1,
  "nome": "Reta Final TJ-SP 2026",
  "dataFinal": "2026-08-15",
  "minutosPadrao": 60,
  "dias": [
    { "data": "2026-07-10", "blocos": [
      { "disciplina": "Direito Penal", "topicos": ["Crimes contra a vida"], "aula": "Aula 05", "minutos": 90 },
      { "disciplina": "Português", "topicos": ["Crase"] }
    ]}
  ]
}
```
Validação: `versao===1`; datas `YYYY-MM-DD`; `dias[].data <= dataFinal`; `disciplina` obrigatória; `topicos[]` pode ser vazio se houver `aula`; `minutos` inteiro > 0 opcional.

### Estado (`state.planejamento` com `tipo:'reta_final'`)
Campos padrão do plano (disciplinas derivadas dos blocos, sequencia vazia) + :
```js
retaFinal: {
  nome, dataFinal, minutosPadrao, importadoEm,
  blocos: [{ id:'rf_<uid>', data, dataOriginal, discId,
             topicos:[{assId|null, aulaId|null}], minutos,
             status:'pendente'|'concluido'|'nao_coberto', rolagens }]
}
```
`blocos[].id` obrigatório (merge-by-id do `setState`). Plano arquivado: `state.planejamentoArquivado = { plan, arquivadoEm } | null` — **precisa entrar na whitelist do `setState`** ([store.js:124-161](src/js/store.js:124), whitelist fixa confirmada; sem isso evapora no reload).

### `ev.sessao.topicos[]`
```js
[{ assId|null, aulaId|null,  // ≥1 não-nulo
   questoes:{total,acertos,erros}|null,
   paginas:{modo,total,inicio?,fim?}|null,
   statusTopico:'nao_iniciado'|'em_andamento'|'finalizado' }]
```
Derivados no save: `ev.assId/aulaId` = 1º item; `sessao.questoes/paginas` = somas; `sessao.statusTopico` = 'finalizado' se algum item finalizado. Eventos da reta final: `ev.rfBlocoId = bloco.id` (análogo a `seqId`).

---

## FASE 0 — Publicar o plano

- Copiar este plano para `docs/plano-reta-final-multi-topico.md`, commit e push na `main`.

## FASE 1 — Fundação de estado e sync (pré-requisito de tudo)

TDD: `tests/unit/store-reta-final-sync.test.js` (**risco alto**) primeiro.

- **[store.js](src/js/store.js)**: whitelist do `setState` + estado inicial ganham `planejamentoArquivado`. (`planejamento.retaFinal` já passa pelo `mergeValues` recursivo — nada a fazer.)
- **[sync-center.js](src/js/sync/sync-center.js)** (~421-455): quando LWW escolhe plano remoto, levar `planejamentoArquivado` junto (mutação atômica com mesmo `updatedAt`).
- Testes: whitelist preserva campos novos em boot/import; merge-by-id de `retaFinal.blocos`; LWW leva `planejamentoArquivado`; `createExportableState` inclui os campos.

Commits: (1) store whitelist + testes; (2) sync LWW.

## FASE 2 — Reta Final: núcleo puro + agendador

TDD: `reta-final-core.test.js`, `reta-final-rollover.test.js` (**risco alto**), `reta-final-sync-eventos.test.js` (**risco alto**, espelho de `cycle-sync-occupied-slots.test.js`).

- Criar `src/js/logic/reta-final-core.js` — **núcleo puro** (sem state/app, espelho de `cycle-progress.js`): `validateRetaFinalPayload`, `normalizeNameKey` (NFD sem acentos), `matchRetaFinalToEditais`, `rolloverRetaFinalBlocks`, `reconcileRetaFinalWithEvents` (nunca toca updatedAt), `computeRetaFinalSummary`.
- Criar `src/js/logic/reta-final.js` — orquestração: `syncRetaFinalToEventos()`, `getRetaFinalOccupiedBlocoIds(eventos)`.
- **[cycle.js](src/js/logic/cycle.js:632)**: branch no topo de `syncCicloToEventos()` — `if (tipo==='reta_final') return syncRetaFinalToEventos()`. Mantém todos os call sites intactos. Sem ciclo de imports (`cycle.js` importa de `reta-final.js`; `reta-final.js` só importa store/utils/core).
- **[sync-center.js](src/js/sync/sync-center.js:455)**: após `reconcileSequenceWithEvents`, chamar `reconcileRetaFinalWithEvents` (import do core puro).
- Atualizar `logic-cycle-imports.test.js` (guarda: core puro não importa store/app).

### Algoritmo de `syncRetaFinalToEventos()` (idempotente)
1. `reconcileRetaFinalWithEvents` — bloco com evento `rfBlocoId` em `estudei` → `concluido`.
2. `rolloverRetaFinalBlocks` — bloco `pendente` com `data < hoje` sem evento preservado: se `hoje <= dataFinal` → `data = hoje` (ordenação estável: entra depois dos blocos que já eram de hoje), `rolagens++`; senão → `nao_coberto`. **Sem** `touchPlanejamento()` (cada dispositivo re-deriva; evita ping-pong LWW — padrão de `cycle-progress.js:85-89`).
3. Wipe de autos `rfBlocoId` não preservados (preservado = `estudei` ou `tempoAcumulado>0` — padrão occupiedSlots do commit 8756f10).
4. Materializa eventos (`id:'autorf_'+uid`, `isAutoGenerated`, `rfBlocoId`) para blocos `pendente` com `data >= hoje` cujo `rfBlocoId` não tem evento preservado.
5. `scheduleSave()` só se mudou. Usa `todayStr()`/data local, nunca `toISOString()`.

Commits: (3) núcleo validação/matching; (4) rolagem+reconcile; (5) agendador+roteamento.

## FASE 3 — Reta Final: ativação, import e UI

TDD: `reta-final-activation.test.js`; e2e `reta-final.spec.js`.

- `reta-final.js`: `activateRetaFinal({payload, matching})` (arquiva plano ativo, cria disciplinas/assuntos/aulas faltantes nos editais — disciplina nova vai no edital principal ativo ou num edital "Reta Final" —, monta plano, `touchPlanejamento()`, wipe+sync+`scheduleSave()`); `restaurarPlanejamentoArquivado()`.
- Criar `src/js/views/reta-final-import.js` — modal no padrão de [data-management.js:108-168](src/js/views/config/data-management.js:108): file → parse → validate → match → preview (casados × criados) → confirmar.
- Criar `src/js/views/reta-final-view.js` — lista agrupada por data (badge "rolado de DD/MM" quando `data !== dataOriginal`), resumo por disciplina até `dataFinal` (substitui a previsão de sessões), seção "Não cobertos", banner pós-`dataFinal` com "Restaurar planejamento anterior".
- Criar `src/js/ui/actions/reta-final.js` (actions `open-reta-final-import`, `confirm-reta-final-import`, `restaurar-planejamento-arquivado`; registrar em `ui/actions/index.js`).
- **[ciclo-view.js](src/js/views/ciclo-view.js:203)**: rotear `tipo==='reta_final'` → `renderRetaFinal`; botão "Importar Reta Final".
- **[planejamento-wizard.js](src/js/planejamento-wizard.js)**: card "Reta Final (importar)" no passo de tipo.
- **[app.js](src/js/app.js:102)**: no `init()`, se plano é reta_final, rodar `syncRetaFinalToEventos()` (rolagem no boot; `renderRetaFinal` também chama — cobre virada de dia com app aberto).
- E2E: import→preview→confirmar→view/calendário; seed de bloco de ontem→reload→rolado para hoje; restaurar plano arquivado.

Commits: (6) ativação/restauração; (7) modal import; (8) view+hooks+e2e.

## FASE 4 — Registro de sessão multi-tópico

TDD: `session-topics.test.js`, `session-save-topics.test.js` (**risco alto**, padrão de `session-save-slots.test.js`), `registro-sessao-topicos-ui.test.js`; e2e `sessao-multi-topico.spec.js`.

- Criar `src/js/registro-sessao/session-topics.js` — **puro**: `normalizeSessionTopics(ev)` (legado escalar → 1 item), `sumTopicQuestoes/Paginas`, `applyTopicosToEvent(ev, topicos, fallbackGlobals)`, `buildTopicosFromRetaFinalBloco(bloco)`.
- **[session-save.js](src/js/registro-sessao/session-save.js:169)**: `performSave({…, sessionTopicos})` — validação por item (extrair helper das regras atuais 272-331); `applyTopicosToEvent` grava lista + derivados; promoção (405-429) vira loop sobre itens finalizados (**manter guarda** `if (ass && !ass.concluido)` — não resetar `revisoesFetas` de assunto já concluído); hábitos usam somas; sessão sem tópicos = comportamento atual byte a byte.
- **[modal-renderer.js](src/js/registro-sessao/modal-renderer.js)**: bloco "Tópicos da sessão" — selects atuais viram "linha editora" + botão "+ Adicionar à lista"; `renderTopicosList` com inputs por item (`data-topico-idx`: questões, páginas, status, remover). Campos globais viram somatório informativo quando há itens (ativos com lista vazia — caminho legado). **Não renomear** ids `#reg-*`.
- **[registro-sessao.js](src/js/registro-sessao.js)**: estado `_sessionTopicos`; `openRegistroSessao` popula via `normalizeSessionTopics(ev)`; `addTopicoSessao/removeTopicoSessao/updateTopicoField` + actions; filtro de `#reg-aula` por `linkedAulaIds` do assunto; passa `sessionTopicos` ao save.
- Sem mudança (garantido pelos totais derivados): `logic/progress.js`, `logic/revisions.js`, `cycle-progress.js`.

Commits: (9) núcleo topicos[]; (10) performSave multi-tópico; (11) UI multi-add+e2e.

## FASE 5 — Integração e acabamento

- **[registro-sessao.js](src/js/registro-sessao.js)**: se `ev.rfBlocoId` e lista vazia, pré-preencher via `buildTopicosFromRetaFinalBloco` (lookup em `state.planejamento.retaFinal.blocos`).
- **[historico-view.js](src/js/views/historico-view.js)**: render de `topicos[]` quando presente, fallback ao atual.
- Regressão e2e completa: `sessoes`, `full-study-flow`, `timer-flow`, `ciclo-step-flow`, `planejamento` (nota: `editais.spec.js` e `format:check` já falham antes — não são baseline).
- Bump de versão de cache do app (padrão dos commits `chore(cache)`), commit+push final e handoff (CLAUDE.md).

Commits: (12) integração rfBlocoId no registro; (13) histórico; (14) bump cache + handoff.

## Verificação final

- `npx vitest run` — suíte inteira verde.
- E2E: `npx playwright test tests/e2e/reta-final.spec.js tests/e2e/sessao-multi-topico.spec.js tests/e2e/sessoes.spec.js tests/e2e/full-study-flow.spec.js`.
- Manual: importar JSON de exemplo → preview, calendário, resumo; registrar sessão a partir de evento da reta final (lista pré-preenchida) com 2 tópicos → histórico, conclusão nos editais, revisões, dashboard; simular dia perdido → reload → bloco rolado para hoje.

## Riscos principais

1. Whitelist do `setState` (Fase 1 é pré-requisito de tudo).
2. Ping-pong LWW: rolagem/reconcile jamais chamam `touchPlanejamento()`; import/restauração/edição manual sempre chamam.
3. Re-popular bloco ocupado (análogo exato do bug histórico dos occupied slots) — wipe e materialização checam eventos preservados.
4. IDs do DOM `#reg-*` intactos; campos por item usam `data-topico-idx`.
5. Não resetar `revisoesFetas` de assunto já concluído ao reeditar sessão.
