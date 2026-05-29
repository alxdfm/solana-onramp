import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Inline rpc-websockets and uuid to resolve ESM/CJS interop issues from @solana/web3.js
    server: {
      deps: {
        inline: ['rpc-websockets', 'uuid', '@solana/web3.js'],
      },
    },
  },
});
