import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
  },
});
