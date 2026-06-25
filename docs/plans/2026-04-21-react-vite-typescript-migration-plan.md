# React Vite TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Estudo Organizado from the current vanilla ES modules SPA to a React + Vite + TypeScript application without resetting user data, breaking local-first behavior, or losing PWA/sync capabilities.

**Architecture:** Use a strangler migration instead of a big-bang rewrite. Keep the current `src/` app as the stable production baseline while a new Vite React app is built in `app/`, reusing the existing domain contracts, storage schema, sync envelope, visual tokens, Playwright coverage, and release checks until the React app can safely replace the legacy shell.

**Tech Stack:** React, Vite, TypeScript, CSS modules or plain CSS with design tokens, Vitest, React Testing Library, Playwright, IndexedDB, localStorage fallback, Cloudflare Worker/KV sync, Google Drive sync, PWA manifest/service worker

---

## Migration Principles

- Preserve existing local data. Existing IndexedDB/localStorage users must open the React app and see the same editais, eventos, habitos, revisoes, configuracoes, timers, sync settings, and historical records.
- Keep the vanilla app runnable until final cutover. During migration, `npm run dev:legacy` and `npm run dev:react` must both work.
- Move behavior in vertical slices. Each migrated feature must include UI, state, persistence, tests, and route/navigation compatibility.
- Prefer shared contracts over copied assumptions. State shape, sync envelope, route ids, action names, and test fixtures must be defined once and consumed by both legacy and React migration tests when practical.
- Do not use the migration to redesign every workflow at once. Apply the professional clean visual system, but keep information architecture and critical user flows recognizable.
- Avoid framework lock-in inside domain rules. Domain calculations, data normalization, migrations, and sync serialization should live outside React components.

## Current Repo Baseline

- Current production app root: `src/index.html`
- Runtime modules: `src/js/main.js`, `src/js/app.js`, `src/js/store.js`, `src/js/logic.js`, `src/js/views.js`, `src/js/components.js`
- Extracted view modules already exist under `src/js/views/`
- UI action dispatcher already exists under `src/js/ui/actions/`
- Shared DOM/accessibility helpers already exist under `src/js/ui/`
- CSS is split across `src/css/tokens.css`, `src/css/base.css`, `src/css/components.css`, `src/css/views.css`, `src/css/styles.css`
- PWA files: `src/manifest.json`, `src/sw.js`, `src/js/sw-register.js`
- Cloudflare static assets currently point to `src` in `wrangler.jsonc`
- Automated test commands already exist: `npm run test:unit`, `npm run test:e2e`, `npm run test:all`
- CI already runs unit tests and Playwright E2E on `main`

## Target Folder Structure

Create the React app beside the legacy app first:

```text
app/
  index.html
  public/
    assets/
      icons/
  src/
    main.tsx
    App.tsx
    routes/
      routeIds.ts
      AppRouter.tsx
    shell/
      AppShell.tsx
      Sidebar.tsx
      Topbar.tsx
      SearchCommand.tsx
      ModalHost.tsx
      ToastHost.tsx
    design/
      tokens.css
      base.css
      components.css
      themes.ts
    domain/
      types.ts
      defaults.ts
      migrations.ts
      selectors.ts
      revisionRules.ts
      studyCycle.ts
      analytics.ts
    state/
      AppStateProvider.tsx
      appReducer.ts
      actions.ts
      events.ts
    storage/
      indexedDb.ts
      localStorageFallback.ts
      persistence.ts
      exportImport.ts
    sync/
      cloudflareSync.ts
      driveSync.ts
      credentials.ts
    pwa/
      manifest.ts
      registerServiceWorker.ts
      serviceWorker.ts
    features/
      home/
      organizer/
      timer/
      calendar/
      ciclo/
      revisoes/
      habitos/
      editais/
      banca/
      configuracoes/
    test/
      fixtures/
      renderWithAppState.tsx
```

Keep legacy files in place until Phase 10:

```text
src/
  index.html
  js/
  css/
  sw.js
  manifest.json
```

---

## Phase 0: Migration Readiness And Safety Gates

**Purpose:** Establish a measurable baseline before adding React. This prevents a migration that feels successful because the app boots but silently breaks saved data or core workflows.

**Files:**
- Create: `src/docs/superpowers/plans/2026-04-21-react-vite-typescript-migration-plan.md`
- Create: `src/docs/architecture/react-migration-contracts.md`
- Modify: `README.md`

- [ ] **Step 1: Capture the current branch and worktree state**

Run:

```powershell
git status --short --branch
```

Expected:

```text
## main...origin/main
```

If unrelated changes exist, write them in the execution log of this plan before editing files. Do not stage unrelated files.

- [ ] **Step 2: Record the migration decision**

Create `src/docs/architecture/react-migration-contracts.md` with this content:

```md
# React Migration Contracts

## Decision

The React migration uses a strangler approach. The legacy vanilla app remains runnable until the React app passes compatibility, persistence, PWA, sync, accessibility, and E2E gates.

## Non-negotiable contracts

- Existing IndexedDB and localStorage data must remain readable.
- Existing Cloudflare sync envelopes remain supported.
- Existing Google Drive backup payloads remain importable.
- Existing route ids remain stable: home, med, cronometro, calendar, ciclo, revisoes, habitos, editais, verticalizado, dashboard, banca, config.
- Existing data-action names can disappear from React internals, but E2E tests must keep user-facing behavior stable.
- No data reset is allowed as part of cutover.

## Cutover rule

React becomes the production app only when all critical E2E tests pass against the React dev server and the manual regression checklist has no critical blocker.
```

- [ ] **Step 3: Add README migration note**

Append a short migration note under the development/testing section:

```md
## React migration track

The production app is still the vanilla app under `src/`. A React + Vite + TypeScript migration may be developed in `app/` behind separate scripts until cutover. During migration, both legacy and React test suites must remain runnable.
```

- [ ] **Step 4: Run baseline tests**

Run:

```powershell
npm run test:unit
npm run test:e2e
```

Expected:

```text
unit tests: PASS
e2e tests: PASS
```

If a test fails before React changes, mark it as a baseline blocker in this plan and fix or quarantine it before continuing.

- [ ] **Step 5: Commit Phase 0**

Run:

```powershell
git add src/docs/superpowers/plans/2026-04-21-react-vite-typescript-migration-plan.md src/docs/architecture/react-migration-contracts.md README.md
git commit -m "docs(migration): plan react vite typescript migration"
```

Expected: a focused docs commit.

---

## Phase 1: Tooling Scaffold For React Without Touching Production

**Purpose:** Add React, Vite, and TypeScript in a separate app root while keeping legacy scripts intact.

**Files:**
- Modify: `package.json`
- Create: `app/index.html`
- Create: `app/src/main.tsx`
- Create: `app/src/App.tsx`
- Create: `app/src/design/tokens.css`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `vite.config.ts`
- Create: `vitest.react.config.ts`

- [ ] **Step 1: Install React migration dependencies**

Run:

```powershell
npm install react react-dom
npm install -D typescript vite @vitejs/plugin-react @types/react @types/react-dom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Expected:

```text
package.json and package-lock.json updated
```

- [ ] **Step 2: Add package scripts without removing legacy scripts**

Modify `package.json` scripts to include:

```json
{
  "scripts": {
    "dev:legacy": "http-server src -p 8080 -c-1",
    "dev:react": "vite --config vite.config.ts",
    "build:react": "vite build --config vite.config.ts",
    "preview:react": "vite preview --config vite.config.ts",
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:react": "vitest run --config vitest.react.config.ts",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:react && npm run test:e2e"
  }
}
```

Keep any existing script that is not listed above.

- [ ] **Step 3: Create TypeScript base config**

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" }
  ]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["app/src/*"],
      "@legacy/*": ["src/js/*"]
    }
  },
  "include": ["app/src"]
}
```

- [ ] **Step 4: Create Vite config with isolated app root**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'app',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app/src'),
      '@legacy': path.resolve(__dirname, 'src/js')
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  }
});
```

- [ ] **Step 5: Create React Vitest config**

Create `vitest.react.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app/src'),
      '@legacy': path.resolve(__dirname, 'src/js')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./app/src/test/setup.ts'],
    include: ['app/src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true
  }
});
```

- [ ] **Step 6: Create React test setup**

Create `app/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Create React app shell stub**

Create `app/index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#10b981" />
    <title>Estudo Organizado</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `app/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/tokens.css';
import { App } from './App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root was not found.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `app/src/App.tsx`:

```tsx
export function App() {
  return (
    <main>
      <h1>Estudo Organizado</h1>
      <p>React migration shell is running.</p>
    </main>
  );
}
```

Create `app/src/design/tokens.css`:

```css
:root {
  --bg: #f1f5f9;
  --card: #ffffff;
  --surface: #ffffff;
  --border: #e2e8f0;
  --text-primary: #1e293b;
  --text-secondary: #475569;
  --text-muted: #5b6b80;
  --accent: #10b981;
  --accent-text: #052e16;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text-primary);
}
```

- [ ] **Step 8: Verify React shell**

Run:

```powershell
npm run build:react
npm run test:react
```

Expected:

```text
build:react PASS
test:react PASS with no tests or setup-only success
```

- [ ] **Step 9: Commit Phase 1**

Run:

```powershell
git add package.json package-lock.json tsconfig.json tsconfig.app.json vite.config.ts vitest.react.config.ts app
git commit -m "build(react): scaffold vite typescript app"
```

---

## Phase 2: Shared Data Contracts And Migration Fixtures

**Purpose:** Define the app state types, schema versioning, route ids, and migration fixtures before UI migration begins.

**Files:**
- Create: `app/src/domain/types.ts`
- Create: `app/src/domain/defaults.ts`
- Create: `app/src/domain/migrations.ts`
- Create: `app/src/routes/routeIds.ts`
- Create: `app/src/test/fixtures/appState.ts`
- Create: `app/src/domain/migrations.test.ts`
- Create: `tests/unit/react-contracts.test.js`

- [ ] **Step 1: Define route ids**

Create `app/src/routes/routeIds.ts`:

```ts
export const ROUTE_IDS = [
  'home',
  'med',
  'cronometro',
  'calendar',
  'ciclo',
  'revisoes',
  'habitos',
  'editais',
  'verticalizado',
  'dashboard',
  'banca',
  'config'
] as const;

export type RouteId = (typeof ROUTE_IDS)[number];

export function isRouteId(value: unknown): value is RouteId {
  return typeof value === 'string' && (ROUTE_IDS as readonly string[]).includes(value);
}
```

- [ ] **Step 2: Define minimum state types**

Create `app/src/domain/types.ts`:

```ts
import type { RouteId } from '../routes/routeIds';

export type ISODateString = string;

export interface AppConfig {
  tema: string;
  darkMode: boolean;
  lastDarkTheme?: string;
  visualizacao: 'mes' | 'semana';
  primeirodiaSemana: 0 | 1;
  frequenciaRevisao: number[];
  metas: {
    horasSemana: number;
  };
  cfSyncEnabled?: boolean;
  cfRemoteUpdatedAt?: string | null;
  cfConflict?: unknown;
  _lastUpdated?: string;
}

export interface Assunto {
  id: string;
  nome: string;
  concluido?: boolean;
  dataConclusao?: ISODateString;
  revisoesFetas?: ISODateString[];
  relevancia?: 'P1' | 'P2' | 'P3';
}

export interface Aula {
  id: string;
  nome: string;
  estudada?: boolean;
}

export interface Disciplina {
  id: string;
  nome: string;
  icone?: string;
  cor?: string;
  assuntos: Assunto[];
  aulas?: Aula[];
}

export interface Edital {
  id: string;
  nome: string;
  cor: string;
  disciplinas: Disciplina[];
}

export interface Evento {
  id: string;
  titulo?: string;
  discId?: string;
  editalId?: string;
  assuntoId?: string;
  aulaId?: string;
  data: ISODateString;
  duracaoMin?: number;
  status: 'agendado' | 'estudei' | 'atrasado' | 'nao';
  minutosEstudados?: number;
  sessao?: Record<string, unknown>;
  seqId?: string;
  isAutoGenerated?: boolean;
}

export interface HabitosState {
  videoaula: Record<string, unknown>[];
  leitura: Record<string, unknown>[];
  questoes: Record<string, unknown>[];
  simulado: Record<string, unknown>[];
  revisao: Record<string, unknown>[];
  flashcards: Record<string, unknown>[];
}

export interface AppState {
  schemaVersion: number;
  currentView?: RouteId;
  config: AppConfig;
  editais: Edital[];
  eventos: Evento[];
  habitos: HabitosState;
  planejamento?: Record<string, unknown>;
  lastSync?: string | null;
  driveFileId?: string | null;
}
```

- [ ] **Step 3: Define default state**

Create `app/src/domain/defaults.ts`:

```ts
import type { AppState } from './types';

export const CURRENT_SCHEMA_VERSION = 7;

export function createDefaultState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    currentView: 'home',
    config: {
      tema: 'light',
      darkMode: false,
      visualizacao: 'mes',
      primeirodiaSemana: 0,
      frequenciaRevisao: [1, 7, 30, 90],
      metas: {
        horasSemana: 20
      },
      cfSyncEnabled: false,
      cfRemoteUpdatedAt: null
    },
    editais: [],
    eventos: [],
    habitos: {
      videoaula: [],
      leitura: [],
      questoes: [],
      simulado: [],
      revisao: [],
      flashcards: []
    },
    planejamento: {},
    lastSync: null,
    driveFileId: null
  };
}
```

- [ ] **Step 4: Define normalizer and migration entrypoint**

Create `app/src/domain/migrations.ts`:

```ts
import { createDefaultState, CURRENT_SCHEMA_VERSION } from './defaults';
import type { AppState } from './types';
import { isRouteId } from '../routes/routeIds';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function normalizeImportedState(input: unknown): AppState {
  const defaults = createDefaultState();
  const raw = asRecord(input);
  const rawConfig = asRecord(raw.config);
  const rawHabitos = asRecord(raw.habitos);
  const currentView = isRouteId(raw.currentView) ? raw.currentView : defaults.currentView;

  return {
    ...defaults,
    ...raw,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    currentView,
    config: {
      ...defaults.config,
      ...rawConfig,
      frequenciaRevisao: asArray<number>(rawConfig.frequenciaRevisao).length
        ? asArray<number>(rawConfig.frequenciaRevisao)
        : defaults.config.frequenciaRevisao,
      metas: {
        ...defaults.config.metas,
        ...asRecord(rawConfig.metas)
      }
    },
    editais: asArray(raw.editais),
    eventos: asArray(raw.eventos),
    habitos: {
      ...defaults.habitos,
      ...rawHabitos,
      videoaula: asArray(rawHabitos.videoaula),
      leitura: asArray(rawHabitos.leitura),
      questoes: asArray(rawHabitos.questoes),
      simulado: asArray(rawHabitos.simulado),
      revisao: asArray(rawHabitos.revisao),
      flashcards: asArray(rawHabitos.flashcards)
    }
  };
}
```

- [ ] **Step 5: Add migration fixture**

Create `app/src/test/fixtures/appState.ts`:

```ts
import type { AppState } from '../../domain/types';

export function createMigrationFixture(): AppState {
  return {
    schemaVersion: 7,
    currentView: 'home',
    config: {
      tema: 'dark',
      darkMode: true,
      visualizacao: 'mes',
      primeirodiaSemana: 0,
      frequenciaRevisao: [1, 7, 30, 90],
      metas: { horasSemana: 20 },
      cfSyncEnabled: true,
      cfRemoteUpdatedAt: '2026-04-19T12:00:00.000Z'
    },
    editais: [
      {
        id: 'ed_1',
        nome: 'Concurso Principal',
        cor: '#10b981',
        disciplinas: [
          {
            id: 'disc_1',
            nome: 'Direito Constitucional',
            cor: '#10b981',
            icone: 'balance-scale',
            assuntos: [
              {
                id: 'assunto_1',
                nome: 'Controle de Constitucionalidade',
                concluido: true,
                dataConclusao: '2026-04-18',
                revisoesFetas: ['2026-04-19']
              }
            ],
            aulas: [
              {
                id: 'aula_1',
                nome: 'Aula 01 - Controle',
                estudada: true
              }
            ]
          }
        ]
      }
    ],
    eventos: [
      {
        id: 'ev_1',
        titulo: 'Estudo Constitucional',
        editalId: 'ed_1',
        discId: 'disc_1',
        assuntoId: 'assunto_1',
        aulaId: 'aula_1',
        data: '2026-04-20',
        duracaoMin: 60,
        status: 'estudei',
        minutosEstudados: 60
      }
    ],
    habitos: {
      videoaula: [],
      leitura: [],
      questoes: [{ id: 'q_1', data: '2026-04-20', acertos: 8, erros: 2 }],
      simulado: [],
      revisao: [],
      flashcards: []
    },
    planejamento: {},
    lastSync: '2026-04-20T12:00:00.000Z',
    driveFileId: 'drive_file_1'
  };
}
```

- [ ] **Step 6: Test state normalization**

Create `app/src/domain/migrations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeImportedState } from './migrations';
import { createMigrationFixture } from '../test/fixtures/appState';

describe('normalizeImportedState', () => {
  it('preserves existing core data while normalizing schema version', () => {
    const fixture = createMigrationFixture();
    const normalized = normalizeImportedState(fixture);

    expect(normalized.schemaVersion).toBe(7);
    expect(normalized.editais[0]?.disciplinas[0]?.assuntos[0]?.nome).toBe('Controle de Constitucionalidade');
    expect(normalized.eventos[0]?.status).toBe('estudei');
    expect(normalized.habitos.questoes).toHaveLength(1);
    expect(normalized.driveFileId).toBe('drive_file_1');
  });

  it('repairs missing config and habit arrays', () => {
    const normalized = normalizeImportedState({ editais: [], eventos: [], config: {} });

    expect(normalized.config.tema).toBe('light');
    expect(normalized.config.metas.horasSemana).toBe(20);
    expect(normalized.habitos.videoaula).toEqual([]);
    expect(normalized.habitos.questoes).toEqual([]);
  });

  it('falls back to home when currentView is invalid', () => {
    const normalized = normalizeImportedState({ currentView: 'unknown' });

    expect(normalized.currentView).toBe('home');
  });
});
```

- [ ] **Step 7: Add legacy/React contract smoke test**

Create `tests/unit/react-contracts.test.js`:

```js
import { describe, expect, it } from 'vitest';

describe('React migration contracts', () => {
  it('documents the route ids that must stay stable during migration', () => {
    const routeIds = [
      'home',
      'med',
      'cronometro',
      'calendar',
      'ciclo',
      'revisoes',
      'habitos',
      'editais',
      'verticalizado',
      'dashboard',
      'banca',
      'config'
    ];

    expect(routeIds).toContain('home');
    expect(routeIds).toContain('calendar');
    expect(routeIds).toContain('config');
  });
});
```

- [ ] **Step 8: Verify contracts**

Run:

```powershell
npm run test:react
npm run test:unit -- tests/unit/react-contracts.test.js
```

Expected:

```text
PASS app/src/domain/migrations.test.ts
PASS tests/unit/react-contracts.test.js
```

- [ ] **Step 9: Commit Phase 2**

Run:

```powershell
git add app/src/domain app/src/routes app/src/test tests/unit/react-contracts.test.js
git commit -m "feat(react): add migration data contracts"
```

---

## Phase 3: Persistence Layer Compatibility

**Purpose:** Make React read and write the same local-first data as the legacy app before any feature UI is migrated.

**Files:**
- Create: `app/src/storage/indexedDb.ts`
- Create: `app/src/storage/localStorageFallback.ts`
- Create: `app/src/storage/persistence.ts`
- Create: `app/src/storage/persistence.test.ts`
- Modify: `app/src/domain/types.ts`

- [ ] **Step 1: Define persistence constants**

Create `app/src/storage/persistence.ts`:

```ts
import type { AppState } from '../domain/types';
import { normalizeImportedState } from '../domain/migrations';
import { loadFromIndexedDb, saveToIndexedDb } from './indexedDb';
import { loadFromLocalStorage, saveToLocalStorage } from './localStorageFallback';

export const LEGACY_LOCAL_STORAGE_KEY = 'estudo_state';
export const LEGACY_DB_NAME = 'EstudoOrganizadoDB';
export const LEGACY_STORE_NAME = 'state';
export const LEGACY_STATE_KEY = 'app-state';

export async function loadPersistedState(): Promise<AppState> {
  const indexedDbState = await loadFromIndexedDb();
  if (indexedDbState) return normalizeImportedState(indexedDbState);

  const localStorageState = loadFromLocalStorage();
  if (localStorageState) return normalizeImportedState(localStorageState);

  return normalizeImportedState(null);
}

export async function savePersistedState(state: AppState): Promise<void> {
  const normalized = normalizeImportedState({
    ...state,
    config: {
      ...state.config,
      _lastUpdated: new Date().toISOString()
    }
  });

  await saveToIndexedDb(normalized);
  saveToLocalStorage(normalized);
}
```

- [ ] **Step 2: Implement IndexedDB adapter**

Create `app/src/storage/indexedDb.ts`:

```ts
import { LEGACY_DB_NAME, LEGACY_STATE_KEY, LEGACY_STORE_NAME } from './persistence';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.createObjectStore(LEGACY_STORE_NAME);
      }
    };
  });
}

export async function loadFromIndexedDb(): Promise<unknown | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEGACY_STORE_NAME, 'readonly');
    const store = tx.objectStore(LEGACY_STORE_NAME);
    const request = store.get(LEGACY_STATE_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);
  });
}

export async function saveToIndexedDb(state: unknown): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEGACY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(LEGACY_STORE_NAME);
    const request = store.put(state, LEGACY_STATE_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
```

- [ ] **Step 3: Implement localStorage fallback**

Create `app/src/storage/localStorageFallback.ts`:

```ts
import { LEGACY_LOCAL_STORAGE_KEY } from './persistence';

export function loadFromLocalStorage(): unknown | null {
  const raw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveToLocalStorage(state: unknown): void {
  localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(state));
}
```

- [ ] **Step 4: Test localStorage compatibility**

Create `app/src/storage/persistence.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMigrationFixture } from '../test/fixtures/appState';
import { loadFromLocalStorage, saveToLocalStorage } from './localStorageFallback';

describe('localStorageFallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('reads legacy estudo_state payloads', () => {
    const fixture = createMigrationFixture();
    localStorage.setItem('estudo_state', JSON.stringify(fixture));

    expect(loadFromLocalStorage()).toMatchObject({
      editais: fixture.editais,
      eventos: fixture.eventos
    });
  });

  it('writes payloads to the legacy key', () => {
    const fixture = createMigrationFixture();
    saveToLocalStorage(fixture);

    const raw = localStorage.getItem('estudo_state');
    expect(raw).toContain('Concurso Principal');
  });
});
```

- [ ] **Step 5: Verify persistence tests**

Run:

```powershell
npm run test:react -- app/src/storage/persistence.test.ts
```

Expected:

```text
PASS app/src/storage/persistence.test.ts
```

- [ ] **Step 6: Manual compatibility check**

Run legacy app:

```powershell
npm run dev:legacy
```

Create one edital and one event in the browser. Then run React app:

```powershell
npm run dev:react
```

Expected: React persistence debug screen in Phase 4 can load the same edital and event.

- [ ] **Step 7: Commit Phase 3**

Run:

```powershell
git add app/src/storage app/src/domain
git commit -m "feat(react): add legacy persistence adapter"
```

---

## Phase 4: React State Provider, Navigation, And Shell

**Purpose:** Replace the static React stub with a real app shell that can load persisted state, navigate between route ids, show loading/error states, and preserve the current product layout.

**Files:**
- Create: `app/src/state/AppStateProvider.tsx`
- Create: `app/src/state/appReducer.ts`
- Create: `app/src/state/actions.ts`
- Create: `app/src/state/events.ts`
- Create: `app/src/routes/AppRouter.tsx`
- Create: `app/src/shell/AppShell.tsx`
- Create: `app/src/shell/Sidebar.tsx`
- Create: `app/src/shell/Topbar.tsx`
- Create: `app/src/shell/ToastHost.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Define state actions**

Create `app/src/state/actions.ts`:

```ts
import type { AppState } from '../domain/types';
import type { RouteId } from '../routes/routeIds';

export type AppAction =
  | { type: 'state/loaded'; state: AppState }
  | { type: 'state/replace'; state: AppState }
  | { type: 'navigation/setRoute'; routeId: RouteId }
  | { type: 'config/setTheme'; theme: string }
  | { type: 'toast/show'; message: string; tone: 'success' | 'error' | 'info' }
  | { type: 'toast/clear' };

export interface ToastState {
  message: string;
  tone: 'success' | 'error' | 'info';
}

export interface AppRuntimeState {
  appState: AppState;
  isLoaded: boolean;
  toast: ToastState | null;
}
```

- [ ] **Step 2: Define reducer**

Create `app/src/state/appReducer.ts`:

```ts
import { createDefaultState } from '../domain/defaults';
import type { AppAction, AppRuntimeState } from './actions';

export function createInitialRuntimeState(): AppRuntimeState {
  return {
    appState: createDefaultState(),
    isLoaded: false,
    toast: null
  };
}

export function appReducer(state: AppRuntimeState, action: AppAction): AppRuntimeState {
  switch (action.type) {
    case 'state/loaded':
      return { ...state, appState: action.state, isLoaded: true };
    case 'state/replace':
      return { ...state, appState: action.state };
    case 'navigation/setRoute':
      return {
        ...state,
        appState: {
          ...state.appState,
          currentView: action.routeId
        }
      };
    case 'config/setTheme':
      return {
        ...state,
        appState: {
          ...state.appState,
          config: {
            ...state.appState.config,
            tema: action.theme,
            darkMode: action.theme !== 'light',
            lastDarkTheme: action.theme !== 'light' ? action.theme : state.appState.config.lastDarkTheme
          }
        }
      };
    case 'toast/show':
      return { ...state, toast: { message: action.message, tone: action.tone } };
    case 'toast/clear':
      return { ...state, toast: null };
    default:
      return state;
  }
}
```

- [ ] **Step 3: Create provider**

Create `app/src/state/AppStateProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { appReducer, createInitialRuntimeState } from './appReducer';
import type { AppAction, AppRuntimeState } from './actions';
import { loadPersistedState, savePersistedState } from '../storage/persistence';

interface AppStateContextValue {
  state: AppRuntimeState;
  dispatch: React.Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialRuntimeState);

  useEffect(() => {
    let cancelled = false;

    loadPersistedState().then((loadedState) => {
      if (!cancelled) dispatch({ type: 'state/loaded', state: loadedState });
    }).catch(() => {
      if (!cancelled) dispatch({ type: 'state/loaded', state: state.appState });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state.isLoaded) return;
    const timeoutId = window.setTimeout(() => {
      savePersistedState(state.appState);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [state.appState, state.isLoaded]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
```

- [ ] **Step 4: Create sidebar and topbar**

Create `app/src/shell/Sidebar.tsx`:

```tsx
import { ROUTE_IDS, type RouteId } from '../routes/routeIds';
import { useAppState } from '../state/AppStateProvider';

const labels: Record<RouteId, string> = {
  home: 'Pagina Inicial',
  med: 'Study Organizer',
  cronometro: 'Cronometro',
  calendar: 'Calendario',
  ciclo: 'Ciclo de Estudos',
  revisoes: 'Revisoes',
  habitos: 'Habitos',
  editais: 'Editais',
  verticalizado: 'Ed. Verticalizado',
  dashboard: 'Dashboard',
  banca: 'Banca',
  config: 'Configuracoes'
};

export function Sidebar() {
  const { state, dispatch } = useAppState();
  const currentView = state.appState.currentView ?? 'home';

  return (
    <nav className="sidebar" aria-label="Menu principal">
      <div className="sidebar__brand">Estudo Organizado</div>
      {ROUTE_IDS.map((routeId) => (
        <button
          key={routeId}
          type="button"
          className={routeId === currentView ? 'sidebar__item sidebar__item--active' : 'sidebar__item'}
          onClick={() => dispatch({ type: 'navigation/setRoute', routeId })}
        >
          {labels[routeId]}
        </button>
      ))}
    </nav>
  );
}
```

Create `app/src/shell/Topbar.tsx`:

```tsx
import { useAppState } from '../state/AppStateProvider';

export function Topbar() {
  const { state, dispatch } = useAppState();
  const currentView = state.appState.currentView ?? 'home';
  const nextTheme = state.appState.config.tema === 'light'
    ? state.appState.config.lastDarkTheme ?? 'dark'
    : 'light';

  return (
    <header className="topbar">
      <h1 className="topbar__title">{currentView}</h1>
      <button
        type="button"
        className="button button--ghost"
        onClick={() => dispatch({ type: 'config/setTheme', theme: nextTheme })}
      >
        Alternar tema
      </button>
    </header>
  );
}
```

- [ ] **Step 5: Create shell and router**

Create `app/src/routes/AppRouter.tsx`:

```tsx
import { useAppState } from '../state/AppStateProvider';

export function AppRouter() {
  const { state } = useAppState();
  const currentView = state.appState.currentView ?? 'home';

  return (
    <section className="route-panel" aria-label="Conteudo principal">
      <h2>{currentView}</h2>
      <p>Feature migration pending for route: {currentView}</p>
    </section>
  );
}
```

Create `app/src/shell/AppShell.tsx`:

```tsx
import { AppRouter } from '../routes/AppRouter';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastHost } from './ToastHost';

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <Topbar />
        <main id="main-content" className="app-shell__content">
          <AppRouter />
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
```

Create `app/src/shell/ToastHost.tsx`:

```tsx
import { useAppState } from '../state/AppStateProvider';

export function ToastHost() {
  const { state, dispatch } = useAppState();
  if (!state.toast) return null;

  return (
    <div className={`toast toast--${state.toast.tone}`} role="status">
      <span>{state.toast.message}</span>
      <button type="button" onClick={() => dispatch({ type: 'toast/clear' })}>
        Fechar
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Wire provider into App**

Modify `app/src/App.tsx`:

```tsx
import { AppStateProvider } from './state/AppStateProvider';
import { AppShell } from './shell/AppShell';

export function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}
```

- [ ] **Step 7: Verify shell**

Run:

```powershell
npm run build:react
npm run test:react
```

Expected:

```text
build:react PASS
test:react PASS
```

- [ ] **Step 8: Manual shell check**

Run:

```powershell
npm run dev:react
```

Expected:

- Sidebar route buttons render.
- Clicking each route changes the main content heading.
- Theme toggle changes state and persists after refresh.

- [ ] **Step 9: Commit Phase 4**

Run:

```powershell
git add app/src
git commit -m "feat(react): add app shell and state provider"
```

---

## Phase 5: Professional Clean Design System

**Purpose:** Fix the current design inconsistency while React is still early, so every migrated feature consumes the same visual language.

**Files:**
- Modify: `app/src/design/tokens.css`
- Create: `app/src/design/base.css`
- Create: `app/src/design/components.css`
- Create: `app/src/design/themes.ts`
- Create: `app/src/design/design-system.test.ts`
- Modify: `app/src/main.tsx`
- Modify: `app/src/shell/*.tsx`

- [ ] **Step 1: Define canonical tokens**

Replace `app/src/design/tokens.css` with:

```css
:root {
  color-scheme: light;

  --color-bg: #f4f7fb;
  --color-surface: #ffffff;
  --color-surface-muted: #eef3f8;
  --color-border: #d9e2ec;
  --color-border-strong: #bcccdc;

  --color-text: #172033;
  --color-text-secondary: #44546a;
  --color-text-muted: #64748b;

  --color-primary: #0f9f7a;
  --color-primary-hover: #0b7f63;
  --color-primary-text: #ffffff;

  --color-info: #2563eb;
  --color-success: #059669;
  --color-warning: #d97706;
  --color-danger: #dc2626;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);

  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

[data-theme='dark'] {
  color-scheme: dark;

  --color-bg: #0f172a;
  --color-surface: #182235;
  --color-surface-muted: #111827;
  --color-border: #2f3b52;
  --color-border-strong: #475569;

  --color-text: #f8fafc;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #94a3b8;

  --color-primary: #34d399;
  --color-primary-hover: #6ee7b7;
  --color-primary-text: #052e16;
}
```

- [ ] **Step 2: Add base CSS**

Create `app/src/design/base.css`:

```css
* {
  box-sizing: border-box;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Add component CSS**

Create `app/src/design/components.css`:

```css
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
}

.app-shell__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.app-shell__content {
  padding: var(--space-6);
}

.sidebar {
  background: #172033;
  color: #dbe4f0;
  padding: var(--space-4);
}

.sidebar__brand {
  font-weight: 800;
  margin-bottom: var(--space-5);
}

.sidebar__item {
  width: 100%;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  padding: 10px 12px;
  text-align: left;
}

.sidebar__item--active {
  background: var(--color-primary);
  color: var(--color-primary-text);
}

.topbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.topbar__title {
  margin: 0;
  font-size: 18px;
}

.route-panel,
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5);
}

.button {
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 8px 14px;
  font-weight: 700;
}

.button--primary {
  background: var(--color-primary);
  color: var(--color-primary-text);
}

.button--ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}

.toast {
  position: fixed;
  right: var(--space-5);
  bottom: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-3) var(--space-4);
}
```

- [ ] **Step 4: Import CSS in order**

Modify `app/src/main.tsx` imports:

```tsx
import './design/tokens.css';
import './design/base.css';
import './design/components.css';
```

- [ ] **Step 5: Add theme application effect**

Modify `AppShell.tsx`:

```tsx
import { useEffect } from 'react';
import { AppRouter } from '../routes/AppRouter';
import { useAppState } from '../state/AppStateProvider';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastHost } from './ToastHost';

export function AppShell() {
  const { state } = useAppState();

  useEffect(() => {
    document.documentElement.dataset.theme = state.appState.config.tema === 'light' ? 'light' : 'dark';
  }, [state.appState.config.tema]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <Topbar />
        <main id="main-content" className="app-shell__content">
          <AppRouter />
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
```

- [ ] **Step 6: Add design-system token test**

Create `app/src/design/design-system.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const requiredTokens = [
  '--color-bg',
  '--color-surface',
  '--color-border',
  '--color-text',
  '--color-text-secondary',
  '--color-primary',
  '--color-primary-text'
];

describe('design system contract', () => {
  it('keeps a small canonical token surface for migrated React UI', () => {
    expect(requiredTokens).toEqual([
      '--color-bg',
      '--color-surface',
      '--color-border',
      '--color-text',
      '--color-text-secondary',
      '--color-primary',
      '--color-primary-text'
    ]);
  });
});
```

- [ ] **Step 7: Verify desktop and mobile shell manually**

Run:

```powershell
npm run dev:react
```

Check:

- 1366px desktop: sidebar, topbar, content area align.
- 768px tablet: no horizontal overflow.
- 390px mobile: sidebar strategy is identified as the next task if layout does not fit.

- [ ] **Step 8: Commit Phase 5**

Run:

```powershell
git add app/src/design app/src/main.tsx app/src/shell
git commit -m "feat(react): add clean design system foundation"
```

---

## Phase 6: Feature Migration Slices

**Purpose:** Migrate user-facing features one at a time. Each slice must be shippable in React preview and keep legacy production untouched.

## Slice Order

1. Home dashboard
2. Configuracoes and theme settings
3. Editais CRUD
4. Study Organizer and free timer
5. Calendar
6. Revisoes
7. Habitos
8. Ciclo de Estudos
9. Dashboard by discipline
10. Banca analyzer
11. Global search
12. Import/export and destructive recovery flows

### Slice 6.1: Home Dashboard

**Files:**
- Create: `app/src/features/home/HomePage.tsx`
- Create: `app/src/features/home/homeSelectors.ts`
- Create: `app/src/features/home/HomePage.test.tsx`
- Modify: `app/src/routes/AppRouter.tsx`

- [ ] **Step 1: Extract home selectors**

Create `app/src/features/home/homeSelectors.ts`:

```ts
import type { AppState } from '../../domain/types';

export function selectTodayStudyMinutes(state: AppState, today: string): number {
  return state.eventos
    .filter((evento) => evento.data === today && evento.status === 'estudei')
    .reduce((sum, evento) => sum + (evento.minutosEstudados ?? evento.duracaoMin ?? 0), 0);
}

export function selectEditalProgress(state: AppState) {
  const totals = state.editais.flatMap((edital) => edital.disciplinas)
    .reduce((acc, disc) => {
      const assuntos = disc.assuntos ?? [];
      acc.total += assuntos.length;
      acc.done += assuntos.filter((assunto) => assunto.concluido).length;
      return acc;
    }, { total: 0, done: 0 });

  return {
    done: totals.done,
    total: totals.total,
    percentage: totals.total ? Math.round((totals.done / totals.total) * 100) : 0
  };
}
```

- [ ] **Step 2: Test selectors**

Create `app/src/features/home/HomePage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { createMigrationFixture } from '../../test/fixtures/appState';
import { selectEditalProgress, selectTodayStudyMinutes } from './homeSelectors';

describe('home selectors', () => {
  it('sums study minutes for the selected day', () => {
    const state = createMigrationFixture();

    expect(selectTodayStudyMinutes(state, '2026-04-20')).toBe(60);
  });

  it('computes edital progress', () => {
    const state = createMigrationFixture();

    expect(selectEditalProgress(state)).toEqual({
      done: 1,
      total: 1,
      percentage: 100
    });
  });
});
```

- [ ] **Step 3: Create HomePage component**

Create `app/src/features/home/HomePage.tsx`:

```tsx
import { useMemo } from 'react';
import { useAppState } from '../../state/AppStateProvider';
import { selectEditalProgress, selectTodayStudyMinutes } from './homeSelectors';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function HomePage() {
  const { state } = useAppState();
  const today = useMemo(todayKey, []);
  const minutes = selectTodayStudyMinutes(state.appState, today);
  const progress = selectEditalProgress(state.appState);

  return (
    <div className="home-page">
      <section className="card">
        <h2>Hoje</h2>
        <strong>{Math.floor(minutes / 60)}h {minutes % 60}min</strong>
        <span>Tempo estudado</span>
      </section>
      <section className="card">
        <h2>Edital</h2>
        <strong>{progress.percentage}%</strong>
        <span>{progress.done} de {progress.total} topicos concluidos</span>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Route HomePage**

Modify `app/src/routes/AppRouter.tsx`:

```tsx
import { HomePage } from '../features/home/HomePage';
import { useAppState } from '../state/AppStateProvider';

export function AppRouter() {
  const { state } = useAppState();
  const currentView = state.appState.currentView ?? 'home';

  if (currentView === 'home') return <HomePage />;

  return (
    <section className="route-panel" aria-label="Conteudo principal">
      <h2>{currentView}</h2>
      <p>Feature migration pending for route: {currentView}</p>
    </section>
  );
}
```

- [ ] **Step 5: Verify slice**

Run:

```powershell
npm run test:react -- app/src/features/home/HomePage.test.tsx
npm run build:react
```

Expected:

```text
PASS HomePage.test.tsx
build:react PASS
```

### Slice 6.2: Configuracoes

**Files:**
- Create: `app/src/features/configuracoes/ConfiguracoesPage.tsx`
- Create: `app/src/features/configuracoes/configActions.ts`
- Create: `app/src/features/configuracoes/ConfiguracoesPage.test.tsx`
- Modify: `app/src/routes/AppRouter.tsx`
- Modify: `app/src/state/actions.ts`
- Modify: `app/src/state/appReducer.ts`

- [ ] **Step 1: Add config actions**

Extend `AppAction`:

```ts
| { type: 'config/setWeeklyGoal'; hours: number }
| { type: 'config/setReviewIntervals'; intervals: number[] }
```

Extend reducer:

```ts
case 'config/setWeeklyGoal':
  return {
    ...state,
    appState: {
      ...state.appState,
      config: {
        ...state.appState.config,
        metas: {
          ...state.appState.config.metas,
          horasSemana: action.hours
        }
      }
    }
  };
case 'config/setReviewIntervals':
  return {
    ...state,
    appState: {
      ...state.appState,
      config: {
        ...state.appState.config,
        frequenciaRevisao: action.intervals
      }
    }
  };
```

- [ ] **Step 2: Create ConfiguracoesPage**

Create `app/src/features/configuracoes/ConfiguracoesPage.tsx`:

```tsx
import { useAppState } from '../../state/AppStateProvider';

export function ConfiguracoesPage() {
  const { state, dispatch } = useAppState();
  const config = state.appState.config;

  return (
    <section className="card">
      <h2>Configuracoes</h2>
      <label>
        Tema
        <select
          value={config.tema}
          onChange={(event) => dispatch({ type: 'config/setTheme', theme: event.target.value })}
        >
          <option value="light">Claro</option>
          <option value="dark">Escuro</option>
        </select>
      </label>
      <label>
        Meta semanal
        <input
          type="number"
          min="1"
          max="100"
          value={config.metas.horasSemana}
          onChange={(event) => dispatch({ type: 'config/setWeeklyGoal', hours: Number(event.target.value) })}
        />
      </label>
    </section>
  );
}
```

- [ ] **Step 3: Route config**

In `AppRouter.tsx`:

```tsx
import { ConfiguracoesPage } from '../features/configuracoes/ConfiguracoesPage';

if (currentView === 'config') return <ConfiguracoesPage />;
```

- [ ] **Step 4: Test config behavior**

Create `app/src/features/configuracoes/ConfiguracoesPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../../state/AppStateProvider';
import { ConfiguracoesPage } from './ConfiguracoesPage';

describe('ConfiguracoesPage', () => {
  it('renders theme and weekly goal controls', async () => {
    render(
      <AppStateProvider>
        <ConfiguracoesPage />
      </AppStateProvider>
    );

    expect(await screen.findByLabelText('Tema')).toBeInTheDocument();
    expect(screen.getByLabelText('Meta semanal')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Tema'), 'dark');

    expect(screen.getByLabelText('Tema')).toHaveValue('dark');
  });
});
```

### Slice 6.3: Editais CRUD

**Files:**
- Create: `app/src/features/editais/EditaisPage.tsx`
- Create: `app/src/features/editais/editaisReducer.ts`
- Create: `app/src/features/editais/EditalForm.tsx`
- Create: `app/src/features/editais/EditaisPage.test.tsx`
- Modify: `app/src/state/actions.ts`
- Modify: `app/src/state/appReducer.ts`

- [ ] **Step 1: Add edital actions**

Add:

```ts
| { type: 'editais/create'; nome: string; cor: string }
| { type: 'editais/delete'; editalId: string }
| { type: 'editais/addDisciplina'; editalId: string; nome: string; cor: string; icone?: string }
| { type: 'editais/toggleAssunto'; editalId: string; discId: string; assuntoId: string }
```

- [ ] **Step 2: Implement reducer cases**

Reducer must create immutable updates and preserve unknown fields:

```ts
case 'editais/create':
  return {
    ...state,
    appState: {
      ...state.appState,
      editais: [
        ...state.appState.editais,
        {
          id: crypto.randomUUID(),
          nome: action.nome,
          cor: action.cor,
          disciplinas: []
        }
      ]
    }
  };
case 'editais/delete':
  return {
    ...state,
    appState: {
      ...state.appState,
      editais: state.appState.editais.filter((edital) => edital.id !== action.editalId)
    }
  };
```

- [ ] **Step 3: Build EditaisPage**

Create UI with:

- List of editais
- Create edital form
- Delete button with accessible label
- Discipline count
- Empty state when no edital exists

- [ ] **Step 4: Add test**

Test must verify:

- Existing fixture edital renders.
- Creating a new edital adds a row.
- Deleting an edital removes it.

Run:

```powershell
npm run test:react -- app/src/features/editais/EditaisPage.test.tsx
```

### Slice 6.4: Study Organizer And Timer

**Files:**
- Create: `app/src/features/organizer/OrganizerPage.tsx`
- Create: `app/src/features/organizer/EventCard.tsx`
- Create: `app/src/features/organizer/eventActions.ts`
- Create: `app/src/features/timer/timerReducer.ts`
- Create: `app/src/features/timer/useStudyTimer.ts`
- Modify: `app/src/state/actions.ts`
- Modify: `app/src/state/appReducer.ts`

- [ ] **Step 1: Preserve event statuses**

React must use exactly these status values:

```ts
type EventoStatus = 'agendado' | 'estudei' | 'atrasado' | 'nao';
```

- [ ] **Step 2: Implement event creation**

Create event action:

```ts
| {
    type: 'eventos/create';
    evento: Omit<Evento, 'id'>;
  }
```

Reducer:

```ts
case 'eventos/create':
  return {
    ...state,
    appState: {
      ...state.appState,
      eventos: [
        ...state.appState.eventos,
        { ...action.evento, id: crypto.randomUUID() }
      ]
    }
  };
```

- [ ] **Step 3: Implement timer hook**

Create `useStudyTimer.ts`:

```ts
import { useEffect, useRef, useState } from 'react';

export function useStudyTimer(initialSeconds = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  return {
    seconds,
    isRunning,
    start: () => setIsRunning(true),
    pause: () => setIsRunning(false),
    reset: () => {
      setIsRunning(false);
      setSeconds(0);
    }
  };
}
```

- [ ] **Step 4: E2E parity**

Add Playwright tests for:

- Create event
- Start timer
- Pause timer
- Mark studied
- Refresh page and confirm event remains

Run:

```powershell
npm run test:e2e -- tests/e2e/sessoes.spec.js
```

### Slice 6.5: Calendar

**Files:**
- Create: `app/src/features/calendar/CalendarPage.tsx`
- Create: `app/src/features/calendar/calendarSelectors.ts`
- Create: `app/src/features/calendar/CalendarPage.test.tsx`

- [ ] **Step 1: Implement selectors for month/week**

Selectors must group `state.eventos` by `data` and preserve existing statuses.

- [ ] **Step 2: Build accessible calendar grid**

Calendar days must be buttons, not clickable divs.

- [ ] **Step 3: E2E parity**

Run:

```powershell
npm run test:e2e -- tests/e2e/calendar.spec.js
```

### Slice 6.6: Remaining Features

Migrate each remaining feature with the same pattern:

- Domain selectors first
- Reducer actions second
- Component third
- Unit test fourth
- Existing E2E parity fifth

Use these required commands:

```powershell
npm run test:react
npm run build:react
npm run test:e2e -- tests/e2e/revisoes-habitos.spec.js
npm run test:e2e -- tests/e2e/ciclo-grade.spec.js
npm run test:e2e -- tests/e2e/dashboard-fluxos.spec.js
npm run test:e2e -- tests/e2e/editais.spec.js
```

---

## Phase 7: Sync, Import/Export, And Credential Safety

**Purpose:** Move Cloudflare sync, Google Drive sync, backup export/import, and credential separation into React without weakening current security contracts.

**Files:**
- Create: `app/src/sync/cloudflareSync.ts`
- Create: `app/src/sync/driveSync.ts`
- Create: `app/src/sync/credentials.ts`
- Create: `app/src/storage/exportImport.ts`
- Create: `app/src/sync/cloudflareSync.test.ts`
- Modify: `app/src/features/configuracoes/ConfiguracoesPage.tsx`

- [ ] **Step 1: Preserve Cloudflare envelope**

Create `app/src/sync/cloudflareSync.ts`:

```ts
import type { AppState } from '../domain/types';

export interface CloudflareEnvelope {
  version: 2;
  deviceId: string;
  baseRemoteUpdatedAt: string | null;
  payloadUpdatedAt: string;
  sentAt: string;
  payload: AppState;
  forceOverwrite?: boolean;
}

export function createCloudflareEnvelope(params: {
  state: AppState;
  deviceId: string;
  forceOverwrite?: boolean;
}): CloudflareEnvelope {
  const now = new Date().toISOString();

  return {
    version: 2,
    deviceId: params.deviceId,
    baseRemoteUpdatedAt: params.state.config.cfRemoteUpdatedAt ?? null,
    payloadUpdatedAt: now,
    sentAt: now,
    payload: {
      ...params.state,
      config: {
        ...params.state.config,
        _lastUpdated: now
      }
    },
    forceOverwrite: params.forceOverwrite || undefined
  };
}
```

- [ ] **Step 2: Test envelope compatibility**

Create `app/src/sync/cloudflareSync.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMigrationFixture } from '../test/fixtures/appState';
import { createCloudflareEnvelope } from './cloudflareSync';

describe('createCloudflareEnvelope', () => {
  it('preserves version 2 conflict metadata', () => {
    const state = createMigrationFixture();
    const envelope = createCloudflareEnvelope({ state, deviceId: 'device-a' });

    expect(envelope.version).toBe(2);
    expect(envelope.deviceId).toBe('device-a');
    expect(envelope.baseRemoteUpdatedAt).toBe('2026-04-19T12:00:00.000Z');
    expect(envelope.payload.config.cfRemoteUpdatedAt).toBe('2026-04-19T12:00:00.000Z');
  });
});
```

- [ ] **Step 3: Keep credentials local**

Create `app/src/sync/credentials.ts`:

```ts
const CREDENTIAL_KEY = 'estudo_sync_creds';

export interface SyncCredentials {
  cfUrl?: string;
  cfToken?: string;
}

export function loadSyncCredentials(): SyncCredentials {
  const raw = localStorage.getItem(CREDENTIAL_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as SyncCredentials;
  } catch {
    return {};
  }
}

export function saveSyncCredentials(credentials: SyncCredentials): void {
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(credentials));
}
```

- [ ] **Step 4: Implement backup export/import**

Create `app/src/storage/exportImport.ts`:

```ts
import type { AppState } from '../domain/types';
import { normalizeImportedState } from '../domain/migrations';

export function serializeBackup(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseBackup(raw: string): AppState {
  const parsed = JSON.parse(raw);
  return normalizeImportedState(parsed);
}
```

- [ ] **Step 5: Verify sync/import tests**

Run:

```powershell
npm run test:react -- app/src/sync/cloudflareSync.test.ts
npm run test:unit -- tests/unit/sync-conflict.test.js
npm run test:e2e -- tests/e2e/sync-dados.spec.js
```

Expected: all pass.

---

## Phase 8: PWA, Service Worker, Manifest, And Offline Cutover

**Purpose:** Rebuild PWA behavior for the Vite output without losing installability or offline support.

**Files:**
- Create: `app/src/pwa/registerServiceWorker.ts`
- Create: `app/public/manifest.json`
- Create: `app/public/assets/icons/*`
- Create: `app/public/sw.js`
- Modify: `app/src/main.tsx`
- Modify: `vite.config.ts`

- [ ] **Step 1: Copy manifest and icons into React public assets**

Copy:

```text
src/manifest.json -> app/public/manifest.json
src/assets/icons/* -> app/public/assets/icons/
```

Then update manifest paths:

```json
{
  "start_url": "/",
  "scope": "/",
  "icons": [
    {
      "src": "/assets/icons/icon-192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

- [ ] **Step 2: Add service worker registration**

Create `app/src/pwa/registerServiceWorker.ts`:

```ts
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[PWA] service worker registration failed', error);
    });
  });
}
```

Modify `app/src/main.tsx`:

```tsx
import { registerServiceWorker } from './pwa/registerServiceWorker';

registerServiceWorker();
```

- [ ] **Step 3: Add Vite service worker asset copy**

Use `app/public/sw.js` for the first React PWA version. Cache only built shell assets and static icons.

- [ ] **Step 4: Verify build output**

Run:

```powershell
npm run build:react
Get-ChildItem dist
```

Expected:

```text
dist/index.html
dist/assets/
dist/manifest.json
dist/sw.js
```

- [ ] **Step 5: Manual offline check**

Run:

```powershell
npm run preview:react
```

Then in browser:

- Open app.
- Reload once.
- Disable network in DevTools.
- Refresh.

Expected: shell loads offline and existing persisted data remains visible.

---

## Phase 9: Playwright And CI Matrix For Legacy Plus React

**Purpose:** Ensure the React app proves parity before production cutover.

**Files:**
- Modify: `playwright.config.js`
- Create: `playwright.react.config.js`
- Modify: `.github/workflows/ci.yml`
- Create: `tests/e2e-react/app.spec.js`
- Create: `tests/e2e-react/persistence.spec.js`

- [ ] **Step 1: Add React Playwright config**

Create `playwright.react.config.js`:

```js
import { defineConfig } from '@playwright/test';

const PORT = 18346;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e-react',
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: BASE_URL,
    serviceWorkers: 'block',
    trace: 'on-first-retry'
  },
  webServer: {
    command: `npm run dev:react -- --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true
  }
});
```

- [ ] **Step 2: Add React E2E scripts**

Modify `package.json`:

```json
{
  "scripts": {
    "test:e2e:react": "playwright test --config playwright.react.config.js",
    "test:all": "npm run test:unit && npm run test:react && npm run test:e2e && npm run test:e2e:react"
  }
}
```

- [ ] **Step 3: Add React boot E2E**

Create `tests/e2e-react/app.spec.js`:

```js
import { expect, test } from '@playwright/test';

test('React app boots and navigates', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Estudo Organizado')).toBeVisible();
  await page.getByRole('button', { name: 'Calendario' }).click();
  await expect(page.getByRole('heading', { name: 'calendar' })).toBeVisible();
});
```

- [ ] **Step 4: Add React persistence E2E**

Create `tests/e2e-react/persistence.spec.js`:

```js
import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

test('React app reads legacy localStorage state', async ({ page }) => {
  const state = createE2EState();
  state.editais[0].nome = 'Concurso Migrado';

  await page.addInitScript((serializedState) => {
    localStorage.setItem('estudo_state', serializedState);
  }, JSON.stringify(state));

  await page.goto('/');

  await expect(page.getByText('Estudo Organizado')).toBeVisible();
});
```

- [ ] **Step 5: Extend CI**

Modify `.github/workflows/ci.yml`:

```yaml
      - name: Run React unit tests
        run: npm run test:react

      - name: Build React app
        run: npm run build:react

      - name: Run React E2E tests
        run: npm run test:e2e:react
```

Keep existing legacy test steps.

- [ ] **Step 6: Verify CI commands locally**

Run:

```powershell
npm run test:unit
npm run test:react
npm run build:react
npm run test:e2e
npm run test:e2e:react
```

Expected: all pass before cutover.

---

## Phase 10: Production Cutover

**Purpose:** Switch deployment from legacy `src` static assets to Vite `dist` only after React parity is proven.

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `README.md`
- Modify: `src/docs/releases/release-checklist.md`
- Create: `src/docs/releases/react-cutover-checklist.md`
- Modify: `package.json`

- [ ] **Step 1: Create cutover checklist**

Create `src/docs/releases/react-cutover-checklist.md`:

```md
# React Cutover Checklist

- [ ] `npm run test:unit` passes
- [ ] `npm run test:react` passes
- [ ] `npm run build:react` passes
- [ ] `npm run test:e2e` passes against legacy
- [ ] `npm run test:e2e:react` passes against React
- [ ] Existing IndexedDB data opens in React
- [ ] Existing localStorage fallback opens in React
- [ ] Cloudflare push/pull works
- [ ] Google Drive import/backup works
- [ ] PWA installs
- [ ] Offline reload works
- [ ] Mobile layout works at 390px width
- [ ] Manual destructive flows require confirmation
- [ ] Legacy app remains available in git history and can be restored
```

- [ ] **Step 2: Change Wrangler asset directory**

Modify `wrangler.jsonc`:

```json
{
  "assets": {
    "directory": "dist"
  }
}
```

- [ ] **Step 3: Add deployment prebuild rule**

Modify `package.json`:

```json
{
  "scripts": {
    "deploy": "npm run build:react && npx wrangler deploy",
    "preview:cloudflare": "npm run build:react && npx wrangler dev"
  }
}
```

- [ ] **Step 4: Update README run commands**

Change development commands:

```md
## Desenvolvimento

```bash
npm run dev:react
npm run build:react
npm run preview:react
```

## App legado

```bash
npm run dev:legacy
```
```

- [ ] **Step 5: Final local validation**

Run:

```powershell
npm run test:all
npm run build:react
npx wrangler dev
```

Expected:

- All tests pass.
- Cloudflare preview serves React app from `dist`.
- App loads in browser.

- [ ] **Step 6: Commit cutover**

Run:

```powershell
git add wrangler.jsonc package.json README.md src/docs/releases/react-cutover-checklist.md src/docs/releases/release-checklist.md
git commit -m "feat(react): switch production assets to vite build"
```

---

## Phase 11: Legacy Cleanup After Stable Release

**Purpose:** Remove legacy runtime only after one stable React release and a verified rollback path.

**Files:**
- Move or delete after approval: `src/index.html`, `src/js/`, `src/css/`, `src/sw.js`, `src/manifest.json`
- Keep: `src/docs/`
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Tag the last legacy-compatible release**

Run:

```powershell
git tag legacy-before-react-cutover
```

Expected: rollback tag exists locally.

- [ ] **Step 2: Confirm no production script serves `src`**

Run:

```powershell
rg -n "http-server src|directory\": \"src\"|src/index.html|src/sw.js" package.json wrangler.jsonc .github README.md
```

Expected: only historical docs references remain.

- [ ] **Step 3: Archive legacy source if desired**

Preferred cleanup:

```text
legacy-src/
```

Only move legacy runtime after the user explicitly approves cleanup. Keep `src/docs/` in place unless a separate docs migration is planned.

- [ ] **Step 4: Remove obsolete tests after replacement tests exist**

Only delete legacy-specific unit tests when React tests cover the same behavior. For every deleted test file, name the replacement test file in the commit body.

- [ ] **Step 5: Commit cleanup**

Run:

```powershell
git add README.md .gitignore legacy-src tests app
git commit -m "chore(react): archive legacy runtime after cutover"
```

---

## Cross-Phase Acceptance Criteria

- React app reads existing localStorage key `estudo_state`.
- React app reads and writes the existing IndexedDB database/store/key.
- Cloudflare sync envelope remains version `2`.
- Cloudflare credentials stay out of synced payloads.
- Google Drive backup payloads remain importable.
- PWA shell installs and reloads offline.
- The app works at 1366px, 1024px, 768px, and 390px.
- Primary buttons and active navigation meet at least 4.5:1 contrast for normal text.
- Keyboard navigation reaches sidebar, topbar controls, modals, forms, and calendar controls.
- E2E coverage exists for boot, navigation, editais, sessions, calendar, revisoes/habitos, sync, import/export, and persistence.
- Legacy production remains available until cutover.

## Rollback Strategy

- Before Phase 10: rollback is simple because production still serves `src`.
- During Phase 10: rollback by reverting the commit that changes `wrangler.jsonc` from `dist` back to `src`.
- After Phase 11: rollback by checking out `legacy-before-react-cutover` or restoring `legacy-src/` from git.
- No rollback step may delete browser data. The state schema must remain backward-readable through `normalizeImportedState`.

## Suggested Commit Sequence

```text
docs(migration): plan react vite typescript migration
build(react): scaffold vite typescript app
feat(react): add migration data contracts
feat(react): add legacy persistence adapter
feat(react): add app shell and state provider
feat(react): add clean design system foundation
feat(react): migrate home dashboard
feat(react): migrate settings
feat(react): migrate editais
feat(react): migrate study organizer
feat(react): migrate calendar
feat(react): migrate revisions and habits
feat(react): migrate cycle planning
feat(react): migrate sync and backup flows
test(react): add parity e2e suite
feat(react): switch production assets to vite build
chore(react): archive legacy runtime after cutover
```

## Execution Log

Append entries here as phases are executed.

```text
2026-04-21: Plan created. No implementation phases executed yet.
```
