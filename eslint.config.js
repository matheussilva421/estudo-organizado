import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';

const browserGlobals = {
  Chart: 'readonly',
  gapi: 'readonly',
  google: 'readonly',
  Notification: 'readonly',
  FileReader: 'readonly',
  URL: 'readonly',
  Blob: 'readonly',
  Request: 'readonly',
  fetch: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  indexedDB: 'readonly',
  IDBKeyRange: 'readonly',
  navigator: 'readonly',
  document: 'readonly',
  window: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  Element: 'readonly',
  HTMLElement: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  TouchEvent: 'readonly',
  DragEvent: 'readonly',
  DataTransfer: 'readonly',
  Node: 'readonly',
  Text: 'readonly',
  Comment: 'readonly',
  DocumentFragment: 'readonly',
  ShadowRoot: 'readonly',
  MutationObserver: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  performance: 'readonly',
  crypto: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  getComputedStyle: 'readonly',
  location: 'readonly',
  Headers: 'readonly',
  Audio: 'readonly',
  structuredClone: 'readonly',
  caches: 'readonly',
  CacheStorage: 'readonly',
  ESTUDO_FIREBASE_CONFIG: 'readonly',
  ESTUDO_APP_CHECK_SITE_KEY: 'readonly',
  EstudoApp: 'writable',
  disconnectDrive: 'writable',
  pullFromDrive: 'writable',
  loadPastAssuntos: 'writable',
  clearData: 'writable',
  openAddEventModal: 'writable',
};

const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  global: 'readonly',
};

const serviceWorkerGlobals = {
  self: 'readonly',
  importScripts: 'readonly',
 clients: 'readonly',
  skipWaiting: 'readonly',
  RegistrationOptions: 'readonly',
};

const testGlobals = {
  describe: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  vi: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
};

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...testGlobals,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'error',
      'semi': ['warn', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-trailing-spaces': 'warn',
      'eol-last': 'warn',
      'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
    },
  },
  {
    files: ['src/sw.js'],
    languageOptions: {
      globals: {
        ...serviceWorkerGlobals,
      },
    },
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'src/js/firebase-bundle.js',
      'src/vendor/**',
      '*.min.js',
    ],
  },
];
