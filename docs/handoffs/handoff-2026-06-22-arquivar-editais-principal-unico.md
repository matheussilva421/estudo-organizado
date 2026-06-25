# Handoff — Arquivar editais (modelo de edital principal único) + página "Editais Anteriores"

Data: 2026-06-22
Branch: `feat/arquivar-editais-principal-unico` (criada a partir de `main`)

## Objetivo da sessão

Permitir **arquivar editais sem perder estatísticas** e simplificar o app para um
modelo de **edital principal único**:

- Sempre existe exatamente 1 edital principal (ativo); os demais ficam arquivados.
- Os dados/estatísticas dos editais arquivados nunca são perdidos.
- O **seletor de edital** (abas da Home, dropdown do Dashboard/topbar, dropdown do
  verticalizado) foi removido — o app foca no principal.
- Nova página **"Editais Anteriores"** exibe as estatísticas dos arquivados.

Plano completo: `C:\Users\slvma\.claude\plans\quero-poder-arquivar-um-validated-noodle.md`.

## Decisões de produto (confirmadas com o usuário via /grill-me)

1. Arquivar espelha o arquivamento de disciplina (flag, dados preservados, reversível).
2. Sem seletor: um principal por vez; Dashboard/Histórico/Home escopam no principal.
3. Trocar principal: "Tornar principal" num arquivado promove e arquiva o atual (atômico).
   Criar edital novo também o torna principal e arquiva o anterior.
4. Arquivar o principal abre modal pedindo o sucessor (promover arquivado ou criar novo).
5. Página nova "Editais Anteriores": abas por edital arquivado → dashboard completo daquele
   edital (reaproveita `renderDashboard` escopado).
6. Sync: **flag-only**, `sync-center.js` INTOCADO. Arquivar não é exclusão → sem tombstone.
7. Migração v10→v11 adiciona `arquivado`/`arquivadoEm`. No 1º load, se houver >1 edital ativo,
   modal único pede o principal (1x por dispositivo).
8. Excluir permanece (único caminho que perde stats), mas "Arquivar" é a ação primária.

## Arquivos alterados

Fonte:
- `src/js/store/migrations.js` — `DEFAULT_SCHEMA_VERSION` 10→11; bloco v10→v11 (arquivado/arquivadoEm).
- `src/js/logic.js` — helpers `getActiveEditais`, `getArchivedEditais`, `getPrincipalEdital`,
  `getPrincipalEditalId`, `archiveEdital`, `unarchiveEdital`, `makeEditalPrincipal`; guarda
  `if (edital.arquivado) continue` em `getActiveDisciplinas`.
- `src/js/edital-filter.js` — `getSelectedEditalId` agora resolve o **principal** (ou override);
  novo `withEditalScope(editalId, fn)` (override de escopo não-persistido). `getEditalForDiscId`
  segue varrendo TODOS os editais (vínculo de stats).
- `src/js/logic/revisions.js`, `src/js/views/revisao-view.js`, `src/js/logic/progress.js`,
  `src/js/views/editais-view.js` — guardas para pular editais arquivados em revisões, progresso,
  próxima aula e verticalizado.
- `src/js/views/editais-anteriores-view.js` — **NOVO**: página com abas por arquivado +
  `withEditalScope(id, () => renderDashboard(host))`; empty-state.
- `src/js/views/editais-view.js` — `renderEditais` com seção do principal + seção "Editais
  arquivados" (Tornar principal / Estatísticas / Excluir); botão "📦 Arquivar" no header do
  principal; removido dropdown "Todos os editais" do verticalizado.
- `src/js/views/editais-crud.js` — `saveEdital` cria como principal (chama `makeEditalPrincipal`);
  novos `openEditalSuccessorModal`, `reconcilePrincipalEdital` (+ `openFirstRunPrincipalModal`).
- `src/js/ui/actions/editais.js` — ações `archive-edital`, `make-edital-principal`,
  `set-anterior-tab`; aviso forte em `delete-edital`.
- `src/js/components.js` — dispatch/título da view `editais-anteriores`; **removido** o seletor
  de edital do topbar (`renderEditalFilter`/`set-edital-filter`) e o import ocioso.
- `src/js/ui/actions/navegacao.js` — **removidas** ações `set-active-edital` e `set-edital-filter`.
- `src/js/views/home-view.js` — **removidas** as abas de edital (`set-active-edital`).
- `src/js/views/historico-view.js` — texto de empty-state aponta para "Editais Anteriores".
- `src/js/ui-state.js` — seção `editaisAnteriores: { activeTab: null }`.
- `src/js/views.js` — re-exports de `renderEditaisAnteriores`, `setAnteriorTab`,
  `openEditalSuccessorModal`, `reconcilePrincipalEdital`.
- `src/js/app.js` — chama `reconcilePrincipalEdital()` no init (após `navigate('home')`).
- `src/index.html` — item de menu "Editais Anteriores" (após "Ed. Verticalizado").

Testes:
- `tests/unit/editais-anteriores.test.js` — **NOVO** (página nova).
- `tests/unit/editais-principal-flow.test.js` — **NOVO** (saveEdital cria como principal; reconciler).
- `tests/unit/logic.test.js` — helpers de edital + guardas de fluxos ativos.
- `tests/unit/edital-filter.test.js` — reescrito para o modelo de principal único + `withEditalScope`.
- `tests/unit/store-migrations.test.js`, `tests/unit/store.test.js` — v11 + campos.
- `tests/unit/editais-view-render.test.js`, `tests/unit/navegacao-actions.test.js`,
  `tests/unit/views-modules.test.js`, `tests/unit/app-submodules.test.js` — ajustados à remoção
  do seletor e às novas deps.

## Validações executadas

- `npx vitest run` (suíte completa): **113 arquivos, 1854 testes, 0 falhas** (verde).
- `npx eslint src/`: **0 erros**, 44 warnings (todos pré-existentes; nenhum no código novo). Exit 0.
- Teste `action-contracts` faz **bundle real com esbuild** de `src/js/main.js` → grafo de módulos
  do browser compila sem exports faltando (valida a fiação da feature).
- `git diff --stat src/js/sync/ src/js/store/indexeddb.js src/js/store/export-state.js`: **vazio**
  → **sync NÃO foi alterado** (regra máxima respeitada).

## Confirmação explícita sobre o SYNC

Nenhuma linha de `src/js/sync/*` foi alterada. A feature é flag-only: `arquivado`/`arquivadoEm`
viajam dentro do array `editais`, mesclado pelo `mergeById` existente. Arquivar não é exclusão →
sem tombstone. Remover o seletor mexe só em estado por-dispositivo (`localStorage`/ui-state).

## Pendências / verificação manual recomendada

- **Smoke manual no navegador NÃO foi executado automaticamente** (extensão Claude-in-Chrome não
  estava conectada nesta sessão). Recomenda-se validar em desktop/mobile:
  1. Criar edital → vira principal e arquiva o anterior.
  2. "📦 Arquivar" no principal → modal de sucessor (escolher arquivado ou criar) conclui só após definir.
  3. "Tornar principal" num arquivado → troca atômica.
  4. Página "Editais Anteriores": abas por arquivado, cada uma mostra o dashboard daquele edital;
     empty-state quando não há arquivados.
  5. Revisões/Calendário/Ciclo/Study Organizer não oferecem o edital arquivado; Dashboard/Histórico/Home
     mostram só o principal; stats do arquivado seguem visíveis na página nova.
  6. 1º load com >1 edital ativo → modal "Qual é seu edital principal?".
- Funções `setActiveEdital`/`setActiveEditalId` em `home-view.js` ficaram exportadas mas ociosas
  (sem lint error). Limpeza opcional futura.

## Áreas NÃO tocadas

Sync (Cloudflare/Drive/Firestore), IndexedDB, export-state, backup/restore, autenticação.

## Revisão (self-review + revisor independente)

Após a 1ª entrega, revisão crítica + agente revisor. Achados tratados:

- **[Corrigido] 2º edital ativo invisível**: `renderEditais` usava `getFilteredEditais`
  (só o principal); num estado transitório com >1 ativo (merge de sync ou modal de
  reconciliação dispensado), o 2º ativo não aparecia em lugar nenhum. Agora usa
  `getActiveEditais()` (renderiza todos os ativos) — nenhum edital fica oculto.
  Teste de regressão em `editais-view-render.test.js`.
- **[Corrigido] Flag do reconciler gravada cedo demais**: a flag `estudo_principal_reconciled`
  era gravada ao abrir o modal; dispensá-lo deixava >1 ativo sem novo aviso. Agora a flag
  só é gravada quando o invariante já vale (≤1 ativo) OU quando o usuário confirma a escolha.
  Testes em `editais-principal-flow.test.js`.
- **[Limpado] Código morto**: removidos `setActiveEdital`/`setActiveEditalId` (e imports
  `setUiSection`/`setSelectedEditalId`) órfãos em `home-view.js`.
- **[Verificado, sem ação] Home escopada no principal**: é o comportamento decidido
  ("só o principal"); o streak/heatmap (`getConsistencyStreak`) segue global. `allowAll`
  virou parâmetro vestigial (dívida cosmética, não bug).
- **[Verificado, sem ação] `navigate` registrado em 2 arquivos**: pré-existente e permitido
  pelo teste `action-contracts` (`allowedDuplicates = ['navigate']`).

Validação pós-revisão: `vitest run` → **1857 testes, 0 falhas**; `eslint src/` → **0 erros**;
sync intocado.

## Status do GitHub

- Commit `683670e` (29 arquivos) na branch `feat/arquivar-editais-principal-unico`.
- Push realizado: branch publicada em `origin` e rastreada.
- Abrir PR: https://github.com/matheussilva421/estudo-organizado/pull/new/feat/arquivar-editais-principal-unico

## Próximos passos

1. (Usuário) Rodar o smoke manual acima (extensão Chrome não estava conectada nesta sessão).
2. Abrir o PR e revisar o diff.
