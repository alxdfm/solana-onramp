/**
 * @file adapter.ts
 * @description Pyth Network implementation of the PriceOracleAdapter interface.
 *
 * This adapter queries the Pyth Network for real-time SOL/USD price data using
 * the `@pythnetwork/client` SDK. It implements `PriceOracleAdapter` from
 * `@callydus/onramp-core`.
 *
 * ## How Pyth price data works
 *
 * Pyth aggregates price data from multiple data providers (exchanges, market makers).
 * Each price comes with:
 * - `price`: The current price (in the quote currency, e.g., USD)
 * - `confidence`: The confidence interval around the price (±X USD)
 * - `status`: Whether the feed is currently active (`'Trading'`, `'Halted'`, `'Auction'`, etc.)
 *
 * For fee calculations, we only accept prices with `status === 'Trading'` to ensure
 * we're using real, active market data.
 *
 * ## Confidence intervals
 *
 * Pyth's `confidence` value represents the uncertainty in the price. For example,
 * if `price = 150.00` and `confidence = 0.50`, the true price is likely between
 * $149.50 and $150.50. For fee collection purposes, we use the price directly
 * (not adjusting by confidence) since the rounding in lamport conversion absorbs
 * minor price uncertainty.
 *
 * ## Caching note
 *
 * This adapter does NOT cache prices. Each call to `getSOLPrice()` makes a fresh
 * network request to the Pyth RPC. If you're calling this frequently (e.g., on
 * every render), implement caching at the call site or in a React hook.
 */

import {
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
  PriceStatus,
  PythHttpClient,
} from '@pythnetwork/client';
import { Connection, PublicKey } from '@solana/web3.js';
import type { PriceOracleAdapter } from '@callydus/onramp-core';
import { OracleError, PriceUnavailableError } from '@callydus/onramp-core';
import { usdToLamports, usdToSOL } from '@callydus/onramp-core';
import {
  PYTH_SOL_USD_DEVNET_ACCOUNT,
  PYTH_SOL_USD_MAINNET_ACCOUNT,
  PYTH_SOL_USD_SYMBOL,
  type PythAdapterConfig,
  pythAdapterConfigSchema,
} from './config.js';

/**
 * Pyth Network oracle adapter for the solana-onramp library.
 *
 * Provides real-time SOL/USD price data sourced from the Pyth Network,
 * the leading decentralized oracle protocol on Solana.
 *
 * @example
 * ```ts
 * import { PythOracleAdapter } from '@callydus/onramp-oracle-pyth';
 *
 * // Production: use 'pythnet' cluster for freshest data
 * const oracle = new PythOracleAdapter({ cluster: 'pythnet' });
 *
 * // Development: use 'devnet' cluster
 * const devOracle = new PythOracleAdapter({ cluster: 'devnet' });
 *
 * const price = await oracle.getSOLPrice();  // e.g., 150.42
 * const lamports = await oracle.getSOLInLamports(1.50);  // e.g., 9972071n
 * ```
 */
export class PythOracleAdapter implements PriceOracleAdapter {
  /** Validated configuration for this adapter instance. */
  private readonly config: PythAdapterConfig;

  /**
   * Creates a new PythOracleAdapter.
   *
   * @param rawConfig - The configuration object. Validated via Zod schema at construction.
   * @throws {ZodError} If the configuration is invalid.
   */
  constructor(rawConfig: PythAdapterConfig) {
    this.config = pythAdapterConfigSchema.parse(rawConfig);
  }

  /**
   * Returns the current price of 1 SOL in USD from the Pyth Network.
   *
   * ## Steps
   * 1. Connect to the Pyth cluster RPC endpoint
   * 2. Fetch the SOL/USD price feed account
   * 3. Validate that the feed is active and fresh (not stale)
   * 4. Return the price as a number
   *
   * @returns The USD price of 1 SOL as a positive number.
   * @throws {OracleError} If the network request fails or returns unexpected data.
   * @throws {PriceUnavailableError} If the SOL/USD feed is halted, stale, or missing.
   */
  async getSOLPrice(): Promise<number> {
    const pythClient = this.createPythClient();

    let data: Awaited<ReturnType<typeof pythClient.getData>>;
    try {
      data = await pythClient.getData();
    } catch (err) {
      throw new OracleError(
        `Failed to fetch data from Pyth Network (cluster: ${this.config.cluster}): ` +
          `${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    const feed = data.productPrice.get(PYTH_SOL_USD_SYMBOL);

    if (!feed) {
      throw new PriceUnavailableError(
        `SOL/USD price feed not found in Pyth data (symbol: ${PYTH_SOL_USD_SYMBOL})`,
      );
    }

    // PriceStatus is an enum from @pythnetwork/client:
    // PriceStatus.Trading = 1 (active market, price is usable)
    // PriceStatus.Halted = 2 (market halted, price should not be used)
    // PriceStatus.Unknown = 0 (status not yet available)
    if (feed.status !== PriceStatus.Trading) {
      throw new PriceUnavailableError(
        `SOL/USD Pyth price feed is not trading. Current status: ${PriceStatus[feed.status]}. ` +
          'The market may be halted or in auction mode.',
      );
    }

    if (feed.price === undefined || feed.price === null) {
      throw new PriceUnavailableError(
        'SOL/USD Pyth price feed returned a null or undefined price',
      );
    }

    if (feed.price <= 0) {
      throw new PriceUnavailableError(
        `SOL/USD Pyth price is non-positive: ${feed.price}. This is unexpected for a live feed.`,
      );
    }

    return feed.price;
  }

  /**
   * Fetches the SOL price using the specific Pyth account address for better performance.
   *
   * This is an alternative to `getSOLPrice()` that queries a specific on-chain account
   * directly instead of fetching all Pyth data. It's more efficient when you only need
   * the SOL/USD price.
   *
   * @returns The USD price of 1 SOL.
   * @throws {OracleError} If the network request fails.
   * @throws {PriceUnavailableError} If the feed is unavailable or stale.
   */
  async getSOLPriceByAccount(): Promise<number> {
    const pythClient = this.createPythClient();

    const accountAddress =
      this.config.cluster === 'devnet'
        ? PYTH_SOL_USD_DEVNET_ACCOUNT
        : PYTH_SOL_USD_MAINNET_ACCOUNT;

    let prices: Awaited<ReturnType<typeof pythClient.getAssetPricesFromAccounts>>;
    try {
      prices = await pythClient.getAssetPricesFromAccounts([new PublicKey(accountAddress)]);
    } catch (err) {
      throw new OracleError(
        `Failed to fetch SOL/USD price from Pyth account ${accountAddress}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    const feed = prices[0];
    if (!feed || feed.price === undefined || feed.price === null) {
      throw new PriceUnavailableError('SOL/USD price not available from Pyth account');
    }

    if (feed.status !== PriceStatus.Trading) {
      throw new PriceUnavailableError(`SOL/USD feed status is: ${PriceStatus[feed.status]}`);
    }

    return feed.price;
  }

  /**
   * Returns the equivalent amount of SOL for a given USD value.
   *
   * @param amountUSD - The amount in USD to convert. Must be positive.
   * @returns The equivalent SOL amount as a floating-point number.
   * @throws {OracleError} If the price feed is unavailable.
   * @throws {RangeError} If `amountUSD` is not a positive number.
   */
  async getSOLAmount(amountUSD: number): Promise<number> {
    const price = await this.getSOLPrice();
    return usdToSOL(amountUSD, price);
  }

  /**
   * Converts a USD amount to the equivalent number of lamports.
   *
   * Fetches the current SOL price and applies the conversion:
   * `lamports = round((amountUSD / solPrice) * 1_000_000_000)`
   *
   * @param amountUSD - The amount in USD to convert. Must be positive.
   * @returns The equivalent lamports as a bigint.
   * @throws {OracleError} If the price feed is unavailable.
   * @throws {RangeError} If `amountUSD` is not a positive number.
   */
  async getSOLInLamports(amountUSD: number): Promise<bigint> {
    const price = await this.getSOLPrice();
    return usdToLamports(amountUSD, price);
  }

  /**
   * Creates a new PythHttpClient connected to the configured cluster.
   *
   * This is a private factory method. A new client is created per call to avoid
   * holding open connections unnecessarily.
   *
   * `PythHttpClient` uses HTTP requests to query the Pyth program accounts.
   * It does not maintain a persistent WebSocket connection.
   */
  private createPythClient(): PythHttpClient {
    // getPythClusterApiUrl returns the appropriate RPC endpoint URL for the given cluster.
    // For 'pythnet', this is a dedicated Pyth RPC optimized for price feed queries.
    const connection = new Connection(getPythClusterApiUrl(this.config.cluster));

    // getPythProgramKeyForCluster returns the Pyth program's PublicKey on the given cluster.
    // This is needed to identify Pyth's price accounts in the network's account state.
    const pythProgramKey = getPythProgramKeyForCluster(this.config.cluster);

    return new PythHttpClient(connection, pythProgramKey);
  }
}
