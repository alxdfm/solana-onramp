# solana-onramp

[![CI](https://github.com/callydus/solana-onramp/actions/workflows/ci.yml/badge.svg)](https://github.com/callydus/solana-onramp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@callydus/onramp-core)](https://www.npmjs.com/package/@callydus/onramp-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

Generic, provider-agnostic fiat-to-crypto onramp for Solana.

---

## Why this library?

Getting SOL into a user's wallet is surprisingly hard to get right:

- **Provider lock-in:** integrating MoonPay directly couples your app to their SDK and widget API. Switching providers later means rewriting the integration.
- **USD → lamports math:** Solana instructions work in lamports (1 SOL = 1,000,000,000 lamports). Converting a "$1.50 fee" to lamports requires the current SOL price, bigint arithmetic, and rounding — easy to get wrong.
- **Price oracle fragility:** if your single price source goes down, fee collection breaks.

`solana-onramp` solves all three:

1. **Adapter pattern** — swap MoonPay for Transak without changing a single line of app code.
2. **Built-in fee math** — `client.convertUSDToLamports(1.50)` returns the right `bigint`. The math is pure, tested, and handles rounding correctly.
3. **Pluggable oracles** — use Pyth in production, CoinGecko as a fallback. The client doesn't care which one.

**When NOT to use this library:** if you only need a buy button and don't collect fees, using a provider's native widget directly is simpler. This library earns its weight when you need the combination of fee collection + oracle + swappable provider.

---

## Packages

| Package | Description |
|---|---|
| [`@callydus/onramp-core`](./packages/core) | Core interfaces, `OnrampClient`, fee math, error types |
| [`@callydus/onramp-adapter-moonpay`](./packages/adapter-moonpay) | MoonPay SDK integration |
| [`@callydus/onramp-adapter-transak`](./packages/adapter-transak) | Transak stub (not yet implemented) |
| [`@callydus/onramp-oracle-pyth`](./packages/oracle-pyth) | Pyth Network price feed — production recommended |
| [`@callydus/onramp-oracle-coingecko`](./packages/oracle-coingecko) | CoinGecko free API — dev/testing only |
| [`@callydus/onramp-react`](./packages/react) | React hooks and context |

---

## Installation

```bash
# Core + the adapters you need
pnpm add @callydus/onramp-core @callydus/onramp-adapter-moonpay @callydus/onramp-oracle-pyth

# For React apps
pnpm add @callydus/onramp-react
```

---

## Quick Start

### 1. Create the client

```ts
import { createOnrampClient } from '@callydus/onramp-core';
import { MoonPayAdapter } from '@callydus/onramp-adapter-moonpay';
import { PythOracleAdapter } from '@callydus/onramp-oracle-pyth';

const client = createOnrampClient({
  onrampAdapter: new MoonPayAdapter({
    apiKey: process.env.NEXT_PUBLIC_MOONPAY_API_KEY,
    urlSignerEndpoint: '/api/sign-moonpay-url', // your backend route
    variant: 'overlay',
  }),
  oracleAdapter: new PythOracleAdapter({
    cluster: 'pythnet', // use 'devnet' for testing
  }),
  network: 'mainnet-beta',
});
```

### 2. Open the onramp widget

```ts
const result = await client.topup({
  walletAddress: userWallet.publicKey.toString(),
  amountFiat: 100,
  currency: 'USD',
  theme: 'dark',
  language: 'en',
});

if (result.success) {
  console.log('Topup status:', result.data.status);
  // 'success' | 'pending' | 'cancelled'
}
```

### 3. Get the SOL price

```ts
const priceResult = await client.getSOLPrice();
if (priceResult.success) {
  console.log(`1 SOL = $${priceResult.data}`);
}
```

### 4. Convert USD to lamports

```ts
const lamportsResult = await client.convertUSDToLamports(1.50);
if (lamportsResult.success) {
  console.log(`$1.50 = ${lamportsResult.data} lamports`);
  // e.g., 10_000_000n (at SOL=$150)
}
```

### 5. Collect a fee

```ts
import { PublicKey, Connection } from '@solana/web3.js';

const feeResult = await client.collectFee({
  from: new PublicKey(userWalletAddress),
  treasury: new PublicKey(TREASURY_WALLET_ADDRESS),
  amountUSD: 1.50,
  connection: new Connection(RPC_URL),
});

if (feeResult.success) {
  console.log('Fee collected! Signature:', feeResult.data);
}
```

---

## React Usage

### Setup

```tsx
// app.tsx or _app.tsx
import { OnrampProvider } from '@callydus/onramp-react';
import { createOnrampClient } from '@callydus/onramp-core';
import { MoonPayAdapter } from '@callydus/onramp-adapter-moonpay';
import { PythOracleAdapter } from '@callydus/onramp-oracle-pyth';

// Create outside the component — stable reference
const onrampClient = createOnrampClient({
  onrampAdapter: new MoonPayAdapter({ apiKey: process.env.NEXT_PUBLIC_MOONPAY_KEY }),
  oracleAdapter: new PythOracleAdapter({ cluster: 'pythnet' }),
  network: 'mainnet-beta',
});

function App({ children }) {
  return (
    <OnrampProvider client={onrampClient}>
      {children}
    </OnrampProvider>
  );
}
```

### useOnramp

```tsx
import { useOnramp } from '@callydus/onramp-react';

function BuySOLButton({ walletAddress }) {
  const { topup, isLoading, lastResult, error } = useOnramp();

  return (
    <div>
      <button
        onClick={() => topup({ walletAddress, amountFiat: 50, currency: 'USD' })}
        disabled={isLoading}
      >
        {isLoading ? 'Opening...' : 'Buy SOL'}
      </button>

      {lastResult && <p>Status: {lastResult.status}</p>}
      {error && <p className="error">Error: {error.message}</p>}
    </div>
  );
}
```

### useFee

```tsx
import { useFee } from '@callydus/onramp-react';
import { useEffect, useState } from 'react';

function FeeEstimator({ feeAmountUSD }: { feeAmountUSD: number }) {
  const { estimateFeeInSOL, solPrice, isLoading } = useFee();
  const [feeInSOL, setFeeInSOL] = useState<number | null>(null);

  useEffect(() => {
    estimateFeeInSOL(feeAmountUSD).then(setFeeInSOL);
  }, [feeAmountUSD, estimateFeeInSOL]);

  return (
    <div>
      <p>SOL price: ${solPrice?.toFixed(2) ?? '...'}</p>
      <p>Fee: ${feeAmountUSD} ≈ {feeInSOL?.toFixed(6) ?? '...'} SOL</p>
      {isLoading && <p>Fetching price...</p>}
    </div>
  );
}
```

---

## Fee Math

Converts USD fees to lamports using the current SOL price:

```
lamports = round( (amountUSD / solPriceUSD) × 1_000_000_000 )
```

You can use the pure utility functions directly:

```ts
import { usdToLamports, lamportsToUSD, LAMPORTS_PER_SOL } from '@callydus/onramp-core';

const lamports = usdToLamports(1.50, 150);  // 10_000_000n
const usd = lamportsToUSD(10_000_000n, 150); // 1.5

console.log(LAMPORTS_PER_SOL); // 1_000_000_000n
```

Lamport values are always `bigint` — never `number` — to avoid float precision loss at high SOL prices.

---

## MoonPay URL Signing

When you pass `walletAddress` to MoonPay, they require a backend signature on the widget URL
to prevent wallet address tampering. Set up a route in your backend:

```ts
// Next.js App Router — app/api/sign-moonpay-url/route.ts
import crypto from 'crypto';

export async function POST(req: Request) {
  const { url } = await req.json();

  const signature = crypto
    .createHmac('sha256', process.env.MOONPAY_SECRET_KEY!) // server-side secret key
    .update(new URL(url).search)                           // sign only the query string
    .digest('base64');

  return Response.json({ signature });
}
```

Then point the adapter to your route:

```ts
new MoonPayAdapter({
  apiKey: process.env.NEXT_PUBLIC_MOONPAY_API_KEY, // publishable key — safe for client
  urlSignerEndpoint: '/api/sign-moonpay-url',       // your backend route
})
```

The adapter calls this endpoint automatically when opening the widget.

---

## Architecture

```
Consumer code
     │
     ▼
OnrampClient       ← generic, Result<T> API, no provider knowledge
     │
     ├── OnrampAdapter      ← interface for fiat-to-crypto providers
     │       ├── MoonPayAdapter    (stable)
     │       └── TransakAdapter    (stub — PRs welcome)
     │
     └── PriceOracleAdapter ← interface for SOL/USD price sources
             ├── PythOracleAdapter      (production)
             └── CoinGeckoOracleAdapter (dev/testing)
```

The `core` package has zero runtime dependency on any provider SDK.

---

## Error Handling

All `OnrampClient` methods return `Result<T>` — they never throw:

```ts
const result = await client.getSOLPrice();

if (result.success) {
  doSomethingWithPrice(result.data); // number
} else {
  if (result.error instanceof PriceUnavailableError) {
    showFallbackPrice();
  } else if (result.error instanceof OracleError) {
    showOracleUnavailableMessage();
  }
}
```

### Error types

| Error class | Code | When thrown |
|---|---|---|
| `OnrampError` | — | Base class for all library errors |
| `OracleError` | `ORACLE_ERROR` | Network failure fetching price |
| `PriceUnavailableError` | `PRICE_UNAVAILABLE` | Feed halted, stale, or missing |
| `FeeCollectionError` | `FEE_COLLECTION_FAILED` | SOL transfer transaction failed |
| `NotImplementedError` | `NOT_IMPLEMENTED` | Stub adapter method called |
| `ValidationError` | `VALIDATION_ERROR` | Invalid input parameters |

---

## Development

```bash
git clone https://github.com/callydus/solana-onramp
cd solana-onramp
pnpm install
pnpm build
pnpm test
pnpm lint
```

---

## License

MIT — 2026 Callydus. See [LICENSE](./LICENSE).
