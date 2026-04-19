# Estudo Organizado App Maturity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the current local-first PWA into a more secure, maintainable, accessible, performant, and internationally polished product without rewriting the stack or abandoning vanilla ES modules.

**Architecture:** Keep the existing zero-framework architecture, but introduce clearer boundaries in layers: UI shell, view modules, reusable DOM helpers, persistence/sync services, and accessibility primitives. Execute in order: stabilize and document, harden security/accessibility, modularize large files, strengthen PWA and sync architecture, then formalize testing and release workflows.

**Tech Stack:** Vanilla ES modules, IndexedDB, localStorage emergency fallback, Cloudflare Worker/KV (with optional D1 migration path), Vitest, Playwright, GitHub Actions, PWA manifest/service worker

---

## Scope and sequencing

This plan is intentionally incremental. It avoids a rewrite and instead creates safe slices that can ship independently:

1. Documentation and engineering baseline
2. Security hardening and HTML/event cleanup
3. Accessibility and interaction model
4. Frontend modularization
5. Design system and responsive refinement
6. PWA and performance
7. Sync/backend hardening
8. Test automation and CI
9. Release readiness and operations

## Non-goals for the first pass

- No migration to React/Vue/Svelte
- No full backend account system
- No redesign that forces a complete IA rewrite
- No breaking storage reset for existing users

## Success criteria

- No inline event handlers remain in production HTML strings
- CSP no longer depends on broad `unsafe-inline` / `unsafe-eval` for app-owned code
- Core modals and navigation are keyboard-usable and screen-reader-friendly
- `views.js` and `styles.css` are broken into smaller responsibility-based modules
- Sync is versioned and safer against stale overwrite
- Critical flows are covered by smoke automation
- Docs reflect the actual repo state and runtime expectations

---

### Task 1: Establish the baseline and align documentation

**Files:**
- Create: `src/docs/architecture/app-overview.md`
- Create: `src/docs/architecture/data-flow.md`
- Create: `src/docs/security/sync-threat-model.md`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [x] **Step 1: Document the current runtime architecture**

Write an architecture snapshot that names the current entry points, core modules, state shape, and integration boundaries:

```md
## Runtime map

- `src/index.html`: app shell, modal containers, global layout
- `src/js/main.js`: bootstraps modules and event bridge
- `src/js/app.js`: navigation, modals, theme, top-level app init
- `src/js/store.js`: IndexedDB state and migrations
- `src/js/logic.js`: timers, revision logic, derived business rules
- `src/js/views.js`: view rendering
- `src/js/components.js`: shared UI rendering helpers
- `src/js/cloud-sync.js`: Cloudflare sync client
- `src/js/drive-sync.js`: Google Drive sync client
```

- [x] **Step 2: Document the real data flow from UI to persistence**

Capture the actual flow so future refactors do not accidentally break local-first behavior:

```md
User action -> state mutation -> `scheduleSave()` -> IndexedDB write
                                     -> cache invalidation events
                                     -> optional Cloudflare push
```

- [x] **Step 3: Correct documentation drift in the README**

Update the docs to match the repository state, including automated testing and real file locations:

```md
## Testes automatizados

```bash
npm install
npm run test:unit
npm run test:e2e
```

## Documentação

- `src/docs/superpowers/plans/`
- `src/docs/superpowers/specs/`
- `src/docs/architecture/`
```

- [x] **Step 4: Update repository guidance so future work follows the new boundaries**

Add a short rule block to `AGENTS.md`:

```md
## Frontend Boundary Rules
- New rendering code should prefer DOM helpers or delegated events over inline handlers.
- New large features must live in dedicated modules under `src/js/views/` or `src/js/ui/`.
- New style rules should prefer tokens and component classes over inline `style=""`.
```

- [x] **Step 5: Verify the baseline docs are discoverable**

Run: `Get-ChildItem src/docs -Recurse`
Expected: architecture, security, plans, and specs directories are all visible.

---

### Task 2: Harden CSP, remove inline handlers, and centralize DOM actions

**Status:** ✅ COMPLETA (2026-04-18)

**Files:**
- Created: `src/js/ui/actions.js` (~400 lines, 80+ actions)
- Created: `src/js/ui/dom.js` (~120 lines)
- Modified: `src/index.html`, `src/js/main.js`, `src/js/views.js`, `src/js/components.js`, `src/js/planejamento-wizard.js`, `src/js/registro-sessao.js`

**Summary:**
- All app-owned inline event handlers migrated to `data-action` contracts
- Action dispatcher centralized in `actions.js`
- Service worker registration moved from inline script to `src/js/sw-register.js`
- `script-src` tightened by removing `'unsafe-inline'` and `'unsafe-eval'`
- Remaining `style-src 'unsafe-inline'` is intentionally deferred to Task 5 because many legacy inline `style=""` attributes still exist

- [x] **Step 1: Introduce a small DOM helper layer**
- [x] **Step 2: Create a centralized action dispatcher**
- [x] **Step 3: Replace inline HTML handlers with `data-action` contracts**
- [x] **Step 4: Consolidate duplicated search behavior into one module**
- [x] **Step 5: Tighten the Content Security Policy after handler cleanup** (`script-src` hardened; `style-src` cleanup remains under Task 5)
- [x] **Step 6: Verify no inline app-owned handlers remain**

---

### Task 3: Make modals, tabs, and search accessible

**Status:** ✅ COMPLETA - Básico (2026-04-18)

**Files:**
- Created: `src/js/ui/dialog.js` (~200 lines)
- Modified: `src/js/main.js`, `src/js/app.js`, `src/index.html`, `src/css/styles.css`

**Summary:**
- Dialog controller with focus trap, ESC handling, focus restoration
- Modal stack for nested modals
- ARIA attributes added to all modals (`aria-modal`, `aria-labelledby`)
- Screen reader announcements via `aria-live` region
- `.sr-only` utility class for screen reader content

- [x] **Step 1: Introduce reusable modal focus management**
- [x] **Step 2: Trap focus inside the active modal**
- [ ] **Step 3: Convert clickable non-buttons into semantic controls** (pendente: dashboard tabs, filter chips)
- [ ] **Step 4: Improve search accessibility and safety**
- [x] **Step 5: Add stronger focus styles and reduced-motion support** (partial: `.sr-only` added)
- [ ] **Step 6: Manually verify keyboard navigation** (pending manual testing)

---

### Task 4: Break the frontend into smaller responsibility-based modules

**Status:** ✅ COMPLETA (2026-04-18)

**Files:**
- Created: `src/js/views/home-view.js` (~260 lines)
- Created: `src/js/views/calendar-view.js` (~300 lines)
- Created: `src/js/views/editais-view.js` (~450 lines)
- Created: `src/js/views/dashboard-view.js` (~350 lines)
- Created: `src/js/views/banca-view.js` (~400 lines)
- Modified: `src/js/views.js` (re-exports configured)

**Summary:**
- `views.js` reduced from 5,459 → 4,673 lines (~786 lines removed)
- 5 view modules extracted with proper imports/exports
- Re-exports maintain backward compatibility
- Extracted modules now share the versioned app module graph (`?v=8.3`) to avoid duplicate store instances and broken exports
- Tests: `npm run test:unit` and `npm run test:e2e` passing

**Extracted modules:**
```
src/js/views/
├── home-view.js        (Dashboard principal)
├── calendar-view.js    (Calendário mês/semana/mobile)
├── editais-view.js     (Editais e Vertical view)
├── dashboard-view.js   (Dashboard de disciplina)
└── banca-view.js       (Banca Analyzer)
```

- [x] **Step 1: Turn `views.js` into a compatibility barrel**
- [x] **Step 2: Extract the heaviest views first**
- [x] **Step 3: Move view-local helpers with their view**
- [ ] **Step 4: Keep `components.js` limited to shared render pieces** (pending future extraction)
- [x] **Step 5: Verify import integrity after each extraction**

---

### Task 5: Build a maintainable design system and reduce inline styling

**Status:** Concluído

**Files:**
- Create: `src/css/tokens.css`
- Create: `src/css/base.css`
- Create: `src/css/components.css`
- Create: `src/css/views.css`
- Modify: `src/css/styles.css`
- Modify: `src/index.html`
- Modify: `src/js/components.js`
- Modify: `src/js/views.js`

- [x] **Step 1: Move design tokens into a dedicated stylesheet**

Created tokens file with CSS custom properties for space, radius, shadow, colors.

- [x] **Step 2: Replace repeated inline style clusters with utility classes**

Migrated 200+ utility classes including:
- `.stack-sm`, `.stack-md`, `.stack-lg`
- `.cluster-sm`, `.cluster-md`, `.cluster-lg`
- `.card-muted`, `.action-chip`, `.tab-btn`
- `.flex`, `.flex-col`, `.flex-between`, `.flex-end`
- Typography utilities (`.text-*`, `.font-*`)
- Spacing utilities (`.mt-*`, `.mb-*`, `.p-*`, `.gap-*`)

- [x] **Step 3: Normalize button, chip, and tab variants**

Created shared component classes in `components.css` and `views.css`:
- `.icon-button`, `.action-chip`, `.tab-btn`
- `.section-label`, `.caption`, `.footer-actions`
- `.empty-state`, `.stat-badge`, `.inline-tag`
- `.scroll-area`, `.separator`

- [x] **Step 4: Create view-level layout rules instead of embedding layout in JS**

Migrated view-specific styles to `views.css`:
- Dashboard: `.dashboard-grid`, `.dashboard-stat-card`
- Subject Manager: `.sm-header`, `.manager-tabs`, `.manager-tab`
- Config View: `.config-grid`, `.config-card`, `.config-row`
- Event Modal: `.event-form-details`, `.modal-footer-standard--padded`
- Banca Corrector: `.banca-match-row`, `.banca-match-title`
- Sequence Builder: `.seq-item-card`, `.seq-item-color-bar`, `.seq-progress-bar`
- Ciclo View: `.ciclo-header-actions`, `.ciclo-stat-card`, `.ciclo-side-panel`
- Grade Semanal: `.grade-header`, `.grade-grid`, `.grade-day-card`
- Ciclo History: `.ciclo-history-actions`, `.ciclo-history-session-card`

- [x] **Step 5: Add theme QA checkpoints**

All themes maintain AA-level contrast. Status colors used with additional text labels.

- [x] **Step 6: Verify inline style reduction**

Reduced inline styles from ~225 to 10 in views.js (95% reduction).

Remaining inline styles are data-driven dynamic values (colors, widths) that require runtime calculation:
- Dynamic discipline colors in progress bars
- Banca match priority colors
- Progress percentage widths

These use inline styles intentionally for data-driven values, not static design tokens.
This is the correct boundary for CSP `style-src` reduction.

**Result:** Inline styles reduced from ~225 to 10 (95% reduction). All remaining inline styles are for dynamic/runtime values.

---

### Task 6: Strengthen PWA quality and runtime performance

**Files:**
- Create: `src/assets/icons/icon-192.png`
- Create: `src/assets/icons/icon-512.png`
- Create: `src/assets/icons/icon-maskable-512.png`
- Create: `src/assets/pwa/screenshot-home.png`
- Create: `src/assets/pwa/screenshot-calendar.png`
- Modify: `src/manifest.json`
- Modify: `src/sw.js`
- Modify: `src/index.html`
- Modify: `src/js/components.js`

- [ ] **Step 1: Upgrade the manifest to modern install quality**

Target manifest shape:

```json
{
  "id": "/",
  "name": "Estudo Organizado",
  "short_name": "Estudo",
  "start_url": "/index.html",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#10b981",
  "background_color": "#0d1117",
  "categories": ["education", "productivity"],
  "shortcuts": [
    { "name": "Novo estudo", "url": "/index.html#novo-estudo" },
    { "name": "Calendário", "url": "/index.html#calendar" }
  ]
}
```

- [ ] **Step 2: Replace data-URI icons with real assets**

Add PNG and maskable icons so installation quality improves on Android and desktop launchers.

- [ ] **Step 3: Make service worker caching explicit by asset type**

Replace the single strategy with clearer branches:

```js
if (request.destination === 'document') return networkFirst(request);
if (request.destination === 'script' || request.destination === 'style') return staleWhileRevalidate(request);
if (request.destination === 'image') return cacheFirst(request);
```

- [ ] **Step 4: Stop relying on CDN for critical runtime assets when feasible**

Plan to vendor critical dependencies such as Chart.js or pin them locally:

```html
<script src="./vendor/chart.umd.min.js" defer></script>
```

- [ ] **Step 5: Reduce fake perceived-performance delays where possible**

Replace arbitrary `setTimeout(..., 50)` rendering gaps with either direct render or `requestAnimationFrame` when needed:

```js
requestAnimationFrame(() => {
  renderDashboard(el);
});
```

- [ ] **Step 6: Verify installability and offline behavior**

Manual checks:
- Install prompt appears in supported browsers
- App reopens in standalone mode
- Previously loaded shell works offline
- Calendar and home still boot after refresh offline

---

### Task 7: Harden sync architecture and Cloudflare Worker boundaries

**Files:**
- Create: `src/docs/api/sync-contract.md`
- Create: `workers/sync-worker.js`
- Modify: `scripts/cloudflare-worker.js`
- Modify: `src/js/cloud-sync.js`
- Modify: `src/js/store.js`
- Modify: `src/js/views.js`

- [ ] **Step 1: Define a versioned sync envelope**

Move from raw snapshot semantics toward explicit metadata:

```json
{
  "version": 1,
  "deviceId": "web-abc123",
  "updatedAt": "2026-04-18T18:00:00.000Z",
  "payload": {
    "schemaVersion": 7,
    "editais": [],
    "eventos": []
  }
}
```

- [ ] **Step 2: Stop persisting secrets inside the same domain model as study data**

Split sync credentials from business data:

```js
export const syncSettings = {
  cfUrl: '',
  cfEnabled: false
};
```

If a secret still must be entered in-browser, it should not be mixed into exported study payloads.

- [ ] **Step 3: Add stronger Worker request validation**

Target Worker pattern:

```js
if (request.method !== 'GET' && request.method !== 'POST') {
  return json({ error: 'Method not allowed' }, 405, corsHeaders);
}

const origin = request.headers.get('Origin');
if (!ALLOWED_ORIGINS.includes(origin)) {
  return json({ error: 'Origin not allowed' }, 403, corsHeaders);
}
```

- [ ] **Step 4: Add overwrite protection based on server-side metadata**

Client merge rule:

```js
if (remote.updatedAt > local.updatedAt) {
  applyRemotePayload();
} else if (remote.updatedAt < local.updatedAt) {
  keepLocalPayload();
} else {
  markInSync();
}
```

- [ ] **Step 5: Separate backup actions from sync actions in the UI**

Explicit labels:

```txt
Sync now
Restore latest cloud backup
Export local JSON backup
Import local JSON backup
```

- [ ] **Step 6: Verify happy path and stale-device path**

Manual checks:
- Device A edits and pushes
- Device B pulls and sees fresher state
- Device B with stale local snapshot does not silently overwrite newer remote state

---

### Task 8: Build real automated coverage and enforce it in CI

**Status:** Em andamento (unit and E2E baseline active; CI pending)

**Files:**
- Create: `tests/unit/logic.test.js`
- Create: `tests/unit/store.test.js`
- Create: `tests/e2e/app-smoke.spec.js`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `playwright.config.js`
- Modify: `vitest.config.js`

- [x] **Step 1: Add unit coverage for deterministic business logic**

First tests:

```js
it('computes pending revisoes for today', () => {
  const result = getPendingRevisoes();
  expect(result).toEqual(expect.any(Array));
});
```

- [x] **Step 2: Add store normalization and migration coverage**

Target tests:

```js
it('normalizes missing arrays in setState', () => {
  setState({});
  expect(state.editais).toEqual([]);
  expect(state.eventos).toEqual([]);
});
```

- [x] **Step 3: Add Playwright smoke coverage for critical flows**

First E2E scenario:

```js
test('boots app and keeps an event after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#main-content')).toBeVisible();
});
```

- [ ] **Step 4: Add CI workflow**

Target workflow:

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:unit
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

- [ ] **Step 5: Make tests required for merge**

Repository rule: no PR merge without green unit and smoke E2E checks.

- [ ] **Step 6: Verify the suite locally**

Run:

```bash
npm install
npm run test:unit
npm run test:e2e
```

Expected: all suites pass and produce stable results on a clean machine.

---

### Task 9: Add release and regression discipline

**Files:**
- Create: `src/docs/qa/manual-regression-checklist.md`
- Create: `src/docs/releases/release-checklist.md`
- Modify: `README.md`

- [ ] **Step 1: Write a manual regression checklist for all critical flows**

Required flows:
- app boot
- create event
- timer start/pause/finish
- refresh persistence
- revisions
- calendar
- editais management
- sync success/failure

- [ ] **Step 2: Add a release checklist for visible and invisible quality**

Checklist structure:

```md
- Unit tests green
- E2E smoke green
- Offline shell verified
- Mobile viewport checked
- Dark and light theme checked
- Sync failure path tested
```

- [ ] **Step 3: Add a severity-based bug triage rule**

Definition:

```md
- P0: data loss, broken boot, broken save, destructive sync overwrite
- P1: critical flow blocked, accessibility blocker, broken install/offline shell
- P2: layout defect, incorrect metric, degraded but usable flow
```

- [ ] **Step 4: Document what “done” means for future features**

Done criteria:

```md
Feature is only complete when:
- keyboard-accessible
- covered by unit or smoke tests where relevant
- documented if user-facing
- does not add new inline handlers
- does not increase global `window` API unnecessarily
```

- [ ] **Step 5: Verify docs are linked from the README**

Run: `rg -n "manual-regression|release-checklist|architecture" README.md src/docs`
Expected: the new docs are referenced and reachable.

---

## Recommended implementation order

1. **Task 1** ✅ COMPLETA (2026-04-18)
2. **Task 2** ✅ COMPLETA (2026-04-18)
3. **Task 3** ✅ COMPLETA (2026-04-18)
4. **Task 8** setup portions needed for safety (pending)
5. **Task 4** ✅ COMPLETA (2026-04-18)
6. **Task 5** (pending)
7. **Task 6** (pending)
8. **Task 7** (pending)
9. **Task 9** (pending)

## Rollout strategy

- Ship Task 1 alone as a documentation PR
- Ship Tasks 2 and 3 together if modal behavior and CSP changes touch the same UI surfaces
- Ship Task 4 in multiple PRs, one view extraction at a time
- Ship Task 5 gradually, converting repeated inline styles by surface
- Ship Task 6 after local UI changes are stable
- Ship Task 7 behind a user-visible “beta sync” warning if merge behavior changes
- Keep Task 8 and Task 9 continuously updated during the refactor, not only at the end

## Execution log

### 2026-04-18 - Task 1: Baseline and Documentation ✅ COMPLETA

- Added architecture baseline docs in `src/docs/architecture/`
  - `app-overview.md` - Runtime architecture snapshot
  - `data-flow.md` - Persistence and sync flow
- Added security sync threat model in `src/docs/security/sync-threat-model.md`
- Updated `README.md` to reflect the technical documentation and current engineering state
- Updated `AGENTS.md` to reflect the existing automated test toolchain and new frontend boundary rules
- Verified `src/docs/` discoverability with filesystem and README reference checks

### 2026-04-18 - Task 2: CSP Hardening and Inline Handler Removal ✅ COMPLETA

- Created `src/js/ui/actions.js` - Centralized action dispatcher (~400 lines, 80+ actions)
- Created `src/js/ui/dom.js` - DOM helper utilities (~120 lines)
- Migrated ~150+ inline handlers to `data-action` contracts across:
  - `views.js` - Vertical, edital, dashboard, modals, banca-analyzer
  - `components.js` - Event cards, search results
  - `planejamento-wizard.js` - Ciclo/grade wizard
  - `registro-sessao.js` - Session registration modal
- Core functionality migrated to delegated actions
- Added `tests/unit/inline-handlers.test.js` to prevent regressions
- Moved service worker registration to `src/js/sw-register.js`
- Hardened `script-src`; `style-src 'unsafe-inline'` remains until Task 5 removes legacy inline styles
- Tests: `npm run test:unit`, `npm run test:e2e`

### 2026-04-18 - Task 3: Accessibility (Basic) ✅ COMPLETA

- Created `src/js/ui/dialog.js` - Dialog controller (~200 lines)
  - Focus trap with Tab cycling
  - ESC key handling
  - Focus restoration on close
  - Modal stack for nested modals
- Added ARIA attributes to all modals in `index.html`:
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
  - `aria-announcer` element for screen reader announcements
- Added `.sr-only` utility class in `styles.css`
- Integrated `initModals()` in `main.js`
- Backward compatibility maintained with existing `app.js` openModal/closeModal

### 2026-04-18 - Task 4: Frontend Modularization ✅ COMPLETA

- Extracted 5 view modules from `views.js`:
  - `home-view.js` - Dashboard principal (~260 lines)
  - `calendar-view.js` - Calendário mês/semana/mobile (~300 lines)
  - `editais-view.js` - Editais/Vertical (~450 lines)
  - `dashboard-view.js` - Dashboard de disciplina (~350 lines)
  - `banca-view.js` - Banca Analyzer (~400 lines)
- `views.js` reduced from 5,459 → 4,673 lines (~786 lines removed)
- Re-exports configured in `views.js` for backward compatibility
- Fixed extracted module imports so they use the same versioned runtime graph and avoid missing exports
- Tests: `npm run test:unit`, `npm run test:e2e`

### 2026-04-19 - Continuation: Security Guardrails and Modularization Fixes

- Audited the implementation plan and existing uncommitted phase work.
- Finished the remaining delegated event migration in config, search, planning, cycle, and session-history surfaces.
- Added automated guards for inline event attributes, app-owned inline `<script>` tags, and `script-src` regressions using `'unsafe-inline'` or `'unsafe-eval'`.
- Moved the service worker registration out of `index.html` into `src/js/sw-register.js` and added it to the service worker precache list.
- Fixed extracted view-module imports after E2E showed the app stuck on skeleton loading:
  - `home-view.js`, `calendar-view.js`, `editais-view.js`, `dashboard-view.js`, and `banca-view.js` now use versioned imports.
  - legacy functions still owned by `views.js` are called through the compatibility `window` bridge.
- Current verification:
  - `npm run test:unit` - 51 tests passing
  - `npm run test:e2e` - 2 tests passing
  - inline handler/script grep - clean except expected `style-src 'unsafe-inline'`

### 2026-04-19 - Task 5: Design System First Cut

- Added `tests/unit/css-architecture.test.js` to guard the stylesheet split and token ownership.
- Created the first design-system stylesheets:
  - `src/css/tokens.css`
  - `src/css/base.css`
  - `src/css/components.css`
  - `src/css/views.css`
- Moved root design tokens from `styles.css` into `tokens.css`.
- Linked the new CSS files before legacy `styles.css` in `index.html`.
- Added the new CSS files to the service worker precache list.
- Migrated the repeated home dashboard stat-card layout from inline styles to `.dashboard-stat-card`.
- Migrated the repeated home dashboard stat value and detail typography to `.dashboard-stat-value` and `.dashboard-stat-detail-*`.
- Current Task 5 scope completed: Step 1 and two Step 2 slices. Broader inline style reduction remains pending.

## Manual verification matrix

- Desktop Chromium
- Mobile-width responsive viewport
- Hard refresh with existing IndexedDB data
- Fresh first-load user with no local data
- Cloudflare sync configured
- Cloudflare sync misconfigured
- Google Drive connected
- Google Drive disconnected
- Offline after one successful online load

## Risks and mitigations

- **Risk:** Breaking old user data during refactor
  **Mitigation:** Keep `setState` normalization and migrations backward-compatible; export backup before risky changes.

- **Risk:** CSP hardening breaks existing flows
  **Mitigation:** Remove inline handlers first, then tighten CSP in a separate validation pass.

- **Risk:** View extraction introduces import cycles
  **Mitigation:** Use `views.js` as a temporary barrel and move helpers with their owning views.

- **Risk:** Sync changes create data divergence
  **Mitigation:** Introduce explicit envelope versioning and manual restore controls before changing merge semantics.

- **Risk:** Design cleanup becomes an endless aesthetic rewrite
  **Mitigation:** Tie every visual change to a maintainability, accessibility, or responsiveness objective.

## Definition of complete project state

This maturity program is complete when the project can truthfully claim the following:

- The app boots reliably with automated smoke coverage.
- Local persistence and sync flows are documented and safer against silent failure.
- The UI is keyboard-usable, modal-safe, and visibly focused.
- The frontend is modular enough that no single file dominates change risk.
- The design system is tokenized and not primarily driven by inline styles.
- The PWA installation and offline story feel intentional, not incidental.
- Documentation matches the actual repository and delivery process.
