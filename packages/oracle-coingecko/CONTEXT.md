# CONTEXT.md — @callydus/onramp-oracle-coingecko

## Status: Functional stub (development/testing only)

## What this package does

Implements the `PriceOracleAdapter` interface from `@callydus/onramp-core` using the
[CoinGecko free public API](https://www.coingecko.com/en/api).

No SDK, no API key, no authentication required. Uses the standard `fetch` API.

## When to use this package

ONLY use for:
- Local development (`pnpm dev`)
- Unit tests and CI environments
- Prototyping
- Fallback when Pyth Network is temporarily unavailable

## When NOT to use this package

Do NOT use in production because:
- Rate limit: ~10-30 requests/minute per IP on the free tier
- No uptime SLA
- Prices updated every 1-2 minutes (not real-time)

**Use `@callydus/onramp-oracle-pyth` for production.**

## API endpoint used

```
GET https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd
Response: { "solana": { "usd": 150.42 } }
```

## Internal structure

```
src/
├── adapter.ts    # CoinGeckoOracleAdapter class
└── index.ts      # Public re-exports
```

## Dependencies

- `@callydus/onramp-core` — for the `PriceOracleAdapter` interface and error classes
- No external SDK (uses native `fetch`)
