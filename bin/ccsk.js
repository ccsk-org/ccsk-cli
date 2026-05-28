#!/usr/bin/env node
import('../dist/cli.js').catch((err) => {
  console.error('Failed to start ccsk:', err?.message ?? err);
  console.error('\nHint: run `bun install && bun run build` (or `npm install && npm run build`) first.');
  process.exit(1);
});
