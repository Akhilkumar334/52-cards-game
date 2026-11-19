import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: [
      'engine/src/**/__tests__/**/*.test.ts',
      'bots/src/**/__tests__/**/*.test.ts',
      'ui/src/**/__tests__/**/*.test.ts',
    ],
    environment: 'node',
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      '@cards/engine': path.resolve(__dirname, 'engine/src'),
      '@cards/bots': path.resolve(__dirname, 'bots/src'),
    },
  },
});
