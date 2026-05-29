# CONTRIBUTING.md — solana-onramp

## Table of Contents

- [Adding a new onramp adapter](#adding-a-new-onramp-adapter)
- [Adding a new price oracle](#adding-a-new-price-oracle)
- [Development setup](#development-setup)
- [Running tests](#running-tests)
- [Code style](#code-style)
- [Submitting a pull request](#submitting-a-pull-request)

---

## Adding a new onramp adapter

Onramp adapters implement the `OnrampAdapter` interface from `@callydus/onramp-core`.

### Step 1: Create the package

```bash
mkdir -p packages/adapter-myprovider/src/__tests__
```

### Step 2: Create `package.json`

```json
{
  "name": "@callydus/onramp-adapter-myprovider",
  "version": "0.1.0",
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@callydus/onramp-core": "workspace:*",
    "@myprovider/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### Step 3: Create `src/config.ts`

Define a Zod schema for the adapter's configuration:

```ts
import { z } from 'zod';

export const myProviderConfigSchema = z.object({
  apiKey: z.string().min(1),
  // ... other config fields
});

export type MyProviderAdapterConfig = z.infer<typeof myProviderConfigSchema>;
```

### Step 4: Create `src/adapter.ts`

Implement the `OnrampAdapter` interface:

```ts
import type { OnrampAdapter, TopupParams, TopupResult } from '@callydus/onramp-core';
import { OnrampError } from '@callydus/onramp-core';

export class MyProviderAdapter implements OnrampAdapter {
  constructor(private readonly config: MyProviderAdapterConfig) {
    myProviderConfigSchema.parse(config);  // validate at construction
  }

  async openWidget(params: TopupParams): Promise<TopupResult> {
    // Integrate with your provider's SDK/API
    // Return TopupResult — do not return Result<T> here, that's the client's job
    // Throw OnrampError (or subclass) on failure
  }

  async getSupportedCurrencies(): Promise<string[]> {
    return ['USD', 'EUR', ...];
  }

  async getSupportedCountries(): Promise<string[]> {
    return ['US', 'DE', ...];
  }
}
```

### Step 5: Create `src/__tests__/adapter.test.ts`

Mock the provider SDK and test all three methods:

```ts
import { describe, it, expect, vi } from 'vitest';
import { MyProviderAdapter } from '../adapter.js';

vi.mock('@myprovider/sdk', () => ({ ... }));

describe('MyProviderAdapter', () => {
  describe('openWidget', () => { ... });
  describe('getSupportedCurrencies', () => { ... });
  describe('getSupportedCountries', () => { ... });
});
```

### Step 6: Create `CONTEXT.md`

Document:
- What the package does
- When to use it vs other adapters
- Internal structure
- Any setup requirements (API keys, URL signing, etc.)

### Step 7: Add to the workspace

Add the package to `pnpm-workspace.yaml` (it's already a glob pattern, so it's automatic).

### Step 8: Update `README.md`

Add the new package to the packages table and add a usage example.

---

## Adding a new price oracle

Price oracle adapters implement the `PriceOracleAdapter` interface from `@callydus/onramp-core`.

### Required methods

```ts
interface PriceOracleAdapter {
  getSOLPrice(): Promise<number>;
  getSOLAmount(amountUSD: number): Promise<number>;
  getSOLInLamports(amountUSD: number): Promise<bigint>;
}
```

The utility functions `usdToLamports` and `usdToSOL` from `@callydus/onramp-core` handle
the math — your oracle just needs to provide the SOL price.

### Typical implementation pattern

```ts
import type { PriceOracleAdapter } from '@callydus/onramp-core';
import { OracleError, PriceUnavailableError, usdToLamports, usdToSOL } from '@callydus/onramp-core';

export class MyOracleAdapter implements PriceOracleAdapter {
  async getSOLPrice(): Promise<number> {
    const price = await fetchPriceFromMySource();
    if (!price) throw new PriceUnavailableError('Price not available');
    return price;
  }

  async getSOLAmount(amountUSD: number): Promise<number> {
    return usdToSOL(amountUSD, await this.getSOLPrice());
  }

  async getSOLInLamports(amountUSD: number): Promise<bigint> {
    return usdToLamports(amountUSD, await this.getSOLPrice());
  }
}
```

### Error types to use

- `OracleError`: Network failure, unexpected HTTP status, SDK error
- `PriceUnavailableError`: Price returned but invalid (null, halted, zero, stale)

---

## Development setup

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Clone and install
git clone https://github.com/callydus/solana-onramp
cd solana-onramp
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint all packages
pnpm lint
```

---

## Running tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
cd packages/core && pnpm test

# Watch mode
cd packages/core && pnpm test:watch
```

---

## Code style

This project uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
# Check all files
pnpm lint

# Auto-fix issues
pnpm lint:fix

# Format all files
pnpm format
```

Key rules (enforced by Biome):
- No `any` — use `unknown` and type narrowing
- No unused variables or imports
- Single quotes for strings
- 100 character line width
- JSDoc required on all public exports

---

## Submitting a pull request

1. Fork the repository
2. Create a branch: `git checkout -b feat/adapter-myprovider`
3. Write code following the patterns in CONVENTIONS.md
4. Write tests — all new code must have tests
5. Ensure all checks pass: `pnpm build && pnpm test && pnpm lint`
6. Open a pull request with a clear description

### PR checklist

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (all existing + new tests)
- [ ] `pnpm lint` passes (no Biome errors)
- [ ] JSDoc on all public exports
- [ ] CONTEXT.md created/updated for affected packages
- [ ] README.md updated if adding a new package
- [ ] No `any` types
- [ ] Result<T> used for all methods that can fail
