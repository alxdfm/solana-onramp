# UBIQUITOUS_LANGUAGE.md — solana-onramp

> This glossary defines the exact terms used in all code, comments, documentation, and conversation.
> **If a term is not here, it does not exist in this project.**
> Using synonyms causes confusion and bugs. Use these exact words.

---

## Core Domain Terms

### Onramp
The process of converting fiat currency (USD, BRL, EUR) into cryptocurrency (SOL).
The opposite of "offramp" (crypto → fiat).
In code: `onramp` (noun), `topup` (verb for the user action of purchasing crypto).

### Topup
The user action of purchasing cryptocurrency using fiat currency via an onramp provider.
Named "topup" because it adds SOL to the user's wallet.
In code: `TopupParams` (input), `TopupResult` (output), `topup()` (method name).
**Never use:** `buy`, `purchase`, `swap`, `onramp` as a verb.

### TopupParams
The input parameters for a topup operation: wallet address, fiat amount, currency, theme, etc.
In code: `TopupParams` interface (PascalCase, always the interface name).

### TopupResult
The output of a completed topup interaction: status + optional transaction ID.
In code: `TopupResult` interface.
Status values: `'success' | 'pending' | 'failed' | 'cancelled'`.

### Widget
The provider's embedded UI (modal, overlay, or embedded iframe) where the user
completes the fiat payment flow. Each provider has their own widget implementation.
In code: `openWidget(params)` is the method on `OnrampAdapter`.
**Never use:** `modal`, `iframe`, `checkout`, `flow`.

### OnrampAdapter
The interface that every fiat-to-crypto provider integration must implement.
Defines: `openWidget()`, `getSupportedCurrencies()`, `getSupportedCountries()`.
In code: `OnrampAdapter` (interface, PascalCase).
**Never use:** `provider`, `integration`, `service`.

### PriceOracle / PriceOracleAdapter
The interface that every price data source must implement.
Provides SOL/USD prices for fee conversion.
In code: `PriceOracleAdapter` (interface), `oracle` (variable name).
**Never use:** `priceFeed`, `priceService`, `rateProvider`.

### FeeParams
The parameters for collecting a SOL fee: payer wallet, treasury wallet, USD amount, connection.
The USD amount is converted internally to lamports.
In code: `FeeParams` interface.

### Lamports
The smallest unit of SOL on the Solana blockchain.
1 SOL = 1,000,000,000 (one billion) lamports.
Lamports are always integers (no fractions). Always use `bigint` for lamport values in code.
In code: `lamports` (variable), `LAMPORTS_PER_SOL` (constant).
**Never use:** `lamport` (always plural), `units`, `satoshis`.

### Treasury
The wallet address that receives collected fees.
In code: `treasury` (FeeParams field), `TREASURY_ADDRESS` (constant in consumer apps).
**Never use:** `feeWallet`, `recipient`, `destination`.

### Network
The Solana network being targeted.
Values: `'mainnet-beta'`, `'devnet'`, `'testnet'`.
In code: `Network` (type), `network` (field on `OnrampClientConfig`).
**Never use:** `chain`, `env`, `environment` (as a substitute for network).

### Result<T>
The discriminated union used for all operations that can fail.
Either `{ success: true; data: T }` or `{ success: false; error: E }`.
All `OnrampClient` methods return `Result<T>`. Adapters may throw — the client wraps them.
In code: `Result<T>` (generic type alias).
**Never use:** try/catch in business logic, `Promise.reject()` for expected failures.

### Adapter
A package that implements one of the core interfaces (`OnrampAdapter` or `PriceOracleAdapter`)
for a specific provider. Named with the prefix `adapter-` (onramp) or `oracle-` (price).
In code: `MoonPayAdapter`, `TransakAdapter`, `PythOracleAdapter`, `CoinGeckoOracleAdapter`.

### Oracle
Specifically, a `PriceOracleAdapter` — a data source for SOL/USD prices.
In code: packages prefixed with `oracle-` (e.g., `oracle-pyth`, `oracle-coingecko`).

---

## Provider-Specific Terms

### MoonPay
A regulated fiat-to-crypto on-ramp provider. The first supported adapter.
API key format: `pk_test_...` (sandbox), `pk_live_...` (production).
In code: `MoonPayAdapter`, `MoonPayAdapterConfig`.

### Transak
A fiat-to-crypto on-ramp provider (stub, not yet implemented).
In code: `TransakAdapter`.

### Pyth Network
A decentralized oracle protocol for real-time financial price data on Solana.
The recommended oracle for production use.
In code: `PythOracleAdapter`, `PythAdapterConfig`, `PythCluster`.

### CoinGecko
A cryptocurrency data aggregator with a free public API.
The development/testing oracle (not for production).
In code: `CoinGeckoOracleAdapter`.

---

## State Terminology

### TopupResult.status values

| Value | Meaning |
|---|---|
| `'success'` | Purchase completed; SOL is on its way to the wallet |
| `'pending'` | Payment received but crypto not yet transferred |
| `'failed'` | Purchase failed (payment rejected, provider error) |
| `'cancelled'` | User closed the widget before completing |

---

## What does NOT exist in this glossary

The following terms are intentionally excluded — they have no meaning in this library:

- `buy`, `purchase` (use `topup`)
- `signer`, `signature` (except in Solana transaction context — use `TransactionSignature`)
- `wallet` as a type (use `PublicKey`)
- `token` (this library only handles native SOL, not SPL tokens)
- `callydus-sign` (this library has no dependency on or knowledge of callydus-sign)
