# CLAUDE.md — solana-onramp

> This file is read automatically by Claude in every session.
> It replaces the need to re-explain the project. Do not modify without updating the source files.

---

## What this project is

**solana-onramp** is a generic, provider-agnostic open-source library for fiat-to-crypto onramp on Solana.

Key principles:
1. **No provider knowledge in core** — `@callydus/onramp-core` has zero imports from MoonPay, Transak, Pyth, or CoinGecko
2. **Adapter pattern** — providers are injected at construction time via interfaces
3. **Result<T> everywhere** — no throws in business logic, errors are values
4. **USD → lamports abstraction** — consumers think in USD, the library handles lamport math
5. **No callydus-sign dependency** — this library is completely standalone

---

## Documentation map

Always read the relevant file before modifying code:

| File | When to read |
|---|---|
| `docs/UBIQUITOUS_LANGUAGE.md` | Always — defines exact terms for the domain |
| `docs/CONVENTIONS.md` | Always — naming, patterns, structure |
| `packages/core/CONTEXT.md` | Before touching core types, client, fee math |
| `packages/adapter-moonpay/CONTEXT.md` | Before touching MoonPay integration |
| `packages/adapter-transak/CONTEXT.md` | Before implementing Transak |
| `packages/oracle-pyth/CONTEXT.md` | Before touching Pyth oracle |
| `packages/oracle-coingecko/CONTEXT.md` | Before touching CoinGecko oracle |
| `packages/react/CONTEXT.md` | Before touching React hooks |

---

## Repository structure

```
solana-onramp/                          ← monorepo (Turborepo + pnpm)
├── packages/
│   ├── core/                           ← OnrampClient, interfaces, fee math, errors
│   │   └── src/
│   │       ├── types.ts                ← ALL public interfaces + Result<T>
│   │       ├── client.ts               ← OnrampClient class
│   │       ├── fee.ts                  ← usdToLamports, lamportsToUSD, LAMPORTS_PER_SOL
│   │       ├── errors.ts               ← typed error hierarchy
│   │       └── index.ts                ← public API re-exports
│   ├── adapter-moonpay/                ← MoonPay SDK adapter
│   │   └── src/
│   │       ├── config.ts               ← Zod schema for MoonPayAdapterConfig
│   │       ├── url-signer.ts           ← HMAC-SHA256 URL signing helper
│   │       └── adapter.ts              ← MoonPayAdapter class
│   ├── adapter-transak/                ← Transak STUB (not implemented)
│   ├── oracle-pyth/                    ← Pyth Network price oracle
│   │   └── src/
│   │       ├── config.ts               ← Pyth constants + PythAdapterConfig schema
│   │       └── adapter.ts              ← PythOracleAdapter class
│   ├── oracle-coingecko/               ← CoinGecko free API oracle (dev only!)
│   └── react/                          ← React Context + useOnramp + useFee
│       └── src/
│           ├── OnrampContext.tsx        ← Context + OnrampProvider
│           ├── useOnramp.ts            ← hook for topup flows
│           └── useFee.ts               ← hook for fee estimation/collection
└── docs/
    ├── UBIQUITOUS_LANGUAGE.md
    └── CONVENTIONS.md
```

---

## Key patterns

### Result<T> — always return, never throw (in client)

```ts
// OnrampClient methods return Result<T>
const result = await client.topup(params);
if (result.success) {
  use(result.data);  // TopupResult
} else {
  handle(result.error);  // typed Error subclass
}

// Adapters MAY throw — client catches and wraps
async openWidget(params): Promise<TopupResult> {
  throw new OnrampError('...');  // OK in adapter
}
```

### Dependency injection — no coupling to specific providers

```ts
// Consumer provides both adapters at construction
const client = createOnrampClient({
  onrampAdapter: new MoonPayAdapter({ ... }),
  oracleAdapter: new PythOracleAdapter({ ... }),
  network: 'mainnet-beta',
});

// core package has NO import from adapter-moonpay or oracle-pyth
```

### Zod schemas = TypeScript types

```ts
// Only define the type once — infer it from Zod
export const configSchema = z.object({ apiKey: z.string() });
export type Config = z.infer<typeof configSchema>;  // never duplicate as interface
```

### BigInt for lamports

```ts
// lamports are always bigint — LAMPORTS_PER_SOL is bigint
const lamports: bigint = usdToLamports(1.50, 150);  // 10_000_000n
```

---

## What NOT to do

- Do NOT import from callydus-sign
- Do NOT add `any` types (enforced by Biome)
- Do NOT use throw in OnrampClient methods (return Result<T>)
- Do NOT create TypeScript interfaces that duplicate Zod schemas
- Do NOT use number for lamport values (use bigint)
- Do NOT use CoinGeckoOracleAdapter in production
- Do NOT omit JSDoc (didatic priority — the developer is learning)

---

## Running the project

```bash
# Install
pnpm install

# Build all packages (core → adapters/oracles → react)
pnpm build

# Run all tests
pnpm test

# Lint
pnpm lint
```

Turbo handles the build order based on workspace dependencies.

---

## Checklist before modifying any file

- [ ] Read the CONTEXT.md of the package being modified
- [ ] Using exact terms from UBIQUITOUS_LANGUAGE.md
- [ ] Following structure from CONVENTIONS.md
- [ ] JSDoc on every new public export
- [ ] No `any` types
- [ ] Result<T> for client methods, throw for adapter methods
- [ ] Zod schema is the single source of truth for configs
- [ ] Tests cover the new code
