import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const outputPath = 'src/vendor/firebase-client.bundle.js';

await build({
  entryPoints: ['scripts/firebase-bundle-entry.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  sourcemap: false,
  outfile: outputPath
});

const output = await readFile(outputPath, 'utf8');
await writeFile(outputPath, output.replace(/[ \t]+$/gm, ''));

console.log(`Built ${outputPath}`);
