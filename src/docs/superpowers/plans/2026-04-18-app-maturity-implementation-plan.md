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

**Files:**
- Create: `src/js/ui/actions.js`
- Create: `src/js/ui/dom.js`
- Modify: `src/index.html`
- Modify: `src/js/main.js`
- Modify: `src/js/views.js`
- Modify: `src/js/components.js`
- Modify: `src/js/planejamento-wizard.js`
- Modify: `src/js/registro-sessao.js`

- [ ] **Step 1: Introduce a small DOM helper layer**

Create helpers so view code stops relying on raw string concatenation everywhere:

```js
export function qs(id, root = document) {
  return root.querySelector(id);
}

export function setText(node, value) {
  if (node) node.textContent = value ?? '';
}

export function clearChildren(node) {
  while (node?.firstChild) node.removeChild(node.firstChild);
}
```

- [ ] **Step 2: Create a centralized action dispatcher**

Move event execution away from `onclick=""`:

```js
const actions = {
  'open-event-detail': (el) => window.openEventDetail?.(el.dataset.eventId),
  'delete-event': (el) => window.deleteEvento?.(el.dataset.eventId),
  'toggle-revision-tab': (el) => window.switchRevTab?.(el.dataset.tab, el)
};

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const handler = actions[target.dataset.action];
  if (handler) handler(target, event);
});
```

- [ ] **Step 3: Replace inline HTML handlers with `data-action` contracts**

Refactor existing render output from this pattern:

```html
<button onclick="deleteEvento('${evento.id}')">Excluir</button>
```

To this pattern:

```html
<button data-action="delete-event" data-event-id="${evento.id}">Excluir</button>
```

- [ ] **Step 4: Consolidate duplicated search behavior into one module**

Keep only one search implementation and export it from one place:

```js
export function bindGlobalSearch() {
  const input = document.getElementById('global-search');
  input?.addEventListener('input', (event) => debouncedOnSearch(event.target.value));
}
```

- [ ] **Step 5: Tighten the Content Security Policy after handler cleanup**

Target policy shape:

```html
<meta http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self' https://cdnjs.cloudflare.com https://apis.google.com https://accounts.google.com;
    style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com 'unsafe-inline';
    font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
    connect-src 'self' https://www.googleapis.com https://accounts.google.com https://*.workers.dev;
    img-src 'self' data: https: blob:;
    media-src 'self' https://assets.mixkit.co;
  ">
```

- [ ] **Step 6: Verify no inline app-owned handlers remain**

Run: `rg -n "onclick=|oninput=|onchange=|onkeyup=|onblur=|onfocus=" src`
Expected: only unavoidable third-party or intentionally deferred exceptions remain, ideally zero.

---

### Task 3: Make modals, tabs, and search accessible

**Files:**
- Create: `src/js/ui/dialog.js`
- Create: `src/js/ui/focus.js`
- Modify: `src/js/app.js`
- Modify: `src/index.html`
- Modify: `src/js/views.js`
- Modify: `src/css/styles.css`

- [ ] **Step 1: Introduce reusable modal focus management**

Create a dialog controller:

```js
let lastFocusedElement = null;

export function openDialog(node) {
  lastFocusedElement = document.activeElement;
  node.classList.add('open');
  node.setAttribute('aria-hidden', 'false');
  const first = node.querySelector('[autofocus], button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
  first?.focus();
}

export function closeDialog(node) {
  node.classList.remove('open');
  node.setAttribute('aria-hidden', 'true');
  lastFocusedElement?.focus?.();
}
```

- [ ] **Step 2: Trap focus inside the active modal**

Add keyboard logic consistent with WAI modal behavior:

```js
export function trapTabKey(event, container) {
  if (event.key !== 'Tab') return;
  const focusable = [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
```

- [ ] **Step 3: Convert clickable non-buttons into semantic controls**

Refactor tab rows and action chips from generic `<div>` to buttons:

```html
<button class="tab-btn"
  type="button"
  data-action="toggle-revision-tab"
  data-tab="pendentes"
  aria-selected="true">
  Pendentes
</button>
```

- [ ] **Step 4: Improve search accessibility and safety**

Render search result items as buttons or links, never inert `div`s:

```html
<button class="search-item"
  type="button"
  data-action="open-event-detail"
  data-event-id="${ev.id}">
  <span class="search-item-label">${safeLabel}</span>
</button>
```

- [ ] **Step 5: Add stronger focus styles and reduced-motion support**

Add CSS primitives:

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 6: Manually verify keyboard navigation**

Test sequence:
- `Tab` through sidebar, topbar, search, and modal controls
- `Escape` closes topmost modal only
- Focus returns to the element that opened the modal
- Search results are navigable without a mouse

---

### Task 4: Break the frontend into smaller responsibility-based modules

**Files:**
- Create: `src/js/views/home-view.js`
- Create: `src/js/views/calendar-view.js`
- Create: `src/js/views/editais-view.js`
- Create: `src/js/views/dashboard-view.js`
- Create: `src/js/views/config-view.js`
- Create: `src/js/views/ciclo-view.js`
- Create: `src/js/views/search-view.js`
- Modify: `src/js/views.js`
- Modify: `src/js/components.js`

- [ ] **Step 1: Turn `views.js` into a compatibility barrel**

Keep imports stable while extracting code:

```js
export { renderHome } from './views/home-view.js';
export { renderCalendar } from './views/calendar-view.js';
export { renderEditais } from './views/editais-view.js';
export { renderDashboard } from './views/dashboard-view.js';
export { renderConfig } from './views/config-view.js';
export { renderCiclo } from './views/ciclo-view.js';
export { onSearch, onSearchFocus, onSearchBlur, clearSearch } from './views/search-view.js';
```

- [ ] **Step 2: Extract the heaviest views first**

Start with the largest and most volatile slices:

```txt
1. home-view.js
2. editais-view.js
3. ciclo-view.js
4. config-view.js
```

- [ ] **Step 3: Move view-local helpers with their view**

Example:

```js
function formatBackupDateTime(value) {
  if (!value) return 'Nunca';
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? 'Nunca' : dt.toLocaleString('pt-BR');
}
```

- [ ] **Step 4: Keep `components.js` limited to shared render pieces**

Shared-only responsibility:

```js
export function renderSkeletonLoader() { ... }
export function renderEventCard(evento) { ... }
export function updateBadges() { ... }
```

- [ ] **Step 5: Verify import integrity after each extraction**

Run after each view extraction:

```bash
npm run test:unit
```

Expected: no import resolution regressions.

---

### Task 5: Build a maintainable design system and reduce inline styling

**Files:**
- Create: `src/css/tokens.css`
- Create: `src/css/base.css`
- Create: `src/css/components.css`
- Create: `src/css/views.css`
- Modify: `src/css/styles.css`
- Modify: `src/index.html`
- Modify: `src/js/components.js`
- Modify: `src/js/views.js`

- [ ] **Step 1: Move design tokens into a dedicated stylesheet**

Create a tokens file:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.10);
}
```

- [ ] **Step 2: Replace repeated inline style clusters with utility classes**

Example migration:

```css
.stack-sm { display: flex; flex-direction: column; gap: var(--space-2); }
.cluster-md { display: flex; align-items: center; gap: var(--space-3); }
.card-muted { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-md); }
```

- [ ] **Step 3: Normalize button, chip, and tab variants**

Define shared classes:

```css
.action-chip { border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600; }
.tab-btn[aria-selected="true"] { color: var(--accent); border-bottom: 2px solid var(--accent); }
.icon-button { inline-size: 36px; block-size: 36px; display: inline-flex; align-items: center; justify-content: center; }
```

- [ ] **Step 4: Create view-level layout rules instead of embedding layout in JS**

Example:

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-4);
}
```

- [ ] **Step 5: Add theme QA checkpoints**

Acceptance list:
- All themes keep AA-level readable contrast for body text
- Graph labels remain readable in dark themes
- Status colors are not the sole signal for meaning

- [ ] **Step 6: Verify inline style reduction**

Run: `rg -n 'style=' src/index.html src/js`
Expected: count drops sharply, leaving only temporary exceptions.

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

**Files:**
- Create: `tests/unit/logic.test.js`
- Create: `tests/unit/store.test.js`
- Create: `tests/e2e/app-smoke.spec.js`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `playwright.config.js`
- Modify: `vitest.config.js`

- [ ] **Step 1: Add unit coverage for deterministic business logic**

First tests:

```js
it('computes pending revisoes for today', () => {
  const result = getPendingRevisoes();
  expect(result).toEqual(expect.any(Array));
});
```

- [ ] **Step 2: Add store normalization and migration coverage**

Target tests:

```js
it('normalizes missing arrays in setState', () => {
  setState({});
  expect(state.editais).toEqual([]);
  expect(state.eventos).toEqual([]);
});
```

- [ ] **Step 3: Add Playwright smoke coverage for critical flows**

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

1. Task 1
2. Task 2
3. Task 3
4. Task 8 setup portions needed for safety
5. Task 4
6. Task 5
7. Task 6
8. Task 7
9. Task 9

## Rollout strategy

- Ship Task 1 alone as a documentation PR
- Ship Tasks 2 and 3 together if modal behavior and CSP changes touch the same UI surfaces
- Ship Task 4 in multiple PRs, one view extraction at a time
- Ship Task 5 gradually, converting repeated inline styles by surface
- Ship Task 6 after local UI changes are stable
- Ship Task 7 behind a user-visible “beta sync” warning if merge behavior changes
- Keep Task 8 and Task 9 continuously updated during the refactor, not only at the end

## Execution log

### 2026-04-18 - Phase 0 / Task 1 started

- Added architecture baseline docs in `src/docs/architecture/`
- Added security sync threat model in `src/docs/security/`
- Updated `README.md` to reflect the technical documentation and current engineering state
- Updated `AGENTS.md` to reflect the existing automated test toolchain and new frontend boundary rules
- Verified `src/docs/` discoverability with filesystem and README reference checks

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
