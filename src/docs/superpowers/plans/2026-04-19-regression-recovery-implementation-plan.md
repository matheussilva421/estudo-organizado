# Regression Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the app after the maturity-plan regressions by fixing confirmed UI, event, search, module, sync, and documentation drift without rewriting the vanilla ES module architecture.

**Architecture:** Keep the current zero-framework app, but make one runtime path authoritative per concern: one action dispatcher, one search implementation, one calendar module, one banca implementation, one sync conflict contract, and one source of progress truth.

**Tech Stack:** Vanilla ES modules, IndexedDB, localStorage recovery, Cloudflare Worker/KV, Vitest, Playwright, CSS modules split under `src/css/`

---

## Phase 0: Freeze the regressions into tests

**Goal:** prevent the current bugs from disappearing from sight again.

**Files:**

- Modify: `tests/e2e/app.spec.js`
- Create: `tests/unit/action-contracts.test.js`
- Create: `tests/unit/sync-conflict.test.js`
- Modify: `tests/unit/css-architecture.test.js`

**Tasks:**

- [x] Add E2E coverage for empty states in `med` and `ciclo`.
- [x] Add E2E coverage proving `#crono-mode-btn` changes from continuous to Pomodoro.
- [x] Add E2E coverage proving global search renders keyboard-focusable results and updates `aria-expanded`.
- [x] Add a static unit test that fails when an action is handled both by `src/js/main.js` and `src/js/ui/actions.js`.
- [x] Add a static unit test that fails on duplicate action keys inside `src/js/ui/actions.js`.
- [x] Add a sync unit test proving stale payloads cannot overwrite newer remote data.
- [x] Add CSS test coverage for `.empty-state` requiring column layout.

**Verification:**

```powershell
npm run test:unit
npm run test:e2e
```

**Acceptance criteria:**

- At least one new test fails before each fix or is proven to reproduce the audited issue.
- The suite includes UI states that match the screenshots: empty Study Organizer and empty Ciclo.

---

## Phase 1: Repair empty states and mobile CTA layout

**Goal:** fix the most visible UI breakage first.

**Files:**

- Modify: `src/css/components.css`
- Modify: `src/css/styles.css`
- Modify: `src/css/views.css`
- Modify if needed: `src/js/views.js`

**Tasks:**

- [x] Consolidate `.empty-state` into one definition with `display: flex`, `flex-direction: column`, centered text, `gap`, and responsive `max-width`.
- [x] Add an explicit `.empty-state-actions` or `.empty-state .btn` rule so CTA buttons keep readable width on mobile.
- [x] Remove conflicting empty-state declarations or make later stylesheet declarations intentionally override the base.
- [x] Audit empty state call sites: Study Organizer, Ciclo, RevisÃµes, HÃ¡bitos, Editais, Banca.
- [x] Verify desktop screenshot no longer shows inline icon/title/paragraph/button.
- [ ] Verify mobile screenshot no longer squeezes CTA text.

**Verification:**

```powershell
npm run test:e2e
```

Manual/browser:

- `Study Organizer` with no events
- `Ciclo de Estudos` with no plan
- viewport `390x844`
- viewport `1920x900`

---

## Phase 2: Collapse action handling into a single dispatcher

**Goal:** eliminate double execution and make button behavior predictable.

**Files:**

- Modify: `src/js/main.js`
- Modify: `src/js/ui/actions.js`
- Modify: `tests/unit/action-contracts.test.js`
- Modify affected tests in `tests/e2e/app.spec.js`

**Tasks:**

- [x] Move any remaining useful switch cases from `main.js` into `ui/actions.js`.
- [x] Remove the legacy `document.addEventListener('click', ...)` switch from `main.js`.
- [x] Keep `main.js` responsible for module bootstrapping and domain event listeners only.
- [x] Remove duplicate action keys inside `ui/actions.js`:
  - `add-minutes`
  - `open-event-detail`
  - `postpone-revision`
  - `toggle-assunto`
  - `open-disc-dashboard`
  - `close-modal`
  - `open-edital-modal`
- [x] Keep one canonical handler per action.
- [x] Add a small dev warning only for unknown actions, not for intentionally passive containers.
- [x] Fix `toggle-timer-mode` E2E so Pomodoro toggles exactly once.

**Verification:**

```powershell
npm run test:unit
npm run test:e2e
```

**Acceptance criteria:**

- Static contract test reports zero duplicate action handlers.
- `#crono-mode-btn` changes to Pomodoro and persists `state.config.pomodoroMode === true`.
- Navigation, modal close, Drive modal and timer mode all still work.

---

## Phase 3: Make global search one accessible implementation

**Goal:** remove the split between `main.js` search and `views.js` search.

**Files:**

- Modify: `src/js/main.js`
- Modify: `src/js/views.js`
- Consider create: `src/js/ui/search.js`
- Modify: `src/index.html`
- Modify: `src/css/styles.css`
- Modify: `tests/e2e/app.spec.js`

**Tasks:**

- [x] Extract global search state/rendering into `src/js/ui/search.js`, or choose `views.js` as the temporary canonical owner.
- [x] Ensure `data-action="search-input"` calls only the canonical implementation.
- [x] Render each result as `<button type="button" class="search-item">`.
- [x] Update `aria-expanded` to `true` when results are visible and `false` when closed.
- [x] Use `role="listbox"`/`option` only if implementing listbox keyboard behavior; otherwise prefer a plain results region with buttons.
- [x] Add keyboard support: ArrowDown/ArrowUp through results, Enter activates, Escape closes.
- [x] Announce result count through `#aria-announcer`.
- [x] Remove stale duplicate `window.debouncedOnSearch` definitions.

**Verification:**

```powershell
npm run test:e2e
```

Manual/browser:

- Type a known event, discipline and subject.
- Tab into results.
- Activate a result by keyboard.
- Confirm search closes and navigation happens.

---

## Phase 4: Finish or revert partial view extraction

**Goal:** stop maintaining files that look real but are not the runtime path.

**Files:**

- Modify: `src/js/views.js`
- Modify: `src/js/components.js`
- Modify: `src/js/views/calendar-view.js`
- Modify: `src/js/views/banca-view.js`
- Modify: `src/js/views/dashboard-view.js`
- Modify: `src/js/views/editais-view.js`
- Modify tests that scan extracted files

**Tasks:**

- [x] Decide per extracted module whether it is canonical now or should be deleted/parked.
- [x] Make `calendar-view.js` the canonical runtime calendar module, or remove it from tests/docs until extraction is real.
- [x] Ensure `components.js` imports `renderCalendar` from the canonical owner.
- [x] Restore actual Banca ranking behavior by importing real functions from `src/js/relevance.js` or moving the previous implementation correctly.
- [x] Replace placeholder functions in `banca-view.js`.
- [x] Add E2E for Banca Analyzer:
  - create/edit edital with topic
  - paste banca ranking
  - process
  - apply P1/P2/P3
  - assert topic relevance changed
- [x] Convert dashboard extracted tabs from `div` to semantic `button`.
- [x] Update docs after the runtime module graph is true.

**Verification:**

```powershell
npm run test:unit
npm run test:e2e
```

**Acceptance criteria:**

- No extracted view module is tested as if active unless imported by the runtime.
- Banca "Gravar P1/P2/P3" no longer hits placeholder failure.
- Calendar behavior comes from one module only.

---

## Phase 5: Harden Cloudflare sync for real conflict safety

**Goal:** make online/local-first sync safer against stale overwrites.

**Files:**

- Modify: `src/js/cloud-sync.js`
- Modify: `scripts/cloudflare-worker.js`
- Modify: `src/js/views.js`
- Modify: `src/docs/api/sync-contract.md`
- Create or modify: `tests/unit/sync-conflict.test.js`

**Tasks:**

- [x] Define a canonical sync envelope:
  - `version`
  - `deviceId`
  - `payload`
  - `payloadUpdatedAt`
  - `baseRemoteUpdatedAt`
  - `sentAt`
- [x] Stop using fresh `sentAt` as overwrite authority.
- [x] Worker must reject stale writes when `baseRemoteUpdatedAt` does not match current remote metadata, unless `forceOverwrite` is explicit.
- [x] Client must surface 409 conflict with a clear choice:
  - pull remote
  - force overwrite
  - export local backup first
- [x] Make `ALLOWED_ORIGINS` configurable and document deployment defaults.
- [x] Keep credentials outside exported/synced payloads and update `sync-contract.md` to match reality.
- [x] Add unit tests for:
  - old payload rejected
  - newer payload accepted
  - forced overwrite accepted only with explicit flag
  - credentials removed from payload

**Verification:**

```powershell
npm run test:unit
```

Manual/browser:

- Configure local Worker test endpoint or mocked fetch.
- Simulate device A update, device B stale push, conflict response.

---

## Phase 6: Continue design-system cleanup without breaking UI

**Goal:** resume CSS modernization after the P1 UI regressions are fixed.

**Files:**

- Modify: `src/index.html`
- Modify: `src/css/tokens.css`
- Modify: `src/css/base.css`
- Modify: `src/css/components.css`
- Modify: `src/css/views.css`
- Modify: `src/css/styles.css`
- Modify: `src/js/components.js`
- Modify: `src/js/planejamento-wizard.js`
- Modify: `src/js/views.js`
- Modify extracted view modules that remain canonical

**Tasks:**

- [ ] Classify remaining `style=` occurrences:
  - static layout style
  - dynamic color
  - dynamic width/progress
  - one-off modal dimensions
- [ ] Move static styles to CSS classes in batches by surface.
- [ ] Keep dynamic values inline only where CSS variables are not practical.
- [ ] Replace `transition: all` with explicit properties.
- [ ] Replace `outline: none` with `:focus-visible` alternatives.
- [ ] Add `aria-label` to icon-only buttons.
- [ ] Remove `style-src 'unsafe-inline'` only after static inline styles are gone or replaced with nonce/hash strategy.

**Verification:**

```powershell
npm run test:unit
npm run test:e2e
```

Manual/browser:

- Dark and light themes
- mobile and desktop
- modals, cards, empty states, calendar, dashboard

---

## Phase 7: Expand regression coverage to real user journeys

**Goal:** make tests catch the kinds of regressions seen in this audit.

**Files:**

- Modify: `tests/e2e/app.spec.js`
- Create optional: `tests/e2e/navigation.spec.js`
- Create optional: `tests/e2e/accessibility.spec.js`
- Create optional: `tests/e2e/sync.spec.js`

**Critical flows to cover:**

- [x] Fresh app, no data: all primary pages render clean empty states.
- [x] Create edital, discipline and subject.
- [x] Create study event from Study Organizer.
- [x] Create event from Calendar date.
- [x] Start, pause, add minutes, discard timer.
- [x] Toggle Pomodoro/Continuous.
- [x] Mark studied and complete Registro de Sessao.
- [x] Revisions appear after subject completion.
- [x] Search event/discipline/subject/habit.
- [x] Ciclo wizard creates a plan.
- [x] Ciclo "Iniciar Estudo" creates an event.
- [x] Banca Analyzer applies ranking.
- [x] Config toggles persist after reload.
- [x] Export JSON and import validation.
- [x] Mobile navigation and no horizontal overflow.

**Verification:**

```powershell
npm run test:e2e
```

**Acceptance criteria:**

- E2E suite covers at least one assertion per sidebar item.
- Each P1 bug from this audit has a regression test.

---

## Phase 8: Align PWA and documentation with the real runtime

**Goal:** make the plan, docs, CI and service worker truthful.

**Files:**

- Modify: `src/sw.js`
- Modify: `src/docs/superpowers/plans/2026-04-18-app-maturity-implementation-plan.md`
- Modify: `src/docs/superpowers/plans/2026-04-18-fase-progress.md`
- Modify: `src/docs/api/sync-contract.md`
- Modify: `README.md`
- Modify: `src/docs/qa/manual-regression-checklist.md`
- Modify: `src/docs/releases/release-checklist.md`

**Tasks:**

- [x] Add all runtime modules to `ASSET_PATHS`, including `ui/*` and canonical `views/*`.
- [x] Add an offline E2E smoke or manual checklist step that actually reloads offline.
- [x] Mark the old maturity plan as superseded by this recovery plan where appropriate.
- [x] Remove "All tasks completed" until the regression plan is executed.
- [x] Resolve duplicate Task 7 numbering.
- [x] Make `fase-progress.md` and the main plan agree.
- [x] Update `sync-contract.md` after the conflict model is implemented.
- [x] Keep CI workflow documented and linked.

**Verification:**

```powershell
npm run test:unit
npm run test:e2e
```

Manual/browser:

- Load app once online.
- Reload offline.
- Navigate to pages backed by extracted modules.

---

## Recommended execution order

1. Phase 0 - tests for current regressions
2. Phase 1 - empty-state UI repair
3. Phase 2 - single action dispatcher
4. Phase 3 - search accessibility
5. Phase 4 - module extraction truth and Banca fix
6. Phase 5 - sync conflict hardening
7. Phase 6 - CSS/CSP cleanup
8. Phase 7 - broader E2E coverage
9. Phase 8 - PWA/docs alignment

## Definition of recovery complete

- Empty states are visually correct on desktop and mobile.
- No action is handled by both `main.js` and `ui/actions.js`.
- No duplicate action key exists in `ui/actions.js`.
- Search results are semantic, keyboard-usable and announce result count.
- Banca Analyzer can persist P1/P2/P3 ranking.
- Cloudflare sync rejects stale overwrite attempts.
- Tests fail if any of the above regress.
- Old plan and progress docs no longer claim unverified completion.

## Implementation log

### 2026-04-19 - Recovery slice 1

Implemented the first recovery slice covering the most visible UI regressions and the double-dispatch bug.

Changed files:

- `src/css/components.css`
- `src/css/styles.css`
- `src/js/main.js`
- `src/js/ui/actions.js`
- `src/js/views.js`
- `tests/e2e/app.spec.js`
- `tests/unit/action-contracts.test.js`
- `tests/unit/css-architecture.test.js`

What changed:

- Added RED tests for empty states, Pomodoro toggle, accessible global search, duplicate action keys and double action dispatch.
- Fixed `.empty-state` layout to stack icon, text and CTA vertically.
- Removed the legacy `data-action` click switch from `main.js`; `main.js` now stays focused on bootstrapping and domain events.
- Moved useful legacy actions into `src/js/ui/actions.js` and removed duplicate action keys.
- Chose `views.js` as the temporary canonical search owner and removed the stale search override from `main.js`.
- Updated search open/close state through `aria-expanded`.

Verification:

```powershell
npm run test:unit -- tests/unit/action-contracts.test.js tests/unit/css-architecture.test.js
npm run test:e2e -- tests/e2e/app.spec.js
npm test
npm run test:e2e
```

Results:

- Unit targeted: 8 passed
- E2E targeted: 5 passed
- Full unit: 59 passed
- Full E2E: 5 passed

Remaining in the next slice:

- Sync conflict regression tests and Cloudflare stale-write protection.
- Broader empty-state/browser verification on mobile screenshots.
- Search ArrowUp/ArrowDown keyboard behavior and ARIA role cleanup.
- Banca/extracted-module cleanup from Phase 4.

### 2026-04-19 - Recovery slice 2

Implemented the Cloudflare sync conflict contract.

Changed files:

- `src/js/cloud-sync.js`
- `scripts/cloudflare-worker.js`
- `src/docs/api/sync-contract.md`
- `tests/unit/sync-conflict.test.js`
- `src/docs/superpowers/plans/2026-04-19-regression-recovery-implementation-plan.md`

What changed:

- Added RED/GREEN unit tests for stale base rejection, matching base acceptance, explicit force overwrite and credential stripping.
- Updated the client envelope to version 2 with `baseRemoteUpdatedAt`, `payloadUpdatedAt` and `sentAt`.
- Removed fresh send time as overwrite authority.
- Updated the Worker to reject versioned writes when the client's base remote metadata does not match the current remote metadata.
- Stored accepted remote metadata back into `state.config.cfRemoteUpdatedAt`.
- Updated `sync-contract.md` to describe the current implementation instead of the older target model.

Verification:

```powershell
npm run test:unit -- tests/unit/sync-conflict.test.js
npm test
npm run test:e2e
```

Result:

- Sync conflict unit tests: 4 passed
- Full unit: 63 passed
- Full E2E: 5 passed

Remaining in the next slice:

- Conflict UX actions: export local backup, pull remote, or force overwrite from the 409 state.
- Configurable `ALLOWED_ORIGINS` deployment defaults.
- Search ArrowUp/ArrowDown keyboard behavior and ARIA role cleanup.

### 2026-04-19 - Recovery slice 3

Completed the remaining accessible-search keyboard slice.

Changed files:

- `src/index.html`
- `src/js/views.js`
- `tests/e2e/app.spec.js`
- `src/docs/superpowers/plans/2026-04-19-regression-recovery-implementation-plan.md`

What changed:

- Replaced the search results container role from `listbox` to a plain `region` with `aria-live="polite"` because results are rendered as real buttons.
- Added ArrowDown/ArrowUp focus movement through search result buttons.
- Added Escape behavior that closes search and restores focus to the search input.
- Expanded the E2E search regression to assert region semantics, arrow navigation and close behavior.

Verification:

```powershell
npm run test:e2e -- tests/e2e/app.spec.js -g "global search"
npm test
npm run test:e2e
```

Results:

- Search E2E focused: 1 passed
- Full unit: 63 passed
- Full E2E: 5 passed

Remaining in the next slice:

- Conflict UX actions: export local backup, pull remote, or force overwrite from the 409 state.
- Configurable `ALLOWED_ORIGINS` deployment defaults.
- Banca/extracted-module cleanup from Phase 4.

### 2026-04-19 - Recovery slice 4

Added a visible Cloudflare conflict-resolution panel in Settings.

Changed files:

- `src/js/views.js`
- `src/js/ui/actions.js`
- `src/js/cloud-sync.js`
- `src/css/views.css`
- `src/docs/api/sync-contract.md`
- `tests/e2e/app.spec.js`
- `src/docs/superpowers/plans/2026-04-19-regression-recovery-implementation-plan.md`

What changed:

- Added an E2E regression for a seeded `state.config.cfConflict`.
- Rendered a Cloudflare conflict panel with explicit actions:
  - export local backup
  - pull remote
  - force local overwrite
- Wired the conflict actions through the central `data-action` dispatcher.
- Added confirmations before destructive pull/force-push actions.
- Cleared `cfConflict` after a successful forced remote pull.
- Documented the conflict UX in `sync-contract.md`.

Verification:

```powershell
npm run test:e2e -- tests/e2e/app.spec.js -g "Cloudflare sync conflict"
npm test
npm run test:e2e
```

Results:

- Conflict E2E focused: 1 passed
- Full unit: 63 passed
- Full E2E: 6 passed

Remaining in the next slice:

- Configurable `ALLOWED_ORIGINS` deployment defaults.
- Banca/extracted-module cleanup from Phase 4.
- Broader E2E journeys across sidebar pages.

### 2026-04-19 - Recovery slice 5

Made Worker browser-origin enforcement configurable.

Changed files:

- `scripts/cloudflare-worker.js`
- `tests/unit/sync-conflict.test.js`
- `src/docs/api/sync-contract.md`
- `src/docs/superpowers/plans/2026-04-19-regression-recovery-implementation-plan.md`

What changed:

- Added tests for configured allowed/disallowed browser origins.
- Added `env.ALLOWED_ORIGINS` parsing as a comma-separated allowlist.
- Kept backward-compatible permissive behavior when no origins are configured.
- Blocked browser requests from origins outside the configured allowlist with HTTP 403.
- Changed allowed CORS preflight responses to HTTP 204.
- Documented the deployment variable and default behavior.

Verification:

```powershell
npm run test:unit -- tests/unit/sync-conflict.test.js
npm test
npm run test:e2e
```

Result:

- Sync/Worker unit tests: 6 passed
- Full unit: 65 passed
- Full E2E: 6 passed

Remaining in the next slice:

- Banca/extracted-module cleanup from Phase 4.
- Broader E2E journeys across sidebar pages.

### 2026-04-19 - Recovery slice 6

Restored the Banca Analyzer runtime behavior in the extracted view module.

Changed files:

- `src/js/views/banca-view.js`
- `tests/e2e/app.spec.js`
- `src/docs/superpowers/plans/2026-04-19-regression-recovery-implementation-plan.md`

What changed:

- Added a RED E2E regression for the extracted Banca Analyzer flow: open Banca, select a discipline, paste ranking text, process, apply P1/P2/P3 and assert persisted subject relevance.
- Changed `banca-view.js` to use the shared `src/js/relevance.js` ranking, commit and revert functions instead of local placeholders.
- Fixed the extracted Banca render path to call its local `renderBancaAnalyzerContent` instead of a missing `window._renderBancaAnalyzerContent`.
- Rebound Banca global action handlers when the extracted view opens so `data-action` clicks use the same analyzer context that rendered the screen.
- Imported the shared `uid` helper into the extracted module so parsing hot topics no longer depends on legacy `views.js` scope.

Verification:

```powershell
npm run test:e2e -- tests/e2e/app.spec.js -g "Banca Analyzer"
npm test
npm run test:e2e
```

Result:

- Banca E2E focused: 1 passed
- Full unit: 65 passed
- Full E2E: 7 passed

Remaining in the next slice:

- Decide the remaining extracted modules' canonical runtime ownership in Phase 4.
- Broader E2E journeys across sidebar pages.

### 2026-04-19 - Recovery slice 8

Made the extracted calendar view the runtime calendar owner.

Changed files:

- `src/js/components.js`
- `src/js/main.js`
- `src/js/views/calendar-view.js`
- `tests/unit/action-contracts.test.js`
- `src/docs/superpowers/plans/2026-04-19-regression-recovery-implementation-plan.md`
- `src/docs/superpowers/plans/2026-04-19-codebase-audit-report.md`

What changed:

- Added a RED unit contract requiring `components.js` to import `renderCalendar` from `src/js/views/calendar-view.js`.
- Added a runtime bridge contract requiring `main.js` to expose `calendar-view.js` exports to `window`.
- Switched `components.js` to render the calendar from the extracted module.
- Added `calendar_view` to the `main.js` module exposure list after `views`, so calendar actions use the extracted module's `calNavigate`, `resetCalDate` and `setCalViewMode`.
- Fixed `calendar-view.js` to import `getEventStatus` from `utils.js`, where it is actually exported.
- Updated calendar view-mode tabs in `calendar-view.js` to semantic `button type="button"` tabs with `role`, `aria-selected` and `aria-controls`.
- Made extracted `setCalViewMode` trigger `window.renderCurrentView()` so the UI updates after switching month/week.

Verification:

```powershell
npm run test:unit -- tests/unit/action-contracts.test.js
npm test
npm run test:e2e
```

Result:

- Action contract focused: 5 passed
- Full unit: 67 passed
- Full E2E: 7 passed

Remaining in the next slice:

- Decide/record ownership for the remaining extracted modules in Phase 4.
- Broader E2E journeys across sidebar pages.

### 2026-04-19 - Recovery slice 7

Converted the extracted discipline dashboard tabs to semantic controls.

Changed files:

- `src/js/views/dashboard-view.js`
- `tests/unit/action-contracts.test.js`
- `src/docs/superpowers/plans/2026-04-19-regression-recovery-implementation-plan.md`

What changed:

- Added a RED unit contract that rejects `<div data-action="switch-dashboard-tab">` in the extracted dashboard module.
- Converted the `topicos`, `aulas` and `banca` dashboard tabs to `button type="button"` controls.
- Added `role="tablist"`, `role="tab"` and `aria-selected` state for the extracted dashboard tab group.
- Normalized tab selection through a single `activeDashboardTab` value so default `topicos` behavior stays explicit.

Verification:

```powershell
npm run test:unit -- tests/unit/action-contracts.test.js
npm test
npm run test:e2e
```

Result:

- Action contract focused: 4 passed
- Full unit: 66 passed
- Full E2E: 7 passed

### 2026-04-19 - Recovery slice 9

Consolidated empty-state CSS and removed legacy banca code.

Changed files:

- `src/css/styles.css`
- `src/css/components.css`
- `src/js/views.js`

What changed:

- Moved `.empty-state` child selectors (`.icon`, `h4`, `p`) into `components.css` alongside the canonical flex-column definition.
- Removed the duplicate legacy `.empty-state` block from `styles.css`.
- Re-exported all banca functions from `banca-view.js` through `views.js` so `main.js` exposes them to `window`.
- Removed the 466-line legacy banca block from `views.js` (lines 2564-3029).

Verification: Full unit: 67 passed

### 2026-04-19 - Recovery slice 10

Added missing runtime modules to service worker precache.

Changed files: `src/sw.js`

What changed: Added `js/ui/actions.js`, `js/ui/dialog.js`, `js/ui/dom.js`, and all 5 `js/views/*.js` modules to `ASSET_PATHS`.

### 2026-04-19 - Recovery slice 11

Design system cleanup: scoped transitions, outline cleanup, aria-labels.

Changed files: `src/css/styles.css`, `src/css/views.css`, `src/js/views.js`, `src/js/views/calendar-view.js`

What changed:

- Replaced 4 `transition: all` with scoped property lists.
- Moved `outline: none` from base selectors to `:focus` selectors.
- Added `aria-label` to 10+ icon-only buttons.

### 2026-04-19 - Recovery slice 12

Expanded E2E coverage from 7 to 12 tests.

New tests: sidebar pages render, Pomodoro persists after reload, config persists after reload, search by keyboard, no mobile overflow.

Verification: Full unit: 67 passed, Full E2E: 12 passed

### 2026-04-19 - Recovery slice 13

Documentation alignment with runtime reality.

Changed files: `src/docs/architecture/app-overview.md`, `src/docs/superpowers/plans/2026-04-18-app-maturity-implementation-plan.md`

What changed:

- Added all new modules to the architecture runtime map.
- Updated fragilities and direction sections.
- Removed duplicate Task 7 entry and added superseded notice to old maturity plan.

### 2026-04-20 - Recovery slice 14

Stabilized the new regression tests and expanded Phase 7 journey coverage.

Changed files:

- `src/js/ui/actions.js`
- `src/js/views.js`
- `tests/e2e/app.spec.js`
- `tests/e2e/calendar.spec.js`
- `tests/e2e/editais.spec.js`
- `tests/e2e/planejamento.spec.js`
- `tests/e2e/revisoes-habitos.spec.js`
- `tests/e2e/sessoes.spec.js`
- `tests/unit/logic.test.js`
- `README.md`
- `src/docs/superpowers/plans/2026-04-18-fase-progress.md`
- `src/docs/superpowers/plans/2026-04-19-regression-recovery-implementation-plan.md`

What changed:

- Fixed the central dispatcher to accept the runtime `data-tipo` and `data-mat` contracts emitted by the session-registration modal.
- Restored `window.addAssunto` so the Editais subject-manager action contract can create topics through the dispatcher.
- Added E2E coverage for edital/discipline/subject creation, calendar-date event creation, planning wizard, Ciclo "Iniciar Estudo", revision completion, habit registration, manual session registration, free chronometer session save, habit search, and timer start/pause/add/discard.
- Kept export JSON covered; import validation remains open because the current E2E only verifies export.
- Documented the CI workflow in the README and refreshed `fase-progress.md` with the current recovery status.

Verification:

```powershell
npm test
npm run test:e2e -- tests/e2e/revisoes-habitos.spec.js tests/e2e/sessoes.spec.js
npm run test:e2e -- tests/e2e/calendar.spec.js tests/e2e/app.spec.js tests/e2e/planejamento.spec.js
npm run test:e2e
```

Results:

- Full unit: 70 passed
- Focused session/revision/habit E2E: 4 passed
- Focused calendar/app/planning E2E: 20 passed
- Full E2E: 25 passed

### 2026-04-20 - Recovery slice 15

Closed the remaining Phase 8 offline/import validation gaps.

Changed files:

- `src/js/views.js`
- `tests/e2e/offline-import.spec.js`
- `src/docs/superpowers/plans/2026-04-19-regression-recovery-implementation-plan.md`
- `src/docs/superpowers/plans/2026-04-18-fase-progress.md`

What changed:

- Added an offline E2E that allows service workers only for that spec, waits for the precache to be ready, switches the browser context offline and reloads the app.
- Hardened local JSON import by appending the generated file input to the DOM and removing it after `FileReader` completes.
- Added import-validation E2E for an invalid backup shape and blocked `sw-register.js` in that test to avoid unrelated service-worker controller reloads.

Verification:

```powershell
npm run test:e2e -- tests/e2e/offline-import.spec.js
npm test
npm run test:e2e
```

Result:

- Focused offline/import E2E: 2 passed
- Full unit: 70 passed
- Full E2E: 27 passed
