// @vitest-environment node
// Ambiente node é obrigatório: a API do esbuild rejeita o TextEncoder do jsdom
// ("Invariant violation: ... instanceof Uint8Array").
//
// Histórico: este contrato vivia em action-contracts.test.js e rodava o esbuild
// via `npx` em processo filho com o timeout padrão de 5s — sob carga (suíte
// paralela), o spawn estourava o timeout e causava a falha intermitente da
// suíte (flake capturado em 2026-07-10). A API programática elimina o npx e
// reduz o tempo de ~6s para ~150ms.
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { buildSync } from 'esbuild';

const rootDir = process.cwd();

describe('bundle graph contract', () => {
  it(
    'keeps the browser module graph bundleable without missing exports',
    () => {
      expect(() =>
        buildSync({
          entryPoints: [join(rootDir, 'src/js/main.js')],
          bundle: true,
          format: 'esm',
          write: false,
          logLevel: 'silent',
          absWorkingDir: rootDir,
        })
      ).not.toThrow();
    },
    30_000
  );
});
