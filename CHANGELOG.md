# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

No unreleased changes.

---

## [0.1.0] — 2026-05-28

Initial release of the `solana-onramp` monorepo.

### Added

**`@callydus/onramp-core`**
- `OnrampAdapter` interface — contract for fiat-to-crypto providers
- `PriceOracleAdapter` interface — contract for SOL/USD price sources
- `OnrampClient` class with `Result<T>` API (never throws in business logic)
- `createOnrampClient(config)` factory function
- `TopupParams` and `TopupResult` interfaces
- `FeeParams` interface for on-chain fee collection
- `usdToLamports(amountUSD, solPriceUSD): bigint` — USD to lamports conversion
- `lamportsToUSD(lamports, solPriceUSD): number` — lamports to USD conversion
- `usdToSOL(amountUSD, solPriceUSD): number` — USD to SOL conversion
- `LAMPORTS_PER_SOL` constant (`1_000_000_000n`)
- Typed error classes: `OnrampError`, `OracleError`, `PriceUnavailableError`, `FeeCollectionError`, `NotImplementedError`, `ValidationError`
- Zod schema validation for `OnrampClientConfig`

**`@callydus/onramp-adapter-moonpay`**
- `MoonPayAdapter` — full implementation using `@moonpay/moonpay-js` v0.7.x
- Overlay and embedded widget variants
- Automatic sandbox/production detection from API key prefix (`pk_test_` / `pk_live_`)
- `onTransactionCompleted` and `onClose` handler wiring
- MoonPay status → `TopupResult.status` mapping (`completed` → `success`, `pending` → `pending`)
- `urlSignerEndpoint` — backend URL signing for `walletAddress` parameter
- `url-signer.ts` helper for HMAC-SHA256 URL signing on the backend
- Static currencies/countries lists for `getSupportedCurrencies()` / `getSupportedCountries()`
- `MoonPayAdapterConfig` with Zod validation

**`@callydus/onramp-adapter-transak`**
- Stub — all methods throw `NotImplementedError`
- Documented as a contribution target in `CONTEXT.md`

**`@callydus/onramp-oracle-pyth`**
- `PythOracleAdapter` — uses `@pythnetwork/client` `PythHttpClient`
- `getData()` → `productPrice.get('Crypto.SOL/USD')` price feed lookup
- Cluster support: `pythnet` (production), `devnet` (testing)
- `PriceStatus.Trading` guard — throws `PriceUnavailableError` for halted/stale feeds
- Configurable `maxPriceAgeMs` for stale price detection
- `PythAdapterConfig` with Zod validation and `PythCluster` type

**`@callydus/onramp-oracle-coingecko`**
- `CoinGeckoOracleAdapter` — uses CoinGecko free public API (no auth required)
- `GET /api/v3/simple/price?ids=solana&vs_currencies=usd`
- Rate-limiting warning — documented as dev/testing only

**`@callydus/onramp-react`**
- `OnrampContext` and `OnrampProvider`
- `useOnramp()` hook with `topup`, `isLoading`, `lastResult`, `error`
- `useFee()` hook with `collectFee`, `estimateFeeInLamports`, `estimateFeeInSOL`, `solPrice`, `isLoading`, `error`

**Repository**
- Turborepo + pnpm workspace monorepo setup
- Biome for lint and formatting
- Vitest test suite — 99 tests across 4 packages
- GitHub Actions CI: type-check, build, test, lint
- `UBIQUITOUS_LANGUAGE.md`, `CONVENTIONS.md`, `CLAUDE.md`
- `CONTRIBUTING.md` with step-by-step guides for adapters and oracles
- MIT License

[Unreleased]: https://github.com/callydus/solana-onramp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/callydus/solana-onramp/releases/tag/v0.1.0
