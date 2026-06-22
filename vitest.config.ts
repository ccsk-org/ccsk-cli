import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['.add/tasks/**/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
