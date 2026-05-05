# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the app shipped to users: `index.html`, `manifest.json`, `sw.js`, `css/styles.css`, and feature modules in `src/js/`. Keep new logic inside the existing module split (`store.js` for persistence, `logic.js` for domain rules, `views.js` for rendering, `components.js` for reusable UI pieces). As the codebase is modularized, prefer responsibility-based folders under `src/js/` such as `views/`, `ui/`, or `services/` instead of extending already-large files indefinitely. Use `scripts/` only for one-off maintenance or migration helpers. Keep static documentation close to the app, for example `src/docs/`.

## Build, Test, and Development Commands
Run the app locally with the existing launcher:

```powershell
.\Abrir_Estudo_Organizado.bat
```

Manual local serving also works:

```powershell
python -m http.server 8000 --directory src
npx http-server src -p 8080
```

Cloudflare asset preview and deploy use Wrangler:

```powershell
npx wrangler dev
npx wrangler deploy
```

Use the maintenance scripts only when their purpose is clear, e.g. `node scripts/fix-all.js`.

## Coding Style & Naming Conventions
This repository is plain HTML, CSS, and vanilla ES modules. Follow the existing style: 2-space indentation, semicolons, single quotes, and small top-level comments only where they add context. Prefer `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for true constants, and `kebab-case` for filenames such as `registro-sessao.js`. Preserve the zero-framework approach unless a broader change is agreed first.

## Testing Guidelines
The repository now has an initial automated test toolchain with Vitest and Playwright configured in `package.json`, even if coverage is still incomplete. Every change should include the most relevant automated command when possible plus manual verification in the browser: load the app, exercise the affected flow, refresh to confirm IndexedDB persistence, and re-check related dashboard or calendar views. For UI work, verify desktop and mobile layouts. For sync changes, test both success and failure states.

Recommended commands:

```powershell
npm test
npm run test:e2e
```

If the local environment is missing dependencies, record that clearly in the final handoff.

## Low-Context Agent Workflow
For small changes, work with the smallest useful context. Read only the files directly related to the request plus direct imports when needed. Do not scan the whole repository to make a localized change.

Do not read, list, or search these paths by default unless the user explicitly asks:

- `node_modules/`
- `.git/`
- `.claude/`
- `.sisyphus/`
- `.playwright-mcp/`
- `coverage/`
- `playwright-report/`
- `test-results/`
- `_local_archive/`
- `output/`
- `src/vendor/`
- `src/docs/superpowers/plans/`
- `package-lock.json`

Use a scoped search pattern such as:

```powershell
rg "termo" src tests scripts -g '!src/vendor/**' -g '!node_modules/**' -g '!coverage/**' -g '!playwright-report/**' -g '!test-results/**' -g '!package-lock.json'
```

## Microchange Mode
Use this mode for text, CSS, localized UI, or small logic changes:

- name the files you expect to touch before editing;
- avoid broad repository exploration;
- run the most specific test available first;
- do not run coverage, full E2E, `test:all`, commit, push, or open a PR unless the user asks for closure/publication.

`README_DEV.md` contains the current file map and test matrix.

## Closure Mode
Use this mode when the user asks to finish, publish, commit, push, release, or validate broadly:

- review `git diff --stat`;
- run targeted tests first;
- run `npm test`;
- run E2E when the change affects UI flow, sync, PWA/offline, or visible layout;
- stage only intended files;
- commit with a scoped conventional message;
- push only when requested or when the task explicitly says to update GitHub.

## Commit & Pull Request Guidelines
Recent history follows scoped conventional commits such as `fix(calendar): layout vertical para dias mobile`. Keep that pattern: `<type>(<scope>): <imperative summary>`. Pull requests should include a concise description, linked issue when applicable, manual test steps, and screenshots or recordings for visible UI changes.

## Security & Configuration Tips
Do not commit tokens, OAuth credentials, or exported study data. Keep Cloudflare secrets in Wrangler/environment bindings, and document any new config in `README.md` or a focused file under `src/docs/`.

## Frontend Boundary Rules
Prefer delegated events and explicit `data-action` contracts over inline handlers for new UI work. Prefer DOM helpers or focused render helpers over growing HTML template strings unchecked. When touching a large file like `views.js` or `styles.css`, make the smallest useful extraction toward a dedicated module instead of only appending more logic in place.
