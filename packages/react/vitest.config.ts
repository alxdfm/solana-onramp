import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    server: {
      deps: {
        inline: ['rpc-websockets', 'uuid', '@solana/web3.js'],
      },
    },
  },
  resolve: {
    alias: {
      '@callydus/onramp-core': resolve(__dirname, '../core/src/index.ts'),
      // Stub out @solana/web3.js to avoid rpc-websockets CJS/ESM interop issues.
      '@solana/web3.js': resolve(
        __dirname,
        'src/__tests__/__mocks__/solana-web3.ts',
      ),
    },
  },
});
