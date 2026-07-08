# Release Checklist

## Pre-release

- [ ] All unit tests green (`npm run test:unit`)
- [ ] All E2E tests green (`npm run test:e2e`)
- [ ] No inline event handlers in production code (`grep -E 'onclick|onchange|oninput|onkeyup' src/js/ src/index.html`)
- [ ] CSP has no `unsafe-eval` in `script-src`
- [ ] Service worker asset list is up to date
- [x] Version bumped in `sw.js` (`APP_VERSION`) — AUTOMATICO via hook `pre-commit` (`.githooks/pre-commit`); manual com `npm run bump`, verificacao com `npm run bump:check`

## Visual & UX

- [ ] Light theme verified
- [ ] Dark theme verified
- [ ] Mobile viewport (480px) verified
- [ ] Desktop viewport (1280px+) verified
- [ ] Offline shell works after one successful load

## Sync & Data

- [ ] Sync push/pull works with valid credentials
- [ ] Sync fails gracefully with invalid credentials
- [ ] No data loss on schema migration
- [ ] Backup export/import works
- [ ] Firestore permission denied shows action needed without opening a blocking modal
- [ ] Entity conflict review shows human choices and no raw JSON by default
- [ ] Export after conflict has no Cloudflare token/URL, Firestore uid, Drive file id, or conflict history
- [ ] `firestore.rules` keeps owner scope, immutable entity identity, positive revision, tombstone validation, and no physical deletes
- [ ] Rapid local edits with Firestore enabled remain responsive and persist after reload

## After Release

- [ ] Update README if commands or architecture changed
- [ ] Update CLAUDE.md if patterns or conventions changed
- [ ] Tag release in git

## Bug Severity Classification

| Level | Description | Examples |
|-------|-------------|----------|
| **P0** | Data loss, broken boot, broken save, destructive sync overwrite | App won't load, IndexedDB data corrupted, sync overwrites newer state |
| **P1** | Critical flow blocked, accessibility blocker, broken install/offline | Can't create events, timer broken, PWA won't install, keyboard trap |
| **P2** | Layout defect, incorrect metric, degraded but usable flow | Misaligned card, wrong streak count, slow render |

## Definition of Done

A feature is only complete when:

- Keyboard-accessible (tab navigation, focus visible)
- Covered by unit or smoke tests where relevant
- Documented if user-facing
- Does not add new inline event handlers
- Does not increase global `window` API unnecessarily
- Uses CSS tokens/classes instead of inline styles
- Works in both light and dark themes
