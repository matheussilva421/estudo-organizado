# Modo Tranquilo De Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o sync em uma experiencia automatica e silenciosa: o usuario edita, o app salva localmente, sincroniza sozinho com Firestore e so pede acao quando houver risco real de perda.

**Architecture:** IndexedDB continua como commit imediato. Firestore primary continua como remoto principal automatico. Cloudflare e Google Drive continuam como canais secundarios manuais, mas saem do caminho principal e ficam em areas avancadas/backup. A UI passa a exibir um estado humano unico e esconde diagnosticos tecnicos por padrao.

**Tech Stack:** Vanilla JavaScript ES modules, IndexedDB, Firebase/Firestore, Cloudflare Worker/KV secundario, Google Drive backup manual, Vitest, Playwright, PWA/service worker.

---

## Baseline Atual

- `src/js/store.js`: salvamento local e evento `stateSaved`.
- `src/js/sync/sync-coordinator.js`: agenda sync primario apos `stateSaved`, login, reconnect e foreground.
- `src/js/sync/firestore-sync-engine.js`: auth, status, snapshot fallback, entity-primary e flush.
- `src/js/sync/sync-center.js`: modelo consolidado da Central de Sync.
- `src/js/views/config-view.js`: renderiza Central de Sync, Backup Center e controles manuais.
- `src/js/main.js`: atualmente agrupa render da tela de config apos eventos `app:firestoreSyncStatus`.
- `tests/unit/sync-center.test.js`: contrato do modelo consolidado.
- `tests/unit/config-view.test.js`: contrato de render da tela de configuracoes.
- `tests/e2e/app.spec.js`: cobre evidencias visuais da Central de Sync e Backup Center.

## Principio De Produto

O fluxo normal nao deve exigir que o usuario leia termos como outbox, shadow diff, ack remoto, snapshot, entity-primary, retries ou tombstone. Esses termos continuam existindo para diagnostico, mas ficam em "Avancado".

Estados visiveis no uso diario:

- `Tudo salvo`: IndexedDB salvo e Firestore sem pendencia critica.
- `Sincronizando`: ha envio automatico em andamento ou fila curta.
- `Offline`: dados salvos localmente e envio remoto aguardando conectividade.
- `Acao necessaria`: conflito real, erro persistente ou login ausente quando o usuario espera sync remoto.

---

## Fase 1 - Central De Sync Em Modo Tranquilo

**Objetivo:** Trocar a primeira dobra da Central de Sync por uma leitura simples e esconder comandos perigosos/manuais em painel avancado.

**Files:**

- Modify: `src/js/sync/sync-center.js`
- Modify: `src/js/views/config-view.js`
- Modify: `src/css/views.css`
- Modify: `tests/unit/sync-center.test.js`
- Modify: `tests/unit/config-view.test.js`
- Modify: `tests/unit/firestore-contracts.test.js`

### Task 1.1 - Criar modelo humano de status

- [x] **Step 1: Add failing tests**

Add tests to `tests/unit/sync-center.test.js`:

```js
it('describes automatic synced state in quiet language', () => {
  const model = buildSyncCenterModel({
    state: {
      config: {
        firestoreSync: {
          enabled: true,
          configured: true,
          signedIn: true,
          mode: 'primary',
          lastPushAt: '2026-05-01T10:00:00.000Z',
        },
      },
    },
  });

  expect(model.quiet.title).toBe('Tudo salvo automaticamente');
  expect(model.quiet.tone).toBe('ok');
});
```

- [x] **Step 2: Implement quiet model**

Add a function in `src/js/sync/sync-center.js` that maps current health and sources to:

```js
{
  title: 'Tudo salvo automaticamente',
  detail: 'Suas alteracoes ficam salvas neste dispositivo e o Firestore sincroniza sozinho.',
  tone: 'ok',
  primaryAction: null
}
```

- [x] **Step 3: Verify focused tests**

Run:

```powershell
npm run test:unit -- tests/unit/sync-center.test.js
```

Expected: all tests pass.

### Task 1.2 - Renderizar painel tranquilo

- [x] **Step 1: Add config render assertions**

Add tests to `tests/unit/config-view.test.js` asserting:

```js
expect(el.innerHTML).toContain('data-testid="sync-quiet-panel"');
expect(el.innerHTML).toContain('Sincronizacao automatica');
expect(el.innerHTML).toContain('data-testid="sync-advanced-panel"');
```

- [x] **Step 2: Update `renderSyncCenterCard()`**

In `src/js/views/config-view.js`, render this structure:

```html
<div class="sync-quiet-panel" data-testid="sync-quiet-panel">
  <div class="sync-quiet-kicker">Sincronizacao automatica</div>
  <div class="sync-quiet-title">Tudo salvo automaticamente</div>
  <div class="sync-quiet-detail">...</div>
</div>
<details class="sync-advanced-panel" data-testid="sync-advanced-panel">
  <summary>Opcoes avancadas de sync</summary>
  ...diagnosticos e botoes atuais...
</details>
```

- [x] **Step 3: Keep manual actions accessible**

The existing actions remain inside the advanced panel:

- `firestore-sync-now`
- `firestore-verify-entity-shadow`
- `firestore-merge-remote`
- `firestore-pull-remote`
- `firestore-force-push`
- Cloudflare/Drive manual actions

### Task 1.3 - Styling

- [x] **Step 1: Add CSS**

Add to `src/css/views.css`:

```css
.sync-quiet-panel {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  padding: 14px;
}
```

- [x] **Step 2: Mobile check**

Ensure the quiet panel stacks and the advanced panel does not overflow horizontally.

---

## Fase 2 - Politica Automatica Sem Botoes No Fluxo Normal

**Objetivo:** Fazer o app decidir sozinho quando enviar, aguardar, baixar ou apenas manter fila.

**Files:**

- Modify: `src/js/sync/sync-coordinator.js`
- Modify: `src/js/sync/firestore-sync-engine.js`
- Modify: `src/js/sync/sync-center.js`
- Test: `tests/unit/sync-coordinator.test.js`
- Test: `tests/unit/firestore-sync-engine-new.test.js`

Tasks:

- [ ] Garantir que `stateSaved` sempre agenda Firestore primary quando usuario esta logado, sem exigir clique em "Enviar local".
- [ ] Usar reconnect/foreground para flush imediato quando `nextAttemptAt` permite.
- [ ] Reduzir emissao de status repetido durante `queued -> syncing -> synced`.
- [ ] Criar regra: se nao ha conflito e ha local mais novo, enviar automaticamente.
- [ ] Criar regra: se nao ha local pendente e remoto e mais novo, baixar automaticamente apenas quando entity-primary puder aplicar sem overwrite inseguro.

---

## Fase 3 - Conflitos Raros E Auto-Merge Por Entidade

**Objetivo:** Fazer alteracoes em entidades diferentes se mesclarem sem pergunta.

**Files:**

- Modify: `src/js/sync/entity-state-builder.js`
- Modify: `src/js/sync/entity-metadata.js`
- Modify: `src/js/sync/firestore-sync-engine.js`
- Test: `tests/unit/firestore-entity-primary-regressions.test.js`
- Test: `tests/e2e/sync-simulation-expanded.spec.js`

Tasks:

- [ ] Mesclar automaticamente entidades diferentes.
- [ ] Tratar tombstones de forma idempotente.
- [ ] Gerar conflito apenas quando a mesma entidade tiver alteracao concorrente incompatível.
- [ ] Persistir decisao de conflito sem payload sensivel.

---

## Fase 4 - Alertas Apenas Quando O Usuario Precisa Agir

**Objetivo:** Remover ansiedade operacional da UI.

**Files:**

- Modify: `src/js/app.js`
- Modify: `src/js/views/config-view.js`
- Modify: `src/js/sync/sync-health.js`
- Test: `tests/unit/save-status.test.js`
- Test: `tests/e2e/app.spec.js`

Tasks:

- [ ] Topbar mostra somente `Tudo salvo`, `Sincronizando`, `Offline` ou `Acao necessaria`.
- [ ] Toasts de sucesso repetidos deixam de aparecer em sync automatico.
- [ ] Erros temporarios ficam silenciosos ate atingir circuito degradado.
- [ ] Conflitos reais abrem CTA claro para resolver.

---

## Fase 5 - Backup Como Rede De Seguranca, Nao Como Sync Diario

**Objetivo:** Cloudflare e Drive viram backup/restore avancado e nao competem com Firestore primary.

**Files:**

- Modify: `src/js/views/config-view.js`
- Modify: `src/js/cloud-sync.js`
- Modify: `src/js/drive-sync.js`
- Modify: `src/docs/api/sync-contract.md`
- Test: `tests/unit/config-view.test.js`
- Test: `tests/e2e/sync-dados.spec.js`

Tasks:

- [ ] Mover Cloudflare e Drive para "Backups avancados".
- [ ] Manter export/import JSON como primeiro botao de recuperacao.
- [ ] Garantir que backup manual nao dispare sync primary automaticamente.
- [ ] Documentar que Cloudflare e Drive sao canais secundarios.

---

## Fase 6 - Release Gate E Validacao De Caos

**Objetivo:** Provar que o Modo Tranquilo nao esconde perda de dados.

Commands:

```powershell
npm run format:check
npm run lint
npm test
npm run test:e2e
```

Scenarios:

- [ ] Salvar evento e fechar aba abruptamente.
- [ ] Reabrir offline e editar outro item.
- [ ] Reconectar e confirmar sync automatico.
- [ ] Simular conflito da mesma entidade.
- [ ] Exportar JSON antes de restore.
- [ ] Confirmar que nenhuma credencial aparece no export.

---

## Execution Log

- 2026-05-01: Plano criado para reduzir o sync a um Modo Tranquilo e iniciar pela Central de Sync.
- 2026-05-01: Fase 1 iniciada. `buildSyncCenterModel()` agora expõe `quiet`, `renderConfig()` usa a Central em Modo Tranquilo, comandos manuais continuam em `sync-advanced-panel`, e testes focados passaram com 76 testes.
- 2026-05-01: Fase 1 validada. `npm run format:check`, `npm run lint`, `npm test` e `npm run test:e2e` passaram. O E2E completo fechou com 110 testes verdes.
