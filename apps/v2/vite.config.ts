import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';

function swPrecache(): Plugin {
  return {
    name: 'v2-sw-precache',
    apply: 'build',
    closeBundle() {
      const dist = resolve(process.cwd(), 'dist');
      const sw = join(dist, 'sw.js');
      const files: string[] = [];
      const walk = (directory: string): void => {
        for (const entry of readdirSync(directory)) {
          const full = join(directory, entry);
          if (statSync(full).isDirectory()) {
            walk(full);
            continue;
          }
          const rel = relative(dist, full).replace(/\\/g, '/');
          if (rel !== 'sw.js' && !rel.endsWith('.map')) files.push(`/${rel}`);
        }
      };
      try {
        walk(dist);
        const source = readFileSync(sw, 'utf8');
        const buildId = createHash('sha256')
          .update(files.sort().map((rel) => {
            const content = readFileSync(join(dist, rel));
            return `${rel}:${createHash('sha256').update(content).digest('hex')}`;
          }).join('|'))
          .update('\n')
          .update(source)
          .digest('hex')
          .slice(0, 12);
        writeFileSync(
          sw,
          `self.__PRECACHE__ = ${JSON.stringify(files)};\n${source.replace('__V2_BUILD__', buildId)}`,
        );
      } catch (error) {
        // The SW is optional in non-browser/test builds, but an existing SW
        // that cannot be versioned must fail the build rather than ship stale.
        if (existsSync(sw)) throw error;
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  envPrefix: 'VITE_',
  define: {
    __V2_E2E__: JSON.stringify(mode === 'e2e'),
  },
  plugins: [react(), swPrecache()],
  server: {
    host: '127.0.0.1',
    port: 18431,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 18431,
    strictPort: true,
    headers: {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    },
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
}));
