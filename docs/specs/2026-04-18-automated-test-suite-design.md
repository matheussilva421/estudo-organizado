# Automated Test Suite Design

## Context

`estudo-organizado` is a vanilla HTML/CSS/ES module web app served directly from `src/` without a Node-based build step. The codebase has no automated tests yet, and current validation depends on manual browser checks for study flows, persistence, dashboard behavior, and responsive layouts.

The most important risks are concentrated in:

- domain logic inside `src/js/logic.js`
- state normalization and migrations inside `src/js/store.js`
- user-critical flows that depend on IndexedDB persistence and page reload behavior

## Goals

- Add an automated test suite that can run through standard npm commands.
- Cover both business logic and real browser behavior.
- Keep the production app framework-free and avoid introducing a build system.
- Make it easy to extend tests incrementally as the app evolves.

## Non-Goals

- Full automation of Cloudflare sync, Google Drive sync, browser notifications, audio playback, or offline service worker behavior in the first version
- Rewriting production modules into a framework or large architectural refactor
- Exhaustive UI snapshot coverage for every screen in the app

## Approaches Considered

### 1. Vitest + Playwright

Recommended.

- `Vitest` provides fast unit and lightweight integration tests for pure or mostly pure logic.
- `Playwright` exercises the real app in a browser with DOM, storage, and reload validation.
- This combination matches the repository shape well and keeps setup straightforward.

### 2. Jest + Playwright

Viable, but heavier for this repo.

- More configuration friction for ES modules and browser-adjacent code
- No clear benefit over `Vitest` here

### 3. Playwright Only

Too narrow for a first automated suite.

- Good for real flows
- Weak protection for calculation-heavy rules and migrations
- Slower feedback loop for logic regressions

## Recommended Design

The suite will use two layers:

### Unit and Integration Layer

Tooling:

- `Vitest`
- `jsdom` for modules that need a DOM-like environment

Primary coverage:

- `src/js/logic.js`
  - `calcRevisionDates`
  - `getPendingRevisoes`
  - `calculateRelevanceWeights`
  - `generatePlanejamento`
  - `getConsistencyStreak`
  - `getPredictiveStats`
- `src/js/store.js`
  - `setState`
  - `runMigrations`
  - schema normalization and default population
- selected pure utilities from `src/js/utils.js` when useful for stable date and formatting assertions

Testing strategy:

- Prefer real function inputs and shared state setup over mock-heavy tests.
- Reset imported mutable state between tests.
- Stub only unavoidable browser globals such as `document`, `window`, `localStorage`, `sessionStorage`, `indexedDB`, `Audio`, and `Notification`.
- Separate truly pure tests from browser-environment tests so failures are easy to localize.

### End-to-End Layer

Tooling:

- `Playwright`

Primary flows:

- app boot renders the home screen successfully
- create a study event through the real UI
- verify the event appears in the expected view
- reload the page and confirm persistence
- navigate to related views such as calendar and dashboard and validate that the created data is reflected
- automate one stable 'study completed' path if the UI flow proves deterministic enough during implementation

Testing strategy:

- Serve `src/` through a simple local static server started by the test runner.
- Use a dedicated browser storage state per test run to avoid cross-test contamination.
- Favor robust selectors and user-visible assertions over brittle implementation details.

## File and Config Structure

Expected additions:

- `package.json`
- `package-lock.json`
- `vitest.config.js`
- `playwright.config.js`
- `tests/unit/`
- `tests/e2e/`
- `tests/fixtures/`
- `tests/helpers/`

Suggested helper responsibilities:

- test state builders for editais, disciplinas, assuntos, eventos, and planejamento
- browser/global shims for unit tests
- reusable E2E setup helpers for bootstrapping known app state

## Commands

The project will expose standard npm commands:

- `npm test` for unit tests
- `npm run test:unit` as an explicit alias
- `npm run test:e2e` for Playwright tests
- `npm run test:e2e:ui` for local interactive debugging

If needed, an additional `test:all` command can be included to run both layers sequentially.

## Data and State Strategy

Because the app relies on mutable module state and IndexedDB-related behavior:

- unit tests will explicitly seed and reset `state`
- migration tests will run against crafted legacy-like state payloads
- E2E tests will initialize clean browser contexts
- where practical, E2E tests may inject prepared local state to reduce setup time for longer flows

## Error Handling and Reliability

The suite should remain reliable on local machines and CI-like environments:

- disable or stub browser features that can create nondeterminism in tests
- avoid dependence on external network services
- keep the first test batch focused on deterministic flows
- treat flaky selectors or timing assumptions as defects in the tests and tighten them before expanding scope

## Rollout Plan

Implementation should proceed in this order:

1. Add Node test tooling and baseline npm scripts.
2. Configure `Vitest` and create shared test helpers.
3. Write the first failing unit tests for stable logic functions.
4. Implement any minimal testability adjustments required by those tests.
5. Configure `Playwright` with static serving of `src/`.
6. Add the first failing E2E tests for app boot, event creation, and persistence.
7. Document the new commands in `README.md`.

## Verification Plan

Before considering the work complete:

- run unit tests successfully
- run E2E tests successfully
- confirm the app still opens normally through the existing local flow
- verify documentation reflects the new workflow

## Risks and Mitigations

### Risk: Browser-coupled modules are hard to import in unit tests

Mitigation:

- start with the most deterministic exported functions
- add narrow shims in test setup
- keep production changes minimal and only where testability truly requires it

### Risk: E2E selectors are brittle in a large DOM

Mitigation:

- prefer labels, text, and stable semantic hooks
- add small test-friendly attributes only when necessary

### Risk: Stateful modules leak data across tests

Mitigation:

- centralize state reset helpers
- isolate browser contexts for E2E

## Decision

Adopt `Vitest + Playwright` as the first automated testing stack, with an initial scope focused on core business logic and the most important persistence-driven user journeys.
