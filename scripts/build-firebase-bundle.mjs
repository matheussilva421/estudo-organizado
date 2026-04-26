import { build } from 'esbuild';

await build({
  entryPoints: ['scripts/firebase-bundle-entry.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  sourcemap: false,
  outfile: 'src/vendor/firebase-client.bundle.js'
});

console.log('Built src/vendor/firebase-client.bundle.js');
