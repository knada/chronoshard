// Vite: dev server with instant TypeScript, and the production bundle in dist/. Vitest runs the tests with the same
// setup (npm test).
import { defineConfig } from 'vitest/config';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  base: './', // relative paths, so the built game runs from any folder or sub-path
  server: { port: 8642, strictPort: true },
  preview: { port: 8642, strictPort: true },
  build: { outDir: 'dist', target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
  // game logic runs under jsdom; tests/setup.ts stands in for the canvas
  test: { environment: 'jsdom', setupFiles: ['tests/setup.ts'], include: ['tests/**/*.test.ts'] },
  plugins: [{
    // the WebP sprite sheets are fetched at runtime (manifest.json lists them), not imported, so copy them as-is
    // (the PNG masters in sprite-sheets/ stay out of the build; `npm run sprites` makes the WebPs from them)
    name: 'copy-sprite-sheets',
    apply: 'build',
    closeBundle() { cpSync(resolve(root, 'sprite-sheets-webp'), resolve(root, 'dist/sprite-sheets-webp'), { recursive: true }); },
  }],
});
