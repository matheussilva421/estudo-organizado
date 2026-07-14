# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the app: `index.html`, `manifest.json`, `sw.js`, `css/styles.css`, and feature modules in `src/js/`. Keep new logic inside existing module split (`store.js` for persistence, `logic.js` for domain rules, `views.js` for rendering, `components.js` for reusable UI pieces). Prefer responsibility-based folders under `src/js/` such as `views/`, `ui/`, or `services/`. Use `scripts/` only for one-off maintenance. Keep all documentation in `docs/` (root) — see `docs/README.md` for the layout. `src/` holds only shipped app code.

## Build, Test, and Development Commands
Run locally:

```powershell
.\Abrir_Estudo_Organizado.bat
```

Manual serving:

```powershell
python -m http.server 8000 --directory src
npx http-server src -p 8080
```

Cloudflare deploy:

```powershell
npx wrangler dev
npx wrangler deploy
```

## Coding Style & Naming Conventions
Plain HTML, CSS, and vanilla ES modules. 2-space indentation, semicolons, single quotes. `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for constants, `kebab-case` for filenames. Preserve zero-framework approach.

## Testing Guidelines
Every change needs automated tests when possible plus manual verification: load app, exercise flow, refresh to confirm IndexedDB persistence, re-check dashboard/calendar views. Verify desktop and mobile layouts. For sync changes, test success and failure states.

Recommended commands:

```powershell
npm test
npm run test:e2e
```

## Low-Context Agent Workflow
For small changes, read only directly related files plus direct imports. Do not scan whole repository.

Do not read, list, or search by default:

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
- `docs/plans/`
- `package-lock.json`

Scoped search:

```powershell
rg "termo" src tests scripts -g '!src/vendor/**' -g '!node_modules/**' -g '!coverage/**' -g '!playwright-report/**' -g '!test-results/**' -g '!package-lock.json'
```

## Microchange Mode
For text, CSS, localized UI, or small logic changes:

- name files to touch before editing;
- avoid broad exploration;
- run specific test first;
- do not run coverage, full E2E, `test:all`, commit, push, or PR unless user asks for closure.

`README_DEV.md` contains file map and test matrix. See `docs/context-budget-playbook.md` for context policies and subagent guidelines.

## Closure Mode
When user asks to finish, publish, commit, push, release, or validate:

- review `git diff --stat`;
- run targeted tests first;
- run `npm test`;
- run E2E when change affects UI flow, sync, PWA/offline, or visible layout;
- stage only intended files;
- commit with scoped conventional message;
- push only when requested or task says to update GitHub.

## Commit & Pull Request Guidelines
Scoped conventional commits: `<type>(<scope>): <imperative summary>`. PRs need concise description, linked issue, manual test steps, and screenshots for UI changes.

## Security & Configuration Tips
Do not commit tokens, OAuth credentials, or exported study data. Keep Cloudflare secrets in Wrangler/environment bindings. Document new config in `README.md` or `docs/`.

## Frontend Boundary Rules
Prefer delegated events and explicit `data-action` contracts over inline handlers. Prefer DOM helpers over growing HTML template strings. When touching large files like `views.js` or `styles.css`, make smallest useful extraction toward dedicated module.

<!-- AI-HANDOFF:START -->
Em uma nova sessao (startup/clear), leia .ai/CURRENT.md, o historico diario mais recente e, como fallback, .aicli/handoff-*.md.
Valide .ai/RECOVERY.md e o estado real do Git; se branch/commit divergirem, avise e nao retome automaticamente.
Mostre um resumo e pergunte ao usuario se deseja retomar. Sempre aguarde uma segunda mensagem antes de agir, mesmo se a primeira ja disser continuar.
Nao repita a pergunta em resume/compact. Se o usuario recusar, execute a acao publica SuspendProjectResume para arquivar o estado anterior e substituir CURRENT.md atomicamente.
Ao fim de cada turno util, grave o intent schema 2.0 no pending.json indicado pelo hook SessionStart; o hook Stop promove o checkpoint automaticamente.
Turno util inclui mudanca de arquivo/estado, teste ou milestone concluido, decisao aceita ou mudanca da proxima acao. Nao registre explicacoes puras, prompts, transcricoes ou segredos.
<!-- AI-HANDOFF:END -->
