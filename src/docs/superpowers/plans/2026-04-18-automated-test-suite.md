# Automated Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a maintainable automated test suite with unit coverage for core business logic and browser E2E coverage for critical user flows.

**Architecture:** Use `Vitest` for fast unit and light integration tests around stateful business logic, and `Playwright` for real browser flows against the static `src/` app. Keep production changes minimal and focused on testability only where imports or selectors are currently too brittle.

**Tech Stack:** Vanilla ES modules, Vitest, jsdom, Playwright, npm scripts, static file serving

---

### Task 1: Bootstrap test tooling

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `playwright.config.js`
- Create: `tests/helpers/test-env.js`

- [ ] Step 1: Add npm metadata and scripts for unit and E2E runs.
- [ ] Step 2: Add Vitest config with a jsdom environment and shared setup file.
- [ ] Step 3: Add Playwright config that serves `src/` locally for browser tests.
- [ ] Step 4: Add shared browser-like shims for globals used by imported modules.
- [ ] Step 5: Run the first unit test command and confirm the suite fails because no tests exist yet or config is incomplete.

### Task 2: Add unit test helpers and first logic tests

**Files:**
- Create: `tests/helpers/state-builders.js`
- Create: `tests/helpers/module-loader.js`
- Create: `tests/unit/logic.test.js`

- [ ] Step 1: Write failing tests for deterministic logic functions such as `calcRevisionDates`, `calculateRelevanceWeights`, and `getPendingRevisoes`.
- [ ] Step 2: Run only the new logic tests and verify they fail for the expected import or environment reasons first.
- [ ] Step 3: Add test helpers to seed and reset shared module state without mocking the core behavior.
- [ ] Step 4: Make the smallest production-safe testability adjustment only if imports remain blocked.
- [ ] Step 5: Re-run the logic tests until they pass cleanly.

### Task 3: Add store and migration tests

**Files:**
- Create: `tests/unit/store.test.js`
- Modify: `tests/helpers/test-env.js`
- Modify: `tests/helpers/module-loader.js`

- [ ] Step 1: Write failing tests for `setState` normalization and `runMigrations`.
- [ ] Step 2: Run only the store tests and verify red before changing production code.
- [ ] Step 3: Extend shared test shims for storage and IndexedDB-related globals only as needed.
- [ ] Step 4: Make minimal production changes if migration or state functions cannot be tested safely as-is.
- [ ] Step 5: Re-run the store tests and confirm all unit tests are green together.

### Task 4: Add end-to-end test coverage

**Files:**
- Create: `tests/e2e/app.spec.js`
- Create: `tests/helpers/e2e-state.js`
- Modify: `playwright.config.js`

- [ ] Step 1: Write a failing Playwright test for app boot and home screen rendering.
- [ ] Step 2: Run only that E2E test and verify it fails for the intended reason.
- [ ] Step 3: Add the minimal helper logic needed to create a clean browser context and stable app startup.
- [ ] Step 4: Add failing tests for creating a study event and preserving it after reload.
- [ ] Step 5: Make only the minimum selector or boot adjustments needed for reliable automation.
- [ ] Step 6: Re-run the E2E suite until the covered flows pass consistently.

### Task 5: Document and verify the suite

**Files:**
- Modify: `README.md`
- Modify: `src/docs/superpowers/plans/2026-04-18-automated-test-suite.md`

- [ ] Step 1: Update repository documentation with the new install and test commands.
- [ ] Step 2: Run the full unit suite.
- [ ] Step 3: Run the full E2E suite.
- [ ] Step 4: Re-check that the app still loads through the existing static flow.
- [ ] Step 5: Mark the plan complete once verification evidence is captured.
