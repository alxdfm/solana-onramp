# CONTEXT.md — @callydus/onramp-core

## What this package does

`@callydus/onramp-core` is the foundation of the solana-onramp library. It defines:

1. **Public interfaces** — the contracts that all adapters must implement (`OnrampAdapter`, `PriceOracleAdapter`)
2. **The OnrampClient** — the central orchestrator that combines an onramp provider with a price oracle
3. **Fee math** — pure functions for converting USD ↔ lamports ↔ SOL
4. **Typed errors** — a hierarchy of error classes for precise error handling
5. **The Result<T> type** — the discriminated union used throughout for safe error handling

This package has **no runtime dependency on any specific provider**. It knows nothing about MoonPay, Transak, Pyth, or CoinGecko. Those are injected via the adapter pattern.

## When to import this package

Import `@callydus/onramp-core` when you need:
- The `OnrampClient` class (the main API)
- The `OnrampAdapter` or `PriceOracleAdapter` interfaces (to build a custom adapter)
- The `usdToLamports` / `lamportsToUSD` utility functions
- The `Result<T>` type
- Any of the error classes

## Internal structure

```
src/
├── types.ts     # All public interfaces: TopupParams, TopupResult, OnrampAdapter,
│                # PriceOracleAdapter, FeeParams, OnrampClientConfig, Result<T>, Network
├── errors.ts    # Error class hierarchy: OnrampError → OracleError, PriceUnavailableError,
│                # FeeCollectionError, NotImplementedError, ValidationError
├── fee.ts       # Pure math: usdToLamports(), lamportsToUSD(), usdToSOL(), LAMPORTS_PER_SOL
├── client.ts    # OnrampClient class + createOnrampClient() factory
└── index.ts     # Re-exports everything that is part of the public API
```

## Key design decisions

### Result<T> instead of throw
All `OnrampClient` methods return `Result<T>`. The client catches errors thrown by adapters
and wraps them. This means callers never need try/catch when using the client.

### Adapters throw, client wraps
By convention, adapter implementations MAY throw errors. The `OnrampClient` catches them
in each method and returns `{ success: false, error }`. This keeps adapters simple while
making the client's API safe.

### BigInt for lamports
The `usdToLamports` function returns `bigint` because lamports are integers and `bigint`
arithmetic is exact. JavaScript's `number` could lose precision for very large lamport values.

### No caching
The client fetches fresh prices on every call. Caching is the adapter's or caller's responsibility.

## Dependencies

- `@solana/web3.js` — peer dependency (caller provides it); used for `PublicKey`, `Connection`,
  `SystemProgram`, `Transaction`, `sendAndConfirmTransaction`
- `zod` — used for config validation schemas

## Tests

```
src/__tests__/
├── fee.test.ts     # Tests usdToLamports, lamportsToUSD, usdToSOL with exact numeric cases
└── client.test.ts  # Tests OnrampClient methods with mocked adapters
```

Run with: `pnpm test` from this package directory.
