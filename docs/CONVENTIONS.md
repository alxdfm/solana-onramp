# CONVENTIONS.md — solana-onramp

> Mandatory patterns. Every file in this library follows these rules.
> When in doubt: explicit > clever, boring > creative, readable > brief.

---

## Naming Conventions

### TypeScript / JavaScript

```
PascalCase    → types, interfaces, components, classes, enums
camelCase     → variables, functions, hooks, props, parameters
SCREAMING     → true constants (never change at runtime)
kebab-case    → file names, folder names, package names
```

**Examples:**
```ts
// Correct
type TopupResult = { status: string }
const walletAddress = params.walletAddress
function useOnramp() { ... }
const LAMPORTS_PER_SOL = 1_000_000_000n

// Wrong
type topupResult = { ... }      // should be PascalCase
const WalletAddress = ...       // should be camelCase
const lamportsPerSol = 1e9      // constant should be SCREAMING
```

### File Naming

| What | Pattern | Example |
|---|---|---|
| React component | `PascalCase.tsx` | `OnrampContext.tsx` |
| React hook | `useCamelCase.ts` | `useOnramp.ts`, `useFee.ts` |
| Adapter implementation | `adapter.ts` | `adapter.ts` |
| Config + schema | `config.ts` | `config.ts` |
| Helper utility | `kebab-case.ts` | `url-signer.ts` |
| Test file | same name + `.test.ts` | `adapter.test.ts` |
| Public exports | `index.ts` | `index.ts` |

---

## TypeScript Patterns

### Always use explicit return types on public functions

```ts
// Correct
async function getSOLPrice(): Promise<number> { ... }
function usdToLamports(amountUSD: number, solPriceUSD: number): bigint { ... }

// Wrong
async function getSOLPrice() { ... }  // return type inferred
```

### Result<T> for operations that can fail

All methods on `OnrampClient` return `Result<T>`. Adapters may throw — client wraps them.

```ts
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

// Client methods: always return Result
async topup(params: TopupParams): Promise<Result<TopupResult>>

// Adapter methods: may throw, will be caught by client
async openWidget(params: TopupParams): Promise<TopupResult>  // throws on error
```

### Zod is the source of truth for validated types

```ts
// Correct: infer the type from the Zod schema
export const moonPayAdapterConfigSchema = z.object({ apiKey: z.string() });
export type MoonPayAdapterConfig = z.infer<typeof moonPayAdapterConfigSchema>;

// Wrong: create a separate interface that mirrors the schema
export interface MoonPayAdapterConfig { apiKey: string }  // duplicates the schema!
```

### BigInt for lamport values

```ts
// Correct: lamports are always bigint
const lamports: bigint = usdToLamports(1.5, 150);  // returns bigint
const LAMPORTS_PER_SOL = 1_000_000_000n;           // bigint literal

// Wrong: using number for lamports (loses precision for large values)
const lamports: number = 10_000_000;
```

### No `any`

`noExplicitAny` is enforced by Biome. If you need an escape hatch, use `unknown` and
narrow the type explicitly.

---

## JSDoc Requirements

JSDoc is required on EVERYTHING that is part of the public API:

```ts
// Required on every public:
// - type alias
// - interface
// - interface field
// - class
// - class field
// - function
// - method

/**
 * Brief one-line description.
 *
 * More detail if needed. Explain the WHY, not just the what.
 * For learners: explain Solana concepts (lamports, PDA, etc.) on first use.
 *
 * @param paramName - What this parameter is and its constraints.
 * @returns What is returned and in what format.
 * @throws {ErrorType} When this error is thrown.
 *
 * @example
 * ```ts
 * const result = doSomething(42);
 * ```
 */
```

JSDoc must never be omitted "for brevity". This project prioritizes learning.

---

## Error Handling

### In adapter implementations

Adapters may throw errors. Always throw a typed error from `@callydus/onramp-core`:

```ts
throw new OracleError('Feed is halted', originalError);
throw new NotImplementedError('TransakAdapter.openWidget');
throw new ValidationError('walletAddress is required');
```

Never throw plain `Error` in library code — typed errors give consumers better diagnostics.

### In `OnrampClient`

The client catches all adapter errors and wraps them in `Result<T>`:

```ts
try {
  const result = await this.adapter.openWidget(params);
  return { success: true, data: result };
} catch (err) {
  return { success: false, error: wrap(err) };
}
```

### In React hooks

Hooks translate `Result<T>` into React state:

```ts
const result = await client.topup(params);
if (result.success) {
  setLastResult(result.data);
} else {
  setError(result.error);
}
```

---

## Package Structure

Each package must have:

```
packages/[name]/
├── src/
│   ├── adapter.ts    (or client.ts, or component files)
│   └── index.ts      ← ONLY public API goes here
├── src/__tests__/    ← tests go here, not next to source
├── CONTEXT.md        ← what this package does, when to use it
├── package.json
└── tsconfig.json
```

### `index.ts` rules

- Only re-export what consumers need
- Internal helpers (not part of the public API) are NOT re-exported
- Adding something to `index.ts` is a semver-relevant change

---

## Dependency Rules

| Package | Can depend on | Cannot depend on |
|---|---|---|
| `onramp-core` | `zod`, `@solana/web3.js` (peer) | Any specific provider SDK |
| `adapter-moonpay` | `onramp-core`, `@moonpay/moonpay-js` | `adapter-transak`, any oracle |
| `adapter-transak` | `onramp-core` | `adapter-moonpay`, any oracle |
| `oracle-pyth` | `onramp-core`, `@pythnetwork/client`, `@solana/web3.js` (peer) | Any adapter |
| `oracle-coingecko` | `onramp-core` | Any adapter, any oracle |
| `react` | `onramp-core`, `react` (peer), `@solana/web3.js` (peer) | Any adapter or oracle directly |

Adapters and oracles are injected into `OnrampClient` at construction. The `react` package
does not import from adapters or oracles — that coupling happens in the consumer app.

---

## Commit Message Format

```
feat(core): add OnrampClient.collectFee method
fix(adapter-moonpay): handle null widget initialization
chore(deps): update @moonpay/moonpay-js to 2.0.0
test(core): add edge cases to fee.test.ts
docs: add Oracle implementation guide to CONTRIBUTING.md
```

Format: `type(scope): description`
Types: `feat`, `fix`, `chore`, `test`, `docs`, `refactor`
