/**
 * @file config.ts
 * @description Configuration schema and constants for the Pyth Network oracle adapter.
 *
 * ## About Pyth Network
 *
 * Pyth Network is a decentralized oracle protocol that provides real-time financial
 * market data directly on-chain. Unlike traditional oracles that push data on a schedule,
 * Pyth uses a "pull oracle" model where price data is published directly by first-party
 * data providers (exchanges, market makers) and aggregated on-chain.
 *
 * ## Clusters
 *
 * Pyth has different deployments for different Solana clusters:
 * - `pythnet`: Pyth's dedicated mainnet. Use this for production SOL/USD prices.
 *   Has faster update frequency and more data providers than the Solana mainnet feed.
 * - `mainnet-beta`: Pyth data available on Solana mainnet (less fresh than pythnet).
 * - `devnet`: Pyth data on Solana devnet. Use this when testing against devnet.
 *
 * For production applications, prefer `pythnet` for SOL/USD as it has:
 * - Sub-second price updates
 * - 15+ contributing data providers
 * - More conservative confidence interval handling
 *
 * ## SOL/USD Feed
 *
 * The canonical SOL/USD price feed ID (hex):
 * `ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`
 *
 * Specific account addresses by network:
 * - mainnet-beta: `H6ARHf6YXhGYeQfUzQNGFVe7obFp6sh4rRHe5WkJvHR9`
 * - devnet: `J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix`
 */

import { z } from 'zod';

/**
 * The Pyth product symbol for SOL/USD.
 *
 * This is the key used to look up the SOL/USD price in `PythHttpClient.getData()`.
 * It follows Pyth's naming convention: `AssetClass.BASE/QUOTE`.
 */
export const PYTH_SOL_USD_SYMBOL = 'Crypto.SOL/USD' as const;

/**
 * The hex-encoded feed ID for the SOL/USD Pyth price feed.
 *
 * This ID is stable across networks and can be used to identify the feed programmatically.
 * Useful when working with the Pyth Price Service (HTTP API) instead of the on-chain client.
 */
export const PYTH_SOL_USD_FEED_ID =
  'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d' as const;

/**
 * On-chain account address for the SOL/USD Pyth price feed on Solana mainnet-beta.
 *
 * Pass this to `pythClient.getAssetPricesFromAccounts()` for efficient targeted queries.
 */
export const PYTH_SOL_USD_MAINNET_ACCOUNT = 'H6ARHf6YXhGYeQfUzQNGFVe7obFp6sh4rRHe5WkJvHR9' as const;

/**
 * On-chain account address for the SOL/USD Pyth price feed on Solana devnet.
 *
 * Use this when testing against devnet to get SOL/USD price data.
 */
export const PYTH_SOL_USD_DEVNET_ACCOUNT = 'J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix' as const;

/**
 * Pyth cluster options for the `@pythnetwork/client` SDK.
 *
 * These map to Pyth's internal cluster naming — different from Solana's cluster names.
 * - `pythnet`: Pyth's dedicated high-frequency mainnet. Best for production price data.
 * - `devnet`: Solana devnet. Use for testing.
 */
export const PYTH_CLUSTERS = ['pythnet', 'devnet'] as const;

/** Type representing a valid Pyth cluster name. */
export type PythCluster = (typeof PYTH_CLUSTERS)[number];

/**
 * Zod schema for validating PythOracleAdapter configuration.
 */
export const pythAdapterConfigSchema = z.object({
  /**
   * The Pyth cluster to connect to.
   *
   * - Use `'pythnet'` for production (mainnet-beta apps)
   * - Use `'devnet'` for development and testing
   */
  cluster: z.enum(PYTH_CLUSTERS),

  /**
   * Maximum acceptable age of the Pyth price feed, in milliseconds.
   *
   * If the most recent price update is older than this, `getSOLPrice()` will throw
   * a `PriceUnavailableError` to prevent using stale data.
   *
   * Default: 60,000ms (60 seconds). For high-frequency fee collection, consider
   * reducing to 10,000ms (10 seconds).
   */
  maxPriceAgeMs: z.number().positive().default(60_000),
});

/**
 * Configuration object for the PythOracleAdapter.
 *
 * @example
 * ```ts
 * const config = pythAdapterConfigSchema.parse({
 *   cluster: 'pythnet',
 *   maxPriceAgeMs: 30_000,  // 30 seconds max staleness
 * });
 * ```
 */
export type PythAdapterConfig = z.infer<typeof pythAdapterConfigSchema>;
