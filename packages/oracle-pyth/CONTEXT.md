# CONTEXT.md — @callydus/onramp-oracle-pyth

## What this package does

Implements the `PriceOracleAdapter` interface from `@callydus/onramp-core` using the
[Pyth Network](https://pyth.network/) — the leading decentralized oracle protocol on Solana.

This adapter provides real-time SOL/USD prices sourced directly from professional market makers
and exchanges that publish data on-chain. It's the recommended oracle for production applications.

## When to use this package

Use `@callydus/onramp-oracle-pyth` when:
- You need high-accuracy, low-latency SOL/USD prices
- You're running in production (mainnet-beta)
- You need cryptographically-verifiable price data
- You want prices aggregated from multiple independent data providers

Prefer `@callydus/onramp-oracle-coingecko` only for:
- Development / local testing (no Solana RPC needed)
- Environments where the Pyth SDK can't be installed (e.g., some edge runtimes)

## Internal structure

```
src/
├── config.ts       # Zod schema + constants (PYTH_SOL_USD_SYMBOL, account addresses)
├── adapter.ts      # PythOracleAdapter class
└── index.ts        # Public re-exports
```

## Cluster selection

| Environment | Recommended cluster |
|---|---|
| Production (mainnet-beta) | `pythnet` (freshest data, most providers) |
| Devnet / testing | `devnet` |
| Local validator | Not supported (Pyth not available locally) |

## Price feed status

The adapter only returns prices with status `'Trading'`. If the feed is `'Halted'`,
`'Auction'`, or `'Unknown'`, a `PriceUnavailableError` is thrown.

## Dependencies

- `@pythnetwork/client` — Pyth Network's official JavaScript client
- `@solana/web3.js` — peer dependency; used for `Connection` and `PublicKey`
- `@callydus/onramp-core` — for the `PriceOracleAdapter` interface and error classes
